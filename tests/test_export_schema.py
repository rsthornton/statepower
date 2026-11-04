"""Schema smoke test for the web data contract.

Validates the committed JSON in web/public/data/ against the shapes the React app
(and src/types.ts) expect. Reads existing files only: no gated CFS data, no pipeline
run, nothing under evolution/. Mirrors web/DESIGN.md's
data-contract reference.
"""

import json
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "data"

# state_name is carried by national rows only (commodity rows omit it).
BASE_CENTRALITY_KEYS = {
    "state_id", "state",
    "betweenness", "eigenvector", "out_degree",
    "rank_betweenness", "rank_eigenvector", "rank_out_degree",
    "gdp_billions", "gdp_rank",
}
EDGE_KEYS = {
    "source", "target", "weight",
    "source_lat", "source_lon", "target_lat", "target_lon",
}


def load(name):
    return json.loads((DATA_DIR / name).read_text())


@pytest.mark.parametrize("name,count", [("centralities_51.json", 51), ("centralities_52.json", 52)])
def test_national_centralities(name, count):
    rows = load(name)
    assert len(rows) == count
    assert (BASE_CENTRALITY_KEYS | {"state_name", "lat", "lon"}).issubset(rows[0].keys())


def test_commodity_centralities():
    rows = load("commodity_centralities.json")
    assert len(rows) > 0
    assert (BASE_CENTRALITY_KEYS | {"commodity_code", "commodity_name"}).issubset(rows[0].keys())


def test_top_edges():
    edges = load("top_edges.json")
    assert len(edges) > 0
    assert EDGE_KEYS.issubset(edges[0].keys())


def test_network_stats():
    stats = load("network_stats.json")
    assert {"nodes", "edges", "density", "clustering_coefficient", "reciprocity"}.issubset(stats)


def test_metadata():
    meta = load("metadata.json")
    assert "commodity_groups" in meta and "sctg_names" in meta


def test_rank_changes():
    rows = load("rank_changes.json")
    assert len(rows) > 0
    assert {"state", "betweenness_change", "eigenvector_change", "out_degree_change"}.issubset(
        rows[0].keys()
    )


def test_state_trade_totals():
    rows = load("state_trade_totals.json")
    assert len(rows) == 51
    r = rows[0]
    assert {"state", "out_total", "in_total", "top_out", "top_in"}.issubset(r.keys())
    assert {"partner", "weight"}.issubset(r["top_out"][0].keys())
    # Smaller states must carry real totals, not the top-N display artifact of $0.
    me = next(x for x in rows if x["state"] == "ME")
    assert me["out_total"] > 0 and me["in_total"] > 0
