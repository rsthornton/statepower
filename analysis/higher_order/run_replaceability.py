"""
Post-hoc exploratory study (NOT pre-registered): a bounded replaceability measure
for sole-supplier links.

For each sole-supplier link (origin s sends more than 50% of destination d's inbound
interstate value of commodity c), count the other origins that ship at least k times
the link's value of c in total and sit no farther from d than (1 + delta) times the
link's median shipment distance. This is a lower bound on replaceability by volume
and distance only: it says nothing about capacity, prices or contracts.

Reads the raw survey files named in evolution/configs read-only; writes
output/replaceability_* here. See README.md, "Bounded replaceability".
"""

import json

import numpy as np
import pandas as pd
from run_dependence import CLASSES, sole_supplier_links
from run_three_way import FIPS, OUT, ROLES, YEARS, load_shipments, source_file

KS = [1, 2, 5]
DELTAS = [0, 0.25, 1]
LINK = ["d", "SCTG", "o"]
CLASS_ORDER = ["replaceable", "thin", "none"]
EARTH_MILES = 3958.8
# Census Bureau 2020 state centers of population (latitude, longitude),
# https://www2.census.gov/geo/docs/reference/cenpop2020/CenPop2020_Mean_ST.txt
CENTROIDS = {
    "AL": (33.0162, -86.7534), "AK": (61.4089, -148.9615), "AZ": (33.3714, -111.8825),
    "AR": (35.1993, -92.7132), "CA": (35.4910, -119.3479), "CO": (39.5347, -105.1854),
    "CT": (41.4928, -72.8787), "DE": (39.3336, -75.5477), "DC": (38.9102, -77.0140),
    "FL": (27.8393, -81.6360), "GA": (33.4107, -83.8912), "HI": (21.1124, -157.4853),
    "ID": (44.2205, -115.2246), "IL": (41.3121, -88.3730), "IN": (40.1442, -86.2516),
    "IA": (41.9366, -93.0372), "KS": (38.4810, -96.4093), "KY": (37.8383, -85.2613),
    "LA": (30.6962, -91.4743), "ME": (44.2674, -69.7646), "MD": (39.1366, -76.8022),
    "MA": (42.2737, -71.3504), "MI": (42.8647, -84.2132), "MN": (45.1900, -93.5588),
    "MS": (32.5754, -89.5663), "MO": (38.4329, -92.2349), "MT": (46.7605, -111.3186),
    "NE": (41.1679, -97.2221), "NV": (37.0159, -116.1738), "NH": (43.1491, -71.4556),
    "NJ": (40.4382, -74.4245), "NM": (34.6078, -106.3322), "NY": (41.4718, -74.5908),
    "NC": (35.5387, -79.6750), "ND": (47.3395, -99.4450), "OH": (40.4386, -82.7969),
    "OK": (35.6069, -96.8542), "OR": (44.7535, -122.5883), "PA": (40.4435, -76.9652),
    "RI": (41.7557, -71.4505), "SC": (34.0225, -80.9965), "SD": (43.9865, -98.9223),
    "TN": (35.8212, -86.3325), "TX": (30.9096, -97.3287), "UT": (40.3858, -111.9480),
    "VT": (44.1020, -72.8242), "VA": (37.8502, -77.7656), "WA": (47.3295, -121.6326),
    "WV": (38.8233, -80.6713), "WI": (43.7237, -89.0314), "WY": (42.6948, -106.9848),
}


def label(k, delta):
    return f"k{k}_delta{delta}"


def centroid_miles(a, b):
    """Great-circle miles between the states' 2020 centers of population."""
    (lat1, lon1), (lat2, lon2) = (np.radians(CENTROIDS[a]), np.radians(CENTROIDS[b]))
    h = np.sin((lat2 - lat1) / 2) ** 2
    h += np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return float(2 * EARTH_MILES * np.arcsin(np.sqrt(h)))


def tables(df):
    """Cells (value, records, median distance) by origin, destination and commodity, and
    the median distance of each ordered state pair over all commodities."""
    cells = (
        df.groupby(["o", "d", "SCTG"], observed=True)
        .agg(usd=("usd", "sum"), records=("usd", "size"), dist=("SHIPMT_DIST_GC", "median"))
        .reset_index()
    )
    pairs = df.groupby(["o", "d"], observed=True).SHIPMT_DIST_GC.median().rename("dist")
    return cells, pairs.reset_index()


def candidates(links, cells, pairs, states):
    """One row per link and alternative origin (every state but the link's origin and
    destination), with the alternative's total interstate value of the commodity and its
    distance to the destination.

    The alternative's distance is the median of its shipments of the commodity to the
    destination; failing that, of all its shipments to the destination; failing that, of
    all the destination's shipments to it; failing that, the great-circle distance between
    the two states' centers of population.
    """
    cand = links.merge(pd.DataFrame({"alt": states}), how="cross")
    cand = cand[(cand.alt != cand.o) & (cand.alt != cand.d)]
    supply = cells.groupby(["o", "SCTG"]).usd.sum().rename("supply")
    cand = cand.join(supply, on=["alt", "SCTG"])
    cand = cand.assign(supply=cand.supply.fillna(0.0))
    same = cells.set_index(["o", "d", "SCTG"]).dist.rename("dist_c")
    to_d = pairs.set_index(["o", "d"]).dist.rename("dist_pair")
    from_d = pairs.rename(columns={"o": "d", "d": "o"}).set_index(["o", "d"]).dist
    cand = cand.join(same, on=["alt", "d", "SCTG"]).join(to_d, on=["alt", "d"])
    cand = cand.join(from_d.rename("dist_back"), on=["alt", "d"])
    source = np.select(
        [cand.dist_c.notna(), cand.dist_pair.notna(), cand.dist_back.notna()],
        ["commodity", "pair", "reverse"],
        "centroid",
    )
    centroid = pd.Series(
        [centroid_miles(a, b) for a, b in zip(cand.alt, cand.d)], index=cand.index
    )
    alt_dist = cand.dist_c.fillna(cand.dist_pair).fillna(cand.dist_back).fillna(centroid)
    return cand.assign(alt_dist=alt_dist, dist_source=source).drop(
        columns=["dist_c", "dist_pair", "dist_back"]
    )


def count_alternatives(cand, k, delta):
    """Alternatives per link: supply of at least k times the link value and distance within
    (1 + delta) times the link's distance."""
    ok = (cand.supply >= k * cand.usd) & (cand.alt_dist <= (1 + delta) * cand.r)
    return ok.groupby([cand[c] for c in LINK]).sum().rename(label(k, delta))


def delta_needed(cand, k):
    """The smallest delta at which a link gains one alternative with k times its value
    (NaN if no other origin ships that much)."""
    big = cand[cand.supply >= k * cand.usd]
    need = (big.alt_dist / big.r - 1).clip(lower=0)
    return need.groupby([big[c] for c in LINK]).min().rename(f"delta_needed_k{k}")


def classify(count):
    return pd.Series(
        np.select([count >= 3, count >= 1], ["replaceable", "thin"], "none"), index=count.index
    )


def year_links(year):
    df = load_shipments(source_file(year), extra=["SHIPMT_DIST_GC"])
    cells, pairs = tables(df)
    links = sole_supplier_links(cells).merge(
        cells[["o", "d", "SCTG", "dist"]].rename(columns={"dist": "r"}), on=LINK
    )
    cand = candidates(links, cells, pairs, sorted(FIPS.values()))
    counts = pd.concat([count_alternatives(cand, k, x) for k in KS for x in DELTAS], axis=1)
    links = links.join(counts, on=LINK).join(delta_needed(cand, 1), on=LINK)
    sources = cand.dist_source.value_counts().to_dict()
    return links.assign(year=year), sources, int(len(df))


def class_table(links):
    roles = pd.read_csv(ROLES)[["state", "year", "role"]]
    links = links.merge(roles.rename(columns={"state": "d"}), on=["d", "year"], how="left")
    links = links.assign(group=links.SCTG.map(CLASSES))
    rows = []
    for k in KS:
        for x in DELTAS:
            cls = classify(links[label(k, x)])
            views = [
                ("all", pd.Series("all", index=links.index)),
                ("persistence", links.persistence),
                ("commodity group", links.group),
                ("destination role", links.role),
            ]
            for by, level in views:
                counts = pd.crosstab([links.year, level], cls)
                counts = counts.reindex(columns=CLASS_ORDER, fill_value=0)
                for (year, lev), row in counts.iterrows():
                    rows.append({"year": year, "k": k, "delta": x, "by": by, "level": lev,
                                 "links": int(row.sum()), **row.to_dict(),
                                 "share_none": row["none"] / row.sum()})
    return pd.DataFrame(rows), links


def main():
    OUT.mkdir(exist_ok=True)
    parts, sources, records = [], {}, {}
    for y in YEARS:
        links, sources[y], records[y] = year_links(y)
        parts.append(links)
        print(y, len(links), sources[y], flush=True)
    links = pd.concat(parts, ignore_index=True)
    keys = links.groupby(LINK).year.nunique()
    persistent = set(keys[keys == len(YEARS)].index)
    links = links.assign(persistence=[
        "persistent" if k in persistent else "transient" for k in zip(*(links[c] for c in LINK))
    ])
    classes, links = class_table(links)
    loosest = label(KS[0], DELTAS[-1])
    none = links[(links.persistence == "persistent") & (links[loosest] == 0)]
    hits = none.groupby(LINK).year.nunique()
    strongest = links[links.set_index(LINK).index.isin(hits[hits == len(YEARS)].index)]
    strongest = strongest.pivot_table(index=[*LINK, "group"], columns="year",
                                      values=["share", "usd", "r", "delta_needed_k1"])
    strongest.columns = [f"{a}_{b}" for a, b in strongest.columns]

    links.round(4).to_csv(OUT / "replaceability_links.csv", index=False)
    classes.round(4).to_csv(OUT / "replaceability_classes.csv", index=False)
    strongest.round(4).reset_index().to_csv(OUT / "replaceability_strongest.csv", index=False)
    (OUT / "replaceability_summary.json").write_text(json.dumps({
        "records": records,
        "links": links.groupby("year").size().to_dict(),
        "persistent_links": len(persistent),
        "strongest_dependence_links": len(strongest),
        "alternative_distance_source": sources,
    }, indent=1, default=int))


if __name__ == "__main__":
    main()
