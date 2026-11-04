"""
Post-hoc check (NOT pre-registered): reconstructability analysis and gravity-style
Poisson regression with fixed effects fit the same model.

On origin division x destination division x commodity, counted by shipment
records (CFS 2017), the maximum-entropy fit by iterative proportional fitting
(RA) and the Poisson maximum-likelihood fit with the matching fixed effects
(Newton's method, as in PPML gravity estimation) give the same fitted counts,
and 2 N ln 2 times RA's information loss equals the Poisson deviance. See
README.md, "RA, log-linear models and gravity".
"""

import json
from itertools import combinations

import numpy as np
import pandas as pd
from ra import fit
from run_three_way import FIPS, OUT, kl, load_shipments, source_file

DIVISION = {
    **dict.fromkeys(["09", "23", "25", "33", "44", "50"], "NE"),
    **dict.fromkeys(["34", "36", "42"], "MA"),
    **dict.fromkeys(["17", "18", "26", "39", "55"], "ENC"),
    **dict.fromkeys(["19", "20", "27", "29", "31", "38", "46"], "WNC"),
    **dict.fromkeys(["10", "11", "12", "13", "24", "37", "45", "51", "54"], "SA"),
    **dict.fromkeys(["01", "21", "28", "47"], "ESC"),
    **dict.fromkeys(["05", "22", "40", "48"], "WSC"),
    **dict.fromkeys(["04", "08", "16", "30", "32", "35", "49", "56"], "MTN"),
    **dict.fromkeys(["02", "06", "15", "41", "53"], "PAC"),
}
STATE_TO_FIPS = {v: k for k, v in FIPS.items()}


def ipf(n, margins, iters=500):
    """Maximum-entropy table with the given margins of n (no structural zeros), by ra.fit."""
    return fit(n, margins, iters=iters)


def design(shape, margins):
    """Dummy columns: one per cell of each kept margin (over-parameterized; lstsq copes)."""
    idx = np.indices(shape).reshape(len(shape), -1).T
    cols = []
    for keep in margins:
        sub = [shape[a] for a in keep]
        key = np.ravel_multi_index(idx[:, list(keep)].T, sub)
        cols.append(np.eye(int(np.prod(sub)))[key])
    return np.hstack(cols)


def poisson_fit(n, margins, iters=100, tol=1e-12):
    """Poisson maximum likelihood with fixed effects for the given margins, by Newton (IRLS).

    A cell with a zero kept margin has fitted value 0 at the maximum (the estimate sits on
    the boundary; Fally 2015, fn 13), so only cells with every kept margin positive are fit.
    """
    live = np.ones(n.shape, dtype=bool)
    for keep in margins:
        ax = tuple(a for a in range(n.ndim) if a not in keep)
        live &= np.broadcast_to(n.sum(axis=ax, keepdims=True) > 0, n.shape)
    y = n.ravel()[live.ravel()]
    X = design(n.shape, margins)[live.ravel()]
    mu = y + 0.5
    eta = np.log(mu)
    for _ in range(iters):
        z = eta + (y - mu) / mu
        w = np.sqrt(mu)
        beta, *_ = np.linalg.lstsq(X * w[:, None], z * w, rcond=None)
        eta_new = X @ beta
        done = np.max(np.abs(eta_new - eta)) < tol
        eta, mu = eta_new, np.exp(eta_new)
        if done:
            break
    m = y > 0
    deviance = 2 * (np.sum(y[m] * np.log(y[m] / mu[m])) - np.sum(y - mu))
    fitted = np.zeros(n.size)
    fitted[live.ravel()] = mu
    return fitted.reshape(n.shape), float(deviance)


def compare(n, margins):
    N = n.sum()
    q = ipf(n, margins)
    mu, deviance = poisson_fit(n, margins)
    loss = kl(n / N, q / N)
    return {
        "max_abs_difference": float(np.abs(q - mu).max()),
        "largest_cell": float(mu.max()),
        "ra_loss_bits": loss,
        "two_n_ln2_loss": float(2 * N * np.log(2) * loss),
        "poisson_deviance": deviance,
    }


def main():
    df = load_shipments(source_file(2017))
    df = df.assign(
        od=df.o.map(STATE_TO_FIPS).map(DIVISION), dd=df.d.map(STATE_TO_FIPS).map(DIVISION)
    )
    t = df.groupby(["od", "dd", "SCTG"]).size()
    levels = [sorted(df.od.unique()), sorted(df.dd.unique()), sorted(df.SCTG.unique())]
    n = (
        t.reindex(pd.MultiIndex.from_product(levels), fill_value=0)
        .values.reshape([len(v) for v in levels])
        .astype(float)
    )
    models = {
        "O:D:C": [(0,), (1,), (2,)],
        "OD:OC:DC": list(combinations(range(3), 2)),
    }
    result = {"records": int(n.sum()), "cells": int(n.size)}
    for name, margins in models.items():
        result[name] = compare(n, margins)
        print(name, json.dumps(result[name]), flush=True)
    OUT.mkdir(exist_ok=True)
    (OUT / "equivalence_summary.json").write_text(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
