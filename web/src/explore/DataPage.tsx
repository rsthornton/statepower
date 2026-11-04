import { useEffect, useState } from "react";
import { PageShell } from "./PageShell";
import { int } from "./data";

type FileInfo = { path: string; group: string; bytes: number; rows: number; columns: string[]; sha256: string };

const BASE = `${import.meta.env.BASE_URL}downloads`;
const GROUPS: [string, string][] = [
  ["2012", "2012"],
  ["2017", "2017"],
  ["2022", "2022"],
  ["thesis_2017", "Thesis tables, 2017"],
];
const size = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export default function DataPage() {
  const [files, setFiles] = useState<FileInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest.json (${r.status})`))))
      .then((m: { files: FileInfo[] }) => setFiles(m.files))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <PageShell kicker="US interstate freight · data" title="Data downloads">
      <section className="fp-section">
        <p>
          Every number on this site comes from the files below, derived from the Commodity Flow Survey public-use files
          for 2012, 2017 and 2022. The full data dictionary is in <a href={`${BASE}/README.md`}>README.md</a>; checksums are
          in <a href={`${BASE}/SHA256SUMS.txt`}>SHA256SUMS.txt</a>.
        </p>
        <h2>Two series</h2>
        <p>
          <b>Network series</b> (states and edges): interstate shipments of every commodity except crude petroleum (SCTG 16),
          which the 2022 survey does not cover, so the three years are comparable. This is the series of the pre-registered
          2012 to 2022 test.
        </p>
        <p>
          <b>Commodity series</b> (commodity flows): 40 two-digit SCTG commodities; unknown, live animals, crude petroleum, other
          and grouped codes are excluded. This is the series behind the map's Flows and Reliance views and the state profiles.
        </p>
        <p>
          <b>Thesis tables</b>: the 2017 network as analyzed in the M.S. thesis, including crude petroleum, with and without a
          rest-of-world node. Its 2017 rankings differ from the network series by at most two places for six states; both give
          the same 11 structurally undervalued states.
        </p>
      </section>

      <section className="fp-section" data-testid="data-files">
        <h2>Files</h2>
        {error && <p className="fm-error">Could not load the file list: {error}</p>}
        {files && GROUPS.map(([g, label]) => {
          const list = files.filter((f) => f.group === g);
          if (!list.length) return null;
          return (
            <table key={g} className="fm-table fp-table fp-stack">
              <caption className="fp-caption">{label}</caption>
              <thead><tr><th scope="col">File</th><th scope="col">Rows</th><th scope="col">Size</th><th scope="col">Columns</th></tr></thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.path} data-testid={`file-${f.path}`}>
                    <td className="nowrap"><a href={`${BASE}/${f.path}`} download>{f.path.split("/").pop()}</a></td>
                    <td className="nowrap pair" data-label="Rows">{int(f.rows)}</td>
                    <td className="nowrap pair" data-label="Size">{size(f.bytes)}</td>
                    <td className="small" data-label="Columns">{f.columns.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </section>

      <section className="fp-section">
        <h2>Definitions</h2>
        <ul>
          <li><b>Dollars</b>: weighted shipment value, shipment value × weight factor, in current dollars of the survey year.</li>
          <li><b>Interstate</b>: origin state differs from destination state; within-state shipments are excluded.</li>
          <li><b>Direction</b>: every edge runs from origin to destination.</li>
          <li><b>Records</b>: the number of survey records behind a row. Few records mean an uncertain estimate.</li>
          <li><b>Ranks</b>: 1 is highest. A state with zero betweenness has no bridge rank (no brokerage).</li>
        </ul>
        <p className="small muted">Survey estimates, not a census of shipments. The survey excludes most farm shipments, crude oil and gas extraction, imports until they leave their first U.S. location, and services.</p>
      </section>

      <section className="fp-section">
        <h2>Raw sources</h2>
        <table className="fm-table fp-table">
          <thead><tr><th scope="col">Year</th><th scope="col">File</th><th scope="col">Source</th></tr></thead>
          <tbody>
            <tr><td>2012</td><td>CFS 2012 Public Use Microdata File</td><td><a href="https://www.census.gov/data/datasets/2012/econ/cfs/historical-datasets.html">census.gov</a></td></tr>
            <tr><td>2017</td><td>CFS 2017 Public Use File</td><td><a href="https://www.census.gov/data/datasets/2017/econ/cfs/historical-datasets.html">census.gov</a></td></tr>
            <tr><td>2022</td><td>CFS 2022 Public Use Microdata Sample</td><td><a href="https://www.census.gov/data/datasets/2022/econ/cfs/historical-datasets.html">census.gov</a></td></tr>
            <tr><td>2017</td><td>Freight Analysis Framework 5 (rest-of-world node, thesis tables only)</td><td><a href="https://www.bts.gov/faf">bts.gov/faf</a></td></tr>
            <tr><td>all</td><td>State GDP, fourth quarter of each survey year (SQGDP1)</td><td>Bureau of Economic Analysis</td></tr>
          </tbody>
        </table>
      </section>

      <section className="fp-section">
        <h2>Rebuild from the raw files</h2>
        <ol>
          <li>Clone the repository and create its Python environment (see the repository README).</li>
          <li>Download the three public-use files and set their paths in <code>evolution/configs/cfs_&lt;year&gt;.yaml</code>.</li>
          <li>Build the year bundles: <code>python evolution/run_evolution.py</code>.</li>
          <li>Write these files: <code>python scripts/export_site_data.py --evolution-cache evolution/cache</code>.</li>
          <li>Check them: <code>python -m pytest tests/test_site_data.py</code>.</li>
        </ol>
        <h2>Citing</h2>
        <p>Thornton, S. (2026). <i>Testing Network Centrality for Economic Power Measurement: Structure and Boundaries in U.S. Interstate Trade.</i> M.S. thesis, Binghamton University. A data DOI will be listed here when one is issued.</p>
      </section>
    </PageShell>
  );
}
