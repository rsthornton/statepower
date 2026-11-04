import type { GeoLook } from "./geo";

export type ThemeName = "day" | "night" | "frost" | "frostband" | "frostneutral" | "observatory" | "observatorylight";

export type Palette = {
  amber: string; teal: string; thin: string; thinRoute: string; warm: string; cool: string;
  state: string; relief: string; raHigh: string; origin: string; dest: string; cand: string; sel: string; hot: string;
};

export type SceneTheme = {
  bg: string;
  fog: [number, number];
  ground: [string, string, string];
  grid: string;
  edge: string;
  edgeOpacity: number;
  edgeStrong: number;
  hemi: [string, string, number];
  key: [string, number];
  rim: [string, number];
  toneMapped: boolean;
  additive: boolean;
  arcSrgb: boolean;
  arcBase: number;
  arcPulse: number;
  arcWidth: number;
  roughness: number;
  /** Draw states as dot fields instead of solid extrusions. */
  field?: boolean;
  /** Bright particles per arc pass (2 = the original single pulse per half). */
  arcDash?: number;
  /** Arc alpha = base + pulse weight × pulse. */
  arcAlpha?: [number, number];
  /** Mix toward white for dots, so the dark end of the ramp stays visible on black. */
  dotLift?: number;
  /** Dot diameter follows the state's value (default true). Off on light grounds, where small dark dots would read
   *  lighter than large pale ones and break the order of the color ramp. */
  dotSized?: boolean;
  /** Dark rim on each dot (0..1), for light grounds; the fill keeps the ramp color. */
  dotRim?: number;
  /** Dot-field curtain walls: alpha at the ground and at the top edge. The vertical cue for height. */
  walls?: [number, number];
  /** Alpha of the ground footprint dots under each dot-field state (0 = none). */
  floorDots?: number;
  /** Ground layers around the states: land, water, relief (decoration, see geo.ts). */
  geo: GeoLook;
  /** Solid look (decoration): contact shadow opacity, wall brightness at the base (1 = flat), occlusion band strength at
   *  the ground, and the light rim along each wall's top edge. */
  solid: { shadow: number; base: number; ao: number; rim: string; rimAlpha: number };
};

export const THEMES: Record<ThemeName, { ui: Palette; scene: SceneTheme }> = {
  day: {
    ui: {
      amber: "#b85a00", teal: "#0b7d74", thin: "#8f949b", thinRoute: "#6f747b", warm: "#c2410c", cool: "#1d5bbf",
      state: "#ebe3d2", relief: "#c8741c", raHigh: "#7e2a0a", origin: "#e8a85a", dest: "#9cbbe0", cand: "#94d1c6", sel: "#e8a85a", hot: "#8f2d0b",
    },
    scene: {
      bg: "#efe8da",
      fog: [60, 110],
      ground: ["#f7f2e8", "#efe7d8", "#e6dcc9"],
      grid: "rgba(110,90,60,0.035)",
      edge: "#5e4b35",
      edgeOpacity: 0.55,
      edgeStrong: 0.95,
      hemi: ["#ffffff", "#bfae8e", 1.5],
      key: ["#fff1da", 2.4],
      rim: ["#dfe8f2", 0.6],
      toneMapped: false,
      additive: false,
      arcSrgb: true,
      arcBase: 1.0,
      arcPulse: -0.15,
      arcWidth: 1.15,
      roughness: 0.9,
      geo: { land: "#e9e4da", landUS: "#e6e0d4", shallow: "#d8e1e6", deep: "#bfccd6", coast: "#7b8794", coastAlpha: 0.45, relief: 0.16, shimmer: 0.012, glint: 0.06 },
      solid: { shadow: 0.2, base: 0.78, ao: 0.32, rim: "#ffffff", rimAlpha: 0.6 },
    },
  },
  frost: {
    ui: {
      amber: "#3d5a96", teal: "#16746a", thin: "#9aa5b1", thinRoute: "#7b8794", warm: "#b45309", cool: "#3d5a96",
      state: "#e3e8ee", relief: "#3d5a96", raHigh: "#24386a", origin: "#8fa3cc", dest: "#8cc5bd", cand: "#c3d0e3", sel: "#8fa3cc", hot: "#1b2a4e",
    },
    scene: {
      bg: "#eef2f6",
      fog: [60, 110],
      ground: ["#f7f9fb", "#eef2f6", "#e3e9f0"],
      grid: "rgba(50,70,100,0.04)",
      edge: "#5f6f84",
      edgeOpacity: 0.5,
      edgeStrong: 0.95,
      hemi: ["#ffffff", "#a8b5c5", 1.5],
      key: ["#f5f8ff", 2.4],
      rim: ["#dfe8f2", 0.6],
      toneMapped: false,
      additive: false,
      arcSrgb: true,
      arcBase: 1.0,
      arcPulse: -0.15,
      arcWidth: 1.15,
      roughness: 0.9,
      geo: { land: "#e9eef3", landUS: "#e3e9f0", shallow: "#d8e3ee", deep: "#b9cadc", coast: "#6f8197", coastAlpha: 0.45, relief: 0.16, shimmer: 0.012, glint: 0.07 },
      solid: { shadow: 0.2, base: 0.78, ao: 0.32, rim: "#ffffff", rimAlpha: 0.6 },
    },
  },
  frostband: {
    ui: {
      amber: "#3d5a96", teal: "#16746a", thin: "#9aa5b1", thinRoute: "#7b8794", warm: "#b45309", cool: "#3d5a96",
      state: "#e3e8ee", relief: "#3d5a96", raHigh: "#24386a", origin: "#8fa3cc", dest: "#8cc5bd", cand: "#c3d0e3", sel: "#8fa3cc", hot: "#1b2a4e",
    },
    scene: {
      bg: "#eef2f6",
      fog: [60, 110],
      ground: ["#f7f9fb", "#eef2f6", "#e3e9f0"],
      grid: "rgba(50,70,100,0.04)",
      edge: "#5f6f84",
      edgeOpacity: 0.5,
      edgeStrong: 0.95,
      hemi: ["#ffffff", "#a8b5c5", 1.5],
      key: ["#f5f8ff", 2.4],
      rim: ["#dfe8f2", 0.6],
      toneMapped: false,
      additive: false,
      arcSrgb: true,
      arcBase: 1.0,
      arcPulse: -0.15,
      arcWidth: 1.15,
      roughness: 0.9,
      geo: { land: "#e9eef3", landUS: "#e3e9f0", shallow: "#d8e3ee", deep: "#b9cadc", coast: "#6f8197", coastAlpha: 0.45, relief: 0.16, shimmer: 0.012, glint: 0.07 },
      solid: { shadow: 0.2, base: 0.78, ao: 0.32, rim: "#ffffff", rimAlpha: 0.6 },
    },
  },
  frostneutral: {
    ui: {
      amber: "#34508a", teal: "#16746a", thin: "#a3a3a3", thinRoute: "#7a7a7a", warm: "#b45309", cool: "#34508a",
      state: "#e6e6e5", relief: "#34508a", raHigh: "#24386a", origin: "#9aaacb", dest: "#93c6bf", cand: "#d2d2d0", sel: "#9aaacb", hot: "#1b2a4e",
    },
    scene: {
      bg: "#f3f3f2",
      fog: [60, 110],
      ground: ["#fafafa", "#f3f3f2", "#e8e8e6"],
      grid: "rgba(0,0,0,0.035)",
      edge: "#6b6b6b",
      edgeOpacity: 0.5,
      edgeStrong: 0.95,
      hemi: ["#ffffff", "#b4b4b2", 1.5],
      key: ["#ffffff", 2.4],
      rim: ["#e8e8e8", 0.6],
      toneMapped: false,
      additive: false,
      arcSrgb: true,
      arcBase: 1.0,
      arcPulse: -0.15,
      arcWidth: 1.15,
      roughness: 0.9,
      geo: { land: "#ececea", landUS: "#e6e6e4", shallow: "#dde4ea", deep: "#c2cdd8", coast: "#7b8590", coastAlpha: 0.42, relief: 0.15, shimmer: 0.012, glint: 0.06 },
      solid: { shadow: 0.2, base: 0.78, ao: 0.32, rim: "#ffffff", rimAlpha: 0.6 },
    },
  },
  night: {
    ui: {
      amber: "#f0a845", teal: "#4fc3b8", thin: "#7d8592", thinRoute: "#7d8592", warm: "#ff8a4c", cool: "#5aa9ff",
      state: "#2a3747", relief: "#e09a3e", raHigh: "#ffb347", origin: "#9a6424", dest: "#3f5f86", cand: "#2b7a70", sel: "#8a5a22", hot: "#ffe2a8",
    },
    scene: {
      bg: "#090d14",
      fog: [34, 70],
      ground: ["#18212e", "#0f1620", "#090d14"],
      grid: "rgba(160,180,210,0.05)",
      edge: "#d9a65c",
      edgeOpacity: 0.3,
      edgeStrong: 0.9,
      hemi: ["#b4c6e4", "#2a1c10", 1.6],
      key: ["#ffd6a0", 2.8],
      rim: ["#6fa8d8", 0.9],
      toneMapped: true,
      additive: true,
      arcSrgb: false,
      arcBase: 0.75,
      arcPulse: 0.9,
      arcWidth: 1,
      roughness: 0.82,
      geo: { land: "#131b26", landUS: "#111824", shallow: "#0d1724", deep: "#060a11", coast: "#4d6280", coastAlpha: 0.5, relief: 0.3, shimmer: 0.03, glint: 0.18 },
      solid: { shadow: 0.6, base: 0.55, ao: 0.5, rim: "#c7d3ff", rimAlpha: 0.55 },
    },
  },
  observatory: {
    ui: {
      amber: "#8fa8ff", teal: "#4fd1c5", thin: "#5d6878", thinRoute: "#6b7686", warm: "#ffb26b", cool: "#8fa8ff",
      state: "#3a4558", relief: "#8fa8ff", raHigh: "#c7d3ff", origin: "#6f86d6", dest: "#3fa59b", cand: "#2b5f5a", sel: "#6f86d6", hot: "#e6ecff",
    },
    scene: {
      bg: "#05070b",
      fog: [40, 95],
      ground: ["#0c1018", "#080b11", "#05070b"],
      grid: "rgba(150,170,210,0.035)",
      edge: "#8fa3c8",
      edgeOpacity: 0.22,
      edgeStrong: 0.85,
      hemi: ["#b4c6e4", "#10141c", 1.2],
      key: ["#e6ecff", 2.0],
      rim: ["#6fa8d8", 0.8],
      toneMapped: false,
      additive: true,
      arcSrgb: false,
      arcBase: 0.6,
      arcPulse: 1.6,
      arcWidth: 0.55,
      roughness: 0.82,
      geo: { land: "#0d121a", landUS: "#0a0e15", shallow: "#0a1626", deep: "#020408", coast: "#4f6d9c", coastAlpha: 0.55, relief: 0.38, shimmer: 0.035, glint: 0.22 },
      solid: { shadow: 0.6, base: 0.55, ao: 0.5, rim: "#c7d3ff", rimAlpha: 0.55 },
      field: true,
      arcDash: 4,
      arcAlpha: [0.5, 1.0],
      dotLift: 0.16,
      walls: [0.0, 0.3],
      floorDots: 0.22,
    },
  },
  // Light companion: the same dot field and particle flows on the Frost ground. Normal blending, so particles
  // are darker moving light; a dark rim keeps the pale end of cividis visible without changing the fill.
  // Dots keep one size here: value is color and height (with curtain walls), as in the solid appearances.
  observatorylight: {
    ui: {
      amber: "#3d5a96", teal: "#16746a", thin: "#9aa5b1", thinRoute: "#7b8794", warm: "#b45309", cool: "#3d5a96",
      state: "#d3dbe4", relief: "#3d5a96", raHigh: "#24386a", origin: "#8fa3cc", dest: "#8cc5bd", cand: "#c3d0e3", sel: "#8fa3cc", hot: "#1b2a4e",
    },
    scene: {
      bg: "#eef2f6",
      fog: [60, 110],
      ground: ["#f7f9fb", "#eef2f6", "#e3e9f0"],
      grid: "rgba(50,70,100,0.06)",
      edge: "#5f6f84",
      edgeOpacity: 0.35,
      edgeStrong: 0.95,
      hemi: ["#ffffff", "#a8b5c5", 1.5],
      key: ["#f5f8ff", 2.4],
      rim: ["#dfe8f2", 0.6],
      toneMapped: false,
      additive: false,
      arcSrgb: true,
      arcBase: 1.0,
      arcPulse: -0.5,
      arcWidth: 0.85,
      roughness: 0.9,
      geo: { land: "#e9eef3", landUS: "#e3e9f0", shallow: "#d8e3ee", deep: "#b9cadc", coast: "#6f8197", coastAlpha: 0.45, relief: 0.16, shimmer: 0.012, glint: 0.07 },
      solid: { shadow: 0.2, base: 0.78, ao: 0.32, rim: "#ffffff", rimAlpha: 0.6 },
      field: true,
      arcDash: 4,
      arcAlpha: [0.6, 0.9],
      dotSized: false,
      dotRim: 0.35,
      walls: [0.0, 0.26],
      floorDots: 0.3,
    },
  },
};

const KEY = "explore-theme";
export const DEFAULT_THEME: ThemeName = "observatorylight";
const isTheme = (v: string | null): v is ThemeName => !!v && v in THEMES;

export function readTheme(): ThemeName {
  try {
    const q = new URLSearchParams(location.search).get("theme");
    if (isTheme(q)) return q;
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(t: ThemeName) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}
