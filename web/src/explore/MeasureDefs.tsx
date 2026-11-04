import type { ReactNode } from "react";
import { YEARS, common, int, pct } from "./data";

const PAIRS_LINE = "Gravity models and centrality see trade through pairs. The three-way part measures how much of trade those pairs miss, and shows which routes carry the miss.";

export function Def({ title, short, children }: { title: string; short: string; children: ReactNode }) {
  return (
    <section className="fm-def">
      <h3>{title}</h3>
      <p>{short}</p>
      <details>
        <summary>The formal version</summary>
        <div className="fm-formal">{children}</div>
      </details>
    </section>
  );
}

export function MeasurePanel() {
  const cm = common();
  const q = cm.auditQuotes;
  const eq = cm.equivalence["OD:OC:DC"];
  const tw = YEARS.map((y) => cm.threeWay[y]);
  return (
    <div data-testid="measure-panel">
      <h3>All commodities: the network measures</h3>
      <Def title="Trade prestige" short="High when a state receives large shipments from states that themselves score high.">
        <p>In-flow eigenvector centrality. With <code>A_ij</code> the dollars from state i to state j:</p>
        <pre>{"x_j = (1/λ) Σ_i A_ij x_i      (x = Aᵀx / λ)"}</pre>
        <p>The full definitions and the thesis correction are on the <a href="/methods">Methods</a> page.</p>
      </Def>
      <Def title="Bridge position" short="How often a state lies on the shortest paths between other states, where heavy trade counts as a short step.">
        <p>Betweenness centrality with edge distance = largest edge value / edge value. A state on no shortest path is shown as "no brokerage". This is position in the network, not physical routing.</p>
      </Def>
      <Def title="Export reach" short="What a state ships to other states, relative to the largest shipper.">
        <pre>{"reach_i = Σ_j A_ij / max_k Σ_j A_kj"}</pre>
      </Def>
      <h3>One commodity</h3>
      <Def title="Share" short="Of everything a state receives of one commodity from other states, the fraction that comes from one origin.">
        <p>With <code>v(o,d,c)</code> the weighted dollars (WGT_FACTOR × SHIPMT_VALUE) shipped from state o to state d of commodity c:</p>
        <pre>{`share(o→d, c) = v(o,d,c) / Σ_o' v(o',d,c)
HHI(d, c)      = Σ_o share(o→d, c)²
national(o, c) = Σ_d v(o,d,c) / Σ_o',d v(o',d,c)`}</pre>
        <p>A majority link is a route with share above 0.5. In-state shipments are not in the survey's interstate total, so "supply" here means supply from other states.</p>
      </Def>
      <Def title="Alternative, as a distance gap" short="How much farther the nearest other state that ships at least as much of the commodity sits, compared with the current supplier.">
        <pre>{`S(a, c)  = Σ_d v(a,d,c)   (a's interstate shipments)
a*       = argmin m(a, d)  over a ∉ {o, d}, S(a,c) ≥ v(o,d,c)
ratio    = m(a*, d) / max(m(o, d), 1)
gap      = m(a*, d) − m(o, d)  miles`}</pre>
        <p><code>m</code> is the great-circle distance between the states' 2020 centers of population, on both sides. The audit found this ratio the most stable gap measure across surveys (rank correlation {q.ratioSpearman}). Caveats: a supplier's output may be committed elsewhere; there are no prices, capacity, grades or modal access; centers are crude for large states, so a ratio below 1 can occur.</p>
        <p>An earlier version used a bound relative to each route's own shipment distance. The audit showed that bound flags short, neighbouring routes by construction ("no alternative" routes: median distance {q.noneMedianR}; {q.noneAdjacent} between adjacent states, against a base rate of {q.adjacentBase}), and that mixing distance definitions flipped the label for {q.definitionFlip} route-years. So the map shows a continuous ratio and no "no alternative" label.</p>
      </Def>
      <Def title="Persistence" short="Whether the same origin holds a majority of a destination's supply in 2012, 2017 and 2022.">
        <p>Majority links: {YEARS.map((y) => `${int(cm.bootstrap.links[y])} in ${y}`).join(", ")}. Two bootstrap replicates of one survey ({int(cm.bootstrap.draws)} draws, records resampled with Poisson weights) keep {q.bootKept} of each other's links; consecutive real surveys keep {q.observedKept}. Sampling alone accounts for about {q.samplingChurn} of the churn, and that is a lower bound, since the public files carry no strata or establishment clusters. Persistent links are mostly the well-measured ones; persistence is read here as "well recorded", not "locked in".</p>
      </Def>
      <Def title="What pairs miss" short={PAIRS_LINE}>
        <p>Treat each dollar as a draw of (origin, destination, commodity) with distribution <code>p</code>. The all-pairs model <code>OD:OC:DC</code> is the maximum-entropy <code>q</code> that keeps every two-way margin of <code>p</code>, found by iterative proportional fitting:</p>
        <pre>{`repeat until the margins match:
  q ← q · p(o,d,·) / q(o,d,·)
  q ← q · p(o,·,c) / q(o,·,c)
  q ← q · p(·,d,c) / q(·,d,c)
loss = KL(p ‖ q) = Σ p · log₂(p / q)   bits
surprise(o,d,c) = ln( p(o,d,c) / q(o,d,c) )`}</pre>
        <p>This is the Poisson gravity model with all pairwise fixed effects, log E[x] = α(o,d) + β(o,c) + γ(d,c): on the 2017 division table the two fits agree to {eq.max_abs_difference.toExponential(1)} in every cell, and 2N ln2 × loss equals the Poisson deviance ({eq.two_n_ln2_loss.toFixed(1)}).</p>
        <table className="fm-table">
          <thead><tr><th>Survey</th><th>All dependence</th><th>Three-way part</th><th>Share</th><th>Sampling null</th></tr></thead>
          <tbody>
            {YEARS.map((y, i) => (
              <tr key={y}><td>{y}</td><td>{tw[i].total_correlation.toFixed(3)} bits</td><td>{tw[i].three_way.toFixed(3)} bits</td><td>{pct(tw[i].three_way / tw[i].total_correlation)}</td><td>{tw[i].three_way_null.toFixed(3)}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="small">Counted by records. About a fifth of the dependence is three-way, well above the sampling null. Route-level surprises are noisy (bootstrap standard deviation of a log ratio {q.surpriseSd}; cross-survey correlation {q.surpriseCorr30} at 30+ records, {q.surpriseCorr300} at 300+), so the Route panel shows one only with 300 or more records or the same sign in another survey.</p>
      </Def>
    </div>
  );
}

