// Village builder: grid village, timed construction, producing buildings, one-builder upgrade queue, raids with auto-resolve.
// Time is wall-clock: advance(now) integrates from the saved timestamp, so closing the tab still earns offline.
let C, S, db, host, ui = {}, off = [], sel = "house", pick = null, av, lastChip = 0, saveT = 0, ro = null;
const COLS = 8, ROWS = 5, CAP = 8 * 3600e3, RAID_MS = 90e3;
const TYPES = {
  house: { n: "House", res: "gold", cost: { gold: 30 }, col: "#f0b7a0" },
  farm: { n: "Farm", res: "food", cost: { gold: 25 }, col: "#cfe08f" },
  workshop: { n: "Workshop", res: "wood", cost: { gold: 30, food: 10 }, col: "#d9c19a" },
  tower: { n: "Tower", res: null, cost: { gold: 20, wood: 30 }, col: "#b9bfd6" },
};
const RATE = 0.3; // per second per level
const BUILD_MS = 8e3;
const upMs = (b) => 10e3 * b.lvl, upCost = (b) => ({ gold: 40 * b.lvl });
const DEF = () => { const t = Date.now(); return { res: { gold: 80, food: 40, wood: 40 }, b: [], troops: 0, last: t, nextRaid: t + RAID_MS, raids: 0, won: 0 }; };
const save = () => { S.saved = Date.now(); db.set(S); };
const afford = (c) => Object.entries(c).every(([k, v]) => S.res[k] >= v);
const pay = (c) => Object.entries(c).forEach(([k, v]) => (S.res[k] -= v));
const costTxt = (c) => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ");
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const defence = () => S.b.filter((b) => b.t === "tower" && b.fin <= Date.now()).reduce((a, b) => a + 4 * b.lvl, 0) + S.troops;
const at = (x, y) => S.b.find((b) => b.x === x && b.y === y);

function advance(now) {
  const from = Math.max(S.last, now - CAP), away = now - S.last > 25e3;
  const before = { ...S.res };
  for (const b of S.b) {
    const T = TYPES[b.t]; if (!T.res) { if (b.up && b.up.end <= now) { b.lvl++; b.up = null; } continue; }
    const seg = (a, c, lvl) => { if (c > a) S.res[T.res] += (c - a) / 1000 * RATE * lvl; };
    const start = Math.max(from, b.fin);
    if (b.up && b.up.end <= now) { seg(start, Math.min(now, b.up.end), b.lvl); seg(Math.max(start, b.up.end), now, b.lvl + 1); b.lvl++; b.up = null; C.say(`${T.n} upgraded to level ${b.lvl}.`); C.sound.beep(700, .12); }
    else seg(start, now, b.lvl);
  }
  S.last = now;
  if (now >= S.nextRaid) { raid(away); S.nextRaid = now + RAID_MS; }
  if (away) { const g = ["gold", "food", "wood"].map((k) => `${Math.floor(S.res[k] - before[k])} ${k}`).join(", "); C.toast(`While you were away: +${g}`, ui.board); }
}
function raid(away, strength) {
  const str = strength || 3 + 2 * S.raids, def = defence(); S.raids++;
  if (def >= str) { S.won++; S.res.gold += 20; C.say(`Raid repelled${away ? " while you were away" : ""}. Defence ${def} against ${str}. Plus 20 gold.`); C.toast(`Raid repelled! ${def} vs ${str}. +20 gold`, ui.board); C.sound.beep(820, .2); }
  else { const lost = Math.floor(S.res.gold * .2); S.res.gold -= lost; C.say(`Raiders won this time. Defence ${def} against ${str}. Lost ${lost} gold. Build towers or train troops.`); C.toast(`Raid got through (${def} vs ${str}). -${lost} gold`, ui.board); C.sound.beep(140, .25, "sawtooth"); }
  avReact(def >= str);
}
function avReact(ok) { av?.set(ok ? { expression: "excited", clip: "Celebrate" } : { expression: "sad", clip: "Idle" }); setTimeout(() => av?.set({ expression: "happy", clip: "Idle" }), 2000); }

function place(x, y) {
  const T = TYPES[sel];
  if (at(x, y)) { pick = at(x, y); info(); drawTiles(); return; }
  if (!afford(T.cost)) { C.toast(`Need ${costTxt(T.cost)}`, ui.board); C.sound.beep(150, .1, "square"); return; }
  pay(T.cost); const b = { t: sel, x, y, lvl: 1, fin: Date.now() + BUILD_MS, up: null }; S.b.push(b); pick = b;
  C.say(`${T.n} placed. It will be ready in ${BUILD_MS / 1000} seconds.`); C.sound.beep(520, .1); save(); drawTiles(); info(); resChips(true);
}
function upgrade() {
  const b = pick; if (!b) return;
  const busy = S.b.some((q) => q.up); if (b.fin > Date.now()) return C.toast("Still under construction", ui.board);
  if (b.lvl >= 3) return C.toast("Max level", ui.board);
  if (busy) return C.toast("Your builder is busy. One upgrade at a time.", ui.board);
  if (!afford(upCost(b))) return C.toast(`Need ${costTxt(upCost(b))}`, ui.board);
  pay(upCost(b)); b.up = { end: Date.now() + upMs(b) }; C.say(`Upgrading ${TYPES[b.t].n} to level ${b.lvl + 1}. Ready in ${upMs(b) / 1000} seconds.`); save(); drawTiles(); info(); resChips(true);
}
function train() { if (S.res.food < 10) return C.toast("Need 10 food", ui.board); if (S.troops >= 20) return C.toast("Barracks full", ui.board); S.res.food -= 10; S.troops++; C.say(`Troop trained. Defence ${defence()}.`); C.sound.beep(450, .08); save(); resChips(true); }

const glyph = { house: '<path d="M4 14V8l6-5 6 5v6z" fill="#fff"/><path d="M3 9l7-6 7 6" fill="none" stroke="#1d1d1b" stroke-width="1.5"/><rect x="8.500" y="10" width="3" height="4" fill="#1d1d1b"/>', farm: '<path d="M3 6h14M3 10h14M3 14h14" stroke="#1d1d1b" stroke-width="1.600"/>', workshop: '<rect x="4" y="7" width="12" height="8" fill="#fff"/><path d="M4 7l3-3h6l3 3" fill="none" stroke="#1d1d1b" stroke-width="1.500"/><circle cx="10" cy="11" r="2" fill="none" stroke="#1d1d1b" stroke-width="1.300"/>', tower: '<rect x="7" y="5" width="6" height="11" fill="#fff"/><path d="M6 5V2.500h2V4h1V2.500h2V4h1V2.500h2V5z" fill="#1d1d1b"/><rect x="9" y="9" width="2" height="3" fill="#1d1d1b"/>' };
function drawTiles() {
  ui.grid.innerHTML = "";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const b = at(x, y), c = C.h("button", `vb-t${b ? " has" : ""}${pick === b && b ? " pick" : ""}`); c.type = "button"; c.dataset.x = x; c.dataset.y = y; c.tabIndex = (x === 0 && y === 0) ? 0 : -1;
    c.setAttribute("aria-label", b ? `${TYPES[b.t].n} level ${b.lvl}, row ${y + 1} column ${x + 1}` : `Empty plot, row ${y + 1} column ${x + 1}. Place ${TYPES[sel].n}`);
    if (b) { c.style.setProperty("--c", TYPES[b.t].col); c.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${glyph[b.t]}</svg><i class="vb-lv">${"•".repeat(b.lvl)}</i><em class="vb-cd" data-id="${S.b.indexOf(b)}"></em>`; }
    ui.grid.appendChild(c);
  }
  tickTimers();
}
function tickTimers() {
  const now = Date.now();
  ui.grid.querySelectorAll(".vb-cd").forEach((e) => {
    const b = S.b[+e.dataset.id]; if (!b) return; const T = b.fin > now ? `Build ${mmss(b.fin - now)}` : b.up ? `Up ${mmss(b.up.end - now)}` : "";
    e.textContent = T; e.parentElement.classList.toggle("busy", !!T);
  });
}
function info() {
  const b = pick; const bb = ui.info;
  if (!b) { bb.innerHTML = `<b>${TYPES[sel].n}</b><span>Cost ${costTxt(TYPES[sel].cost)}. ${TYPES[sel].res ? `Makes ${RATE} ${TYPES[sel].res}/s per level.` : "Adds 4 defence per level."} Tap an empty plot to build.</span>`; ui.up.disabled = true; return; }
  const T = TYPES[b.t], now = Date.now();
  const st = b.fin > now ? `Building, ready in ${mmss(b.fin - now)}` : b.up ? `Upgrading to level ${b.lvl + 1}, ready in ${mmss(b.up.end - now)}` : b.lvl >= 3 ? "Max level" : `Upgrade: ${costTxt(upCost(b))}, ${upMs(b) / 1000}s`;
  bb.innerHTML = `<b>${T.n} level ${b.lvl}</b><span>${st}</span>`; ui.up.disabled = b.fin > now || !!b.up || b.lvl >= 3;
}
function resChips(force) {
  const n = performance.now(); if (!force && n - lastChip < 300) return; lastChip = n;
  C.chip("gold", `Gold ${Math.floor(S.res.gold)}`); C.chip("food", `Food ${Math.floor(S.res.food)}`); C.chip("wood", `Wood ${Math.floor(S.res.wood)}`);
  C.chip("def", `Defence ${defence()}`); C.chip("raid", `Raid in ${mmss(S.nextRaid - Date.now())}`);
  ui.builder.textContent = S.b.some((q) => q.up) ? "Builder: busy" : "Builder: free";
  ui.troops.textContent = `Train troop (10 food) · ${S.troops}`;
}

export function mount(container, ctx) {
  C = ctx; C.css("village.css"); db = C.store(); S = db.get(DEF()); if (!Array.isArray(S.b)) S.b = [];
  for (const k of ["gold", "food", "wood"]) if (!Number.isFinite(S.res?.[k])) S.res = DEF().res;
  host = C.h("div", "g-root vb");
  host.innerHTML = `<div class="vb-main"><div class="vb-board" data-board><div class="vb-grid" role="group" aria-label="Village plots. Arrow keys move, Enter builds or selects." data-grid></div></div>
<div class="vb-side"><div class="vb-adv" data-adv></div>
 <div class="vb-pal" role="radiogroup" aria-label="Building to place">${Object.entries(TYPES).map(([id, t]) => `<button type="button" class="g-btn sm" role="radio" aria-checked="${id === sel}" data-pal="${id}">${t.n}<small>${costTxt(t.cost)}</small></button>`).join("")}</div>
 <p class="vb-info" data-info aria-live="polite"></p>
 <div class="g-row"><button type="button" class="g-btn sm pri" data-up>Upgrade</button><button type="button" class="g-btn sm" data-train></button><button type="button" class="g-btn sm" data-raid title="Send a small practice raid now">Practice raid</button></div>
 <p class="vb-bl" data-builder></p></div></div>`;
  container.appendChild(host);
  const q = (s) => host.querySelector(s);
  ui = { board: q("[data-board]"), grid: q("[data-grid]"), info: q("[data-info]"), up: q("[data-up]"), troops: q("[data-train]"), builder: q("[data-builder]") };
  av = C.avatar({ shape: "cube", expression: "happy" }); q("[data-adv]").appendChild(av); q("[data-adv]").insertAdjacentHTML("beforeend", "<span>Advisor Kamiji: build, upgrade, repel raids.</span>");
  C.hint("Pick a building, tap an empty plot. Buildings finish after a timer, then produce. Towers and troops defend raids; closing the tab keeps earning.");
  pick = null; advance(Date.now()); drawTiles(); info(); resChips(true);
  host.addEventListener("click", (e) => {
    const t = e.target.closest(".vb-t"); if (t) { place(+t.dataset.x, +t.dataset.y); return; }
    const p = e.target.closest("[data-pal]"); if (p) { sel = p.dataset.pal; pick = null; host.querySelectorAll("[data-pal]").forEach((b) => b.setAttribute("aria-checked", String(b === p))); info(); drawTiles(); return; }
    if (e.target.closest("[data-up]")) return upgrade();
    if (e.target.closest("[data-train]")) return train();
    if (e.target.closest("[data-raid]")) { raid(false, 3); resChips(true); save(); }
  });
  ui.grid.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
    const t = e.target.closest(".vb-t"); if (!t) return; e.preventDefault();
    const x = C.clamp(+t.dataset.x + d[0], 0, COLS - 1), y = C.clamp(+t.dataset.y + d[1], 0, ROWS - 1), n = ui.grid.children[y * COLS + x];
    t.tabIndex = -1; n.tabIndex = 0; n.focus();
  });
  let acc = 0;
  off.push(C.loop((dt) => {
    advance(Date.now()); acc += dt; if (acc > .25) { acc = 0; tickTimers(); info(); resChips(); if (Date.now() - saveT > 3000) { saveT = Date.now(); save(); } }
  }));
  addEventListener("pagehide", save);
}
export function reset() { S = DEF(); pick = null; drawTiles(); info(); resChips(true); save(); C.say("Village reset."); }
export function destroy() { try { save(); } catch (e) { /* ignore */ } off.forEach((f) => f()); off = []; removeEventListener("pagehide", save); host?.remove(); host = null; }
