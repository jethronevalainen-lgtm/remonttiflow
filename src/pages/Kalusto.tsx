import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Settings, AlertTriangle, Clock, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Equipment {
  id: string;
  name: string;
  type: string;
  serial: string;
  location: string;
  status: string;
  lastMaintenance: string;
  hoursUsed: number;
}

const EQUIPMENT: Equipment[] = [
  { id: 'EQ-001', name: 'Komatsu PC138', type: 'Kaivinkone', serial: 'SN-2023-001', location: 'Tampere', status: 'Käytössä', lastMaintenance: '15.3.2026', hoursUsed: 1240 },
  { id: 'EQ-002', name: 'Volvo EC220E', type: 'Kaivinkone', serial: 'SN-2022-015', location: 'Espoo', status: 'Käytössä', lastMaintenance: '22.4.2026', hoursUsed: 2890 },
  { id: 'EQ-003', name: 'Scania G450', type: 'Kuorma-auto', serial: 'SN-2021-003', location: 'Helsinki', status: 'Vapaa', lastMaintenance: '10.5.2026', hoursUsed: 4560 },
  { id: 'EQ-004', name: 'Hilti TE 2000', type: 'Työkalu', serial: 'SN-2024-112', location: 'Tampere', status: 'Käytössä', lastMaintenance: '1.7.2026', hoursUsed: 180 },
  { id: 'EQ-005', name: 'PERI UP', type: 'Telineet', serial: 'SN-2023-045', location: 'Espoo', status: 'Käytössä', lastMaintenance: '12.4.2026', hoursUsed: 720 },
  { id: 'EQ-006', name: 'Toyota Hilux', type: 'Pakettiauto', serial: 'SN-2022-008', location: 'Turku', status: 'Käytössä', lastMaintenance: '28.6.2026', hoursUsed: 2340 },
  { id: 'EQ-007', name: 'Bosch GSH 16', type: 'Työkalu', serial: 'SN-2024-089', location: 'Helsinki', status: 'Huollossa', lastMaintenance: '18.7.2026', hoursUsed: 95 },
  { id: 'EQ-008', name: 'Liebherr LTM 1050', type: 'Nosturi', serial: 'SN-2021-002', location: 'Tampere', status: 'Vuokralla', lastMaintenance: '10.3.2026', hoursUsed: 890 },
  { id: 'EQ-009', name: 'Mercedes Sprinter', type: 'Pakettiauto', serial: 'SN-2023-012', location: 'Vantaa', status: 'Vapaa', lastMaintenance: '5.7.2026', hoursUsed: 1560 },
  { id: 'EQ-010', name: 'Atlas Copco XATS 156', type: 'Kompressori', serial: 'SN-2022-007', location: 'Espoo', status: 'Käytössä', lastMaintenance: '15.5.2026', hoursUsed: 670 },
];

const STATUS_COLORS: Record<string, string> = {
  'Käytössä': '#22C55E',
  'Vapaa': '#3B82F6',
  'Huollossa': '#F59E0B',
  'Vuokralla': '#8B5CF6',
};

const chartData = EQUIPMENT.map(eq => ({ name: eq.name.split(' ')[0], hours: eq.hoursUsed }));

export default function Kalusto() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Kaikki');
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);

  const filtered = EQUIPMENT.filter(eq => {
    const matchesSearch = !search || eq.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'Kaikki' || eq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Kalusto</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white"><Plus size={16} /> Lisää kalusto</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center"><Wrench size={20} className="text-primary" /></div><div><p className="text-sm text-text-muted">Kaluston määrä</p><p className="text-xl font-bold text-text-primary">{EQUIPMENT.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center"><Settings size={20} className="text-success" /></div><div><p className="text-sm text-text-muted">Käytössä</p><p className="text-xl font-bold text-text-primary">{EQUIPMENT.filter(e => e.status === 'Käytössä').length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center"><AlertTriangle size={20} className="text-warning" /></div><div><p className="text-sm text-text-muted">Huollossa</p><p className="text-xl font-bold text-text-primary">{EQUIPMENT.filter(e => e.status === 'Huollossa').length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center"><Clock size={20} className="text-info" /></div><div><p className="text-sm text-text-muted">Käyttötunteja yht.</p><p className="text-xl font-bold text-text-primary">{EQUIPMENT.reduce((s, e) => s + e.hoursUsed, 0).toLocaleString('fi-FI')}</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['Kaikki', 'Käytössä', 'Vapaa', 'Huollossa', 'Vuokralla'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'bg-primary' : ''}>{s}</Button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><Input placeholder="Hae kalustoa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

      {/* Chart */}
      <Card><CardHeader><CardTitle className="text-base">Käyttötunnit</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><BarChart data={chartData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" /><Bar dataKey="hours" fill="#F97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nimi</TableHead><TableHead>Tyyppi</TableHead><TableHead>Sarjanumero</TableHead><TableHead>Sijainti</TableHead><TableHead>Status</TableHead><TableHead>Viim. huolto</TableHead><TableHead className="text-right">Tunnit</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(eq => (
                <TableRow key={eq.id} className="cursor-pointer" onClick={() => setSelectedEq(eq)}>
                  <TableCell className="font-medium">{eq.name}</TableCell>
                  <TableCell>{eq.type}</TableCell>
                  <TableCell className="font-mono text-xs">{eq.serial}</TableCell>
                  <TableCell>{eq.location}</TableCell>
                  <TableCell><Badge style={{ backgroundColor: STATUS_COLORS[eq.status] + '20', color: STATUS_COLORS[eq.status], borderColor: STATUS_COLORS[eq.status] }}>{eq.status}</Badge></TableCell>
                  <TableCell>{eq.lastMaintenance}</TableCell>
                  <TableCell className="text-right font-mono">{eq.hoursUsed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
