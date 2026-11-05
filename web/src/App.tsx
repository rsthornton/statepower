import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  loadAllCore,
  loadCommodityCentralities,
  loadCommodityEdges,
  loadCommodityTotals,
} from "./data/loader";
import { topoFeature } from "./lib/topo";
import { MEASURE_COLORS } from "./lib/colors";
import TradeMap from "./components/TradeMap";
import CentralityPills from "./components/CentralityPills";
import CommodityFilter from "./components/CommodityFilter";
import ColorLegend from "./components/ColorLegend";
import DivergenceView from "./components/rankings/DivergenceView";
import StateDossier from "./components/drawer/StateDossier";
import Wordmark from "./components/brand/Wordmark";
import Footer from "./components/Footer";
import { Button, SegmentedControl, Slider } from "./components/ui";
import HeroFinding from "./components/HeroFinding";
import ClaimStrip from "./components/ClaimStrip";
import { readInitialUrlState, useSyncUrlState } from "./hooks/useUrlState";
import type {
  BaseCentralityRow,
  CommodityCentralityRow,
  CoreData,
  Edge,
  Measure,
  StateTotals,
} from "./types";

// Interactive WASM notebook hosted on molab (marimo Cloud).
const NOTEBOOK_URL = "https://molab.marimo.io/notebooks/nb_nMExyXbgvNSdHcr7C9EjfZ/app";
const REPO_URL = "https://github.com/rsthornton/statepower";

// DEV-only component gallery (lazy: its chunk is never loaded in production).
const Gallery = import.meta.env.DEV ? lazy(() => import("./dev/Gallery")) : null;

type NetworkType = "51" | "52";
type FlowDirection = "both" | "in" | "out";
type View = "map" | "divergence";

const ENERGY_CODES = new Set(["15", "16", "17", "18", "19", "15-19"]);
const ENERGY_SCOPE_NOTE =
  "Crude oil is absent from the public 2017 survey file, and pipeline transmission, electricity and foreign imports are outside the survey, so energy dependence is understated here.";

const MEASURE_NAMES: Record<Measure, { plain: string; technical: string }> = {
  eigenvector: { plain: "Trade prestige", technical: "eigenvector" },
  betweenness: { plain: "Bridge position", technical: "betweenness" },
  out_degree: { plain: "Export reach", technical: "weighted out-degree" },
};

export default function App() {
  const [data, setData] = useState<CoreData | null>(null);
  const [view, setView] = useState<View>("map");
  const [measure, setMeasure] = useState<Measure>(
    () => readInitialUrlState().measure ?? "eigenvector",
  );
  const [selectedState, setSelectedState] = useState<string | null>(
    () => readInitialUrlState().state,
  );
  const [networkType, setNetworkType] = useState<NetworkType>("51");
  const [showEdges, setShowEdges] = useState(true);
  const [topN, setTopN] = useState(50);
  const [flowDirection, setFlowDirection] = useState<FlowDirection>("both");
  const [commodity, setCommodity] = useState("all");
  const [commodityCentralities, setCommodityCentralities] = useState<
    CommodityCentralityRow[] | null
  >(null);
  const [commodityEdges, setCommodityEdges] = useState<Edge[] | null>(null);
  const [commodityTotals, setCommodityTotals] = useState<StateTotals[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllCore().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (commodity === "all") {
      setCommodityCentralities(null);
      setCommodityEdges(null);
      setCommodityTotals(null);
      return;
    }
    loadCommodityCentralities().then((all) => {
      const filtered = all.filter((r) => r.commodity_code === commodity);
      setCommodityCentralities(filtered);
    });
    loadCommodityEdges(commodity).then(setCommodityEdges);
    loadCommodityTotals(commodity).then(setCommodityTotals);
  }, [commodity]);

  const geojson = useMemo(() => {
    if (!data?.topo) return null;
    return topoFeature(data.topo, "states");
  }, [data?.topo]);

  const centralities = useMemo<BaseCentralityRow[]>(() => {
    if (!data) return [];
    if (commodity !== "all" && commodityCentralities) return commodityCentralities;
    return networkType === "51" ? data.centralities51 : data.centralities52;
  }, [data, networkType, commodity, commodityCentralities]);

  // Full weight-sorted edge set (topEdges is pre-sorted; sort commodity edges to be safe).
  const allEdges = useMemo<Edge[]>(() => {
    const raw = commodity !== "all" && commodityEdges ? commodityEdges : (data?.topEdges ?? []);
    return [...raw].sort((a, b) => b.weight - a.weight);
  }, [data, commodity, commodityEdges]);

  // Top-N slice actually drawn / explored.
  const edges = useMemo(() => allEdges.slice(0, topN), [allEdges, topN]);

  const stateNames = useMemo(
    () => Object.fromEntries((data?.centralities51 ?? []).map((r) => [r.state, r.state_name])),
    [data],
  );

  // Interstate shipment value from the full flow matrix, for the subtitle.
  const interstateTrillions = useMemo(() => {
    const total = (data?.stateTotals ?? []).reduce((sum, t) => sum + t.out_total, 0);
    return total / 1e12;
  }, [data]);

  const selectedData = useMemo(() => {
    if (!selectedState || !centralities.length) return null;
    return centralities.find((r) => r.state === selectedState) ?? null;
  }, [selectedState, centralities]);

  // True per-state totals from the full flow matrix, for the active commodity.
  const selectedTotals = useMemo(() => {
    if (!selectedState || !data) return null;
    const source = commodity === "all" ? data.stateTotals : commodityTotals;
    return source?.find((t) => t.state === selectedState) ?? null;
  }, [selectedState, commodity, data, commodityTotals]);

  useSyncUrlState(selectedState, measure);

  // The active measure's hue marks hover outlines and the legend dot.
  const measureColor = MEASURE_COLORS[measure];
  const stageStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-card)",
  };
  const isEnergy = ENERGY_CODES.has(commodity);

  if (Gallery && location.hash === "#/components") {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div style={{ animation: "ipo-pulse 1.6s ease-in-out infinite" }}>
          <Wordmark size={28} />
        </div>
        <div
          className="text-xs font-mono tracking-[0.18em] uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Loading network data
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
     <div className="mx-auto w-full max-w-[1240px]">
      <header className="px-4 sm:px-6 pt-5">
        <div
          className="flex items-center justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Wordmark />
            <span
              className="hidden sm:inline pl-3 text-sm whitespace-nowrap"
              style={{ color: "var(--text-muted)", borderLeft: "1px solid var(--border)" }}
            >
              Commodity flows, 2017
            </span>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6 text-[13px] sm:text-sm whitespace-nowrap">
            <a
              href={NOTEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent-blue)" }}
            >
              Methods
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent-blue)" }}
            >
              <span className="sm:hidden">Code</span>
              <span className="hidden sm:inline">Data and code</span>
            </a>
          </nav>
        </div>

        <div className="pt-8 pb-1">
          <h1
            className="font-serif text-[30px] sm:text-[38px] font-semibold leading-[1.15] tracking-[-0.01em]"
            style={{ color: "var(--text-primary)" }}
          >
            Economic weight is more than GDP
          </h1>
          <p
            className="text-base sm:text-[17px] mt-3 max-w-[64ch] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            How each state supplies, buys and brokers the goods moving between states, set
            against the size of its economy.
          </p>
          <div className="hidden lg:block">
            <ClaimStrip>
              <HeroFinding centralities={data.centralities51} measure={measure} />
            </ClaimStrip>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 pt-6 flex flex-col lg:flex-row gap-5 items-start">
        {/* Control rail: filters only. Below lg it follows the stage, so the map comes first. */}
        <aside className="order-2 lg:order-none w-full lg:w-[280px] lg:shrink-0 flex flex-col gap-5">
          <RailSection title="Measure">
            <CentralityPills vertical selected={measure} onSelect={setMeasure} />
          </RailSection>

          <RailSection title="Commodity">
          <CommodityFilter
            selected={commodity}
            onSelect={(code) => {
              setCommodity(code);
              if (code !== "all") setNetworkType("51");
            }}
            metadata={data.metadata}
          />
          </RailSection>

          {view === "map" && (
            <RailSection title="Flows">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  mono
                  disabled={commodity !== "all"}
                  onClick={() => setNetworkType(networkType === "51" ? "52" : "51")}
                >
                  {networkType === "51" ? "Domestic network" : "With foreign trade"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  mono
                  active={showEdges}
                  onClick={() => setShowEdges(!showEdges)}
                >
                  {showEdges ? "Flows shown" : "Flows hidden"}
                </Button>
              </div>

              {showEdges && (
                <div className="flex flex-col gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <label className="flex items-center gap-2">
                    <span className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      Largest
                    </span>
                    <Slider
                      min={Math.min(10, allEdges.length || 10)}
                      max={Math.max(allEdges.length, 10)}
                      step={10}
                      value={Math.min(topN, allEdges.length)}
                      onChange={setTopN}
                    />
                    <span className="font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {Math.min(topN, allEdges.length)}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ color: "var(--text-secondary)" }}>Direction</span>
                    <SegmentedControl
                      size="sm"
                      options={[
                        { value: "both", label: "All" },
                        { value: "in", label: "Inbound" },
                        { value: "out", label: "Outbound" },
                      ]}
                      value={flowDirection}
                      onChange={setFlowDirection}
                    />
                  </div>
                  {!selectedState && (
                    <span style={{ color: "var(--text-muted)" }}>Select a state to apply direction.</span>
                  )}
                </div>
              )}
            </div>
            </RailSection>
          )}
        </aside>

        {/* Stage */}
        <div className="order-1 lg:order-none flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <SegmentedControl
              size="lg"
              options={[
                { value: "map", label: "Map" },
                { value: "divergence", label: "GDP comparison" },
              ]}
              value={view}
              onChange={setView}
            />
            <span className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-secondary)" }}>
                Commodity Flow Survey 2017
                {interstateTrillions > 0 ? ` · $${interstateTrillions.toFixed(1)}T interstate shipments` : ""}
                {" · 50 states and DC"}
              </span>
              <br />
              {MEASURE_NAMES[measure].plain} ·{" "}
              {commodity === "all"
                ? "all commodities"
                : (data.metadata?.sctg_names?.[commodity] ??
                  Object.keys(data.metadata?.commodity_groups ?? {}).find(
                    (g) => (data.metadata?.commodity_groups?.[g] ?? []).includes(commodity),
                  ) ??
                  commodity)}
            </span>
          </div>
          {view === "map" ? (
            <div className="px-4 pt-4 pb-3" style={stageStyle}>
              <div className="relative">
                <TradeMap
                  geojson={geojson}
                  centralities={centralities}
                  measure={measure}
                  selectedState={selectedState}
                  onSelectState={setSelectedState}
                  edges={edges}
                  showEdges={showEdges}
                  flowDirection={flowDirection}
                  accent={measureColor}
                  maxHeightVh={selectedState ? 46 : 62}
                />
              </div>

              <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--hairline)" }}>
                <ColorLegend
                  label={`${MEASURE_NAMES[measure].plain} (${MEASURE_NAMES[measure].technical})`}
                  color={measureColor}
                  min={centralities.length ? Math.min(...centralities.map((r) => r[measure])) : 0}
                  max={centralities.length ? Math.max(...centralities.map((r) => r[measure])) : 1}
                />
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  {selectedState
                    ? "Select another state, or press Esc to clear."
                    : "Select a state for its ranks and trade partners."}{" "}
                  Lines show the largest shipment links, not routes.
                </p>
                {isEnergy && (
                  <p
                    role="note"
                    className="text-xs mt-2 px-3 py-2 rounded-md max-w-2xl leading-snug"
                    style={{
                      color: "var(--text-primary)",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span className="font-semibold">Coverage limit. </span>
                    {ENERGY_SCOPE_NOTE}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <DivergenceView
              centralities={centralities}
              measure={measure}
              selectedState={selectedState}
              onSelectState={setSelectedState}
              accent={measureColor}
            />
          )}

          {selectedState && selectedData && (
            <StateDossier
              state={selectedState}
              stateName={stateNames[selectedState] ?? selectedState}
              measure={measure}
              data={selectedData}
              edges={edges}
              totals={selectedTotals}
              scopeNote={isEnergy && view !== "map" ? ENERGY_SCOPE_NOTE : undefined}
              onClose={() => setSelectedState(null)}
            />
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:hidden">
        <ClaimStrip>
          <HeroFinding centralities={data.centralities51} measure={measure} />
        </ClaimStrip>
      </div>

      <div className="px-4 sm:px-6">
        <div
          className="flex items-center justify-between flex-wrap gap-2 mt-6 pt-3 text-xs font-mono"
          style={{ borderTop: "1px solid var(--hairline)", color: "var(--text-muted)" }}
        >
          <span>U.S. interstate shipments · CFS 2017</span>
          {data.stats && (
            <span>
              50 states and DC · {data.stats.edges.toLocaleString()} weighted links
            </span>
          )}
        </div>
      </div>

      <Footer />
     </div>
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
