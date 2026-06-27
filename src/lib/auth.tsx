import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, clearToken, getToken, setToken, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  register: (body: { name: string; email: string; password: string; room?: string; block?: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    return user;
  }

  async function loginWithGoogle(credential: string) {
    const { token, user } = await api.googleLogin(credential);
    setToken(token);
    setUser(user);
    return user;
  }

  async function register(body: { name: string; email: string; password: string; room?: string; block?: string }) {
    const { token, user } = await api.register(body);
    setToken(token);
    setUser(user);
    return user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function Splash() {
  return (
    <div className="app-bg grid min-h-screen place-items-center">
      <div className="animate-pulse font-display text-2xl font-bold text-muted-foreground">
        <span className="text-accent">AI</span> Powered Complaint Portal
      </div>
    </div>
  );
}

/** Requires any authenticated user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Requires an authenticated admin; students are bounced to their portal. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
