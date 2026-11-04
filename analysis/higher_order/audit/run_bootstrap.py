"""
Sampling-only churn of majority links, by a Poisson bootstrap over shipment records.

Each draw gives every record a Poisson(1) multiplier on its weighted value
(WGT_FACTOR x SHIPMT_VALUE), so heavy records stay heavy. Two draws from one year
are two surveys of an unchanged economy; links that differ between them differ
by sampling alone. Records are treated as independent: the survey's clustering
by establishment and its strata are ignored, so this understates sampling noise.

Writes the draws to .cache/boot_{year}.npz (reused by run_map.py) and
audit/output/bootstrap_churn_*.
"""

import json

import numpy as np
import pandas as pd
from common import CACHE, OUT, STATES, YEARS, codes

DRAWS = 200
SOLE = 0.5
BINS = [0, 5, 10, 30, 100, 300, np.inf]
BIN_LABELS = ["1-4", "5-9", "10-29", "30-99", "100-299", "300+"]


def draws(year):
    path = CACHE / f"boot_{year}.npz"
    if path.exists():
        z = np.load(path)
        return z["obs"], z["records"], z["boot"], list(z["sctg"])
    cell, usd, sctg = codes(year)
    size = 51 * 51 * len(sctg)
    obs = np.bincount(cell, weights=usd, minlength=size)
    records = np.bincount(cell, minlength=size)
    rng = np.random.default_rng(year)
    boot = np.empty((DRAWS, size))
    for b in range(DRAWS):
        boot[b] = np.bincount(cell, weights=usd * rng.poisson(1.0, len(usd)), minlength=size)
    np.savez(path, obs=obs, records=records, boot=boot, sctg=np.array(sctg))
    return obs, records, boot, sctg


def majority(t, n_c):
    """Boolean (…, o, d, c): origin o sends more than half of d's inbound value of c."""
    t = t.reshape(*t.shape[:-1], 51, 51, n_c)
    inbound = t.sum(axis=-3, keepdims=True)
    share = np.divide(t, inbound, out=np.zeros_like(t), where=inbound > 0)
    return (share > SOLE).reshape(*t.shape[:-3], -1)


def main():
    OUT.mkdir(exist_ok=True)
    links_by_year, rec_by_year, rows, link_rows = {}, {}, [], []
    for y in YEARS:
        obs, records, boot, sctg = draws(y)
        n_c = len(sctg)
        observed = majority(obs, n_c)
        b = majority(boot, n_c)
        rec_bin = pd.cut(records, BINS, right=False, labels=BIN_LABELS)
        # draw-vs-draw: links in draw i that are links in draw i+1 (and i+2)
        retain2, retain3, base = (np.zeros(len(BIN_LABELS)) for _ in range(3))
        for i in range(DRAWS - 2):
            a, nxt, nxt2 = b[i], b[i + 1], b[i + 2]
            for j, lab in enumerate(BIN_LABELS):
                m = a & (rec_bin == lab)
                base[j] += m.sum()
                retain2[j] += (m & nxt).sum()
                retain3[j] += (m & nxt & nxt2).sum()
        # reproduction of each observed link
        repro = b[:, observed].mean(axis=0)
        idx = np.flatnonzero(observed)
        o, rest = np.divmod(idx, 51 * n_c)
        d, c = np.divmod(rest, n_c)
        link_rows.append(pd.DataFrame({
            "year": y, "o": [STATES[i] for i in o], "d": [STATES[i] for i in d],
            "SCTG": [sctg[i] for i in c], "records": records[idx], "reproduced": repro,
        }))
        for j, lab in enumerate(BIN_LABELS):
            rows.append({"year": y, "records_bin": lab,
                         "draw_links": base[j] / (DRAWS - 2),
                         "retained_next_draw": retain2[j] / base[j] if base[j] else np.nan,
                         "retained_two_draws": retain3[j] / base[j] if base[j] else np.nan})
        tot = {"year": y, "records_bin": "all", "draw_links": base.sum() / (DRAWS - 2),
               "retained_next_draw": retain2.sum() / base.sum(),
               "retained_two_draws": retain3.sum() / base.sum()}
        rows.append(tot)
        links_by_year[y] = observed
        rec_by_year[y] = records
        print(y, int(observed.sum()), round(tot["retained_next_draw"], 3), flush=True)
    sampling = pd.DataFrame(rows)

    # observed cross-year retention by the link's record bin in the earlier year,
    # matched on (o, d, SCTG) labels
    obs_rows = []
    linkdf = pd.concat(link_rows, ignore_index=True)
    keyset = {y: set(zip(g.o, g.d, g.SCTG)) for y, g in linkdf.groupby("year")}
    linkdf["bin"] = pd.cut(linkdf.records, BINS, right=False, labels=BIN_LABELS)
    for a, bb in [(2012, 2017), (2017, 2022), (2012, 2022)]:
        part = linkdf[linkdf.year == a]
        kept = np.array([k in keyset[bb] for k in zip(part.o, part.d, part.SCTG)])
        for lab in BIN_LABELS + ["all"]:
            m = np.ones(len(part), bool) if lab == "all" else (part.bin == lab).to_numpy()
            obs_rows.append({"from": a, "to": bb, "records_bin": lab, "links": int(m.sum()),
                             "retained": float(kept[m].mean()) if m.any() else np.nan})
    for y in YEARS:
        part = linkdf[linkdf.year == y]
        others = [z for z in YEARS if z != y]
        kept = np.array([all(k in keyset[z] for z in others)
                         for k in zip(part.o, part.d, part.SCTG)])
        for lab in BIN_LABELS + ["all"]:
            m = np.ones(len(part), bool) if lab == "all" else (part.bin == lab).to_numpy()
            obs_rows.append({"from": y, "to": "all three", "records_bin": lab,
                             "links": int(m.sum()),
                             "retained": float(kept[m].mean()) if m.any() else np.nan})
    observed = pd.DataFrame(obs_rows)
    sampling.round(4).to_csv(OUT / "bootstrap_churn_sampling.csv", index=False)
    observed.round(4).to_csv(OUT / "bootstrap_churn_observed.csv", index=False)
    linkdf.drop(columns="bin").round(3).to_csv(OUT / "bootstrap_link_reproduction.csv",
                                               index=False)
    (OUT / "bootstrap_churn_summary.json").write_text(json.dumps({
        "draws": DRAWS,
        "links": {y: int(v.sum()) for y, v in links_by_year.items()},
        "mean_reproduction": linkdf.groupby("year").reproduced.mean().round(4).to_dict(),
    }, indent=1))


if __name__ == "__main__":
    main()
