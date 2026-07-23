import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Cloud, Sun, CloudRain, Wind, Thermometer, Users, FileText, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, addDays, subDays } from 'date-fns';
import { fi } from 'date-fns/locale';

const diaryEntries = [
  { id: 1, date: '2026-07-22', project: 'Korjaustyö Tampere', author: 'Matti Meikäläinen', weather: 'Aurinkoinen', temperature: '22°C', wind: '3 m/s', workers: 8, workDescription: 'LVI-asennukset etenivät suunnitellusti. Kolme kylpyhuonetta valmiiksi.', issues: '' },
  { id: 2, date: '2026-07-22', project: 'Uudisrakennus Espoo', author: 'Pekka Seppänen', weather: 'Pilvinen', temperature: '19°C', wind: '5 m/s', workers: 12, workDescription: 'Sähköasennukset kerroksissa 3-5. Maalaustyöt aloitettu.', issues: 'Materiaalitoimitus viivästynyt 1 päivä.' },
  { id: 3, date: '2026-07-21', project: 'Saneeraus Helsinki', author: 'Anna Lahtinen', weather: 'Sateinen', temperature: '17°C', wind: '7 m/s', workers: 5, workDescription: 'Ikkunoiden poisto vanhoista aukoista. Valmistelutyöt valmiina.', issues: 'Sade hidasti ulkotöitä.' },
  { id: 4, date: '2026-07-21', project: 'Piha-alue Turku', author: 'Sari Kolehmainen', weather: 'Aurinkoinen', temperature: '24°C', wind: '2 m/s', workers: 4, workDescription: 'Pihan päällystys eteni 80%. Istutukset aloitettu.', issues: '' },
  { id: 5, date: '2026-07-20', project: 'Korjaustyö Tampere', author: 'Jukka Lehtonen', weather: 'Puolipilvinen', temperature: '20°C', wind: '4 m/s', workers: 6, workDescription: 'Putkityöt keittiöissä. Lattialämmitys testattu.', issues: '' },
];

const weatherIcon = (weather: string) => {
  if (weather.includes('Aurinko')) return <Sun size={18} className="text-warning" />;
  if (weather.includes('Sade')) return <CloudRain size={18} className="text-info" />;
  return <Cloud size={18} className="text-text-muted" />;
};

export default function Paivakirjat() {
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 6, 22));
  const selectedStr = format(selectedDate, 'yyyy-MM-dd');
  const entries = diaryEntries.filter(e => e.date === selectedStr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Päiväkirjat</h1>
        <Button className="gap-1.5 bg-primary hover:bg-primary-hover text-white">
          <Plus size={16} /> Uusi merkintä
        </Button>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            <ChevronLeft size={16} />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <span className="font-semibold text-text-primary">
              {format(selectedDate, 'EEEE d.M.yyyy', { locale: fi })}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            <ChevronRight size={16} />
          </Button>
        </CardContent>
      </Card>

      {/* Entries */}
      {entries.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-text-secondary">Ei päiväkirjamerkintöjä valitulle päivälle.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{entry.project}</CardTitle>
                      <Badge variant="outline">{entry.author}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-secondary">
                      <span className="flex items-center gap-1">{weatherIcon(entry.weather)} {entry.weather}</span>
                      <span className="flex items-center gap-1"><Thermometer size={14} /> {entry.temperature}</span>
                      <span className="flex items-center gap-1"><Wind size={14} /> {entry.wind}</span>
                      <span className="flex items-center gap-1"><Users size={14} /> {entry.workers} hlö</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-text-primary">{entry.workDescription}</p>
                  {entry.issues && (
                    <div className="p-3 bg-danger-light rounded-lg text-sm text-danger">
                      <strong>Huomautukset:</strong> {entry.issues}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
