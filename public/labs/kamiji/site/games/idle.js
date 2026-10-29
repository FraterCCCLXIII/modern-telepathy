// Idle clicker: tap or hold Kamiji for sparkles, buy helpers and upgrades, nap to prestige for a dream multiplier, earn offline.
let C, S, db, host, ui = {}, off = [], av, holdT = 0, holdIv = 0, avT = 0, saveAcc = 0, uiAcc = 0, pops = 0;
const GENS = [{ id: "pip", n: "Pip helper", base: 15, cps: .5 }, { id: "lantern", n: "Lantern glow", base: 100, cps: 3 }, { id: "meadow", n: "Meadow garden", base: 900, cps: 20 }, { id: "star", n: "Star machine", base: 9000, cps: 130 }];
const UPS = [{ id: "paws", n: "Soft paws", d: "Taps are worth 2x", cost: 50, tap: 2 }, { id: "cheer", n: "Cheer squad", d: "Helpers make 2x", cost: 400, gen: 2 }, { id: "snacks", n: "Golden snacks", d: "Taps are worth 3x", cost: 2500, tap: 3 }, { id: "luck", n: "Lucky stars", d: "Helpers make 2x", cost: 8000, gen: 2 }];
const DEF = () => ({ s: 0, life: 0, dreams: 0, gens: { pip: 0, lantern: 0, meadow: 0, star: 0 }, ups: [], last: Date.now(), taps: 0 });
const save = () => { S.last = Date.now(); db.set(S); };
const mult = () => 1 + .15 * S.dreams;
const tapVal = () => UPS.filter((u) => S.ups.includes(u.id) && u.tap).reduce((a, u) => a * u.tap, 1) * mult();
const genMult = () => UPS.filter((u) => S.ups.includes(u.id) && u.gen).reduce((a, u) => a * u.gen, 1) * mult();
const cps = () => GENS.reduce((a, g) => a + g.cps * S.gens[g.id], 0) * genMult();
const cost = (g) => Math.ceil(g.base * 1.15 ** S.gens[g.id]);
const dreamGain = () => Math.floor(Math.sqrt(S.life / 800));
function fmt(n) { if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n)); const u = ["k", "M", "B", "T"]; let i = -1; while (n >= 1000 && i < 3) { n /= 1000; i++; } return `${n.toFixed(n < 10 ? 2 : 1)}${u[i]}`; }

function earn(v) { S.s += v; S.life += v; }
function tap(x, y) {
  const v = tapVal(); earn(v); S.taps++; C.sound.beep(500 + (S.taps % 5) * 60, .03, "triangle", .03);
  if (!C.reduced) { ui.k.classList.remove("sq"); void ui.k.offsetWidth; ui.k.classList.add("sq"); if (pops++ % 2 === 0) C.burst(ui.stage, `+${fmt(v)}`, x ?? 50, y ?? 40); }
  if (!avT) { av.set({ expression: "excited" }); avT = setTimeout(() => { avT = 0; av.set({ expression: "happy" }); }, 600); }
  head();
}
function head() {
  ui.n.textContent = fmt(S.s); ui.ps.textContent = `${fmt(cps())} per second · tap ${fmt(tapVal())}`;
  C.chip("s", `Sparkles ${fmt(S.s)}`); C.chip("ps", `${fmt(cps())}/s`); C.chip("dreams", `Dreams ${S.dreams}`);
  ui.nap.disabled = dreamGain() < 1; ui.nap.textContent = dreamGain() >= 1 ? `Nap and dream: +${dreamGain()} dream${dreamGain() > 1 ? "s" : ""} (resets this run)` : `Nap and dream (needs ${fmt(800)} sparkles this run)`;
  ui.list.querySelectorAll("[data-buy],[data-up]").forEach((b) => { const c = +b.dataset.c; b.disabled = S.s < c; });
  ui.goal.textContent = S.dreams === 0 ? (S.life < 800 ? `Goal: earn 800 sparkles this run (${fmt(S.life)}/800), then nap for your first dream.` : "Goal reached: nap and dream for a lasting multiplier!") : `Each dream makes everything +15%. Now ${mult().toFixed(2)}x.`;
}
function list() {
  ui.list.innerHTML = `<h4>Helpers</h4>${GENS.map((g) => `<button type="button" class="g-btn id-row" data-buy="${g.id}" data-c="${cost(g)}"><span><b>${g.n}</b><small>${fmt(g.cps * genMult())}/s each</small></span><span class="id-n">${S.gens[g.id]}</span><span class="id-c">${fmt(cost(g))}</span></button>`).join("")}
<h4>Upgrades</h4>${UPS.filter((u) => !S.ups.includes(u.id)).map((u) => `<button type="button" class="g-btn id-row" data-up="${u.id}" data-c="${u.cost}"><span><b>${u.n}</b><small>${u.d}</small></span><span class="id-c">${fmt(u.cost)}</span></button>`).join("") || '<p class="id-none">All upgrades bought.</p>'}`;
  head();
}

export function mount(container, ctx) {
  C = ctx; C.css("idle.css"); db = C.store(); S = db.get(DEF()); const d = DEF(); S.gens = { ...d.gens, ...S.gens }; if (!Array.isArray(S.ups)) S.ups = [];
  host = C.h("div", "g-root id");
  host.innerHTML = `<div class="id-top"><div class="id-n0" data-n aria-hidden="true">0</div><div class="id-l">sparkles</div><div class="id-ps" data-ps></div></div>
<div class="id-stage" data-stage><button type="button" class="id-k" data-k aria-label="Pet Kamiji to earn sparkles. Hold to keep going."><span class="id-av" data-av></span></button></div>
<p class="id-goal" data-goal></p><div class="id-list" data-list tabindex="0" role="region" aria-label="Helpers and upgrades"></div><div class="id-foot"><button type="button" class="g-btn pri" data-nap></button></div><p class="tg-sr" role="status" aria-live="polite" data-ann></p>`;
  container.appendChild(host);
  const q = (s) => host.querySelector(s);
  ui = { n: q("[data-n]"), ps: q("[data-ps]"), stage: q("[data-stage]"), k: q("[data-k]"), list: q("[data-list]"), nap: q("[data-nap]"), goal: q("[data-goal]") };
  av = C.avatar({ shape: "sphere", expression: "happy" }); q("[data-av]").appendChild(av);
  C.hint("Tap or hold Kamiji (Space or Enter works too). Buy helpers and upgrades. Nap to turn this run into dreams: a lasting bonus. Offline time pays half.");
  const away = Math.min(4 * 3600, (Date.now() - S.last) / 1000);
  if (away > 20 && cps() > 0) { const g = cps() * away * .5; earn(g); setTimeout(() => C.toast(`Away ${Math.round(away / 60)} min: +${fmt(g)} sparkles`, host), 300); }
  list();
  ui.k.addEventListener("pointerdown", (e) => { if (e.button) return; const r = ui.stage.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100; if (e.pointerType === "mouse" || e.pointerType === "touch" || e.pointerType === "pen") { tap(x, y); clearTimeout(holdT); clearInterval(holdIv); holdT = setTimeout(() => { holdIv = setInterval(() => tap(x, y), 150); }, 350); ui.k.dataset.p = "1"; } });
  const stop = () => { clearTimeout(holdT); clearInterval(holdIv); setTimeout(() => delete ui.k.dataset.p, 50); };
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => ui.k.addEventListener(ev, stop));
  ui.k.addEventListener("click", (e) => { if (e.detail === 0) tap(); }); // keyboard activation only; pointer taps are handled above
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy]"); if (b) { const g = GENS.find((x) => x.id === b.dataset.buy), c = cost(g); if (S.s >= c) { S.s -= c; S.gens[g.id]++; C.say(`Bought ${g.n}. You have ${S.gens[g.id]}.`); C.sound.beep(700, .1); list(); save(); b.isConnected || host.querySelector(`[data-buy="${g.id}"]`)?.focus(); host.querySelector(`[data-buy="${g.id}"]`)?.focus(); } return; }
    const u = e.target.closest("[data-up]"); if (u) { const x = UPS.find((y) => y.id === u.dataset.up); if (S.s >= x.cost) { S.s -= x.cost; S.ups.push(x.id); C.say(`Upgrade bought: ${x.n}. ${x.d}.`); C.sound.beep(900, .12); list(); save(); ui.k.focus(); } return; }
    if (e.target.closest("[data-nap]") && dreamGain() >= 1) { const g = dreamGain(); S.dreams += g; Object.assign(S, { s: 0, life: 0, gens: DEF().gens, ups: [] }); C.say(`You napped and dreamed. Plus ${g} dreams. Everything is now ${mult().toFixed(2)} times faster.`); C.toast(`+${g} dream${g > 1 ? "s" : ""}! ${mult().toFixed(2)}x`, host); av.set({ expression: "sleepy" }); setTimeout(() => av.set({ expression: "happy" }), 1500); list(); save(); }
  });
  off.push(C.loop((dt) => { earn(cps() * dt); uiAcc += dt; saveAcc += dt; if (uiAcc > .12) { uiAcc = 0; head(); } if (saveAcc > 4) { saveAcc = 0; save(); } }));
  addEventListener("pagehide", save);
}
export function reset() { S = DEF(); list(); save(); C.say("Idle game reset."); }
export function destroy() { try { save(); } catch (e) { /* ignore */ } clearTimeout(holdT); clearInterval(holdIv); clearTimeout(avT); avT = 0; off.forEach((f) => f()); off = []; removeEventListener("pagehide", save); host?.remove(); host = null; }
