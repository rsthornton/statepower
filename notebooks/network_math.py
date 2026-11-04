# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "marimo",
#     "pandas==2.3.1",
#     "numpy==2.3.2",
#     "altair==5.5.0",
#     "plotly==5.24.1",
# ]
# [tool.marimo.display]
# theme = "light"
# ///

import marimo

__generated_with = "0.23.8"
app = marimo.App(width="full", auto_download=["html"])

with app.setup(hide_code=True):
    import pandas as pd
    import numpy as np
    import altair as alt
    import plotly.express as px
    import marimo as mo
    import io

    # Data inlined from viz/data/*.csv so the notebook runs self-contained in a
    # browser WASM kernel (molab / marimo Cloud) with no filesystem access.
    _CENTRALITIES_CSV = """state_id,label,betweenness,eigenvector,out_degree,rank_betweenness,rank_eigenvector,rank_out_degree
6,CA,0.506122,0.309053,1.000000,1,2,1
48,TX,0.262857,0.371410,0.751976,2,1,2
36,NY,0.203265,0.290221,0.506828,3,3,7
42,PA,0.167755,0.241298,0.679378,4,7,4
17,IL,0.144898,0.252299,0.750789,5,6,3
25,MA,0.113061,0.097417,0.276643,6,22,17
39,OH,0.100816,0.267610,0.592153,7,4,5
53,WA,0.097959,0.102527,0.265489,8,21,18
27,MN,0.060000,0.084294,0.282741,9,26,16
13,GA,0.047347,0.197682,0.470041,10,11,10
8,CO,0.040000,0.069734,0.135678,11,28,31
37,NC,0.035102,0.150187,0.436896,12,13,12
19,IA,0.025714,0.064726,0.230628,13,31,22
51,VA,0.024898,0.128090,0.237228,14,15,20
24,MD,0.020000,0.104622,0.164852,15,20,28
22,LA,0.015510,0.111356,0.192163,16,17,25
47,TN,0.010612,0.164833,0.481051,17,12,9
29,MO,0.005714,0.111091,0.309702,18,18,14
26,MI,0.004082,0.216665,0.455857,19,8,11
18,IN,0.002857,0.200740,0.484304,20,10,8
44,RI,0.000000,0.011950,0.060230,21,46,40
45,SC,0.000000,0.110592,0.231858,21,19,21
46,SD,0.000000,0.011894,0.037304,21,47,43
49,UT,0.000000,0.060815,0.132414,21,33,32
40,OK,0.000000,0.093710,0.121389,21,24,33
50,VT,0.000000,0.011874,0.030173,21,48,45
38,ND,0.000000,0.025825,0.042310,21,40,42
54,WV,0.000000,0.037784,0.062533,21,36,39
41,OR,0.000000,0.066402,0.144813,21,30,30
35,NM,0.000000,0.031639,0.023833,21,38,46
1,AL,0.000000,0.092047,0.229895,21,25,23
33,NH,0.000000,0.027337,0.063342,21,39,38
2,AK,0.000000,0.009274,0.005832,21,51,49
4,AZ,0.000000,0.097213,0.153863,21,23,29
5,AR,0.000000,0.054696,0.117005,21,35,34
9,CT,0.000000,0.066599,0.207223,21,29,24
10,DE,0.000000,0.019866,0.065058,21,42,36
11,DC,0.000000,0.011182,0.001796,21,49,50
12,FL,0.000000,0.263732,0.257017,21,5,19
15,HI,0.000000,0.016752,0.001535,21,45,51
16,ID,0.000000,0.018993,0.046488,21,43,41
20,KS,0.000000,0.059335,0.184869,21,34,26
21,KY,0.000000,0.135501,0.290912,21,14,15
23,ME,0.000000,0.018961,0.034035,21,44,44
28,MS,0.000000,0.076198,0.173923,21,27,27
55,WI,0.000000,0.127759,0.340689,21,16,13
30,MT,0.000000,0.023661,0.017099,21,41,48
31,NE,0.000000,0.031901,0.104429,21,37,35
32,NV,0.000000,0.063537,0.064484,21,32,37
34,NJ,0.000000,0.211918,0.522331,21,9,6
56,WY,0.000000,0.009351,0.019084,21,50,47
"""

    _GDP_CSV = """state_abbrev,state_name,gdp_2017_q4_millions
AK,Alaska,54403
AL,Alabama,213903
AR,Arkansas,126263
AZ,Arizona,327933
CA,California,2802289
CO,Colorado,351666
CT,Connecticut,265876
DC,District of Columbia,134000
DE,Delaware,74978
FL,Florida,984138
GA,Georgia,563784
HI,Hawaii,89302
IA,Iowa,191072
ID,Idaho,73324
IL,Illinois,835642
IN,Indiana,364649
KS,Kansas,160390
KY,Kentucky,205935
LA,Louisiana,251058
MA,Massachusetts,537127
MD,Maryland,400630
ME,Maine,62519
MI,Michigan,512762
MN,Minnesota,353283
MO,Missouri,309190
MS,Mississippi,113387
MT,Montana,48604
NC,North Carolina,547187
ND,North Dakota,55894
NE,Nebraska,123120
NH,New Hampshire,82030
NJ,New Jersey,601940
NM,New Mexico,99129
NV,Nevada,160140
NY,New York,1564340
OH,Ohio,661077
OK,Oklahoma,192343
OR,Oregon,240695
PA,Pennsylvania,767580
RI,Rhode Island,60685
SC,South Carolina,222216
SD,South Dakota,50277
TN,Tennessee,351966
TX,Texas,1747212
UT,Utah,169130
VA,Virginia,517548
VT,Vermont,32594
WA,Washington,517236
WI,Wisconsin,330842
WV,West Virginia,78767
WY,Wyoming,41365
"""

    _COORDS_CSV = """state_abbr,state_name,lat,lon
AL,Alabama,32.806671,-86.791130
AK,Alaska,61.370716,-152.404419
AZ,Arizona,33.729759,-111.431221
AR,Arkansas,34.969704,-92.373123
CA,California,36.116203,-119.681564
CO,Colorado,39.059811,-105.311104
CT,Connecticut,41.597782,-72.755371
DE,Delaware,39.318523,-75.507141
FL,Florida,27.766279,-81.686783
GA,Georgia,33.040619,-83.643074
HI,Hawaii,21.094318,-157.498337
ID,Idaho,44.240459,-114.478828
IL,Illinois,40.349457,-88.986137
IN,Indiana,39.849426,-86.258278
IA,Iowa,42.011539,-93.210526
KS,Kansas,38.526600,-96.726486
KY,Kentucky,37.668140,-84.670067
LA,Louisiana,31.169546,-91.867805
ME,Maine,44.693947,-69.381927
MD,Maryland,39.063946,-76.802101
MA,Massachusetts,42.230171,-71.530106
MI,Michigan,43.326618,-84.536095
MN,Minnesota,45.694454,-93.900192
MS,Mississippi,32.741646,-89.678696
MO,Missouri,38.456085,-92.288368
MT,Montana,46.921925,-110.454353
NE,Nebraska,41.125370,-98.268082
NV,Nevada,38.313515,-117.055374
NH,New Hampshire,43.452492,-71.563896
NJ,New Jersey,40.298904,-74.521011
NM,New Mexico,34.840515,-106.248482
NY,New York,42.165726,-74.948051
NC,North Carolina,35.630066,-79.806419
ND,North Dakota,47.528912,-99.784012
OH,Ohio,40.388783,-82.764915
OK,Oklahoma,35.565342,-96.928917
OR,Oregon,44.572021,-122.070938
PA,Pennsylvania,40.590752,-77.209755
RI,Rhode Island,41.680893,-71.511780
SC,South Carolina,33.856892,-80.945007
SD,South Dakota,44.299782,-99.438828
TN,Tennessee,35.747845,-86.692345
TX,Texas,31.054487,-97.563461
UT,Utah,40.150032,-111.862434
VT,Vermont,44.045876,-72.710686
VA,Virginia,37.769337,-78.169968
WA,Washington,47.400902,-121.490494
WV,West Virginia,38.491226,-80.954453
WI,Wisconsin,44.268543,-89.616508
WY,Wyoming,42.755966,-107.302490
DC,District of Columbia,38.897438,-77.026817
"""

    _c51 = pd.read_csv(io.StringIO(_CENTRALITIES_CSV)).rename(columns={"label": "state"})
    _gdp = pd.read_csv(io.StringIO(_GDP_CSV))
    _gdp["gdp_billions"] = _gdp["gdp_2017_q4_millions"] / 1000
    _gdp["gdp_rank"] = _gdp["gdp_billions"].rank(ascending=False, method="min").astype(int)
    _coords = pd.read_csv(io.StringIO(_COORDS_CSV))

    df = _c51.merge(
        _gdp[["state_abbrev", "gdp_billions", "gdp_rank"]],
        left_on="state", right_on="state_abbrev", how="left",
    ).drop(columns=["state_abbrev"])
    df = df.merge(
        _coords[["state_abbr", "state_name"]],
        left_on="state", right_on="state_abbr", how="left",
    ).drop(columns=["state_abbr"])
    df["divergence"] = df["gdp_rank"] - df["rank_eigenvector"]
    df["abs_divergence"] = df["divergence"].abs()

    STATE_LIST = sorted(
        [(row["state_name"], row["state"]) for _, row in df.iterrows()],
        key=lambda x: x[0],
    )

    # ── Brand chart theming (echoes web/DESIGN.md) ──────────────────────────
    BRAND_FONT = "Inter, system-ui, sans-serif"
    INK, INK2, MUTED = "#1a1a2e", "#4a4a6a", "#8888a8"
    HAIRLINE, BORDER = "#eeecf3", "#e4e1ec"
    # measure colors (canonical, from web/src/lib/colors.ts)
    C_EIGEN, C_BETWEEN, C_OUTDEG, C_RED = "#44cc88", "#4488ff", "#ff9944", "#dd3344"

    @alt.theme.register("ipo", enable=True)
    def _ipo_altair_theme():
        return {
            "config": {
                "font": BRAND_FONT,
                "background": "transparent",
                "view": {"stroke": "transparent"},
                "axis": {
                    "labelColor": MUTED,
                    "titleColor": INK2,
                    "gridColor": HAIRLINE,
                    "domainColor": BORDER,
                    "tickColor": BORDER,
                    "labelFont": BRAND_FONT,
                    "titleFont": BRAND_FONT,
                    "titleFontWeight": 500,
                },
                "title": {
                    "color": INK,
                    "subtitleColor": MUTED,
                    "font": BRAND_FONT,
                    "subtitleFont": BRAND_FONT,
                    "fontWeight": 600,
                    "anchor": "start",
                },
                "legend": {"labelColor": INK2, "titleColor": MUTED, "labelFont": BRAND_FONT},
            }
        }

    def style_plotly(fig):
        """Apply the brand font + transparent surfaces to a Plotly figure."""
        fig.update_layout(
            font=dict(family=BRAND_FONT, color=INK2, size=13),
            hoverlabel=dict(font=dict(family=BRAND_FONT)),
            geo=dict(bgcolor="rgba(0,0,0,0)", lakecolor="rgba(0,0,0,0)"),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig


@app.cell(hide_code=True)
def _():
    # Brand stylesheet — injected inline so it travels with the single .py to
    # molab/WASM (same reasoning as the inlined CSV). Echoes web/DESIGN.md tokens.
    mo.Html(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        :root { --ipo-ink:#1a1a2e; --ipo-ink2:#4a4a6a; --ipo-muted:#8888a8; --ipo-accent:#2266dd; }

        body {
            background:
              radial-gradient(1100px 460px at 50% -160px, rgba(119,68,204,0.08), transparent 70%),
              radial-gradient(900px 400px at 100% 0%, rgba(34,102,221,0.05), transparent 60%),
              #f5f5fb !important;
            background-attachment: fixed;
        }

        body, .markdown.prose {
            font-family: "Inter", system-ui, sans-serif;
            color: var(--ipo-ink);
        }
        .markdown.prose { --tw-prose-body: var(--ipo-ink2); --tw-prose-headings: var(--ipo-ink); }
        .markdown.prose p, .markdown.prose li { color: var(--ipo-ink2); line-height: 1.7; }
        .markdown.prose strong { color: var(--ipo-ink); }

        .markdown.prose :is(h1,h2,h3,h4) {
            font-family: "Inter", system-ui, sans-serif;
            letter-spacing: -0.02em; color: var(--ipo-ink);
        }
        .markdown.prose h1 {
            font-weight: 300; line-height: 1.08;
            background: linear-gradient(115deg,#1a1a2e 30%,#463080 75%,#6a3aa8 100%);
            -webkit-background-clip: text; background-clip: text; color: transparent;
            width: fit-content;
        }
        .markdown.prose h2 { font-weight: 500; margin-top: 2.2rem; }
        .markdown.prose h3 { font-weight: 600; }

        .markdown.prose code, code { font-family: "JetBrains Mono", monospace; }
        .markdown.prose a { color: var(--ipo-accent); text-decoration: none; }
        .markdown.prose a:hover { text-decoration: underline; }

        /* tables (state lookup) — lighter, mono numerals */
        .markdown.prose table { font-size: 0.9rem; }
        .markdown.prose th { color: var(--ipo-muted); font-weight: 500; }
        .markdown.prose td { color: var(--ipo-ink2); }

        /* callouts: rounder, softer to match the dashboard cards */
        marimo-callout-output > * { border-radius: 12px !important; }

        /* mono eyebrow + footer */
        .ipo-eyebrow {
            font-family: "JetBrains Mono", monospace; text-transform: uppercase;
            letter-spacing: 0.18em; font-size: 0.7rem; color: var(--ipo-muted);
            margin: 0 0 0.4rem 0;
        }
        .ipo-footer { font-size: 0.8rem; color: var(--ipo-muted); }
        .ipo-footer a { color: var(--ipo-accent); }
        </style>
        """
    )
    return


@app.cell(hide_code=True)
def _():
    mo.md("""
    <div class="ipo-eyebrow">The Interstate Power Observatory · The Math</div>

    # What GDP Misses About Your State's Economy

    If someone asked you to rank the 50 states by economic importance,
    you'd probably reach for GDP. California, Texas, New York — the usual suspects.

    But what if that ranking is **systematically wrong about 40% of states?**

    GDP answers one question: *how much does this state produce?*

    There's a different question: *how does this state sit within the web of
    trade relationships across the country?*

    **Those are fundamentally different questions, and they need different math.**
    This notebook shows you why — with concrete examples you can explore yourself.
    """)
    return


@app.cell(hide_code=True)
def _():
    _fig = px.choropleth(
        df,
        locations="state",
        locationmode="USA-states",
        color="gdp_billions",
        color_continuous_scale="Blues",
        scope="usa",
        hover_name="state_name",
        hover_data={"gdp_billions": ":.0f", "gdp_rank": True, "state": False},
        labels={"gdp_billions": "GDP ($B)", "gdp_rank": "GDP Rank"},
    )
    _fig.update_layout(
        title=None,
        geo=dict(bgcolor="rgba(0,0,0,0)", lakecolor="rgba(0,0,0,0)"),
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        coloraxis_colorbar=dict(title="GDP ($B)"),
        height=380,
    )
    style_plotly(_fig)
    mo.vstack([
        mo.md("## The Familiar Map"),
        mo.ui.plotly(_fig),
        mo.callout(
            mo.md(
                "**Top 5 by GDP:** California (\$2,802B), Texas (\$1,747B), "
                "New York (\$1,564B), Florida (\$984B), Illinois (\$836B)"
            ),
            kind="info",
        ),
        mo.md("*This map measures how much each state produces. It says nothing about how states connect.*"),
    ])
    return


@app.cell(hide_code=True)
def _():
    mo.md("""
    ## Same Totals, Different Structures

    Before we look at real data, consider a thought experiment. Here are two
    tiny trade networks. **Every node has the same total trade volume** — \$100
    billion in and \$100 billion out. By GDP logic, they're all equally important.

    But look at the *structure:*
    """)
    return


@app.cell(hide_code=True)
def _():
    # Two toy networks — same totals, different structures
    # Hub-and-spoke
    _hub_nodes = pd.DataFrame({
        "node": ["A", "B", "C", "D", "E"],
        "x": [300, 150, 450, 150, 450],
        "y": [200, 50, 50, 350, 350],
        "total_trade": [100, 100, 100, 100, 100],
        "color": ["#dd3344", "#4488ff", "#4488ff", "#4488ff", "#4488ff"],
    })

    _hub = alt.Chart(_hub_nodes).mark_circle(size=1200, stroke="white", strokeWidth=2).encode(
        x=alt.X("x:Q", scale=alt.Scale(domain=[0, 600]), axis=alt.Axis(labels=False, ticks=False, domain=False, title=None, grid=False)),
        y=alt.Y("y:Q", scale=alt.Scale(domain=[0, 400]), axis=alt.Axis(labels=False, ticks=False, domain=False, title=None, grid=False)),
        color=alt.Color("color:N", scale=None),
        tooltip=["node:N", "total_trade:Q"],
    )
    _hub_labels = alt.Chart(_hub_nodes).mark_text(fontSize=16, fontWeight="bold", color="white").encode(
        x="x:Q", y="y:Q", text="node:N",
    )

    _hub_edge_data = pd.DataFrame([
        {"x": 300, "y": 200, "x2": 150, "y2": 50},
        {"x": 300, "y": 200, "x2": 450, "y2": 50},
        {"x": 300, "y": 200, "x2": 150, "y2": 350},
        {"x": 300, "y": 200, "x2": 450, "y2": 350},
    ])
    _hub_edges = alt.Chart(_hub_edge_data).mark_rule(color="#aaa", strokeWidth=2).encode(
        x="x:Q", y="y:Q", x2="x2:Q", y2="y2:Q",
    )

    _hub_chart = (_hub_edges + _hub + _hub_labels).properties(
        width=280, height=220, title=alt.Title("Hub-and-Spoke", subtitle="A is central — remove it and the network collapses")
    )

    # Ring
    _ring_nodes = pd.DataFrame({
        "node": ["A", "B", "C", "D", "E"],
        "x": [300, 105, 180, 420, 495],
        "y": [50, 200, 370, 370, 200],
        "total_trade": [100, 100, 100, 100, 100],
    })

    _ring = alt.Chart(_ring_nodes).mark_circle(size=1200, color="#4488ff", stroke="white", strokeWidth=2).encode(
        x=alt.X("x:Q", scale=alt.Scale(domain=[0, 600]), axis=alt.Axis(labels=False, ticks=False, domain=False, title=None, grid=False)),
        y=alt.Y("y:Q", scale=alt.Scale(domain=[0, 400]), axis=alt.Axis(labels=False, ticks=False, domain=False, title=None, grid=False)),
        tooltip=["node:N", "total_trade:Q"],
    )
    _ring_labels = alt.Chart(_ring_nodes).mark_text(fontSize=16, fontWeight="bold", color="white").encode(
        x="x:Q", y="y:Q", text="node:N",
    )

    _ring_edge_data = pd.DataFrame([
        {"x": 300, "y": 50, "x2": 105, "y2": 200},
        {"x": 105, "y": 200, "x2": 180, "y2": 370},
        {"x": 180, "y": 370, "x2": 420, "y2": 370},
        {"x": 420, "y": 370, "x2": 495, "y2": 200},
        {"x": 495, "y": 200, "x2": 300, "y2": 50},
    ])
    _ring_edges = alt.Chart(_ring_edge_data).mark_rule(color="#aaa", strokeWidth=2).encode(
        x="x:Q", y="y:Q", x2="x2:Q", y2="y2:Q",
    )

    _ring_chart = (_ring_edges + _ring + _ring_labels).properties(
        width=280, height=220, title=alt.Title("Ring", subtitle="No node is special — remove any one, the rest still connect")
    )

    mo.vstack([
        mo.hstack([_hub_chart, _ring_chart]),
        mo.callout(
            mo.md(
                "**Every node trades \$100B total.** But in the hub network, Node A is clearly "
                "the most important — remove it and the network falls apart. In the ring, no "
                "node is special.\n\n"
                "**This is what GDP misses.** GDP would rank all five nodes equally in both "
                "networks. Network centrality sees the difference: A's *position* makes it "
                "powerful, not its *size*."
            ),
            kind="warn",
        ),
    ])
    return


@app.cell(hide_code=True)
def _():
    mo.md("""
    ## Now Apply This to Real States

    The Census Bureau tracks what every state ships to every other state —
    billions of dollars of physical goods across 2,534 trade routes between
    51 states. When we compute each state's *position* in that network
    (using the same logic as the hub example), and compare it to GDP, the
    results are surprising.

    **Green = states whose network position exceeds their GDP rank** (structurally undervalued)

    **Purple = states whose GDP overstates their trade network importance** (structurally overvalued)
    """)
    return


@app.cell(hide_code=True)
def _():
    _fig = px.choropleth(
        df,
        locations="state",
        locationmode="USA-states",
        color="divergence",
        color_continuous_scale="PRGn",
        color_continuous_midpoint=0,
        range_color=[-15, 15],
        scope="usa",
        hover_name="state_name",
        hover_data={"gdp_rank": True, "rank_eigenvector": True, "divergence": True, "state": False},
        labels={"divergence": "Divergence", "gdp_rank": "GDP Rank", "rank_eigenvector": "Network Rank"},
    )
    _fig.update_layout(
        title=None,
        geo=dict(bgcolor="rgba(0,0,0,0)", lakecolor="rgba(0,0,0,0)"),
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        coloraxis_colorbar=dict(title="Divergence<br>(+ = undervalued<br>by GDP)"),
        height=400,
    )
    style_plotly(_fig)
    mo.ui.plotly(_fig)
    return


@app.cell(hide_code=True)
def _():
    mo.hstack(
        [
            mo.callout(
                mo.md(
                    "**Structurally undervalued** (network > GDP)\n\n"
                    "- **Kentucky** (+14): GDP #28, Network #14\n"
                    "- **Mississippi** (+10): GDP #37, Network #27\n"
                    "- **Montana** (+8): GDP #49, Network #41\n"
                    "- **Louisiana** (+7): GDP #24, Network #17\n"
                    "- **South Carolina** (+7): GDP #26, Network #19\n\n"
                    "*Manufacturing, energy, and agricultural states. They make, "
                    "extract, and ship physical goods — connecting them to the "
                    "biggest hubs in the network.*"
                ),
                kind="success",
            ),
            mo.callout(
                mo.md(
                    "**Structurally overvalued** (GDP > network)\n\n"
                    "- **DC** (-15): GDP #34, Network #49\n"
                    "- **Massachusetts** (-11): GDP #11, Network #22\n"
                    "- **Minnesota** (-9): GDP #17, Network #26\n"
                    "- **Colorado** (-9): GDP #19, Network #28\n"
                    "- **Washington** (-8): GDP #13, Network #21\n\n"
                    "*Service and knowledge economies. High GDP from finance, "
                    "tech, healthcare — but less central in the physical "
                    "trade network.*"
                ),
                kind="danger",
            ),
        ],
        widths="equal",
    )
    return


@app.cell(hide_code=True)
def _():
    mo.md("""
    ### The Kentucky Story

    Kentucky's GDP ranks **#28** — a modest, mid-tier economy at \$206 billion.
    But its network centrality ranks **#14**, placing it in the top quarter.

    Why? Kentucky is a manufacturing and logistics nexus: automobiles
    (Toyota's largest North American plant), bourbon, tobacco, and coal. It
    sits at the crossroads of I-65, I-64, I-71, and I-75. It trades heavily
    with Ohio (#4 in the network), Indiana (#10), Tennessee (#12), and
    Illinois (#6).

    **Its trading partners are themselves major hubs.** Think back to the toy
    example: Kentucky is like a spoke connected directly to Node A. That
    connection to the hub raises its importance — even though its own
    economy is mid-tier.

    This recursive relationship — importance flowing through connections — is
    exactly what network centrality measures and GDP cannot.
    """)
    return


@app.cell(hide_code=True)
def _():
    mo.callout(
        mo.md(
            '''
            ### The Peninsula Puzzle: Florida

            Florida is the **4th largest economy** in the nation at nearly \$1 trillion.
            Its network prestige is #5 — roughly proportional.

            But here's the puzzle: Florida sits on **zero** of the shortest trade paths
            between other states. Of 51 states, 31 share this property — but Florida
            is the largest economy among them.

            Why? Geography. A peninsula has no through-traffic. Trade flows *into*
            Florida (consumer goods for 22 million residents), but the major corridors
            between other states bypass it entirely.

            In our toy example, Florida is a spoke connected to the hub — well-connected
            but not a *bridge*. If supply chains need to reroute, Florida has no
            alternative paths. It's a well-connected dead end.
            '''
        ),
        kind="info",
    )
    return


@app.cell(hide_code=True)
def _():
    _options = {name: abbr for name, abbr in STATE_LIST}
    state_picker = mo.ui.dropdown(options=_options, value="Indiana", label="Select a state")
    mo.vstack([
        mo.md("## Look Up Your State"),
        mo.md("Every state has a unique structural fingerprint in the trade network."),
        state_picker,
    ])
    return (state_picker,)


@app.cell(hide_code=True)
def _(state_picker):
    _abbr = state_picker.value or "IN"
    _row = df[df["state"] == _abbr].iloc[0]
    _div = int(_row["divergence"])

    _kind = "info" if abs(_div) < 3 else ("success" if _div > 0 else "danger")
    _status = (
        "**Proportional** — GDP and network position roughly aligned"
        if abs(_div) < 3
        else f"**Punches above weight** (+{_div}) — network position exceeds GDP"
        if _div > 0
        else f"**Punches below weight** ({_div}) — GDP overstates network role"
    )

    mo.vstack([
        mo.md(
            f"### {_row['state_name']} ({_abbr})\n\n"
            f"| Measure | Value | Rank |\n"
            f"|---------|-------|------|\n"
            f"| **GDP (2017)** | ${_row['gdp_billions']:.0f}B | #{int(_row['gdp_rank'])} |\n"
            f"| **Eigenvector** (trade prestige) | {_row['eigenvector']:.4f} | #{int(_row['rank_eigenvector'])} |\n"
            f"| **Betweenness** (bridge position) | {_row['betweenness']:.4f} | #{int(_row['rank_betweenness'])} |\n"
            f"| **Out-Degree** (export reach) | {_row['out_degree']:.4f} | #{int(_row['rank_out_degree'])} |"
        ),
        mo.callout(mo.md(_status), kind=_kind),
    ])
    return


@app.cell(hide_code=True)
def _(state_picker):
    _abbr = state_picker.value or "IN"
    _sel = df[df["state"] == _abbr]

    _enc = dict(
        x=alt.X("gdp_rank:Q", title="GDP Rank (1 = largest economy)", scale=alt.Scale(domain=[1, 51])),
        y=alt.Y("rank_eigenvector:Q", title="Network Rank (1 = most central)", scale=alt.Scale(domain=[1, 51])),
    )

    # diagonal reference (y = x: GDP rank == network rank)
    _diag = alt.Chart(pd.DataFrame({"x": [1, 51], "y": [1, 51]})).mark_line(
        strokeDash=[5, 5], color=BORDER,
    ).encode(x="x:Q", y="y:Q")

    # all states, colored by divergence (PRGn, centered at 0)
    _dots = alt.Chart(df).mark_circle(size=90, opacity=0.9, stroke="white", strokeWidth=1).encode(
        color=alt.Color(
            "divergence:Q",
            scale=alt.Scale(scheme="purplegreen", domainMid=0, domain=[-15, 15]),
            legend=None,
        ),
        tooltip=["state_name:N", "gdp_rank:Q", "rank_eigenvector:Q", "divergence:Q"],
        **_enc,
    )

    # the selected state, highlighted
    _highlight = alt.Chart(_sel).mark_point(
        size=280, color=C_RED, filled=True, stroke="white", strokeWidth=2,
    ).encode(tooltip=["state_name:N"], **_enc)

    mo.vstack([
        mo.md("*Above the diagonal = structurally undervalued by GDP. Below = overvalued.*"),
        mo.ui.altair_chart((_diag + _dots + _highlight).properties(width=560, height=420)),
    ])
    return


@app.cell(hide_code=True)
def _():
    mo.vstack([
        mo.md(
            '''
            ## Why the Math Is Different

            ### GDP Is Addition. Centrality Is Multiplication.

            **GDP** sums up everything produced within a state. It's a tally. Each state's
            number is independent — California's GDP doesn't affect Kentucky's GDP.

            **Network centrality** works differently. Your score depends on the scores of
            the states that ship to you. If Kentucky receives large shipments from Ohio (a
            major hub), Kentucky's centrality goes up. If Ohio in turn receives heavily from
            Texas (another giant), that *indirectly* raises Kentucky's centrality too.

            It's recursive: importance flows through the network.

            This is why GDP and centrality can diverge: **GDP captures what you produce on
            your own. Centrality captures who you're embedded with.**
            '''
        ),
        mo.accordion(
            {
                "A bit more formally...": mo.md(
                    "A state's eigenvector centrality is proportional to the weighted "
                    "sum of the centralities of the states that ship to it. If you "
                    "receive heavily from important states, you become important. If "
                    "they receive from other important states, your importance "
                    "compounds. GDP has no such feedback loop: it's a simple aggregate, "
                    "while centrality is a fixed-point solution to a system of "
                    "simultaneous equations.\n\n"
                    "Direction matters on a directed network. This is the in-flow "
                    "version (NetworkX's default, the left eigenvector of the "
                    "origin-by-destination flow matrix). The same calculation on "
                    "outgoing flows agrees closely overall (Spearman 0.95) but moves "
                    "some states: Florida ranks 5th on in-flow and 17th on out-flow."
                ),
            }
        ),
        mo.md(
            '''
            ### The Bridge vs the Hub

            There's a second kind of structural role that GDP misses entirely.
            **Betweenness** asks: does trade between *other* states have to flow
            through you?

            Only **20 of 51 states** have any betweenness at all. The entire
            network's shortest trade paths flow through just CA, TX, NY, PA, IL,
            and a handful of others.

            You can be a major hub (high prestige) without being a bridge (zero
            betweenness). Florida is the perfect example — prestige #5 but zero
            betweenness. Conversely, Massachusetts is GDP #11 and prestige #22
            (underperformer), but **betweenness #6** — it sits on critical trade
            routes even though its own trade volume is modest.
            '''
        ),
    ])
    return


@app.cell(hide_code=True)
def _():
    mo.vstack([
        mo.md("## Why This Matters"),
        mo.md(
            '''
            States with high network centrality but low GDP are *structurally
            undervalued*: policymakers planning infrastructure investment based on
            GDP alone are systematically under-investing in the states that hold
            the trade network together.
            '''
        ),
        mo.hstack(
            [
                mo.callout(
                    mo.md(
                        "**GDP measures size.**\n"
                        "**Centrality measures position.**\n\n"
                        "They diverge for 40% of states."
                    ),
                    kind="neutral",
                ),
                mo.callout(
                    mo.md(
                        "**Manufacturing, energy, and agricultural states** are "
                        "structurally undervalued by GDP. Service economies are "
                        "structurally overvalued."
                    ),
                    kind="neutral",
                ),
                mo.callout(
                    mo.md(
                        "**Infrastructure policy, supply chain planning, and "
                        "investment decisions** should account for network position, "
                        "not just economic output."
                    ),
                    kind="neutral",
                ),
            ],
            widths="equal",
        ),
        mo.md(
            '''
            ---

            <div class="ipo-footer">
            <strong>Explore the interactive map →</strong>
            <a href="https://statepower.systems/" target="_blank">The Interstate Power Observatory</a>

            <strong>Data:</strong> U.S. Census Bureau Commodity Flow Survey 2017 ·
            <strong>Analysis:</strong> Thornton (2026), <em>Interstate Commerce Network Centrality</em>, Master's Thesis, Binghamton University ·
            <strong>Method:</strong> eigenvector, betweenness, and weighted out-degree centrality on a directed network of 51 nodes, 2,534 edges ·
            Built by Halcyonic Systems
            </div>
            '''
        ),
    ])
    return


if __name__ == "__main__":
    app.run()
