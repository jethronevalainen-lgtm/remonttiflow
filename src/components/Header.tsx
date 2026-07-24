import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
} from 'lucide-react';

import { useAppDataContext } from '@/contexts/AppDataContext';
import {
  ROLE_COLORS,
  ROLE_LABELS,
  ROLE_ROUTES,
  useAuth,
} from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { BRAND } from '@/config/brand';
import {
  buildHeaderAlerts,
  filterHeaderRoutes,
  type HeaderAlert,
  type HeaderRoute,
} from '@/lib/headerInsights';

const routes: HeaderRoute[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/tyonjohto', label: 'Työnjohto' },
  { path: '/projektit', label: 'Projektit' },
  { path: '/aikataulutus', label: 'Aikataulutus' },
  { path: '/paivakirjat', label: 'Päiväkirjat' },
  { path: '/kuittaukset', label: 'Kuittaukset' },
  { path: '/laskenta', label: 'Laskenta' },
  { path: '/maaralaskenta', label: 'Määrälaskenta' },
  { path: '/jatehuolto', label: 'Jätehuolto' },
  { path: '/tyomaaraykset', label: 'Työmääräykset' },
  { path: '/tyovuorokalenteri', label: 'Työvuorokalenteri' },
  { path: '/tuntikirjaukset', label: 'Tuntikirjaukset' },
  { path: '/matkakulut', label: 'Matkakulut' },
  { path: '/tyoturvallisuus', label: 'Työturvallisuus' },
  { path: '/crm', label: 'CRM' },
  { path: '/asiakkaat', label: 'Asiakkaat' },
  { path: '/ai', label: 'AI-työkalut' },
  { path: '/viestinta', label: 'Viestintä' },
  { path: '/kalusto', label: 'Kalusto' },
  { path: '/henkilosto', label: 'Henkilöstö' },
  { path: '/lomakkeet', label: 'Lomakkeet' },
  { path: '/raportit', label: 'Raportit' },
  { path: '/hallinta', label: 'Organisaation hallinta' },
];

const routeLabelMap = new Map(routes.map((route) => [route.path, route.label]));

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function alertIcon(alert: HeaderAlert) {
  if (alert.severity === 'danger') {
    return <ShieldAlert size={17} className="text-red-600" />;
  }
  if (alert.severity === 'warning') {
    return <AlertTriangle size={17} className="text-amber-600" />;
  }
  return <CircleAlert size={17} className="text-blue-600" />;
}

function alertTone(alert: HeaderAlert) {
  if (alert.severity === 'danger') return 'border-red-100 bg-red-50/60';
  if (alert.severity === 'warning') return 'border-amber-100 bg-amber-50/60';
  return 'border-blue-100 bg-blue-50/60';
}

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const {
    organizations,
    currentOrg,
    currentRole,
    setCurrentOrg,
  } = useOrganization();
  const { workOrders, timeEntries, safetyItems, projects } = useAppDataContext();

  const [showAlerts, setShowAlerts] = useState(false);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const label = routeLabelMap.get(location.pathname) ?? BRAND.name;
  const displayName = profile?.full_name ?? user?.email ?? '';
  const hasMultipleOrgs = organizations.length > 1;
  const allowedPaths = currentRole ? ROLE_ROUTES[currentRole] : ['/dashboard'];

  const alerts = useMemo(() => {
    const allowed = new Set(allowedPaths);
    return buildHeaderAlerts({
      workOrders,
      timeEntries,
      safetyItems,
      projects,
    }).filter((alert) => allowed.has(alert.path));
  }, [allowedPaths, projects, safetyItems, timeEntries, workOrders]);

  const searchResults = useMemo(
    () => filterHeaderRoutes(routes, allowedPaths, searchValue),
    [allowedPaths, searchValue],
  );

  const goTo = (path: string) => {
    navigate(path);
    setSearchValue('');
    setSearchFocused(false);
    setShowAlerts(false);
  };

  const handleSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchValue('');
      setSearchFocused(false);
      event.currentTarget.blur();
    }
    if (event.key === 'Enter' && searchResults[0]) {
      goTo(searchResults[0].path);
    }
  };

  return (
    <header className="relative z-20 flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
          aria-label="Avaa valikko"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden font-medium text-gray-400 sm:inline">{BRAND.name}</span>
          <span className="hidden text-gray-300 sm:inline">/</span>
          <span className="font-semibold text-gray-900">{label}</span>
        </div>
      </div>

      <div className="relative hidden w-72 md:flex">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          placeholder="Hae sivua..."
          value={searchValue}
          onFocus={() => setSearchFocused(true)}
          onChange={(event) => setSearchValue(event.target.value)}
          onKeyDown={handleSearchKey}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          aria-label="Hae sovelluksen sivuja"
        />
        <AnimatePresence>
          {searchFocused && searchValue.trim() && (
            <>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setSearchFocused(false)}
                aria-label="Sulje hakutulokset"
              />
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
              >
                {searchResults.map((route) => (
                  <button
                    key={route.path}
                    onClick={() => goTo(route.path)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <Search size={14} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-800">{route.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-gray-400">{route.path}</span>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-gray-500">
                    Käyttöoikeuksillasi ei löytynyt vastaavaa sivua.
                  </p>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          {hasMultipleOrgs ? (
            <button
              onClick={() => setShowOrgMenu(!showOrgMenu)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-gray-100"
            >
              <Building2 size={14} className="text-gray-400" />
              <span className="hidden max-w-[160px] truncate text-sm font-medium text-gray-700 sm:inline">
                {currentOrg?.name ?? 'Organisaatio'}
              </span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Building2 size={14} className="text-gray-400" />
              <span className="hidden max-w-[160px] truncate text-sm font-medium text-gray-700 sm:inline">
                {currentOrg?.name ?? 'Organisaatio'}
              </span>
            </div>
          )}
          <AnimatePresence>
            {hasMultipleOrgs && showOrgMenu && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowOrgMenu(false)}
                  aria-label="Sulje organisaatiovalikko"
                />
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-gray-200 bg-white py-2 shadow-xl"
                >
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Vaihda organisaatiota
                  </p>
                  {organizations.map((organization) => (
                    <button
                      key={organization.id}
                      onClick={() => {
                        setCurrentOrg(organization.id);
                        setShowOrgMenu(false);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                    >
                      <Building2 size={14} className="flex-shrink-0 text-gray-400" />
                      <p className="truncate text-sm font-medium text-gray-800">
                        {organization.name}
                      </p>
                      {currentOrg?.id === organization.id && (
                        <Check size={14} className="ml-auto flex-shrink-0 text-orange-500" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {currentRole && (
          <div className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 sm:flex">
            <div className={`h-2.5 w-2.5 rounded-full ${ROLE_COLORS[currentRole]}`} />
            <span className="text-sm font-medium text-gray-700">
              {ROLE_LABELS[currentRole]}
            </span>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
            aria-label="Avaa ajankohtaiset huomiot"
          >
            <Bell size={18} />
            {alerts.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {showAlerts && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowAlerts(false)}
                  aria-label="Sulje ajankohtaiset huomiot"
                />
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 top-full z-50 mt-1 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                >
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-semibold">Ajankohtaiset huomiot</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Johdettu organisaation tämänhetkisistä tiedoista
                    </p>
                  </div>
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => goTo(alert.path)}
                      className={`flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:brightness-[0.98] ${alertTone(alert)}`}
                    >
                      <span className="mt-0.5 flex-shrink-0">{alertIcon(alert)}</span>
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          {alert.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-gray-600">
                          {alert.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                  {alerts.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Check size={24} className="mx-auto mb-2 text-emerald-600" />
                      <p className="text-sm font-medium text-gray-800">
                        Ei avoimia huomioita
                      </p>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-md">
            <span className="text-sm font-bold text-white">{initialsOf(displayName)}</span>
          </div>
          <span className="hidden max-w-[160px] truncate text-sm font-medium text-gray-700 lg:inline">
            {displayName}
          </span>
        </div>

        <button
          onClick={() => { void signOut(); }}
          title="Kirjaudu ulos"
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={16} />
          <span className="hidden text-sm font-medium xl:inline">Kirjaudu ulos</span>
        </button>
      </div>
    </header>
  );
}
