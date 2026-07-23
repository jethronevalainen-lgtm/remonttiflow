import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Car,
  Route,
  Fuel,
  Euro,
  MapPin,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  Navigation,
  Calendar,
  Bike,
  Bus,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

/* ─── Animation Variants ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

/* ─── Mock Data ─── */

// Ajopäiväkirja entries
const ajopaivakirjaData = [
  { id: 1, paiva: '23.6.2025', ajaja: 'Matti Korhonen', ajoneuvo: 'Yhtiön pakettiauto FI-ABC-123', tyyppi: 'auto', alku: 'Tampere, Hatanpään valtatie 20', loppu: 'Espoo, Luomanniitynkuja 5', km: 45, tarkoitus: 'Työmatka', status: 'kirjattu' },
  { id: 2, paiva: '22.6.2025', ajaja: 'Matti Korhonen', ajoneuvo: 'Yhtiön pakettiauto FI-ABC-123', tyyppi: 'auto', alku: 'Espoo, Luomanniitynkuja 5', loppu: 'Helsinki, Mannerheimintie 100', km: 25, tarkoitus: 'Työmatka', status: 'kirjattu' },
  { id: 3, paiva: '20.6.2025', ajaja: 'Liisa Nieminen', ajoneuvo: 'Oma auto', tyyppi: 'oma', alku: 'Tampere, Kaleva', loppu: 'Turku, Aurakatu 12', km: 82, tarkoitus: 'Materiaalinhaku', status: 'kirjattu' },
  { id: 4, paiva: '19.6.2025', ajaja: 'Juha Mäkinen', ajoneuvo: 'Polkupyörä', tyyppi: 'pyora', alku: 'Koti → Tampere', loppu: 'Tampere, Nekala', km: 12, tarkoitus: 'Työmatka', status: 'kirjattu' },
  { id: 5, paiva: '18.6.2025', ajaja: 'Matti Korhonen', ajoneuvo: 'Yhtiön pakettiauto FI-ABC-123', tyyppi: 'auto', alku: 'Tampere, Hatanpään valtatie 20', loppu: 'Helsinki, Itäväylä 15', km: 65, tarkoitus: 'Palaveri', status: 'gps' },
  { id: 6, paiva: '17.6.2025', ajaja: 'Anna Virtanen', ajoneuvo: 'Oma auto', tyyppi: 'oma', alku: 'Helsinki, Kallio', loppu: 'Espoo, Tapiola', km: 18, tarkoitus: 'Työmatka', status: 'kirjattu' },
  { id: 7, paiva: '16.6.2025', ajaja: 'Matti Korhonen', ajoneuvo: 'Yhtiön pakettiauto FI-ABC-123', tyyppi: 'auto', alku: 'Espoo, Tapiola', loppu: 'Helsinki, Lauttasaari', km: 14, tarkoitus: 'Työmatka', status: 'kirjattu' },
  { id: 8, paiva: '15.6.2025', ajaja: 'Pekka Järvinen', ajoneuvo: 'Julkinen liikenne', tyyppi: 'bussi', alku: 'Tampere, Keskusta', loppu: 'Nokia, Työmaa', km: 22, tarkoitus: 'Koulutus', status: 'kirjattu' },
  { id: 9, paiva: '14.6.2025', ajaja: 'Liisa Nieminen', ajoneuvo: 'Yhtiön kuorma-auto FI-DEF-456', tyyppi: 'auto', alku: 'Turku, Aurakatu 12', loppu: 'Salo, Tehdaskatu 3', km: 58, tarkoitus: 'Materiaalinkuljetus', status: 'kirjattu' },
  { id: 10, paiva: '13.6.2025', ajaja: 'Matti Korhonen', ajoneuvo: 'Yhtiön pakettiauto FI-ABC-123', tyyppi: 'auto', alku: 'Helsinki, Itäväylä 15', loppu: 'Vantaa, Tikkurila', km: 19, tarkoitus: 'Työmatka', status: 'kirjattu' },
];

// Matkakulut entries
const matkakulutData = [
  { id: 1, paiva: '23.6.2025', tyyppi: 'Polttoaine', kuvaus: 'Diesel, Shell Tampere', summa: 68.50, km: 450, korvausPerKm: 0.46, yhteensa: 207.00, status: 'korvattu' },
  { id: 2, paiva: '22.6.2025', tyyppi: 'Pysäköinti', kuvaus: 'Pysäköinti Espoon keskus', summa: 12.00, km: 0, korvausPerKm: 0, yhteensa: 12.00, status: 'korvattu' },
  { id: 3, paiva: '21.6.2025', tyyppi: 'Tietullit', kuvaus: 'Tie moottoritie Tampere-Helsinki', summa: 4.50, km: 0, korvausPerKm: 0, yhteensa: 4.50, status: 'korvattu' },
  { id: 4, paiva: '20.6.2025', tyyppi: 'Polttoaine', kuvaus: '95E10, Neste Turku', summa: 82.30, km: 540, korvausPerKm: 0.46, yhteensa: 248.40, status: 'odottaa' },
  { id: 5, paiva: '19.6.2025', tyyppi: 'Muut', kuvaus: 'Polkupyörän huolto', summa: 45.00, km: 0, korvausPerKm: 0, yhteensa: 45.00, status: 'korvattu' },
  { id: 6, paiva: '18.6.2025', tyyppi: 'Polttoaine', kuvaus: 'Diesel, St1 Helsinki', summa: 55.20, km: 362, korvausPerKm: 0.46, yhteensa: 166.52, status: 'odottaa' },
  { id: 7, paiva: '17.6.2025', tyyppi: 'Pysäköinti', kuvaus: 'Parkkihalli Tapiola', summa: 8.00, km: 0, korvausPerKm: 0, yhteensa: 8.00, status: 'korvattu' },
  { id: 8, paiva: '15.6.2025', tyyppi: 'Muut', kuvaus: 'Bussilippu Tampere-Nokia', summa: 7.90, km: 0, korvausPerKm: 0, yhteensa: 7.90, status: 'korvattu' },
];

// Päivärahat entries
const paivarahaData = [
  { id: 1, paiva: '23.6.2025', kohde: 'Espoo', kokoPaivaraha: 51.00, osapaivaraha: 0, yomatraha: 0, ateriaVähennys: 11.50, yhteensa: 39.50, status: 'maksettu' },
  { id: 2, paiva: '22.6.2025', kohde: 'Helsinki', kokoPaivaraha: 51.00, osapaivaraha: 0, yomatraha: 0, ateriaVähennys: 0, yhteensa: 51.00, status: 'maksettu' },
  { id: 3, paiva: '20.6.2025', kohde: 'Turku', kokoPaivaraha: 51.00, osapaivaraha: 0, yomatraha: 17.50, ateriaVähennys: 11.50, yhteensa: 57.00, status: 'odottaa' },
  { id: 4, paiva: '18.6.2025', kohde: 'Helsinki', kokoPaivaraha: 0, osapaivaraha: 24.00, yomatraha: 0, ateriaVähennys: 0, yhteensa: 24.00, status: 'maksettu' },
  { id: 5, paiva: '15.6.2025', kohde: 'Nokia', kokoPaivaraha: 0, osapaivaraha: 24.00, yomatraha: 0, ateriaVähennys: 5.75, yhteensa: 18.25, status: 'maksettu' },
  { id: 6, paiva: '14.6.2025', kohde: 'Salo', kokoPaivaraha: 51.00, osapaivaraha: 0, yomatraha: 17.50, ateriaVähennys: 0, yhteensa: 68.50, status: 'odottaa' },
];

// Chart data
const kuukausiData = [
  { kuukausi: 'Tammi', kilometrit: 980, kustannukset: 580 },
  { kuukausi: 'Helmi', kilometrit: 1120, kustannukset: 670 },
  { kuukausi: 'Maalis', kilometrit: 890, kustannukset: 520 },
  { kuukausi: 'Huhti', kilometrit: 1050, kustannukset: 630 },
  { kuukausi: 'Touko', kilometrit: 1320, kustannukset: 790 },
  { kuukausi: 'Kesä', kilometrit: 1245, kustannukset: 747 },
];

const kulutTyypeittainData = [
  { nimi: 'Polttoaine', arvo: 205.80, vari: '#F97316' },
  { nimi: 'Km-korvaus', arvo: 622.00, vari: '#3B82F6' },
  { nimi: 'Pysäköinti', arvo: 20.00, vari: '#22C55E' },
  { nimi: 'Tietullit', arvo: 4.50, vari: '#F59E0B' },
  { nimi: 'Muut', arvo: 52.90, vari: '#8B5CF6' },
];

const PIE_COLORS = ['#F97316', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'];

/* ─── Helper Components ─── */

function StatusBadge({ status }: { status: string }) {
  if (status === 'kirjattu' || status === 'korvattu' || status === 'maksettu') {
    return (
      <Badge className="bg-success-light text-success hover:bg-success-light">
        <CheckCircle2 size={12} className="mr-1" />
        {status === 'kirjattu' ? 'Kirjattu' : status === 'korvattu' ? 'Korvattu' : 'Maksettu'}
      </Badge>
    );
  }
  if (status === 'gps') {
    return (
      <Badge className="bg-info-light text-info hover:bg-info-light">
        <Navigation size={12} className="mr-1" />
        GPS
      </Badge>
    );
  }
  return (
    <Badge className="bg-warning-light text-warning hover:bg-warning-light">
      <Clock size={12} className="mr-1" />
      Odottaa
    </Badge>
  );
}

function VehicleIcon({ tyyppi }: { tyyppi: string }) {
  if (tyyppi === 'pyora') return <Bike size={16} className="text-success" />;
  if (tyyppi === 'bussi') return <Bus size={16} className="text-info" />;
  if (tyyppi === 'oma') return <Car size={16} className="text-warning" />;
  return <Car size={16} className="text-primary" />;
}

// Stylized route map visualization
function RouteMap({ selectedTrip }: { selectedTrip: typeof ajopaivakirjaData[0] | null }) {
  const routePoints = [
    { x: 80, y: 180, label: 'Tampere' },
    { x: 200, y: 120, label: 'Helsinki' },
    { x: 180, y: 90, label: 'Espoo' },
    { x: 60, y: 250, label: 'Turku' },
    { x: 140, y: 220, label: 'Salo' },
    { x: 100, y: 160, label: 'Nokia' },
    { x: 130, y: 100, label: 'Vantaa' },
  ];

  const routeLines = [
    { from: 0, to: 2, active: selectedTrip?.alku?.includes('Tampere') && selectedTrip?.loppu?.includes('Espoo') },
    { from: 2, to: 1, active: selectedTrip?.alku?.includes('Espoo') && selectedTrip?.loppu?.includes('Helsinki') },
    { from: 0, to: 3, active: selectedTrip?.alku?.includes('Tampere') && selectedTrip?.loppu?.includes('Turku') },
    { from: 0, to: 5, active: selectedTrip?.alku?.includes('Tampere') && selectedTrip?.loppu?.includes('Nokia') },
    { from: 3, to: 4, active: selectedTrip?.alku?.includes('Turku') && selectedTrip?.loppu?.includes('Salo') },
    { from: 1, to: 6, active: selectedTrip?.alku?.includes('Helsinki') && selectedTrip?.loppu?.includes('Vantaa') },
    { from: 2, to: 1, active: selectedTrip?.alku?.includes('Espoo') && selectedTrip?.loppu?.includes('Helsinki') },
  ];

  return (
    <div className="relative w-full h-[320px] bg-[#EDE9E0] rounded-xl overflow-hidden border border-[#D6D0C4]">
      {/* Map-like background pattern */}
      <svg width="100%" height="100%" viewBox="0 0 280 320" className="absolute inset-0">
        {/* Water areas */}
        <ellipse cx="240" cy="60" rx="35" ry="25" fill="#A8C8DC" opacity="0.5" />
        <ellipse cx="30" cy="280" rx="25" ry="20" fill="#A8C8DC" opacity="0.4" />
        {/* Road-like grid lines */}
        <line x1="0" y1="150" x2="280" y2="150" stroke="#FFFFFF" strokeWidth="3" opacity="0.6" />
        <line x1="140" y1="0" x2="140" y2="320" stroke="#FFFFFF" strokeWidth="3" opacity="0.6" />
        <line x1="0" y1="80" x2="280" y2="200" stroke="#FFFFFF" strokeWidth="2" opacity="0.4" />
        <line x1="0" y1="220" x2="280" y2="100" stroke="#FFFFFF" strokeWidth="2" opacity="0.4" />
        {/* Route lines */}
        {routeLines.map((line, i) => {
          const from = routePoints[line.from];
          const to = routePoints[line.to];
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={line.active ? '#F97316' : '#C4BBA8'}
              strokeWidth={line.active ? 4 : 2}
              strokeDasharray={line.active ? '0' : '6,4'}
              opacity={line.active ? 1 : 0.5}
            >
              {line.active && (
                <animate attributeName="stroke-dasharray" values="0,200;200,0" dur="1.5s" fill="freeze" />
              )}
            </line>
          );
        })}
        {/* Show all routes with subtle orange when no selection */}
        {!selectedTrip && routeLines.map((line, i) => {
          const from = routePoints[line.from];
          const to = routePoints[line.to];
          return (
            <line
              key={`all-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#F97316"
              strokeWidth={2}
              opacity={0.3}
            />
          );
        })}
        {/* City markers */}
        {routePoints.map((point, i) => (
          <g key={i}>
            <circle cx={point.x} cy={point.y} r="6" fill="#F97316" opacity="0.2" />
            <circle cx={point.x} cy={point.y} r="4" fill="#F97316" />
            <text
              x={point.x}
              y={point.y + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#5C5548"
              fontWeight="500"
            >
              {point.label}
            </text>
          </g>
        ))}
        {/* Start/End markers for selected trip */}
        {selectedTrip && (
          <>
            <circle cx="140" cy="150" r="14" fill="none" stroke="#22C55E" strokeWidth="2" opacity="0.6">
              <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="140" cy="150" r="5" fill="#22C55E" />
            <text x="140" y="175" textAnchor="middle" fontSize="9" fill="#22C55E" fontWeight="600">Lähtö</text>
          </>
        )}
      </svg>
      {/* Map overlay info */}
      {selectedTrip && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Route size={14} className="text-primary" />
              <span className="font-medium">{selectedTrip.alku.split(',')[0]} → {selectedTrip.loppu.split(',')[0]}</span>
            </div>
            <span className="text-primary font-semibold">{selectedTrip.km} km</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-1">{selectedTrip.tarkoitus} · {selectedTrip.ajoneuvo}</div>
        </motion.div>
      )}
      {!selectedTrip && (
        <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <MapPin size={12} className="text-primary" />
            <span>Valitse ajomatka nähdäksesi reitin</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function Matkakulut() {
  const [selectedTrip, setSelectedTrip] = useState<typeof ajopaivakirjaData[0] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ajopaivakirja');

  const totalKm = ajopaivakirjaData.reduce((s, d) => s + d.km, 0);
  const totalCost = matkakulutData.reduce((s, d) => s + d.yhteensa, 0);
  const totalFuel = matkakulutData.filter(d => d.tyyppi === 'Polttoaine').reduce((s, d) => s + d.summa, 0);
  const totalPaivaraha = paivarahaData.reduce((s, d) => s + d.yhteensa, 0);
  const co2Estimate = (totalKm * 0.12).toFixed(1);

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ─── Page Header ─── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-hero font-bold text-text-primary">Matkakulut & Ajo</h1>
          <p className="text-body-sm text-text-secondary mt-1">Ajopäiväkirja, matkakulut ja päivärahat</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
                <Plus size={16} />
                Uusi merkintä
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-h1">Lisää uusi ajomerkintä</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Päivämäärä</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lähtöaika</Label>
                    <Input type="time" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lähtöpaikka</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Syötä lähtöpaikka" className="flex-1" />
                    <Button variant="outline" size="icon"><MapPin size={16} /></Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Kohde</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Syötä kohde" className="flex-1" />
                    <Button variant="outline" size="icon"><MapPin size={16} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kilometrit</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tarkoitus</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tyomatka">Työmatka</SelectItem>
                        <SelectItem value="materiaali">Materiaalinhaku</SelectItem>
                        <SelectItem value="palaveri">Palaveri</SelectItem>
                        <SelectItem value="koulutus">Koulutus</SelectItem>
                        <SelectItem value="muu">Muu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ajoneuvo</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Valitse ajoneuvo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yhtio">Yhtiön pakettiauto FI-ABC-123</SelectItem>
                      <SelectItem value="oma">Oma auto</SelectItem>
                      <SelectItem value="pyora">Polkupyörä</SelectItem>
                      <SelectItem value="bussi">Julkinen liikenne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
                  <Button className="bg-primary hover:bg-primary-hover text-white" onClick={() => setDialogOpen(false)}>
                    Tallenna merkintä
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2">
            <Navigation size={16} />
            GPS-seuranta
          </Button>
        </div>
      </motion.div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div variants={itemVariants}>
          <TabsList className="bg-white border border-border">
            <TabsTrigger value="ajopaivakirja" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <Car size={16} />
              Ajopäiväkirja
            </TabsTrigger>
            <TabsTrigger value="matkakulut" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <Euro size={16} />
              Matkakulut
            </TabsTrigger>
            <TabsTrigger value="paivaraha" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <Calendar size={16} />
              Päivärahat
            </TabsTrigger>
            <TabsTrigger value="yhteenveto" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <TrendingUp size={16} />
              Yhteenveto
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* ═══════════════════ Tab 1: Ajopäiväkirja ═══════════════════ */}
        <TabsContent value="ajopaivakirja" className="space-y-6">
          {/* KPI Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Ajot kuukausi</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">{totalKm.toLocaleString()} km</p>
                    <div className="flex items-center gap-1 mt-2 text-success text-sm">
                      <TrendingUp size={14} />
                      <span>+156 km</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                    <Car size={20} className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Kustannukset</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">€{totalCost.toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-2 text-success text-sm">
                      <TrendingUp size={14} />
                      <span>+€93.60</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
                    <Euro size={20} className="text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Polttoaine</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">€{totalFuel.toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-2 text-success text-sm">
                      <TrendingUp size={14} />
                      <span>+€42.60</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center">
                    <Fuel size={20} className="text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">CO₂-päästöt</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">{co2Estimate} kg</p>
                    <div className="flex items-center gap-1 mt-2 text-text-muted text-sm">
                      <AlertCircle size={14} />
                      <span>Arvio kuukausi</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center">
                    <Route size={20} className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Map + Trip List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <MapPin size={18} className="text-primary" />
                    Reittikartta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RouteMap selectedTrip={selectedTrip} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <Route size={18} className="text-primary" />
                    Ajomatkat tässä kuussa
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[320px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs uppercase tracking-wider">Päivä</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Reitti</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Km</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Tarkoitus</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ajopaivakirjaData.map((trip) => (
                          <TableRow
                            key={trip.id}
                            className={`cursor-pointer transition-colors ${selectedTrip?.id === trip.id ? 'bg-primary-light' : 'hover:bg-muted/50'}`}
                            onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                          >
                            <TableCell className="text-sm font-medium">{trip.paiva}</TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1">
                                <VehicleIcon tyyppi={trip.tyyppi} />
                                <span className="truncate max-w-[140px]">
                                  {trip.alku.split(',')[0]} → {trip.loppu.split(',')[0]}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono font-medium">{trip.km}</TableCell>
                            <TableCell className="text-sm text-text-secondary">{trip.tarkoitus}</TableCell>
                            <TableCell><StatusBadge status={trip.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 py-3 border-t bg-muted/30 text-xs text-text-secondary">
                    Yhteensä: <span className="font-semibold text-text-primary">{totalKm} km</span> tällä viikolla · <span className="font-semibold text-text-primary">1,245 km</span> tässä kuussa
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ═══════════════════ Tab 2: Matkakulut ═══════════════════ */}
        <TabsContent value="matkakulut" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <Euro size={18} className="text-primary" />
                  Matkakulut
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Päivä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Tyyppi</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Kuvaus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Summa</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Km</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Yhteensä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matkakulutData.map((expense) => (
                        <TableRow key={expense.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{expense.paiva}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              expense.tyyppi === 'Polttoaine' ? 'border-primary text-primary' :
                              expense.tyyppi === 'Pysäköinti' ? 'border-info text-info' :
                              expense.tyyppi === 'Tietullit' ? 'border-warning text-warning' :
                              'border-text-muted text-text-secondary'
                            }>
                              {expense.tyyppi}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{expense.kuvaus}</TableCell>
                          <TableCell className="text-sm font-mono text-right">€{expense.summa.toFixed(2)}</TableCell>
                          <TableCell className="text-sm font-mono text-right">{expense.km > 0 ? expense.km : '-'}</TableCell>
                          <TableCell className="text-sm font-mono font-medium text-right">€{expense.yhteensa.toFixed(2)}</TableCell>
                          <TableCell><StatusBadge status={expense.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══════════════════ Tab 3: Päivärahat ═══════════════════ */}
        <TabsContent value="paivaraha" className="space-y-6">
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary-light border-primary/20">
              <CardContent className="p-4">
                <p className="text-caption text-primary/70 uppercase tracking-wider">Koko päiväraha</p>
                <p className="text-hero font-bold text-primary mt-1 font-mono">€51.00</p>
                <p className="text-xs text-primary/70 mt-1">Kotimaan kokopäiväraha</p>
              </CardContent>
            </Card>
            <Card className="bg-info-light border-info/20">
              <CardContent className="p-4">
                <p className="text-caption text-info/70 uppercase tracking-wider">Osapäiväraha</p>
                <p className="text-hero font-bold text-info mt-1 font-mono">€24.00</p>
                <p className="text-xs text-info/70 mt-1">Kotimaan osapäiväraha</p>
              </CardContent>
            </Card>
            <Card className="bg-success-light border-success/20">
              <CardContent className="p-4">
                <p className="text-caption text-success/70 uppercase tracking-wider">Päivärahat yhteensä</p>
                <p className="text-hero font-bold text-success mt-1 font-mono">€{totalPaivaraha.toFixed(2)}</p>
                <p className="text-xs text-success/70 mt-1">Tämä kuukausi</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  Päivärahamerkinnät
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Päivä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Kohde</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Koko päiväraha</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Osapäiväraha</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Yömatraha</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Ateria-vähennys</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Yhteensä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paivarahaData.map((pr) => (
                        <TableRow key={pr.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{pr.paiva}</TableCell>
                          <TableCell className="text-sm">{pr.kohde}</TableCell>
                          <TableCell className="text-sm font-mono text-right">{pr.kokoPaivaraha > 0 ? `€${pr.kokoPaivaraha.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-sm font-mono text-right">{pr.osapaivaraha > 0 ? `€${pr.osapaivaraha.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-sm font-mono text-right">{pr.yomatraha > 0 ? `€${pr.yomatraha.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-sm font-mono text-right text-danger">{pr.ateriaVähennys > 0 ? `-€${pr.ateriaVähennys.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="text-sm font-mono font-medium text-right">€{pr.yhteensa.toFixed(2)}</TableCell>
                          <TableCell><StatusBadge status={pr.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══════════════════ Tab 4: Yhteenveto ═══════════════════ */}
        <TabsContent value="yhteenveto" className="space-y-6">
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Kilometrit yhteensä</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">6,605 km</p>
                    <p className="text-xs text-text-muted mt-1">Vuosi 2025</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                    <Car size={20} className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Kustannukset yhteensä</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">€3,939.40</p>
                    <p className="text-xs text-text-muted mt-1">Vuosi 2025</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
                    <Euro size={20} className="text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-caption text-text-secondary uppercase tracking-wider">Päivärahat yhteensä</p>
                    <p className="text-hero font-bold text-text-primary mt-1 font-mono">€258.25</p>
                    <p className="text-xs text-text-muted mt-1">Tämä kuukausi</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center">
                    <Calendar size={20} className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    Kilometrit kuukausittain
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={kuukausiData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="kuukausi" tick={{ fontSize: 12, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number) => [`${value} km`, 'Kilometrit']}
                      />
                      <Bar dataKey="kilometrit" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <Fuel size={18} className="text-primary" />
                    Kustannukset tyypeittäin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={kulutTyypeittainData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="arvo"
                        nameKey="nimi"
                      >
                        {kulutTyypeittainData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => <span className="text-xs text-text-secondary">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
