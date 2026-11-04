import { useEffect, useState, type ReactNode } from "react";
import { readTheme, saveTheme, type ThemeName } from "../engine/theme";
import { CSS } from "./styles";
import { SiteBar } from "./SiteBar";

/** Site bar, page heading and a readable column, for the text pages (Findings, Data, Methods). */
export function PageShell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);
  useEffect(() => {
    document.title = `${title} · Interstate Power Observatory`;
  }, [title]);
  return (
    <div className="fm fp">
      <style>{CSS}</style>
      <header className="fm-top">
        <SiteBar theme={theme} onTheme={setTheme} />
      </header>
      <main className="fp-main" id="main" tabIndex={-1}>
        <div className="fp-title">
          <span className="fm-kicker">{kicker}</span>
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
