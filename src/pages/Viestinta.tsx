import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Megaphone,
  Send,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const messages = [
  { id: '1', from: 'Matti M.', to: 'Työnjohto', content: 'Putkityöt valmiit huoneistossa 2B. Seuraavaksi 3B.', time: '10:30', read: true },
  { id: '2', from: 'Laura K.', to: 'Kaikki', content: 'Laatoitusmateriaali saapunut. Aloitetaan huomenna.', time: '09:15', read: false },
  { id: '3', from: 'Asiakas', to: 'Matti M.', content: 'Milloin putkiremontti on valmis?', time: 'Eilen', read: false },
  { id: '4', from: 'Jussi P.', to: 'Työnjohto', content: 'Sähkösuunnitelma päivitetty, tarkistathan.', time: 'Eilen', read: true },
];

const announcements = [
  { id: '1', title: 'Talviturvallisuuspäivä 25.1.', content: 'Kaikki työmaat osallistuvat talviturvallisuuspäivään. Ohjelma lähetetään erikseen.', date: '15.1.2026', urgent: true },
  { id: '2', title: 'Uusi työmaapäiväkirjamalli', content: 'Päivitetty päiväkirjamalli otetaan käyttöön 20.1. alkaen.', date: '14.1.2026', urgent: false },
  { id: '3', title: 'Materiaalitoimituksen viivästys', content: 'Kerrostalo B:n laatoitus viivästyy 2 päivällä.', date: '13.1.2026', urgent: true },
];

export default function Viestinta() {
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Viestintä</h1>
        <p className="text-gray-500 mt-1">Viestit, tiedotteet ja ilmoitukset</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="messages" className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" /> Viestit
            <Badge className="ml-1 bg-primary text-white">{messages.filter(m => !m.read).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-1">
            <Megaphone className="w-4 h-4" /> Tiedotteet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2">
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card
                    className={`cursor-pointer hover:shadow-md transition-shadow ${!msg.read ? 'border-primary' : ''}`}
                    onClick={() => setSelectedMsg(msg.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-primary">{msg.from.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${!msg.read ? 'font-semibold' : ''}`}>{msg.from}</p>
                        </div>
                        <span className="text-xs text-gray-400">{msg.time}</span>
                      </div>
                      <p className={`text-xs truncate ${!msg.read ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {msg.content}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            <div className="lg:col-span-2">
              <Card className="h-full flex flex-col">
                <CardContent className="flex-1 p-4">
                  {selectedMsg ? (
                    <div className="space-y-4">
                      {messages.filter(m => m.id === selectedMsg).map(m => (
                        <div key={m.id}>
                          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">{m.from.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{m.from}</p>
                              <p className="text-xs text-gray-500">{m.to} · {m.time}</p>
                            </div>
                          </div>
                          <p className="text-gray-700">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                        <p>Valitse viesti nähdäksesi sisällön</p>
                      </div>
                    </div>
                  )}
                </CardContent>
                {selectedMsg && (
                  <div className="p-4 border-t flex gap-2">
                    <input type="text" placeholder="Kirjoita vastaus..."
                      className="flex-1 h-10 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary" />
                    <Button className="bg-primary hover:bg-primary-hover"><Send className="w-4 h-4" /></Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <div className="space-y-3">
            {announcements.map(a => (
              <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className={`hover:shadow-md transition-shadow ${a.urgent ? 'border-red-200' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {a.urgent ? <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" /> : <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{a.title}</h3>
                          {a.urgent && <Badge className="bg-red-100 text-red-800">Kiireellinen</Badge>}
                        </div>
                        <p className="text-sm text-gray-600">{a.content}</p>
                        <p className="text-xs text-gray-400 mt-2">{a.date}</p>
                      </div>
                    </div>
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
