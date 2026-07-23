import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Star,
  ChevronRight,
  Euro,
  FolderOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Customer {
  id: string;
  name: string;
  type: 'company' | 'housing' | 'municipality';
  contact: string;
  phone: string;
  email: string;
  address: string;
  projects: number;
  totalValue: number;
  rating: number;
}

const customers: Customer[] = [
  { id: '1', name: 'Asunto Oy Keltainen Tähti', type: 'housing', contact: 'Mikko M.', phone: '040-1234567', email: 'mikko@keltainentahhti.fi', address: 'Keltanenkatu 15, Helsinki', projects: 3, totalValue: 510000, rating: 5 },
  { id: '2', name: 'Tmi Rakennus Rane', type: 'company', contact: 'Rane R.', phone: '050-7654321', email: 'rane@rakennusrane.fi', address: 'Ranekatu 3, Vantaa', projects: 2, totalValue: 85000, rating: 4 },
  { id: '3', name: 'Asunto Oy Sininen Talo', type: 'housing', contact: 'Sari S.', phone: '040-9876543', email: 'sari@sininentalo.fi', address: 'Sinikatu 42, Helsinki', projects: 1, totalValue: 85000, rating: 5 },
  { id: '4', name: 'Helsingin Kaupunki', type: 'municipality', contact: 'Anna T.', phone: '09-31012345', email: 'anna.t@hel.fi', address: 'Pohjoisesplanadi 11-13, Helsinki', projects: 1, totalValue: 320000, rating: 4 },
  { id: '5', name: 'Asunto Oy Merituuli', type: 'housing', contact: 'Kari J.', phone: '040-5557890', email: 'kari@merituuli.fi', address: 'Merikatu 8, Espoo', projects: 0, totalValue: 0, rating: 3 },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'company': return <Badge className="bg-blue-100 text-blue-800">Yritys</Badge>;
    case 'housing': return <Badge className="bg-green-100 text-green-800">Taloyhtiö</Badge>;
    case 'municipality': return <Badge className="bg-purple-100 text-purple-800">Kunta</Badge>;
    default: return null;
  }
};

export default function Asiakkaat() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCustomers = customers.length;
  const totalValue = customers.reduce((s, c) => s + c.totalValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asiakkaat</h1>
          <p className="text-gray-500 mt-1">Asiakasrekisteri ja yhteystiedot</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi asiakas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <Users className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm text-gray-500">Asiakkaita</p>
              <p className="text-2xl font-bold">{totalCustomers}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <Euro className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-sm text-gray-500">Arvo yht.</p>
              <p className="text-2xl font-bold text-green-600">{(totalValue / 1000).toFixed(0)}k €</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <FolderOpen className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-sm text-gray-500">Projekteja</p>
              <p className="text-2xl font-bold text-blue-600">{customers.reduce((s, c) => s + c.projects, 0)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hae asiakkaista..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(customer => (
          <motion.div key={customer.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full" onClick={() => setSelectedCustomer(customer)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.contact}</p>
                    </div>
                  </div>
                  {getTypeBadge(customer.type)}
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p className="flex items-center gap-2"><Phone className="w-3 h-3" />{customer.phone}</p>
                  <p className="flex items-center gap-2"><Mail className="w-3 h-3" />{customer.email}</p>
                  <p className="flex items-center gap-2"><MapPin className="w-3 h-3" />{customer.address}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className="text-sm text-gray-500">{customer.projects} projektia</span>
                  <span className="font-medium text-sm">{customer.totalValue.toLocaleString('fi-FI')} €</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
