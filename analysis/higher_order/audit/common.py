"""Shared loading for the replaceability audit: one compact cache per survey year.

The cache holds one row per interstate shipment record after the filters in
run_three_way.load_shipments (state codes, SCTG, weighted value, great-circle miles).
"""

import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from run_replaceability import centroid_miles  # noqa: E402
from run_three_way import FIPS, YEARS, load_shipments, source_file  # noqa: E402

OUT = HERE / "output"
CACHE = HERE / ".cache"
STATES = sorted(FIPS.values())
ADJACENCY_URL = (
    "https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2024.txt"
)


def shipments(year):
    """Records as a frame with o, d, SCTG (str), usd, dist; cached as npz."""
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"shipments_{year}.npz"
    if not path.exists():
        df = load_shipments(source_file(year), extra=["SHIPMT_DIST_GC"])
        sctg = sorted(df.SCTG.unique())
        np.savez(
            path,
            o=df.o.map(STATES.index).to_numpy(np.int8),
            d=df.d.map(STATES.index).to_numpy(np.int8),
            c=df.SCTG.map(sctg.index).to_numpy(np.int8),
            usd=df.usd.to_numpy(np.float64),
            dist=df.SHIPMT_DIST_GC.to_numpy(np.float64),
            sctg=np.array(sctg),
        )
    z = np.load(path)
    states, sctg = np.array(STATES), z["sctg"]
    return pd.DataFrame({
        "o": pd.Categorical(states[z["o"]], categories=STATES),
        "d": pd.Categorical(states[z["d"]], categories=STATES),
        "SCTG": pd.Categorical(sctg[z["c"]], categories=list(sctg)),
        "usd": z["usd"],
        "SHIPMT_DIST_GC": z["dist"],
    })


def codes(year):
    """Integer cell index (o, d, c) per record and the weighted value, for bootstraps."""
    shipments(year)
    z = np.load(CACHE / f"shipments_{year}.npz")
    n_c = len(z["sctg"])
    cell = (z["o"].astype(np.int64) * 51 + z["d"]) * n_c + z["c"]
    return cell, z["usd"], list(z["sctg"])


def adjacency():
    """Unordered state pairs that share a county boundary in the Census Bureau county
    adjacency file (2024). The file counts some water boundaries, so IL-MI, MI-MN and
    NY-RI are adjacent here."""
    path = OUT / "state_adjacency.csv"
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        raw = CACHE / "county_adjacency2024.txt"
        if not raw.exists():
            urllib.request.urlretrieve(ADJACENCY_URL, raw)
        df = pd.read_csv(raw, sep="|", dtype=str)
        a, b = df["County Name"].str[-2:], df["Neighbor Name"].str[-2:]
        keep = (a != b) & a.isin(STATES) & b.isin(STATES)
        pairs = sorted({tuple(sorted(p)) for p in zip(a[keep], b[keep])})
        pd.DataFrame(pairs, columns=["a", "b"]).to_csv(path, index=False)
    pairs = pd.read_csv(path)
    return {frozenset(p) for p in zip(pairs.a, pairs.b)}


def centroid_matrix():
    return pd.DataFrame(
        [[centroid_miles(a, b) if a != b else 0.0 for b in STATES] for a in STATES],
        index=STATES, columns=STATES,
    )
