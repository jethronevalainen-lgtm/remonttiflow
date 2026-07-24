import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  Calculator,
  Calendar,
  FileText,
  Image,
  LockKeyhole,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BRAND } from '@/config/brand';

const plannedTools = [
  { name: 'Dokumenttianalyysi', description: 'Sopimusten, tarjousten ja työmaa-asiakirjojen analyysi', icon: FileText },
  { name: 'Ääniassistentti', description: 'Puheesta työmaapäiväkirjan luonnokseksi', icon: Mic },
  { name: 'Kustannustuki', description: 'Laskelman poikkeamien ja riskien tunnistaminen', icon: Calculator },
  { name: 'Aikatauluanalyysi', description: 'Vaiheiden riippuvuuksien ja viiveiden tarkastelu', icon: Calendar },
  { name: 'Riskianalyysi', description: 'Projektin operatiivisten riskien yhteenveto', icon: TrendingUp },
  { name: 'Kalustotuki', description: 'Kalustotarpeiden ja huoltoriskien tarkastelu', icon: Wrench },
  { name: 'Viestiluonnokset', description: 'Työmaa- ja asiakasviestien luonnostelu', icon: MessageSquare },
  { name: 'Kuvadokumentointi', description: 'Työmaakuvien kuvailu ja luokittelu', icon: Image },
];

export default function AIPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-hero text-text-primary">AI-työkalut</h1>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
            Ei vielä käytössä
          </Badge>
        </div>
        <p className="mt-1 text-body-sm text-text-secondary">
          Tekoälyominaisuudet otetaan käyttöön vasta, kun palvelinpuolinen malliyhteys ja käyttöehdot on konfiguroitu.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-amber-950">Simuloidut vastaukset on poistettu</h2>
            <p className="text-sm leading-6 text-amber-900/80">
              {BRAND.aiAssistantName} ei tällä hetkellä lähetä kysymyksiä mallipalvelulle eikä väitä tuottavansa tekoälyvastauksia. Näkymä aktivoidaan myöhemmin erillisellä palvelinpuolisella integraatiolla.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole size={18} className="text-primary" /> Palvelinsalaisuus
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-text-secondary">
            Mallipalvelun avain säilytetään palvelinympäristössä. Avainta ei koskaan upoteta selaimeen tai GitHub-repositorioon.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck size={18} className="text-primary" /> Organisaatiorajaus
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-text-secondary">
            Käyttäjän istunto, rooli ja aktiivinen organisaatio tarkistetaan ennen kuin organisaation tietoja voidaan käyttää vastauksen taustalla.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot size={18} className="text-primary" /> Hallittu käyttöönotto
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-text-secondary">
            Ensimmäinen versio rajataan lukevaksi avustajaksi. Tietoja muuttavat AI-toiminnot vaativat erillisen vahvistuksen ja audit trailin.
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h2 className="font-semibold text-text-primary">Suunnitellut ominaisuudet</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plannedTools.map((tool, index) => (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="h-full border-dashed bg-slate-50/60">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
                      <tool.icon size={18} />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Suunniteltu</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">{tool.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{tool.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
