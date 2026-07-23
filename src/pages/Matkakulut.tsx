import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  Plus,
  Search,
  Filter,
  Euro,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TravelExpense {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: 'mileage' | 'allowance' | 'parking' | 'other';
  description: string;
  startLocation?: string;
  endLocation?: string;
  distance?: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  receiptUrl?: string;
  projectId?: string;
  projectName?: string;
}

const travelExpenses: TravelExpense[] = [
  {
    id: '1',
    employeeId: '1',
    employeeName: 'Mika M.',
    date: '2026-01-15',
    type: 'mileage',
    description: 'Työmatka Rivitalo A',
    startLocation: 'Toimisto',
    endLocation: 'Rivitalo A',
    distance: 25,
    amount: 18.75,
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-15',
    projectId: '1',
    projectName: 'Rivitalo A'
  },
  {
    id: '2',
    employeeId: '2',
    employeeName: 'Laura K.',
    date: '2026-01-15',
    type: 'mileage',
    description: 'Työmatka Kerrostalo B',
    startLocation: 'Toimisto',
    endLocation: 'Kerrostalo B',
    distance: 40,
    amount: 30.00,
    status: 'pending',
    projectId: '2',
    projectName: 'Kerrostalo B'
  },
  {
    id: '3',
    employeeId: '1',
    employeeName: 'Mika M.',
    date: '2026-01-14',
    type: 'allowance',
    description: 'Päiväraha',
    amount: 42.00,
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-14',
    projectId: '1',
    projectName: 'Rivitalo A'
  },
  {
    id: '4',
    employeeId: '3',
    employeeName: 'Jussi P.',
    date: '2026-01-15',
    type: 'parking',
    description: 'Pysäköinti',
    amount: 15.00,
    status: 'pending',
    projectId: '1',
    projectName: 'Rivitalo A'
  },
  {
    id: '5',
    employeeId: '4',
    employeeName: 'Timo K.',
    date: '2026-01-13',
    type: 'mileage',
    description: 'Työmatka Toimisto C',
    startLocation: 'Toimisto',
    endLocation: 'Toimisto C',
    distance: 30,
    amount: 22.50,
    status: 'approved',
    approvedBy: 'Jethro',
    approvedAt: '2026-01-13',
    projectId: '3',
    projectName: 'Toimisto C'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>;
    case 'approved':
      return <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-800">Hylätty</Badge>;
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'mileage': return 'Kilometrikorvaus';
    case 'allowance': return 'Päiväraha';
    case 'parking': return 'Pysäköinti';
    case 'other': return 'Muu';
    default: return type;
  }
};

export default function Matkakulut() {
  const [expenses, setExpenses] = useState<TravelExpense[]>(travelExpenses);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  const filteredExpenses = expenses.filter(e =>
    e.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.projectName && e.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  const totalDistance = expenses.filter(e => e.type === 'mileage' && e.distance).reduce((sum, e) => sum + (e.distance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matkakulut</h1>
          <p className="text-gray-500 mt-1">Kilometrikorvaukset ja päivärahat</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi matkakulu
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Kirjaukset', value: expenses.length.toString(), icon: FileText, color: 'text-blue-600' },
          { label: 'Kilometrit yht.', value: `${totalDistance} km`, icon: Car, color: 'text-gray-600' },
          { label: 'Odottaa', value: `${totalPending.toFixed(2)} €`, icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Hyväksytty', value: `${totalApproved.toFixed(2)} €`, icon: CheckCircle2, color: 'text-green-600' },
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
          <TabsTrigger value="list">Kirjaukset</TabsTrigger>
          <TabsTrigger value="summary">Yhteenveto</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae kirjauksia..."
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

          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-1">Päivä</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-2">Kuvaus</div>
                <div className="col-span-2">Reitti</div>
                <div className="col-span-1">Summa</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Projekti</div>
              </div>
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-1 text-sm">{new Date(expense.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-xs">{getTypeLabel(expense.type)}</Badge>
                  </div>
                  <div className="col-span-2 font-medium">{expense.employeeName}</div>
                  <div className="col-span-2 text-sm">{expense.description}</div>
                  <div className="col-span-2 text-sm text-gray-600">
                    {expense.startLocation && expense.endLocation ? (
                      <span>{expense.startLocation} → {expense.endLocation} ({expense.distance} km)</span>
                    ) : (
                      '-'
                    )}
                  </div>
                  <div className="col-span-1 font-medium">{expense.amount.toFixed(2)} €</div>
                  <div className="col-span-1">{getStatusBadge(expense.status)}</div>
                  <div className="col-span-2 text-sm">{expense.projectName || '-'}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Työntekijöittäin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(expenses.map(e => e.employeeName))).map(name => {
                    const total = expenses.filter(e => e.employeeName === name).reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm">{name}</span>
                        <span className="font-medium">{total.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projekteittain</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(expenses.filter(e => e.projectName).map(e => e.projectName!))).map(name => {
                    const total = expenses.filter(e => e.projectName === name).reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm">{name}</span>
                        <span className="font-medium">{total.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
