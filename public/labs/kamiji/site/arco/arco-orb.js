// Arco orb: the Kamiji sphere head (assets/kamiji.glb, shapeSphere = 1, two tall eyes, no mouth or brows).
// Two looks on the same model:
//   plasma (default)  the clay skin is swapped for the Kosmos docs rainbow plasma (Arco logo, "speaking" state)
//   clay              the plain soft-shaded clay sphere in a tint (agent avatars)
// opts.variant = "plasma" | "clay", opts.tint = "#rrggbb" (clay colour), setPlasma(bool) fades between them.
//
// Plasma source: kosmos-docs/src/components/RainbowCircle/fluidShader.ts (the docs-home orb; the same shader
// feeds the kosmos.computer orb, site/kosmos-computer/kosmos-computer.js). The wave sum, hue maths and the
// hue2rgb ramp below are that fragment shader's lines; only the input coordinate differs (the sphere's
// view-space normal instead of gl_FragCoord, which gives the same flat disc) and soft shading plus a rim
// light are layered on so the ball still reads as clay.
//
// One shared WebGL renderer draws every orb on the page and copies each frame into that orb's own 2D canvas
// (the site's shared-renderer pattern: site/hands/hands.js, site/logo3d.js). Orbs render only while visible,
// at <= 30 fps, not in hidden tabs; prefers-reduced-motion draws one static frame with the plasma frozen.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const MODEL_URL = new URL("../../assets/kamiji.glb", import.meta.url).href;
const FPS = 30;
const FROZEN_T = 5.2;                // plasma time used for the static (reduced-motion) frame
const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");

// Same expression morph weights as the hero hand (site/main.js EXPRESSIONS). Mouth and brows are hidden,
// so only the eye weights show.
const EXPRESSIONS = {
  neutral: {},
  orb: { eyeWideLeft: 1, eyeWideRight: 1 },   // the default here: a little wider so the eyes read at 24-40 px
  happy: { mouthSmile: 1, browUpLeft: 0.3, browUpRight: 0.3 },
  excited: { mouthSmile: 1, mouthOpen: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, browUpLeft: 1, browUpRight: 1 },
  thinking: { browUpLeft: 1, browDownRight: 0.5, eyeLookUp: 0.8, eyeLookLeft: 0.5, mouthFrown: 0.2 },
  sad: { mouthFrown: 1, browSadLeft: 1, browSadRight: 1, eyeLookDown: 0.5 },
  angry: { mouthFrown: 0.7, browAngryLeft: 1, browAngryRight: 1 },
  surprised: { mouthO: 1, eyeWideLeft: 1, eyeWideRight: 1, browUpLeft: 1, browUpRight: 1 },
  sleepy: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.8, browDownLeft: 0.3, browDownRight: 0.3, mouthFrown: 0.15 },
};
const HIDDEN = ["FaceInk", "FaceTongue", "FaceGlint"];

const PLASMA_FN = /* glsl */ `
uniform float uTime;
uniform vec2 uMouse;
uniform float uSpeak;
uniform float uPlasma;
uniform vec3 uTint;
vec3 hue2rgb(float h) {
  h = fract(h);
  float r = abs(h * 6.0 - 3.0) - 1.0;
  float g = 2.0 - abs(h * 6.0 - 2.0);
  float b = 2.0 - abs(h * 6.0 - 4.0);
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
vec3 plasma(vec2 st, float t0) {
  vec2 center = vec2(0.5);
  float t = t0 * 0.45;
  float waveA = sin(st.x * 3.2 + t);
  float waveB = cos(st.y * 2.8 - t * 0.9);
  float waveC = sin((st.x + st.y) * 2.4 + t * 1.1);
  float blend = (waveA + waveB + waveC) / 3.0;
  float hue = fract(
    blend * 0.7 +                       // docs: 0.22 and 0.35 below; widened (x5 and x5.7) so a 40 px ball shows the whole rainbow
    t * 0.18 +
    atan(st.y - 0.5, st.x - 0.5) / 6.2831853 +   // not in the docs: a slow swirl so the ball shows several hues at once
    length(st - center) * 2.0 +
    (st.x - uMouse.x) * 0.5 +
    (st.y - uMouse.y) * 0.5
  );
  vec3 col = hue2rgb(hue);
  return mix(col, hue2rgb(hue + 0.12), smoothstep(-0.2, 0.6, blend) * 0.35);
}`;

const SHADE = /* glsl */ `
vec3 pN = normalize(vNormal);
vec3 pV = normalize(vViewPosition);
vec2 pst = pN.xy * 0.5 + 0.5;
vec3 pcol = plasma(pst, uTime);
pcol = mix(pcol, vec3(dot(pcol, vec3(0.333))), 0.12);          // a touch off the pure wheel so shading reads
pcol = mix(uTint, pcol, uPlasma) * (0.96 + 0.2 * uSpeak);
vec3 pLin = pow(pcol, vec3(2.2));
float pLam = clamp(dot(pN, normalize(vec3(-0.45, 0.6, 0.66))), 0.0, 1.0);
float pNdv = clamp(dot(pN, pV), 0.0, 1.0);
float pRim = pow(1.0 - pNdv, 2.4);
vec3 pBase = pLin * (0.5 + 0.62 * pLam + 0.18 * pN.y);          // soft top-left light, darker underside
pBase *= mix(1.0, 0.82, pow(1.0 - pNdv, 1.6));                    // edge turns down a touch (volume)
vec3 pSheen = vec3(1.0, 0.96, 0.9) * pow(pLam, 5.0) * 0.28;       // clay-ish broad highlight
vec3 pRimCol = mix(pLin, vec3(1.0), 0.55) * pRim * (0.28 + 0.3 * uSpeak);
outgoingLight = pBase + pSheen + pRimCol + pLin * (0.1 * uSpeak);
`;

function plasmaMaterial(tint, plasma) {
  const uniforms = {
    uTime: { value: FROZEN_T }, uMouse: { value: new THREE.Vector2(0.42, 0.58) }, uSpeak: { value: 0 },
    uPlasma: { value: plasma ? 1 : 0 }, uTint: { value: new THREE.Color(tint).convertLinearToSRGB() },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = PLASMA_FN + "\n" + sh.fragmentShader.replace("#include <opaque_fragment>", SHADE + "\n#include <opaque_fragment>");
  };
  m.customProgramCacheKey = () => "arco-plasma-2";
  m.userData.uniforms = uniforms;
  return m;
}

// ---- shared state: one renderer, one parsed model -------------------------------------------------------
const orbs = new Set();
let renderer = null, rcanvas = null, rsize = 0;
let gltf = null, loading = null;
let raf = 0, last = 0, lost = false, globals = false;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
const key = new THREE.DirectionalLight(0xffefd2, 1.8);
key.position.set(-1.5, 2, 4);
scene.add(key);
const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
const pointer = { x: -1e4, y: -1e4 };

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  rcanvas = renderer.domElement;
  rcanvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    orbs.forEach((o) => o.root.classList.remove("is-live"));
  });
  return renderer;
}

function loadModel() {
  loading ||= new GLTFLoader().loadAsync(MODEL_URL).then((g) => (gltf = g));
  return loading;
}

function ensureGlobals() {
  if (globals) return;
  globals = true;
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; if (!reduceQuery.matches) kick(); }, { passive: true });
  addEventListener("pagehide", () => { if (raf) cancelAnimationFrame(raf); raf = 0; });
}

const wants = () => { for (const o of orbs) if (o.ready && o.near && (o.dirty || o.animates())) return true; return false; };

function kick() {
  if (raf || lost || document.hidden || !wants()) return;
  last = performance.now() - 40;
  raf = requestAnimationFrame(loop);
}

function loop(now) {
  raf = 0;
  if (lost || document.hidden) return;
  const dt0 = now - last;
  if (dt0 >= 1000 / FPS - 2) {
    const dt = Math.min(dt0 / 1000, 0.1);
    last = now;
    for (const o of orbs) {
      if (!o.ready || !o.near) continue;
      const moving = o.step(dt);
      if (moving || o.dirty) o.draw();
    }
  }
  if (wants()) raf = requestAnimationFrame(loop);
}

// ---- one orb --------------------------------------------------------------------------------------------
export function createArcoOrb(target, opts = {}) {
  const isCanvas = target.tagName === "CANVAS";
  const root = isCanvas ? target.parentElement : target;
  const canvas = isCanvas ? target : document.createElement("canvas");
  if (!isCanvas) root.appendChild(canvas);
  canvas.setAttribute("aria-hidden", "true");
  canvas.classList.add("arco-orb-canvas");
  root.classList.add("arco-orb");
  if (opts.size) { root.style.width = opts.size + "px"; root.style.height = opts.size + "px"; }
  const ctx2d = canvas.getContext("2d");
  const plasmaDefault = (opts.variant || "plasma") === "plasma";

  const state = {
    expr: opts.expression || "orb",
    speaking: !!opts.speaking,
    plasma: plasmaDefault, plasmaK: plasmaDefault ? 1 : 0,
    weights: {},
    speak: 0,
    pt: reduceQuery.matches ? FROZEN_T : 1.5 + Math.random() * 20,
    nextBlink: 1.5 + Math.random() * 3,
    look: { x: 0, y: 0 },
  };
  const o = { root, canvas, ready: false, near: false, dirty: true, dead: false, animates: () => !reduceQuery.matches };
  let obj = null, mat = null, meshes = [], w = 0, h = 0;

  function sizeCanvas() {
    const cw = root.clientWidth || opts.size || 36, ch = root.clientHeight || opts.size || 36;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.max(1, Math.round(cw * dpr)), nh = Math.max(1, Math.round(ch * dpr));
    if (nw !== w || nh !== h || canvas.width !== nw) { w = nw; h = nh; canvas.width = w; canvas.height = h; o.dirty = true; }
  }

  o.step = (dt) => {
    const rm = reduceQuery.matches;
    const target = EXPRESSIONS[state.expr] || {};
    const f = rm ? 1 : 1 - Math.exp(-12 * dt);
    let moving = false;
    const u = mat.userData.uniforms;

    const sg = state.speaking ? 1 : 0;
    state.speak += (sg - state.speak) * (rm ? 1 : 1 - Math.exp(-6 * dt));
    if (Math.abs(sg - state.speak) < 0.01) state.speak = sg; else moving = true;
    const pg = state.plasma ? 1 : 0;
    state.plasmaK += (pg - state.plasmaK) * (rm ? 1 : 1 - Math.exp(-7 * dt));
    if (Math.abs(pg - state.plasmaK) < 0.01) state.plasmaK = pg; else moving = true;
    if (!rm && state.plasmaK > 0) { state.pt += dt * (1 + state.speak * 1.8); moving = true; }
    const pulse = state.speak * (0.5 + 0.5 * Math.sin(state.pt * 9));
    u.uTime.value = state.pt;
    u.uPlasma.value = state.plasmaK;
    u.uSpeak.value = rm ? state.speak * 0.5 : state.speak * (0.55 + 0.45 * pulse);

    let lx = 0, ly = 0;
    if (!rm && pointer.x > -1e3) {
      const r = root.getBoundingClientRect();
      const dx = (pointer.x - (r.left + r.width / 2)) / 260, dy = (pointer.y - (r.top + r.height / 2)) / 260;
      const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len) / len;
      lx = dx * k; ly = dy * k;
      u.uMouse.value.set(0.5 + lx * 0.25, 0.5 - ly * 0.25);
    }
    state.look.x += (lx - state.look.x) * f; state.look.y += (ly - state.look.y) * f;

    state.nextBlink -= dt;
    if (state.nextBlink < -0.12) state.nextBlink = 2 + Math.random() * 3;
    const blinking = state.nextBlink < 0 && !rm;

    const goalLook = {
      eyeLookRight: Math.max(0, state.look.x) * 0.55, eyeLookLeft: Math.max(0, -state.look.x) * 0.55,
      eyeLookDown: Math.max(0, state.look.y) * 0.5, eyeLookUp: Math.max(0, -state.look.y) * 0.5,
    };
    const names = new Set([...Object.keys(state.weights), ...Object.keys(target), ...Object.keys(goalLook)]);
    names.forEach((k) => {
      let goal = target[k] || 0;
      if (k in goalLook) goal = Math.max(goal, goalLook[k]);
      if (state.speaking && (k === "eyeWideLeft" || k === "eyeWideRight")) goal = Math.max(goal, 0.25 + 0.2 * pulse);
      if (blinking && (k === "eyeBlinkLeft" || k === "eyeBlinkRight")) goal = Math.max(goal, 1);
      const cur = state.weights[k] || 0;
      const nv = cur + (goal - cur) * f;
      if (Math.abs(nv - cur) > 0.001) moving = true;
      state.weights[k] = Math.abs(nv - goal) < 0.002 ? goal : nv;
    });
    for (const m of meshes) {
      const d = m.morphTargetDictionary;
      for (const k in d) m.morphTargetInfluences[d[k]] = k === "shapeSphere" ? 1 : k === "shapeCube" ? 0 : state.weights[k] || 0;
    }
    return moving || blinking;
  };

  o.draw = () => {
    o.dirty = false;
    if (!o.ready || lost) return;
    sizeCanvas();
    const need = Math.max(w, h);
    if (need > rsize) { rsize = need; renderer.setSize(rsize, rsize, false); }
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.clear();
    scene.add(obj);
    renderer.render(scene, camera);
    scene.remove(obj);
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.drawImage(rcanvas, 0, rcanvas.height - h, w, h, 0, 0, w, h);
    root.classList.add("is-live");
  };

  async function build() {
    await loadModel();
    if (o.dead) return;
    getRenderer();
    if (lost) return;
    obj = SkeletonUtils.clone(gltf.scene);
    mat = plasmaMaterial(opts.tint || "#ffd23f", plasmaDefault);
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const name = n.material.name;
      if (HIDDEN.includes(name)) n.visible = false;
      if (name === "HandSkin") n.material = mat;
      if (n.morphTargetDictionary) meshes.push(n);
    });
    for (const m of meshes) if ("shapeSphere" in m.morphTargetDictionary) m.morphTargetInfluences[m.morphTargetDictionary.shapeSphere] = 1;
    const mixer = new THREE.AnimationMixer(obj);
    const idle = gltf.animations.find((c) => c.name === "Idle");
    if (idle) mixer.clipAction(idle).play();
    mixer.update(0.8);                                   // a settled Idle frame; the ball is frozen after that
    obj.updateMatrixWorld(true);
    obj.traverse((n) => { if (n.isSkinnedMesh) n.skeleton.update(); });
    const box = new THREE.Box3().setFromObject(obj, true);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const radius = Math.max(s.x, s.y, s.z) / 2;
    const holder = new THREE.Group();
    holder.add(obj);
    obj.position.sub(c);
    obj = holder;
    camera.position.set(0, 0, (radius * 1.03) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    o.ready = true;
    o.step(0.016);
    sizeCanvas();
    o.dirty = true;
    ensureGlobals();
    kick();
  }

  const io = new IntersectionObserver((es) => {
    o.near = es[es.length - 1].isIntersecting;
    if (o.near) { o.dirty = true; kick(); }
  }, { rootMargin: "80px" });
  io.observe(root);
  const ro = new ResizeObserver(() => { o.dirty = true; kick(); });
  ro.observe(root);
  reduceQuery.addEventListener?.("change", () => { o.dirty = true; kick(); });

  orbs.add(o);
  build().catch((err) => { console.warn("Arco orb unavailable", err); o.dead = true; orbs.delete(o); root.classList.remove("is-live"); });

  return {
    setExpression(n) { state.expr = n; o.dirty = true; kick(); },
    setSpeaking(v) { state.speaking = !!v; o.dirty = true; kick(); },
    setPlasma(v) { state.plasma = !!v; o.dirty = true; kick(); },
    destroy() { o.dead = true; orbs.delete(o); io.disconnect(); ro.disconnect(); },
  };
}
