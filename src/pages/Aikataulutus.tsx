import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const phases = [
  { id: '1', name: 'Purku', project: 'Rivitalo A', start: '2026-01-05', end: '2026-01-20', progress: 100, color: 'bg-green-500' },
  { id: '2', name: 'Putkityöt', project: 'Rivitalo A', start: '2026-01-21', end: '2026-02-15', progress: 65, color: 'bg-blue-500' },
  { id: '3', name: 'Laatoitus', project: 'Rivitalo A', start: '2026-02-16', end: '2026-03-01', progress: 0, color: 'bg-gray-300' },
  { id: '4', name: 'Kylpyhuoneet', project: 'Kerrostalo B', start: '2026-01-08', end: '2026-02-28', progress: 15, color: 'bg-purple-500' },
  { id: '5', name: 'Sähkötyöt', project: 'Rivitalo D', start: '2025-11-15', end: '2026-02-15', progress: 80, color: 'bg-yellow-500' },
  { id: '6', name: 'Suunnittelu', project: 'Toimisto C', start: '2026-02-01', end: '2026-02-28', progress: 5, color: 'bg-pink-500' },
];

const milestones = [
  { id: '1', title: 'Putkityön tarkastus', date: '16.1.2026', project: 'Rivitalo A', type: 'inspection' },
  { id: '2', title: 'Sähkötyön välitarkastus', date: '18.1.2026', project: 'Kerrostalo B', type: 'inspection' },
  { id: '3', title: 'Laatoituksen aloitus', date: '20.1.2026', project: 'Rivitalo A', type: 'start' },
  { id: '4', title: 'Työturvallisuustarkastus', date: '22.1.2026', project: 'Toimisto C', type: 'safety' },
];

export default function Aikataulutus() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 1));

  const monthNames = ['Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
    'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aikataulutus</h1>
          <p className="text-gray-500 mt-1">Projektien vaiheiden ja määräaikojen hallinta</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi vaihe
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Projektiaikataulu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phases.map((phase, i) => (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-32 flex-shrink-0">
                  <p className="text-sm font-medium">{phase.name}</p>
                  <p className="text-xs text-gray-500">{phase.project}</p>
                </div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${phase.color} rounded-lg transition-all`}
                    style={{ width: `${phase.progress}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                    {phase.start} - {phase.end} ({phase.progress}%)
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Tulevat määräpäivät
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {milestones.map(m => (
              <div key={m.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">{m.date}</span>
                </div>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-gray-500">{m.project}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
