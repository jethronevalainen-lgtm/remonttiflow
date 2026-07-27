import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { homeForRole, useAuth, type UserRole } from './contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { AppDataProvider } from './contexts/AppDataContext';
import Layout from './components/Layout';
import { ErrorState, LoadingState } from '@/components/states';
import {
  Dashboard, Tyonjohto, Tarkastukset, Projektit, ProjectWorkspace, Aikataulutus,
  Paivakirjat, Kuittaukset, Laskenta, Maaralaskenta, Jatehuolto, Tyomaaraykset,
  Tyovuorokalenteri, Tuntikirjaukset, Matkakulut, CRM, Asiakkaat,
  AIPage, Viestinta, Kalusto, Henkilosto, Henkilokortit, PalkkaAineisto, Lomakkeet,
  Raportit, Hallinta, KayttajaEsikatselu, Tilaukset, TilaajanTyot, CustomerProject,
  CustomerCollaborationManager, ProjectDiscussions, ProjectConversation,
  ProjectRequests, SafetyPortal, QrHallinta, QrKirjautuminen, Varmuuskopiot,
  Toiminnanohjaus,
} from './pages';
import HenkilokortitPreview from './pages/HenkilokortitPreview';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState text="Ladataan…" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

function WorkspaceError({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
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
  children: React.ReactNode;
  allowedRoles: UserRole[];
  useActualRole?: boolean;
}) {
  const { loading, error, refreshOrganizations } = useOrganization();
  const { actualRole, effectiveRole } = useViewAs();
  const role = useActualRole ? actualRole : effectiveRole;
  const retry = () => { void refreshOrganizations().catch(() => undefined); };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState text="Ladataan käyttöoikeuksia…" />
      </div>
    );
  }

  if (error || !role) {
    return <WorkspaceError error={error} onRetry={retry} />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }
  return <>{children}</>;
}

function CustomerPreviewBoundary({ children }: { children: React.ReactNode }) {
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState text="Avataan työtilaa…" />
      </div>
    );
  }

  if (error || !effectiveRole) {
    return <WorkspaceError error={error} onRetry={retry} />;
  }

  return <Navigate to={homeForRole(effectiveRole)} replace />;
}

function EmployeeCardsRoute() {
  const { effectiveRole, isPreviewing } = useViewAs();
  return isPreviewing && effectiveRole !== 'admin'
    ? <HenkilokortitPreview />
    : <Henkilokortit />;
}

function AppRoutes() {
  const allRoles: UserRole[] = ['admin', 'supervisor', 'worker', 'customer'];
  const internalRoles: UserRole[] = ['admin', 'supervisor', 'worker'];
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<RoleHome />} />
        <Route path="/dashboard" element={<RoleGuard allowedRoles={internalRoles}><Dashboard /></RoleGuard>} />
        <Route path="/toiminnanohjaus" element={<RoleGuard allowedRoles={internalRoles}><Toiminnanohjaus /></RoleGuard>} />
        <Route path="/tyonjohto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyonjohto /></RoleGuard>} />
        <Route path="/tarkastukset" element={<RoleGuard allowedRoles={internalRoles}><Tarkastukset /></RoleGuard>} />
        <Route path="/projektit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Projektit /></RoleGuard>} />
        <Route path="/projektit/:projectId" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><ProjectWorkspace /></RoleGuard>} />
        <Route path="/projektit/:projectId/tilaajayhteistyo" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><CustomerCollaborationManager /></RoleGuard>} />
        <Route path="/projektipyynnot" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><ProjectRequests /></RoleGuard>} />
        <Route path="/projektikeskustelut" element={<RoleGuard allowedRoles={allRoles}><CustomerPreviewBoundary><ProjectDiscussions /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/projektikeskustelut/:projectId" element={<RoleGuard allowedRoles={allRoles}><CustomerPreviewBoundary><ProjectConversation /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/aikataulutus" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Aikataulutus /></RoleGuard>} />
        <Route path="/paivakirjat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Paivakirjat /></RoleGuard>} />
        <Route path="/kuittaukset" element={<RoleGuard allowedRoles={internalRoles}><Kuittaukset /></RoleGuard>} />
        <Route path="/laskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Laskenta /></RoleGuard>} />
        <Route path="/maaralaskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Maaralaskenta /></RoleGuard>} />
        <Route path="/jatehuolto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Jatehuolto /></RoleGuard>} />
        <Route path="/tyomaaraykset" element={<RoleGuard allowedRoles={internalRoles}><Tyomaaraykset /></RoleGuard>} />
        <Route path="/tilaukset" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tilaukset /></RoleGuard>} />
        <Route path="/tilaajan-tyot" element={<RoleGuard allowedRoles={['customer']}><TilaajanTyot /></RoleGuard>} />
        <Route path="/tilaajan-projektit/:projectId" element={<RoleGuard allowedRoles={['customer']}><CustomerProject /></RoleGuard>} />
        <Route path="/tyovuorokalenteri" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyovuorokalenteri /></RoleGuard>} />
        <Route path="/tuntikirjaukset" element={<RoleGuard allowedRoles={internalRoles}><Tuntikirjaukset /></RoleGuard>} />
        <Route path="/palkka-aineisto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><PalkkaAineisto /></RoleGuard>} />
        <Route path="/qr-kirjautuminen" element={<RoleGuard allowedRoles={internalRoles}><QrKirjautuminen /></RoleGuard>} />
        <Route path="/qr-hallinta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><QrHallinta /></RoleGuard>} />
        <Route path="/matkakulut" element={<RoleGuard allowedRoles={internalRoles}><Matkakulut /></RoleGuard>} />
        <Route path="/tyoturvallisuus" element={<RoleGuard allowedRoles={allRoles}><CustomerPreviewBoundary><SafetyPortal /></CustomerPreviewBoundary></RoleGuard>} />
        <Route path="/crm" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><CRM /></RoleGuard>} />
        <Route path="/asiakkaat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Asiakkaat /></RoleGuard>} />
        <Route path="/ai" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><AIPage /></RoleGuard>} />
        <Route path="/viestinta" element={<RoleGuard allowedRoles={internalRoles}><Viestinta /></RoleGuard>} />
        <Route path="/kalusto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Kalusto /></RoleGuard>} />
        <Route path="/henkilosto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Henkilosto /></RoleGuard>} />
        <Route path="/henkilokortit" element={<RoleGuard allowedRoles={internalRoles}><EmployeeCardsRoute /></RoleGuard>} />
        <Route path="/lomakkeet" element={<RoleGuard allowedRoles={internalRoles}><Lomakkeet /></RoleGuard>} />
        <Route path="/raportit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Raportit /></RoleGuard>} />
        <Route path="/varmuuskopiot" element={<RoleGuard allowedRoles={['admin']} useActualRole><Varmuuskopiot /></RoleGuard>} />
        <Route path="/hallinta" element={<RoleGuard allowedRoles={['admin']} useActualRole><Hallinta /></RoleGuard>} />
        <Route path="/kayttajaesikatselu" element={<RoleGuard allowedRoles={['admin']} useActualRole><KayttajaEsikatselu /></RoleGuard>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}
