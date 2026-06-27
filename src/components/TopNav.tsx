import { Link, useNavigate } from "react-router-dom";
import { PencilLine, ListChecks, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import Logo from "./Logo";
import NotificationsDropdown from "./NotificationsDropdown";

interface TopNavProps {
  active: "report" | "complaints";
}

function initials(name?: string) {
  if (!name) return "ME";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TopNav({ active }: TopNavProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link to="/">
          <Logo />
        </Link>

        <nav className="flex items-center gap-1 rounded-full">
          <NavPill to="/" icon={<PencilLine className="h-4 w-4" />} label="Report" active={active === "report"} />
          <NavPill
            to="/complaints"
            icon={<ListChecks className="h-4 w-4" />}
            label="My Complaints"
            active={active === "complaints"}
          />
        </nav>

        <div className="flex items-center gap-3">
          <NotificationsDropdown />
          <span
            title={user?.name}
            className="grid h-10 w-10 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent-foreground"
          >
            {initials(user?.name)}
          </span>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground/60 transition-colors hover:bg-muted"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavPill({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "text-foreground/70 hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
