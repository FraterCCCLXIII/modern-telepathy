// Shared code for the workshop editors: three.js engine (one shared WebGL
// renderer drawing into the page's 2D canvas), a vanilla port of the outline
// and toon look from src/kamiji-toon.ts, the 3D emoji catalogue, halo and
// reactions, and the editor UI (layers, floating bar, code, PNG, share link).
// Plain ES modules, no build step.
import { initWorkshopMenu } from "./menu.js";
import { STUDIOS } from "./studios.js";

export const ASSETS = new URL("../../assets/", import.meta.url).href;
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const $ = (sel, el = document) => el.querySelector(sel);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const TINTS = ["#ffd23f", "#ff9f43", "#ff6b6b", "#ff8fc7", "#a77bff", "#4f9dff", "#2ec4b6", "#6bd66b"];
export const INK_COLORS = ["#111111", "#3b2a20", "#1f3a5f", "#ffffff", "#ff4d8d"];

// ---------------------------------------------------------------- engine

export async function loadEngine() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const loader = new GLTFLoader();
  const cache = new Map();
  const load = (url) => {
    if (!cache.has(url)) {
      const p = loader.loadAsync(url);
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return cache.get(url);
  };
  return { THREE, SkeletonUtils, renderer, load };
}

/** One viewer: scene, camera, lights, render loop into a 2D canvas. */
export function createStage(engine, viewerEl) {
  const { THREE, renderer } = engine;
  const canvas = viewerEl.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
  const key = new THREE.DirectionalLight(0xffefd2, 1.8);
  key.position.set(-1.5, 2, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const st = {
    scene, camera, canvas, tickers: new Set(), toons: new Set(), dirty: true,
    afterRender: new Set(), frameInfo: null, modelCss: 300, invalidate() { st.dirty = true; },
  };

  /** Frame a square of edge `edge * margin` around `center` (a Vector3). */
  st.frame = (center, edge, margin) => {
    st.frameInfo = { center: center.clone(), edge, margin };
    st.dirty = true;
  };
  function applyFrame(w, h) {
    const f = st.frameInfo;
    if (!f) return;
    const vf = THREE.MathUtils.degToRad(camera.fov / 2);
    const aspect = w / h;
    const half = (f.edge * f.margin) / 2;
    const dist = Math.max(half / Math.tan(vf), half / Math.tan(Math.atan(Math.tan(vf) * aspect)));
    camera.position.set(f.center.x, f.center.y, f.center.z + dist);
    camera.lookAt(f.center.x, f.center.y, f.center.z);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    st.modelCss = Math.min(viewerEl.clientWidth, viewerEl.clientHeight) / f.margin;
  }

  st.render = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(viewerEl.clientWidth * dpr));
    const h = Math.max(1, Math.round(viewerEl.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    applyFrame(w, h);
    st.toons.forEach((t) => t.prepare(st.modelCss, w, h, dpr));
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(renderer.domElement, 0, 0, w, h);
    st.afterRender.forEach((fn) => fn());
  };

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduceMotion || st.dirty) {
      st.tickers.forEach((fn) => fn(reduceMotion ? 0 : dt));
      st.render();
      st.dirty = false;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  new ResizeObserver(() => (st.dirty = true)).observe(viewerEl);
  return st;
}

// ------------------------------------------------- outline and toon (port)
// Ported from src/kamiji-toon.ts: an inverted-hull ink outline pushed out in
// clip space (constant pixel width) and a banded light ramp. Same shader
// patches; the vanilla version applies them to the model's own materials, so
// call it only on clones (every model here clones its materials).

function weldNormals(pos, nor, count) {
  let extent = 0;
  for (let i = 0; i < count * 3; i++) extent = Math.max(extent, Math.abs(pos[i]));
  const q = 1 / Math.min(1e-3, Math.max(extent * 1e-5, 1e-6));
  const sums = new Map(), keys = new Array(count);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const k = `${Math.round(pos[i3] * q)},${Math.round(pos[i3 + 1] * q)},${Math.round(pos[i3 + 2] * q)}`;
    keys[i] = k;
    const s = sums.get(k);
    if (s) { s[0] += nor[i3]; s[1] += nor[i3 + 1]; s[2] += nor[i3 + 2]; }
    else sums.set(k, [nor[i3], nor[i3 + 1], nor[i3 + 2]]);
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let [x, y, z] = sums.get(keys[i]);
    let len = Math.hypot(x, y, z);
    if (len < 1e-8) { [x, y, z] = [nor[i3], nor[i3 + 1], nor[i3 + 2]]; len = Math.hypot(x, y, z) || 1; }
    out[i3] = x / len; out[i3 + 1] = y / len; out[i3 + 2] = z / len;
  }
  return out;
}

const WELDED = "kamijiInkNormal";
const TOON_GLSL = `
uniform float uKamijiBands;
float kamijiBand( float t, float bands ) {
  float x = clamp( t, 0.0, 1.0 ) * ( bands - 1.0 );
  float w = clamp( fwidth( x ) * 1.5, 0.04, 0.5 );
  return ( floor( x ) + smoothstep( 0.5 - w, 0.5 + w, fract( x ) ) ) / ( bands - 1.0 );
}
`;
const TOON_MAIN = `
  if ( uKamijiBands > 1.5 ) {
    vec3 kLit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    float kAlbedo = max( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.03 );
    float kShade = dot( kLit, vec3( 0.2126, 0.7152, 0.0722 ) ) / kAlbedo;
    float kT = kamijiBand( kShade / 1.7, uKamijiBands );
    vec3 kTone = mix( vec3( 0.80, 0.84, 1.0 ), vec3( 1.0, 0.985, 0.95 ), kT );
    outgoingLight = diffuseColor.rgb * mix( 0.62, 1.1, kT ) * kTone + totalEmissiveRadiance;
  }
  #include <opaque_fragment>`;

export function outlineDisplayPixels(width, cssSize) {
  return Math.max(1, width * Math.sqrt(Math.max(cssSize, 1) / 48));
}

export function makeToon(engine, root) {
  const { THREE } = engine;
  const ink = { value: new THREE.Vector2(0, 0) };
  const bands = { value: 0 };
  const hulls = [];
  const patched = new WeakSet();
  let built = false, applied = "", cfg = null;

  const hullMat = new THREE.MeshBasicMaterial({
    color: "#111111", side: THREE.BackSide, fog: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
  });
  hullMat.onBeforeCompile = (shader) => {
    shader.uniforms.uKamijiInk = ink;
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", `attribute vec3 ${WELDED};\nuniform vec2 uKamijiInk;\nvoid main() {`)
      .replace("#include <beginnormal_vertex>", THREE.ShaderChunk.beginnormal_vertex.replace("vec3( normal )", `vec3( ${WELDED} )`))
      .replace("#include <begin_vertex>", `#ifdef USE_SKINNING
 #ifdef FLIP_SIDED
 vec3 kamijiN = - transformedNormal;
 #else
 vec3 kamijiN = transformedNormal;
 #endif
#else
 vec3 kamijiN = normalMatrix * ${WELDED};
#endif
#include <begin_vertex>`)
      .replace("#include <project_vertex>", `#include <project_vertex>
      {
        vec2 kd = vec2( kamijiN.x * projectionMatrix[0][0], kamijiN.y * projectionMatrix[1][1] );
        float kl = length( kd );
        kd = kl > 1e-5 ? kd / kl : vec2( 0.0 );
        gl_Position.xy += kd * uKamijiInk * gl_Position.w;
        gl_Position.z += 0.0006 * gl_Position.w;
      }`);
  };
  hullMat.customProgramCacheKey = () => "kamiji-ink-s";

  const meshes = () => {
    const list = [];
    root.traverse((n) => { if (n.isMesh && !n.userData.kamijiOutline) list.push(n); });
    return list;
  };
  const cutout = (m) => m.alphaTest > 0 || m.transparent;

  function ensureWelded(geometry) {
    if (geometry.getAttribute(WELDED)) return true;
    const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
    if (!p || !n || p.count !== n.count) return false;
    const pos = new Float32Array(p.count * 3), nor = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
      nor[i * 3] = n.getX(i); nor[i * 3 + 1] = n.getY(i); nor[i * 3 + 2] = n.getZ(i);
    }
    geometry.setAttribute(WELDED, new THREE.BufferAttribute(weldNormals(pos, nor, p.count), 3));
    return true;
  }

  function buildHulls() {
    if (built) return;
    built = true;
    meshes().forEach((src) => {
      if (Array.isArray(src.material) || cutout(src.material)) return; // cut-out decals (mochi face) get no hull
      if (!ensureWelded(src.geometry)) return;
      let hull;
      if (src.isSkinnedMesh) { hull = new THREE.SkinnedMesh(src.geometry, hullMat); hull.bind(src.skeleton, src.bindMatrix); }
      else hull = new THREE.Mesh(src.geometry, hullMat);
      if (src.morphTargetInfluences) { hull.morphTargetInfluences = src.morphTargetInfluences; hull.morphTargetDictionary = src.morphTargetDictionary; }
      hull.frustumCulled = false;
      hull.matrixAutoUpdate = false;
      hull.userData.kamijiOutline = true;
      src.add(hull);
      hulls.push({ src, hull });
    });
  }

  function patchMaterials() {
    meshes().forEach((mesh) => {
      const m = mesh.material;
      if (Array.isArray(m) || patched.has(m) || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
      patched.add(m);
      const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
      m.onBeforeCompile = (shader, r) => {
        prev.call(m, shader, r);
        shader.uniforms.uKamijiBands = bands;
        shader.fragmentShader = shader.fragmentShader
          .replace("void main() {", `${TOON_GLSL}\nvoid main() {`)
          .replace("#include <opaque_fragment>", TOON_MAIN);
      };
      m.customProgramCacheKey = () => `${prevKey.call(m)}|kamiji-toon`;
      m.needsUpdate = true;
    });
  }

  return {
    /** s = { outline: { enabled, color, width }, toon: { enabled, bands } } */
    apply(s) {
      const key = JSON.stringify(s);
      if (key === applied) return false;
      applied = key; cfg = s;
      if (s.outline.enabled) buildHulls();
      hulls.forEach(({ hull }) => (hull.visible = s.outline.enabled));
      try { hullMat.color.set(s.outline.color); } catch { hullMat.color.set("#111111"); }
      if (s.toon.enabled) patchMaterials();
      bands.value = s.toon.enabled ? s.toon.bands : 0;
      return true;
    },
    prepare(cssSize, w, h, dpr) {
      if (!cfg?.outline.enabled) return;
      const px = outlineDisplayPixels(cfg.outline.width, cssSize) * dpr;
      ink.value.set((2 * px) / w, (2 * px) / h);
    },
    dispose() {
      hulls.forEach(({ src, hull }) => src.remove(hull));
      hulls.length = 0;
      hullMat.dispose();
    },
  };
}

export function toonFromState(s) {
  return {
    outline: { enabled: !!s.outline, color: s.ink || "#111111", width: Number(s.width) || 2 },
    toon: { enabled: !!s.toon, bands: Number(s.bands) || 3 },
  };
}

// ------------------------------------------------------- emoji catalogue

const GROUPS = [
  { id: "root", label: "Emotes", index: "props/index.json", dir: "props/" },
  { id: "symbols", label: "Symbols", index: "props/symbols/index.json", dir: "props/symbols/" },
  { id: "faces", label: "Faces", index: "props/faces/index.json", dir: "props/faces/" },
  { id: "objects", label: "Objects", index: "props/objects/index.json", dir: "props/objects/" },
  { id: "shapes", label: "Shapes", index: "props/shapes/index.json", dir: "props/shapes/" },
];
export const HALO_GROUPS = GROUPS;

const prettify = (n) => n.replace(/^face_/, "").replace(/_/g, " ");

/** Reads the same index.json files under assets/props the library catalogue is generated from. */
export async function loadCatalog() {
  const entries = [];
  await Promise.all(GROUPS.map(async (g, gi) => {
    try {
      const data = await (await fetch(ASSETS + g.index)).json();
      (Array.isArray(data) ? data : data.props || []).forEach((p, i) => {
        if (p.name === "kamiji-shapes-morph") return;
        entries.push({
          id: p.name, label: prettify(p.name), group: g.id, category: p.category || "", tint: p.tint || "#ffd23f",
          url: ASSETS + g.dir + p.file, kamijiExpression: p.kamijiExpression, order: gi * 1000 + i,
        });
      });
    } catch (err) { console.warn("Kamiji workshop: catalogue group failed", g.id, err); }
  }));
  entries.sort((a, b) => a.order - b.order);
  return { entries, byId: new Map(entries.map((e) => [e.id, e])) };
}

/** Loads one prop as a unit-sized, centred, tintable object (materials are clones). */
export async function makeProp(engine, entry, tint) {
  const { THREE } = engine;
  const gltf = await engine.load(entry.url);
  const inner = gltf.scene.clone(true);
  const clay = [];
  inner.traverse((n) => {
    if (!n.isMesh) return;
    n.material = n.material.clone();
    if (n.material.name === "Clay") clay.push(n.material);
  });
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  inner.position.sub(center);
  const holder = new THREE.Group();
  holder.add(inner);
  holder.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1e-6));
  const wrap = new THREE.Group();
  wrap.add(holder);
  const setTint = (c) => { clay.forEach((m) => { try { m.color.set(c); } catch { /* keep */ } }); };
  setTint(tint || entry.tint);
  return { object: wrap, inner, holder, setTint, fade(o) { inner.traverse((n) => { if (n.isMesh) { n.material.transparent = true; n.material.opacity = o; } }); } };
}

// ------------------------------------------------------------------ halo
// Slot positions ported from src/kamiji-halo-logic.ts. The library draws each
// halo emoji in its own canvas; here they are 3D objects in the same scene,
// so depth and lighting differ slightly.

const DEG = Math.PI / 180;
const spread = (n, a, b) => (n <= 0 ? [] : n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));

export function haloSlots(arrangement, count, radius = 1, spin = 0) {
  const n = Math.max(0, count);
  if (arrangement === "orbit") {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / Math.max(n, 1)) * 360 * DEG + spin;
      return { x: Math.sin(a) * 0.7 * radius, y: -Math.cos(a) * 0.6 * radius, scale: 1 };
    });
  }
  if (arrangement === "burst") {
    return spread(n, -105, 105).map((a, i) => ({ x: Math.sin(a * DEG) * 0.74 * radius, y: -Math.cos(a * DEG) * 0.7 * radius - 0.04, scale: i % 2 ? 0.85 : 1.1 }));
  }
  return spread(n, -72, 72).map((a) => ({ x: Math.sin(a * DEG) * 0.6 * radius, y: -Math.cos(a * DEG) * 0.56 * radius - 0.02, scale: 1 }));
}

export function createHalo(engine, stage, catalog) {
  const { THREE } = engine;
  const group = new THREE.Group();
  stage.scene.add(group);
  let items = [], arrangement = "arc", ids = [], toonCfg = null;
  let center = new THREE.Vector3(), edge = 1, t = 0, loadToken = 0;

  async function add(slot, id) {
    const entry = catalog.byId.get(id);
    if (!entry) return null;
    const prop = await makeProp(engine, entry);
    const it = { id, slot, prop, age: 0, toon: null };
    prop.object.rotation.set(0.14, -0.45, 0);
    if (toonCfg) { it.toon = makeToon(engine, prop.object); it.toon.apply(toonCfg); stage.toons.add(it.toon); }
    group.add(prop.object);
    return it;
  }
  function drop(it) {
    group.remove(it.prop.object);
    if (it.toon) { stage.toons.delete(it.toon); it.toon.dispose(); }
  }

  async function set(nextIds, nextArrangement) {
    arrangement = nextArrangement || arrangement;
    const token = ++loadToken;
    const keep = [];
    items.forEach((it) => { if (nextIds[it.slot] === it.id) keep.push(it); else drop(it); });
    items = keep;
    ids = nextIds.slice();
    for (let slot = 0; slot < nextIds.length; slot++) {
      if (items.some((it) => it.slot === slot)) continue;
      const it = await add(slot, nextIds[slot]);
      if (token !== loadToken) { if (it) drop(it); return; }
      if (it) items.push(it);
    }
    stage.invalidate();
  }

  stage.tickers.add((dt) => {
    t += dt;
    const slots = haloSlots(arrangement, ids.length, 1.12, t * 0.5);
    items.forEach((it) => {
      it.age += dt;
      const s = slots[it.slot];
      if (!s) return;
      const pop = reduceMotion ? 1 : Math.min(1, it.age / 0.28);
      const back = 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2); // ease out back
      const bob = reduceMotion ? 0 : Math.sin(t * 2.2 + it.slot * 1.3) * 0.018 * edge;
      const size = edge * 0.3 * s.scale * (pop >= 1 ? 1 : back);
      it.prop.object.scale.setScalar(Math.max(0.001, size));
      it.prop.object.position.set(center.x + s.x * edge, center.y - s.y * edge + bob, center.z + edge * 0.05);
      if (!reduceMotion && arrangement !== "orbit") it.prop.object.rotation.y = -0.45 + Math.sin(t * 1.4 + it.slot) * 0.25;
    });
  });

  return {
    set,
    layout(c, e) { center = c.clone(); edge = e; stage.invalidate(); },
    setToon(cfg) {
      toonCfg = cfg;
      items.forEach((it) => {
        if (!it.toon) { it.toon = makeToon(engine, it.prop.object); stage.toons.add(it.toon); }
        it.toon.apply(cfg);
      });
      stage.invalidate();
    },
    get ids() { return ids; },
    dispose() { loadToken++; items.forEach(drop); items = []; stage.scene.remove(group); },
  };
}

// ------------------------------------------------------------- reactions
// Floating emoji bursts. Motion constants follow src/kamiji-reactions-logic.ts
// (1.3 to 1.8 s, drift and rise, fade at the end); rendering is in-scene 3D.

export function createReactions(engine, stage, catalog) {
  const { THREE } = engine;
  const group = new THREE.Group();
  stage.scene.add(group);
  let live = [], center = new THREE.Vector3(), edge = 1;
  const MAX_LIVE = 24;

  stage.tickers.add((dt) => {
    live = live.filter((r) => {
      r.age += dt;
      const u = (r.age - r.delay) / r.dur;
      if (u < 0) { r.prop.object.visible = false; return true; }
      if (u >= 1) { group.remove(r.prop.object); return false; }
      r.prop.object.visible = true;
      const ease = 1 - Math.pow(1 - u, 2);
      const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const pop = Math.min(1, u / 0.12);
      r.prop.object.position.set(center.x + r.drift * ease * edge, center.y + r.rise * ease * edge, center.z + edge * 0.1);
      r.prop.object.scale.setScalar(edge * 0.2 * (0.4 + 0.6 * pop));
      r.prop.object.rotation.z = r.rot * ease;
      r.prop.fade(fade);
      return true;
    });
    if (live.length) stage.invalidate();
  });

  return {
    layout(c, e) { center = c.clone(); edge = e; },
    async react(id, count = 3) {
      const entry = catalog.byId.get(id);
      if (!entry) return;
      for (let i = 0; i < count; i++) {
        if (live.length >= MAX_LIVE) { const old = live.shift(); group.remove(old.prop.object); }
        const prop = await makeProp(engine, entry);
        prop.object.visible = false;
        prop.object.rotation.set(0.14, -0.45, 0);
        group.add(prop.object);
        live.push({
          prop, age: 0, delay: i * 0.045, dur: rand(1.3, 1.8), drift: (Math.random() - 0.5) * (0.35 + count * 0.07),
          rise: rand(0.35, 0.65), rot: (Math.random() - 0.5) * 0.7,
        });
      }
      stage.invalidate();
    },
    dispose() { group.clear(); live = []; stage.scene.remove(group); },
  };
}

// --------------------------------------------------------------- editor UI

const b64 = {
  enc: (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))),
};
const sameColor = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const HEX = /^#[0-9a-f]{6}$/i;

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  });
  n.append(...kids);
  return n;
}

const opt = (o) => (typeof o === "object" ? o : { v: o, l: String(o) });

/**
 * mountStudio(factory): factory({ engine, catalog }) returns the studio definition:
 *   id, title, blurb, note, storageKey
 *   defaults        plain state object
 *   layers[]        { key, title, type: pills|swatches|toggle|emoji|action, options, note, when(state), random }
 *   modelKey(state) string; the model is rebuilt when it changes
 *   createModel({engine, stage, catalog, state}) -> { root, center, edge, tick(dt), apply(state), dispose() }
 *   halo            { key, arrangementKey, max } optional
 *   describe(state) -> alt text
 *   code(state)     -> { jsx, json }
 */
export async function mountStudio(factory) {
  const app = $("#app");
  let engine, catalog;
  const shell = buildShell();
  try {
    engine = await loadEngine();
    catalog = await loadCatalog();
  } catch (err) {
    console.warn("Kamiji workshop: 3D unavailable", err);
    shell.viewer.querySelector("canvas").hidden = true;
    const fb = shell.viewer.querySelector(".fallback");
    fb.hidden = false;
    fb.textContent = "3D preview unavailable in this browser. The editor needs WebGL.";
    return;
  }
  const def = await factory({ engine, catalog });
  shell.setTitle(def);

  // ---- state
  const layerKeys = def.layers.filter((l) => l.key);
  const defaults = structuredClone(def.defaults);
  let state = structuredClone(defaults);
  const lsKey = `kamiji-workshop:${def.id}`;
  function sanitize(raw) {
    const out = structuredClone(defaults);
    if (!raw || typeof raw !== "object") return out;
    layerKeys.forEach((L) => {
      const v = raw[L.key];
      if (v === undefined) return;
      if (L.type === "pills" || L.type === "toggle") {
        const ok = L.type === "toggle" ? typeof v === "boolean" : (L.options || []).map(opt).some((o) => o.v === v);
        if (ok) out[L.key] = v;
      } else if (L.type === "range") {
        if (typeof v === "number" && Number.isFinite(v)) out[L.key] = clamp(v, L.min, L.max);
      } else if (L.type === "swatches") {
        if (typeof v === "string" && HEX.test(v)) out[L.key] = v.toLowerCase();
      } else if (L.type === "emoji") {
        if (Array.isArray(v)) out[L.key] = v.filter((id) => catalog.byId.has(id)).slice(0, L.max || 3);
      }
    });
    return out;
  }
  try {
    const hash = new URLSearchParams(location.hash.slice(1)).get("s");
    if (hash) state = sanitize({ ...defaults, ...b64.dec(hash) });
    else { const saved = localStorage.getItem(lsKey); if (saved) state = sanitize(JSON.parse(saved)); }
  } catch { /* corrupt hash or storage: start from defaults */ }

  // ---- stage + model
  const stage = createStage(engine, shell.viewer);
  const shadowEl = el("span", { class: "ws-shadow", "aria-hidden": "true", hidden: true });
  shell.viewer.prepend(shadowEl);
  let shadowBox = null; // CSS px of the ellipse, for the PNG export
  stage.afterRender.add(() => {
    if (!state.shadow || !model) { shadowEl.hidden = true; shadowBox = null; return; }
    const { THREE } = engine;
    const floor = model.floor ?? model.center.y - model.edge / 2;
    const a = new THREE.Vector3(model.center.x, floor, model.center.z).project(stage.camera);
    const b = new THREE.Vector3(model.center.x + model.edge, floor, model.center.z).project(stage.camera);
    const W = shell.viewer.clientWidth, H = shell.viewer.clientHeight;
    const edgePx = ((b.x - a.x) / 2) * W;
    const x = ((a.x + 1) / 2) * W, y = ((1 - a.y) / 2) * H;
    const w = state.shadowWidth * edgePx, h = Math.max(4, Math.round(edgePx * 0.14));
    const top = y - 0.02 * edgePx - h;
    shadowBox = { x, top, w, h };
    const g = `radial-gradient(ellipse at center, color-mix(in srgb, #000000 ${Math.round(state.shadowOpacity * 100)}%, transparent) 0%, transparent 72%)`;
    Object.assign(shadowEl.style, { left: `${x}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, background: g });
    shadowEl.hidden = false;
  });
  const halo = def.halo ? createHalo(engine, stage, catalog) : null;
  const reactions = def.reactions ? createReactions(engine, stage, catalog) : null;
  let model = null, toon = null, building = 0, builtKey = null;

  function frameModel() {
    if (!model) return;
    const c = model.center, e = model.edge;
    const withHalo = halo && halo.ids.length;
    stage.frame(c, e, (model.margin || 1.4) + (withHalo ? 0.35 : 0));
    halo?.layout(c, e);
    reactions?.layout(c, e);
  }

  async function ensureModel() {
    const key = def.modelKey ? def.modelKey(state) : "main";
    if (key === builtKey && model) return;
    const token = ++building;
    shell.viewer.setAttribute("aria-busy", "true");
    let next;
    try { next = await def.createModel({ engine, stage, catalog, state: structuredClone(state) }); }
    catch (err) {
      console.warn("Kamiji workshop: model failed", err);
      shell.toast("Could not load this model.");
      return;
    }
    if (token !== building) { next.dispose(); return; }
    if (model) { stage.tickers.delete(model.tickFn); if (toon) { stage.toons.delete(toon); toon.dispose(); } model.dispose(); stage.scene.remove(model.root); }
    model = next; builtKey = key;
    stage.scene.add(model.root);
    model.tickFn = (dt) => model.tick(dt);
    stage.tickers.add(model.tickFn);
    toon = makeToon(engine, model.root);
    stage.toons.add(toon);
    shell.viewer.removeAttribute("aria-busy");
    syncModel();
    frameModel();
    window.__workshop = { state, stage, model, snap: () => shell.snap() };
  }

  function syncModel() {
    if (!model) return;
    model.apply(state);
    toon.apply(toonFromState(state));
    if (halo && def.halo) {
      halo.set(state[def.halo.key] || [], state[def.halo.arrangementKey]).then(frameModel);
      if (def.haloToon) halo.setToon(toonFromState(state));
    }
    shell.viewer.setAttribute("aria-label", def.describe(state));
    stage.invalidate();
  }

  // ---- persistence
  function persist() {
    const diff = {};
    Object.keys(state).forEach((k) => { if (JSON.stringify(state[k]) !== JSON.stringify(defaults[k])) diff[k] = state[k]; });
    try { localStorage.setItem(lsKey, JSON.stringify(state)); } catch { /* storage blocked */ }
    try {
      const h = Object.keys(diff).length ? `#s=${b64.enc(diff)}` : "";
      history.replaceState(null, "", location.pathname + location.search + h);
    } catch { /* ignore */ }
  }

  function change(patch) {
    Object.assign(state, patch);
    persist();
    layers.refresh();
    if ((def.modelKey ? def.modelKey(state) : "main") !== builtKey) ensureModel(); else syncModel();
    if (halo) frameModel();
    window.__workshop && (window.__workshop.state = state);
  }

  // ---- layers
  const layers = buildLayers(def, () => state, change, catalog, { react: (id, n) => reactions?.react(id, n), toast: shell.toast });
  shell.layersHost.replaceChildren(...layers.sections);
  layers.refresh();

  // ---- floating bar
  function randomise() {
    const next = structuredClone(state);
    layerKeys.forEach((L) => {
      if (L.random === false) return;
      if (L.type === "pills") next[L.key] = pick((L.options || []).map(opt)).v;
      else if (L.type === "swatches") next[L.key] = pick(L.options);
      else if (L.type === "range") next[L.key] = +(Math.round(rand(L.min, L.max) / L.step) * L.step).toFixed(2);
      else if (L.type === "toggle") next[L.key] =Math.random() < (L.randomOn ?? 0.35);
      else if (L.type === "emoji") {
        const n = Math.random() < 0.3 ? 0 : 1 + Math.floor(Math.random() * (L.max || 3));
        const pool = catalog.entries.filter((e) => (L.groups || ["root", "symbols"]).includes(e.group));
        next[L.key] = Array.from({ length: n }, () => pick(pool).id).filter((v, i, a) => a.indexOf(v) === i);
      }
    });
    change(next);
  }
  shell.bar.random.addEventListener("click", randomise);
  shell.bar.reset.addEventListener("click", () => { try { localStorage.removeItem(lsKey); } catch { /* ignore */ } change(structuredClone(defaults)); shell.toast("Reset to the starting character."); });
  shell.bar.png.addEventListener("click", () => {
    stage.render();
    const out = document.createElement("canvas");
    out.width = stage.canvas.width; out.height = stage.canvas.height;
    const o = out.getContext("2d");
    if (shadowBox) { // the shadow is a DOM overlay, so draw the same ellipse into the export
      const k = out.width / shell.viewer.clientWidth;
      const r = (shadowBox.w / 2) * k;
      o.save();
      o.translate((shadowBox.x) * k, (shadowBox.top + shadowBox.h / 2) * k);
      o.scale(1, shadowBox.h / shadowBox.w);
      const grad = o.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(0,0,0,${state.shadowOpacity})`);
      grad.addColorStop(0.72, "rgba(0,0,0,0)");
      o.fillStyle = grad;
      o.fillRect(-r, -r, r * 2, r * 2);
      o.restore();
    }
    o.drawImage(stage.canvas, 0, 0);
    out.toBlob((blob) => {
      if (!blob) { shell.toast("Could not make a PNG."); return; }
      const a = el("a", { href: URL.createObjectURL(blob), download: `kamiji-${def.id}-${Date.now().toString(36)}.png` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      shell.toast("PNG saved (transparent background).");
    }, "image/png");
  });
  shell.bar.share.addEventListener("click", async () => {
    persist();
    shell.toast((await copyText(location.href)) ? "Link copied. The character is in the URL." : "Copy failed. The address bar has the link.");
  });
  shell.bar.code.addEventListener("click", () => shell.openCode(def.code(state)));
  shell.snap = () => stage.canvas.toDataURL("image/png");

  await ensureModel();
  persist();

  if (new URLSearchParams(location.search).get("snap")) {
    setTimeout(() => {
      stage.render();
      shell.snapOut.value = stage.canvas.toDataURL("image/png");
      shell.snapOut.hidden = false;
    }, 2500);
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const t = el("textarea", { "aria-hidden": "true" });
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.append(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}

function buildShell() {
  const app = $("#app");
  const viewer = el("div", { class: "viewer ws-viewer", role: "img", "aria-label": "Live 3D preview" },
    el("canvas"), el("p", { class: "fallback", hidden: true }));
  const btn = (label, extra = "") => el("button", { type: "button", class: `ws-act ${extra}`, text: label });
  const bar = { random: btn("Randomise"), reset: btn("Reset"), code: btn("Copy code"), png: btn("Download PNG"), share: btn("Share link") };
  const toastEl = el("p", { class: "ws-toast", role: "status", "aria-live": "polite" });
  const snapOut = el("textarea", { id: "snap", hidden: true, "aria-hidden": "true" });
  const h1 = el("h1");
  const blurb = el("p", { class: "ws-blurb" });
  const layersHost = el("div", { class: "ws-layers" });
  const note = el("p", { class: "ws-approx" });
  const panel = el("aside", { class: "ws-panel", "aria-label": "Character layers" },
    el("div", { class: "ws-panel-head" }, h1, blurb), layersHost, note);
  const stageSec = el("section", { class: "ws-stage", id: "ws-stage", "aria-label": "Preview" },
    viewer, el("div", { class: "ws-bar", role: "toolbar", "aria-label": "Character actions" }, ...Object.values(bar)), toastEl, snapOut);

  const menuWrap = el("div", { class: "ws", "data-ws-menu": true },
    el("button", { type: "button", class: "ws-btn", id: "ws-btn", "aria-expanded": "false", "aria-controls": "ws-menu" }, "Workshops "),
    el("div", { class: "ws-menu", id: "ws-menu", hidden: true }));
  menuWrap.querySelector("button").insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  const crumb = el("p", { class: "ws-crumb" });
  const top = el("header", { class: "ws-top" },
    el("a", { class: "brand", href: "../index.html", "aria-label": "Kamiji home" }, "Kamiji", el("span", { class: "dot", text: "." })),
    crumb, menuWrap);

  const codeTitle = el("h2", { text: "Copy code" });
  const codeTabs = el("div", { class: "ws-tabs", role: "group", "aria-label": "Format" });
  const codePre = el("pre", { class: "ws-code", tabindex: "0" }, el("code"));
  const codeCopy = btn("Copy", "ws-primary");
  const codeClose = btn("Close");
  const codeNote = el("p", { class: "ws-code-note", text: "Props match the React components in src/. The package is not published yet, so import from your vendored copy." });
  const dialog = el("dialog", { class: "ws-dialog", "aria-labelledby": "ws-code-h" },
    el("div", { class: "ws-dialog-in" }, Object.assign(codeTitle, { id: "ws-code-h" }), codeTabs, codePre, codeNote, el("div", { class: "ws-dialog-act" }, codeCopy, codeClose)));
  let shown = { jsx: "", json: "" }, fmt = "jsx";
  const fmts = [["jsx", "React JSX"], ["json", "JSON"]];
  const tabBtns = fmts.map(([k, l]) => {
    const b = el("button", { type: "button", class: "pill", text: l });
    b.addEventListener("click", () => { fmt = k; paint(); });
    codeTabs.append(b);
    return [k, b];
  });
  function paint() {
    codePre.firstChild.textContent = shown[fmt];
    tabBtns.forEach(([k, b]) => b.setAttribute("aria-pressed", String(k === fmt)));
  }
  codeCopy.addEventListener("click", async () => { toast((await copyText(shown[fmt])) ? `${fmt === "jsx" ? "React snippet" : "JSON"} copied.` : "Copy failed. Select the text instead."); });
  codeClose.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 3200);
  }

  app.replaceChildren(el("a", { class: "skip", href: "#ws-stage", text: "Skip to the preview" }), top,
    el("div", { class: "ws-app" }, panel, stageSec), dialog);
  initWorkshopMenu(app);

  return {
    viewer, bar, layersHost, toast, snapOut, snap: null,
    setTitle(def) {
      document.title = `${def.title} | Kamiji workshop`;
      h1.textContent = def.title; blurb.textContent = def.blurb; note.textContent = def.note || "";
      crumb.textContent = "";
      crumb.append(el("span", { text: "Workshop" }), " / ", def.title);
    },
    openCode(code) { shown = code; paint(); dialog.showModal(); },
  };
}

function buildLayers(def, getState, change, catalog, helpers) {
  const sections = [];
  const refreshers = [];

  def.layers.forEach((L, idx) => {
    const id = `layer-${idx}`;
    const title = el("h2", { class: "ws-layer-t", id, text: L.title });
    const prev = el("button", { type: "button", class: "ws-scroll", "aria-label": `Scroll ${L.title} left`, tabindex: "-1" }, "‹");
    const next = el("button", { type: "button", class: "ws-scroll", "aria-label": `Scroll ${L.title} right`, tabindex: "-1" }, "›");
    const head = el("div", { class: "ws-layer-h" }, title, el("span", { class: "ws-scrolls" }, prev, next));
    const sec = el("section", { class: "ws-layer", "aria-labelledby": id }, head);
    if (L.note) sec.append(el("p", { class: "ws-layer-n", text: L.note }));

    const rail = el("div", { class: "ws-rail", role: "group", "aria-labelledby": id });
    const rails = [rail];
    sec.append(rail);
    const upd = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      prev.disabled = rail.scrollLeft <= 1; next.disabled = rail.scrollLeft >= max - 1;
      head.classList.toggle("scrollable", max > 2);
      rail.style.setProperty("--fl", rail.scrollLeft <= 1 ? "0px" : "28px");
      rail.style.setProperty("--fr", rail.scrollLeft >= max - 1 ? "0px" : "28px");
    };
    rail.addEventListener("scroll", upd, { passive: true });
    new ResizeObserver(upd).observe(rail);
    prev.addEventListener("click", () => rail.scrollBy({ left: -rail.clientWidth * 0.7, behavior: reduceMotion ? "auto" : "smooth" }));
    next.addEventListener("click", () => rail.scrollBy({ left: rail.clientWidth * 0.7, behavior: reduceMotion ? "auto" : "smooth" }));

    let refresh = () => {};
    if (L.type === "pills" || L.type === "toggle") {
      const options = L.type === "toggle" ? [{ v: false, l: L.off || "Off" }, { v: true, l: L.on || "On" }] : L.options.map(opt);
      const btns = options.map((o) => {
        const b = el("button", { type: "button", class: "pill", text: o.l });
        if (o.dot) b.prepend(el("i", { class: "dot-sw", style: `background:${o.dot}` }));
        b.addEventListener("click", () => change(L.pick ? L.pick(o.v, getState()) : { [L.key]: o.v }));
        rail.append(b);
        return [o, b];
      });
      refresh = () => btns.forEach(([o, b]) => b.setAttribute("aria-pressed", String(getState()[L.key] === o.v)));
    } else if (L.type === "swatches") {
      const btns = L.options.map((c) => {
        const b = el("button", { type: "button", class: "swatch", style: `background:${c}`, "aria-label": `${L.title} ${c}` });
        b.addEventListener("click", () => change({ [L.key]: c }));
        rail.append(b);
        return [c, b];
      });
      const input = el("input", { type: "color", "aria-label": `Custom ${L.title.toLowerCase()}` });
      input.addEventListener("input", () => change({ [L.key]: input.value }));
      rail.append(el("label", { class: "swatch custom", title: "Custom colour" }, input));
      refresh = () => {
        const cur = getState()[L.key];
        btns.forEach(([c, b]) => b.setAttribute("aria-pressed", String(sameColor(c, cur))));
        input.value = HEX.test(cur) ? cur : "#888888";
        input.parentElement.classList.toggle("on", !L.options.some((c) => sameColor(c, cur)));
      };
    } else if (L.type === "range") {
      const input = el("input", { type: "range", class: "ws-range", min: L.min, max: L.max, step: L.step, "aria-labelledby": id });
      const out = el("output", { class: "ws-range-v" });
      input.addEventListener("input", () => change({ [L.key]: Number(input.value) }));
      rail.classList.add("ws-rail-range");
      rail.append(input, out);
      refresh = () => { const v = getState()[L.key]; input.value = v; out.textContent = `${Math.round(v * 100)}%`; };
    } else if (L.type === "action") {
      L.options.forEach((o) => {
        const entry = catalog.byId.get(o.v);
        const b = el("button", { type: "button", class: "pill", text: o.l });
        if (entry) b.prepend(el("i", { class: "dot-sw", style: `background:${entry.tint}` }));
        b.addEventListener("click", () => helpers.react(o.v, 3));
        rail.append(b);
      });
    } else if (L.type === "emoji") {
      const max = L.max || 3;
      const picked = el("div", { class: "ws-picked", "aria-label": "Picked emoji" });
      const groupRail = el("div", { class: "ws-rail ws-rail-sub", role: "group", "aria-label": `${L.title} category` });
      const groups = HALO_GROUPS.filter((g) => (L.groups || ["root", "symbols", "faces", "objects", "shapes"]).includes(g.id));
      let group = groups[0].id;
      const gBtns = groups.map((g) => {
        const b = el("button", { type: "button", class: "pill pill-s", text: g.label });
        b.addEventListener("click", () => { group = g.id; renderItems(); refresh(); });
        groupRail.append(b);
        return [g, b];
      });
      sec.insertBefore(picked, rail);
      sec.insertBefore(groupRail, rail);
      rails.push(groupRail);
      const toggle = (id) => {
        const cur = getState()[L.key].slice();
        const at = cur.indexOf(id);
        if (at >= 0) cur.splice(at, 1); else { cur.push(id); while (cur.length > max) cur.shift(); }
        change({ [L.key]: cur });
      };
      const itemBtns = new Map();
      function renderItems() {
        rail.replaceChildren();
        itemBtns.clear();
        catalog.entries.filter((e) => e.group === group).forEach((e) => {
          const b = el("button", { type: "button", class: "pill", text: e.label });
          b.prepend(el("i", { class: "dot-sw", style: `background:${e.tint}` }));
          b.addEventListener("click", () => toggle(e.id));
          rail.append(b);
          itemBtns.set(e.id, b);
        });
        rail.scrollLeft = 0;
        upd();
      }
      renderItems();
      refresh = () => {
        const cur = getState()[L.key];
        title.textContent = `${L.title} (${cur.length}/${max})`;
        gBtns.forEach(([g, b]) => b.setAttribute("aria-pressed", String(g.id === group)));
        itemBtns.forEach((b, id) => b.setAttribute("aria-pressed", String(cur.includes(id))));
        picked.replaceChildren();
        if (!cur.length) picked.append(el("span", { class: "ws-none", text: "None picked. Tap up to three." }));
        cur.forEach((id) => {
          const e = catalog.byId.get(id);
          const c = el("button", { type: "button", class: "chip", "aria-label": `Remove ${e?.label || id}`, text: `${e?.label || id} ×` });
          c.addEventListener("click", () => toggle(id));
          picked.append(c);
        });
      };
    }
    sections.push(sec);
    refreshers.push(() => {
      const hidden = L.when && !L.when(getState());
      sec.hidden = !!hidden;
      sec.classList.toggle("off", !!(L.dim && L.dim(getState())));
      refresh();
      requestAnimationFrame(upd);
    });
  });
  return { sections, refresh: () => refreshers.forEach((f) => f()) };
}

/** ["a", "b"] with spaces, as people write it. */
export const jsxList = (ids) => `[${ids.map((i) => `"${i}"`).join(", ")}]`;

/** Builds a JSX element string. props: array of "name=..." strings; wrap: optional [openTag, closeTag, innerIndentLevel]. */
export function jsxElement(name, props, indent = 0, children = null) {
  const pad = "  ".repeat(indent);
  const lines = [`${pad}<${name}`, ...props.map((p) => `${pad}  ${p}`)];
  if (children) return `${lines.join("\n")}\n${pad}>\n${children}\n${pad}</${name}>`;
  return `${lines.join("\n")}\n${pad}/>`;
}

/** outline / toon JSX props from the shared look state (defaults collapse to `outline` and `toon`). */
export function lookProps(s) {
  const out = [];
  if (s.outline) out.push(sameColor(s.ink, "#111111") && Number(s.width) === 2 ? "outline" : `outline={{ color: "${s.ink}", width: ${s.width} }}`);
  if (s.toon) out.push(Number(s.bands) === 3 ? "toon" : `toon={{ bands: ${s.bands} }}`);
  return out;
}

/** The look layers every studio shares: outline, ink colour, width, toon, bands. */
export function lookLayers() {
  return [
    { key: "outline", title: "Outline", type: "toggle", randomOn: 0.3 },
    { key: "ink", title: "Ink colour", type: "swatches", options: INK_COLORS, when: (s) => s.outline },
    { key: "width", title: "Line width", type: "pills", options: [1, 2, 3, 4, 6].map((v) => ({ v, l: `${v}` })), when: (s) => s.outline, note: "Width at a 48 px avatar; it grows gently with size, as in the library." },
    { key: "toon", title: "Toon shading", type: "toggle", randomOn: 0.3 },
    { key: "bands", title: "Toon bands", type: "pills", options: [2, 3, 4, 5, 6].map((v) => ({ v, l: `${v}` })), when: (s) => s.toon },
    { key: "shadow", title: "Ground shadow", type: "toggle", randomOn: 0.4, note: "A soft ellipse under the model, drawn in the page, as the shadow prop does." },
    { key: "shadowOpacity", title: "Shadow opacity", type: "range", min: 0.05, max: 1, step: 0.05, when: (s) => s.shadow },
    { key: "shadowWidth", title: "Shadow width", type: "range", min: 0.2, max: 1, step: 0.05, when: (s) => s.shadow },
  ];
}
export const LOOK_DEFAULTS = { outline: false, ink: "#111111", width: 2, toon: false, bands: 3, shadow: false, shadowOpacity: 0.3, shadowWidth: 0.55 };

/** shadow JSX prop (empty when off); defaults of the library are opacity 0.3 and width 0.55. */
export function shadowProps(s) {
  return s.shadow ? [`shadow={{ opacity: ${+Number(s.shadowOpacity).toFixed(2)}, width: ${+Number(s.shadowWidth).toFixed(2)} }}`] : [];
}

export { STUDIOS };
