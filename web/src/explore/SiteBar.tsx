import { useEffect, useRef, useState } from "react";
import type { ThemeName } from "../engine/theme";
import { Nav } from "./Nav";

const APPEARANCES: [ThemeName, string][] = [
  ["observatorylight", "Observatory (light)"],
  ["observatory", "Observatory (dark)"],
  ["frostneutral", "Neutral"],
];

function AppearanceMenu({ theme, onTheme }: { theme: ThemeName; onTheme: (t: ThemeName) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="fm-appearance" ref={ref}>
      <button className="fm-icon" aria-label="Appearance" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="appearance">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="fm-menu" role="menu" aria-label="Appearance">
          {APPEARANCES.map(([t, label]) => (
            <button key={t} role="menuitemradio" aria-checked={t === theme} className={t === theme ? "on" : ""}
              onClick={() => { onTheme(t); setOpen(false); }} data-testid={`theme-${t}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The site's top bar: name, page navigation, appearance. Shared by the map and the text pages. */
export function SiteBar({ theme, onTheme, skipTo = "#main" }: { theme: ThemeName; onTheme: (t: ThemeName) => void; skipTo?: string }) {
  return (
    <div className="fm-site">
      <a className="fm-skip" href={skipTo}>Skip to content</a>
      <div className="fm-brandbox">
        <a className="fm-brand" href="/">Interstate Power Observatory</a>
        <span className="fm-tagline" data-testid="tagline">GDP is not equivalent to economic power.</span>
      </div>
      <Nav />
      <AppearanceMenu theme={theme} onTheme={onTheme} />
    </div>
  );
}
