import { BRAND } from '../config/brand';
import type {
  Project, WorkOrder, TimeEntry, Employee, Equipment,
  Customer, CrmLead, DiaryEntry, SafetyItem, WasteEntry,
  DrivingLogEntry, Announcement, Message,
} from '../types';

export const initialProjects: Project[] = [
  { id: 'PROJ-1', name: 'Korjaustyö Tampere', customer: 'As Oy Tampereen Keskusta', status: 'Aktiivinen', startDate: '2025-03-01', endDate: '2026-09-30', progress: 47, budget: 450000, spent: 211500, location: 'Tampere' },
  { id: 'PROJ-2', name: 'Uudisrakennus Espoo', customer: 'Rakennus Oy Helsinki', status: 'Aktiivinen', startDate: '2024-06-01', endDate: '2026-12-15', progress: 92, budget: 1200000, spent: 1104000, location: 'Espoo' },
  { id: 'PROJ-3', name: 'Saneeraus Helsinki', customer: 'Kiinteistöhuolto Keskus Oy', status: 'Aktiivinen', startDate: '2026-06-01', endDate: '2026-11-30', progress: 15, budget: 280000, spent: 42000, location: 'Helsinki' },
  { id: 'PROJ-4', name: 'Piha-alue Turku', customer: 'Perhe Korhonen', status: 'Aktiivinen', startDate: '2025-08-15', endDate: '2026-10-31', progress: 73, budget: 85000, spent: 62050, location: 'Turku' },
  { id: 'PROJ-5', name: 'LVI-remontti Vantaa', customer: 'Liisa Virtanen', status: 'Valmis', startDate: '2025-01-10', endDate: '2026-03-20', progress: 100, budget: 35000, spent: 34000, location: 'Vantaa' },
  { id: 'PROJ-6', name: 'Kattoremontti Oulu', customer: 'Taloyhtiö Tähtipolku', status: 'Suunniteltu', startDate: '2026-09-01', endDate: '2027-05-31', progress: 0, budget: 650000, spent: 0, location: 'Oulu' },
  { id: 'PROJ-7', name: 'Julkisivuremontti Tampere', customer: 'As Oy Hervanta', status: 'Aktiivinen', startDate: '2025-05-01', endDate: '2026-12-31', progress: 68, budget: 2100000, spent: 1428000, location: 'Tampere' },
  { id: 'PROJ-8', name: 'Toimistoremontti Helsinki', customer: 'Rakennus Oy Helsinki', status: 'Myöhässä', startDate: '2026-01-15', endDate: '2026-06-30', progress: 45, budget: 180000, spent: 81000, location: 'Helsinki' },
  { id: 'PROJ-9', name: 'Putkistosaneeraus', customer: 'As Oy Tampereen Keskusta', status: 'Valmis', startDate: '2024-09-01', endDate: '2026-04-30', progress: 100, budget: 890000, spent: 875000, location: 'Tampere' },
  { id: 'PROJ-10', name: 'Kylpyhuoneremontti Espoo', customer: 'Matti Meikäläinen', status: 'Suunniteltu', startDate: '2026-10-01', endDate: '2026-12-15', progress: 0, budget: 28000, spent: 0, location: 'Espoo' },
];

export const initialWorkOrders: WorkOrder[] = [
  { id: 'TM-2025-001', title: 'LVI-asennus kerrostalo', project: 'Korjaustyö Tampere', assignee: 'Jukka L.', dueDate: '2026-07-24', priority: 'Korkea', status: 'Käynnissä', description: 'LVI-asennukset kylpyhuoneisiin' },
  { id: 'TM-2025-002', title: 'Rakennustyömaa valvonta', project: 'Uudisrakennus Espoo', assignee: 'Pekka S.', dueDate: '2026-07-25', priority: 'Normaali', status: 'Avoin', description: 'Päivittäinen työmaavalvonta' },
  { id: 'TM-2025-003', title: 'Ikkunoiden asennus', project: 'Saneeraus Helsinki', assignee: 'Anna L.', dueDate: '2026-07-26', priority: 'Korkea', status: 'Käynnissä', description: 'Uusien ikkunoiden asennus' },
  { id: 'TM-2025-004', title: 'Lattialämmitys', project: 'Korjaustyö Tampere', assignee: 'Liisa R.', dueDate: '2026-07-28', priority: 'Normaali', status: 'Odottaa', description: 'Lattialämmitysjärjestelmän asennus' },
  { id: 'TM-2025-005', title: 'Sähkötyöt', project: 'Uudisrakennus Espoo', assignee: 'Matti K.', dueDate: '2026-07-20', priority: 'Korkea', status: 'Käynnissä', description: 'Sähköasennukset', type: 'Sähkötyö' },
  { id: 'TM-2025-006', title: 'Maalaustyöt', project: 'Piha-alue Turku', assignee: 'Sari K.', dueDate: '2026-08-01', priority: 'Matala', status: 'Avoin', description: 'Ulkomaalaustyöt' },
  { id: 'TM-2025-007', title: 'Laatoitus', project: 'Saneeraus Helsinki', assignee: 'Tomi H.', dueDate: '2026-08-05', priority: 'Normaali', status: 'Avoin', description: 'Kylpyhuoneen laatoitus' },
  { id: 'TM-2025-008', title: 'Putkityöt', project: 'Korjaustyö Tampere', assignee: 'Juha M.', dueDate: '2026-07-30', priority: 'Korkea', status: 'Käynnissä', description: 'Putkistojen uusiminen' },
];

export const initialTimeEntries: TimeEntry[] = [
  { id: 'TK-1', date: '2026-07-22', employee: 'Matti Meikäläinen', project: 'Korjaustyö Tampere', hours: 8, overtime: 0, description: 'Työnjohto', status: 'Hyväksytty' },
  { id: 'TK-2', date: '2026-07-22', employee: 'Jukka Lehtonen', project: 'Korjaustyö Tampere', hours: 8, overtime: 2, description: 'LVI-asennus', status: 'Hyväksytty' },
  { id: 'TK-3', date: '2026-07-22', employee: 'Anna Lahtinen', project: 'Saneeraus Helsinki', hours: 7.5, overtime: 0, description: 'Ikkuna-asennus', status: 'Odottaa' },
  { id: 'TK-4', date: '2026-07-22', employee: 'Pekka Seppänen', project: 'Uudisrakennus Espoo', hours: 8, overtime: 0, description: 'Valvonta', status: 'Hyväksytty' },
  { id: 'TK-5', date: '2026-07-21', employee: 'Liisa Rantanen', project: 'Korjaustyö Tampere', hours: 6, overtime: 0, description: 'Lattialämmitys', status: 'Hyväksytty' },
];

export const initialEmployees: Employee[] = [
  { id: 'EMP1', name: 'Matti Meikäläinen', role: 'Työnjohtaja', department: 'Työnjohto', phone: '040-1234567', email: `matti.meikalainen@${BRAND.emailDomain}`, startDate: '2018-01-15', status: 'Aktiivinen', projects: 4, hours: 1680, training: 6, certifications: ['Rakennusmestari', 'Työturvallisuuskortti'] },
  { id: 'EMP2', name: 'Liisa Virtanen', role: 'Projektipäällikkö', department: 'Hallinto', phone: '040-2345678', email: `liisa.virtanen@${BRAND.emailDomain}`, startDate: '2019-03-01', status: 'Aktiivinen', projects: 3, hours: 1600, training: 5, certifications: ['Projektinhallinnan ammattitutkinto'] },
  { id: 'EMP3', name: 'Jukka Lehtonen', role: 'LVI-asentaja', department: 'LVI', phone: '040-3456789', email: `jukka.lehtonen@${BRAND.emailDomain}`, startDate: '2020-06-01', status: 'Aktiivinen', projects: 2, hours: 1520, training: 4, certifications: ['LVI-perustutkinto', 'Työturvallisuuskortti'] },
  { id: 'EMP4', name: 'Anna Lahtinen', role: 'Rakennusmies', department: 'Rakennus', phone: '040-4567890', email: `anna.lahtinen@${BRAND.emailDomain}`, startDate: '2021-02-15', status: 'Aktiivinen', projects: 2, hours: 1450, training: 3, certifications: ['Rakennusalan perustutkinto'] },
  { id: 'EMP5', name: 'Pekka Seppänen', role: 'Sähköasentaja', department: 'Sähkö', phone: '040-5678901', email: `pekka.seppanen@${BRAND.emailDomain}`, startDate: '2020-09-01', status: 'Aktiivinen', projects: 1, hours: 1550, training: 4, certifications: ['Sähkötekniikan perustutkinto', 'Sähköturvallisuus S2'] },
];

export const initialEquipment: Equipment[] = [
  { id: 'KAL-1', name: 'Komatsu PC138', type: 'Kaivinkone', serial: 'K-2023-001', location: 'Tampere', status: 'Käytössä', lastMaintenance: '2026-06-15' },
  { id: 'KAL-2', name: 'Volvo EC220E', type: 'Kaivinkone', serial: 'K-2022-015', location: 'Espoo', status: 'Käytössä', lastMaintenance: '2026-05-20' },
  { id: 'KAL-3', name: 'Scania G450', type: 'Kuorma-auto', serial: 'KU-2021-003', location: 'Helsinki', status: 'Vapaa', lastMaintenance: '2026-07-01' },
  { id: 'KAL-4', name: 'Hilti TE 2000', type: 'Työkalu', serial: 'T-2024-112', location: 'Tampere', status: 'Käytössä', lastMaintenance: '2026-07-10' },
  { id: 'KAL-5', name: 'PERI UP Telineet', type: 'Telineet', serial: 'TE-2023-045', location: 'Espoo', status: 'Käytössä', lastMaintenance: '2026-04-12' },
];

export const initialCustomers: Customer[] = [
  { id: 'AS-001', name: 'As Oy Tampereen Keskusta', type: 'Taloyhtiö', contactPerson: 'Matti Mäkinen', phone: '03-1234567', email: 'hallitus@aytampere.fi', address: 'Hämeenkatu 12, 33100 Tampere', projectCount: 3, lastContact: '22.7.2026', status: 'Aktiivinen' },
  { id: 'AS-002', name: 'Rakennus Oy Helsinki', type: 'Yritys', contactPerson: 'Anna Lindqvist', phone: '09-2345678', email: 'anna@rakennusoy.fi', address: 'Mannerheimintie 25, 00100 Helsinki', projectCount: 4, lastContact: '21.7.2026', status: 'Aktiivinen' },
  { id: 'AS-003', name: 'Kiinteistöhuolto Keskus Oy', type: 'Yritys', contactPerson: 'Pekka Korhonen', phone: '09-3456789', email: 'pekka@khkeskus.fi', address: 'Fredrikinkatu 8, 00120 Helsinki', projectCount: 2, lastContact: '20.7.2026', status: 'Aktiivinen' },
  { id: 'AS-004', name: 'Perhe Korhonen', type: 'Yksityinen', contactPerson: 'Maria Korhonen', phone: '040-4567890', email: 'maria.korhonen@email.fi', address: 'Mäkitie 5, 90100 Oulu', projectCount: 2, lastContact: '18.7.2026', status: 'Aktiivinen' },
];

export const initialCrmLeads: CrmLead[] = [
  { id: 'LEAD-1', name: 'Korjaustyö Lahti', company: 'As Oy Lahden Keskusta', value: 320000, stage: 'Uusi', assignee: 'Liisa Virtanen', date: '2026-07-20' },
  { id: 'LEAD-2', name: 'Uudisrakennus Jyväskylä', company: 'Rakennus Oy Jyväskylä', value: 850000, stage: 'Tarjous tehty', assignee: 'Matti Meikäläinen', date: '2026-07-15' },
  { id: 'LEAD-3', name: 'Saneeraus Tampere', company: 'Kiinteistö Oy Tampere', value: 420000, stage: 'Neuvottelu', assignee: 'Liisa Virtanen', date: '2026-07-10' },
];

export const initialDiaryEntries: DiaryEntry[] = [
  { id: 'PK-1', date: '2026-07-22', project: 'Korjaustyö Tampere', author: 'Matti Meikäläinen', weather: 'Aurinkoinen', temperature: '22°C', workers: 8, workDescription: 'LVI-asennukset etenivät suunnitellusti.' },
  { id: 'PK-2', date: '2026-07-22', project: 'Uudisrakennus Espoo', author: 'Pekka Seppänen', weather: 'Pilvinen', temperature: '19°C', workers: 12, workDescription: 'Sähköasennukset etenivät.' },
];

export const initialSafetyItems: SafetyItem[] = [
  { id: 'TURV-1', type: 'incident', title: 'Liukastuminen työmaalla', date: '2026-07-15', severity: 'Lievä', status: 'Käsitelty' },
  { id: 'TURV-2', type: 'risk', title: 'Putoamisvaara telineillä', date: '2026-07-10', severity: 'Keskitasoinen', status: 'Toimenpiteet käynnissä' },
];

export const initialWasteEntries: WasteEntry[] = [
  { id: 'JATE-1', date: '2026-07-22', project: 'Korjaustyö Tampere', wasteType: 'Sekajäte', amount: 450, method: 'Kaatopaikka', cost: 890 },
  { id: 'JATE-2', date: '2026-07-22', project: 'Uudisrakennus Espoo', wasteType: 'Metalli', amount: 320, method: 'Kierrätys', cost: 0 },
];

export const initialDrivingLog: DrivingLogEntry[] = [
  { id: 'AJO-1', date: '2026-07-22', driver: 'Matti Meikäläinen', vehicle: 'Toyota Hilux', startAddress: 'Tampere, Keskusta', endAddress: 'Tampere, Hervanta', distance: 12, purpose: 'Työmaakäynti' },
];

export const initialAnnouncements: Announcement[] = [
  { id: 'TIED-1', title: 'Kesälomajärjestelyt 2026', content: 'Kesälomakausi alkaa 1.6.2026.', author: 'Hallinto', date: '2026-04-01', priority: 'Tärkeä' },
];

export const initialMessages: Message[] = [
  { id: 'VIESTI-1', sender: 'Matti Meikäläinen', recipient: 'Kaikki', content: 'Hyvää huomenta!', timestamp: '2026-07-22T07:30:00', read: true },
];
