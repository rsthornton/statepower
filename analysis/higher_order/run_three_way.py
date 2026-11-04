"""
Post-hoc exploratory study (NOT pre-registered): higher-order dependence in
interstate commodity flows, origin state x destination state x commodity.

For each survey year: total dependence (total correlation), O-information,
the three-way part (what the OD:OC:DC model misses), a sampling null, the
same after a commodity-specific distance term, and each origin state's
share of the three-way part. See README.md.

Reads the raw survey files named in evolution/configs read-only; writes to
output/ here.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from ra import (  # noqa: F401 (kl and entropy are imported from here by the other scripts)
    cell_terms,
    entropy,
    fit,
    kl,
)
from scipy.stats import spearmanr

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = HERE / "output"
ROLES = ROOT / "analysis" / "state_roles" / "output" / "state_roles.csv"
YEARS = [2012, 2017, 2022]

FIPS = dict(
    zip(
        "01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 "
        "27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 "
        "53 54 55 56".split(),
        "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV "
        "NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(),
    )
)
# unknown, live animals (not coded separately in 2022),
# crude petroleum (out of scope in 2022), other
DROP_SCTG = {"00", "01", "16", "99"}
# great-circle miles; each state pair takes the band of its median shipment distance
BANDS = [0, 250, 500, 750, 1000, 1500, 2000, np.inf]
NULL_DRAWS = 2


def source_file(year):
    config = yaml.safe_load((ROOT / "evolution" / "configs" / f"cfs_{year}.yaml").read_text())
    return config["source_file"]


def load_shipments(path, extra=()):
    cols = ["ORIG_STATE", "DEST_STATE", "SCTG", "SHIPMT_VALUE", "WGT_FACTOR", *extra]
    df = pd.read_csv(
        path,
        usecols=cols,
        dtype={"ORIG_STATE": str, "DEST_STATE": str, "SCTG": str, "QUARTER": str},
    )
    df = df[~df.SCTG.str.contains("-") & ~df.SCTG.isin(DROP_SCTG)]
    df = df[df.ORIG_STATE.isin(FIPS) & df.DEST_STATE.isin(FIPS) & (df.ORIG_STATE != df.DEST_STATE)]
    df = df.assign(
        o=df.ORIG_STATE.map(FIPS), d=df.DEST_STATE.map(FIPS), usd=df.WGT_FACTOR * df.SHIPMT_VALUE
    )
    assert df.o.nunique() == 51 and df.d.nunique() == 51
    return df


PAIRS = ((0, 1), (0, 2), (1, 2))


def fit_pairs(p, band=None, iters=300):
    """OD:OC:DC by ra.fit, and with band also the distance band x commodity margin.

    The OD margin keeps the zero diagonal (no interstate flow from a state to itself).
    """
    n = p.shape[0]
    start = np.ones(p.shape)
    start[np.arange(n), np.arange(n), :] = 0
    return fit(p, PAIRS, start, band, iters)


def null_contributions(q, n_records, band, seed):
    """Per-origin three-way part of tables drawn from the fitted model q, refitted the same way."""
    rng = np.random.default_rng(seed)
    draws = []
    for _ in range(NULL_DRAWS):
        s = rng.multinomial(n_records, q.ravel()).reshape(q.shape) / n_records
        draws.append(cell_terms(s, fit_pairs(s, band)).sum((1, 2)))
    return np.mean(draws, 0)


def pair_bands(df, states):
    band = -np.ones((len(states), len(states)), dtype=int)
    for (o, d), miles in df.groupby(["o", "d"]).SHIPMT_DIST_GC.median().items():
        band[states.index(o), states.index(d)] = np.searchsorted(BANDS, miles, side="right") - 1
    return band


def analyse_year(year):
    df = load_shipments(source_file(year), extra=["SHIPMT_DIST_GC"])
    states = sorted(FIPS.values())
    sctg = sorted(df.SCTG.unique())
    index = (
        df.o.map(states.index).values,
        df.d.map(states.index).values,
        df.SCTG.map(sctg.index).values,
    )
    band = pair_bands(df, states)
    result = {"year": year, "records": len(df), "commodities": len(sctg)}
    per_state = pd.DataFrame(index=states)
    for weighting, w in [("records", np.ones(len(df))), ("dollars", df.usd.values)]:
        t = np.zeros((len(states), len(states), len(sctg)))
        np.add.at(t, index, w)
        p = t / t.sum()
        h_o, h_d, h_c = entropy(p.sum((1, 2))), entropy(p.sum((0, 2))), entropy(p.sum((0, 1)))
        h_od, h_oc, h_dc = (
            entropy(p.sum(2).ravel()),
            entropy(p.sum(1).ravel()),
            entropy(p.sum(0).ravel()),
        )
        h_all = entropy(p.ravel())
        tc = h_o + h_d + h_c - h_all
        dtc = h_all - ((h_all - h_dc) + (h_all - h_oc) + (h_all - h_od))
        q, qd = fit_pairs(p), fit_pairs(p, band)
        r = {
            "total_correlation": tc,
            "o_information": tc - dtc,
            "three_way": kl(p, q),
            "three_way_after_distance": kl(p, qd),
        }
        if weighting == "records":
            null, null_d = (
                null_contributions(q, len(df), None, 0),
                null_contributions(qd, len(df), band, 1),
            )
            r["three_way_null"], r["three_way_after_distance_null"] = (
                float(null.sum()),
                float(null_d.sum()),
            )
            excess = r["three_way"] - r["three_way_null"]
            excess_d = r["three_way_after_distance"] - r["three_way_after_distance_null"]
            r["share_of_excess_explained_by_distance"] = 1 - excess_d / excess
            share = p.sum((1, 2))
            per_state["share"] = share
            per_state["excess_per_share"] = (cell_terms(p, q).sum((1, 2)) - null) / share
            per_state["excess_per_share_after_distance"] = (
                cell_terms(p, qd).sum((1, 2)) - null_d
            ) / share
        result[weighting] = r
    roles = pd.read_csv(ROLES)
    per_state = per_state.join(
        roles[roles.year == year].set_index("state")[["role", "rank_eigenvector"]]
    )
    # net of size: residual of log excess on log share
    slope, icept = np.polyfit(
        np.log(per_state.share), np.log(per_state.excess_per_share_after_distance), 1
    )
    per_state = per_state.assign(
        net_of_size=np.log(per_state.excess_per_share_after_distance)
        - (icept + slope * np.log(per_state.share))
    )
    result["size_slope"] = float(slope)
    result["spearman_rank_vs_excess"] = float(
        spearmanr(per_state.rank_eigenvector, per_state.excess_per_share_after_distance).statistic
    )
    result["role_means_net_of_size"] = (
        per_state.groupby("role").net_of_size.mean().round(3).to_dict()
    )
    return result, per_state


def main():
    OUT.mkdir(exist_ok=True)
    summary, nets = {}, {}
    for year in YEARS:
        result, per_state = analyse_year(year)
        per_state.round(5).to_csv(OUT / f"three_way_states_{year}.csv")
        summary[year] = result
        nets[year] = per_state.net_of_size
        print(year, json.dumps(result["records"]), flush=True)
    nets = pd.DataFrame(nets)
    summary["net_of_size_cross_year_spearman"] = nets.corr(method="spearman").round(3).to_dict()
    (OUT / "three_way_summary.json").write_text(json.dumps(summary, indent=1, default=float))


if __name__ == "__main__":
    main()
