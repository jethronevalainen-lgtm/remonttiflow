import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Users,
  Droplets,
  Thermometer,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */
const diaryEntries = [
  {
    id: 1,
    date: '2025-06-23',
    dateFormatted: 'Maanantai 23. kesäkuuta 2025',
    project: 'Tampere, Hatanpään valtatie 12',
    author: 'Matti Korhonen',
    authorInitials: 'MK',
    weather: { icon: 'cloud', temp: 18, wind: 5, precipitation: 2 },
    workers: [
      { name: 'Matti Korhonen', hours: 8 },
      { name: 'Pekka Salminen', hours: 8 },
      { name: 'Timo Nieminen', hours: 7.5 },
      { name: 'Sari Rantanen', hours: 6 },
    ],
    tasks: [
      { desc: 'Runkotyöt edistyivät kerrokseen 3', done: true },
      { desc: 'Sähköasennukset aloitettu kerros 1', done: true },
      { desc: 'LVI-putkitus saatettu loppuun', done: false },
      { desc: 'Turvakierros suoritettu', done: true },
    ],
    materials: [
      { name: 'Betoni C30', amount: '12 m³' },
      { name: 'Teräkset B500B', amount: '0.8 tn' },
    ],
    equipment: ['Nosturi Liebherr', 'Betoniauto', 'Sähkötyökalut'],
    notes: 'Sähkötarkastaja kävi paikalla ja hyväksyi kerroksen 1 asennukset. Huomiselle varattu betonitoimitus klo 08:00.',
    issues: 'Pieni viive LVI-työissä puutteellisten materiaalitoimitusten vuoksi.',
  },
  {
    id: 2,
    date: '2025-06-22',
    dateFormatted: 'Sunnuntai 22. kesäkuuta 2025',
    project: 'Espoo, Suurpelto B12',
    author: 'Jukka Lehtonen',
    authorInitials: 'JL',
    weather: { icon: 'sun', temp: 24, wind: 3, precipitation: 0 },
    workers: [
      { name: 'Jukka Lehtonen', hours: 8 },
      { name: 'Juha Mäkinen', hours: 8 },
      { name: 'Anna Lahtinen', hours: 7 },
    ],
    tasks: [
      { desc: 'Perustusten muottityöt valmisteltu', done: true },
      { desc: 'Sähkökaapelien veto aloitettu', done: true },
      { desc: 'Työmaan siivous', done: true },
    ],
    materials: [
      { name: 'Sähkökaapeli', amount: '150 m' },
    ],
    equipment: ['Kaivinkone', 'Sähkötyökalut'],
    notes: 'Hyvä työpäivä, sää suosi. Perustukset valmiina betonointia varten maanantaina.',
    issues: '',
  },
  {
    id: 3,
    date: '2025-06-21',
    dateFormatted: 'Lauantai 21. kesäkuuta 2025',
    project: 'Helsinki, Kruununhaka 8',
    author: 'Anna Lahtinen',
    authorInitials: 'AL',
    weather: { icon: 'rain', temp: 15, wind: 8, precipitation: 12 },
    workers: [
      { name: 'Anna Lahtinen', hours: 6 },
      { name: 'Liisa Virtanen', hours: 6 },
      { name: 'Pekka Salminen', hours: 4 },
    ],
    tasks: [
      { desc: 'LVI-asennukset kerros 2', done: true },
      { desc: 'Vesijohtojen painetestaus', done: true },
      { desc: 'Lattiavalun valmistelu', done: false },
    ],
    materials: [
      { name: 'LVI-putket', amount: '30 m' },
      { name: 'Liittimet', amount: '15 kpl' },
    ],
    equipment: ['LVI-työkalut', 'Painepumppu'],
    notes: 'Sateinen päivä hidasti ulkotöitä, mutta sisätyöt etenivät suunnitelman mukaan.',
    issues: 'Lattian valu siirretty paremman sään ajankohtaan.',
  },
  {
    id: 4,
    date: '2025-06-20',
    dateFormatted: 'Perjantai 20. kesäkuuta 2025',
    project: 'Tampere, Hatanpään valtatie 12',
    author: 'Matti Korhonen',
    authorInitials: 'MK',
    weather: { icon: 'sun', temp: 22, wind: 4, precipitation: 0 },
    workers: [
      { name: 'Matti Korhonen', hours: 8 },
      { name: 'Pekka Salminen', hours: 8 },
      { name: 'Timo Nieminen', hours: 8 },
      { name: 'Sari Rantanen', hours: 7 },
      { name: 'Jukka Lehtonen', hours: 5 },
    ],
    tasks: [
      { desc: 'Betonivalu kerros 2', done: true },
      { desc: 'Muottien purku', done: true },
      { desc: 'Terästyöt tarkistettu', done: true },
      { desc: 'Työturvallisuuspalaveri', done: true },
    ],
    materials: [
      { name: 'Betoni C30', amount: '18 m³' },
      { name: 'Teräkset B500B', amount: '1.2 tn' },
    ],
    equipment: ['Nosturi Liebherr', 'Betoniauto', 'Värinälevy'],
    notes: 'Erinomainen työpäivä. Kaikki suunnitellut tehtävät saatiin valmiiksi. Viikonlopun jäljiltä maanantaina jatketaan runkotöillä.',
    issues: '',
  },
  {
    id: 5,
    date: '2025-06-19',
    dateFormatted: 'Torstai 19. kesäkuuta 2025',
    project: 'Vantaa, Tikkurilan toimisto',
    author: 'Sari Rantanen',
    authorInitials: 'SR',
    weather: { icon: 'cloud', temp: 19, wind: 6, precipitation: 1 },
    workers: [
      { name: 'Sari Rantanen', hours: 8 },
      { name: 'Juha Mäkinen', hours: 8 },
    ],
    tasks: [
      { desc: 'Purku- ja esivalmistelutyöt', done: true },
      { desc: 'Työmaan rajaus ja suojaukset', done: true },
    ],
    materials: [
      { name: 'Suojamuovit', amount: '50 m²' },
    ],
    equipment: ['Purku-/esivalmistelutyökalut'],
    notes: 'Projekti käynnistetty onnistuneesti. Purkutyöt jatkuvat ensi viikolla.',
    issues: '',
  },
  {
    id: 6,
    date: '2025-06-18',
    dateFormatted: 'Keskiviikko 18. kesäkuuta 2025',
    project: 'Espoo, Suurpelto B12',
    author: 'Jukka Lehtonen',
    authorInitials: 'JL',
    weather: { icon: 'sun', temp: 25, wind: 2, precipitation: 0 },
    workers: [
      { name: 'Jukka Lehtonen', hours: 8 },
      { name: 'Juha Mäkinen', hours: 8 },
      { name: 'Anna Lahtinen', hours: 8 },
    ],
    tasks: [
      { desc: 'Maaperätutkimukset valmiiksi', done: true },
      { desc: 'Perustusten merkintä', done: true },
      { desc: 'Ensimmäiset kaivuutyöt', done: true },
    ],
    materials: [],
    equipment: ['Kaivinkone', 'Maanrakennustyökalut'],
    notes: 'Kaikki maanrakennustyöt aloitettu aikataulussa. Sää suosi työntekoa.',
    issues: '',
  },
];

const weatherIcon = (icon: string, size = 16) => {
  switch (icon) {
    case 'sun': return <Sun size={size} className="text-warning" />;
    case 'rain': return <CloudRain size={size} className="text-info" />;
    case 'cloud': return <Cloud size={size} className="text-text-secondary" />;
    default: return <Sun size={size} className="text-warning" />;
  }
};

/* ─── Component ─── */
export default function Paivakirjat() {
  const [selectedEntry, setSelectedEntry] = useState(diaryEntries[0]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('2025-06-23');

  const filteredEntries = diaryEntries.filter(e => e.date === selectedDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span>Projektit</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Päiväkirjat</span>
          </div>
          <h1 className="text-hero text-text-primary">Päiväkirjat</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työmaapäiväkirjamerkinnät</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-hover text-white gap-2"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={16} /> {showForm ? 'Peruuta' : 'Uusi merkintä'}
        </Button>
      </div>

      {/* ── Date Selector ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}>
          <ChevronLeft size={16} />
        </Button>
        <div className="flex items-center gap-2 bg-bg-light px-4 py-2 rounded-lg border border-[#E2E8F0]">
          <CalendarDays size={16} className="text-primary" />
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border-0 bg-transparent p-0 h-auto w-auto focus-visible:ring-0"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          setSelectedDate(d.toISOString().split('T')[0]);
        }}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* ── New Entry Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardHeader>
                <CardTitle className="text-h2 text-text-primary flex items-center gap-2">
                  <FileText size={20} className="text-primary" />
                  Uusi päiväkirjamerkintä
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Päivämäärä</label>
                    <Input type="date" defaultValue={selectedDate} />
                  </div>
                  <div>
                    <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Projekti</label>
                    <Input placeholder="Valitse projekti..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Lämpötila (°C)</label>
                    <Input type="number" placeholder="18" />
                  </div>
                  <div>
                    <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Tuuli (m/s)</label>
                    <Input type="number" placeholder="5" />
                  </div>
                  <div>
                    <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Sademäärä (mm)</label>
                    <Input type="number" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Tehdyt työt</label>
                  <Textarea placeholder="Kuvaile päivän työt..." rows={4} />
                </div>
                <div>
                  <label className="text-caption text-text-muted uppercase tracking-wider font-semibold block mb-1.5">Huomautukset / Poikkeamat</label>
                  <Textarea placeholder="Kirjaa huomiot ja poikkeamat..." rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Peruuta</Button>
                  <Button className="bg-primary hover:bg-primary-hover text-white">Tallenna merkintä</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content: Entry List + Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Entry list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-h3 text-text-primary">Merkinnät {new Date(selectedDate).toLocaleDateString('fi-FI')}</h2>
          {filteredEntries.length === 0 ? (
            <Card className="border border-[#E2E8F0] shadow-card">
              <CardContent className="p-8 text-center">
                <BookOpen size={40} className="mx-auto text-text-muted mb-3" />
                <p className="text-h3 text-text-primary mb-1">Ei merkintöjä</p>
                <p className="text-body-sm text-text-secondary">Valitulle päivälle ei ole päiväkirjamerkintöjä.</p>
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <Card
                  className={cn(
                    'border shadow-card cursor-pointer transition-all hover:shadow-card-hover hover:-translate-y-0.5',
                    selectedEntry?.id === entry.id ? 'border-primary bg-primary-light' : 'border-[#E2E8F0]'
                  )}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">{entry.project}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-text-primary mb-2">{entry.dateFormatted}</p>
                    <div className="flex items-center gap-3 text-body-sm text-text-secondary mb-2">
                      <span className="flex items-center gap-1">{weatherIcon(entry.weather.icon)} {entry.weather.temp}°C</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {entry.workers.length} työntekijää</span>
                    </div>
                    <p className="text-body-sm text-text-secondary line-clamp-2">{entry.notes}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                        {entry.authorInitials}
                      </div>
                      <span className="text-caption text-text-muted">{entry.author}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}

          {/* Show all other entries */}
          {diaryEntries.filter(e => e.date !== selectedDate).map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (filteredEntries.length + i) * 0.05, duration: 0.2 }}
            >
              <Card
                className={cn(
                  'border shadow-card cursor-pointer transition-all hover:shadow-card-hover hover:-translate-y-0.5 opacity-70',
                  selectedEntry?.id === entry.id ? 'border-primary bg-primary-light opacity-100' : 'border-[#E2E8F0]'
                )}
                onClick={() => setSelectedEntry(entry)}
              >
                <CardContent className="p-4">
                  <Badge variant="outline" className="text-xs mb-2">{entry.project}</Badge>
                  <p className="text-sm font-medium text-text-primary">{entry.dateFormatted}</p>
                  <div className="flex items-center gap-3 text-caption text-text-muted mt-1">
                    <span className="flex items-center gap-1">{weatherIcon(entry.weather.icon, 12)} {entry.weather.temp}°C</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {entry.workers.length}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Right: Entry detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selectedEntry && (
              <motion.div
                key={selectedEntry.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              >
                <Card className="border border-[#E2E8F0] shadow-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="mb-2">{selectedEntry.project}</Badge>
                        <CardTitle className="text-h2 text-text-primary">{selectedEntry.dateFormatted}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white">
                          {selectedEntry.authorInitials}
                        </div>
                      </div>
                    </div>
                    <p className="text-body-sm text-text-secondary mt-1">Kirjoittanut {selectedEntry.author}</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Weather */}
                    <div className="bg-bg-light rounded-lg p-4">
                      <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3">Sääolosuhteet</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          {weatherIcon(selectedEntry.weather.icon, 20)}
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{selectedEntry.weather.temp}°C</p>
                            <p className="text-caption text-text-muted">Lämpötila</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wind size={20} className="text-text-secondary" />
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{selectedEntry.weather.wind} m/s</p>
                            <p className="text-caption text-text-muted">Tuuli</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Droplets size={20} className="text-info" />
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{selectedEntry.weather.precipitation} mm</p>
                            <p className="text-caption text-text-muted">Sade</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Thermometer size={20} className="text-danger" />
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{selectedEntry.weather.temp > 20 ? 'Lämmintä' : selectedEntry.weather.temp > 10 ? 'Viileää' : 'Kylmää'}</p>
                            <p className="text-caption text-text-muted">Tunne</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Workers */}
                    <div>
                      <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                        <Users size={14} /> Paikalla olleet
                      </h3>
                      <div className="bg-bg-light rounded-lg overflow-hidden">
                        <div className="grid grid-cols-2 gap-0">
                          {selectedEntry.workers.map((w, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-[#F1F5F9]">
                              <span className="text-sm text-text-primary">{w.name}</span>
                              <span className="text-mono text-body-sm text-text-secondary">{w.hours} h</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2.5 flex items-center justify-between bg-white">
                          <span className="text-sm font-semibold text-text-primary">Yhteensä</span>
                          <span className="text-mono text-sm font-bold text-primary">
                            {selectedEntry.workers.reduce((sum, w) => sum + w.hours, 0)} h
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tasks */}
                    <div>
                      <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Tehdyt työt
                      </h3>
                      <div className="space-y-2">
                        {selectedEntry.tasks.map((task, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-bg-light">
                            <Checkbox checked={task.done} className="mt-0.5" />
                            <span className={cn('text-sm', task.done ? 'line-through text-text-muted' : 'text-text-primary')}>{task.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Materials */}
                    {selectedEntry.materials.length > 0 && (
                      <div>
                        <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3">Käytetyt materiaalit</h3>
                        <div className="bg-bg-light rounded-lg divide-y divide-[#F1F5F9]">
                          {selectedEntry.materials.map((m, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-sm text-text-primary">{m.name}</span>
                              <span className="text-mono text-body-sm text-text-secondary">{m.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Equipment */}
                    {selectedEntry.equipment.length > 0 && (
                      <div>
                        <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3">Koneet ja kalusto</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.equipment.map((eq, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{eq}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <h3 className="text-caption text-text-muted uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                        <FileText size={14} /> Muistiinpanot
                      </h3>
                      <p className="text-body-sm text-text-secondary bg-bg-light rounded-lg p-4">{selectedEntry.notes}</p>
                    </div>

                    {/* Issues */}
                    {selectedEntry.issues && (
                      <div className="bg-danger-light rounded-lg p-4 border border-danger-light">
                        <h3 className="text-caption text-danger uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                          <Clock size={14} /> Huomautukset / Poikkeamat
                        </h3>
                        <p className="text-body-sm text-danger">{selectedEntry.issues}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
