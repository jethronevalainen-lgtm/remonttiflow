import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ─── Mock Data ─── */
const phases = [
  { id: 1, project: 'Tampere, Hatanpää', phase: 'Perustukset', start: 0, duration: 4, color: '#3B82F6' },
  { id: 2, project: 'Tampere, Hatanpää', phase: 'Runko', start: 4, duration: 8, color: '#F97316' },
  { id: 3, project: 'Tampere, Hatanpää', phase: 'Katto', start: 12, duration: 3, color: '#22C55E' },
  { id: 4, project: 'Tampere, Hatanpää', phase: 'LVI', start: 14, duration: 6, color: '#8B5CF6' },
  { id: 5, project: 'Tampere, Hatanpää', phase: 'Sähkö', start: 14, duration: 5, color: '#EC4899' },
  { id: 6, project: 'Tampere, Hatanpää', phase: 'Viimeistely', start: 19, duration: 4, color: '#F59E0B' },

  { id: 7, project: 'Espoo, Suurpelto', phase: 'Perustukset', start: 2, duration: 5, color: '#3B82F6' },
  { id: 8, project: 'Espoo, Suurpelto', phase: 'Runko', start: 7, duration: 10, color: '#F97316' },
  { id: 9, project: 'Espoo, Suurpelto', phase: 'LVI', start: 16, duration: 6, color: '#8B5CF6' },
  { id: 10, project: 'Espoo, Suurpelto', phase: 'Sähkö', start: 17, duration: 5, color: '#EC4899' },
  { id: 11, project: 'Espoo, Suurpelto', phase: 'Viimeistely', start: 21, duration: 5, color: '#F59E0B' },

  { id: 12, project: 'Helsinki, Kruununhaka', phase: 'Perustukset', start: 4, duration: 4, color: '#3B82F6' },
  { id: 13, project: 'Helsinki, Kruununhaka', phase: 'Runko', start: 8, duration: 7, color: '#F97316' },
  { id: 14, project: 'Helsinki, Kruununhaka', phase: 'LVI', start: 15, duration: 5, color: '#8B5CF6' },
  { id: 15, project: 'Helsinki, Kruununhaka', phase: 'Sähkö', start: 15, duration: 4, color: '#EC4899' },
  { id: 16, project: 'Helsinki, Kruununhaka', phase: 'Viimeistely', start: 19, duration: 6, color: '#F59E0B' },

  { id: 17, project: 'Vantaa, Tikkurila', phase: 'Perustukset', start: 6, duration: 4, color: '#3B82F6' },
  { id: 18, project: 'Vantaa, Tikkurila', phase: 'Runko', start: 10, duration: 8, color: '#F97316' },
  { id: 19, project: 'Vantaa, Tikkurila', phase: 'LVI', start: 17, duration: 5, color: '#8B5CF6' },
  { id: 20, project: 'Vantaa, Tikkurila', phase: 'Viimeistely', start: 21, duration: 4, color: '#F59E0B' },
];

const projects = ['Tampere, Hatanpää', 'Espoo, Suurpelto', 'Helsinki, Kruununhaka', 'Vantaa, Tikkurila'];

const monthLabels = [
  'Tammi 2025', 'Helmi 2025', 'Maalis 2025', 'Huhti 2025', 'Touko 2025', 'Kesä 2025',
  'Heinä 2025', 'Elo 2025', 'Syys 2025', 'Loka 2025', 'Marras 2025', 'Joulu 2025',
  'Tammi 2026', 'Helmi 2026', 'Maalis 2026', 'Huhti 2026', 'Touko 2026', 'Kesä 2026',
];

const legendItems = [
  { label: 'Suunnittelu', color: '#3B82F6' },
  { label: 'Rakennus', color: '#F97316' },
  { label: 'LVI', color: '#8B5CF6' },
  { label: 'Sähkö', color: '#EC4899' },
  { label: 'Viimeistely', color: '#F59E0B' },
];

/* ─── Component ─── */
export default function Aikataulutus() {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const colCount = viewMode === 'month' ? 18 : 18 * 4;
  const colWidth = viewMode === 'month' ? 80 : 30;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-body-sm text-text-secondary mb-1">
            <span>Dashboard</span>
            <ChevronRight size={14} />
            <span>Projektit</span>
            <ChevronRight size={14} />
            <span className="text-text-primary font-medium">Aikataulutus</span>
          </div>
          <h1 className="text-hero text-text-primary">Aikataulutus</h1>
          <p className="text-body-sm text-text-secondary mt-1">Projektien aikataulun Gantt-kaavionäkymä</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-bg-light rounded-lg border border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                viewMode === 'month' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Kuukausi
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                viewMode === 'week' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Viikko
            </button>
          </div>
          <Button variant="outline" size="sm" className="gap-1">
            <CalendarDays size={14} /> Tänään
          </Button>
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
            <Plus size={16} /> Uusi vaihe
          </Button>
        </div>
      </div>

      {/* ── Gantt Chart ── */}
      <Card className="border border-[#E2E8F0] shadow-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 200 + colCount * colWidth }}>
              {/* Timeline Header */}
              <div className="flex border-b border-[#E2E8F0]">
                {/* Sticky project column header */}
                <div className="w-[200px] flex-shrink-0 p-4 bg-bg-light border-r border-[#E2E8F0] font-semibold text-sm text-text-primary sticky left-0 z-10">
                  Projektit / Vaiheet
                </div>
                {/* Time columns */}
                <div className="flex">
                  {viewMode === 'month' ? (
                    monthLabels.map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-shrink-0 border-r border-[#F1F5F9] px-2 py-4 text-center text-caption text-text-muted font-medium uppercase tracking-wider',
                          i % 2 === 0 ? 'bg-bg-light' : 'bg-white'
                        )}
                        style={{ width: colWidth }}
                      >
                        {m}
                      </div>
                    ))
                  ) : (
                    Array.from({ length: colCount }, (_, i) => {
                      const monthIdx = Math.floor(i / 4);
                      const weekInMonth = (i % 4) + 1;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex-shrink-0 border-r border-[#F1F5F9] px-1 py-4 text-center text-[10px] text-text-muted font-medium',
                            i % 2 === 0 ? 'bg-bg-light' : 'bg-white'
                          )}
                          style={{ width: colWidth }}
                        >
                          <div className="text-[9px] text-text-muted uppercase">{monthLabels[monthIdx]?.split(' ')[0]}</div>
                          <div>v{weekInMonth}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Project rows */}
              {projects.map((project, pi) => {
                const projectPhases = phases.filter(p => p.project === project);
                return (
                  <motion.div
                    key={project}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: pi * 0.08, duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                    className="flex border-b border-[#F1F5F9]"
                  >
                    {/* Project name cell */}
                    <div className="w-[200px] flex-shrink-0 p-4 bg-bg-light border-r border-[#E2E8F0] sticky left-0 z-10">
                      <p className="text-sm font-semibold text-text-primary truncate">{project}</p>
                      <p className="text-caption text-text-muted mt-0.5">{projectPhases.length} vaihetta</p>
                    </div>
                    {/* Gantt bars area */}
                    <div className="relative flex" style={{ height: 60 + projectPhases.length * 32 }}>
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: colCount }, (_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex-shrink-0 border-r border-[#F1F5F9]',
                              i % 2 === 0 ? 'bg-transparent' : 'bg-[#FAFBFC]'
                            )}
                            style={{ width: colWidth }}
                          />
                        ))}
                      </div>
                      {/* Phase bars */}
                      <svg className="absolute inset-0" style={{ width: colCount * colWidth, height: 60 + projectPhases.length * 32 }}>
                        {/* Today line */}
                        <line
                          x1={6 * colWidth}
                          y1={0}
                          x2={6 * colWidth}
                          y2={60 + projectPhases.length * 32}
                          stroke="#EF4444"
                          strokeWidth={1}
                          strokeDasharray="4 4"
                        />
                        {projectPhases.map((phase, fi) => {
                          const unitWidth = viewMode === 'month' ? colWidth : colWidth;
                          const x = phase.start * unitWidth + 4;
                          const w = phase.duration * unitWidth - 8;
                          const y = 16 + fi * 32;
                          return (
                            <g key={phase.id}>
                              {/* Dependency line to next phase */}
                              {fi < projectPhases.length - 1 && (
                                <line
                                  x1={x + w}
                                  y1={y + 12}
                                  x2={projectPhases[fi + 1].start * unitWidth + 4}
                                  y2={16 + (fi + 1) * 32 + 12}
                                  stroke="#94A3B8"
                                  strokeWidth={1}
                                  strokeDasharray="3 3"
                                  markerEnd="url(#arrowhead)"
                                />
                              )}
                              {/* Bar */}
                              <motion.rect
                                initial={{ width: 0 }}
                                animate={{ width: w }}
                                transition={{ delay: pi * 0.08 + fi * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                                x={x}
                                y={y}
                                height={24}
                                rx={6}
                                fill={phase.color}
                                opacity={0.9}
                              />
                              {/* Phase label */}
                              {w > 50 && (
                                <text
                                  x={x + w / 2}
                                  y={y + 16}
                                  textAnchor="middle"
                                  fill="white"
                                  fontSize={10}
                                  fontWeight={600}
                                >
                                  {phase.phase}
                                </text>
                              )}
                            </g>
                          );
                        })}
                        {/* Arrow marker definition */}
                        <defs>
                          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="#94A3B8" />
                          </marker>
                        </defs>
                      </svg>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 py-3 border-t border-[#E2E8F0] bg-bg-light flex-wrap">
            <span className="text-caption text-text-muted uppercase tracking-wider font-semibold">Selite:</span>
            {legendItems.map(item => (
              <span key={item.label} className="flex items-center gap-1.5 text-body-sm text-text-secondary">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-body-sm text-text-secondary ml-4">
              <span className="w-px h-4 border-l border-dashed border-danger" /> Tänään
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-[#E2E8F0] shadow-card">
          <CardContent className="p-4">
            <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Aikataulussa</p>
            <p className="text-h1 text-success">3 / 4</p>
            <p className="text-body-sm text-text-secondary">projektia aikataulussa</p>
          </CardContent>
        </Card>
        <Card className="border border-[#E2E8F0] shadow-card">
          <CardContent className="p-4">
            <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Kokonaiskesto</p>
            <p className="text-h1 text-primary">18 kk</p>
            <p className="text-body-sm text-text-secondary">Tammi 2025 – Kesä 2026</p>
          </CardContent>
        </Card>
        <Card className="border border-[#E2E8F0] shadow-card">
          <CardContent className="p-4">
            <p className="text-caption text-text-muted uppercase tracking-wider mb-1">Aktiivisia vaiheita</p>
            <p className="text-h1 text-info">{phases.length}</p>
            <p className="text-body-sm text-text-secondary">kaikissa projekteissa</p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
