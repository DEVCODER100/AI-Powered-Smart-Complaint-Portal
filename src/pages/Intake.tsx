import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import TopNav from "@/components/TopNav";
import Toast from "@/components/Toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Intake() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasText = text.trim().length > 0;

  async function handleSubmit() {
    if (!hasText || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { message } = await api.createComplaint(text.trim());
      setToast(message);
      setTimeout(() => navigate("/complaints"), 1900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
      setSubmitting(false);
    }
  }

  return (
    <div className="app-bg min-h-screen">
      <TopNav active="report" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-foreground/80 shadow-sm">
          <Sparkles className="h-4 w-4 text-accent" strokeWidth={2.4} />
          AI-powered intake
        </span>

        <h1 className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight">
          What's the problem?
        </h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Just describe it in your own words. No forms, no dropdowns — our AI
          sorts out the category, location and urgency for you.
        </p>

        <div className="mt-8 rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. No water in Block C second floor since morning..."
            rows={5}
            className="w-full resize-none bg-transparent text-lg leading-relaxed text-foreground placeholder:text-muted-foreground/60"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{text.length} characters</span>
            <button
              onClick={handleSubmit}
              disabled={!hasText || submitting}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white shadow-soft transition-all",
                hasText
                  ? "submit-gradient-active hover:brightness-105"
                  : "submit-gradient cursor-not-allowed opacity-90"
              )}
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.4} />
              {submitting ? "Understanding..." : "Understand & submit"}
            </button>
          </div>
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      </main>

      {toast && <Toast message={toast} />}
    </div>
  );
}
