import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
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
  Shield,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  ArrowUpDown,
  Award,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  socialSecurityNumber: string;
  bankAccount: string;
  hourlyRate: number;
  startDate: string;
  employmentType: 'full_time' | 'part_time' | 'seasonal';
  status: 'active' | 'sick_leave' | 'vacation' | 'terminated';
  certifications: string[];
  skills: string[];
  emergencyContact: string;
  emergencyPhone: string;
  notes: string;
}

interface WorkEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  date: string;
  hours: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
}

const initialEmployees: Employee[] = [
  {
    id: '1',
    firstName: 'Mika',
    lastName: 'Mäkinen',
    role: 'Putkiasentaja',
    department: 'Putkityöt',
    phone: '040-1234567',
    email: 'mika.makinen@vakantti.fi',
    address: 'Putoskatu 1',
    city: 'Helsinki',
    socialSecurityNumber: '010170-123A',
    bankAccount: 'FI49 1234 5678 9012 34',
    hourlyRate: 22.50,
    startDate: '2023-01-15',
    employmentType: 'full_time',
    status: 'active',
    certifications: ['Putkiasennus', 'LVI-työt', 'Hygieniapassi'],
    skills: ['Kupari', 'Muovi', 'Teräs'],
    emergencyContact: 'Marja Mäkinen',
    emergencyPhone: '040-7654321',
    notes: 'Erittäin taitava putkiasentaja. Suosittelen kehityskeskusteluun.'
  },
  {
    id: '2',
    firstName: 'Laura',
    lastName: 'Korhonen',
    role: 'Sähköasentaja',
    department: 'Sähkötyöt',
    phone: '040-2345678',
    email: 'laura.korhonen@vakantti.fi',
    address: 'Sähkökatu 5',
    city: 'Espoo',
    socialSecurityNumber: '150275-234B',
    bankAccount: 'FI49 2345 6789 0123 45',
    hourlyRate: 24.00,
    startDate: '2022-06-01',
    employmentType: 'full_time',
    status: 'active',
    certifications: ['Sähkötyöturvallisuus', 'ATA1', 'ATA2'],
    skills: ['Sähköasennus', 'Automaatio', 'Valaistus'],
    emergencyContact: 'Petri Korhonen',
    emergencyPhone: '040-8765432',
    notes: 'Kokenut sähköasentaja. Pystyy itsenäiseen työskentelyyn.'
  },
  {
    id: '3',
    firstName: 'Jussi',
    lastName: 'Puttonen',
    role: 'Laatoittaja',
    department: 'Laatoitus',
    phone: '040-3456789',
    email: 'jussi.puttonen@vakantti.fi',
    address: 'Laatoituskatu 12',
    city: 'Vantaa',
    socialSecurityNumber: '200380-345C',
    bankAccount: 'FI49 3456 7890 1234 56',
    hourlyRate: 21.00,
    startDate: '2024-03-01',
    employmentType: 'full_time',
    status: 'vacation',
    certifications: ['Laatoitus', 'Vesieristys'],
    skills: ['Laatoitus', 'Vesieristys', 'Marmori'],
    emergencyContact: 'Anna Puttonen',
    emergencyPhone: '040-9876543',
    notes: 'Hyvä laatoittaja. Loma 15.1.-29.1.2026.'
  },
  {
    id: '4',
    firstName: 'Timo',
    lastName: 'Kallio',
    role: 'Rakennusmies',
    department: 'Yleinen',
    phone: '040-4567890',
    email: 'timo.kallio@vakantti.fi',
    address: 'Rakennuskatu 8',
    city: 'Helsinki',
    socialSecurityNumber: '050485-456D',
    bankAccount: 'FI49 4567 8901 2345 67',
    hourlyRate: 19.50,
    startDate: '2024-01-10',
    employmentType: 'full_time',
    status: 'sick_leave',
    certifications: ['Työturvallisuus', 'Tulityö'],
    skills: ['Purkutyöt', 'Muuraus', 'Betonityöt'],
    emergencyContact: 'Leena Kallio',
    emergencyPhone: '040-0987654',
    notes: 'Sairasloma 10.1.-20.1.2026. Lääkärintodistus saatu.'
  },
  {
    id: '5',
    firstName: 'Sari',
    lastName: 'Virtanen',
    role: 'Siivooja',
    department: 'Siivous',
    phone: '040-5678901',
    email: 'sari.virtanen@vakantti.fi',
    address: 'Siivouskatu 3',
    city: 'Espoo',
    socialSecurityNumber: '100690-567E',
    bankAccount: 'FI49 5678 9012 3456 78',
    hourlyRate: 16.50,
    startDate: '2025-01-05',
    employmentType: 'part_time',
    status: 'active',
    certifications: ['Siivous', 'Työturvallisuus'],
    skills: ['Rakennussiivous', 'Loppusiivous'],
    emergencyContact: 'Matti Virtanen',
    emergencyPhone: '040-1098765',
    notes: 'Osa-aikainen (30h/vko).'
  }
];

const workEntries: WorkEntry[] = [
  { id: '1', employeeId: '1', employeeName: 'Mika M.', projectId: '1', projectName: 'Rivitalo A', date: '2026-01-15', hours: 8, description: 'Putkiasennusta', status: 'approved' },
  { id: '2', employeeId: '2', employeeName: 'Laura K.', projectId: '2', projectName: 'Kerrostalo B', date: '2026-01-15', hours: 7.5, description: 'Sähköasennusta', status: 'pending' },
  { id: '3', employeeId: '4', employeeName: 'Timo K.', projectId: '1', projectName: 'Rivitalo A', date: '2026-01-14', hours: 0, description: 'Sairasloma', status: 'approved' },
  { id: '4', employeeId: '5', employeeName: 'Sari V.', projectId: '1', projectName: 'Rivitalo A', date: '2026-01-15', hours: 6, description: 'Rakennussiivous', status: 'pending' }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Aktiivinen</Badge>;
    case 'sick_leave':
      return <Badge className="bg-red-100 text-red-800">Sairasloma</Badge>;
    case 'vacation':
      return <Badge className="bg-blue-100 text-blue-800">Loma</Badge>;
    case 'terminated':
      return <Badge className="bg-gray-100 text-gray-800">Päättynyt</Badge>;
    default:
      return null;
  }
};

const getEmploymentTypeLabel = (type: string) => {
  switch (type) {
    case 'full_time': return 'Kokoaikainen';
    case 'part_time': return 'Osa-aikainen';
    case 'seasonal': return 'Kausityö';
    default: return type;
  }
};

export default function Henkilosto() {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key as keyof Employee];
    const bVal = b[sortConfig.key as keyof Employee];
    if (aVal === undefined || bVal === undefined) return 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredEmployees = sortedEmployees.filter(emp =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.phone.includes(searchTerm)
  );

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    sickLeave: employees.filter(e => e.status === 'sick_leave').length,
    vacation: employees.filter(e => e.status === 'vacation').length,
    avgRate: employees.reduce((sum, e) => sum + e.hourlyRate, 0) / employees.length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Henkilöstö</h1>
          <p className="text-gray-500 mt-1">Hallinnoi työntekijöitä ja työaikaa</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => { setShowAddForm(true); setSelectedEmployee(null); }}
        >
          <Plus className="w-4 h-4" />
          Lisää työntekijä
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Työntekijöitä', value: stats.total.toString(), icon: Users, color: 'text-blue-600' },
          { label: 'Aktiiviset', value: stats.active.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Sairaslomalla', value: stats.sickLeave.toString(), icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Lomalla', value: stats.vacation.toString(), icon: Calendar, color: 'text-blue-600' },
          { label: 'Kesk. tuntipalkka', value: `${stats.avgRate.toFixed(2)} €`, icon: Euro, color: 'text-purple-600' },
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
          <TabsTrigger value="list">Työntekijät</TabsTrigger>
          <TabsTrigger value="hours">Tuntikirjaukset</TabsTrigger>
          {selectedEmployee && <TabsTrigger value="details">Tiedot</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae työntekijöitä nimellä, roolilla tai osastolla..."
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

          {/* Employee List */}
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <button
                  className="col-span-3 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('lastName')}
                >
                  Nimi <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  className="col-span-2 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('role')}
                >
                  Rooli <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-2">Yhteystiedot</div>
                <button
                  className="col-span-1 flex items-center gap-1 hover:text-gray-900"
                  onClick={() => handleSort('hourlyRate')}
                >
                  Palkka <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="col-span-1">Tila</div>
                <div className="col-span-2">Sertifikaatit</div>
                <div className="col-span-1 text-right">Toiminnot</div>
              </div>

              {/* Table Rows */}
              <AnimatePresence>
                {filteredEmployees.map((emp) => (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                    onClick={() => { setSelectedEmployee(emp); setActiveTab('details'); }}
                  >
                    <div className="col-span-3">
                      <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                      <div className="text-sm text-gray-500">{emp.department}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm">{emp.role}</div>
                      <div className="text-xs text-gray-500">{getEmploymentTypeLabel(emp.employmentType)}</div>
                    </div>
                    <div className="col-span-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {emp.phone}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Mail className="w-3 h-3" />
                        {emp.email}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span className="font-medium">{emp.hourlyRate.toFixed(2)} €/h</span>
                    </div>
                    <div className="col-span-1">{getStatusBadge(emp.status)}</div>
                    <div className="col-span-2">
                      <div className="flex flex-wrap gap-1">
                        {emp.certifications.slice(0, 2).map((cert) => (
                          <Badge key={cert} variant="outline" className="text-xs">{cert}</Badge>
                        ))}
                        {emp.certifications.length > 2 && (
                          <Badge variant="outline" className="text-xs">+{emp.certifications.length - 2}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setActiveTab('details'); }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredEmployees.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Ei työntekijöitä hakuehdoilla</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-700">
                <div className="col-span-2">Työntekijä</div>
                <div className="col-span-2">Projekti</div>
                <div className="col-span-2">Päivämäärä</div>
                <div className="col-span-1">Tunnit</div>
                <div className="col-span-3">Kuvaus</div>
                <div className="col-span-2">Tila</div>
              </div>
              {workEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-b-0 hover:bg-gray-50 items-center">
                  <div className="col-span-2 font-medium">{entry.employeeName}</div>
                  <div className="col-span-2">{entry.projectName}</div>
                  <div className="col-span-2">{new Date(entry.date).toLocaleDateString('fi-FI')}</div>
                  <div className="col-span-1">{entry.hours} h</div>
                  <div className="col-span-3 text-sm text-gray-600">{entry.description}</div>
                  <div className="col-span-2">
                    {entry.status === 'approved' ? (
                      <Badge className="bg-green-100 text-green-800">Hyväksytty</Badge>
                    ) : entry.status === 'rejected' ? (
                      <Badge className="bg-red-100 text-red-800">Hylätty</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">Odottaa</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedEmployee && (
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-blue-600" />
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </div>
                  {getStatusBadge(selectedEmployee.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Info */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Työsuhdetiedot
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Rooli:</span> <span>{selectedEmployee.role}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Osasto:</span> <span>{selectedEmployee.department}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Tuntipalkka:</span> <span className="font-medium">{selectedEmployee.hourlyRate.toFixed(2)} €/h</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Työsuhde:</span> <span>{getEmploymentTypeLabel(selectedEmployee.employmentType)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Alkamispäivä:</span> <span>{new Date(selectedEmployee.startDate).toLocaleDateString('fi-FI')}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Henkilötunnus:</span> <span>{selectedEmployee.socialSecurityNumber}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Tilinumero:</span> <span>{selectedEmployee.bankAccount}</span></div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Yhteystiedot
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {selectedEmployee.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-gray-400" />
                        {selectedEmployee.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {selectedEmployee.address}, {selectedEmployee.city}
                      </div>
                      <div className="mt-4">
                        <span className="text-gray-500">Hätäyhteyshenkilö:</span>
                        <div className="mt-1">
                          <div>{selectedEmployee.emergencyContact}</div>
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="w-3 h-3" />
                            {selectedEmployee.emergencyPhone}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Certifications & Skills */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Sertifikaatit ja taidot
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Sertifikaatit:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedEmployee.certifications.map((cert) => (
                          <Badge key={cert} className="bg-blue-100 text-blue-800">{cert}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Taidot:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedEmployee.skills.map((skill) => (
                          <Badge key={skill} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedEmployee.notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Muistiinpanot
                    </h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedEmployee.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
