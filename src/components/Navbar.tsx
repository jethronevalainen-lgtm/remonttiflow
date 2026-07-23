import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  BookOpen,
  Calculator,
  Ruler,
  Recycle,
  ClipboardList,
  Clock,
  Timer,
  Route,
  ShieldCheck,
  Users,
  UserCircle,
  MessageSquare,
  Wrench,
  FileText,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

/* ─── Types ─── */
interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  children?: { label: string; path: string }[];
}

/* ─── Navigation items ─── */
const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Työnjohto',
    icon: FolderKanban,
    path: '/tyonjohto',
    children: [
      { label: 'Projektit', path: '/projektit' },
      { label: 'Aikataulutus', path: '/aikataulutus' },
      { label: 'Päiväkirjat', path: '/paivakirjat' },
    ],
  },
  { label: 'Laskenta', icon: Calculator, path: '/laskenta' },
  { label: 'Määrälaskenta', icon: Ruler, path: '/maaralaskenta' },
  { label: 'Jätehuolto', icon: Recycle, path: '/jatehuolto' },
  { label: 'Työmääräykset', icon: ClipboardList, path: '/tyomaaraykset' },
  { label: 'Työvuorokalenteri', icon: CalendarDays, path: '/tyovuorokalenteri' },
  { label: 'Tuntikirjaukset', icon: Clock, path: '/tuntikirjaukset' },
  { label: 'Matkakulut & Ajo', icon: Route, path: '/matkakulut' },
  { label: 'Työturvallisuus', icon: ShieldCheck, path: '/tyoturvallisuus' },
  { label: 'CRM', icon: Users, path: '/crm' },
  { label: 'Asiakkaat', icon: UserCircle, path: '/asiakkaat' },
  { label: 'AI', icon: BrainCircuit, path: '/ai' },
  { label: 'Viestintä', icon: MessageSquare, path: '/viestinta' },
  { label: 'Kalusto', icon: Wrench, path: '/kalusto' },
  { label: 'Henkilöstö', icon: BookOpen, path: '/henkilosto' },
  { label: 'Lomakkeet', icon: FileText, path: '/lomakkeet' },
  { label: 'Raportit', icon: BarChart3, path: '/raportit' },
];

export default function Navbar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#E2E8F0] shadow-sm"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className={`fixed lg:static top-0 left-0 h-screen bg-[#0F172A] flex flex-col z-50 flex-shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } transition-transform duration-300`}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-bold text-white tracking-tight"
              >
                RemonttiFlow
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedGroups[item.label];

            if (hasChildren) {
              return (
                <div key={item.path}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isExpanded
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <motion.span
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          className="text-white/50"
                        >
                          <ChevronRight size={14} />
                        </motion.span>
                      </>
                    )}
                  </button>
                  <AnimatePresence>
                    {isExpanded && !collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {item.children?.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 ml-6 rounded-lg text-sm transition-colors ${
                                isActive
                                  ? 'bg-primary/20 text-primary font-medium'
                                  : 'text-white/50 hover:text-white hover:bg-white/5'
                              }`
                            }
                          >
                            <span>{sub.label}</span>
                          </NavLink>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: Collapse toggle */}
        <div className="p-2 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Piilota valikko</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
