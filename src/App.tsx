import { lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { homeForRole, useAuth, type UserRole } from './contexts/AuthContext';
import { rolesForRoute } from '@/auth/permissions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { AppDataProvider } from './contexts/AppDataContext';
import Layout from './components/Layout';
import { ErrorState, LoadingState } from '@/components/states';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

const Dashboard = lazy(() => import('./pages/DashboardV2'));
const Tyonjohto = lazy(() => import('./pages/Tyonjohto'));
const Tarkastukset = lazy(() => import('./pages/Tarkastukset'));
const Projektit = lazy(() => import('./pages/Projektit'));
const ProjectWorks = lazy(() => import('./pages/ProjectWorks'));
const ProjectWorkspace = lazy(() => import('./pages/ProjectWorkspace'));
const Aikataulutus = lazy(() => import('./pages/Aikataulutus'));
const Paivakirjat = lazy(() => import('./pages/Paivakirjat'));
const Kuittaukset = lazy(() => import('./pages/Kuittaukset'));
const Tarjoukset = lazy(() => import('./pages/Tarjoukset'));
const Jatehuolto = lazy(() => import('./pages/Jatehuolto'));
const Tyomaaraykset = lazy(() => import('./pages/Tyomaaraykset'));
const Tyovuorokalenteri = lazy(() => import('./pages/Tyovuorokalenteri'));
const Tuntikirjaukset = lazy(() => import('./pages/TuntikirjauksetV2'));
const CoordinatorTimeEntries = lazy(() => import('./pages/CoordinatorTimeEntries'));
const Kirjaukset = lazy(() => import('./pages/Kirjaukset'));
const Matkakulut = lazy(() => import('./pages/MatkakulutV2'));
const CRM = lazy(() => import('./pages/CRM'));
const Asiakkaat = lazy(() => import('./pages/Asiakkaat'));
const AIPage = lazy(() => import('./pages/AI'));
const Viestinta = lazy(() => import('./pages/Viestinta'));
const Kalusto = lazy(() => import('./pages/Kalusto'));
const Henkilosto = lazy(() => import('./pages/HenkilostoWithSupervisors'));
const Henkilokortit = lazy(() => import('./pages/Henkilokortit'));
const HenkilokortitPreview = lazy(() => import('./pages/HenkilokortitPreview'));
const PalkkaAineisto = lazy(() => import('./pages/PalkkaAineistoV4'));
const Lomakkeet = lazy(() => import('./pages/Lomakkeet'));
const Raportit = lazy(() => import('./pages/RaportitV2'));
const Hallinta = lazy(() => import('./pages/HallintaV2'));
const KayttajaEsikatselu = lazy(() => import('./pages/KayttajaEsikatseluV2'));
const Tilaukset = lazy(() => import('./pages/Tilaukset'));
const TilaajanTyot = lazy(() => import('./pages/TilaajanTyotV2'));
const NewCustomerWorkRequest = lazy(() => import('./pages/NewCustomerWorkRequest'));
const CustomerProject = lazy(() => import('./pages/CustomerProjectV2'));
const CustomerCollaborationManager = lazy(() => import('./pages/CustomerCollaborationManager'));
const ProjectDiscussions = lazy(() => import('./pages/ProjectDiscussions'));
const ProjectConversation = lazy(() => import('./pages/ProjectConversation'));
const ProjectRequests = lazy(() => import('./pages/ProjectRequests'));
const SafetyPortal = lazy(() => import('./pages/SafetyPortal'));
const QrHallinta = lazy(() => import('./pages/QrHallinta'));
const QrKirjautuminen = lazy(() => import('./pages/QrKirjautuminen'));
const Varmuuskopiot = lazy(() => import('./pages/Varmuuskopiot'));
const Toiminnanohjaus = lazy(() => import('./pages/Toiminnanohjaus'));

function PublicHome() {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingState text="Ladataan…" /></div>;
  }
  if (session) return <Navigate to="/app" replace />;
  return <LandingPage />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingState text="Ladataan…" /></div>;
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

function WorkspaceError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <ErrorState
        title={error ? 'Työtilaa ei voitu avata' : 'Työtilaa ei löytynyt'}
        description={error ?? 'Käyttäjätilillä ei ole voimassa olevaa organisaatiojäsenyyttä.'}
        onRetry={onRetry}
        className="w-full max-w-lg"
      />
    </div>
  );
}

function RoleGuard({
  children,
  allowedRoles,
  useActualRole = false,
}: {
  children: ReactNode;
  allowedRoles: UserRole[];
  useActualRole?: boolean;
}) {
  const { loading, error, refreshOrganizations } = useOrganization();
  const { actualRole, effectiveRole } = useViewAs();
  const role = useActualRole ? actualRole : effectiveRole;
  const retry = () => { void refreshOrganizations().catch(() => undefined); };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingState text="Ladataan käyttöoikeuksia…" /></div>;
  }
  if (error || !role) return <WorkspaceError error={error} onRetry={retry} />;
  if (!allowedRoles.includes(role)) return <Navigate to={homeForRole(role)} replace />;
  return <>{children}</>;
}

function CustomerPreviewBoundary({ children }: { children: ReactNode }) {
  const { effectiveRole, isPreviewing, customerPreview } = useViewAs();
  if (isPreviewing && effectiveRole === 'customer') {
    if (!customerPreview) return <Navigate to="/kayttajaesikatselu" replace />;
    return <Navigate to="/tilaajan-tyot" replace />;
  }
  return <>{children}</>;
}

function RoleHome() {
  const { loading, error, refreshOrganizations } = useOrganization();
  const { effectiveRole } = useViewAs();
  const retry = () => { void refreshOrganizations().catch(() => undefined); };

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoadingState text="Avataan työtilaa…" /></div>;
  }
  if (error || !effectiveRole) return <WorkspaceError error={error} onRetry={retry} />;
  return <Navigate to={homeForRole(effectiveRole)} replace />;
}

function EmployeeCardsRoute() {
  const { effectiveRole, isPreviewing } = useViewAs();
  return isPreviewing && effectiveRole !== 'admin' ? <HenkilokortitPreview /> : <Henkilokortit />;
}

function TimeEntriesRoute() {
  const { effectiveRole } = useViewAs();
  return effectiveRole === 'project_coordinator' ? <CoordinatorTimeEntries /> : <Tuntikirjaukset />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/app" element={<RoleHome />} />
        <Route path="/dashboard" element={<RoleGuard allowedRoles={rolesForRoute('/dashboard')}><Dashboard /></RoleGuard>} />
        <Route path="/tyonjohto" element={<RoleGuard allowedRoles={rolesForRoute('/tyonjohto')}><Tyonjohto /></RoleGuard>} />
        <Route path="/tarkastukset" element={<RoleGuard allowedRoles={rolesForRoute('/tarkastukset')}><Tarkastukset /></RoleGuard>} />
        <Route path="/projektit" element={<RoleGuard allowedRoles={rolesForRoute('/projektit')}><Projektit /></RoleGuard>} />
        <Route path="/projektit/:projectId" element={<RoleGuard allowedRoles={rolesForRoute('/projektit')}><ProjectWorks /></RoleGuard>} />
        <Route path="/projektit/:projectId/tyotila" element={<RoleGuard allowedRoles={rolesForRoute('/projektit')}><ProjectWorkspace /></RoleGuard>} />
        <Route path="/projektit/:projectId/tilaajayhteistyo" element={<RoleGuard allowedRoles={rolesForRoute('/projektit')}><CustomerCollaborationManager /></RoleGuard>} />
        <Route path="/projektipyynnot" element={<RoleGuard allowedRoles={rolesForRoute('/projektipyynnot')}><ProjectRequests /></RoleGuard>} />
        <Route path="/projektikeskustelut" element={<RoleGuard allowedRoles={rolesForRoute('/projektikeskustelut')}><CustomerPreviewBoundary><ProjectDiscussions /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/projektikeskustelut/:projectId" element={<RoleGuard allowedRoles={rolesForRoute('/projektikeskustelut')}><CustomerPreviewBoundary><ProjectConversation /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/aikataulutus" element={<RoleGuard allowedRoles={rolesForRoute('/aikataulutus')}><Aikataulutus /></RoleGuard>} />
        <Route path="/paivakirjat" element={<RoleGuard allowedRoles={rolesForRoute('/paivakirjat')}><Paivakirjat /></RoleGuard>} />
        <Route path="/kuittaukset" element={<RoleGuard allowedRoles={rolesForRoute('/kuittaukset')}><Kuittaukset /></RoleGuard>} />
        <Route path="/tarjoukset" element={<RoleGuard allowedRoles={rolesForRoute('/tarjoukset')}><Tarjoukset /></RoleGuard>} />
        <Route path="/laskenta" element={<RoleGuard allowedRoles={rolesForRoute('/laskenta')}><Tarjoukset /></RoleGuard>} />
        <Route path="/maaralaskenta" element={<RoleGuard allowedRoles={rolesForRoute('/maaralaskenta')}><Tarjoukset /></RoleGuard>} />
        <Route path="/jatehuolto" element={<RoleGuard allowedRoles={rolesForRoute('/jatehuolto')}><Jatehuolto /></RoleGuard>} />
        <Route path="/tyomaaraykset" element={<RoleGuard allowedRoles={rolesForRoute('/tyomaaraykset')}><Tyomaaraykset /></RoleGuard>} />
        <Route path="/tilaukset" element={<RoleGuard allowedRoles={rolesForRoute('/tilaukset')}><Tilaukset /></RoleGuard>} />
        <Route path="/tilaajan-tyot" element={<RoleGuard allowedRoles={rolesForRoute('/tilaajan-tyot')}><TilaajanTyot /></RoleGuard>} />
        <Route path="/tilaajan-tyot/uusi" element={<RoleGuard allowedRoles={rolesForRoute('/tilaajan-tyot')}><NewCustomerWorkRequest /></RoleGuard>} />
        <Route path="/tilaajan-projektit/:projectId" element={<RoleGuard allowedRoles={rolesForRoute('/tilaajan-projektit')}><CustomerProject /></RoleGuard>} />
        <Route path="/tyovuorokalenteri" element={<RoleGuard allowedRoles={rolesForRoute('/tyovuorokalenteri')}><Tyovuorokalenteri /></RoleGuard>} />
        <Route path="/tuntikirjaukset" element={<RoleGuard allowedRoles={rolesForRoute('/tuntikirjaukset')}><TimeEntriesRoute /></RoleGuard>} />
        <Route path="/kirjaukset" element={<RoleGuard allowedRoles={rolesForRoute('/kirjaukset')}><Kirjaukset /></RoleGuard>} />
        <Route path="/palkka-aineisto" element={<RoleGuard allowedRoles={rolesForRoute('/palkka-aineisto')}><PalkkaAineisto /></RoleGuard>} />
        <Route path="/qr-kirjautuminen" element={<RoleGuard allowedRoles={rolesForRoute('/qr-kirjautuminen')}><QrKirjautuminen /></RoleGuard>} />
        <Route path="/qr-hallinta" element={<RoleGuard allowedRoles={rolesForRoute('/qr-hallinta')}><QrHallinta /></RoleGuard>} />
        <Route path="/matkakulut" element={<RoleGuard allowedRoles={rolesForRoute('/matkakulut')}><Matkakulut /></RoleGuard>} />
        <Route path="/tyoturvallisuus" element={<RoleGuard allowedRoles={rolesForRoute('/tyoturvallisuus')}><CustomerPreviewBoundary><SafetyPortal /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/crm" element={<RoleGuard allowedRoles={rolesForRoute('/crm')}><CRM /></RoleGuard>} />
        <Route path="/asiakkaat" element={<RoleGuard allowedRoles={rolesForRoute('/asiakkaat')}><Asiakkaat /></RoleGuard>} />
        <Route path="/toiminnanohjaus" element={<RoleGuard allowedRoles={rolesForRoute('/toiminnanohjaus')}><Toiminnanohjaus /></RoleGuard>} />
        <Route path="/ai" element={<RoleGuard allowedRoles={rolesForRoute('/ai')}><AIPage /></RoleGuard>} />
        <Route path="/viestinta" element={<RoleGuard allowedRoles={rolesForRoute('/viestinta')}><Viestinta /></RoleGuard>} />
        <Route path="/kalusto" element={<RoleGuard allowedRoles={rolesForRoute('/kalusto')}><Kalusto /></RoleGuard>} />
        <Route path="/henkilosto" element={<RoleGuard allowedRoles={rolesForRoute('/henkilosto')}><Henkilosto /></RoleGuard>} />
        <Route path="/henkilokortit" element={<RoleGuard allowedRoles={rolesForRoute('/henkilokortit')}><EmployeeCardsRoute /></RoleGuard>} />
        <Route path="/lomakkeet" element={<RoleGuard allowedRoles={rolesForRoute('/lomakkeet')}><Lomakkeet /></RoleGuard>} />
        <Route path="/raportit" element={<RoleGuard allowedRoles={rolesForRoute('/raportit')}><Raportit /></RoleGuard>} />
        <Route path="/varmuuskopiot" element={<RoleGuard allowedRoles={rolesForRoute('/varmuuskopiot')} useActualRole><Varmuuskopiot /></RoleGuard>} />
        <Route path="/hallinta" element={<RoleGuard allowedRoles={rolesForRoute('/hallinta')} useActualRole><Hallinta /></RoleGuard>} />
        <Route path="/kayttajaesikatselu" element={<RoleGuard allowedRoles={rolesForRoute('/kayttajaesikatselu')} useActualRole><KayttajaEsikatselu /></RoleGuard>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();
  return <AppDataProvider key={user?.id ?? 'signed-out'}><AppRoutes /></AppDataProvider>;
}
