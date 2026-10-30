// Creature catching on a stylised map. Fake "GPS": wander button, pad or drag. No real geolocation. Original art.
let C, S, db, host, off = [], alive = false, ui = {}, catching = null, heading = 0, pan = { x: 0, y: 0 };
const W = 1000, STEP = 34, NEAR = 120;
export const SPECIES = [
  { id: "shizuku", name: "Shizuku", col: "#7ecbff", rare: 1, kind: "drop" },
  { id: "hana", name: "Hana", col: "#ff9ec7", rare: 1, kind: "flower" },
  { id: "koke", name: "Koke", col: "#8fd68a", rare: 1, kind: "moss" },
  { id: "kumo", name: "Kumo", col: "#dfe7f5", rare: 2, kind: "cloud" },
  { id: "chochin", name: "Chochin", col: "#ff9a6b", rare: 2, kind: "lantern" },
  { id: "cubie", name: "Cubie", col: "#b583ff", rare: 2, kind: "cube" },
  { id: "orby", name: "Orby", col: "#ffd23f", rare: 3, kind: "sphere" },
  { id: "kon", name: "Kon", col: "#f2b24d", rare: 3, kind: "fox" },
];
const sp = (id) => SPECIES.find((x) => x.id === id);

function art(s, size = 56) {
  const f = '<circle cx="23" cy="34" r="2.4" fill="#2c2a33"/><circle cx="37" cy="34" r="2.4" fill="#2c2a33"/><path d="M26 40q4 4 8 0" stroke="#2c2a33" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="19" cy="39" r="2.4" fill="#ff7a9a" opacity=".5"/><circle cx="41" cy="39" r="2.4" fill="#ff7a9a" opacity=".5"/>';
  const body = { cube: `<rect x="10" y="16" width="40" height="38" rx="9" fill="${s.col}"/><path d="M10 25q20-9 40 0" fill="rgba(255,255,255,.35)"/>`, sphere: `<circle cx="30" cy="35" r="20" fill="${s.col}"/><ellipse cx="23" cy="26" rx="6" ry="4" fill="rgba(255,255,255,.45)"/>`, drop: `<path d="M30 6C20 22 10 30 10 41a20 15 0 0040 0C50 30 40 22 30 6z" fill="${s.col}"/>`, cloud: `<circle cx="20" cy="38" r="12" fill="${s.col}"/><circle cx="31" cy="30" r="14" fill="${s.col}"/><circle cx="42" cy="38" r="11" fill="${s.col}"/><rect x="12" y="38" width="38" height="12" rx="6" fill="${s.col}"/>` }[s.kind] ||
    `<ellipse cx="30" cy="37" rx="21" ry="18" fill="${s.col}"/><ellipse cx="23" cy="28" rx="6" ry="4" fill="rgba(255,255,255,.4)"/>`;
  const extra = { flower: [0, 72, 144, 216, 288].map((a) => `<ellipse cx="30" cy="14" rx="5" ry="7" fill="#fff" stroke="#ffb3d1" transform="rotate(${a} 30 20)"/>`).join("") + '<circle cx="30" cy="20" r="3.5" fill="#ffd23f"/>',
    moss: '<path d="M18 22c4-8 8-8 12-2 4-6 8-6 12 2z" fill="#5fae6a"/>', lantern: '<rect x="25" y="8" width="10" height="7" rx="2" fill="#7a5a44"/><path d="M30 8V3" stroke="#7a5a44" stroke-width="2"/>',
    fox: '<path d="M12 24l4-14 9 9zM48 24l-4-14-9 9z" fill="#f2b24d"/><path d="M15 21l2-6 4 4zM45 21l-2-6-4 4z" fill="#fff4e0"/>', drop: "", cloud: "", cube: "", sphere: "" }[s.kind] || "";
  return `<svg viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true" focusable="false">${extra}${body}${f}</svg>`;
}

function terrain() {
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let b = "";
  for (let i = 0; i < 46; i++) { const x = r() * 940, y = r() * 940, w = 40 + r() * 70, hh = 40 + r() * 70; b += `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="10" fill="${["#e8efd9", "#f1ead8", "#e3ecdc", "#efe3d3"][i % 4]}"/>`; }
  for (let i = 0; i < 18; i++) { const x = r() * 960, y = r() * 960; b += `<circle cx="${x}" cy="${y}" r="${14 + r() * 26}" fill="#cfe5b8" opacity=".9"/>`; }
  const road = "M0 180C200 140 320 260 520 220S860 120 1000 200M120 0C160 300 60 520 200 700S380 900 340 1000M600 0C640 260 760 380 700 560S820 860 900 1000M0 640C240 600 420 740 620 700S900 620 1000 700";
  return `<svg viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" aria-hidden="true" focusable="false"><rect width="${W}" height="${W}" fill="#f6f3e8"/>${b}
<path d="M760 760c60-40 140-30 170 20s-20 120-100 130-130-60-70-150z" fill="#bfe0f2"/><path d="M80 760c40-30 100-20 110 30s-30 90-80 80-70-60-30-110z" fill="#bfe0f2"/>
<path d="${road}" stroke="#fff" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${road}" stroke="#e2dccb" stroke-width="2" fill="none" stroke-dasharray="6 8"/></svg>`;
}

const DEF = () => ({ x: 500, y: 500, dex: {}, balls: 10, steps: 0, cr: [], nid: 1 });
const save = () => db.set({ x: S.x, y: S.y, dex: S.dex, balls: S.balls, steps: S.steps, cr: S.cr, nid: S.nid });
const species = () => SPECIES.filter((s) => S.dex[s.id] > 0).length;
function chips() { C.chip("dex", `Dex ${species()}/${SPECIES.length}`); C.chip("balls", `Balls ${S.balls}`); C.chip("steps", `Steps ${S.steps}`); }

function pickSpecies() {
  const bag = []; SPECIES.forEach((s) => { for (let i = 0; i < 4 - s.rare; i++) bag.push(s); });
  return C.pick(bag);
}
function spawn() {
  S.cr = S.cr.filter((c) => Math.hypot(c.x - S.x, c.y - S.y) < 380);
  while (S.cr.length < 4) {
    const a = Math.random() * 6.283, hasNear = S.cr.some((q) => Math.hypot(q.x - S.x, q.y - S.y) < NEAR - 20), d = hasNear ? C.rnd(90, 200) : C.rnd(45, 90), s = pickSpecies();
    S.cr.push({ id: S.nid++, sp: s.id, x: C.clamp(S.x + Math.cos(a) * d, 30, W - 30), y: C.clamp(S.y + Math.sin(a) * d, 30, W - 30) });
  }
}

function drawCreatures() {
  ui.layer.textContent = "";
  for (const c of S.cr) {
    const s = sp(c.sp), b = C.h("button", "mp-cr", art(s, 54)); b.type = "button"; b.dataset.sp = c.sp; b.dataset.id = c.id;
    b.style.left = `${c.x}px`; b.style.top = `${c.y}px`; b.style.setProperty("--d", `${(c.id % 5) * -.4}s`);
    b.setAttribute("aria-label", `${s.name}, a wild creature, ${Math.round(Math.hypot(c.x - S.x, c.y - S.y) / 10)} metres away. Tap to catch.`);
    ui.layer.appendChild(b);
  }
  near();
}
function near() { ui.layer.querySelectorAll(".mp-cr").forEach((b) => { const c = S.cr.find((q) => q.id == b.dataset.id); b.classList.toggle("near", !!c && Math.hypot(c.x - S.x, c.y - S.y) < NEAR); }); }

function cam() {
  const w = ui.view.clientWidth || 280, hh = ui.view.clientHeight || 420;
  const cx = C.clamp(S.x + pan.x, w / 2, W - w / 2), cy = C.clamp(S.y + pan.y, hh / 2, W - hh / 2);
  ui.world.style.transform = `translate(${Math.round(w / 2 - cx)}px, ${Math.round(hh / 2 - cy)}px)`;
  ui.me.style.left = `${S.x}px`; ui.me.style.top = `${S.y}px`;
  ui.recenter.hidden = !(pan.x || pan.y);
}
function move(dx, dy) {
  if (catching) return;
  const n = Math.hypot(dx, dy) || 1;
  S.x = C.clamp(S.x + dx / n * STEP, 30, W - 30); S.y = C.clamp(S.y + dy / n * STEP, 30, W - 30); pan = { x: 0, y: 0 };
  S.steps++; if (S.steps % 8 === 0 && S.balls < 12) { S.balls++; C.toast("+1 ball found"); }
  if (S.steps % 3 === 0) spawn();
  C.sound.beep(300 + (S.steps % 4) * 40, .04);
  if (S.steps % 3 === 0) drawCreatures(); else near();
  cam(); chips(); save();
}
function wander() { heading += C.rnd(-.9, .9); if (S.x < 80 || S.x > W - 80 || S.y < 80 || S.y > W - 80) heading = Math.atan2(500 - S.y, 500 - S.x); move(Math.cos(heading), Math.sin(heading)); }

// ---- catch screen ----------------------------------------------------------------------------------------------
const PERIOD = 1500;
const ringScale = (t) => 1.9 - 1.5 * (((t % PERIOD) / PERIOD));
function tol(s) { return .22 - .035 * s.rare; }
function openCatch(c) {
  const s = sp(c.sp);
  catching = { c, s, tries: 3, t0: performance.now(), busy: false };
  ui.catch.hidden = false;
  ui.cArt.innerHTML = art(s, 120); ui.cName.textContent = `${s.name} appeared!`;
  ui.cInfo.textContent = ""; updateCatch();
  ui.throw.focus(); C.say(`${s.name} appeared. Press Throw when the ring is inside the green circle.`);
}
function updateCatch() { ui.tries.textContent = `Tries ${catching.tries} · Balls ${S.balls}`; ui.throw.disabled = catching.busy || S.balls <= 0; }
function zone() { const k = catching, sc = ringScale(performance.now() - k.t0), d = Math.abs(sc - 1), t = tol(k.s); return { sc, z: d <= t ? "in" : d <= t * 2.2 ? "near" : "out" }; }
function throwBall() {
  const k = catching; if (!k || k.busy || S.balls <= 0) return;
  const { z } = zone(); k.busy = true; S.balls--; k.tries--;
  ui.ball.classList.remove("fly"); void ui.ball.offsetWidth; if (!C.reduced) ui.ball.classList.add("fly");
  C.sound.beep(520, .08);
  setTimeout(() => {
    if (!catching) return;
    const ok = z === "in" || (z === "near" && Math.random() < .45);
    if (ok) {
      S.dex[k.s.id] = (S.dex[k.s.id] || 0) + 1; S.cr = S.cr.filter((q) => q.id !== k.c.id);
      const first = S.dex[k.s.id] === 1;
      ui.cInfo.textContent = z === "in" ? "Great throw! Caught!" : "Caught!";
      C.burst(ui.catch, "+1", 50, 40); C.sound.beep(880, .2);
      C.say(`${z === "in" ? "Great throw. " : ""}You caught ${k.s.name}${first ? ", a new dex entry" : ""}. Dex ${species()} of ${SPECIES.length}.`);
      if (species() === SPECIES.length) C.say("Dex complete! Every creature found.");
      ui.cArt.classList.add("got");
      setTimeout(() => closeCatch(true), 900);
    } else if (k.tries <= 0 || S.balls <= 0) {
      S.cr = S.cr.filter((q) => q.id !== k.c.id);
      ui.cInfo.textContent = `${k.s.name} ran off.`; C.say(`${k.s.name} ran off.`);
      setTimeout(() => closeCatch(true), 900);
    } else { ui.cInfo.textContent = z === "near" ? "So close! Try again." : "Missed. Wait for the green."; C.say(ui.cInfo.textContent); k.busy = false; updateCatch(); }
    chips(); save();
  }, C.reduced ? 80 : 420);
  updateCatch();
}
function closeCatch(redraw) {
  catching = null; ui.catch.hidden = true; ui.cArt.classList.remove("got");
  if (redraw) { spawn(); drawCreatures(); } chips(); save(); ui.view.focus();
}

function dex() {
  ui.dexList.innerHTML = SPECIES.map((s) => {
    const n = S.dex[s.id] || 0;
    return `<li class="mp-card${n ? "" : " unseen"}">${art(s, 46)}<b>${n ? s.name : "???"}</b><span>${n ? "x" + n : "not found"}</span></li>`;
  }).join("");
  ui.dexSum.textContent = `${species()} of ${SPECIES.length} found · ${Object.values(S.dex).reduce((a, b) => a + b, 0)} caught`;
}

export function mount(container, ctx) {
  C = ctx; alive = true; C.css("map.css"); db = C.store(); S = db.get(DEF());
  if (!Array.isArray(S.cr)) S.cr = [];
  host = C.h("div", "g-root mp");
  host.innerHTML = `<div class="mp-view" tabindex="0" role="group" aria-label="Map. Use the arrow keys or the pad to walk, or drag to look around."><div class="mp-world" style="width:${W}px;height:${W}px">${terrain()}<div class="mp-layer"></div><div class="mp-me" aria-hidden="true"><span class="mp-pulse"></span></div></div>
<div class="mp-top"><button type="button" class="g-btn sm" data-dex>Dex</button><button type="button" class="g-btn sm" data-recenter hidden>Recenter</button></div></div>
<div class="mp-pad" role="group" aria-label="Walk controls">
 <button type="button" class="g-btn mp-u" data-dir="0,-1" aria-label="Walk north">&#9650;</button><button type="button" class="g-btn mp-l" data-dir="-1,0" aria-label="Walk west">&#9664;</button>
 <button type="button" class="g-btn pri mp-w" data-wander>Wander</button><button type="button" class="g-btn mp-r" data-dir="1,0" aria-label="Walk east">&#9654;</button><button type="button" class="g-btn mp-d" data-dir="0,1" aria-label="Walk south">&#9660;</button></div>
<div class="g-overlay mp-catch" hidden role="dialog" aria-label="Catch"><h4 data-cname></h4><div class="mp-stage"><div class="mp-target"></div><div class="mp-ring" data-zone="out"></div><div class="mp-cart" data-cart></div><span class="mp-ball"></span></div>
 <p data-cinfo aria-hidden="true"></p><p class="mp-tries" data-tries></p><div class="g-row"><button type="button" class="g-btn pri" data-throw>Throw</button><button type="button" class="g-btn" data-run>Run</button></div></div>
<div class="g-overlay mp-dex" hidden role="dialog" aria-label="Creature dex"><h4>Dex</h4><p data-dexsum></p><ul class="mp-grid" data-dexlist></ul><button type="button" class="g-btn pri" data-dexclose>Close</button></div>`;
  container.appendChild(host);
  ui = { view: host.querySelector(".mp-view"), world: host.querySelector(".mp-world"), layer: host.querySelector(".mp-layer"), me: host.querySelector(".mp-me"), recenter: host.querySelector("[data-recenter]"),
    catch: host.querySelector(".mp-catch"), cArt: host.querySelector("[data-cart]"), cName: host.querySelector("[data-cname]"), cInfo: host.querySelector("[data-cinfo]"), tries: host.querySelector("[data-tries]"),
    throw: host.querySelector("[data-throw]"), ring: host.querySelector(".mp-ring"), ball: host.querySelector(".mp-ball"), dex: host.querySelector(".mp-dex"), dexList: host.querySelector("[data-dexlist]"), dexSum: host.querySelector("[data-dexsum]") };
  const me = ui.me; me.appendChild(C.avatar({ shape: "sphere" }));
  C.hint("Walk with the pad, arrow keys or Wander (no real location is used). Tap a glowing creature, then Throw with the ring in the green.");
  spawn(); drawCreatures(); cam(); chips();

  host.addEventListener("click", (e) => {
    const t = e.target;
    const d = t.closest("[data-dir]"); if (d) { const [x, y] = d.dataset.dir.split(",").map(Number); move(x, y); return; }
    if (t.closest("[data-wander]")) return wander();
    if (t.closest("[data-throw]")) return throwBall();
    if (t.closest("[data-run]")) { C.say("You stepped back."); return closeCatch(false); }
    if (t.closest("[data-dex]")) { dex(); ui.dex.hidden = false; return; }
    if (t.closest("[data-dexclose]")) { ui.dex.hidden = true; ui.view.focus(); return; }
    if (t.closest("[data-recenter]")) { pan = { x: 0, y: 0 }; cam(); return; }
    const cr = t.closest(".mp-cr");
    if (cr && !dragged) {
      const c = S.cr.find((q) => q.id == cr.dataset.id); if (!c) return;
      if (Math.hypot(c.x - S.x, c.y - S.y) > NEAR) { C.toast("Too far. Walk closer."); return; }
      openCatch(c);
    }
  });
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!ui.dex.hidden) { ui.dex.hidden = true; ui.view.focus(); } else if (catching) closeCatch(false); return; }
    if (e.target !== ui.view) return;
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key];
    if (m) { e.preventDefault(); move(...m); } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); wander(); }
  });
  // drag to pan
  let dragging = null, dragged = false;
  ui.view.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) { dragged = false; return; } dragging = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; dragged = false; ui.view.setPointerCapture?.(e.pointerId); });
  ui.view.addEventListener("pointermove", (e) => { if (!dragging) return; const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y; if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true; pan = { x: dragging.px - dx, y: dragging.py - dy }; cam(); });
  const end = () => { dragging = null; setTimeout(() => { dragged = false; }, 0); };
  ui.view.addEventListener("pointerup", end); ui.view.addEventListener("pointercancel", end);
  off.push(C.loop(() => { if (catching && !ui.catch.hidden) { const { sc, z } = zone(); ui.ring.style.transform = `translate(-50%,-50%) scale(${sc})`; ui.ring.dataset.zone = z; } }));
  new ResizeObserver(cam).observe(ui.view);
}
export function reset() { closeCatch(false); S = DEF(); heading = 0; pan = { x: 0, y: 0 }; spawn(); drawCreatures(); cam(); chips(); save(); ui.dex.hidden = true; C.say("Map reset. Dex cleared."); }
export function destroy() { save?.(); off.forEach((f) => f()); off = []; catching = null; host?.remove(); host = null; }
