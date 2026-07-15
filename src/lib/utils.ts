import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a number of minutes-ago into the short relative label used in the UI. */
export function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hours = Math.round(minutesAgo / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/** Format an assignment ETA window in the viewer's local timezone. */
export function formatEtaWindow(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const day = s.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const e = end ? new Date(end) : null;
  return e && !Number.isNaN(e.getTime()) ? `${day}, ${t(s)} – ${t(e)}` : `${day}, ${t(s)}`;
}
