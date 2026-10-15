"""
Boundary sensitivity of bridge position, 2017: the top 10 states by
betweenness in the domestic network (51 nodes) beside the top 10 once a single
rest-of-world node is added (52 nodes). States are ranked among states only, so
the world node, which becomes the largest bridge, does not push every state
down one place. States whose betweenness falls to zero are labelled "no
brokerage" rather than given the shared tied rank.

Reads the dashboard's published centralities (web/public/data/centralities_51.json
and centralities_52.json); writes figures/ here.
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch, PathPatch
from matplotlib.path import Path as MPath

HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "web" / "public" / "data"
OUT = HERE / "figures"
INK, MUTED, LINE = "#1f2a24", "#6b726e", "#aab4ae"
DOM, WORLD = "#0072b2", "#b35c00"
CARD_D, CARD_W = "#e8f1f8", "#f8efe6"
L0, L1 = 0.0, 0.36
R0, R1 = 0.64, 1.0


def font():
    names = {f.name for f in font_manager.fontManager.ttflist}
    for name in ("IBM Plex Sans", "Helvetica Neue", "Helvetica", "Arial"):
        if name in names:
            return name
    return "sans-serif"


def ranks(path):
    rows = {r["state"]: r["betweenness"] for r in json.loads(path.read_text())}
    states = {s: v for s, v in rows.items() if s != "RoW"}
    assert len(states) == 51
    order = sorted((s for s in states if states[s] > 0), key=lambda s: -states[s])
    return {s: i + 1 for i, s in enumerate(order)}, rows


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def card(ax, x0, x1, color, top):
    ax.add_patch(FancyBboxPatch((x0, top), x1 - x0, 10.6 - top, boxstyle="round,pad=0,rounding_size=0.02",
                                facecolor=color, edgecolor="none", zorder=0, mutation_aspect=12))


def connector(ax, y0, y1):
    xa, xb = L1 + 0.01, R0 - 0.01
    mid = (xa + xb) / 2
    path = MPath([(xa, y0), (mid, y0), (mid, y1), (xb, y1)],
                 [MPath.MOVETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4])
    ax.add_patch(PathPatch(path, facecolor="none", edgecolor=LINE, lw=3.2, capstyle="round", zorder=1))
    ax.scatter([xa, xb], [y0, y1], s=70, color=LINE, zorder=2)


def main():
    dom, _ = ranks(DATA / "centralities_51.json")
    wld, raw52 = ranks(DATA / "centralities_52.json")
    assert max(raw52, key=raw52.get) == "RoW"
    left = [s for s, r in sorted(dom.items(), key=lambda x: x[1]) if r <= 10]
    right = [s for s, r in sorted(wld.items(), key=lambda x: x[1]) if r <= 10]
    both = set(left) & set(right)
    stopped = sorted(s for s in dom if s not in wld)
    assert "OH" in stopped and not [s for s in wld if s not in dom]

    plt.rcParams["font.family"] = font()
    fig, ax = plt.subplots(figsize=(16, 9.6), dpi=200)
    fig.patch.set_facecolor("white")
    card(ax, L0, L1, CARD_D, -0.95)
    card(ax, R0, R1, CARD_W, -2.05)

    ax.text(L0 + 0.03, -0.3, "U.S. only", ha="left", va="center",
            fontsize=27, fontweight="bold", color=DOM)
    ax.text(R0 + 0.03, -1.4, "With the world", ha="left", va="center",
            fontsize=27, fontweight="bold", color=WORLD)
    ax.add_patch(FancyBboxPatch((R0 + 0.03, -0.62), R1 - R0 - 0.06, 0.66, boxstyle="round,pad=0,rounding_size=0.015",
                                facecolor=WORLD, edgecolor="none", zorder=1, mutation_aspect=12))
    ax.text(R0 + 0.05, -0.29, "World node: largest bridge", ha="left", va="center",
            fontsize=22, fontweight="bold", color="white", zorder=2)

    for s in both:
        connector(ax, dom[s], wld[s])

    for s in left:
        y = dom[s]
        alone = s not in both
        ax.text(L0 + 0.065, y, f"{y}", ha="right", va="center", fontsize=22, color=MUTED)
        ax.text(L0 + 0.09, y, s, ha="left", va="center", fontsize=29, fontweight="bold", color=DOM if alone else INK)
        if alone:
            note = "no brokerage" if s not in wld else f"{ordinal(wld[s])} with world"
            ax.text(L1 - 0.025, y, note, ha="right", va="center", fontsize=21, color=DOM)

    for s in right:
        y = wld[s]
        alone = s not in both
        ax.text(R0 + 0.065, y, f"{y}", ha="right", va="center", fontsize=22, color=MUTED)
        ax.text(R0 + 0.09, y, s, ha="left", va="center", fontsize=29, fontweight="bold", color=WORLD if alone else INK)
        if alone:
            ax.text(R1 - 0.025, y, f"{ordinal(dom[s])} U.S. only", ha="right", va="center", fontsize=21, color=WORLD)

    ax.text(0.5, 11.25, f"Lines join the {len(both)} states on both lists.  {len(stopped)} states stop brokering "
            f"when the world is added: {', '.join(stopped)}.", ha="center", va="top", fontsize=20, color=MUTED)

    ax.set_xlim(-0.01, 1.01)
    ax.set_ylim(11.8, -2.25)
    ax.axis("off")
    fig.subplots_adjust(left=0.02, right=0.98, top=0.98, bottom=0.02)
    OUT.mkdir(exist_ok=True)
    for ext in ("png", "svg"):
        fig.savefig(OUT / f"boundary-bridges-2017.{ext}", facecolor="white")
    print("domestic", left)
    print("world", right)
    print("stopped", stopped)


if __name__ == "__main__":
    main()
