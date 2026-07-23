import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Search,
  Send,
  Paperclip,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Reply,
  Trash2,
  Mail,
  Phone,
  Bell,
  Filter,
  X,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Message {
  id: string;
  projectId?: string;
  projectName?: string;
  from: string;
  to: string[];
  subject: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high';
  category: 'general' | 'safety' | 'quality' | 'schedule' | 'urgent';
  replies: MessageReply[];
  attachments: string[];
}

interface MessageReply {
  id: string;
  from: string;
  content: string;
  timestamp: string;
}

const messages: Message[] = [
  {
    id: '1',
    projectId: '1',
    projectName: 'Rivitalo A',
    from: 'Matti Meikäläinen',
    to: ['Jethro'],
    subject: 'Putkityön aikataulu',
    content: 'Hei, milloin putkityöt asunnossa 3 alkavat? Tarvitsisimme tiedon, jotta voimme varautua.',
    timestamp: '2026-01-15T10:30:00',
    isRead: false,
    priority: 'normal',
    category: 'schedule',
    replies: [
      {
        id: 'r1',
        from: 'Jethro',
        content: 'Hei Matti, putkityöt asunnossa 3 alkavat ensi viikolla maanantaina. Ilmoitamme tarkemman ajan perjantaina.',
        timestamp: '2026-01-15T11:00:00'
      }
    ],
    attachments: []
  },
  {
    id: '2',
    projectId: '1',
    projectName: 'Rivitalo A',
    from: 'Jethro',
    to: ['Mika M.', 'Laura K.'],
    subject: 'Turvallisuustarkastus huomenna',
    content: 'Muistutus: Turvallisuustarkastus työmaalla huomenna klo 9:00. Varmistakaa, että työalueet ovat siistejä.',
    timestamp: '2026-01-15T09:00:00',
    isRead: true,
    priority: 'high',
    category: 'safety',
    replies: [
      {
        id: 'r2',
        from: 'Mika M.',
        content: 'Selvä, työalue on valmis tarkastukseen.',
        timestamp: '2026-01-15T09:15:00'
      }
    ],
    attachments: []
  },
  {
    id: '3',
    projectId: '2',
    projectName: 'Kerrostalo B',
    from: 'Sari Sininen',
    to: ['Jethro'],
    subject: 'Laatoituksen laatu',
    content: 'Olisiko mahdollista saada kuvia laatoituksesta ennen saumausta? Haluaisimme varmistaa, että laatu on hallituksen toivomalla tasolla.',
    timestamp: '2026-01-14T16:00:00',
    isRead: true,
    priority: 'normal',
    category: 'quality',
    replies: [],
    attachments: []
  },
  {
    id: '4',
    from: 'Helsingin Kaupunki',
    to: ['Jethro'],
    subject: 'Toimistoremontin aloituspalaveri',
    content: 'Hei, sovittu aloituspalaveri pidetään ensi viikolla tiistaina klo 14:00. Paikka: Toimistokatu 1, kokoushuone A.',
    timestamp: '2026-01-14T12:00:00',
    isRead: true,
    priority: 'high',
    category: 'general',
    replies: [
      {
        id: 'r3',
        from: 'Jethro',
        content: 'Kiitos tiedosta. Olemme paikalla.',
        timestamp: '2026-01-14T13:00:00'
      }
    ],
    attachments: ['Kokouskutsu.pdf']
  },
  {
    id: '5',
    projectId: '1',
    projectName: 'Rivitalo A',
    from: 'Mika M.',
    to: ['Jethro'],
    subject: 'Materiaalien puute',
    content: 'Putkityössä on loppunut 15mm kupariputki kesken. Tarvitsisimme lisää noin 20 metriä.',
    timestamp: '2026-01-15T08:00:00',
    isRead: false,
    priority: 'high',
    category: 'urgent',
    replies: [],
    attachments: []
  }
];

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'general':
      return <Badge variant="outline">Yleinen</Badge>;
    case 'safety':
      return <Badge className="bg-red-100 text-red-800">Turvallisuus</Badge>;
    case 'quality':
      return <Badge className="bg-blue-100 text-blue-800">Laatu</Badge>;
    case 'schedule':
      return <Badge className="bg-yellow-100 text-yellow-800">Aikataulu</Badge>;
    case 'urgent':
      return <Badge className="bg-orange-100 text-orange-800">Kiireellinen</Badge>;
    default:
      return null;
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'high':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'normal':
      return <Mail className="w-4 h-4 text-blue-500" />;
    case 'low':
      return <Mail className="w-4 h-4 text-gray-400" />;
    default:
      return null;
  }
};

export default function Viestinta() {
  const [messageList, setMessageList] = useState<Message[]>(messages);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState({
    to: '',
    subject: '',
    content: '',
    priority: 'normal' as const,
    category: 'general' as const
  });

  const filteredMessages = messageList.filter(msg =>
    msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (msg.projectName && msg.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleMarkAsRead = (id: string) => {
    setMessageList(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
  };

  const handleReply = (messageId: string) => {
    if (!replyContent.trim()) return;

    const reply: MessageReply = {
      id: `r-${Date.now()}`,
      from: 'Jethro',
      content: replyContent,
      timestamp: new Date().toISOString()
    };

    setMessageList(prev => prev.map(m =>
      m.id === messageId ? { ...m, replies: [...m.replies, reply] } : m
    ));
    setReplyContent('');
    setReplyingTo(null);
  };

  const handleSendMessage = () => {
    if (!newMessage.to || !newMessage.subject || !newMessage.content) return;

    const msg: Message = {
      id: Date.now().toString(),
      from: 'Jethro',
      to: newMessage.to.split(',').map(s => s.trim()),
      subject: newMessage.subject,
      content: newMessage.content,
      timestamp: new Date().toISOString(),
      isRead: true,
      priority: newMessage.priority,
      category: newMessage.category,
      replies: [],
      attachments: []
    };

    setMessageList(prev => [msg, ...prev]);
    setShowCompose(false);
    setNewMessage({
      to: '',
      subject: '',
      content: '',
      priority: 'normal',
      category: 'general'
    });
  };

  const unreadCount = messageList.filter(m => !m.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Viestintä</h1>
          <p className="text-gray-500 mt-1">Viestit ja tiedonvälitys</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowCompose(!showCompose)}
        >
          {showCompose ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCompose ? 'Peruuta' : 'Uusi viesti'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Viestit', value: messageList.length.toString(), icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Lukematta', value: unreadCount.toString(), icon: Bell, color: 'text-red-600' },
          { label: 'Kiireelliset', value: messageList.filter(m => m.priority === 'high' && !m.isRead).length.toString(), icon: AlertCircle, color: 'text-orange-600' },
          { label: 'Vastauksia', value: messageList.reduce((sum, m) => sum + m.replies.length, 0).toString(), icon: Reply, color: 'text-green-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-20`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Compose Form */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Uusi viesti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Vastaanottaja</label>
                    <Input
                      placeholder="Nimi tai sähköposti"
                      value={newMessage.to}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Aihe</label>
                    <Input
                      placeholder="Viestin aihe"
                      value={newMessage.subject}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Prioriteetti</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newMessage.priority}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, priority: e.target.value as Message['priority'] }))}
                    >
                      <option value="low">Matala</option>
                      <option value="normal">Normaali</option>
                      <option value="high">Korkea</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kategoria</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      value={newMessage.category}
                      onChange={(e) => setNewMessage(prev => ({ ...prev, category: e.target.value as Message['category'] }))}
                    >
                      <option value="general">Yleinen</option>
                      <option value="safety">Turvallisuus</option>
                      <option value="quality">Laatu</option>
                      <option value="schedule">Aikataulu</option>
                      <option value="urgent">Kiireellinen</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Viesti</label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                    placeholder="Kirjoita viesti..."
                    value={newMessage.content}
                    onChange={(e) => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4 mr-2" />
                    Lähetä
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-1">
            Saapuneet
            {unreadCount > 0 && (
              <Badge className="bg-red-100 text-red-800 ml-1">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">Lähetetyt</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Hae viesteistä..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Suodata
            </Button>
          </div>

          <div className="space-y-3">
            {filteredMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`cursor-pointer hover:shadow-md transition-shadow ${!msg.isRead ? 'border-blue-300 bg-blue-50/30' : ''}`}
                  onClick={() => {
                    setExpandedMessage(expandedMessage === msg.id ? null : msg.id);
                    handleMarkAsRead(msg.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          {!msg.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                          {getPriorityIcon(msg.priority)}
                          <h3 className={`${!msg.isRead ? 'font-semibold' : 'font-medium'}`}>{msg.subject}</h3>
                          {getCategoryBadge(msg.category)}
                          {msg.projectName && (
                            <Badge variant="outline" className="text-xs">{msg.projectName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Lähettäjä: {msg.from}</span>
                          <span>{new Date(msg.timestamp).toLocaleString('fi-FI')}</span>
                          {msg.replies.length > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {msg.replies.length} vastaus
                            </span>
                          )}
                          {msg.attachments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {msg.attachments.length} liite
                            </span>
                          )}
                        </div>
                      </div>
                      {expandedMessage === msg.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {expandedMessage === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t space-y-4"
                      >
                        <p className="text-sm text-gray-700 whitespace-pre-line">{msg.content}</p>

                        {msg.attachments.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2">Liitteet</h4>
                            <div className="flex flex-wrap gap-2">
                              {msg.attachments.map((att, i) => (
                                <Badge key={i} variant="outline" className="flex items-center gap-1">
                                  <Paperclip className="w-3 h-3" />
                                  {att}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Replies */}
                        {msg.replies.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Vastaukset</h4>
                            {msg.replies.map((reply) => (
                              <div key={reply.id} className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{reply.from}</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(reply.timestamp).toLocaleString('fi-FI')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Form */}
                        {replyingTo === msg.id ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                              placeholder="Kirjoita vastaus..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleReply(msg.id)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Send className="w-4 h-4 mr-1" />
                                Lähetä
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                              >
                                Peruuta
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setReplyingTo(msg.id); }}
                            >
                              <Reply className="w-4 h-4 mr-1" />
                              Vastaa
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Lähetetyt viestit näkyvät täällä</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
