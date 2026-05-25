import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarInitials: string;
};

type StoredUser = AuthUser & { password: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'fs_token';
const LOCAL_USERS_KEY = 'fs_local_users';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8002';

// Hardcoded admin account — always works regardless of backend
const HARDCODED_ADMIN: StoredUser = {
  id: 'admin-001',
  name: 'Admin',
  email: 'admin@gmail.com',
  password: 'admin123',
  role: 'admin',
  avatarInitials: 'AD',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getLocalUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '[]') as StoredUser[];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: StoredUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function makeLocalToken(email: string) {
  return btoa(`local:${email}:${Date.now()}`);
}

function isLocalToken(token: string) {
  try {
    return atob(token).startsWith('local:');
  } catch {
    return false;
  }
}

function emailFromLocalToken(token: string) {
  try {
    return atob(token).split(':')[1];
  } catch {
    return null;
  }
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

async function fetchMe(token: string): Promise<AuthUser> {
  const url = joinUrl(API_BASE_URL, '/api/v1/auth/me');
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Unauthorized');
  const data = (await res.json()) as { user: AuthUser } | AuthUser;
  return 'user' in data ? data.user : data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (!token) return;

    if (isLocalToken(token)) {
      const email = emailFromLocalToken(token);
      const all = [HARDCODED_ADMIN, ...getLocalUsers()];
      const found = all.find((u) => u.email === email);
      if (found) {
        const { password: _p, ...rest } = found;
        setUser(rest);
      } else {
        logout();
      }
      return;
    }

    // Try backend token
    fetchMe(token)
      .then(setUser)
      .catch(() => logout());
  }, [token, logout]);

  const login = useCallback(async (email: string, password: string) => {
    // 1. Check hardcoded admin first
    if (
      email.toLowerCase() === HARDCODED_ADMIN.email &&
      password === HARDCODED_ADMIN.password
    ) {
      const tok = makeLocalToken(email);
      localStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
      const { password: _p, ...rest } = HARDCODED_ADMIN;
      setUser(rest);
      return;
    }

    // 2. Check locally registered users
    const localUsers = getLocalUsers();
    const localMatch = localUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (localMatch) {
      const tok = makeLocalToken(email);
      localStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
      const { password: _p, ...rest } = localMatch;
      setUser(rest);
      return;
    }

    // 3. Fall back to backend
    try {
      const url = joinUrl(API_BASE_URL, '/api/v1/auth/login');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error('Invalid credentials');

      const data = (await res.json()) as { access_token: string; user?: AuthUser };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);

      const u = data.user ?? (await fetchMe(data.access_token));
      setUser(u);
    } catch {
      throw new Error('Invalid credentials');
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const all = [HARDCODED_ADMIN, ...getLocalUsers()];
    if (all.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists');
    }

    const newUser: StoredUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      role: 'analyst',
      avatarInitials: getInitials(name),
    };

    saveLocalUsers([...getLocalUsers(), newUser]);

    const tok = makeLocalToken(email);
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    const { password: _p, ...rest } = newUser;
    setUser(rest);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isAuthenticated: Boolean(token && user), login, signup, logout }),
    [login, signup, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
