import { useEffect, useState } from "react";
import { PageShell } from "./PageShell";
import { MeasurePanel } from "./MeasureDefs";
import { loadCommon } from "./data";
import { repoFile } from "./repo";

export default function MethodsPage() {
  const [common, setCommon] = useState(false);
  useEffect(() => {
    loadCommon().then(() => setCommon(true)).catch(() => setCommon(false));
  }, []);

  return (
    <PageShell kicker="US interstate freight · methods" title="Methods">
      <figure className="fp-epigraph" data-testid="methods-epigraph">
        <blockquote>Influence is thus conceived not as a substance or possession (e.g., GNP) but as a relational property that appears in the transactions of nations.</blockquote>
        <figcaption>Steven J. Brams, "Measuring the Concentration of Power in Political Systems," <i>American Political Science Review</i>, 1968</figcaption>
      </figure>
      <section className="fp-section" data-testid="methods-network">
        <h2>The network</h2>
        <p>
          Each of the 50 states and the District of Columbia is a node. An edge runs from origin state <i>i</i> to destination
          state <i>j</i>, weighted by the dollars shipped from <i>i</i> to <i>j</i> in the survey year (shipment value × weight
          factor, summed over records). Within-state shipments are excluded. Edges are directed: <i>i</i> to <i>j</i> and
          <i> j</i> to <i>i</i> are two different edges.
        </p>
      </section>

      <section className="fp-section" data-testid="methods-measures">
        <h2>Three measures</h2>
        <h3>Trade prestige: in-flow eigenvector centrality</h3>
        <p>A state scores high when it receives large shipments from states that themselves score high. With <i>A</i><sub>ij</sub> the dollars from <i>i</i> to <i>j</i>:</p>
        <pre>{"x_j = (1/λ) Σ_i A_ij x_i      (x = Aᵀx / λ, the leading eigenvector)"}</pre>
        <p className="small muted">
          This is the NetworkX default on a directed graph, and every value reported in the thesis and on this site uses it.
          Equation 3.2 of the thesis wrote the out-flow form; the correction is in <a href={repoFile("paper/ERRATA.md")}>paper/ERRATA.md</a>.
          On the thesis's 2017 network the in-flow and out-flow rankings correlate at 0.951.
        </p>
        <h3>Bridge position: betweenness centrality</h3>
        <p>
          How often a state lies on the shortest paths between other states. Edge distance is the largest edge value divided by
          the edge's value, so heavy trade is a short step. Normalized by NetworkX for a directed graph. A state on no shortest
          path has zero betweenness and is shown as "no brokerage" rather than given a tied rank.
        </p>
        <p className="small muted">
          This is position in the network, not physical routing: the survey records only where a shipment starts and ends, so a
          state on the path between two others does not mean their goods pass through it.
        </p>
        <h3>Export reach: weighted out-degree</h3>
        <pre>{"reach_i = Σ_j A_ij / max_k Σ_j A_kj"}</pre>
        <h3>Structurally undervalued</h3>
        <p>A state whose trade prestige rank is five or more places above its GDP rank (GDP rank minus trade prestige rank ≥ 5).</p>
      </section>

      <section className="fp-section" data-testid="methods-status">
        <h2>Registered and post hoc</h2>
        <p>
          <b>Registered.</b> Three forecasts with numeric thresholds for 2012, 2017 and 2022 (rank stability of the measures and
          the top 10, backbone overlap, commodity reorganization), committed before the full run. Thresholds:{" "}
          <a href={repoFile("evolution/thresholds.yaml")}>evolution/thresholds.yaml</a>; design: <a href={repoFile("evolution/README.md")}>evolution/README.md</a>;
          results: <a href={repoFile("evolution/results/evolution_20260808_093628/report.md")}>the run report</a> and the <a href="/findings">Findings</a> page.
        </p>
        <p>
          <b>Post hoc.</b> Everything else on the site was computed after the thesis and was not registered: the map's share,
          distance gap, persistence and three-way measures, the state profiles, and the table of undervalued states by survey.
          Write-ups: <a href={repoFile("analysis/higher_order/README.md")}>analysis/higher_order/README.md</a> and its{" "}
          <a href={repoFile("analysis/higher_order/audit/AUDIT.md")}>audit</a>.
        </p>
      </section>

      <section className="fp-section" data-testid="methods-map">
        <h2>Measures on the map (commodity series, post hoc)</h2>
        {common ? <div className="fp-defs"><MeasurePanel /></div> : <p className="muted">Loading…</p>}
      </section>

      <section className="fp-section">
        <h2>Documents</h2>
        <ul>
          <li><a href={repoFile("paper/thesis.pdf")}>Thesis</a> (M.S., Binghamton University, 2026)</li>
          <li><a href={repoFile("paper/ERRATA.md")}>Errata</a>: corrections to the thesis</li>
          <li><a href={repoFile("evolution/thresholds.yaml")}>Pre-registered thresholds</a> and <a href={repoFile("evolution/results/evolution_20260808_093628/report.md")}>run report</a></li>
          <li><a href="/data">Data downloads</a> and data dictionary</li>
        </ul>
      </section>
    </PageShell>
  );
}
