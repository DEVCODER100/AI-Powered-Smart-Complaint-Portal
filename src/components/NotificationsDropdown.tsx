import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { relativeTime, cn } from "@/lib/utils";

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => n.unread).length;

  useEffect(() => {
    api
      .notifications()
      .then(({ notifications, total }) => {
        setItems(notifications);
        setTotal(total);
      })
      .catch(() => setItems([]));
  }, []);

  async function loadMore() {
    try {
      const { notifications, total } = await api.notifications(20, items.length);
      setItems((prev) => [...prev, ...notifications]);
      setTotal(total);
    } catch {
      /* keep what we have */
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await api.markAllRead();
    } catch {
      /* best-effort; UI already cleared */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground/70 transition-colors hover:bg-muted"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-background">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] origin-top-right animate-pop-in rounded-2xl border border-border bg-card p-2 shadow-pop">
          <div className="flex items-center justify-between px-3 py-2">
            <h4 className="font-display text-base font-bold">Notifications</h4>
            <button
              onClick={markAllRead}
              className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              Mark all read
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="max-h-[420px] overflow-auto">
              {items.map((n, i) => (
                <li key={n.id}>
                  {i > 0 && <hr className="mx-3 border-border/70" />}
                  <div className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60">
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        n.unread ? "bg-accent" : "bg-transparent"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-foreground">{n.title}</p>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">{n.body}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground/80">{relativeTime(n.agoMinutes)}</p>
                    </div>
                  </div>
                </li>
              ))}
              {items.length < total && (
                <li className="px-3 py-2">
                  <button
                    onClick={loadMore}
                    className="w-full rounded-lg border border-border py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Load more ({items.length} of {total})
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
