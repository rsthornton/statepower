"""
Post-hoc exploratory study (NOT pre-registered): states as variables, after
Varley, Pope, Faskowitz and Sporns (2023, Communications Biology 6:451).

Observation = one slice (commodity x destination census division x quarter).
Variable = a state's shipped value in that slice, Gaussian-copula transformed,
with the slice-wide mean regressed out (the analogue of global signal
regression). O-information from the correlation matrix, random subsets, and
simulated annealing for the most synergistic subsets, each compared with the
same pipeline run on column-shuffled data. 2012 and 2017 only: the 2022 file
has no quarter. See README.md.
"""

import json

import numpy as np
import pandas as pd
from run_three_way import FIPS, OUT, ROLES, load_shipments, source_file
from scipy.stats import norm, rankdata

YEARS = [2012, 2017]
SIZES = [3, 5, 8, 10]
RUNS, NULL_RUNS = 40, 15

DIVISION = {
    **dict.fromkeys(["09", "23", "25", "33", "44", "50"], 1),
    **dict.fromkeys(["34", "36", "42"], 2),
    **dict.fromkeys(["17", "18", "26", "39", "55"], 3),
    **dict.fromkeys(["19", "20", "27", "29", "31", "38", "46"], 4),
    **dict.fromkeys(["10", "11", "12", "13", "24", "37", "45", "51", "54"], 5),
    **dict.fromkeys(["01", "21", "28", "47"], 6),
    **dict.fromkeys(["05", "22", "40", "48"], 7),
    **dict.fromkeys(["04", "08", "16", "30", "32", "35", "49", "56"], 8),
    **dict.fromkeys(["02", "06", "15", "41", "53"], 9),
}


def slice_table(year):
    df = load_shipments(source_file(year), extra=["QUARTER"])
    key = df.SCTG + "|" + df.DEST_STATE.map(DIVISION).astype(str) + "|" + df.QUARTER.str.zfill(2)
    table = df.pivot_table(index=key, columns="o", values="usd", aggfunc="sum", fill_value=0.0)
    return table[sorted(FIPS.values())]


def gaussianize(X):
    return np.column_stack([norm.ppf(rankdata(col) / (len(col) + 1)) for col in X.T])


def remove_slice_signal(Z):
    g = Z.mean(1, keepdims=True)
    return Z - g * ((Z * g).sum(0) / (g * g).sum())


def o_information(R):
    """O-information in bits of a Gaussian with correlation R; negative means synergy."""
    _, logdet = np.linalg.slogdet(R)
    return float((-logdet - 0.5 * np.log(np.diag(np.linalg.inv(R))).sum()) / np.log(2))


def anneal(R, k, rng, steps=4000, t0=0.05):
    n = R.shape[0]
    cur = rng.choice(n, k, replace=False)
    f = o_information(R[np.ix_(cur, cur)])
    best, f_best = cur.copy(), f
    for step in range(steps):
        temp = t0 * (1 - step / steps) + 1e-6
        nxt = cur.copy()
        nxt[rng.integers(k)] = rng.choice(np.setdiff1d(np.arange(n), cur))
        g = o_information(R[np.ix_(nxt, nxt)])
        if g < f or rng.random() < np.exp((f - g) / temp):
            cur, f = nxt, g
            if f < f_best:
                best, f_best = cur.copy(), f
    return best, f_best


def analyse_year(year):
    table = slice_table(year)
    states = list(table.columns)
    rng = np.random.default_rng(0)
    raw = table.values
    shuffled = np.column_stack([rng.permutation(col) for col in raw.T])
    R = np.corrcoef(remove_slice_signal(gaussianize(raw)).T)
    R_null = np.corrcoef(remove_slice_signal(gaussianize(shuffled)).T)
    R_no_regression = np.corrcoef(gaussianize(raw).T)
    result = {
        "year": year,
        "slices": int(raw.shape[0]),
        "random_subsets_fraction_synergistic": {},
        "annealed": {},
    }
    for k in SIZES:
        vals = [
            o_information(R[np.ix_(s, s)])
            for s in (rng.choice(len(states), k, replace=False) for _ in range(3000))
        ]
        result["random_subsets_fraction_synergistic"][k] = float(np.mean(np.array(vals) < 0))
    hits = pd.Series(0.0, index=states)
    for k in SIZES:
        best = []
        for _ in range(RUNS):
            members, f = anneal(R, k, rng)
            best.append(f)
            hits.iloc[members] += 1
        result["annealed"][k] = {
            "best": float(min(best)),
            "median": float(np.median(best)),
            "shuffled_best": float(min(anneal(R_null, k, rng)[1] for _ in range(NULL_RUNS))),
            "no_slice_regression_best": float(
                min(anneal(R_no_regression, k, rng)[1] for _ in range(NULL_RUNS))
            ),
        }
    roles = pd.read_csv(ROLES)
    part = (hits / hits.sum() * len(states)).rename("participation_vs_chance").to_frame()
    part = part.join(roles[roles.year == year].set_index("state")[["role", "rank_eigenvector"]])
    result["participation_by_role"] = (
        part.groupby("role").participation_vs_chance.mean().round(2).to_dict()
    )
    return result, part


def main():
    OUT.mkdir(exist_ok=True)
    summary = {}
    for year in YEARS:
        result, part = analyse_year(year)
        part.round(4).to_csv(OUT / f"states_as_variables_participation_{year}.csv")
        summary[year] = result
        print(year, json.dumps(result["annealed"]), flush=True)
    (OUT / "states_as_variables_summary.json").write_text(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
