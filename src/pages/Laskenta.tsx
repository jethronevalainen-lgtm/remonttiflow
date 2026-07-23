import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Plus,
  Search,
  FileText,
  Euro,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const calculations = [
  { id: '1', name: 'Rivitalo A - Putkiremontti', customer: 'Asunto Oy Keltainen Tähti', amount: 145000, status: 'approved', date: '15.1.2026' },
  { id: '2', name: 'Kerrostalo B - Kylpyhuoneet', customer: 'Asunto Oy Sininen Talo', amount: 85000, status: 'pending', date: '14.1.2026' },
  { id: '3', name: 'Toimisto C - Peruskorjaus', customer: 'Helsingin Kaupunki', amount: 320000, status: 'draft', date: '10.1.2026' },
  { id: '4', name: 'Rivitalo D - Sähkötyöt', customer: 'Tmi Rakennus Rane', amount: 35000, status: 'approved', date: '5.1.2026' },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>;
    case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>;
    case 'draft': return <Badge variant="outline">Luonnos</Badge>;
    case 'rejected': return <Badge className="bg-red-100 text-red-800">Hylätty</Badge>;
    default: return null;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
    default: return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

export default function Laskenta() {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = calculations.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = calculations.reduce((s, c) => s + c.amount, 0);
  const approvedAmount = calculations.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laskenta</h1>
          <p className="text-gray-500 mt-1">Kustannuslaskelmat ja tarjoukset</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi laskelma
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Laskelmia yht.</p>
              <p className="text-2xl font-bold">{calculations.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Summa yht.</p>
              <p className="text-2xl font-bold text-primary">{totalAmount.toLocaleString('fi-FI')} €</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Hyväksytty</p>
              <p className="text-2xl font-bold text-green-600">{approvedAmount.toLocaleString('fi-FI')} €</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae laskelmista..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <div className="space-y-2">
        {filtered.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(c.status)}
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.customer} · {c.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(c.status)}
                  <span className="font-medium text-sm">{c.amount.toLocaleString('fi-FI')} €</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
