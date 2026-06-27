import { Sparkles } from "lucide-react";

export default function Toast({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-0 bottom-8 z-[60] flex justify-center px-4">
      <div className="flex max-w-md items-start gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-pop animate-pop-in">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full brand-gradient">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.4} />
        </span>
        <p className="text-sm font-medium leading-snug text-foreground">{message}</p>
      </div>
    </div>
  );
}
