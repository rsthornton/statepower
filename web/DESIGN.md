# The Interstate Power Observatory: design system

The design contract for the site. Read this before changing anything visual. Its history and the reasons behind each choice are in `docs/next-site/LOG.md`.

## Identity

**Name:** The Interstate Power Observatory.
**Claim:** GDP is not equivalent to economic power. A state's position in the network of interstate shipments is a different thing from its size.
**Register:** plain, analytical, checkable. The map leads; every number on a page traces to a file in this repo.

## Stack

React 19, Vite, TypeScript (strict). The map is a three.js scene (`src/engine/`) with a WebGL check and a fallback page. Page CSS lives in one template string, `src/explore/styles.ts`, injected once; it also exports `PHONE`, the phone media query (narrow screens, and phones held sideways).

## Appearances

Five appearances: three in the menu at the right of the site bar, all five with `?theme=`. Each sets CSS variables on `:root[data-theme=…]` in `styles.ts` and a scene palette in `src/engine/theme.ts`.

| Appearance | `data-theme` | Status |
|---|---|---|
| Observatory (light) | `observatorylight` | Default (since 2026-11-04); states drawn as dot fields |
| Observatory (dark) | `observatory` | Menu |
| Neutral | `frostneutral` | Menu |
| Slate, Band | `frost`, `frostband` | Off the menu (2026-11-04); still reachable with `?theme=` and checked by the e2e suite |

The Frost rules apply to all five: Inter, straight edges (radius 0), no shadows, gradients or blur on page chrome. Observatory (light) is the default; dark and Neutral stay in the menu.

## Color

| Use | Color |
|---|---|
| Centrality (Position view) | Cividis: perceptually uniform, colorblind-safe, lightness rises with value |
| Beyond pairs (ratio to typical) | BrBG divergence on a log scale, ½× to 2×, neutral at 1× |
| Routes and outbound | Indigo (`accent`, per appearance) |
| Inbound | Teal |
| Thin routes (fewer survey records than the threshold) | Darker gray (`thinRoute`) at 0.55 opacity, named in the legend |
| Warning | Amber, only for warnings |

Never red and blue for a divergence: on U.S. states it reads as an election map. Colors are added to the appearance's variables first, then used.

## Layout

- **Site bar:** name (links home), Map / Findings / Data / Methods / Code, appearance menu.
- **Toolbar:** Year, Scope (All commodities, One commodity, Beyond pairs), then the controls that view needs (commodity and Flows / Reliance, Side, links shown). A control shows only in the views it affects.
- **Stage:** the map, with overlays: the legend (top left), the map tools (3D / 2D, Reset view, Tour), and on desktop the tour card. Every overlay over the canvas carries `data-occludes`; the scene fits its home view into the space they leave and shifts the image there, so no state sits under an overlay. A new overlay gets the attribute.
- **Side panel:** a state picker, then tabs per view (State, Rankings or Ladder, Route, Commodity, How it's measured, About).
- **Phones** (`PHONE`): the toolbar stacks, the tour card sits under the map, the panel follows below. Held sideways, the map fills the screen and the tour card sits top right. Tap targets are at least 24 by 24 CSS pixels.
- **Labels:** at most five on the map, in priority order; a label that would overlap an earlier one is hidden.

## Honest encoding

The map's data channels are state color (order preserved), state height (linear in the value), arc width (dollars) and arc color (inbound, outbound). Everything else is decoration, and decoration must never read as data.

- **DO** name every channel that varies with the value in the legend (e.g. "Color, height and dot size by"). The e2e suite checks the wording per appearance.
- **DO** keep relief, water and terrain on the ground plane at low amplitude. They never change a state's top height.
- **DO** add an e2e check that samples rendered state colors across the ramp and asserts their luminance order matches value order, whenever lighting, tone mapping, fog or grading changes.
- **DON'T** bloom, light or shadow state tops; tops carry color. Glow belongs to arcs and particles only.
- **DON'T** reuse a data channel for effect (no decorative height, no state tint from lighting, no arc width for emphasis).
- **DON'T** animate data under reduced motion; first-visit effects run once per visitor and settle before labels or the legend appear.

## Copy

- No em dashes in user-facing text. Use commas, periods, or "to".
- Lead with plain measure names (trade prestige, bridge position, export reach); the method name follows.
- A zero score has no meaningful rank: show "No brokerage" or "none", never the tied rank.
- Rank gaps are positions, not performance: no "overperforms" or "punches above its weight". Signed numbers (`+14`, `−15`, true minus sign).
- Numbers: `$2.80T`, `$206B`; percentages as on the page (`over 99%`, one decimal under 10%).
- Registered results and post hoc ones are labelled as such wherever they appear; the Beyond pairs view carries "Post hoc, exploratory".
- Say what is not claimed. The About tabs and the Methods page list it.

## Verify

```bash
npm run typecheck && npm run lint && npm test && npm run build
BASE_URL=http://localhost:5192 npm run e2e   # against `npx vite preview --port 5192`
```

Then look at the change at 360, 390, 844 by 390 (sideways) and 1280 wide. The e2e suite covers numbers against the data files, keyboard and screen-reader paths, contrast in every appearance, phone layouts, overlay framing and the no-WebGL fallback.

## Classic dashboard (retired)

The previous SVG dashboard was retired at release (2026-11-04): `/classic` redirects to `/` (`vercel.json`). Its code (`src/dashboard.tsx` and what only it imports) is no longer reachable and can be deleted.
