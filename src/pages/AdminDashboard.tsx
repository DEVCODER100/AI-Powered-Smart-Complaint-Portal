import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  Users,
  Building2,
  Copy,
  Flag,
  RotateCcw,
  Split,
  XCircle,
  Wrench,
  Phone,
} from "lucide-react";
import Logo from "@/components/Logo";
import CategoryIcon, { CATEGORY_LABEL } from "@/components/CategoryIcon";
import SeverityBadge from "@/components/SeverityBadge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  type AdminCluster,
  type Reporter,
  type Status,
  type Worker,
} from "@/lib/types";
import { cn, formatEtaWindow } from "@/lib/utils";

// datetime-local wants "YYYY-MM-DDTHH:mm" in the viewer's local time.
function toLocalInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const PAGE_SIZE = 25;

const isOverdue = (c: AdminCluster) =>
  c.status !== "done" && c.status !== "rejected" && c.ageHours > c.slaTargetHours;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [clusters, setClusters] = useState<AdminCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminComplaints(PAGE_SIZE, 0)
      .then(({ clusters, total }) => {
        setClusters(clusters);
        setTotal(total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { clusters: next, total } = await api.adminComplaints(PAGE_SIZE, clusters.length);
      setClusters((prev) => [...prev, ...next]);
      setTotal(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  const open = clusters.filter((c) => c.status !== "done" && c.status !== "rejected").length;
  const overdue = clusters.filter(isOverdue).length;

  async function setStatus(id: string, status: Status, reason?: string) {
    setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await api.setStatus(id, status, reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  function replaceCluster(updated: AdminCluster, detached?: AdminCluster) {
    setClusters((prev) => {
      const next = prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
      return detached ? [detached, ...next] : next;
    });
    if (detached) setTotal((t) => t + 1);
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
            value={
              clusters.filter(
                (c) => c.severity === "critical" && c.status !== "done" && c.status !== "rejected"
              ).length
            }
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
            <ClusterRow key={c.id} cluster={c} onStatus={setStatus} onChanged={replaceCluster} />
          ))}
        </div>

        {clusters.length < total && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground shadow-card transition-colors hover:bg-muted disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : `Load more (${clusters.length} of ${total})`}
            </button>
          </div>
        )}
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
  onChanged,
}: {
  cluster: AdminCluster;
  onStatus: (id: string, s: Status, reason?: string) => void;
  onChanged: (updated: AdminCluster, detached?: AdminCluster) => void;
}) {
  const overdue = isOverdue(cluster);
  const terminal = cluster.status === "done" || cluster.status === "rejected";
  const [reporters, setReporters] = useState<Reporter[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // Worker-assignment panel state (F10).
  const [assignOpen, setAssignOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [workerId, setWorkerId] = useState<number | "">("");
  const [etaStart, setEtaStart] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [etaEnd, setEtaEnd] = useState(() => toLocalInput(new Date(Date.now() + 3 * 60 * 60 * 1000)));
  const [assigning, setAssigning] = useState(false);

  async function openAssign() {
    setRowError(null);
    setAssignOpen((o) => !o);
    if (workers === null) {
      try {
        const { workers } = await api.workers(cluster.department);
        setWorkers(workers);
        if (workers[0]) setWorkerId(workers[0].id);
      } catch (err) {
        setRowError(err instanceof Error ? err.message : "Failed to load workers");
      }
    }
  }

  async function assign() {
    if (!workerId) return;
    setAssigning(true);
    setRowError(null);
    try {
      const { complaint } = await api.assignWorker(cluster.id, {
        workerId: Number(workerId),
        etaStart: new Date(etaStart).toISOString(),
        etaEnd: new Date(etaEnd).toISOString(),
      });
      onChanged(complaint);
      setAssignOpen(false);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to assign worker");
    } finally {
      setAssigning(false);
    }
  }

  async function toggleReporters(e: React.MouseEvent) {
    e.preventDefault();
    if (reporters) {
      setReporters(null);
      return;
    }
    try {
      const { reporters } = await api.reporters(cluster.id);
      setReporters(reporters);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to load reporters");
    }
  }

  async function detach(userId: number) {
    setBusy(true);
    setRowError(null);
    try {
      const { cluster: updated, detached } = await api.detachReporter(cluster.id, userId);
      onChanged(updated, detached);
      setReporters((prev) => prev?.filter((r) => r.userId !== userId) ?? null);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to detach reporter");
    } finally {
      setBusy(false);
    }
  }

  function reject() {
    const reason = window.prompt("Reason for rejecting (optional):") ?? undefined;
    onStatus(cluster.id, "rejected", reason || undefined);
  }

  return (
    <article
      className={cn(
        "rounded-3xl border bg-card p-6 shadow-card transition-colors",
        cluster.severity === "critical" && !terminal
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

          {cluster.title ? (
            <>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-foreground">
                {cluster.title}
              </p>
              <details className="group mt-0.5">
                <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">
                  <span className="group-open:hidden">Show original report</span>
                  <span className="hidden group-open:inline">Hide original report</span>
                </summary>
                <p className="mt-1.5 rounded-xl bg-muted/50 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground/80">
                  {cluster.description}
                </p>
              </details>
            </>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
              {cluster.description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={toggleReporters}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[13px] font-medium text-teal-700 transition-colors hover:bg-teal-100"
              title="View reporters"
            >
              <Users className="h-3.5 w-3.5" />
              {cluster.othersReported + 1} students reported
            </button>
            <Chip icon={<Building2 className="h-3.5 w-3.5" />} className="bg-slate-100 text-slate-600">
              {cluster.department}
            </Chip>
            {cluster.assignment && (
              <Chip icon={<Wrench className="h-3.5 w-3.5" />} className="bg-emerald-100 text-emerald-700">
                {cluster.assignment.workerName}
              </Chip>
            )}
            <Chip
              icon={overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              className={overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}
            >
              {overdue
                ? `Overdue · ${cluster.slaTargetHours}h SLA`
                : `${cluster.slaTargetHours}h response target`}
            </Chip>
            {cluster.aiFlagged && (
              <Chip icon={<Flag className="h-3.5 w-3.5" />} className="bg-amber-100 text-amber-800">
                Needs review — AI uncertain
              </Chip>
            )}
            {cluster.possibleDuplicateOf && (
              <Chip icon={<Copy className="h-3.5 w-3.5" />} className="bg-purple-100 text-purple-700">
                Possible duplicate of {cluster.possibleDuplicateOf}
              </Chip>
            )}
          </div>

          {cluster.mediaUrl && cluster.mediaType === "image" && (
            <a href={cluster.mediaUrl} target="_blank" rel="noreferrer" className="mt-3 block w-fit">
              <img
                src={cluster.mediaUrl}
                alt="complaint attachment"
                className="max-h-64 rounded-xl border border-border object-contain shadow-sm"
              />
            </a>
          )}
          {cluster.mediaUrl && cluster.mediaType === "video" && (
            <video
              src={cluster.mediaUrl}
              controls
              playsInline
              className="mt-3 max-h-64 w-fit max-w-full rounded-xl border border-border shadow-sm"
            />
          )}

          {reporters && (
            <div className="mt-3 rounded-2xl border border-border/70 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reporters
              </p>
              <ul className="space-y-2">
                {reporters.map((r) => (
                  <li key={r.userId} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground">{r.name}</span>
                      {r.rawText && (
                        <p className="truncate text-muted-foreground" title={r.rawText}>
                          “{r.rawText}”
                        </p>
                      )}
                    </div>
                    {reporters.length > 1 && (
                      <button
                        onClick={() => detach(r.userId)}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/70 transition-colors hover:bg-muted disabled:opacity-50"
                        title="Split this report into its own complaint"
                      >
                        <Split className="h-3 w-3" />
                        Detach
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rowError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">
              {rowError}
            </p>
          )}
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

        <span className="mx-1 h-5 w-px bg-border" />

        {terminal ? (
          <button
            onClick={() => onStatus(cluster.id, "pending")}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </button>
        ) : (
          <button
            onClick={reject}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              cluster.status === "rejected"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        )}

        {!terminal && (
          <button
            onClick={openAssign}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <Wrench className="h-3.5 w-3.5" />
            {cluster.assignment ? "Reassign worker" : "Assign worker"}
          </button>
        )}
      </div>

      {/* assign panel (F10) */}
      {assignOpen && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          {cluster.assignment && (
            <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-emerald-800">
              <span className="font-semibold">Currently:</span>
              {cluster.assignment.workerName} · {cluster.assignment.workerRole}
              <a href={`tel:${cluster.assignment.workerPhone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {cluster.assignment.workerPhone}
              </a>
              {formatEtaWindow(cluster.assignment.etaStart, cluster.assignment.etaEnd) && (
                <span className="text-emerald-700">
                  · {formatEtaWindow(cluster.assignment.etaStart, cluster.assignment.etaEnd)}
                </span>
              )}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Worker ({cluster.department})
              </span>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {workers === null && <option>Loading…</option>}
                {workers?.length === 0 && <option value="">No workers in this department</option>}
                {workers?.map((w) => (
                  <option key={w.id} value={w.id} disabled={!w.isAvailable}>
                    {w.name} · {w.role}
                    {w.isAvailable ? "" : " (unavailable)"}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Arrival from
                </span>
                <input
                  type="datetime-local"
                  value={etaStart}
                  onChange={(e) => setEtaStart(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  to
                </span>
                <input
                  type="datetime-local"
                  value={etaEnd}
                  onChange={(e) => setEtaEnd(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={assign}
              disabled={assigning || !workerId}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              <Wrench className="h-3.5 w-3.5" />
              {assigning ? "Assigning…" : "Confirm assignment"}
            </button>
            <button
              onClick={() => setAssignOpen(false)}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <span className="text-xs text-muted-foreground">Assigning moves this to In Progress and notifies reporters.</span>
          </div>
        </div>
      )}
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
