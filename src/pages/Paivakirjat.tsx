import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Clock,
  MapPin,
  Wrench,
  Users,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const diaryEntries = [
  {
    id: '1',
    date: '15.1.2026',
    author: 'Matti M.',
    project: 'Rivitalo A',
    weather: 'Pilvinen, -2°C',
    content: 'Putkityöt etenivät suunnitellusti. Keittiön putket asennettu ja testattu. Huomiseksi suunniteltu kylpyhuoneen putkien asennus.',
    workers: 5,
    hours: 37.5,
    issues: '',
  },
  {
    id: '2',
    date: '14.1.2026',
    author: 'Laura K.',
    project: 'Kerrostalo B',
    weather: 'Sateinen, +1°C',
    content: 'Laatoituksen valmistelu aloitettu. Asuntojen purkutyöt valmiit 8/12. Materiaalitoimitus saapui klo 10.30.',
    workers: 4,
    hours: 30.0,
    issues: 'Hissi poissa käytöstä - korjaaja tilattu',
  },
  {
    id: '3',
    date: '13.1.2026',
    author: 'Jussi P.',
    project: 'Rivitalo D',
    weather: 'Aurinkoinen, -5°C',
    content: 'Sähköasennukset jatkuivat. Pääkeskus asennettu ja johdotus aloitettu. Asiakas tyytyväinen edistymiseen.',
    workers: 2,
    hours: 15.0,
    issues: '',
  },
  {
    id: '4',
    date: '12.1.2026',
    author: 'Anna S.',
    project: 'Rivitalo A',
    weather: 'Luminen, -8°C',
    content: 'Purkuvalmius tehty. Vanhat putket poistettu. Rakennusjäte lajiteltu ja kuljetettu. Turvakierros OK.',
    workers: 6,
    hours: 45.0,
    issues: '',
  },
];

export default function Paivakirjat() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('1');

  const filtered = diaryEntries.filter(e =>
    e.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työmaapäiväkirjat</h1>
          <p className="text-gray-500 mt-1">Päivittäiset kirjaukset ja tapahtumat</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4" /> Uusi kirjaus
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Hae päiväkirjoista..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(entry => (
          <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.project}</span>
                        <Badge variant="outline" className="text-xs">{entry.date}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{entry.author}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entry.workers} hlö</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{entry.hours} h</span>
                      </div>
                    </div>
                  </div>
                  {expandedId === entry.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
                <AnimatePresence>
                  {expandedId === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t text-sm text-gray-700">
                        <p className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" /> Sää: {entry.weather}
                        </p>
                        <p className="whitespace-pre-line">{entry.content}</p>
                        {entry.issues && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg text-red-700 text-sm flex items-start gap-2">
                            <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {entry.issues}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
