# AGENTS.md

Instructions for any coding agent working in this repository. The research framing
is [`README.md`](README.md); the layer map is [`ARCHITECTURE.md`](ARCHITECTURE.md);
the map's rules are in [`web/README.md`](web/README.md); the classic dashboard's
design system is [`web/DESIGN.md`](web/DESIGN.md).

## What this is

The Interstate Power Observatory: network measures of state power from the
Commodity Flow Survey (2012, 2017, 2022). The web app (`web/`, statepower.systems),
the registered three-survey study (`evolution/`, frozen), post hoc analyses
(`analysis/`), the site data export (`scripts/export_site_data.py`), the original
2017 pipeline (`main.py` + `cfs-network-toolkit/`, outputs in `results/`), Marimo
notebooks, and the thesis (`paper/`).

## First commands

```bash
python -m venv .venv && source .venv/bin/activate   # project venv; never install globally
pip install -r requirements.txt && pip install -e cfs-network-toolkit/
python main.py                     # 51×51 domestic (default); --international for 52×52
python tests/validate_pipeline.py  # end-to-end validation

cd web && npm ci && npm run dev    # the Observatory
```

CI (`.github/workflows/ci.yml`) runs, and a change should pass before it is pushed:
`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` in `web/`
(plus `npm run e2e` against a running preview, which CI does not run);
`ruff check cfs-network-toolkit scripts tests main.py`; `pytest tests/test_export_schema.py`.

## Do not touch

- **`evolution/` is frozen.** It holds a ResearchHub pre-registration whose
  `thresholds.yaml` hash is published. Do not modify, move, or re-run anything under
  it outside a deliberate post-registration step. CI skips it.
- **Raw data is never committed.** The raw files (`data/cfs_2017_puf.csv`,
  `data/FAF5*.csv`) are gitignored; the CFS 2017 Public Use File cannot be
  redistributed. `data/README.md` says how to obtain them. The derived tables in
  `data/` are tracked.
- `results/` holds the canonical pipeline outputs; change them only by re-running
  the pipeline.
- `web/public/data/v2/` and `web/public/downloads/` are the map's data, written by
  `scripts/export_site_data.py` and checked by `tests/test_site_data.py`.
  `web/public/data/*.json` is the classic dashboard's, written by
  `scripts/export_viz_data.py`. Regenerate with the script; never edit by hand.

## Commits

- Conventional commits; AI-written commits carry the writing tool's co-author
  trailer.
- **Exception: thesis ETD revisions** (formal academic submission, `paper/`):
  lowercase, minimal, no conventional prefix, no AI attribution.
