import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Send,
  FileText,
  Mic,
  Calculator,
  Calendar,
  TrendingUp,
  Wrench,
  MessageSquare,
  Image,
  Bot,
  User,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const tools = [
  { id: '1', name: 'Dokumenttianalyysi', description: 'Analysoi sopimukset ja tarjoukset', icon: FileText, color: 'bg-blue-100 text-blue-600' },
  { id: '2', name: 'Ääniassistentti', description: 'Diktoi työmaapäiväkirja', icon: Mic, color: 'bg-purple-100 text-purple-600' },
  { id: '3', name: 'Kustannusarvio', description: 'Laske urakkahinta AI:lla', icon: Calculator, color: 'bg-green-100 text-green-600' },
  { id: '4', name: 'Aikatauluoptimointi', description: 'Optimoi projektiaikataulu', icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  { id: '5', name: 'Riskianalyysi', description: 'Tunnista projektiriskit', icon: TrendingUp, color: 'bg-red-100 text-red-600' },
  { id: '6', name: 'Työkalusuosittelu', description: 'Suosittele oikeat työkalut', icon: Wrench, color: 'bg-cyan-100 text-cyan-600' },
  { id: '7', name: 'Viestigeneraattori', description: 'Kirjoita ammattimaiset viestit', icon: MessageSquare, color: 'bg-pink-100 text-pink-600' },
  { id: '8', name: 'Dokumenttikuvat', description: 'Luo dokumentaatiokuvaukset', icon: Image, color: 'bg-amber-100 text-amber-600' },
];

const chatHistory = [
  { role: 'assistant', message: 'Hei! Olen VaKantti AI -assistentti. Miten voin auttaa sinua tänään?' },
];

export default function AIPage() {
  const [messages, setMessages] = useState(chatHistory);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, message: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const responses: Record<string, string> = {
        'hei': 'Hei! Kuinka voin auttaa?',
        'projekti': 'Voit kysyä projekteista, kustannuksista tai aikatauluista.',
        'turvallisuus': 'Turvallisuus on tärkeää! Tarkista viimeisimmät havainnot Työturvallisuus-välilehdeltä.',
      };
      const lower = userMsg.message.toLowerCase();
      const response = Object.entries(responses).find(([k]) => lower.includes(k))?.[1]
        || 'Kiitos viestistä! Olen vielä oppimisvaiheessa, mutta voin auttaa parhaani mukaan. Kokeile työkaluja alla olevasta valikosta.';

      setMessages(prev => [...prev, { role: 'assistant', message: response }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI-työkalut</h1>
        <p className="text-gray-500 mt-1">Tekoälyavusteet rakennusalan työhön</p>
      </div>

      {/* Chat */}
      <Card className="h-[300px] flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            VaKantti AI -assistentti
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                m.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                {m.message}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-gray-100 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
        </CardContent>
        <div className="p-4 border-t flex gap-2">
          <Input
            placeholder="Kirjoita kysymyksesi..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            className="flex-1"
          />
          <Button onClick={sendMessage} className="bg-primary hover:bg-primary-hover">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tools.map((tool, i) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg ${tool.color} flex items-center justify-center mb-3`}>
                  <tool.icon className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-sm mb-1">{tool.name}</h3>
                <p className="text-xs text-gray-500">{tool.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
