import { useEffect, useState } from "react";
import TopNav from "@/components/TopNav";
import ComplaintCard from "@/components/ComplaintCard";
import { api } from "@/lib/api";
import type { Complaint } from "@/lib/types";

export default function MyComplaints() {
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myComplaints()
      .then(({ complaints }) => setComplaints(complaints))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const active = complaints?.filter((c) => c.status !== "done").length ?? 0;
  const resolved = complaints?.filter((c) => c.status === "done").length ?? 0;

  return (
    <div className="app-bg min-h-screen">
      <TopNav active="complaints" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <h1 className="font-display text-5xl font-bold tracking-tight">My complaints</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {active} active · {resolved} resolved. We'll ping you on every change.
        </p>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
        )}

        {complaints === null && !error ? (
          <div className="mt-8 space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl border border-border/70 bg-card/60" />
            ))}
          </div>
        ) : complaints && complaints.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-border/70 bg-card p-10 text-center text-muted-foreground shadow-card">
            No complaints yet. Head to <span className="font-semibold text-foreground">Report</span> to raise one.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {complaints?.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
