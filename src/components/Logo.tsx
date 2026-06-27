import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** "dark" = navy/teal wordmark on light bg; "light" = white wordmark for dark panels. */
  variant?: "dark" | "light";
  className?: string;
  tileClassName?: string;
}

export default function Logo({ variant = "dark", className, tileClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl brand-gradient shadow-soft",
          tileClassName
        )}
      >
        <Sparkles className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
      </span>
      <span className="font-display text-[17px] font-bold leading-tight tracking-tight whitespace-nowrap">
        <span className="text-accent">AI</span>
        <span className={variant === "light" ? "text-white" : "text-foreground"}>
          {" "}
          Powered Complaint Portal
        </span>
      </span>
    </div>
  );
}
