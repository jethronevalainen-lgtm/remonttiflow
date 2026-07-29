import type { OfferPricingSettings, OfferVersionTotals } from './offerCalculator';
import { calculateOfferVersionTotals } from './offerCalculator';

export interface OfferPhaseDefinition {
  title: string;
  description: string;
}

export interface OfferPhaseTemplate {
  id: string;
  name: string;
  summary: string;
  suggestedMarginPercent: number;
  suggestedOverheadPercent: number;
  suggestedRiskPercent: number;
  defaultDeliveryTime: string;
  defaultTerms: string;
  phases: OfferPhaseDefinition[];
}

/** Valmiit työvaihepohjat remontti- ja urakkatarjouksiin. */
export const OFFER_PHASE_TEMPLATES: OfferPhaseTemplate[] = [
  {
    id: 'blank',
    name: 'Tyhjä tarjous',
    summary: 'Aloita ilman valmiita vaiheita ja rakenna osiot itse.',
    suggestedMarginPercent: 20,
    suggestedOverheadPercent: 8,
    suggestedRiskPercent: 3,
    defaultDeliveryTime: 'Sovitaan erikseen',
    defaultTerms: 'Tarjous on voimassa ilmoitettuun päivään. Työt aloitetaan sopimuksen jälkeen.',
    phases: [],
  },
  {
    id: 'bathroom',
    name: 'Kylpyhuoneremontti',
    summary: 'Purku, vedeneristys, laatoitus, kalusteet, LVI ja sähkö.',
    suggestedMarginPercent: 22,
    suggestedOverheadPercent: 10,
    suggestedRiskPercent: 5,
    defaultDeliveryTime: '3–5 viikkoa tilauksesta',
    defaultTerms:
      'Tarjous sisältää työt ja materiaalit ilmoitettujen vaiheiden mukaisesti. Piilossa olevat vauriot hinnoitellaan erikseen. Asiakas vastaa käyttöveden ja sähkön kytkennöistä, ellei toisin sovita.',
    phases: [
      { title: 'Suojaus ja purku', description: 'Tilojen suojaus, vanhojen pintojen ja kalusteiden purku, jätehuolto.' },
      { title: 'Vedeneristys', description: 'Alustat, kaadot, vedeneriste ja tarkastus.' },
      { title: 'Laatoitus ja pinnat', description: 'Seinä- ja lattialaatoitus, saumaus, silikonit.' },
      { title: 'Kalusteet ja varusteet', description: 'WC, allas, suihku, peilikaappi ja kiinnitykset.' },
      { title: 'LVI-työt', description: 'Putkivedot, liitokset ja käyttöönotto.' },
      { title: 'Sähkötyöt', description: 'Valaistus, pistorasiat, lattialämmitys ja kytkennät.' },
      { title: 'Siivous ja luovutus', description: 'Loppusiivous, dokumentointi ja luovutus.' },
    ],
  },
  {
    id: 'kitchen',
    name: 'Keittiöremontti',
    summary: 'Purku, runko, kalusteasennus, tasot, LVI ja viimeistely.',
    suggestedMarginPercent: 20,
    suggestedOverheadPercent: 9,
    suggestedRiskPercent: 4,
    defaultDeliveryTime: '4–6 viikkoa tilauksesta',
    defaultTerms:
      'Tarjous kattaa sovitut keittiövaiheet. Kalusteiden toimitusajat vaikuttavat aikatauluun. Muutokset hyväksytään kirjallisesti ennen toteutusta.',
    phases: [
      { title: 'Purku ja suojaus', description: 'Vanhojen kalusteiden purku ja tilojen suojaus.' },
      { title: 'Runko- ja pintatyöt', description: 'Seinä- ja lattiakorjaukset, maalaus tai pinnoitus.' },
      { title: 'Kalusteasennus', description: 'Kaapit, vetolaatikot ja kiinnitykset.' },
      { title: 'Tasot ja välitilat', description: 'Työtasot, välitilalevyt ja listoitukset.' },
      { title: 'LVI ja kodinkoneet', description: 'Vesi-, viemäri- ja koneasennukset.' },
      { title: 'Sähkötyöt', description: 'Valaistus, pistorasiat ja kodinkoneiden kytkennät.' },
      { title: 'Viimeistely', description: 'Listat, siivous ja käyttöönotto-ohjeistus.' },
    ],
  },
  {
    id: 'interior',
    name: 'Asunnon pintaremontti',
    summary: 'Suojaus, tasoitus, maalaus, listat ja siivous.',
    suggestedMarginPercent: 18,
    suggestedOverheadPercent: 8,
    suggestedRiskPercent: 3,
    defaultDeliveryTime: '2–4 viikkoa tilauksesta',
    defaultTerms:
      'Tarjous sisältää näkyvät pintatyöt. Rakennevauriot, asbestikartoitus ja erikoispinnoitteet eivät sisälly, ellei erikseen mainita.',
    phases: [
      { title: 'Suojaus ja valmistelu', description: 'Kalusteiden suojaus, peittotyöt ja työmaa-alue.' },
      { title: 'Purku ja korjaukset', description: 'Vanhojen listojen, tapettien tai pintojen poisto.' },
      { title: 'Tasoitus ja pohjatyöt', description: 'Paikkaukset, tasoitteet ja hionta.' },
      { title: 'Maalaus ja pinnoitus', description: 'Seinät, katot ja tarvittaessa ovet.' },
      { title: 'Listat ja viimeistely', description: 'Jalka-, katto- ja peitelistat.' },
      { title: 'Siivous', description: 'Loppusiivous ja luovutus.' },
    ],
  },
  {
    id: 'facade',
    name: 'Julkisivu- ja ulkotyöt',
    summary: 'Telineet, purku, alustat, pinnoitus ja detaljit.',
    suggestedMarginPercent: 18,
    suggestedOverheadPercent: 12,
    suggestedRiskPercent: 6,
    defaultDeliveryTime: 'Sääolosuhteiden mukaan, arvio 4–8 viikkoa',
    defaultTerms:
      'Ulkotyöt riippuvat säästä. Telineet, suojaukset ja jätehuolto sisältyvät tarjoukseen, ellei toisin ilmoiteta. Piilovauriot hinnoitellaan erikseen.',
    phases: [
      { title: 'Telineet ja suojaus', description: 'Telineet, putoamissuojaus ja ympäristön suojaus.' },
      { title: 'Purku ja avaukset', description: 'Vanhojen pinnoitteiden ja vaurioituneiden osien poisto.' },
      { title: 'Alustatyöt', description: 'Paikkaukset, kiinnitykset ja pohjustus.' },
      { title: 'Pinnoitus', description: 'Rappaus, maalaus tai levytykset.' },
      { title: 'Detaljit ja pellitykset', description: 'Listat, pellitykset ja tiivistykset.' },
      { title: 'Siivous ja purku', description: 'Telineiden purku ja työmaan siivous.' },
    ],
  },
  {
    id: 'maintenance',
    name: 'Huolto- ja korjaustyöt',
    summary: 'Kartoitus, korjaus, materiaalit ja dokumentointi.',
    suggestedMarginPercent: 25,
    suggestedOverheadPercent: 10,
    suggestedRiskPercent: 5,
    defaultDeliveryTime: '1–2 viikkoa tilauksesta',
    defaultTerms:
      'Tarjous perustuu ilmoitettuun laajuuteen. Lisätyöt ja varaosat veloitetaan erikseen hyväksynnän jälkeen.',
    phases: [
      { title: 'Kartoitus', description: 'Kohteen tarkastus ja työsuunnitelma.' },
      { title: 'Korjaustyöt', description: 'Sovitut huolto- ja korjaustoimenpiteet.' },
      { title: 'Materiaalit ja varaosat', description: 'Tarvittavat materiaalit ja hankinnat.' },
      { title: 'Dokumentointi', description: 'Kuvat, mittaukset ja luovutusraportti.' },
    ],
  },
];

export function getOfferPhaseTemplate(id: string): OfferPhaseTemplate {
  return OFFER_PHASE_TEMPLATES.find((template) => template.id === id) ?? OFFER_PHASE_TEMPLATES[0];
}

export interface CalculationStep {
  id: string;
  label: string;
  detail: string;
  amountCents: number;
  tone: 'neutral' | 'cost' | 'sale' | 'tax' | 'total' | 'margin';
  operator?: '+' | '=' | '→';
}

export function buildCalculationSteps(
  totals: OfferVersionTotals,
  settings: OfferPricingSettings,
): CalculationStep[] {
  return [
    {
      id: 'direct',
      label: 'Suorat kustannukset',
      detail: 'Rivien kustannukset hukan jälkeen',
      amountCents: totals.directCostCents,
      tone: 'cost',
    },
    {
      id: 'overhead',
      label: 'Yleiskulut',
      detail: `${settings.overheadPercent} % suorista kustannuksista`,
      amountCents: totals.overheadCents,
      tone: 'cost',
      operator: '+',
    },
    {
      id: 'risk',
      label: 'Riskivaraus',
      detail: `${settings.riskPercent} % (suorat + yleiskulut)`,
      amountCents: totals.riskCents,
      tone: 'cost',
      operator: '+',
    },
    {
      id: 'estimated',
      label: 'Arvioitu kokonaiskustannus',
      detail: 'Sisäinen kustannuspohja hinnoittelulle',
      amountCents: totals.estimatedCostCents,
      tone: 'neutral',
      operator: '=',
    },
    {
      id: 'sale',
      label: 'Veroton myyntihinta',
      detail: `Tavoitekate ${settings.targetMarginPercent} % myynnistä`,
      amountCents: totals.saleSubtotalCents,
      tone: 'sale',
      operator: '→',
    },
    {
      id: 'margin',
      label: 'Arvioitu kate',
      detail: `${totals.grossMarginPercent.toFixed(1)} % myynnistä`,
      amountCents: totals.grossMarginCents,
      tone: 'margin',
    },
    {
      id: 'vat',
      label: 'ALV',
      detail: `${settings.vatRate} % verottomasta myynnistä`,
      amountCents: totals.vatCents,
      tone: 'tax',
      operator: '+',
    },
    {
      id: 'total',
      label: 'Tarjous yhteensä',
      detail: 'Asiakkaalle näkyvä loppusumma',
      amountCents: totals.totalCents,
      tone: 'total',
      operator: '=',
    },
  ];
}

export function buildCalculationStepsFromLines(
  lines: Array<{
    quantity: number;
    costUnitPriceCents: number;
    saleUnitPriceCents: number;
    wastePercent?: number;
    discountPercent?: number;
    optional?: boolean;
  }>,
  settings: OfferPricingSettings,
): CalculationStep[] {
  return buildCalculationSteps(calculateOfferVersionTotals(lines, settings), settings);
}

export function mergePhaseSelections(
  templateId: string,
  extraPhases: OfferPhaseDefinition[],
): OfferPhaseDefinition[] {
  const template = getOfferPhaseTemplate(templateId);
  const merged = [...template.phases];
  for (const phase of extraPhases) {
    const title = phase.title.trim();
    if (!title) continue;
    if (merged.some((item) => item.title.toLocaleLowerCase('fi-FI') === title.toLocaleLowerCase('fi-FI'))) {
      continue;
    }
    merged.push({ title, description: phase.description.trim() });
  }
  return merged;
}
