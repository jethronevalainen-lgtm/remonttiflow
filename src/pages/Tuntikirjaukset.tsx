import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Trash2,
  Send,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  User,
  Users,
  ClipboardCheck,
  CheckCheck,
  Timer,
  CalendarDays,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

/* ─── Types ─── */
type TimeEntryStatus = 'Hyväksytty' | 'Odottaa' | 'Hylätty';

interface TimeEntry {
  id: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  project: string;
  projectColor: string;
  workType: string;
  hours: number;
  overtime: number;
  description: string;
  status: TimeEntryStatus;
  personId?: string;
  personName?: string;
  personInitials?: string;
}

interface ApprovalRequest {
  id: string;
  personName: string;
  personInitials: string;
  weekRange: string;
  totalHours: number;
  submittedDate: string;
  entries: TimeEntry[];
}

/* ─── Mock Data ─── */
const MY_TIME_ENTRIES: TimeEntry[] = [
  { id: 't1', date: '23.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '15:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 8.5, overtime: 0.5, description: 'Seinärakenteiden purkua', status: 'Hyväksytty' },
  { id: 't2', date: '24.6.2025', dayName: 'Ti', startTime: '07:00', endTime: '16:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 9.0, overtime: 1.0, description: 'Uusien runkopuiden asennus', status: 'Hyväksytty' },
  { id: 't3', date: '25.6.2025', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Sähkökaapelointi kerros 2', status: 'Odottaa' },
  { id: 't4', date: '26.6.2025', dayName: 'To', startTime: '07:00', endTime: '15:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 8.5, overtime: 0.5, description: 'LVI-valmistelu', status: 'Odottaa' },
  { id: 't5', date: '27.6.2025', dayName: 'Pe', startTime: '07:00', endTime: '14:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 7.5, overtime: 0, description: 'Lopputarkistus ja siivous', status: 'Odottaa' },
  { id: 't6', date: '30.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Sisämaalaus toimisto A', status: 'Odottaa' },
  { id: 't7', date: '1.7.2025', dayName: 'Ti', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'Maalaus', hours: 9.0, overtime: 1.0, description: 'Sisämaalaus toimisto B', status: 'Odottaa' },
  { id: 't8', date: '2.7.2025', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Pistorasioiden asennus', status: 'Odottaa' },
  { id: 't9', date: '3.7.2025', dayName: 'To', startTime: '07:00', endTime: '15:30', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Sähkö', hours: 8.5, overtime: 0.5, description: 'Valaistuskytkimet', status: 'Odottaa' },
  { id: 't10', date: '4.7.2025', dayName: 'Pe', startTime: '07:00', endTime: '14:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'Maalaus', hours: 7.0, overtime: 0, description: 'Viimeistely ja tarkistus', status: 'Odottaa' },
  { id: 't11', date: '16.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Purkutyöt aloitettu', status: 'Hyväksytty' },
  { id: 't12', date: '17.6.2025', dayName: 'Ti', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Runkopuiden mittaus', status: 'Hyväksytty' },
  { id: 't13', date: '18.6.2025', dayName: 'Ke', startTime: '07:00', endTime: '16:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 9.5, overtime: 1.5, description: 'Kiireellinen korjaus', status: 'Hyväksytty' },
  { id: 't14', date: '19.6.2025', dayName: 'To', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Normaali työpäivä', status: 'Hyväksytty' },
  { id: 't15', date: '20.6.2025', dayName: 'Pe', startTime: '07:00', endTime: '14:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Rakennus', hours: 7.0, overtime: 0, description: 'Viikon lopetus', status: 'Hyväksytty' },
];

const TEAM_ENTRIES: TimeEntry[] = [
  { id: 'te1', date: '23.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Perustustyöt', status: 'Hyväksytty', personId: 'e1', personName: 'Matti Korhonen', personInitials: 'MK' },
  { id: 'te2', date: '23.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Sähköasennukset', status: 'Odottaa', personId: 'e2', personName: 'Jukka Lehtonen', personInitials: 'JL' },
  { id: 'te3', date: '23.6.2025', dayName: 'Ma', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.0, overtime: 1.0, description: 'Putkiasennukset', status: 'Odottaa', personId: 'e3', personName: 'Anna Lahtinen', personInitials: 'AL' },
  { id: 'te4', date: '24.6.2025', dayName: 'Ti', startTime: '07:00', endTime: '15:30', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.5, overtime: 0.5, description: 'Runkotyöt', status: 'Hyväksytty', personId: 'e1', personName: 'Matti Korhonen', personInitials: 'MK' },
  { id: 'te5', date: '24.6.2025', dayName: 'Ti', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Kaapelointi', status: 'Odottaa', personId: 'e2', personName: 'Jukka Lehtonen', personInitials: 'JL' },
  { id: 'te6', date: '24.6.2025', dayName: 'Ti', startTime: '08:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Vesiputkien testaus', status: 'Odottaa', personId: 'e3', personName: 'Anna Lahtinen', personInitials: 'AL' },
  { id: 'te7', date: '25.6.2025', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Pohjamaalaus', status: 'Odottaa', personId: 'e5', personName: 'Liisa Rantanen', personInitials: 'LR' },
  { id: 'te8', date: '25.6.2025', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Eristystyöt', status: 'Hyväksytty', personId: 'e6', personName: 'Sari Kettunen', personInitials: 'SK' },
  { id: 'te9', date: '26.6.2025', dayName: 'To', startTime: '07:00', endTime: '16:30', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.5, overtime: 1.5, description: 'Kiireellinen korjaus', status: 'Odottaa', personId: 'e7', personName: 'Timo Nieminen', personInitials: 'TN' },
  { id: 'te10', date: '26.6.2025', dayName: 'To', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Tarkastukset', status: 'Hyväksytty', personId: 'e4', personName: 'Pekka Salminen', personInitials: 'PS' },
  { id: 'te11', date: '27.6.2025', dayName: 'Pe', startTime: '07:00', endTime: '14:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 7.0, overtime: 0, description: 'Lopputarkistus', status: 'Odottaa', personId: 'e2', personName: 'Jukka Lehtonen', personInitials: 'JL' },
  { id: 'te12', date: '27.6.2025', dayName: 'Pe', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Sisämaalaus', status: 'Odottaa', personId: 'e5', personName: 'Liisa Rantanen', personInitials: 'LR' },
];

const APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id: 'a1',
    personName: 'Jukka Lehtonen',
    personInitials: 'JL',
    weekRange: '23.–29.6.2025',
    totalHours: 38.5,
    submittedDate: '27.6.2025',
    entries: [
      { id: 'ae1', date: '23.6.', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Sähköasennukset', status: 'Odottaa' },
      { id: 'ae2', date: '24.6.', dayName: 'Ti', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Kaapelointi', status: 'Odottaa' },
      { id: 'ae3', date: '25.6.', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Rasiasovitukset', status: 'Odottaa' },
      { id: 'ae4', date: '26.6.', dayName: 'To', startTime: '07:00', endTime: '15:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.5, overtime: 0.5, description: 'Testaukset', status: 'Odottaa' },
      { id: 'ae5', date: '27.6.', dayName: 'Pe', startTime: '07:00', endTime: '14:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 7.0, overtime: 0, description: 'Lopputarkistus', status: 'Odottaa' },
    ],
  },
  {
    id: 'a2',
    personName: 'Anna Lahtinen',
    personInitials: 'AL',
    weekRange: '23.–29.6.2025',
    totalHours: 41.0,
    submittedDate: '27.6.2025',
    entries: [
      { id: 'ae6', date: '23.6.', dayName: 'Ma', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.0, overtime: 1.0, description: 'Putkiasennukset', status: 'Odottaa' },
      { id: 'ae7', date: '24.6.', dayName: 'Ti', startTime: '08:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Vesiputkien testaus', status: 'Odottaa' },
      { id: 'ae8', date: '25.6.', dayName: 'Ke', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.0, overtime: 1.0, description: 'Hana-asennukset', status: 'Odottaa' },
      { id: 'ae9', date: '26.6.', dayName: 'To', startTime: '07:00', endTime: '16:30', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.5, overtime: 1.5, description: 'Kiireellinen korjaus', status: 'Odottaa' },
      { id: 'ae10', date: '27.6.', dayName: 'Pe', startTime: '07:00', endTime: '15:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Viimeistely', status: 'Odottaa' },
    ],
  },
  {
    id: 'a3',
    personName: 'Matti Korhonen',
    personInitials: 'MK',
    weekRange: '16.–22.6.2025',
    totalHours: 40.0,
    submittedDate: '20.6.2025',
    entries: [
      { id: 'ae11', date: '16.6.', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Perustustyöt', status: 'Odottaa' },
      { id: 'ae12', date: '17.6.', dayName: 'Ti', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Runkotyöt', status: 'Odottaa' },
      { id: 'ae13', date: '18.6.', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Eristystyöt', status: 'Odottaa' },
      { id: 'ae14', date: '19.6.', dayName: 'To', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Tarkastukset', status: 'Odottaa' },
      { id: 'ae15', date: '20.6.', dayName: 'Pe', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Rakennus', hours: 8.0, overtime: 0, description: 'Viikon lopetus', status: 'Odottaa' },
    ],
  },
];

const STATUS_CONFIG: Record<TimeEntryStatus, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  'Hyväksytty': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  'Odottaa': { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
  'Hylätty': { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
};

/* ─── Summary Chart Data ─── */
const MONTHLY_HOURS_DATA = [
  { month: 'Tammi', tuntimäärä: 168, ylityöt: 12 },
  { month: 'Helmi', tuntimäärä: 160, ylityöt: 8 },
  { month: 'Maalis', tuntimäärä: 176, ylityöt: 20 },
  { month: 'Huhti', tuntimäärä: 152, ylityöt: 4 },
  { month: 'Touko', tuntimäärä: 184, ylityöt: 28 },
  { month: 'Kesä', tuntimäärä: 142, ylityöt: 10 },
];

const PROJECT_HOURS_DATA = [
  { name: 'Tampereen korjaustyö', value: 85, color: '#3B82F6' },
  { name: 'Espoon uudisrakennus', value: 64, color: '#F97316' },
  { name: 'Helsingin toimistorakennus', value: 52, color: '#22C55E' },
];

const WORK_TYPE_DATA = [
  { name: 'Rakennus', value: 120, color: '#3B82F6' },
  { name: 'Sähkö', value: 45, color: '#F59E0B' },
  { name: 'LVI', value: 38, color: '#EF4444' },
  { name: 'Maalaus', value: 55, color: '#22C55E' },
  { name: 'Muu', value: 15, color: '#8B5CF6' },
];

const OVERTIME_TREND_DATA = [
  { month: 'Tammi', ylityöt: 12 },
  { month: 'Helmi', ylityöt: 8 },
  { month: 'Maalis', ylityöt: 20 },
  { month: 'Huhti', ylityöt: 4 },
  { month: 'Touko', ylityöt: 28 },
  { month: 'Kesä', ylityöt: 10 },
];

/* ─── Component ─── */
export default function Tuntikirjaukset() {
  const [activeTab, setActiveTab] = useState('omat');
  const [myEntries, setMyEntries] = useState<TimeEntry[]>(MY_TIME_ENTRIES);
  const [teamEntries] = useState<TimeEntry[]>(TEAM_ENTRIES);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(APPROVAL_REQUESTS);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  /* Timer */
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getEntryStatus = (entry: TimeEntry, reqId: string): TimeEntryStatus => {
    const key = `${reqId}-${entry.id}`;
    if (approvedIds.has(key)) return 'Hyväksytty';
    if (rejectedIds.has(key)) return 'Hylätty';
    return entry.status;
  };

  const handleApprove = (reqId: string, entryId: string) => {
    setApprovedIds((prev) => new Set(prev).add(`${reqId}-${entryId}`));
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(`${reqId}-${entryId}`);
      return next;
    });
  };

  const handleReject = (reqId: string, entryId: string) => {
    setRejectedIds((prev) => new Set(prev).add(`${reqId}-${entryId}`));
    setApprovedIds((prev) => {
      const next = new Set(prev);
      next.delete(`${reqId}-${entryId}`);
      return next;
    });
  };

  const handleApproveAll = (req: ApprovalRequest) => {
    const nextApproved = new Set(approvedIds);
    req.entries.forEach((e) => {
      nextApproved.add(`${req.id}-${e.id}`);
    });
    setApprovedIds(nextApproved);
  };

  /* Stats */
  const myStats = useMemo(() => {
    const total = myEntries.reduce((s, e) => s + e.hours, 0);
    const overtime = myEntries.reduce((s, e) => s + e.overtime, 0);
    const approved = myEntries.filter((e) => e.status === 'Hyväksytty').length;
    const pending = myEntries.filter((e) => e.status === 'Odottaa').length;
    return { total, overtime, approved, pending };
  }, [myEntries]);

  const teamStats = useMemo(() => {
    const total = teamEntries.reduce((s, e) => s + e.hours, 0);
    const overtime = teamEntries.reduce((s, e) => s + e.overtime, 0);
    return { total, overtime };
  }, [teamStats]);

  /* Delete */
  const handleDelete = (id: string) => {
    setMyEntries((prev) => prev.filter((e) => e.id !== id));
  };

  /* Add/Edit */
  const handleSave = (formData: FormData) => {
    const newEntry: TimeEntry = {
      id: editingEntry?.id || `t${Date.now()}`,
      date: formData.get('date') as string,
      dayName: formData.get('dayName') as string,
      startTime: formData.get('startTime') as string,
      endTime: formData.get('endTime') as string,
      project: formData.get('project') as string,
      projectColor: '#3B82F6',
      workType: formData.get('workType') as string,
      hours: parseFloat(formData.get('hours') as string),
      overtime: parseFloat(formData.get('overtime') as string) || 0,
      description: formData.get('description') as string,
      status: 'Odottaa',
    };
    if (editingEntry) {
      setMyEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? newEntry : e)));
    } else {
      setMyEntries((prev) => [newEntry, ...prev]);
    }
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const openAddDialog = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  /* Approval progress */
  const getApprovalProgress = (req: ApprovalRequest) => {
    const approved = req.entries.filter((e) => getEntryStatus(e, req.id) === 'Hyväksytty').length;
    return { approved, total: req.entries.length, percent: (approved / req.entries.length) * 100 };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Tuntikirjaukset</h1>
          <p className="text-muted-foreground mt-1">Kirjaa, seuraa ja hallinnoi työaikaa</p>
        </div>
        <div className="flex items-center gap-2">
          {timerRunning && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <Timer className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-lg font-mono font-semibold text-primary">{formatTimer(timerSeconds)}</span>
            </div>
          )}
          <Button
            variant={timerRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={() => {
              if (timerRunning) {
                setTimerRunning(false);
                setTimerSeconds(0);
              } else {
                setTimerRunning(true);
              }
            }}
            className="gap-2"
          >
            {timerRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {timerRunning ? 'Pysäytä' : 'Aloita ajastin'}
          </Button>
          <Button size="sm" onClick={openAddDialog} className="gap-2 bg-primary hover:bg-primary-hover text-white">
            <Plus className="w-4 h-4" />
            Uusi kirjaus
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Omat tunnit</p>
                <p className="text-xl font-bold text-heading">{myStats.total}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ylityöt</p>
                <p className="text-xl font-bold text-heading">{myStats.overtime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hyväksytty</p>
                <p className="text-xl font-bold text-heading">{myStats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Odottaa</p>
                <p className="text-xl font-bold text-heading">{myStats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="omat" className="gap-2 data-[state=active]:bg-white">
            <User className="w-4 h-4" />
            Omat kirjaukset
          </TabsTrigger>
          <TabsTrigger value="tiimi" className="gap-2 data-[state=active]:bg-white">
            <Users className="w-4 h-4" />
            Tiimin kirjaukset
          </TabsTrigger>
          <TabsTrigger value="hyvaksynnat" className="gap-2 data-[state=active]:bg-white">
            <ClipboardCheck className="w-4 h-4" />
            Hyväksynnät
            {approvalRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">
                {approvalRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="yhteenveto" className="gap-2 data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4" />
            Yhteenveto
          </TabsTrigger>
        </TabsList>

        {/* Omat kirjaukset */}
        <TabsContent value="omat" className="mt-4">
          <Card className="bg-white border border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Omat tuntikirjaukset
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedWeek((w) => w - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">Viikko {25 + selectedWeek} / 2025</span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedWeek((w) => w + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myEntries.map((entry) => {
                  const StatusIcon = STATUS_CONFIG[entry.status].icon;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: entry.projectColor }}>
                          {entry.dayName}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-heading">{entry.date}</span>
                            <span className="text-sm text-muted-foreground">
                              {entry.startTime}–{entry.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{entry.project}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{entry.workType}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-heading">{entry.hours}h</p>
                          {entry.overtime > 0 && <p className="text-xs text-warning">+{entry.overtime}h ylityö</p>}
                        </div>
                        <Badge className={cn(STATUS_CONFIG[entry.status].bg, STATUS_CONFIG[entry.status].text, 'border-0 gap-1')}>
                          <StatusIcon className="w-3 h-3" />
                          {entry.status}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEditDialog(entry)}>
                            <Edit3 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiimin kirjaukset */}
        <TabsContent value="tiimi" className="mt-4">
          <Card className="bg-white border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Tiimin tuntikirjaukset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamEntries.map((entry) => {
                  const StatusIcon = STATUS_CONFIG[entry.status].icon;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-white">
                          {entry.personInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-heading">{entry.personName}</span>
                            <span className="text-sm text-muted-foreground">{entry.date}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{entry.project}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{entry.workType}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-heading">{entry.hours}h</p>
                          {entry.overtime > 0 && <p className="text-xs text-warning">+{entry.overtime}h</p>}
                        </div>
                        <Badge className={cn(STATUS_CONFIG[entry.status].bg, STATUS_CONFIG[entry.status].text, 'border-0 gap-1')}>
                          <StatusIcon className="w-3 h-3" />
                          {entry.status}
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hyväksynnät */}
        <TabsContent value="hyvaksynnat" className="mt-4 space-y-4">
          {approvalRequests.map((req) => {
            const progress = getApprovalProgress(req);
            const isExpanded = expandedRequest === req.id;
            return (
              <Card key={req.id} className="bg-white border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-base font-bold text-white">
                        {req.personInitials}
                      </div>
                      <div>
                        <p className="font-semibold text-heading">{req.personName}</p>
                        <p className="text-sm text-muted-foreground">
                          {req.weekRange} • {req.totalHours}h • Lähetetty {req.submittedDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={progress.percent} className="w-24 h-2" />
                      <span className="text-sm text-muted-foreground">
                        {progress.approved}/{progress.total}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setExpandedRequest(isExpanded ? null : req.id)}>
                        {isExpanded ? 'Piilota' : 'Näytä'}
                      </Button>
                      <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveAll(req)}>
                        <CheckCheck className="w-4 h-4" />
                        Hyväksy kaikki
                      </Button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-2 border-t border-border pt-4">
                          {req.entries.map((entry) => {
                            const status = getEntryStatus(entry, req.id);
                            const StatusIcon = STATUS_CONFIG[status].icon;
                            return (
                              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: entry.projectColor }}>
                                    {entry.dayName}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-heading">{entry.date}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {entry.startTime}–{entry.endTime}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{entry.workType}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{entry.project} • {entry.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="font-semibold text-heading">{entry.hours}h</p>
                                  <Badge className={cn(STATUS_CONFIG[status].bg, STATUS_CONFIG[status].text, 'border-0 gap-1')}>
                                    <StatusIcon className="w-3 h-3" />
                                    {status}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-8 h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => handleApprove(req.id, entry.id)}
                                    >
                                      <ThumbsUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-8 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleReject(req.id, entry.id)}
                                    >
                                      <ThumbsDown className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Yhteenveto */}
        <TabsContent value="yhteenveto" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border border-border">
              <CardHeader>
                <CardTitle className="text-base">Kuukausittaiset tunnit</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={MONTHLY_HOURS_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="tuntimäärä" fill="#2563EB" name="Tuntimäärä" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ylityöt" fill="#F59E0B" name="Ylityöt" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border border-border">
              <CardHeader>
                <CardTitle className="text-base">Tunnit projekteittain</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={PROJECT_HOURS_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {PROJECT_HOURS_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border border-border">
              <CardHeader>
                <CardTitle className="text-base">Työlajit</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={WORK_TYPE_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {WORK_TYPE_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border border-border">
              <CardHeader>
                <CardTitle className="text-base">Ylityötrendi</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={OVERTIME_TREND_DATA}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="ylityöt" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Muokkaa kirjausta' : 'Uusi tuntikirjaus'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Päivämäärä</Label>
                  <Input name="date" type="date" defaultValue={editingEntry?.date ? editingEntry.date.split('.').reverse().join('-') : ''} required />
                </div>
                <div className="space-y-2">
                  <Label>Viikonpäivä</Label>
                  <Select name="dayName" defaultValue={editingEntry?.dayName || 'Ma'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alkuaika</Label>
                  <Input name="startTime" type="time" defaultValue={editingEntry?.startTime || '07:00'} required />
                </div>
                <div className="space-y-2">
                  <Label>Loppuaika</Label>
                  <Input name="endTime" type="time" defaultValue={editingEntry?.endTime || '15:00'} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Projekti</Label>
                <Select name="project" defaultValue={editingEntry?.project || 'Tampereen korjaustyö'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tampereen korjaustyö">Tampereen korjaustyö</SelectItem>
                    <SelectItem value="Espoon uudisrakennus">Espoon uudisrakennus</SelectItem>
                    <SelectItem value="Helsingin toimistorakennus">Helsingin toimistorakennus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Työlaji</Label>
                <Select name="workType" defaultValue={editingEntry?.workType || 'Rakennus'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rakennus">Rakennus</SelectItem>
                    <SelectItem value="Sähkö">Sähkö</SelectItem>
                    <SelectItem value="LVI">LVI</SelectItem>
                    <SelectItem value="Maalaus">Maalaus</SelectItem>
                    <SelectItem value="Muu">Muu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tunnit</Label>
                  <Input name="hours" type="number" step="0.5" defaultValue={editingEntry?.hours || 8} required />
                </div>
                <div className="space-y-2">
                  <Label>Ylityö (h)</Label>
                  <Input name="overtime" type="number" step="0.5" defaultValue={editingEntry?.overtime || 0} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Kuvaus</Label>
                <Textarea name="description" defaultValue={editingEntry?.description || ''} placeholder="Mitä teit tänään?" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Peruuta
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary-hover text-white">
                Tallenna
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}