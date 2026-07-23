import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  FileText,
  Calculator,
  Clock,
  Shield,
  Mic,
  Camera,
  Send,
  CheckCircle,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: 'active' | 'beta' | 'development';
  usageCount: number;
  lastUsed: string;
}

interface AIInsight {
  id: string;
  title: string;
  description: string;
  type: 'risk' | 'opportunity' | 'anomaly' | 'recommendation';
  projectId?: string;
  projectName?: string;
  confidence: number;
  date: string;
  isRead: boolean;
}

interface AIQuery {
  id: string;
  question: string;
  answer: string;
  category: string;
  timestamp: string;
  isHelpful?: boolean;
}

const aiTools: AITool[] = [
  {
    id: '1',
    name: 'Dokumenttianalyysi',
    description: 'Analysoi urakkasopimukset, työmaapäiväkirjat ja muut dokumentit automaattisesti. Tunnistaa riskit ja poikkeamat.',
    icon: 'FileText',
    category: 'analyysi',
    status: 'active',
    usageCount: 156,
    lastUsed: '2026-01-15'
  },
  {
    id: '2',
    name: 'Kustannuslaskuri',
    description: 'AI-tehostettu kustannusarvio, joka oppii historiallisista tiedoista ja antaa tarkempia arvioita.',
    icon: 'Calculator',
    category: 'laskenta',
    status: 'active',
    usageCount: 89,
    lastUsed: '2026-01-14'
  },
  {
    id: '3',
    name: 'Aikatauluassistentti',
    description: 'Ehdottaa optimaalista työjärjestystä ja resurssien allokaatiota based on learned patterns.',
    icon: 'Clock',
    category: 'aikataulutus',
    status: 'beta',
    usageCount: 45,
    lastUsed: '2026-01-10'
  },
  {
    id: '4',
    name: 'Riskianalysaattori',
    description: 'Ennakoi työmaariskit historiallisen datan perusteella ja ehdottaa ennaltaehkäiseviä toimenpiteitä.',
    icon: 'Shield',
    category: 'turvallisuus',
    status: 'active',
    usageCount: 124,
    lastUsed: '2026-01-15'
  },
  {
    id: '5',
    name: 'Puheentunnistus',
    description: 'Muunna työmaapalaverit tekstiksi automaattisesti. Tunnistaa tehtävät ja vastuut.',
    icon: 'Mic',
    category: 'viestintä',
    status: 'beta',
    usageCount: 34,
    lastUsed: '2026-01-08'
  },
  {
    id: '6',
    name: 'Kuvanalysaattori',
    description: 'Analysoi työmaakuvat ja tunnistaa turvallisuuspuutteet, laatuongelmat ja edistymisen.',
    icon: 'Camera',
    category: 'laatu',
    status: 'development',
    usageCount: 12,
    lastUsed: '2026-01-05'
  }
];

const initialInsights: AIInsight[] = [
  {
    id: '1',
    title: 'Kustannusylityksen riski havaittu',
    description: 'Projekti "Rivitalo A" on 15 % alkuperäisen budjetin yläpuolella. Pääasiallinen syy: putkityöt kestivät 3 päivää suunniteltua pidempään. Suositus: Tarkista jäljellä olevat urakat ja neuvottele uudelleen aliurakoitsijoiden kanssa.',
    type: 'risk',
    projectId: '1',
    projectName: 'Rivitalo A',
    confidence: 0.92,
    date: '2026-01-15',
    isRead: false
  },
  {
    id: '2',
    title: 'Optimaalinen aliurakoitsija-aikaikkuna',
    description: 'Sähkötyö yhtiö SähköM Oy on saatavilla seuraavaksi 2 viikoksi. Historiallinen datan perusteella hinta-laatusuhde on 23 % parempi kuin kilpailijoilla.',
    type: 'opportunity',
    projectId: '2',
    projectName: 'Kerrostalo B',
    confidence: 0.87,
    date: '2026-01-14',
    isRead: false
  },
  {
    id: '3',
    title: 'Turvallisuuspoikkeama tunnistettu',
    description: 'Työmaalla "Toimisto C" on havaittu toistuvia putoamissuojaukseen liittyviä puutteita (3 kertaa viimeisen 2 viikon aikana). Suositus: Välittömästi tarkastus ja lisäkoulutus työntekijöille.',
    type: 'anomaly',
    projectId: '3',
    projectName: 'Toimisto C',
    confidence: 0.95,
    date: '2026-01-13',
    isRead: true
  },
  {
    id: '4',
    title: 'Resurssien allokointisuositus',
    description: 'Työntekijä Mika M. on ollut tehokkain (98 % suoritusaste) vesieristystöissä. Suositus: Allokoi vesieristystyöhön projektissa "Rivitalo D".',
    type: 'recommendation',
    projectId: '4',
    projectName: 'Rivitalo D',
    confidence: 0.78,
    date: '2026-01-12',
    isRead: true
  }
];

const initialQueries: AIQuery[] = [
  {
    id: '1',
    question: 'Mitkä ovat tämän hetkiset kustannusriskit aktiivisissa projekteissa?',
    answer: 'Analyysin perusteella aktiivisissa projekteissa on tunnistettu seuraavat riskit:\n\n1. **Rivitalo A**: Kustannusylitys 15 % (syynä putkityön viivästyminen)\n2. **Kerrostalo B**: Aliurakointikustannusten nousu 8 % markkinatilanteen vuoksi\n3. **Toimisto C**: Materiaalitoimitusten viivästyminen voi aiheuttaa 5 päivän aikataulupoikkeaman\n\nSuosittelen seurantapalaveria projektipäälliköiden kanssa ensi viikolla.',
    category: 'riskit',
    timestamp: '2026-01-15T10:30:00',
    isHelpful: true
  },
  {
    id: '2',
    question: 'Vertaa työntekijöiden suorituskykyä viime kuussa',
    answer: 'Tässä työntekijöiden suorituskykyanalyysi joulukuulta 2025:\n\n**Tehokkaimmat työntekijät:**\n1. Mika M. - 98 % suoritusaste, 0 turvallisuuspoikkeamaa\n2. Laura K. - 96 % suoritusaste, erinomainen laatupalaute\n3. Jussi P. - 94 % suoritusaste, aktiivinen kehitysehdotuksissa\n\n**Huomioitavaa:**\n- Sairauspoissaolot nousivat 12 % edelliskuusta\n- Uusien työntekijöiden perehdytys vaikuttaa keskisuoritukseen\n\nHaluatko tarkemman analyysin jostain tiimistä?',
    category: 'henkilöstö',
    timestamp: '2026-01-14T14:15:00',
    isHelpful: true
  }
];

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'FileText': return FileText;
    case 'Calculator': return Calculator;
    case 'Clock': return Clock;
    case 'Shield': return Shield;
    case 'Mic': return Mic;
    case 'Camera': return Camera;
    default: return Sparkles;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Aktiivinen</Badge>;
    case 'beta':
      return <Badge className="bg-yellow-100 text-yellow-800">Beta</Badge>;
    case 'development':
      return <Badge className="bg-gray-100 text-gray-800">Kehityksessä</Badge>;
    default:
      return null;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'risk':
      return <Badge className="bg-red-100 text-red-800">Riski</Badge>;
    case 'opportunity':
      return <Badge className="bg-green-100 text-green-800">Mahdollisuus</Badge>;
    case 'anomaly':
      return <Badge className="bg-orange-100 text-orange-800">Poikkeama</Badge>;
    case 'recommendation':
      return <Badge className="bg-blue-100 text-blue-800">Suositus</Badge>;
    default:
      return null;
  }
};

export default function AI() {
  const [insights, setInsights] = useState<AIInsight[]>(initialInsights);
  const [queries, setQueries] = useState<AIQuery[]>(initialQueries);
  const [newQuestion, setNewQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const handleSendQuestion = () => {
    if (!newQuestion.trim()) return;

    setIsLoading(true);

    // Simulate AI processing
    setTimeout(() => {
      const newQuery: AIQuery = {
        id: Date.now().toString(),
        question: newQuestion,
        answer: generateAIResponse(newQuestion),
        category: 'yleinen',
        timestamp: new Date().toISOString()
      };

      setQueries(prev => [newQuery, ...prev]);
      setNewQuestion('');
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (question: string): string => {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('kustannus') || lowerQ.includes('budjetti')) {
      return 'Kustannusanalyysin mukaan aktiivisissa projekteissa kustannukset ovat keskimäärin 8 % suunnitellun budjetin yläpuolella. Suurimmat ylitykset liittyvät aliurakointiin (+15 %) ja materiaaleihin (+12 %). Suosittelen tarkistamaan jäljellä olevat urakat ja neuvottelemaan uudet hinnat pitkäaikaisilla kumppaneilla.';
    } else if (lowerQ.includes('aikataulu') || lowerQ.includes('viivästy')) {
      return 'Aikatauluanalyysin perusteella 3 projektia on myöhässä keskimäärin 5 päivää. Pääasialliset syyt: materiaalitoimitusten viivästymiset (40 %), sääolosuhteet (35 %) ja aliurakoitsijoiden aikataulumuutokset (25 %). Suositus: Siirrä resursseja projektiin "Rivitalo A" ja ota yhteyttä materiaalitoimittajiin.';
    } else if (lowerQ.includes('turvallisuus') || lowerQ.includes('riski')) {
      return 'Turvallisuusanalyysi: Viimeisen 30 päivän aikana on kirjattu 12 turvallisuuspoikkeamaa, mikä on 20 % enemmän kuin edelliskuussa. Yleisimmät: putoamissuojaus (5), työkalujen säilytys (4) ja henkilönsuojaimet (3). Suositus: Välittömästi turvallisuuspalaveri ja tarkastus kaikilla työmailla.';
    } else {
      return 'Kiitos kysymyksestä! Analysoin tätä parhaillaan. Voit tarkentaa kysymystäsi tai kysyä lisää projektien kustannuksista, aikatauluista, henkilöstöstä tai turvallisuudesta.';
    }
  };

  const markInsightAsRead = (id: string) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
  };

  const markQueryAsHelpful = (id: string, isHelpful: boolean) => {
    setQueries(prev => prev.map(q => q.id === id ? { ...q, isHelpful } : q));
  };

  const unreadCount = insights.filter(i => !i.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tekoäly & Älykäs Analyysi</h1>
          <p className="text-gray-500 mt-1">AI-työkalut ja oivallukset päätöksenteon tueksi</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {unreadCount} uutta oivallusta
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Oivallukset & Analyysit</TabsTrigger>
          <TabsTrigger value="assistant">AI-Assistentti</TabsTrigger>
          <TabsTrigger value="tools">Työkalut</TabsTrigger>
        </TabsList>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            {insights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    !insight.isRead ? 'border-purple-300 bg-purple-50/30' : ''
                  }`}
                  onClick={() => {
                    setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
                    if (!insight.isRead) markInsightAsRead(insight.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">{getTypeBadge(insight.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold ${!insight.isRead ? 'text-purple-900' : 'text-gray-900'}`}>
                              {insight.title}
                            </h3>
                            {!insight.isRead && (
                              <span className="w-2 h-2 bg-purple-500 rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {insight.projectName} • {new Date(insight.date).toLocaleDateString('fi-FI')} • Luotettavuus: {Math.round(insight.confidence * 100)}%
                          </p>
                          {expandedInsight === insight.id && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-sm text-gray-700 mt-3 whitespace-pre-line"
                            >
                              {insight.description}
                            </motion.p>
                          )}
                        </div>
                      </div>
                      {expandedInsight === insight.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* AI Assistant Tab */}
        <TabsContent value="assistant" className="space-y-4">
          <Card className="min-h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                VaKantti AI-Assistentti
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[400px]">
                {queries.map((query) => (
                  <div key={query.id} className="space-y-2">
                    <div className="flex justify-end">
                      <div className="bg-purple-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                        <p className="text-sm">{query.question}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-[80%]">
                        <p className="text-sm text-gray-800 whitespace-pre-line">{query.answer}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">
                            {new Date(query.timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {query.isHelpful === undefined ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => markQueryAsHelpful(query.id, true)}
                                className="text-xs text-green-600 hover:underline"
                              >
                                Hyödyllinen
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => markQueryAsHelpful(query.id, false)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Ei hyödyllinen
                              </button>
                            </div>
                          ) : query.isHelpful ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Hyödyllinen
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI analysoi...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Input
                  placeholder="Kysy mitä tahansa projekteista, kustannuksista, aikatauluista..."
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendQuestion()}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendQuestion}
                  disabled={isLoading || !newQuestion.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs text-gray-500">Pikakysymykset:</span>
                {['Kustannusylitykset?', 'Aikatauluriskit?', 'Henkilöstötehokkuus?', 'Turvallisuuspoikkeamat?'].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setNewQuestion(q);
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 text-gray-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiTools.map((tool) => {
              const IconComponent = getIconComponent(tool.icon);
              return (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <IconComponent className="w-5 h-5 text-purple-600" />
                        </div>
                        {getStatusBadge(tool.status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{tool.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{tool.usageCount} käyttökertaa</span>
                        <span>Viimeksi: {new Date(tool.lastUsed).toLocaleDateString('fi-FI')}</span>
                      </div>
                      <Button
                        className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
                        size="sm"
                        disabled={tool.status === 'development'}
                      >
                        {tool.status === 'development' ? 'Tulossa pian' : 'Avaa työkalu'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Kehityspalaute
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Haluatko uuden AI-työkalun tai parannuksen olemassa olevaan? Kerro meille, niin kehitystiimi priorisoi sen.
              </p>
              <div className="flex items-center gap-2">
                <Input placeholder="Kuvaile toivomasi työkalu tai parannus..." />
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-1" />
                  Lähetä
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
