import { interpolateDivergence } from "../lib/colors";

export type Year = "2012" | "2017" | "2022";
export const YEARS: readonly Year[] = ["2012", "2017", "2022"];

// [origin, destination, dollars in thousands, records, median shipment miles, centroid gap ratio]
export type Flow = [number, number, number, number, number, number | null];
// [d, o, share, r, nearest (A), gap (A), gap centroid, ratio centroid, adjacent, persistent]
export type Link = [number, number, number, number, number | null, number | null, number | null, number | null, boolean, boolean];
// [o, d, ln(observed / OD:OC:DC fit), bootstrap 5%, 95%, records, other surveys with the same sign]
export type Surprise = [number, number, number, number, number, number, number[]];

export type YearData = {
  usd: number;
  records: number;
  threeWayShare: number;
  supply: number[];
  inbound: number[];
  local: Record<string, [string, number, number, number, number]>;
  flows: Flow[];
  links: Link[];
  surprise: Surprise[];
  surpriseTested: number;
};
export type Commodity = { sctg: string; name: string; years: Record<Year, YearData> };

type ThreeWay = { total_correlation: number; three_way: number; three_way_null: number; three_way_after_distance: number; share_of_excess_explained_by_distance: number; dollars: { total_correlation: number; three_way: number } };
type EqRow = { max_abs_difference: number; largest_cell: number; ra_loss_bits: number; two_n_ln2_loss: number; poisson_deviance: number };
export type Common = {
  states: string[];
  names: string[];
  fips: string[];
  centroids: [number, number][];
  centroidMiles: number[][];
  adjacent: [number, number][];
  commodities: [string, string, Record<Year, [number, number, number]>][];
  years: Record<Year, { records: number; usd: number; three_way_bits: number }>;
  threeWay: Record<Year, ThreeWay>;
  equivalence: { records: number; cells: number; "O:D:C": EqRow; "OD:OC:DC": EqRow };
  bootstrap: { draws: number; links: Record<Year, number>; mean_reproduction: Record<Year, number> };
  surpriseSummary: { min_records: number; noise: Record<Year, { cells: number; median_boot_sd: number }> };
  surpriseStability: { years: string; min_records_both: number; cells: number; pearson: number }[];
  rankStability: { years: string; links_both: number; spearman_link: number }[];
  auditQuotes: Record<string, string>;
  thin: number;
  surpriseFloor: number;
};

const BASE = `${import.meta.env.BASE_URL}data/v2`;

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/${path}`);
  if (!r.ok) throw new Error(`could not load ${path} (${r.status})`);
  return (await r.json()) as T;
}

type Meta = Omit<Common, "years"> & { commoditySeries: Common["years"] };
let commonData: Common | null = null;
let pendingCommon: Promise<Common> | null = null;

// The site's meta.json in the shape the map was written against (`years` = per-year summary).
export function loadCommon(): Promise<Common> {
  if (commonData) return Promise.resolve(commonData);
  pendingCommon ??= getJSON<Meta>("meta.json").then(({ commoditySeries, ...rest }) => {
    commonData = { ...rest, years: commoditySeries };
    return commonData;
  });
  return pendingCommon;
}

export const common = (): Common => {
  if (!commonData) throw new Error("loadCommon() must resolve before the map renders");
  return commonData;
};

const commodities: Record<string, Promise<Commodity>> = {};
export function loadCommodity(sctg: string): Promise<Commodity> {
  commodities[sctg] ??= getJSON<Commodity>(`commodity/${sctg}.json`);
  return commodities[sctg];
}

export const key = (o: number, d: number) => o * 51 + d;

export function flowIndex(yd: YearData): Map<number, Flow> {
  const m = new Map<number, Flow>();
  for (const f of yd.flows) m.set(key(f[0], f[1]), f);
  return m;
}

export type Candidate = { state: number; supply: number; miles: number };

// Origins other than o and d whose total interstate shipments of the commodity are at least v,
// nearest first by centroid miles to d (the audit's E-centroid definition).
export function candidates(yd: YearData, o: number, d: number, v: number): Candidate[] {
  const miles = common().centroidMiles;
  const out: Candidate[] = [];
  yd.supply.forEach((s, a) => {
    if (a !== o && a !== d && s >= v && s > 0) out.push({ state: a, supply: s, miles: miles[a][d] });
  });
  return out.sort((x, y) => x.miles - y.miles);
}

export const share = (yd: YearData, f: Flow) => (yd.inbound[f[1]] > 0 ? f[2] / yd.inbound[f[1]] : 0);

export function usd(k: number): string {
  const v = k * 1e3;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
export const pct = (x: number) => (x >= 0.995 && x < 1 ? "over 99%" : x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
export const times = (lr: number) => {
  const r = Math.exp(lr);
  return r >= 1 ? `${r >= 10 ? Math.round(r) : r.toFixed(1)} times` : `1/${(1 / r) >= 10 ? Math.round(1 / r) : (1 / r).toFixed(1)}`;
};
export const int = (n: number) => n.toLocaleString("en-US");

export function confidence(records: number): { label: string; tier: 0 | 1 | 2 | 3 } {
  if (records < common().thin) return { label: `thin: ${records} record${records === 1 ? "" : "s"}`, tier: 0 };
  if (records < 30) return { label: `${records} records`, tier: 1 };
  if (records < 300) return { label: `${records} records`, tier: 2 };
  return { label: `${int(records)} records`, tier: 3 };
}

// [inbound $K, inbound records, outbound $K, outbound records, within-state $K, within-state records,
//  top suppliers [[state, share of inbound]], top receivers [[state, share of outbound]]]
export type BalanceRow = [number, number, number, number, number, number, [number, number][], [number, number][]];
export type Balance = { sctgs: string[]; names: Record<string, string>; years: Record<Year, Record<string, BalanceRow[]>> };

type BalanceYear = { sctgs: string[]; names: Record<string, string>; rows: Record<string, BalanceRow[]> };
let pendingBalance: Promise<Balance> | null = null;
export function loadBalance(): Promise<Balance> {
  pendingBalance ??= Promise.all(YEARS.map((y) => getJSON<BalanceYear>(`balance/${y}.json`))).then((parts) => {
    const years = {} as Balance["years"];
    const names: Record<string, string> = {};
    const sctgs = new Set<string>();
    parts.forEach((b, i) => {
      years[YEARS[i]] = b.rows;
      Object.assign(names, b.names);
      b.sctgs.forEach((c) => sctgs.add(c));
    });
    return { sctgs: [...sctgs].sort(), names, years };
  });
  return pendingBalance;
}

// Network series (registered evolution bundles): each state's three centralities for a year, and
// every interstate edge.
export type Measure = "eigenvector" | "betweenness" | "out_degree";
export type NetworkState = {
  state: string; name: string; fips: string;
  eigenvector: number; betweenness: number; out_degree: number;
  rank_eigenvector: number; rank_betweenness: number; rank_out_degree: number;
  no_brokerage: boolean; gdp_billions: number; gdp_rank: number; gap_eigenvector: number;
};
export type Network = { year: number; states: NetworkState[]; edges: [string, string, number][] };

const networks: Record<string, Promise<Network>> = {};
export function loadNetwork(year: Year): Promise<Network> {
  networks[year] ??= getJSON<Network>(`network/${year}.json`);
  return networks[year];
}

/** One plain sentence per measure, shown under the measure picker. */
export const MEASURE_PLAIN: Record<Measure, string> = {
  eigenvector: "High when a state receives a lot from states that are themselves central, the way a paper gains standing when well-cited papers cite it.",
  betweenness: "How often a state sits between two others on the network's shortest trade paths, where heavy trade counts as a short step.",
  out_degree: "How much a state ships to other states, compared with the biggest shipper.",
};

export const MEASURE_NAMES: Record<Measure, string> = {
  eigenvector: "Trade prestige",
  betweenness: "Bridge position",
  out_degree: "Export reach",
};

// Post hoc lattice over origin, destination and commodity (analysis/higher_order/run_lattice.py).
// Ladder shares are net of a sampling null, by records with a record-bootstrap interval; `dollars` has neither.
export type RaRung = { structure: string; reading: string; captured: number; low: number; high: number; raw: number; dollars: number };
// Per state (in common().states order): its share of what pairs miss over its share of records, with an interval;
// netOfSize is the log residual of that ratio on the size share across states, whose slope is sizeSlope.
export type RaSide = { carry: number[]; low: number[]; high: number[]; netOfSize: number[]; sizeSlope: number };
// [partner, sctg, records, records the pairwise model expects]
export type RaCell = [number, string, number, number];
export type Side = "shipping" | "receiving";
export type Ra = {
  year: number; postHoc: true; ladder: RaRung[];
  shipping: RaSide; receiving: RaSide; shippingAfterDistance: RaSide; receivingAfterDistance: RaSide;
  share: Record<Side, number[]>;
  cells: Record<string, Record<Side, RaCell[]>>;
};

/** Each state's ratio over the ratio typical for a state its size (1 = typical). */
export const adjusted = (ra: Ra, side: Side) => ra[side].netOfSize.map((v) => Math.exp(v));

/** Position on the diverging ramp: half to double the typical ratio, on a log scale. */
export const rampT = (r: number) => Math.max(0, Math.min(1, 0.5 + Math.log2(r) / 2));
export const rampColor = (r: number) => interpolateDivergence(rampT(r));

let pendingRa: Promise<Record<Year, Ra>> | null = null;
export function loadRa(): Promise<Record<Year, Ra>> {
  pendingRa ??= Promise.all(YEARS.map((y) => getJSON<Ra>(`ra/${y}.json`)))
    .then((rs) => Object.fromEntries(YEARS.map((y, i) => [y, rs[i]])) as Record<Year, Ra>);
  return pendingRa;
}
