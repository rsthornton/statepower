// Phone layout: narrow screens, and phones held sideways (short and wide).
export const PHONE = "(max-width: 760px), (max-height: 500px) and (orientation: landscape)";

export const CSS = `
:root, :root[data-theme="day"] { color-scheme: light; --accent: #a3560a; --line-strong: #c9bda6; --track: #e6dccb; --ink-2: #3f444b; --hilite: #8f2d0b; --on-ink: #7c3a07; --tick: #5e636a; --shadow: rgba(60,40,10,.18); --dot-persist: #3d2a12; --amber: #954305; --code: #7a3e0b; --kicker: #8a4f12; --teal-ink: #0b5f58; --muted: #5b6068; --grey: #8f949b; --teal: #08635c; --track-2: #ddd2bf; --panel-2: #f3ede1; --field: #fffdf8; --pre: #f6f1e7; --bg: #efe8da; --honesty-bg: rgba(239,232,218,.94); --tip: rgba(255,253,248,.97); --glass: rgba(255,252,245,.9); --glass-2: rgba(255,252,245,.9); --card: rgba(255,252,245,.95); --label: rgba(255,252,245,.94); --shadow-2: rgba(60,40,10,.16); --dot-sel-stroke: #ffffff; --anchor: #2a1d0e; --ra: #3a2a14; --ink: #1f2328; --warn: #9a4a07; --summary: #8a4f12; --author: #7a5a18; --honesty: #6e5a35; --h3: #8a4f12; --sky-ink: #1d4f91; --row-key: #444a52; --gold: #a07a1e; --amber-line: #b45309; --conf: #3f8f7a; --focus: #b45309; --axis1: #9b7b45; --sky-line: #5b82b8; --btn-line: #bfb39b; --card-line: #d6c8ab; --error: #f6d5cf; --seg-on: #f3dfbf; --teal-line: #2b8a80; --grid: #e2d8c6; --line: #ddd4c3; --tier: #d7efe9; --on-accent: #ffffff; --btn-row: #f6f1e7; --list: #fffdf8; --panel: #fbf8f1; --top: #fbf8f1; --dot-stroke: #fffdf8; }
:root[data-theme="night"] { color-scheme: dark; --accent: #d9a65c; --line-strong: #3a4658; --track: #222c3a; --ink-2: #c8ccd2; --hilite: #ffe2a8; --on-ink: #ffd38f; --tick: #8c95a1; --shadow: rgba(0,0,0,.5); --dot-persist: #fff2cf; --amber: #f0a845; --code: #e6cf9f; --kicker: #c9a86a; --teal-ink: #9fe7dd; --muted: #9aa3ad; --grey: #6b7380; --teal: #4fc3b8; --track-2: #2a3646; --panel-2: #151d29; --field: #0d131c; --pre: #0b1018; --bg: #090d14; --honesty-bg: rgba(8,11,16,.92); --tip: rgba(14,19,28,.95); --glass: rgba(12,17,25,.82); --glass-2: rgba(12,17,25,.8); --card: rgba(11,15,22,.88); --label: rgba(10,14,20,.78); --shadow-2: rgba(0,0,0,.45); --dot-sel-stroke: #fff; --anchor: #f6e7c8; --ra: #f1e4c8; --ink: #ece6da; --warn: #e0b070; --summary: #d9b67a; --author: #d8c08a; --honesty: #cdb98f; --h3: #c9b48d; --sky-ink: #bcd6ff; --row-key: #b8bec6; --gold: #b8913a; --amber-line: #b07a2c; --conf: #8fb7a8; --focus: #8a6a32; --axis1: #6b5a3a; --sky-line: #4b6f9c; --btn-line: #4a5568; --card-line: #3a3326; --error: #3a1d1d; --seg-on: #2c2416; --teal-line: #2b7a70; --grid: #263244; --line: #243041; --tier: #20303a; --on-accent: #1a1206; --btn-row: #131a25; --list: #111823; --panel: #10161f; --top: #0f1520; --dot-stroke: #0b0f16; }

:root[data-theme="frost"], :root[data-theme="frostband"], :root[data-theme="frostneutral"], :root[data-theme="observatorylight"] { color-scheme: light; --accent: #3d5a96; --line-strong: #b9c4d0; --track: #e4eaf0; --ink-2: #3a4553; --hilite: #1b2a4e; --on-ink: #24386a; --tick: #5b6675; --shadow: rgba(20,30,50,.10); --dot-persist: #1b2a4e; --amber: #3d5a96; --code: #24386a; --kicker: #3d5a96; --teal-ink: #0f5a52; --muted: #5b6675; --grey: #8a96a5; --teal: #16746a; --track-2: #d3dbe4; --panel-2: #eef2f6; --field: #ffffff; --pre: #f7f9fb; --bg: #eef2f6; --honesty-bg: rgba(238,242,246,.94); --tip: rgba(255,255,255,.98); --glass: rgba(255,255,255,.94); --glass-2: rgba(255,255,255,.94); --card: rgba(255,255,255,.98); --label: rgba(255,255,255,.95); --shadow-2: rgba(20,30,50,.10); --dot-sel-stroke: #ffffff; --anchor: #18212b; --ra: #18212b; --ink: #18212b; --warn: #9a4a07; --summary: #3d5a96; --author: #3d5a96; --honesty: #5b6675; --h3: #3d5a96; --sky-ink: #24386a; --row-key: #3a4553; --gold: #3d5a96; --amber-line: #3d5a96; --conf: #16746a; --focus: #3d5a96; --axis1: #8a97a8; --sky-line: #6f86b8; --btn-line: #b9c4d0; --card-line: #c9d2dc; --error: #f3d6d6; --seg-on: #dfe6f3; --teal-line: #16746a; --grid: #e1e7ee; --line: #d9e0e8; --tier: #d8ece9; --on-accent: #ffffff; --btn-row: #f3f6f9; --list: #ffffff; --panel: #f8fafc; --top: #ffffff; --dot-stroke: #ffffff; }
:root[data-theme="frostneutral"] { --bg: #f3f3f2; --top: #ffffff; --pre: #fafafa; --panel: #fafafa; --panel-2: #f2f2f1; --line: #e2e2e0; --line-strong: #c4c4c2; --track: #ebebea; --track-2: #dcdcda; --ink: #161616; --ink-2: #3d3d3d; --muted: #5f5f5f; --tick: #5f5f5f; --kicker: #5f5f5f; --h3: #3d3d3d; --summary: #3d3d3d; --author: #3d3d3d; --gold: #3d3d3d; --seg-on: #e6e6e4; --on-ink: #161616; --accent: #34508a; --amber: #34508a; --amber-line: #34508a; --focus: #34508a; --code: #34508a; --honesty-bg: rgba(243,243,242,.94); --honesty: #5f5f5f; --grid: #e6e6e4; --axis1: #9a9a9a; --btn-row: #f5f5f4; --row-key: #3d3d3d; --card-line: #d4d4d2; --btn-line: #c4c4c2; --sky-line: #8a9bbf; --sky-ink: #24386a; --dot-persist: #1b2a4e; }
:root[data-theme="observatory"] { color-scheme: dark; --accent: #8fa8ff; --line-strong: #2c3442; --track: #1a202a; --ink-2: #c9ced6; --hilite: #e6ecff; --on-ink: #e6ecff; --tick: #8a93a0; --shadow: rgba(0,0,0,.5); --dot-persist: #e6ecff; --amber: #8fa8ff; --code: #c7d3ff; --kicker: #9aa6bd; --teal-ink: #7fe0d6; --muted: #9aa3ad; --grey: #6b7380; --teal: #4fd1c5; --track-2: #222a36; --panel-2: #0d1117; --field: #0d1117; --pre: #0a0d12; --bg: #05070b; --honesty-bg: rgba(5,7,11,.9); --tip: rgba(12,15,21,.96); --glass: rgba(10,13,19,.9); --glass-2: rgba(10,13,19,.9); --card: rgba(10,13,19,.94); --label: rgba(8,10,15,.86); --shadow-2: rgba(0,0,0,.45); --dot-sel-stroke: #ffffff; --anchor: #e6ecff; --ra: #e6ecff; --ink: #e8eaee; --warn: #ffb26b; --summary: #9aa6bd; --author: #9aa6bd; --honesty: #9aa3ad; --h3: #c9ced6; --sky-ink: #c7d3ff; --row-key: #b8bec6; --gold: #8fa8ff; --amber-line: #8fa8ff; --conf: #4fd1c5; --focus: #8fa8ff; --axis1: #4a5466; --sky-line: #6f86d6; --btn-line: #2c3442; --card-line: #252d3a; --error: #3a1d1d; --seg-on: #1c2433; --teal-line: #3fa59b; --grid: #1a202a; --line: #1c222c; --tier: #16302e; --on-accent: #05070b; --btn-row: #0b0e14; --list: #0b0e14; --panel: #080b10; --top: #080b10; --dot-stroke: #05070b; --card: #0f141c; --card-line: #3a4558; }
:root[data-theme="frostneutral"] .fm-legend { border-left-color: #8a8a88; }
:root[data-theme^="observatory"] .fm-tour { border: 1px solid var(--card-line); border-top: 2px solid var(--accent); }
:root[data-theme^="observatory"] .fm-tour p { font-family: inherit; font-size: 15px; line-height: 1.5; }
:root[data-theme^="observatory"] .fm-rail button { border-top-color: var(--card-line); }
:root[data-theme^="observatory"] .fm-rail button.done { border-top-color: var(--kicker); }
:root[data-theme^="observatory"] .fm-rail button.on { border-top-color: var(--accent); }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm h1, :root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm h2 { font-family: inherit; font-weight: 650; letter-spacing: -0.01em; }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm *:not(.dotkey) { border-radius: 0 !important; box-shadow: none !important; backdrop-filter: none !important; }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm-site { background: var(--top); }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm-legend { border: 0; border-left: 3px solid var(--accent); }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm-honesty { background: var(--honesty-bg); text-align: left; letter-spacing: 0; }
:root[data-theme="frostband"] .fm-site { background: #1c2735; border-bottom: 0; --ink: #f2f5f9; --ink-2: #d5dde7; --muted: #9fb0c4; --kicker: #9fb4d8; --line: #36465a; --line-strong: #4a5d74; --field: #243244; --seg-on: #3d5a96; --on-ink: #ffffff; }
:root[data-theme="frostband"] .fm-brand { color: #ffffff; }
:root[data-theme="frostband"] .fm-site .fm-btn { background: var(--field); color: var(--ink); border: 1px solid var(--line-strong); }
:root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm-big b, :root:is([data-theme^="frost"], [data-theme^="observatory"]) .fm b { font-family: inherit; }
:root[data-theme="frostband"] .fm-pick-list { --ink: #18212b; --list: #ffffff; --line-strong: #b9c4d0; --track: #e4eaf0; }
:root[data-theme="frostband"] .fm-tabs { background: #e3e9f0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); }
.fm {
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: var(--ink); background: var(--bg);
  height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.fm h1, .fm h2 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-weight: 600; letter-spacing: 0.005em; }
.fm h1 { margin: 0; font-size: 22px; line-height: 1.15; }
.fm h2 { margin: 0 0 2px; font-size: 21px; line-height: 1.2; }
.fm h3 { margin: 18px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--h3); font-weight: 600; }
.fm h3.teal { color: var(--teal); } .fm h3.amber { color: var(--amber); }
.fm p { margin: 6px 0; }
.fm .muted { color: var(--muted); } .fm .small { font-size: 12.5px; } .fm .warn { color: var(--warn); }
.fm code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--code); }
.fm button { font: inherit; color: inherit; cursor: pointer; }

.fm-top { position: relative; z-index: 5; }
.fm-site { display: flex; align-items: center; gap: 28px; padding: 0 20px; height: 52px; border-bottom: 1px solid var(--line); background: var(--top); }
.fm-brandbox { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
.fm-tagline { font-size: 13.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 14px; border-left: 1px solid var(--line-strong); }
.fm-tour-lead { font-family: Inter, system-ui, sans-serif !important; font-size: 18px !important; font-weight: 650; letter-spacing: -0.01em; margin: 2px 0 6px; }
.fm-brand { font-size: 15px; font-weight: 650; letter-spacing: -0.01em; color: var(--ink); text-decoration: none; white-space: nowrap; }
.fm-site .fm-nav { margin-left: auto; }
.fm-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--line); background: var(--field); color: var(--ink-2); }
.fm-icon:hover { color: var(--ink); border-color: var(--line-strong); }
.fm-appearance { position: relative; }
.fm-menu { position: absolute; right: 0; top: 38px; min-width: 140px; padding: 4px 0; background: var(--list); border: 1px solid var(--line-strong); z-index: 30; display: flex; flex-direction: column; }
.fm-menu button { text-align: left; padding: 7px 14px; border: 0; background: transparent; color: var(--ink); }
.fm-menu button:hover { background: var(--track); }
.fm-menu button.on { font-weight: 650; }
.fm-menu button.on::before { content: "\\2713  "; }
.fm-toolbar { display: flex; align-items: flex-end; gap: 22px; padding: 10px 20px 12px; border-bottom: 1px solid var(--line); background: var(--pre); flex-wrap: wrap; }
.fm-group { display: flex; flex-direction: column; gap: 5px; }
.fm-group-row { display: flex; align-items: center; gap: 10px; }
.fm-glabel { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.fm-group.nested { padding-left: 18px; border-left: 2px solid var(--line-strong); }
.fm-group.quiet .fm-seg button { padding: 4px 10px; font-size: 12.5px; }
.fm-spacer { flex: 1; }
.fm-skip { position: absolute; left: 12px; top: -48px; padding: 8px 12px; background: var(--ink); color: var(--top); z-index: 50; text-decoration: none; }
.fm-skip:focus { top: 8px; }
.fm :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.fm-statesel { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); font-size: 12.5px; color: var(--muted); }
.fm-statesel select { flex: 1; font: inherit; color: var(--ink); padding: 5px 8px; border: 1px solid var(--line-strong); background: var(--field); }
.fm-pick-list li.current { font-weight: 650; }
.fm-stage-tools { position: absolute; right: 12px; top: 12px; display: flex; gap: 8px; z-index: 4; }
.fm-stage-tools .fm-home { position: static; }
.fm-stage-tools .fm-seg button { padding: 5px 10px; font-size: 12px; }
.fm-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fm-legend-select { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; font-weight: 600; }
.fm-legend-select select { font: inherit; font-weight: 500; padding: 5px 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--ink); }
.fp-title { padding: 8px 0 4px; } .fp-title h1 { margin: 2px 0 0; font-size: 26px; }
.fm-kicker { display: block; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--kicker); }
.fm-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fm-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--field); }
.fm-seg button { border: 0; background: transparent; padding: 6px 11px; color: var(--ink-2); }
.fm-seg button + button { border-left: 1px solid var(--line); }
.fm-seg button.on { background: var(--seg-on); color: var(--on-ink); }
.fm-pick { position: relative; }
.fm-pick input { width: 230px; padding: 7px 10px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field); color: var(--ink); font: inherit; }
.fm-pick input:focus { outline: 2px solid var(--focus); }
.fm-pick-list { position: absolute; top: 38px; left: 0; width: 320px; max-height: 360px; overflow: auto; margin: 0; padding: 4px; list-style: none;
  background: var(--list); border: 1px solid var(--line-strong); border-radius: 10px; box-shadow: 0 16px 40px var(--shadow); z-index: 20; }
.fm-pick-list li { display: flex; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.fm-pick-list li:hover, .fm-pick-list li[aria-selected="true"] { background: var(--track); }
.fm-pick-list li.fm-pick-head { cursor: default; background: none; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--kicker); }
.fm-pick-list li .muted { font-size: 11.5px; white-space: nowrap; }
.fm-slider { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); } .fm-slider b { min-width: 28px; }
.fm-slider b { color: var(--ink); }
.fm-slider input { width: 130px; accent-color: var(--accent); }

.fm-main { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 400px; position: relative; }
.fm-stage { position: relative; min-width: 0; min-height: 0; overflow: hidden; touch-action: none; }
.fm-stage canvas { display: block; width: 100%; height: 100%; }
.fm-overlay { position: absolute; inset: 0; pointer-events: none; }
.map-label { position: absolute; left: 0; top: 0; padding: 2px 7px; border-radius: 6px; font-size: 11.5px; white-space: nowrap; font-weight: 600;
  background: var(--label); border: 1px solid var(--line-strong); color: var(--ink); }
.map-label[data-tone="amber"] { border-color: var(--amber-line); color: var(--on-ink); }
.map-label[data-tone="teal"] { border-color: var(--teal-line); color: var(--teal-ink); font-weight: 500; }
.map-label[data-tone="sky"] { border-color: var(--sky-line); color: var(--sky-ink); }
/* A tour stop's takeaway on the map: the words sit where the map moves, and arrive with it. */
.map-label[data-tone="callout"] { z-index: 2; padding: 7px 12px; border-radius: 8px; font-size: 17px; line-height: 1.25; font-weight: 700; white-space: normal;
  width: max-content; max-width: 320px; text-align: center; color: var(--ink); background: var(--card); border: 2px solid var(--accent);
  animation: fm-callout .7s ease-out .35s both; }
@keyframes fm-callout { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) { .map-label[data-tone="callout"], .fm-open-steps li, .fm-open .fm-intro-btns { animation: none !important; } }
.fm-legend { position: absolute; top: 12px; left: 14px; max-width: 330px; padding: 9px 11px; border-radius: 12px; font-size: 12px;
  background: var(--glass); border: 1px solid var(--line); backdrop-filter: blur(4px); }
.fm-legend i { display: inline-block; width: 18px; height: 4px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
.fm-legend .fm-ra { margin: 0 0 6px; font-family: "Iowan Old Style", Georgia, serif; font-size: 13.5px; line-height: 1.35; color: var(--ra); }
.fm-tip { position: absolute; pointer-events: none; max-width: 280px; padding: 8px 10px; border-radius: 10px; font-size: 12.5px; z-index: 8;
  background: var(--tip); border: 1px solid var(--line-strong); box-shadow: 0 10px 30px var(--shadow-2); }
.fm-honesty { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 14px; font-size: 11.5px; letter-spacing: 0.03em; color: var(--honesty);
  background: linear-gradient(transparent, var(--honesty-bg) 40%); text-align: center; pointer-events: none; }
.fm-home { position: absolute; right: 12px; top: 12px; padding: 5px 10px; border-radius: 8px; font-size: 12px; background: var(--glass-2); border: 1px solid var(--line); color: var(--ink-2); }
.fm-error { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); padding: 12px 16px; background: var(--error); border-radius: 10px; }

.fm-intro, .fm-tour { position: absolute; z-index: 6; border-radius: 16px; background: var(--card); border: 1px solid var(--card-line); backdrop-filter: blur(6px);
  box-shadow: 0 20px 60px var(--shadow); }
.fm-intro { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(480px, calc(100% - 32px)); padding: 22px 24px; }
.fm-anchor { margin: 0 !important; font-family: "Iowan Old Style", Georgia, serif; font-size: 25px; line-height: 1.3; color: var(--anchor); }
.fm-intro-q { margin-top: 12px !important; color: var(--ink-2); }
.fm-intro-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
/* The opening card: the claim, its source, one line on what the map does, then in. */
.fm-open { width: min(540px, calc(100% - 32px)); z-index: 7; background: color-mix(in srgb, var(--card) 80%, transparent) !important; }
.fm-open .fm-anchor { margin-top: 8px !important; }
.fm-open-cite { margin: 6px 0 0 !important; font-size: 13px; color: var(--muted); }
/* The argument in three beats, each arriving in turn so the eye reads them in order. */
.fm-open-steps { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 10px; counter-reset: beat; }
.fm-open-steps li { counter-increment: beat; display: grid; grid-template-columns: 26px 1fr; gap: 10px; align-items: baseline; font-size: 16px; line-height: 1.4; color: var(--ink-2);
  animation: fm-beat .6s ease-out both; }
.fm-open-steps li::before { content: counter(beat); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 4px; background: var(--accent); color: var(--on-accent); font: 700 12px/1 Inter, system-ui, sans-serif; translate: 0 2px; }
.fm-open-steps li b { color: var(--ink); font-size: 18px; }
.fm-open-steps li:nth-child(1) { animation-delay: .5s; }
.fm-open-steps li:nth-child(2) { animation-delay: 1.3s; }
.fm-open-steps li:nth-child(3) { animation-delay: 2.1s; }
.fm-open .fm-intro-btns { animation: fm-beat .5s ease-out 2.7s both; }
@keyframes fm-beat { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
.fm-open .fm-btn { min-height: 40px; }
/* On the flow stop: swap in another good without leaving the tour. */
.fm-tour-picks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0 2px; font-size: 13px; color: var(--ink-2); }
.fm-tour-picks button { min-height: 28px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--btn-line); background: var(--panel-2); color: var(--ink); font-size: 13px; }
.fm-tour-picks button.on { background: var(--seg-on); border-color: var(--accent); font-weight: 600; }
.fm-tour-ask { display: inline-block; margin-top: 10px; font-size: 13px; color: var(--ink-2); }
.fm-btn { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--btn-line); background: var(--panel-2); }
.fm-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
.fm-btn.ghost { background: transparent; border-color: transparent; color: var(--muted); }
.fm-tour { left: 16px; bottom: 40px; width: min(440px, calc(100% - 32px)); padding: 14px 16px; }
.fm-tour-bar { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 0 0 12px; font: 600 14px/1.2 Inter, system-ui, sans-serif; }
.fm-tour-bar b { color: var(--accent); font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
.fm-tour-bar span { color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fm-home[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
@media (min-width: 1400px) { .fm-tour { width: min(520px, calc(100% - 32px)); padding: 18px 20px; } .fm-tour p { font-size: 17px; } }
:root .fm-tour { border-top: 3px solid var(--accent); }
.fm-rail { list-style: none; display: flex; gap: 4px; margin: 0 0 10px; padding: 0; }
.fm-rail li { flex: 1; }
.fm-rail button { width: 100%; padding: 6px 0 0; border: 0; border-top: 2px solid var(--card-line); background: none; color: var(--kicker); font: 500 11px/1 Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; letter-spacing: .06em; text-align: left; cursor: pointer; min-height: 24px; }
.fm-rail button.done { border-top-color: var(--kicker); }
.fm-rail button.on { border-top-color: var(--ink, currentColor); color: inherit; font-weight: 600; }
.fm-rail button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.fm-tour-head { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--kicker); }
.fm-tour p { font-family: "Iowan Old Style", Georgia, serif; font-size: 16px; line-height: 1.4; }

.fm-side { border-left: 1px solid var(--line); background: var(--panel); display: flex; flex-direction: column; min-height: 0; }
.fm-chart { padding: 10px 12px 6px; border-bottom: 1px solid var(--line); background: var(--panel2); }
.fm-chart-head { font-size: 12.5px; }
.fm-chart svg { width: 100%; height: auto; display: block; }
.fm-chart .grid { stroke: var(--grid); stroke-width: 1; } .fm-chart .axis1 { stroke: var(--axis1); stroke-dasharray: 3 3; }
.fm-chart .tick { fill: var(--tick); font-size: 10px; } .fm-chart .lab { fill: var(--tick); font-size: 10px; }
.fm-chart .dot { fill: var(--accent); fill-opacity: .75; stroke: var(--dot-stroke); stroke-width: 1; cursor: pointer; }
.fm-chart .dot.persistent { stroke: var(--dot-persist); stroke-width: 1.4; }
.fm-chart .dot.sel { fill: var(--hilite); fill-opacity: 1; stroke: var(--dot-sel-stroke); stroke-width: 2; }
.fm-chart .dot:hover { fill-opacity: 1; }
.fm-chart-foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 11px; }
.dotkey { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); border: 1.4px solid var(--dot-persist); vertical-align: middle; }
.fm-tabs { display: flex; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
.fm-tabs button { border: 0; background: transparent; padding: 7px 9px; color: var(--muted); border-bottom: 2px solid transparent; white-space: nowrap; font-size: 13px; }
.fm-tabs button.on { color: var(--on-ink); border-bottom-color: var(--accent); }
.fm-panel { flex: 1; overflow: auto; padding: 12px 16px 28px; }
.fm-nav { display: flex; gap: 22px; margin-left: auto; font-size: 13.5px; }
.fm-nav a { color: var(--ink-2); text-decoration: none; padding: 4px 0; border-bottom: 2px solid transparent; }
.fm-nav a:hover { color: var(--ink); }
.fm-nav a[aria-current="page"] { color: var(--ink); border-bottom-color: var(--accent); }
.fp { height: auto; min-height: 100vh; overflow: visible; }
.fp-main { max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; }
.fp-section { padding: 22px 0; border-bottom: 1px solid var(--line); }
.fp-epigraph { margin: 18px 0 4px; padding: 2px 0 2px 16px; border-left: 3px solid var(--accent); max-width: 640px; }
.fp-epigraph blockquote { margin: 0; font-family: "Iowan Old Style", Georgia, serif; font-size: 19px; line-height: 1.45; color: var(--ink); }
.fp-epigraph figcaption { margin-top: 8px; font-size: 13px; color: var(--muted); }
.fp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.fp h2 { font-size: 20px; margin: 0 0 8px; }
.fp h3 { font-size: 13px; margin: 18px 0 6px; } .fp pre { white-space: pre-wrap; } .fp-caption { text-align: left; font-weight: 650; padding: 14px 0 4px; } .fp ul, .fp ol { padding-left: 20px; } .fp-defs { max-width: 640px; }
.fp-chart { width: 100%; height: auto; margin: 8px 0; }
.fp-chart .grid { stroke: var(--grid); } .fp-chart .tick { font-size: 11px; fill: var(--tick); }
.fp-chart .lab { font-size: 12px; fill: var(--ink-2); } .fp-chart .gdp { fill: var(--grey); }
.fp .fp-table { width: 100%; font-size: 13.5px; } .fp .fp-table th, .fp .fp-table td { padding: 6px 8px; text-align: left; vertical-align: top; }
.fp a { color: var(--accent); text-underline-offset: 2px; } .fp a:hover { color: var(--ink); }
.fp .fm-site .fm-brand { color: var(--ink); } .fp .fm-site .fm-nav a { color: var(--ink-2); } .fp .fm-site .fm-nav a[aria-current="page"], .fp .fm-site .fm-nav a:hover { color: var(--ink); } .fp-table .nowrap { white-space: nowrap; } .fp-table td.strong { font-weight: 650; } .fp-table td.muted { color: var(--muted); }
.fm-profile { margin-top: 6px; }
.fm-profile-row { display: grid; grid-template-columns: 1fr auto; gap: 0 10px; width: 100%; text-align: left; padding: 6px 4px; border: 0; border-bottom: 1px solid var(--line); background: transparent; }
.fm-profile-row:hover { background: var(--track); }
.fm-profile-row .small { grid-column: 1 / -1; }
.fm-profile-row.thin { opacity: .6; }
.fm-big { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.fm-big > div { background: var(--panel2); border: 1px solid var(--line); border-radius: 12px; padding: 9px 11px; }
.fm-big b { display: block; font-size: 22px; font-family: "Iowan Old Style", Georgia, serif; color: var(--hilite); }
.fm-big span { font-size: 12px; color: var(--muted); }
.fm-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px dashed var(--track); font-size: 13px; }
.fm-row span { color: var(--row-key); } .fm-row b { font-weight: 600; text-align: right; }
.fm-conf { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.fm-conf .bar { width: 70px; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
.fm-conf .bar i { display: block; height: 100%; background: var(--conf); }
.fm-conf.t0 { color: var(--muted); } .fm-conf.t0 .bar i { background: var(--grey); }
.fm-gap { margin: 8px 0 4px; }
.fm-gap-track { position: relative; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--track), var(--track-2)); }
.fm-gap-track span { position: absolute; top: -3px; width: 4px; height: 16px; border-radius: 2px; transform: translateX(-2px); }
.fm-gap-track .here { background: var(--amber); } .fm-gap-track .next { background: var(--teal); }
.fm-gap-labels { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); margin-top: 4px; }
.fm-cands { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
.fm-cands button, .fm-split button, .fm-barrow { display: flex; justify-content: space-between; gap: 8px; text-align: left; padding: 5px 8px; border-radius: 8px;
  border: 1px solid transparent; background: var(--btn-row); font-size: 12.5px; }
.fm-cands button:hover, .fm-split button:hover, .fm-barrow:hover { border-color: var(--line-strong); }
.fm-split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fm-split > div { display: flex; flex-direction: column; gap: 3px; }
.fm-split button.thin { opacity: .5; }
.fm-barrow { width: 100%; align-items: center; margin-bottom: 3px; }
.fm-barrow > span:first-child { width: 110px; }
.fm-barrow .bar { flex: 1; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
.fm-barrow .bar i { display: block; height: 100%; background: var(--accent); }
.fm-spark-row { display: flex; gap: 10px; align-items: center; }
.fm-spark { width: 150px; flex: none; }
.fm-spark .line { fill: none; stroke: var(--accent); stroke-width: 1.6; } .fm-spark .pt { fill: var(--hilite); } .fm-spark .pt.hollow { fill: none; stroke: var(--grey); }
.fm-spark .grid { stroke: var(--track-2); stroke-dasharray: 2 3; } .fm-spark .tick { fill: var(--tick); font-size: 9px; }
.fm-def { border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.fm-def details summary { cursor: pointer; color: var(--summary); font-size: 12.5px; margin-top: 4px; }
.fm-formal { font-size: 12.5px; color: var(--ink-2); }
.fm-formal pre { font: 11.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--pre); border: 1px solid var(--line); border-radius: 8px;
  padding: 8px 10px; overflow-x: auto; color: var(--code); white-space: pre; }
.fm-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin: 6px 0; }
.fm-table th, .fm-table td { padding: 3px 4px; border-bottom: 1px solid var(--track); text-align: right; }
.fm-table th:first-child, .fm-table td:first-child { text-align: left; }
.fm-legend-title { font-weight: 600; margin-bottom: 6px; }
.fm-legend-def { font-size: 12px; color: var(--ink-2); max-width: 250px; margin: 4px 0 6px; line-height: 1.35; }
.fm-author { border: 1px solid var(--line-strong); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
.fm-claim { border: 1px solid var(--line-strong); border-radius: 12px; padding: 10px 14px; background: var(--panel2); }
.fm-claim .tier { display: inline-block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: var(--tier); color: var(--teal-ink); }
.fm-claim h3 { margin-top: 10px; }
.fm-claim ul, .fm ul.small { margin: 4px 0; padding-left: 18px; }
.ra-rungs { list-style: none; margin: 6px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ra-rungs li { padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; }
.ra-rungs li.on { border-color: var(--line-strong); background: var(--panel2); }
.ra-rung-head { display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; font-size: 12.5px; }
.ra-rung-head code { font-weight: 600; }
.ra-rung-head span { color: var(--ink-2); }
.ra-rungs .bar { display: block; height: 6px; margin: 4px 0 3px; border-radius: 3px; background: var(--track); overflow: hidden; }
.ra-rungs .bar i { display: block; height: 100%; background: var(--accent); }
.ra-rung-years { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 12px; color: var(--muted); }
.ra-rung-years .now { color: var(--ink); font-weight: 600; }

.fm-allc { font-size: 13px; color: var(--ink-2); padding: 7px 10px; border: 1px dashed var(--line-strong); border-radius: 10px; }
.fm-ra-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.fm-ra-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
.fm-compare { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); }
.fm-compare select { font: inherit; color: var(--ink); background: var(--field); border: 1px solid var(--line-strong); border-radius: 8px; padding: 4px 6px; }
.fm-note { font-size: 12.5px; padding: 6px 9px; border-left: 3px solid var(--accent); background: var(--panel-2); border-radius: 6px; }
.fm-cube-wrap { position: relative; height: 320px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-top: 6px; }
.fm-cube-wrap canvas { display: block; width: 100%; height: 100%; }
.fm-cube-key { position: absolute; left: 8px; right: 8px; bottom: 6px; pointer-events: none; }
.fm-lattice { width: 100%; height: auto; display: block; }
.fm-lattice .edge { stroke: var(--line-strong); stroke-width: 1; }
.fm-lattice .node { cursor: pointer; }
.fm-lattice .node rect:first-child { fill: var(--panel-2); stroke: var(--line-strong); }
.fm-lattice .node.on rect:first-child { fill: var(--seg-on); stroke: var(--accent); stroke-width: 1.6; }
.fm-lattice .nm { font: 600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace; fill: var(--ink); }
.fm-lattice .lv { font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; fill: var(--muted); }
.fm-lattice .track { fill: var(--track); } .fm-lattice .bar { fill: var(--accent); }
.fm-bring { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 4px; }
.fm-bring-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.fm-bring-row { display: grid; grid-template-columns: 1fr 56px 46px; grid-template-areas: "nm bar v" "sub sub sub"; gap: 1px 8px; align-items: center;
  width: 100%; text-align: left; padding: 5px 8px; margin: 2px 0; border-radius: 8px; border: 1px solid transparent; background: var(--btn-row); font-size: 12.5px; }
.fm-bring-row:hover, .fm-bring-row.on { border-color: var(--line-strong); }
.fm-bring-row .nm { grid-area: nm; font-weight: 600; }
.fm-bring-row .bar { grid-area: bar; height: 5px; border-radius: 3px; background: var(--track); overflow: hidden; }
.fm-bring-row .bar i { display: block; height: 100%; background: var(--teal); }
.fm-bring-row .v { grid-area: v; text-align: right; font-weight: 600; }
.fm-bring-row .sub { grid-area: sub; color: var(--muted); font-size: 11.5px; }
.fm-bring-row.thin { opacity: 0.55; }
.fm-bring-row .tag { margin-left: 6px; font-size: 10px; font-weight: 500; padding: 0 6px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--muted); }
.fm-bring-row .tag.recv { color: var(--teal-ink); } .fm-bring-row .tag.ship { color: var(--on-ink); }
.fm-caveat { margin-top: 8px; }
.fm-meaning { margin-top: 6px; font-size: 12px; } .fm-meaning summary { cursor: pointer; color: var(--summary); }
.fm-meaning ul { margin: 4px 0 0; padding-left: 16px; } .fm-meaning li { margin: 2px 0; }
.fm-ramp { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.fm-ramp i { flex: 1; height: 8px; border-radius: 4px; width: auto !important; margin: 0 !important; }

@media ${PHONE} {
  .fm-site { height: auto; flex-wrap: wrap; gap: 6px 16px; padding: 10px 16px 0; }
  .fm-brand { flex: 1; padding: 4px 0; }
  .fm-brandbox { flex: 1; }
  .fm-tagline { display: none; }
  .fm-site .fm-nav { order: 3; width: 100%; margin-left: 0; gap: 20px; overflow-x: auto; padding-bottom: 6px; }
  .fm-site .fm-nav a { padding: 6px 0; }
  .fm { height: auto; min-height: 100vh; overflow: visible; }
  .fm-top { padding: 0; }
  .fm h1 { font-size: 19px; }
  /* Toolbar: one control per row, its label beside it. */
  .fm-toolbar { flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 8px; padding: 10px 16px 12px; }
  .fm-group { flex-direction: row; align-items: flex-start; gap: 10px; }
  .fm-glabel { flex: none; width: 82px; padding-top: 11px; }
  .fm-group.quiet { align-items: center; }
  .fm-group.quiet .fm-glabel { padding-top: 0; }
  .fm-group-row { flex: 1; min-width: 0; flex-wrap: wrap; gap: 8px; }
  .fm-group.nested { padding-left: 0; border-left: 0; }
  .fm-spacer { display: none; }
  .fm-seg button { min-height: 36px; }
  .ra-legend-long { display: none; }
  .fm-group.quiet .fm-seg button, .fm-stage-tools .fm-seg button { min-height: 32px; }
  .fm-controls { gap: 6px; }
  .fm-pick, .fm-pick input { width: 100%; }
  .fm-group-row .fm-pick { flex: 1 1 100%; }
  .fm-pick input { min-height: 36px; }
  .fm-pick-list { width: 100%; }
  .fm-slider { flex-direction: row; align-items: center; gap: 8px; width: 100%; }
  .fm-slider input { flex: 1; height: 32px; }
  .fm-main { display: block; }
  .fm-stage { height: 58vh; height: 58svh; min-height: 340px; }
  .fm-stage-tools { top: auto; bottom: 52px; }
  .fm-home { top: auto; bottom: 46px; right: 8px; min-height: 32px; }
  .fm-legend { top: 8px; left: 8px; right: 8px; max-width: none; font-size: 12px; padding: 6px 9px; }
  .fm-legend .fm-ra { font-size: 12px; }
  .fm-legend-def { font-size: 12px; max-width: none; }
  .fm-honesty { font-size: 11.5px; padding: 5px 8px; }
  .fm-anchor { font-size: 20px; }
  .fm-intro { padding: 16px 18px; }
  .fm-open-cite { font-size: 12px; }
  .fm-open-steps { margin-top: 10px; gap: 6px; }
  .fm-open-steps li { font-size: 14px; grid-template-columns: 22px 1fr; gap: 8px; }
  .fm-open-steps li b { font-size: 15px; }
  .map-label[data-tone="callout"] { font-size: 14px; padding: 5px 9px; max-width: 190px; }
  .fm-tour-picks button { min-height: 32px; }
  /* The tour card sits under the map, so it never hides the states it talks about. */
  .fm-tour { position: relative; left: auto; right: auto; bottom: auto; width: auto; padding: 10px 16px 14px; border-radius: 0; border-left: 0; border-right: 0; box-shadow: none; }
  .fm-tour p { font-size: 14px; line-height: 1.4; margin: 4px 0; }
  :root[data-theme^="observatory"] .fm-tour p { font-size: 14px; line-height: 1.4; }
  .fm-tour-lead { font-size: 16px !important; }
  .fm-tour-bar b { font-size: 18px; }
  .fm-tour .fm-intro-btns { margin-top: 8px; }
  .fm-tour .fm-btn { min-height: 40px; padding: 8px 14px; }
  .fm-rail button { min-height: 32px; padding-top: 10px; }
  .fm-side { border-left: 0; border-top: 1px solid var(--line); border-radius: 16px 16px 0 0; margin-top: -10px; position: relative; z-index: 4; }
  .fm-tour + .fm-side { margin-top: 0; border-radius: 0; }
  .fm-side::before { content: ""; display: block; width: 44px; height: 4px; border-radius: 2px; background: var(--line-strong); margin: 8px auto 0; }
  .fm-tour + .fm-side::before { display: none; }
  .fm-tabs button { min-height: 36px; }
  .fm-panel { overflow: visible; }
  .fp-main { padding: 16px 16px 48px; }
  .fp code, .fp a { overflow-wrap: anywhere; }
  .fp details summary { padding: 6px 0; }
  .fp-table a { display: inline-block; padding: 4px 0; }
}
/* Phone held sideways: the map fills the screen and the tour card floats at its right edge. */
@media (max-height: 500px) and (orientation: landscape) {
  .fm-stage { height: calc(100svh - 8px); min-height: 0; }
  .fm-main { position: relative; }
  .fm-tour { position: absolute; top: 8px; right: 8px; left: auto; bottom: auto; width: min(340px, 40%); max-height: calc(100svh - 24px); overflow: auto; border: 1px solid var(--card-line); }
  .fm-tour + .fm-side { margin-top: -10px; border-radius: 16px 16px 0 0; }
  .fm-legend { right: auto; max-width: 46%; }
}
/* Narrow phones: wide tables become one block per row, each value labelled. */
@media (max-width: 560px) {
  .fm-open { background: var(--card) !important; }
  .fp-stack thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .fp-stack, .fp-stack tbody, .fp-stack tr, .fp-stack td { display: block; width: 100%; }
  .fp-stack caption { display: block; }
  .fp-stack tr { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .fp .fp-stack td { padding: 2px 0; border: 0; text-align: left; white-space: normal; }
  .fp .fp-stack td.pair { display: inline-block; width: auto; margin-right: 16px; }
  .fp-stack td[data-label]::before { content: attr(data-label) " "; color: var(--muted); font-size: 12px; }
}

/* Narrow phones: the three scopes take two rows, Beyond pairs on its own. */
@media (max-width: 560px) {
  .fm-seg[aria-label="Scope"] { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .fm-seg[aria-label="Scope"] button:last-child { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--line); }
}
`;
