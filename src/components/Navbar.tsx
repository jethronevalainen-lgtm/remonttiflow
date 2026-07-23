import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  HardHat,
  FolderKanban,
  ClipboardCheck,
  CalendarClock,
  Clock,
  Car,
  ShieldCheck,
  Users,
  MessageSquare,
  Wrench,
  UserCircle,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* Types */
interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  path: string;
  children?: NavSubItem[];
}

interface NavSubItem {
  label: string;
  path: string;
}

/* Navigation Data */
const navSections: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Työnjohto', icon: HardHat, path: '/tyonjohto' },
    ],
  },
  {
    title: 'Projektit',
    items: [
      {
        label: 'Projektit',
        icon: FolderKanban,
        path: '/projektit',
        children: [
          { label: 'Projektit', path: '/projektit' },
          { label: 'Aikataulutus', path: '/aikataulutus' },
          { label: 'Päiväkirjat', path: '/paivakirjat' },
          { label: 'Laskenta', path: '/laskenta' },
          { label: 'Määrälaskenta', path: '/maaralaskenta' },
          { label: 'Jätehuolto', path: '/jatehuolto' },
        ],
      },
    ],
  },
  {
    title: 'Hallinta',
    items: [
      { label: 'Työmääräykset', icon: ClipboardCheck, path: '/tyomaaraykset' },
      { label: 'Työvuorokalenteri', icon: CalendarClock, path: '/tyovuorokalenteri' },
      { label: 'Tuntikirjaukset', icon: Clock, path: '/tuntikirjaukset' },
      { label: 'Matkakulut & Ajo', icon: Car, path: '/matkakulut' },
      { label: 'Työturvallisuus', icon: ShieldCheck, path: '/tyoturvallisuus' },
    ],
  },
  {
    title: 'Asiakkaat',
    items: [
      { label: 'CRM', icon: MessageSquare, path: '/crm' },
      { label: 'Asiakkaat', icon: Users, path: '/asiakkaat' },
    ],
  },
  {
    title: 'Työkalut',
    items: [
      { label: 'AI', icon: Sparkles, path: '/ai' },
      { label: 'Viestintä', icon: MessageSquare, path: '/viestinta' },
      { label: 'Kalusto', icon: Wrench, path: '/kalusto' },
      { label: 'Henkilöstö', icon: UserCircle, path: '/henkilosto' },
      { label: 'Lomakkeet', icon: FileText, path: '/lomakkeet' },
      { label: 'Raportit', icon: BarChart3, path: '/raportit' },
    ],
  },
];

/* Component */
interface NavbarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Navbar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Projektit: true,
  });

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = (path: string, hasChildren?: boolean, label?: string) => {
    if (hasChildren && label) {
      toggleMenu(label);
    } else {
      navigate(path);
      onMobileClose();
    }
  };

  /* Nav Content (shared between desktop and mobile) */
  const NavContent = () => (
    <>
      {/* Logo Area */}
      <div className="flex items-center h-14 px-3 border-b border-bg-dark-border flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">VK</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-text-on-dark font-semibold text-base whitespace-nowrap"
              >
                VaKantti
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={onMobileClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-dark-border text-text-on-dark-muted transition-colors"
        >
          <X size={18} />
        </button>
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-7 h-7 items-center justify-center rounded-md hover:bg-bg-dark-border text-text-muted transition-colors"
        >
          <motion.span
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronLeft size={16} />
          </motion.span>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="mb-4">
            {section.title && (
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2 mt-4"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
                      {section.title}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            {!collapsed && section.title && sIdx > 0 && (
              <div className="border-t border-bg-dark-border my-2" />
            )}

            {section.items.map(item => {
              const active = isActive(item.path);
              const hasChildren = !!item.children;
              const menuOpen = hasChildren && expandedMenus[item.label];

              return (
                <div key={item.path}>
                  <button
                    onClick={() => handleNavClick(item.path, hasChildren, item.label)}
                    className={cn(
                      'w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors duration-150 relative group',
                      active && !hasChildren
                        ? 'bg-primary-light text-primary border-l-[3px] border-primary'
                        : 'text-text-on-dark-muted hover:bg-bg-dark-border hover:text-text-on-dark border-l-[3px] border-transparent'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'flex-shrink-0',
                        active && !hasChildren ? 'text-primary' : 'text-text-muted group-hover:text-text-on-dark'
                      )}
                      size={20}
                    />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 text-left whitespace-nowrap overflow-hidden text-[13px]"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {hasChildren && !collapsed && (
                      <motion.span
                        animate={{ rotate: menuOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={14} className="text-text-muted" />
                      </motion.span>
                    )}

                    {collapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-bg-dark-elevated text-text-on-dark text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-bg-dark-border">
                        {item.label}
                      </div>
                    )}
                  </button>

                  <AnimatePresence>
                    {hasChildren && menuOpen && !collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 pl-4 border-l border-bg-dark-border mt-1 space-y-1">
                          {item.children?.map(sub => {
                            const subActive = isActive(sub.path);
                            return (
                              <button
                                key={sub.path}
                                onClick={() => { navigate(sub.path); onMobileClose(); }}
                                className={cn(
                                  'w-full flex items-center h-9 px-3 rounded-md text-[13px] transition-colors duration-150',
                                  subActive
                                    ? 'bg-primary-light text-primary'
                                    : 'text-text-on-dark-muted hover:bg-bg-dark-border hover:text-text-on-dark'
                                )}
                              >
                                {sub.label}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="flex-shrink-0 border-t border-bg-dark-border p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-primary-light border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">MM</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0"
              >
                <p className="text-sm font-medium text-text-on-dark truncate">Matti Meikäläinen</p>
                <p className="text-xs text-text-muted truncate">Työnjohtaja</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: Overlay Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              className="fixed top-0 left-0 h-screen w-[260px] bg-bg-dark-elevated border-r border-bg-dark-border flex flex-col z-50 md:hidden"
            >
              <NavContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop: Collapsible Sidebar */}
      <motion.aside
        className="hidden md:flex flex-col h-screen bg-bg-dark-elevated border-r border-bg-dark-border flex-shrink-0 overflow-hidden"
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        style={{ zIndex: 10 }}
      >
        <NavContent />
      </motion.aside>
    </>
  );
}
