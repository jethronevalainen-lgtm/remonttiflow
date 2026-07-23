import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Euro,
  Star,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  ArrowUpDown,
  Settings,
  Truck,
  Hammer,
  Drill,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Equipment {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  year: number;
  purchaseDate: string;
  purchasePrice: number;
  status: 'available' | 'in_use' | 'maintenance' | 'broken';
  currentProject?: string;
  lastService: string;
  nextService: string;
  notes: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  type: 'routine' | 'repair' | 'inspection';
  description: string;
  cost: number;
  performedBy: string;
}

const initialEquipment: Equipment[] = [
  {
    id: '1',
    name: 'Pyörölaikka',
    type: 'Sähkötyökalu',
    manufacturer: 'Makita',
    model: 'DGA504',
    serialNumber: 'SN123456',
    year: 2023,
    purchaseDate: '2023-03-15',
    purchasePrice: 350,
    status: 'available',
    lastService: '2025-12-01',
    nextService: '2026-03-01',
    notes: 'Hyvässä kunnossa'
  },
  {
    id: '2',
    name: 'Porakone',
    type: 'Sähkötyökalu',
    manufacturer: 'Bosch',
    model: 'GBH 2-28 F',
    serialNumber: 'SN789012',
    year: 2022,
    purchaseDate: '2022-06-20',
    purchasePrice: 450,
    status: 'in_use',
    currentProject: 'Rivitalo A',
    lastService: '2025-11-15',
    nextService: '2026-02-15',
    notes: 'Poraustehokas'
  },
  {
    id: '3',
    name: 'Pakettiauto',
    type: 'Kuljetus',
    manufacturer: 'Ford',
    model: 'Transit',
    serialNumber: 'ABC-123',
    year: 2021,
    purchaseDate: '2021-01-10',
    purchasePrice: 25000,
    status: 'in_use',
    currentProject: 'Kerrostalo B',
    lastService: '2025-10-20',
    nextService: '2026-01-20',
    notes: 'Hyvä kuljetusauto'
  },
  {
    id: '4',
    name: 'Laikkaleikkuri',
    type: 'Sähkötyökalu',
    manufacturer: 'Husqvarna',
    model: 'K-770',
    serialNumber: 'SN345678',
    year: 2024,
    purchaseDate: '2024-02-01',
    purchasePrice: 1200,
    status: 'maintenance',
    lastService: '2026-01-10',
    nextService: '2026-04-10',
    notes: 'Terän vaihto ja huolto'
  },
  {
    id: '5',
    name: 'Imuri',
    type: 'Siivous',
    manufacturer: 'Nilfisk',
    model: 'Attix 30-01',
    serialNumber: 'SN901234',
    year: 2023,
    purchaseDate: '2023-05-15',
    purchasePrice: 550,
    status: 'available',
    lastService: '2025-12-10',
    nextService: '2026-03-10',
    notes: 'Teollisuusimuri'
  }
];

const maintenanceRecords: MaintenanceRecord[] = [
  { id: '1', equipmentId: '1', equipmentName: 'Pyörölaikka', date: '2025-12-01', type: 'routine', description: 'Vuosihuolto', cost: 50, performedBy: 'Makita Service' },
  { id: '2', equipmentId: '2', equipmentName: 'Porakone', date: '2025-11-15', type: 'repair', description: 'Hiiliharjojen vaihto', cost: 35, performedBy: 'Bosch Service' },
  { id: '3', equipmentId: '4', equipmentName: 'Laikkaleikkuri', date: '2026-01-10', type: 'repair', description: 'Terän vaihto', cost: 180, performedBy: 'Husqvarna Service' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'available':
      return <Badge className="bg-green-100 text-green-800">Vapaa</Badge>;
    case 'in_use':
      return <Badge className="bg-blue-100 text-blue-800">Käytössä</Badge>;
    case 'maintenance':
      return <Badge className="bg-yellow-100 text-yellow-800">Huollossa</Badge>;
    case 'broken':
      return <Badge className="bg-red-100 text-red-800">Rikki</Badge>;
    default:
      return null;
  }
};

const getMaintenanceTypeBadge = (type: string) => {
  switch (type) {
    case 'routine':
      return <Badge className="bg-green-100 text-green-800">Huolto</Badge>;
    case 'repair':
      return <Badge className="bg-red-100 text-red-800">Korjaus</Badge>;
    case 'inspection':
      return <Badge className="bg-blue-100 text-blue-800">Tarkastus</Badge>;
    default:
      return null;
  }
};

export default function Kalusto() {
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  const filteredEquipment = equipment.filter(eq =>
    eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    inUse: equipment.filter(e => e.status === 'in_use').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    totalValue: equipment.reduce((sum, e) => sum + e.purchasePrice, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kalusto</h1>
          <p className="text-gray-500 mt-1">Työkalut, laitteet ja ajoneuvot</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Lisää kalusto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Kalusto yhteensä', value: stats.total.toString(), icon: Wrench, color: 'text-blue-600' },
          { label: 'Vapaa', value: stats.available.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Käytössä', value: stats.inUse.toString(), icon: Settings, color: 'text-blue-600' },
          { label: 'Huollossa', value: stats.maintenance.toString(), icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Kokonaisarvo', value: `${(stats.totalValue / 1000).toFixed(0)}k €`, icon: Euro, color: 'text-purple-600' },
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
          <TabsTrigger value="list">Kalustolista</TabsTrigger>
          <TabsTrigger value="maintenance">Huoltohistoria</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae kalustoa..."
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
                <div className="col-span-2">Nimi</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-2">Valmistaja / Malli</div>
                <div className="col-span-1">Vuosi</div>
                <div className="col-span-1">Hankintahinta</div>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Viim. huolto / Seur.</div>
                <div className="col-span-2">Huomautukset</div>
              </div>
              {filteredEquipment.map((eq) => (
                <div
                  key={eq.id}
                  className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer items-center"
                  onClick={() => setSelectedEquipment(eq)}
                >
                  <div className="col-span-2 font-medium">{eq.name}</div>
                  <div className="col-span-1 text-sm">{eq.type}</div>
                  <div className="col-span-2 text-sm">
                    <div>{eq.manufacturer}</div>
                    <div className="text-gray-500">{eq.model}</div>
                  </div>
                  <div className="col-span-1 text-sm">{eq.year}</div>
                  <div className="col-span-1 text-sm">{eq.purchasePrice.toLocaleString('fi-FI')} €</div>
                  <div className="col-span-1">{getStatusBadge(eq.status)}</div>
                  <div className="col-span-2 text-sm">
                    <div>{new Date(eq.lastService).toLocaleDateString('fi-FI')}</div>
                    <div className="text-gray-500">{new Date(eq.nextService).toLocaleDateString('fi-FI')}</div>
                  </div>
                  <div className="col-span-2 text-sm text-gray-600 truncate">{eq.notes}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Kalusto</div>
                <div className="col-span-1">Päivä</div>
                <div className="col-span-1">Tyyppi</div>
                <div className="col-span-4">Kuvaus</div>
                <div className="col-span-1">Kustannus</div>
                <div className="col-span-3">Suorittaja</div>
              </div>
              {maintenanceRecords.map((record) => (
                <div key={record.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-2 font-medium">{record.equipmentName}</div>
                  <div className="col-span-1 text-sm">{new Date(record.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1">{getMaintenanceTypeBadge(record.type)}</div>
                  <div className="col-span-4 text-sm">{record.description}</div>
                  <div className="col-span-1 text-sm">{record.cost.toLocaleString('fi-FI')} €</div>
                  <div className="col-span-3 text-sm">{record.performedBy}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
