# The Interstate Power Observatory

GDP is not equivalent to economic power. Power is relational: it is exerted over someone, and GDP measures a state by itself. This project measures the relations instead, starting with trade. It builds a network of interstate shipments from the Commodity Flow Survey (2012, 2017 and 2022) and asks where a state's position in that network parts ways with its size.

**[statepower.systems](https://statepower.systems/)** is the interactive site: a 3D map of the network, a guided tour of the main results, every route for 40 commodities, the registered findings, downloads and methods.

## What it finds

- **Size is not position.** In 2017, 11 states rank five or more places higher on trade prestige (in-flow eigenvector centrality) than on GDP. Kentucky is 28th by GDP and 14th by trade prestige.
- **The structure lasts.** A forecast registered on June 19, 2026, before the 2012 and 2022 surveys were analyzed, said trade prestige rankings would correlate with 2017's at 0.9 or more. They came in at 0.988 and 0.985. Seven states rank five or more places above GDP in all three surveys.
- **Boundaries matter for some measures.** Bridge position (betweenness) reshuffles when foreign trade is added; trade prestige and export reach do not.

Corrections to the thesis (eigenvector direction, the undervalued-state rule) are in [`paper/ERRATA.md`](paper/ERRATA.md).

## Where things are

| Folder | What |
|---|---|
| [`web/`](web/) | The site (React, TypeScript, three.js). Start with [`web/README.md`](web/README.md). |
| [`evolution/`](evolution/) | The three-survey study and its pre-registration. **Frozen**: do not modify or re-run. |
| [`analysis/`](analysis/) | Post hoc analyses: three-way dependence, state roles, rank dynamics, eigenvector direction. |
| [`scripts/`](scripts/) | `export_site_data.py` builds the site's data and downloads from the evolution cache. |
| [`cfs-network-toolkit/`](cfs-network-toolkit/), `main.py`, [`configs/`](configs/), [`results/`](results/) | The original 2017 pipeline and its committed outputs. |
| [`notebooks/`](notebooks/) | Marimo notebooks; pre-rendered [companion](notebooks/__marimo__/companion.html) and [replication](notebooks/__marimo__/replication.html). |
| [`paper/`](paper/) | The M.S. thesis (LaTeX, PDF, figures) and its errata. |
| [`viz/`](viz/) | The archived Dash app; still the CSV source for the classic dashboard at `/classic`. |

[`ARCHITECTURE.md`](ARCHITECTURE.md) maps the layers and the data flow.

## Run it

```bash
cd web && npm ci && npm run dev          # the site
```

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && pip install -e cfs-network-toolkit/
python main.py                           # the 2017 pipeline (needs the raw survey file, see data/README.md)
python tests/validate_pipeline.py
```

The raw Census files are not redistributed; [`data/README.md`](data/README.md) says where to get them. The site's [Data page](https://statepower.systems/data) has the derived tables as CSVs with checksums.

## Take part

This is the first result of a program: comprehensive, integrated measures of state power in US federalism, bringing together political science, economics and systems research. Input-output, finance and travel layers are next.

[Open an issue](https://github.com/rsthornton/statepower/issues) with a question, a problem or an idea, or pick one up.

## Cite

Thornton, S. (2026). *Testing Network Centrality for Economic Power Measurement: Structure and Boundaries in U.S. Interstate Trade.* M.S. thesis, Department of Systems Science and Industrial Engineering, Binghamton University. A data DOI will be added when issued.

MIT License; see [LICENSE](LICENSE).
