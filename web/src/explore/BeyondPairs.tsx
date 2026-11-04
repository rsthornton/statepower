import { YEARS, common, int, pct, type Ra, type Side, type Year } from "./data";
import { interpolateDivergence } from "../lib/colors";

// The Beyond pairs view: how much of the shipments' structure every pair of origin, destination and
// commodity captures, and which states carry what pairs miss. All of it is post hoc.

const PAIRS = "OD:OC:DC";
const SIDE_WORD: Record<Side, string> = { shipping: "shipping", receiving: "receiving" };

export const RAMP = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(interpolateDivergence).join(", ")})`;

/** How many times more a state half the size carries, on the fitted size line. */
const halfSize = (slope: number) => 2 ** -slope;
const ratio = (r: number) => `${r.toFixed(r >= 9.95 ? 0 : 1)}×`;
const comName = (sctg: string) => common().commodities.find((c) => c[0] === sctg)?.[1] ?? `SCTG ${sctg}`;

export const DRAWN_2022 = "The 2022 survey file is a differently drawn sample, so compare states within a year, not across years.";

export function PostHoc() {
  return <div className="tier" data-testid="ra-posthoc">Post hoc, exploratory</div>;
}

export function LadderPanel({ ras, year, side }: { ras: Record<Year, Ra>; year: Year; side: Side }) {
  const ra = ras[year];
  const pairs = ra.ladder.find((r) => r.structure === PAIRS)!;
  const slope = ra[side].sizeSlope;
  return (
    <div data-testid="ra-ladder">
      <section className="fm-claim">
        <PostHoc />
        <h3>How much do pairs capture?</h3>
        <p>
          Take away each state's and each commodity's size, and what is left is structure: who ships what to whom.
          Models of pairs, such as gravity models and the network measures, keep every pair of origin, destination and
          commodity. In {year} they capture <b data-testid="ra-pairs-share">{pct(pairs.dollars)}</b> of that structure,
          counted by dollars. The other {pct(1 - pairs.dollars)} is what pairs miss.
        </p>
        <p className="small">
          Smaller states carry more of it. Across {SIDE_WORD[side]} states, one half the size of another carries
          about {ratio(halfSize(slope))} as much per shipment record. The map colors each state against states its size.
        </p>
      </section>
      <h3>The ladder</h3>
      <p className="small muted">Each step keeps more of the table. Share of the structure captured, by dollars; the bar is {year}.</p>
      <ol className="ra-rungs">
        {ra.ladder.map((r) => (
          <li key={r.structure} className={r.structure === PAIRS ? "on" : ""} data-testid={`ra-rung-${r.structure}`}>
            <div className="ra-rung-head"><code>{r.structure.replace("+distance", " + distance")}</code><span>{r.reading}</span></div>
            <span className="bar"><i style={{ width: `${Math.max(0, r.dollars) * 100}%` }} /></span>
            <div className="ra-rung-years">
              {YEARS.map((y) => {
                const v = ras[y].ladder.find((x) => x.structure === r.structure)?.dollars ?? 0;
                return <span key={y} className={y === year ? "now" : ""}>{y} {pct(v)}</span>;
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="small muted">
        By dollars, as on the rest of the site, the ladder holds across all three surveys. The same ladder by survey
        records, with sampling intervals, is under How it's measured.
      </p>
    </div>
  );
}

export function PairsStatePanel({ ra, side, state, year, onPick, onCell }: {
  ra: Ra; side: Side; state: number | null; year: Year; onPick: (s: number | null) => void; onCell: (sctg: string, o: number, d: number) => void;
}) {
  const cm = common();
  if (state === null) return <p className="muted">Click a state, or choose one above, to see how much of what pairs miss it carries as a {SIDE_WORD[side]} state, and the shipments pairs fall shortest on.</p>;
  const s = ra[side], after = ra[`${side}AfterDistance`];
  const adj = Math.exp(s.netOfSize[state]);
  const cells = ra.cells[cm.states[state]]?.[side] ?? [];
  return (
    <div data-testid="ra-state-panel">
      <h2>{cm.names[state]}</h2>
      <p className="muted">As a {SIDE_WORD[side]} state · {year} · post hoc</p>
      <div className="fm-big">
        <div><b data-testid="ra-adjusted">{ratio(adj)}</b><span>what pairs miss, against states its size</span></div>
        <div><b data-testid="ra-raw">{ratio(s.carry[state])}</b><span>its size share ({ratio(s.low[state])} to {ratio(s.high[state])})</span></div>
      </div>
      <div className="fm-row"><span>Share of shipment records, {SIDE_WORD[side]}</span><b>{pct(ra.share[side][state])}</b></div>
      <div className="fm-row"><span>Against its size share, after distance</span><b>{ratio(after.carry[state])}</b></div>
      <p className="small muted">
        1× is typical. The raw ratio is the state's share of what pairs miss over its share of records; the interval
        covers record sampling only, not the survey's design.{year === "2022" ? ` ${DRAWN_2022}` : ""}
      </p>
      <h3>Where pairs fall shortest</h3>
      <p className="small">The shipments the model of pairs most underpredicts, in survey records. Choose one to open the route.</p>
      <div className="fm-cands" data-testid="ra-cells">
        {cells.map(([partner, sctg, records, expected]) => {
          const [o, d] = side === "shipping" ? [state, partner] : [partner, state];
          return (
            <button key={`${partner}-${sctg}`} onClick={() => onCell(sctg, o, d)} data-testid={`ra-cell-${partner}-${sctg}`}>
              <span>{side === "shipping" ? "to" : "from"} {cm.names[partner]} · {comName(sctg)}</span>
              <span className="muted">{int(records)} records, pairs expect {int(Math.round(expected))}</span>
            </button>
          );
        })}
        {!cells.length && <p className="muted small">No shipment here falls short of the model of pairs.</p>}
      </div>
      <button className="fm-btn ghost" onClick={() => onPick(null)}>Clear state</button>
    </div>
  );
}

export function PairsLegend({ side, year }: { side: Side; year: Year }) {
  return (
    <div data-testid="ra-legend">
      <div className="fm-legend-title">What pairs miss, as a {SIDE_WORD[side]} state</div>
      <p className="fm-legend-def ra-legend-long">Color and height: each state's share of what pairs miss, against states its size. Post hoc.</p>
      <div className="fm-ramp"><span>½×</span><i style={{ background: RAMP }} /><span>2×</span></div>
      <p className="fm-legend-def">Middle: typical for its size.{year === "2022" ? " 2022 is a differently drawn sample." : ""}</p>
    </div>
  );
}

export function RaDrawer({ ra, year, side }: { ra: Ra; year: Year; side: Side }) {
  return (
    <section className="fm-def" data-testid="ra-drawer">
      <h3>Beyond pairs</h3>
      <p>How much of the shipments' structure each model captures, and which states carry what the model of every pair misses. Post hoc: chosen after seeing the data, not registered in advance.</p>
      <details>
        <summary>The formal version</summary>
        <div className="fm-formal">
          <p>Shipment records form a table <code>p(o, d, c)</code> over origin state, destination state and commodity. A structure keeps some of its margins: <code>OD:OC:DC</code> keeps every pair. Its fit <code>q</code> is the maximum-entropy table with those margins, found by iterative proportional fitting. That is also the Poisson log-linear model with the matching fixed effects. A state does not ship interstate to itself, so those cells stay zero.</p>
          <pre>{"L(M)   = Σ p log₂(p / q_M)          bits\nshare  = 1 − (L(M) − N(M)) / (L(O:D:C) − N(O:D:C))"}</pre>
          <p><code>N(M)</code> is the loss of tables of the same size drawn from M's own fit: what sampling alone would leave. The distance step adds a commodity-specific distance profile to every pair.</p>
          <table className="fm-table" data-testid="ra-records">
            <caption className="small muted">{year}, by survey records, net of sampling. 95% intervals resample records; they do not cover the survey's design.</caption>
            <thead><tr><th scope="col">Structure</th><th scope="col">Captured</th><th scope="col">Interval</th><th scope="col">Dollars</th></tr></thead>
            <tbody>
              {ra.ladder.map((r) => (
                <tr key={r.structure}><td><code>{r.structure}</code></td><td>{(r.captured * 100).toFixed(1)}%</td>
                  <td>{(r.low * 100).toFixed(1)} to {(r.high * 100).toFixed(1)}</td><td>{(r.dollars * 100).toFixed(1)}%</td></tr>
              ))}
            </tbody>
          </table>
          <p>A state's ratio is its share of what pairs miss over its share of records, both as a {SIDE_WORD[side]} state:</p>
          <pre>{"r_s = [(L_s − N_s) / (L − N)] / share_s"}</pre>
          <p>Here <code>L_s</code> sums the loss over the state's cells. Weighted by share, the ratios average 1. Across the 51 states, log r falls with log share (slope {ra[side].sizeSlope.toFixed(2)} in {year}). The map shows <code>exp</code> of each state's residual from that line: its ratio against the ratio typical for its size.</p>
          <p><b>Not claimed:</b> why any shipment departs from pairs; that the size line is a law; anything about the survey's design error. By records, 2022 does not compare with the earlier surveys, so year comparisons use dollars. Code: <code>analysis/higher_order/ra.py</code> and <code>run_lattice.py</code>.</p>
        </div>
      </details>
    </section>
  );
}
