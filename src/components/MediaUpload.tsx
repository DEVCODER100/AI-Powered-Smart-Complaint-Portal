import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { prepareMedia, type SelectedMedia } from "@/lib/media";

interface Props {
  value: SelectedMedia | null;
  onChange: (media: SelectedMedia | null) => void;
  /** Upload progress 0–100 while the parent is submitting, or null when idle. */
  progress?: number | null;
  disabled?: boolean;
}

export default function MediaUpload({ value, onChange, progress = null, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (value) URL.revokeObjectURL(value.previewUrl);
      onChange(await prepareMedia(file));
    } catch (err) {
      onChange(null);
      setError(err instanceof Error ? err.message : "Could not use that file");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange(null);
    setError(null);
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground/80 shadow-sm transition-colors hover:border-accent/50 hover:bg-muted/40 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin text-accent" />
          ) : (
            <Camera className="h-[18px] w-[18px] text-accent" strokeWidth={2.2} />
          )}
          Add a photo or short video
        </button>
      ) : (
        <div className="relative w-fit overflow-hidden rounded-xl border border-border bg-card p-1 shadow-sm">
          {value.type === "image" ? (
            <img src={value.previewUrl} alt="attachment preview" className="h-28 w-28 rounded-lg object-cover" />
          ) : (
            <video
              src={value.previewUrl}
              className="h-28 w-28 rounded-lg object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          )}

          {progress !== null && progress < 100 && (
            <div className="absolute inset-1 grid place-items-center rounded-lg bg-black/45 text-sm font-semibold text-white">
              {progress}%
            </div>
          )}

          {progress === null && (
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              aria-label="Remove attachment"
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      <p className="mt-1.5 text-xs text-muted-foreground">
        Optional — one photo or a video up to 15s. Helps the worker find and fix it faster.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
