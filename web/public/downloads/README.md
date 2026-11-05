# Interstate commodity flows, 2012, 2017, 2022: data downloads

Derived from the U.S. Census Bureau and Bureau of Transportation Statistics Commodity Flow
Survey (CFS) public-use files. Every file here is produced by `scripts/export_site_data.py` in
the repository [github.com/rsthornton/statepower](https://github.com/rsthornton/statepower);
`SHA256SUMS.txt` lists a checksum for each CSV.

## Two series

The files come from two definitions of the same survey data. They differ slightly, on purpose.

**Network series** (`states_<year>.csv`, `edges_<year>.csv`). The series used by the
pre-registered study of 2012, 2017 and 2022 (`evolution/` in the repository; thresholds
registered June 15, 2026). Interstate shipments of every commodity except crude petroleum
(SCTG 16), which the 2022 survey does not cover, so the three years are comparable.

**Commodity series** (`commodity_flows_<year>.csv`). 40 two-digit SCTG commodities. Excluded:
unknown (00), live animals (01, not coded separately in 2022), crude petroleum (16), other (99)
and grouped codes. This is the series behind the site's 3-D map.

**Thesis tables** (`thesis_2017/`). The 2017 network as analyzed in the M.S. thesis: all
commodities including crude petroleum, the domestic 51-node network and the 52-node network
with a rest-of-world node built from FAF5 international flows. The thesis's 2017 rankings differ
from the network series' 2017 rankings by at most two places for six states; both give the same
11 structurally undervalued states.

## Common definitions

- **Dollars**: weighted shipment value, `SHIPMT_VALUE × WGT_FACTOR`, current U.S. dollars of the
  survey year (not inflation-adjusted).
- **Interstate**: origin state differs from destination state. Within-state shipments are excluded.
- **States**: the 50 states and the District of Columbia, as USPS abbreviations.
- **Direction**: every edge runs origin to destination.

## Files

### `<year>/states_<year>.csv` (network series, 51 rows)

| Column | Meaning |
|---|---|
| `state`, `name`, `fips` | USPS abbreviation, name, two-digit FIPS code |
| `betweenness` | Bridge position: betweenness centrality (NetworkX, normalized), edge distance = largest edge value / edge value, so heavy trade is a short step |
| `eigenvector` | Trade prestige: in-flow eigenvector centrality (a state scores high when it receives large shipments from states that themselves score high; NetworkX default on a directed graph) |
| `out_degree` | Export reach: weighted out-degree (total dollars shipped to other states) divided by the largest state's |
| `rank_*` | Rank of each measure, 1 = highest; ties share the lowest rank |
| `no_brokerage` | True when betweenness is zero (the state lies on no shortest paths); its betweenness rank is a shared tie, not a position |
| `gdp_billions`, `gdp_rank` | Fourth-quarter state GDP of the survey year (BEA), billions of current dollars, and its rank |
| `gap_eigenvector` | GDP rank minus trade prestige rank. Five or more marks a structurally undervalued state |

### `<year>/edges_<year>.csv` (network series, every interstate edge)

`origin`, `destination`, `usd`. 2,539 edges in 2012, 2,534 in 2017, 2,547 in 2022.

### `<year>/commodity_flows_<year>.csv` (commodity series)

One row per origin, destination and commodity with at least one survey record.

| Column | Meaning |
|---|---|
| `origin`, `destination` | USPS abbreviations |
| `sctg` | Two-digit Standard Classification of Transported Goods code |
| `usd` | Weighted shipment value |
| `records` | Number of survey records behind the row. Small counts mean an uncertain estimate; the site greys routes under 10 records |
| `median_miles` | Median great-circle shipment distance of those records |

Records: 2,279,065 (2012), 2,943,533 (2017), 22,150,779 (2022). The 2022 public file is much
larger than the earlier two, so 2022 estimates rest on more records.

## Caveats

- Survey estimates, not a census of shipments. The CFS covers shipments by establishments in
  mining, manufacturing, wholesale and selected retail and services; it excludes most farm
  shipments, crude oil and natural gas extraction, imports until they leave their first U.S.
  location, and services.
- Flows are observed origin-destination shipments, not physical routes, and not capacity.
- Rankings computed on these networks describe structural position, not causation.
- Everything beyond the registered H1 to H3 tests is post hoc and labeled as such on the site.

## Raw source files

| Year | File | Source |
|---|---|---|
| 2012 | CFS 2012 PUMF (CSV) | [census.gov 2012 CFS datasets](https://www.census.gov/data/datasets/2012/econ/cfs/historical-datasets.html) |
| 2017 | CFS 2017 PUF (CSV) | [census.gov 2017 CFS datasets](https://www.census.gov/data/datasets/2017/econ/cfs/historical-datasets.html) |
| 2022 | CFS 2022 PUMS (CSV, 680 MB zip) | [census.gov 2022 CFS datasets](https://www.census.gov/data/datasets/2022/econ/cfs/historical-datasets.html) |
| 2017 | FAF5 (rest-of-world node, thesis only) | [bts.gov/faf](https://www.bts.gov/faf) |

GDP: BEA state quarterly GDP (SQGDP1), fourth quarter of each survey year.

## Reproducing these files

1. Clone the repository and create its Python environment (see the repository README).
2. Download the three public-use files above and set their paths in `evolution/configs/cfs_<year>.yaml`.
3. Build the registered year bundles: `python evolution/run_evolution.py` (see `evolution/README.md`).
4. Run `python scripts/export_site_data.py --evolution-cache evolution/cache`.
5. Run `python -m pytest tests/test_site_data.py` to check totals against the registered report.

## Citing

Please cite the thesis and the repository. Thornton, S. (2026). *Testing Network Centrality for
Economic Power Measurement: Structure and Boundaries in U.S. Interstate Trade.* M.S. thesis,
Binghamton University. Software and data: Thornton, S. (2026). *The Interstate Power Observatory* (v1.0.0).
Zenodo. https://doi.org/10.5281/zenodo.23988369 (all versions; this release is https://doi.org/10.5281/zenodo.23988370).

Corrections to the thesis are listed in `paper/ERRATA.md` in the repository.
