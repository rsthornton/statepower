"""
Post-hoc exploratory study (NOT pre-registered): the lattice of structures over
origin state, destination state and commodity, per survey year.

For each of the nine structures (O:D:C up to the data, ODC), plus OD:OC:DC with
the commodity-specific distance term: its loss in bits, a sampling null (the
loss of tables of the same size drawn from its own fit), and the share of the
dependence it captures, raw and net of the null, with a bootstrap interval
over records. Then each state's part of what the pairwise model misses, as a
shipping state and as a receiving state: its share of the excess loss over its
share of records (1 is its size share), with a bootstrap interval.

Counted by records; dollars have no sample size, so dollar figures carry no
null or interval. Reads the raw survey files read-only; writes to output/.
See README.md, "The lattice".
"""

import json

import numpy as np
import pandas as pd
import ra
from run_three_way import FIPS, OUT, YEARS, load_shipments, pair_bands, source_file

NULL_DRAWS = 10
BOOT_DRAWS = 40
DISTANCE = "OD:OC:DC+distance"
PAIRS = ((0, 1), (0, 2), (1, 2))


def tables(df, states, sctg):
    index = (
        df.o.map(states.index).values,
        df.d.map(states.index).values,
        df.SCTG.map(sctg.index).values,
    )
    out = {}
    for weighting, w in [("records", np.ones(len(df))), ("dollars", df.usd.values)]:
        t = np.zeros((len(states), len(states), len(sctg)))
        np.add.at(t, index, w)
        out[weighting] = t
    return out


def rungs(start):
    """Structure name -> function fitting it to a table."""
    out = {ra.name(s): (lambda p, s=s: ra.fit(p, s, start)) for s in ra.lattice(3)}
    return out


def losses(p, fits):
    """Loss of each rung, and per-state slices (origin, destination) of the pairwise rungs."""
    q = {k: f(p) for k, f in fits.items()}
    loss = {k: ra.kl(p, v) for k, v in q.items()}
    slices = {}
    for k in ("OD:OC:DC", DISTANCE):
        terms = ra.cell_terms(p, q[k])
        slices[k] = (terms.sum((1, 2)), terms.sum((0, 2)))
    return loss, slices, q


def null_draws(q, n, fits, seed):
    """Mean loss and mean per-state slices over tables drawn from each rung's own fit."""
    rng = np.random.default_rng(seed)
    loss = {k: 0.0 for k in fits}
    slices = {k: (0.0, 0.0) for k in ("OD:OC:DC", DISTANCE)}
    for _ in range(NULL_DRAWS):
        for k, f in fits.items():
            s = rng.multinomial(n, q[k].ravel()).reshape(q[k].shape) / n
            fitted = f(s)
            loss[k] += ra.kl(s, fitted) / NULL_DRAWS
            if k in slices:
                t = ra.cell_terms(s, fitted)
                o, d = slices[k]
                slices[k] = (o + t.sum((1, 2)) / NULL_DRAWS, d + t.sum((0, 2)) / NULL_DRAWS)
    return loss, slices


def carry(slices, null_slices, share, excess):
    """Each state's share of the excess loss over its share of records (1 = its size share)."""
    return (slices - null_slices) / excess / share


def interval(estimate, draws, axis=None):
    """95% sampling interval centred on the estimate.

    Resampled tables carry a second round of sampling loss, so their own centre is shifted;
    only their spread around their median is used.
    """
    lo, mid, hi = np.percentile(draws, [2.5, 50, 97.5], axis=axis)
    return estimate - (mid - lo), estimate + (hi - mid)


def net_of_size(values, share):
    """Residual of log value on log share (NaN for every state if any value is not positive)."""
    if (values <= 0).any():
        return np.full(len(values), np.nan)
    slope, icept = np.polyfit(np.log(share), np.log(values), 1)
    return np.log(values) - (icept + slope * np.log(share))


def top_cells(p, q, n, states, sctg, k=5):
    """Each state's k cells with the largest positive term of the pairwise loss, both sides."""
    terms = ra.cell_terms(p, q)
    rows = []
    for side, name in ((0, "shipping"), (1, "receiving")):
        for i, st in enumerate(states):
            t = terms[i] if side == 0 else terms[:, i]
            for j, c in zip(*np.unravel_index(np.argsort(t, axis=None)[::-1][:k], t.shape)):
                if t[j, c] <= 0:
                    break
                cell = (i, j, c) if side == 0 else (j, i, c)
                rows.append(
                    {
                        "state": st,
                        "side": name,
                        "partner": states[j],
                        "sctg": sctg[c],
                        "term": t[j, c],
                        "records": p[cell] * n,
                        "expected": q[cell] * n,
                    }
                )
    return pd.DataFrame(rows)


def analyse_year(year):
    df = load_shipments(source_file(year), extra=["SHIPMT_DIST_GC"])
    states = sorted(FIPS.values())
    sctg = sorted(df.SCTG.unique())
    n = len(states)
    start = np.ones((n, n, len(sctg)))
    start[np.arange(n), np.arange(n), :] = 0
    band = pair_bands(df, states)
    fits = rungs(start)
    fits[DISTANCE] = lambda p: ra.fit(p, PAIRS, start, band)
    t = tables(df, states, sctg)
    counts = t["records"]
    p = counts / counts.sum()

    loss, slices, q = losses(p, fits)
    for s in ra.lattice(3):
        gap = ra.margin_gap(p, q[ra.name(s)], s)
        assert gap < 1e-9, f"{year} {ra.name(s)} did not converge (margin gap {gap:.1e})"
    null, null_slices = null_draws(q, len(df), fits, seed=year)
    ind = "O:D:C"

    def net_captured(lo, nu, k):
        return 1 - (lo[k] - nu[k]) / (lo[ind] - nu[ind])

    boot = {k: [] for k in fits}
    boot_states = {(k, side): [] for k in slices for side in (0, 1)}
    for draw in ra.bootstrap(counts, BOOT_DRAWS, seed=year + 1):
        b = draw / draw.sum()
        bl, bs, _ = losses(b, fits)
        for k in fits:
            boot[k].append(net_captured(bl, null, k))
        for k in slices:
            excess = bl[k] - null[k]
            shares = (b.sum((1, 2)), b.sum((0, 2)))
            for side in (0, 1):
                boot_states[(k, side)].append(
                    carry(bs[k][side], null_slices[k][side], shares[side], excess)
                )

    pd_ = t["dollars"] / t["dollars"].sum()
    dollar_loss = {k: ra.kl(pd_, f(pd_)) for k, f in fits.items()}
    shape = (n, n, len(sctg))
    rows = []
    # lattice order, with the distance rung right after the pairwise one
    order = [ra.name(s) for s in ra.lattice(3)]
    order.insert(order.index("OD:OC:DC") + 1, DISTANCE)
    for k in order:
        lo, hi = interval(net_captured(loss, null, k), boot[k])
        structure = next((s for s in ra.lattice(3) if ra.name(s) == k), None)
        rows.append(
            {
                "structure": k,
                # the distance rung adds band x commodity terms on top of the pairwise model
                "params": ra.params(structure, shape) if structure else None,
                "loss": loss[k],
                "null": null[k],
                "captured": 1 - loss[k] / loss[ind],
                "captured_net": net_captured(loss, null, k),
                "captured_net_low": lo,
                "captured_net_high": hi,
                "dollars_loss": dollar_loss[k],
                "dollars_captured": 1 - dollar_loss[k] / dollar_loss[ind],
            }
        )
    ladder = pd.DataFrame(rows)

    per_state = pd.DataFrame(index=states)
    per_state["share_shipping"] = p.sum((1, 2))
    per_state["share_receiving"] = p.sum((0, 2))
    for k, tag in (("OD:OC:DC", ""), (DISTANCE, "_after_distance")):
        excess = loss[k] - null[k]
        for side, name in ((0, "shipping"), (1, "receiving")):
            share = per_state[f"share_{name}"].values
            col = f"carry_{name}{tag}"
            est = carry(slices[k][side], null_slices[k][side], share, excess)
            per_state[col] = est
            lo, hi = interval(est, np.array(boot_states[(k, side)]), axis=0)
            per_state[f"{col}_low"], per_state[f"{col}_high"] = lo, hi
            per_state[f"{col}_net_of_size"] = net_of_size(est, share)
    top = top_cells(p, q["OD:OC:DC"], len(df), states, sctg)
    summary = {
        "year": year,
        "records": len(df),
        "commodities": len(sctg),
        "null_draws": NULL_DRAWS,
        "bootstrap_draws": BOOT_DRAWS,
    }
    return summary, ladder, per_state, top


def main():
    OUT.mkdir(exist_ok=True)
    summary = {}
    for year in YEARS:
        s, ladder, per_state, top = analyse_year(year)
        top.round(6).to_csv(OUT / f"lattice_cells_{year}.csv", index=False)
        ladder.round(6).to_csv(OUT / f"lattice_{year}.csv", index=False)
        per_state.round(5).to_csv(OUT / f"lattice_states_{year}.csv")
        summary[year] = s
        print(year, ladder[["structure", "captured", "captured_net"]].round(3).to_dict("records"))
    (OUT / "lattice_summary.json").write_text(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
