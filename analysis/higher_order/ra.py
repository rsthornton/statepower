"""
Reconstructability analysis (RA) on a contingency table, in numpy.

A structure is a set of margins of the table, written as tuples of axes:
((0, 1), (0, 2), (1, 2)) keeps every pair of three variables, OD:OC:DC.
Its fitted table is the maximum-entropy table with those margins, found by
iterative proportional fitting (IPF). That is also the maximum-likelihood
hierarchical log-linear model with those margins, and the Poisson fit of a
gravity equation with the matching fixed effects (run_equivalence.py checks
this on the data).

The loss of a structure is the KL divergence of the data from its fit, in
bits. The share of dependence a structure captures is one minus its loss over
the loss of the independence structure. Structural zeros (a state cannot ship
interstate to itself) enter through the start table: a cell that starts at
zero stays zero.
"""

from itertools import combinations

import numpy as np


def entropy(p):
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def kl(p, q):
    m = p > 0
    return float((p[m] * np.log2(p[m] / q[m])).sum())


def cell_terms(p, q):
    """Each cell's term of kl(p, q); the terms of a slice sum to that slice's part of the loss."""
    out = np.zeros_like(p)
    m = p > 0
    out[m] = p[m] * np.log2(p[m] / q[m])
    return out


def fit(p, structure, start=None, band=None, iters=300):
    """IPF of p to the margins in structure, from start (ones if None), in a fixed number of sweeps.

    band, for a three-way table only: integer labels over axes 0 and 1 (-1 for no label);
    the fit then also keeps the band x axis-2 margin (a commodity-specific distance profile).
    """
    q = np.ones(p.shape) if start is None else start.astype(float)
    q /= q.sum()
    if band is not None:
        n0, n1 = p.shape[:2]
        flat = band.ravel()
        valid = flat >= 0
        onehot = np.zeros((flat.max() + 1, n0 * n1))
        onehot[flat[valid], np.flatnonzero(valid)] = 1
        target = onehot @ p.reshape(n0 * n1, -1)
    for _ in range(iters):
        for keep in structure:
            ax = tuple(a for a in range(p.ndim) if a not in keep)
            mp, mq = p.sum(axis=ax, keepdims=True), q.sum(axis=ax, keepdims=True)
            q = q * np.divide(mp, mq, out=np.zeros_like(mq), where=mq > 0)
        if band is not None:
            cur = onehot @ q.reshape(n0 * n1, -1)
            factor = np.divide(target, cur, out=np.zeros_like(cur), where=cur > 0)
            scale = factor[np.where(valid, flat, 0)] * valid[:, None]
            q = (q.reshape(n0 * n1, -1) * scale).reshape(q.shape)
    return q


def margin_gap(p, q, structure):
    """Largest absolute difference between p and q over the margins q should keep."""
    gaps = []
    for keep in structure:
        ax = tuple(a for a in range(p.ndim) if a not in keep)
        gaps.append(np.abs(p.sum(axis=ax) - q.sum(axis=ax)).max())
    return float(max(gaps))


def lattice(k):
    """Every structure on k variables: margins that cover all variables, none inside another.

    Ordered from independence to the saturated table by parameter count, then by name.
    There are 9 on three variables and 114 on four.
    """
    subsets = [s for r in range(1, k + 1) for s in combinations(range(k), r)]
    found = []

    def grow(chosen, rest):
        if chosen and set().union(*map(set, chosen)) == set(range(k)):
            found.append(tuple(sorted(chosen, key=lambda m: (-len(m), m))))
        for i, s in enumerate(rest):
            if not any(set(s) <= set(c) or set(c) <= set(s) for c in chosen):
                grow(chosen + [s], rest[i + 1 :])

    grow([], subsets)
    return sorted(found, key=lambda st: (params(st, [2] * k), name(st)))


def params(structure, shape):
    """Free parameters of the log-linear model, ignoring structural zeros (one term per subset)."""
    kept = {sub for m in structure for r in range(1, len(m) + 1) for sub in combinations(m, r)}
    return int(sum(np.prod([shape[a] - 1 for a in sub]) for sub in kept))


def name(structure, letters="ODCM"):
    """OD:OC:DC style name; each margin's letters in variable order."""
    return ":".join("".join(letters[a] for a in m) for m in structure)


def independence(k):
    return tuple((a,) for a in range(k))


def captured(p, q, q_independence):
    """Share of the dependence in p (the independence model's loss) that the fit q keeps."""
    return 1 - kl(p, q) / kl(p, q_independence)


def bootstrap(counts, draws, seed):
    """Tables resampled from the observed records: multinomial draws of the same size."""
    rng = np.random.default_rng(seed)
    n = int(round(counts.sum()))
    p = (counts / counts.sum()).ravel()
    for _ in range(draws):
        yield rng.multinomial(n, p).reshape(counts.shape).astype(float)
