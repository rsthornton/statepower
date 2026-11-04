import { useState } from "react";
import { common, int, pct, usd, type Balance, type Year } from "./data";

export type BringDir = "in" | "out";
export type BringHover = { sctg: string; dir: BringDir } | null;

const CAVEAT = "Domestic shipments only. The survey covers mines, manufacturers, wholesalers and some retail; it leaves out farms, crude oil from the well, and most foreign imports. Brought in is what arrived from other states, not total use.";

export function bringRows(bal: Balance, year: Year, state: number, dir: BringDir) {
  return bal.sctgs.map((c) => {
    const [i, ir, o, orr, w, wr, ti, to] = bal.years[year][c][state];
    const num = dir === "in" ? i : o;
    const den = num + w;
    const top = dir === "in" ? ti[0] : to[0];
    return { sctg: c, name: bal.names[c], share: den > 0 ? num / den : null, dollars: num, records: dir === "in" ? ir : orr, within: w, withinRec: wr,
      top, net: i > o ? "net receiver" : i < o ? "net shipper" : "balanced" };
  }).filter((r) => r.share !== null).sort((a, b) => (b.share as number) - (a.share as number) || b.dollars - a.dollars);
}

export function BringsIn({ bal, year, state, dir, setDir, hover, setHover }: {
  bal: Balance; year: Year; state: number; dir: BringDir; setDir: (d: BringDir) => void; hover: BringHover; setHover: (h: BringHover) => void;
}) {
  const cm = common();
  const [all, setAll] = useState(false);
  const rows = bringRows(bal, year, state, dir);
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <section className="fm-bring" data-testid="brings-in">
      <div className="fm-bring-head">
        <h3>What {cm.names[state]} {dir === "in" ? "brings in" : "sends out"}</h3>
        <div className="fm-seg" role="group" aria-label="Brings in or sends out">
          <button className={dir === "in" ? "on" : ""} onClick={() => setDir("in")} data-testid="bring-in">Brings in</button>
          <button className={dir === "out" ? "on" : ""} onClick={() => setDir("out")} data-testid="send-out">Sends out</button>
        </div>
      </div>
      <p className="small muted">{dir === "in"
        ? `Share brought in: what arrived from other states, as a share of that plus what moved within ${cm.names[state]}. ${year}, all 40 commodities, highest first.`
        : `Share sent out: what left for other states, as a share of that plus what moved within ${cm.names[state]}. ${year}, all 40 commodities, highest first.`}</p>
      {shown.map((r) => {
        const on = hover?.sctg === r.sctg && hover.dir === dir;
        return (
          <button
            key={r.sctg}
            className={`fm-bring-row${r.records < cm.thin ? " thin" : ""}${on ? " on" : ""}`}
            onMouseEnter={() => setHover({ sctg: r.sctg, dir })}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ sctg: r.sctg, dir })}
            onClick={() => setHover({ sctg: r.sctg, dir })}
            data-testid={`bring-row-${r.sctg}`}
          >
            <span className="nm">{r.name}<span className={`tag ${r.net === "net receiver" ? "recv" : "ship"}`}>{r.net}</span></span>
            <span className="bar"><i style={{ width: `${(r.share as number) * 100}%` }} /></span>
            <span className="v" data-testid={`bring-share-${r.sctg}`}>{pct(r.share as number)}</span>
            <span className="sub">
              {dir === "in" && (r.share as number) >= 0.5 ? "mostly from other states · " : ""}{usd(r.dollars)} {dir === "in" ? "received" : "sent"}
              {r.top ? `, mainly ${dir === "in" ? "from" : "to"} ${cm.names[r.top[0]]}, ${pct(r.top[1])}` : ""}
              {r.records < cm.thin ? ` · thin: ${int(r.records)} record${r.records === 1 ? "" : "s"}` : ""}
            </span>
          </button>
        );
      })}
      {rows.length > 12 && <button className="fm-btn ghost" onClick={() => setAll(!all)} data-testid="bring-all">{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
      <p className="small muted fm-caveat" data-testid="bring-caveat">{CAVEAT}</p>
    </section>
  );
}
