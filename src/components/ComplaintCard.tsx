import { Users, Wrench, Phone, Clock } from "lucide-react";
import type { Complaint } from "@/lib/types";
import { relativeTime, formatEtaWindow } from "@/lib/utils";
import CategoryIcon, { CATEGORY_LABEL } from "./CategoryIcon";
import SeverityBadge from "./SeverityBadge";
import StatusPill from "./StatusPill";
import ProgressTracker from "./ProgressTracker";

export default function ComplaintCard({ complaint }: { complaint: Complaint }) {
  return (
    <article className="rounded-3xl border border-border/70 bg-card p-6 shadow-card">
      {/* header */}
      <div className="flex items-start gap-4">
        <CategoryIcon category={complaint.category} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-foreground">
            {CATEGORY_LABEL[complaint.category]} · {complaint.block} · {complaint.floor}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {complaint.id} · {relativeTime(complaint.reportedAgoMinutes)}
          </p>
        </div>
        <SeverityBadge severity={complaint.severity} />
      </div>

      {/* AI title with the original report expandable underneath */}
      {complaint.title ? (
        <div className="mt-4">
          <p className="text-[15px] font-semibold leading-relaxed text-foreground">
            {complaint.title}
          </p>
          <details className="mt-1 group">
            <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">
              <span className="group-open:hidden">Show original report</span>
              <span className="hidden group-open:inline">Hide original report</span>
            </summary>
            <p className="mt-1.5 rounded-xl bg-muted/50 px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground/80">
              {complaint.description}
            </p>
          </details>
        </div>
      ) : (
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/90">
          {complaint.description}
        </p>
      )}

      {/* attached photo / video (F15) */}
      {complaint.mediaUrl && complaint.mediaType === "image" && (
        <a href={complaint.mediaUrl} target="_blank" rel="noreferrer" className="mt-4 block w-fit">
          <img
            src={complaint.mediaUrl}
            alt="complaint attachment"
            className="h-28 w-28 rounded-xl border border-border object-cover shadow-sm transition-transform hover:scale-[1.02]"
          />
        </a>
      )}
      {complaint.mediaUrl && complaint.mediaType === "video" && (
        <video
          src={complaint.mediaUrl}
          controls
          playsInline
          className="mt-4 h-40 w-fit max-w-full rounded-xl border border-border object-cover shadow-sm"
        />
      )}

      {/* status + cluster count */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatusPill status={complaint.status} />
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
          <Users className="h-4 w-4" strokeWidth={2.2} />
          {complaint.othersReported} others reported this
        </span>
      </div>

      {/* assigned worker (F10) — who is coming + ETA + tappable phone */}
      {complaint.assignment && complaint.status !== "rejected" && (
        <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Assigned · help is on the way
              </p>
              <p className="mt-0.5 font-semibold text-foreground">
                {complaint.assignment.workerName}
                <span className="font-normal text-muted-foreground"> · {complaint.assignment.workerRole}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {formatEtaWindow(complaint.assignment.etaStart, complaint.assignment.etaEnd) && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" strokeWidth={2.2} />
                    {formatEtaWindow(complaint.assignment.etaStart, complaint.assignment.etaEnd)}
                  </span>
                )}
                <a
                  href={`tel:${complaint.assignment.workerPhone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" strokeWidth={2.2} />
                  {complaint.assignment.workerPhone}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <hr className="my-5 border-border/70" />

      {complaint.status === "rejected" ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This complaint was reviewed and rejected. If the problem persists, you can report it
          again with more detail.
        </p>
      ) : (
        <ProgressTracker status={complaint.status} />
      )}
    </article>
  );
}
