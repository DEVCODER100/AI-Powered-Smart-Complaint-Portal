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
