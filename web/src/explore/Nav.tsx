import { REPO } from "./repo";

const LINKS = [
  ["/", "Map"],
  ["/findings", "Findings"],
  ["/data", "Data"],
  ["/methods", "Methods"],
] as const;

export function Nav() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const here = path === "/explore" ? "/" : path;
  return (
    <nav className="fm-nav" aria-label="Site">
      {LINKS.map(([href, label]) => (
        <a key={href} href={href} aria-current={here === href ? "page" : undefined}>{label}</a>
      ))}
      <a href={REPO} data-testid="nav-code">Code</a>
    </nav>
  );
}
