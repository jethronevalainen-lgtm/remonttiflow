import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Image,
  PenLine
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DiaryEntry {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  author: string;
  weather: string;
  temperature: number;
  workDescription: string;
  completedWork: string[];
  issues: string[];
  visitors: string[];
  photos: number;
  status: 'draft' | 'submitted';
  createdAt: string;
}

const diaryEntries: DiaryEntry[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-15',
    author: 'Mika M.',
    weather: 'Pilvinen',
    temperature: -2,
    workDescription: 'Putkityöt jatkuivat asunnoissa 1-3. Vanhoja putkia purettu ja uusia asennettu.',
    completedWork: ['Putkien purku as 1', 'Uusien putkien asennus as 1', 'Putkien purku as 2 (kesken)'],
    issues: ['Asunto 2: Lattiassa vanha vesivahinko havaittu, tarvitaan lisätarkastus'],
    visitors: ['LVI-tarkastaja Kalle K.'],
    photos: 3,
    status: 'submitted',
    createdAt: '2026-01-15T16:00:00'
  },
  {
    id: '2',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-14',
    author: 'Laura K.',
    weather: 'Aurinkoinen',
    temperature: -5,
    workDescription: 'Sähkötyöt aloitettu asunnoissa 1-2. Johdot vedetty ja rasiat asennettu.',
    completedWork: ['Sähköjohdot as 1', 'Rasiat as 1-2', 'Keskuskaapin tarkistus'],
    issues: [],
    visitors: [],
    photos: 2,
    status: 'submitted',
    createdAt: '2026-01-14T16:00:00'
  },
  {
    id: '3',
    projectId: '2',
    projectName: 'Kerrostalo B',
    date: '2026-01-15',
    author: 'Timo K.',
    weather: 'Pilvinen',
    temperature: -1,
    workDescription: 'Purkutyöt jatkuivat kerroksissa 1-2. Vanhat materiaalit kuljetettu pois.',
    completedWork: ['Purkutyöt krs 1', 'Jätteiden kuljetus', 'Purkutyöt krs 2 (aloitettu)'],
    issues: ['Rappukäytävässä pölyä, lisäsiivous tarvitaan'],
    visitors: ['Työsuojelutarkastaja'],
    photos: 5,
    status: 'submitted',
    createdAt: '2026-01-15T16:00:00'
  },
  {
    id: '4',
    projectId: '3',
    projectName: 'Toimisto C',
    date: '2026-01-15',
    author: 'Jethro',
    weather: 'Sateinen',
    temperature: 3,
    workDescription: 'Katselmus pidetty. Lattiavalu hyväksytty. Seinärajaukset tehty.',
    completedWork: ['Lattiavalun katselmus', 'Seinärajaukset', 'Materiaalien tilaus'],
    issues: ['Lattian tasaisuudessa pieniä poikkeamia hyväksyttävissä rajoissa'],
    visitors: ['Rakennuttaja', 'Valvoja', 'Betoniyhtiön edustaja'],
    photos: 4,
    status: 'draft',
    createdAt: '2026-01-15T17:00:00'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-800">Luonnos</Badge>;
    case 'submitted':
      return <Badge className="bg-green-100 text-green-800">Tallennettu</Badge>;
    default:
      return null;
  }
};

export default function Paivakirjat() {
  const [entries, setEntries] = useState<DiaryEntry[]>(diaryEntries);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('entries');

  const filteredEntries = entries.filter(entry =>
    entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.workDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: entries.length,
    today: entries.filter(e => e.date === '2026-01-15').length,
    issues: entries.filter(e => e.issues.length > 0).length,
    photos: entries.reduce((sum, e) => sum + e.photos, 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Päiväkirjat</h1>
          <p className="text-gray-500 mt-1">Työmaapäiväkirjat ja merkinnät</p>
        </div>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Uusi päiväkirja
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Merkinnät', value: stats.total.toString(), icon: BookOpen, color: 'text-blue-600' },
          { label: 'Tänään', value: stats.today.toString(), icon: Calendar, color: 'text-green-600' },
          { label: 'Poikkeamat', value: stats.issues.toString(), icon: AlertTriangle, color: 'text-yellow-600' },
          { label: 'Valokuvat', value: stats.photos.toString(), icon: Image, color: 'text-purple-600' },
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
          <TabsTrigger value="entries">Merkinnät</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae merkintöjä..."
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

          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{entry.projectName}</h3>
                          {getStatusBadge(entry.status)}
                          {entry.issues.length > 0 && (
                            <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {entry.issues.length} poikkeama
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(entry.date).toLocaleDateString('fi-FI')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {entry.author}
                          </span>
                          <span className="flex items-center gap-1">
                            <PenLine className="w-3 h-3" />
                            {entry.weather}, {entry.temperature}°C
                          </span>
                          <span className="flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {entry.photos} kuvaa
                          </span>
                        </div>
                      </div>
                      {expandedEntry === entry.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {expandedEntry === entry.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-4"
                      >
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Työn kuvaus</h4>
                          <p className="text-sm text-gray-700">{entry.workDescription}</p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2">Tehdyt työt</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {entry.completedWork.map((work, i) => (
                              <li key={i}>{work}</li>
                            ))}
                          </ul>
                        </div>

                        {entry.issues.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 text-red-600">Poikkeamat ja havainnot</h4>
                            <ul className="list-disc list-inside text-sm text-red-700">
                              {entry.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {entry.visitors.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Vierailijat</h4>
                            <div className="flex flex-wrap gap-2">
                              {entry.visitors.map((visitor, i) => (
                                <Badge key={i} variant="outline">{visitor}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                          <Button variant="outline" size="sm">Muokkaa</Button>
                          <Button variant="outline" size="sm">Lataa PDF</Button>
                          <Button variant="outline" size="sm">Tulosta</Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
