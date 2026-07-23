import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Calendar, GraduationCap, HardHat, Wrench, Briefcase,
  Phone, Mail, Search, Plus, Settings, MoreHorizontal, CheckCircle,
  Clock, AlertTriangle, Shield, Award,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const employees = [
  { id: '1', name: 'Matti M.', role: 'Putkimies', department: 'LVI', phone: '040-1234567', email: 'matti@vakantti.fi', status: 'active', projects: 2, hours: 1520, training: 4 },
  { id: '2', name: 'Laura K.', role: 'Laatoittaja', department: 'Pinnat', phone: '040-2345678', email: 'laura@vakantti.fi', status: 'active', projects: 1, hours: 1480, training: 3 },
  { id: '3', name: 'Jussi P.', role: 'Sähkömies', department: 'Sähkö', phone: '040-3456789', email: 'jussi@vakantti.fi', status: 'vacation', projects: 1, hours: 1600, training: 5 },
  { id: '4', name: 'Anna S.', role: 'LVI-asentaja', department: 'LVI', phone: '040-4567890', email: 'anna@vakantti.fi', status: 'active', projects: 2, hours: 1450, training: 4 },
  { id: '5', name: 'Pekka H.', role: 'Rakennusmies', department: 'Yleinen', phone: '040-5678901', email: 'pekka@vakantti.fi', status: 'active', projects: 1, hours: 1550, training: 3 },
  { id: '6', name: 'Maria L.', role: 'Työnjohtaja', department: 'Johto', phone: '040-6789012', email: 'maria@vakantti.fi', status: 'active', projects: 5, hours: 1680, training: 6 },
  { id: '7', name: 'Timo R.', role: 'Maalari', department: 'Pinnat', phone: '040-7890123', email: 'timo@vakantti.fi', status: 'sick', projects: 0, hours: 1200, training: 2 },
  { id: '8', name: 'Satu K.', role: 'Siivooja', department: 'Kiinteistö', phone: '040-8901234', email: 'satu@vakantti.fi', status: 'active', projects: 3, hours: 1400, training: 2 },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active': return <Badge className="bg-green-100 text-green-800">Työssä</Badge>;
    case 'vacation': return <Badge className="bg-blue-100 text-blue-800">Lomalla</Badge>;
    case 'sick': return <Badge className="bg-red-100 text-red-800">Sairas</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Henkilosto() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('employees');

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = employees.filter(e => e.status === 'active').length;
  const onVacation = employees.filter(e => e.status === 'vacation').length;
  const sickCount = employees.filter(e => e.status === 'sick').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Henkilöstö</h1>
          <p className="text-gray-500 mt-1">Työntekijät, roolit ja osaaminen</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Lisää henkilö
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Henkilöstö', value: employees.length, icon: Users },
          { label: 'Työssä', value: activeCount, icon: UserCheck, color: 'text-green-600' },
          { label: 'Lomalla', value: onVacation, icon: Calendar, color: 'text-blue-600' },
          { label: 'Sairas', value: sickCount, icon: AlertTriangle, color: 'text-red-600' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color || ''}`}>{s.value}</p>
                </div>
                <s.icon className="w-8 h-8 text-gray-300" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae henkilöstöstä..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-2">Nimi</div>
            <div className="col-span-2">Rooli</div>
            <div className="col-span-1">Osasto</div>
            <div className="col-span-1">Tila</div>
            <div className="col-span-1">Projektit</div>
            <div className="col-span-2">Tunnit</div>
            <div className="col-span-1">Koulutus</div>
            <div className="col-span-2 text-right">Toiminnot</div>
          </div>
          {filtered.map(e => (
            <div key={e.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors items-center">
              <div className="col-span-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{e.name.charAt(0)}</span>
                </div>
                <span className="text-sm font-medium">{e.name}</span>
              </div>
              <div className="col-span-2 text-sm">{e.role}</div>
              <div className="col-span-1 text-sm">{e.department}</div>
              <div className="col-span-1">{getStatusBadge(e.status)}</div>
              <div className="col-span-1 text-sm">{e.projects}</div>
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <Progress value={(e.hours / 1800) * 100} className="h-2 w-16" />
                  <span className="text-xs">{e.hours}h</span>
                </div>
              </div>
              <div className="col-span-1 flex items-center gap-1">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-sm">{e.training}</span>
              </div>
              <div className="col-span-2 text-right">
                <Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
