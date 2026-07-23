import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  ClipboardList,
  Clock,
  Wrench,
  Calculator,
  FileText,
  Shield,
  MessageSquare,
  BarChart3,
  Calendar,
  BookOpen,
  Car,
  Trash2,
  HardHat,
  GraduationCap,
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Yleisnäkymä', icon: LayoutDashboard },
  { to: '/projektit', label: 'Projektit', icon: FolderOpen },
  { to: '/asiakkaat', label: 'Asiakkaat', icon: Users },
  { to: '/crm', label: 'CRM & Myynti', icon: GraduationCap },
  { to: '/henkilosto', label: 'Henkilöstö', icon: Users },
  { to: '/tyomaaraykset', label: 'Työmääräykset', icon: ClipboardList },
  { to: '/tuntikirjaukset', label: 'Tuntikirjaukset', icon: Clock },
  { to: '/tyovuorokalenteri', label: 'Työvuorokalenteri', icon: Calendar },
  { to: '/kalusto', label: 'Kalusto', icon: Wrench },
  { to: '/laskenta', label: 'Laskenta', icon: Calculator },
  { to: '/maaralaskenta', label: 'Määrälaskenta', icon: Calculator },
  { to: '/lomakkeet', label: 'Lomakkeet', icon: FileText },
  { to: '/tyoturvallisuus', label: 'Työturvallisuus', icon: Shield },
  { to: '/viestinta', label: 'Viestintä', icon: MessageSquare },
  { to: '/raportit', label: 'Raportit', icon: BarChart3 },
  { to: '/aikataulutus', label: 'Aikataulutus', icon: Calendar },
  { to: '/paivakirjat', label: 'Päiväkirjat', icon: BookOpen },
  { to: '/matkakulut', label: 'Matkakulut', icon: Car },
  { to: '/jatehuolto', label: 'Jätehuolto', icon: Trash2 },
  { to: '/tyonjohto', label: 'Työnjohto', icon: HardHat },
  { to: '/ai', label: 'Tekoäly', icon: Sparkles },
];

export default function Navbar({ isOpen, onClose }: NavbarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.nav
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-200 ease-in-out
          lg:transform-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col h-[calc(100vh-60px)] lg:h-auto
        `}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="font-semibold">Valikko</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </motion.nav>
    </>
  );
}
