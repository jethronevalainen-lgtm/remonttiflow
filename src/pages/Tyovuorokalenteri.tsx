import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Users,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const workers = ['Matti M.', 'Laura K.', 'Jussi P.', 'Anna S.', 'Pekka H.'];

const shifts = [
  { id: '1', worker: 'Matti M.', date: '2026-01-20', start: '07:00', end: '15:00', project: 'Rivitalo A', type: 'day' },
  { id: '2', worker: 'Laura K.', date: '2026-01-20', start: '08:00', end: '16:00', project: 'Kerrostalo B', type: 'day' },
  { id: '3', worker: 'Jussi P.', date: '2026-01-20', start: '07:00', end: '15:00', project: 'Rivitalo D', type: 'day' },
  { id: '4', worker: 'Anna S.', date: '2026-01-20', start: '06:00', end: '14:00', project: 'Rivitalo A', type: 'day' },
  { id: '5', worker: 'Pekka H.', date: '2026-01-20', start: '09:00', end: '17:00', project: 'Kerrostalo B', type: 'day' },
  { id: '6', worker: 'Matti M.', date: '2026-01-21', start: '07:00', end: '15:00', project: 'Rivitalo A', type: 'day' },
  { id: '7', worker: 'Laura K.', date: '2026-01-21', start: '08:00', end: '16:00', project: 'Kerrostalo B', type: 'day' },
  { id: '8', worker: 'Jussi P.', date: '2026-01-21', start: '07:00', end: '11:00', project: 'Rivitalo D', type: 'half' },
];

const getShiftColor = (project: string) => {
  switch (project) {
    case 'Rivitalo A': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Kerrostalo B': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Rivitalo D': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function Tyovuorokalenteri() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 20));
  const [view, setView] = useState<'week' | 'day'>('week');

  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const dayNames = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
  const monthNames = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä', 'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu'];

  const formatDateKey = (d: Date) => d.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työvuorokalenteri</h1>
          <p className="text-gray-500 mt-1">Työvuorojen suunnittelu ja hallinta</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setView(view === 'week' ? 'day' : 'week')}>
            {view === 'week' ? 'Päivänäkymä' : 'Viikkonäkymä'}
          </Button>
          <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
            <Plus className="w-4 h-4" /> Uusi vuoro
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {weekDays[0].getDate()}. - {weekDays[6].getDate()}. {monthNames[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
        </h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-8 gap-2">
        <div className="font-medium text-sm text-gray-500 p-2">Työntekijä</div>
        {weekDays.map((d, i) => (
          <div key={i} className={`text-center p-2 rounded-lg text-sm font-medium ${
            d.toDateString() === new Date().toDateString() ? 'bg-primary-light text-primary' : 'text-gray-700'
          }`}>
            {dayNames[i]} {d.getDate()}.
          </div>
        ))}

        {workers.map(worker => (
          <>
            <div key={worker} className="p-2 text-sm font-medium flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">{worker.charAt(0)}</span>
              </div>
              {worker}
            </div>
            {weekDays.map((d, i) => {
              const dayShifts = shifts.filter(s => s.worker === worker && s.date === formatDateKey(d));
              return (
                <div key={`${worker}-${i}`} className="p-1 min-h-[60px] border rounded-lg">
                  {dayShifts.map(s => (
                    <div key={s.id} className={`text-xs p-1 rounded mb-1 ${getShiftColor(s.project)}`}>
                      <div className="font-medium truncate">{s.project}</div>
                      <div className="text-[10px]">{s.start}-{s.end}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Päällekkäisyydet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">Ei havaittuja päällekkäisyyksiä tällä viikolla.</p>
        </CardContent>
      </Card>
    </div>
  );
}
