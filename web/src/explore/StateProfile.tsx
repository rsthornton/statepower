import { common, pct, usd, type Balance, type Year } from "./data";

type Item = { c: string; usd: number; note: string; thin: boolean };

const MAJORITY = 0.5;

/** What one state ships, receives and depends on, by commodity, for one survey year. */
export function stateProfile(bal: Balance, year: Year, state: number) {
  const rows = bal.years[year];
  const thin = common().thin;
  const ships: Item[] = [];
  const receives: Item[] = [];
  const leansOn: Item[] = [];
  const leanedOn: (Item & { share: number })[] = [];
  for (const c of Object.keys(rows)) {
    const all = rows[c];
    const r = all[state];
    const national = all.reduce((a, x) => a + x[2], 0);
    if (r[2] > 0) ships.push({ c, usd: r[2], note: `${pct(r[2] / national)} of US interstate supply`, thin: r[3] < thin });
    if (r[0] > 0) receives.push({ c, usd: r[0], note: r[6][0] ? `top supplier ${common().states[r[6][0][0]]}, ${pct(r[6][0][1])}` : "", thin: r[1] < thin });
    const top = r[6][0];
    if (top && top[1] > MAJORITY) {
      leansOn.push({ c, usd: r[0], note: `${common().names[top[0]]} supplies ${pct(top[1])}`, thin: r[1] < thin });
    }
    if (r[2] > 0 && all.every((x, i) => i === state || x[2] < r[2])) {
      leanedOn.push({ c, usd: r[2], note: `${pct(r[2] / national)} of US interstate supply`, thin: r[3] < thin, share: r[2] / national });
    }
  }
  const byUsd = (a: Item, b: Item) => b.usd - a.usd;
  return {
    ships: ships.sort(byUsd).slice(0, 5),
    receives: receives.sort(byUsd).slice(0, 5),
    leansOn: leansOn.sort(byUsd).slice(0, 6),
    leanedOn: leanedOn.sort((a, b) => b.share - a.share).slice(0, 6),
  };
}

function List({ title, items, names, onCommodity, empty, test }: {
  title: string; items: Item[]; names: Record<string, string>; onCommodity: (c: string) => void; empty: string; test: string;
}) {
  return (
    <section className="fm-profile" data-testid={test}>
      <h3>{title}</h3>
      {items.length ? items.map((it) => (
        <button key={it.c} className={`fm-profile-row${it.thin ? " thin" : ""}`} onClick={() => onCommodity(it.c)} title="Show this commodity's flows">
          <span>{names[it.c]}</span>
          <b>{usd(it.usd)}</b>
          <span className="muted small">{it.note}{it.thin ? " · few records" : ""}</span>
        </button>
      )) : <p className="muted small">{empty}</p>}
    </section>
  );
}

export function StateProfile({ bal, year, state, onCommodity }: { bal: Balance; year: Year; state: number; onCommodity: (c: string) => void }) {
  const p = stateProfile(bal, year, state);
  const name = common().names[state];
  return (
    <div data-testid="state-profile">
      <List title="Ships most" items={p.ships} names={bal.names} onCommodity={onCommodity} empty="No interstate shipments recorded." test="profile-ships" />
      <List title="Receives most" items={p.receives} names={bal.names} onCommodity={onCommodity} empty="No interstate receipts recorded." test="profile-receives" />
      <List title="Leans on one supplier" items={p.leansOn} names={bal.names} onCommodity={onCommodity}
        empty={`No commodity where one state supplies over half of what ${name} receives.`} test="profile-leans" />
      <List title="Largest US supplier of" items={p.leanedOn} names={bal.names} onCommodity={onCommodity}
        empty={`${name} is not the largest interstate supplier of any commodity.`} test="profile-leaned" />
      <p className="small muted">Dollars are interstate shipments of 40 commodities in {year}. "Leans on" means one state supplies over half of {name}'s receipts of that commodity; a share describes observed flows, not whether the supplier could be replaced. Select a commodity to see its flows.</p>
    </div>
  );
}
