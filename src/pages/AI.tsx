import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, FileText, Calculator, Clock, Shield, Mic, Camera, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const aiTools = [
  { name: 'Dokumenttianalyysi', description: 'Analysoi rakennusasiakirjoja automaattisesti', icon: FileText },
  { name: 'Kustannusarvio', description: 'Tee nopea kustannusarvio tekoälyn avulla', icon: Calculator },
  { name: 'Aikatauluoptimointi', description: 'Optimoi projektiaikatauluja', icon: Clock },
  { name: 'Turvallisuusanalyysi', description: 'Tunnista turvallisuusriskit', icon: Shield },
  { name: 'Äänipäiväkirja', description: 'Puhu päiväkirjamerkintä puheesta tekstiksi', icon: Mic },
  { name: 'Kuvantunnistus', description: 'Tunnista rakennusmateriaalit kuvasta', icon: Camera },
];

const simulatedChat = [
  { sender: 'user', text: 'Analysoi Tampereen korjaustyön päiväkirja eiliseltä.' },
  { sender: 'ai', text: 'Analyysi valmis! Eilen työmaalla työskenteli 8 henkilöä. LVI-asennukset etenivät suunnitellusti ja kolme kylpyhuonetta saatiin valmiiksi. Ennalta arvaamattomia viivästyksiä ei ilmennyt. Suositus: Jatka samaan tahtiin.' },
  { sender: 'user', text: 'Arvioi projektin kokonaiskustannukset.' },
  { sender: 'ai', text: 'Perustuen työmääriin ja päiväkirjamerkintöihin, arvioin kokonaiskustannukseksi noin 412 000 €. Tämä sisältää työvoiman (180 000 €), materiaalit (150 000 €) ja muut kustannukset (82 000 €). Budjettipoikkeama +8 %.' },
];

export default function AIPage() {
  const [messages] = useState(simulatedChat);
  const [input, setInput] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tekoälyavusteet</h1>
          <p className="text-sm text-text-muted">AI-avustaja rakennusalan ammattilaisille</p>
        </div>
      </div>

      {/* Chat Interface */}
      <Card className="bg-bg-dark border-bg-dark-border">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-bg-dark-elevated text-text-on-dark border border-bg-dark-border'
                }`}>
                  {msg.sender === 'ai' && <Sparkles size={14} className="inline mr-2 text-primary" />}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Kirjoita kysymys..."
              className="flex-1 h-10 px-4 bg-bg-dark-elevated border border-bg-dark-border rounded-lg text-sm text-text-on-dark placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
            <Button className="bg-primary hover:bg-primary-hover text-white h-10 px-4">
              <Send size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {['Analysoi päiväkirja', 'Arvioi kustannukset', 'Optimoi aikataulu', 'Tarkista turvallisuus'].map(prompt => (
          <Button key={prompt} variant="outline" size="sm" className="text-xs">
            {prompt}
          </Button>
        ))}
      </div>

      {/* AI Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {aiTools.map((tool, idx) => (
          <motion.div key={tool.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                  <tool.icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary text-sm">{tool.name}</p>
                  <p className="text-xs text-text-muted mt-1">{tool.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
