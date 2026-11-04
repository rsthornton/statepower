import { useEffect, useState } from "react";
import { YEARS, loadNetwork, type Network, type Year } from "./data";
import { PageShell } from "./PageShell";
import { repoFile } from "./repo";

type Verdict = { id: string; arc: string; detail: string; verdict: string };
type Registered = {
  report: string; thresholds_sha256: string; thresholds_commit: string; thresholds_commit_date: string; run: string;
  verdicts: Verdict[];
};

const ABOVE = "#0e7c86";
const BELOW = "#a15c00";
const readable = (d: string) =>
  d.replace(/>=/g, "\u2265").replace(/<=/g, "\u2264").replace(/\brho\b/g, "Spearman").replace(/top10/g, "top 10").replace(/out_degree/g, "export reach")
    .replace(/\beigenvector\b/g, "trade prestige").replace(/\bbetweenness\b/g, "bridge position").replace(/->/g, "to");
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

async function loadRegistered(): Promise<Registered> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/v2/registered.json`);
  if (!r.ok) throw new Error(`could not load registered.json (${r.status})`);
  return (await r.json()) as Registered;
}

function Dumbbell({ net }: { net: Network }) {
  const rows = net.states.filter((r) => Math.abs(r.gap_eigenvector) >= 5).sort((a, b) => b.gap_eigenvector - a.gap_eigenvector);
  const W = 640, L = 150, R = 50, H = 22, T = 28;
  const x = (rank: number) => L + ((rank - 1) / 50) * (W - L - R);
  return (
    <svg className="fp-chart" viewBox={`0 0 ${W} ${T + rows.length * H + 8}`} role="img"
      aria-label={`States whose trade prestige rank and GDP rank differ by five or more places, ${net.year}`}>
      {[1, 10, 20, 30, 40, 51].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={T - 6} y2={T + rows.length * H} className="grid" />
          <text x={x(t)} y={T - 10} textAnchor="middle" className="tick">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = T + i * H + H / 2;
        const color = r.gap_eigenvector > 0 ? ABOVE : BELOW;
        return (
          <g key={r.state} data-testid={`dumbbell-${r.state}`}>
            <text x={L - 10} y={y + 4} textAnchor="end" className="lab">{r.name}</text>
            <line x1={x(r.gdp_rank)} x2={x(r.rank_eigenvector)} y1={y} y2={y} stroke={color} strokeWidth={2} />
            <circle cx={x(r.gdp_rank)} cy={y} r={4} className="gdp" />
            <circle cx={x(r.rank_eigenvector)} cy={y} r={5} fill={color} />
            <text x={W - R + 8} y={y + 4} className="lab" fill={color}>{signed(r.gap_eigenvector)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FindingsPage() {
  const [year, setYear] = useState<Year>("2017");
  const [nets, setNets] = useState<Record<string, Network>>({});
  const [reg, setReg] = useState<Registered | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(YEARS.map((y) => loadNetwork(y)))
      .then((list) => setNets(Object.fromEntries(list.map((n) => [String(n.year), n]))))
      .catch((e: Error) => setError(e.message));
    loadRegistered().then(setReg).catch((e: Error) => setError(e.message));
  }, []);

  const net = nets[year];
  const apart = net ? net.states.filter((r) => Math.abs(r.gap_eigenvector) >= 5).length : 0;
  const under = net ? net.states.filter((r) => r.gap_eigenvector >= 5) : [];
  const ever = net && Object.keys(nets).length === 3
    ? nets["2017"].states.map((r, i) => [r, YEARS.map((y) => nets[y].states[i].gap_eigenvector)] as const)
      .filter(([, g]) => g.some((v) => v >= 5))
      .sort((a, b) => b[1].filter((v) => v >= 5).length - a[1].filter((v) => v >= 5).length || b[1][1] - a[1][1])
    : [];

  return (
    <PageShell kicker="US interstate freight · findings" title="Network position and GDP, 2012 to 2022">
        {error && <p className="fm-error">Could not load data: {error}</p>}

        <section className="fp-section" data-testid="findings-gap">
          <div className="fp-head">
            <h2>Trade prestige rank and GDP rank</h2>
            <div className="fm-seg" role="group" aria-label="Year">
              {YEARS.map((y) => <button key={y} className={y === year ? "on" : ""} aria-pressed={y === year} onClick={() => setYear(y)} data-testid={`findings-year-${y}`}>{y}</button>)}
            </div>
          </div>
          {net && (
            <>
              <p data-testid="findings-summary">
                In {year}, {apart} of 51 states rank five or more places away from their GDP rank in trade prestige.
                {" "}{under.length} rank five or more places above it, the structurally undervalued states: {under.map((r) => r.name).join(", ")}.
              </p>
              <Dumbbell net={net} />
              <p className="small muted">Grey dot: GDP rank. Colored dot: trade prestige rank (in-flow eigenvector centrality, all commodities except crude petroleum). Rank 1 is highest. Teal: above GDP rank; ochre: below.</p>
            </>
          )}
        </section>

        <section className="fp-section" data-testid="findings-years">
          <h2>Undervalued in which surveys</h2>
          <p>States five or more places above their GDP rank in at least one survey. The value is GDP rank minus trade prestige rank.</p>
          {ever.length > 0 && (
            <table className="fm-table fp-table">
              <thead><tr><th scope="col">State</th>{YEARS.map((y) => <th scope="col" key={y}>{y}</th>)}</tr></thead>
              <tbody>
                {ever.map(([r, g]) => (
                  <tr key={r.state}>
                    <td>{r.name}</td>
                    {g.map((v, i) => <td key={YEARS[i]} className={v >= 5 ? "strong" : "muted"}>{signed(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="fp-section" data-testid="findings-registered">
          <h2>The registered test</h2>
          {reg && (
            <>
              <p>
                Thresholds for three forecasts were committed to the public repository on {reg.thresholds_commit_date} (commit{" "}
                <code>{reg.thresholds_commit}</code>, SHA-256 <code>{reg.thresholds_sha256.slice(0, 12)}…</code>) and evaluated on the full
                2012, 2017 and 2022 files on {reg.run}. 2017 is the anchor; 2017 to 2012 tests the past, 2017 to 2022 the forecast.
              </p>
              <table className="fm-table fp-table fp-stack">
                <thead><tr><th scope="col">Test</th><th scope="col">Comparison</th><th scope="col">Result against threshold</th><th scope="col">Verdict</th></tr></thead>
                <tbody>
                  {reg.verdicts.map((v) => (
                    <tr key={v.id} data-testid={`verdict-${v.id}`}>
                      <td className="nowrap">{v.id}</td><td className="nowrap" data-label="Comparison">{v.arc.replace("->", "to")}</td><td data-label="Result">{readable(v.detail)}</td>
                      <td className={v.verdict === "HOLD" ? "strong" : "muted"} data-label="Verdict">{v.verdict === "HOLD" ? "Held" : "Exploratory"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">H1: rank stability of the three measures and the top 10. H2: backbone overlap. H3: commodity reorganization. H4 and H5 were reported as exploratory, without registered thresholds. Report: <a href={repoFile(`evolution/results/${reg.report}/report.md`)}><code>evolution/results/{reg.report}/</code></a>; thresholds: <a href={repoFile("evolution/thresholds.yaml")}><code>evolution/thresholds.yaml</code></a>.</p>
            </>
          )}
        </section>
    </PageShell>
  );
}
