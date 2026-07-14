import type { Status } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOT: Record<Status, string> = {
  pending: "bg-slate-400",
  "in-progress": "bg-blue-500",
  waiting: "bg-amber-500",
  done: "bg-green-500",
  rejected: "bg-red-500",
};

const TEXT: Record<Status, string> = {
  pending: "text-slate-600",
  "in-progress": "text-blue-600",
  waiting: "text-amber-600",
  done: "text-green-600",
  rejected: "text-red-600",
};

export default function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", TEXT[status])}>
      <span className={cn("h-2 w-2 rounded-full", DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}
