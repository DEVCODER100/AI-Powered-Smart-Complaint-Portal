import { Droplet, Wifi, Zap, Sparkles, MessageSquare } from "lucide-react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONFIG: Record<Category, { Icon: typeof Wifi; className: string }> = {
  plumbing: { Icon: Droplet, className: "bg-sky-100 text-sky-600" },
  wifi: { Icon: Wifi, className: "bg-indigo-100 text-indigo-600" },
  electrical: { Icon: Zap, className: "bg-amber-100 text-amber-600" },
  cleaning: { Icon: Sparkles, className: "bg-teal-100 text-teal-600" },
  other: { Icon: MessageSquare, className: "bg-slate-100 text-slate-600" },
};

export const CATEGORY_LABEL: Record<Category, string> = {
  plumbing: "Plumbing",
  wifi: "WiFi",
  electrical: "Electrical",
  cleaning: "Cleaning",
  other: "General",
};

export default function CategoryIcon({
  category,
  size = "md",
}: {
  category: Category;
  size?: "sm" | "md";
}) {
  const { Icon, className } = CONFIG[category];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        size === "md" ? "h-11 w-11" : "h-9 w-9",
        className
      )}
    >
      <Icon className={size === "md" ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.2} />
    </span>
  );
}
