import { useState, useEffect } from 'react';
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
      { id: 'ae3', date: '25.6.', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 8.0, overtime: 0, description: 'Kytkentä', status: 'Odottaa' },
      { id: 'ae4', date: '26.6.', dayName: 'To', startTime: '07:00', endTime: '16:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 9.0, overtime: 1.0, description: 'Testaus ja tarkistus', status: 'Odottaa' },
      { id: 'ae5', date: '27.6.', dayName: 'Pe', startTime: '07:00', endTime: '14:30', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Sähkö', hours: 7.5, overtime: 0, description: 'Viimeistely', status: 'Odottaa' },
    ],
  },
  {
    id: 'a2',
    personName: 'Anna Lahtinen',
    personInitials: 'AL',
    weekRange: '23.–29.6.2025',
    totalHours: 40.0,
    submittedDate: '27.6.2025',
    entries: [
      { id: 'ae6', date: '23.6.', dayName: 'Ma', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.0, overtime: 1.0, description: 'Putkiasennukset', status: 'Odottaa' },
      { id: 'ae7', date: '24.6.', dayName: 'Ti', startTime: '08:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Testaus', status: 'Odottaa' },
      { id: 'ae8', date: '25.6.', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Liitokset', status: 'Odottaa' },
      { id: 'ae9', date: '26.6.', dayName: 'To', startTime: '07:00', endTime: '15:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 8.0, overtime: 0, description: 'Tarkistus', status: 'Odottaa' },
      { id: 'ae10', date: '27.6.', dayName: 'Pe', startTime: '07:00', endTime: '16:00', project: 'Helsingin toimistorakennus', projectColor: '#22C55E', workType: 'LVI', hours: 9.0, overtime: 1.0, description: 'Viimeistely', status: 'Odottaa' },
    ],
  },
  {
    id: 'a3',
    personName: 'Liisa Rantanen',
    personInitials: 'LR',
    weekRange: '23.–29.6.2025',
    totalHours: 36.0,
    submittedDate: '26.6.2025',
    entries: [
      { id: 'ae11', date: '23.6.', dayName: 'Ma', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Pohjamaalaus', status: 'Odottaa' },
      { id: 'ae12', date: '24.6.', dayName: 'Ti', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Pohjamaalaus jatkuu', status: 'Odottaa' },
      { id: 'ae13', date: '25.6.', dayName: 'Ke', startTime: '07:00', endTime: '15:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Päällemaalaus', status: 'Odottaa' },
      { id: 'ae14', date: '26.6.', dayName: 'To', startTime: '07:00', endTime: '14:00', project: 'Tampereen korjaustyö', projectColor: '#3B82F6', workType: 'Maalaus', hours: 7.0, overtime: 0, description: 'Viimeistely', status: 'Odottaa' },
      { id: 'ae15', date: '27.6.', dayName: 'Pe', startTime: '07:00', endTime: '15:00', project: 'Espoon uudisrakennus', projectColor: '#F97316', workType: 'Maalaus', hours: 8.0, overtime: 0, description: 'Uusi kohde', status: 'Odottaa' },
    ],
  },
];

/* ─── Chart Data ─── */
const MONTHLY_HOURS = [
  { month: 'Tammi', tunnit: 168, ylityo: 12 },
  { month: 'Helmi', tunnit: 160, ylityo: 8 },
  { month: 'Maalis', tunnit: 176, ylityo: 16 },
  { month: 'Huhti', tunnit: 152, ylityo: 4 },
  { month: 'Touko', tunnit: 184, ylityo: 24 },
  { month: 'Kesä', tunnit: 144, ylityo: 6 },
];

const PROJECT_BREAKDOWN = [
  { name: 'Espoon uudisrakennus', value: 45, color: '#F97316' },
  { name: 'Tampereen korjaustyö', value: 30, color: '#3B82F6' },
  { name: 'Helsingin toimistorakennus', value: 25, color: '#22C55E' },
];

const OVERTIME_TREND = [
  { week: 'Vko 20', ylityo: 4 },
  { week: 'Vko 21', ylityo: 8 },
  { week: 'Vko 22', ylityo: 12 },
  { week: 'Vko 23', ylityo: 6 },
  { week: 'Vko 24', ylityo: 10 },
  { week: 'Vko 25', ylityo: 3 },
  { week: 'Vko 26', ylityo: 5 },
];

const WORK_TYPE_BREAKDOWN = [
  { type: 'Rakennus', hours: 85 },
  { type: 'Sähkö', hours: 42 },
  { type: 'LVI', hours: 38 },
  { type: 'Maalaus', hours: 55 },
  { type: 'Eristys', hours: 20 },
];

/* ─── Helpers ─── */
const statusConfig: Record<TimeEntryStatus, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Hyväksytty: { bg: 'bg-success-light', text: 'text-success', icon: CheckCircle2 },
  Odottaa: { bg: 'bg-warning-light', text: 'text-warning', icon: AlertCircle },
  Hylätty: { bg: 'bg-danger-light', text: 'text-danger', icon: XCircle },
};

/* ─── Component ─── */
export default function Tuntikirjaukset() {
  const [activeTab, setActiveTab] = useState('omat');
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Summary calculations
  const currentWeekEntries = MY_TIME_ENTRIES.filter(e => e.status === 'Hyväksytty');
  const currentWeekHours = currentWeekEntries.reduce((sum, e) => sum + e.hours, 0);
  const pendingHours = MY_TIME_ENTRIES.filter(e => e.status === 'Odottaa').reduce((sum, e) => sum + e.hours, 0);
  const approvedHours = currentWeekHours;
  const totalOvertime = MY_TIME_ENTRIES.reduce((sum, e) => sum + e.overtime, 0);
  const targetHours = 40;
  const progressPercent = Math.min((approvedHours / targetHours) * 100, 100);

  const handleApprove = (id: string) => {
    setApprovedIds(prev => new Set(prev).add(id));
    setRejectedIds(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const handleReject = (id: string) => {
    setRejectedIds(prev => new Set(prev).add(id));
    setApprovedIds(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const getEntryStatus = (entry: TimeEntry, reqId: string) => {
    const key = `${reqId}-${entry.id}`;
    if (approvedIds.has(key)) return 'Hyväksytty' as TimeEntryStatus;
    if (rejectedIds.has(key)) return 'Hylätty' as TimeEntryStatus;
    return entry.status;
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
          <h1 className="text-hero text-text-primary">Tuntikirjaukset</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työaikakirjaus ja seuranta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart3 size={16} /> Raportti
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Send size={16} /> Vie
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary-hover text-white" onClick={() => setDialogOpen(true)}>
            <Plus size={16} /> Kirjaa tunnit
          </Button>
        </div>
      </motion.div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-bg-light border border-border p-1">
          <TabsTrigger value="omat" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
            <User size={14} /> Omat kirjaukset
          </TabsTrigger>
          <TabsTrigger value="tiimi" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users size={14} /> Tiimin kirjaukset
          </TabsTrigger>
          <TabsTrigger value="hyvaksynnät" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
            <ClipboardCheck size={14} /> Hyväksynnät
          </TabsTrigger>
          <TabsTrigger value="yhteenveto" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 size={14} /> Yhteenveto
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Omat kirjaukset ─── */}
        <TabsContent value="omat" className="space-y-6">
          {/* KPI Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption text-text-secondary font-medium">Viikko 25</span>
                  <CalendarDays size={18} className="text-primary" />
                </div>
                <p className="text-hero text-text-primary">{approvedHours.toFixed(1)}h <span className="text-h3 text-text-secondary">/ {targetHours}h</span></p>
                <Progress value={progressPercent} className="h-2 mt-3" />
                <p className={cn('text-caption mt-1.5 font-medium', progressPercent >= 100 ? 'text-success' : 'text-warning')}>
                  {progressPercent >= 100 ? 'Tavoite saavutettu' : `${(targetHours - approvedHours).toFixed(1)}h jäljellä`}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption text-text-secondary font-medium">Kirjatut tunnit</span>
                  <Clock size={18} className="text-primary" />
                </div>
                <p className="text-hero text-text-primary">{(approvedHours + pendingHours).toFixed(1)}h</p>
                <p className="text-body-sm text-text-secondary mt-1">Tämä viikko</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption text-text-secondary font-medium">Hyväksytty</span>
                  <CheckCircle2 size={18} className="text-success" />
                </div>
                <p className="text-hero text-success">{approvedHours.toFixed(1)}h</p>
                <p className="text-body-sm text-text-secondary mt-1">{currentWeekEntries.length} kirjaukset</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-caption text-text-secondary font-medium">Odottaa</span>
                  <AlertCircle size={18} className="text-warning" />
                </div>
                <p className="text-hero text-warning">{pendingHours.toFixed(1)}h</p>
                <p className="text-body-sm text-text-secondary mt-1">{MY_TIME_ENTRIES.filter(e => e.status === 'Odottaa').length} kirjaukset</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Timer Quick Entry */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={cn('border-border shadow-card', timerRunning && 'border-primary/30')}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', timerRunning ? 'bg-primary text-white' : 'bg-bg-light text-text-secondary')}>
                      <Timer size={24} />
                    </div>
                    <div>
                      <h4 className="text-h3 text-text-primary">Pikakirjaus</h4>
                      <p className="text-body-sm text-text-secondary">
                        {timerRunning ? 'Ajastin käynnissä' : 'Aloita reaaliaikainen kirjaus'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1" />
                  {timerRunning && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-3xl font-mono font-semibold text-text-primary tracking-wider"
                    >
                      {formatTimer(elapsedSeconds)}
                    </motion.div>
                  )}
                  <Button
                    className={cn(
                      'gap-2 min-w-[140px]',
                      timerRunning
                        ? 'bg-danger hover:bg-danger/90 text-white'
                        : 'bg-primary hover:bg-primary-hover text-white'
                    )}
                    onClick={() => setTimerRunning(!timerRunning)}
                  >
                    {timerRunning ? <Square size={16} /> : <Play size={16} />}
                    {timerRunning ? 'Pysäytä' : 'Aloita ajastin'}
                  </Button>
                  {!timerRunning && (
                    <Button variant="outline" className="gap-2" onClick={() => setDialogOpen(true)}>
                      <Clock size={16} /> Kirjaa manuaalisesti
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Week Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft size={16} /></Button>
              <span className="text-h3 text-text-primary">Viikko 25 (23.–29.6.2025)</span>
              <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight size={16} /></Button>
            </div>
            <Button variant="ghost" size="sm">Tänään</Button>
          </motion.div>

          {/* Time Entries Table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-light border-b border-border">
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Päivämäärä</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Aika</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Projekti</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Työlaji</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Kuvaus</th>
                    <th className="text-right px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Tunnit</th>
                    <th className="text-right px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Ylityö</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Status</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold w-24">Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {MY_TIME_ENTRIES.map((entry, idx) => {
                      const cfg = statusConfig[entry.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-b border-border/50 hover:bg-bg-light transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-text-primary">{entry.dayName} {entry.date}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">{entry.startTime}–{entry.endTime}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.projectColor }} />
                              <span className="text-sm text-text-primary">{entry.project}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">{entry.workType}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary max-w-[200px] truncate">{entry.description}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono font-medium text-text-primary">{entry.hours}h</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {entry.overtime > 0 ? (
                              <span className="text-sm font-mono font-medium text-danger">+{entry.overtime}h</span>
                            ) : (
                              <span className="text-sm text-text-muted">–</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn(cfg.bg, cfg.text, 'gap-1 font-medium')}>
                              <StatusIcon size={12} /> {entry.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Edit3 size={14} /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 size={14} /></Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border bg-bg-light/50 flex items-center justify-between">
              <p className="text-body-sm text-text-secondary">
                Yhteensä: <span className="font-semibold text-text-primary">{MY_TIME_ENTRIES.reduce((s, e) => s + e.hours, 0).toFixed(1)}h</span>
                {' · '}Ylityö: <span className="font-semibold text-danger">+{totalOvertime.toFixed(1)}h</span>
              </p>
            </div>
          </motion.div>
        </TabsContent>

        {/* ─── Tab: Tiimin kirjaukset ─── */}
        <TabsContent value="tiimi" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl border border-border shadow-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-h3 text-text-primary">Tiimin tuntikirjaukset — Viikko 25</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft size={16} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight size={16} /></Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-light border-b border-border">
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Henkilö</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Päivä</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Aika</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Projekti</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Työlaji</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Kuvaus</th>
                    <th className="text-right px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Tunnit</th>
                    <th className="text-left px-4 py-3 text-caption uppercase tracking-wider text-text-secondary font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_ENTRIES.map((entry, idx) => {
                    const cfg = statusConfig[entry.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b border-border/50 hover:bg-bg-light transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary-light text-primary text-[10px] font-semibold flex items-center justify-center">
                              {entry.personInitials}
                            </div>
                            <span className="text-sm font-medium text-text-primary">{entry.personName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary">{entry.dayName} {entry.date}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{entry.startTime}–{entry.endTime}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.projectColor }} />
                            <span className="text-sm text-text-primary">{entry.project}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{entry.workType}</Badge></td>
                        <td className="px-4 py-3 text-sm text-text-secondary max-w-[160px] truncate">{entry.description}</td>
                        <td className="px-4 py-3 text-right text-sm font-mono font-medium text-text-primary">{entry.hours}h</td>
                        <td className="px-4 py-3">
                          <Badge className={cn(cfg.bg, cfg.text, 'gap-1 font-medium text-xs')}>
                            <StatusIcon size={11} /> {entry.status}
                          </Badge>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </TabsContent>

        {/* ─── Tab: Hyväksynnät ─── */}
        <TabsContent value="hyvaksynnät" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between"
          >
            <h3 className="text-h2 text-text-primary">Hyväksyntäjono</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => APPROVAL_REQUESTS.forEach(r => handleApprove(r.id))}>
                <CheckCheck size={16} /> Hyväksy kaikki
              </Button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Approval List */}
            <div className="space-y-3">
              {APPROVAL_REQUESTS.map((req, idx) => {
                const allApproved = req.entries.every(e => getEntryStatus(e, req.id) === 'Hyväksytty');
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    <Card
                      className={cn(
                        'border-border shadow-card cursor-pointer transition-all hover:shadow-card-hover',
                        selectedApproval?.id === req.id && 'ring-2 ring-primary',
                        allApproved && 'border-success/30 bg-success-light/20'
                      )}
                      onClick={() => setSelectedApproval(req)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-light text-primary text-sm font-semibold flex items-center justify-center">
                            {req.personInitials}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-text-primary">{req.personName}</p>
                            <p className="text-body-sm text-text-secondary">{req.weekRange} · {req.totalHours}h</p>
                          </div>
                          <div className="text-right">
                            <p className="text-caption text-text-muted">{req.submittedDate}</p>
                            {allApproved && <Badge className="bg-success-light text-success mt-1">Hyväksytty</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Approval Detail */}
            <AnimatePresence mode="wait">
              {selectedApproval && (
                <motion.div
                  key={selectedApproval.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-border shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-h3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-light text-primary text-xs font-semibold flex items-center justify-center">
                          {selectedApproval.personInitials}
                        </div>
                        {selectedApproval.personName} — {selectedApproval.weekRange}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {selectedApproval.entries.map(entry => {
                          const status = getEntryStatus(entry, selectedApproval.id);
                          const cfg = statusConfig[status];
                          const StatusIcon = cfg.icon;
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                                status === 'Hyväksytty' && 'bg-success-light/30 border-success/20',
                                status === 'Hylätty' && 'bg-danger-light/30 border-danger/20',
                                status === 'Odottaa' && 'bg-white border-border'
                              )}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-text-primary">{entry.dayName} {entry.date}</span>
                                  <span className="text-body-sm text-text-secondary">{entry.startTime}–{entry.endTime}</span>
                                  <Badge className={cn(cfg.bg, cfg.text, 'text-[10px] gap-0.5')}>
                                    <StatusIcon size={10} /> {status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.projectColor }} />
                                  <span className="text-xs text-text-secondary">{entry.project} · {entry.workType} · {entry.hours}h</span>
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">{entry.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-border">
                        <p className="text-sm text-text-secondary mb-3">
                          Yhteensä: <span className="font-semibold text-text-primary">{selectedApproval.totalHours}h</span>
                        </p>
                        <Textarea
                          placeholder="Hyväksyntäkommentti (valinnainen)..."
                          value={approvalComment}
                          onChange={e => setApprovalComment(e.target.value)}
                          className="mb-3 text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-white"
                            onClick={() => {
                              selectedApproval.entries.forEach(e => handleApprove(`${selectedApproval.id}-${e.id}`));
                            }}
                          >
                            <ThumbsUp size={16} /> Hyväksy
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 gap-1.5 text-danger hover:bg-danger-light"
                            onClick={() => {
                              selectedApproval.entries.forEach(e => handleReject(`${selectedApproval.id}-${e.id}`));
                            }}
                          >
                            <ThumbsDown size={16} /> Hylkää
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>

        {/* ─── Tab: Yhteenveto ─── */}
        <TabsContent value="yhteenveto" className="space-y-6">
          {/* Summary KPIs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary font-medium">Keskim. päivittäinen työaika</p>
                <p className="text-hero text-text-primary mt-1">7.8h</p>
                <p className="text-body-sm text-success mt-1">Tavoitteen alapuolella (8h)</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary font-medium">Ylityötunnit kesäkuussa</p>
                <p className="text-hero text-warning mt-1">6.0h</p>
                <p className="text-body-sm text-text-secondary mt-1">Alle 10h raja</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-card">
              <CardContent className="p-5">
                <p className="text-caption text-text-secondary font-medium">Hyväksyntäaste</p>
                <p className="text-hero text-success mt-1">92%</p>
                <p className="text-body-sm text-text-secondary mt-1">Keskiarvo tällä kvartaalilla</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Hours Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-border shadow-card">
                <CardHeader>
                  <CardTitle className="text-h3 flex items-center gap-2">
                    <BarChart3 size={18} className="text-primary" /> Kuukausittaiset tunnit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={MONTHLY_HOURS}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number, name: string) => [`${value}h`, name === 'tunnit' ? 'Työtunnit' : 'Ylityö']}
                      />
                      <Bar dataKey="tunnit" fill="#F97316" radius={[4, 4, 0, 0]} name="Työtunnit" />
                      <Bar dataKey="ylityo" fill="#EF4444" radius={[4, 4, 0, 0]} name="Ylityö" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Project Breakdown Pie Chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border-border shadow-card">
                <CardHeader>
                  <CardTitle className="text-h3 flex items-center gap-2">
                    <Briefcase size={18} className="text-primary" /> Projektijakauma
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={PROJECT_BREAKDOWN}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {PROJECT_BREAKDOWN.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                      <Legend formatter={(value: string) => <span className="text-sm text-text-secondary">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Work Type Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-border shadow-card">
                <CardHeader>
                  <CardTitle className="text-h3 flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-primary" /> Työlajijakauma
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {WORK_TYPE_BREAKDOWN.map((wt, i) => {
                      const maxHours = Math.max(...WORK_TYPE_BREAKDOWN.map(w => w.hours));
                      const pct = (wt.hours / maxHours) * 100;
                      const colors = ['#F97316', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B'];
                      return (
                        <div key={wt.type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-text-primary font-medium">{wt.type}</span>
                            <span className="text-sm font-mono text-text-secondary">{wt.hours}h</span>
                          </div>
                          <div className="h-3 bg-bg-light rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: colors[i % colors.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Overtime Trend */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-border shadow-card">
                <CardHeader>
                  <CardTitle className="text-h3 flex items-center gap-2">
                    <AlertCircle size={18} className="text-primary" /> Ylityötrendi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={OVERTIME_TREND}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number) => [`${value}h`, 'Ylityötunnit']}
                      />
                      <Line type="monotone" dataKey="ylityo" stroke="#EF4444" strokeWidth={2} dot={{ r: 4, fill: '#EF4444' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── New Entry Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-h2">Kirjaa tunnit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Päivämäärä</Label>
              <Input type="date" defaultValue="2025-06-25" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alkuaika</Label>
                <Input type="time" defaultValue="07:00" />
              </div>
              <div className="space-y-2">
                <Label>Loppuaika</Label>
                <Input type="time" defaultValue="15:00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Projekti</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Valitse projekti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="espoo">Espoon uudisrakennus</SelectItem>
                  <SelectItem value="helsinki">Helsingin toimistorakennus</SelectItem>
                  <SelectItem value="tampere">Tampereen korjaustyö</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Työlaji</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Valitse työlaji" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rak">Rakennus</SelectItem>
                  <SelectItem value="sah">Sähkö</SelectItem>
                  <SelectItem value="lvi">LVI</SelectItem>
                  <SelectItem value="maa">Maalaus</SelectItem>
                  <SelectItem value="eri">Eristys</SelectItem>
                  <SelectItem value="ylit">Ylityö</SelectItem>
                  <SelectItem value="matk">Matka</SelectItem>
                  <SelectItem value="pala">Palaveri</SelectItem>
                  <SelectItem value="muu">Muu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kuvaus</Label>
              <Textarea placeholder="Kuvaile tehty työ..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="submitApproval" defaultChecked className="w-4 h-4 rounded border-border text-primary" />
              <Label htmlFor="submitApproval" className="text-sm text-text-secondary">Lähetä hyväksyttäväksi</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
            <Button className="bg-primary hover:bg-primary-hover text-white" onClick={() => setDialogOpen(false)}>
              Tallenna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
