"""
Site data (web/public/data/v2/) and researcher downloads (web/public/downloads/) for the
Commodity Flow Survey years 2012, 2017 and 2022.

Two series, documented in downloads/README.md:

Network series. The registered evolution study's year bundles (evolution/cache, read only):
interstate shipments of every commodity except crude petroleum (SCTG 16), so the three years
are comparable. Per year: each state's three centralities (bridge position = betweenness on
inverted weights, trade prestige = in-flow eigenvector, export reach = weighted out-degree),
ranks, GDP rank and the gap between them, and every state-to-state edge (no cap).

Commodity series. The 40 two-digit SCTG codes kept by the higher-order loaders
(analysis/higher_order/run_three_way.load_shipments: drops unknown, live animals, crude
petroleum, other and grouped codes). Per commodity and year: every origin-destination pair
with at least one record (dollars, record count, median shipment miles, distance gap to the
nearest other state shipping as much), supply and inbound totals, local reliance, the audit's
majority links and route-level surprise cells that pass the floor. This is the 3-D map's data
(ported from an earlier 3-D map prototype's extract script).

Dollars are WGT_FACTOR x SHIPMT_VALUE throughout. Raw survey files are read through the paths
in evolution/configs and never written.

Run with the project venv:
    .venv/bin/python scripts/export_site_data.py --evolution-cache /path/to/evolution/cache
"""

import argparse
import csv
import hashlib
import json
import pickle
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
HOI = ROOT / "analysis" / "higher_order"
sys.path.insert(0, str(HOI))

from run_replaceability import CENTROIDS, centroid_miles  # noqa: E402
from run_three_way import (  # noqa: E402
    DROP_SCTG,
    FIPS,
    YEARS,
    fit_pairs,
    load_shipments,
    source_file,
)

SITE = ROOT / "web" / "public" / "data" / "v2"
DOWNLOADS = ROOT / "web" / "public" / "downloads"
CACHE = ROOT / ".cache" / "site_data"
AUDIT = HOI / "audit" / "output"
META = ROOT / "web" / "public" / "data" / "metadata.json"
REPORT = ROOT / "evolution" / "results" / "evolution_20260808_093628" / "results.json"
GDP = {
    2012: ROOT / "evolution/data/state_gdp_2012.csv",
    2017: ROOT / "data/state_gdp_2017.csv",
    2022: ROOT / "evolution/data/state_gdp_2022.csv",
}
STATES = sorted(FIPS.values())
SI = {s: i for i, s in enumerate(STATES)}
FIPS_OF = {v: k for k, v in FIPS.items()}
THIN = 10
SURPRISE_FLOOR = 300
LN2 = float(np.log(2))
AUDIT_QUOTES = {
    "bootKept": "68 to 73%",
    "observedKept": "19 to 26%",
    "samplingChurn": "40 to 47%",
    "ratioSpearman": "0.73 to 0.87",
    "noneAdjacent": "88 to 97%",
    "noneMedianR": "71 to 100 miles against 400 to 448",
    "definitionFlip": "148 or 159 of 296",
    "surpriseCorr30": "0.26 to 0.37",
    "surpriseCorr300": "0.46 to 0.53",
    "surpriseSd": "0.29 to 0.32",
    "adjacentBase": "50 to 57%",
}
NAMES = dict(
    AL="Alabama",
    AK="Alaska",
    AZ="Arizona",
    AR="Arkansas",
    CA="California",
    CO="Colorado",
    CT="Connecticut",
    DE="Delaware",
    DC="District of Columbia",
    FL="Florida",
    GA="Georgia",
    HI="Hawaii",
    ID="Idaho",
    IL="Illinois",
    IN="Indiana",
    IA="Iowa",
    KS="Kansas",
    KY="Kentucky",
    LA="Louisiana",
    ME="Maine",
    MD="Maryland",
    MA="Massachusetts",
    MI="Michigan",
    MN="Minnesota",
    MS="Mississippi",
    MO="Missouri",
    MT="Montana",
    NE="Nebraska",
    NV="Nevada",
    NH="New Hampshire",
    NJ="New Jersey",
    NM="New Mexico",
    NY="New York",
    NC="North Carolina",
    ND="North Dakota",
    OH="Ohio",
    OK="Oklahoma",
    OR="Oregon",
    PA="Pennsylvania",
    RI="Rhode Island",
    SC="South Carolina",
    SD="South Dakota",
    TN="Tennessee",
    TX="Texas",
    UT="Utah",
    VT="Vermont",
    VA="Virginia",
    WA="Washington",
    WV="West Virginia",
    WI="Wisconsin",
    WY="Wyoming",
)
MEASURES = ["betweenness", "eigenvector", "out_degree"]


def k(usd):
    """Dollars to thousands at four significant figures."""
    v = float(f"{usd / 1e3:.4g}")
    return int(v) if v >= 1000 else v


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), default=str))


# Network series ---------------------------------------------------------------------------


def network(year, cache_dir):
    with open(cache_dir / f"cfs_{year}_full.pkl", "rb") as f:
        bundle = pickle.load(f)
    c = bundle["centralities"].set_index("label").reindex(STATES)
    gdp = pd.read_csv(GDP[year]).set_index("state_abbrev").reindex(STATES)
    gdp_b = gdp[f"gdp_{year}_q4_millions"] / 1e3
    gdp_rank = gdp_b.rank(ascending=False, method="min").astype(int)
    ranks = {m: c[m].rank(ascending=False, method="min").astype(int) for m in MEASURES}
    rows = []
    for s in STATES:
        rows.append(
            {
                "state": s,
                "name": NAMES[s],
                "fips": FIPS_OF[s],
                **{m: round(float(c.at[s, m]), 6) for m in MEASURES},
                **{f"rank_{m}": int(ranks[m][s]) for m in MEASURES},
                "no_brokerage": bool(c.at[s, "betweenness"] == 0),
                "gdp_billions": round(float(gdp_b[s]), 3),
                "gdp_rank": int(gdp_rank[s]),
                "gap_eigenvector": int(gdp_rank[s] - ranks["eigenvector"][s]),
            }
        )
    e = bundle["edges"]
    fips2 = {int(k_): v for k_, v in FIPS.items()}
    edges = sorted(
        (
            [fips2[int(o)], fips2[int(d)], float(v)]
            for o, d, v in zip(e.ORIG_STATE, e.DEST_STATE, e.SHIPMT_VALUE)
        ),
        key=lambda r: -r[2],
    )
    st = bundle["stats"]
    stats = {
        key: st[key]
        for key in (
            "raw_records",
            "interstate_records",
            "interstate_weighted_total",
            "edge_count",
            "sctg16_records_dropped",
        )
    }
    return rows, edges, stats


# Commodity series (the 3-D map's data, without RA) ---------------------------------------


def records(year):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"records_{year}.npz"
    if not path.exists():
        df = load_shipments(source_file(year), extra=["SHIPMT_DIST_GC"])
        sctg = sorted(df.SCTG.unique())
        np.savez(
            path,
            o=df.o.map(SI).to_numpy(np.int8),
            d=df.d.map(SI).to_numpy(np.int8),
            c=df.SCTG.map(sctg.index).to_numpy(np.int8),
            usd=df.usd.to_numpy(np.float64),
            miles=df.SHIPMT_DIST_GC.to_numpy(np.float64),
            sctg=np.array(sctg),
        )
    z = np.load(path)
    return z["o"], z["d"], z["c"], z["usd"], z["miles"], list(z["sctg"])


def cells(year):
    o, d, c, usd, miles, sctg = records(year)
    df = pd.DataFrame({"o": o, "d": d, "c": c, "usd": usd, "miles": miles})
    g = (
        df.groupby(["o", "d", "c"])
        .agg(usd=("usd", "sum"), records=("usd", "size"), miles=("miles", "median"))
        .reset_index()
    )
    return g, sctg, len(df)


def within_state(year):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"within_{year}.csv"
    if not path.exists():
        cols = ["ORIG_STATE", "DEST_STATE", "SCTG", "SHIPMT_VALUE", "WGT_FACTOR"]
        df = pd.read_csv(
            source_file(year),
            usecols=cols,
            dtype={"ORIG_STATE": str, "DEST_STATE": str, "SCTG": str},
        )
        df = df[~df.SCTG.str.contains("-") & ~df.SCTG.isin(DROP_SCTG)]
        df = df[df.ORIG_STATE.isin(FIPS) & (df.ORIG_STATE == df.DEST_STATE)]
        df = df.assign(s=df.ORIG_STATE.map(FIPS), usd=df.WGT_FACTOR * df.SHIPMT_VALUE)
        df.groupby(["s", "SCTG"]).usd.agg(["sum", "size"]).reset_index().to_csv(path, index=False)
    return pd.read_csv(path, dtype={"SCTG": str})


def centroid_matrix():
    return np.array([[centroid_miles(a, b) if a != b else 0.0 for b in STATES] for a in STATES])


def gap_columns(g, cent):
    """Nearest other origin (not o, not d) whose total shipments of the commodity are at least
    the pair's value, by centroid distance to d; its miles; ratio to the pair's own distance."""
    supply = g.groupby(["o", "c"]).usd.sum()
    near_state = np.full(len(g), -1)
    near_mi = np.full(len(g), np.nan)
    states = np.arange(51)
    for c, sub in g.groupby("c"):
        sup = np.zeros(51)
        s = supply.xs(c, level="c")
        sup[s.index.to_numpy()] = s.to_numpy()
        o, d, v = sub.o.to_numpy(), sub.d.to_numpy(), sub.usd.to_numpy()
        ok = (
            (sup[None, :] >= v[:, None])
            & (states[None, :] != o[:, None])
            & (states[None, :] != d[:, None])
        )
        dist = np.where(ok, cent[:, d].T, np.inf)
        a = dist.argmin(axis=1)
        found = np.isfinite(dist[np.arange(len(a)), a])
        pos = sub.index.to_numpy()
        near_state[pos[found]] = a[found]
        near_mi[pos[found]] = dist[np.arange(len(a)), a][found]
    own = cent[g.o.to_numpy(), g.d.to_numpy()]
    return near_state, near_mi, near_mi / np.clip(own, 1, None)


def three_way(g, n_c):
    t = np.zeros((51, 51, n_c))
    t[g.o, g.d, g.c] = g.usd
    p = t / t.sum()
    q = fit_pairs(p)
    m = (p > 0) & (q > 0)
    terms = np.zeros_like(p)
    terms[m] = p[m] * np.log2(p[m] / q[m])
    return terms


def surprise_table():
    s = pd.read_csv(AUDIT / "surprise_cells.csv.gz", dtype={"SCTG": str})
    big = s[s.log_ratio.abs() >= LN2]
    sign = big.assign(sg=np.sign(big.log_ratio))[["year", "o", "d", "SCTG", "sg"]]
    other = sign.merge(sign, on=["o", "d", "SCTG", "sg"])
    recur = (
        other[other.year_x != other.year_y]
        .groupby(["year_x", "o", "d", "SCTG"])
        .year_y.apply(lambda y: sorted(set(y)))
    )
    big = big.set_index(["year", "o", "d", "SCTG"])
    big["recur"] = recur.reindex(big.index).apply(lambda v: v if isinstance(v, list) else [])
    big = big.reset_index()
    big["passes"] = (big.records >= SURPRISE_FLOOR) | (big.recur.str.len() > 0)
    return s, big


def commodity_series(names):
    cent = centroid_matrix()
    mapdata = json.loads((AUDIT / "map_data.json").read_text())["years"]
    surprise_all, surprise = surprise_table()
    per, summary, flat = {}, {}, {}
    for y in YEARS:
        g, sctg, n_records = cells(y)
        ns, nm, ratio = gap_columns(g, cent)
        g = g.assign(near=ns, near_mi=nm, ratio=ratio)
        terms = three_way(g, len(sctg))
        tw_total = float(terms.sum())
        summary[y] = {
            "records": n_records,
            "usd": float(g.usd.sum()),
            "three_way_bits": tw_total,
            "commodities": len(sctg),
        }
        flat[y] = g.assign(sctg=[sctg[i] for i in g.c])
        md = mapdata[str(y)]
        for ci, c in enumerate(sctg):
            sub = g[g.c == ci].sort_values("usd", ascending=False)
            supply = np.zeros(51)
            inbound = np.zeros(51)
            np.add.at(supply, sub.o.to_numpy(), sub.usd.to_numpy())
            np.add.at(inbound, sub.d.to_numpy(), sub.usd.to_numpy())
            local = {}
            for d, dd in sub.groupby("d"):
                share = dd.usd / inbound[d]
                top = dd.loc[share.idxmax()]
                local[STATES[d]] = [
                    STATES[int(top.o)],
                    round(float(share.max()), 3),
                    round(float((share**2).sum()), 3),
                    int(len(dd)),
                    int(dd.records.sum()),
                ]
            flows = [
                [
                    int(r.o),
                    int(r.d),
                    k(r.usd),
                    int(r.records),
                    round(r.miles),
                    None if np.isnan(r.ratio) else round(r.ratio, 3),
                ]
                for r in sub.itertuples()
            ]
            sp = surprise[(surprise.year == y) & (surprise.SCTG == c) & surprise.passes]
            surprise_rows = [
                [
                    SI[r.o],
                    SI[r.d],
                    round(r.log_ratio, 3),
                    round(r.boot_lo, 2),
                    round(r.boot_hi, 2),
                    int(r.records),
                    r.recur,
                ]
                for r in sp.sort_values("log_ratio", ascending=False).itertuples()
            ]
            links = [[SI[x[0]], SI[x[1]], *x[2:]] for x in md["gaps"].get(c, [])]
            per.setdefault(c, {"sctg": c, "name": names[c], "years": {}})["years"][str(y)] = {
                "usd": round(float(sub.usd.sum()) / 1e3),
                "records": int(sub.records.sum()),
                "threeWayShare": round(float(terms[:, :, ci].sum()) / tw_total, 4),
                "supply": [k(v) for v in supply],
                "inbound": [k(v) for v in inbound],
                "local": local,
                "flows": flows,
                "links": links,
                "surprise": surprise_rows,
                "surpriseTested": int(((surprise_all.year == y) & (surprise_all.SCTG == c)).sum()),
            }
    return per, summary, flat, cent


def balance(names):
    out = {}
    for y in YEARS:
        g, sctg, _ = cells(y)
        w = within_state(y)
        yd = {}
        for ci, c in enumerate(sctg):
            sub = g[g.c == ci]
            inb = sub.groupby("d").agg(usd=("usd", "sum"), rec=("records", "sum"))
            outb = sub.groupby("o").agg(usd=("usd", "sum"), rec=("records", "sum"))
            ws = w[w.SCTG == c].set_index("s")
            rows = []
            for x, st in enumerate(STATES):
                into = sub[sub.d == x].sort_values("usd", ascending=False)
                from_ = sub[sub.o == x].sort_values("usd", ascending=False)
                i_usd = float(inb.usd.get(x, 0.0))
                o_usd = float(outb.usd.get(x, 0.0))
                top_in = (
                    [[int(r.o), round(r.usd / i_usd, 4)] for r in into.head(6).itertuples()]
                    if i_usd > 0
                    else []
                )
                top_out = (
                    [[int(r.d), round(r.usd / o_usd, 4)] for r in from_.head(6).itertuples()]
                    if o_usd > 0
                    else []
                )
                rows.append(
                    [
                        k(i_usd),
                        int(inb.rec.get(x, 0)),
                        k(o_usd),
                        int(outb.rec.get(x, 0)),
                        k(float(ws["sum"].get(st, 0.0))),
                        int(ws["size"].get(st, 0)),
                        top_in,
                        top_out,
                    ]
                )
            yd[c] = rows
        out[y] = {"sctgs": sctg, "names": {c: names[c] for c in sctg}, "rows": yd}
    return out


# Downloads ---------------------------------------------------------------------------------


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


READING = {
    "O:D:C": "size alone",
    "DC:O": "what each state receives, by commodity",
    "OC:D": "what each state ships, by commodity",
    "OD:C": "who trades with whom",
    "OC:DC": "both commodity mixes, no partners",
    "OD:DC": "partners and receiving mixes",
    "OD:OC": "partners and shipping mixes",
    "OD:OC:DC": "every pair",
    "OD:OC:DC+distance": "every pair, commodity-specific distance",
    "ODC": "the data",
}


def ra_year(y):
    """The lattice and each state's part of what pairs miss (higher_order/run_lattice.py)."""
    lat = pd.read_csv(HOI / "output" / f"lattice_{y}.csv")
    st = pd.read_csv(HOI / "output" / f"lattice_states_{y}.csv", index_col=0).loc[STATES]
    cells = pd.read_csv(HOI / "output" / f"lattice_cells_{y}.csv", dtype={"sctg": str})
    r4 = lambda v: round(float(v), 4)  # noqa: E731

    def side(name, tag=""):
        col = f"carry_{name}{tag}"
        return {
            "carry": [r4(v) for v in st[col]],
            "low": [r4(v) for v in st[f"{col}_low"]],
            "high": [r4(v) for v in st[f"{col}_high"]],
            "netOfSize": [r4(v) for v in st[f"{col}_net_of_size"]],
            # slope of log ratio on log size share across states (net_of_size is the residual)
            "sizeSlope": r4(np.polyfit(np.log(st[f"share_{name}"]), np.log(st[col]), 1)[0]),
        }

    top = {}
    for r in cells.itertuples():
        top.setdefault(r.state, {"shipping": [], "receiving": []})[r.side].append(
            [SI[r.partner], r.sctg, int(round(r.records)), round(float(r.expected), 1)]
        )
    return {
        "year": y,
        "postHoc": True,
        "ladder": [
            {
                "structure": r.structure,
                "reading": READING[r.structure],
                "captured": r4(r.captured_net),
                "low": r4(r.captured_net_low),
                "high": r4(r.captured_net_high),
                "raw": r4(r.captured),
                "dollars": r4(r.dollars_captured),
            }
            for r in lat.itertuples()
        ],
        "shipping": side("shipping"),
        "receiving": side("receiving"),
        "shippingAfterDistance": side("shipping", "_after_distance"),
        "receivingAfterDistance": side("receiving", "_after_distance"),
        "share": {
            "shipping": [round(float(v), 6) for v in st.share_shipping],
            "receiving": [round(float(v), 6) for v in st.share_receiving],
        },
        "cells": {s: top[s] for s in STATES if s in top},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--evolution-cache", type=Path, default=ROOT / "evolution" / "cache")
    ap.add_argument("--network-only", action="store_true")
    ap.add_argument("--ra-only", action="store_true", help="write only data/v2/ra/")
    args = ap.parse_args()
    for y in YEARS:
        write_json(SITE / "ra" / f"{y}.json", ra_year(y))
    if args.ra_only:
        return
    if not (args.evolution_cache / "cfs_2017_full.pkl").exists():
        sys.exit(f"evolution cache not found at {args.evolution_cache}; pass --evolution-cache")
    names = json.loads(META.read_text())["sctg_names"]
    commit = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True
    ).stdout.strip()

    network_stats = {}
    for y in YEARS:
        rows, edges, stats = network(y, args.evolution_cache)
        network_stats[y] = stats
        write_json(
            SITE / "network" / f"{y}.json",
            {"year": y, "states": rows, "edges": edges, "stats": stats},
        )
        write_csv(
            DOWNLOADS / str(y) / f"states_{y}.csv",
            list(rows[0].keys()),
            [list(r.values()) for r in rows],
        )
        write_csv(
            DOWNLOADS / str(y) / f"edges_{y}.csv",
            ["origin", "destination", "usd"],
            [[o, d, round(v, 2)] for o, d, v in edges],
        )

    meta = {
        "generated": date.today().isoformat(),
        "commit": commit,
        "years": YEARS,
        "states": STATES,
        "names": [NAMES[s] for s in STATES],
        "fips": [FIPS_OF[s] for s in STATES],
        "network": {str(y): network_stats[y] for y in YEARS},
    }

    if not args.network_only:
        per, summary, flat, cent = commodity_series(names)
        for c, body in per.items():
            write_json(SITE / "commodity" / f"{c}.json", body)
        for y, b in balance(names).items():
            write_json(SITE / "balance" / f"{y}.json", b)
        for y in YEARS:
            g = flat[y].sort_values(["sctg", "usd"], ascending=[True, False])
            write_csv(
                DOWNLOADS / str(y) / f"commodity_flows_{y}.csv",
                ["origin", "destination", "sctg", "usd", "records", "median_miles"],
                [
                    [
                        STATES[r.o],
                        STATES[r.d],
                        r.sctg,
                        round(r.usd, 2),
                        int(r.records),
                        round(r.miles),
                    ]
                    for r in g.itertuples()
                ],
            )
        adj = pd.read_csv(AUDIT / "state_adjacency.csv")
        tw = json.loads((HOI / "output" / "three_way_summary.json").read_text())
        eq = json.loads((HOI / "output" / "equivalence_summary.json").read_text())
        meta |= {
            "centroids": [list(CENTROIDS[s]) for s in STATES],
            "centroidMiles": [[round(v) for v in row] for row in cent],
            "adjacent": [[SI[a], SI[b]] for a, b in zip(adj.a, adj.b)],
            "commodities": [
                [
                    c,
                    names[c],
                    {
                        str(y): [
                            per[c]["years"][str(y)]["usd"],
                            len(per[c]["years"][str(y)]["links"]),
                            len(per[c]["years"][str(y)]["surprise"]),
                        ]
                        for y in YEARS
                    },
                ]
                for c in sorted(per)
            ],
            "commoditySeries": {str(y): summary[y] for y in YEARS},
            "threeWay": {
                str(y): tw[str(y)]["records"] | {"dollars": tw[str(y)]["dollars"]} for y in YEARS
            },
            "equivalence": eq,
            "bootstrap": json.loads((AUDIT / "bootstrap_churn_summary.json").read_text()),
            "surpriseSummary": json.loads((AUDIT / "surprise_summary.json").read_text()),
            "surpriseStability": pd.read_csv(AUDIT / "surprise_stability.csv")
            .round(3)
            .to_dict(orient="records"),
            "auditQuotes": AUDIT_QUOTES,
            "rankStability": pd.read_csv(AUDIT / "variants_rank_stability.csv")
            .query("measure == 'ratio_centroid_k1'")
            .round(3)
            .to_dict(orient="records"),
            "thin": THIN,
            "surpriseFloor": SURPRISE_FLOOR,
        }
    write_json(SITE / "meta.json", meta)

    report = json.loads(REPORT.read_text())
    thresholds = ROOT / "evolution" / "thresholds.yaml"
    if sha256(thresholds) != report["thresholds_sha256"]:
        sys.exit(
            "evolution/thresholds.yaml no longer matches the hash recorded in the registered report"
        )
    commit_line = subprocess.run(
        ["git", "log", "-1", "--format=%h %ad", "--date=short", "--", "evolution/thresholds.yaml"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    ).stdout.split()
    write_json(
        SITE / "registered.json",
        {
            "report": REPORT.parent.name,
            "thresholds_commit": commit_line[0],
            "thresholds_commit_date": commit_line[1],
            "run": "2026-08-08",
            "thresholds_sha256": report["thresholds_sha256"],
            "verdicts": report["verdicts"],
            "pairs": [
                {
                    "pair": pr["pair"],
                    "base_year": pr["base_year"],
                    "target_year": pr["target_year"],
                    "H1": pr["H1"],
                }
                for pr in report["pairs"]
            ],
        },
    )

    thesis = DOWNLOADS / "thesis_2017"
    thesis.mkdir(parents=True, exist_ok=True)
    for src in [
        "data/bilateral_flows_51x51.csv",
        "data/bilateral_flows_52x52.csv",
        "results/51x51_domestic/centralities_51x51_domestic.csv",
        "results/52x52_international/centralities_52x52_intl.csv",
    ]:
        shutil.copy2(ROOT / src, thesis / Path(src).name)

    files = sorted(p for p in DOWNLOADS.rglob("*.csv") if p.is_file())
    (DOWNLOADS / "SHA256SUMS.txt").write_text(
        "".join(f"{sha256(p)}  {p.relative_to(DOWNLOADS)}\n" for p in files)
    )
    manifest = []
    for p in files:
        with open(p, newline="") as f:
            reader = csv.reader(f)
            columns = next(reader)
            rows = sum(1 for _ in reader)
        rel = str(p.relative_to(DOWNLOADS))
        manifest.append(
            {
                "path": rel,
                "group": rel.split("/")[0],
                "bytes": p.stat().st_size,
                "rows": rows,
                "columns": columns,
                "sha256": sha256(p),
            }
        )
    write_json(
        DOWNLOADS / "manifest.json", {"generated": date.today().isoformat(), "files": manifest}
    )
    print("network", {y: s["edge_count"] for y, s in network_stats.items()})
    if not args.network_only:
        print("commodities", len(per), {y: summary[y]["records"] for y in YEARS})


if __name__ == "__main__":
    main()
