import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  ChevronRight,
  Users,
  Wrench,
  Flame,
  HardHat,
  Eye,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
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

// Turvallisuusindeksi trend data
const turvallisuusTrendi = [
  { kuukausi: 'Tammi', indeksi: 78 },
  { kuukausi: 'Helmi', indeksi: 82 },
  { kuukausi: 'Maalis', indeksi: 85 },
  { kuukausi: 'Huhti', indeksi: 83 },
  { kuukausi: 'Touko', indeksi: 89 },
  { kuukausi: 'Kesä', indeksi: 87 },
];

// Avoimet toimenpiteet
const avoimetToimenpiteet = [
  { id: 1, otsikko: 'Korjaa rakennustelineet', tyomaa: 'Tampere', deadline: 'Myöhässä 3 pv', prioriteetti: 'korkea', vari: '#EF4444' },
  { id: 2, otsikko: 'Päivitä pelastussuunnitelma', tyomaa: 'Espoo', deadline: '5 pv jäljellä', prioriteetti: 'keski', vari: '#F59E0B' },
  { id: 3, otsikko: 'Tilaa uudet suojakypärät', tyomaa: 'Helsinki', deadline: '12 pv jäljellä', prioriteetti: 'matala', vari: '#3B82F6' },
  { id: 4, otsikko: 'Tarkista H2S-mittarit', tyomaa: 'Turku', deadline: '7 pv jäljellä', prioriteetti: 'keski', vari: '#F59E0B' },
  { id: 5, otsikko: 'Päivitä ensiapupakkaus', tyomaa: 'Kaikki', deadline: '14 pv jäljellä', prioriteetti: 'matala', vari: '#3B82F6' },
];

// Työmaakohtainen turvallisuus
const tyomaaTurvallisuus = [
  { tyomaa: 'Tampere', indeksi: 92, tapaukset: 1, koulutukset: 95, viimTarkastus: '10.6.2025', seuraavaTarkastus: '24.6.2025', status: 'ok' },
  { tyomaa: 'Espoo', indeksi: 88, tapaukset: 2, koulutukset: 87, viimTarkastus: '12.6.2025', seuraavaTarkastus: '26.6.2025', status: 'huomio' },
  { tyomaa: 'Helsinki', indeksi: 96, tapaukset: 0, koulutukset: 100, viimTarkastus: '5.6.2025', seuraavaTarkastus: '20.6.2025', status: 'ok' },
  { tyomaa: 'Turku', indeksi: 85, tapaukset: 3, koulutukset: 78, viimTarkastus: '8.6.2025', seuraavaTarkastus: '28.6.2025', status: 'toimia' },
];

// Riskiarviot
const riskiData = [
  { id: 1, toimenpide: 'Putoaminen korkealta', tyomaa: 'Tampere', todennakoisyys: 3, vakavuus: 5, yhteensa: 15, toimenpiteet: 'Turvavaljaat, tarkastus', vastuu: 'Matti K.' },
  { id: 2, toimenpide: 'Sähköisku', tyomaa: 'Helsinki', todennakoisyys: 2, vakavuus: 5, yhteensa: 10, toimenpiteet: 'Eristys, merkinnät', vastuu: 'Liisa N.' },
  { id: 3, toimenpide: 'Kemikaalialtistus', tyomaa: 'Espoo', todennakoisyys: 3, vakavuus: 3, yhteensa: 9, toimenpiteet: 'Suojaimet, tuuletus', vastuu: 'Juha M.' },
  { id: 4, toimenpide: 'Rakennustelineen kaatuminen', tyomaa: 'Turku', todennakoisyys: 2, vakavuus: 4, yhteensa: 8, toimenpiteet: 'Ankkurointi, tarkastus', vastuu: 'Anna V.' },
  { id: 5, toimenpide: 'Liukastuminen', tyomaa: 'Tampere', todennakoisyys: 4, vakavuus: 2, yhteensa: 8, toimenpiteet: 'Puhdistus, varoitusmerkit', vastuu: 'Pekka J.' },
  { id: 6, toimenpide: 'Purun pöly', tyomaa: 'Espoo', todennakoisyys: 4, vakavuus: 2, yhteensa: 8, toimenpiteet: 'Hengityssuojaimet', vastuu: 'Matti K.' },
  { id: 7, toimenpide: 'Törmäys työkoneeseen', tyomaa: 'Turku', todennakoisyys: 2, vakavuus: 4, yhteensa: 8, toimenpiteet: 'Varoitusalue, opastus', vastuu: 'Liisa N.' },
  { id: 8, toimenpide: 'Melualtistus', tyomaa: 'Helsinki', todennakoisyys: 5, vakavuus: 1, yhteensa: 5, toimenpiteet: 'Kuulosuojaimet', vastuu: 'Juha M.' },
];

// Tarkastukset
const tarkastuksetData = [
  { id: 1, paiva: '24.6.2025', tyyppi: 'Turvakierros', vastuullinen: 'Matti Korhonen', status: 'suunniteltu', tulos: '-' },
  { id: 2, paiva: '26.6.2025', tyyppi: 'Kalustotarkastus', vastuullinen: 'Liisa Nieminen', status: 'suunniteltu', tulos: '-' },
  { id: 3, paiva: '20.6.2025', tyyppi: 'Turvakierros', vastuullinen: 'Anna Virtanen', status: 'valmis', tulos: 'Hyvä' },
  { id: 4, paiva: '22.6.2025', tyyppi: 'Kemikaalitarkastus', vastuullinen: 'Juha Mäkinen', status: 'kaynnissa', tulos: '-' },
  { id: 5, paiva: '28.6.2025', tyyppi: 'Turvakierros', vastuullinen: 'Pekka Järvinen', status: 'suunniteltu', tulos: '-' },
];

// Tapaturmat
const tapaturmaData = [
  { id: 1, paiva: '18.6.2025', henkilo: 'Kalle Salminen', tyyppi: 'Tapaturma', vakavuus: 'lieva', kuvaus: 'Materiaalin putoaminen varpaalle, mustelma', toimenpiteet: 'Ensiapu, työkenkien tarkistus', tyomaa: 'Tampere' },
  { id: 2, paiva: '15.6.2025', henkilo: 'Sari Lahtinen', tyyppi: 'Vaaratilanne', vakavuus: 'keskitasoinen', kuvaus: 'Lähellä ollut telineen horjuminen', toimenpiteet: 'Telineen tarkastus, ankkurointi', tyomaa: 'Espoo' },
  { id: 3, paiva: '12.6.2025', henkilo: 'Timo Koskinen', tyyppi: 'Tapaturma', vakavuus: 'vakava', kuvaus: 'Sähkötyötapaturmasta johtunut palovamma käteen', toimenpiteet: 'Ensiapu, sairaalakuljetus, työselvitys', tyomaa: 'Turku' },
  { id: 4, paiva: '10.6.2025', henkilo: 'Minna Hämäläinen', tyyppi: 'Turvallisuushavainto', vakavuus: 'lieva', kuvaus: 'Puuttuvat varoitusmerkit kulkureitillä', toimenpiteet: 'Merkkien asennus', tyomaa: 'Espoo' },
  { id: 5, paiva: '8.6.2025', henkilo: 'Antti Rantanen', tyyppi: 'Tapaturma', vakavuus: 'keskitasoinen', kuvaus: 'Niska-selkävamma raskasta nostettaessa', toimenpiteet: 'Työfysioterapia, nostotekniikkakoulutus', tyomaa: 'Turku' },
];

// Koulutukset
const koulutusData = [
  { id: 1, koulutus: 'Työturvallisuuskortti', paiva: '15.3.2025', osallistujat: 12, voimassa: '15.3.2030', paiviaJaljella: 1714, status: 'voimassa' },
  { id: 2, koulutus: 'Tulityökortti', paiva: '10.1.2025', osallistujat: 8, voimassa: '10.1.2030', paiviaJaljella: 1669, status: 'voimassa' },
  { id: 3, koulutus: 'Sähkötyöturvallisuus', paiva: '5.2.2024', osallistujat: 5, voimassa: '5.2.2027', paiviaJaljella: 595, status: 'voimassa' },
  { id: 4, koulutus: 'Ensiapukoulutus', paiva: '20.9.2023', osallistujat: 10, voimassa: '20.9.2026', paiviaJaljella: 832, status: 'voimassa' },
  { id: 5, koulutus: 'Hätäensiapu', paiva: '12.5.2025', osallistujat: 6, voimassa: '12.5.2027', paiviaJaljella: 691, status: 'vanhenemassa' },
  { id: 6, koulutus: 'Työturvallisuusvaltuutettu', paiva: '8.4.2022', osallistujat: 3, voimassa: '8.4.2026', paiviaJaljella: 292, status: 'vanhenemassa' },
];

// Tarkastustyypit for risk matrix
const todennakoisyysLabels = ['', 'Erittäin epätodennäköinen', 'Epätodennäköinen', 'Mahdollinen', 'Todennäköinen', 'Erittäin todennäköinen'];
const vakavuusLabels = ['', 'Vähäinen', 'Pieni', 'Kohtalainen', 'Vakava', 'Erittäin vakava'];

/* ─── Helper Components ─── */

function TarkastusStatusBadge({ status }: { status: string }) {
  if (status === 'valmis') {
    return (
      <Badge className="bg-success-light text-success hover:bg-success-light">
        <CheckCircle2 size={12} className="mr-1" />
        Valmis
      </Badge>
    );
  }
  if (status === 'kaynnissa') {
    return (
      <Badge className="bg-primary-light text-primary hover:bg-primary-light">
        <Clock size={12} className="mr-1" />
        Käynnissä
      </Badge>
    );
  }
  return (
    <Badge className="bg-info-light text-info hover:bg-info-light">
      <Clock size={12} className="mr-1" />
      Suunniteltu
    </Badge>
  );
}

function VakavuusBadge({ vakavuus }: { vakavuus: string }) {
  if (vakavuus === 'vakava') {
    return <Badge className="bg-danger-light text-danger hover:bg-danger-light gap-1"><AlertTriangle size={12} />Vakava</Badge>;
  }
  if (vakavuus === 'keskitasoinen') {
    return <Badge className="bg-warning-light text-warning hover:bg-warning-light gap-1"><AlertCircle size={12} />Keskitasoinen</Badge>;
  }
  return <Badge className="bg-info-light text-info hover:bg-info-light gap-1"><Eye size={12} />Lievä</Badge>;
}

function KoulutusStatusBadge({ status, paiviaJaljella }: { status: string; paiviaJaljella: number }) {
  if (status === 'voimassa' && paiviaJaljella > 60) {
    return <Badge className="bg-success-light text-success hover:bg-success-light"><CheckCircle2 size={12} className="mr-1" />Voimassa</Badge>;
  }
  if (status === 'vanhenemassa' || (status === 'voimassa' && paiviaJaljella <= 60)) {
    return <Badge className="bg-warning-light text-warning hover:bg-warning-light"><Clock size={12} className="mr-1" />Vanhenemassa</Badge>;
  }
  return <Badge className="bg-danger-light text-danger hover:bg-danger-light"><AlertTriangle size={12} className="mr-1" />Vanhentunut</Badge>;
}

function TyomaaStatusBadge({ status }: { status: string }) {
  if (status === 'ok') return <Badge className="bg-success-light text-success hover:bg-success-light gap-1"><CheckCircle2 size={12} />OK</Badge>;
  if (status === 'huomio') return <Badge className="bg-warning-light text-warning hover:bg-warning-light gap-1"><AlertCircle size={12} />Huomio</Badge>;
  return <Badge className="bg-danger-light text-danger hover:bg-danger-light gap-1"><AlertTriangle size={12} />Toimenpiteitä</Badge>;
}

function RiskiVari(yhteensa: number): string {
  if (yhteensa >= 15) return '#FEE2E2'; // red
  if (yhteensa >= 10) return '#FFEDD5'; // orange
  if (yhteensa >= 5) return '#FEF3C7'; // yellow
  return '#DCFCE7'; // green
}

function RiskiVariText(yhteensa: number): string {
  if (yhteensa >= 15) return '#DC2626';
  if (yhteensa >= 10) return '#EA580C';
  if (yhteensa >= 5) return '#D97706';
  return '#16A34A';
}

function RiskiSoluVari(todennakoisyys: number, vakavuus: number): string {
  const yhteensa = todennakoisyys * vakavuus;
  if (yhteensa >= 15) return '#EF4444';
  if (yhteensa >= 10) return '#F97316';
  if (yhteensa >= 5) return '#F59E0B';
  return '#22C55E';
}

// Riski Matrix - laske riskien määrä per solu
function laskeRiskitSolu(t: number, v: number) {
  return riskiData.filter(r => r.todennakoisyys === t && r.vakavuus === v).length;
}

// Safety Index Gauge Component
function SafetyGauge({ score }: { score: number }) {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (score / 100) * arcLength;
  const rotation = 135;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 160 }}>
      <svg width={200} height={160} viewBox="0 0 200 160">
        {/* Background arc */}
        <circle
          cx="100"
          cy="100"
          r={normalizedRadius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotation} 100 100)`}
        />
        {/* Foreground arc */}
        <motion.circle
          cx="100"
          cy="100"
          r={normalizedRadius}
          fill="none"
          stroke={score >= 90 ? '#22C55E' : score >= 75 ? '#F59E0B' : '#EF4444'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          transform={`rotate(${rotation} 100 100)`}
        />
        {/* Score text */}
        <text x="100" y="95" textAnchor="middle" fontSize="36" fontWeight="700" fill="#1E293B" fontFamily="Inter, sans-serif">
          {score}
        </text>
        <text x="100" y="115" textAnchor="middle" fontSize="12" fill="#64748B" fontFamily="Inter, sans-serif">
          / 100
        </text>
      </svg>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Tyoturvallisuus() {
  const [activeTab, setActiveTab] = useState('yleiskatsaus');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [valittuRiskiSolut, setValittuRiskiSolut] = useState<{t: number; v: number} | null>(null);

  const safetyScore = 87;
  const trendi = turvallisuusTrendi[turvallisuusTrendi.length - 1].indeksi - turvallisuusTrendi[turvallisuusTrendi.length - 2].indeksi;

  const suodatetutRiskit = valittuRiskiSolut
    ? riskiData.filter(r => r.todennakoisyys === valittuRiskiSolut.t && r.vakavuus === valittuRiskiSolut.v)
    : riskiData;

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
          <h1 className="text-hero font-bold text-text-primary">Työturvallisuus</h1>
          <p className="text-body-sm text-text-secondary mt-1">Työturvallisuuden hallinta ja seuranta</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
                <Plus size={16} />
                Uusi tapahtuma
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-h1">Ilmoita uusi tapahtuma</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Päivämäärä</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aika</Label>
                    <Input type="time" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Työmaa</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Valitse työmaa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tampere">Tampere</SelectItem>
                      <SelectItem value="espoo">Espoo</SelectItem>
                      <SelectItem value="helsinki">Helsinki</SelectItem>
                      <SelectItem value="turku">Turku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tapahtumatyyppi</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Valitse tyyppi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tapaturma">Tapaturma</SelectItem>
                      <SelectItem value="vaaratilanne">Vaaratilanne</SelectItem>
                      <SelectItem value="poikkeama">Poikkeama</SelectItem>
                      <SelectItem value="havainto">Turvallisuushavainto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vakavuus</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Valitse vakavuus" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lieva">Lievä</SelectItem>
                      <SelectItem value="keski">Keskitasoinen</SelectItem>
                      <SelectItem value="vakava">Vakava</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kuvaus</Label>
                  <Input placeholder="Kuvaa tapahtuma" />
                </div>
                <div className="space-y-2">
                  <Label>Toimenpiteet</Label>
                  <Input placeholder="Mitkä toimenpiteet tehtiin?" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Peruuta</Button>
                  <Button className="bg-primary hover:bg-primary-hover text-white" onClick={() => setDialogOpen(false)}>
                    Tallenna
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="gap-2">
            <Shield size={16} />
            Turvakierros
          </Button>
        </div>
      </motion.div>

      {/* ─── Top KPI Cards ─── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-caption text-text-secondary uppercase tracking-wider">Turvallisuusindeksi</p>
                <p className="text-hero font-bold text-text-primary mt-1 font-mono">{safetyScore}/100</p>
                <div className={`flex items-center gap-1 mt-2 text-sm ${trendi >= 0 ? 'text-success' : 'text-danger'}`}>
                  {trendi >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{trendi >= 0 ? '+' : ''}{trendi} vs edellinen kuukausi</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                <ShieldCheck size={20} className="text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-caption text-text-secondary uppercase tracking-wider">Tapaukset kuukaudessa</p>
                <p className="text-hero font-bold text-text-primary mt-1 font-mono">2</p>
                <div className="flex items-center gap-1 mt-2 text-success text-sm">
                  <TrendingDown size={14} />
                  <span>-3 vs edellinen kuukausi</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-danger-light flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-caption text-text-secondary uppercase tracking-wider">Koulutukset</p>
                <p className="text-hero font-bold text-text-primary mt-1 font-mono">15 pv</p>
                <div className="flex items-center gap-1 mt-2 text-warning text-sm">
                  <Users size={14} />
                  <span>3 henkilöä päivitystä vailla</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-warning-light flex items-center justify-center">
                <GraduationCap size={20} className="text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-caption text-text-secondary uppercase tracking-wider">Seuraava tarkastus</p>
                <p className="text-hero font-bold text-text-primary mt-1 font-mono">24.6.</p>
                <div className="flex items-center gap-1 mt-2 text-info text-sm">
                  <MapPinIcon />
                  <span>Tampere</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-info-light flex items-center justify-center">
                <ClipboardCheck size={20} className="text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <motion.div variants={itemVariants}>
          <TabsList className="bg-white border border-border flex-wrap h-auto">
            <TabsTrigger value="yleiskatsaus" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <Shield size={16} />
              Yleiskatsaus
            </TabsTrigger>
            <TabsTrigger value="riskiarviot" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <AlertTriangle size={16} />
              Riskiarviot
            </TabsTrigger>
            <TabsTrigger value="tarkastukset" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <ClipboardCheck size={16} />
              Tarkastukset
            </TabsTrigger>
            <TabsTrigger value="tapaturmat" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <AlertCircle size={16} />
              Tapaturmat
            </TabsTrigger>
            <TabsTrigger value="koulutukset" className="gap-2 data-[state=active]:bg-primary-light data-[state=active]:text-primary">
              <GraduationCap size={16} />
              Koulutukset
            </TabsTrigger>
          </TabsList>
        </motion.div>

        {/* ════════════════ Tab 1: Yleiskatsaus ════════════════ */}
        <TabsContent value="yleiskatsaus" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Safety Gauge + Trend Chart */}
            <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    Turvallisuusindeksin kehitys
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <SafetyGauge score={safetyScore} />
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={turvallisuusTrendi}>
                          <defs>
                            <linearGradient id="safetyGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="kuukausi" tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(value) => [`${value}/100`, 'Indeksi']}
                          />
                          <ReferenceLine y={95} stroke="#22C55E" strokeDasharray="5 5" label={{ value: 'Tavoite', position: 'right', fill: '#22C55E', fontSize: 11 }} />
                          <Area type="monotone" dataKey="indeksi" stroke="#F97316" strokeWidth={2.5} fill="url(#safetyGradient)" dot={{ r: 4, fill: '#F97316' }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Open Action Items */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-h2 flex items-center gap-2">
                    <Wrench size={18} className="text-primary" />
                    Avoimet toimenpiteet
                    <Badge className="ml-auto bg-primary-light text-primary">{avoimetToimenpiteet.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {avoimetToimenpiteet.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08, duration: 0.25 }}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: item.vari }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{item.otsikko}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                          <span>{item.tyomaa}</span>
                          <span>·</span>
                          <span className={item.prioriteetti === 'korkea' ? 'text-danger font-medium' : ''}>{item.deadline}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text-muted flex-shrink-0 mt-2" />
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Site Safety Table */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <HardHat size={18} className="text-primary" />
                  Työmaakohtainen turvallisuus
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Työmaa</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Indeksi</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Tapaukset</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Koulutukset</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Viim. tarkastus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Seuraava</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tyomaaTurvallisuus.map((site) => (
                        <TableRow key={site.tyomaa} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{site.tyomaa}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium">{site.indeksi}/100</span>
                              <Progress value={site.indeksi} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{site.tapaukset}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{site.koulutukset}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary">{site.viimTarkastus}</TableCell>
                          <TableCell className="text-sm text-text-secondary">{site.seuraavaTarkastus}</TableCell>
                          <TableCell><TyomaaStatusBadge status={site.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ════════════════ Tab 2: Riskiarviot ════════════════ */}
        <TabsContent value="riskiarviot" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-primary" />
                  5×5 Riskimatriisi
                </CardTitle>
                <p className="text-body-sm text-text-secondary">
                  {valittuRiskiSolut
                    ? `Näytetään riskit: Todennäköisyys ${valittuRiskiSolut.t}, Vakavuus ${valittuRiskiSolut.v}`
                    : 'Klikkaa solua nähdäksesi riskit kyseisessä luokassa'}
                </p>
              </CardHeader>
              <CardContent>
                {/* Risk Matrix Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[500px]">
                    {/* Y-axis label */}
                    <div className="flex items-start">
                      <div className="flex flex-col justify-center mr-2">
                        <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                          Todennäköisyys
                        </span>
                      </div>
                      <div className="flex-1">
                        {/* Grid header */}
                        <div className="grid grid-cols-6 gap-1 mb-1">
                          <div className="text-center" />
                          {vakavuusLabels.slice(1).map((label, i) => (
                            <div key={i} className="text-[10px] text-text-secondary text-center font-medium leading-tight">
                              {label}
                            </div>
                          ))}
                        </div>
                        {/* Grid rows */}
                        {[5, 4, 3, 2, 1].map((t) => (
                          <div key={t} className="grid grid-cols-6 gap-1 mb-1">
                            {/* Y-axis label */}
                            <div className="flex items-center justify-end pr-2">
                              <span className="text-[10px] text-text-secondary font-medium leading-tight text-right">
                                {todennakoisyysLabels[t]}
                              </span>
                            </div>
                            {/* Cells */}
                            {[1, 2, 3, 4, 5].map((v) => {
                              const riskiLkm = laskeRiskitSolu(t, v);
                              const bgVari = RiskiSoluVari(t, v);
                              const isSelected = valittuRiskiSolut?.t === t && valittuRiskiSolut?.v === v;
                              return (
                                <motion.button
                                  key={v}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setValittuRiskiSolut(isSelected ? null : { t, v })}
                                  className={`h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm transition-all ${isSelected ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                                  style={{ backgroundColor: bgVari, opacity: riskiLkm > 0 ? 1 : 0.4 }}
                                >
                                  {riskiLkm > 0 && riskiLkm}
                                </motion.button>
                              );
                            })}
                          </div>
                        ))}
                        {/* X-axis label */}
                        <div className="text-center mt-2">
                          <span className="text-[11px] text-text-secondary font-medium uppercase tracking-wider">Vakavuus</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 justify-center flex-wrap">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#22C55E]" /><span className="text-xs text-text-secondary">Matala (1-4)</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#F59E0B]" /><span className="text-xs text-text-secondary">Keskitaso (5-9)</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#F97316]" /><span className="text-xs text-text-secondary">Korkea (10-14)</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[#EF4444]" /><span className="text-xs text-text-secondary">Kriittinen (15-25)</span></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Risk List */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <BookOpen size={18} className="text-primary" />
                  Riskiluettelo
                  {valittuRiskiSolut && (
                    <Button variant="ghost" size="sm" onClick={() => setValittuRiskiSolut(null)} className="ml-auto">
                      Näytä kaikki
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Toimenpide / Riski</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Työmaa</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-center">Todennäköisyys</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-center">Vakavuus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-center">Yhteensä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Toimenpiteet</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Vastuu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suodatetutRiskit.map((risk) => (
                        <TableRow key={risk.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{risk.toimenpide}</TableCell>
                          <TableCell className="text-sm">{risk.tyomaa}</TableCell>
                          <TableCell className="text-sm text-center font-mono">{risk.todennakoisyys}</TableCell>
                          <TableCell className="text-sm text-center font-mono">{risk.vakavuus}</TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: RiskiVari(risk.yhteensa), color: RiskiVariText(risk.yhteensa), border: 'none' }}>
                              {risk.yhteensa}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-text-secondary max-w-[200px] truncate">{risk.toimenpiteet}</TableCell>
                          <TableCell className="text-sm">{risk.vastuu}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ════════════════ Tab 3: Tarkastukset ════════════════ */}
        <TabsContent value="tarkastukset" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-primary" />
                  Tarkastusohjelma
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Päivä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Tyyppi</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Vastuullinen</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Tulos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tarkastuksetData.map((tark) => (
                        <TableRow key={tark.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{tark.paiva}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {tark.tyyppi === 'Turvakierros' && <Shield size={14} className="text-primary" />}
                              {tark.tyyppi === 'Kalustotarkastus' && <Wrench size={14} className="text-info" />}
                              {tark.tyyppi === 'Kemikaalitarkastus' && <Flame size={14} className="text-warning" />}
                              <span className="text-sm">{tark.tyyppi}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{tark.vastuullinen}</TableCell>
                          <TableCell><TarkastusStatusBadge status={tark.status} /></TableCell>
                          <TableCell className="text-sm">
                            {tark.tulos === '-' ? (
                              <span className="text-text-muted">-</span>
                            ) : (
                              <span className="text-success font-medium">{tark.tulos}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ════════════════ Tab 4: Tapaturmat ════════════════ */}
        <TabsContent value="tapaturmat" className="space-y-6">
          <motion.div variants={itemVariants} className="flex justify-end">
            <Button className="bg-primary hover:bg-primary-hover text-white gap-2" onClick={() => setDialogOpen(true)}>
              <Plus size={16} />
              Lisää tapaturma
            </Button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <AlertCircle size={18} className="text-primary" />
                  Tapahtumaluettelo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Päivä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Työmaa</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Henkilö</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Tyyppi</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Vakavuus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Kuvaus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Toimenpiteet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tapaturmaData.map((inc) => (
                        <TableRow key={inc.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{inc.paiva}</TableCell>
                          <TableCell className="text-sm">{inc.tyomaa}</TableCell>
                          <TableCell className="text-sm">{inc.henkilo}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {inc.tyyppi}
                            </Badge>
                          </TableCell>
                          <TableCell><VakavuusBadge vakavuus={inc.vakavuus} /></TableCell>
                          <TableCell className="text-sm text-text-secondary max-w-[200px]">{inc.kuvaus}</TableCell>
                          <TableCell className="text-sm text-text-secondary max-w-[200px]">{inc.toimenpiteet}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ════════════════ Tab 5: Koulutukset ════════════════ */}
        <TabsContent value="koulutukset" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-h2 flex items-center gap-2">
                  <GraduationCap size={18} className="text-primary" />
                  Koulutustiedot
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wider">Koulutus</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Päivämäärä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-center">Osallistujat</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Voimassa asti</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-center">Päiviä jäljellä</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {koulutusData.map((training) => (
                        <TableRow key={training.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-medium">{training.koulutus}</TableCell>
                          <TableCell className="text-sm">{training.paiva}</TableCell>
                          <TableCell className="text-sm text-center">{training.osallistujat}</TableCell>
                          <TableCell className="text-sm">{training.voimassa}</TableCell>
                          <TableCell className="text-sm font-mono text-center">
                            <span className={training.paiviaJaljella < 365 ? 'text-warning font-medium' : ''}>
                              {training.paiviaJaljella}
                            </span>
                          </TableCell>
                          <TableCell><KoulutusStatusBadge status={training.status} paiviaJaljella={training.paiviaJaljella} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Training summary cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-success-light border-success/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-success" />
                  <div>
                    <p className="text-lg font-bold text-success font-mono">4</p>
                    <p className="text-xs text-success/70">Voimassa olevaa koulutusta</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-warning-light border-warning/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock size={24} className="text-warning" />
                  <div>
                    <p className="text-lg font-bold text-warning font-mono">2</p>
                    <p className="text-xs text-warning/70">Vanhenemassa</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-info-light border-info/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users size={24} className="text-info" />
                  <div>
                    <p className="text-lg font-bold text-info font-mono">44</p>
                    <p className="text-xs text-info/70">Koulutettua henkilöä</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
