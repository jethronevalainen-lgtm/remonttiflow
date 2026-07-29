import { Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  FolderKanban,
  Home,
  Loader2,
  Menu,
  MessageCircle,
  Megaphone,
  RotateCcw,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';

import Header from './Header';
import Navbar from './Navbar';
import ContextAnnouncementSection from './announcements/ContextAnnouncementSection';
import GlobalAnnouncementBanner from './announcements/GlobalAnnouncementBanner';
import { ROLE_LABELS, homeForRole } from '@/contexts/AuthContext';
import { useAppDataContext } from '@/contexts/AppDataContext';
import {
  CURRENT_ORG_STORAGE_KEY,
  useOrganization,
} from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  isDemoOrganizationBusinessId,
  listDemoAccounts,
  readDemoSourceOrganization,
  type DemoAccountSummary,
} from '@/lib/supabase/demoEnvironment';

interface BottomItem {
  path?: string;
  label: string;
  icon: LucideIcon;
  menu?: boolean;
}

const workerBottomItems: BottomItem[] = [
  { path: '/dashboard', label: 'Tänään', icon: Home },
  { path: '/tyomaaraykset', label: 'Työni', icon: ClipboardCheck },
  { path: '/tuntikirjaukset', label: 'Työaika', icon: Clock },
  { path: '/tarkastukset', label: 'Puutteet', icon: ClipboardList },
  { label: 'Lisää', icon: Menu, menu: true },
];

const customerBottomItems: BottomItem[] = [
  { path: '/tilaajan-tyot', label: 'Yhteenveto', icon: Home },
  { path: '/projektikeskustelut', label: 'Viestit', icon: MessageCircle },
  { path: '/viestinta', label: 'Tiedotteet', icon: Megaphone },
  { label: 'Lisää', icon: Menu, menu: true },
];

const managementBottomItems: BottomItem[] = [
  { path: '/dashboard', label: 'Tänään', icon: Home },
  { path: '/projektit', label: 'Projektit', icon: FolderKanban },
  { path: '/tyomaaraykset', label: 'Työt', icon: ClipboardCheck },
  { path: '/aikataulutus', label: 'Aikataulu', icon: CalendarClock },
  { label: 'Lisää', icon: Menu, menu: true },
];

function RouteLoadingState() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-3 text-sm font-medium text-slate-600"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={20} className="animate-spin text-primary" />
      Ladataan osiota…
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountSummary[]>([]);
  const [roleSwitchingUserId, setRoleSwitchingUserId] = useState<string | null>(null);
  const [roleSwitchError, setRoleSwitchError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    organizations,
    currentOrg,
  } = useOrganization();
  const {
    effectiveRole,
    isImpersonating,
    previewTarget,
    startPreview,
    switchPreview,
    stopPreview,
    switching,
  } = useViewAs();
  const { loading, refreshing, error, operationError, refresh } = useAppDataContext();
  const { online, pendingCount, syncing, sync } = useOfflineSync();
  const visibleError = operationError ?? error;
  const bottomItems = effectiveRole === 'customer'
    ? customerBottomItems
    : effectiveRole === 'worker'
      ? workerBottomItems
      : managementBottomItems;
  const isDemoOrganization = isDemoOrganizationBusinessId(currentOrg?.business_id);
  const sourceOrganizationId = readDemoSourceOrganization();
  const sourceOrganization = organizations.find((organization) => organization.id === sourceOrganizationId)
    ?? organizations.find((organization) => !isDemoOrganizationBusinessId(organization.business_id));

  useEffect(() => {
    if (!isDemoOrganization || !currentOrg?.id) {
      setDemoAccounts([]);
      return;
    }
    let cancelled = false;
    void listDemoAccounts(currentOrg.id)
      .then((accounts) => {
        if (!cancelled) setDemoAccounts(accounts);
      })
      .catch((caught) => {
        if (!cancelled) setRoleSwitchError(caught instanceof Error ? caught.message : 'Demoroolien haku epäonnistui.');
      });
    return () => { cancelled = true; };
  }, [currentOrg?.id, isDemoOrganization]);

  const returnToAdministrator = async () => {
    await stopPreview();
    navigate('/kayttajaesikatselu', { replace: true });
  };

  const returnToSourceOrganization = () => {
    if (!sourceOrganization) return;
    try {
      window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, sourceOrganization.id);
    } finally {
      window.location.reload();
    }
  };

  const openDemoRole = async (userId: string) => {
    const account = demoAccounts.find((item) => item.userId === userId);
    if (!account || account.userId === previewTarget?.userId) return;
    setRoleSwitchingUserId(account.userId);
    setRoleSwitchError(null);
    try {
      const target = {
        userId: account.userId,
        displayName: account.displayName,
        email: account.email,
        role: account.role,
      };
      if (isImpersonating) await switchPreview(target);
      else await startPreview(target);
      navigate(homeForRole(account.role), { replace: true });
    } catch (caught) {
      setRoleSwitchError(caught instanceof Error ? caught.message : 'Demoroolin avaaminen epäonnistui.');
    } finally {
      setRoleSwitchingUserId(null);
    }
  };

  const roleSelector = demoAccounts.length > 0 ? (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-current/30 bg-white px-2.5 font-semibold">
      <UsersRound size={15} className="shrink-0 opacity-70" />
      <span className="sr-only">Vaihda demoroolia</span>
      <select
        value={previewTarget?.userId ?? ''}
        disabled={switching || Boolean(roleSwitchingUserId)}
        onChange={(event) => void openDemoRole(event.target.value)}
        className="min-w-0 max-w-[210px] bg-transparent text-sm outline-none disabled:cursor-wait"
        aria-label="Vaihda demoroolia"
      >
        {!previewTarget && <option value="">Avaa demorooli…</option>}
        {demoAccounts.map((account) => (
          <option key={account.userId} value={account.userId}>{ROLE_LABELS[account.role]}</option>
        ))}
      </select>
      {(switching || roleSwitchingUserId) && <Loader2 size={14} className="animate-spin" />}
    </label>
  ) : null;

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-slate-50">
      <div className="hidden md:block"><Navbar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} /></div>

      {mobileOpen && (
        <>
          <button type="button" aria-label="Sulje sivuvalikko" className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 z-50 h-full max-w-[88vw] md:hidden"><Navbar collapsed={false} onToggle={() => setMobileOpen(false)} isMobile /></div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <GlobalAnnouncementBanner />

        {(!online || pendingCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
            <span className="min-w-0 flex-1">
              {!online
                ? `Offline-tila – muutokset säilyvät laitteella${pendingCount ? ` (${pendingCount} jonossa)` : ''}.`
                : `${pendingCount} muutosta odottaa synkronointia.`}
            </span>
            {online && pendingCount > 0 && (
              <button type="button" onClick={() => void sync()} disabled={syncing} className="min-h-10 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold">
                {syncing ? 'Synkronoidaan…' : 'Synkronoi nyt'}
              </button>
            )}
          </div>
        )}

        {isDemoOrganization && !isImpersonating && (
          <div className="flex flex-col gap-2 border-b border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 sm:flex-row sm:items-center sm:px-4">
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
              <Building2 size={17} className="mt-0.5 flex-shrink-0 text-emerald-700 sm:mt-0" />
              <p className="min-w-0 leading-5"><span className="font-semibold">Eristetty demoympäristö.</span>{' '}Täällä tehdyt muutokset eivät sekoitu oikean organisaation tietoihin.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {roleSelector}
              {sourceOrganization && (
                <button type="button" onClick={returnToSourceOrganization} className="flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-400 bg-white px-3 py-2 font-semibold text-emerald-900 transition-colors hover:bg-emerald-100">
                  <RotateCcw size={16} /> Palaa: {sourceOrganization.name}
                </button>
              )}
            </div>
          </div>
        )}

        {isImpersonating && previewTarget && (
          <div className={`flex flex-col gap-2 border-b px-3 py-2 text-sm sm:flex-row sm:items-center sm:px-4 ${isDemoOrganization ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
            <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
              <Eye size={17} className={`mt-0.5 flex-shrink-0 sm:mt-0 ${isDemoOrganization ? 'text-emerald-700' : 'text-amber-700'}`} />
              <p className="min-w-0 leading-5"><span className="font-semibold">Rooliesikatselu:</span>{' '}<span className="font-medium">{previewTarget.displayName || previewTarget.email}</span>{' '}<span className="opacity-80">({ROLE_LABELS[previewTarget.role]})</span>.<span className="hidden sm:inline"> Kaikki toiminnot ja tallennukset tehdään tämän käyttäjän oikeuksilla.</span></p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isDemoOrganization && roleSelector}
              <button type="button" disabled={switching} onClick={() => void returnToAdministrator()} className="flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-current/40 bg-white px-3 py-2 font-semibold transition-colors hover:bg-white/70 disabled:cursor-wait disabled:opacity-60">
                <X size={16} /> {switching ? 'Palautetaan…' : 'Palaa roolivalintaan'}
              </button>
            </div>
          </div>
        )}

        {roleSwitchError && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"><AlertTriangle size={16} />{roleSwitchError}</div>
        )}

        {(loading || refreshing) && effectiveRole !== 'customer' && (
          <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-800"><Loader2 size={16} className="animate-spin" />{loading ? 'Ladataan käyttöoikeuksiesi tietoja…' : 'Päivitetään tietoja…'}</div>
        )}

        {visibleError && effectiveRole !== 'customer' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"><AlertTriangle size={16} /><span className="min-w-0 flex-1">{visibleError}</span><button type="button" className="min-h-9 rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100" onClick={() => void refresh()}>Yritä uudelleen</button></div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-24 sm:px-4 sm:py-5 md:px-6 md:py-6 md:pb-8">
          <ContextAnnouncementSection pathname={location.pathname} />
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} className="min-w-0 max-w-full" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <Suspense fallback={<RouteLoadingState />}><Outlet /></Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex min-h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(15,23,42,0.06)] backdrop-blur md:hidden">
          {bottomItems.map((item) => {
            const active = Boolean(item.path && (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)));
            return (
              <button key={item.path ?? item.label} type="button" aria-current={active ? 'page' : undefined} aria-label={item.label} onClick={() => item.menu ? setMobileOpen(true) : item.path && navigate(item.path)} className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors ${active ? 'bg-orange-50 text-orange-600' : 'text-slate-500'}`}>
                <item.icon size={20} /><span className="max-w-full break-words text-center leading-3">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
