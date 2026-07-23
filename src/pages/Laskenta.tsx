import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  Euro,
  FileText,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CostEstimate {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  createdAt: string;
  validUntil: string;
}

const costEstimates: CostEstimate[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    name: 'Putkiremontti - arvio',
    category: 'Putkityöt',
    description: 'Vanhojen putkien purku ja uusien asennus',
    quantity: 1,
    unit: 'kpl',
    unitPrice: 45000,
    totalPrice: 45000,
    status: 'approved',
    createdAt: '2025-12-01',
    validUntil: '2026-03-01'
  },
  {
    id: '2',
    projectId: '2',
    projectName: 'Kerrostalo B',
    name: 'Sähkötyöt - arvio',
    category: 'Sähkötyöt',
    description: 'Sähköasennukset asuntoihin',
    quantity: 12,
    unit: 'asunto',
    unitPrice: 2500,
    totalPrice: 30000,
    status: 'sent',
    createdAt: '2026-01-10',
    validUntil: '2026-04-10'
  },
  {
    id: '3',
    projectId: '3',
    projectName: 'Toimisto C',
    name: 'Maalaustyöt - arvio',
    category: 'Maalaus',
    description: 'Seinien ja kattojen maalaus',
    quantity: 500,
    unit: 'm²',
    unitPrice: 25,
    totalPrice: 12500,
    status: 'draft',
    createdAt: '2026-01-14',
    validUntil: '2026-04-14'
  },
  {
    id: '4',
    projectId: '1',
    projectName: 'Rivitalo A',
    name: 'Laatoitus - arvio',
    category: 'Laatoitus',
    description: 'Kylpyhuoneiden laatoitus',
    quantity: 80,
    unit: 'm²',
    unitPrice: 120,
    totalPrice: 9600,
    status: 'approved',
    createdAt: '2025-12-15',
    validUntil: '2026-03-15'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-800">Luonnos</Badge>;
    case 'sent':
      return <Badge className="bg-blue-100 text-blue-800">Lähetetty</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800">Hylätty</Badge>;
    default:
      return null;
  }
};

export default function Laskenta() {
  const [estimates, setEstimates] = useState<CostEstimate[]>(costEstimates);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null);

  const filteredEstimates = estimates.filter(est =>
    est.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    est.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    est.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalApproved = estimates.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.totalPrice, 0);
  const totalPending = estimates.filter(e => e.status === 'sent').reduce((sum, e) => sum + e.totalPrice, 0);
  const totalDraft = estimates.filter(e => e.status === 'draft').reduce((sum, e) => sum + e.totalPrice, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laskenta</h1>
          <p className="text-gray-500 mt-1">Kustannusarviot ja tarjoukset</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi arvio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Arviot yhteensä', value: estimates.length.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Hyväksytty', value: `${totalApproved.toLocaleString('fi-FI')} €`, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Odottaa', value: `${totalPending.toLocaleString('fi-FI')} €`, icon: Clock, color: 'text-yellow-600' },
          { label: 'Luonnokset', value: `${totalDraft.toLocaleString('fi-FI')} €`, icon: TrendingUp, color: 'text-gray-600' },
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

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Hae arvioita..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Suodata
        </Button>
      </div>

      {/* Estimates List */}
      <div className="space-y-3">
        {filteredEstimates.map((estimate) => (
          <motion.div
            key={estimate.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedEstimate(expandedEstimate === estimate.id ? null : estimate.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{estimate.name}</h3>
                      {getStatusBadge(estimate.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{estimate.projectName}</span>
                      <span>{estimate.category}</span>
                      <span>{estimate.quantity} {estimate.unit}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{estimate.totalPrice.toLocaleString('fi-FI')} €</p>
                    <p className="text-sm text-gray-500">{estimate.unitPrice.toLocaleString('fi-FI')} €/{estimate.unit}</p>
                  </div>
                  {expandedEstimate === estimate.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 ml-4" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 ml-4" />
                  )}
                </div>

                {expandedEstimate === estimate.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Kuvaus</label>
                        <p className="text-sm mt-1">{estimate.description}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Luotu</label>
                        <p className="text-sm mt-1">{new Date(estimate.createdAt).toLocaleDateString('fi-FI')}</p>
                        <label className="text-sm text-gray-500 mt-2">Voimassa</label>
                        <p className="text-sm mt-1">{new Date(estimate.validUntil).toLocaleDateString('fi-FI')}</p>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button variant="outline" size="sm">Muokkaa</Button>
                        <Button variant="outline" size="sm">Lataa PDF</Button>
                        {estimate.status === 'draft' && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Lähetä</Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
