// Browser smoke checks for the Explore page (3-D map) and the dashboard root.
// Run against a running server: BASE_URL=http://127.0.0.1:5190 CHROME=/path/to/chrome npm run e2e
// Numbers shown on the page are compared with the site's own data files in public/data/v2.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:5190";
const DATA = new URL("../public/data/v2/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("meta.json", DATA)));
const com = (c) => JSON.parse(readFileSync(new URL(`commodity/${c}.json`, DATA)));
const network = (y) => JSON.parse(readFileSync(new URL(`network/${y}.json`, DATA)));
const ra = (y) => JSON.parse(readFileSync(new URL(`ra/${y}.json`, DATA)));
const S = meta.states;

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    const p = join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (existsSync(p)) return p;
  }
  throw new Error("set CHROME to a Chromium executable");
}

// Same formatting as src/explore/data.ts.
function usd(k) {
  const v = k * 1e3;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}
const pct = (x) => (x >= 0.995 && x < 1 ? "over 99%" : x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);

const failures = [];
let passed = 0;
function check(ok, msg) {
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
  ok ? passed++ : failures.push(msg);
}

const CANVAS = '[data-testid="map-canvas"]';
const SIG = (sel) => {
  const c = document.querySelector(sel);
  const g = document.createElement("canvas");
  g.width = 48; g.height = 48;
  const x = g.getContext("2d");
  x.drawImage(c, 0, 0, 48, 48);
  return Array.from(x.getImageData(0, 0, 48, 48).data);
};
const diff = (a, b) => a.reduce((n, v, i) => n + (Math.abs(v - b[i]) > 12 ? 1 : 0), 0) / a.length;
function nonblank(px) {
  let lit = 0;
  const seen = new Set();
  for (let i = 0; i < px.length; i += 4) {
    if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) > 30) lit++;
    seen.add(`${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`);
  }
  return { lit: lit / (px.length / 4), colors: seen.size };
}

async function open(page, query) {
  await page.goto("about:blank"); // a hash-only change would not reload the app
  await page.goto(`${BASE}/explore${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  await page.waitForTimeout(1500);
}
const sig = (page) => page.evaluate(SIG, CANVAS);
async function clickAt(page, p) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
}

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const [name, w, h] of [["desktop", 1280, 820], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await open(page, "?t=4&intro=0#c=17&y=2022&v=flows");
  const nb = nonblank(await sig(page));
  // A blank canvas is ~0 lit. The home view frames Alaska and Hawaii too, so the map covers less of it than before.
  check(nb.lit > 0.05 && nb.colors > 20, `${name}: canvas non-blank (${JSON.stringify(nb)})`);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check(sw <= cw, `${name}: no horizontal scroll (${sw} <= ${cw})`);
  check((await page.locator('[data-testid^="scope-"]').count()) === 2 && (await page.locator('[data-testid^="view-"]').count()) === 2,
    `${name}: scope (all / one commodity) above Flows and Reliance; Beyond pairs hidden from visitors`);
  check((await page.locator('[data-testid^="ra-"]').count()) === 0, `${name}: no RA elements outside Beyond pairs`);

  const flows = await sig(page);
  await page.click('[data-testid="view-reliance"]');
  await page.waitForTimeout(1200);
  check(diff(flows, await sig(page)) > 0.05, `${name}: Reliance view changes the scene`);
  const reliance = await sig(page);
  await page.click('[data-testid="year-2012"]');
  await page.waitForTimeout(1200);
  check(diff(reliance, await sig(page)) > 0.005, `${name}: year switch changes the scene`);

  if (name === "desktop") {
    await page.fill('[data-testid="commodity-input"]', "coal");
    await page.click('[data-testid="commodity-opt-15"]');
    await page.waitForTimeout(1500);
    check((await page.inputValue('[data-testid="commodity-input"]')) === "Coal", "desktop: commodity search switches to coal");
    check((await page.innerText('[data-testid="commodity-usd"]')) === usd(com("15").years["2012"].usd), "desktop: coal total equals the data file");

    await open(page, "?t=4&intro=0#c=21&y=2017&v=reliance");
    const tx = S.indexOf("TX");
    await clickAt(page, await page.evaluate((i) => window.__freight.stateScreen(i), tx));
    await page.waitForTimeout(1800);
    const yd = com("21").years["2017"];
    const loc = yd.local.TX;
    const got = {
      title: await page.innerText('[data-testid="state-panel"] h2'),
      inb: await page.innerText('[data-testid="state-inbound"]'),
      sup: await page.innerText('[data-testid="state-supply"]'),
      top: await page.innerText('[data-testid="state-top"]'),
    };
    check(
      got.title === "Texas" && got.inb === usd(yd.inbound[tx]) && got.sup === usd(yd.supply[tx]) && got.top === `${loc[0]}, ${pct(loc[1])}`,
      `desktop: clicking Texas opens its panel with the data file's numbers (${JSON.stringify(got)})`,
    );
    await page.waitForSelector('[data-testid="brings-in"], [data-testid="state-panel"]');

    await open(page, "?t=4&intro=0#c=17&y=2022&v=flows");
    const o = S.indexOf("LA"), d = S.indexOf("MS");
    await clickAt(page, await page.evaluate(([a, b]) => window.__freight.arcApex(a, b), [o, d]));
    await page.waitForTimeout(1800);
    const g = com("17").years["2022"];
    const f = g.flows.find((x) => x[0] === o && x[1] === d);
    const title = await page.innerText('[data-testid="route-panel"] h2');
    const share = await page.innerText('[data-testid="route-share"]');
    check(title === "Louisiana → Mississippi" && share === pct(f[2] / g.inbound[d]),
      `desktop: clicking the LA→MS arc opens that route with the file's share (${title}, ${share})`);

    await page.goto(`${BASE}/explore?t=4#v=flows`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    await page.click('[data-testid="tour-start"]');
    await page.click('[data-testid="tour-rail-5"]');
    await page.waitForFunction(() => /Mississippi/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
    const tour = await page.innerText('[data-testid="tour-text"]');
    check(tour.includes(pct(f[2] / g.inbound[d])) && tour.includes("Pipeline transmission"), "desktop: tour stop 6 quotes the data file's share and the energy coverage limit");
    const say6 = await page.waitForFunction((t) => [...document.querySelectorAll('.map-label[data-tone="callout"]')].some((e) => e.style.display !== "none" && e.textContent === t),
      `${pct(f[2] / g.inbound[d])} of Mississippi's interstate gasoline comes from Louisiana`, { timeout: 5000 }).then(() => true, () => false);
    check(say6, "desktop: tour stop 6 pins its takeaway on Mississippi");
    {
      // Another good on stop 6: the route where a mid-size or larger state leans hardest on one supplier, from the data file.
      const p = com("21").years["2022"];
      const med = [...p.inbound].sort((a, b) => a - b)[Math.floor(p.inbound.length / 2)];
      const top = p.flows.filter((x) => x[3] >= meta.thin && p.inbound[x[1]] >= med && p.inbound[x[1]] > 0)
        .reduce((b, x) => (!b || x[2] / p.inbound[x[1]] > b[2] / p.inbound[b[1]] ? x : b), null);
      await page.click('[data-testid="tour-pick-21"]');
      const ok = await page.waitForFunction((n) => (document.querySelector('[data-testid="tour-text"]')?.textContent ?? "").startsWith(`${n}.`), meta.names[top[1]], { timeout: 5000 }).then(() => true, () => false);
      const t21 = await page.innerText('[data-testid="tour-text"]');
      const routeOk = await page.waitForFunction((n) => document.querySelector('[data-testid="route-panel"] h2')?.textContent === n, `${meta.names[top[0]]} → ${meta.names[top[1]]}`, { timeout: 5000 }).then(() => true, () => false);
      check(ok && t21.includes(pct(top[2] / p.inbound[top[1]])) && !t21.includes("Pipeline") && routeOk && (await page.locator('[data-testid="tour-card"]').count()) === 1,
        `desktop: picking pharmaceuticals on stop 6 keeps the tour and answers from commodity/21.json (${S[top[0]]}→${S[top[1]]})`);
      await page.click('[data-testid="tour-pick-17"]');
      await page.waitForFunction(() => /^Mississippi\./.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
    }
    check(/^Mapping: .+, 2022$/.test(await page.innerText('[data-testid="legend-commodity"]')), "desktop: the legend names the commodity being mapped");

    // Position view: the dashboard's measures in the 3-D scene, checked against network/<year>.json.
    await open(page, "?t=4#y=2017&v=position&m=eigenvector");
    const n17 = network(2017);
    const ky = S.indexOf("KY");
    await clickAt(page, await page.evaluate((i) => window.__freight.stateScreen(i), ky));
    await page.waitForTimeout(1800);
    const r = n17.states[ky];
    const pos = {
      title: await page.innerText('[data-testid="position-state-panel"] h2'),
      rank: await page.innerText('[data-testid="pos-eigenvector"]'),
      bridge: await page.innerText('[data-testid="pos-betweenness"]'),
      gdp: await page.innerText('[data-testid="pos-gdp"]'),
      gap: await page.innerText('[data-testid="pos-gap"]'),
    };
    check(pos.title === "Kentucky" && pos.rank === `#${r.rank_eigenvector}` && pos.bridge === (r.no_brokerage ? "no brokerage" : `#${r.rank_betweenness}`)
      && pos.gdp === `#${r.gdp_rank}` && pos.gap === `+${r.gap_eigenvector}`,
      `desktop: Position panel for Kentucky equals network/2017.json (${JSON.stringify(pos)})`);
    await page.waitForSelector('[data-testid="profile-ships"] .fm-profile-row');
    const bal = JSON.parse(readFileSync(new URL("balance/2017.json", DATA)));
    const kyOut = Object.entries(bal.rows).map(([c, rows]) => [c, rows[ky][2]]).sort((a, b) => b[1] - a[1])[0];
    const shipsFirst = await page.innerText('[data-testid="profile-ships"] .fm-profile-row:first-of-type span:first-child');
    const shipsUsd = await page.innerText('[data-testid="profile-ships"] .fm-profile-row:first-of-type b');
    check(shipsFirst === bal.names[kyOut[0]] && shipsUsd === usd(kyOut[1]),
      `desktop: Kentucky's top shipped commodity equals balance/2017.json (${shipsFirst}, ${shipsUsd})`);
    const leans = Object.entries(bal.rows).filter(([, rows]) => rows[ky][6][0] && rows[ky][6][0][1] > 0.5).length;
    check((await page.locator('[data-testid="profile-leans"] .fm-profile-row').count()) === Math.min(6, leans),
      `desktop: "leans on one supplier" lists the file's majority-supplier commodities (${leans})`);
    await page.click('[data-testid="tab-rankings"]');
    check((await page.locator('[data-testid="rankings-panel"] tbody tr').count()) === 51, "desktop: rankings table lists all 51");
    const first = await page.innerText('[data-testid="rankings-panel"] tbody tr:first-child td:nth-child(2)');
    const top = n17.states.find((x) => x.rank_eigenvector === 1).name;
    check(first === top, `desktop: rankings table starts with the file's #1 (${first})`);
    const before = await sig(page);
    await page.selectOption('[data-testid="measure"]', "betweenness");
    await page.waitForTimeout(1500);
    check(/sits between two others/.test(await page.innerText('[data-testid="measure-plain"]')), "desktop: the measure picker explains bridge position in one plain sentence");
    const bt = n17.states.find((x) => x.rank_betweenness === 1);
    const btGap = await page.innerText('[data-testid="rankings-panel"] tbody tr:first-child td:nth-child(4)');
    const want = bt.gdp_rank - 1 === 0 ? "0" : (bt.gdp_rank - 1 > 0 ? "+" : "") + (bt.gdp_rank - 1);
    check(btGap.replace("\u2212", "-") === want || btGap === want, `desktop: rankings gap follows the chosen measure (${bt.state} bridge #1, gap ${btGap}, want ${want})`);
    check(diff(before, await sig(page)) > 0.01, "desktop: switching measure changes the scene");
    const before2d = await sig(page);
    await page.click('[data-testid="persp-2d"]');
    await page.waitForTimeout(1500);
    check(diff(before2d, await sig(page)) > 0.05, "desktop: 2D perspective changes the scene");
    await page.locator('[data-testid="topn"]').fill("410");
    check((await page.innerText('[data-testid="topn-value"]')) === "All", "desktop: link slider reaches All");

    for (const tab of ["measure", "about"]) {
      await page.click(`[data-testid="tab-${tab}"]`);
      const text = await page.innerText(`[data-testid="panel-${tab}"]`);
      check(!/\bRA\b|Cliff|course|Beyond distance/.test(text), `desktop: ${tab} tab has no RA or course references`);
    }
  }
  check(errors.length === 0, `${name}: no page or console errors (${errors.join(" | ")})`);
  await page.close();
}

// Reduced motion: the arc pulse stops, so two frames a second apart are identical. Control: without
// reduced motion the same two frames differ, so the check can fail.
{
  const ctl = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await open(ctl, "?intro=0#c=17&y=2022&v=flows");
  const c0 = await sig(ctl);
  await ctl.waitForTimeout(1000);
  check(diff(c0, await sig(ctl)) > 0, "control: without reduced motion the arcs animate");
  await ctl.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page, "?intro=0#c=17&y=2022&v=flows");
  const a = await sig(page);
  await page.waitForTimeout(1000);
  check(diff(a, await sig(page)) === 0, "reduced motion: animation frozen");
  await open(page, "?intro=0#y=2017&v=position");
  const still = await page.getAttribute('[data-testid="commodity-browse"]', "placeholder");
  check(still === `Search ${meta.commodities.length} commodities`, `reduced motion: commodity hint does not cycle (${still})`);
  await ctx.close();
}

// All-commodities view: the commodity box shows the range (cycling hint, full list by dollars) and maps one on pick.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await open(page, "?t=4#y=2017&v=position");
  const BOX = '[data-testid="commodity-browse"]';
  const h0 = await page.getAttribute(BOX, "placeholder");
  await page.waitForTimeout(2600);
  const h1 = await page.getAttribute(BOX, "placeholder");
  check(/^Try: /.test(h0) && h0 !== h1, `browse: hint cycles through commodities (${h0} → ${h1})`);
  const label = await page.getAttribute(BOX, "aria-label");
  check(label === `Map one commodity (${meta.commodities.length} available)`, `browse: fixed accessible name (${label})`);
  await page.click(BOX);
  const ids = await page.$$eval('[role="option"]', (els) => els.map((e) => e.id.replace("commodity-opt-", "")));
  const want = [...meta.commodities].sort((a, b) => b[2]["2017"][0] - a[2]["2017"][0]).map((c) => c[0]);
  check(ids.length === meta.commodities.length && ids.join() === want.join(),
    `browse: list shows all ${want.length} commodities by 2017 dollars (first ${ids[0]})`);
  await page.click(`[data-testid="commodity-opt-${want[0]}"]`);
  await page.waitForFunction(() => document.querySelector('[data-testid="commodity-input"]'));
  const name = meta.commodities.find((c) => c[0] === want[0])[1];
  const onOne = (await page.getAttribute('[data-testid="scope-one"]', "aria-pressed")) === "true";
  check(onOne && (await page.inputValue('[data-testid="commodity-input"]')) === name, `browse: picking maps that commodity (${name})`);
  await page.close();
}

// Home is the map on Position, 2017; /classic redirects home (vercel.json).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  const onPosition = (await page.getAttribute('[data-testid="scope-all"]', "aria-pressed")) === "true";
  const on2017 = (await page.getAttribute('[data-testid="year-2017"]', "aria-pressed")) === "true";
  check(onPosition && on2017, "home: / opens the map on all commodities (Position), 2017");
  await page.waitForSelector('[data-testid="opening"]', { timeout: 5000 }).catch(() => null);
  const quote = await page.locator('[data-testid="opening-quote"]').innerText().catch(() => "");
  check(/property of the social relation/.test(quote) && (await page.locator('[data-testid="tour-card"]').count()) === 0
    && (await page.locator('[data-testid="opening-steps"] li b').allInnerTexts()).join(" | ") === "GDP is a total. | Power is a relation. | So follow the ties.",
    "home: first visit opens on the Emerson quote and the argument in three beats, the tour card waits behind it");
  await page.click('[data-testid="opening-start"]');
  await page.waitForSelector('[data-testid="tour-card"]', { timeout: 5000 }).catch(() => null);
  check((await page.locator('[data-testid="opening"]').count()) === 0, "home: Start the tour closes the opening");
  const n17 = network(2017);
  const first = [...n17.states].sort((x, y) => x.rank_eigenvector - y.rank_eigenvector)[0].name;
  const lead = await page.locator('[data-testid="tour-lead"]').innerText().catch(() => "");
  const byGdp = [...n17.states].sort((x, y) => x.gdp_rank - y.gdp_rank);
  await page.waitForFunction(() => /stand tallest/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
  const sizeText = await page.innerText('[data-testid="tour-text"]');
  check(lead === "Start with the usual picture of power: size." && (await page.locator('.fm-rail li').count()) === 9,
    `home: first visit opens the tour on the GDP picture (nine stops, Beyond pairs held back)`);
  check(byGdp.slice(0, 3).every((x) => sizeText.includes(x.name)) && (await page.locator('[data-testid="legend-gdp"]').count()) === 1
    && (await page.evaluate(() => window.__freight.arcCount())) === 0,
    `home: stop 1 maps GDP alone, no ties drawn, and names the top three from network/2017.json (${byGdp.slice(0, 3).map((x) => x.state).join(", ")})`);
  await page.click('[data-testid="tour-next"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="tour-lead"]')?.textContent === "Now add the ties.");
  const tiesDrawn = await page.waitForFunction(() => window.__freight.arcCount() > 0, null, { timeout: 5000 }).then(() => true, () => false);
  check(tiesDrawn && (await page.locator('[data-testid="legend-gdp"]').count()) === 1 && /all commodities combined, in dollars/.test(await page.innerText('[data-testid="tour-text"]')),
    "home: stop 2 draws the ties over the same GDP map and says what a line is");
  await page.click('[data-testid="tour-next"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="tour-lead"]')?.textContent === "Measure each state by its ties instead.");
  check((await page.locator('[data-testid="legend-gdp"]').count()) === 0 && (await page.inputValue('[data-testid="measure"]')) === "eigenvector"
    && /well-cited papers/.test(await page.innerText('[data-testid="tour-text"]')),
    "home: stop 3 switches the map to trade prestige and defines it in the card");
  check((await page.innerText('[data-testid="tagline"]')) === "GDP is not equivalent to economic power.", "home: the claim sits beside the title");
  check((await page.getAttribute('[data-testid="nav-code"]', "href")) === "https://github.com/rsthornton/statepower", "home: the nav links to the repository");
  await page.click('[data-testid="tab-measure"]');
  const mp = await page.innerText('[data-testid="measure-panel"]');
  check(["trade prestige", "bridge position", "export reach"].every((m) => mp.toLowerCase().includes(m)), "home: How it's measured defines the three network measures");
  await page.click('[data-testid="tab-state"]');
  await page.click('[data-testid="tour-next"]');
  await page.waitForFunction(() => /first by trade prestige|leads by both/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
  const tourText = await page.innerText('[data-testid="tour-text"]');
  const callout = async () => page.waitForFunction(() => {
    const el = [...document.querySelectorAll('.map-label[data-tone="callout"]')].find((e) => e.style.display !== "none" && e.style.visibility !== "hidden");
    return el?.textContent || false;
  }, null, { timeout: 5000 }).then((h) => h.jsonValue(), () => "");
  const markLabels = async () => page.evaluate(() => [...document.querySelectorAll(".map-label")].filter((el) => el.style.display !== "none" && /prestige #\d+ · GDP #\d+/.test(el.textContent ?? "")).map((el) => el.textContent));
  const tx = n17.states.find((x) => x.state === "TX"), ca = n17.states.find((x) => x.state === "CA");
  const txMarks = await markLabels();
  const txSay = await callout();
  check(tourText.startsWith(`${first}.`) && txSay === `Texas: ${tx.rank_eigenvector}st by ties, ${tx.gdp_rank}nd by GDP` && txMarks.includes(`CA prestige #${ca.rank_eigenvector} · GDP #${ca.gdp_rank}`),
    `home: stop 4 opens on its answer from network/2017.json, pins it on Texas and labels California's ranks (${first} first; ${txSay}; ${txMarks.join(" | ")})`);
  check(/s=\d+/.test(await page.evaluate(() => location.hash)), "home: stop 4 selects the state, so only its trade is drawn");
  await page.click('[data-testid="tour-rail-4"]');
  await page.waitForFunction(() => /Kentucky is/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
  const ky = n17.states.find((x) => x.state === "KY");
  const ma = n17.states.find((x) => x.state === "MA");
  const kyText = await page.innerText('[data-testid="tour-text"]');
  const kyFrom = n17.edges.filter((e) => e[1] === "KY").sort((a, b) => b[2] - a[2]).slice(0, 4).map((e) => n17.states.find((x) => x.state === e[0]).name);
  check(kyText.startsWith(`Kentucky is ${ky.gdp_rank}th by GDP but ${ky.rank_eigenvector}th by trade prestige`) && kyText.includes(`reverse: ${ma.gdp_rank}th by GDP, ${ma.rank_eigenvector}nd by trade prestige`)
    && kyFrom.every((n) => kyText.includes(n)) && (await markLabels()).length === 1 && (await callout()) === `Kentucky: ${ky.gdp_rank}th by GDP, ${ky.rank_eigenvector}th by ties`,
    `home: Kentucky stop quotes network/2017.json (KY ${ky.gdp_rank}/${ky.rank_eigenvector}, MA ${ma.gdp_rank}/${ma.rank_eigenvector}, suppliers ${kyFrom.join(", ")}) and labels both`);
  await page.click('[data-testid="tour-rail-6"]');
  await page.waitForFunction(() => /every survey/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
  const reg = JSON.parse(readFileSync(new URL("registered.json", DATA)));
  const rho = (pair) => reg.pairs.find((p) => p.pair === pair).H1.measures.eigenvector.spearman.toFixed(3);
  const keep = [2012, 2017, 2022].map((y) => new Set(network(y).states.filter((x) => x.gdp_rank - x.rank_eigenvector >= 5).map((x) => x.state)));
  const persist = network(2022).states.filter((x) => keep.every((k) => k.has(x.state)));
  const q5 = await page.innerText('[data-testid="tour-text"]');
  const shown = await page.evaluate(() => [...document.querySelectorAll(".map-label")].filter((el) => el.style.display !== "none" && /^[A-Z]{2} \+\d+$/.test(el.textContent ?? "")).length);
  check(q5.includes(rho("retrodiction")) && q5.includes(rho("prediction")) && shown === persist.length,
    `home: structure stop quotes registered.json (${rho("retrodiction")}, ${rho("prediction")}) and labels the ${persist.length} persistent states (${shown} shown)`);
  const heads = new Set();
  for (let k = 0; k < 8; k++) { heads.add(await page.innerText('[data-testid="tour-head"]')); await page.waitForTimeout(800); }
  check(heads.size >= 2, `home: structure stop cycles the survey years (${[...heads].join(" | ")})`);
  await page.click('[data-testid="tour-rail-7"]');
  await page.waitForFunction(() => /Kill it if Texas/.test(document.querySelector('[data-testid="tour-text"]')?.textContent ?? ""));
  const keep5 = [2012, 2017, 2022].map((y) => new Set(network(y).states.filter((x) => x.gdp_rank - x.rank_eigenvector >= 5).map((x) => x.state)));
  const wide = n17.states.filter((x) => keep5.every((k) => k.has(x.state)));
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const betText = await page.innerText('[data-testid="tour-text"]');
  const betMarks = await markLabels();
  const betSay = await callout();
  const ms = wide.find((x) => x.state === "MS") ?? [...wide].sort((a, b) => (b.gdp_rank - b.rank_eigenvector) - (a.gdp_rank - a.rank_eigenvector))[0];
  const sources = await page.locator('[data-testid="tour-sources"] li').allInnerTexts();
  // dcmap.us/states, planned column, read 2026-11-05: the same table FreightMap holds, so the card's share is checked against it.
  const GW = { TX: 73.6, VA: 23.3, PA: 15, GA: 18.6, UT: 19.1, OH: 13.8, NM: 13.2, WV: 13.4, AZ: 9.3, IL: 8.7, IN: 4.6, NV: 4.9, KY: 7, NY: 5.7, IA: 2.9, LA: 3, WY: 3.2,
    ND: 2.5, MO: 2.7, OK: 3.6, CA: 2, OR: 1, WA: 1.4, WI: 0.21, NC: 1.5, AL: 2, MI: 1.2, NE: 2.1, SC: 2.2, KS: 2.2, AR: 1.7, CO: 1.9, ME: 2.1, MD: 1.1,
    TN: 0.168, MN: 1, MS: 0.28, MT: 1.3, NJ: 0.295, AK: 1.1, FL: 0.77, SD: 0.575, ID: 0.078, CT: 0.1, MA: 0.023, HI: 0, DE: 0, NH: 0, VT: 0, DC: 0, RI: 0 }, TOTAL_GW = 276.4;
  const shareGw = Math.round(100 * wide.reduce((a, x) => a + (GW[x.state] ?? 0), 0) / TOTAL_GW);
  check(betText.includes(`The ${WORDS[wide.length]} states here have ranked at least five places higher`) && betText.includes(`hold about ${shareGw}% of that planned power`) && !/: that \d+%/.test(betText)
    && betSay.includes(`${shareGw}% of the pipeline with the other ${WORDS[wide.length - 1]}`) && betMarks.length === wide.length
    && wide.every((x) => betMarks.includes(`${x.state} prestige #${x.rank_eigenvector} · GDP #${x.gdp_rank}`))
    && betSay.startsWith(`${ms.name}:`) && sources.length === 5 && /HYPOTHESIS/.test(sources[4]),
    `home: The bet counts and labels the ${wide.length} states five or more places ahead of their GDP rank in network/2012, 2017 and 2022.json (${wide.map((x) => x.state).join(", ")}), gives their ${shareGw}% of planned power, pins ${ms.state}, lists 5 sources`);
  await page.click('[data-testid="tour-rail-8"]');
  check((await page.locator('[data-testid="tour-end"]').count()) === 1 && /author's note/.test(await page.innerText('[data-testid="tour-text"]')),
    "home: last stop hands off to free exploration and points to the author's note");
  await page.click('[data-testid="tour-rail-1"]');
  await page.click('[data-testid="tour-skip"]');
  check((await page.locator('[data-testid="tour-card"]').count()) === 0, "home: Skip tour closes it");
  await page.goto("about:blank");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  await page.waitForTimeout(800);
  check((await page.locator('[data-testid="tour-card"]').count()) === 0, "home: the tour does not start again on the next visit");
  await page.click('[data-testid="appearance"]');
  check((await page.locator('[data-testid^="theme-"]').count()) === 3 && (await page.evaluate(() => document.documentElement.dataset.theme)) === "observatorylight",
    "home: Observatory (light) is the default; the menu offers three looks");
  await page.click('[data-testid="theme-observatory"]');
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === "observatory", "home: appearance menu switches the theme");
  await page.click('[data-testid="appearance"]');
  await page.click('[data-testid="theme-observatorylight"]');
  const vj = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
  check(vj.redirects?.some((r) => r.source === "/classic" && r.destination === "/" && r.permanent), "classic: /classic redirects home");
  await page.close();
}
// Ground layers (land, water, relief): decoration that loads in every appearance and leaves the data alone.
{
  const PIXELS = ([sel, pts]) => {
    const c = document.querySelector(sel);
    const r = c.getBoundingClientRect();
    const g = document.createElement("canvas");
    g.width = c.width; g.height = c.height;
    const x = g.getContext("2d");
    x.drawImage(c, 0, 0);
    return pts.map((p) => Array.from(x.getImageData(Math.round(((p.x - r.left) * c.width) / r.width), Math.round(((p.y - r.top) * c.height) / r.height), 1, 1).data.slice(0, 3)));
  };
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const ranks = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = []; o.forEach(([, i], k) => (r[i] = k)); return r; };
  const spearman = (a, b) => { const ra = ranks(a), rb = ranks(b), n = a.length; return 1 - (6 * ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0)) / (n * (n * n - 1)); };
  const eig = network("2017").states.map((s) => s.eigenvector);
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const t of ["frostneutral", "frost", "frostband", "observatorylight", "observatory"]) {
    // fx=high turns on every effect (contact shadows included) even on the software renderer the checks use.
    await open(page, `?t=4&fx=high&theme=${t}#y=2017&v=position&m=eigenvector&flat=1`);
    const ready = await page.waitForFunction(() => window.__freight.geoState().ready, null, { timeout: 15000 }).then(() => true, () => false);
    check(ready, `ground (${t}): land, water and relief layers load`);
    // Arcs meet the states at the sampled points; hide them so the samples are state tops.
    await page.evaluate(() => window.__freight.arcs(false));
    await page.waitForTimeout(800);
    const pts = await page.evaluate((n) => Array.from({ length: n }, (_, i) => window.__freight.stateScreen(i)), S.length);
    const on = await sig(page), topsOn = await page.evaluate(PIXELS, [CANVAS, pts]);
    const decor = (v) => page.evaluate((x) => { window.__freight.geo(x); window.__freight.solid(x); }, v);
    await decor(false);
    await page.waitForTimeout(300);
    const off = await sig(page), topsOff = await page.evaluate(PIXELS, [CANVAS, pts]);
    await decor(true);
    check(diff(on, off) > 0.05, `ground (${t}): the layers change the frame (${diff(on, off).toFixed(3)} of it)`);
    // 3-D view: the solid look (contact shadows, wall shading, edge rim) changes the frame.
    await page.click('[data-testid="persp-3d"]');
    await page.waitForTimeout(1200);
    const pts3 = await page.evaluate((n) => Array.from({ length: n }, (_, i) => window.__freight.stateScreen(i)), S.length);
    const solidOn = await sig(page), tops3On = await page.evaluate(PIXELS, [CANVAS, pts3]);
    check((await page.evaluate(() => window.__freight.geoState().shadows)) === true, `solid (${t}): contact shadows on with fx=high`);
    await decor(false);
    await page.waitForTimeout(300);
    const solidOff = await sig(page), tops3Off = await page.evaluate(PIXELS, [CANVAS, pts3]);
    await page.evaluate(() => window.__freight.geo(true));
    await page.waitForTimeout(300);
    const geoOnly = await sig(page);
    await decor(true);
    check(diff(solidOn, geoOnly) > 0.005, `solid (${t}): shadows, wall shading and rim change the 3-D frame (${diff(solidOn, geoOnly).toFixed(3)} of it)`);
    if (t.startsWith("observatory")) continue; // dot fields: a state's anchor pixel may fall between dots
    // In 3-D a tall neighbor's wall can cover a state's anchor. Count only anchors that show that state's own top
    // (with every effect off, within 8 of its color in the top-down view); those must be identical with the effects on.
    const vis = S.map((s, i) => i).filter((i) => S[i] !== "HI" && tops3Off[i].every((v, k) => Math.abs(v - topsOff[i][k]) <= 8));
    const moved3 = Math.max(...vis.map((i) => Math.max(...tops3On[i].map((v, k) => Math.abs(v - tops3Off[i][k])))));
    check(vis.length >= 30 && moved3 <= 2, `solid (${t}): 3-D state tops keep their rendered color with every effect on (largest channel change ${moved3} over ${vis.length} visible tops)`);
    const maxE3 = Math.max(...eig), vis3 = vis.filter((i) => !["DC", "RI", "DE"].includes(S[i]));
    let p3 = 0, k3 = 0;
    for (const i of vis3) for (const j of vis3) if (eig[i] - eig[j] >= 0.1 * maxE3) { p3++; if (lum(tops3On[i]) > lum(tops3On[j])) k3++; }
    check(p3 > 50 && k3 === p3, `solid (${t}): 3-D tops keep the ramp's order with every effect on (${k3} of ${p3} separated pairs)`);
    // Hawaii's center of population falls in the water between islands at this scale, so its sample is not a state top;
    // DC is a few pixels wide, so its sample sits on the outline the solid look redraws.
    const keep = S.map((s, i) => i).filter((i) => S[i] !== "HI" && S[i] !== "DC");
    const change = (i) => Math.max(...topsOn[i].map((v, k) => Math.abs(v - topsOff[i][k])));
    const worst = keep.reduce((a, i) => (change(i) > change(a) ? i : a), keep[0]);
    const moved = change(worst);
    check(moved <= 2, `ground (${t}): state tops keep their rendered color with the layers and solid look on (largest channel change ${moved} over ${keep.length} states, top-down, at ${S[worst]})`);
    // Order: for every pair of states whose values differ by a tenth of the range or more, the higher value renders lighter
    // (cividis rises in lightness). Near-ties are left out, and so are DC, RI and DE: a few pixels wide at this zoom,
    // their samples land on outlines.
    const maxE = Math.max(...eig);
    const big = keep.filter((i) => !["DC", "RI", "DE"].includes(S[i]));
    let pairs = 0, kept = 0;
    for (const i of big) for (const j of big) {
      if (eig[i] - eig[j] < 0.1 * maxE) continue;
      pairs++;
      if (lum(topsOn[i]) > lum(topsOn[j])) kept++;
    }
    const rho = spearman(keep.map((i) => eig[i]), keep.map((i) => lum(topsOn[i])));
    check(pairs > 100 && kept === pairs, `ground (${t}): rendered state colors keep the ramp's order (${kept} of ${pairs} separated pairs over ${big.length} states; Spearman ${rho.toFixed(3)} over all ${keep.length})`);
  }
  // Weak GPU (the checks run on a software renderer): the water is held still and the smaller mask loads.
  await open(page, "?t=4#y=2017&v=position");
  const low = await page.evaluate(() => window.__freight.geoState());
  check(low.animated === false && low.shadows === false, `ground: software renderer holds the water still and skips shadows (${JSON.stringify(low)})`);
  await open(page, "?fx=high&intro=0#y=2017&v=position");
  await page.waitForFunction(() => window.__freight.geoState().ready, null, { timeout: 15000 }).catch(() => {});
  check((await page.evaluate(() => window.__freight.geoState().animated)) === true, "ground: a strong GPU animates the water (control for the next check)");
  const first = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await first.goto(`${BASE}/explore?theme=observatory`, { waitUntil: "networkidle" });
  await first.waitForFunction(() => window.__freight?.ready());
  await first.waitForTimeout(300);
  check((await first.evaluate(() => window.__freight.geoState().swarmed)) === true, "swarm: a first visit in Observatory (dark) swarms the dots into place");
  await first.close();
  await page.click('[data-testid="tab-about"]');
  const about = await page.innerText('[data-testid="panel-about"]');
  check(/Natural Earth/.test(about) && /Terrain Tiles/.test(about) && /not data/.test(about), "ground: About lists the geography sources and says they are not data");
  check(errors.length === 0, `ground: no page errors (${errors.join(" | ")})`);
  await page.close();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: "reduce" });
  const rm = await ctx.newPage();
  await open(rm, "?fx=high&intro=0#y=2017&v=position");
  await rm.waitForFunction(() => window.__freight.geoState().ready, null, { timeout: 15000 }).catch(() => {});
  check((await rm.evaluate(() => window.__freight.geoState().animated)) === false, "ground: reduced motion holds the water still, even on a strong GPU");
  // First visit in a dot-field appearance: the dots swarm into place, except with motion reduced.
  await rm.goto(`${BASE}/explore?theme=observatory`, { waitUntil: "networkidle" });
  await rm.waitForFunction(() => window.__freight?.ready());
  check((await rm.evaluate(() => window.__freight.geoState().swarmed)) === false, "swarm: reduced motion skips the first-visit swarm");
  await ctx.close();
}

await browser.close();

// Findings page: counts and verdicts come from the data files.
{
  const b = await chromium.launch({ executablePath: chromePath() });
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/findings`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="findings-summary"]');
  const n17 = network(2017);
  const apart = n17.states.filter((r) => Math.abs(r.gap_eigenvector) >= 5).length;
  const under = n17.states.filter((r) => r.gap_eigenvector >= 5).length;
  const summary = await page.innerText('[data-testid="findings-summary"]');
  check(summary.includes(`${apart} of 51`) && summary.includes(`${under} rank five`), `findings: 2017 summary counts equal the file (${apart} apart, ${under} undervalued)`);
  check((await page.locator('[data-testid^="dumbbell-"]').count()) === apart, "findings: one dumbbell row per state five or more places apart");
  const reg = JSON.parse(readFileSync(new URL("registered.json", DATA)));
  check((await page.locator('[data-testid^="verdict-"]').count()) === reg.verdicts.length, `findings: all ${reg.verdicts.length} registered verdicts listed`);
  const h1p = await page.innerText('[data-testid="verdict-H1-P"]');
  check(h1p.includes("0.985") && h1p.includes("Held"), "findings: H1-P shows trade prestige 0.985, held");
  await page.click('[data-testid="findings-year-2022"]');
  const n22 = network(2022).states.filter((r) => Math.abs(r.gap_eigenvector) >= 5).length;
  check((await page.locator('[data-testid^="dumbbell-"]').count()) === n22, "findings: year switch redraws for 2022");
  check(errors.length === 0, `findings: no page or console errors (${errors.join(" | ")})`);
  await b.close();
}

// Keyboard and screen-reader access on the map.
{
  const page = await (await chromium.launch({ executablePath: chromePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }))
    .newPage({ viewport: { width: 1280, height: 820 } });
  await page.goto(`${BASE}/?t=4`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  await page.keyboard.press("Tab");
  check((await page.evaluate(() => document.activeElement?.textContent)) === "Skip to content", "keyboard: first Tab reaches the skip link");
  await page.keyboard.press("Enter");
  check((await page.evaluate(() => document.activeElement?.id)) === "panel", "keyboard: skip link moves focus to the details panel");
  const label = await page.getAttribute('[data-testid="map-canvas"]', "aria-label");
  check(!!label && label.includes("trade prestige"), "screen reader: the map canvas has a description of what it shows");
  await page.selectOption('[data-testid="state-select"]', String(S.indexOf("KY")));
  await page.waitForSelector('[data-testid="position-state-panel"]');
  check((await page.innerText('[data-testid="position-state-panel"] h2')) === "Kentucky", "keyboard: choosing a state from the list opens it without the mouse");
  const said = await page.innerText('[data-testid="announce"]').catch(() => "");
  const live = await page.evaluate(() => document.querySelector('[data-testid="announce"]')?.textContent ?? "");
  check(live.startsWith("Kentucky selected") && live.includes("GDP rank 28"), `screen reader: selection is announced (${live || said})`);
  await page.click('[data-testid="scope-one"]');
  await page.focus('[data-testid="commodity-input"]');
  await page.keyboard.type("coal");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  check((await page.inputValue('[data-testid="commodity-input"]')) === "Coal", "keyboard: commodity search works with arrows and Enter");

  // Contrast: every small-text element against its effective background, in each theme (WCAG AA 4.5:1).
  const ratio = (selectors) => {
    const lum = (c) => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const a = c.match(/[\d.]+/g);
        if (a && (a.length < 4 || Number(a[3]) > 0.9)) return c;
      }
      return "rgb(255,255,255)";
    };
    const worst = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (!el.textContent.trim() || el.offsetParent === null) continue;
        const l1 = lum(getComputedStyle(el).color), l2 = lum(bgOf(el));
        const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        worst.push([sel, Math.round(r * 100) / 100]);
      }
    }
    return worst.sort((a, b) => a[1] - b[1]).slice(0, 3);
  };
  const SEL = [".fm-glabel", ".fm-nav a", ".fm-brand", ".fm-seg button", ".fm-legend div", ".fm-tabs button", ".fm-panel .muted", ".fm-panel .small", ".fm-honesty", ".fm-statesel span", ".fm-row span"];
  for (const t of ["frostneutral", "frost", "frostband", "observatory", "observatorylight"]) {
    await page.goto(`${BASE}/?t=4&theme=${t}#y=2017&v=position&s=${S.indexOf("KY")}`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="position-state-panel"]');
    const low = await page.evaluate(ratio, SEL);
    check(low.length > 0 && low[0][1] >= 4.5, `contrast (${t}): lowest text contrast ${JSON.stringify(low[0])} is at least 4.5:1`);
  }
  // Observatory draws states as dot fields: clicking a state still selects it, and the canvas is not blank.
  await page.goto("about:blank");
  await page.goto(`${BASE}/explore?t=4&theme=observatory#y=2017&v=position`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  await page.waitForTimeout(1500);
  const obs = nonblank(await page.evaluate(SIG, CANVAS));
  check(obs.lit > 0.05 && obs.colors > 20, `observatory: canvas non-blank (${JSON.stringify(obs)})`);
  await clickAt(page, await page.evaluate((i) => window.__freight.stateScreen(i), S.indexOf("TX")));
  await page.waitForSelector('[data-testid="position-state-panel"] h2');
  check((await page.innerText('[data-testid="position-state-panel"] h2')) === "Texas", "observatory: clicking a dot-field state selects it");
  // Dot-field states keep a vertical cue: with the curtain walls hidden the frame changes, so the walls are drawn.
  await page.evaluate(() => window.__freight.walls(false));
  await page.waitForTimeout(300);
  const noWalls = await page.evaluate(SIG, CANVAS);
  await page.evaluate(() => window.__freight.walls(true));
  await page.waitForTimeout(300);
  const walls = await page.evaluate(SIG, CANVAS);
  check(diff(noWalls, walls) > 0.01, `observatory: curtain walls add a visible vertical cue (${diff(noWalls, walls).toFixed(3)} of the frame)`);
  // Legend names every channel that carries the value.
  check((await page.innerText('[data-testid="legend-encodes"]')) === "Color, height and dot size by", "observatory: legend says color, height and dot size");
  await page.goto("about:blank");
  await page.goto(`${BASE}/explore?t=4&theme=observatory#c=17&y=2022&v=reliance`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="legend-reliance"]');
  check((await page.innerText('[data-testid="legend-reliance"]')).trim().startsWith("Height and dot size:"), "observatory: Reliance legend names height and dot size");

  // Light companion: same dot field and particle flows on the Frost ground; dots keep one size, so the legend does not claim size.
  await page.goto("about:blank");
  await page.goto(`${BASE}/explore?t=4&theme=observatorylight#y=2017&v=position`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__freight?.ready());
  await page.waitForTimeout(1500);
  const lt = nonblank(await page.evaluate(SIG, CANVAS));
  check(lt.lit > 0.05 && lt.colors > 20, `observatory (light): canvas non-blank (${JSON.stringify(lt)})`);
  check((await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(238, 242, 246)", "observatory (light): Frost page ground");
  check((await page.innerText('[data-testid="legend-encodes"]')) === "Color and height by", "observatory (light): legend says color and height (dots keep one size)");
  await page.evaluate(() => window.__freight.walls(false));
  await page.waitForTimeout(300);
  const lNoWalls = await page.evaluate(SIG, CANVAS);
  await page.evaluate(() => window.__freight.walls(true));
  await page.waitForTimeout(300);
  check(diff(lNoWalls, await page.evaluate(SIG, CANVAS)) > 0.01, "observatory (light): curtain walls add a visible vertical cue");
  await clickAt(page, await page.evaluate((i) => window.__freight.stateScreen(i), S.indexOf("TX")));
  await page.waitForSelector('[data-testid="position-state-panel"] h2');
  check((await page.innerText('[data-testid="position-state-panel"] h2')) === "Texas", "observatory (light): clicking a dot-field state selects it");
  await page.goto("about:blank");
  await page.goto(`${BASE}/explore?t=4&theme=frostneutral#y=2017&v=position`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="legend-encodes"]');
  check((await page.innerText('[data-testid="legend-encodes"]')) === "Color and height by", "neutral: legend unchanged (color and height)");

  // Tour card in every appearance: text contrast against the card.
  const TOUR_SEL = [".fm-tour-bar b", ".fm-tour-bar span", ".fm-tour-head", ".fm-tour-lead", '[data-testid="tour-text"]', ".fm-rail button", ".fm-tour .fm-btn", ".fm-tour-ask", ".fm-tour-sources li"];
  for (const t of ["frostneutral", "frost", "frostband", "observatory", "observatorylight"]) {
    await page.goto("about:blank");
    await page.goto(`${BASE}/?t=4&theme=${t}#y=2017&v=position`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    if (!(await page.locator('[data-testid="tour-card"]').count())) await page.click('[data-testid="tour-start"]');
    await page.waitForFunction(() => (document.querySelector('[data-testid="tour-text"]')?.textContent ?? "").length > 20);
    const low = await page.evaluate(ratio, TOUR_SEL);
    check(low.length > 0 && low[0][1] >= 4.5, `tour card (${t}): lowest text contrast ${JSON.stringify(low[0])} is at least 4.5:1`);
  }
  await page.context().browser().close();
}

// Data and Methods pages.
{
  const b = await chromium.launch({ executablePath: chromePath() });
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const manifest = JSON.parse(readFileSync(new URL("../../downloads/manifest.json", DATA)));
  await page.goto(`${BASE}/data`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid^="file-"]');
  check((await page.locator('[data-testid^="file-"]').count()) === manifest.files.length, `data: lists all ${manifest.files.length} files from the manifest`);
  const href = await page.getAttribute('[data-testid="file-2017/states_2017.csv"] a', "href");
  const res = await page.request.get(new URL(href, BASE).toString());
  check(res.ok() && (await res.text()).startsWith("state,name,fips"), "data: the 2017 states file downloads");
  await page.goto(`${BASE}/methods`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="methods-map"] .fm-def');
  const text = await page.innerText("main");
  check(text.includes("in-flow") && text.includes("no brokerage") && text.includes("Post hoc"), "methods: measures, no-brokerage rule and post hoc labels present");
  check(!/\bRA\b|Cliff|course/.test(text), "methods: no RA or course references");
  check(errors.length === 0, `data and methods: no page or console errors (${errors.join(" | ")})`);
  await b.close();
}

// Phones: every page fits the width, the tour card never covers the map, touch selects a state, controls are big enough to tap.
{
  const b = await chromium.launch({ executablePath: chromePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const phone = (w, h) => b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; }, sel);
  const overlap = (a, c) => Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)) * Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
  // WCAG 2.5.8: at least 24 by 24 CSS pixels, inline links in prose excepted.
  const TAPS = ".fm-site a, .fm-site button, .fm-toolbar button, .fm-toolbar input, .fm-stage-tools button, .fm-rail button, .fm-tour .fm-btn, .fm-tabs button, .fm-statesel select";
  const tooSmall = (page) => page.$$eval(TAPS, (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24); })
    .map((e) => `${e.dataset.testid ?? e.textContent.trim().slice(0, 16)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));

  for (const [w, h] of [[360, 740], [390, 844]]) {
    const ctx = await phone(w, h);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const path of ["/findings", "/data", "/methods"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      check(await fits(page), `phone ${w}: ${path} has no horizontal scroll`);
    }
    for (const q of ["?t=4&intro=0#c=17&y=2022&v=flows", "?t=4&intro=0#c=21&y=2017&v=reliance", "?t=4&intro=0#y=2017&v=position"]) {
      await open(page, q);
      check(await fits(page), `phone ${w}: map ${q.split("#")[1]} has no horizontal scroll`);
    }
    const small = await tooSmall(page);
    check(small.length === 0, `phone ${w}: map controls at least 24 px (${small.join(" | ")})`);
    // A clipped toolbar does not scroll the page, so check each control's own box and label.
    const spill = await page.$$eval(".fm-toolbar button", (els) => els.filter((e) => e.getBoundingClientRect().right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1)
      .map((e) => e.dataset.testid));
    check(spill.length === 0, `phone ${w}: toolbar buttons sit on screen and hold their labels (${spill.join(" | ")})`);

    // First visit: the tour opens under the map, and the map and the card fit on one screen.
    await page.evaluate(() => localStorage.clear());
    await page.goto("about:blank");
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    await page.waitForSelector('[data-testid="opening"]');
    {
      const st = await rect(page, ".fm-stage"), op = await rect(page, '[data-testid="opening"]');
      check(op.top >= st.top - 1 && op.bottom <= st.bottom + 1 && op.left >= -1 && op.right <= w + 1 && (await tooSmall(page)).length === 0,
        `phone ${w}: the opening card fits on the map with tappable buttons (card ${Math.round(op.top)}–${Math.round(op.bottom)}, map ${Math.round(st.top)}–${Math.round(st.bottom)})`);
    }
    await page.tap('[data-testid="opening-start"]');
    await page.waitForSelector('[data-testid="tour-card"]');
    await page.waitForTimeout(1200);
    const stage = await rect(page, ".fm-stage"), card = await rect(page, '[data-testid="tour-card"]');
    check(overlap(stage, card) === 0, `phone ${w}: the tour card does not cover the map`);
    check(stage.top >= -1 && card.bottom <= h + 1, `phone ${w}: map and tour card on one screen (map top ${Math.round(stage.top)}, card bottom ${Math.round(card.bottom)} of ${h})`);
    const smallTour = await tooSmall(page);
    check(smallTour.length === 0, `phone ${w}: tour controls at least 24 px (${smallTour.join(" | ")})`);
    await page.tap('[data-testid="tour-next"]');
    const moved = await page.waitForFunction(() => document.querySelector('[data-testid="tour-lead"]')?.textContent === "Now add the ties.", null, { timeout: 5000 }).then(() => true, () => false);
    check(moved, `phone ${w}: tapping Next moves the tour on`);
    await page.tap('[data-testid="tour-skip"]');
    check((await page.locator('[data-testid="tour-card"]').count()) === 0, `phone ${w}: tapping Skip tour closes it`);

    // Touch selects a state.
    await open(page, "?t=4&intro=0#y=2017&v=position");
    await page.evaluate(() => document.querySelector(".fm-stage").scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
    const p = await page.evaluate((i) => window.__freight.stateScreen(i), S.indexOf("TX"));
    await page.touchscreen.tap(p.x, p.y);
    const name = await page.waitForFunction(() => document.querySelector('[data-testid="position-state-panel"] h2')?.textContent === "Texas", null, { timeout: 5000 }).then(() => "Texas", () => "none");
    check(name === "Texas", `phone ${w}: tapping Texas opens its panel`);
    check(errors.length === 0, `phone ${w}: no page errors (${errors.join(" | ")})`);
    await ctx.close();
  }

  // Every appearance draws on a phone and fits its width.
  {
    const ctx = await phone(390, 844);
    const page = await ctx.newPage();
    for (const t of ["frostneutral", "frost", "frostband", "observatorylight", "observatory"]) {
      await open(page, `?t=4&intro=0&theme=${t}#y=2017&v=position`);
      const nb = nonblank(await sig(page));
      check(nb.lit > 0.05 && nb.colors > 20 && (await fits(page)), `phone: ${t} draws the map and fits the width`);
    }
    await ctx.close();
  }

  // Held sideways: the map fills the screen and the tour card leaves most of it clear.
  {
    const ctx = await phone(844, 390);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    if (!(await page.locator('[data-testid="tour-card"]').count())) await page.click('[data-testid="tour-start"]');
    await page.waitForTimeout(1200);
    const stage = await rect(page, ".fm-stage"), card = await rect(page, '[data-testid="tour-card"]');
    check(stage.height >= 0.9 * 390 && Math.abs(stage.top) <= 2, `landscape: map fills the screen (${Math.round(stage.height)} px, top ${Math.round(stage.top)})`);
    check(overlap(stage, card) / (stage.width * stage.height) < 0.4 && card.bottom <= 390 + 1, "landscape: tour card covers under 40% of the map and fits the screen");
    check(await fits(page), "landscape: no horizontal scroll");
    await ctx.close();
  }
  await b.close();
}

// Beyond pairs: the ladder, the size-adjusted map, a state's missed shipments and the formal drawer, all from ra/<year>.json.
{
  const b = await chromium.launch({ executablePath: chromePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const r17 = ra(2017), r22 = ra(2022);
  const pairs17 = r17.ladder.find((r) => r.structure === "OD:OC:DC");
  for (const [name, w, h, touch] of [["desktop", 1280, 820, false], ["phone 360", 360, 740, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await open(page, "?t=4&intro=0#y=2017&v=pairs");
    check((await page.evaluate(() => location.hash)).includes("v=position"), `${name}: a Beyond pairs link falls back to Position for visitors`);
    await open(page, "?t=4&intro=0&pairs=1#y=2017&v=position");
    const position = await sig(page);
    await page.click('[data-testid="scope-pairs"]');
    await page.waitForSelector('[data-testid="ra-ladder"]');
    await page.waitForTimeout(1200);
    check(diff(position, await sig(page)) > 0.05, `${name}: Beyond pairs recolors the map`);
    check(/v=pairs/.test(await page.evaluate(() => location.hash)) && /side=shipping/.test(await page.evaluate(() => location.hash)), `${name}: the link keeps the view and side`);
    check((await page.textContent('[data-testid="ra-pairs-share"]')) === pct(pairs17.dollars), `${name}: pairs capture ${pct(pairs17.dollars)} by dollars in 2017, from the data`);
    check((await page.locator('[data-testid^="ra-rung-"]').count()) === r17.ladder.length, `${name}: the ladder has all ${r17.ladder.length} steps`);
    check((await page.locator('[data-testid="ra-posthoc"]').count()) === 1 && (await page.locator('[data-testid="ra-legend"]').count()) === 1, `${name}: labelled post hoc, with its own legend`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${name}: no horizontal scroll`);
    const spill = await page.$$eval(".fm-toolbar button", (els) => els.filter((e) => e.getBoundingClientRect().right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.dataset.testid));
    check(spill.length === 0, `${name}: toolbar buttons sit on screen and hold their labels (${spill.join(" | ")})`);

    const ship = await sig(page);
    await page.click('[data-testid="side-receiving"]');
    await page.waitForTimeout(1200);
    check(diff(ship, await sig(page)) > 0.005, `${name}: the receiving side changes the map`);
    await page.click('[data-testid="side-shipping"]');

    const wy = S.indexOf("WY");
    await page.selectOption('[data-testid="state-select"]', String(wy));
    await page.waitForSelector('[data-testid="ra-state-panel"]');
    const adj = Math.exp(r17.shipping.netOfSize[wy]), raw = r17.shipping.carry[wy];
    check((await page.textContent('[data-testid="ra-adjusted"]')) === `${adj.toFixed(1)}×` && (await page.textContent('[data-testid="ra-raw"]')) === `${raw.toFixed(1)}×`,
      `${name}: Wyoming ships ${adj.toFixed(1)}× a state its size and ${raw.toFixed(1)}× its size share`);
    const cells = r17.cells.WY.shipping;
    check((await page.locator('[data-testid^="ra-cell-"]').count()) === cells.length, `${name}: Wyoming's ${cells.length} most underpredicted shipments listed`);
    const [partner, sctg] = cells[0];
    await page.click(`[data-testid="ra-cell-${partner}-${sctg}"]`);
    await page.waitForSelector('[data-testid="route-panel"]');
    const hash = await page.evaluate(() => location.hash);
    check(hash.includes(`c=${sctg}`) && hash.includes(`r=${wy}-${partner}`) && hash.includes("v=flows"), `${name}: a missed shipment opens its route in Flows (${hash})`);

    await open(page, "?t=4&intro=0&pairs=1#y=2022&v=pairs");
    await page.click('[data-testid="tab-measure"]');
    await page.click('[data-testid="ra-drawer"] summary');
    check((await page.locator('[data-testid="ra-records"] tbody tr').count()) === r22.ladder.length, `${name}: the drawer lists the 2022 ladder by records`);
    const lo = r22.ladder.find((r) => r.structure === "OD:OC:DC");
    check((await page.textContent('[data-testid="ra-records"]')).includes(`${(lo.low * 100).toFixed(1)} to ${(lo.high * 100).toFixed(1)}`), `${name}: the drawer shows the record interval for every pair`);
    check((await page.textContent('[data-testid="ra-legend"]')).includes("2022 is a differently drawn sample"), `${name}: 2022 carries its sampling note`);
    check(errors.length === 0, `${name}: no page errors in Beyond pairs (${errors.join(" | ")})`);
    await ctx.close();
  }
  await b.close();
}

// Framing: the home view keeps every state clear of the overlays on the map; Alaska and Hawaii arcs stay in frame;
// map labels never overlap.
{
  const b = await chromium.launch({ executablePath: chromePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const box = (page, sel) => page.locator(sel).first().boundingBox();
  const under = async (page, sels) => {
    const pts = await page.evaluate((n) => Array.from({ length: n }, (_, i) => window.__freight.stateScreen(i)), S.length);
    const out = [];
    for (const sel of sels) {
      const r = await box(page, sel);
      if (r) pts.forEach((p, i) => { if (p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height) out.push(`${S[i]} under ${sel}`); });
    }
    return out;
  };
  const LEGEND = '[data-testid="legend"]', CARD = '[data-testid="tour-card"]';
  for (const [name, w, h, touch, sels] of [["desktop", 1280, 820, false, [CARD, LEGEND]], ["landscape", 844, 390, true, [CARD, LEGEND]]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/explore?t=4`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    if (!(await page.locator(CARD).count())) await page.click('[data-testid="tour-start"]');
    await page.waitForTimeout(1500);
    const hidden = await under(page, sels);
    check(!hidden.length, `framing (${name}): on tour stop 1 no state sits under the tour card or legend (${hidden.join(", ") || "none"})`);
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/explore?t=4#v=position`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    await page.waitForTimeout(1500);
    const hidden = await under(page, [LEGEND, ".fm-stage-tools"]);
    check(!hidden.length, `framing (phone): no state sits under the legend or the map tools (${hidden.join(", ") || "none"})`);
    await ctx.close();
  }
  {
    const page = await b.newPage({ viewport: { width: 1280, height: 820 } });
    const g = com("17").years["2022"];
    for (const st of ["AK", "HI"]) {
      const s = S.indexOf(st);
      await page.goto("about:blank");
      await page.goto(`${BASE}/explore?t=4#v=flows&c=17&y=2022&s=${s}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => window.__freight?.ready());
      await page.waitForTimeout(1500);
      const c = await box(page, CANVAS);
      const flows = g.flows.filter((f) => f[0] === s || f[1] === s);
      const apexes = await page.evaluate((fs) => fs.map(([o, d]) => window.__freight.arcApex(o, d)), flows);
      const out = flows.filter((f, i) => { const p = apexes[i]; return !p || p.x < c.x || p.x > c.x + c.width || p.y < c.y || p.y > c.y + c.height; });
      check(flows.length > 0 && !out.length, `framing: ${st}'s ${flows.length} gasoline routes in 2022 have their apex in frame (${out.map((f) => `${S[f[0]]}-${S[f[1]]}`).join(", ") || "all"})`);
    }
    await page.close();
  }
  for (const [name, w, h, touch] of [["desktop", 1280, 820, false], ["phone", 360, 740, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/explore?t=4&pairs=1#v=pairs`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__freight?.ready());
    await page.waitForTimeout(2000);
    const labels = await page.evaluate(() => [...document.querySelectorAll(".map-label")]
      .filter((el) => el.style.display !== "none" && el.style.visibility !== "hidden")
      .map((el) => { const r = el.getBoundingClientRect(); return [el.textContent, r.left, r.right, r.top, r.bottom]; }));
    const clash = labels.flatMap((a, i) => labels.slice(i + 1).filter((b) => a[1] < b[2] && a[2] > b[1] && a[3] < b[4] && a[4] > b[3]).map((b) => `${a[0]}/${b[0]}`));
    check(labels.length >= 2 && !clash.length, `labels (${name}): ${labels.length} visible Beyond pairs labels, none overlapping (${clash.join(", ") || "clear"})`);
    await ctx.close();
  }
  await b.close();
}

// No WebGL: the Explore page shows its fallback instead of a broken canvas.
{
  const b = await chromium.launch({ executablePath: chromePath(), args: ["--disable-webgl", "--disable-3d-apis"] });
  const page = await b.newPage();
  await page.goto(`${BASE}/explore`, { waitUntil: "networkidle" });
  check((await page.locator('[data-testid="explore-fallback"]').count()) === 1, "no WebGL: fallback page shown");
  await b.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
