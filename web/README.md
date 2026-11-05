# Interstate Power Observatory: web app

The site for the US interstate trade study: a 3-D map of the Commodity Flow Survey (2012, 2017, 2022), findings, data downloads and methods. Static files only; no server.

## Run it

```bash
cd web
npm install
npm run dev -- --port 5190
```

## Pages

| Path | What |
|---|---|
| `/` (also `/explore`) | The map. Opens on all commodities, 2017, trade prestige. First visit opens a nine-stop tour. |
| `/findings` | GDP comparison and the registered 2012 to 2022 results. |
| `/data` | CSV downloads by year, data dictionary, checksums, raw sources, rebuild steps. |
| `/methods` | How each measure is computed, registered vs post hoc, documents. |
| `/classic` | The previous SVG dashboard, kept during the switch. |

`vercel.json` rewrites each path to `index.html`; `src/main.tsx` lazy-loads the matching page, so three.js stays out of the classic bundle.

## Code

```
src/
  engine/engine.ts     three.js scene: states (solid or dot field), instanced flow arcs, camera, picking
  engine/theme.ts      appearances: Neutral (default), Slate, Band, Observatory dark and light (experimental)
  engine/geo.ts        ground layers: oceans, coasts, lakes, terrain around the states (decoration, lazy-loaded)
  explore/FreightMap.tsx  map page: toolbar, tour, side panel, keyboard and screen-reader paths
  explore/*Page.tsx    Findings, Data, Methods
  explore/data.ts      loaders for public/data/v2
  dashboard.tsx, App.tsx, components/   the classic dashboard (/classic)
public/data/v2/        site data (meta, network/<year>, commodity/<sctg>, balance/<year>, registered)
public/downloads/      CSVs, README (dictionary), SHA256SUMS.txt, manifest.json
public/geo/            baked ground layers, written by ../scripts/build_geo_layers.py (Natural Earth, us-atlas, AWS Terrain Tiles)
e2e/explore.check.mjs  browser checks
```

## Data

Written by `scripts/export_site_data.py` from the evolution cache (read only) and the raw survey files:

```bash
../.venv/bin/python scripts/export_site_data.py --evolution-cache evolution/cache
../.venv/bin/python -m pytest tests/test_site_data.py
```

The tests compare the export with the registered report, the thesis tables and the download checksums.

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
BASE_URL=http://127.0.0.1:5190 npm run e2e   # needs the dev server and a Chromium; set CHROME if not found
```

The browser checks compare numbers on the page with the data files, cover keyboard use, reduced motion, the no-WebGL fallback and text contrast in every appearance.

## Design

`DESIGN.md` is the design contract: appearances, color, layout, honest encoding, copy rules, and the classic dashboard's rules.
