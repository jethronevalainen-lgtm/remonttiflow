import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from './contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { AppDataProvider } from './contexts/AppDataContext';
import Layout from './components/Layout';
import { LoadingState } from '@/components/states';
import {
  Dashboard, Tyonjohto, Projektit, Aikataulutus, Paivakirjat, Kuittaukset,
  Laskenta, Maaralaskenta, Jatehuolto, Tyomaaraykset, Tyovuorokalenteri,
  Tuntikirjaukset, Matkakulut, Tyoturvallisuus, CRM, Asiakkaat,
  AIPage, Viestinta, Kalusto, Henkilosto, Lomakkeet, Raportit, Hallinta,
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

function RoleGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: UserRole[] }) {
  const { currentRole, loading } = useOrganization();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState text="Ladataan…" />
      </div>
    );
  }
  if (!currentRole || !allowedRoles.includes(currentRole)) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <span className="text-2xl">🔒</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900">Pääsy kielletty</h2>
      <p className="text-gray-500">Sinulla ei ole oikeuksia tälle sivulle.</p>
    </div>
  );
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tyonjohto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyonjohto /></RoleGuard>} />
        <Route path="/projektit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Projektit /></RoleGuard>} />
        <Route path="/aikataulutus" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Aikataulutus /></RoleGuard>} />
        <Route path="/paivakirjat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Paivakirjat /></RoleGuard>} />
        <Route path="/kuittaukset" element={<Kuittaukset />} />
        <Route path="/laskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Laskenta /></RoleGuard>} />
        <Route path="/maaralaskenta" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Maaralaskenta /></RoleGuard>} />
        <Route path="/jatehuolto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Jatehuolto /></RoleGuard>} />
        <Route path="/tyomaaraykset" element={<Tyomaaraykset />} />
        <Route path="/tyovuorokalenteri" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyovuorokalenteri /></RoleGuard>} />
        <Route path="/tuntikirjaukset" element={<Tuntikirjaukset />} />
        <Route path="/matkakulut" element={<Matkakulut />} />
        <Route path="/tyoturvallisuus" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Tyoturvallisuus /></RoleGuard>} />
        <Route path="/crm" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><CRM /></RoleGuard>} />
        <Route path="/asiakkaat" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Asiakkaat /></RoleGuard>} />
        <Route path="/ai" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><AIPage /></RoleGuard>} />
        <Route path="/viestinta" element={<Viestinta />} />
        <Route path="/kalusto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Kalusto /></RoleGuard>} />
        <Route path="/henkilosto" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Henkilosto /></RoleGuard>} />
        <Route path="/lomakkeet" element={<Lomakkeet />} />
        <Route path="/raportit" element={<RoleGuard allowedRoles={['admin', 'supervisor']}><Raportit /></RoleGuard>} />
        <Route path="/hallinta" element={<RoleGuard allowedRoles={['admin']}><Hallinta /></RoleGuard>} />
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
