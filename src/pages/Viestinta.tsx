import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Phone, Mail, Search, Bell, CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const conversations = [
  { id: 1, name: 'Matti Meikäläinen', role: 'Työnjohtaja', lastMessage: 'LVI-asennukset valmiit tänään', time: '10:30', unread: 2 },
  { id: 2, name: 'Liisa Virtanen', role: 'Projektipäällikkö', lastMessage: 'Budjettiesitys lähetetty', time: '09:15', unread: 0 },
  { id: 3, name: 'Jukka Lehtonen', role: 'LVI-asentaja', lastMessage: 'Materiaalit saapuneet', time: 'Eilen', unread: 1 },
  { id: 4, name: 'Anna Lahtinen', role: 'Rakennusmies', lastMessage: 'Ikkunat asennettu', time: 'Eilen', unread: 0 },
  { id: 5, name: 'Pekka Seppänen', role: 'Sähköasentaja', lastMessage: 'Sähkötyöt jatkuvat huomenna', time: 'Ti', unread: 0 },
];

const chatMessages = [
  { sender: 'Matti Meikäläinen', text: 'Hei! Onko LVI-asennukset etenemässä aikataulussa?', time: '10:25', me: false },
  { sender: 'Minä', text: 'Kyllä, kolme kylpyhuonetta valmiiksi tänään.', time: '10:28', me: true },
  { sender: 'Matti Meikäläinen', text: 'Hienoa! Raportoi lopputulos illalla.', time: '10:30', me: false },
];

const notifications = [
  { id: 1, text: 'Työmääräys TM-2025-001 päivitetty', type: 'work', time: '5 min sitten', read: false },
  { id: 2, text: 'Turvakierros suoritettu Tampereella', type: 'safety', time: '30 min sitten', read: false },
  { id: 3, text: 'Uusi projekti lisätty: Espoon toimisto', type: 'project', time: '1 h sitten', read: true },
];

export default function Viestinta() {
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
  const [selectedConv, setSelectedConv] = useState(1);
  const [notifs, setNotifs] = useState(notifications);

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Viestintä</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={activeTab === 'messages' ? 'default' : 'outline'} onClick={() => setActiveTab('messages')} className={activeTab === 'messages' ? 'bg-primary' : ''}>
          <MessageSquare size={16} className="mr-2" /> Viestit
        </Button>
        <Button variant={activeTab === 'notifications' ? 'default' : 'outline'} onClick={() => setActiveTab('notifications')} className={activeTab === 'notifications' ? 'bg-primary' : ''}>
          <Bell size={16} className="mr-2" /> Ilmoitukset ({notifs.filter(n => !n.read).length})
        </Button>
      </div>

      {activeTab === 'messages' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversation List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" placeholder="Hae..." className="w-full h-9 pl-9 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#F1F5F9]">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${selectedConv === conv.id ? 'bg-primary-light' : 'hover:bg-[#F8FAFC]'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-primary">{conv.name.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary truncate">{conv.name}</p>
                        <span className="text-xs text-text-muted">{conv.time}</span>
                      </div>
                      <p className="text-xs text-text-muted truncate">{conv.lastMessage}</p>
                    </div>
                    {conv.unread > 0 && (
                      <Badge className="bg-primary text-white text-xs min-w-[20px] h-5 flex items-center justify-center">{conv.unread}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">MM</span>
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">Matti Meikäläinen</p>
                    <p className="text-xs text-text-muted">Työnjohtaja</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm"><Phone size={16} /></Button>
                  <Button variant="ghost" size="sm"><Mail size={16} /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 min-h-[300px]">
              {chatMessages.map((msg, idx) => (
                <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.1 }}
                  className={`flex ${msg.me ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-lg text-sm ${msg.me ? 'bg-primary text-white' : 'bg-[#F8FAFC] text-text-primary'}`}>
                    <p>{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.me ? 'text-white/70' : 'text-text-muted'}`}>{msg.time}</p>
                  </div>
                </motion.div>
              ))}
            </CardContent>
            <div className="p-4 border-t flex gap-2">
              <input type="text" placeholder="Kirjoita viesti..." className="flex-1 h-10 px-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm" />
              <Button className="bg-primary hover:bg-primary-hover text-white h-10 px-4"><Send size={16} /></Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ilmoitukset</CardTitle>
            <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCircle size={16} className="mr-2" /> Merkkaa luetuiksi</Button>
          </CardHeader>
          <CardContent className="divide-y divide-[#F1F5F9]">
            {notifs.map(notif => (
              <div key={notif.id} className={`flex items-center gap-3 py-3 ${notif.read ? 'opacity-60' : ''}`}>
                {notif.read ? <Circle size={16} className="text-text-muted" /> : <Circle size={16} className="text-primary fill-primary" />}
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{notif.text}</p>
                  <p className="text-xs text-text-muted">{notif.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
