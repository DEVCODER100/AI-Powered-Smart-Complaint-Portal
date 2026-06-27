import { Users } from "lucide-react";
import type { Complaint } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
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

      {/* description */}
      <p className="mt-4 text-[15px] leading-relaxed text-foreground/90">
        {complaint.description}
      </p>

      {/* status + cluster count */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatusPill status={complaint.status} />
        <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
          <Users className="h-4 w-4" strokeWidth={2.2} />
          {complaint.othersReported} others reported this
        </span>
      </div>

      <hr className="my-5 border-border/70" />

      <ProgressTracker status={complaint.status} />
    </article>
  );
}
