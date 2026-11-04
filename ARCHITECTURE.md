# Architecture

Orientation for contributors and future sessions. See `README.md` for the research framing and
`web/DESIGN.md` for the dashboard's design system.

## Layers

| Layer | Where | What |
|---|---|---|
| Pipeline | `main.py` + `cfs-network-toolkit/cfs_toolkit/core/` | load → preprocess → build graph → centralities → save. Driven by `configs/*.yaml`. |
| Analysis | `cfs_toolkit/analysis/` | filtration, boundary sensitivity, GDP comparison, commodity decomposition. |
| Canonical results | `results/` | committed pipeline outputs (no raw data needed to explore). |
| Notebooks | `notebooks/` | Marimo exploration / replication / defense. |
| Export bridge | `scripts/export_site_data.py` | reads the evolution cache (read only) and the raw survey files → writes `web/public/data/v2/` and `web/public/downloads/`. Checked by `tests/test_site_data.py`. The classic dashboard still reads `web/public/data/*.json` from `scripts/export_viz_data.py`. |
| Web app | `web/` | The Interstate Power Observatory (React 19 + TypeScript + Vite; three.js map at `/`, Findings, Data, Methods; the SVG dashboard at `/classic`). See `web/README.md`. |
| Evolution study | `evolution/` | three-survey (2012/2017/2022) pre-registration. **Frozen — see below.** |
| Paper | `paper/` | thesis LaTeX + figures. |

## The frozen guardrail

`evolution/` holds a ResearchHub pre-registration. `evolution/thresholds.yaml` is hashed and the
hash is published; **public registration must precede any full-data run.** Do not modify, move, or
re-run anything under `evolution/` outside a deliberate, post-registration step. CI is scoped to
skip it (`paths-ignore` + no job touches it).

## Data flow

Raw CFS public-use files for 2012, 2017 and 2022 (not committed) → `evolution/run_evolution.py` →
`evolution/cache/` → `scripts/export_site_data.py` → `web/public/data/v2/` + `web/public/downloads/` →
the map and pages via `web/src/explore/data.ts`. The classic dashboard's path (2017 only):
pipeline → `viz/data/` CSVs → `scripts/export_viz_data.py` → `web/public/data/*.json`.
The JSON shapes are the contract; `web/src/types.ts` mirrors them, and `tests/test_export_schema.py`
guards them with no gated data. To change a field, change the export script, the type, and the
consuming component together.

## Working on the web app

Read `web/README.md` (the map) or `web/DESIGN.md` (the classic dashboard), then `cd web && npm install && npm run dev`
(read the port Vite prints). Quality gates: `npm run typecheck && npm run lint && npm run test && npm run build`,
then `npm run e2e` against the dev server. See `web/README.md`.

## Quality gates

- **Web:** typecheck (tsc strict), eslint, vitest, vite build. CI job `web`.
- **Python:** `ruff check` (advisory for now — the analysis code predates ruff) + `pytest tests/test_export_schema.py`
  (zero gated data). CI job `python`. Config in the root `pyproject.toml`.
- Install the toolkit editable: `pip install -e cfs-network-toolkit/` (metadata in `setup.py`,
  build backend in its `pyproject.toml`).

## Conventions

Conventional commits with the Claude co-author trailer. Web work happens on a feature branch.
Vercel project `tradeflows` is not Git-connected: production deploys are made with the Vercel CLI
(checked 2026-10-17), so merging to `main` does not deploy. No em dashes in user-facing copy.
