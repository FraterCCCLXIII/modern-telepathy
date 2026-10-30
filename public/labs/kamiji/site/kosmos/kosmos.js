// Kosmos page. One shared three.js WebGL renderer draws the hero Kamikin into a 2D canvas (same pattern as
// ../kamikin/kamikin.js). This is three.js running in the page, NOT the Kosmos (wgpu) renderer.
import { enableSpin, applyOrbit } from "../spin.js";
const MOCHI_DIR = "../../assets/mochi/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const FACES = ["neutral", "blink", "happy", "joy", "surprised", "sad"];
const CLIPS = ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"];
const IDS = ["kamikin-player", "kamikin-pip", "kamikin-shizuku", "kamikin-hana", "kamikin-koke", "kamikin-kumo", "kamikin-chochin", "kamikin-kon"];
const DEFAULT_ID = "kamikin-hana";

// ---- selector rail: one dropdown per control (same .rail classes as the other pages) -----------------
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

function heroFallback(viewerEl, message) {
  const p = viewerEl.querySelector(".fallback");
  if (p) { p.textContent = message; p.hidden = false; }
  viewerEl.querySelector("canvas")?.setAttribute("hidden", "");
}

// ---- main ------------------------------------------------------------------------------------------
async function boot() {
  const heroEl = $("hero-model");
  const caption = $("hero-cap");
  const state = { id: DEFAULT_ID, face: "neutral", clip: "idle" };

  // Character data first: the page text works without WebGL.
  let index = [];
  try {
    const r = await fetch(`${MOCHI_DIR}index.json`);
    index = (await r.json()).characters || [];
  } catch (err) { console.warn("Kosmos page: mochi index missing", err); }
  const meta = (id) => index.find((c) => c.id === id) || { id, name: id.replace("kamikin-", ""), species: "" };
  const ids = IDS.filter((id) => index.some((c) => c.id === id));
  if (!ids.length) { heroFallback(heroEl, "Character data could not be loaded."); $("hero-rail").hidden = true; return; }
  if (!ids.includes(state.id)) state.id = ids[0];

  let THREE, GLTFLoader, SkeletonUtils, renderer;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("Kosmos page: 3D unavailable", err);
    heroFallback(heroEl, "3D preview unavailable in this browser. The page text below still applies.");
    $("hero-rail").hidden = true;
    return;
  }

  const loader = new GLTFLoader();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const canvas = heroEl.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
  const key = new THREE.DirectionalLight(0xffefd2, 1.8);
  key.position.set(-1.5, 2, 4); scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  const view = { near: false, dirty: true, mixer: null, tick: null, loadStarted: false, load: null };
  new IntersectionObserver((e) => { view.near = e[e.length - 1].isIntersecting; view.dirty = true; }, { rootMargin: "100px" }).observe(heroEl);
  addEventListener("resize", () => { view.dirty = true; });
  view.el = heroEl; view.camera = camera;
  enableSpin(view);

  function fit(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const extent = Math.max(size.y, size.x) * 1.25;
    const dist = (extent / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(center.x, center.y, center.z + dist);
    camera.lookAt(center.x, center.y, center.z);
    view.orbit = { cx: center.x, cy: center.y, cz: center.z, dist, lift: 0 };
  }
  function draw() {
    const w = Math.max(1, Math.round(heroEl.clientWidth * dpr)), h = Math.max(1, Math.round(heroEl.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    applyOrbit(view);
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.render(scene, camera);
    ctx.clearRect(0, 0, w, h); ctx.drawImage(renderer.domElement, 0, 0, w, h);
  }
  let last = performance.now(), acc = 0;
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now; acc += dt;
    if (acc >= 1 / 30 && view.near && !document.hidden) {
      const step = acc; acc = 0;
      if (!view.loadStarted && view.load) {
        view.loadStarted = true;
        view.load().catch((err) => { console.warn("Kosmos page: load failed", err); heroFallback(heroEl, "Could not load this model."); });
      } else if (view.tick) {
        const moving = view.tick(reduceMotion ? 0 : step);
        if (moving || view.dirty) { draw(); view.dirty = false; }
      }
    }
    requestAnimationFrame(frame);
  }

  // A mochi: skinned GLB (cached), six face textures, nine clips, a blink now and then.
  const cache = new Map();
  const loadMochi = (id) => { if (!cache.has(id)) cache.set(id, loader.loadAsync(`${MOCHI_DIR}${id}.glb`)); return cache.get(id); };
  function mochiContent(id, init) {
    const c = { disposed: false, face: init.face };
    let faceMat = null, texIdx = {}, gltf = null, root = null, action = null, t = 0, blinkAt = 1.5 + Math.random() * 3, blinkUntil = 0;
    const textures = new Map();
    const applyTex = async (s) => {
      if (!faceMat || texIdx[s] == null) return;
      if (!textures.has(s)) {
        const tex = await gltf.parser.getDependency("texture", texIdx[s]);
        tex.colorSpace = THREE.SRGBColorSpace; textures.set(s, tex);
      }
      if (c.disposed) return;
      faceMat.map = textures.get(s); faceMat.needsUpdate = true; view.dirty = true;
    };
    c.setFace = (s) => { c.face = s; applyTex(s); };
    c.setClip = (n) => {
      if (!gltf || !view.mixer) return;
      const clip = gltf.animations.find((x) => x.name === n); if (!clip) return;
      const next = view.mixer.clipAction(clip);
      if (action && action !== next) action.fadeOut(0.2);
      next.reset().fadeIn(0.2).play(); action = next; view.dirty = true;
    };
    c.attach = async () => {
      gltf = await loadMochi(id);
      if (c.disposed) return;
      root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => { if (n.isMesh && n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; } });
      texIdx = gltf.parser.json.materials.find((x) => x.name === "face")?.extras?.faceStates || {};
      scene.add(root);
      view.mixer = new THREE.AnimationMixer(root);
      c.setClip(gltf.animations.some((x) => x.name === init.clip) ? init.clip : gltf.animations[0]?.name);
      view.mixer.update(reduceMotion ? 0.5 : 0);
      fit(root);
      if (c.face !== "neutral") applyTex(c.face);
      view.tick = (dt) => {
        t += dt;
        if (!reduceMotion && c.face === "neutral") {
          if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2 + Math.random() * 3; applyTex("blink"); }
          else if (blinkUntil && t > blinkUntil) { blinkUntil = 0; applyTex("neutral"); }
        }
        if (dt > 0) view.mixer.update(dt);
        return dt > 0;
      };
      view.dirty = true;
    };
    c.dispose = () => {
      c.disposed = true;
      if (root) scene.remove(root);
      view.mixer?.stopAllAction(); if (root) view.mixer?.uncacheRoot(root);
      faceMat?.dispose(); view.mixer = null; view.tick = null;
    };
    return c;
  }

  let content = null;
  function showHero() {
    content?.dispose();
    const c = mochiContent(state.id, { face: state.face, clip: state.clip });
    content = c;
    view.loadStarted = false; view.load = () => c.attach(); view.tick = null; view.dirty = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    heroEl.querySelector(".fallback").hidden = true; canvas.removeAttribute("hidden");
    const m = meta(state.id);
    heroEl.setAttribute("aria-label", `Live 3D Kamikin character ${cap(m.name)}, a demo of what runs on the engine`);
    caption.textContent = `${cap(m.name)}, Kamikin demo. Rendered with three.js in this page, not the Kosmos renderer`;
  }

  const rail = document.createElement("div");
  rail.className = "rail"; rail.setAttribute("role", "group"); rail.setAttribute("aria-label", "Model controls");
  const dCharacter = dropdown("Character", (id) => { state.id = id; state.face = "neutral"; state.clip = "idle"; dFace.set("neutral"); dClip.set("idle"); showHero(); });
  const dFace = dropdown("Face", (f) => { state.face = f; content?.setFace(f); });
  const dClip = dropdown("Clip", (n) => { state.clip = n; content?.setClip(n); });
  dCharacter.setItems(ids.map((id) => ({ value: id, label: cap(meta(id).name), hint: meta(id).species })), state.id);
  dFace.setItems(FACES.map((f) => ({ value: f, label: f })), state.face);
  dClip.setItems(CLIPS.map((n) => ({ value: n, label: n })), state.clip);
  rail.append(dCharacter.el, dFace.el, dClip.el);
  $("hero-rail").replaceChildren(rail);

  showHero();
  requestAnimationFrame(frame);
}

boot().catch((err) => console.error("Kosmos page error", err));
