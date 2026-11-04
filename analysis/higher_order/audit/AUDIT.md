# Audit: bounded replaceability and measures for the map

Post hoc, not pre-registered. Audits `run_replaceability.py` (README, "Bounded
replaceability") and computes the measures a redesigned map would use. Same data and
filters as the README: CFS 2012 PUMF, 2017 PUF, 2022 PUMS, interstate records only,
40 two-digit SCTG codes, dollar-weighted (WGT_FACTOR x SHIPMT_VALUE).

A **majority link** is the README's sole-supplier link: origin s sends more than 50% of
destination d's inbound interstate value of commodity c (502, 441 and 435 links in 2012,
2017 and 2022; 60 persistent). v is the link's value, r the median distance of its
shipments.

**Adjacency source.** State pairs sharing a county boundary in the Census Bureau county
adjacency file, 2024 vintage
(<https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2024.txt>),
reduced to the 50 states and DC: 112 pairs, in `output/state_adjacency.csv`. The file
counts some water boundaries, so IL-MI, MI-MN and NY-RI are adjacent; AZ-CO and NM-UT
(Four Corners) are adjacent. AK and HI have no neighbours.

## Summary

| Concern or measure | Finding |
|---|---|
| A reproduces | All 27 class counts (9 settings x 3 years) match the README exactly; per-link counts and r match `replaceability_links.csv` on all 1,378 link-years. |
| 1. Relative bound favours short links | Holds. "None" links (k=1, delta=1) have median r 71 to 100 miles against 400 to 448, and 88 to 97% are between adjacent states against 40 to 45% of the rest. For 156 of the 296 "none" link-years the nearest origin with supply of at least v is under 250 extra miles away. All 15 named links are adjacent pairs. |
| 2. Distance mismatch | Matters for the class, little for the gap. Using one distance definition on both sides removes the "none" label from half of A's "none" link-years (148 or 159 of 296) and adds 47. The gap flag (250 miles) moves from 53 to 58 links a year under D to 40 to 50 under E. |
| 3. Churn and sampling | Two bootstrap replicates of one year keep 68 to 73% of each other's links and 55 to 62% across three replicates. Observed: 19 to 26% kept between surveys, 12 to 14% in all three. Independent-record sampling accounts for roughly 40 to 47% of the churn; this is a lower bound because establishment clustering is ignored. |
| D/E gap: non-adjacent routes | k=1, gap of 250 miles or more: 33 distinct non-adjacent links under D, 27 under E (centroid), 26 under E (pair medians) over three years. Only 1 to 3 recur in two years; about half rest on fewer than 15 records. |
| Gap rank stability | Link-level Spearman across survey pairs: 0.44 to 0.71 under D, 0.61 to 0.77 under E (centroid), 0.73 to 0.87 for the centroid ratio. Destination-commodity level: 0.25 to 0.53. |
| RA surprise stability | Cell log ratios correlate 0.26 to 0.37 across years (cells with 30 or more records), 0.46 to 0.53 at 300 or more. Top-20 lists share 0 or 1 cell between years. |

## Variant A: the existing test

Reproduced by calling the functions of `run_replaceability.py` on the same records
(`run_variants.py`, `output/variants_A_reproduction.csv`). Every class count in the README
table "Classes by setting" matches.

## Concern 1: the bound is relative to r

| Year | "None" at k=1, delta=1 | median r, none / rest | adjacent, none / rest | median centroid miles, none / rest |
|---|---|---|---|---|
| 2012 | 92 | 83 / 425 | 92% / 40% | 226 / 457 |
| 2017 | 99 | 71 / 400 | 97% / 45% | 184 / 455 |
| 2022 | 105 | 100 / 448 | 88% / 41% | 206 / 501 |

- Base rates: 50 to 57% of all majority links are between adjacent states; 47 of the 60
  persistent links (78%) are. The 15 named persistent links are all adjacent pairs
  under the Census list.
- Of the 296 "none" link-years, 58 have an origin with supply of at least v less than
  100 extra miles away and 156 less than 250; 14 have no origin of that size anywhere.
  The "none" label is mostly a statement that r is short.
- Every A setting flags mostly adjacent links (70 to 97%). Variant C (absolute bands)
  reverses this: within 500 miles at k=1, 26 to 38% of flagged links are adjacent and
  59 to 73 a year are not, because the absolute band flags remote destinations (Alaska,
  Hawaii, the Mountain West) regardless of the incumbent's distance.
- Variant D also flags mostly adjacent links (71 to 83% at a 250-mile gap), so the
  neighbour pattern is not only an artifact: neighbours that dominate a destination
  often do sit hundreds of miles closer than the next origin of sufficient size.

Of the 15 named links, 5 keep a gap of at least 250 miles in all three years under D
(MS fuel oils from LA, NM coal from CO, NM fuel oils from TX, the WA and OR mixed-freight
pair) and 4 under E with centroid distances (MS gasoline and fuel oils from LA, the WA
and OR pair). The others have gaps of 15 to 200 miles in at least one year.

## Concern 2: distance definitions

The README's count (about 75% of candidate rows use the all-commodity pair median)
reproduces. For the decision that matters, the nearest origin with supply of at least v,
911 of 1,364 link-years use a commodity-specific distance and 453 the pair median.

| Year | Candidate rows with both distances: median pair / commodity | rows differing by more than 50% | links with r below the pair median of s to d |
|---|---|---|---|
| 2012 | 1.00 | 9.5% | 59% |
| 2017 | 1.00 | 9.3% | 54% |
| 2022 | 1.00 | 6.6% | 62% |

No systematic bias in the median, but incumbent and alternative are measured on
different scales. For adjacent states the difference is large in relative terms: MA to
NH fuel oils has r of 9 to 35 miles against 61 miles between centers of population.

Change in the "none" class (k=1, delta=1; 296 link-years under A) when both sides use
one definition:

| Definition on both sides | A none, now not | now none, A not | none in both |
|---|---|---|---|
| Commodity medians, centroid fallback | 0 | 15 | 296 |
| All-commodity pair medians (reverse, then centroid fallback) | 148 | 47 | 148 |
| Centers of population (Census 2020) | 159 | 47 | 137 |

The relative class is fragile to the definition; the absolute gap is less so (flags at a
250-mile gap, k=1: A distances 53 / 55 / 58, pair 44 / 50 / 48, centroid 40 / 46 / 46).

## Concern 3: what persistence selects, and sampling churn

| Year | Links | median value ($M) | median records | median r | adjacent | bootstrap reproduction |
|---|---|---|---|---|---|---|
| 2012 persistent / transient | 60 / 442 | 297 / 109 | 51 / 12.5 | 139 / 321 | 78% / 46% | 0.93 / 0.78 |
| 2017 persistent / transient | 60 / 381 | 266 / 80 | 53 / 21 | 129 / 300 | 78% / 53% | 0.92 / 0.80 |
| 2022 persistent / transient | 60 / 375 | 382 / 73 | 73 / 18 | 137 / 305 | 78% / 48% | 0.94 / 0.81 |

Bootstrap (`run_bootstrap.py`): 200 draws per year; each record's weighted value is
multiplied by a Poisson(1) count, so heavy records stay heavy. Two draws are two surveys
of an unchanged economy. Records are treated as independent; the survey's strata and
clustering by establishment are not available in the public files, so the noise below is
a lower bound.

Share of links kept, by the link's records in the earlier year:

| Records | 1-4 | 5-9 | 10-29 | 30-99 | 100-299 | 300+ | all |
|---|---|---|---|---|---|---|---|
| Sampling only, next draw (2012 / 2017 / 2022) | .53 / .53 / .65 | .65 / .62 / .75 | .72 / .72 / .73 | .75 / .79 / .76 | .77 / .82 / .71 | .79 / .83 / .80 | .68 / .71 / .73 |
| Observed 2012 to 2017 | .12 | .19 | .25 | .38 | .36 | .63 (8 links) | .26 |
| Observed 2017 to 2022 | .03 | .14 | .24 | .28 | .60 | .35 (17 links) | .25 |
| Sampling only, two further draws | .34 / .36 / .49 | .52 / .47 / .65 | .61 / .61 / .63 | .65 / .70 / .67 | .67 / .75 / .59 | .74 / .75 / .72 | .55 / .59 / .62 |
| Observed in all three surveys (from 2012 / 2017 / 2022) | .02 / .01 / .03 | .06 / .07 / .04 | .06 / .13 / .21 | .25 / .15 / .18 | .24 / .33 / .14 | .25 / .24 / .25 | .12 / .14 / .14 |

- Sampling alone loses 27 to 32% of links between two draws and 38 to 45% across three.
  Observed losses are 74 to 81% between surveys and 86 to 88% across three. On these
  figures, independent-record sampling accounts for about 40% of pairwise churn and 47%
  of three-survey churn.
- Even links with 300 or more records lose about 20% between draws. The cause is the
  50% threshold: reproduction is 0.60 for links with shares of 50 to 55% and 0.92 for 80
  to 90% (`output/selection_by_share_margin.csv`). A hard majority cut makes membership
  noisy wherever shares sit near it.
- Persistence selects large, short, well-recorded links with high shares, all of which
  raise reproduction. The persistent set is closer to "well-measured" than to
  "structurally locked in".

## Variants B to E

Flagged links per year (`output/variants_summary.csv` has every setting):

| Variant | Flag | 2012 | 2017 | 2022 | adjacent share | non-adjacent per year |
|---|---|---|---|---|---|---|
| A | none, k=1, delta=1 | 92 | 99 | 105 | 88 to 97% | 3 to 13 |
| A | none, k=2, delta=0.25 | 192 | 181 | 178 | 83 to 86% | 25 to 31 |
| B | no other origin ships k x v, k=1 | 4 | 4 | 6 | 50 to 100% | 0 to 3 |
| B | k=2 | 13 | 11 | 15 | 60 to 91% | 1 to 6 |
| B | k=5 | 44 | 48 | 53 | 62 to 79% | 10 to 20 |
| C | none within 250 mi, k=1 | 205 | 204 | 216 | 44 to 50% | 101 to 121 |
| C | none within 500 mi, k=1 | 94 | 98 | 98 | 26 to 38% | 59 to 73 |
| C | none within 1,000 mi, k=1 | 42 | 48 | 52 | 10 to 13% | 38 to 45 |
| D | gap of 250+ mi, k=1 | 53 | 55 | 58 | 71 to 83% | 9 to 17 |
| D | gap of 500+ mi, k=1 | 18 | 18 | 29 | 62 to 83% | 3 to 11 |
| D | gap of 250+ mi, k=2 | 94 | 93 | 86 | 74 to 81% | 18 to 22 |
| E (pair medians) | gap of 250+ mi, k=1 | 44 | 50 | 48 | 71 to 89% | 5 to 14 |
| E (centroid) | gap of 250+ mi, k=1 | 40 | 46 | 46 | 72 to 85% | 6 to 13 |
| E (centroid) | gap of 250+ mi, k=2 | 80 | 79 | 73 | 75 to 84% | 13 to 18 |

- B: volume alone almost never binds at k=1 (4 to 6 links a year); every other link has
  some origin of sufficient size. Replaceability in this test is a distance question.
- D and E: the gap is defined as the distance of the nearest origin with supply of at
  least k x v minus the incumbent's distance; a link with no such origin counts as an
  infinite gap. Ratio columns divide instead of subtract.
- Non-adjacent links surfacing at k=1, gap of 250 miles or more, over three years: 33
  distinct under D, 27 under E (centroid), 26 under E (pair). Recurring in two or more
  years: 3 under D (WA to AK nonmetallic minerals, LA to FL gasoline, CA to WA alcoholic
  beverages), 1 under each E (LA to FL gasoline). Of the 28 E (centroid) non-adjacent
  link-years, 14 rest on fewer than 15 records (for example LA to FL fuels in 2017: 2 and
  3 records carrying $1.2 and $4.8 billion). The well-supported ones (100 or more
  records): KS to TX cereal grains 2012, MT to OR and IL to LA cereal grains 2017, CA to
  WA alcoholic beverages 2022, NC to FL chemical products 2022.

Rank stability of the gap (links that are majority links in both years; no origin of
sufficient size ranks as the largest gap):

| Measure | links 2012-17 / 2017-22 / 2012-22 | Spearman, link | Spearman, destination x commodity |
|---|---|---|---|
| D gap, k=1 | 130 / 111 / 93 | .71 / .44 / .47 | .47 / .25 / .29 |
| D gap, k=2 | | .66 / .51 / .68 | .47 / .32 / .37 |
| E gap (pair), k=1 | | .75 / .58 / .61 | .49 / .29 / .35 |
| E gap (centroid), k=1 | | .77 / .70 / .61 | .47 / .38 / .35 |
| E ratio (centroid), k=1 | | .87 / .76 / .73 | .52 / .40 / .43 |

Consistent distances make the gap more stable, mainly for 2017 to 2022. The ratio is
more stable than the difference because centroid distances do not change between years;
only supply and the identity of the nearest origin do.

## Measures for the map

`run_map.py`; all in `output/map_data.json` (1,164,788 bytes, keyed year, then SCTG).

- **National reliance**: each origin's share of national interstate value of the
  commodity (`map_national_reliance.csv`, 6,120 rows; shares under 0.001 omitted from
  the JSON).
- **Local reliance**: per destination and commodity, the top origin, its share, the
  supplier HHI, the number of supplying origins and the records (`map_local_reliance.csv`).
- **Gaps**: per majority link, r, the nearest origin with supply of at least v (A
  distances), the D gap, the E (centroid) gap and ratio, adjacency and persistence.
- **RA surprise**: ln(observed / fitted) per origin x destination x commodity cell, where
  the fit is the maximum-entropy table with the OD, OC and DC margins
  (`run_three_way.fit_pairs`; margins match to 1e-17). This is the Poisson fit with
  origin-destination, origin-commodity and destination-commodity fixed effects
  (`run_equivalence.py` shows the identity on the division table). Cells with 30 or more
  records: 17,377 (2012), 20,081 (2017), 36,703 (2022). The JSON keeps those with an
  absolute log ratio of ln 2 or more; `surprise_cells.csv.gz` has all of them with
  bootstrap intervals.

### Surprise: stability and noise

| Years | min records (both years) | cells | Pearson | Spearman | same sign |
|---|---|---|---|---|---|
| 2012-2017 | 30 / 100 / 300 | 15,406 / 5,258 / 1,005 | .37 / .42 / .53 | .34 / .39 / .50 | 62 / 63 / 67% |
| 2017-2022 | 30 / 100 / 300 | 18,964 / 7,351 / 1,766 | .32 / .36 / .46 | .30 / .34 / .43 | 60 / 61 / 64% |
| 2012-2022 | 30 / 100 / 300 | 16,497 / 5,648 / 1,077 | .26 / .33 / .46 | .25 / .31 / .45 | 59 / 60 / 65% |

- Bootstrap (the same 200 draws, refitted each time): median standard deviation of a
  cell's log ratio 0.29 to 0.32; 37 to 45% of cells have an absolute log ratio above two
  standard deviations.
- Top 20 per year (`surprise_top20.csv`): log ratios 3.0 to 6.1 (20 to 440 times the
  fit), median 42 to 52 records. In 2012 and 2017 every top-20 cell has a 5% bootstrap
  bound above 2.1, and the median cell is in the bootstrap top 20 in 79% and 93% of draws.
  In 2022, 4 of the 20 have bounds between 0.05 and 1.0 (single heavy records), and the
  median cell is in the bootstrap top 20 in 57% of draws.
- The top cells pass the record bootstrap but fail recurrence: the top-20 sets share 0
  (2012-2017) or 1 cell (2017-2022, 2012-2022). Top cells reappear in another year
  with 30 or more records in 15 cell-year pairs; 3 recur strongly (OR to OK transport
  equipment, 4.5 and 3.8; NV to UT fuel oils, 3.1 and 3.9; MO to KS coal 2017 and
  2012, 3.5 and 3.0). Many top cells are odd pairings on few records (MT to CT
  pharmaceuticals, DE to OK transport equipment), the pattern a single establishment
  produces; the public files carry no establishment identifier, so a record bootstrap
  cannot separate these from durable structure.

## What holds and what does not

- **Holds**: concern 1. The "none" class is concentrated on short, adjacent links by
  construction of a relative bound. Concern 2 for the class: half of the "none" set
  depends on mixing distance definitions. Concern 3: persistence selects well-measured
  links, and sampling alone accounts for a large share (40 to 47%, a lower bound) of
  churn; the 50% cut itself makes membership noisy.
- **Holds partly**: the neighbour pattern is not only an artifact. Under the absolute
  gap (D, E), 71 to 89% of flagged links remain adjacent, against a base rate of 50 to
  57%.
- **Does not hold up as stated**: "persistent links are about twice as likely to have no
  alternative" is largely the joint effect of short r and good measurement, not evidence
  of lock-in. Of the 15 named links, 4 or 5 keep a gap of 250 miles or more in all three
  years under any distance definition.
- **For the map**: the gap in miles with centroid distances on both sides (E) is the most
  stable gap measure and has no mismatch; local reliance and national reliance need no
  modelling. Cell-level RA surprise is year-specific (cross-year correlation 0.26 to
  0.37); shown on a map it should carry a record floor of 300 or recurrence in two
  surveys, with the bootstrap interval.

## Caveats

- Survey design: no strata or establishment clusters in the public files; every
  bootstrap figure is a lower bound on noise. Weighted values have no sample size.
- 2022 is a PUMS of about 7.5 times the records with different codes; fixed record
  thresholds bind differently by year.
- Centers of population are crude for large states (TX to NM fuel oils: 582 miles
  between centers against a 141 to 163-mile shipment median), so E (centroid) gaps can be
  negative.
- Supply is total interstate shipments of the commodity; no capacity, contracts, grades
  or modal access, as in the original.

## Files and runtime

Scripts in `analysis/higher_order/audit/`, run from `analysis/higher_order/` with the
`us-trade-centrality/.venv` interpreter, in this order:

| Script | Writes | Time |
|---|---|---|
| `common.py` (imported) | `.cache/` record caches (gitignored), `output/state_adjacency.csv` | 50 s first run |
| `run_variants.py` | `output/variants_*` | 8 s |
| `run_bootstrap.py` | `.cache/boot_*.npz`, `output/bootstrap_*` | 140 s |
| `run_selection.py` | `output/selection_*` | 2 s |
| `run_map.py` | `output/map_*`, `output/surprise_*`, `output/map_data.json` | 85 s |

`output/selection_summary.json` also holds a cruder expectation (each link's
reproduction rate squared, 0.66 to 0.72); the draw-to-draw figures above are the
comparison used.
