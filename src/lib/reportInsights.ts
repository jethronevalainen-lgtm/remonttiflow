import type {
  ReportCenterBreakdown,
  ReportCenterContext,
  ReportCenterDataset,
  ReportCenterInsight,
  ReportCenterRow,
} from '@/lib/supabase/reportCenter';

type NumericMap = Map<string, number>;

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, fallback = 'Ei tietoa'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function addToMap(target: NumericMap, label: string, value: number): void {
  target.set(label, (target.get(label) ?? 0) + value);
}

function topRows(source: NumericMap, limit = 8): Array<{ label: string; value: number }> {
  return [...source.entries()]
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'fi'))
    .slice(0, limit);
}

function nonEmptyBreakdowns(...items: ReportCenterBreakdown[]): ReportCenterBreakdown[] {
  return items.filter((item) => item.rows.length > 0);
}

function dateOnly(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function generatedDay(dataset: ReportCenterDataset): Date {
  const parsed = new Date(dataset.generatedAt);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function percentage(part: number, total: number): number {
  return total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0;
}

function successInsight(title: string, description: string): ReportCenterInsight {
  return { id: `success-${title}`, severity: 'success', title, description };
}

function emptyAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  return {
    summary: dataset.summary,
    insights: [{
      id: 'empty-report',
      severity: 'info',
      title: 'Rajauksella ei ole aineistoa',
      description: 'Raportti muodostui onnistuneesti, mutta valittu ajanjakso ja rajaukset eivät sisältäneet rivejä.',
    }],
    breakdowns: [],
  };
}

function timeEntryAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const employees: NumericMap = new Map();
  const projects: NumericMap = new Map();
  let approvedRows = 0;
  let pendingRows = 0;
  let rejectedRows = 0;
  let missingDescriptions = 0;
  let totalRecordedHours = 0;

  for (const row of dataset.rows) {
    const recordedHours = numberValue(row.hours) + numberValue(row.overtime);
    totalRecordedHours += recordedHours;
    addToMap(employees, textValue(row.employee), recordedHours);
    addToMap(projects, textValue(row.project, 'Ei projektia'), recordedHours);
    const status = textValue(row.status, '');
    if (status === 'Hyväksytty') approvedRows += 1;
    if (status === 'Odottaa') pendingRows += 1;
    if (status === 'Hylätty') rejectedRows += 1;
    if (!textValue(row.description, '').trim()) missingDescriptions += 1;
  }

  const insights: ReportCenterInsight[] = [];
  if (rejectedRows > 0) insights.push({
    id: 'rejected-time-entries', severity: 'critical', title: 'Hylättyjä tuntikirjauksia',
    description: 'Hylätyt kirjaukset vaativat korjauksen ennen palkka- tai laskutusaineiston muodostamista.',
    value: rejectedRows, format: 'number',
  });
  if (pendingRows > 0) insights.push({
    id: 'pending-time-entries', severity: 'warning', title: 'Hyväksyntää odottavia tunteja',
    description: 'Keskeneräiset hyväksynnät heikentävät palkka- ja projektiseurannan ajantasaisuutta.',
    value: pendingRows, format: 'number',
  });
  if (missingDescriptions > 0) insights.push({
    id: 'missing-time-descriptions', severity: 'warning', title: 'Työseloste puuttuu',
    description: 'Puuttuva työseloste vaikeuttaa työn todentamista, laskutusta ja jälkiselvityksiä.',
    value: missingDescriptions, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Tuntiaineisto on kunnossa', 'Rajauksella ei ole hylättyjä tai odottavia kirjauksia eikä puuttuvia työselosteita.'));

  return {
    summary: {
      ...dataset.summary,
      totalRecordedHours: Number(totalRecordedHours.toFixed(2)),
      approvedRows,
      pendingRows,
      rejectedRows,
      missingDescriptions,
      approvalRate: percentage(approvedRows, dataset.rows.length),
    },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      { id: 'hours-by-employee', title: 'Tunnit henkilöittäin', description: 'Säännöllinen työaika ja ylityö yhteensä.', format: 'hours', rows: topRows(employees) },
      { id: 'hours-by-project', title: 'Tunnit projekteittain', description: 'Kirjatut tunnit valitulla ajanjaksolla.', format: 'hours', rows: topRows(projects) },
    ),
  };
}

function workDescriptionAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const employees: NumericMap = new Map();
  const projects: NumericMap = new Map();
  let missingDescriptions = 0;
  let shortDescriptions = 0;
  let pendingRows = 0;

  for (const row of dataset.rows) {
    const description = textValue(row.description, '');
    if (!description) missingDescriptions += 1;
    else if (description.length < 20) shortDescriptions += 1;
    if (row.status === 'Odottaa') pendingRows += 1;
    addToMap(employees, textValue(row.employee), numberValue(row.hours));
    addToMap(projects, textValue(row.project, 'Ei projektia'), numberValue(row.hours));
  }

  const insights: ReportCenterInsight[] = [];
  if (missingDescriptions > 0) insights.push({
    id: 'missing-descriptions', severity: 'critical', title: 'Työseloste puuttuu kokonaan',
    description: 'Kirjaus ei kerro, mitä työmaalla tehtiin. Täydennä seloste ennen hyväksyntää tai laskutusta.',
    value: missingDescriptions, format: 'number',
  });
  if (shortDescriptions > 0) insights.push({
    id: 'short-descriptions', severity: 'warning', title: 'Liian lyhyitä työselosteita',
    description: 'Alle 20 merkin seloste ei yleensä yksilöi tehtyä työtä riittävästi.',
    value: shortDescriptions, format: 'number',
  });
  if (pendingRows > 0) insights.push({
    id: 'pending-descriptions', severity: 'warning', title: 'Selosteita odottaa hyväksyntää',
    description: 'Tarkista sisältö ja työmääräyskohdistus ennen hyväksymistä.',
    value: pendingRows, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Työselosteet ovat käyttökelpoisia', 'Selosteet on täytetty riittävän yksilöivästi eikä hyväksyntäjonoa ole.'));

  return {
    summary: { ...dataset.summary, missingDescriptions, shortDescriptions, pendingRows },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      { id: 'description-hours-by-employee', title: 'Selostetut tunnit henkilöittäin', description: 'Työselosteisiin liittyvät tunnit.', format: 'hours', rows: topRows(employees) },
      { id: 'description-hours-by-project', title: 'Selostetut tunnit projekteittain', description: 'Työselosteiden tuntijakauma.', format: 'hours', rows: topRows(projects) },
    ),
  };
}

function presenceAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const projects: NumericMap = new Map();
  const employees: NumericMap = new Map();
  let openCheckIns = 0;
  let outsideGeofence = 0;
  let weakLocation = 0;
  let longPresence = 0;

  for (const row of dataset.rows) {
    const duration = numberValue(row.durationHours);
    addToMap(projects, textValue(row.project, 'Ei projektia'), duration);
    addToMap(employees, textValue(row.employee), duration);
    if (!row.checkedOutAt) openCheckIns += 1;
    if (row.withinGeofence !== null && row.withinGeofence !== undefined && !booleanValue(row.withinGeofence)) outsideGeofence += 1;
    if (numberValue(row.accuracyM) > 100) weakLocation += 1;
    if (duration > 12) longPresence += 1;
  }

  const insights: ReportCenterInsight[] = [];
  if (longPresence > 0) insights.push({
    id: 'long-presence', severity: 'critical', title: 'Yli 12 tunnin läsnäoloja',
    description: 'Pitkä tai avoimeksi jäänyt kirjautuminen on tarkistettava työaika- ja työturvallisuussyistä.',
    value: longPresence, format: 'number',
  });
  if (openCheckIns > 0) insights.push({
    id: 'open-check-ins', severity: 'warning', title: 'Avoimia työmaakirjautumisia',
    description: 'Uloskirjautuminen puuttuu. Tarkista, onko työ edelleen käynnissä vai jäikö kirjaus avoimeksi.',
    value: openCheckIns, format: 'number',
  });
  if (outsideGeofence > 0) insights.push({
    id: 'outside-geofence', severity: 'warning', title: 'Kirjautumisia työmaa-alueen ulkopuolella',
    description: 'Sijainti ei vastannut projektin määriteltyä työmaa-aluetta kirjautumishetkellä.',
    value: outsideGeofence, format: 'number',
  });
  if (weakLocation > 0) insights.push({
    id: 'weak-location', severity: 'info', title: 'Heikkoja sijaintivarmennuksia',
    description: 'Paikannustarkkuus oli yli 100 metriä, joten sijaintitieto ei yksin riitä varmaan todentamiseen.',
    value: weakLocation, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Läsnäolokirjaukset ovat kunnossa', 'Avoimia, poikkeuksellisen pitkiä tai sijaintipoikkeamia sisältäviä kirjautumisia ei löytynyt.'));

  return {
    summary: { ...dataset.summary, openCheckIns, outsideGeofence, weakLocation, longPresence },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      { id: 'presence-by-project', title: 'Läsnäoloaika työmaittain', description: 'Sisään- ja uloskirjausten perusteella.', format: 'hours', rows: topRows(projects) },
      { id: 'presence-by-employee', title: 'Läsnäoloaika henkilöittäin', description: 'Kirjattu läsnäoloaika valitulla ajanjaksolla.', format: 'hours', rows: topRows(employees) },
    ),
  };
}

function travelAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const categories: NumericMap = new Map();
  const projects: NumericMap = new Map();
  let pendingAmountEur = 0;
  let rejectedAmountEur = 0;
  let missingAttachments = 0;
  let approvedRows = 0;

  for (const row of dataset.rows) {
    const amount = numberValue(row.amountEur);
    addToMap(categories, textValue(row.type, 'Muu'), amount);
    addToMap(projects, textValue(row.project, 'Ei projektia'), amount);
    if (row.status === 'Odottaa') pendingAmountEur += amount;
    if (row.status === 'Hylätty') rejectedAmountEur += amount;
    if (row.status === 'Hyväksytty') approvedRows += 1;
    if (!booleanValue(row.hasAttachment)) missingAttachments += 1;
  }

  const insights: ReportCenterInsight[] = [];
  if (rejectedAmountEur > 0) insights.push({
    id: 'rejected-expenses', severity: 'critical', title: 'Hylättyjä kuluja',
    description: 'Hylätyt kulut on korjattava tai poistettava ennen palkka- tai laskutusaineistoa.',
    value: Number(rejectedAmountEur.toFixed(2)), format: 'money',
  });
  if (pendingAmountEur > 0) insights.push({
    id: 'pending-expenses', severity: 'warning', title: 'Kuluja odottaa hyväksyntää',
    description: 'Avoin hyväksyntäjono vaikuttaa maksettavaan ja laskutettavaan kokonaismäärään.',
    value: Number(pendingAmountEur.toFixed(2)), format: 'money',
  });
  if (missingAttachments > 0) insights.push({
    id: 'missing-expense-attachments', severity: 'warning', title: 'Kuitteja tai liitteitä puuttuu',
    description: 'Tositteeton kulu vaatii erillisen tarkistuksen ennen hyväksymistä.',
    value: missingAttachments, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Kuluaineisto on käsittelykelpoinen', 'Rajauksella ei ole hylättyjä, odottavia tai liitteettömiä kuluja.'));

  return {
    summary: {
      ...dataset.summary,
      pendingAmountEur: Number(pendingAmountEur.toFixed(2)),
      rejectedAmountEur: Number(rejectedAmountEur.toFixed(2)),
      missingAttachments,
      approvalRate: percentage(approvedRows, dataset.rows.length),
    },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      { id: 'expenses-by-type', title: 'Kulut kululajeittain', description: 'Kulujen euromääräinen jakauma.', format: 'money', rows: topRows(categories) },
      { id: 'expenses-by-project', title: 'Kulut projekteittain', description: 'Kohdistetut kulut valitulla ajanjaksolla.', format: 'money', rows: topRows(projects) },
    ),
  };
}

function projectAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const statusCounts: NumericMap = new Map();
  const budgetRows: ReportCenterBreakdown['rows'] = [];
  let overBudgetProjects = 0;
  let overBudgetEur = 0;
  let delayedProjects = 0;
  let pendingHours = 0;
  let openWorkOrders = 0;

  for (const row of dataset.rows) {
    const budget = numberValue(row.budgetEur);
    const spent = numberValue(row.spentEur);
    const status = textValue(row.status);
    addToMap(statusCounts, status, 1);
    if (budget > 0 && spent > budget) {
      overBudgetProjects += 1;
      overBudgetEur += spent - budget;
    }
    if (status === 'Myöhässä') delayedProjects += 1;
    pendingHours += numberValue(row.pendingHours);
    openWorkOrders += numberValue(row.openWorkOrders);
    budgetRows.push({
      label: textValue(row.name, 'Nimetön projekti'),
      value: Number(spent.toFixed(2)),
      secondaryValue: Number(budget.toFixed(2)),
    });
  }

  const insights: ReportCenterInsight[] = [];
  if (overBudgetProjects > 0) insights.push({
    id: 'over-budget-projects', severity: 'critical', title: 'Budjetin ylittäneitä projekteja',
    description: 'Toteuma ylittää asetetun budjetin. Tarkista kustannukset, lisätyöt ja laskutus.',
    value: overBudgetProjects, format: 'number',
  });
  if (delayedProjects > 0) insights.push({
    id: 'delayed-projects', severity: 'critical', title: 'Myöhässä olevia projekteja',
    description: 'Projektin tila on merkitty myöhästyneeksi ja vaatii aikataulu- tai resurssitoimenpiteitä.',
    value: delayedProjects, format: 'number',
  });
  if (pendingHours > 0) insights.push({
    id: 'pending-project-hours', severity: 'warning', title: 'Projekteilla odottavia tunteja',
    description: 'Hyväksymättömät tunnit eivät vielä muodosta luotettavaa kustannus- tai laskutuspohjaa.',
    value: Number(pendingHours.toFixed(2)), format: 'hours',
  });
  if (openWorkOrders > 0) insights.push({
    id: 'open-work-orders', severity: 'info', title: 'Avoimia työmääräyksiä',
    description: 'Avoimet tehtävät kannattaa suhteuttaa projektin valmiusasteeseen ja tavoitepäivään.',
    value: openWorkOrders, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Projektikanta on hallinnassa', 'Budjetti-, aikataulu- tai hyväksyntäpoikkeamia ei löytynyt valitulla rajauksella.'));

  return {
    summary: {
      ...dataset.summary,
      overBudgetProjects,
      overBudgetEur: Number(overBudgetEur.toFixed(2)),
      delayedProjects,
      pendingHours: Number(pendingHours.toFixed(2)),
      openWorkOrders,
    },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      {
        id: 'project-budget', title: 'Projektien toteuma ja budjetti',
        description: 'Toteuma verrattuna projektin asetettuun budjettiin.', format: 'money', secondaryFormat: 'money',
        valueLabel: 'Toteuma', secondaryValueLabel: 'Budjetti',
        rows: budgetRows.sort((left, right) => right.value - left.value).slice(0, 8),
      },
      { id: 'project-statuses', title: 'Projektit tiloittain', description: 'Projektikannan nykyinen tilajakauma.', format: 'number', rows: topRows(statusCounts) },
    ),
  };
}

function equipmentAnalysis(dataset: ReportCenterDataset): Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'> {
  const statusCounts: NumericMap = new Map();
  const projectCounts: NumericMap = new Map();
  const today = generatedDay(dataset);
  const dueLimit = new Date(today);
  dueLimit.setDate(dueLimit.getDate() + 30);
  let overdueMaintenance = 0;
  let dueSoonMaintenance = 0;
  let unassignedEquipment = 0;
  let inMaintenance = 0;

  for (const row of dataset.rows) {
    const status = textValue(row.status);
    addToMap(statusCounts, status, 1);
    addToMap(projectCounts, textValue(row.project, 'Ei projektia'), 1);
    if (status === 'Huollossa') inMaintenance += 1;
    if (!textValue(row.responsible, '')) unassignedEquipment += 1;
    const nextMaintenance = dateOnly(row.nextMaintenance);
    if (nextMaintenance && nextMaintenance < today) overdueMaintenance += 1;
    else if (nextMaintenance && nextMaintenance <= dueLimit) dueSoonMaintenance += 1;
  }

  const insights: ReportCenterInsight[] = [];
  if (overdueMaintenance > 0) insights.push({
    id: 'overdue-maintenance', severity: 'critical', title: 'Huolto on myöhässä',
    description: 'Kaluston seuraava huoltopäivä on ohitettu. Käyttöturvallisuus ja huoltohistoria on tarkistettava.',
    value: overdueMaintenance, format: 'number',
  });
  if (dueSoonMaintenance > 0) insights.push({
    id: 'due-maintenance', severity: 'warning', title: 'Huoltoja erääntyy 30 päivän sisällä',
    description: 'Varaa huolto ja varmista korvaava kalusto ennen käyttökatkoa.',
    value: dueSoonMaintenance, format: 'number',
  });
  if (unassignedEquipment > 0) insights.push({
    id: 'unassigned-equipment', severity: 'warning', title: 'Kalustolta puuttuu vastuuhenkilö',
    description: 'Vastuuhenkilö helpottaa sijainnin, kunnon ja palautuksen seurantaa.',
    value: unassignedEquipment, format: 'number',
  });
  if (inMaintenance > 0) insights.push({
    id: 'equipment-in-maintenance', severity: 'info', title: 'Kalustoa huollossa',
    description: 'Huollossa oleva kalusto ei ole normaalisti varattavissa työmaille.',
    value: inMaintenance, format: 'number',
  });
  if (!insights.length) insights.push(successInsight('Kaluston huoltotilanne on kunnossa', 'Myöhässä olevia huoltoja tai vastuuhenkilöttömiä kalustoja ei löytynyt.'));

  return {
    summary: { ...dataset.summary, overdueMaintenance, dueSoonMaintenance, unassignedEquipment, inMaintenance },
    insights: insights.slice(0, 4),
    breakdowns: nonEmptyBreakdowns(
      { id: 'equipment-statuses', title: 'Kalusto tiloittain', description: 'Kalustorekisterin nykyinen tilajakauma.', format: 'number', rows: topRows(statusCounts) },
      { id: 'equipment-projects', title: 'Kalusto projekteittain', description: 'Nykyinen projektikohdistus.', format: 'number', rows: topRows(projectCounts) },
    ),
  };
}

export function enrichReportDataset(dataset: ReportCenterDataset, context: ReportCenterContext): ReportCenterDataset {
  if (!dataset.rows.length) return { ...dataset, context, ...emptyAnalysis(dataset) };

  let analysis: Pick<ReportCenterDataset, 'summary' | 'insights' | 'breakdowns'>;
  switch (dataset.reportType) {
    case 'time_entries': analysis = timeEntryAnalysis(dataset); break;
    case 'work_descriptions': analysis = workDescriptionAnalysis(dataset); break;
    case 'site_presence': analysis = presenceAnalysis(dataset); break;
    case 'travel_expenses': analysis = travelAnalysis(dataset); break;
    case 'projects': analysis = projectAnalysis(dataset); break;
    case 'equipment': analysis = equipmentAnalysis(dataset); break;
    default: analysis = { summary: dataset.summary, insights: [], breakdowns: [] };
  }

  return { ...dataset, context, ...analysis };
}

export function searchableReportRow(row: ReportCenterRow): string {
  return Object.values(row).map((value) => String(value ?? '')).join(' ').toLocaleLowerCase('fi');
}
