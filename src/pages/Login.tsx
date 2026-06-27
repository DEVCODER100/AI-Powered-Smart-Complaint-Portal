import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Layers, Bell, Mail, Lock, Shield, User as UserIcon } from "lucide-react";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/api";

const FEATURES = [
  { Icon: Sparkles, title: "Describe it once", body: "AI understands category, location & urgency from plain text." },
  { Icon: Layers, title: "Smart de-duplication", body: "Same issue from 18 students becomes one tracked report." },
  { Icon: Bell, title: "Always in the loop", body: "Get notified on every status change until it's fixed." },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, register, logout } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "admin">("login");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [email, setEmail] = useState("aisha.k@campus.edu");
  const [password, setPassword] = useState("hostel123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function routeFor(user: User) {
    navigate(user.role === "admin" ? "/admin" : "/");
  }

  function openAdmin() {
    setError(null);
    setMode("admin");
    setEmail("");
    setPassword("");
  }

  function backToStudent() {
    setError(null);
    setMode("login");
    setEmail("aisha.k@campus.edu");
    setPassword("hostel123");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        routeFor(await register({ name, email, password, room }));
      } else if (mode === "admin") {
        const user = await login(email, password);
        if (user.role !== "admin") {
          logout(); // students must not get in through the admin portal
          setError("This account doesn't have admin access.");
          return;
        }
        navigate("/admin");
      } else {
        routeFor(await login(email, password));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function quickLogin(em: string, pw: string) {
    setError(null);
    setBusy(true);
    try {
      routeFor(await login(em, pw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(credential: string) {
    setError(null);
    setBusy(true);
    try {
      routeFor(await loginWithGoogle(credential));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  const isAdmin = mode === "admin";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="auth-panel-gradient relative hidden flex-col justify-between p-10 text-white lg:flex xl:p-14">
        <Logo variant="light" />

        <div className="max-w-md">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Hostel problems, solved
            <br />
            <span className="text-accent">the smart way.</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-white/75">
            Just type what's wrong — our AI figures out the rest: category,
            location, severity, and who else is affected.
          </p>

          <div className="mt-10 space-y-6">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm leading-snug text-white/65">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/45">Trusted by 2,400+ residents across 6 hostel blocks.</p>
      </div>

      {/* Right form panel */}
      <div className="app-bg flex items-center justify-center p-6 lg:bg-card lg:bg-none">
        {isAdmin ? (
          <div className="w-full max-w-[400px]">
            <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" strokeWidth={2.2} />
            </span>
            <h2 className="font-display text-4xl font-bold tracking-tight">Admin portal</h2>
            <p className="mt-2 text-muted-foreground">
              Restricted access — staff sign-in only.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <Field label="Admin email">
                <Mail className="h-[18px] w-[18px] text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="admin@…"
                  className="w-full bg-transparent text-foreground"
                />
              </Field>

              <Field label="Password">
                <Lock className="h-[18px] w-[18px] text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-transparent text-foreground"
                />
              </Field>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="!mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Sign in to admin portal"}
              </button>
            </form>

            <button
              onClick={backToStudent}
              className="mx-auto mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to student login
            </button>
          </div>
        ) : (
        <div className="w-full max-w-[400px]">
          <h2 className="font-display text-4xl font-bold tracking-tight">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {isRegister
              ? "Register with your campus email to report issues."
              : "Sign in to report and track hostel issues."}
          </p>

          <div className="mt-7">
            <GoogleSignInButton
              onCredential={handleGoogle}
              fallback={
                <button
                  onClick={() => quickLogin("aisha.k@campus.edu", "hostel123")}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 font-semibold text-foreground shadow-card transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              }
            />
          </div>

          <div className="my-6 flex items-center gap-4">
            <hr className="flex-1 border-border" />
            <span className="text-sm text-muted-foreground">
              {isRegister ? "or register with email" : "or use email"}
            </span>
            <hr className="flex-1 border-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <Field label="Full name">
                <UserIcon className="h-[18px] w-[18px] text-muted-foreground" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Aisha Khan"
                  className="w-full bg-transparent text-foreground"
                />
              </Field>
            )}

            <Field label="Campus email">
              <Mail className="h-[18px] w-[18px] text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent text-foreground"
              />
            </Field>

            <Field label="Password">
              <Lock className="h-[18px] w-[18px] text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-transparent text-foreground"
              />
            </Field>

            {isRegister && (
              <Field label="Room (optional)">
                <Shield className="h-[18px] w-[18px] text-muted-foreground" />
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="C-214"
                  className="w-full bg-transparent text-foreground"
                />
              </Field>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="!mt-6 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account? " : "New here? "}
            <button
              onClick={() => {
                setError(null);
                setMode(isRegister ? "login" : "register");
              }}
              className="font-semibold text-primary hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>

          <hr className="my-6 border-border" />

          <button
            onClick={openAdmin}
            disabled={busy}
            className="mx-auto flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            <Shield className="h-4 w-4" strokeWidth={2.2} />
            Admin login
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
        {children}
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
