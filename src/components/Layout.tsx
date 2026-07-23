import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import Header from './Header';
import { useState } from 'react';
import { Home, Wrench, Clock, MessageSquare, User } from 'lucide-react';

const bottomNavItems = [
  { path: '/dashboard', label: 'Etusivu', icon: Home },
  { path: '/tyomaaraykset', label: 'Määräykset', icon: Wrench },
  { path: '/tuntikirjaukset', label: 'Tunnit', icon: Clock },
  { path: '/viestinta', label: 'Viestit', icon: MessageSquare },
  { path: '/dashboard', label: 'Profiili', icon: User },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <div className="hidden md:block">
        <Navbar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 h-full z-50 md:hidden">
            <Navbar collapsed={false} onToggle={() => setMobileOpen(false)} isMobile />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-30 flex items-center justify-around px-2">
          {bottomNavItems.map(item => (
            <a key={item.label} href={`#${item.path}`}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${location.pathname === item.path ? 'text-orange-500' : 'text-gray-500'}`}>
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
