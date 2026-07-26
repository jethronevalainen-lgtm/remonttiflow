import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { homeForRole, useAuth, type UserRole } from './contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { AppDataProvider } from './contexts/AppDataContext';
import Layout from './components/Layout';
import { LoadingState } from '@/components/states';
import {
  Dashboard, Tyonjohto, Tarkastukset, Projektit, ProjectWorkspace, Aikataulutus,
  Paivakirjat, Kuittaukset, Laskenta, Maaralaskenta, Jatehuolto, Tyomaaraykset,
  Tyovuorokalenteri, Tuntikirjaukset, Matkakulut, CRM, Asiakkaat,
  AIPage, Viestinta, Kalusto, Henkilosto, Lomakkeet, Raportit, Hallinta,
  KayttajaEsikatselu, Tilaukset, TilaajanTyot, CustomerProject,
  ProjectDiscussions, ProjectConversation, ProjectRequests, SafetyPortal,
} from './pages';
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
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
  const { loading } = useOrganization();
  const { actualRole, effectiveRole } = useViewAs();
  const role = useActualRole ? actualRole : effectiveRole;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState text="Ladataan käyttöoikeuksia…" />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={homeForRole(role)} replace />;
  }
  return <>{children}</>;
}

function RoleHome() {
  const { loading } = useOrganization();
  const { effectiveRole } = useViewAs();
  if (loading || !effectiveRole) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingState text="Avataan työtilaa…" />
      </div>
    );
  }
  return <Navigate to={homeForRole(effectiveRole)} replace />;
}

function AppRoutes() {
  const allRoles: UserRole[] = ['admin', 'supervisor', 'worker', 'customer'];
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<RoleHome />} />
        <Route path="/dashboard" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Dashboard /></RoleGuard>} />
        <Route path="/tyonjohto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyonjohto /></RoleGuard>} />
        <Route path="/tarkastukset" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Tarkastukset /></RoleGuard>} />
        <Route path="/projektit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Projektit /></RoleGuard>} />
        <Route path="/projektit/:projectId" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><ProjectWorkspace /></RoleGuard>} />
        <Route path="/projektipyynnot" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><ProjectRequests /></RoleGuard>} />
        <Route path="/projektikeskustelut" element={<RoleGuard allowedRoles={allRoles}><ProjectDiscussions /></RoleGuard>} />
        <Route path="/projektikeskustelut/:projectId" element={<RoleGuard allowedRoles={allRoles}><ProjectConversation /></RoleGuard>} />
        <Route path="/aikataulutus" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Aikataulutus /></RoleGuard>} />
        <Route path="/paivakirjat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Paivakirjat /></RoleGuard>} />
        <Route path="/kuittaukset" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Kuittaukset /></RoleGuard>} />
        <Route path="/laskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Laskenta /></RoleGuard>} />
        <Route path="/maaralaskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Maaralaskenta /></RoleGuard>} />
        <Route path="/jatehuolto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Jatehuolto /></RoleGuard>} />
        <Route path="/tyomaaraykset" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Tyomaaraykset /></RoleGuard>} />
        <Route path="/tilaukset" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tilaukset /></RoleGuard>} />
        <Route path="/tilaajan-tyot" element={<RoleGuard allowedRoles={['customer']}><TilaajanTyot /></RoleGuard>} />
        <Route path="/tilaajan-projektit/:projectId" element={<RoleGuard allowedRoles={['customer']}><CustomerProject /></RoleGuard>} />
        <Route path="/tyovuorokalenteri" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyovuorokalenteri /></RoleGuard>} />
        <Route path="/tuntikirjaukset" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Tuntikirjaukset /></RoleGuard>} />
        <Route path="/matkakulut" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Matkakulut /></RoleGuard>} />
        <Route path="/tyoturvallisuus" element={<RoleGuard allowedRoles={allRoles}><SafetyPortal /></RoleGuard>} />
        <Route path="/crm" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><CRM /></RoleGuard>} />
        <Route path="/asiakkaat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Asiakkaat /></RoleGuard>} />
        <Route path="/ai" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><AIPage /></RoleGuard>} />
        <Route path="/viestinta" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Viestinta /></RoleGuard>} />
        <Route path="/kalusto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Kalusto /></RoleGuard>} />
        <Route path="/henkilosto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Henkilosto /></RoleGuard>} />
        <Route path="/lomakkeet" element={<RoleGuard allowedRoles={['admin', 'supervisor', 'worker']}><Lomakkeet /></RoleGuard>} />
        <Route path="/raportit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Raportit /></RoleGuard>} />
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
