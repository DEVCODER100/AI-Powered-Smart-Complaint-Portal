import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Clock, AlertTriangle, ArrowUpDown, Users, Building2 } from "lucide-react";
import Logo from "@/components/Logo";
import CategoryIcon, { CATEGORY_LABEL } from "@/components/CategoryIcon";
import SeverityBadge from "@/components/SeverityBadge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, STATUS_ORDER, type AdminCluster, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const isOverdue = (c: AdminCluster) => c.status !== "done" && c.ageHours > c.slaTargetHours;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [clusters, setClusters] = useState<AdminCluster[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminComplaints()
      .then(({ clusters }) => setClusters(clusters))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const open = clusters.filter((c) => c.status !== "done").length;
  const overdue = clusters.filter(isOverdue).length;

  async function setStatus(id: string, status: Status) {
    // optimistic update, then persist
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await api.setStatus(id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              Admin
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground/60 transition-colors hover:bg-muted"
            aria-label="Log out"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <h1 className="font-display text-5xl font-bold tracking-tight">Admin dashboard</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {open} open issues · {overdue} overdue. The worklist arrives pre-sorted —
          you decide less.
        </p>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
        )}

        {/* summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Open issues" value={open} />
          <Stat
            label="Critical"
            value={clusters.filter((c) => c.severity === "critical" && c.status !== "done").length}
            accent="text-red-600"
          />
          <Stat label="Overdue (SLA)" value={overdue} accent="text-red-600" />
          <Stat
            label="Total reports"
            value={clusters.reduce((n, c) => n + c.othersReported + 1, 0)}
          />
        </div>

        <div className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          Sorted by severity, then report count
        </div>

        <div className="mt-4 space-y-4">
          {clusters.map((c) => (
            <ClusterRow key={c.id} cluster={c} onStatus={setStatus} />
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-bold", accent ?? "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function ClusterRow({
  cluster,
  onStatus,
}: {
  cluster: AdminCluster;
  onStatus: (id: string, s: Status) => void;
}) {
  const overdue = isOverdue(cluster);

  return (
    <article
      className={cn(
        "rounded-3xl border bg-card p-6 shadow-card transition-colors",
        cluster.severity === "critical" && cluster.status !== "done"
          ? "border-red-200 ring-1 ring-red-100"
          : "border-border/70"
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <CategoryIcon category={cluster.category} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold leading-tight">
              {CATEGORY_LABEL[cluster.category]} · {cluster.block} · {cluster.floor}
            </h3>
            <SeverityBadge severity={cluster.severity} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{cluster.id}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
            {cluster.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip icon={<Users className="h-3.5 w-3.5" />} className="bg-teal-50 text-teal-700">
              {cluster.othersReported + 1} students reported
            </Chip>
            <Chip icon={<Building2 className="h-3.5 w-3.5" />} className="bg-slate-100 text-slate-600">
              {cluster.department}
            </Chip>
            <Chip
              icon={overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              className={
                overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
              }
            >
              {overdue
                ? `Overdue · ${cluster.slaTargetHours}h SLA`
                : `${cluster.slaTargetHours}h response target`}
            </Chip>
          </div>
        </div>
      </div>

      {/* status control */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
        <span className="mr-1 text-sm font-medium text-muted-foreground">Move to:</span>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => onStatus(cluster.id, s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              cluster.status === s
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-foreground/70 hover:bg-muted/70"
            )}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </article>
  );
}

function Chip({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
