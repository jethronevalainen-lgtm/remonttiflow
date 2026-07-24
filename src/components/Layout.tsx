import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardSignature,
  Clock,
  FolderKanban,
  Home,
  Loader2,
  MessageSquare,
} from 'lucide-react';

import Header from './Header';
import Navbar from './Navbar';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useOrganization } from '@/contexts/OrganizationContext';

const workerBottomItems = [
  { path: '/dashboard', label: 'Etusivu', icon: Home },
  { path: '/tyomaaraykset', label: 'Omat työt', icon: ClipboardCheck },
  { path: '/tuntikirjaukset', label: 'Tunnit', icon: Clock },
  { path: '/kuittaukset', label: 'Kuittaukset', icon: ClipboardSignature },
  { path: '/viestinta', label: 'Viestit', icon: MessageSquare },
];

const managementBottomItems = [
  { path: '/dashboard', label: 'Etusivu', icon: Home },
  { path: '/projektit', label: 'Projektit', icon: FolderKanban },
  { path: '/tyomaaraykset', label: 'Työt', icon: ClipboardCheck },
  { path: '/tuntikirjaukset', label: 'Tunnit', icon: Clock },
  { path: '/viestinta', label: 'Viestit', icon: MessageSquare },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole } = useOrganization();
  const { loading, refreshing, error, operationError, refresh } = useAppDataContext();
  const visibleError = operationError ?? error;
  const bottomItems = currentRole === 'worker' ? workerBottomItems : managementBottomItems;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <div className="hidden md:block">
        <Navbar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Sulje sivuvalikko"
            className="fixed inset-0 z-40 bg-black/55 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 z-50 h-full md:hidden">
            <Navbar collapsed={false} onToggle={() => setMobileOpen(false)} isMobile />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />

        {(loading || refreshing) && (
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            <Loader2 size={16} className="animate-spin" />
            {loading ? 'Ladataan käyttöoikeuksiesi tietoja…' : 'Päivitetään tietoja…'}
          </div>
        )}

        {visibleError && (
          <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            <AlertTriangle size={16} />
            <span className="flex-1">{visibleError}</span>
            <button
              type="button"
              className="rounded-md border border-red-300 px-2 py-1 font-medium hover:bg-red-100"
              onClick={() => void refresh()}
            >
              Yritä uudelleen
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-17 items-center justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
          {bottomItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors ${active ? 'bg-orange-50 text-orange-600' : 'text-slate-500'}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
