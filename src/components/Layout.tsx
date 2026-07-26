import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  FolderKanban,
  Home,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';

import Header from './Header';
import Navbar from './Navbar';
import { ROLE_LABELS } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import { useViewAs } from '@/contexts/ViewAsContext';

const workerBottomItems = [
  { path: '/dashboard', label: 'Etusivu', icon: Home },
  { path: '/tyomaaraykset', label: 'Omat työt', icon: ClipboardCheck },
  { path: '/tuntikirjaukset', label: 'Tunnit', icon: Clock },
  { path: '/tarkastukset', label: 'Korjaukset', icon: ClipboardList },
  { path: '/viestinta', label: 'Viestit', icon: MessageSquare },
];

const managementBottomItems = [
  { path: '/dashboard', label: 'Etusivu', icon: Home },
  { path: '/projektit', label: 'Projektit', icon: FolderKanban },
  { path: '/tarkastukset', label: 'Tarkastukset', icon: ClipboardList },
  { path: '/tyomaaraykset', label: 'Työt', icon: ClipboardCheck },
  { path: '/viestinta', label: 'Viestit', icon: MessageSquare },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { effectiveRole, isPreviewing, previewTarget, stopPreview } = useViewAs();
  const { loading, refreshing, error, operationError, refresh } = useAppDataContext();
  const visibleError = operationError ?? error;
  const bottomItems = effectiveRole === 'worker' ? workerBottomItems : managementBottomItems;

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-slate-50">
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
          <div className="fixed left-0 top-0 z-50 h-full max-w-[88vw] md:hidden">
            <Navbar collapsed={false} onToggle={() => setMobileOpen(false)} isMobile />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />

        {isPreviewing && previewTarget && (
          <div className="flex flex-col gap-2 border-b border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950 sm:flex-row sm:items-center sm:px-4">
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
              <Eye size={17} className="mt-0.5 flex-shrink-0 text-indigo-700 sm:mt-0" />
              <p className="min-w-0 leading-5">
                <span className="font-semibold">Esikatselutila:</span>{' '}
                <span className="font-medium">{previewTarget.displayName || previewTarget.email}</span>{' '}
                <span className="text-indigo-700">({ROLE_LABELS[previewTarget.role]})</span>.
                <span className="hidden sm:inline"> Tallennukset on estetty sovelluksen yhteisessä tietokerroksessa.</span>
              </p>
            </div>
            <button
              type="button"
              onClick={stopPreview}
              className="flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 font-semibold text-indigo-800 transition-colors hover:bg-indigo-100"
            >
              <X size={16} /> Lopeta esikatselu
            </button>
          </div>
        )}

        {(loading || refreshing) && (
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            <Loader2 size={16} className="animate-spin" />
            {loading ? 'Ladataan käyttöoikeuksiesi tietoja…' : 'Päivitetään tietoja…'}
          </div>
        )}

        {visibleError && (
          <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            <AlertTriangle size={16} />
            <span className="min-w-0 flex-1">{visibleError}</span>
            <button
              type="button"
              className="min-h-9 rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
              onClick={() => void refresh()}
            >
              Yritä uudelleen
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-24 sm:px-4 sm:py-5 md:px-6 md:py-6 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              className="min-w-0 max-w-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex min-h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
          {bottomItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                onClick={() => navigate(item.path)}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors ${active ? 'bg-orange-50 text-orange-600' : 'text-slate-500'}`}
              >
                <item.icon size={20} />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
