import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeEuro,
  BarChart3,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  ClipboardSignature,
  Clock,
  DatabaseBackup,
  Eye,
  FileQuestion,
  FileText,
  FolderKanban,
  Gauge,
  HardHat,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  QrCode,
  Recycle,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCircle,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

import { BRAND } from '@/config/brand';
import {
  ROLE_LABELS,
  ROLE_ROUTES,
  useAuth,
  type UserRole,
} from '@/contexts/AuthContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { cn } from '@/lib/utils';

interface NavItem { label: string; icon: LucideIcon; path: string; }
interface NavGroup { key: string; title: string; items: NavItem[]; }

const workerGroups: NavGroup[] = [
  {
    key: 'own-work', title: 'Oma työ', items: [
      { label: 'Oma työtila', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Minun työni', icon: ClipboardCheck, path: '/tyomaaraykset' },
      { label: 'Tuntikirjaukset', icon: Clock, path: '/tuntikirjaukset' },
      { label: 'Kaikki kirjaukset', icon: ClipboardList, path: '/kirjaukset' },
      { label: 'Matkakulut', icon: Car, path: '/matkakulut' },
      { label: 'Omat henkilöstö- ja palkkatiedot', icon: UserCircle, path: '/henkilokortit' },
    ],
  },
  {
    key: 'site-tools', title: 'Työmaan työkalut', items: [
      { label: 'Turvallisuushavainnot', icon: ShieldCheck, path: '/tyoturvallisuus' },
      { label: 'Korjattavat puutteet', icon: ClipboardList, path: '/tarkastukset' },
      { label: 'Projektikeskustelut', icon: MessageCircle, path: '/projektikeskustelut' },
      { label: 'Kuittaukset', icon: ClipboardSignature, path: '/kuittaukset' },
      { label: 'Lomakkeet', icon: FileText, path: '/lomakkeet' },
      { label: 'Viestit', icon: MessageSquare, path: '/viestinta' },
    ],
  },
];

const customerGroups: NavGroup[] = [{
  key: 'customer-portal', title: 'Tilaajan työtila', items: [
    { label: 'Projektini', icon: FolderKanban, path: '/tilaajan-tyot' },
    { label: 'Projektikeskustelut', icon: MessageCircle, path: '/projektikeskustelut' },
    { label: 'Turvallisuushavainto', icon: ShieldCheck, path: '/tyoturvallisuus' },
  ],
}];

const managementGroups: NavGroup[] = [
  {
    key: 'overview', title: 'Tilannekuva', items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Työnjohto', icon: HardHat, path: '/tyonjohto' },
      { label: 'Raportit', icon: BarChart3, path: '/raportit' },
    ],
  },
  {
    key: 'work-control', title: 'Työn ohjaus', items: [
      { label: 'Työmääräykset', icon: ClipboardCheck, path: '/tyomaaraykset' },
      { label: 'Aikataulutus', icon: CalendarClock, path: '/aikataulutus' },
      { label: 'Työvuorot', icon: CalendarClock, path: '/tyovuorokalenteri' },
      { label: 'Tarkastukset ja luovutukset', icon: ClipboardList, path: '/tarkastukset' },
      { label: 'Päiväkirjat', icon: FileText, path: '/paivakirjat' },
      { label: 'Työturvallisuus', icon: ShieldCheck, path: '/tyoturvallisuus' },
      { label: 'Tilaukset', icon: ShoppingCart, path: '/tilaukset' },
      { label: 'Jätehuolto', icon: Recycle, path: '/jatehuolto' },
    ],
  },
  {
    key: 'projects', title: 'Projektit ja yhteistyö', items: [
      { label: 'Projektit ja tiimit', icon: FolderKanban, path: '/projektit' },
      { label: 'Projektikeskustelut', icon: MessageCircle, path: '/projektikeskustelut' },
      { label: 'Projektipyynnöt', icon: FileQuestion, path: '/projektipyynnot' },
      { label: 'QR-kirjautumisen hallinta', icon: QrCode, path: '/qr-hallinta' },
    ],
  },
  {
    key: 'people', title: 'Henkilöt ja kirjaukset', items: [
      { label: 'Henkilöstö', icon: UserCircle, path: '/henkilosto' },
      { label: 'Henkilökortit ja palkat', icon: ShieldCheck, path: '/henkilokortit' },
      { label: 'Tuntikirjaukset', icon: Clock, path: '/tuntikirjaukset' },
      { label: 'Kaikki kirjaukset', icon: ClipboardList, path: '/kirjaukset' },
      { label: 'Palkka-aineisto', icon: BadgeEuro, path: '/palkka-aineisto' },
      { label: 'Matkakulut', icon: Car, path: '/matkakulut' },
      { label: 'Viestintä', icon: MessageSquare, path: '/viestinta' },
    ],
  },
  {
    key: 'commercial', title: 'Asiakkaat ja talous', items: [
      { label: 'Asiakkaat', icon: Users, path: '/asiakkaat' },
      { label: 'CRM', icon: MessageSquare, path: '/crm' },
      { label: 'Tarjouslaskenta', icon: FileText, path: '/tarjoukset' },
      { label: 'Toiminnanohjaus', icon: Gauge, path: '/toiminnanohjaus' },
    ],
  },
  {
    key: 'tools', title: 'Työkalut', items: [
      { label: 'Kuittaukset', icon: ClipboardSignature, path: '/kuittaukset' },
      { label: 'Lomakkeet', icon: FileText, path: '/lomakkeet' },
      { label: 'Kalusto', icon: Wrench, path: '/kalusto' },
      { label: 'AI-työkalut', icon: Sparkles, path: '/ai' },
    ],
  },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface NavbarProps { collapsed: boolean; onToggle: () => void; isMobile?: boolean; }

export default function Navbar({ collapsed, onToggle, isMobile }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveRole, effectiveDisplayName, isImpersonating } = useViewAs();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    'work-control': true,
    projects: false,
    people: false,
    commercial: false,
    tools: false,
    'own-work': true,
    'site-tools': true,
    'customer-portal': true,
    admin: false,
  });

  if (!user || !effectiveRole) return null;
  const role: UserRole = effectiveRole;
  const allowedRoutes = new Set(ROLE_ROUTES[role]);
  const baseGroups = role === 'worker'
    ? workerGroups
    : role === 'customer'
      ? customerGroups
      : [
          ...managementGroups,
          ...(role === 'admin'
            ? [{
                key: 'admin',
                title: 'Admin',
                items: [
                  { label: 'Organisaation hallinta', icon: Settings, path: '/hallinta' },
                  { label: 'Varmuuskopiot', icon: DatabaseBackup, path: '/varmuuskopiot' },
                  { label: 'Toimi käyttäjänä', icon: Eye, path: '/kayttajaesikatselu' },
                ],
              }]
            : []),
        ];
  const groups = baseGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedRoutes.has(item.path)) }))
    .filter((group) => group.items.length > 0);
  const displayName = effectiveDisplayName || user.email || '';

  const goTo = (path: string) => {
    navigate(path);
    if (isMobile) onToggle();
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    return (
      <button
        type="button"
        onClick={() => goTo(item.path)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all',
          active ? 'bg-orange-500/15 text-orange-400 shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white',
        )}
      >
        <item.icon size={19} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <motion.aside
      className={cn('flex h-[100dvh] max-w-[88vw] flex-shrink-0 flex-col border-r border-slate-800 bg-slate-950', isMobile && 'w-[280px]')}
      animate={{ width: collapsed ? 64 : 270 }}
      transition={{ duration: 0.22 }}
    >
      <div className="flex h-14 flex-shrink-0 items-center border-b border-slate-800 px-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500 text-sm font-bold text-white shadow-lg shadow-orange-500/20">{BRAND.shortName}</div>
          {!collapsed && <span className="truncate font-bold tracking-tight text-white">{BRAND.name}</span>}
        </div>
        {isMobile ? (
          <button type="button" onClick={onToggle} aria-label="Sulje valikko" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"><X size={18} /></button>
        ) : (
          <button type="button" onClick={onToggle} aria-label={collapsed ? 'Laajenna valikko' : 'Pienennä valikko'} className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 md:flex">
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }}><ChevronLeft size={17} /></motion.span>
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
        {groups.map((group) => {
          const open = openGroups[group.key] ?? true;
          return (
            <div key={group.key}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenGroups((previous) => ({ ...previous, [group.key]: !open }))}
                  className="flex min-h-9 w-full items-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-300"
                >
                  <span className="flex-1 text-left">{group.title}</span>
                  <motion.span animate={{ rotate: open ? 0 : -90 }}><ChevronDown size={12} /></motion.span>
                </button>
              )}
              <AnimatePresence initial={false}>
                {(open || collapsed) && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-0.5 overflow-hidden"
                  >
                    {group.items.map((item) => <NavButton key={item.path} item={item} />)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-bold text-white">{initialsOf(displayName)}</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-[11px] text-slate-400">{isImpersonating ? `Käyttäjänä: ${ROLE_LABELS[role]}` : ROLE_LABELS[role]}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
