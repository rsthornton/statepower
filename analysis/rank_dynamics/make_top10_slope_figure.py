"""
Two top-10 lists, 2017: the ten states highest in trade prestige (in-flow
eigenvector) beside the ten highest in bridge position (betweenness). Each list
sits on its own card; states on both lists are joined across the gap. The
others carry their rank on the other measure, or "none" when their betweenness
is zero.

Reads the dashboard's published centralities (web/public/data/centralities_51.json);
writes figures/ here.
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch, PathPatch
from matplotlib.path import Path as MPath

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "web" / "public" / "data" / "centralities_51.json"
OUT = HERE / "figures"
INK, MUTED, LINE = "#1f2a24", "#6b726e", "#aab4ae"
PRESTIGE, BRIDGE = "#005a43", "#0072b2"
CARD_P, CARD_B = "#eaf2ee", "#e8f1f8"
L0, L1 = 0.0, 0.36
R0, R1 = 0.64, 1.0


def font():
    names = {f.name for f in font_manager.fontManager.ttflist}
    for name in ("IBM Plex Sans", "Helvetica Neue", "Helvetica", "Arial"):
        if name in names:
            return name
    return "sans-serif"


def card(ax, x0, x1, color):
    ax.add_patch(FancyBboxPatch((x0, -0.95), x1 - x0, 11.55, boxstyle="round,pad=0,rounding_size=0.02",
                                facecolor=color, edgecolor="none", zorder=0, mutation_aspect=12))


def connector(ax, y0, y1):
    xa, xb = L1 + 0.01, R0 - 0.01
    mid = (xa + xb) / 2
    path = MPath([(xa, y0), (mid, y0), (mid, y1), (xb, y1)],
                 [MPath.MOVETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4])
    ax.add_patch(PathPatch(path, facecolor="none", edgecolor=LINE, lw=3.2, capstyle="round", zorder=1))
    ax.scatter([xa, xb], [y0, y1], s=70, color=LINE, zorder=2)


def main():
    rows = {r["state"]: r for r in json.loads(DATA.read_text())}
    assert len(rows) == 51
    brokers = {s for s, r in rows.items() if r["betweenness"] > 0}
    prestige = sorted(rows, key=lambda s: rows[s]["rank_eigenvector"])[:10]
    bridge = sorted(brokers, key=lambda s: rows[s]["rank_betweenness"])[:10]
    both = set(prestige) & set(bridge)
    assert {"FL", "MA"} <= set(prestige) ^ set(bridge)

    plt.rcParams["font.family"] = font()
    fig, ax = plt.subplots(figsize=(16, 9), dpi=200)
    fig.patch.set_facecolor("white")
    card(ax, L0, L1, CARD_P)
    card(ax, R0, R1, CARD_B)

    ax.text(L0 + 0.03, -0.3, "Top 10 in trade prestige", ha="left", va="center",
            fontsize=27, fontweight="bold", color=PRESTIGE)
    ax.text(R0 + 0.03, -0.3, "Top 10 in bridge position", ha="left", va="center",
            fontsize=27, fontweight="bold", color=BRIDGE)

    for s in both:
        connector(ax, rows[s]["rank_eigenvector"], rows[s]["rank_betweenness"])

    for s in prestige:
        y = rows[s]["rank_eigenvector"]
        alone = s not in both
        ax.text(L0 + 0.065, y, f"{y}", ha="right", va="center", fontsize=22, color=MUTED)
        ax.text(L0 + 0.09, y, s, ha="left", va="center", fontsize=29, fontweight="bold",
                color=PRESTIGE if alone else INK)
        if alone:
            note = "bridge rank: none" if s not in brokers else f"bridge rank {rows[s]['rank_betweenness']}"
            ax.text(L1 - 0.025, y, note, ha="right", va="center", fontsize=21, color=PRESTIGE)

    for s in bridge:
        y = rows[s]["rank_betweenness"]
        alone = s not in both
        ax.text(R0 + 0.065, y, f"{y}", ha="right", va="center", fontsize=22, color=MUTED)
        ax.text(R0 + 0.09, y, s, ha="left", va="center", fontsize=29, fontweight="bold",
                color=BRIDGE if alone else INK)
        if alone:
            ax.text(R1 - 0.025, y, f"prestige rank {rows[s]['rank_eigenvector']}", ha="right", va="center",
                    fontsize=21, color=BRIDGE)

    ax.text(0.5, 11.25, f"Lines join the {len(both)} states on both lists.  "
            f"{51 - len(brokers)} of 51 states lie on no shortest paths.",
            ha="center", va="top", fontsize=21, color=MUTED)

    ax.set_xlim(-0.01, 1.01)
    ax.set_ylim(11.8, -1.15)
    ax.axis("off")
    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.02)
    OUT.mkdir(exist_ok=True)
    for ext in ("png", "svg"):
        fig.savefig(OUT / f"top10-prestige-vs-bridge-2017.{ext}", facecolor="white")
    print("prestige", prestige)
    print("bridge", bridge)
    print("both", sorted(both))


if __name__ == "__main__":
    main()
