const REPO_URL = "https://github.com/rsthornton/statepower";

export default function Footer() {
  return (
    <footer
      className="mx-6 mt-8 mb-6 pt-5 flex flex-wrap items-center justify-between gap-3 text-xs"
      style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
    >
      <div className="max-w-xl leading-relaxed">
        Data: Commodity Flow Survey 2017, U.S. Census Bureau and Bureau of Transportation
        Statistics. State GDP from the U.S. Bureau of Economic Analysis. Centrality computed on the
        survey-weighted interstate shipment network.
      </div>
      <div className="flex items-center gap-4 whitespace-nowrap">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          Source and methods
        </a>
        <span>Built by Halcyonic Systems</span>
      </div>
    </footer>
  );
}
