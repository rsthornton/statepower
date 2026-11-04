"""
Audit of the bounded replaceability test (run_replaceability.py), post hoc.

For every majority link (origin s sends more than 50% of destination d's inbound
interstate value of commodity c) in 2012, 2017 and 2022:

A  the existing test, reproduced (class counts must match the README);
B  volume only: origins other than s and d shipping at least k x v of c in total;
C  absolute distance bands: such origins within 250, 500 or 1,000 miles of d;
D  the distance gap: distance of the nearest origin with supply >= k x v, minus r,
   in miles and as a ratio, with the alternatives' distances as in A;
E  the same gap with one distance definition on both sides: commodity medians
   (centroid fallback), all-commodity pair medians (reverse, then centroid
   fallback), or centroid to centroid.

Each flag is compared against state adjacency (Census county adjacency file).
Writes audit/output/variants_*.
"""

import json

import numpy as np
import pandas as pd
from common import OUT, STATES, YEARS, adjacency, centroid_matrix, shipments
from run_dependence import CLASSES, sole_supplier_links
from run_replaceability import (
    DELTAS,
    KS,
    LINK,
    candidates,
    classify,
    count_alternatives,
    label,
    tables,
)

BANDS = [250, 500, 1000]
GAP_FLAGS = [250, 500]
DEFS = ["A", "commodity", "pair", "centroid"]


def as_str(frame):
    return frame.astype({c: str for c in ["o", "d", "SCTG"] if c in frame})


def year_frames(year, cent):
    df = shipments(year)
    cells, pairs = tables(df)
    cells, pairs = as_str(cells), as_str(pairs)
    links = sole_supplier_links(cells).merge(
        cells[["o", "d", "SCTG", "dist"]].rename(columns={"dist": "r"}), on=LINK
    )
    pair_dist = pairs.set_index(["o", "d"]).dist
    links = links.assign(
        r_pair=[pair_dist.get((o, d), np.nan) for o, d in zip(links.o, links.d)],
        r_centroid=[cent.at[o, d] for o, d in zip(links.o, links.d)],
    )
    cand = candidates(links, cells, pairs, STATES)
    same = cells.set_index(["o", "d", "SCTG"]).dist
    to_d = pair_dist
    from_d = pairs.rename(columns={"o": "d", "d": "o"}).set_index(["o", "d"]).dist
    c_key = list(zip(cand.alt, cand.d, cand.SCTG))
    p_key = list(zip(cand.alt, cand.d))
    centroid = np.array([cent.at[a, d] for a, d in p_key])
    dist_c = same.reindex(c_key).to_numpy()
    dist_pair = to_d.reindex(p_key).to_numpy()
    dist_back = from_d.reindex(p_key).to_numpy()
    cand = cand.assign(
        dist_c=dist_c,
        dist_pair=dist_pair,
        alt_commodity=np.where(np.isnan(dist_c), centroid, dist_c),
        alt_pair=pd.Series(dist_pair).fillna(pd.Series(dist_back)).fillna(
            pd.Series(centroid)).to_numpy(),
        alt_centroid=centroid,
    )
    return links, cand


def nearest(cand, k, column):
    big = cand[cand.supply >= k * cand.usd]
    return big.groupby([big[c] for c in LINK])[column].min()


def evaluate(links, cand):
    out = links.copy()
    idx = out.set_index(LINK).index
    for k in KS:
        for x in DELTAS:
            out[f"A_{label(k, x)}"] = count_alternatives(cand, k, x).reindex(idx).to_numpy()
    for k in KS:
        out[f"B_k{k}"] = (
            (cand.supply >= k * cand.usd).groupby([cand[c] for c in LINK]).sum()
            .reindex(idx).to_numpy()
        )
    for k in [1, 2]:
        for b in BANDS:
            ok = (cand.supply >= k * cand.usd) & (cand.alt_dist <= b)
            out[f"C_k{k}_{b}"] = ok.groupby([cand[c] for c in LINK]).sum().reindex(idx).to_numpy()
    incumbent = {"A": "r", "commodity": "r", "pair": "r_pair", "centroid": "r_centroid"}
    alt = {"A": "alt_dist", "commodity": "alt_commodity", "pair": "alt_pair",
           "centroid": "alt_centroid"}
    for k in [1, 2]:
        for name in DEFS:
            near = nearest(cand, k, alt[name]).reindex(idx).to_numpy()
            out[f"near_{name}_k{k}"] = near
            out[f"gap_{name}_k{k}"] = near - out[incumbent[name]].to_numpy()
            out[f"ratio_{name}_k{k}"] = near / out[incumbent[name]].clip(lower=1).to_numpy()
    # distance source of the nearest k=1 alternative under A
    big = cand[cand.supply >= cand.usd].copy()
    big["src"] = np.select(
        [big.dist_c.notna(), big.dist_pair.notna()], ["commodity", "pair"], "reverse/centroid"
    )
    first = big.sort_values("alt_dist").groupby(LINK).head(1).set_index(LINK).src
    out["near_A_k1_source"] = first.reindex(idx).to_numpy()
    return out


def flags(links):
    """Boolean flag columns: True = 'no alternative' or large gap under each variant."""
    f = {}
    for k in KS:
        for x in DELTAS:
            f[f"A k={k} delta={x}"] = links[f"A_{label(k, x)}"] == 0
    for k in KS:
        f[f"B k={k}"] = links[f"B_k{k}"] == 0
    for k in [1, 2]:
        for b in BANDS:
            f[f"C k={k} within {b} mi"] = links[f"C_k{k}_{b}"] == 0
    for k in [1, 2]:
        for name in DEFS:
            v = "D" if name == "A" else f"E-{name}"
            for g in GAP_FLAGS:
                gap = links[f"gap_{name}_k{k}"]
                f[f"{v} k={k} gap>={g}"] = gap.isna() | (gap >= g)
    return pd.DataFrame(f)


def summarise(links, fl):
    rows = []
    for name in fl.columns:
        for y in YEARS:
            m = links.year == y
            hit = fl[name] & m
            rows.append({
                "variant": name, "year": y, "links": int(m.sum()),
                "flagged": int(hit.sum()),
                "share_flagged": float(hit.sum() / m.sum()),
                "flagged_adjacent_share": float(links.adjacent[hit].mean()) if hit.any() else np.nan,
                "flagged_nonadjacent": int((hit & ~links.adjacent).sum()),
                "flagged_persistent": int((hit & (links.persistence == "persistent")).sum()),
                "flagged_persistent_nonadjacent": int(
                    (hit & ~links.adjacent & (links.persistence == "persistent")).sum()),
            })
    return pd.DataFrame(rows)


def rank_stability(links):
    rows = []
    for col in [f"gap_{n}_k{k}" for k in [1, 2] for n in DEFS] + \
               [f"ratio_{n}_k{k}" for k in [1, 2] for n in DEFS]:
        # no qualifying origin = largest gap
        val = links[col].fillna(np.inf)
        wide = links.assign(v=val).pivot_table(index=LINK, columns="year", values="v",
                                               aggfunc="first")
        dc = links.assign(v=val).sort_values("share", ascending=False).pivot_table(
            index=["d", "SCTG"], columns="year", values="v", aggfunc="first")
        for a, b in [(2012, 2017), (2017, 2022), (2012, 2022)]:
            both = wide[[a, b]].dropna()
            both_dc = dc[[a, b]].dropna()
            rows.append({
                "measure": col, "years": f"{a}-{b}",
                "links_both": len(both),
                "spearman_link": float(both[a].rank().corr(both[b].rank())),
                "dc_pairs_both": len(both_dc),
                "spearman_dest_commodity": float(both_dc[a].rank().corr(both_dc[b].rank())),
            })
    return pd.DataFrame(rows)


def main():
    OUT.mkdir(exist_ok=True)
    adj = adjacency()
    cent = centroid_matrix()
    parts, diag = [], {}
    for y in YEARS:
        links, cand = year_frames(y, cent)
        parts.append(evaluate(links, cand).assign(year=y))
        both = cand.dist_c.notna() & cand.dist_pair.notna()
        diag[y] = {
            "candidate_rows": len(cand),
            "rows_with_commodity_distance": int(cand.dist_c.notna().sum()),
            "median_pair_over_commodity_where_both": float(
                (cand.dist_pair[both] / cand.dist_c[both].clip(lower=1)).median()),
            "share_pair_vs_commodity_off_by_half_where_both": float(
                (np.abs(np.log(cand.dist_pair[both].clip(lower=1)
                               / cand.dist_c[both].clip(lower=1))) > np.log(1.5)).mean()),
            "incumbent_median_r_over_pair_median": float(
                (links.r / links.r_pair.clip(lower=1)).median()),
            "incumbent_share_r_below_pair_median": float((links.r < links.r_pair).mean()),
        }
        print(y, len(links), flush=True)
    links = pd.concat(parts, ignore_index=True)
    keys = links.groupby(LINK).year.nunique()
    persistent = set(keys[keys == len(YEARS)].index)
    links = links.assign(
        persistence=["persistent" if k in persistent else "transient"
                     for k in zip(*(links[c] for c in LINK))],
        adjacent=[frozenset((o, d)) in adj for o, d in zip(links.o, links.d)],
        group=links.SCTG.map(CLASSES),
    )
    # A reproduction: class counts per setting
    repro = []
    for k in KS:
        for x in DELTAS:
            cls = classify(links[f"A_{label(k, x)}"])
            t = pd.crosstab(links.year, cls).reindex(columns=["replaceable", "thin", "none"],
                                                     fill_value=0)
            for y, row in t.iterrows():
                repro.append({"k": k, "delta": x, "year": y, **row.to_dict()})
    fl = flags(links)
    summary = summarise(links, fl)
    stab = rank_stability(links)

    # concern 1: r and adjacency among A-none (k=1, delta=1) versus the rest
    a_none = fl["A k=1 delta=1"]
    c1 = links.groupby([links.year, a_none.rename("A_none")]).agg(
        links=("r", "size"), median_r=("r", "median"), adjacent_share=("adjacent", "mean"),
        median_centroid=("r_centroid", "median"))
    # concern 2: does the definition change the class at k=1, delta=1?
    swaps = {}
    for name in ["commodity", "pair", "centroid"]:
        inc = {"commodity": "r", "pair": "r_pair", "centroid": "r_centroid"}[name]
        none_e = links[f"near_{name}_k1"].isna() | (links[f"near_{name}_k1"] > 2 * links[inc])
        swaps[name] = {
            "A_none_E_not": int((a_none & ~none_e).sum()),
            "E_none_A_not": int((~a_none & none_e).sum()),
            "both_none": int((a_none & none_e).sum()),
        }
    named = links[(links.persistence == "persistent")]
    hits = named[a_none[named.index]].groupby(LINK).year.nunique()
    fifteen = hits[hits == 3].index
    named15 = [{"d": d, "SCTG": c, "o": o, "adjacent": frozenset((o, d)) in adj}
               for d, c, o in fifteen]

    # concern 1: A-none links whose nearest k=1 alternative is under 250 or 100 extra miles
    a_gap = links.gap_A_k1[a_none]
    by_construction = {
        "A_none": int(a_none.sum()),
        "gap_under_100": int((a_gap < 100).sum()),
        "gap_under_250": int((a_gap < 250).sum()),
        "no_qualifying_origin": int(a_gap.isna().sum()),
    }
    surfaced = {}
    for name in ["D k=1 gap>=250", "E-centroid k=1 gap>=250", "E-pair k=1 gap>=250",
                 "D k=2 gap>=250", "E-centroid k=2 gap>=250"]:
        hit = links[fl[name] & ~links.adjacent]
        keys = hit.groupby(LINK).year.apply(sorted)
        surfaced[name] = {
            "unique_nonadjacent_links": len(keys),
            "in_2_or_more_years": int((keys.map(len) >= 2).sum()),
            "links": [f"{o}>{d} {c} {ys}" for (d, c, o), ys in keys.items()],
        }

    links_out = links.drop(columns=["group"]).round(3)
    links_out.to_csv(OUT / "variants_links.csv", index=False)
    summary.round(4).to_csv(OUT / "variants_summary.csv", index=False)
    stab.round(4).to_csv(OUT / "variants_rank_stability.csv", index=False)
    pd.DataFrame(repro).to_csv(OUT / "variants_A_reproduction.csv", index=False)
    c1.round(3).to_csv(OUT / "variants_concern1.csv")
    (OUT / "variants_summary.json").write_text(json.dumps({
        "links": links.groupby("year").size().to_dict(),
        "persistent": len(persistent),
        "adjacent_pairs": len(adj),
        "base_adjacent_share": links.groupby("year").adjacent.mean().round(4).to_dict(),
        "persistent_adjacent_share": float(
            links[links.persistence == "persistent"].adjacent.mean()),
        "strongest15": named15,
        "distance_diagnostics": diag,
        "nearest_k1_source_A": links.near_A_k1_source.value_counts().to_dict(),
        "class_swaps_k1_delta1": swaps,
        "A_none_by_construction": by_construction,
        "nonadjacent_surfaced": surfaced,
    }, indent=1, default=str))


if __name__ == "__main__":
    main()
