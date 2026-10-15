"""
Two top-10 lists, 2017: the ten states highest in trade prestige (in-flow
eigenvector) beside the ten highest in bridge position (betweenness). States on
both lists are joined; the others are marked with their rank on the other
measure, or "none" when their betweenness is zero.

Reads the dashboard's published centralities (web/public/data/centralities_51.json);
writes figures/ here.
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import font_manager

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "web" / "public" / "data" / "centralities_51.json"
OUT = HERE / "figures"
INK, MUTED, LINE = "#1f2a24", "#5a5c5b", "#b9c1bc"
PRESTIGE, BRIDGE = "#005a43", "#0072b2"
XL, XR = 0.0, 1.0


def font():
    names = {f.name for f in font_manager.fontManager.ttflist}
    for name in ("IBM Plex Sans", "Helvetica Neue", "Helvetica", "Arial"):
        if name in names:
            return name
    return "sans-serif"


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

    for s in both:
        y0, y1 = rows[s]["rank_eigenvector"], rows[s]["rank_betweenness"]
        ax.plot([XL + 0.09, XR - 0.09], [y0, y1], color=LINE, lw=3, zorder=1)

    for s in prestige:
        y = rows[s]["rank_eigenvector"]
        alone = s not in both
        c = PRESTIGE if alone else INK
        ax.text(XL - 0.02, y, f"{y}", ha="right", va="center", fontsize=24, color=MUTED)
        ax.text(XL + 0.0, y, s, ha="left", va="center", fontsize=30, fontweight="bold", color=c)
        if alone:
            other = "bridge rank: none" if s not in brokers else f"bridge rank {rows[s]['rank_betweenness']}"
            ax.text(XL + 0.11, y, other, ha="left", va="center", fontsize=22, color=PRESTIGE, style="italic")

    for s in bridge:
        y = rows[s]["rank_betweenness"]
        alone = s not in both
        c = BRIDGE if alone else INK
        ax.text(XR + 0.0, y, s, ha="right", va="center", fontsize=30, fontweight="bold", color=c)
        ax.text(XR + 0.02, y, f"{y}", ha="left", va="center", fontsize=24, color=MUTED)
        if alone:
            ax.text(XR - 0.11, y, f"prestige rank {rows[s]['rank_eigenvector']}", ha="right", va="center",
                    fontsize=22, color=BRIDGE, style="italic")

    ax.text(XL, 0.0, "Top 10 in trade prestige", ha="left", va="bottom", fontsize=28, fontweight="bold", color=PRESTIGE)
    ax.text(XR, 0.0, "Top 10 in bridge position", ha="right", va="bottom", fontsize=28, fontweight="bold", color=BRIDGE)
    ax.text(0.5, 11.1, f"Gray lines: on both lists ({len(both)} states).  "
            f"{51 - len(brokers)} of 51 states broker no routes at all.",
            ha="center", va="top", fontsize=21, color=MUTED)

    ax.set_xlim(-0.08, 1.08)
    ax.set_ylim(11.9, -0.9)
    ax.axis("off")
    fig.subplots_adjust(left=0.03, right=0.97, top=0.97, bottom=0.03)
    OUT.mkdir(exist_ok=True)
    for ext in ("png", "svg"):
        fig.savefig(OUT / f"top10-prestige-vs-bridge-2017.{ext}", facecolor="white")
    print("prestige", prestige)
    print("bridge", bridge)
    print("both", sorted(both))


if __name__ == "__main__":
    main()
