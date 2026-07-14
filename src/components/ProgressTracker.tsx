import { Check } from "lucide-react";
import type { Status } from "@/lib/types";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_BG: Record<Status, string> = {
  pending: "bg-slate-800",
  "in-progress": "bg-blue-500",
  waiting: "bg-amber-500",
  done: "bg-green-500",
  rejected: "bg-red-500", // rejected is rendered as a banner, not a tracker step
};

const STAGE_RING: Record<Status, string> = {
  pending: "ring-slate-800/15",
  "in-progress": "ring-blue-500/20",
  waiting: "ring-amber-500/25",
  done: "ring-green-500/20",
  rejected: "ring-red-500/20",
};

export default function ProgressTracker({ status }: { status: Status }) {
  const current = STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-start">
      {STATUS_ORDER.map((stage, i) => {
        const completed = i < current;
        const isCurrent = i === current;
        const lineActive = i <= current; // segment leading into this step

        return (
          <div key={stage} className="contents">
            {i > 0 && (
              <div className="flex-1 pt-[17px]">
                <div
                  className={cn(
                    "h-[3px] rounded-full transition-colors",
                    lineActive ? "bg-primary" : "bg-slate-200"
                  )}
                />
              </div>
            )}

            <div className="flex w-9 shrink-0 flex-col items-center gap-2">
              {completed ? (
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-white",
                    STAGE_BG[stage]
                  )}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </div>
              ) : isCurrent ? (
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ring-4",
                    STAGE_BG[stage],
                    STAGE_RING[stage]
                  )}
                >
                  {i + 1}
                </div>
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-200 bg-white text-sm font-semibold text-slate-400">
                  {i + 1}
                </div>
              )}

              <span
                className={cn(
                  "whitespace-nowrap text-center text-xs font-medium",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : completed
                      ? "text-foreground/70"
                      : "text-slate-400"
                )}
              >
                {STATUS_LABEL[stage]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
