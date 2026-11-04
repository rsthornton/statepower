"""
What persistence selects: size, distance, record support and bootstrap reproduction of
persistent versus transient majority links, and reproduction by distance from the 50%
threshold. Reads audit/output/variants_links.csv and bootstrap_link_reproduction.csv
(run run_variants.py and run_bootstrap.py first); writes audit/output/selection_*.
"""

import json

import numpy as np
import pandas as pd
from common import OUT

KEY = ["year", "o", "d", "SCTG"]


def main():
    links = pd.read_csv(OUT / "variants_links.csv", dtype={"SCTG": str})
    repro = pd.read_csv(OUT / "bootstrap_link_reproduction.csv", dtype={"SCTG": str})
    links = links.merge(repro[[*KEY, "reproduced"]], on=KEY, how="left")
    by = links.groupby(["year", "persistence"]).agg(
        links=("usd", "size"), median_usd=("usd", "median"), median_records=("records", "median"),
        median_r=("r", "median"), adjacent=("adjacent", "mean"),
        median_share=("share", "median"), mean_reproduced=("reproduced", "mean"),
    )
    margin = pd.cut(links.share, [0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0001])
    by_margin = links.groupby(margin, observed=True).agg(
        links=("usd", "size"), mean_reproduced=("reproduced", "mean"),
        median_records=("records", "median"))
    # sampling-only expectation of three-survey persistence for each link: product of
    # its own reproduction rate twice (two further independent surveys of the same economy)
    expect = links.groupby("year").apply(
        lambda g: pd.Series({"observed_persistent_share": (g.persistence == "persistent").mean(),
                             "sampling_only_expected": (g.reproduced**2).mean()}),
        include_groups=False)
    by.round(3).to_csv(OUT / "selection_by_persistence.csv")
    by_margin.round(3).to_csv(OUT / "selection_by_share_margin.csv")
    (OUT / "selection_summary.json").write_text(json.dumps(
        expect.round(4).to_dict(orient="index"), indent=1, default=str))
    print(by.round(3).to_string(), by_margin.round(3).to_string(), expect.round(3), sep="\n")


if __name__ == "__main__":
    main()
