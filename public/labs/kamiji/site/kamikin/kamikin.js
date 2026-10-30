// Kamikin front page. One shared WebGL renderer draws the hero and every carousel
// card and copies the result into each canvas's 2D context (same pattern as ../main.js),
// so 15 live models fit well under the browser's WebGL context limit.
import { enableSpin, applyOrbit } from "../spin.js";
import "../workshop/menu.js";

const MOCHI_DIR = "../../assets/mochi/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

const FACES = ["neutral", "blink", "happy", "joy", "surprised", "sad"];
const CLIPS = ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"];
const DEFAULT_ID = "kamikin-player";
// Order of the cast: the player and the species the player can pick, then Pip and the six kamikin.
const IDS = [
  "kamikin-player", "kamikin-pip", "kamikin-shizuku", "kamikin-hana", "kamikin-koke", "kamikin-kumo", "kamikin-chochin", "kamikin-kon",
  "kamikin-player-bunny-3", "kamikin-player-cat-5", "kamikin-player-chick-6", "kamikin-player-hamster-4", "kamikin-player-panda-2", "kamikin-player-pup-8",
];
// Roles as the game documents define them (docs/kamikin-context.md). Anything not documented gets no role line.
const ROLES = {
  "kamikin-player": { tag: "Player", text: "The player in Season 1 of the design (Ren)." },
  "kamikin-pip": { tag: "Guide", text: "Guide and companion. Walks with you from the start and teaches each new word first." },
  "kamikin-shizuku": { tag: "Kamikin 1", text: "Buds off a dewdrop when the pond wakes." },
  "kamikin-hana": { tag: "Kamikin 2", text: "Buds off a flower bud when the flower bank wakes." },
  "kamikin-koke": { tag: "Kamikin 3", text: "Buds off a mossy stone when the stones wake." },
  "kamikin-kumo": { tag: "Kamikin 4", text: "Buds off a cloud wisp when the cloud hill wakes." },
  "kamikin-chochin": { tag: "Kamikin 5", text: "The lantern kamikin, from lantern lane." },
  "kamikin-kon": { tag: "Secret friend", text: "Appears only after the other five have each been cared for." },
};
const PLAYER_ROLE = { tag: "Player choice", text: "One of the six species a player can pick." };
const roleOf = (id) => ROLES[id] || (id.startsWith("kamikin-player-") ? PLAYER_ROLE : null);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---- workshop menu: Kamikin studio first, plus a way back to the Kamiji hero page -------------------
(function tuneMenu() {
  const ul = document.querySelector(".ws-menu ul");
  if (!ul) return;
  const first = [...ul.children].find((li) => li.querySelector("a")?.getAttribute("href")?.endsWith("kamikin.html"));
  if (first) ul.prepend(first);
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "ws-item";
  a.href = "../index.html";
  const img = document.createElement("img");
  img.src = "../workshop/img/hand.png"; img.alt = ""; img.width = 56; img.height = 56; img.loading = "lazy";
  const text = document.createElement("span");
  text.className = "ws-txt";
  const b = document.createElement("b"); b.textContent = "Kamiji hero";
  const d = document.createElement("span"); d.textContent = "Back to the Kamiji 3D hand landing page.";
  text.append(b, d);
  a.append(img, text);
  li.append(a);
  ul.append(li);
})();

// ---- selector rail: one dropdown per control (same .rail classes as the Kamiji hero) ----------------
let openMenu = null;
function closeMenu(focusBtn) {
  if (!openMenu) return;
  openMenu.menu.hidden = true;
  openMenu.btn.setAttribute("aria-expanded", "false");
  if (focusBtn) openMenu.btn.focus();
  openMenu = null;
}
document.addEventListener("pointerdown", (e) => { if (openMenu && !openMenu.btn.parentElement.contains(e.target)) closeMenu(false); });

function dropdown(label, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "rail-dd";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "rail-btn";
  btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
  const lbl = document.createElement("span"); lbl.className = "rail-lbl"; lbl.textContent = label;
  const val = document.createElement("span"); val.className = "rail-val";
  const text = document.createElement("span"); text.className = "rail-text";
  const chev = document.createElement("span"); chev.className = "rail-chev"; chev.setAttribute("aria-hidden", "true");
  val.append(text); btn.append(lbl, val, chev);
  const menu = document.createElement("ul");
  menu.className = "rail-menu"; menu.setAttribute("role", "listbox"); menu.setAttribute("aria-label", label); menu.hidden = true;
  wrap.append(btn, menu);

  let items = [], value = null;
  function render() {
    text.textContent = items.find((i) => i.value === value)?.label ?? "None";
    menu.replaceChildren();
    items.forEach((it) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option"); li.tabIndex = -1;
      li.setAttribute("aria-selected", String(it.value === value));
      li.append(document.createTextNode(it.label));
      if (it.hint) { const s = document.createElement("small"); s.textContent = it.hint; li.append(s); }
      li.addEventListener("click", () => { api.set(it.value); onPick(it.value); closeMenu(true); });
      menu.append(li);
    });
  }
  function open() {
    closeMenu(false); render();
    menu.hidden = false; btn.setAttribute("aria-expanded", "true"); openMenu = { btn, menu };
    (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild)?.focus();
  }
  btn.addEventListener("click", () => (menu.hidden ? open() : closeMenu(true)));
  btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
  menu.addEventListener("keydown", (e) => {
    const opts = [...menu.children], i = opts.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); opts[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); opts[opts.length - 1]?.focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.activeElement?.click(); }
    else if (e.key === "Escape" || e.key === "Tab") closeMenu(e.key === "Escape");
  });
  const api = {
    el: wrap,
    setItems(list, v) { items = list; value = v; render(); },
    set(v) { value = v; render(); },
  };
  return api;
}

// ---- main ------------------------------------------------------------------------------------------
async function boot() {
  const heroEl = $("hero-model");
  const track = $("k-track");
  const state = { id: DEFAULT_ID, face: "neutral", clip: "idle" };
  let railCharacter = null, railFace = null, railClip = null;

  // Character data first: the page text works without WebGL.
  let index = [];
  try {
    const r = await fetch(`${MOCHI_DIR}index.json`);
    index = (await r.json()).characters || [];
  } catch (err) { console.warn("Kamikin page: mochi index missing", err); }
  const meta = (id) => index.find((c) => c.id === id) || { id, name: id.replace("kamikin-", ""), species: "", persona: "" };
  const ids = IDS.filter((id) => index.some((c) => c.id === id));
  if (!ids.length) { heroFallback(heroEl, "Character data could not be loaded."); return; }
  const label = (id) => { const m = meta(id); return `${cap(m.name)}, ${m.species || "mochi"}`; };

  let THREE, GLTFLoader, SkeletonUtils, renderer;
  const tiles = new Map(); // id -> button
  function buildCards(viewerFor) {
    ids.forEach((id) => {
      const m = meta(id), role = roleOf(id);
      const li = document.createElement("li"); li.className = "k-item";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "k-card"; btn.dataset.id = id;
      btn.setAttribute("aria-pressed", String(id === state.id));
      btn.setAttribute("aria-label", `${cap(m.name)}, ${m.species}: show in the hero`);
      const v = document.createElement("div"); v.className = "viewer"; v.setAttribute("aria-hidden", "true");
      v.append(document.createElement("canvas"));
      const fb = document.createElement("p"); fb.className = "fallback"; fb.hidden = true; v.append(fb);
      const name = document.createElement("span"); name.className = "k-name";
      name.append(document.createTextNode(cap(m.name)));
      if (role) { const t = document.createElement("i"); t.textContent = role.tag; name.append(t); }
      const meta2 = document.createElement("span"); meta2.className = "k-meta"; meta2.textContent = `${m.species || "mochi"} · ${m.height ?? "?"} m`;
      const persona = document.createElement("p"); persona.className = "k-persona"; persona.textContent = m.persona;
      btn.append(v, name, meta2, persona);
      if (role) { const r = document.createElement("p"); r.className = "k-role"; r.textContent = role.text; btn.append(r); }
      li.append(btn); track.append(li);
      tiles.set(id, btn);
      btn.addEventListener("click", () => { if (renderer) pick(id, true); });
      viewerFor?.(v, id);
    });
  }

  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("Kamikin page: 3D unavailable", err);
    heroFallback(heroEl, "3D preview unavailable in this browser. The files are in the repository.");
    buildCards(null);
    track.querySelectorAll(".viewer").forEach((v) => { v.hidden = true; });
    wireTrack();
    $("hero-rail").hidden = true;
    return;
  }

  const loader = new GLTFLoader();
  const viewers = new Set();
  const dpr = Math.min(devicePixelRatio || 1, 2);

  function makeViewer(el, opts = {}) {
    const canvas = el.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
    const key = new THREE.DirectionalLight(0xffefd2, 1.8);
    key.position.set(-1.5, 2, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const v = { el, canvas, ctx, scene, camera, mixer: null, near: false, gate: opts.gate || null, dirty: true, loadStarted: false, load: null, tick: null };
    const io = new IntersectionObserver((entries) => { v.near = entries[entries.length - 1].isIntersecting; v.dirty = true; }, { root: opts.root || null, rootMargin: opts.margin || "200px" });
    io.observe(el);
    viewers.add(v);
    return v;
  }
  function fit(v, root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const extent = Math.max(size.y, size.x) * 1.25;
    const dist = (extent / 2) / Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2));
    v.camera.position.set(center.x, center.y, center.z + dist);
    v.camera.lookAt(center.x, center.y, center.z);
    v.orbit = { cx: center.x, cy: center.y, cz: center.z, dist, lift: 0 };
  }
  function draw(v) {
    const w = Math.max(1, Math.round(v.el.clientWidth * dpr)), h = Math.max(1, Math.round(v.el.clientHeight * dpr));
    if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
    v.camera.aspect = w / h; v.camera.updateProjectionMatrix();
    applyOrbit(v);
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.render(v.scene, v.camera);
    v.ctx.clearRect(0, 0, w, h); v.ctx.drawImage(renderer.domElement, 0, 0, w, h);
  }
  let last = performance.now(), acc = 0;
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now; acc += dt;
    if (acc >= 1 / 30) {
      const step = acc; acc = 0;
      for (const v of viewers) {
        if (!v.near || (v.gate && !v.gate())) continue;
        if (!v.loadStarted && v.load) {
          v.loadStarted = true;
          v.load().catch((err) => { console.warn("Kamikin page: load failed", err); heroFallback(v.el, "Could not load this model.", true); });
          continue;
        }
        if (!v.tick) continue;
        const moving = v.tick(reduceMotion ? 0 : step);
        if (moving || v.dirty) { draw(v); v.dirty = false; }
      }
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => viewers.forEach((v) => (v.dirty = true)));

  // A mochi in a viewer: skinned GLB (cached), six face textures, nine clips, a blink now and then.
  const cache = new Map();
  const loadMochi = (id) => { if (!cache.has(id)) cache.set(id, loader.loadAsync(`${MOCHI_DIR}${id}.glb`)); return cache.get(id); };
  function mochiContent(v, id, init = {}) {
    const c = { disposed: false, face: init.face || "neutral" };
    let faceMat = null, texIdx = {}, gltf = null, root = null, action = null, t = 0, blinkAt = 1.5 + Math.random() * 3, blinkUntil = 0;
    const textures = new Map();
    const applyTex = async (state) => {
      if (!faceMat || texIdx[state] == null) return;
      if (!textures.has(state)) {
        const tex = await gltf.parser.getDependency("texture", texIdx[state]);
        tex.colorSpace = THREE.SRGBColorSpace; textures.set(state, tex);
      }
      if (c.disposed) return;
      faceMat.map = textures.get(state); faceMat.needsUpdate = true; v.dirty = true;
    };
    c.setFace = (s) => { c.face = s; applyTex(s); };
    c.setClip = (n) => {
      if (!gltf || !v.mixer) return;
      const clip = gltf.animations.find((x) => x.name === n); if (!clip) return;
      const next = v.mixer.clipAction(clip);
      if (action && action !== next) action.fadeOut(0.2);
      next.reset().fadeIn(0.2).play(); action = next; v.dirty = true;
    };
    c.attach = async () => {
      gltf = await loadMochi(id);
      if (c.disposed) return;
      root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => { if (n.isMesh && n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; } });
      texIdx = gltf.parser.json.materials.find((x) => x.name === "face")?.extras?.faceStates || {};
      v.scene.add(root);
      v.mixer = new THREE.AnimationMixer(root);
      c.setClip(gltf.animations.some((x) => x.name === (init.clip || "idle")) ? init.clip || "idle" : gltf.animations[0]?.name);
      v.mixer.update(reduceMotion ? 0.5 : 0);
      fit(v, root);
      if (c.face !== "neutral") applyTex(c.face);
      v.tick = (dt) => {
        t += dt;
        if (!reduceMotion && c.face === "neutral") {
          if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2 + Math.random() * 3; applyTex("blink"); }
          else if (blinkUntil && t > blinkUntil) { blinkUntil = 0; applyTex("neutral"); }
        }
        if (dt > 0) v.mixer.update(dt);
        return dt > 0;
      };
      v.dirty = true;
    };
    c.dispose = () => {
      c.disposed = true;
      if (root) v.scene.remove(root);
      v.mixer?.stopAllAction(); if (root) v.mixer?.uncacheRoot(root);
      faceMat?.dispose(); v.mixer = null; v.tick = null;
    };
    return c;
  }

  // ---- hero ----
  const hero = makeViewer(heroEl, { margin: "0px" });
  enableSpin(hero);
  let heroContent = null;
  const caption = $("hero-cap");
  function showHero() {
    heroContent?.dispose();
    const c = mochiContent(hero, state.id, { face: state.face, clip: state.clip });
    heroContent = c;
    hero.loadStarted = false; hero.load = () => c.attach(); hero.tick = null; hero.dirty = true;
    hero.ctx.clearRect(0, 0, hero.canvas.width, hero.canvas.height);
    heroEl.querySelector(".fallback").hidden = true; hero.canvas.removeAttribute("hidden");
    const m = meta(state.id);
    heroEl.setAttribute("aria-label", `Live 3D ${label(state.id)}, a Kamikin character`);
    caption.textContent = `${cap(m.name)} · ${m.species || "mochi"} · Kamikin`;
  }

  // ---- carousel cards: lazy, only while the section is on screen and the card is near the track ----
  let meetOn = false;
  new IntersectionObserver((e) => { meetOn = e[e.length - 1].isIntersecting; viewers.forEach((x) => (x.dirty = true)); }, { rootMargin: "200px" }).observe($("meet"));
  buildCards((vEl, id) => {
    const v = makeViewer(vEl, { root: track, margin: "120px", gate: () => meetOn });
    const c = mochiContent(v, id);
    v.load = () => c.attach();
  });
  wireTrack();

  // ---- hero roster: every character in one row at the bottom of the screen, no backgrounds ----
  const rosterTiles = new Map();
  (function buildRoster() {
    const ul = $("hero-roster"); if (!ul) return;
    ids.forEach((id) => {
      const m = meta(id);
      const li = document.createElement("li"); li.className = "hr-item";
      const btn = document.createElement("button"); btn.type = "button"; btn.dataset.id = id;
      btn.setAttribute("aria-pressed", String(id === state.id));
      btn.setAttribute("aria-label", `${cap(m.name)}, ${m.species || "mochi"}: show in the hero`);
      const vEl = document.createElement("div"); vEl.className = "viewer"; vEl.setAttribute("aria-hidden", "true");
      vEl.append(document.createElement("canvas"));
      const fb = document.createElement("p"); fb.className = "fallback"; fb.hidden = true; vEl.append(fb);
      const name = document.createElement("span"); name.className = "hr-name"; name.textContent = cap(m.name);
      const sp = document.createElement("span"); sp.className = "hr-sp"; sp.textContent = m.species || "mochi";
      btn.append(vEl, name, sp); li.append(btn); ul.append(li);
      rosterTiles.set(id, btn);
      btn.addEventListener("click", () => pick(id, true));
      const v = makeViewer(vEl, { margin: "120px" });
      const c = mochiContent(v, id);
      v.load = () => c.attach();
    });
  })();

  // ---- selection ----
  function pick(id, user) {
    state.id = id; state.face = "neutral"; state.clip = "idle";
    tiles.forEach((b, k) => b.setAttribute("aria-pressed", String(k === id)));
    rosterTiles.forEach((b, k) => b.setAttribute("aria-pressed", String(k === id)));
    const strip = $("hero-roster"), cur = rosterTiles.get(id)?.parentElement;
    if (strip && cur) strip.scrollTo({ left: cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
    railCharacter?.set(id); railFace?.set("neutral"); railClip?.set("idle");
    showHero();
    window.dispatchEvent(new CustomEvent("kamikin:character", { detail: { id } }));
    history.replaceState(null, "", `#character=${encodeURIComponent(id)}`);
    const st = $("meet-status");
    st.textContent = "";
    if (user) {
      st.append(document.createTextNode(`${cap(meta(id).name)} is now in the hero. `));
      const a = document.createElement("a"); a.href = "#top"; a.textContent = "See it at the top";
      st.append(a);
    }
  }
  function buildRail() {
    const rail = document.createElement("div");
    rail.className = "rail"; rail.setAttribute("role", "group"); rail.setAttribute("aria-label", "Model controls");
    railCharacter = dropdown("Character", (id) => pick(id, false));
    railFace = dropdown("Face", (f) => { state.face = f; heroContent?.setFace(f); });
    railClip = dropdown("Clip", (n) => { state.clip = n; heroContent?.setClip(n); });
    railCharacter.setItems(ids.map((id) => ({ value: id, label: cap(meta(id).name), hint: meta(id).species })), state.id);
    railFace.setItems(FACES.map((f) => ({ value: f, label: f })), state.face);
    railClip.setItems(CLIPS.map((n) => ({ value: n, label: n })), state.clip);
    rail.append(railCharacter.el, railFace.el, railClip.el);
    $("hero-rail").replaceChildren(rail);
    alignRail();
  }
  // Centre the control pill under the model (the stage right-aligns both, but the pill is wider than the model).
  function alignRail() {
    const r = $("hero-rail"), model = $("hero-model"); if (!r || !model) return;
    r.style.transform = "";
    const m = model.getBoundingClientRect(), b = r.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, pad = 12;
    let dx = (m.left + m.width / 2) - (b.left + b.width / 2);
    if (b.width + 2 * pad >= vw) dx = (vw - b.width) / 2 - b.left;
    else dx = Math.min(Math.max(dx, pad - b.left), vw - pad - b.right);
    r.style.transform = Math.abs(dx) < 0.5 ? "" : `translateX(${dx.toFixed(1)}px)`;
  }
  addEventListener("resize", alignRail);
  if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(alignRail); ro.observe($("hero-rail")); ro.observe($("hero-model")); }

  // hash: #character=<id>
  const m = /^#character=(.+)$/.exec(location.hash);
  if (m) { try { const id = decodeURIComponent(m[1]); if (ids.includes(id)) state.id = id; } catch { /* keep default */ } }
  tiles.forEach((b, k) => b.setAttribute("aria-pressed", String(k === state.id)));
  rosterTiles.forEach((b, k) => b.setAttribute("aria-pressed", String(k === state.id)));
  buildRail();
  showHero();
  addEventListener("hashchange", () => {
    const h = /^#character=(.+)$/.exec(location.hash);
    if (!h) return;
    try { const id = decodeURIComponent(h[1]); if (ids.includes(id) && id !== state.id) pick(id, false); } catch { /* ignore */ }
  });
  // Bridge for chat.js: the current hero character and a way to set the hero mochi's face.
  window.kamikinHero = { get id() { return state.id; }, setFace(f) { state.face = f; heroContent?.setFace(f); } };
  window.dispatchEvent(new CustomEvent("kamikin:character", { detail: { id: state.id } }));
  requestAnimationFrame(frame);
}

function wireTrack() {
  const track = $("k-track"), prev = $("car-prev"), next = $("car-next");
  const step = () => Math.max(220, track.clientWidth * 0.8);
  const upd = () => {
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduceMotion ? "auto" : "smooth" }));
  next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduceMotion ? "auto" : "smooth" }));
  track.addEventListener("scroll", upd, { passive: true });
  addEventListener("resize", upd);
  upd();
}

function heroFallback(viewerEl, message) {
  const p = viewerEl.querySelector(".fallback");
  if (p) { p.textContent = message; p.hidden = false; }
  viewerEl.querySelector("canvas")?.setAttribute("hidden", "");
}

boot().catch((err) => console.error("Kamikin page error", err));
