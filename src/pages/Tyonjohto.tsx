import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  BookOpen,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  CircleDot,
  Circle,
  CircleOff,
  Waves,
  CloudRain,
  Wind,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/* Mock Data */
const tyonjohtoData = {
  activeProjects: [
    {
      id: '1',
      name: 'Rivitalo A - Putkiremontti',
      address: 'Keltanenkatu 15, Helsinki',
      status: 'active',
      progress: 35,
      workers: 5,
      startDate: '2026-01-05',
      endDate: '2026-03-15',
      dailyNotes: 12,
      lastNote: '2026-01-15',
      issues: 2,
    },
    {
      id: '2',
      name: 'Kerrostalo B - Kylpyhuoneet',
      address: 'Sinikatu 42, Helsinki',
      status: 'active',
      progress: 15,
      workers: 4,
      startDate: '2026-01-08',
      endDate: '2026-04-30',
      dailyNotes: 8,
      lastNote: '2026-01-14',
      issues: 1,
    },
    {
      id: '3',
      name: 'Toimisto C - Peruskorjaus',
      address: 'Toimistokatu 1, Espoo',
      status: 'planning',
      progress: 5,
      workers: 0,
      startDate: '2026-02-01',
      endDate: '2026-08-31',
      dailyNotes: 2,
      lastNote: '2026-01-10',
      issues: 0,
    },
  ],
  workers: [
    { id: '1', name: 'Matti M.', role: 'Putkimies', project: 'Rivitalo A', status: 'working', hoursToday: 7.5 },
    { id: '2', name: 'Laura K.', role: 'Laatoittaja', project: 'Kerrostalo B', status: 'working', hoursToday: 8.0 },
    { id: '3', name: 'Jussi P.', role: 'Sähkömies', project: 'Rivitalo D', status: 'break', hoursToday: 4.0 },
    { id: '4', name: 'Anna S.', role: 'LVI-asentaja', project: 'Rivitalo A', status: 'working', hoursToday: 6.5 },
    { id: '5', name: 'Pekka H.', role: 'Rakennusmies', project: 'Kerrostalo B', status: 'working', hoursToday: 7.0 },
  ],
  dailyTasks: [
    { id: '1', text: 'Tarkasta putkityöt Rivitalo A', done: true, priority: 'high' },
    { id: '2', text: 'Laatoituksen aloitus Kerrostalo B', done: false, priority: 'high' },
    { id: '3', text: 'Turvakierros työmaalla', done: false, priority: 'medium' },
    { id: '4', text: 'Työmaapäiväkirjan kirjaus', done: true, priority: 'low' },
    { id: '5', text: 'Tilaa materiaalit Toimisto C', done: false, priority: 'medium' },
  ],
  weather: {
    temp: -2,
    condition: 'snow',
    wind: 5,
    humidity: 85,
  },
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Aktiivinen</Badge>;
    case 'planning':
      return <Badge className="bg-gray-100 text-gray-800">Suunnittelu</Badge>;
    default:
      return null;
  }
};

const getWorkerStatus = (status: string) => {
  switch (status) {
    case 'working':
      return { color: 'text-green-600', bg: 'bg-green-50', label: 'Työssä', icon: CircleDot };
    case 'break':
      return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Tauko', icon: Circle };
    default:
      return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Ei paikalla', icon: CircleOff };
  }
};

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-100 text-red-800">Kiireellinen</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-100 text-yellow-800">Normaali</Badge>;
    default:
      return <Badge className="bg-blue-100 text-blue-800">Matala</Badge>;
  }
};

export default function Tyonjohto() {
  const [tasks, setTasks] = useState(tyonjohtoData.dailyTasks);
  const [activeTab, setActiveTab] = useState('overview');

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t));
  };

  const completedTasks = tasks.filter(t => t.done).length;
  const totalTasks = tasks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Työnjohto</h1>
          <p className="text-gray-500 mt-1">Työmaiden seuranta ja päivittäinen hallinta</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Työmaapäiväkirja
          </Button>
          <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
            <Plus className="w-4 h-4" />
            Uusi tehtävä
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Yleisnäkymä</TabsTrigger>
          <TabsTrigger value="projects">Projektit</TabsTrigger>
          <TabsTrigger value="workers">Henkilöstö</TabsTrigger>
          <TabsTrigger value="tasks">Tehtävät</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Aktiiviset projektit</p>
                      <p className="text-2xl font-bold text-gray-900">{tyonjohtoData.activeProjects.filter(p => p.status === 'active').length}</p>
                    </div>
                    <Building2 className="w-8 h-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Työntekijät paikalla</p>
                      <p className="text-2xl font-bold text-gray-900">{tyonjohtoData.workers.filter(w => w.status === 'working').length}/{tyonjohtoData.workers.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Päivän tehtävät</p>
                      <p className="text-2xl font-bold text-gray-900">{completedTasks}/{totalTasks}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Sää</p>
                      <p className="text-2xl font-bold text-gray-900">{tyonjohtoData.weather.temp}°C</p>
                    </div>
                    <CloudRain className="w-8 h-8 text-blue-400 opacity-40" />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{tyonjohtoData.weather.wind} m/s</span>
                    <span className="flex items-center gap-1"><Waves className="w-3 h-3" />{tyonjohtoData.weather.humidity}%</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Quick Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Päivän tehtävät ({completedTasks}/{totalTasks})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(completedTasks / totalTasks) * 100} className="mb-4" />
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <Checkbox checked={task.done} onCheckedChange={() => toggleTask(task.id)} />
                    <span className={cn('flex-1 text-sm', task.done && 'line-through text-gray-400')}>
                      {task.text}
                    </span>
                    {getPriorityBadge(task.priority)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="grid gap-4">
            {tyonjohtoData.activeProjects.map(project => (
              <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{project.name}</h3>
                          {getStatusBadge(project.status)}
                        </div>
                        <p className="text-sm text-gray-500">{project.address}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1"><Users className="w-4 h-4" />{project.workers} työntekijää</span>
                          <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{project.dailyNotes} päiväkirjaa</span>
                          {project.issues > 0 && <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-4 h-4" />{project.issues} ongelmaa</span>}
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Edistyminen</span>
                            <span className="font-medium">{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Workers Tab */}
        <TabsContent value="workers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tyonjohtoData.workers.map(worker => {
              const statusInfo = getWorkerStatus(worker.status);
              const StatusIcon = statusInfo.icon;
              return (
                <motion.div key={worker.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">{worker.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{worker.name}</p>
                            <p className="text-sm text-gray-500">{worker.role}</p>
                          </div>
                        </div>
                        <div className={cn('px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1', statusInfo.bg, statusInfo.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><span className="text-gray-400">Projekti:</span> {worker.project}</p>
                        <p><span className="text-gray-400">Tuntia tänään:</span> {worker.hoursToday}h</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kaikki tehtävät</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                    <Checkbox checked={task.done} onCheckedChange={() => toggleTask(task.id)} />
                    <span className={cn('flex-1', task.done && 'line-through text-gray-400')}>
                      {task.text}
                    </span>
                    {getPriorityBadge(task.priority)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
