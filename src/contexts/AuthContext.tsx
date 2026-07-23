import { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'admin' | 'supervisor' | 'worker';

export interface User {
  name: string;
  role: UserRole;
  avatar: string;
  initials: string;
}

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const ROLE_USERS: Record<UserRole, User> = {
  admin: { name: 'Jethro Neva', role: 'admin', avatar: '', initials: 'JN' },
  supervisor: { name: 'Matti Meikäläinen', role: 'supervisor', avatar: '', initials: 'MM' },
  worker: { name: 'Laura Kinnunen', role: 'worker', avatar: '', initials: 'LK' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Järjestelmänvalvoja',
  supervisor: 'Työnjohtaja',
  worker: 'Työntekijä',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-500',
  supervisor: 'bg-orange-500',
  worker: 'bg-blue-500',
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    '/dashboard', '/tyonjohto', '/projektit', '/aikataulutus', '/paivakirjat',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tyovuorokalenteri',
    '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus', '/crm', '/asiakkaat',
    '/ai', '/viestinta', '/kalusto', '/henkilosto', '/lomakkeet', '/raportit',
  ],
  supervisor: [
    '/dashboard', '/tyonjohto', '/projektit', '/aikataulutus', '/paivakirjat',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tyovuorokalenteri',
    '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus', '/crm', '/asiakkaat',
    '/viestinta', '/kalusto', '/henkilosto', '/lomakkeet', '/raportit',
  ],
  worker: [
    '/dashboard', '/tyomaaraykset', '/tuntikirjaukset', '/matkakulut', '/viestinta',
  ],
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(ROLE_USERS.supervisor);

  const login = (role: UserRole) => setUser(ROLE_USERS[role]);
  const logout = () => setUser(null);
  const hasRole = (roles: UserRole[]) => user !== null && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
