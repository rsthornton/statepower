"""
Post-hoc exploratory study (NOT pre-registered): can a state be identified from its
commodity flows?

Two views. (1) Profiles, 51 states: how many are uniquely identified by their top-k
outflow and top-k inflow commodities (by value), against two baselines: commodity
columns shuffled across states, and every state shipping the national mix (the
origin-commodity independence model, drawn at each state's record count). (2) Shipments:
the share of origin-state (and destination-state) uncertainty answered by commodity,
by partner state, and by both. See README.md.
"""

import json

import numpy as np
import pandas as pd
from run_three_way import OUT, YEARS, load_shipments, source_file

TOP_K = [1, 2, 3]
RUNS = 1000


def unique_count(outflow, inflow, k):
    """States whose (top-k outflow, top-k inflow) commodity lists no other state shares."""
    top_out = np.argsort(-outflow, axis=1)[:, :k]
    top_in = np.argsort(-inflow, axis=1)[:, :k]
    keys = pd.Series([tuple(a) + ("|",) + tuple(b) for a, b in zip(top_out, top_in)])
    return int((keys.map(keys.value_counts()) == 1).sum())


def profiles(df):
    out = df.groupby(["o", "SCTG"]).usd.sum().unstack(fill_value=0).astype(float)
    inn = df.groupby(["d", "SCTG"]).usd.sum().unstack(fill_value=0).astype(float)
    inn = inn.reindex(index=out.index, columns=out.columns, fill_value=0)
    return out, inn


def profile_study(df, seed=0):
    out, inn = profiles(df)
    flows_out, flows_in = out.values, inn.values
    rng = np.random.default_rng(seed)
    n_out = df.groupby("o").size().reindex(out.index).values
    n_in = df.groupby("d").size().reindex(out.index).values
    p_out = flows_out.sum(0) / flows_out.sum()
    p_in = flows_in.sum(0) / flows_in.sum()
    shuffled = {k: [] for k in TOP_K}
    national = {k: [] for k in TOP_K}
    for _ in range(RUNS):
        Os = np.column_stack([rng.permutation(c) for c in flows_out.T])
        Is = np.column_stack([rng.permutation(c) for c in flows_in.T])
        On = np.array([rng.multinomial(n, p_out) for n in n_out], float)
        In = np.array([rng.multinomial(n, p_in) for n in n_in], float)
        for k in TOP_K:
            shuffled[k].append(unique_count(Os, Is, k))
            national[k].append(unique_count(On, In, k))
    result = {}
    for k in TOP_K:
        s, n = np.array(shuffled[k]), np.array(national[k])
        observed = unique_count(flows_out, flows_in, k)
        result[k] = {
            "observed": observed,
            "outflow_only": unique_count(flows_out, np.zeros_like(flows_in), k),
            "inflow_only": unique_count(np.zeros_like(flows_out), flows_in, k),
            "shuffled_mean": float(s.mean()),
            "shuffled_95": [float(np.percentile(s, 2.5)), float(np.percentile(s, 97.5))],
            "share_shuffled_at_least_observed": float(np.mean(s >= observed)),
            "national_mix_mean": float(n.mean()),
        }
    return result


def shipment_study(df):
    result = {}
    for weighting, w in [("records", None), ("dollars", "usd")]:

        def H(cols):
            g = df.groupby(cols).size() if w is None else df.groupby(cols)[w].sum()
            p = g.values / g.values.sum()
            p = p[p > 0]
            return float(-(p * np.log2(p)).sum())

        def explained(target, clues):
            return 100 * (H([target]) + H(clues) - H(clues + [target])) / H([target])

        result[weighting] = {
            "origin_by_commodity": explained("o", ["SCTG"]),
            "origin_by_destination": explained("o", ["d"]),
            "origin_by_both": explained("o", ["SCTG", "d"]),
            "destination_by_commodity": explained("d", ["SCTG"]),
            "destination_by_origin": explained("d", ["o"]),
            "destination_by_both": explained("d", ["SCTG", "o"]),
        }
    return result


def main():
    OUT.mkdir(exist_ok=True)
    summary = {}
    for year in YEARS:
        df = load_shipments(source_file(year))
        summary[year] = {"shipments": shipment_study(df)}
        if year == 2017:
            summary[year]["profiles"] = profile_study(df)
        print(year, json.dumps(summary[year]["shipments"]["dollars"]), flush=True)
    (OUT / "identify_state_summary.json").write_text(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
