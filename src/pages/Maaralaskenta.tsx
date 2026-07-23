import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Plus,
  Search,
  Filter,
  Euro,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface QuantityItem {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  category: string;
  unit: string;
  estimatedQuantity: number;
  actualQuantity: number;
  unitPrice: number;
  totalEstimated: number;
  totalActual: number;
  variance: number;
  status: 'draft' | 'confirmed' | 'invoiced';
}

const quantityItems: QuantityItem[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    name: 'Putkien asennus',
    category: 'Putkityöt',
    unit: 'm',
    estimatedQuantity: 500,
    actualQuantity: 520,
    unitPrice: 45,
    totalEstimated: 22500,
    totalActual: 23400,
    variance: 4.0,
    status: 'confirmed'
  },
  {
    id: '2',
    projectId: '1',
    projectName: 'Rivitalo A',
    name: 'Laatoitus',
    category: 'Laatoitus',
    unit: 'm²',
    estimatedQuantity: 80,
    actualQuantity: 75,
    unitPrice: 120,
    totalEstimated: 9600,
    totalActual: 9000,
    variance: -6.25,
    status: 'confirmed'
  },
  {
    id: '3',
    projectId: '2',
    projectName: 'Kerrostalo B',
    name: 'Sähköasennus',
    category: 'Sähkötyöt',
    unit: 'kpl',
    estimatedQuantity: 12,
    actualQuantity: 12,
    unitPrice: 2500,
    totalEstimated: 30000,
    totalActual: 30000,
    variance: 0,
    status: 'invoiced'
  },
  {
    id: '4',
    projectId: '1',
    projectName: 'Rivitalo A',
    name: 'Vesieristys',
    category: 'Vesieristys',
    unit: 'm²',
    estimatedQuantity: 60,
    actualQuantity: 0,
    unitPrice: 80,
    totalEstimated: 4800,
    totalActual: 0,
    variance: 0,
    status: 'draft'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-800">Luonnos</Badge>;
    case 'confirmed':
      return <Badge className="bg-green-100 text-green-800">Vahvistettu</Badge>;
    case 'invoiced':
      return <Badge className="bg-blue-100 text-blue-800">Laskutettu</Badge>;
    default:
      return null;
  }
};

const getVarianceColor = (variance: number) => {
  if (variance > 5) return 'text-red-600';
  if (variance > 0) return 'text-yellow-600';
  if (variance < -5) return 'text-green-600';
  return 'text-gray-600';
};

export default function Maaralaskenta() {
  const [items, setItems] = useState<QuantityItem[]>(quantityItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEstimated = items.reduce((sum, i) => sum + i.totalEstimated, 0);
  const totalActual = items.reduce((sum, i) => sum + i.totalActual, 0);
  const totalVariance = totalEstimated > 0 ? ((totalActual - totalEstimated) / totalEstimated) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Määrälaskenta</h1>
          <p className="text-gray-500 mt-1">Työmäärät ja määrämuutokset</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi määrä
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Määrät yhteensä', value: items.length.toString(), icon: Package, color: 'text-blue-600' },
          { label: 'Arvioitu arvo', value: `${totalEstimated.toLocaleString('fi-FI')} €`, icon: FileText, color: 'text-gray-600' },
          { label: 'Toteutunut', value: `${totalActual.toLocaleString('fi-FI')} €`, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Poikkeama', value: `${totalVariance.toFixed(1)}%`, icon: TrendingUp, color: totalVariance > 5 ? 'text-red-600' : totalVariance < 0 ? 'text-green-600' : 'text-yellow-600' },
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
            placeholder="Hae määriä..."
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

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{item.name}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{item.projectName}</span>
                      <span>{item.category}</span>
                      <span>{item.estimatedQuantity} {item.unit} (arvio)</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{item.actualQuantity} {item.unit} (toteuma)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{item.totalActual.toLocaleString('fi-FI')} €</p>
                    <p className={`text-sm ${getVarianceColor(item.variance)}`}>
                      Poikkeama: {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}%
                    </p>
                  </div>
                  {expandedItem === item.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 ml-4" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 ml-4" />
                  )}
                </div>

                {expandedItem === item.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Arvioitu määrä</label>
                        <p className="font-medium">{item.estimatedQuantity} {item.unit}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Toteutunut määrä</label>
                        <p className="font-medium">{item.actualQuantity} {item.unit}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Yksikköhinta</label>
                        <p className="font-medium">{item.unitPrice.toLocaleString('fi-FI')} €/{item.unit}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Yhteensä (arvio)</label>
                        <p className="font-medium">{item.totalEstimated.toLocaleString('fi-FI')} €</p>
                        <label className="text-sm text-gray-500">Yhteensä (toteuma)</label>
                        <p className="font-medium">{item.totalActual.toLocaleString('fi-FI')} €</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="outline" size="sm">Muokkaa</Button>
                      <Button variant="outline" size="sm">Päivitä toteuma</Button>
                      {item.status === 'confirmed' && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Laskuta</Button>
                      )}
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
