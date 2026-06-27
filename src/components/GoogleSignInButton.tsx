import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Google Identity Services must be initialized only once per page load.
let gisInitialized = false;

interface Props {
  onCredential: (credential: string) => void;
  /** Rendered when no Google Client ID is configured yet (keeps the app usable). */
  fallback: React.ReactNode;
  disabled?: boolean;
}

export default function GoogleSignInButton({ onCredential, fallback }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let tries = 0;
    const timer = setInterval(() => {
      const gid = window.google?.accounts?.id;
      if (gid && ref.current) {
        clearInterval(timer);
        if (!gisInitialized) {
          gid.initialize({
            client_id: CLIENT_ID,
            callback: (resp: { credential?: string }) => {
              if (resp.credential) onCredential(resp.credential);
            },
          });
          gisInitialized = true;
        }
        ref.current.replaceChildren();
        gid.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 360,
          logo_alignment: "center",
        });
        setRendered(true);
      } else if (++tries > 50) {
        clearInterval(timer); // GIS script never loaded -> fall back
      }
    }, 100);
    return () => clearInterval(timer);
  }, [onCredential]);

  if (!CLIENT_ID) return <>{fallback}</>;

  return (
    <div className="flex justify-center">
      <div ref={ref} />
      {!rendered && <div className="h-[44px]" />}
    </div>
  );
}
