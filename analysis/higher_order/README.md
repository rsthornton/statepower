# Higher-order dependence in interstate commodity flows

**Post-hoc exploratory analysis. Not pre-registered.** Nothing here touches
`evolution/`. The study asks whether the interstate commodity network carries
structure that pairwise measures (the centralities behind the state roles)
cannot see, following Varley, Pope, Faskowitz and Sporns (2023), "Multivariate
information theory uncovers synergistic subsystems of the human cerebral
cortex", *Communications Biology* 6:451.

## Data

The raw survey files named in `evolution/configs/` (CFS 2012 PUMF, 2017 PUF,
2022 PUMS), read only. Interstate shipments only. Dropped in every year so the
three years share one commodity list (40 two-digit SCTG codes): grouped codes
(0.1 to 0.3% of records), unknown (00), live animals (01, not coded separately
in 2022), crude petroleum (16, out of scope in 2022) and other (99).
Records: 2,279,065 (2012), 2,943,533 (2017), 22,150,779 (2022).

## Two framings

**A. Origin, destination and commodity as three variables** (`run_three_way.py`).
One shipment is one observation. The information measures:

| Measure | Meaning |
|---|---|
| Total correlation | all dependence among O, D and C; the loss of the independence model O:D:C |
| O-information | total correlation minus dual total correlation; negative means synergy-dominated |
| Three-way part | the loss of the model OD:OC:DC, fitted by iterative proportional fitting |
| After distance | the same, with a distance band x commodity term added to the model |

The OD:OC:DC fit is the maximum-likelihood Poisson log-linear model with those
margins: the same form as a gravity equation with exporter-by-product,
importer-by-product and pair fixed effects. The three-way part is what such a
model cannot explain. The distance term lets each commodity have its own
distance profile (seven bands by the pair's median great-circle distance), so
whatever survives it is not commodity-specific distance decay. The sampling
null draws tables of the same size from the fitted model and refits them.

**B. States as variables** (`run_states_as_variables.py`), the literal Varley
framing. One observation is a slice: commodity x destination census division x
quarter (about 1,440 slices; 2012 and 2017, since the 2022 file has no
quarter). Each state's value is its shipped value in the slice, rank-transformed
to normal scores, with the slice-wide mean regressed out (the analogue of
global signal regression). O-information is computed from the correlation
matrix for random subsets and for the most synergistic subsets found by
simulated annealing. Two controls run through the same optimizer: columns
shuffled before the regression, and no regression.

## Results: framing A

Counted by records; dollar-weighted figures in brackets.

| | 2012 | 2017 | 2022 |
|---|---|---|---|
| Total correlation (bits) | 0.767 [1.458] | 0.754 [1.307] | 0.753 [1.309] |
| O-information (bits) | -0.154 [-0.386] | -0.148 [-0.348] | -0.164 [-0.361] |
| Three-way part (bits) | 0.160 [0.411] | 0.155 [0.362] | 0.169 [0.373] |
| Sampling null | 0.026 | 0.020 | 0.003 |
| Three-way part after distance | 0.119 | 0.113 | 0.128 |
| Share of the excess explained by distance | 30% | 31% | 25% |

- In all three years the flows are synergy-dominated: knowing the commodity
  makes the origin-destination pattern more informative, not less.
- About a fifth of the total dependence is three-way, 6 to 66 times the
  sampling null. Commodity-specific distance accounts for a quarter to a third
  of it; the rest is pair-specific.

Per state, the measure is the origin's share of the three-way part (after
distance, net of the null) divided by its share of records.

- It falls with size: larger states fit the pairwise model more closely
  (Spearman with eigenvector rank 0.88, 0.90, 0.78).
- Net of size (the residual of log measure on log share), the ranking is
  stable from 2012 to 2017 (Spearman 0.88) and weaker against 2022 (0.57,
  0.55).
- Mean net-of-size residual by 2017 role: Specialist 0.34, Sustainer 0.12,
  Generalist 0.10, Router -0.13, Engine -0.25, Market -0.28. In all three
  years Specialists are highest and Engines among the two lowest.

## Results: framing B

| Subset size | 3 | 5 | 8 | 10 |
|---|---|---|---|---|
| Random subsets synergistic, 2017 | 41% | 14% | 1.2% | 0.1% |
| Most synergistic found, 2017 (bits) | -0.034 | -0.107 | -0.133 | -0.137 |
| Same, columns shuffled first | -0.001 | -0.003 | -0.009 | -0.014 |
| Same, no slice regression | -0.016 | +0.011 | +0.145 | +0.392 |

2012 is similar (most synergistic -0.033, -0.087, -0.144, -0.137).

- Synergistic subsets exist and are about 10 to 40 times stronger than the
  same search finds in shuffled data, so the regression does not create them.
- Without the regression, the shared commodity-size signal makes larger
  subsets redundant, as global signal does in the brain data.
- Participation in the annealed subsets relative to chance, 2017: Specialist
  1.37, Market 1.30, Generalist 1.15, Sustainer 0.74, Engine 0.71, Router 0.69.
  Engines and Routers are under-represented in both years and Markets
  over-represented in both. Specialists are over-represented in 2017 and near
  chance in 2012 (1.03); Sustainers differ by year.

## Reading

Both framings point the same way: the states most central in the pairwise
network take part least in higher-order structure; specialist states (and, in
framing B, market states) take part most. Varley et al. report the analogue in the brain: pairs with strong
functional connectivity rarely sit together in synergistic subsets. This is a
hypothesis about the network, not yet a finding about the economy.

## RA, log-linear models and gravity

`run_equivalence.py` checks on the data that reconstructability analysis and
gravity-style Poisson regression with fixed effects fit the same model. Table:
origin division x destination division x commodity, 2017, interstate shipment
records (2,943,533 records, 3,240 cells).

| Model | Largest difference in fitted counts, IPF vs Poisson | 2 N ln 2 x RA loss | Poisson deviance |
|---|---|---|---|
| O:D:C (exporter and importer effects only) | 2.1e-10 (cells up to 9,871) | 1,183,247.9 | 1,183,247.9 |
| OD:OC:DC (pair, exporter-product, importer-product) | 1.6e-9 (cells up to 18,302) | 202,120.8 | 202,120.8 |

Gravity specifications estimated by Poisson pseudo-maximum likelihood with only
fixed effects are hierarchical log-linear models. Their fitted values match the
observed fixed-effect margins (Arvis and Shepherd 2013, p. 6 of the World Bank
manuscript; Fally 2015, Lemma 2) and, when the estimate exists, equal the
maximum-entropy reconstruction from those margins (the log-linear literature,
e.g. Bishop, Fienberg and Holland 1975). That makes them points in RA's lattice
of structures: exporter + importer effects is independence; adding pair,
exporter-product and importer-product effects is OD:OC:DC. Pair covariates such
as distance take a specification outside the lattice. Cells with a zero kept
margin are fitted as zero, where the estimate sits on the boundary (Fally 2015,
fn 13). The three-way part reported above is what the full fixed-effect
specification leaves out.

## The lattice

`run_lattice.py`, writing `output/lattice_*`. Every structure over origin (O),
destination (D) and commodity (C), from independence to the data, plus the
pairwise model with the commodity-specific distance term. Each structure is
fitted by `ra.fit` with the zero diagonal kept (no interstate flow from a state
to itself). "Captured" is the share of the dependence a structure keeps: one
minus its loss over the loss of O:D:C. "Net" subtracts each structure's own
sampling null (10 tables of the same size drawn from its fit). Intervals are
95% over 40 resamples of the records, centred on the estimate (resampled tables
carry a second round of sampling loss, so only their spread is used). They
cover record sampling only, not the survey design.

Share of dependence captured, by records, net of the null (dollars in brackets):

| Structure | Reading | 2012 | 2017 | 2022 |
|---|---|---|---|---|
| O:D:C | size alone | 0 | 0 | 0 |
| DC:O | what each state receives, by commodity | 5.9% [8.8%] | 5.9% [8.3%] | 4.8% [8.9%] |
| OC:D | what each state ships, by commodity | 16.2% [26.5%] | 16.3% [24.3%] | 35.3% [24.9%] |
| OD:C | who trades with whom | 59.2% [37.3%] | 59.0% [39.8%] | 37.0% [37.6%] |
| OC:DC | both commodity mixes, no partners | 22.5% [35.7%] | 22.6% [33.1%] | 40.2% [34.1%] |
| OD:DC | partners and receiving mixes | 65.2% [46.1%] | 64.9% [48.1%] | 41.7% [46.5%] |
| OD:OC | partners and shipping mixes | 75.5% [63.8%] | 75.3% [64.0%] | 72.3% [62.4%] |
| OD:OC:DC | every pair | 80.6% [70.8%] | 80.3% [71.2%] | 76.3% [70.4%] |
| OD:OC:DC + distance | every pair, commodity-specific distance | 86.4% [75.4%] | 86.3% [76.0%] | 82.1% [74.4%] |
| ODC | the data | 100% | 100% | 100% |

Intervals are at most 0.3 points wide.

- Pairs keep about four-fifths of the dependence counted by records and
  seven-tenths counted by dollars. Who trades with whom (OD) is the largest
  single relation; adding each state's shipping mix (OC) adds more than adding
  its receiving mix (DC).
- By dollars the ladder is nearly the same in all three years. By records 2022
  differs (OD:C 37% against 59%, OC:D 35% against 16%): the 2022 file is a
  different sample (PUMS), so record-counted structure does not compare across
  years. Compare years by dollars.

Per state (`lattice_states_<year>.csv`), as shipping and as receiving state:
the state's share of the excess loss of OD:OC:DC (its slice of the loss minus
its slice of the null) over its share of records. 1 is its size share; the
share-weighted ratios sum to 1. Also after distance, and net of size (the
residual of log ratio on log share). The ratio falls with size: in 2017
Wyoming ships 4.5 times its size share of what pairs miss (interval 4.3 to
4.7); Texas ships 0.7 and receives 0.6 times its share. Net of size Wyoming, New Mexico, Montana, Idaho and
South Dakota still lead as shipping states. `lattice_cells_<year>.csv` holds
each state's five cells with the largest positive term, with observed and
expected records.

## Can a state be identified from its flows?

`run_identify_state.py`. Two views of the same question.

Profiles (2017, 51 states, by value): how many states are uniquely identified by their
top-k outflow and top-k inflow commodities, against two baselines of 1,000 runs each.

| Top k each way | Outflow only | Inflow only | Both | Shuffled commodities (95%) | National mix |
|---|---|---|---|---|---|
| 1 | 6 | 2 | 18 | 30.2 (23-38) | 0.9 |
| 2 | 27 | 10 | 45 | 50.8 (49-51) | 1.5 |
| 3 | 47 | 29 | 51 | 51.0 (51-51) | 3.6 |

States are far more distinctive than if each shipped the national mix, but less unique
than shuffled profiles (999 of 1,000 shuffles beat the observed 18 at k = 1): states
share top commodities and fall into families. Uniqueness at k = 3 holds for random
profiles too, so it says nothing.

Shipments (records are the observations): share of origin-state uncertainty answered,
by value.

| Year | Commodity | Destination | Both | Destination state by origin + commodity |
|---|---|---|---|---|
| 2012 | 7.3% | 11.3% | 26.1% | 20.9% |
| 2017 | 6.0% | 10.8% | 23.7% | 19.4% |
| 2022 | 6.1% | 10.2% | 23.4% | 19.2% |

Commodity and partner together answer more than the two separately (2017: 23.7% against
6.0 + 10.8). By record counts the shares are smaller (2017: 2.2%, 8.6%, 13.5%) with the
same shape.

## Caveats

- Survey design: the record counts ignore the sampling design; dollar-weighted
  figures have no sample size.
- The 2022 file is a sample (PUMS) of a different size and structure, which
  may explain part of the weaker 2012-to-2022 agreement.
- Small states have concentrated portfolios, and the size slope is removed
  only linearly in logs.
- Framing B depends on the slice definition and on the regression step; its
  Gaussian estimator is applied to rank-transformed, zero-heavy values.
- Commodity trade only, as for the state roles.

## Dependence follow-ups

`run_dependence.py`, writing `output/dependence_*`. Dollar-weighted unless
stated. A **sole-supplier link** is a destination-commodity pair whose largest
origin sends more than 50% of its inbound interstate value; it is
**persistent** if the same origin holds it in 2012, 2017 and 2022.

### Mode groups

| Group | 2012 and 2017 codes | 2022 codes |
|---|---|---|
| truck | 03, 04, 05 | 111, 112, 113 |
| rail | 06 | 12 |
| water | 07, 08, 09, 10, 101 | 131, 132, 133 |
| pipeline | 12 | 15 |
| air/parcel | 11, 14 | 14, 21 |
| multiple/other | 00, 02, 13, 15 to 20 | 16, 22 to 25, 30 |

No code book was at hand, so each code was placed by its median shipment
weight, median distance and leading commodities (for example, 2017 code 14:
6 lb median, 531 miles, SCTG 40/35/30, so parcel; 2022 code 15: SCTG 20/13/17
over 12 miles, so pipeline). Uncertain: 2022 code 113 (a truck subtype, but
which one is unclear; it stays in truck either way), 2022 code 16 (84 records,
coal over 7 miles, placed in other), and the deep-sea codes (2017 10, 2022 133),
whose profiles are odd for deep sea but stay in water either way. The shipper
groups use the first two NAICS digits (2012, 2017) or SECTOR (2022): wholesale
42, manufacturing 31 to 33, mining 21, other (retail 45 or 44-45, transport and
warehousing 49 or 48-49, information 51, management 55).

### H3. Are persistent sole-supplier links physical rather than commercial?

| | 2012 | 2017 | 2022 |
|---|---|---|---|
| Sole-supplier links | 502 | 441 | 435 |
| Persistent (all three years) | 60 | 60 | 60 |
| Median records behind the link, persistent / transient | 51 / 12.5 | 53 / 21 | 73 / 18 |
| Links under 10 records, persistent / transient | 10% / 42% | 7% / 34% | 8% / 42% |
| Median records behind the destination-commodity pair, persistent / transient | 94 / 62 | 139 / 66 | 240 / 88 |
| Median shipment value per record ($), persistent / transient | 19,875 / 16,254 | 16,489 / 12,817 | 12,520 / 10,831 |

Mode mix (share of link value):

| | truck | rail | water | pipeline | air/parcel | multiple/other |
|---|---|---|---|---|---|---|
| 2012 persistent | 39% | 7% | 8% | 26% | 16% | 3% |
| 2012 transient | 66% | 11% | 7% | 4% | 11% | 2% |
| 2017 persistent | 52% | 3% | 5% | 14% | 17% | 10% |
| 2017 transient | 48% | 3% | 9% | 11% | 23% | 6% |
| 2022 persistent | 60% | 5% | 5% | 22% | 2% | 6% |
| 2022 transient | 69% | 13% | 4% | 5% | 5% | 5% |

Commodity class of the links (2017): persistent 38% bulk minerals, 25% farm
and food, 20% fuels, 10% chemicals, 7% scrap and mixed, none in machinery,
vehicles or wood and paper; transient 33%, 20%, 18%, 7%, 5%, with 12% wood and
paper and 3% machinery and vehicles. The 60 persistent links are coal from
Wyoming to nine states, fuels mostly between neighbours (Louisiana to
Mississippi and Texas, Massachusetts to New Hampshire, Illinois to Indiana),
food from Maryland to DC and from California to Hawaii, Arizona and Oregon,
pharmaceuticals between neighbours (Massachusetts to New Hampshire and
Vermont, California to Nevada, Arizona to New Mexico, Illinois to Wisconsin),
and mixed freight between Washington and Oregon and to Alaska and
Hawaii. Market states (8 of 51) receive 21 of the 60.

Persistence under a minimum-records threshold on the destination-commodity
pair (applied in every year):

| Minimum records | 1 | 5 | 10 | 30 | 100 | 300 |
|---|---|---|---|---|---|---|
| 2017 links supported in all years | 390 | 337 | 303 | 237 | 124 | 47 |
| of which also links in 2012 | 32% | 34% | 35% | 35% | 30% | 30% |
| of which links in all three years | 15% | 17% | 17% | 17% | 17% | 15% |

- Partly supported. Persistent links lean toward pipeline (26% and 22% of
  value in 2012 and 2022 against 4% and 5% for transient links; 2017 is
  14% against 11%) and toward bulk minerals, fuels and food, but truck still
  carries 39 to 60% of their value. "Physical" fits coal, fuels and
  pharmaceuticals poorly as a single story: the common thread is proximity
  and isolated destinations (DC, Hawaii, Alaska, New Hampshire).
- Thin cells are not what makes links transient. Transient links rest on
  fewer records (a third to two-fifths under 10), but raising the support
  threshold to 300 records leaves the persistence rate flat at 15 to 17%.
  Most sole-supplier links turn over between surveys even where the share is
  well estimated.

### H4. What the three-way part is made of, by shipper group

Three-way part (loss of OD:OC:DC) fitted within each group, in bits; records
columns use record counts, with the sampling null for that count.
"Attributed" splits each pooled cell's term by the group's share of the
cell's value, so attributed shares sum to 1.

| Year | Group | Value share | Three-way, dollars | Three-way, records (null) | Attributed share of pooled | Top-5 origins / top-25 pairs share |
|---|---|---|---|---|---|---|
| 2012 | pooled | 100% | 0.411 | 0.160 | 100% | |
| 2012 | wholesale | 34% | 0.541 | 0.271 (0.068) | 35% | 26% / 9% |
| 2012 | manufacturing | 49% | 0.425 | 0.177 (0.035) | 44% | 22% / 9% |
| 2012 | mining | 0.7% | 0.133 | 0.482 (0.079) | 1.7% | 34% / 23% |
| 2012 | other | 16% | 0.608 | 0.402 (0.141) | 20% | 27% / 10% |
| 2017 | pooled | 100% | 0.362 | 0.155 | 100% | |
| 2017 | wholesale | 37% | 0.500 | 0.258 (0.053) | 38% | 25% / 9% |
| 2017 | manufacturing | 47% | 0.398 | 0.182 (0.031) | 43% | 22% / 8% |
| 2017 | mining | 0.5% | 0.195 | 0.479 (0.071) | 1.4% | 30% / 26% |
| 2017 | other | 16% | 0.513 | 0.306 (0.089) | 17% | 23% / 12% |
| 2022 | pooled | 100% | 0.373 | 0.169 | 100% | |
| 2022 | wholesale | 36% | 0.550 | 0.297 (0.007) | 42% | 25% / 10% |
| 2022 | manufacturing | 47% | 0.423 | 0.213 (0.007) | 45% | 23% / 9% |
| 2022 | mining | 0.4% | 0.146 | 0.195 (0.021) | 0.7% | 37% / 26% |
| 2022 | other | 17% | 0.389 | 0.144 (0.004) | 12% | 25% / 14% |

Top cells by within-group term, 2017 (origin to destination, SCTG):

| Group | Cells |
|---|---|
| wholesale | NY to KY pharmaceuticals (21); IN to OH mixed freight (43); TN to GA mixed freight; PA to NY pharmaceuticals |
| manufacturing | CA to OH pharmaceuticals; WI to MD motor vehicles (36); CT to TN transport equipment (37); CT to NY machinery (34) |
| other | GA to FL mixed freight; IN to GA pharmaceuticals; KY to TN mixed freight; PA to NJ mixed freight |
| mining | UT to TX nonmetallic minerals (13); KY to LA gravel (12); MO to TX nonmetallic mineral products (31) |

- Each group's own three-way part is larger than the pooled one (except
  mining in dollars): pooling groups with different pairwise patterns hides
  some of each group's specificity. The test file has a constructed case
  where two groups with no three-way structure pool into some.
- Wholesale carries slightly more than its value share (35 to 42% of the
  pooled part on 34 to 37% of value) and has the largest per-record excess
  over the null; manufacturing carries slightly less (43 to 45% on 47 to 49%).
  Neither dominates: the pooled part is spread across groups roughly in
  proportion to value.
- The hubs-versus-corridors hypothesis is not supported by these
  concentration measures: wholesale and manufacturing put about the same
  share of their three-way part on their top five origins (22 to 26%) and top
  25 origin-destination pairs (8 to 10%). The top origin is Texas for
  manufacturing in all three years and Illinois (2012, 2022) or Texas (2017)
  for wholesale.
- Top cells rarely repeat: of the top ten cells per group and year, only
  Illinois to Wisconsin wholesale pharmaceuticals appears in all three
  years. Mining's top cells often rest on a handful of records (2 to 6 in
  several 2012 and 2022 cells).

### H5. Buyer concentration versus supplier concentration

For each origin and commodity, the HHI of its shipments over destinations
(buyer concentration); for each destination and commodity, the HHI of its
receipts over origins (supplier concentration). Cells with fewer than 30
records are dropped; each state's figure is the value-weighted mean over
commodities. Asymmetry is buyer minus supplier HHI.

| Role | Buyer HHI 2012 / 2017 / 2022 | Supplier HHI 2012 / 2017 / 2022 | Asymmetry 2012 / 2017 / 2022 |
|---|---|---|---|
| Engine | 0.077 / 0.079 / 0.079 | 0.100 / 0.095 / 0.095 | -0.023 / -0.016 / -0.017 |
| Router | 0.113 / 0.111 / 0.115 | 0.159 / 0.118 / 0.115 | -0.046 / -0.007 / 0.000 |
| Generalist | 0.152 / 0.141 / 0.151 | 0.174 / 0.153 / 0.169 | -0.022 / -0.012 / -0.017 |
| Sustainer | 0.153 / 0.144 / 0.116 | 0.195 / 0.167 / 0.168 | -0.043 / -0.023 / -0.053 |
| Specialist | 0.257 / 0.185 / 0.169 | 0.227 / 0.214 / 0.208 | 0.030 / -0.028 / -0.039 |
| Market | 0.260 / 0.270 / 0.275 | 0.237 / 0.279 / 0.234 | 0.023 / -0.010 / 0.041 |

- Destinations depend on fewer origins than origins depend on destinations:
  supplier HHI exceeds buyer HHI in 40, 35 and 39 of 51 states.
- Both concentrations track size (Engines lowest, Markets highest).
  Sustainers are among the two most negative roles in all three years
  (concentrated sourcing, spread-out selling). Markets have positive
  asymmetry in 2012 and 2022 (sales as concentrated as sourcing or more);
  Specialists only in 2012. Role means over 5 to 17 states are noisy.

### Caveats for these follow-ups

- Concentration of observed flows is not non-substitutability. A destination
  that buys 80% of a commodity from one state may have many potential
  suppliers; the survey records where goods came from, not what else was
  possible.
- Survey design: links and HHIs use weighted value, which has no sample
  size; the record counts are only a guide to support. The per-group null is
  a multinomial on record counts, not the survey design.
- 2022 is a different sample (PUMS, about 7.5 times the records, different
  mode and sector codes), so thresholds on record counts bind differently by
  year, and part of the turnover in links may be sample, not economy.
- Shipper groups are the shipper's industry, not the trade's purpose: a
  manufacturer's sales office and a wholesaler can ship the same goods.
- The mode mapping is inferred from shipment profiles (see above).

## Bounded replaceability

> **Correction (2026-10-11).** A follow-up audit reproduced this section exactly
> (all class counts and per-link values, 1,378 link-years) and found three
> limits that weaken the reading below:
>
> - The relative distance bound favours short links. Links with no alternative
>   have a median r of 71 to 100 miles against 400 to 448 for the rest, and 88
>   to 97% of them join neighbouring states (Census county adjacency file). For
>   156 of the 296 no-alternative link-years, an origin with enough supply is
>   less than 250 extra miles away. Under a fixed gap in miles, flagged links
>   are still 71 to 89% neighbours against a base rate of 50 to 57%, so part of
>   the pattern is real.
> - The incumbent's distance is commodity-specific while most alternatives use
>   the all-commodity pair median. Measuring both sides the same way removes
>   the no-alternative label from 148 to 159 of the 296 link-years and adds it
>   to 47. Only 4 or 5 of the 15 named links keep a gap of at least 250 miles
>   in all three years, not the nine stated below.
> - Persistence and churn are confounded with sampling. Two bootstrap
>   replicates of the same survey keep only 68 to 73% of each other's
>   sole-supplier links, so record sampling alone accounts for at least 40 to
>   47% of the observed churn; persistent links are mostly the well-measured
>   ones.
>
> Read the class counts as a description of this particular bound, not as a
> finding that the named routes lack alternatives. A continuous distance gap
> (nearest sufficient origin's distance relative to the link's, both measured
> the same way) is more stable across years (Spearman 0.73 to 0.87) and is the
> recommended measure. Audit scripts, outputs and full numbers:
> `audit/AUDIT.md`.

`run_replaceability.py`, writing `output/replaceability_*`. Dependence here means
concentration of observed flows plus a stated, bounded replaceability. Capacity
is not claimed.

### Definition

The links are the sole-supplier links above (same code, same filters): origin
s sends more than 50% of destination d's inbound interstate value of commodity
c. Dollar-weighted (WGT_FACTOR x SHIPMT_VALUE).

- v: the value d receives of c from s.
- r: the median great-circle distance (SHIPMT_DIST_GC) of the s to d shipments
  of c, unweighted.
- An **alternative** is any origin o other than s and d whose total interstate
  shipments of c, to all destinations, are at least k x v, and whose distance
  to d is at most (1 + delta) x r.
- The alternative's distance to d is the median of its shipments of c to d; if
  it ships none, the median of all its shipments to d; if none, the median of
  all d's shipments to it; if none, the great-circle distance between the two
  states' 2020 centers of population (Census Bureau,
  `CenPop2020_Mean_ST.txt`). Over the three years, about 75% of candidate
  rows use the all-commodity pair median, 24% the commodity median, under 1%
  the reverse direction and 72 rows (2012 and 2017 only) the centroid.
- Classes: **replaceable** by volume and distance (3 or more alternatives),
  **thin** (1 or 2), **none** (0).

k is 1, 2 or 5; delta is 0, 0.25 or 1. `replaceability_links.csv` holds every
link with its count at each setting and `delta_needed_k1`, the smallest delta
at which one origin with at least v of c qualifies.

### Classes by setting

Links replaceable / thin / none:

| k | delta | 2012 (502) | 2017 (441) | 2022 (435) |
|---|---|---|---|---|
| 1 | 0 | 180 / 131 / 191 | 132 / 110 / 199 | 131 / 108 / 196 |
| 1 | 0.25 | 218 / 137 / 147 | 171 / 126 / 144 | 174 / 108 / 153 |
| 1 | 1 | 297 / 113 / 92 | 242 / 100 / 99 | 234 / 96 / 105 |
| 2 | 0 | 148 / 121 / 233 | 104 / 110 / 227 | 114 / 100 / 221 |
| 2 | 0.25 | 185 / 125 / 192 | 141 / 119 / 181 | 151 / 106 / 178 |
| 2 | 1 | 263 / 110 / 129 | 206 / 110 / 125 | 207 / 96 / 132 |
| 5 | 0 | 110 / 98 / 294 | 69 / 89 / 283 | 87 / 99 / 249 |
| 5 | 0.25 | 145 / 99 / 258 | 91 / 112 / 238 | 122 / 95 / 218 |
| 5 | 1 | 204 / 104 / 194 | 150 / 111 / 180 | 173 / 74 / 188 |

Share with no alternative, persistent (60 links) / transient:

| k | delta | 2012 | 2017 | 2022 |
|---|---|---|---|---|
| 1 | 0 | 65% / 34% | 63% / 42% | 73% / 41% |
| 1 | 1 | 38% / 16% | 40% / 20% | 47% / 21% |
| 2 | 0.25 | 58% / 36% | 55% / 39% | 62% / 38% |
| 5 | 0 | 82% / 55% | 75% / 62% | 80% / 54% |

By commodity group and destination role (three years pooled), share with no
alternative at the loosest setting (k=1, delta=1) and at k=2, delta=0.25:

| Commodity group | Links | k=1, delta=1 | k=2, delta=0.25 |
|---|---|---|---|
| fuels | 243 | 39% | 60% |
| wood and paper | 138 | 20% | 37% |
| scrap and mixed | 70 | 20% | 44% |
| bulk minerals | 465 | 19% | 36% |
| farm and food | 272 | 17% | 35% |
| chemicals | 104 | 16% | 36% |
| metals and minerals | 21 | 10% | 52% |
| machinery and vehicles | 50 | 10% | 18% |
| other manufactured | 15 | 7% | 40% |

| Destination role | Links | k=1, delta=1 | k=2, delta=0.25 |
|---|---|---|---|
| Engine | 64 | 33% | 56% |
| Router | 120 | 31% | 49% |
| Generalist | 415 | 21% | 40% |
| Specialist | 199 | 21% | 37% |
| Market | 336 | 19% | 36% |
| Sustainer | 244 | 18% | 39% |

### Strongest candidates for genuine dependence

Persistent links with no alternative at k=1, delta=1 in all three years: 15
of the 60. Distances in miles: r, then the nearest origin that ships at least
v of the commodity.

| Destination, commodity, origin | Share 2012 / 2017 / 2022 | r / nearest, 2012 | 2017 | 2022 |
|---|---|---|---|---|
| WI, pharmaceuticals (21), from IL | 76% / 68% / 74% | 112 / 312 | 98 / 281 | 103 / 367 |
| WA, mixed freight (43), from OR | 59% / 57% / 77% | 159 / 766 | 157 / 721 | 157 / 687 |
| OR, mixed freight (43), from WA | 56% / 57% / 54% | 136 / 536 | 135 / 622 | 171 / 570 |
| MS, gasoline (17), from LA | 79% / 68% / 85% | 129 / 520 | 85 / 428 | 124 / 319 |
| MS, fuel oils (18), from LA | 89% / 83% / 86% | 111 / 427 | 58 / 428 | 124 / 426 |
| NM, fuel oils (18), from TX | 97% / 99% / 77% | 163 / 654 | 141 / 516 | 148 / 738 |
| PA, coal (15), from WV | 85% / 86% / 91% | 85 / 259 | 52 / 289 | 73 / 289 |
| NM, coal (15), from CO | 100% / 100% / 100% | 120 / 538 | 127 / 482 | 121 / 432 |
| SD, coal (15), from WY | 100% / 100% / 100% | 111 / 292 | 114 / 289 | 115 / 308 |
| WV, gasoline (17), from KY | 90% / 85% / 92% | 29 / 434 | 27 / 94 | 5 / 449 |
| NJ, other agricultural (03), from NY | 51% / 60% / 62% | 24 / 72 | 28 / 552 | 18 / 77 |
| OR, fuel oils (18), from WA | 57% / 93% / 94% | 21 / 50 | 54 / 1,424 | 118 / 1,428 |
| ME, fuel oils (18), from NH | 96% / 99% / 53% | 8 / 168 | 7 / 136 | 28 / 141 |
| NH, fuel oils (18), from MA | 71% / 74% / 73% | 9 / 105 | 20 / 90 | 35 / 117 |
| DC, other agricultural (03), from MD | 63% / 62% / 94% | 8 / 62 | 9 / 24 | 21 / 62 |

The values range from $0.02 billion (coal to New Mexico and South Dakota) to
$11.8 billion (pharmaceuticals to Wisconsin) in 2017.

### Reading

- Most sole-supplier links have a nearby origin of sufficient size. At the
  loosest setting 18 to 24% of links have none; at the strictest (k=5,
  delta=0) 57 to 64%. The count of "none" rises by a factor of 2.4 to 3.2
  from loosest to strictest.
- Persistent links are about twice as likely as transient ones to have no
  alternative at every setting (38 to 47% against 16 to 21% at the loosest).
  Part of this is distance: persistent links are short (median r 129 to 139
  miles against 300 to 321), and the distance bound is relative to r.
- Fuels stand apart: 39% have no alternative at the loosest setting, twice
  any other group. Engine and Router destinations have the highest "none"
  shares (31 to 33%), against 18 to 21% for the other roles.
- Of the 15 named links, the first nine hold up in absolute terms: in every
  year the nearest origin of sufficient size is 170 to 610 miles farther
  than the current supplier (coal, refined fuels from Louisiana and Texas,
  the Washington and Oregon mixed-freight pair, Illinois pharmaceuticals to
  Wisconsin). The last six rest on short r (5 to 35 miles in most years), so
  a neighbour 24 to 170 miles away fails the bound; they are weaker
  candidates. Oregon's fuel oils from Washington is the exception among them
  in 2017 and 2022 (nearest about 1,400 miles), and New Jersey's 2017 figure
  (552 miles) is an outlier against 72 and 77 in the other years.

### Caveats

- This is a lower bound on replaceability by volume and distance only. An
  alternative's output may be committed to other buyers; there are no
  prices, contracts, capacity, product grades or modal access (a refinery
  without a pipeline to d is still counted).
- The distance bound is relative to r, so it is strict for short links and
  loose for long ones. `delta_needed_k1` and the nearest-alternative miles
  above show how far each link is from gaining one alternative.
- The alternative's supply is its total interstate shipments of c, including
  any to d itself; in-state shipments are not counted, so a large producer
  that mostly serves its own state is undercounted.
- Two-digit SCTG mixes products (fuel oils with other refined products;
  pharmaceuticals across all drugs), so an origin of sufficient size may not
  make the same goods.
- Distances are medians of unweighted records. For most candidate pairs the
  distance is the all-commodity pair median, not commodity-specific.
- The survey caveats above apply: weighted values have no sample size, and
  2022 is a different sample.

## Reproduce

`ra.py` holds the RA operations every script here uses: entropy, KL loss, the IPF fit of
any structure (with structural zeros through the start table), the lattice of structures,
and the record bootstrap.

```bash
cd analysis/higher_order
python run_three_way.py           # writes output/three_way_*
python run_states_as_variables.py # writes output/states_as_variables_*
python run_dependence.py          # writes output/dependence_*
python run_replaceability.py      # writes output/replaceability_*
python run_lattice.py             # writes output/lattice_*
pytest tests/test_higher_order.py # each measure passes a case and fails one
```
