import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Building2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Star,
  FileText,
  MessageSquare,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ContactPerson {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

interface Customer {
  id: string;
  name: string;
  type: 'company' | 'individual';
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  yTunnus?: string;
  rating: number;
  status: 'active' | 'passive' | 'prospect';
  notes: string;
  contactPersons: ContactPerson[];
  projectCount: number;
  totalValue: number;
  lastContact: string;
  createdAt: string;
}

interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

const initialCustomers: Customer[] = [
  {
    id: '1',
    name: 'Asunto Oy Keltanen Tähti',
    type: 'company',
    address: 'Keltanenkatu 15',
    city: 'Helsinki',
    postalCode: '00100',
    phone: '050-1234567',
    email: 'hallitus@keltanentalo.fi',
    yTunnus: '1234567-8',
    rating: 5,
    status: 'active',
    notes: 'Tärkeä asiakas. Hallitus kokoontuu kuukausittain.',
    contactPersons: [
      { id: '1', name: 'Matti Meikäläinen', role: 'Hallituksen puheenjohtaja', phone: '040-1234567', email: 'matti@example.fi', isPrimary: true },
      { id: '2', name: 'Liisa Laatikkoinen', role: 'Isännöitsijä', phone: '040-7654321', email: 'liisa@example.fi', isPrimary: false }
    ],
    projectCount: 3,
    totalValue: 145000,
    lastContact: '2026-01-15',
    createdAt: '2025-06-01'
  },
  {
    id: '2',
    name: 'Tmi Rakennus Rane',
    type: 'company',
    address: 'Rakennuskatu 8',
    city: 'Espoo',
    postalCode: '02100',
    phone: '050-9876543',
    email: 'rane@rakennus.fi',
    yTunnus: '9876543-2',
    rating: 4,
    status: 'active',
    notes: 'Alihankkija, tekee hyvää jälkeä.',
    contactPersons: [
      { id: '3', name: 'Rane Rakennus', role: 'Yrittäjä', phone: '050-9876543', email: 'rane@rakennus.fi', isPrimary: true }
    ],
    projectCount: 5,
    totalValue: 89000,
    lastContact: '2026-01-14',
    createdAt: '2025-03-15'
  },
  {
    id: '3',
    name: 'Pekka Puttonen',
    type: 'individual',
    address: 'Putostie 22 B 15',
    city: 'Vantaa',
    postalCode: '01300',
    phone: '040-1112223',
    email: 'pekka@puttonen.fi',
    rating: 3,
    status: 'prospect',
    notes: 'Pyysi tarjousta keittiöremontista.',
    contactPersons: [],
    projectCount: 0,
    totalValue: 0,
    lastContact: '2026-01-10',
    createdAt: '2026-01-10'
  },
  {
    id: '4',
    name: 'Asunto Oy Sininen Talo',
    type: 'company',
    address: 'Sinikatu 42',
    city: 'Helsinki',
    postalCode: '00500',
    phone: '050-4445556',
    email: 'hallitus@sininentalo.fi',
    yTunnus: '5556667-8',
    rating: 4,
    status: 'active',
    notes: 'Kylpyhuoneremontti meneillään.',
    contactPersons: [
      { id: '4', name: 'Sari Sininen', role: 'Hallituksen puheenjohtaja', phone: '040-4445556', email: 'sari@sininen.fi', isPrimary: true }
    ],
    projectCount: 1,
    totalValue: 45000,
    lastContact: '2026-01-12',
    createdAt: '2025-09-01'
  },
  {
    id: '5',
    name: 'Helsingin Kaupunki',
    type: 'company',
    address: 'Pohjoisesplanadi 11-13',
    city: 'Helsinki',
    postalCode: '00170',
    phone: '09-3101691',
    email: 'helsinki@helsinki.fi',
    yTunnus: '0211675-2',
    rating: 5,
    status: 'active',
    notes: 'Julkinen tilaaja. Laadukkaat vaatimukset.',
    contactPersons: [
      { id: '5', name: 'Kaarina Kaupunki', role: 'Hankintapäällikkö', phone: '09-3101692', email: 'kaarina@helsinki.fi', isPrimary: true }
    ],
    projectCount: 2,
    totalValue: 320000,
    lastContact: '2026-01-08',
    createdAt: '2024-11-01'
  }
];

const customerNotes: CustomerNote[] = [
  { id: '1', customerId: '1', content: 'Hallituksen kokous pidetty. Päätettiin aloittaa putkiremontti.', createdBy: 'Jethro', createdAt: '2026-01-15' },
  { id: '2', customerId: '1', content: 'Matti soitti ja kyseli aikataulusta.', createdBy: 'Jethro', createdAt: '2026-01-10' },
  { id: '3', customerId: '2', content: 'Ranen kanssa sovittu seuraavasta työmaasta.', createdBy: 'Jethro', createdAt: '2026-01-14' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Aktiivinen</Badge>;
    case 'passive':
      return <Badge className="bg-gray-100 text-gray-800">Passiivinen</Badge>;
    case 'prospect':
      return <Badge className="bg-yellow-100 text-yellow-800">Prospekti</Badge>;
    default:
      return null;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'company':
      return <Badge variant="outline" className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Yritys</Badge>;
    case 'individual':
      return <Badge variant="outline" className="flex items-center gap-1"><Users className="w-3 h-3" /> Yksityishenkilö</Badge>;
    default:
      return null;
  }
};

const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
    />
  ));
};

export default function Asiakkaat() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key as keyof Customer];
    const bVal = b[sortConfig.key as keyof Customer];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredCustomers = sortedCustomers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    prospects: customers.filter(c => c.status === 'prospect').length,
    totalValue: customers.reduce((sum, c) => sum + c.totalValue, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asiakkaat</h1>
          <p className="text-gray-500 mt-1">Hallinnoi asiakastietoja ja yhteyshenkilöitä</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => { setShowAddForm(true); setSelectedCustomer(null); }}
        >
          <Plus className="w-4 h-4" />
          Lisää asiakas
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Asiakkaita yhteensä', value: stats.total.toString(), icon: Users, color: 'text-blue-600' },
          { label: 'Aktiiviset', value: stats.active.toString(), icon: Star, color: 'text-green-600' },
          { label: 'Prospektit', value: stats.prospects.toString(), icon: Clock, color: 'text-yellow-600' },
          { label: 'Kokonaisarvo', value: `${(stats.totalValue / 1000).toFixed(0)}k €`, icon: FileText, color: 'text-purple-600' },
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
          <TabsTrigger value="list">Asiakaslista</TabsTrigger>
          {selectedCustomer && <TabsTrigger value="details">Asiakastiedot</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae asiakkaita nimellä, sähköpostilla tai puhelinnumerolla..."
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

          {/* Customer List */}
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <button
                  className="col-span-3 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('name')}
                >
                  Nimi <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-2">Tyyppi</div>
                <div className="col-span-2">Yhteystiedot</div>
                <button
                  className="col-span-1 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('rating')}
                >
                  Arvio <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-1">Tila</div>
                <button
                  className="col-span-1 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('projectCount')}
                >
                  Projektit <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-2 text-right">Toiminnot</div>
              </div>

              {/* Table Rows */}
              <AnimatePresence>
                {filteredCustomers.map((customer) => (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                    onClick={() => { setSelectedCustomer(customer); setActiveTab('details'); }}
                  >
                    <div className="col-span-3">
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {customer.address}, {customer.postalCode} {customer.city}
                      </div>
                    </div>
                    <div className="col-span-2">{getTypeBadge(customer.type)}</div>
                    <div className="col-span-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Mail className="w-3 h-3" />
                        {customer.email}
                      </div>
                    </div>
                    <div className="col-span-1 flex">{renderStars(customer.rating)}</div>
                    <div className="col-span-1">{getStatusBadge(customer.status)}</div>
                    <div className="col-span-1 text-center">
                      <Badge variant="outline">{customer.projectCount}</Badge>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); setActiveTab('details'); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredCustomers.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Ei asiakkaita hakuehdoilla</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedCustomer && (
          <TabsContent value="details" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setActiveTab('list')}>
                ← Takaisin listaan
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Muokkaa
                </Button>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Poista
                </Button>
              </div>
            </div>

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedCustomer.type === 'company' ? (
                      <Building2 className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Users className="w-6 h-6 text-blue-600" />
                    )}
                    {selectedCustomer.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedCustomer.status)}
                    {getTypeBadge(selectedCustomer.type)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Yhteystiedot</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {selectedCustomer.address}, {selectedCustomer.postalCode} {selectedCustomer.city}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {selectedCustomer.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {selectedCustomer.email}
                      </div>
                      {selectedCustomer.yTunnus && (
                        <div className="text-gray-600">
                          Y-tunnus: {selectedCustomer.yTunnus}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Tilastot</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        Arvosana: {selectedCustomer.rating}/5
                      </div>
                      <div>Projektien määrä: {selectedCustomer.projectCount}</div>
                      <div>Kokonaisarvo: {selectedCustomer.totalValue.toLocaleString('fi-FI')} €</div>
                      <div>Viimeisin yhteydenotto: {new Date(selectedCustomer.lastContact).toLocaleDateString('fi-FI')}</div>
                      <div>Asiakkuuden alku: {new Date(selectedCustomer.createdAt).toLocaleDateString('fi-FI')}</div>
                    </div>
                  </div>
                </div>

                {selectedCustomer.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Muistiinpanot</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedCustomer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Persons */}
            {selectedCustomer.contactPersons.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Yhteyshenkilöt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedCustomer.contactPersons.map((person) => (
                      <div
                        key={person.id}
                        className={`p-4 rounded-lg border ${person.isPrimary ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{person.name}</span>
                              {person.isPrimary && (
                                <Badge className="bg-blue-100 text-blue-800">Pääyhteyshenkilö</Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{person.role}</div>
                          </div>
                          <div className="text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {person.phone}
                            </div>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {person.email}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Muistiinpanohistoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerNotes
                    .filter(n => n.customerId === selectedCustomer.id)
                    .map((note) => (
                      <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-800">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{note.createdBy}</span>
                          <span>•</span>
                          <span>{new Date(note.createdAt).toLocaleDateString('fi-FI')}</span>
                        </div>
                      </div>
                    ))}
                  {customerNotes.filter(n => n.customerId === selectedCustomer.id).length === 0 && (
                    <p className="text-gray-500 text-center py-4">Ei muistiinpanoja</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
