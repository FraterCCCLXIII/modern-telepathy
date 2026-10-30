// Kamiji landing page viewer. One shared WebGL renderer draws every preview
// and copies the result into each canvas's 2D context, so the page stays well
// under the browser's WebGL context limit.

import { enableSpin, applyOrbit } from "./spin.js";
import { createHandPoses, HAND_EMOJI } from "./hand-poses.js";
import { initLibraryBrowser } from "./libraries.js";
import { createEffects, EFFECT_FLAGS, effectAnimates, normalizeEffects } from "./effects.js";
import { createRtkMouth, RTK_EXPRESSIONS, shapeFaceAnchor, emojiMouthAnchor } from "./rtk-mouth.js";
import { createTubeFace, tubeShapeAnchor, tubeEmojiAnchor } from "./tube-face.js"; // "tube" Mouth choice: tube mouth + emoji-head eyes
import { createAccessories } from "./accessories.js"; // Accessories tab + hero Accessory row (site/accessories.js)

const HAND_URL = "../assets/kamiji.glb";
const MOCHI_DIR = "../assets/mochi/";
const RUBBER_DIR = "../assets/rubbernose/";
const PROPS_DIR = "../assets/props/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const EXPRESSIONS = {
  neutral: {},
  happy: { mouthSmile: 1, browUpLeft: 0.3, browUpRight: 0.3 },
  excited: { mouthSmile: 1, mouthOpen: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, browUpLeft: 1, browUpRight: 1 },
  thinking: { browUpLeft: 1, browDownRight: 0.5, eyeLookUp: 0.8, eyeLookLeft: 0.5, mouthFrown: 0.2 },
  sad: { mouthFrown: 1, browSadLeft: 1, browSadRight: 1, eyeLookDown: 0.5 },
  angry: { mouthFrown: 0.7, browAngryLeft: 1, browAngryRight: 1 },
  surprised: { mouthO: 1, eyeWideLeft: 1, eyeWideRight: 1, browUpLeft: 1, browUpRight: 1 },
  sleepy: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.8, browDownLeft: 0.3, browDownRight: 0.3, mouthFrown: 0.15 },
};
const SHAPES = { hand: [0, 0], sphere: [1, 0], cube: [0, 1] };
const TINTS = ["#ffd23f", "#ff7a59", "#5ec27a", "#4aa8ff", "#b583ff", "#ff7eb6"];
const TINT_NAMES = ["yellow", "coral", "green", "blue", "violet", "pink"];
const FACE_STATES = ["neutral", "blink", "happy", "joy", "surprised", "sad"];
const MOCHI_CLIPS = ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"];
const HAND_CLIPS = ["Idle", "Wave", "Think", "Celebrate"];
const HIDDEN_FACE_MATERIALS = ["FaceInk", "FaceTongue", "FaceGlint"]; // mouth, brows, glints are off in the library too

// ---- per-tile variation (library rail) --------------------------------------
// Every rail tile gets its own calm cycle, seeded from the item id so it is the same on every load and tab switch
// but differs between neighbours. The hero never uses this. All timing runs off the shared frame tick's dt (no timers).
function seededRng(seed) { // mulberry32
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function tileVariation(id) {
  let h = 2166136261; const s = String(id);
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const rng = seededRng(h >>> 0), r = (lo, hi) => lo + (hi - lo) * rng();
  return {
    rng,                         // seeded stream for later choices (deterministic order, no Math.random)
    phase: rng(),                // 0..1 starting phase of every loop
    speed: r(0.8, 1.2),          // bob / sway / clip rate multiplier
    amp: r(0.8, 1),              // amplitude multiplier (never above what tiles used before)
    blinkEvery: r(2, 5),         // seconds between blinks
    blinkAt0: r(0.6, 4),         // first blink offset
    blinkFor: r(0.1, 0.17),      // seconds the eyes stay shut
    dwell: r(3, 6),              // seconds of idle between special clips
    special: r(1.6, 2.8),        // seconds a special clip is held
    exprEvery: r(4, 9),          // seconds between expression changes
    exprAt0: r(1.5, 7),          // first expression change offset
    order: rng(),                // picks which specials this tile owns and in which order
  };
}
// Occasional blink + expression change on its own timers. o: {base, blink?, exprs[], apply(state), canChange?()}; returns step(dt).
function tileFaceCycle(tv, o) {
  let t = 0, blinkAt = tv.blinkAt0, blinkUntil = 0, exprAt = tv.exprAt0, exprUntil = 0, shown = o.base;
  const show = (s) => { if (s !== shown) { shown = s; o.apply(s); } };
  return (dt) => {
    t += dt;
    if (exprUntil) { if (t > exprUntil) { exprUntil = 0; show(o.base); exprAt = t + tv.exprEvery * (0.85 + 0.3 * tv.rng()); } return; }
    if (blinkUntil) { if (t > blinkUntil) { blinkUntil = 0; show(o.base); } return; }
    if (t > exprAt) {
      if (o.canChange && !o.canChange()) { exprAt = t + 2; return; }
      exprUntil = t + 1.3 + 1.2 * tv.rng(); show(o.exprs[Math.floor(tv.rng() * o.exprs.length)]);
    } else if (o.blink && t > blinkAt) { blinkUntil = t + tv.blinkFor; blinkAt = t + tv.blinkEvery * (0.75 + 0.5 * tv.rng()); show(o.blink); }
  };
}
// Idle for a while, play one of this tile's specials (cross-faded by play()), back to idle. specials: [{name, hold}] hold in seconds.
function tileClipCycle(tv, idle, specials, play) {
  if (!specials.length) return () => {};
  let t = 0, at = tv.dwell * (0.35 + 0.8 * tv.phase), inSpecial = false, i = Math.floor(tv.order * specials.length);
  return (dt) => {
    t += dt;
    if (t < at) return;
    if (inSpecial) { inSpecial = false; play(idle); at = t + tv.dwell * (0.8 + 0.4 * tv.rng()); return; }
    inSpecial = true; i = (i + 1 + Math.floor(tv.rng() * 2)) % specials.length;
    play(specials[i].name); at = t + specials[i].hold;
  };
}
// Seeded subset (1..max) of `names`, in a seeded order, as [{name, hold}] using each clip's length from `dur(name)`.
function pickSpecials(tv, names, max, dur) {
  const pool = names.slice(), out = [], n = 1 + Math.floor(tv.order * 7 % max);
  while (pool.length && out.length < n) {
    const name = pool.splice(Math.floor(tv.rng() * pool.length), 1)[0], d = dur(name) || 1.5;
    out.push({ name, hold: Math.min(3.6, d * Math.max(1, Math.ceil(tv.special / d))) }); // end on a loop boundary
  }
  return out;
}
const ALL_IDS = [
  "kamikin-player", "kamikin-player-bunny-3", "kamikin-player-cat-5", "kamikin-player-chick-6",
  "kamikin-player-hamster-4", "kamikin-player-panda-2", "kamikin-player-pup-8", "kamikin-chochin",
  "kamikin-hana", "kamikin-koke", "kamikin-kon", "kamikin-kumo", "kamikin-pip", "kamikin-shizuku",
];

const $ = (id) => document.getElementById(id);

function showFallback(viewerEl, message) {
  const p = viewerEl.querySelector(".fallback");
  if (p) { p.textContent = message; p.hidden = false; }
  viewerEl.querySelector("canvas")?.setAttribute("hidden", "");
}

function chipGroup(container, items, onPick, initial, label) {
  container.replaceChildren();
  const buttons = [];
  items.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pill"; b.textContent = name;
    b.setAttribute("aria-pressed", String(name === initial));
    b.addEventListener("click", () => {
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(name);
    });
    buttons.push(b); container.append(b);
  });
}

// Multi-select variant (Effect): each pill toggles on its own; onPick gets the list of pressed names.
function multiChipGroup(container, items, onPick, initial, opts = {}) {
  container.replaceChildren();
  const on = new Set((opts.normalize || normalizeEffects)(initial));
  items.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pill"; b.textContent = name;
    if (opts.groups?.[name]) b.dataset.group = opts.groups[name];
    b.setAttribute("aria-pressed", String(on.has(name)));
    b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
      onPick(items.filter((_, i) => container.children[i].getAttribute("aria-pressed") === "true"));
    });
    container.append(b);
  });
}

async function boot() {
  const heroEl = $("hero-hand");
  let THREE, GLTFLoader, SkeletonUtils, renderer;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("Kamiji site: 3D unavailable", err);
    const msg = "3D preview unavailable in this browser. The files are in the repository.";
    showFallback(heroEl, msg);
    document.querySelectorAll("#lib-panels, #lb").forEach((el) => { el.innerHTML = `<p class="hint-note">${msg}</p>`; });
    document.querySelector(".lib-head")?.setAttribute("hidden", "");
    return;
  }

  const loader = new GLTFLoader();
  const viewers = new Set();
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // ---- RTK mouth (site/rtk-mouth.js): one library-wide mode for hands, shapes and emoji heads --------
  // "none" = as before, "rtk" = RTK mouth decal (shapes also get the Kamiji eyes), "classic" = the hand's morph-ink mouth.
  // Start with ?mouth=rtk. Kamikin and Rubbernose never take part.
  let faceMode = new URLSearchParams(location.search).get("mouth") || "none";
  if (!["none", "rtk", "classic", "tube"].includes(faceMode)) faceMode = "none";
  const faceUsers = new Set(); // every live hand / shape / emoji content: { setMouth(mode) }
  function setFaceMode(m) { faceMode = m; faceUsers.forEach((f) => f.setMouth(m)); }
  // Shapes always wear the Kamiji eyes; their Mouth row only switches the RTK mouth (default on).
  let shapeMouth = (() => { const q = new URLSearchParams(location.search).get("mouth"); return q === "none" ? "none" : q === "tube" ? "tube" : "rtk"; })();
  const shapeUsers = new Set();
  function setShapeMouth(m) { shapeMouth = m === "rtk" || m === "tube" ? m : "none"; shapeUsers.forEach((f) => f.setMouth(shapeMouth)); }

  // ---- viewer base -------------------------------------------------------
  // opts.root / opts.margin: scroller the item lives in (carousel track) and how
  // far outside it counts as "near". opts.gate: extra page-level visibility test.
  function makeViewer(el, opts = {}) {
    const canvas = el.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, opts.hemi ?? 1.5));
    const key = new THREE.DirectionalLight(0xffefd2, opts.key ?? 1.8);
    key.position.set(-1.5, 2, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const v = {
      el, canvas, ctx, scene, camera, mixer: null, near: false, gate: opts.gate || null, dirty: true, loadStarted: false,
      load: null, tick: null, faces: new Set(), invalidate() { v.dirty = true; },
    };
    const io = new IntersectionObserver((entries) => {
      v.near = entries[entries.length - 1].isIntersecting;
      v.dirty = true;
    }, { root: opts.root || null, rootMargin: opts.margin || "200px" });
    io.observe(el);
    viewers.add(v);
    v.destroy = () => { io.disconnect(); viewers.delete(v); }; // for library tiles that come and go
    return v;
  }

  function fit(v, root, lift = 0, all3 = false) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const extent = (all3 ? Math.max(size.x, size.y, size.z) * 1.35 : Math.max(size.y, size.x) * 1.25);
    const dist = (extent / 2) / Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2));
    v.camera.position.set(center.x, center.y + lift, center.z + dist);
    v.camera.lookAt(center.x, center.y, center.z);
    v.orbit = { cx: center.x, cy: center.y, cz: center.z, dist, lift };
  }

  let fxLib = null; // hero Effect post-process (effects.js), created on first use
  function draw(v) {
    const w = Math.max(1, Math.round(v.el.clientWidth * dpr)), h = Math.max(1, Math.round(v.el.clientHeight * dpr));
    if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    applyOrbit(v);
    if (v === hero) shadowUpdate(v);
    if (v.fx?.length) {
      try {
        fxLib ||= createEffects(THREE, renderer);
        fxLib.render(v.scene, v.camera, w, h, v.fx, { dist: v.orbit?.dist || 1, frame: fxLib.frame(reduceMotion) });
      } catch (err) { console.warn("Kamiji site: effect unavailable", err); v.fx = []; renderer.setRenderTarget(null); renderer.render(v.scene, v.camera); }
    } else renderer.render(v.scene, v.camera);
    v.ctx.clearRect(0, 0, w, h);
    v.ctx.drawImage(renderer.domElement, 0, 0, w, h);
  }

  let last = performance.now();
  let acc = 0;
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
    acc += dt;
    if (acc >= 1 / 30) {
      const step = acc; acc = 0;
      for (const v of viewers) {
        if (!v.near || (v.gate && !v.gate())) continue; // only visible items render or load
        if (!v.loadStarted && v.load) {
          v.loadStarted = true;
          v.load().catch((err) => { console.warn("Kamiji site: load failed", err); showFallback(v.el, "Could not load this model."); });
          continue;
        }
        if (!v.tick) continue;
        for (const f of v.faces) if (f.update(reduceMotion ? 0 : step)) v.dirty = true; // RTK mouth tween / lip sync
        const moving = v.tick(reduceMotion ? 0 : step);
        if (moving || v.dirty || (v.fx && effectAnimates(v.fx) && !reduceMotion)) { draw(v); v.dirty = false; }
      }
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => viewers.forEach((v) => (v.dirty = true)));

  // ---- content: the hand -------------------------------------------------
  // Each content object owns what it adds to a viewer's scene and removes it in
  // dispose(). Geometry and textures stay with the cached GLB asset; only the
  // materials this content cloned are disposed.
  const handAsset = loader.loadAsync(HAND_URL);

  function handContent(v, color = TINTS[0], lift = 0) {
    const c = { disposed: false };
    const state = { expr: "neutral", shape: "sphere", weights: {}, shapeW: [1, 0], nextBlink: 2 }; // the default hero is the sphere head
    let action = null, gltf = null, skin = null, root = null;
    const meshes = [], mouthMeshes = [];
    let rtk = null, tube = null, mouthMode = faceMode, clipExpr = null; // tube: site/tube-face.js, made on first use
    // Mouth: "none" | "rtk" (RTK decal, site/rtk-mouth.js) | "classic" (the morph-ink mouth, "mouth" is the old name)
    c.setMouth = (n) => {
      mouthMode = n === "mouth" ? "classic" : n;
      mouthMeshes.forEach((m) => { m.visible = mouthMode === "classic"; });
      rtk?.setVisible(mouthMode === "rtk");
      if (mouthMode === "tube" && root && !tube) { tube = createTubeFace(THREE, root, { target: "hand", expression: mouthExpr(), live: true, reduceMotion, followPointer: true, onDirty: () => { v.dirty = true; } }).attach(); v.faces.add(tube); c.tube = tube; }
      tube?.setVisible(mouthMode === "tube"); v.dirty = true;
    };
    const mouthExpr = () => (state.expr === "neutral" && clipExpr ? clipExpr : state.expr);
    c.setColor = (col) => { color = col; skin?.color.set(col); v.dirty = true; };
    c.setExpression = (n) => { state.expr = n; rtk?.setExpression(mouthExpr()); tube?.setExpression(mouthExpr()); v.dirty = true; };
    c.shape = "sphere"; c.setShape = (n) => { state.shape = n; c.shape = n; v.dirty = true; };
    c.setClip = (n) => {
      if (!gltf) return;
      const clip = gltf.animations.find((x) => x.name === n); if (!clip) return;
      const next = v.mixer.clipAction(clip);
      if (action && action !== next) action.fadeOut(0.2);
      next.reset().fadeIn(0.2).play(); action = next; v.dirty = true;
      clipExpr = { Think: "thinking", Celebrate: "excited", Wave: "happy" }[n] || null; // the RTK mouth follows the clip
      rtk?.setExpression(mouthExpr()); tube?.setExpression(mouthExpr());
    };
    c.attach = async () => {
      gltf = await handAsset;
      if (c.disposed) return;
      root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => {
        if (!n.isMesh) return;
        const mat = n.material;
        if (HIDDEN_FACE_MATERIALS.includes(mat.name)) {
          n.visible = false;
          if (mat.name === "FaceInk" || mat.name === "FaceTongue") mouthMeshes.push(n); // the Mouth control shows these
        }
        if (mat.name === "HandSkin") {
          skin = new THREE.MeshPhysicalMaterial({ color: mat.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
          n.material = skin;
        }
        if (n.morphTargetDictionary) meshes.push(n);
      });
      v.scene.add(root);
      v.mixer = new THREE.AnimationMixer(root);
      faceUsers.add(c);
      rtk = createRtkMouth(THREE, root, { target: "hand", expression: mouthExpr(), live: true, reduceMotion, onDirty: () => { v.dirty = true; } }).attach();
      if (rtk.morphMesh) meshes.push(rtk.morphMesh); // follows shapeSphere / shapeCube with the face
      v.faces.add(rtk); c.rtk = rtk;
      c.setMouth(mouthMode);
      c.setColor(color);
      c.setClip("Idle");
      v.mixer.update(reduceMotion ? 0.8 : 0);
      fit(v, root, lift);
      v.root = root;
      v.tick = (dt) => {
        const f = 1 - Math.exp(-12 * dt);
        const target = EXPRESSIONS[state.expr] || {};
        // blink now and then unless the expression already closes the eyes
        state.nextBlink -= dt;
        if (state.nextBlink < -0.12) state.nextBlink = 2 + Math.random() * 3;
        const blinking = state.nextBlink < 0 && !reduceMotion ? 1 : 0;
        const names = new Set([...Object.keys(state.weights), ...Object.keys(target)]);
        let moving = false;
        names.forEach((k) => {
          let goal = target[k] || 0;
          if (blinking && (k === "eyeBlinkLeft" || k === "eyeBlinkRight")) goal = Math.max(goal, 1);
          const cur = state.weights[k] || 0;
          const nv = dt === 0 ? goal : cur + (goal - cur) * f;
          if (Math.abs(nv - cur) > 0.001) moving = true;
          state.weights[k] = Math.abs(nv - goal) < 0.002 ? goal : nv;
        });
        const [s, cu] = SHAPES[state.shape];
        const sw = state.shapeW;
        const ns = dt === 0 ? s : sw[0] + (s - sw[0]) * f, nc = dt === 0 ? cu : sw[1] + (cu - sw[1]) * f;
        if (Math.abs(ns - sw[0]) > 0.001 || Math.abs(nc - sw[1]) > 0.001) moving = true;
        state.shapeW = [ns, nc];
        meshes.forEach((m) => {
          const d = m.morphTargetDictionary;
          for (const k in d) {
            let w;
            if (k === "shapeSphere") w = ns; else if (k === "shapeCube") w = nc; else w = state.weights[k] || 0;
            m.morphTargetInfluences[d[k]] = w;
          }
        });
        // fingers stay still while the hand is a ball or a cube
        const still = state.shape !== "hand" && ns + nc > 0.5;
        if (!still && dt > 0) { v.mixer.update(dt); moving = true; }
        return moving;
      };
      v.dirty = true;
    };
    c.dispose = () => {
      c.disposed = true;
      if (root) v.scene.remove(root);
      v.mixer?.stopAllAction(); if (root) v.mixer?.uncacheRoot(root);
      skin?.dispose();
      faceUsers.delete(c);
      if (rtk) { v.faces.delete(rtk); rtk.dispose(); }
      if (tube) { v.faces.delete(tube); tube.dispose(); }
      v.mixer = null; v.tick = null; v.root = null;
    };
    return c;
  }

  // ---- content: mochi ----------------------------------------------------
  const mochiCache = new Map();
  const loadMochi = (id) => {
    if (!mochiCache.has(id)) mochiCache.set(id, loader.loadAsync(`${MOCHI_DIR}${id}.glb`));
    return mochiCache.get(id);
  };
  let index = [];
  try {
    const r = await fetch(`${MOCHI_DIR}index.json`);
    index = (await r.json()).characters || [];
  } catch (err) { console.warn("Kamiji site: mochi index missing", err); }
  const meta = (id) => index.find((c) => c.id === id) || { id, name: id.replace("kamikin-", ""), species: "" };

  function mochiContent(v, id) {
    const m = meta(id);
    const c = { disposed: false, grounded: true, m, face: "neutral", states: m.faceStates || FACE_STATES }; // grounded: has legs, the hero shadow tracks its feet
    let faceMat = null, texIdx = {}, gltf = null, root = null, action = null;
    const textures = new Map();
    let blinkAt = 1.5 + Math.random() * 3, blinkUntil = 0, t = 0;
    const tv = v !== hero ? tileVariation(id) : null; // rail tile: its own seeded cycle (the hero keeps the original)
    let tileFace = null, tileClip = null;
    const applyTex = async (state) => {
      if (!faceMat || texIdx[state] == null) return;
      if (!textures.has(state)) {
        const tex = await gltf.parser.getDependency("texture", texIdx[state]);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.set(state, tex);
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
      root.traverse((n) => {
        if (!n.isMesh) return;
        if (n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; }
      });
      const faceDef = gltf.parser.json.materials.find((x) => x.name === "face");
      texIdx = faceDef?.extras?.faceStates || {};
      v.scene.add(root); v.root = root;
      v.mixer = new THREE.AnimationMixer(root);
      if (!gltf.animations.some((x) => x.name === "idle") && gltf.animations[0]) c.setClip(gltf.animations[0].name); else c.setClip("idle");
      v.mixer.update(reduceMotion ? 0.5 : 0);
      if (tv && !reduceMotion) {
        const idle = action?.getClip();
        const dur = (n) => gltf.animations.find((x) => x.name === n)?.duration;
        v.mixer.timeScale = tv.speed; v.mixer.update(tv.phase * (idle?.duration || 1)); // own rate and starting phase
        tileClip = tileClipCycle(tv, idle?.name || "idle", pickSpecials(tv, ["happy", "wave"].filter(dur), 2, dur), c.setClip);
        const ex = c.states.filter((x) => ["happy", "joy", "surprised"].includes(x));
        tileFace = tileFaceCycle(tv, { base: "neutral", blink: "blink", exprs: ex.length ? ex : ["happy"], apply: applyTex });
      }
      fit(v, root);
      if (c.face !== "neutral") applyTex(c.face);
      v.tick = (dt) => {
        t += dt;
        if (tv && !reduceMotion) { tileClip(dt); tileFace(dt); }
        else if (!reduceMotion && c.face === "neutral") {
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
      faceMat?.dispose();
      v.mixer = null; v.tick = null; v.root = null;
    };
    return c;
  }

  // ---- content: Rubbernose ----------------------------------------------
  // 1930s cartoon things (assets/rubbernose/). Same face-state swap as the mochi, plus: the
  // "Clay" material is the body colour and takes the tint, and the "Ink" hull is the outline.
  const rubberCache = new Map();
  const loadRubber = (id) => {
    if (!rubberCache.has(id)) rubberCache.set(id, loader.loadAsync(`${RUBBER_DIR}${id}.glb`));
    return rubberCache.get(id);
  };
  let rubberIndex = [];
  try {
    const r = await fetch(`${RUBBER_DIR}index.json`);
    rubberIndex = (await r.json()).characters || [];
  } catch (err) { console.warn("Kamiji site: Rubbernose index missing", err); }
  const rubberMeta = (id) => rubberIndex.find((c) => c.id === id) || { id, name: id.replace("rubbernose-", ""), species: "", tint: TINTS[0] };

  function rubberContent(v, id, color) {
    const m = rubberMeta(id);
    const c = { disposed: false, grounded: true, m, face: "neutral", states: m.faceStates || FACE_STATES, clips: (m.clips || []).map((x) => x.name) };
    let faceMat = null, texIdx = {}, gltf = null, root = null, action = null;
    const clay = [], own = [], textures = new Map();
    color = color || m.tint;
    let blinkAt = 1.5 + Math.random() * 3, blinkUntil = 0, t = 0;
    const tv = v !== hero ? tileVariation(id) : null; // rail tile: its own seeded cycle (the hero keeps the original)
    let tileFace = null, tileClip = null;
    const applyTex = async (state) => {
      if (!faceMat || texIdx[state] == null) return;
      if (!textures.has(state)) {
        const tex = await gltf.parser.getDependency("texture", texIdx[state]);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.set(state, tex);
      }
      if (c.disposed) return;
      faceMat.map = textures.get(state); faceMat.needsUpdate = true; v.dirty = true;
    };
    c.setColor = (col) => { color = col; clay.forEach((x) => x.color.set(col)); v.dirty = true; };
    c.setFace = (s) => { c.face = s; applyTex(s); };
    c.setClip = (n) => {
      if (!gltf || !v.mixer) return;
      const clip = gltf.animations.find((x) => x.name === n); if (!clip) return;
      const next = v.mixer.clipAction(clip);
      if (action && action !== next) action.fadeOut(0.2);
      next.reset().fadeIn(0.2).play(); action = next; v.dirty = true;
    };
    c.attach = async () => {
      gltf = await loadRubber(id);
      if (c.disposed) return;
      root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => {
        if (!n.isMesh) return;
        n.material = n.material.clone(); own.push(n.material);
        if (n.material.name === "face") faceMat = n.material;
        if (n.material.name === "Clay") clay.push(n.material);
        n.frustumCulled = false; // skinned limbs leave the bind-pose bounds
      });
      c.setColor(color);
      texIdx = gltf.parser.json.materials.find((x) => x.name === "face")?.extras?.faceStates || {};
      v.scene.add(root); v.root = root;
      v.mixer = new THREE.AnimationMixer(root);
      c.setClip("idle");
      v.mixer.update(reduceMotion ? 0.5 : 0);
      if (tv && !reduceMotion) {
        const dur = (n) => gltf.animations.find((x) => x.name === n)?.duration;
        v.mixer.timeScale = tv.speed; v.mixer.update(tv.phase * (dur("idle") || 2)); // own rate and starting phase
        tileClip = tileClipCycle(tv, "idle", pickSpecials(tv, ["wave", "cheer", "point", "shrug", "thumbs-up", "charleston"].filter((n) => c.clips.includes(n)), 3, dur), c.setClip);
        const ex = c.states.filter((x) => ["happy", "joy", "surprised"].includes(x));
        tileFace = tileFaceCycle(tv, { base: "neutral", blink: "blink", exprs: ex.length ? ex : ["happy"], apply: applyTex });
      }
      fit(v, root);
      v.orbit.dist *= 1.3; v.orbit.cy += (m.height || 1.3) * 0.07; // cheer and wave reach above the bind-pose box
      if (c.face !== "neutral") applyTex(c.face);
      v.tick = (dt) => {
        t += dt;
        if (tv && !reduceMotion) { tileClip(dt); tileFace(dt); }
        else if (!reduceMotion && c.face === "neutral") {
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
      own.forEach((x) => x.dispose());
      v.mixer = null; v.tick = null; v.root = null;
    };
    return c;
  }

  // ---- content: props ----------------------------------------------------
  const propCache = new Map();
  const loadProp = (file) => {
    if (!propCache.has(file)) propCache.set(file, loader.loadAsync(`${PROPS_DIR}${file}`));
    return propCache.get(file);
  };

  // face: "shape" (Kamiji eyes + RTK mouth on the front of the shape), "emoji" (RTK mouth replaces the baked one), or none (plain prop)
  const EMOJI_MOUTH = ["Mouth", "Teeth", "Tongue"];
  const EMOJI_KEEP = new Set(["face_kiss", "face_shush", "face_thinking"]); // the mouth is the gesture, or a hand covers it: keep the baked geometry
  function propContent(v, item, color, face = null) {
    const c = { disposed: false };
    const mats = [], clay = [];
    let pivot = null, rtk = null, tube = null, user = null, curExpr = null;
    // Only the "Clay" material takes the tint; role materials (eyes, mouth, ...) keep their baked colours.
    c.setColor = (col) => { color = col; clay.forEach((m) => m.color.set(col)); v.dirty = true; };
    c.setExpression = (n) => { curExpr = n; rtk?.setExpression(n); tube?.setExpression(n); };
    c.face = null; c.item = item; c.kind = face || "prop"; // accessories.js reads these
    c.attach = async () => {
      const gltf = await loadProp(item.file);
      if (c.disposed) return;
      const root = gltf.scene.clone(true);
      const meshes = [];
      root.traverse((n) => {
        if (!n.isMesh) return;
        n.material = n.material.clone(); mats.push(n.material); meshes.push(n);
        if (n.material.name === "Clay") clay.push(n.material);
      });
      if (!clay.length) clay.push(...mats); // a model without a Clay material: tint it all
      clay.forEach((m) => m.color.set(color));
      if (face) { // before the root is moved: the decal is projected in model space
        const live = v === hero;
        const baked = face === "emoji" ? meshes.filter((m) => EMOJI_MOUTH.includes(m.material.name)) : [];
        const anchor = face === "shape" ? shapeFaceAnchor(THREE, item.name, root)
          : !EMOJI_KEEP.has(item.name) && baked.length ? emojiMouthAnchor(THREE, item.name, baked) : null;
        if (anchor) {
          const body = face === "emoji" ? meshes.filter((m) => !baked.includes(m) && m.material.name === "Clay") : meshes;
          rtk = createRtkMouth(THREE, root, {
            target: "surface", layout: face === "shape" && !anchor.mouthOnly ? "face" : "mouth", live, reduceMotion,
            expression: face === "emoji" ? item.kamijiExpression || "neutral" : "neutral",
            targets: body, anchor: anchor.rect, offset: anchor.offset, cacheKey: `${item.file}`, onDirty: () => { v.dirty = true; },
          }).attach();
          v.faces.add(rtk); c.rtk = rtk;
          const shape = face === "shape";
          // "tube" Mouth choice (site/tube-face.js): tube mouth + emoji-head eyes on shapes, tube mouth on emoji (they keep their own eyes); made on first use
          curExpr = face === "emoji" ? item.kamijiExpression || "neutral" : "neutral";
          const tubeAnchor = shape ? tubeShapeAnchor(THREE, item.name, anchor) : tubeEmojiAnchor();
          const ensureTube = () => {
            if (!tube) {
              tube = createTubeFace(THREE, root, { target: "surface", live, reduceMotion, eyes: shape && !anchor.mouthOnly, expression: curExpr, targets: body, frame: tubeAnchor.frame, region: tubeAnchor.region, cacheKey: `${item.file}`, followPointer: live, onDirty: () => { v.dirty = true; } }).attach();
              v.faces.add(tube); c.tube = tube;
            }
            return tube.covered > 0.5 ? tube : null;
          };
          user = {
            setMouth(m) {
              const tubeOn = m === "tube" && !!ensureTube();
              const on = rtk.covered > 0.5 && !tubeOn && (shape || m === "rtk");
              rtk.setVisible(on);
              if (shape) rtk.setMouthShown(m === "rtk");
              tube?.setVisible(tubeOn);
              baked.forEach((b) => { b.visible = !(on || tubeOn); });
              v.dirty = true;
            },
          };
          (shape ? shapeUsers : faceUsers).add(user); user.setMouth(shape ? shapeMouth : faceMode);
        }
        c.face = anchor ? face : null;
      }
      pivot = new THREE.Group();
      const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
      root.position.sub(center); pivot.add(root);
      pivot.rotation.y = 0.45;
      v.scene.add(pivot); v.root = pivot;
      fit(v, pivot, 0, true);
      // Slow sway, like assets/props/preview.html. A full turn shows thin flat props edge-on, which looks squashed.
      let t = 0.7;
      const tv = v !== hero ? tileVariation(item.id || item.name) : null; // rail tile: own sway rate, reach and starting phase
      if (tv) {
        t = tv.phase * Math.PI * 2 / 0.9;
        // faces (shape / emoji) now and then change expression; only while the RTK face is shown, so a hidden one costs no redraw
        const swap = rtk && tileFaceCycle(tv, { base: item.kamijiExpression || "neutral", exprs: ["happy", "surprised", "excited", "thinking"], apply: (n) => { c.setExpression(n); v.dirty = true; }, canChange: () => (rtk.visible || tube?.visible) && !reduceMotion });
        v.tick = (dt) => { t += dt * tv.speed; pivot.rotation.y = Math.sin(t * 0.9) * 0.7 * tv.amp; if (swap && !reduceMotion) swap(dt); return dt > 0; };
      } else v.tick = (dt) => { t += dt; pivot.rotation.y = Math.sin(t * 0.9) * 0.7; return dt > 0; };
      v.dirty = true;
    };
    c.dispose = () => {
      c.disposed = true;
      if (pivot) v.scene.remove(pivot);
      if (user) { faceUsers.delete(user); shapeUsers.delete(user); }
      if (rtk) { v.faces.delete(rtk); rtk.dispose(); }
      if (tube) { v.faces.delete(tube); tube.dispose(); }
      mats.forEach((m) => m.dispose());
      v.tick = null; v.root = null;
    };
    return c;
  }

  // ---- hero: swappable model + adaptive controls --------------------------
  const hero = makeViewer(heroEl);
  enableSpin(hero);
  const card = document.querySelector(".card.controls");
  const caption = $("hero-cap");
  const rows = { expr: $("g-expr"), shape: $("g-shape"), clip: $("g-clip"), mouth: $("g-mouth"), accessory: $("g-accessory"), effect: $("g-effect"), tint: $("g-tint") };
  let heroContent = null;
  let heroEffect = []; // the hero Effect choice (additive flags, see effects.js), kept while switching heroes
  const effectRow = () => ({ items: EFFECT_FLAGS, multi: true, initial: heroEffect, onPick: (list) => { heroEffect = normalizeEffects(list); hero.fx = heroEffect; hero.dirty = true; } });

  const accs = createAccessories({ THREE, loader, hero, getContent: () => heroContent, fit, reduceMotion, tileVariation }); // site/accessories.js
  window.kamijiAccessories = accs; // wear(id) / remove(id) / clear() / list() / toggle(id)

  function swatchGroup(container, colors, initial, onPick) {
    container.replaceChildren();
    colors.forEach((col, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch"; b.style.background = col;
      b.setAttribute("aria-label", `Tint ${TINT_NAMES[TINTS.indexOf(col)] || col}`);
      b.setAttribute("aria-pressed", String(col === initial));
      b.addEventListener("click", () => {
        container.querySelectorAll(".swatch").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        onPick(col);
      });
      container.append(b);
    });
  }

  // cfg: { label, expr:{items,initial,onPick}, shape:{...}, clip:{...}, tint:{colors,initial,onPick} }
  function setControls(cfg) {
    card.setAttribute("aria-label", cfg.label);
    hero.fx = cfg.effect ? heroEffect : [];
    requestAnimationFrame(alignRail);
    for (const k of ["expr", "shape", "clip", "mouth", "accessory", "effect"]) {
      if (!rows[k]) continue;
      rows[k].closest(".row").hidden = !cfg[k];
      if (cfg[k]?.multi) multiChipGroup(rows[k], cfg[k].items, cfg[k].onPick, cfg[k].initial, cfg[k]);
      else if (cfg[k]) chipGroup(rows[k], cfg[k].items, cfg[k].onPick, cfg[k].initial);
      else rows[k].replaceChildren();
    }
    rows.tint.closest(".row").hidden = !cfg.tint;
    if (cfg.tint) swatchGroup(rows.tint, cfg.tint.colors, cfg.tint.initial, cfg.tint.onPick);
    else rows.tint.replaceChildren();
  }

  // Ground shadow: grounded heroes (c.grounded) get a contact shadow right under their feet; floating ones keep
  // the shadow low with a gap and shrink it as they bob up. Writes --shadow-y/-w/-h/-o on the stage.
  const stageEl = heroEl.closest(".stage");
  const shadowEl = stageEl?.querySelector(".shadow");
  let sh = null, shLast = performance.now();
  const shVec = new THREE.Vector3();
  function shadowUpdate(v) {
    const root = v.root, o = v.orbit;
    if (!stageEl || !root || !o || !heroContent) return;
    const now = performance.now(), dt = Math.min((now - shLast) / 1000, 0.1); shLast = now;
    root.updateMatrixWorld(true);
    const lowest = () => {
      let y = Infinity;
      for (const b of sh.bones) { b.getWorldPosition(shVec); if (shVec.y < y) y = shVec.y; }
      if (y === Infinity) { root.getWorldPosition(shVec); y = shVec.y; }
      return y;
    };
    if (!sh || sh.root !== root) {
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      sh = { root, bones: [], minY: box.min.y, size, ctr, grounded: !!heroContent.grounded, snap: true };
      root.traverse((n) => { if (n.isBone && n.parent?.isBone) sh.bones.push(n); }); // skip the root bone: it stays on the ground plane
      sh.low0 = lowest();
    }
    const lift = Math.max(0, lowest() - sh.low0) / Math.max(0.01, sh.size.y); // fraction of body height
    const vh = v.el.clientHeight || 1, vw = v.el.clientWidth || 1;
    // project the ground point under the feet (bind-pose bottom) through the hero camera
    shVec.set(sh.ctr.x, sh.minY, sh.ctr.z).project(v.camera); // the shadow stays on the ground; only its size/opacity react to lift
    const footPx = (1 - shVec.y) / 2 * vh;
    const distToFeet = Math.max(0.01, v.camera.position.distanceTo(new THREE.Vector3(sh.ctr.x, sh.minY, sh.ctr.z)));
    const pxPerUnit = (vh / 2) / Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2)) / distToFeet;
    let wPx, yPx, op;
    const k = Math.max(0.3, 1 - lift * 1.6);
    if (sh.grounded) {
      wPx = Math.min(vw * 0.8, Math.max(vw * 0.28, Math.max(sh.size.x * 0.55, sh.size.y * 0.3) * pxPerUnit)) * k;
      const hPx = Math.max(10, wPx * 0.18);
      yPx = footPx - hPx * 0.15; // feet just overlap the top of the ellipse
      op = 0.5 + 0.5 * k;
    } else {
      wPx = Math.min(vw * 0.52, 380) * (0.55 + 0.45 * k); op = 0.35 + 0.65 * k; yPx = vh - 17;
    }
    const hPx = Math.max(10, wPx * (sh.grounded ? 0.18 : 0.07));
    // the CSS box is 26px tall and its bottom edge sits at the viewer's bottom + 10px - 30px: offset from its centre
    const baseCentre = vh - 30 + 13;
    const target = { y: yPx - baseCentre + 0, w: wPx, h: hPx, o: op };
    if (sh.vw !== vw || sh.vh !== vh) { sh.vw = vw; sh.vh = vh; sh.snap = true; } // re-fit (resize): no easing
    const first = sh.snap;
    if (sh.snap || reduceMotion) { sh.cur = target; sh.snap = false; }
    else {
      const a = 1 - Math.exp(-dt * 16), c = sh.cur;
      c.y += (target.y - c.y) * a; c.w += (target.w - c.w) * a; c.h += (target.h - c.h) * a; c.o += (target.o - c.o) * a;
    }
    const st = stageEl.style;
    st.setProperty("--shadow-y", `${sh.cur.y.toFixed(1)}px`); st.setProperty("--shadow-w", `${sh.cur.w.toFixed(1)}px`);
    st.setProperty("--shadow-h", `${sh.cur.h.toFixed(1)}px`); st.setProperty("--shadow-o", sh.cur.o.toFixed(3));
    if (first) requestAnimationFrame(() => st.setProperty("--shadow-on", "1")); // fade in only once the first position is applied
  }

  // Centre the control rail under the model: translate it so the two share one vertical axis, shifted only as
  // far as needed to stay inside the viewport.
  function alignRail() {
    const r = card; if (!r) return;
    r.style.transform = "";
    const m = heroEl.getBoundingClientRect(), b = r.getBoundingClientRect();
    const vwid = document.documentElement.clientWidth, pad = 12;
    let dx = (m.left + m.width / 2) - (b.left + b.width / 2);
    if (b.width + 2 * pad >= vwid) dx = (vwid - b.width) / 2 - b.left;
    else dx = Math.min(Math.max(dx, pad - b.left), vwid - pad - b.right);
    r.style.transform = Math.abs(dx) < 0.5 ? "" : `translateX(${dx.toFixed(1)}px)`;
  }
  if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(alignRail); ro.observe(card); ro.observe(heroEl); ro.observe(document.documentElement); }
  addEventListener("resize", alignRail);

  function setHero(content, aria, text) {
    heroContent?.dispose();
    heroContent = content; sh = null; stageEl?.style.setProperty("--shadow-on", "0"); // hidden until the new model's bounds are known
    hero.loadStarted = false; hero.load = () => content.attach(); hero.tick = null; hero.dirty = true;
    hero.ctx.clearRect(0, 0, hero.canvas.width, hero.canvas.height);
    heroEl.querySelector(".fallback").hidden = true;
    hero.canvas.removeAttribute("hidden");
    heroEl.setAttribute("aria-label", aria);
    caption.textContent = text;
  }

  function showHand(color = TINTS[0]) {
    const c = handContent(hero, color);
    setHero(c, "Live 3D Kamiji hand with an idle animation", "Kamiji hand");
    setControls({
      label: "Hand controls",
      expr: { items: Object.keys(EXPRESSIONS), initial: "neutral", onPick: c.setExpression },
      shape: { items: Object.keys(SHAPES), initial: "sphere", onPick: c.setShape },
      clip: { items: HAND_CLIPS, initial: "Idle", onPick: c.setClip },
      mouth: { items: ["none", "rtk", "classic", "tube"], initial: faceMode, onPick: setFaceMode },
      accessory: accs.rowConfig(),
      effect: effectRow(),
      tint: { colors: TINTS, initial: color, onPick: c.setColor },
    });
  }

  let handPosesApi = null;
  const handPoseApi = () => (handPosesApi ||= createHandPoses({ THREE, SkeletonUtils, reduceMotion, EXPRESSIONS, loader, handAsset, fit, faceFor, tileVariation, tileFaceCycle, isTile: (v) => v !== hero }));
  function showHandPose(item) {
    const color = item.tint || TINTS[0];
    const c = handPoseApi().content(hero, item, color);
    setHero(c, `Live 3D Kamiji hand: ${item.label}`, `Hands · ${item.label}`);
    setControls({
      label: `${item.label} controls`,
      mouth: { items: ["none", "rtk", "classic", "tube"], initial: faceMode, onPick: setFaceMode },
      tint: { colors: TINTS, initial: color, onPick: c.setColor },
    });
  }

  function showMochi(id) {
    const m = meta(id);
    const c = mochiContent(hero, id);
    const desc = `${m.name}${m.species ? `, ${m.species}` : ""}`;
    setHero(c, `Live 3D ${desc}, a Kamikin mochi character, with an idle animation`, `${m.name} · ${m.species || "mochi"} · Kamikin`);
    setControls({
      label: `${m.name} controls`,
      expr: { items: c.states, initial: "neutral", onPick: c.setFace },
      clip: { items: MOCHI_CLIPS, initial: "idle", onPick: c.setClip },
      effect: effectRow(),
    });
  }

  function showRubbernose(id, tint) {
    const m = rubberMeta(id);
    const c = rubberContent(hero, id, tint);
    setHero(c, `Live 3D ${m.name}, a Rubbernose ${m.species || "character"} in the 1930s cartoon style, with an idle animation`, `${m.name} · ${m.species || "character"} · Rubbernose`);
    const start = tint || m.tint;
    const colors = [...new Set([start, m.tint, ...TINTS])];
    setControls({
      label: `${m.name} controls`,
      expr: { items: c.states, initial: "neutral", onPick: c.setFace },
      clip: { items: c.clips, initial: "idle", onPick: c.setClip },
      effect: effectRow(),
      tint: { colors, initial: start, onPick: c.setColor },
    });
  }

  // face: "shape" | "emoji" give the item the RTK mouth switch and an expression row; plain props have neither.
  function showProp(item, face = null) {
    const c = propContent(hero, item, item.tint, face);
    setHero(c, `Live 3D ${item.name} prop, slowly swaying`, `${item.name} · ${item.category || "prop"} prop`);
    const colors = [item.tint, ...TINTS.filter((x) => x.toLowerCase() !== item.tint.toLowerCase())];
    const cfg = { label: `${item.name} prop controls`, tint: { colors, initial: item.tint, onPick: c.setColor } };
    if (face) {
      const emoji = face === "emoji";
      cfg.expr = { items: RTK_EXPRESSIONS, initial: emoji ? item.kamijiExpression || "neutral" : "neutral", onPick: c.setExpression };
      cfg.mouth = emoji
        ? { items: ["baked", "rtk", "tube"], initial: faceMode === "rtk" || faceMode === "tube" ? faceMode : "baked", onPick: (n) => setFaceMode(n === "rtk" || n === "tube" ? n : "none") }
        : { items: ["none", "rtk", "tube"], initial: shapeMouth, onPick: setShapeMouth }; // none = eyes only (classic does not apply to shapes)
      cfg.accessory = accs.rowConfig();
    }
    setControls(cfg);
  }

  // RTK mouth on the Hands tab (called by hand-poses.js for every hand it builds): hero faces are live, tiles share static textures.
  function faceFor(root, expression, v) {
    const ctl = createRtkMouth(THREE, root, { target: "hand", expression, live: v === hero, reduceMotion, onDirty: () => { v.dirty = true; } }).attach();
    const classic = [];
    root.traverse((n) => { if (n.isMesh && (n.material.name === "FaceInk" || n.material.name === "FaceTongue")) classic.push(n); });
    let tube = null, curExpr = expression;
    const user = {
      setMouth(m) {
        classic.forEach((x) => { x.visible = m === "classic"; }); ctl.setVisible(m === "rtk");
        if (m === "tube" && !tube) { tube = createTubeFace(THREE, root, { target: "hand", expression: curExpr, live: v === hero, reduceMotion, followPointer: v === hero, onDirty: () => { v.dirty = true; } }).attach(); v.faces.add(tube); }
        tube?.setVisible(m === "tube"); v.dirty = true;
      },
    };
    faceUsers.add(user); v.faces.add(ctl); user.setMouth(faceMode);
    return { setExpression: (n) => { curExpr = n; ctl.setExpression(n); tube?.setExpression(n); }, dispose() { faceUsers.delete(user); v.faces.delete(ctl); ctl.dispose(); if (tube) { v.faces.delete(tube); tube.dispose(); } } };
  }

  // Lip-sync hook for the chat widgets: window.kamijiFace drives the hero's RTK mouth (hand, shape or emoji item).
  // setMouth("rtk") turns it on library-wide. See docs/rtk-mouth.md.
  const heroFace = () => { for (const f of hero.faces) if (f.visible !== false) return f; return null; }; // the visible one: RTK or tube
  window.kamijiFace = {
    setMouth: (m) => { if (["none", "rtk", "classic", "tube"].includes(m)) { setFaceMode(m); setShapeMouth(m); document.querySelectorAll("#g-mouth .pill").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === m))); } },
    get mouth() { return faceMode; },
    setViseme: (id) => heroFace()?.setViseme(id),
    setOpen: (v) => heroFace()?.setOpen(v),
    speakText: (text, ms, onend) => heroFace()?.speakText(text, ms, onend),
    setExpression: (n) => heroFace()?.setExpression(n),
    stop: () => heroFace()?.stop(),
    _hero: hero, // debug / tests only
  };

  await accs.ready.catch(() => {}); // the Accessory row needs the index
  showHand();

  // ---- tabbed carousel -----------------------------------------------------
  // To add a library, push one object onto TABS:
  //   id        unique tab id
  //   label     tab text
  //   hashKey   URL hash key, shareable as #hashKey=itemId
  //   load()    async, returns items [{ id, ... }] (usually from the library's index.json)
  //   render(item, ctx)  returns an <li class="tile lib-item"> (use libTile + ctx.preview)
  //   onSelect(item)     swaps the hero
  const libInView = { value: false };
  const gate = () => libInView.value;
  new IntersectionObserver((e) => { libInView.value = e[e.length - 1].isIntersecting; viewers.forEach((x) => (x.dirty = true)); }, { rootMargin: "200px" }).observe($("lib"));

  function libTile(tab, item, name, sub, aria) {
    const li = document.createElement("li");
    li.className = "tile lib-item";
    li.innerHTML = `<button type="button"><span class="viewer" role="img"><canvas></canvas><span class="fallback" hidden></span></span><span class="nm"></span><span class="sp"></span></button>`;
    const btn = li.querySelector("button");
    btn.dataset.tab = tab.id; btn.dataset.id = item.id;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", aria);
    li.querySelector(".viewer").setAttribute("aria-hidden", "true");
    li.querySelector(".viewer").removeAttribute("role");
    li.querySelector(".nm").textContent = name;
    li.querySelector(".sp").textContent = sub;
    btn.addEventListener("click", () => select(tab, item, true));
    return li;
  }
  function preview(li, ctx, make, opts = {}) {
    const v = makeViewer(li.querySelector(".viewer"), { root: ctx.track, margin: "0px 260px", gate, hemi: 1.6, key: 2, ...opts });
    const c = make(v);
    v.load = () => c.attach();
  }

  const TABS = [
    {
      id: "kamikin", label: "Kamikin", hashKey: "character",
      async load() {
        const ids = [...ALL_IDS, ...index.map((c) => c.id).filter((id) => !ALL_IDS.includes(id))];
        return ids.map((id) => ({ id, ...meta(id) }));
      },
      render(item, ctx) {
        const li = libTile(this, item, item.name, item.species, `${item.name}, ${item.species || "mochi"}: show in the hero`);
        preview(li, ctx, (v) => mochiContent(v, item.id));
        return li;
      },
      onSelect(item) { showMochi(item.id); },
    },
    {
      id: "rubbernose", label: "Rubbernose", hashKey: "rubbernose",
      async load() { return rubberIndex.map((m) => ({ ...m })); },
      render(item, ctx) {
        const li = libTile(this, item, item.name, item.species, `${item.name}, ${item.species || "Rubbernose character"}: show in the hero`);
        preview(li, ctx, (v) => rubberContent(v, item.id));
        return li;
      },
      onSelect(item) { showRubbernose(item.id); },
    },
    {
      id: "hands", label: "Hands", hashKey: "hand",
      async load() { return HAND_EMOJI.map((e) => ({ ...e, id: e.name, tint: TINTS[0] })); },
      render(item, ctx) {
        const li = libTile(this, item, item.label, item.kind === "pair" ? "pair" : item.pose || item.animation, `${item.label}: show in the hero`);
        preview(li, ctx, (v) => handPoseApi().content(v, item, item.tint));
        return li;
      },
      onSelect(item) { showHandPose(item); },
    },
    {
      id: "shapes", label: "Shapes", hashKey: "shape",
      async load() {
        const r = await fetch(`${PROPS_DIR}shapes/index.json`);
        const data = await r.json();
        const rows = (Array.isArray(data) ? data : data.props || []).filter((p) => p.category === "shape");
        const first = ["shape_sphere", "shape_cube", "shape_cube_rounded"];
        rows.sort((a, b) => (first.indexOf(b.name) + 1) - (first.indexOf(a.name) + 1) || 0);
        return rows.map((p) => ({ id: p.name, ...p, file: `shapes/${p.file}` }));
      },
      render(item, ctx) {
        const nm = item.name.replace(/^shape_/, "").replace(/_/g, " ");
        const li = libTile(this, item, nm, item.keywords?.[0] || "shape", `${nm} shape: show in the hero`);
        preview(li, ctx, (v) => propContent(v, item, item.tint, "shape"));
        return li;
      },
      onSelect(item) { showProp(item, "shape"); },
    },
    {
      id: "emojis", label: "Emojis", hashKey: "emoji",
      async load() {
        const r = await fetch(`${PROPS_DIR}faces/index.json`);
        const data = await r.json();
        return (Array.isArray(data) ? data : data.props || []).map((p) => ({ id: p.name, ...p, file: `faces/${p.file}` }));
      },
      render(item, ctx) {
        const nm = item.name.replace(/^face_/, "").replace(/_/g, " ");
        const li = libTile(this, item, nm, item.kamijiExpression || "face", `${nm} emoji: show in the hero`);
        preview(li, ctx, (v) => propContent(v, item, item.tint, "emoji"));
        return li;
      },
      onSelect(item) { showProp(item, "emoji"); },
    },
    {
      id: "props", label: "Props", hashKey: "prop",
      async load() {
        const r = await fetch(`${PROPS_DIR}index.json`);
        const data = await r.json();
        return (Array.isArray(data) ? data : data.props || []).map((p) => ({ id: p.name, ...p }));
      },
      render(item, ctx) {
        const li = libTile(this, item, item.name, item.category || "prop", `${item.name} prop: show in the hero`);
        preview(li, ctx, (v) => propContent(v, item, item.tint));
        return li;
      },
      onSelect(item) { showProp(item); },
    },
    {
      id: "accessories", label: "Accessories", hashKey: "accessory",
      async load() { return (await accs.ready).map((it) => ({ ...it })); },
      render(item, ctx) {
        const li = libTile(this, item, item.label, item.slot, `${item.label}, ${item.slot} accessory: wear it in the hero`);
        preview(li, ctx, (v) => accs.tileContent(v, item));
        return li;
      },
      onSelect(item) { if (!accs.supports(heroContent)) showHand(); accs.toggle(item.id); },
    },
  ];

  const tabList = $("lib-tabs"), panels = $("lib-panels"), prevBtn = $("car-prev"), nextBtn = $("car-next");
  let activeTab = null, selected = null;

  TABS.forEach((tab) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tab"; b.id = `tab-${tab.id}`; b.textContent = tab.label;
    b.setAttribute("role", "tab"); b.setAttribute("aria-controls", `panel-${tab.id}`);
    b.setAttribute("aria-selected", "false"); b.tabIndex = -1;
    b.addEventListener("click", () => activate(tab));
    tab.btn = b; tabList.append(b);
    const p = document.createElement("div");
    p.className = "panel-lib"; p.id = `panel-${tab.id}`; p.hidden = true;
    p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", b.id);
    p.innerHTML = `<ul class="track" role="list"></ul>`;
    tab.panel = p; tab.track = p.querySelector(".track");
    tab.track.setAttribute("aria-label", `${tab.label} library`);
    panels.append(p);
    const upd = () => updateNav(tab);
    tab.track.addEventListener("scroll", upd, { passive: true });
    new ResizeObserver(upd).observe(tab.track);
  });
  tabList.addEventListener("keydown", (e) => {
    const i = TABS.indexOf(activeTab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const tab = TABS[(to + TABS.length) % TABS.length];
    activate(tab); tab.btn.focus();
  });

  function updateNav(tab) {
    if (tab !== activeTab) return;
    const t = tab.track, max = t.scrollWidth - t.clientWidth;
    const atStart = t.scrollLeft <= 1, atEnd = t.scrollLeft >= max - 1;
    prevBtn.disabled = atStart; nextBtn.disabled = atEnd;
    t.style.setProperty("--fl", atStart ? "0px" : "36px");
    t.style.setProperty("--fr", atEnd ? "0px" : "36px");
  }
  const step = (dir) => activeTab.track.scrollBy({ left: dir * activeTab.track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));

  async function activate(tab) {
    activeTab = tab;
    TABS.forEach((t) => {
      const on = t === tab;
      t.btn.setAttribute("aria-selected", String(on)); t.btn.tabIndex = on ? 0 : -1; t.panel.hidden = !on;
    });
    if (!tab.ready) {
      tab.ready = (async () => {
        try {
          tab.items = await tab.load();
          const ctx = { track: tab.track };
          tab.items.forEach((item) => tab.track.append(tab.render(item, ctx)));
          refreshPressed();
        } catch (err) {
          console.warn("Kamiji site: library failed", tab.id, err);
          tab.track.innerHTML = `<li class="hint-note">Could not load the ${tab.label} library.</li>`;
        }
      })();
    }
    await tab.ready;
    updateNav(tab);
  }

  function refreshPressed() {
    document.querySelectorAll(".lib-item button").forEach((b) => {
      b.setAttribute("aria-pressed", String(!!selected && b.dataset.tab === selected.tab.id && b.dataset.id === selected.item.id));
    });
  }

  function revealHero() {
    const r = heroEl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) heroEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  function select(tab, item, user) {
    selected = { tab, item };
    tab.onSelect(item);
    refreshPressed();
    history.replaceState(null, "", `#${tab.hashKey}=${encodeURIComponent(item.id)}`);
    if (user) revealHero();
  }

  async function applyHash() {
    const h = location.hash.slice(1), eq = h.indexOf("=");
    if (eq < 0) return;
    const tab = TABS.find((t) => t.hashKey === h.slice(0, eq));
    if (!tab) return;
    let id; try { id = decodeURIComponent(h.slice(eq + 1)); } catch { return; }
    await activate(tab);
    const item = tab.items?.find((x) => x.id === id);
    if (!item) return;
    select(tab, item, false);
    const li = tab.track.querySelector(`button[data-id="${CSS.escape(id)}"]`)?.closest("li");
    if (li) tab.track.scrollTo({ left: li.offsetLeft - (tab.track.clientWidth - li.offsetWidth) / 2 });
  }
  addEventListener("hashchange", applyHash);

  await activate(TABS[0]);
  await applyHash();

  // Library browser (site/libraries.js): everything it needs from this file.
  initLibraryBrowser({
    THREE, SkeletonUtils, loader, reduceMotion, TINTS, TINT_NAMES, EXPRESSIONS,
    makeViewer, fit, hero, handAsset, setHero, setControls, revealHero, showMochi, showRubbernose,
    mochi: { ids: ALL_IDS, index, meta, content: mochiContent },
    rubbernose: { index: rubberIndex, meta: rubberMeta, content: rubberContent },
  });

  requestAnimationFrame(frame);
}

boot().catch((err) => console.error("Kamiji site error", err));
