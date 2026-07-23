import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Sun,
  Moon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  projectId?: string;
  projectName?: string;
  type: 'work' | 'vacation' | 'sick' | 'training' | 'day_off';
  notes: string;
}

const shifts: Shift[] = [
  // Mika M. - Week 3
  { id: '1', employeeId: '1', employeeName: 'Mika M.', date: '2026-01-12', startTime: '07:00', endTime: '15:30', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '2', employeeId: '1', employeeName: 'Mika M.', date: '2026-01-13', startTime: '07:00', endTime: '15:30', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '3', employeeId: '1', employeeName: 'Mika M.', date: '2026-01-14', startTime: '07:00', endTime: '15:30', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '4', employeeId: '1', employeeName: 'Mika M.', date: '2026-01-15', startTime: '07:00', endTime: '15:30', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '5', employeeId: '1', employeeName: 'Mika M.', date: '2026-01-16', startTime: '07:00', endTime: '12:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: 'Lyhyt päivä' },

  // Laura K. - Week 3
  { id: '6', employeeId: '2', employeeName: 'Laura K.', date: '2026-01-12', startTime: '07:30', endTime: '15:00', projectId: '2', projectName: 'Kerrostalo B', type: 'work', notes: '' },
  { id: '7', employeeId: '2', employeeName: 'Laura K.', date: '2026-01-13', startTime: '07:30', endTime: '15:00', projectId: '2', projectName: 'Kerrostalo B', type: 'work', notes: '' },
  { id: '8', employeeId: '2', employeeName: 'Laura K.', date: '2026-01-14', startTime: '07:30', endTime: '15:00', projectId: '2', projectName: 'Kerrostalo B', type: 'work', notes: '' },
  { id: '9', employeeId: '2', employeeName: 'Laura K.', date: '2026-01-15', startTime: '07:30', endTime: '15:00', projectId: '2', projectName: 'Kerrostalo B', type: 'work', notes: '' },

  // Jussi P. - Week 3 (vacation Thu-Fri)
  { id: '10', employeeId: '3', employeeName: 'Jussi P.', date: '2026-01-12', startTime: '08:00', endTime: '14:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '11', employeeId: '3', employeeName: 'Jussi P.', date: '2026-01-13', startTime: '08:00', endTime: '14:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '12', employeeId: '3', employeeName: 'Jussi P.', date: '2026-01-14', startTime: '', endTime: '', type: 'vacation', notes: 'Loma' },
  { id: '13', employeeId: '3', employeeName: 'Jussi P.', date: '2026-01-15', startTime: '', endTime: '', type: 'vacation', notes: 'Loma' },

  // Timo K. - Week 3 (sick leave Mon-Wed)
  { id: '14', employeeId: '4', employeeName: 'Timo K.', date: '2026-01-12', startTime: '', endTime: '', type: 'sick', notes: 'Sairasloma' },
  { id: '15', employeeId: '4', employeeName: 'Timo K.', date: '2026-01-13', startTime: '', endTime: '', type: 'sick', notes: 'Sairasloma' },
  { id: '16', employeeId: '4', employeeName: 'Timo K.', date: '2026-01-14', startTime: '', endTime: '', type: 'sick', notes: 'Sairasloma' },
  { id: '17', employeeId: '4', employeeName: 'Timo K.', date: '2026-01-15', startTime: '07:00', endTime: '15:00', projectId: '3', projectName: 'Toimisto C', type: 'work', notes: 'Paluu töihin' },
  { id: '18', employeeId: '4', employeeName: 'Timo K.', date: '2026-01-16', startTime: '07:00', endTime: '15:00', projectId: '3', projectName: 'Toimisto C', type: 'work', notes: '' },

  // Sari V. - Week 3 (part-time)
  { id: '19', employeeId: '5', employeeName: 'Sari V.', date: '2026-01-12', startTime: '08:00', endTime: '14:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '20', employeeId: '5', employeeName: 'Sari V.', date: '2026-01-13', startTime: '08:00', endTime: '14:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
  { id: '21', employeeId: '5', employeeName: 'Sari V.', date: '2026-01-14', startTime: '08:00', endTime: '14:00', projectId: '1', projectName: 'Rivitalo A', type: 'work', notes: '' },
];

const employees = ['Mika M.', 'Laura K.', 'Jussi P.', 'Timo K.', 'Sari V.'];

const getShiftBadge = (type: string) => {
  switch (type) {
    case 'work':
      return <Badge className="bg-blue-100 text-blue-800">Työ</Badge>;
    case 'vacation':
      return <Badge className="bg-green-100 text-green-800">Loma</Badge>;
    case 'sick':
      return <Badge className="bg-red-100 text-red-800">Sairas</Badge>;
    case 'training':
      return <Badge className="bg-purple-100 text-purple-800">Koulutus</Badge>;
    case 'day_off':
      return <Badge variant="outline">Vapaa</Badge>;
    default:
      return null;
  }
};

const getFinnishDayName = (date: Date): string => {
  const days = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
  return days[date.getDay()];
};

export default function Tyovuorokalenteri() {
  const [currentWeek, setCurrentWeek] = useState(3);
  const [activeTab, setActiveTab] = useState('week');

  // Get dates for current week
  const getWeekDates = (weekNum: number) => {
    const start = new Date(2026, 0, (weekNum - 1) * 7 + 1);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeek);
  const weekDays = weekDates.slice(0, 5); // Mon-Fri

  const stats = {
    totalShifts: shifts.filter(s => s.type === 'work').length,
    vacationDays: shifts.filter(s => s.type === 'vacation').length,
    sickDays: shifts.filter(s => s.type === 'sick').length,
    totalEmployees: employees.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työvuorokalenteri</h1>
          <p className="text-gray-500 mt-1">Työvuorojen suunnittelu ja hallinta</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi vuoro
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Työvuorot', value: stats.totalShifts.toString(), icon: CalendarDays, color: 'text-blue-600' },
          { label: 'Lomapäivät', value: stats.vacationDays.toString(), icon: Sun, color: 'text-green-600' },
          { label: 'Sairauspoissaolot', value: stats.sickDays.toString(), icon: Moon, color: 'text-red-600' },
          { label: 'Työntekijät', value: stats.totalEmployees.toString(), icon: Users, color: 'text-purple-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-20`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="week">Viikkonäkymä</TabsTrigger>
          <TabsTrigger value="list">Listanäkymä</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <h3 className="font-semibold">Viikko {currentWeek}, 2026</h3>
              <p className="text-sm text-gray-500">
                {weekDates[0].toLocaleDateString('fi-FI')} - {weekDates[6].toLocaleDateString('fi-FI')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left text-sm font-medium text-gray-700 w-32">Työntekijä</th>
                    {weekDays.map((date, i) => (
                      <th key={i} className="p-3 text-center text-sm font-medium text-gray-700 border-l">
                        <div>{getFinnishDayName(date)}</div>
                        <div className="text-xs text-gray-500">{date.getDate()}.{date.getMonth() + 1}.</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp} className="border-b last:border-b-0">
                      <td className="p-3 font-medium text-sm">{emp}</td>
                      {weekDays.map((date, i) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const shift = shifts.find(s => s.employeeName === emp && s.date === dateStr);
                        return (
                          <td key={i} className="p-3 border-l text-center">
                            {shift ? (
                              <div className="space-y-1">
                                {getShiftBadge(shift.type)}
                                {shift.type === 'work' && (
                                  <div className="text-xs text-gray-600">
                                    <div>{shift.startTime}-{shift.endTime}</div>
                                    <div className="text-gray-400">{shift.projectName}</div>
                                  </div>
                                )}
                                {shift.notes && (
                                  <div className="text-xs text-gray-400">{shift.notes}</div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="opacity-50">-</Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-1">Päivä</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-2">Aika</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-2">Huomautukset</div>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>
              {shifts.map((shift) => (
                <div key={shift.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-2 font-medium">{shift.employeeName}</div>
                  <div className="col-span-1 text-sm">{new Date(shift.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1">{getShiftBadge(shift.type)}</div>
                  <div className="col-span-2 text-sm">
                    {shift.type === 'work' ? `${shift.startTime} - ${shift.endTime}` : '-'}
                  </div>
                  <div className="col-span-2 text-sm">{shift.projectName || '-'}</div>
                  <div className="col-span-2 text-sm text-gray-600">{shift.notes}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
