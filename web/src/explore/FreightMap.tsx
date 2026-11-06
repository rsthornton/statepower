import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FreightScene, type ArcSpec, type Hit, type Label } from "../engine/engine";
import {
  MEASURE_NAMES, MEASURE_PLAIN, YEARS, candidates, common, confidence, flowIndex, int, key, loadBalance, loadCommodity, loadNetwork, loadRa, pct, adjusted, rampColor, rampT, share, times, usd,
  type Balance, type Commodity, type Flow, type Measure, type Network, type Ra, type Side, type Year, type YearData,
} from "./data";
import { interpolateSequential } from "../lib/colors";
import { CSS, PHONE } from "./styles";
import { BringsIn, type BringDir, type BringHover } from "./BringsIn";
import { StateProfile } from "./StateProfile";
import { SiteBar } from "./SiteBar";
import { MeasurePanel } from "./MeasureDefs";
import { LadderPanel, PairsLegend, PairsStatePanel, RaDrawer } from "./BeyondPairs";
import { THEMES, readTheme, saveTheme, type Palette, type ThemeName } from "../engine/theme";

type View = "flows" | "reliance" | "position" | "pairs";
type Tab = "route" | "state" | "commodity" | "rankings" | "ladder" | "measure" | "about";
type Route = [number, number];

const HONESTY = "Source: Commodity Flow Survey, 2012, 2017 and 2022. Observed interstate shipments.";

// A flow stop opens on one route; `picks` lets the reader swap in another good, answered by topDependence.
type FlowStop = { kind: "flow"; title: string; lead: string; sctg: string; year: Year; view: View; o: string; d: string; picks?: string[]; text: (com: Commodity, f: Flow | undefined) => string };
// Stops that compare surveys get every year's network and the registered rank correlations.
type TourExtra = { nets: Record<Year, Network>; rho: { r2012: number; r2022: number; published: string } };
// say: the stop's takeaway, a few words pinned on the map to the state it is about ([state, text]); the card carries the detail.
type Say<T> = (data: T) => [string, string];
// bare: towers only, no ties drawn. lit: ties drawn in the contrasting color. marks: states labelled with both ranks, so the comparison sits on the map.
type PositionStop = { kind: "position"; title: string; lead: string; year: Year; measure: Measure; state?: string; focus?: string[]; marks?: string[]; extra?: boolean; gdp?: boolean; bare?: boolean; lit?: boolean; risers?: boolean; cycle?: boolean; text: (net: Network, x: TourExtra | null) => string; say?: Say<Network> };
// The Beyond pairs stop opens on the state carrying the most of what pairs miss, against states its size.
type PairsStop = { kind: "pairs"; title: string; lead: string; year: Year; side: Side; text: (ra: Ra) => string; say?: Say<Ra> };
type TourStop = FlowStop | PositionStop | PairsStop;
const topMissed = (ra: Ra, side: Side) => adjusted(ra, side).reduce((best, r, i, a) => (r > a[best] ? i : best), 0);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const TOUR_SEEN = "explore-tour-seen";
function tourSeen() {
  try { return localStorage.getItem(TOUR_SEEN) === "1"; } catch { return true; }
}
const ratioIn = (com: Commodity, y: Year, o: number, d: number) => com.years[y].flows.find((x) => x[0] === o && x[1] === d)?.[5] ?? null;
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const words = (n: number) => WORDS[n] ?? String(n);
const gapUp = (n: Network) => n.states.filter((x) => x.gdp_rank - x.rank_eigenvector >= 5);
// The lasting risers: `net`'s states ahead of their GDP rank by five or more places in every survey, largest gap in `net` first.
const lasting = (nets: Record<Year, Network>, net: Network) => {
  const keep = YEARS.map((y) => new Set(gapUp(nets[y]).map((s) => s.state)));
  return net.states.filter((s) => keep.every((k) => k.has(s.state))).sort((a, b) => (b.gdp_rank - b.rank_eigenvector) - (a.gdp_rank - a.rank_eigenvector));
};
// Planned data center power, not in this site's data. Source: dcmap.us/states, planned column, read 2026-11-05 (announced power;
// trackers disagree). pausedGw: Texas (73.6), Georgia (18.6), Ohio (13.8) and New York (5.7) together.
const PIPELINE_2026 = { totalGw: 276.4, pausedGw: 112, pausedShare: 40 };
// The same source and column, every state and DC, in GW. A state with no entry would count as 0, so a share can only be understated.
const PLANNED_GW_2026: Record<string, number> = {
  TX: 73.6, VA: 23.3, PA: 15, GA: 18.6, UT: 19.1, OH: 13.8, NM: 13.2, WV: 13.4, AZ: 9.3, IL: 8.7, IN: 4.6, NV: 4.9, KY: 7, NY: 5.7, IA: 2.9, LA: 3, WY: 3.2,
  ND: 2.5, MO: 2.7, OK: 3.6, CA: 2, OR: 1, WA: 1.4, WI: 0.21, NC: 1.5, AL: 2, MI: 1.2, NE: 2.1, SC: 2.2, KS: 2.2, AR: 1.7, CO: 1.9, ME: 2.1, MD: 1.1,
  TN: 0.168, MN: 1, MS: 0.28, MT: 1.3, NJ: 0.295, AK: 1.1, FL: 0.77, SD: 0.575, ID: 0.078, CT: 0.1, MA: 0.023, HI: 0, DE: 0, NH: 0, VT: 0, DC: 0, RI: 0,
};
const plannedShare = (states: string[]) => Math.round(100 * states.reduce((a, s) => a + (PLANNED_GW_2026[s] ?? 0), 0) / PIPELINE_2026.totalGw);
// Hypotheses: five cards opened from the toolbar, apart from the tour (Shingai, 2026-11-05). Each frames the lasting risers (five or more
// places ahead of their GDP rank in every survey; 2017 ranks shown), mutes the four paused states, and states a bet to check later.
// share: the risers' share of planned power, a whole percent; n: how many risers. Every card is stamped HYPOTHESIS: a claim, not a finding.
const HYP_DATE = "2026-11-05";
const PAUSED_2026 = ["TX", "GA", "OH", "NY"];
type HypCard = { head: string; text: (share: number, n: number) => string };
const HYPOTHESES: HypCard[] = [
  { head: "The question", text: (share, n) => `When the biggest economies close the door on data centers, where does the load go? New governors in Texas, Georgia and Ohio have promised a pause, and New York froze permits for big ones. Those four hold about ${PIPELINE_2026.pausedShare}% of the planned data center power in the country. The ${words(n)} states here have ranked at least five places higher by trade ties than by GDP in every Commodity Flow Survey since 2012. They hold about ${share}% of that planned power, and nobody has promised to pause them.` },
  { head: "Bet 1, load moves", text: (share, n) => `Data centers go to states that are not blocking them and already move a lot of goods. Pass: these ${words(n)}'s share of planned US data center capacity doubles, from ${share}% to ${2 * share}%, by December 2028. Kill: Texas lifts its pause within a year, or the share is flat or lower at the check.` },
  { head: "Bet 2, price, not pause", text: (_share, n) => `States the network values more than GDP does will price access rather than deny it. Pass: by the end of 2027 none of the ${words(n)} has a statewide moratorium, and at least two more have ratepayer laws of the Tennessee kind, where a data center pays for the grid it needs. Kill: any of the ${words(n)} passes a statewide pause.` },
  { head: "Bet 3, the ceiling", text: (_share, n) => `What they capture is bounded by grid headroom, not demand. Pass: at the 2028 check no single one of the ${words(n)} exceeds Texas's 2026 operating capacity (about 10.5 GW). Kill: one does, or self-generated power (the xAI Southaven model) makes the grid limit irrelevant.` },
  { head: "Scoreboard", text: () => `Three bets, placed ${HYP_DATE}. The baselines below are what each is checked against.` },
];
// Baselines on the day the bets were placed, and when each is checked.
const hypScoreboard = (share: number, risers: string[]) => {
  const big = risers.reduce((a, b) => ((PLANNED_GW_2026[b] ?? 0) > (PLANNED_GW_2026[a] ?? 0) ? b : a));
  return [
    `Bet 1: ${share}% on ${HYP_DATE} (dcmap.us planned column); check Dec 2028.`,
    `Bet 2: 0 of ${risers.length} with a statewide pause on ${HYP_DATE}; check Dec 2027.`,
    `Bet 3: largest of the ${words(risers.length)} is ${big} at ${PLANNED_GW_2026[big] ?? 0} GW planned on ${HYP_DATE}; check Dec 2028.`,
  ];
};
const HYP_SOURCES = [
  "Trade ties: Commodity Flow Survey 2012, 2017 and 2022, state-to-state shipment value (this site's data); ranks shown are 2017.",
  "GDP: BEA 2017.",
  "Planned data center power by state: dcmap.us/states, read 2026-11-05 (announced power; trackers disagree).",
  "Pledges: Fortune, 2026-11-04, \"Democrat wins will slow data center construction...\" (Hinojosa, Acton, Bottoms); New York Executive Order 62 as reported Nov 2026.",
  "Stamp: HYPOTHESIS, 2026-11-05.",
  "Ratepayer laws: Tennessee HB1847/SB2128 (2026) as reported by Quorum and MultiState; Texas 2026 operating capacity from dcmap.us.",
];
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const listNames = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// The tour tells one argument, the way Shingai puts it (2026-10-30): GDP is a total; power is exerted
// over someone, so it lives in ties; so measure states by their ties. The map shows each step before the card names it:
// towers alone (stop 1), the ties appear (2), the towers reshape by ties (3), then two states the ties reorder, zoomed and
// lit (4, 5), one good at a time (6), how lasting and how complete the picture is (7, 8), and the reader's turn (9).
// Beyond pairs waits for its own entrance (Shingai, 2026-11-04): hidden from visitors, kept behind ?pairs=1.
const PAIRS = (() => { try { return new URLSearchParams(location.search).has("pairs"); } catch { return false; } })();
const ALL_STOPS: TourStop[] = [
  {
    kind: "position", title: "Size", year: "2017", measure: "eigenvector", gdp: true, bare: true,
    say: () => ["NE", "Height is GDP: each state on its own"],
    lead: "Start with the usual picture of power: size.",
    text: (net) => {
      const top = [...net.states].sort((a, b) => a.gdp_rank - b.gdp_rank);
      return `Each state's height is its GDP in ${net.year}. ${listNames(top.slice(0, 3).map((x) => x.name))} stand tallest. GDP is a total: it adds up what a state produces on its own, and says nothing about whom it depends on.`;
    },
  },
  {
    kind: "position", title: "Ties", year: "2017", measure: "eigenvector", gdp: true, lit: true,
    say: () => ["NE", "Power runs through these ties"],
    lead: "Now add the ties.",
    text: (net) => `Each line is trade between two states in ${net.year}: every good, all commodities combined, in dollars. Thicker lines carry more. Power is exerted over someone, so it lives in these ties, not in totals.`,
  },
  {
    kind: "position", title: "Power is relational", year: "2017", measure: "eigenvector", lit: true,
    say: () => ["NE", "Now height is ties, not size"],
    lead: "Measure each state by its ties instead.",
    text: () => `${REDUCED_MOTION ? "" : "Watch the heights change. "}They now show trade prestige: a state ranks high when it takes in large shipments from states that rank high themselves, the way a paper gains standing when well-cited papers cite it.`,
  },
  {
    kind: "position", title: "Bigger than their GDP", year: "2017", measure: "eigenvector", state: "TX", focus: ["TX", "CA"], marks: ["CA"],
    say: (net) => { const t = net.states.find((x) => x.state === "TX")!; return ["TX", `Texas: ${ord(t.rank_eigenvector)} by ties, ${ord(t.gdp_rank)} by GDP`]; },
    lead: "Which state draws in more trade than its GDP suggests?",
    text: (net) => {
      const top = [...net.states].sort((a, b) => a.rank_eigenvector - b.rank_eigenvector)[0];
      const big = [...net.states].sort((a, b) => a.gdp_rank - b.gdp_rank)[0];
      const lead = top.gdp_rank > 1
        ? `${top.name}. It is ${ord(top.gdp_rank)} by GDP but first by trade prestige, ahead of ${big.name}, the larger economy.`
        : `${top.name} leads by both GDP and trade prestige.`;
      return `${lead} The lines now show only ${top.name}'s trade. The more of it comes from high-prestige states, the higher it ranks.`;
    },
  },
  {
    kind: "position", title: "Partners, not size", year: "2017", measure: "eigenvector", state: "KY", focus: ["KY", "MA"], marks: ["MA"],
    say: (net) => { const k = net.states.find((x) => x.state === "KY")!; return ["KY", `Kentucky: ${ord(k.gdp_rank)} by GDP, ${ord(k.rank_eigenvector)} by ties`]; },
    lead: "Something odd about Kentucky.",
    text: (net) => {
      const ky = net.states.find((x) => x.state === "KY")!, ma = net.states.find((x) => x.state === "MA")!;
      const most = Math.max(...net.states.map((x) => x.gdp_rank - x.rank_eigenvector));
      const from = net.edges.filter((e) => e[1] === "KY").sort((a, b) => b[2] - a[2]).slice(0, 4)
        .map((e) => net.states.find((x) => x.state === e[0])!);
      const worst = Math.max(...from.map((x) => x.rank_eigenvector));
      return `Kentucky is ${ord(ky.gdp_rank)} by GDP but ${ord(ky.rank_eigenvector)} by trade prestige${ky.gdp_rank - ky.rank_eigenvector === most ? ", the biggest jump of any state" : ""}. Its largest suppliers, ${listNames(from.map((x) => x.name))}, all rank in the top ${worst} themselves: its partners lift it. Massachusetts is the reverse: ${ord(ma.gdp_rank)} by GDP, ${ord(ma.rank_eigenvector)} by trade prestige.`;
    },
  },
  {
    kind: "flow", title: "Who depends on whom", lead: "Now one good: if one state stopped shipping it, who would feel it?",
    sctg: "17", year: "2022", view: "flows", o: "LA", d: "MS", picks: ["17", "21", "35", "36"],
    text: (com, f) => {
      if (!f) return "";
      const yd = com.years["2022"];
      const c = candidates(yd, f[0], f[1], f[2])[0];
      const r = ratioIn(com, "2022", f[0], f[1]);
      return `Mississippi. Louisiana supplies ${pct(share(yd, f))} of its interstate gasoline (${f[3]} survey records). That is not a lock-in: the next state shipping as much${c ? `, ${common().names[c.state]},` : ""} is ${r === null ? "n/a" : r.toFixed(1)} times as far away. Pipeline transmission and foreign imports are outside the survey, so energy dependence is understated.`;
    },
  },
  {
    kind: "position", title: "Not a snapshot", year: "2022", measure: "eigenvector", extra: true, cycle: true,
    say: () => ["NE", "The pattern barely moves"],
    lead: "Back to all goods: is this a snapshot or a lasting structure?",
    text: (_net, x) => {
      if (!x) return "";
      const n = lasting(x.nets, x.nets["2022"]).length;
      return `Lasting.${REDUCED_MOTION ? "" : " Watch the years change: the map barely moves."} A forecast published ${x.rho.published}, before the 2012 and 2022 data were analyzed, said rankings would match 2017's at 0.9 or better. They came in at ${x.rho.r2012.toFixed(3)} and ${x.rho.r2022.toFixed(3)}. The ${words(n)} labelled states beat their GDP rank by five or more places in every survey.`;
    },
  },
  {
    kind: "pairs", title: "Beyond pairs", year: "2017", side: "shipping",
    lead: "Do pairs of states tell the whole story?",
    say: (ra) => {
      const cm = common(), top = topMissed(ra, "shipping"), cell = ra.cells[cm.states[top]]?.shipping[0];
      const good = cell ? cm.commodities.find((c) => c[0] === cell[1])?.[1].toLowerCase() : undefined;
      // Pinned at the route's far end: the shipping state sits near the map's edge once both are framed.
      return cell && good ? [cm.states[cell[0]], `${cap(good)} from ${cm.names[top]}: ${int(cell[2])} shipments, pairs predict ${int(Math.round(cell[3]))}`] : [cm.states[top], "Pairs miss some routes"];
    },
    text: (ra) => {
      const cm = common();
      const pairs = ra.ladder.find((r) => r.structure === "OD:OC:DC")!;
      const top = topMissed(ra, "shipping");
      const cell = ra.cells[cm.states[top]]?.shipping[0];
      const good = cell ? cm.commodities.find((c) => c[0] === cell[1])?.[1].toLowerCase() : undefined;
      const example = cell && good
        ? ` Take ${good} from ${cm.names[top]} to ${cm.names[cell[0]]}: the survey's sample has ${int(cell[2])} shipments; pairs predict ${int(Math.round(cell[3]))}.`
        : "";
      return `Not quite. Everything so far looked at pairs: who trades with whom, what each state ships, what each receives. In ${ra.year}, pairs explain ${pct(pairs.dollars)} of the pattern, by dollars. The rest is particular goods on particular routes.${example} For its size, ${cm.names[top]} has the most that pairs miss, ${Math.exp(ra.shipping.netOfSize[top]).toFixed(1)} times a typical state. Exploratory: asked after seeing the data.`;
    },
  },
  {
    kind: "position", title: "Your turn", year: "2022", measure: "eigenvector",
    lead: "Explore it yourself.",
    text: () => "That is the core idea: to see power, look at connections, not totals. This is the first result of the Interstate Power Observatory. Click any state, choose one of 40 goods in the Commodity box above, or change the year. About has the author's note and how to send feedback.",
  },
];
const TOUR = PAIRS ? ALL_STOPS : ALL_STOPS.filter((t) => t.kind !== "pairs");

// The route where one state leans hardest on one supplier for a good: the largest share of a destination's interstate
// supply, among destinations at least median size and routes with enough survey records (small receivers swing to 100%).
function topDependence(yd: YearData): Flow | undefined {
  const med = [...yd.inbound].sort((a, b) => a - b)[Math.floor(yd.inbound.length / 2)];
  return yd.flows.filter((f) => f[3] >= common().thin && yd.inbound[f[1]] >= med && yd.inbound[f[1]] > 0)
    .reduce<Flow | undefined>((best, f) => (!best || share(yd, f) > share(yd, best) ? f : best), undefined);
}
function dependText(com: Commodity, year: Year, f: Flow | undefined) {
  if (!f) return "";
  const cm = common(), yd = com.years[year];
  const c = candidates(yd, f[0], f[1], f[2])[0];
  const r = ratioIn(com, year, f[0], f[1]);
  const energy = ["15", "17", "18", "19"].includes(com.sctg) ? " Pipeline transmission and foreign imports are outside the survey, so energy dependence is understated." : "";
  return `${cm.names[f[1]]}. ${cm.names[f[0]]} supplies ${pct(share(yd, f))} of its interstate ${com.name.toLowerCase()} (${f[3]} survey records), the largest such share for this good among mid-size and larger states.${c && r !== null ? ` The next state shipping as much, ${cm.names[c.state]}, is ${r.toFixed(1)} times as far away.` : ""}${energy}`;
}

// The opening card: the claim first, top-down, before the reader clicks in (review of 2026-10-30).
const OPENING_QUOTE = "Power is a property of the social relation; it is not an attribute of the actor.";
const OPENING_CITE = "Richard M. Emerson, “Power-Dependence Relations,” 1962";

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const q = new URLSearchParams(location.search);
  const r = p.get("r")?.split("-").map(Number);
  return {
    c: p.get("c") ?? undefined,
    y: (YEARS as readonly string[]).includes(p.get("y") ?? "") ? (p.get("y") as Year) : undefined,
    v: (["flows", "reliance", "position", "pairs"] as const).find((x) => x === p.get("v") && (PAIRS || x !== "pairs")),
    side: p.get("side") === "receiving" ? ("receiving" as const) : ("shipping" as const),
    r: r && r.length === 2 && r.every((n) => Number.isInteger(n)) ? (r as Route) : undefined,
    s: p.get("s") !== null ? Number(p.get("s")) : undefined,
    m: (["eigenvector", "betweenness", "out_degree"] as const).find((x) => x === p.get("m")),
    flat: p.get("flat") === "1",
    firstVisit: !location.hash.slice(1) && !q.has("t") && !tourSeen(),
    // ?t= freezes animation time (screenshots); reduced motion freezes it too, which also makes camera moves instant.
    t: q.get("t") !== null ? Number(q.get("t")) : matchMedia("(prefers-reduced-motion: reduce)").matches ? 4 : null,
  };
}

export default function FreightMap() {
  const cm = common();
  const init = useMemo(() => readHash(), []);
  const [sctg, setSctg] = useState(init.c ?? "17");
  const [year, setYear] = useState<Year>(init.y ?? "2017");
  const [view, setView] = useState<View>(init.v ?? "position");
  const [topN, setTopN] = useState(120);
  const [measure, setMeasure] = useState<Measure>(init.m ?? "eigenvector");
  const [commodityView, setCommodityView] = useState<"flows" | "reliance">(init.v === "reliance" ? "reliance" : "flows");
  const [flat, setFlat] = useState(init.flat);
  const [net, setNet] = useState<Network | null>(null);
  const [com, setCom] = useState<Commodity | null>(null);
  const [selState, setSelState] = useState<number | null>(init.s ?? null);
  const [route, setRoute] = useState<Route | null>(init.r ?? null);
  const [tab, setTab] = useState<Tab>((init.v ?? "position") === "position" ? "state" : init.v === "pairs" ? (init.s !== undefined ? "state" : "ladder")
    : init.r ? "route" : init.s !== undefined ? "state" : "commodity");
  const [side, setSide] = useState<Side>(init.side);
  const [ras, setRas] = useState<Record<Year, Ra> | null>(null);
  const ra = view === "pairs" && ras ? ras[year] : null;
  const [hover, setHover] = useState<{ x: number; y: number; hit: Hit } | null>(null);
  const [tour, setTour] = useState<number | null>(init.firstVisit ? 0 : null);
  // First visit: the opening card sits over stop 1's map until the reader starts the tour or leaves it.
  const [opening, setOpening] = useState(init.firstVisit);
  const [tourExtra, setTourExtra] = useState<TourExtra | null>(null);
  // The Hypotheses cards: which card is open; its states are the lasting risers, known once the three networks are in.
  const [hyp, setHyp] = useState<number | null>(null);
  const hypOn = hyp !== null;
  const hypStates = useMemo(() => (hypOn && tourExtra && net && String(net.year) === "2017" ? lasting(tourExtra.nets, net).map((s) => s.state) : undefined), [hypOn, tourExtra, net]);
  const hypShare = hypStates ? plannedShare(hypStates) : 0;
  const lensStop = tour !== null && TOUR[tour].kind === "position" ? (TOUR[tour] as PositionStop) : null;
  const gdpLens = !!lensStop?.gdp, risers = !!lensStop?.risers, cycling = !!lensStop?.cycle, bare = !!lensStop?.bare, lit = !!lensStop?.lit;
  const marks = hypStates ?? lensStop?.marks, focus = hypStates ?? lensStop?.focus;
  // The Hypotheses cards color the risers as selected and the paused four as plain; a tour stop that selects one state keeps its single highlight.
  const focusIdx = useMemo(() => new Set(hypOn && focus ? focus.map((s) => cm.states.indexOf(s)) : []), [hypOn, focus, cm]);
  const mutedIdx = useMemo(() => new Set(hypOn ? PAUSED_2026.map((s) => cm.states.indexOf(s)) : []), [hypOn, cm]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>(readTheme);
  const C = THEMES[theme].ui;
  const [bal, setBal] = useState<Balance | null>(null);
  const [bringDir, setBringDir] = useState<BringDir>("in");
  const [bringHover, setBringHover] = useState<BringHover>(null);
  useEffect(() => {
    if (tab !== "state" || selState === null || bal) return;
    loadBalance().then(setBal).catch((e: Error) => setError(e.message));
  }, [tab, selState, bal]);
  useEffect(() => { setBringHover(null); }, [selState, tab, year]);
  useEffect(() => {
    if (view !== "pairs" || ras) return;
    loadRa().then(setRas).catch((e: Error) => setError(e.message));
  }, [view, ras]);
  useEffect(() => {
    if (view !== "position") return;
    let live = true;
    loadNetwork(year).then((n) => live && setNet(n)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [view, year]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FreightScene | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    loadCommodity(sctg).then((c) => live && setCom(c)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [sctg]);

  useEffect(() => {
    let scene: FreightScene;
    try {
      scene = new FreightScene(canvasRef.current!, overlayRef.current!, cm.centroids, cm.fips, init.t, theme);
    } catch (e) {
      setError(`the 3-D view could not start (${(e as Error).message})`);
      return;
    }
    sceneRef.current = scene;
    if (init.flat) scene.setFlat(true);
    (window as unknown as { __freight: object }).__freight = {
      arcApex: (o: number, d: number) => scene.arcApex(key(o, d)),
      stateScreen: (s: number) => scene.stateScreen(s),
      walls: (v: boolean) => scene.setWallsVisible(v),
      geo: (v: boolean) => scene.setGeoVisible(v),
      arcs: (v: boolean) => scene.setArcsVisible(v),
      solid: (v: boolean) => scene.setSolidVisible(v),
      geoState: () => scene.geoState(),
      ready: () => !!sceneRef.current,
      arcCount: () => (scene as unknown as { arcs: ArcSpec[] }).arcs.length,
    };
    return () => scene.dispose();
  }, [cm, init.t, init.flat]);

  // Overlays over the map (legend, tour card, map tools): the scene frames its home view in the space they leave.
  useEffect(() => {
    const canvas = canvasRef.current, stage = canvas?.parentElement, main = stage?.parentElement;
    if (!canvas || !stage || !main) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const c = canvas.getBoundingClientRect();
        sceneRef.current?.setOccluders([...main.querySelectorAll<HTMLElement>("[data-occludes]")].map((el) => {
          const r = el.getBoundingClientRect();
          const x0 = Math.max(r.left, c.left), x1 = Math.min(r.right, c.right), y0 = Math.max(r.top, c.top), y1 = Math.min(r.bottom, c.bottom);
          return { x: x0 - c.left, y: y0 - c.top, w: x1 - x0, h: y1 - y0 };
        }));
      });
    };
    const ro = new ResizeObserver(measure);
    const watch = () => {
      ro.disconnect();
      ro.observe(stage);
      main.querySelectorAll("[data-occludes]").forEach((el) => ro.observe(el));
      measure();
    };
    const mo = new MutationObserver(watch);
    mo.observe(main, { childList: true });
    mo.observe(stage, { childList: true });
    watch();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); };
  }, [cm, init.t, init.flat]);

  useEffect(() => { sceneRef.current?.setFlat(flat); }, [flat]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
    sceneRef.current?.setTheme(theme);
  }, [theme]);

  const yd = com && com.sctg === sctg ? com.years[year] : null;
  const fi = useMemo(() => (yd ? flowIndex(yd) : new Map<number, Flow>()), [yd]);
  const routeFlow = route ? fi.get(key(route[0], route[1])) : undefined;
  const routeCands = useMemo(() => (yd && routeFlow ? candidates(yd, routeFlow[0], routeFlow[1], routeFlow[2]) : []), [yd, routeFlow]);

  useEffect(() => {
    const p = new URLSearchParams({ c: sctg, y: year, v: view });
    if (view === "position") p.set("m", measure);
    if (view === "pairs") p.set("side", side);
    if (flat) p.set("flat", "1");
    if (route) p.set("r", `${route[0]}-${route[1]}`);
    else if (selState !== null) p.set("s", String(selState));
    history.replaceState(null, "", `${location.pathname}${location.search}#${p.toString()}`);
  }, [sctg, year, view, route, selState, measure, flat, side]);

  const arcs = useMemo<ArcSpec[]>(() => {
    if (!yd && view !== "position" && view !== "pairs") return [];
    if (bare && view === "position") return [];
    const out: ArcSpec[] = [];
    if (view === "pairs") {
      // The selected state's shipments that pairs most underpredict, width by the records pairs miss.
      const cells = ra && selState !== null ? ra.cells[cm.states[selState]]?.[side] ?? [] : [];
      const max = Math.max(1, ...cells.map((c) => c[2] - c[3]));
      const seen = new Set<number>();
      for (const [partner, , records, expected] of cells) {
        const [o, d] = side === "shipping" ? [selState!, partner] : [partner, selState!];
        if (seen.has(key(o, d))) continue;
        seen.add(key(o, d));
        const w = Math.sqrt((records - expected) / max);
        out.push({ id: key(o, d), o, d, width: 0.15 + 0.45 * w, lift: w, color: side === "shipping" ? C.amber : C.teal, alpha: 0.9 });
      }
      return out;
    }
    const routeKey = route ? key(route[0], route[1]) : -1;
    const netYear = net && String(net.year) === year ? net : null;
    if (view === "position") {
      if (!netYear) return out;
      let edges = netYear.edges.map(([o, d, v]) => [cm.states.indexOf(o), cm.states.indexOf(d), v] as const);
      if (selState !== null) edges = edges.filter((e) => e[0] === selState || e[1] === selState);
      edges = edges.slice(0, topN);
      const max = Math.max(1, ...edges.map((e) => e[2]));
      for (const [o, d, v] of edges) {
        const w = Math.sqrt(v / max);
        // The stops that introduce the ties draw them in the theme's contrasting color, so they read at once.
        const color = lit || (selState !== null && d === selState) ? C.teal : C.amber;
        out.push({ id: key(o, d), o, d, width: lit ? Math.min(1, w * 1.25) : w, lift: w, color, alpha: lit ? 0.95 : 0.8 });
      }
      return out;
    }
    if (bringHover && bal && selState !== null) {
      const row = bal.years[year][bringHover.sctg][selState];
      const list = bringHover.dir === "in" ? row[6] : row[7];
      const max = Math.max(...list.map((x) => x[1]), 1e-9);
      for (const [other, sh] of list) {
        const [o, d] = bringHover.dir === "in" ? [other, selState] : [selState, other];
        const w = Math.sqrt(sh / max);
        out.push({ id: key(o, d), o, d, width: 0.12 + 0.45 * w, lift: w, color: bringHover.dir === "in" ? C.teal : C.amber, alpha: 0.95 });
      }
      return out;
    } else {
      if (!yd) return out;
      let flows = yd.flows;
      if (selState !== null) flows = flows.filter((f) => f[0] === selState || f[1] === selState);
      else if (view === "reliance") flows = [];
      flows = flows.slice(0, topN);
      const max = Math.max(1, ...flows.map((f) => f[2]));
      for (const f of flows) {
        const id = key(f[0], f[1]);
        const thin = f[3] < cm.thin;
        const color = thin ? C.thinRoute : selState === null ? C.amber : f[1] === selState ? C.teal : C.amber;
        const w = Math.sqrt(f[2] / max);
        out.push({ id, o: f[0], d: f[1], width: w, lift: w, color, alpha: (thin ? 0.55 : 0.85) * (route && id !== routeKey ? 0.2 : 1) });
      }
    }
    if (routeFlow) {
      const existing = out.find((a) => a.id === routeKey);
      const base = existing ?? { id: routeKey, o: routeFlow[0], d: routeFlow[1], width: 0.4, lift: 0.4, color: C.hot, alpha: 1 };
      const i = out.indexOf(existing as ArcSpec);
      if (i >= 0) out.splice(i, 1);
      out.push({ ...base, color: routeFlow[3] < cm.thin ? C.thinRoute : C.hot, alpha: 1, width: Math.max(base.width, 0.6), lift: Math.max(base.lift, 0.5) });
    }
    return out;
  }, [yd, fi, view, topN, selState, route, routeFlow, cm.thin, cm.states, C, bringHover, bal, year, net, ra, side, bare, lit]);

  const national = useMemo(() => {
    if (!yd) return new Array(51).fill(0) as number[];
    const total = yd.supply.reduce((a, b) => a + b, 0) || 1;
    return yd.supply.map((s) => s / total);
  }, [yd]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setArcs(arcs);
    const maxN = Math.max(...national, 1e-9);
    if (view === "pairs") {
      if (!ra) return;
      const adj = adjusted(ra, side);
      scene.setStates(adj.map((r) => 0.04 + 0.5 * rampT(r)), adj.map((r, i) => (i === selState ? C.sel : rampColor(r))), adj.map((_, i) => i === selState));
      return;
    }
    if (view === "position") {
      if (!net || String(net.year) !== year) return;
      const vals = net.states.map((r) => (gdpLens ? r.gdp_billions : r[measure]));
      const maxV = Math.max(...vals, 1e-12);
      const heights = vals.map((v) => 0.75 * (v / maxV));
      const colors = net.states.map((r, i) =>
        i === selState || focusIdx.has(i) ? C.sel : mutedIdx.has(i) || (!gdpLens && measure === "betweenness" && r.no_brokerage) ? C.state : interpolateSequential(vals[i] / maxV));
      scene.setStates(heights, colors, net.states.map((_, i) => i === selState), (tour !== null && tour <= 2) || cycling ? 0.035 : 0.12);
      return;
    }
    const heights = national.map((s) => (view === "reliance" ? s / maxN : 0.05 * Math.sqrt(s / maxN)));
    const colors = national.map((s, i) => {
      let c = view === "reliance" ? mix(C.state, C.relief, Math.sqrt(s / maxN)) : C.state;
      if (routeFlow) {
        if (i === routeFlow[0]) c = C.origin;
        else if (i === routeFlow[1]) c = C.dest;
        else if (routeCands.slice(0, 3).some((x) => x.state === i)) c = C.cand;
      } else if (i === selState) c = C.sel;
      return c;
    });
    const edges = national.map((_, i) => i === selState || (!!routeFlow && (i === routeFlow[0] || i === routeFlow[1])));
    scene.setStates(heights, colors, edges);
  }, [arcs, national, view, routeFlow, routeCands, selState, C, net, measure, year, gdpLens, tour, cycling, ra, side, focusIdx, mutedIdx]);

  const labels = useMemo<Label[]>(() => {
    const out: Label[] = [];
    // On tour, the stop's takeaway comes first: it outranks any label it would overlap.
    if (tour !== null && !opening) {
      const st = TOUR[tour];
      const at = ([abbr, text]: [string, string]): Label => ({ state: cm.states.indexOf(abbr), text, tone: "callout" });
      if (st.kind === "position" && st.say && net && String(net.year) === year) out.push(at(st.say(net)));
      else if (st.kind === "pairs" && st.say && ras) out.push(at(st.say(ras[st.year])));
      else if (st.kind === "flow" && routeFlow && yd && com && com.sctg === sctg)
        out.push({ state: routeFlow[1], text: `${pct(share(yd, routeFlow))} of ${cm.names[routeFlow[1]]}'s interstate ${com.name.toLowerCase()} comes from ${cm.names[routeFlow[0]]}`, tone: "callout" });
    }
    // A comparison stop labels its states with both ranks, the first in amber: the answer sits on the map.
    if (view === "position" && marks && net && String(net.year) === year) {
      marks.forEach((s, k) => { const r = net.states.find((x) => x.state === s); if (r) out.push({ state: net.states.indexOf(r), text: `${s} prestige #${r.rank_eigenvector} · GDP #${r.gdp_rank}`, tone: k === 0 ? "amber" : "plain" }); });
      return out;
    }
    if (routeFlow) {
      out.push({ state: routeFlow[0], text: `${cm.states[routeFlow[0]]} origin`, tone: "amber" });
      out.push({ state: routeFlow[1], text: `${cm.states[routeFlow[1]]} destination`, tone: "sky" });
      routeCands.slice(0, 3).forEach((c) => out.push({ state: c.state, text: `${cm.states[c.state]} · ${int(c.miles)} mi`, tone: "teal" }));
    } else if (selState !== null) {
      out.push({ state: selState, text: cm.names[selState], tone: "amber" });
    } else if (view === "pairs" && ra) {
      adjusted(ra, side).map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 5)
        .forEach(([r, i]) => out.push({ state: i, text: `${cm.states[i]} ${r.toFixed(1)}×`, tone: "plain" }));
    } else if (view === "position" && net && String(net.year) === year && gdpLens) {
      [...net.states].map((r, i) => [r, i] as const).sort((a, b) => a[0].gdp_rank - b[0].gdp_rank).slice(0, 5)
        .forEach(([r, i]) => out.push({ state: i, text: `${r.state} #${r.gdp_rank} GDP`, tone: "plain" }));
    } else if (view === "position" && net && String(net.year) === year && cycling && tourExtra) {
      lasting(tourExtra.nets, net).forEach((r) => out.push({ state: net.states.indexOf(r), text: `${r.state} +${r.gdp_rank - r.rank_eigenvector}`, tone: "teal" }));
    } else if (view === "position" && net && String(net.year) === year && risers) {
      // The stop's answer gets its own label: the state first by trade prestige, with its GDP rank beside it.
      const top = net.states.reduce((a, b) => (b.rank_eigenvector < a.rank_eigenvector ? b : a));
      out.push({ state: net.states.indexOf(top), text: `${top.state} #1 prestige · #${top.gdp_rank} GDP`, tone: "amber" });
      gapUp(net).forEach((r) => out.push({ state: net.states.indexOf(r), text: `${r.state} +${r.gdp_rank - r.rank_eigenvector}`, tone: "teal" }));
    } else if (view === "position" && net && String(net.year) === year) {
      const rk = `rank_${measure}` as const;
      [...net.states].map((r, i) => [r, i] as const).filter(([r]) => !(measure === "betweenness" && r.no_brokerage))
        .sort((a, b) => a[0][rk] - b[0][rk]).slice(0, 5)
        .forEach(([r, i]) => out.push({ state: i, text: `${r.state} #${r[rk]}`, tone: "plain" }));
    } else if (view === "reliance") {
      national.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 5)
        .forEach(([s, i]) => out.push({ state: i, text: `${cm.states[i]} ${pct(s)}`, tone: "plain" }));
    }
    return out;
  }, [routeFlow, routeCands, selState, view, national, cm, net, measure, year, gdpLens, risers, cycling, tourExtra, ra, side, marks, tour, opening, ras, yd, com, sctg]);

  // While the opening card is up, the map shows behind it without labels, so nothing competes with its words.
  useEffect(() => { sceneRef.current?.setLabels(opening ? [] : labels); }, [labels, opening]);

  // Alaska and Hawaii sit in insets far from their partners: frame them with the states their arcs reach (#12).
  const framed = (s: number) => {
    if (cm.fips[s] !== "02" && cm.fips[s] !== "15") return [s];
    const ends = view === "pairs" ? (ras?.[year].cells[cm.states[s]]?.[side] ?? []).map((c) => c[0])
      : view === "position" ? (net && String(net.year) === year ? net.edges.map(([o, d]) => [cm.states.indexOf(o), cm.states.indexOf(d)]) : []).filter((e) => e.includes(s)).map((e) => e[0] + e[1] - s)
      : (yd?.flows ?? []).filter((f) => f[0] === s || f[1] === s).map((f) => f[0] + f[1] - s);
    return [s, ...ends.slice(0, Math.min(8, topN))];
  };
  const flewInitially = useRef(false);
  useEffect(() => {
    if (!yd || flewInitially.current) return;
    flewInitially.current = true;
    if (init.r) sceneRef.current?.flyToStates(init.r, 10);
    else if (init.s !== undefined) sceneRef.current?.flyToStates(framed(init.s), 10);
    // once, on the first data: framed reads the data at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yd, init]);

  const selectRoute = (r: Route | null, fly = true) => {
    setRoute(r);
    if (r) {
      setTab("route");
      if (fly) sceneRef.current?.flyToStates([r[0], r[1]]);
    }
  };
  const selectState = (s: number | null) => {
    setSelState(s);
    setRoute(null);
    if (s !== null) {
      setTab("state");
      sceneRef.current?.flyToStates(framed(s));
    }
  };

  const onCanvas = (e: React.PointerEvent) => e.target === canvasRef.current;
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons || !onCanvas(e)) return setHover(null);
    const hit = sceneRef.current?.pick(e.clientX, e.clientY) ?? null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover(hit ? { x: e.clientX - rect.left, y: e.clientY - rect.top, hit } : null);
  };
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { down.current = onCanvas(e) ? { x: e.clientX, y: e.clientY } : null; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") setHover(null);
    const d = down.current;
    down.current = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const hit = sceneRef.current?.pick(e.clientX, e.clientY, view === "position" || view === "pairs") ?? null;
    if (hit?.kind === "arc") selectRoute([Math.floor(hit.id / 51), hit.id % 51]);
    else if (hit?.kind === "state") selectState(hit.state === selState ? null : hit.state);
    else { setSelState(null); setRoute(null); }
  };

  // The Beyond pairs stop opens its state and frames it with the partner of its most-missed route, so that route is in view.
  const pairsOpen = (r: Ra, s: Side) => {
    const top = topMissed(r, s), cell = r.cells[cm.states[top]]?.[s][0];
    selectState(top);
    if (cell) sceneRef.current?.flyToStates([top, cell[0]]);
  };
  const goTour = (i: number | null) => {
    setTour(i); setHyp(null);
    if (i === null) return;
    try { localStorage.setItem(TOUR_SEEN, "1"); } catch { /* storage blocked: the tour may show again */ }
    const t = TOUR[i];
    setYear(t.year);
    if (t.kind === "position") {
      setView("position"); setMeasure(t.measure); setRoute(null); setTab("state");
      if (t.state) selectState(cm.states.indexOf(t.state));
      else { setSelState(null); sceneRef.current?.flyHome(); }
      if (t.focus) sceneRef.current?.flyToStates(t.focus.map((x) => cm.states.indexOf(x)));
      return;
    }
    if (t.kind === "pairs") {
      setView("pairs"); setSide(t.side); setRoute(null); setTab("state");
      if (ras) pairsOpen(ras[t.year], t.side);
      else setSelState(null);
      return;
    }
    const o = cm.states.indexOf(t.o), d = cm.states.indexOf(t.d);
    setSctg(t.sctg); setView(t.view); setCommodityView(t.view === "reliance" ? "reliance" : "flows"); setSelState(null);
    selectRoute([o, d]);
  };
  // Opening a Hypotheses card: the 2017 prestige map with nothing selected; the risers frame the view once the three networks are in.
  const goHyp = (i: number | null) => {
    setHyp(i); setTour(null); setOpening(false);
    if (i === null) return;
    setYear("2017"); setView("position"); setMeasure("eigenvector"); setRoute(null); setSelState(null); setTab("state");
  };
  const endHyp = () => { setHyp(null); sceneRef.current?.flyHome(); };
  useEffect(() => { if (hypStates) sceneRef.current?.flyToStates(hypStates.map((x) => cm.states.indexOf(x))); }, [hypStates, cm]);
  const needsExtra = hypOn || (tour !== null && TOUR[tour].kind === "position" && (TOUR[tour] as PositionStop).extra);
  useEffect(() => {
    if (!needsExtra || tourExtra) return;
    Promise.all([
      Promise.all(YEARS.map((y) => loadNetwork(y))),
      fetch(`${import.meta.env.BASE_URL}data/v2/registered.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("registered.json")))),
    ]).then(([ns, reg]) => {
      const rho = (pair: string) => reg.pairs.find((p: { pair: string }) => p.pair === pair).H1.measures.eigenvector.spearman as number;
      setTourExtra({
        nets: Object.fromEntries(YEARS.map((y, i) => [y, ns[i]])) as Record<Year, Network>,
        rho: { r2012: rho("retrodiction"), r2022: rho("prediction"), published: new Date(`${reg.thresholds_commit_date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) },
      });
    }).catch((e: Error) => setError(e.message));
  }, [needsExtra, tourExtra]);
  const pairsStop = tour !== null && TOUR[tour].kind === "pairs" ? (TOUR[tour] as PairsStop) : null;
  useEffect(() => {
    if (!pairsStop || !ras || selState !== null) return;
    pairsOpen(ras[pairsStop.year], pairsStop.side);
    // selectState is stable in effect; the stop and the data decide when to run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsStop, ras]);
  const endTour = () => { setTour(null); setHyp(null); setOpening(false); sceneRef.current?.flyHome(); };
  // On a flow stop the reader may swap in another good: its strongest dependence becomes the route.
  const flowStop = tour !== null && TOUR[tour].kind === "flow" ? (TOUR[tour] as FlowStop) : null;
  const pickGood = (c: string) => {
    setSctg(c); setSelState(null);
    if (flowStop && c === flowStop.sctg) selectRoute([cm.states.indexOf(flowStop.o), cm.states.indexOf(flowStop.d)]);
  };
  useEffect(() => {
    if (!flowStop || !com || com.sctg !== sctg || com.sctg === flowStop.sctg) return;
    const f = topDependence(com.years[flowStop.year]);
    if (f) selectRoute([f[0], f[1]]);
  }, [flowStop, com, sctg]);
  // On phones the tour card sits under the map, not over it: bring the map and the card into view together.
  const touring = (tour !== null && !opening) || hypOn;
  useEffect(() => {
    if (!touring || !matchMedia(PHONE).matches) return;
    canvasRef.current?.parentElement?.scrollIntoView({ block: "start", behavior: REDUCED_MOTION ? "auto" : "smooth" });
  }, [touring]);

  // First visit with no link state: the tour is already on stop 1 (the default view); fly in to it.
  useEffect(() => {
    if (!init.firstVisit) return;
    sceneRef.current?.introFlight();
    try { localStorage.setItem(TOUR_SEEN, "1"); } catch { /* storage blocked: the tour may show again */ }
  }, [init]);

  const canvasLabel = view === "pairs"
    ? `Map of U.S. states, ${year}, colored by each state's share of what models of pairs miss as a ${side} state, against states its size. The same values are in the State tab; choose a state with the state list.`
    : view === "position"
    ? `Map of U.S. states, ${year}, colored by ${MEASURE_NAMES[measure].toLowerCase()} across all commodities. The same values are in the Rankings tab; choose a state with the state list.`
    : `Map of interstate ${com?.name.toLowerCase() ?? "commodity"} shipments, ${year}, ${view === "reliance" ? "states raised by share of national supply" : "routes drawn by dollars"}. Choose a state with the state list; details appear in the side panel.`;
  const announcement = (() => {
    if (routeFlow && route) return `${cm.names[route[0]]} to ${cm.names[route[1]]} selected: ${usd(routeFlow[2])}, ${yd ? pct(share(yd, routeFlow)) : ""} of ${cm.states[route[1]]}'s interstate supply.`;
    if (selState === null) return "";
    if (view === "pairs" && ra) return `${cm.names[selState]} selected: ${Math.exp(ra[side].netOfSize[selState]).toFixed(1)} times what pairs miss for a ${side} state its size.`;
    if (view === "position" && net && String(net.year) === year) {
      const r = net.states[selState];
      const rank = measure === "betweenness" && r.no_brokerage ? "no brokerage" : `rank ${r[`rank_${measure}`]}`;
      return `${r.name} selected: ${MEASURE_NAMES[measure].toLowerCase()} ${rank}, GDP rank ${r.gdp_rank}.`;
    }
    return `${cm.names[selState]} selected.`;
  })();

  // The structure stop steps through the three surveys so the reader sees how little the map moves.
  useEffect(() => {
    if (!cycling || REDUCED_MOTION) return;
    const id = setInterval(() => setYear((y) => YEARS[(YEARS.indexOf(y) + 1) % YEARS.length]), 2600);
    return () => clearInterval(id);
  }, [cycling]);

  const tourStop = tour !== null ? TOUR[tour] : null;
  const tourText = !tourStop ? ""
    : tourStop.kind === "pairs" ? (ras ? tourStop.text(ras[tourStop.year]) : "")
    : tourStop.kind === "position" ? (tourStop.extra ? (tourExtra ? tourStop.text(tourExtra.nets[tourStop.year], tourExtra) : "")
      : net && String(net.year) === tourStop.year ? tourStop.text(net, tourExtra) : "")
    : com?.sctg === tourStop.sctg ? tourStop.text(com, com.years[tourStop.year].flows.find((f) => f[0] === cm.states.indexOf(tourStop.o) && f[1] === cm.states.indexOf(tourStop.d)))
    : com && com.sctg === sctg && tourStop.picks?.includes(com.sctg) ? dependText(com, tourStop.year, topDependence(com.years[tourStop.year])) : "";

  const tooltip = hover && view === "pairs" ? (ra ? pairsTip(hover.hit, ra, side) : null) : hover && view === "position" ? (net ? positionTip(hover.hit, net, measure, cm.states) : null) : hover && yd ? tooltipText(hover.hit, yd, fi, national, cm.names, cm.states) : null;

  return (
    <div className="fm" data-testid="freight-map" data-theme={theme}>
      <style>{CSS}</style>
      <header className="fm-top">
        <SiteBar theme={theme} onTheme={setTheme} skipTo="#panel" />
        <div className="fm-toolbar" role="toolbar" aria-label="Map controls">
          <Group label="Year">
            <Seg label="Year" items={YEARS.map((y) => [y, y] as const)} value={year} onChange={(y) => { setYear(y); setTour(null); setHyp(null); }} test="year" />
          </Group>
          <Group label="Scope">
            <Seg label="Scope" items={PAIRS ? [["all", "All commodities"], ["one", "One commodity"], ["pairs", "Beyond pairs"]] as const : [["all", "All commodities"], ["one", "One commodity"]] as const}
              value={view === "position" ? "all" : view === "pairs" ? "pairs" : "one"}
              onChange={(v) => {
                setView(v === "all" ? "position" : v === "pairs" ? "pairs" : commodityView);
                setTab(v === "all" ? "state" : v === "pairs" ? (selState !== null ? "state" : "ladder") : "commodity");
                setTour(null); setHyp(null); setRoute(null);
              }} test="scope" />
          </Group>
          {view === "pairs" && (
            <Group label="Side">
              <Seg label="Side" items={[["shipping", "Shipping"], ["receiving", "Receiving"]] as const} value={side} onChange={setSide} test="side" />
            </Group>
          )}
          {view === "position" && (
            <Group label="Commodity">
              <CommodityPicker browse sctg={sctg} year={year}
                onPick={(c) => { setSctg(c); setView(commodityView); setTab("commodity"); setRoute(null); setSelState(null); setTour(null); setHyp(null); }} />
            </Group>
          )}
          {(view === "flows" || view === "reliance") && (
            <Group label="Commodity" nested>
              <CommodityPicker sctg={sctg} year={year} onPick={(c) => { setSctg(c); setRoute(null); setTour(null); setHyp(null); }} />
              <Seg label="Show" items={[["flows", "Flows"], ["reliance", "Reliance"]] as const} value={view === "reliance" ? "reliance" : "flows"}
                onChange={(v) => { setView(v); setCommodityView(v); setTour(null); setHyp(null); setRoute(null); }} test="view" />
            </Group>
          )}
          <div className="fm-spacer" />
          {(view === "flows" || view === "position") && (
            <Group label={view === "position" ? "Links shown" : "Routes shown"} quiet>
              <label className="fm-slider">
                <span className="fm-sr">{view === "position" ? "Links" : "Routes"} shown</span>
                <input type="range" min={20} max={410} step={10} value={Number.isFinite(topN) ? topN : 410}
                  onChange={(e) => { const v = Number(e.target.value); setTopN(v > 400 ? Infinity : v); }} data-testid="topn"
                  aria-valuetext={Number.isFinite(topN) ? String(topN) : "All"} />
                <b data-testid="topn-value">{Number.isFinite(topN) ? topN : "All"}</b>
              </label>
            </Group>
          )}
        </div>
      </header>

      <main className="fm-main">
        <section className="fm-stage" onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)}>
          <canvas ref={canvasRef} data-testid="map-canvas" role="img" aria-label={canvasLabel} />
          <div ref={overlayRef} className="fm-overlay" />
          {!opening && <Legend view={view} selState={selState} names={cm.names} C={C} measure={measure} setMeasure={setMeasure} gdpLens={gdpLens} ties={bare ? "none" : lit ? "lit" : "plain"} comName={com?.name} year={year} side={side} sized={!!THEMES[theme].scene.field && THEMES[theme].scene.dotSized !== false} />}
          {tooltip && hover && (
            <div className="fm-tip" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }} data-testid="tooltip">{tooltip}</div>
          )}
          {error && <div className="fm-error">Could not load data: {error}</div>}
          <div className="fm-honesty" data-testid="honesty">{HONESTY}</div>
          <div className="fm-stage-tools" data-occludes>
            <Seg label="Perspective" items={[["3d", "3D"], ["2d", "2D"]] as const} value={flat ? "2d" : "3d"} onChange={(v) => setFlat(v === "2d")} test="persp" />
            <button className="fm-home" onClick={() => sceneRef.current?.flyHome()} title="Reset view" data-testid="home">Reset view</button>
            <button className="fm-home" onClick={() => { setOpening(false); goTour(0); }} aria-pressed={tour !== null} data-testid="tour-start">Tour</button>
            <button className="fm-home" onClick={() => goHyp(0)} aria-pressed={hypOn} data-testid="hyp-start">Hypotheses</button>
          </div>
          {opening && (
            <div className="fm-intro fm-open" data-testid="opening" role="dialog" aria-label="Introduction">
              <div className="fm-tour-head">Interstate Power Observatory</div>
              <blockquote className="fm-anchor" data-testid="opening-quote">“{OPENING_QUOTE}”</blockquote>
              <p className="fm-open-cite">{OPENING_CITE}</p>
              <ol className="fm-open-steps" data-testid="opening-steps">
                <li><span><b>GDP is a total.</b> It adds up what a state produces on its own.</span></li>
                <li><span><b>Power is a relation.</b> It is exerted over someone.</span></li>
                <li><span><b>So follow the ties.</b> This map traces what U.S. states ship each other, to see who depends on whom.</span></li>
              </ol>
              <div className="fm-intro-btns">
                <button className="fm-btn primary" onClick={() => { setOpening(false); goTour(0); }} data-testid="opening-start" autoFocus>Start the tour</button>
                <button className="fm-btn ghost" onClick={endTour} data-testid="opening-skip">Explore on my own</button>
              </div>
            </div>
          )}
        </section>
        {tourStop && !opening && (
          <div className="fm-tour" data-testid="tour-card" role="region" aria-label="Guided tour" data-occludes>
            <div className="fm-tour-bar" data-testid="tour-bar"><b>Guided tour</b><span>Stop {tour! + 1} of {TOUR.length}</span></div>
            <ol className="fm-rail" aria-label="Tour stops">
              {TOUR.map((t, i) => (
                <li key={i}>
                  <button className={i === tour ? "on" : i < tour! ? "done" : ""} aria-current={i === tour ? "step" : undefined}
                    aria-label={`Stop ${i + 1}: ${t.title}`} onClick={() => goTour(i)} data-testid={`tour-rail-${i}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="fm-tour-head" data-testid="tour-head">{tour === 0 ? tourStop.title : `${tourStop.title} · ${cycling ? year : tourStop.year}`}</div>
            <p className="fm-tour-lead" data-testid="tour-lead">{tourStop.lead}</p>
            <p data-testid="tour-text">{tourText || "Loading…"}</p>
            {tourStop.kind === "flow" && tourStop.picks && (
              <div className="fm-tour-picks" role="group" aria-label="Try another good" data-testid="tour-picks">
                <span>Try another good:</span>
                {tourStop.picks.map((c) => (
                  <button key={c} className={c === sctg ? "on" : ""} aria-pressed={c === sctg} onClick={() => pickGood(c)} data-testid={`tour-pick-${c}`}>
                    {cm.commodities.find((x) => x[0] === c)?.[1] ?? c}
                  </button>
                ))}
              </div>
            )}
            <div className="fm-intro-btns">
              {tour! > 0 && <button className="fm-btn" onClick={() => goTour(tour! - 1)}>Back</button>}
              {tour! < TOUR.length - 1
                ? <button className="fm-btn primary" onClick={() => goTour(tour! + 1)} data-testid="tour-next">Next stop</button>
                : <button className="fm-btn primary" onClick={endTour} data-testid="tour-end">Explore freely</button>}
              {tour! < TOUR.length - 1 && <button className="fm-btn ghost" onClick={endTour} data-testid="tour-skip">Skip tour</button>}
            </div>
            <a className="fm-tour-ask" data-testid="tour-ask"
              href={`mailto:rthornton@binghamton.edu?subject=${encodeURIComponent(`Observatory question, tour stop ${tour! + 1}: ${tourStop.title}`)}`}>
              Question about this stop? Ask the author</a>
          </div>
        )}
        {hyp !== null && (
          <div className="fm-tour" data-testid="hyp-card" role="region" aria-label="Hypotheses" data-occludes>
            <div className="fm-tour-bar" data-testid="hyp-bar"><b>Hypotheses</b><span>Card {hyp + 1} of {HYPOTHESES.length}</span></div>
            <ol className="fm-rail" aria-label="Hypothesis cards">
              {HYPOTHESES.map((h, i) => (
                <li key={i}>
                  <button className={i === hyp ? "on" : i < hyp ? "done" : ""} aria-current={i === hyp ? "step" : undefined}
                    aria-label={`Card ${i + 1}: ${h.head}`} onClick={() => goHyp(i)} data-testid={`hyp-rail-${i}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="fm-tour-head" data-testid="hyp-head">{HYPOTHESES[hyp].head}{hyp < HYPOTHESES.length - 1 ? " · 2017" : ""}</div>
            <p data-testid="hyp-text">{hypStates ? HYPOTHESES[hyp].text(hypShare, hypStates.length) : "Loading…"}</p>
            {hyp === HYPOTHESES.length - 1 && hypStates && (
              <>
                <ul className="fm-tour-sources" aria-label="Scoreboard" data-testid="hyp-scoreboard">
                  {hypScoreboard(hypShare, hypStates).map((l) => <li key={l}>{l}</li>)}
                </ul>
                <details className="fm-tour-details" data-testid="hyp-sources-box">
                  <summary>Sources</summary>
                  <ul className="fm-tour-sources" aria-label="Sources" data-testid="hyp-sources">
                    {HYP_SOURCES.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                </details>
              </>
            )}
            <div className="fm-tour-stamp" data-testid="hyp-stamp">HYPOTHESIS, {HYP_DATE}</div>
            <div className="fm-intro-btns">
              {hyp > 0 && <button className="fm-btn" onClick={() => goHyp(hyp - 1)}>Back</button>}
              {hyp < HYPOTHESES.length - 1
                ? <button className="fm-btn primary" onClick={() => goHyp(hyp + 1)} data-testid="hyp-next">Next card</button>
                : <button className="fm-btn primary" onClick={endHyp} data-testid="hyp-end">Close</button>}
              {hyp < HYPOTHESES.length - 1 && <button className="fm-btn ghost" onClick={endHyp} data-testid="hyp-close">Close</button>}
            </div>
          </div>
        )}

        <aside className="fm-side" id="panel" aria-label="Details" tabIndex={-1}>
          <div className="fm-sr" role="status" aria-live="polite" data-testid="announce">{announcement}</div>
          <StateSelect value={selState} onPick={selectState} names={cm.names} />
          {yd && (view === "flows" || view === "reliance") && <GapChart yd={yd} route={route} onPick={(r) => { setSelState(null); selectRoute(r); setTour(null); setHyp(null); }} names={cm.states} />}
          <nav className="fm-tabs" role="tablist">
            {(view === "pairs"
              ? [["ladder", "Ladder"], ["state", "State"], ["measure", "How it's measured"], ["about", "About"]] as const
              : view === "position"
              ? [["state", "State"], ["rankings", "Rankings"], ["measure", "How it's measured"], ["about", "About"]] as const
              : [["route", "Route"], ["state", "State"], ["commodity", "Commodity"], ["measure", "How it's measured"], ["about", "About"]] as const).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} data-testid={`tab-${t}`}>{l}</button>
            ))}
          </nav>
          <div className="fm-panel" data-testid={`panel-${tab}`}>
            {view === "pairs" && tab !== "about"
              ? (!ras ? <p className="muted">Loading the lattice…</p>
                : tab === "ladder" ? <LadderPanel ras={ras} year={year} side={side} />
                : tab === "state" ? <PairsStatePanel ra={ras[year]} side={side} state={selState} year={year} onPick={selectState}
                  onCell={(c, o, d) => { setSctg(c); setView("flows"); setCommodityView("flows"); setSelState(null); selectRoute([o, d]); }} />
                : <><RaDrawer ra={ras[year]} year={year} side={side} /><MeasurePanel /></>)
              : view === "position" && (tab === "state" || tab === "rankings")
              ? (!net || String(net.year) !== year ? <p className="muted">Loading the network…</p>
                : tab === "state" ? <PositionStatePanel net={net} state={selState} measure={measure} onPick={selectState} bal={bal} year={year} onCommodity={(c) => { setSctg(c); setView("flows"); setTab("state"); }} />
                : <RankingsPanel net={net} measure={measure} onPick={selectState} />)
              : !yd ? <p className="muted">Loading the commodity…</p>
              : tab === "route" ? <RoutePanel yd={yd} com={com!} year={year} route={route} flow={routeFlow} cands={routeCands} onState={selectState} />
              : tab === "state" ? (
                <>
                  <StatePanel yd={yd} state={selState} onRoute={(r) => selectRoute(r)} onPick={selectState} />
                  {selState !== null && (bal
                    ? <BringsIn bal={bal} year={year} state={selState} dir={bringDir} setDir={(d) => { setBringDir(d); setBringHover(null); }} hover={bringHover} setHover={setBringHover} />
                    : <p className="muted small">Loading what the state brings in…</p>)}
                </>
              )
              : tab === "commodity" ? <CommodityPanel yd={yd} com={com!} year={year} onState={selectState} />
              : tab === "measure" ? <MeasurePanel />
              : <AboutPanel />}
          </div>
        </aside>
      </main>
    </div>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * Math.max(0, Math.min(1, t)));
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, "0")}`;
}

function tooltipText(hit: Hit, yd: YearData, fi: Map<number, Flow>, national: number[], names: string[], ab: string[]): ReactNode {
  if (!hit) return null;
  if (hit.kind === "state") {
    const s = hit.state;
    const loc = yd.local[ab[s]];
    return (
      <>
        <b>{names[s]}</b>
        <div>Ships {usd(yd.supply[s])} to other states ({pct(national[s])} of the national total)</div>
        <div>Receives {usd(yd.inbound[s])}{loc ? <>; top supplier {loc[0]} with {pct(loc[1])}</> : null}</div>
      </>
    );
  }
  const o = Math.floor(hit.id / 51), d = hit.id % 51;
  const f = fi.get(hit.id);
  if (!f) return null;
  return (
    <>
      <b>{ab[o]} → {ab[d]}</b>
      <div>{usd(f[2])} · {pct(share(yd, f))} of {ab[d]}'s interstate supply of it, from {ab[o]}</div>
      <div className={f[3] < common().thin ? "warn" : ""}>{confidence(f[3]).label}</div>
      <div className="muted">Click for the route</div>
    </>
  );
}

function Seg<T extends string>({ label, items, value, onChange, test }: { label: string; items: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; test: string }) {
  return (
    <div className="fm-seg" role="group" aria-label={label}>
      {items.map(([v, l]) => (
        <button key={v} className={v === value ? "on" : ""} onClick={() => onChange(v)} data-testid={`${test}-${v}`} aria-pressed={v === value}>{l}</button>
      ))}
    </div>
  );
}

const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Commodity search. In browse mode (all-commodities view) the box starts empty and its hint cycles through the commodities. */
function CommodityPicker({ sctg, year, onPick, browse = false }: { sctg: string; year: Year; onPick: (c: string) => void; browse?: boolean }) {
  const list = useMemo(() => [...common().commodities].sort((a, b) => b[2][year][0] - a[2][year][0]), [year]);
  const current = list.find((c) => c[0] === sctg);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState(0);
  const cycling = browse && !open && !REDUCED_MOTION;
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => { if (!document.hidden) setHint((h) => (h + 1) % list.length); }, 2200);
    return () => clearInterval(id);
  }, [cycling, list.length]);
  // With a search term, an exact name comes first, then names starting with it, then other matches; each tier by dollars.
  const ql = q.trim().toLowerCase();
  const tier = (name: string) => (name.toLowerCase() === ql ? 0 : name.toLowerCase().startsWith(ql) ? 1 : 2);
  const shown = !ql ? list
    : list.filter((c) => c[1].toLowerCase().includes(ql) || c[0].includes(ql)).sort((a, b) => tier(a[1]) - tier(b[1]));
  const pick = (c: string) => { onPick(c); setQ(""); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && shown[active]) { e.preventDefault(); pick(shown[active][0]); }
    else if (e.key === "Escape") setOpen(false);
  };
  const placeholder = !browse ? "Search commodities"
    : cycling ? `Try: ${list[hint % list.length][1]}` : `Search ${list.length} commodities`;
  return (
    <div className="fm-pick">
      <input
        value={open ? q : browse ? "" : current ? `${current[1]}` : ""}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQ(""); setActive(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); }}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-controls="commodity-list"
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `commodity-opt-${shown[active][0]}` : undefined}
        aria-label={browse ? `Map one commodity (${list.length} available)` : "Commodity"}
        data-testid={browse ? "commodity-browse" : "commodity-input"}
      />
      {open && (
        <ul className="fm-pick-list" role="listbox" id="commodity-list" aria-label="Commodities">
          {!q && <li className="fm-pick-head" role="presentation">{list.length} commodities, by {year} interstate dollars</li>}
          {shown.map((c, i) => (
            <li key={c[0]} id={`commodity-opt-${c[0]}`} role="option" aria-selected={i === active} className={!browse && c[0] === sctg ? "current" : ""}
              onMouseDown={() => pick(c[0])} onMouseEnter={() => setActive(i)} data-testid={`commodity-opt-${c[0]}`}>
              <span>{c[1]}</span><span className="muted">SCTG {c[0]} · {usd(c[2][year][0])}</span>
            </li>
          ))}
          {!shown.length && <li className="muted">No match</li>}
        </ul>
      )}
    </div>
  );
}

function Legend({ view, selState, names, C, measure, setMeasure, gdpLens, ties = "plain", sized, comName, year, side }: { view: View; selState: number | null; names: string[]; C: Palette; measure?: Measure; setMeasure?: (m: Measure) => void; gdpLens?: boolean; ties?: "none" | "plain" | "lit"; sized: boolean; comName?: string; year: Year; side: Side }) {
  // Where an appearance also scales each state's dots by the same value, the legend names all three channels.
  return (
    <div className="fm-legend" data-testid="legend" data-occludes>
      {view === "pairs" && <PairsLegend side={side} year={year} />}
      {(view === "flows" || view === "reliance") && comName && <div className="fm-legend-title" data-testid="legend-commodity">Mapping: {comName}, {year}</div>}
      {view === "flows" && (selState === null ? (
        <>
          <div><i style={{ background: C.amber }} /> Route, width by dollars, rising with value</div>
          <div><i style={{ background: C.thinRoute }} /> Thin: fewer than {common().thin} survey records</div>
        </>
      ) : (
        <>
          <div><i style={{ background: C.teal }} /> {names[selState]} relies on (inbound)</div>
          <div><i style={{ background: C.amber }} /> {names[selState]} supplies (outbound)</div>
        </>
      ))}
      {view === "reliance" && <div data-testid="legend-reliance"><i style={{ background: C.relief }} /> {sized ? "Height and dot size" : "Height"}: state's share of national interstate shipments of this commodity</div>}
      {view === "position" && measure && (
        <>
          {gdpLens ? <div data-testid="legend-gdp">{sized ? "Color, height and dot size by" : "Color and height by"} GDP, the usual measure of size</div> : <label className="fm-legend-select">
            <span data-testid="legend-encodes">{sized ? "Color, height and dot size by" : "Color and height by"}</span>
            <select value={measure} onChange={(e) => setMeasure?.(e.target.value as Measure)} data-testid="measure" aria-describedby="measure-plain">
              {(Object.keys(MEASURE_NAMES) as Measure[]).map((m) => <option key={m} value={m}>{MEASURE_NAMES[m]}</option>)}
            </select>
          </label>}
          {!gdpLens && <p className="fm-legend-def" id="measure-plain" data-testid="measure-plain">{MEASURE_PLAIN[measure]}</p>}
          <div className="fm-ramp"><span>low</span><i style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => interpolateSequential(t)).join(", ")})` }} /><span>high</span></div>
          {!gdpLens && measure === "betweenness" && <div><i style={{ background: C.state }} /> No brokerage: on no shortest paths</div>}
          {ties !== "none" && <div><i style={{ background: ties === "lit" ? C.teal : C.amber }} /> Largest interstate links, width by dollars</div>}
        </>
      )}
    </div>
  );
}

function GapChart({ yd, route, onPick, names }: { yd: YearData; route: Route | null; onPick: (r: Route) => void; names: string[] }) {
  const W = 340, H = 200, L = 50, R = 10, T = 14, B = 34;
  const ys = (r: number | null) => {
    if (r === null) return T + 2;
    const v = Math.log10(Math.max(0.1, Math.min(10, r)));
    return T + 14 + ((1 - v) / 2) * (H - T - B - 14);
  };
  const xs = (s: number) => L + ((s - 0.5) / 0.5) * (W - L - R);
  const sel = route ? yd.links.find((l) => l[1] === route[0] && l[0] === route[1]) : undefined;
  return (
    <div className="fm-chart" data-testid="gap-chart">
      <div className="fm-chart-head">
        <b>Majority links</b> <span className="muted">· {yd.links.length} routes where one state sends over half</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Majority links: share against distance gap ratio">
        {[0.1, 1, 10].map((r) => (
          <g key={r}>
            <line x1={L} x2={W - R} y1={ys(r)} y2={ys(r)} className={r === 1 ? "axis1" : "grid"} />
            <text x={L - 6} y={ys(r) + 3} textAnchor="end" className="tick">{r === 1 ? "1×" : `${r}×`}</text>
          </g>
        ))}
        <text x={L - 6} y={T + 5} textAnchor="end" className="tick">none</text>
        {[0.5, 0.75, 1].map((s) => <text key={s} x={xs(s)} y={H - B + 14} textAnchor="middle" className="tick">{Math.round(s * 100)}%</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="lab">share of the destination's interstate supply from its top state</text>
        <text x={10} y={(T + H - B) / 2 + 6} textAnchor="middle" className="lab" transform={`rotate(-90 10 ${(T + H - B) / 2 + 6})`}>distance ratio</text>
        {yd.links.map((l) => {
          const isSel = l === sel;
          const r = l[7];
          return (
            <circle
              key={`${l[1]}-${l[0]}`}
              cx={xs(l[2])} cy={ys(r)} r={isSel ? 6 : 3.6}
              className={`dot${l[9] ? " persistent" : ""}${isSel ? " sel" : ""}`}
              onClick={() => onPick([l[1], l[0]])}
              data-testid={`chart-dot-${l[1]}-${l[0]}`}
            >
              <title>{`${names[l[1]]} → ${names[l[0]]}: ${pct(l[2])}, ratio ${r === null ? "none ships as much" : r.toFixed(2)}${l[9] ? ", persistent" : ""}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="fm-chart-foot muted">
        <span><i className="dotkey persistent" /> majority link in all three surveys</span>
        <span>Above 1×: the next state shipping as much is farther away</span>
      </div>
    </div>
  );
}

function Spark({ values }: { values: (number | null)[] }) {
  const W = 150, H = 44;
  const x = (i: number) => 12 + i * ((W - 24) / 2);
  const y = (v: number) => 6 + (1 - v) * (H - 18);
  const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
  return (
    <svg className="fm-spark" viewBox={`0 0 ${W} ${H}`} data-testid="sparkline">
      <line x1={8} x2={W - 8} y1={y(0.5)} y2={y(0.5)} className="grid" />
      <polyline points={pts.filter(Boolean).map((p) => p!.join(",")).join(" ")} className="line" />
      {pts.map((p, i) => p
        ? <circle key={i} cx={p[0]} cy={p[1]} r={3} className="pt" />
        : <circle key={i} cx={x(i)} cy={y(0)} r={3} className="pt hollow" />)}
      {YEARS.map((yr, i) => <text key={yr} x={x(i)} y={H - 1} textAnchor="middle" className="tick">{yr}</text>)}
    </svg>
  );
}

function Row({ k, v, test }: { k: string; v: ReactNode; test?: string }) {
  return <div className="fm-row"><span>{k}</span><b data-testid={test}>{v}</b></div>;
}

function RoutePanel({ yd, com, year, route, flow, cands, onState }: { yd: YearData; com: Commodity; year: Year; route: Route | null; flow: Flow | undefined; cands: ReturnType<typeof candidates>; onState: (s: number) => void }) {
  const cm = common();
  if (!route) return <p className="muted">Click any arc on the map, or a dot in the chart, to see one route: its share, its record count and how far the next sufficient supplier is.</p>;
  const [o, d] = route;
  if (!flow) return <p className="muted" data-testid="route-empty">No {com.name.toLowerCase()} shipments from {cm.names[o]} to {cm.names[d]} were recorded in {year}.</p>;
  const sh = share(yd, flow);
  const conf = confidence(flow[3]);
  const own = cm.centroidMiles[o][d];
  const near = cands[0];
  const ratio = flow[5];
  const history = YEARS.map((y) => {
    const yy = com.years[y];
    const f = yy.flows.find((x) => x[0] === o && x[1] === d);
    return f ? share(yy, f) : null;
  });
  const majority = YEARS.filter((y) => com.years[y].links.some((l) => l[1] === o && l[0] === d));
  const s = yd.surprise.find((x) => x[0] === o && x[1] === d);
  return (
    <div data-testid="route-panel">
      <h2>{cm.names[o]} → {cm.names[d]}</h2>
      <p className="muted">{com.name} · {year}</p>
      <div className="fm-big">
        <div><b data-testid="route-share">{pct(sh)}</b><span>of {cm.states[d]}'s interstate {com.name.toLowerCase()} come from {cm.names[o]}</span></div>
        <div><b data-testid="route-usd">{usd(flow[2])}</b><span>shipped in {year}</span></div>
      </div>
      <div className={`fm-conf t${conf.tier}`} data-testid="route-records">
        <span className="bar"><i style={{ width: `${Math.min(100, (Math.log10(flow[3] + 1) / Math.log10(3000)) * 100)}%` }} /></span>
        {conf.label}{conf.tier === 0 ? ": too few to lean on" : conf.tier === 3 ? ": well recorded" : ""}
      </div>

      <h3>How far is the next sufficient supplier?</h3>
      <p className="small">A state other than {cm.states[o]} whose interstate shipments of {com.name.toLowerCase()}, to anywhere, are at least this route's {usd(flow[2])}. Distances between the states' centers of population.</p>
      {near ? (
        <>
          <div className="fm-gap">
            <div className="fm-gap-track">
              <span className="here" style={{ left: `${Math.min(100, (own / Math.max(near.miles, own) ) * 100)}%` }} />
              <span className="next" style={{ left: `${Math.min(100, (near.miles / Math.max(near.miles, own)) * 100)}%` }} />
            </div>
            <div className="fm-gap-labels">
              <span>{cm.states[o]}: {int(own)} mi</span><span>{cm.states[near.state]}: {int(near.miles)} mi</span>
            </div>
          </div>
          <Row k="Distance ratio (next ÷ this)" v={ratio === null ? "n/a" : `${ratio.toFixed(2)}×`} test="route-ratio" />
          <Row k="Gap in miles" v={`${near.miles - own >= 0 ? "+" : ""}${int(Math.round(near.miles - own))} mi`} test="route-gap" />
          <Row k="Median shipment distance on this route" v={`${int(flow[4])} mi`} />
          <div className="fm-cands" data-testid="route-cands">
            {cands.slice(0, 6).map((c) => (
              <button key={c.state} onClick={() => onState(c.state)}><span>{cm.names[c.state]}</span><span className="muted">{int(c.miles)} mi · ships {usd(c.supply)}</span></button>
            ))}
            {cands.length > 6 && <div className="muted small">and {cands.length - 6} more</div>}
          </div>
        </>
      ) : <p data-testid="route-ratio">No other state ships as much {com.name.toLowerCase()} in total as this route carries. This compares volumes only.</p>}

      <h3>Over three surveys</h3>
      <div className="fm-spark-row">
        <Spark values={history} />
        <div className="small">Share of {cm.states[d]}'s supply: {history.map((h, i) => `${YEARS[i]} ${h === null ? "none" : pct(h)}`).join(" · ")}.<br />
          Majority link in {majority.length ? majority.join(", ") : "no survey"} ({majority.length} of 3).</div>
      </div>

      <h3>What pairs miss</h3>
      {s ? (
        <p data-testid="route-surprise">Observed is <b>{times(s[2])}</b> what the all-pairs model predicts (90% bootstrap range {times(s[3])} to {times(s[4])}; {int(s[5])} records{s[6].length ? `; same sign in ${s[6].join(" and ")}` : ""}).</p>
      ) : (
        <p className="small muted" data-testid="route-surprise">No reading shown. A route is shown only with 300 or more records, or when the same surplus or shortfall appears in another survey, and when observed is at least double or half the prediction.</p>
      )}
    </div>
  );
}

function StatePanel({ yd, state, onRoute, onPick }: { yd: YearData; state: number | null; onRoute: (r: Route) => void; onPick: (s: number | null) => void }) {
  const cm = common();
  if (state === null) return <p className="muted">Click a state, or choose one above, to split its routes into what it relies on (inbound, teal) and what it supplies (outbound, amber).</p>;
  const loc = yd.local[cm.states[state]];
  const inbound = yd.flows.filter((f) => f[1] === state).slice(0, 8);
  const outbound = yd.flows.filter((f) => f[0] === state).slice(0, 8);
  const total = yd.supply.reduce((a, b) => a + b, 0) || 1;
  return (
    <div data-testid="state-panel">
      <h2>{cm.names[state]}</h2>
      <div className="fm-big">
        <div><b data-testid="state-inbound">{usd(yd.inbound[state])}</b><span>received from other states</span></div>
        <div><b data-testid="state-supply">{usd(yd.supply[state])}</b><span>shipped to other states ({pct(yd.supply[state] / total)} of the national total)</span></div>
      </div>
      {loc && (
        <>
          <Row k="Top supplier" v={`${loc[0]}, ${pct(loc[1])}`} test="state-top" />
          <Row k="Supplier concentration (HHI)" v={loc[2].toFixed(2)} />
          <Row k="Supplying states" v={loc[3]} />
          <Row k="Inbound records" v={int(loc[4])} />
        </>
      )}
      <div className="fm-split">
        <div>
          <h3 className="teal">Relies on</h3>
          {inbound.map((f) => (
            <button key={f[0]} onClick={() => onRoute([f[0], f[1]])} className={f[3] < cm.thin ? "thin" : ""}>
              <span>{cm.states[f[0]]}</span><span>{pct(share(yd, f))}</span>
            </button>
          ))}
          {!inbound.length && <p className="muted small">No inbound records.</p>}
        </div>
        <div>
          <h3 className="amber">Supplies</h3>
          {outbound.map((f) => (
            <button key={f[1]} onClick={() => onRoute([f[0], f[1]])} className={f[3] < cm.thin ? "thin" : ""}>
              <span>{cm.states[f[1]]}</span><span>{pct(share(yd, f))}</span>
            </button>
          ))}
          {!outbound.length && <p className="muted small">No outbound records.</p>}
        </div>
      </div>
      <p className="small muted">Percentages are each route's share of the destination's interstate supply. Greyed rows rest on fewer than {cm.thin} records.</p>
      <button className="fm-btn ghost" onClick={() => onPick(null)}>Clear state</button>
    </div>
  );
}

function CommodityPanel({ yd, com, year, onState }: { yd: YearData; com: Commodity; year: Year; onState: (s: number) => void }) {
  const cm = common();
  const total = yd.supply.reduce((a, b) => a + b, 0) || 1;
  const top = yd.supply.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 6);
  const persistent = yd.links.filter((l) => l[9]).length;
  return (
    <div data-testid="commodity-panel">
      <h2>{com.name}</h2>
      <p className="muted">SCTG {com.sctg} · {year}</p>
      <div className="fm-big">
        <div><b data-testid="commodity-usd">{usd(yd.usd)}</b><span>shipped between states</span></div>
        <div><b>{int(yd.records)}</b><span>survey records</span></div>
      </div>
      <h3>Who ships it</h3>
      {top.map(([s, i]) => (
        <button key={i} className="fm-barrow" onClick={() => onState(i)}>
          <span>{cm.names[i]}</span>
          <span className="bar"><i style={{ width: `${(s / top[0][0]) * 100}%` }} /></span>
          <span>{pct(s / total)}</span>
        </button>
      ))}
      <Row k="Majority links (one origin sends over half)" v={yd.links.length} test="commodity-links" />
      <Row k="of which held in all three surveys" v={persistent} />
      <Row k="Share of the year's three-way part" v={pct(yd.threeWayShare)} />
      <Row k="Surprise routes shown / tested" v={`${yd.surprise.length} / ${int(yd.surpriseTested)}`} />
      <p className="small muted">The three-way part is the dependence among origin, destination and commodity that no model of pairs reproduces; this commodity's routes carry the share above of it, in dollars.</p>
    </div>
  );
}

function AboutPanel() {
  return (
    <div data-testid="about-panel">
      <section className="fm-author" id="author-note" data-testid="author-note">
        <h3>Author's note</h3>
        <p>Power is a fundamental question of theoretical political economy. Mainstream economics has few tools for reasoning about it in a holistic, systemic way, so it gets reduced to simple dimensions and types. Political science has a rich tradition of using network science to study different kinds of power, and economic complexity research is doing great work, but each looks along its own dimensions.</p>
        <p>I am curious what would happen if we had a robust, comprehensive, systemic measure of political economic power. What would it reveal about the current structure and dynamics of the US political economy? This site is a first result toward an answer.</p>
        <p>I see the Observatory as an interdisciplinary program: political scientists, economists, and systems and complex systems researchers developing comprehensive, integrated measures of state power in the context of US federalism.</p>
        <p>If it interests you, tackle an <a href="https://github.com/rsthornton/statepower/issues">open issue</a>, leave a comment with feedback, share it with a friend, or reach out to discuss problems, ideas and feature requests (<a href="mailto:rthornton@binghamton.edu">rthornton@binghamton.edu</a>).</p>
        <p className="small muted">Shingai Thornton</p>
      </section>
      <h3>What this site shows</h3>
      <p>{PAIRS ? "Four" : "Three"} views of one record, the Commodity Flow Survey's interstate shipments in 2012, 2017 and 2022.</p>
      <ul>
        <li><b>Position.</b> Each state's place in the national trade network on three measures (trade prestige, bridge position, export reach), set against its GDP rank.</li>
        <li><b>Flows.</b> Who ships each of 40 commodities to whom, how concentrated each destination's supply is, and how far the next sufficient supplier sits.</li>
        <li><b>Structure over time.</b> Whether positions hold across the three surveys, tested against thresholds registered before the 2022 comparison was run.</li>
        {PAIRS && <li><b>Beyond pairs.</b> How much of the shipments' pattern models of pairs capture, and which states carry what they miss. Post hoc, exploratory.</li>}
      </ul>
      <section className="fm-claim" data-testid="claim-card-position">
        <div className="tier">Observed data, association</div>
        <h3>Position: premises</h3>
        <ul>
          <li>States are nodes; the dollar value of interstate shipments, all commodities except SCTG 16, weights the links between them.</li>
          <li>Trade prestige (in-flow eigenvector) is high for a state that receives large shipments from states that themselves score high. Bridge position (betweenness) counts how often a state lies on the shortest paths between others, where heavy trade counts as a short step. Export reach (weighted out-degree) is what a state ships, relative to the largest shipper.</li>
          <li>GDP rank stands in for economic size.</li>
        </ul>
        <h3>Shown</h3>
        <ul><li>Where network rank and GDP rank part ways, by five places or more, and whether those gaps hold across three surveys.</li></ul>
        <h3>Does not show</h3>
        <ul><li>Bargaining power, political influence or welfare; trade within a state, with other countries, in services or in finance.</li></ul>
        <h3>Commonly misread as</h3>
        <ul><li>"The country depends on this state." High trade prestige means a state draws in trade from central states; who depends on whom as a supplier is the Flows view's question.</li></ul>
      </section>
      <h3>Flows</h3>
      <section className="fm-claim" data-testid="claim-card">
        <div className="tier">Observed data, association</div>
        <h3>Premises</h3>
        <ul>
          <li>The Commodity Flow Survey's public record files (2012, 2017, 2022) describe interstate shipments by origin, destination and commodity, weighted to national totals.</li>
          <li>A state's total interstate shipments of a commodity stand in for its capacity to supply.</li>
          <li>Distance between centers of population stands in for the cost of switching suppliers.</li>
        </ul>
        <h3>Shown</h3>
        <ul><li>How concentrated each destination's supply is, how far the next sufficient supplier sits, how stable both are across three surveys, and which routes carry more or less than a model of pairs predicts.</li></ul>
        <h3>Does not show</h3>
        <ul><li>Capacity, contracts, prices, product grades or modal access; what would happen if a route closed; why any route exists.</li></ul>
        <h3>Commonly misread as</h3>
        <ul><li>"This state cannot get it anywhere else." A high share is a description of observed flows, and a distance ratio is a bound on one kind of replaceability, not a test of it.</li></ul>
      </section>
      <h3>Sources</h3>
      <ul className="small">
        <li>US Census Bureau and Bureau of Transportation Statistics, Commodity Flow Survey: 2012 Public Use Microdata File, 2017 Public Use File, 2022 Public Use Microdata Sample. Interstate records, 40 two-digit SCTG commodities.</li>
        <li>Census Bureau 2020 state centers of population; county adjacency file, 2024.</li>
        <li>State shapes: us-atlas (Census cartographic boundaries), Albers USA projection with Alaska and Hawaii inset.</li>
        <li>Coasts, oceans and terrain around the states (decoration, not data): Natural Earth 1:50m land and lakes (v5.1.2), us-atlas 3.0.1 nation outline, and AWS Terrain Tiles elevation and sea depth (zoom 5), all public domain. Relief is exaggerated and drawn only outside the states; it never changes a state's height or color.</li>
        <li>Analysis and audit: <code>analysis/higher_order/README.md</code> and <code>analysis/higher_order/audit/AUDIT.md</code> in the repository (post hoc, not pre-registered).</li>
      </ul>
      <h3>Caveats</h3>
      <ul className="small">
        <li>Weighted dollars have no sample size; record counts are shown as a guide to support, and noise estimates are lower bounds.</li>
        <li>The 2022 file is a different, larger sample with different codes; record thresholds bind differently by year.</li>
        <li>Two-digit commodity codes mix products (all fuel oils, all pharmaceuticals).</li>
        <li>Supply means shipments to other states; a producer that mostly serves its own state is undercounted.</li>
      </ul>
    </div>
  );
}

function positionTip(hit: Hit, net: Network, measure: Measure, ab: string[]): ReactNode {
  if (!hit) return null;
  if (hit.kind === "state") {
    const r = net.states[hit.state];
    const rank = r[`rank_${measure}`];
    return (
      <>
        <b>{r.name}</b>
        <div>{MEASURE_NAMES[measure]}: {measure === "betweenness" && r.no_brokerage ? "no brokerage" : `#${rank} of 51`}</div>
        <div>GDP rank #{r.gdp_rank}</div>
      </>
    );
  }
  const o = Math.floor(hit.id / 51), d = hit.id % 51;
  const e = net.edges.find((x) => x[0] === ab[o] && x[1] === ab[d]);
  return e ? <><b>{ab[o]} → {ab[d]}</b><div>{usd(e[2] / 1e3)} shipped, all commodities, {net.year}</div></> : null;
}

function pairsTip(hit: Hit, ra: Ra, side: Side): ReactNode {
  if (!hit || hit.kind !== "state") return null;
  const i = hit.state;
  return (
    <>
      <b>{common().names[i]}</b>
      <div>{Math.exp(ra[side].netOfSize[i]).toFixed(1)}× what pairs miss for a {side} state its size</div>
      <div className="muted">{ra[side].carry[i].toFixed(1)}× its size share, before adjusting</div>
    </>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : "0");

function PositionStatePanel({ net, state, measure, onPick, bal, year, onCommodity }: { net: Network; state: number | null; measure: Measure; onPick: (s: number | null) => void; bal: Balance | null; year: Year; onCommodity: (c: string) => void }) {
  if (state === null) return <p className="muted">Click a state, or choose one above, to see its three network measures for {net.year} next to its GDP rank. Choose the measure in the legend on the map.</p>;
  const r = net.states[state];
  const row = (m: Measure) => (m === "betweenness" && r.no_brokerage ? "no brokerage" : `#${r[`rank_${m}`]}`);
  return (
    <div data-testid="position-state-panel">
      <h2>{r.name}</h2>
      <p className="muted">All commodities · {net.year}</p>
      <div className="fm-big">
        <div><b data-testid="pos-rank">{row(measure)}</b><span title={MEASURE_PLAIN[measure]}>{MEASURE_NAMES[measure]}</span></div>
        <div><b data-testid="pos-gdp">#{r.gdp_rank}</b><span>GDP rank (${int(Math.round(r.gdp_billions))}B)</span></div>
      </div>
      <Row k="Trade prestige" v={row("eigenvector")} test="pos-eigenvector" />
      <Row k="Bridge position" v={row("betweenness")} test="pos-betweenness" />
      <Row k="Export reach" v={row("out_degree")} test="pos-out_degree" />
      <Row k="GDP rank minus trade prestige rank" v={signed(r.gap_eigenvector)} test="pos-gap" />
      <p className="small muted">A gap of +5 or more marks a structurally undervalued state. Ranks: 1 is highest. Bridge position counts shortest paths through the network, not physical routes.</p>
      {bal ? <StateProfile bal={bal} year={year} state={state} onCommodity={onCommodity} /> : <p className="muted small">Loading commodities…</p>}
      <button className="fm-btn ghost" onClick={() => onPick(null)}>Clear state</button>
    </div>
  );
}

function RankingsPanel({ net, measure, onPick }: { net: Network; measure: Measure; onPick: (s: number) => void }) {
  const rk = `rank_${measure}` as const;
  const rows = net.states.map((r, i) => [r, i] as const).sort((a, b) => a[0][rk] - b[0][rk] || a[0].state.localeCompare(b[0].state));
  return (
    <div data-testid="rankings-panel">
      <table className="fm-table">
        <caption className="small muted">{MEASURE_NAMES[measure]}, {net.year}, all 51; select a row to open the state.</caption>
        <thead><tr><th scope="col">Rank</th><th scope="col">State</th><th scope="col">GDP rank</th><th scope="col">Gap</th></tr></thead>
        <tbody>
          {rows.map(([r, i]) => (
            <tr key={r.state} onClick={() => onPick(i)} onKeyDown={(e) => e.key === "Enter" && onPick(i)} tabIndex={0}>
              <td>{measure === "betweenness" && r.no_brokerage ? "none" : r[rk]}</td><td>{r.name}</td><td>{r.gdp_rank}</td><td>{measure === "betweenness" && r.no_brokerage ? "none" : signed(r.gdp_rank - r[rk])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Group({ label, nested, quiet, children }: { label: string; nested?: boolean; quiet?: boolean; children: ReactNode }) {
  return (
    <div className={`fm-group${nested ? " nested" : ""}${quiet ? " quiet" : ""}`} role="group" aria-label={label}>
      <span className="fm-glabel" aria-hidden="true">{label}</span>
      <div className="fm-group-row">{children}</div>
    </div>
  );
}

function StateSelect({ value, onPick, names }: { value: number | null; onPick: (s: number | null) => void; names: string[] }) {
  const order = names.map((n, i) => [n, i] as const).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <label className="fm-statesel">
      <span>State</span>
      <select value={value ?? ""} onChange={(e) => onPick(e.target.value === "" ? null : Number(e.target.value))} data-testid="state-select">
        <option value="">Choose a state…</option>
        {order.map(([n, i]) => <option key={i} value={i}>{n}</option>)}
      </select>
    </label>
  );
}
