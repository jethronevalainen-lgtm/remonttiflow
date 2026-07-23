import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Menu, ChevronDown, Check } from 'lucide-react';
import { useAuth, ROLE_LABELS, ROLE_COLORS } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';
import { BRAND } from '@/config/brand';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tyonjohto': 'Työnjohto',
  '/projektit': 'Projektit',
  '/aikataulutus': 'Aikataulutus',
  '/paivakirjat': 'Päiväkirjat',
  '/laskenta': 'Laskenta',
  '/maaralaskenta': 'Määrälaskenta',
  '/jatehuolto': 'Jätehuolto',
  '/tyomaaraykset': 'Työmääräykset',
  '/tyovuorokalenteri': 'Työvuorokalenteri',
  '/tuntikirjaukset': 'Tuntikirjaukset',
  '/matkakulut': 'Matkakulut',
  '/tyoturvallisuus': 'Työturvallisuus',
  '/crm': 'CRM',
  '/asiakkaat': 'Asiakkaat',
  '/ai': 'AI-työkalut',
  '/viestinta': 'Viestintä',
  '/kalusto': 'Kalusto',
  '/henkilosto': 'Henkilöstö',
  '/lomakkeet': 'Lomakkeet',
  '/raportit': 'Raportit',
};

const notifications = [
  { id: 1, text: 'Uusi työmääräys #1288', time: '2 min sitten', read: false },
  { id: 2, text: 'Putkityön tarkastus valmis', time: '15 min sitten', read: false },
  { id: 3, text: 'Matti M. kirjasi 8 tuntia', time: '1 tunti sitten', read: true },
];

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { user, login } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [notifs, setNotifs] = useState(notifications);

  const label = routeLabels[location.pathname] || BRAND.name;
  const unreadCount = notifs.filter(n => !n.read).length;
  const roles: UserRole[] = ['admin', 'supervisor', 'worker'];

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-20 relative">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 font-medium hidden sm:inline">{BRAND.name}</span>
          <span className="text-gray-300 hidden sm:inline">/</span>
          <span className="text-gray-900 font-semibold">{label}</span>
        </div>
      </div>

      <div className="hidden md:flex relative w-72">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Hae..." value={searchVal} onChange={e => setSearchVal(e.target.value)}
          className="w-full h-9 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setShowRoleMenu(!showRoleMenu)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <div className={`w-2.5 h-2.5 rounded-full ${user ? ROLE_COLORS[user.role] : 'bg-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user ? ROLE_LABELS[user.role] : 'Rooli'}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          <AnimatePresence>
            {showRoleMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vaihda roolia</p>
                  {roles.map(role => (
                    <button key={role} onClick={() => { login(role); setShowRoleMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                      <div className={`w-3 h-3 rounded-full ${ROLE_COLORS[role]}`} />
                      <p className="text-sm font-medium text-gray-800">{ROLE_LABELS[role]}</p>
                      {user?.role === role && <Check size={14} className="ml-auto text-orange-500" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)} className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                    <p className="font-semibold text-sm">Ilmoitukset</p>
                    {unreadCount > 0 && <button onClick={() => setNotifs(p => p.map(n => ({ ...n, read: true })))} className="text-xs text-orange-500 hover:text-orange-600">Merkkaa luetuiksi</button>}
                  </div>
                  {notifs.map(n => (
                    <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-orange-50/50' : ''}`}>
                      <p className={`text-sm ${!n.read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{n.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
          <span className="text-white text-sm font-bold">{user?.initials || '?'}</span>
        </div>
      </div>
    </header>
  );
}
