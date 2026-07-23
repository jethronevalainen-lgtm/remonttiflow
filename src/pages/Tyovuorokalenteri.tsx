import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Sun,
  Moon,
  Sunset,
  Coffee,
  AlertTriangle,
  Clock,
  User,
  Briefcase,
  Umbrella,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ShiftEmployee } from '@/types';

/* ─── Types ─── */
type ShiftType = 'Aamu' | 'Iltavuoro' | 'Yövuoro' | 'Vapaapäivä' | 'Loma' | 'Sairaasloma';
type CalendarView = 'month' | 'week' | 'day';

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  type: ShiftType;
  project: string;
  notes?: string;
}

/* ─── Constants ─── */
const SHIFT_TYPES: Record<ShiftType, { label: string; color: string; bg: string; border: string; icon: typeof Sun }> = {
  Aamu: { label: 'Aamu', color: 'text-[#2563EB]', bg: 'bg-[#DBEAFE]', border: 'border-[#93C5FD]', icon: Sun },
  Iltavuoro: { label: 'Iltavuoro', color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED]', border: 'border-[#FDBA74]', icon: Sunset },
  Yövuoro: { label: 'Yövuoro', color: 'text-[#7C3AED]', bg: 'bg-[#EDE9FE]', border: 'border-[#C4B5FD]', icon: Moon },
  Vapaapäivä: { label: 'Vapaapäivä', color: 'text-[#64748B]', bg: 'bg-[#F1F5F9]', border: 'border-[#CBD5E1]', icon: Coffee },
  Loma: { label: 'Loma', color: 'text-[#059669]', bg: 'bg-[#D1FAE5]', border: 'border-[#6EE7B7]', icon: Umbrella },
  Sairaasloma: { label: 'Sairasloma', color: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', border: 'border-[#FCA5A5]', icon: Stethoscope },
};

const WEEK_DAYS = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
const WEEK_DAYS_FULL = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];

const MONTH_NAMES = [
  'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
  'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu',
];

/* ─── Employees ─── */
const EMPLOYEES: ShiftEmployee[] = [
  { id: 'e1', name: 'Matti Korhonen', initials: 'MK', role: 'Rakennusmestari', color: '#F97316' },
  { id: 'e2', name: 'Jukka Lehtonen', initials: 'JL', role: 'Sähköasentaja', color: '#3B82F6' },
  { id: 'e3', name: 'Anna Lahtinen', initials: 'AL', role: 'LVI-asentaja', color: '#22C55E' },
  { id: 'e4', name: 'Pekka Salminen', initials: 'PS', role: 'Rakennustyöntekijä', color: '#8B5CF6' },
  { id: 'e5', name: 'Liisa Rantanen', initials: 'LR', role: 'Maalari', color: '#EC4899' },
  { id: 'e6', name: 'Sari Kettunen', initials: 'SK', role: 'Eristäjä', color: '#F59E0B' },
  { id: 'e7', name: 'Timo Nieminen', initials: 'TN', role: 'Putkiasentaja', color: '#06B6D4' },
  { id: 'e8', name: 'Kaisa Mäkinen', initials: 'KM', role: 'Työnjohtaja', color: '#EF4444' },
];

/* ─── Shift Data (2 weeks) ─── */
const INITIAL_SHIFTS: Shift[] = [
  // Week 1: June 16-22, 2025
  { id: 's1', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-16', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's2', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-16', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's3', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-16', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Helsingin toimistorakennus' },
  { id: 's4', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-16', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's5', employeeId: 'e5', employeeName: 'Liisa Rantanen', employeeInitials: 'LR', date: '2025-06-16', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's6', employeeId: 'e8', employeeName: 'Kaisa Mäkinen', employeeInitials: 'KM', date: '2025-06-16', startTime: '08:00', endTime: '16:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  { id: 's7', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-17', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's8', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-17', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Tampereen korjaustyö' },
  { id: 's9', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-17', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },
  { id: 's10', employeeId: 'e6', employeeName: 'Sari Kettunen', employeeInitials: 'SK', date: '2025-06-17', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's11', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-17', startTime: '22:00', endTime: '06:00', type: 'Yövuoro', project: 'Espoon uudisrakennus' },

  { id: 's12', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-18', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's13', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-18', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's14', employeeId: 'e5', employeeName: 'Liisa Rantanen', employeeInitials: 'LR', date: '2025-06-18', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Tampereen korjaustyö' },
  { id: 's15', employeeId: 'e8', employeeName: 'Kaisa Mäkinen', employeeInitials: 'KM', date: '2025-06-18', startTime: '08:00', endTime: '16:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  { id: 's16', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-19', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's17', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-19', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },
  { id: 's18', employeeId: 'e6', employeeName: 'Sari Kettunen', employeeInitials: 'SK', date: '2025-06-19', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's19', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-19', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Espoon uudisrakennus' },

  { id: 's20', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-20', startTime: '07:00', endTime: '12:00', type: 'Aamu', project: 'Espoon uudisrakennus', notes: 'Puolipäivä' },
  { id: 's21', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-20', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's22', employeeId: 'e5', employeeName: 'Liisa Rantanen', employeeInitials: 'LR', date: '2025-06-20', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },

  { id: 's23', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-21', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },
  { id: 's24', employeeId: 'e8', employeeName: 'Kaisa Mäkinen', employeeInitials: 'KM', date: '2025-06-21', startTime: '08:00', endTime: '14:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  // Sunday - mostly off
  { id: 's25', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-22', startTime: '22:00', endTime: '06:00', type: 'Yövuoro', project: 'Espoon uudisrakennus' },

  // Week 2: June 23-29, 2025
  { id: 's26', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-23', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's27', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-23', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's28', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-23', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Helsingin toimistorakennus' },
  { id: 's29', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-23', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's30', employeeId: 'e6', employeeName: 'Sari Kettunen', employeeInitials: 'SK', date: '2025-06-23', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },

  { id: 's31', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-24', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Espoon uudisrakennus' },
  { id: 's32', employeeId: 'e5', employeeName: 'Liisa Rantanen', employeeInitials: 'LR', date: '2025-06-24', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's33', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-24', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's34', employeeId: 'e8', employeeName: 'Kaisa Mäkinen', employeeInitials: 'KM', date: '2025-06-24', startTime: '08:00', endTime: '16:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  { id: 's35', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-25', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's36', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-25', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's37', employeeId: 'e6', employeeName: 'Sari Kettunen', employeeInitials: 'SK', date: '2025-06-25', startTime: '15:00', endTime: '23:00', type: 'Iltavuoro', project: 'Tampereen korjaustyö' },

  { id: 's38', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-26', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's39', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-26', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },
  { id: 's40', employeeId: 'e5', employeeName: 'Liisa Rantanen', employeeInitials: 'LR', date: '2025-06-26', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Tampereen korjaustyö' },
  { id: 's41', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-26', startTime: '22:00', endTime: '06:00', type: 'Yövuoro', project: 'Espoon uudisrakennus' },

  { id: 's42', employeeId: 'e2', employeeName: 'Jukka Lehtonen', employeeInitials: 'JL', date: '2025-06-27', startTime: '07:00', endTime: '12:00', type: 'Aamu', project: 'Tampereen korjaustyö', notes: 'Puolipäivä' },
  { id: 's43', employeeId: 'e4', employeeName: 'Pekka Salminen', employeeInitials: 'PS', date: '2025-06-27', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's44', employeeId: 'e8', employeeName: 'Kaisa Mäkinen', employeeInitials: 'KM', date: '2025-06-27', startTime: '08:00', endTime: '16:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  // Weekend
  { id: 's45', employeeId: 'e1', employeeName: 'Matti Korhonen', employeeInitials: 'MK', date: '2025-06-28', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Espoon uudisrakennus' },
  { id: 's46', employeeId: 'e3', employeeName: 'Anna Lahtinen', employeeInitials: 'AL', date: '2025-06-28', startTime: '07:00', endTime: '15:00', type: 'Aamu', project: 'Helsingin toimistorakennus' },

  { id: 's47', employeeId: 'e7', employeeName: 'Timo Nieminen', employeeInitials: 'TN', date: '2025-06-29', startTime: '22:00', endTime: '06:00', type: 'Yövuoro', project: 'Espoon uudisrakennus' },
];

// Days off / vacation
const SPECIAL_DAYS: Record<string, { employeeId: string; type: ShiftType; note?: string }[]> = {
  '2025-06-16': [{ employeeId: 'e7', type: 'Vapaapäivä' }],
  '2025-06-18': [{ employeeId: 'e2', type: 'Loma', note: 'Kesäloma' }],
  '2025-06-19': [{ employeeId: 'e5', type: 'Vapaapäivä' }],
  '2025-06-20': [{ employeeId: 'e2', type: 'Loma', note: 'Kesäloma' }, { employeeId: 'e3', type: 'Vapaapäivä' }, { employeeId: 'e6', type: 'Vapaapäivä' }],
  '2025-06-21': [{ employeeId: 'e1', type: 'Vapaapäivä' }, { employeeId: 'e2', type: 'Loma' }, { employeeId: 'e4', type: 'Vapaapäivä' }, { employeeId: 'e6', type: 'Vapaapäivä' }],
  '2025-06-22': [{ employeeId: 'e1', type: 'Vapaapäivä' }, { employeeId: 'e2', type: 'Loma' }, { employeeId: 'e3', type: 'Vapaapäivä' }, { employeeId: 'e4', type: 'Vapaapäivä' }, { employeeId: 'e5', type: 'Vapaapäivä' }, { employeeId: 'e6', type: 'Vapaapäivä' }, { employeeId: 'e8', type: 'Vapaapäivä' }],
  '2025-06-23': [{ employeeId: 'e5', type: 'Loma', note: 'Kesäloma' }],
  '2025-06-25': [{ employeeId: 'e1', type: 'Vapaapäivä' }, { employeeId: 'e3', type: 'Sairaasloma', note: 'Flunssa' }],
  '2025-06-26': [{ employeeId: 'e2', type: 'Vapaapäivä' }, { employeeId: 'e8', type: 'Vapaapäivä' }],
  '2025-06-27': [{ employeeId: 'e1', type: 'Vapaapäivä' }, { employeeId: 'e3', type: 'Sairaasloma' }, { employeeId: 'e5', type: 'Loma' }, { employeeId: 'e6', type: 'Vapaapäivä' }],
  '2025-06-28': [{ employeeId: 'e2', type: 'Vapaapäivä' }, { employeeId: 'e4', type: 'Vapaapäivä' }, { employeeId: 'e5', type: 'Loma' }, { employeeId: 'e6', type: 'Vapaapäivä' }, { employeeId: 'e7', type: 'Vapaapäivä' }, { employeeId: 'e8', type: 'Vapaapäivä' }],
  '2025-06-29': [{ employeeId: 'e1', type: 'Vapaapäivä' }, { employeeId: 'e2', type: 'Vapaapäivä' }, { employeeId: 'e3', type: 'Sairaasloma' }, { employeeId: 'e4', type: 'Vapaapäivä' }, { employeeId: 'e5', type: 'Loma' }, { employeeId: 'e6', type: 'Vapaapäivä' }, { employeeId: 'e8', type: 'Vapaapäivä' }],
};

/* ─── Date helpers ─── */
function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstDay.getDay());
  const days: Date[] = [];
  const curr = new Date(start);
  while (curr <= lastDay || curr.getDay() !== 0) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day;
  date.setDate(diff);
  return date;
}

function getWeekDays(d: Date): Date[] {
  const start = getWeekStart(d);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh + em / 60) - (sh + sm / 60);
}

/* ─── New-shift form constants ─── */
interface ShiftFormState {
  employeeId: string;
  date: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  project: string;
  notes: string;
}

const PROJECT_OPTIONS = ['Espoon uudisrakennus', 'Helsingin toimistorakennus', 'Tampereen korjaustyö'];

// Shift types that are actual work (require a project)
const WORK_SHIFT_TYPES: ShiftType[] = ['Aamu', 'Iltavuoro', 'Yövuoro'];

/* ─── Component ─── */
export default function Tyovuorokalenteri() {
  const today = new Date(2025, 5, 24); // June 24, 2025 as "today"
  const [currentDate, setCurrentDate] = useState(today);
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set(EMPLOYEES.map(e => e.id)));
  const [searchEmployee, setSearchEmployee] = useState('');
  const [newShiftOpen, setNewShiftOpen] = useState(false);

  // Shifts as component state (session-only until the backend lands)
  const [shifts, setShifts] = useState<Shift[]>(INITIAL_SHIFTS);

  // New-shift form state
  const [shiftForm, setShiftForm] = useState<ShiftFormState>({
    employeeId: '',
    date: formatDateKey(today),
    type: 'Aamu',
    startTime: '07:00',
    endTime: '15:00',
    project: '',
    notes: '',
  });
  const [shiftErrors, setShiftErrors] = useState<string[]>([]);
  const [shiftSavedMessage, setShiftSavedMessage] = useState('');

  const openNewShiftDialog = () => {
    setShiftForm({
      employeeId: '',
      date: selectedDay ? formatDateKey(selectedDay) : formatDateKey(today),
      type: 'Aamu',
      startTime: '07:00',
      endTime: '15:00',
      project: '',
      notes: '',
    });
    setShiftErrors([]);
    setNewShiftOpen(true);
  };

  // Auto-dismiss the save confirmation
  useEffect(() => {
    if (!shiftSavedMessage) return;
    const t = setTimeout(() => setShiftSavedMessage(''), 4000);
    return () => clearTimeout(t);
  }, [shiftSavedMessage]);

  const handleSaveShift = () => {
    const errors: string[] = [];
    if (!shiftForm.employeeId) errors.push('Valitse henkilö.');
    if (!shiftForm.date) errors.push('Valitse päivämäärä.');
    if (!shiftForm.startTime || !shiftForm.endTime) {
      errors.push('Syötä alku- ja loppuaika.');
    } else if (shiftForm.type !== 'Yövuoro' && shiftForm.endTime <= shiftForm.startTime) {
      errors.push('Loppuajan on oltava alkuaikaa myöhempi (yövuoro voi päättyä seuraavana päivänä).');
    }
    if (WORK_SHIFT_TYPES.includes(shiftForm.type) && !shiftForm.project) {
      errors.push('Valitse projekti työvuorolle.');
    }
    setShiftErrors(errors);
    if (errors.length > 0) return;

    const emp = EMPLOYEES.find(e => e.id === shiftForm.employeeId);
    if (!emp) return;
    const newShift: Shift = {
      id: `s-custom-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeInitials: emp.initials,
      date: shiftForm.date,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      type: shiftForm.type,
      project: shiftForm.project || '—',
      notes: shiftForm.notes.trim() || undefined,
    };
    setShifts(prev => [...prev, newShift]);
    setNewShiftOpen(false);
    setShiftErrors([]);
    // Navigate the calendar to the new shift so it is immediately visible
    const shiftDate = new Date(`${shiftForm.date}T00:00:00`);
    setCurrentDate(shiftDate);
    setSelectedDay(shiftDate);
    setShiftSavedMessage('Työvuoro lisätty kalenteriin.');
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const weekDays = useMemo(() => selectedDay ? getWeekDays(selectedDay) : getWeekDays(currentDate), [selectedDay, currentDate]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedEmployees(new Set(EMPLOYEES.map(e => e.id)));
  const selectNone = () => setSelectedEmployees(new Set());

  const filteredEmployees = useMemo(() => {
    if (!searchEmployee) return EMPLOYEES;
    return EMPLOYEES.filter(e => e.name.toLowerCase().includes(searchEmployee.toLowerCase()));
  }, [searchEmployee]);

  const getShiftsForDate = (dateKey: string): (Shift | { employeeId: string; type: ShiftType; note?: string; isSpecial: true })[] => {
    const dayShiftList = shifts.filter(s => s.date === dateKey && selectedEmployees.has(s.employeeId));
    const specials = SPECIAL_DAYS[dateKey]?.filter(s => selectedEmployees.has(s.employeeId)) || [];
    const result: (Shift | { employeeId: string; type: ShiftType; note?: string; isSpecial: true })[] = [...dayShiftList];
    // Only add special days for employees without a shift
    const shiftEmpIds = new Set(dayShiftList.map(s => s.employeeId));
    specials.forEach(s => {
      if (!shiftEmpIds.has(s.employeeId)) {
        result.push({ ...s, isSpecial: true });
      }
    });
    return result;
  };

  const isToday = (d: Date) => {
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const goToPrev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
      setSelectedDay(d);
    }
  };

  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
      setSelectedDay(d);
    }
  };

  const goToToday = () => {
    setCurrentDate(today);
    setSelectedDay(today);
  };

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-hero text-text-primary">Työvuorokalenteri</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työvuorojen suunnittelu ja hallinta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Clock size={16} /> Mallipohjat
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-hover text-white" onClick={openNewShiftDialog}>
            <Plus size={16} /> Uusi työvuoro
          </Button>
        </div>
      </motion.div>

      {/* Save confirmation */}
      {shiftSavedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-light px-4 py-2.5 text-sm text-success font-medium"
        >
          {shiftSavedMessage}
        </motion.div>
      )}

      {/* ─── Calendar Toolbar ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrev}>
            <ChevronLeft size={18} />
          </Button>
          <h2 className="text-h2 text-text-primary min-w-[200px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNext}>
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-light rounded-lg p-0.5 border border-border">
            {([
              { key: 'month', label: 'Kuukausi' },
              { key: 'week', label: 'Viikko' },
              { key: 'day', label: 'Päivä' },
            ] as { key: CalendarView; label: string }[]).map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  view === v.key ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Tänään
          </Button>
        </div>
      </motion.div>

      {/* ─── Main Content: Calendar + Side Panel ─── */}
      <div className="flex gap-6">
        {/* Calendar Area */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 min-w-0"
        >
          <AnimatePresence mode="wait">
            {/* ─── Month View ─── */}
            {view === 'month' && (
              <motion.div
                key="month"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
              >
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-border">
                  {WEEK_DAYS.map(d => (
                    <div key={d} className="px-2 py-2.5 text-center text-caption font-semibold text-text-secondary uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => {
                    const dateKey = formatDateKey(day);
                    const dayShifts = getShiftsForDate(dateKey);
                    const inCurrentMonth = day.getMonth() === month;
                    const todayFlag = isToday(day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const selected = selectedDay && formatDateKey(selectedDay) === dateKey;
                    const hasConflict = dayShifts.length > 4;

                    return (
                      <motion.div
                        key={dateKey}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15, delay: Math.min(idx * 0.01, 0.3) }}
                        className={cn(
                          'min-h-[110px] p-1.5 border-b border-r border-border cursor-pointer transition-colors relative',
                          !inCurrentMonth && 'bg-bg-light/50',
                          isWeekend && inCurrentMonth && 'bg-bg-light/30',
                          todayFlag && 'bg-primary-light/30',
                          selected && 'ring-2 ring-inset ring-primary',
                          !selected && 'hover:bg-bg-light'
                        )}
                        onClick={() => setSelectedDay(day)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              'w-6 h-6 flex items-center justify-center text-sm rounded-full',
                              todayFlag && 'bg-primary text-white font-semibold',
                              !todayFlag && !inCurrentMonth && 'text-text-muted',
                              !todayFlag && inCurrentMonth && 'text-text-primary font-medium'
                            )}
                          >
                            {day.getDate()}
                          </span>
                          {hasConflict && (
                            <AlertTriangle size={12} className="text-warning" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {dayShifts.slice(0, 3).map((shift, i) => {
                            const shiftType = 'isSpecial' in shift ? shift.type : shift.type;
                            const employee = EMPLOYEES.find(e => e.id === shift.employeeId);
                            const cfg = SHIFT_TYPES[shiftType];
                            const ShIcon = cfg.icon;
                            return (
                              <div
                                key={i}
                                className={cn(
                                  'flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight font-medium truncate',
                                  cfg.bg, cfg.color
                                )}
                                title={`${shiftType}${employee ? ` · ${employee.name}` : ''}`}
                              >
                                <ShIcon size={9} />
                                <span className="truncate">{employee?.initials}</span>
                                {!('isSpecial' in shift) && (
                                  <span className="opacity-75">{hoursBetween(shift.startTime, shift.endTime)}h</span>
                                )}
                              </div>
                            );
                          })}
                          {dayShifts.length > 3 && (
                            <div className="text-[10px] text-text-muted pl-1">+{dayShifts.length - 3}</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ─── Week View ─── */}
            {view === 'week' && (
              <motion.div
                key="week"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
              >
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="px-2 py-3 text-center text-caption font-semibold text-text-secondary border-r border-border">
                    Aika
                  </div>
                  {weekDays.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        'px-1 py-3 text-center border-r border-border last:border-r-0',
                        isToday(d) && 'bg-primary-light/30'
                      )}
                    >
                      <div className="text-caption text-text-secondary uppercase">{WEEK_DAYS[i]}</div>
                      <div
                        className={cn(
                          'text-sm font-semibold mt-0.5',
                          isToday(d) ? 'text-primary' : 'text-text-primary'
                        )}
                      >
                        {d.getDate()}.
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-8">
                  {/* Time labels */}
                  <div className="border-r border-border">
                    {Array.from({ length: 14 }, (_, i) => i + 6).map(hour => (
                      <div key={hour} className="h-14 px-2 border-b border-border/50 flex items-start">
                        <span className="text-[11px] text-text-muted -mt-2">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((d, di) => {
                    const dateKey = formatDateKey(d);
                    const dayShifts = shifts.filter(s => s.date === dateKey && selectedEmployees.has(s.employeeId));
                    return (
                      <div
                        key={di}
                        className={cn(
                          'relative border-r border-border last:border-r-0',
                          isToday(d) && 'bg-primary-light/10'
                        )}
                      >
                        {Array.from({ length: 14 }, (_, i) => i + 6).map(hour => (
                          <div key={hour} className="h-14 border-b border-border/50" />
                        ))}
                        {dayShifts.map((shift, si) => {
                          const startHour = parseInt(shift.startTime.split(':')[0]);
                          const duration = hoursBetween(shift.startTime, shift.endTime);
                          const employee = EMPLOYEES.find(e => e.id === shift.employeeId);
                          const cfg = SHIFT_TYPES[shift.type];
                          return (
                            <motion.div
                              key={shift.id}
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: si * 0.05, duration: 0.2 }}
                              className={cn(
                                'absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 border text-[10px] overflow-hidden cursor-pointer hover:shadow-sm transition-shadow',
                                cfg.bg, cfg.border, cfg.color
                              )}
                              style={{
                                top: `${(startHour - 6) * 56 + 2}px`,
                                height: `${Math.max(duration * 56 - 4, 20)}px`,
                              }}
                              title={`${shift.employeeName} · ${shift.startTime}–${shift.endTime} · ${shift.project}`}
                            >
                              <div className="font-semibold truncate">{employee?.initials}</div>
                              <div className="truncate opacity-75">{shift.startTime}–{shift.endTime}</div>
                              <div className="truncate opacity-60">{shift.project}</div>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ─── Day View ─── */}
            {view === 'day' && selectedDay && (
              <motion.div
                key="day"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
              >
                <div className="p-4 border-b border-border">
                  <h3 className="text-h2 text-text-primary">
                    {WEEK_DAYS_FULL[selectedDay.getDay()]} {selectedDay.getDate()}. {MONTH_NAMES[selectedDay.getMonth()]} {selectedDay.getFullYear()}
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 15 }, (_, i) => i + 6).map(hour => {
                    const dateKey = formatDateKey(selectedDay);
                    const hourShifts = shifts.filter(
                      s =>
                        s.date === dateKey &&
                        selectedEmployees.has(s.employeeId) &&
                        parseInt(s.startTime.split(':')[0]) <= hour &&
                        parseInt(s.endTime.split(':')[0]) > hour
                    );
                    return (
                      <div key={hour} className="flex items-stretch min-h-[56px]">
                        <div className="w-16 flex-shrink-0 px-3 py-2 border-r border-border bg-bg-light/50 text-right">
                          <span className="text-xs text-text-muted">{String(hour).padStart(2, '0')}:00</span>
                        </div>
                        <div className="flex-1 p-1 flex gap-1">
                          {hourShifts.map(shift => {
                            const cfg = SHIFT_TYPES[shift.type];
                            return (
                              <div
                                key={shift.id}
                                className={cn(
                                  'flex-1 rounded-md px-2 py-1 border text-xs',
                                  cfg.bg, cfg.border, cfg.color
                                )}
                              >
                                <div className="font-semibold">{shift.employeeName}</div>
                                <div className="opacity-75">{shift.startTime}–{shift.endTime}</div>
                                <div className="opacity-60">{shift.project}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Side Panel ─── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="w-72 flex-shrink-0 hidden xl:block space-y-4"
        >
          {/* Employee Filter */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-h3 text-text-primary flex items-center gap-2">
                <User size={16} /> Henkilöstö
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Hae henkilöä..."
                  value={searchEmployee}
                  onChange={e => setSearchEmployee(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                  Kaikki
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectNone}>
                  Ei mitään
                </Button>
              </div>
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {filteredEmployees.map(emp => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-bg-light cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployees.has(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: emp.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{emp.name}</div>
                      <div className="text-[11px] text-text-muted">{emp.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Details */}
          {selectedDay && (
            <Card className="border-border shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-h3 text-text-primary">
                  {WEEK_DAYS[selectedDay.getDay()]} {selectedDay.getDate()}.{selectedDay.getMonth() + 1}.
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const dateKey = formatDateKey(selectedDay);
                  const dayShifts = shifts.filter(s => s.date === dateKey && selectedEmployees.has(s.employeeId));
                  const totalHours = dayShifts.reduce((sum, s) => sum + hoursBetween(s.startTime, s.endTime), 0);
                  const offCount = (SPECIAL_DAYS[dateKey]?.filter(s => selectedEmployees.has(s.employeeId) && s.type === 'Vapaapäivä').length || 0);
                  const vacationCount = (SPECIAL_DAYS[dateKey]?.filter(s => selectedEmployees.has(s.employeeId) && s.type === 'Loma').length || 0);

                  return (
                    <>
                      <div className="text-body-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">{dayShifts.length}</span> työvuoroa ·{' '}
                        <span className="font-semibold text-text-primary">{totalHours.toFixed(0)}h</span> yhteensä
                        {offCount > 0 && ` · ${offCount} vapaalla`}
                        {vacationCount > 0 && ` · ${vacationCount} lomalla`}
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {dayShifts.map(shift => {
                          const employee = EMPLOYEES.find(e => e.id === shift.employeeId);
                          const cfg = SHIFT_TYPES[shift.type];
                          return (
                            <div
                              key={shift.id}
                              className={cn(
                                'p-2.5 rounded-lg border text-xs',
                                cfg.bg, cfg.border
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: employee?.color }} />
                                  {shift.employeeName}
                                </span>
                                <Badge className={cn(cfg.bg, cfg.color, 'text-[10px]')}>{shift.type}</Badge>
                              </div>
                              <div className="text-text-secondary flex items-center gap-1">
                                <Clock size={10} /> {shift.startTime}–{shift.endTime}
                              </div>
                              <div className="text-text-muted mt-0.5 flex items-center gap-1">
                                <Briefcase size={10} /> {shift.project}
                              </div>
                            </div>
                          );
                        })}
                        {dayShifts.length === 0 && (
                          <p className="text-body-sm text-text-muted italic text-center py-4">Ei työvuoroja tälle päivälle</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={openNewShiftDialog}
                      >
                        <Plus size={14} /> Lisää työvuoro
                      </Button>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* ─── Legend ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center gap-4 text-sm"
      >
        <span className="text-text-secondary font-medium">Selite:</span>
        {Object.entries(SHIFT_TYPES).map(([key, cfg]) => {
          const CfgIcon = cfg.icon;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-sm', cfg.bg, cfg.border, 'border')} />
              <CfgIcon size={12} className={cfg.color} />
              <span className="text-text-secondary">{cfg.label}</span>
            </div>
          );
        })}
      </motion.div>

      {/* ─── New Shift Dialog ─── */}
      <Dialog
        open={newShiftOpen}
        onOpenChange={open => {
          setNewShiftOpen(open);
          if (!open) setShiftErrors([]);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-h2">Uusi työvuoro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {shiftErrors.length > 0 && (
              <div className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 space-y-1">
                {shiftErrors.map(err => (
                  <p key={err} className="text-sm text-danger">{err}</p>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Henkilö *</Label>
              <Select
                value={shiftForm.employeeId}
                onValueChange={v => setShiftForm(prev => ({ ...prev, employeeId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valitse henkilö" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEES.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: emp.color }} />
                        {emp.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Päivämäärä *</Label>
                <Input
                  type="date"
                  value={shiftForm.date}
                  onChange={e => setShiftForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tyyppi</Label>
                <Select
                  value={shiftForm.type}
                  onValueChange={v => setShiftForm(prev => ({ ...prev, type: v as ShiftType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SHIFT_TYPES).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alkuaika *</Label>
                <Input
                  type="time"
                  value={shiftForm.startTime}
                  onChange={e => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Loppuaika *</Label>
                <Input
                  type="time"
                  value={shiftForm.endTime}
                  onChange={e => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Projekti{WORK_SHIFT_TYPES.includes(shiftForm.type) ? ' *' : ''}</Label>
              <Select
                value={shiftForm.project}
                onValueChange={v => setShiftForm(prev => ({ ...prev, project: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Valitse projekti" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Muistiinpanot</Label>
              <Input
                placeholder="Valinnainen..."
                value={shiftForm.notes}
                onChange={e => setShiftForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-text-muted">
              Tallentuu istuntoon — pysyvä tallennus tulee backendin myötä.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewShiftOpen(false)}>Peruuta</Button>
            <Button className="bg-primary hover:bg-primary-hover text-white" onClick={handleSaveShift}>
              Tallenna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
