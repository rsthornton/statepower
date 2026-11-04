"""
Measures for a redesigned map, per year and commodity (SCTG two-digit), dollar-weighted:

national reliance  each origin's share of national interstate value of the commodity;
local reliance     each destination's top-supplier share and supplier HHI;
RA surprise        ln(observed / fitted) per origin x destination x commodity cell, where
                   the fit is the maximum-entropy table with the three pair margins
                   (OD:OC:DC by IPF, run_three_way.fit_pairs), which equals the Poisson
                   fit with origin-destination, origin-commodity and destination-commodity
                   fixed effects (run_equivalence.py). Reported for cells with at least
                   MIN_RECORDS shipment records; checked against the Poisson bootstrap draws
                   of run_bootstrap.py, refitted per draw.

Writes audit/output/map_*, surprise_* and map_data.json.
"""

import json

import numpy as np
import pandas as pd
from common import OUT, STATES, YEARS
from run_bootstrap import draws
from run_three_way import fit_pairs

MIN_RECORDS = 30
MAP_MIN_ABS_LOG = np.log(2)
TOP = 20
SURPRISE_DRAWS = 200


def reliance(t, records, sctg):
    nat = t.sum(axis=1)  # o x c
    nat_share = nat / nat.sum(axis=0, keepdims=True)
    inbound = t.sum(axis=0, keepdims=True)  # 1 x d x c
    share = np.divide(t, inbound, out=np.zeros_like(t), where=inbound > 0)
    top = share.argmax(axis=0)
    local = pd.DataFrame({
        "d": np.repeat(STATES, len(sctg)), "SCTG": np.tile(sctg, 51),
        "top_origin": [STATES[i] for i in top.ravel()],
        "top_share": share.max(axis=0).ravel(),
        "hhi": (share**2).sum(axis=0).ravel(),
        "suppliers": (t > 0).sum(axis=0).ravel(),
        "records": records.sum(axis=0).ravel(),
        "usd": inbound[0].ravel(),
    })
    national = pd.DataFrame({
        "o": np.repeat(STATES, len(sctg)), "SCTG": np.tile(sctg, 51),
        "share": nat_share.ravel(), "usd": nat.ravel(), "records": records.sum(axis=1).ravel(),
    })
    return national, local[local.usd > 0]


def log_ratio(t):
    p = t / t.sum()
    q = fit_pairs(p)
    out = np.full(p.shape, np.nan)
    m = (p > 0) & (q > 0)
    out[m] = np.log(p[m] / q[m])
    return out


def surprises(year):
    obs, records, boot, sctg = draws(year)
    n_c = len(sctg)
    shape = (51, 51, n_c)
    lr = log_ratio(obs.reshape(shape)).ravel()
    adequate = np.flatnonzero((records >= MIN_RECORDS) & np.isfinite(lr))
    b = np.array([log_ratio(boot[i].reshape(shape)).ravel()[adequate]
                  for i in range(SURPRISE_DRAWS)])
    o, rest = np.divmod(adequate, 51 * n_c)
    d, c = np.divmod(rest, n_c)
    cells = pd.DataFrame({
        "year": year, "o": [STATES[i] for i in o], "d": [STATES[i] for i in d],
        "SCTG": [sctg[i] for i in c], "records": records[adequate], "usd": obs[adequate],
        "log_ratio": lr[adequate],
        "boot_sd": b.std(axis=0), "boot_lo": np.quantile(b, 0.05, axis=0),
        "boot_hi": np.quantile(b, 0.95, axis=0),
    })
    rank = (-b).argsort(axis=1).argsort(axis=1)  # 0 = largest log ratio in the draw
    cells["boot_top20"] = (rank < TOP).mean(axis=0)
    cells["boot_top100"] = (rank < 100).mean(axis=0)
    return cells, sctg


def main():
    OUT.mkdir(exist_ok=True)
    nationals, locals_, cells = [], [], []
    for y in YEARS:
        obs, records, _, sctg = draws(y)
        shape = (51, 51, len(sctg))
        nat, loc = reliance(obs.reshape(shape), records.reshape(shape), sctg)
        nationals.append(nat.assign(year=y))
        locals_.append(loc.assign(year=y))
        cy, _ = surprises(y)
        cells.append(cy)
        print(y, len(cy), flush=True)
    national = pd.concat(nationals, ignore_index=True)
    local = pd.concat(locals_, ignore_index=True)
    cells = pd.concat(cells, ignore_index=True)

    top = (cells.sort_values("log_ratio", ascending=False).groupby("year").head(TOP)
           .sort_values(["year", "log_ratio"], ascending=[True, False]))
    bottom = (cells.sort_values("log_ratio").groupby("year").head(TOP))
    wide = cells.pivot_table(index=["o", "d", "SCTG"], columns="year", values="log_ratio")
    recw = cells.pivot_table(index=["o", "d", "SCTG"], columns="year", values="records")
    stability = []
    for a, b in [(2012, 2017), (2017, 2022), (2012, 2022)]:
        both = wide[[a, b]].dropna()
        for floor in [MIN_RECORDS, 100, 300]:
            m = (recw.loc[both.index, a] >= floor) & (recw.loc[both.index, b] >= floor)
            sub = both[m]
            stability.append({
                "years": f"{a}-{b}", "min_records_both": floor, "cells": len(sub),
                "pearson": float(sub[a].corr(sub[b])),
                "spearman": float(sub[a].rank().corr(sub[b].rank())),
                "sign_agreement": float((np.sign(sub[a]) == np.sign(sub[b])).mean()),
            })
    stability = pd.DataFrame(stability)
    top_sets = {y: set(zip(g.o, g.d, g.SCTG)) for y, g in top.groupby("year")}
    top_overlap = {f"{a}-{b}": len(top_sets[a] & top_sets[b])
                   for a, b in [(2012, 2017), (2017, 2022), (2012, 2022)]}
    # do top surprises recur? log ratio of each year's top 20 in the other years
    recur = top[["year", "o", "d", "SCTG", "log_ratio"]].merge(
        cells[["year", "o", "d", "SCTG", "log_ratio"]].rename(
            columns={"year": "other_year", "log_ratio": "other_log_ratio"}),
        on=["o", "d", "SCTG"])
    recur = recur[recur.year != recur.other_year]

    noise = cells.groupby("year").apply(lambda g: pd.Series({
        "cells": len(g),
        "median_boot_sd": g.boot_sd.median(),
        "share_abs_lr_over_2sd": (g.log_ratio.abs() > 2 * g.boot_sd).mean(),
        "share_ci_excludes_zero": ((g.boot_lo > 0) | (g.boot_hi < 0)).mean(),
    }), include_groups=False)
    top_check = top.groupby("year").apply(lambda g: pd.Series({
        "top20_min_lower_bound": g.boot_lo.min(),
        "top20_lower_bound_over_1": int((g.boot_lo > 1).sum()),
        "top20_median_freq_in_boot_top20": g.boot_top20.median(),
        "top20_median_freq_in_boot_top100": g.boot_top100.median(),
        "top20_median_records": g.records.median(),
    }), include_groups=False)

    national.round(5).to_csv(OUT / "map_national_reliance.csv", index=False)
    local.round(4).to_csv(OUT / "map_local_reliance.csv", index=False)
    cells.round(3).to_csv(OUT / "surprise_cells.csv.gz", index=False)
    top.round(3).to_csv(OUT / "surprise_top20.csv", index=False)
    bottom.round(3).to_csv(OUT / "surprise_bottom20.csv", index=False)
    stability.round(4).to_csv(OUT / "surprise_stability.csv", index=False)
    recur.round(3).to_csv(OUT / "surprise_top20_recurrence.csv", index=False)
    (OUT / "surprise_summary.json").write_text(json.dumps({
        "min_records": MIN_RECORDS, "draws": SURPRISE_DRAWS,
        "noise": noise.round(4).to_dict(orient="index"),
        "top20_check": top_check.round(4).to_dict(orient="index"),
        "top20_overlap": top_overlap,
        "top20_recurring_in_other_years": int(len(recur)),
    }, indent=1, default=str))
    write_map(national, local, cells)


def write_map(national, local, cells):
    gaps = pd.read_csv(OUT / "variants_links.csv", dtype={"SCTG": str})
    data = {
        "meta": {
            "unit": "dollars (WGT_FACTOR x SHIPMT_VALUE), interstate only, CFS 2012/2017/2022",
            "national": "origin -> share of national interstate value of the commodity (>= 0.001)",
            "local": "destination -> [top origin, top-supplier share, supplier HHI, records]",
            "gaps": "majority links: [d, o, share, r_mi, nearest_k1_mi (A distances), gap_k1_mi, "
                    "gap_k1_centroid_mi, ratio_k1_centroid, adjacent, persistent]; null = no "
                    "origin ships at least v",
            "surprise": "[o, d, ln(observed/OD:OC:DC fit), bootstrap 5%, 95%, records]; cells "
                        f"with >= {MIN_RECORDS} records and |ln| >= ln 2",
        },
        "years": {},
    }
    for y in YEARS:
        yd = {"national": {}, "local": {}, "gaps": {}, "surprise": {}}
        for c, g in national[(national.year == y) & (national.share >= 0.001)].groupby("SCTG"):
            yd["national"][c] = dict(zip(g.o, g.share.round(4)))
        for c, g in local[local.year == y].groupby("SCTG"):
            yd["local"][c] = {d: [o, round(s, 3), round(h, 3), int(r)] for d, o, s, h, r in
                              zip(g.d, g.top_origin, g.top_share, g.hhi, g.records)}
        for c, g in gaps[gaps.year == y].groupby("SCTG"):
            yd["gaps"][c] = [
                [r.d, r.o, round(r.share, 3), round(r.r), nz(r.near_A_k1), nz(r.gap_A_k1),
                 nz(r.gap_centroid_k1), nz(r.ratio_centroid_k1, 2), bool(r.adjacent),
                 r.persistence == "persistent"]
                for r in g.itertuples()]
        sel = cells[(cells.year == y) & (cells.log_ratio.abs() >= MAP_MIN_ABS_LOG)]
        for c, g in sel.groupby("SCTG"):
            yd["surprise"][c] = [[r.o, r.d, round(r.log_ratio, 2), round(r.boot_lo, 2),
                                  round(r.boot_hi, 2), int(r.records)] for r in g.itertuples()]
        data["years"][str(y)] = yd
    path = OUT / "map_data.json"
    path.write_text(json.dumps(data, separators=(",", ":")))
    print("map_data.json bytes", path.stat().st_size)


def nz(x, nd=0):
    return None if pd.isna(x) else round(float(x), nd) if nd else int(round(float(x)))


if __name__ == "__main__":
    main()
