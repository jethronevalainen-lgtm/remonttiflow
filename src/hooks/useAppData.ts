import { useLocalStorage } from './useLocalStorage';
import { BRAND } from '../config/brand';
import type {
  Project, WorkOrder, TimeEntry, Employee, Equipment,
  Customer, CrmLead, DiaryEntry, SafetyItem, WasteEntry,
  DrivingLogEntry, Announcement, Message,
} from '../types';
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

// Re-export the canonical domain types so existing import sites
// (`from '../hooks/useAppData'`) keep working unchanged.
export type {
  Project, WorkOrder, TimeEntry, Employee, Equipment,
  Customer, CrmLead, DiaryEntry, SafetyItem, WasteEntry,
  DrivingLogEntry, Announcement, Message,
  ProjectStatus, WorkOrderPriority, WorkOrderStatus, TimeEntryStatus,
  EmployeeStatus, EquipmentStatus, CustomerType, CustomerStatus,
  CrmLeadStage, SafetyItemType, SafetyItemSeverity, AnnouncementPriority,
} from '../types';

const STORAGE_VERSION = BRAND.storagePrefix;
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

  const addCustomer = (c: Omit<Customer, 'id'>) => {
    const newCustomer = { ...c, id: generateId('AS') };
    setCustomers(prev => [newCustomer, ...prev]);
    return newCustomer;
  };
  const updateCustomer = (id: string, patch: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addCrmLead = (l: Omit<CrmLead, 'id'>) => {
    const newLead = { ...l, id: generateId('LEAD') };
    setCrmLeads(prev => [newLead, ...prev]);
    return newLead;
  };
  const updateCrmLead = (id: string, patch: Partial<CrmLead>) => {
    setCrmLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };
  const deleteCrmLead = (id: string) => {
    setCrmLeads(prev => prev.filter(l => l.id !== id));
  };

  const addTimeEntry = (e: Omit<TimeEntry, 'id'>) => {
    const newEntry = { ...e, id: generateId('TK') };
    setTimeEntries(prev => [newEntry, ...prev]);
    return newEntry;
  };

  const addSafetyItem = (s: Omit<SafetyItem, 'id'>) => {
    const newItem = { ...s, id: generateId('TURV') };
    setSafetyItems(prev => [newItem, ...prev]);
    return newItem;
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
    addCustomer, updateCustomer, deleteCustomer,
    addCrmLead, updateCrmLead, deleteCrmLead,
    addTimeEntry, addSafetyItem,
    setTimeEntries, setEmployees, setEquipment,
    setCustomers, setCrmLeads, setDiaryEntries,
    setSafetyItems, setWasteEntries, setDrivingLog,
    setAnnouncements, setMessages,
  };
}
