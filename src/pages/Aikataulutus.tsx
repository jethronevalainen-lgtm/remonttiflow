import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  GanttChart,
  List,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkPhase {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed';
  responsible: string;
  completion: number;
  dependencies: string[];
}

interface Milestone {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  date: string;
  type: 'inspection' | 'delivery' | 'completion' | 'payment';
  completed: boolean;
}

const workPhases: WorkPhase[] = [
  {
    id: '1',
    name: 'Purkutyöt',
    projectId: '1',
    projectName: 'Rivitalo A',
    startDate: '2026-01-05',
    endDate: '2026-01-10',
    status: 'completed',
    responsible: 'Timo K.',
    completion: 100,
    dependencies: []
  },
  {
    id: '2',
    name: 'Putkityöt',
    projectId: '1',
    projectName: 'Rivitalo A',
    startDate: '2026-01-11',
    endDate: '2026-01-18',
    status: 'delayed',
    responsible: 'Mika M.',
    completion: 60,
    dependencies: ['1']
  },
  {
    id: '3',
    name: 'Sähkötyöt',
    projectId: '1',
    projectName: 'Rivitalo A',
    startDate: '2026-01-15',
    endDate: '2026-01-22',
    status: 'in_progress',
    responsible: 'SähköM Oy',
    completion: 30,
    dependencies: ['1']
  },
  {
    id: '4',
    name: 'Vesieristys',
    projectId: '1',
    projectName: 'Rivitalo A',
    startDate: '2026-01-19',
    endDate: '2026-01-24',
    status: 'planned',
    responsible: 'Laura K.',
    completion: 0,
    dependencies: ['2']
  },
  {
    id: '5',
    name: 'Laatoitus',
    projectId: '1',
    projectName: 'Rivitalo A',
    startDate: '2026-01-25',
    endDate: '2026-02-05',
    status: 'planned',
    responsible: 'Jussi P.',
    completion: 0,
    dependencies: ['3', '4']
  }
];

const milestones: Milestone[] = [
  {
    id: '1',
    name: 'Putkityön tarkastus',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-18',
    type: 'inspection',
    completed: false
  },
  {
    id: '2',
    name: 'Sähkötyön välitarkastus',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-19',
    type: 'inspection',
    completed: false
  },
  {
    id: '3',
    name: 'Välitoimitus - materiaalit',
    projectId: '1',
    projectName: 'Rivitalo A',
    date: '2026-01-20',
    type: 'delivery',
    completed: false
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'planned':
      return <Badge className="bg-gray-100 text-gray-800">Suunniteltu</Badge>;
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-800">Käynnissä</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800">Valmis</Badge>;
    case 'delayed':
      return <Badge className="bg-red-100 text-red-800">Viivästynyt</Badge>;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'planned': return 'bg-gray-200';
    case 'in_progress': return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    case 'delayed': return 'bg-red-500';
    default: return 'bg-gray-200';
  }
};

const getMilestoneIcon = (type: string) => {
  switch (type) {
    case 'inspection': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'delivery': return <ArrowRight className="w-4 h-4 text-blue-500" />;
    case 'completion': return <Calendar className="w-4 h-4 text-green-500" />;
    case 'payment': return <Clock className="w-4 h-4 text-purple-500" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

export default function Aikataulutus() {
  const [selectedProject, setSelectedProject] = useState('all');
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [currentWeek, setCurrentWeek] = useState(3); // Week 3 of 2026

  const filteredPhases = selectedProject === 'all'
    ? workPhases
    : workPhases.filter(p => p.projectId === selectedProject);

  const filteredMilestones = selectedProject === 'all'
    ? milestones
    : milestones.filter(m => m.projectId === selectedProject);

  // Calculate week dates
  const getWeekDates = (weekNum: number) => {
    const start = new Date(2026, 0, (weekNum - 1) * 7 + 1);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeek);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aikataulutus</h1>
          <p className="text-gray-500 mt-1">Projektien aikataulut ja työvaiheet</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Suodata
          </Button>
          <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Uusi työvaihe
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Aktiiviset projektit', value: '5', icon: GanttChart, color: 'text-blue-600' },
          { label: 'Viikon työvaiheet', value: '12', icon: Calendar, color: 'text-green-600' },
          { label: 'Viivästyneet', value: '2', icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Tämän viikon kilometrit', value: '0 €', icon: Clock, color: 'text-purple-600' },
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

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Aikajana</TabsTrigger>
          <TabsTrigger value="phases">Työvaiheet</TabsTrigger>
          <TabsTrigger value="milestones">Virstanpylväät</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <h3 className="font-semibold">Viikko {currentWeek}, 2026</h3>
              <p className="text-sm text-gray-500">
                {weekDates[0].toLocaleDateString('fi-FI')} - {weekDates[6].toLocaleDateString('fi-FI')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-8 border-b">
                <div className="p-3 border-r font-semibold text-sm">Työvaihe</div>
                {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'].map((day, i) => (
                  <div key={day} className="p-3 text-center font-semibold text-sm border-r last:border-r-0">
                    <div>{day}</div>
                    <div className="text-xs text-gray-500">{weekDates[i].getDate()}</div>
                  </div>
                ))}
              </div>
              {filteredPhases.map((phase) => (
                <div key={phase.id} className="grid grid-cols-8 border-b last:border-b-0">
                  <div className="p-3 border-r text-sm">
                    <div className="font-medium truncate">{phase.name}</div>
                    <div className="text-xs text-gray-500">{phase.responsible}</div>
                  </div>
                  {weekDates.map((date, i) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isActive = dateStr >= phase.startDate && dateStr <= phase.endDate;
                    return (
                      <div
                        key={i}
                        className={`p-3 border-r last:border-r-0 ${
                          isActive ? getStatusColor(phase.status) + ' opacity-60' : ''
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phases Tab */}
        <TabsContent value="phases" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'gantt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('gantt')}
              >
                <GanttChart className="w-4 h-4 mr-1" />
                Gantt
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4 mr-1" />
                Lista
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPhases.map((phase) => (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{phase.name}</h3>
                          {getStatusBadge(phase.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(phase.startDate).toLocaleDateString('fi-FI')} - {new Date(phase.endDate).toLocaleDateString('fi-FI')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {phase.responsible}
                          </span>
                          <span>{phase.completion}% valmis</span>
                        </div>
                      </div>
                      <div className="w-32">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getStatusColor(phase.status)}`}
                            style={{ width: `${phase.completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {phase.dependencies.length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        Riippuvuudet: {phase.dependencies.join(', ')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="space-y-4">
          <div className="space-y-3">
            {filteredMilestones.map((milestone) => (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={milestone.completed ? 'border-green-300 bg-green-50/30' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${milestone.completed ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {getMilestoneIcon(milestone.type)}
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${milestone.completed ? 'text-green-800' : 'text-gray-900'}`}>
                          {milestone.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {milestone.projectName} • {new Date(milestone.date).toLocaleDateString('fi-FI')}
                        </p>
                      </div>
                      {milestone.completed ? (
                        <Badge className="bg-green-100 text-green-800">Suoritettu</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Odottaa</Badge>
                      )}
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
