import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, HardHat, FolderKanban, ClipboardCheck, CalendarClock,
  Clock, Car, ShieldCheck, Users, MessageSquare, Wrench, UserCircle,
  FileText, BarChart3, ChevronDown, ChevronLeft, Sparkles, X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/config/brand';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { UserRole } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  roles?: UserRole[];
}

const mainItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Työnjohto', icon: HardHat, path: '/tyonjohto', roles: ['admin', 'supervisor'] },
];

const projectItems: NavItem[] = [
  { label: 'Projektit', icon: FolderKanban, path: '/projektit', roles: ['admin', 'supervisor'] },
  { label: 'Aikataulutus', icon: CalendarClock, path: '/aikataulutus', roles: ['admin', 'supervisor'] },
  { label: 'Päiväkirjat', icon: FileText, path: '/paivakirjat', roles: ['admin', 'supervisor'] },
  { label: 'Laskenta', icon: BarChart3, path: '/laskenta', roles: ['admin', 'supervisor'] },
  { label: 'Määrälaskenta', icon: Wrench, path: '/maaralaskenta', roles: ['admin', 'supervisor'] },
  { label: 'Jätehuolto', icon: ShieldCheck, path: '/jatehuolto', roles: ['admin', 'supervisor'] },
];

const mgmtItems: NavItem[] = [
  { label: 'Työmääräykset', icon: ClipboardCheck, path: '/tyomaaraykset' },
  { label: 'Työvuorokal.', icon: CalendarClock, path: '/tyovuorokalenteri', roles: ['admin', 'supervisor'] },
  { label: 'Tuntikirjaukset', icon: Clock, path: '/tuntikirjaukset' },
  { label: 'Matkakulut', icon: Car, path: '/matkakulut' },
  { label: 'Työturvallisuus', icon: ShieldCheck, path: '/tyoturvallisuus', roles: ['admin', 'supervisor'] },
];

const customerItems: NavItem[] = [
  { label: 'CRM', icon: MessageSquare, path: '/crm', roles: ['admin', 'supervisor'] },
  { label: 'Asiakkaat', icon: Users, path: '/asiakkaat', roles: ['admin', 'supervisor'] },
];

const toolItems: NavItem[] = [
  { label: 'AI', icon: Sparkles, path: '/ai', roles: ['admin', 'supervisor'] },
  { label: 'Viestintä', icon: MessageSquare, path: '/viestinta' },
  { label: 'Kalusto', icon: Wrench, path: '/kalusto', roles: ['admin', 'supervisor'] },
  { label: 'Henkilöstö', icon: UserCircle, path: '/henkilosto', roles: ['admin', 'supervisor'] },
  { label: 'Lomakkeet', icon: FileText, path: '/lomakkeet', roles: ['admin', 'supervisor'] },
  { label: 'Raportit', icon: BarChart3, path: '/raportit', roles: ['admin', 'supervisor'] },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface NavbarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

export default function Navbar({ collapsed, onToggle, isMobile }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentRole } = useOrganization();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    projektit: true, hallinta: true, asiakkaat: false, tyokalut: false,
  });

  if (!user) return null;
  // No org role resolved yet → worker-minimal: only unguarded routes.
  const effectiveRole: UserRole = currentRole ?? 'worker';
  const canSee = (item: NavItem) => !item.roles || item.roles.includes(effectiveRole);

  const displayName = profile?.full_name ?? user.email ?? '';

  const toggle = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  const NavButton = ({ item }: { item: NavItem }) => {
    const active = location.pathname === item.path;
    return (
      <button
        onClick={() => { navigate(item.path); if (isMobile) onToggle(); }}
        className={cn(
          'w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-all duration-200 relative group',
          active
            ? 'bg-orange-500/15 text-orange-500 shadow-sm'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
        )}
      >
        <item.icon size={20} className={cn('flex-shrink-0', active && 'text-orange-500')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700 transition-opacity">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  const Section = ({ title, items, sectionKey }: { title: string; items: NavItem[]; sectionKey: string }) => {
    const visible = items.filter(canSee);
    if (visible.length === 0) return null;
    const isOpen = openSections[sectionKey] ?? true;
    return (
      <div className="mb-1">
        {!collapsed && (
          <button onClick={() => toggle(sectionKey)} className="flex items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors w-full">
            <span className="flex-1 text-left">{title}</span>
            <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={12} />
            </motion.span>
          </button>
        )}
        <AnimatePresence>
          {(isOpen || collapsed) && (
            <motion.div initial={collapsed ? {} : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-0.5">
              {visible.map(item => <NavButton key={item.path} item={item} />)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.aside
      className={cn('flex flex-col h-screen bg-[#0F172A] border-r border-slate-700/50 flex-shrink-0', isMobile && 'w-[260px]')}
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center h-14 px-3 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
            <span className="text-white font-bold text-sm">{BRAND.shortName}</span>
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white font-bold text-base tracking-tight">
              {BRAND.name}
            </motion.span>
          )}
        </div>
        {!isMobile && (
          <button onClick={onToggle} className="hidden md:flex w-7 h-7 items-center justify-center rounded-md hover:bg-slate-700 text-slate-400 transition-colors">
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft size={16} />
            </motion.span>
          </button>
        )}
        {isMobile && (
          <button onClick={onToggle} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1 scrollbar-thin">
        {mainItems.filter(canSee).map(item => <NavButton key={item.path} item={item} />)}
        <div className="my-2 border-t border-slate-700/30" />
        <Section title="Projektit" items={projectItems} sectionKey="projektit" />
        <div className="my-1 border-t border-slate-700/30" />
        <Section title="Hallinta" items={mgmtItems} sectionKey="hallinta" />
        <div className="my-1 border-t border-slate-700/30" />
        <Section title="Asiakkaat" items={customerItems} sectionKey="asiakkaat" />
        <div className="my-1 border-t border-slate-700/30" />
        <Section title="Työkalut" items={toolItems} sectionKey="tyokalut" />
      </nav>

      <div className="flex-shrink-0 border-t border-slate-700/50 p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-sm font-bold">{initialsOf(displayName)}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400">{ROLE_LABELS[effectiveRole]}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
