"""
Post-hoc exploratory study (NOT pre-registered): follow-ups on single-origin
dependence in interstate commodity flows.

H3: are persistent sole-supplier links (one origin >50% of a destination's
inbound value of a commodity, in all three surveys) physical rather than
commercial? Mode mix, value per record, commodity class, and the record
counts behind each link, with persistence under minimum-record thresholds.
H4: the three-way part (loss of OD:OC:DC) within shipper groups (wholesale,
manufacturing, mining, other) and each group's share of the pooled part.
H5: buyer concentration of origins vs supplier concentration of destinations,
by state role.

Reads the raw survey files named in evolution/configs read-only; writes
output/dependence_* here. See README.md, "Dependence follow-ups".
"""

import json

import numpy as np
import pandas as pd
from run_three_way import (
    FIPS,
    OUT,
    ROLES,
    YEARS,
    cell_terms,
    fit_pairs,
    kl,
    load_shipments,
    source_file,
)

SOLE = 0.5
THRESHOLDS = [1, 5, 10, 30, 100, 300]
NULL_DRAWS = 2
HHI_MIN_RECORDS = 30
TOP_CELLS = 10

# Mode codes as found in the files. 2012/2017 follow the PUF code list; the 2022
# PUMS uses a hierarchical list. Codes were checked against each code's median
# weight, distance and leading commodities (see README); 2022 codes 113 and 16
# are inferred, not read from a code book.
MODES = {
    2012: {
        **dict.fromkeys([3, 4, 5], "truck"),
        6: "rail",
        **dict.fromkeys([7, 8, 9, 10, 101], "water"),
        12: "pipeline",
        **dict.fromkeys([11, 14], "air/parcel"),
        **dict.fromkeys([0, 2, 13, 15, 16, 17, 18, 19, 20], "multiple/other"),
    },
    2022: {
        **dict.fromkeys([111, 112, 113], "truck"),
        12: "rail",
        **dict.fromkeys([131, 132, 133], "water"),
        15: "pipeline",
        **dict.fromkeys([14, 21], "air/parcel"),
        **dict.fromkeys([16, 22, 23, 24, 25, 30], "multiple/other"),
    },
}
MODES[2017] = MODES[2012]

SHIPPERS = {"42": "wholesale", "31": "manufacturing", "32": "manufacturing",
            "33": "manufacturing", "31-33": "manufacturing", "21": "mining"}

CLASSES = {
    **dict.fromkeys(["02", "03", "04", "05", "06", "07", "08", "09"], "farm and food"),
    **dict.fromkeys(["10", "11", "12", "13", "14", "15"], "bulk minerals"),
    **dict.fromkeys(["17", "18", "19"], "fuels"),
    **dict.fromkeys(["20", "21", "22", "23", "24"], "chemicals"),
    **dict.fromkeys(["25", "26", "27", "28", "29"], "wood and paper"),
    **dict.fromkeys(["31", "32", "33"], "metals and minerals"),
    **dict.fromkeys(["34", "35", "36", "37", "38"], "machinery and vehicles"),
    **dict.fromkeys(["30", "39", "40"], "other manufactured"),
    **dict.fromkeys(["41", "43"], "scrap and mixed"),
}


def mode_group(year, codes):
    groups = codes.astype(int).map(MODES[year])
    unmapped = set(codes[groups.isna()].unique())
    if unmapped:
        raise KeyError(f"unmapped {year} mode codes: {sorted(unmapped)}")
    return groups


def shipper_group(codes):
    codes = codes.astype(str)
    key = codes.where(codes.str.contains("-"), codes.str[:2])
    return key.map(SHIPPERS).fillna("other")


def aggregate(year):
    """Weighted value, records and unweighted value by origin, destination, commodity,
    mode group and shipper group."""
    naics = "SECTOR" if year == 2022 else "NAICS"
    df = load_shipments(source_file(year), extra=["MODE", naics])
    df = df.assign(mode=mode_group(year, df.MODE), shipper=shipper_group(df[naics]))
    return (
        df.groupby(["o", "d", "SCTG", "mode", "shipper"], observed=True)
        .agg(usd=("usd", "sum"), records=("usd", "size"), value=("SHIPMT_VALUE", "sum"))
        .reset_index()
    )


def sole_supplier_links(cells, threshold=SOLE):
    """Destination-commodity pairs whose largest origin sends more than `threshold` of the
    inbound value, with the records behind the link cell and behind the pair."""
    odc = cells.groupby(["d", "SCTG", "o"], as_index=False).agg(
        usd=("usd", "sum"), records=("records", "sum")
    )
    dc = odc.groupby(["d", "SCTG"], as_index=False).agg(
        dc_usd=("usd", "sum"), dc_records=("records", "sum")
    )
    odc = odc.merge(dc, on=["d", "SCTG"])
    odc = odc.assign(share=odc.usd / odc.dc_usd)
    return odc[odc.share > threshold].reset_index(drop=True)


def hhi(weights, keys):
    shares = weights / weights.groupby(keys).transform("sum")
    return (shares**2).groupby(keys).sum()


def tensor(frame, column, states, sctg):
    t = np.zeros((len(states), len(states), len(sctg)))
    index = (
        frame.o.map(states.index).values,
        frame.d.map(states.index).values,
        frame.SCTG.map(sctg.index).values,
    )
    np.add.at(t, index, frame[column].values)
    return t


def attributed_share(pooled, t, tg):
    """Share of the pooled three-way part carried by one group: each cell's term is split
    by the group's share of that cell's value."""
    split = np.divide(tg, t, out=np.zeros_like(t), where=t > 0)
    return float((pooled * split).sum() / pooled.sum())


def three_way_null(q, n_records, seed):
    rng = np.random.default_rng(seed)
    draws = []
    for _ in range(NULL_DRAWS):
        s = rng.multinomial(n_records, q.ravel()).reshape(q.shape) / n_records
        draws.append(kl(s, fit_pairs(s)))
    return float(np.mean(draws))


def h3(aggs):
    links = {y: sole_supplier_links(aggs[y]).set_index(["d", "SCTG", "o"]) for y in YEARS}
    persistent = set.intersection(*(set(v.index) for v in links.values()))
    rows, mode_rows = [], []
    for y in YEARS:
        keys = ["d", "SCTG", "o"]
        link = links[y].reset_index()
        link = link.assign(persistent=[k in persistent for k in links[y].index])
        detail = aggs[y].merge(link[[*keys, "persistent"]], on=keys)
        values = detail.groupby(keys, as_index=False).value.sum()
        link = link.merge(values, on=keys)
        link = link.assign(
            usd_per_record=link.usd / link.records,
            value_per_record=link.value / link.records,
            **{"class": link.SCTG.map(CLASSES)},
        )
        for kind, part in link.groupby("persistent"):
            label = "persistent" if kind else "transient"
            rows.append({
                "year": y, "links": label, "count": len(part),
                "median_records": float(part.records.median()),
                "share_under_10_records": float((part.records < 10).mean()),
                "median_dc_records": float(part.dc_records.median()),
                "median_share": float(part.share.median()),
                "median_usd_per_record": float(part.usd_per_record.median()),
                "median_value_per_record": float(part.value_per_record.median()),
                **{f"class: {c}": float(v) for c, v in
                   part["class"].value_counts(normalize=True).items()},
            })
            sub = detail[detail.persistent == kind]
            mode_usd = sub.groupby("mode").usd.sum() / sub.usd.sum()
            mode_rows.append({"year": y, "links": label, **mode_usd.round(4).to_dict()})
    summary = pd.DataFrame(rows).fillna(0)
    modes = pd.DataFrame(mode_rows).fillna(0)
    support = {y: aggs[y].groupby(["d", "SCTG"]).records.sum() for y in YEARS}
    persistence = []
    for k in THRESHOLDS:
        kept = {y: links[y][links[y].dc_records >= k] for y in YEARS}
        sets = {y: set(kept[y].index) for y in YEARS}
        # 2017 links whose destination-commodity pair clears k records in every year
        base = [i for i in sets[2017]
                if all(support[y].get(i[:2], 0) >= k for y in YEARS)]
        persistence.append({
            "min_dc_records": k,
            **{f"links_{y}": len(sets[y]) for y in YEARS},
            "links_2017_supported_all_years": len(base),
            "in_2012": float(np.mean([i in sets[2012] for i in base])) if base else np.nan,
            "in_all_three": float(np.mean([i in sets[2012] and i in sets[2022] for i in base]))
            if base else np.nan,
        })
    persistent_list = links[2017].loc[sorted(persistent)].reset_index()
    persistent_list = persistent_list.assign(**{"class": persistent_list.SCTG.map(CLASSES)})
    return summary, modes, pd.DataFrame(persistence), persistent_list, len(persistent)


def h4(aggs):
    states = sorted(FIPS.values())
    summary, top, places = [], [], []
    for y in YEARS:
        cells = aggs[y]
        sctg = sorted(cells.SCTG.unique())
        t = tensor(cells, "usd", states, sctg)
        p = t / t.sum()
        q = fit_pairs(p)
        pooled = cell_terms(p, q)
        r_all = tensor(cells, "records", states, sctg)
        pooled_r = kl(r_all / r_all.sum(), fit_pairs(r_all / r_all.sum()))
        summary.append({"year": y, "group": "pooled", "usd_share": 1.0,
                        "records": int(r_all.sum()), "three_way_usd": float(pooled.sum()),
                        "three_way_records": pooled_r, "attributed_share": 1.0})
        for g, part in cells.groupby("shipper"):
            tg = tensor(part, "usd", states, sctg)
            pg = tg / tg.sum()
            qg = fit_pairs(pg)
            terms = cell_terms(pg, qg)
            rg = tensor(part, "records", states, sctg)
            n = int(rg.sum())
            qr = fit_pairs(rg / n)
            od = terms.sum(2)
            pairs = np.sort(od.ravel())[::-1]
            summary.append({
                "year": y, "group": g, "usd_share": float(tg.sum() / t.sum()), "records": n,
                "three_way_usd": float(terms.sum()),
                "three_way_records": kl(rg / n, qr),
                "three_way_records_null": three_way_null(qr, n, y),
                "attributed_share": attributed_share(pooled, t, tg),
                "top5_origins_share": float(np.sort(od.sum(1))[::-1][:5].sum() / od.sum()),
                "top5_destinations_share": float(np.sort(od.sum(0))[::-1][:5].sum() / od.sum()),
                "top25_pairs_share": float(pairs[:25].sum() / od.sum()),
                "top_origin": states[int(od.sum(1).argmax())],
                "top_destination": states[int(od.sum(0).argmax())],
            })
            for flat in np.argsort(terms.ravel())[::-1][:TOP_CELLS]:
                i, j, k = np.unravel_index(flat, terms.shape)
                top.append({"year": y, "group": g, "o": states[i], "d": states[j],
                            "SCTG": sctg[k], "bits": float(terms[i, j, k]),
                            "usd": float(tg[i, j, k]), "records": int(rg[i, j, k]),
                            "observed_over_model": float(pg[i, j, k] / qg[i, j, k])})
            places.append(pd.DataFrame({
                "year": y, "group": g, "state": states,
                "as_origin": od.sum(1) / od.sum(), "as_destination": od.sum(0) / od.sum(),
            }))
    return pd.DataFrame(summary), pd.DataFrame(top), pd.concat(places)


def h5(aggs):
    roles = pd.read_csv(ROLES)
    rows, by_role = [], []
    for y in YEARS:
        odc = aggs[y].groupby(["o", "d", "SCTG"]).agg(usd=("usd", "sum"),
                                                      records=("records", "sum")).reset_index()
        oc = odc.groupby(["o", "SCTG"]).agg(usd=("usd", "sum"), records=("records", "sum"))
        dc = odc.groupby(["d", "SCTG"]).agg(usd=("usd", "sum"), records=("records", "sum"))
        oc["buyer_hhi"] = hhi(odc.usd, [odc.o, odc.SCTG])
        dc["supplier_hhi"] = hhi(odc.usd, [odc.d, odc.SCTG])
        oc, dc = oc[oc.records >= HHI_MIN_RECORDS], dc[dc.records >= HHI_MIN_RECORDS]

        def weighted(frame, col, level):
            w = frame.usd * frame[col]
            return w.groupby(level=level).sum() / frame.usd.groupby(level=level).sum()

        state = pd.DataFrame({
            "buyer_hhi": weighted(oc, "buyer_hhi", "o"),
            "supplier_hhi": weighted(dc, "supplier_hhi", "d"),
        })
        state = state.assign(asymmetry=state.buyer_hhi - state.supplier_hhi, year=y).join(
            roles[roles.year == y].set_index("state")[["role"]]
        )
        rows.append(state.rename_axis("state").reset_index())
        means = state.groupby("role")[["buyer_hhi", "supplier_hhi", "asymmetry"]].mean()
        by_role.append(means.assign(year=y, states=state.groupby("role").size()).reset_index())
    return pd.concat(rows), pd.concat(by_role)


def main():
    OUT.mkdir(exist_ok=True)
    aggs = {}
    for y in YEARS:
        aggs[y] = aggregate(y)
        print(y, int(aggs[y].records.sum()), flush=True)
    run(aggs)


def run(aggs):
    summary, modes, persistence, persistent_list, n_persistent = h3(aggs)
    summary.round(4).to_csv(OUT / "dependence_h3_links.csv", index=False)
    modes.to_csv(OUT / "dependence_h3_modes.csv", index=False)
    persistence.round(4).to_csv(OUT / "dependence_h3_persistence.csv", index=False)
    persistent_list.round(4).to_csv(OUT / "dependence_h3_persistent_links.csv", index=False)
    groups, top, places = h4(aggs)
    groups.round(5).to_csv(OUT / "dependence_h4_groups.csv", index=False)
    top.round(5).to_csv(OUT / "dependence_h4_top_cells.csv", index=False)
    places.round(5).to_csv(OUT / "dependence_h4_states.csv", index=False)
    states, by_role = h5(aggs)
    states.round(4).to_csv(OUT / "dependence_h5_states.csv", index=False)
    by_role.round(4).to_csv(OUT / "dependence_h5_roles.csv", index=False)
    (OUT / "dependence_summary.json").write_text(json.dumps({
        "persistent_links": n_persistent,
        "records": {y: int(aggs[y].records.sum()) for y in YEARS},
    }, indent=1))


if __name__ == "__main__":
    main()
