// Pocket Kamiji: a window of tiny playable prototypes (genres) starring Kamiji. No network, no audio unless enabled.
// Shell only: window frame, genre switcher, shared ctx. Each genre lives in games/<id>.js (lazy loaded) and exports
// mount(container, ctx), reset() and destroy(). All saves are per genre in localStorage (try/catch).
const GENRES = [
  { id: "pet", label: "Virtual pet", name: "Virtual pet", form: "egg", how: "Feed, play, tuck in and wash your pocket Kamiji. Keep every marker up and it grows." },
  { id: "map", label: "Creature catching", name: "Creature catching", form: "phone", how: "Walk the map, tap a creature nearby, then throw when the ring is in the green." },
  { id: "lang", label: "Language streak", name: "Language streak", form: "phone", how: "Finish a short lesson: answer 3 questions without losing your hearts." },
  { id: "rpg", label: "Adventure RPG", name: "Adventure RPG", form: "wide", how: "Walk with arrow keys or the pad. Talk to the elder, find the lantern, win the battle." },
  { id: "village", label: "Village builder", name: "Village builder", form: "wide", how: "Place buildings, wait for timers, collect resources, upgrade and defend against raids." },
  { id: "sim", label: "Life sim", name: "Life sim", form: "wide", how: "Use furniture to keep Kamiji's needs up through the day. Decorate with the colour mode." },
  { id: "garden", label: "Cozy garden", name: "Cozy garden", form: "wide", how: "Pick a tool, tap a plot: plant, water, then harvest and sell. Energy refills each day." },
  { id: "idle", label: "Idle clicker", name: "Idle clicker", form: "phone", how: "Tap or hold Kamiji to earn sparkles, buy helpers, then nap to prestige for a multiplier." },
];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls = "", html = "") => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const BASE = new URL("./", import.meta.url);

let root, win, stageEl, screenEl, nameEl, chipsEl, hintEl, liveEl, switchEl, soundBtn, fsBtn;
let cur = null, mod = null, token = 0, visible = false, modal = false;
const loops = new Set(), avatars = new Set(), chips = new Map(), cssLoaded = new Set(), modules = new Map();
let raf = 0, lastT = 0;

// ---- shared helpers -----------------------------------------------------------------------------------------
const sound = {
  on: false, ac: null,
  beep(f = 440, d = .09, type = "sine", vol = .05) {
    if (!sound.on) return;
    try {
      sound.ac = sound.ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = sound.ac.createOscillator(), g = sound.ac.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(.0001, sound.ac.currentTime + d);
      o.connect(g).connect(sound.ac.destination); o.start(); o.stop(sound.ac.currentTime + d);
    } catch (e) { /* audio unavailable */ }
  },
};

function store(id) {
  const key = `kamiji.games.${id}.v1`;
  return {
    get(def) { try { const o = JSON.parse(localStorage.getItem(key) || "null"); return o && typeof o === "object" ? { ...def, ...o } : def; } catch (e) { return def; } },
    set(o) { try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) { /* storage unavailable */ } },
    clear() { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
  };
}

let avatarMod = null;
function avatarSupported() {
  avatarMod = avatarMod || import("../packages/kamiji-avatar/kamiji-avatar.js").then(() => { const K = customElements.get("kamiji-avatar"); return !!(K && K.supported()); }).catch(() => false);
  return avatarMod;
}
// Kamiji avatar helper: a wrapper with a CSS blob fallback, replaced by <kamiji-avatar> once WebGL is ready.
function avatar(o = {}) {
  const w = h("span", `tg-av ${o.cls || ""}`);
  w.innerHTML = `<span class="tg-blob" aria-hidden="true"><i></i><i></i><b></b></span><kamiji-avatar size="100%" shape="${o.shape || "sphere"}" expression="${o.expression || "happy"}" clip="${o.clip || "Idle"}" color="${o.color || "#ffd23f"}" src="${new URL("../assets/", import.meta.url).href}"></kamiji-avatar>`;
  const el = w.querySelector("kamiji-avatar");
  w.style.setProperty("--c", o.color || "#ffd23f");
  avatars.add(el);
  avatarSupported().then((ok) => {
    if (!ok || !el.isConnected && !w.isConnected) return;
    el.addEventListener("kamiji-ready", () => w.classList.add("ready"));
    el.addEventListener("kamiji-error", () => w.classList.remove("ready"));
  });
  w.set = (attrs) => { for (const k in attrs) { if (attrs[k] === "" || attrs[k] == null) el.removeAttribute(k); else el.setAttribute(k, attrs[k]); } if (attrs.color) w.style.setProperty("--c", attrs.color); };
  return w;
}

function say(t) { if (!liveEl) return; liveEl.textContent = ""; setTimeout(() => { liveEl.textContent = t; }, 30); }
function chip(id, text) {
  let c = chips.get(id);
  if (!c) { c = h("span", "tg-chip"); c.dataset.chip = id; chipsEl.appendChild(c); chips.set(id, c); }
  if (c.textContent !== text) c.textContent = text;
}
function css(name) {
  if (cssLoaded.has(name)) return;
  cssLoaded.add(name);
  const l = h("link"); l.rel = "stylesheet"; l.href = new URL(`games/${name}`, BASE).href; document.head.appendChild(l);
}
function burst(parent, text, x = 50, y = 50, cls = "") {
  if (REDUCED || !parent) return;
  const p = h("span", `tg-pop ${cls}`, text);
  p.style.left = `${x}%`; p.style.top = `${y}%`; p.setAttribute("aria-hidden", "true");
  parent.appendChild(p); setTimeout(() => p.remove(), 1100);
}
function toast(text, host) {
  const t = h("div", "tg-toast", text); t.setAttribute("aria-hidden", "true");
  (host || screenEl).appendChild(t); setTimeout(() => t.remove(), 1800); say(text);
}
const isActive = () => visible && !document.hidden;

// 30 fps shared loop: handlers get dt in seconds; runs only while the window is on screen.
function loop(fn) { loops.add(fn); kick(); return () => loops.delete(fn); }
function kick() { if (!raf && loops.size && isActive()) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(t) {
  raf = 0;
  if (!isActive() || !loops.size) return;
  if (t - lastT >= 33) { const dt = Math.min((t - lastT) / 1000, .1); lastT = t; for (const f of [...loops]) { try { f(dt); } catch (e) { console.error(e); } } }
  raf = requestAnimationFrame(frame);
}

const ctx = { REDUCED, reduced: REDUCED, h, $, say, chip, css, sound, store, avatar, burst, toast, loop, isActive, hint: (t) => { if (hintEl) hintEl.textContent = t; },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)), rnd: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)], el: null };

// ---- shell UI ---------------------------------------------------------------------------------------------
const icon = {
  full: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2zM11.500 5.500a3.500 3.500 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function build(mount) {
  mount.innerHTML = `<div class="tg" data-form="egg">
<div class="tg-window" id="tg-window">
 <div class="tg-top">
  <div class="tg-bar1"><h3 class="tg-name" data-name></h3>
   <div class="tg-tools">
    <button type="button" class="tg-tool" data-sound aria-pressed="false" title="Sound is off. Turn on simple beeps.">${icon.sound}<span>Sound off</span></button>
    <button type="button" class="tg-tool" data-reset title="Start this game over">${icon.reset}<span>Reset</span></button>
    <button type="button" class="tg-tool" data-full aria-pressed="false" title="Fullscreen">${icon.full}<span>Fullscreen</span></button>
   </div></div>
  <div class="tg-chips" data-chips role="group" aria-label="Game stats"></div>
 </div>
 <div class="tg-stage" id="tg-panel" role="group" aria-label="Game" data-stage></div>
 <div class="tg-bottom"><p class="tg-hint" data-hint></p></div>
</div>
<div class="tg-styles-row"><span class="tg-sr" id="tg-style-l">Game style</span>
 <div class="tg-styles" role="radiogroup" aria-labelledby="tg-style-l">${GENRES.map((g, i) => `<button type="button" class="tg-style" role="radio" data-style="${g.id}" aria-controls="tg-panel" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${g.label}</button>`).join("")}</div></div>
<p class="tg-note">Prototype: mini versions of familiar genres, each a tiny original game starring Kamiji. Everything runs in your browser and saves only there, per style.</p>
<p class="tg-sr" role="status" aria-live="polite" data-live></p>
</div>`;
  root = $(".tg", mount); win = $(".tg-window", root); stageEl = $("[data-stage]", root); nameEl = $("[data-name]", root); chipsEl = $("[data-chips]", root);
  hintEl = $("[data-hint]", root); liveEl = $("[data-live]", root); switchEl = $(".tg-styles", root); soundBtn = $("[data-sound]", root); fsBtn = $("[data-full]", root);
}

function frameFor(form) {
  stageEl.textContent = ""; stageEl.className = `tg-stage tg-s-${form}`;
  if (form === "egg") { screenEl = h("div", "tg-egg"); stageEl.appendChild(screenEl); return; }
  if (form === "phone") {
    const p = h("div", "tg-phone"); p.innerHTML = '<i class="tg-notch" aria-hidden="true"></i><div class="tg-screen"></div><i class="tg-homebar" aria-hidden="true"></i>';
    stageEl.appendChild(p); screenEl = $(".tg-screen", p); return;
  }
  const w = h("div", "tg-wide"); w.innerHTML = '<div class="tg-titlebar" aria-hidden="true"><i></i><i></i><i></i></div><div class="tg-screen"></div>';
  stageEl.appendChild(w); screenEl = $(".tg-screen", w);
}

async function select(id, focus) {
  const g = GENRES.find((x) => x.id === id) || GENRES[0];
  const my = ++token;
  if (mod) { try { mod.destroy(); } catch (e) { console.error(e); } mod = null; }
  loops.clear(); avatars.forEach((a) => { try { a.dispose?.(); } catch (e) { /* ignore */ } }); avatars.clear();
  chips.clear(); chipsEl.textContent = ""; cur = g;
  win.parentElement.dataset.form = g.form; win.parentElement.dataset.game = g.id;
  nameEl.textContent = g.name; ctx.hint(g.how);
  switchEl.querySelectorAll("[data-style]").forEach((b) => { const on = b.dataset.style === g.id; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  frameFor(g.form); ctx.el = screenEl;
  screenEl.innerHTML = '<p class="tg-loading">Loading</p>';
  try { const u = new URL(location.href); u.searchParams.set("game", g.id); history.replaceState(null, "", u); } catch (e) { /* ignore */ }
  let m = modules.get(g.id);
  try { if (!m) { m = await import(`./games/${g.id}.js`); modules.set(g.id, m); } } catch (e) { console.error(e); if (my === token) screenEl.innerHTML = '<p class="tg-loading">This style could not load.</p>'; return; }
  if (my !== token) return;
  screenEl.textContent = "";
  mod = m; ctx.id = g.id; ctx.store = () => store(g.id);
  m.mount(g.form === "egg" ? screenEl : screenEl, ctx);
  say(`${g.name}. ${g.how}`);
  kick();
}

function setModal(on) {
  modal = on; win.classList.toggle("tg-modal", on); document.documentElement.classList.toggle("tg-lock", on);
  fsBtn.setAttribute("aria-pressed", String(on)); fsBtn.querySelector("span").textContent = on ? "Exit full" : "Fullscreen";
  if (on) fsBtn.focus();
}
async function toggleFull() {
  const fs = document.fullscreenElement === win;
  if (fs) { await document.exitFullscreen().catch(() => {}); return; }
  if (modal) { setModal(false); return; }
  if (win.requestFullscreen) { try { await win.requestFullscreen(); return; } catch (e) { /* fall back to modal */ } }
  setModal(true);
}

function init() {
  const sec = document.getElementById("tama");
  const mount = sec && sec.querySelector("[data-tama]");
  if (!mount) return;
  build(mount);
  const q = new URLSearchParams(location.search).get("game");
  const start = GENRES.some((g) => g.id === q) ? q : "pet";

  switchEl.addEventListener("click", (e) => { const b = e.target.closest("[data-style]"); if (b && b.dataset.style !== cur?.id) select(b.dataset.style); });
  switchEl.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key === "Home" || e.key === "End" || keys[e.key]) {
      e.preventDefault();
      const i = GENRES.findIndex((g) => g.id === cur.id);
      const n = e.key === "Home" ? 0 : e.key === "End" ? GENRES.length - 1 : (i + keys[e.key] + GENRES.length) % GENRES.length;
      select(GENRES[n].id, true);
    }
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-reset]")) { mod?.reset?.(); say(`${cur.name} was reset`); }
    else if (e.target.closest("[data-full]")) toggleFull();
    else if (e.target.closest("[data-sound]")) {
      sound.on = !sound.on; soundBtn.setAttribute("aria-pressed", String(sound.on)); soundBtn.querySelector("span").textContent = sound.on ? "Sound on" : "Sound off";
      soundBtn.title = sound.on ? "Sound is on. Turn off." : "Sound is off. Turn on simple beeps."; if (sound.on) sound.beep(660, .12);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal) setModal(false); });
  document.addEventListener("fullscreenchange", () => { const on = document.fullscreenElement === win; fsBtn.setAttribute("aria-pressed", String(on)); fsBtn.querySelector("span").textContent = on ? "Exit full" : "Fullscreen"; });
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); }, { threshold: 0.05 }).observe(win);
  addEventListener("pagehide", () => { try { mod?.destroy?.(); } catch (e) { /* ignore */ } mod = null; });
  ctx.css("shared.css");
  select(start);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
