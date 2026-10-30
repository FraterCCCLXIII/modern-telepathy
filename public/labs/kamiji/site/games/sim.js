// Life sim: a cutaway house, five needs that decay, furniture that satisfies them, a day/night clock, a daily schedule, decorating.
let C, S, db, host, ui = {}, off = [], av, bubbleT = 0, saveAcc = 0;
const MIN_PER_SEC = 8; // game minutes per real second: a day is 3 real minutes
const NEEDS = [["hunger", "Hunger", .7], ["energy", "Energy", .5], ["fun", "Fun", .8], ["social", "Social", .6], ["hygiene", "Hygiene", .5]];
const FURN = [
  { id: "fridge", name: "Fridge", room: 0, need: "hunger", gain: 45, secs: 3, verb: "snacks", em: "\u{1F35A}", x: 70, y: 52 },
  { id: "tv", name: "TV", room: 1, need: "fun", gain: 40, secs: 4, verb: "watches TV", em: "\u{1F3AE}", x: 24, y: 48 },
  { id: "phone", name: "Phone", room: 1, need: "social", gain: 45, secs: 3, verb: "calls a friend", em: "\u{1F4AC}", x: 74, y: 52 },
  { id: "bed", name: "Bed", room: 2, need: "energy", gain: 50, secs: 5, verb: "naps", em: "\u{1F634}", x: 40, y: 52 },
  { id: "shower", name: "Shower", room: 3, need: "hygiene", gain: 50, secs: 4, verb: "freshens up", em: "\u{1F6C1}", x: 60, y: 48 },
];
const ROOMS = ["Kitchen", "Living room", "Bedroom", "Bathroom"];
const PAL = ["#ffd9a8", "#cde7d6", "#cfd8f5", "#f5cfe0", "#e9e2c6"], FPAL = ["#c58a4e", "#6f9fd8", "#d96a6a", "#7cb87c", "#9a86d8"];
const GOALS = [{ id: "eat", t: "Eat in the morning (before 11:00)", f: (h) => h >= 6 && h < 11, by: ["fridge"] }, { id: "fun", t: "Have fun or call a friend in the afternoon (12:00 to 18:00)", f: (h) => h >= 12 && h < 18, by: ["tv", "phone"] }, { id: "sleep", t: "Sleep at night (after 21:00)", f: (h) => h >= 21 || h < 6, by: ["bed"] }];
const DEF = () => ({ n: { hunger: 80, energy: 80, fun: 70, social: 70, hygiene: 80 }, t: 7 * 60, day: 1, goals: {}, perfect: 0, wall: [0, 1, 2, 3], col: { fridge: 0, tv: 0, phone: 1, bed: 2, shower: 1 }, dec: 0, room: 1 });
const save = () => db.set(S);
const hour = () => Math.floor(S.t / 60) % 24;
const clock = () => `${String(hour()).padStart(2, "0")}:${String(Math.floor(S.t % 60 / 10) * 10).padStart(2, "0")}`;
const mood = () => Math.round(Object.values(S.n).reduce((a, b) => a + b, 0) / 5);
let busy = null, bub = "";

function chips() { C.chip("day", `Day ${S.day} ${clock()}`); C.chip("mood", `Mood ${mood()}%`); C.chip("perfect", `Perfect days ${S.perfect}`); C.chip("cosy", `Cosy ${S.dec}`); }
function needsUI() {
  ui.needs.innerHTML = NEEDS.map(([id, label]) => { const v = Math.round(S.n[id]); return `<div class="lf-need${v < 25 ? " low" : ""}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-valuetext="${v} percent"><span>${label}</span><div class="g-bar" style="--p:${v}%;--c:${v < 25 ? "#d65a5a" : "#4a8a5a"}"><i></i></div></div>`; }).join("");
}
function goalsUI() { ui.goals.innerHTML = GOALS.map((g) => `<li class="${S.goals[g.id] ? "done" : ""}">${S.goals[g.id] ? "&#10003; " : "&#9675; "}${g.t}</li>`).join(""); }
function drawHouse() {
  ui.house.innerHTML = ROOMS.map((r, i) => `<div class="lf-room" style="--w:${PAL[S.wall[i]]}" data-room="${i}"><span class="lf-rn">${r}</span><button type="button" class="lf-paint g-btn sm" data-paint="${i}" aria-label="Paint ${r} walls" hidden>Paint</button>${FURN.filter((f) => f.room === i).map((f) => `<button type="button" class="lf-f lf-${f.id}" data-f="${f.id}" style="--fc:${FPAL[S.col[f.id]]};left:${f.x}%;top:${f.y}%" aria-label="${f.name}: ${NEEDS.find((n) => n[0] === f.need)[1]} +${f.gain}"><b></b><span>${f.name}</span></button>`).join("")}</div>`).join("") + '<div class="lf-k" data-k></div><div class="lf-bub" data-bub aria-hidden="true"></div><div class="lf-night" aria-hidden="true"></div>';
  ui.k = ui.house.querySelector("[data-k]"); ui.k.appendChild(av); ui.bub = ui.house.querySelector("[data-bub]"); ui.night = ui.house.querySelector(".lf-night");
  placeK(S.room, 50, 62); applyDeco();
}
function applyDeco() { ui.house.classList.toggle("deco", !!ui.deco.getAttribute("aria-pressed") === true && ui.deco.getAttribute("aria-pressed") === "true"); ui.house.querySelectorAll("[data-paint]").forEach((b) => (b.hidden = ui.deco.getAttribute("aria-pressed") !== "true")); }
function placeK(room, x, y) { const col = room % 2, row = Math.floor(room / 2); ui.k.style.left = `${col * 50 + x / 2}%`; ui.k.style.top = `${row * 50 + y / 2}%`; S.room = room; }
function bubble(em) { if (em === bub) return; bub = em; ui.bub.textContent = em; const k = ui.k; ui.bub.style.left = k.style.left; ui.bub.style.top = k.style.top; }
function moodEmoji() {
  if (busy) return busy.f.em;
  const low = NEEDS.map(([id]) => [id, S.n[id]]).sort((a, b) => a[1] - b[1])[0];
  if (low[1] < 30) return { hunger: "\u{1F35A}", energy: "\u{1F634}", fun: "\u{1F3AE}", social: "\u{1F4AC}", hygiene: "\u{1F6C1}" }[low[0]];
  return mood() > 70 ? "\u{1F60A}" : "\u{1F642}";
}

function use(id) {
  if (busy) return C.toast("Kamiji is busy", ui.house);
  const f = FURN.find((q) => q.id === id), open = ui.deco.getAttribute("aria-pressed") === "true";
  if (open) { S.col[id] = (S.col[id] + 1) % FPAL.length; S.dec = decoCount(); drawHouse(); ui.house.querySelector(`[data-f="${id}"]`)?.focus(); C.say(`${f.name} repainted.`); save(); chips(); return; }
  busy = { f, left: f.secs, walk: C.reduced ? 0 : .6 };
  placeK(f.room, f.x, f.y + 14); ui.house.classList.add("busy"); C.say(`Kamiji ${f.verb}.`);
}
function decoCount() { const d = DEF(); return S.col && Object.keys(S.col).filter((k) => S.col[k] !== d.col[k]).length + S.wall.filter((w, i) => w !== d.wall[i]).length; }
function finish() {
  const f = busy.f; let g = f.gain; if (f.id === "bed" && (hour() >= 21 || hour() < 6)) g *= 1.5;
  S.n[f.need] = Math.min(100, S.n[f.need] + g); busy = null; ui.house.classList.remove("busy");
  C.burst(ui.house, `+${Math.round(g)}`, parseFloat(ui.k.style.left), parseFloat(ui.k.style.top) - 8); C.sound.beep(660, .12);
  const h = hour(); for (const q of GOALS) if (!S.goals[q.id] && q.by.includes(f.id) && q.f(h)) { S.goals[q.id] = true; C.say(`Goal done: ${q.t}`); C.toast("Goal complete!", ui.house); }
  av.set({ expression: "excited", clip: "Celebrate" }); setTimeout(() => av.set({ expression: "happy", clip: "Idle" }), 1400);
  needsUI(); goalsUI(); chips(); save();
}
function newDay() {
  const all = GOALS.every((g) => S.goals[g.id]);
  if (all) { S.perfect++; C.say(`Perfect day ${S.day}! All goals complete.`); C.toast("Perfect day!", ui.house); } else C.say(`Day ${S.day} ended with ${GOALS.filter((g) => S.goals[g.id]).length} of 3 goals.`);
  S.day++; S.goals = {}; goalsUI(); chips();
}
function tick(dt) {
  const prev = S.t; S.t += dt * MIN_PER_SEC;
  for (const [id, , r] of NEEDS) { const mult = id === "energy" && busy?.f.id === "bed" ? 0 : 1; S.n[id] = Math.max(0, S.n[id] - r * dt * mult); }
  if (S.t >= 24 * 60 + 6 * 60 - 0 && prev < 24 * 60 + 6 * 60) { S.t -= 24 * 60; newDay(); }
  if (busy) { if (busy.walk > 0) busy.walk -= dt; else { busy.left -= dt; ui.house.style.setProperty("--prog", `${(1 - busy.left / busy.f.secs) * 100}%`); if (busy.left <= 0) finish(); } }
  const night = hour() >= 21 || hour() < 6; ui.night.style.opacity = night ? ".38" : hour() >= 19 ? ".16" : "0";
  const em = moodEmoji(); if (em !== bub) bubble(em);
  saveAcc += dt; if (saveAcc > .4) { saveAcc = 0; needsUI(); chips(); } if (saveAcc === 0 && Math.random() < .08) save();
}

export function mount(container, ctx) {
  C = ctx; C.css("sim.css"); db = C.store(); S = db.get(DEF()); const d = DEF(); S.n = { ...d.n, ...S.n }; S.col = { ...d.col, ...S.col }; if (!Array.isArray(S.wall)) S.wall = d.wall; if (!S.goals || typeof S.goals !== "object") S.goals = {};
  if (S.t >= 24 * 60) S.t = 7 * 60;
  host = C.h("div", "g-root lf");
  host.innerHTML = `<div class="lf-main"><div class="lf-house" data-house></div><div class="lf-side"><div class="lf-needs" data-needs></div><ul class="lf-goals" data-goals aria-label="Today's schedule"></ul><div class="g-row"><button type="button" class="g-btn sm" data-deco aria-pressed="false">Decorate</button></div></div></div>`;
  container.appendChild(host);
  ui = { house: host.querySelector("[data-house]"), needs: host.querySelector("[data-needs]"), goals: host.querySelector("[data-goals]"), deco: host.querySelector("[data-deco]") };
  av = C.avatar({ shape: "sphere" }); busy = null; bub = "";
  C.hint("Click furniture to send Kamiji there and fill a need. Do the three daily goals for a perfect day. Decorate repaints furniture and walls.");
  drawHouse(); needsUI(); goalsUI(); chips();
  host.addEventListener("click", (e) => {
    const f = e.target.closest("[data-f]"); if (f) return use(f.dataset.f);
    const p = e.target.closest("[data-paint]"); if (p) { const i = +p.dataset.paint; S.wall[i] = (S.wall[i] + 1) % PAL.length; S.dec = decoCount(); drawHouse(); ui.house.querySelector(`[data-paint="${i}"]`)?.focus(); C.say(`${ROOMS[i]} repainted.`); chips(); save(); return; }
    if (e.target.closest("[data-deco]")) { const on = ui.deco.getAttribute("aria-pressed") !== "true"; ui.deco.setAttribute("aria-pressed", String(on)); ui.deco.textContent = on ? "Done decorating" : "Decorate"; applyDeco(); C.say(on ? "Decorate mode: choose furniture or Paint to change colours." : "Decorate mode off."); }
  });
  off.push(C.loop(tick));
  addEventListener("pagehide", save);
}
export function reset() { S = DEF(); busy = null; ui.house.classList.remove("busy"); ui.deco.setAttribute("aria-pressed", "false"); ui.deco.textContent = "Decorate"; bub = ""; drawHouse(); needsUI(); goalsUI(); chips(); save(); C.say("Home reset."); }
export function destroy() { try { save(); } catch (e) { /* ignore */ } off.forEach((f) => f()); off = []; removeEventListener("pagehide", save); host?.remove(); host = null; busy = null; }
