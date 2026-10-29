// Cozy garden: plant, water and harvest plots; light seasons; a market to sell crops and buy seeds; daily energy.
let C, S, db, host, ui = {}, off = [], av, tool = "plant", seed = "turnip";
const COLS = 4, ROWS = 3, DAY = 60, MAXE = 12, WATER = 20, CAP = 3600;
const CROPS = { turnip: { n: "Turnip", grow: 24, price: 12, cost: 4, best: 0, col: "#f2f2e6", leaf: "#6fbf73" }, berry: { n: "Berry", grow: 36, price: 22, cost: 8, best: 1, col: "#d9526b", leaf: "#4f9d63" }, pumpkin: { n: "Pumpkin", grow: 54, price: 40, cost: 15, best: 2, col: "#f08c32", leaf: "#5fa85f" } };
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"], TINT = ["#e6f3d6", "#fbf0c4", "#f6dcc0", "#e3ecf5"];
const DEF = () => ({ coins: 10, seeds: { turnip: 3, berry: 0, pumpkin: 0 }, crops: { turnip: 0, berry: 0, pumpkin: 0 }, plots: Array(COLS * ROWS).fill(null), energy: MAXE, day: 1, clock: 0, last: Date.now(), earned: 0, goal: false });
const save = () => { S.last = Date.now(); db.set(S); };
const season = () => (S.day - 1) % 4;
const rate = (c) => (season() === 3 ? .4 : season() === CROPS[c].best ? 1.5 : 1);

function chips() { C.chip("day", `Day ${S.day} ${SEASONS[season()]}`); C.chip("coins", `Coins ${S.coins}`); C.chip("energy", `Energy ${S.energy}/${MAXE}`); C.chip("goal", S.goal ? "Thriving!" : `Earn ${Math.min(S.earned, 100)}/100`); }
function advance(sec) {
  for (const p of S.plots) if (p) { const use = Math.min(sec, p.w); if (use > 0) p.g = Math.min(CROPS[p.c].grow, p.g + use * rate(p.c)); p.w = Math.max(0, p.w - sec); }
  S.clock += sec; while (S.clock >= DAY) { S.clock -= DAY; S.day++; S.energy = MAXE; C.say(`A new day: Day ${S.day}, ${SEASONS[season()]}. Energy restored.`); if (S.day > 1 && season() === 3) C.toast("Winter: crops grow slowly", ui.board); }
}
const stage = (p) => (p.g >= CROPS[p.c].grow ? 3 : Math.floor(p.g / CROPS[p.c].grow * 3));
function plant(p) {
  const c = CROPS[p.c], s = stage(p), fruit = s === 3;
  const body = [`<circle cx="20" cy="30" r="3" fill="#7a5a44"/>`, `<path d="M20 32V24" stroke="${c.leaf}" stroke-width="2"/><ellipse cx="16" cy="23" rx="4" ry="2.500" fill="${c.leaf}"/><ellipse cx="24" cy="22" rx="4" ry="2.500" fill="${c.leaf}"/>`, `<path d="M20 33V18" stroke="${c.leaf}" stroke-width="2.500"/><ellipse cx="14" cy="19" rx="6" ry="3.500" fill="${c.leaf}"/><ellipse cx="26" cy="17" rx="6" ry="3.500" fill="${c.leaf}"/><ellipse cx="20" cy="12" rx="4" ry="5" fill="${c.leaf}"/>`, `<ellipse cx="14" cy="17" rx="6" ry="3.500" fill="${c.leaf}"/><ellipse cx="26" cy="17" rx="6" ry="3.500" fill="${c.leaf}"/><circle cx="20" cy="26" r="9" fill="${c.col}" stroke="rgba(0,0,0,.2)"/><path d="M20 17v-5" stroke="${c.leaf}" stroke-width="2.500"/>`][s];
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${body}</svg>${p.w > 0 ? '<i class="gd-w"></i>' : ""}${fruit ? '<i class="gd-r"></i>' : ""}`;
}
function plots() {
  ui.grid.innerHTML = S.plots.map((p, i) => `<button type="button" class="gd-p${p && stage(p) === 3 ? " ripe" : ""}${p && p.w > 0 ? " wet" : ""}" data-p="${i}" aria-label="${p ? `${CROPS[p.c].n}, ${["seed", "sprout", "growing", "ripe"][stage(p)]}${p.w > 0 ? ", watered" : ", dry"}` : "Empty plot"}, plot ${i + 1}" tabindex="${i === 0 ? 0 : -1}">${p ? plant(p) : ""}</button>`).join("");
  ui.board.style.background = TINT[season()];
}
function seedsUI() {
  ui.seeds.innerHTML = Object.entries(CROPS).map(([id, c]) => `<button type="button" class="g-btn sm" role="radio" aria-checked="${seed === id}" data-seed="${id}">${c.n} seeds · ${S.seeds[id]}</button>`).join("");
  ui.tools.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tool === tool)));
}
function market() {
  const total = Object.entries(S.crops).reduce((a, [k, n]) => a + n * CROPS[k].price, 0);
  ui.mk.innerHTML = `<h4>Market</h4><p>Coins ${S.coins}</p><div class="gd-mk">${Object.entries(CROPS).map(([id, c]) => `<div><b>${c.n}</b><span>Have ${S.crops[id]} · sells ${c.price}</span><button type="button" class="g-btn sm" data-sell="${id}" ${S.crops[id] ? "" : "disabled"}>Sell</button><button type="button" class="g-btn sm" data-buy="${id}" ${S.coins >= c.cost ? "" : "disabled"}>Buy seed ${c.cost}</button></div>`).join("")}</div><div class="g-row"><button type="button" class="g-btn sm" data-sellall ${total ? "" : "disabled"}>Sell all (${total})</button><button type="button" class="g-btn pri sm" data-mkclose>Close</button></div>`;
}
function spend() { if (S.energy <= 0) { C.toast("Out of energy. Sleep to start a new day.", ui.board); C.sound.beep(150, .1, "square"); return false; } S.energy--; return true; }
function act(i) {
  const p = S.plots[i];
  if (tool === "plant") {
    if (p) return C.toast("Something is already growing", ui.board);
    if (S.seeds[seed] <= 0) return C.toast(`No ${CROPS[seed].n} seeds. Buy some at the market.`, ui.board);
    if (!spend()) return; S.seeds[seed]--; S.plots[i] = { c: seed, g: 0, w: 0 }; C.say(`Planted ${CROPS[seed].n}.`); C.sound.beep(420, .08);
  } else if (tool === "water") {
    if (!p) return C.toast("Plant something first", ui.board); if (stage(p) === 3) return C.toast("Already ripe. Harvest it!", ui.board);
    if (!spend()) return; p.w = WATER; C.say(`Watered the ${CROPS[p.c].n}.`); C.sound.beep(600, .08);
  } else {
    if (!p || stage(p) < 3) return C.toast(p ? "Not ripe yet" : "Nothing to harvest", ui.board);
    if (!spend()) return; S.crops[p.c]++; S.plots[i] = null; C.say(`Harvested a ${CROPS[p.c].n}. Sell it at the market.`); C.burst(ui.board, "+1", 50, 40); C.sound.beep(820, .15);
    av.set({ expression: "excited", clip: "Celebrate" }); setTimeout(() => av.set({ expression: "happy", clip: "Idle" }), 1400);
  }
  plots(); chips(); seedsUI(); save(); ui.grid.querySelector(`[data-p="${i}"]`)?.focus();
}
function sell(id) { const n = S.crops[id]; if (!n) return; const v = n * CROPS[id].price; S.coins += v; S.earned += v; S.crops[id] = 0; afterSale(`Sold ${n} ${CROPS[id].n} for ${v} coins.`); }
function afterSale(msg) { C.say(msg); C.sound.beep(980, .12); if (!S.goal && S.earned >= 100) { S.goal = true; C.toast("Garden thriving! 100 coins earned", ui.board); C.say("Garden thriving. You earned 100 coins."); } market(); chips(); seedsUI(); save(); }

export function mount(container, ctx) {
  C = ctx; C.css("garden.css"); db = C.store(); S = db.get(DEF()); const d = DEF(); S.seeds = { ...d.seeds, ...S.seeds }; S.crops = { ...d.crops, ...S.crops };
  if (!Array.isArray(S.plots) || S.plots.length !== COLS * ROWS) S.plots = d.plots;
  host = C.h("div", "g-root gd");
  host.innerHTML = `<div class="gd-main"><div class="gd-board" data-board><div class="gd-grid" role="group" aria-label="Garden plots" data-grid></div></div>
<div class="gd-side"><div class="gd-adv" data-adv></div><div class="gd-tools" role="radiogroup" aria-label="Tool" data-tools>${[["plant", "Plant"], ["water", "Water"], ["harvest", "Harvest"]].map(([id, l]) => `<button type="button" class="g-btn sm" role="radio" data-tool="${id}" aria-checked="${id === tool}">${l}</button>`).join("")}</div>
<div class="gd-seeds" role="radiogroup" aria-label="Seed to plant" data-seeds></div><div class="g-row"><button type="button" class="g-btn sm" data-market>Market</button><button type="button" class="g-btn sm" data-sleep>Sleep (next day)</button></div></div></div>
<div class="g-overlay gd-mkt" data-mk hidden role="dialog" aria-label="Market"></div>`;
  container.appendChild(host);
  ui = { board: host.querySelector("[data-board]"), grid: host.querySelector("[data-grid]"), tools: host.querySelector("[data-tools]"), seeds: host.querySelector("[data-seeds]"), mk: host.querySelector("[data-mk]") };
  av = C.avatar({ shape: "sphere" }); host.querySelector("[data-adv]").appendChild(av); host.querySelector("[data-adv]").insertAdjacentHTML("beforeend", "<span>Gardener Kamiji</span>");
  const away = Math.min(CAP, (Date.now() - S.last) / 1000);
  C.hint("Pick Plant, Water or Harvest, then tap a plot. Crops only grow while watered, and faster in their favourite season. Sell at the market.");
  if (away > 20) { advance(away); C.toast(`Your garden kept growing while you were away`, ui.board); }
  plots(); chips(); seedsUI();
  host.addEventListener("click", (e) => {
    const p = e.target.closest("[data-p]"); if (p) return act(+p.dataset.p);
    const t = e.target.closest("[data-tool]"); if (t) { tool = t.dataset.tool; seedsUI(); return; }
    const s = e.target.closest("[data-seed]"); if (s) { seed = s.dataset.seed; tool = "plant"; seedsUI(); return; }
    if (e.target.closest("[data-market]")) { market(); ui.mk.hidden = false; ui.mk.querySelector("button")?.focus(); return; }
    if (e.target.closest("[data-mkclose]")) { ui.mk.hidden = true; ui.grid.querySelector("[tabindex='0']")?.focus(); return; }
    const sl = e.target.closest("[data-sell]"); if (sl) return sell(sl.dataset.sell);
    if (e.target.closest("[data-sellall]")) { Object.keys(CROPS).forEach(sell); return; }
    const b = e.target.closest("[data-buy]"); if (b) { const c = CROPS[b.dataset.buy]; if (S.coins >= c.cost) { S.coins -= c.cost; S.seeds[b.dataset.buy]++; afterSale(`Bought a ${c.n} seed.`); } return; }
    if (e.target.closest("[data-sleep]")) { advance(DAY - S.clock + .01); S.energy = MAXE; plots(); chips(); save(); C.toast(`Day ${S.day}: ${SEASONS[season()]}`, ui.board); }
  });
  ui.grid.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key]; if (!d) return; e.preventDefault();
    const cur = +e.target.closest("[data-p]").dataset.p, n = C.clamp(cur + d, 0, COLS * ROWS - 1), el = ui.grid.children[n]; ui.grid.children[cur].tabIndex = -1; el.tabIndex = 0; el.focus();
  });
  host.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ui.mk.hidden) { ui.mk.hidden = true; } });
  let acc = 0, sv = 0;
  off.push(C.loop((dt) => { advance(dt); acc += dt; sv += dt; if (acc > .5) { acc = 0; const f = document.activeElement?.dataset?.p; plots(); chips(); if (f != null) ui.grid.querySelector(`[data-p="${f}"]`)?.focus(); } if (sv > 4) { sv = 0; save(); } }));
  addEventListener("pagehide", save);
}
export function reset() { S = DEF(); tool = "plant"; seed = "turnip"; ui.mk.hidden = true; plots(); chips(); seedsUI(); save(); C.say("Garden reset."); }
export function destroy() { try { save(); } catch (e) { /* ignore */ } off.forEach((f) => f()); off = []; removeEventListener("pagehide", save); host?.remove(); host = null; }
