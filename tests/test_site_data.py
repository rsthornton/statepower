"""
Cross-checks for the site data and downloads written by scripts/export_site_data.py.

Network series against the registered evolution report and the thesis 2017 tables; commodity
series against the 3-D map's tested figures and, when the map's preview data is on disk,
against those files directly.
"""

import csv
import hashlib
import json
import os
import math
import re
from pathlib import Path

import pytest
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "web" / "public" / "data" / "v2"
DOWNLOADS = ROOT / "web" / "public" / "downloads"
REPORT = ROOT / "evolution" / "results" / "evolution_20260808_093628" / "results.json"
# An earlier 3-D map preview's data, for a cross-check that runs only where it exists (CFS_PREVIEW_DATA).
FREIGHT = Path(os.environ.get("CFS_PREVIEW_DATA", "/nonexistent"))
YEARS = [2012, 2017, 2022]
UNDERVALUED_2017 = {"IN", "KY", "LA", "MI", "MS", "MT", "ND", "OK", "SC", "TN", "WV"}

pytestmark = pytest.mark.skipif(not (SITE / "meta.json").exists(), reason="site data not exported")


def load(path):
    return json.loads(path.read_text())


@pytest.fixture(scope="module")
def meta():
    return load(SITE / "meta.json")


@pytest.mark.parametrize("year", YEARS)
def test_network_matches_registered_report(year):
    reg = load(REPORT)["years"][str(year)]
    net = load(SITE / "network" / f"{year}.json")
    assert len(net["edges"]) == reg["edge_count"]
    total = sum(e[2] for e in net["edges"])
    assert abs(total / reg["interstate_weighted_total"] - 1) < 1e-9
    assert len(net["states"]) == 51
    for r in net["states"]:
        assert r["no_brokerage"] == (r["betweenness"] == 0)
        assert r["gap_eigenvector"] == r["gdp_rank"] - r["rank_eigenvector"]


def test_network_2017_agrees_with_thesis_tables():
    net = {r["state"]: r for r in load(SITE / "network" / "2017.json")["states"]}
    dash = {r["state"]: r for r in load(ROOT / "web" / "public" / "data" / "centralities_51.json")}
    states = sorted(net)
    rho = spearmanr(
        [net[s]["eigenvector"] for s in states], [dash[s]["eigenvector"] for s in states]
    ).correlation
    assert rho > 0.999
    assert {s for s in states if net[s]["gap_eigenvector"] >= 5} == UNDERVALUED_2017


def test_commodity_records_and_counts(meta):
    assert len(meta["commodities"]) == 40
    records = {y: meta["commoditySeries"][str(y)]["records"] for y in YEARS}
    assert records == {2012: 2_279_065, 2017: 2_943_533, 2022: 22_150_779}


def flow(c, y, o, d, meta):
    si = {s: i for i, s in enumerate(meta["states"])}
    yd = load(SITE / "commodity" / f"{c}.json")["years"][str(y)]
    f = next(f for f in yd["flows"] if f[0] == si[o] and f[1] == si[d])
    return f, f[2] / yd["inbound"][si[d]]


def test_commodity_examples(meta):
    f, s = flow("21", 2017, "IL", "WI", meta)
    assert abs(s - 0.6836) < 0.0006 and abs(f[2] * 1e3 / 11_827_959_976 - 1) < 1e-3
    f, s = flow("15", 2017, "WY", "SD", meta)
    assert abs(s - 1.0) < 0.0005 and f[4] == 114
    for y, exp in zip(YEARS, [0.7878, 0.68, 0.8519]):
        assert abs(flow("17", y, "LA", "MS", meta)[1] - exp) < 0.0005
    assert meta["centroidMiles"][meta["states"].index("TX")][meta["states"].index("NM")] == 582
    assert len(meta["adjacent"]) == 112


@pytest.mark.skipif(not FREIGHT.exists(), reason="3-D map preview data not on this machine")
@pytest.mark.parametrize("code", ["02", "15", "17", "21", "36", "43"])
def test_commodity_files_equal_the_map(code):
    text = (FREIGHT / f"c{code}.js").read_text()
    theirs = json.loads(re.search(r'window\.FREIGHT\["\d+"\]=(.*);\s*$', text, re.S).group(1))
    ours = load(SITE / "commodity" / f"{code}.json")
    assert ours == theirs


@pytest.mark.parametrize("year", YEARS)
def test_downloads_match_site_data(year, meta):
    net = load(SITE / "network" / f"{year}.json")
    with open(DOWNLOADS / str(year) / f"edges_{year}.csv") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == len(net["edges"])
    assert abs(sum(float(r["usd"]) for r in rows) / sum(e[2] for e in net["edges"]) - 1) < 1e-9
    with open(DOWNLOADS / str(year) / f"commodity_flows_{year}.csv") as f:
        rows = list(csv.DictReader(f))
    assert sum(int(r["records"]) for r in rows) == meta["commoditySeries"][str(year)]["records"]
    assert (
        abs(sum(float(r["usd"]) for r in rows) / meta["commoditySeries"][str(year)]["usd"] - 1)
        < 1e-9
    )


def test_checksums():
    for line in (DOWNLOADS / "SHA256SUMS.txt").read_text().splitlines():
        digest, name = line.split("  ")
        assert hashlib.sha256((DOWNLOADS / name).read_bytes()).hexdigest() == digest


def test_manifest_describes_every_csv():
    manifest = load(DOWNLOADS / "manifest.json")["files"]
    on_disk = sorted(str(p.relative_to(DOWNLOADS)) for p in DOWNLOADS.rglob("*.csv"))
    assert sorted(f["path"] for f in manifest) == on_disk
    for f in manifest:
        path = DOWNLOADS / f["path"]
        with open(path) as fh:
            lines = fh.read().splitlines()
        assert f["rows"] == len(lines) - 1
        assert f["columns"] == lines[0].split(",")
        assert f["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()


# RA: the lattice and each state's part of what pairs miss (analysis/higher_order/run_lattice.py).
HOI_OUT = ROOT / "analysis" / "higher_order" / "output"


@pytest.mark.parametrize("year", YEARS)
def test_ra_ladder_matches_the_lattice_run(year):
    ra = load(SITE / "ra" / f"{year}.json")
    rows = list(csv.DictReader((HOI_OUT / f"lattice_{year}.csv").open()))
    assert ra["postHoc"] is True
    assert [r["structure"] for r in ra["ladder"]] == [r["structure"] for r in rows]
    for r, c in zip(ra["ladder"], rows):
        assert abs(r["captured"] - float(c["captured_net"])) < 1e-4
        assert r["low"] <= r["captured"] <= r["high"]
    by = {r["structure"]: r for r in ra["ladder"]}
    assert by["O:D:C"]["captured"] == 0 and by["ODC"]["captured"] == 1
    pairs, distance = by["OD:OC:DC"]["captured"], by["OD:OC:DC+distance"]["captured"]
    assert by["OD:C"]["captured"] < pairs < distance < 1


@pytest.mark.parametrize("year", YEARS)
def test_ra_states_share_weighted_carry_is_one(year, meta):
    ra = load(SITE / "ra" / f"{year}.json")
    for side in ("shipping", "receiving"):
        s = ra[side]
        assert len(s["carry"]) == len(meta["states"])
        total = sum(w * c for w, c in zip(ra["share"][side], s["carry"]))
        assert abs(total - 1) < 0.01, (side, total)
        assert all(lo <= c <= hi for lo, c, hi in zip(s["low"], s["carry"], s["high"]))


def test_ra_cells_name_real_states_and_commodities(meta):
    ra = load(SITE / "ra" / "2017.json")
    codes = {c[0] for c in meta["commodities"]}
    assert set(ra["cells"]) <= set(meta["states"])
    for sides in ra["cells"].values():
        for cells in sides.values():
            assert len(cells) <= 5
            for partner, sctg, records, expected in cells:
                assert 0 <= partner < 51 and sctg in codes and records > expected


@pytest.mark.parametrize("year", YEARS)
def test_ra_size_adjustment_is_the_residual_of_the_size_slope(year):
    ra = load(SITE / "ra" / f"{year}.json")
    for side in ("shipping", "receiving"):
        s = ra[side]
        assert s["sizeSlope"] < 0
        logs = [math.log(v) for v in ra["share"][side]]
        fit = [math.log(c) - s["sizeSlope"] * x for c, x in zip(s["carry"], logs)]
        icept = sum(fit) / len(fit)
        for f, net in zip(fit, s["netOfSize"]):
            assert abs(f - icept - net) < 0.01
