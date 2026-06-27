import { AlertTriangle, Info, Flame } from "lucide-react";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONFIG: Record<
  Severity,
  { label: string; className: string; Icon: typeof Info }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-700",
    Icon: Flame,
  },
  high: {
    label: "High",
    className: "bg-amber-100 text-amber-700",
    Icon: AlertTriangle,
  },
  normal: {
    label: "Normal",
    className: "bg-sky-100 text-sky-700",
    Icon: Info,
  },
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, className, Icon } = CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      {label}
    </span>
  );
}
