import { useLocalStorage } from './useLocalStorage';
import {
  initialProjects,
  initialWorkOrders,
  initialTimeEntries,
  initialEmployees,
  initialEquipment,
  initialCustomers,
  initialCrmLeads,
  initialDiaryEntries,
  initialSafetyItems,
  initialWasteEntries,
  initialDrivingLog,
  initialAnnouncements,
  initialMessages,
} from '../data/initialData';

export interface Project {
  id: string;
  name: string;
  customer: string;
  status: 'Aktiivinen' | 'Suunniteltu' | 'Valmis' | 'Myöhässä';
  startDate: string;
  endDate: string;
  progress: number;
  budget: number;
  spent: number;
  description?: string;
  location?: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  project: string;
  assignee: string;
  dueDate: string;
  priority: 'Korkea' | 'Normaali' | 'Matala';
  status: 'Avoin' | 'Käynnissä' | 'Odottaa' | 'Valmis' | 'Peruttu';
  description?: string;
  type?: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  employee: string;
  project: string;
  hours: number;
  overtime: number;
  description: string;
  status: 'Hyväksytty' | 'Odottaa' | 'Hylätty';
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  startDate: string;
  status: 'Aktiivinen' | 'Lomalla' | 'Sapattivapaa' | 'Eroonnut';
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  serial: string;
  location: string;
  status: 'Käytössä' | 'Vapaa' | 'Huollossa' | 'Vuokralla';
  lastMaintenance: string;
}

export interface Customer {
  id: string;
  name: string;
  type: 'Yritys' | 'Yksityinen' | 'Taloyhtiö';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  projectCount: number;
  lastContact: string;
  status: 'Aktiivinen' | 'Epäaktiivinen';
}

export interface CrmLead {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: 'Uusi' | 'Tarjous tehty' | 'Neuvottelu' | 'Sopimus';
  assignee: string;
  date: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  project: string;
  author: string;
  weather: string;
  temperature: string;
  workers: number;
  workDescription: string;
  issues?: string;
}

export interface SafetyItem {
  id: string;
  type: 'incident' | 'risk' | 'inspection' | 'training';
  title: string;
  date: string;
  severity?: 'Lievä' | 'Keskitasoinen' | 'Vakava';
  status: string;
}

export interface WasteEntry {
  id: string;
  date: string;
  project: string;
  wasteType: string;
  amount: number;
  method: string;
  cost: number;
}

export interface DrivingLogEntry {
  id: string;
  date: string;
  driver: string;
  vehicle: string;
  startAddress: string;
  endAddress: string;
  distance: number;
  purpose: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  priority: 'Tärkeä' | 'Normaali' | 'Info';
}

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_VERSION = 'vakantti-v1';
const KEYS = {
  projects: `${STORAGE_VERSION}-projects`,
  workOrders: `${STORAGE_VERSION}-workOrders`,
  timeEntries: `${STORAGE_VERSION}-timeEntries`,
  employees: `${STORAGE_VERSION}-employees`,
  equipment: `${STORAGE_VERSION}-equipment`,
  customers: `${STORAGE_VERSION}-customers`,
  crmLeads: `${STORAGE_VERSION}-crmLeads`,
  diaryEntries: `${STORAGE_VERSION}-diaryEntries`,
  safetyItems: `${STORAGE_VERSION}-safetyItems`,
  wasteEntries: `${STORAGE_VERSION}-wasteEntries`,
  drivingLog: `${STORAGE_VERSION}-drivingLog`,
  announcements: `${STORAGE_VERSION}-announcements`,
  messages: `${STORAGE_VERSION}-messages`,
  sidebarCollapsed: `${STORAGE_VERSION}-sidebarCollapsed`,
};

let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}-${idCounter}`;
}

export function useAppData() {
  const [projects, setProjects] = useLocalStorage<Project[]>(KEYS.projects, initialProjects);
  const [workOrders, setWorkOrders] = useLocalStorage<WorkOrder[]>(KEYS.workOrders, initialWorkOrders);
  const [timeEntries, setTimeEntries] = useLocalStorage<TimeEntry[]>(KEYS.timeEntries, initialTimeEntries);
  const [employees, setEmployees] = useLocalStorage<Employee[]>(KEYS.employees, initialEmployees);
  const [equipment, setEquipment] = useLocalStorage<Equipment[]>(KEYS.equipment, initialEquipment);
  const [customers, setCustomers] = useLocalStorage<Customer[]>(KEYS.customers, initialCustomers);
  const [crmLeads, setCrmLeads] = useLocalStorage<CrmLead[]>(KEYS.crmLeads, initialCrmLeads);
  const [diaryEntries, setDiaryEntries] = useLocalStorage<DiaryEntry[]>(KEYS.diaryEntries, initialDiaryEntries);
  const [safetyItems, setSafetyItems] = useLocalStorage<SafetyItem[]>(KEYS.safetyItems, initialSafetyItems);
  const [wasteEntries, setWasteEntries] = useLocalStorage<WasteEntry[]>(KEYS.wasteEntries, initialWasteEntries);
  const [drivingLog, setDrivingLog] = useLocalStorage<DrivingLogEntry[]>(KEYS.drivingLog, initialDrivingLog);
  const [announcements, setAnnouncements] = useLocalStorage<Announcement[]>(KEYS.announcements, initialAnnouncements);
  const [messages, setMessages] = useLocalStorage<Message[]>(KEYS.messages, initialMessages);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage<boolean>(KEYS.sidebarCollapsed, false);

  const addProject = (project: Omit<Project, 'id'>) => {
    const newProject = { ...project, id: generateId('PROJ') };
    setProjects(prev => [newProject, ...prev]);
    return newProject;
  };
  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };
  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const addWorkOrder = (wo: Omit<WorkOrder, 'id'>) => {
    const newWo = { ...wo, id: generateId('TM') };
    setWorkOrders(prev => [newWo, ...prev]);
    return newWo;
  };
  const updateWorkOrder = (id: string, updates: Partial<WorkOrder>) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, ...updates } : wo));
  };
  const deleteWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));
  };

  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'Aktiivinen').length,
    completedProjects: projects.filter(p => p.status === 'Valmis').length,
    totalRevenue: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
    openWorkOrders: workOrders.filter(wo => wo.status === 'Avoin').length,
    inProgressWorkOrders: workOrders.filter(wo => wo.status === 'Käynnissä').length,
    totalEmployees: employees.length,
    activeEmployees: employees.filter(e => e.status === 'Aktiivinen').length,
    totalCustomers: customers.length,
    openLeads: crmLeads.filter(l => l.stage === 'Uusi').length,
    totalEquipment: equipment.length,
  };

  return {
    projects, workOrders, timeEntries, employees, equipment,
    customers, crmLeads, diaryEntries, safetyItems, wasteEntries,
    drivingLog, announcements, messages, sidebarCollapsed, stats,
    setSidebarCollapsed,
    addProject, updateProject, deleteProject,
    addWorkOrder, updateWorkOrder, deleteWorkOrder,
    setTimeEntries, setEmployees, setEquipment,
    setCustomers, setCrmLeads, setDiaryEntries,
    setSafetyItems, setWasteEntries, setDrivingLog,
    setAnnouncements, setMessages,
  };
}
