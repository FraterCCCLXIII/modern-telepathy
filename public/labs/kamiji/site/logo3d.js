// Kamiji header logo: the word "Kamiji" as six inflated clay letters (assets/logo/kamiji_logo.glb)
// that take turns bubbling into Kamiji shapes (props, faces, the hand rig) and back.
//
// Progressive enhancement: the header link keeps its flat SVG <img>; it is hidden only after
// this module has drawn its first frame. No WebGL, a load error or a missing asset leaves the SVG.
// Loads once the page is idle, renders at <= 30 fps, pauses off-screen and in background tabs,
// and draws one static frame of the word under prefers-reduced-motion. One extra WebGL context.

const LOGO_URL = "../assets/logo/kamiji_logo.glb";
const HAND_URL = "../assets/kamiji.glb";
const PROPS = "../assets/props/";
const INK = "#1d2a20";            // the dark ink of the flat SVG outline
const YELLOW = "#ffd23f";
const OUTLINE = 0.032;             // world-space ink outline thickness
const FPS = 30;
const SLOT = 2.0;                 // seconds between one letter starting to morph and the next one
const ORDER = [0, 3, 5, 1, 4, 2]; // K i a... visit order; consecutive picks are never neighbours
const T_POP = 0.22;               // letter has burst, shape pops in
const T_OUT = 1.95;               // shape starts to burst
const T_BACK = T_OUT + 0.22;      // letter pops back in
const T_END = T_BACK + 0.8;       // spring has settled
const WORLD_W = 3.5, WORLD_H = 1.78, WORLD_CX = -0.05, WORLD_CY = 0.03; // what the canvas shows (see style.css)

// What each letter turns into. size = world size of the shape's larger side.
const HAND = { kind: "hand", size: 0.76 };
const FORMS = {
  K: [{ file: "objects/crown.glb", tint: "#ffb81f", size: 0.62 }, { file: "faces/face_cool.glb", tint: YELLOW, size: 0.62 }],
  a: [{ kind: "head", size: 0.64 }, { file: "shapes/shape_cat_head.glb", tint: "#ff9f6b", size: 0.6 }],
  m: [{ ...HAND, clip: "Wave" }, { file: "git/git_merge.glb", tint: "#5ec27a", size: 0.62 }],
  i1: [{ file: "heart.glb", tint: "#ff5a7a", size: 0.5 }, { file: "sparkle.glb", tint: "#ffe066", size: 0.55 }],
  j: [{ file: "git/git_branch.glb", tint: "#4aa8ff", size: 0.58 }, { file: "objects/rocket.glb", tint: "#ff7a59", size: 0.6 }],
  i2: [{ file: "objects/lightbulb_on.glb", tint: "#ffe680", size: 0.54 }, { file: "star.glb", tint: "#b583ff", size: 0.54 }],
};

const spring = (u) => (u <= 0 ? 0 : 1 - Math.exp(-7 * u) * Math.cos(11 * u));      // soft ~15% overshoot
const squash = (u) => (u <= 0 ? 0 : 0.28 * Math.exp(-6 * u) * Math.sin(16 * u));   // wobble in x vs y
function vanish(u) {                                                               // inflate a little, then burst
  if (u <= 0) return 1;
  if (u < 0.12) return 1 + 0.16 * Math.sin((u / 0.12) * Math.PI / 2);
  if (u < T_POP) { const k = (u - 0.12) / (T_POP - 0.12); return 1.16 * (1 - k * k); }
  return 0;
}

const link = document.querySelector(".brand-bubble");
const img = link && link.querySelector("img");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function whenIdle() {
  return new Promise((res) => {
    const go = () => ("requestIdleCallback" in window ? requestIdleCallback(res, { timeout: 3000 }) : setTimeout(res, 600));
    if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
  });
}

async function start() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

  const canvas = document.createElement("canvas");
  canvas.className = "logo3d";
  canvas.setAttribute("aria-hidden", "true");
  link.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch (err) { canvas.remove(); throw err; }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.25));
  const key = new THREE.DirectionalLight(0xffefd2, 1.9);
  key.position.set(-1.5, 2, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(20, WORLD_W / WORLD_H, 0.1, 50);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(WORLD_H / 2, WORLD_W / 2 / camera.aspect) / t;
    camera.position.set(WORLD_CX, WORLD_CY, dist);
    camera.lookAt(WORLD_CX, WORLD_CY, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  }
  let dirty = true;

  // ---- ink outline: an inverted hull pushed out along the normals ---------------------------
  function hullMaterial(amt) {
    const m = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color(INK), side: THREE.BackSide });
    const u = { value: amt };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uOut = u;
      sh.vertexShader = "uniform float uOut;\n" + sh.vertexShader.replace(
        "#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * uOut;");
    };
    return m;
  }
  function addOutline(root, amt) {
    const meshes = [];
    root.traverse((n) => { if (n.isMesh && n.visible) meshes.push(n); });
    for (const m of meshes) {
      const mat = hullMaterial(amt);
      let h;
      if (m.isSkinnedMesh) { h = new THREE.SkinnedMesh(m.geometry, mat); h.bindMode = m.bindMode; h.bind(m.skeleton, m.bindMatrix); }
      else h = new THREE.Mesh(m.geometry, mat);
      h.position.copy(m.position); h.quaternion.copy(m.quaternion); h.scale.copy(m.scale);
      h.morphTargetDictionary = m.morphTargetDictionary;
      h.morphTargetInfluences = m.morphTargetInfluences;
      h.frustumCulled = false;
      m.parent.add(h);
    }
  }

  const loader = new GLTFLoader();
  const clayMat = (tint) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });

  // ---- letters -----------------------------------------------------------------------------
  const logo = await loader.loadAsync(LOGO_URL);
  const letterMat = clayMat(YELLOW);
  const letters = [];
  for (const name of ["K", "a", "m", "i1", "j", "i2"]) {
    const node = logo.scene.getObjectByName(name);
    if (!node) throw new Error("logo letter missing: " + name);
    const mesh = node.isMesh ? node : node.getObjectByProperty("isMesh", true);
    mesh.material = letterMat;
    const home = mesh.position.clone(); // the node translation is the letter's place in the word
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
    const pivot = new THREE.Group();
    pivot.position.copy(home);
    pivot.add(mesh);
    addOutline(pivot, OUTLINE);
    scene.add(pivot);
    letters.push({ name, pivot, home, phase: Math.random() * 6.28, morph: null, count: 0, forms: [] });
  }

  // ---- pop effect: ink ring + a few tinted bubbles ------------------------------------------
  const ringGeo = new THREE.RingGeometry(0.88, 1, 40);
  const bubbleGeo = new THREE.SphereGeometry(1, 10, 8);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false });
  const effects = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, inkMat.clone());
    g.add(ring);
    const fill = new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, depthWrite: false });
    const bubbles = [];
    for (let k = 0; k < 8; k++) {
      const outer = new THREE.Mesh(bubbleGeo, inkMat.clone());
      const inner = new THREE.Mesh(bubbleGeo, fill);
      inner.scale.setScalar(0.72); inner.position.z = 0.01;
      const b = new THREE.Group(); b.add(outer, inner);
      g.add(b);
      bubbles.push({ b, ang: 0, rad: 1, sz: 0.05 });
    }
    g.visible = false;
    scene.add(g);
    effects.push({ g, ring, bubbles, fill, age: 99, size: 0.6 });
  }
  function pop(pos, tint, size) {
    const e = effects.find((x) => x.age > 0.6) || effects[0];
    e.age = 0; e.size = size; e.fill.color.set(tint);
    e.g.position.copy(pos); e.g.position.z = 0.3;
    e.bubbles.forEach((q, i) => { q.ang = (i / 8) * Math.PI * 2 + Math.random() * 0.5; q.rad = 0.8 + Math.random() * 0.5; q.sz = 0.032 + Math.random() * 0.03; });
    e.g.visible = true;
  }
  function stepEffects(dt) {
    for (const e of effects) {
      if (!e.g.visible) continue;
      e.age += dt;
      const k = e.age / 0.5;
      if (k >= 1) { e.g.visible = false; continue; }
      const ease = 1 - (1 - k) * (1 - k);
      e.ring.scale.setScalar(e.size * (0.3 + 0.36 * ease));
      e.ring.material.opacity = 0.55 * (1 - k);
      for (const q of e.bubbles) {
        const r = e.size * 0.42 * q.rad * (0.35 + ease);
        q.b.position.set(Math.cos(q.ang) * r, Math.sin(q.ang) * r * 0.9, 0);
        q.b.scale.setScalar(q.sz * (1 - k * k) * 1.6);
      }
      e.fill.opacity = 1 - k * k;
      for (const q of e.bubbles) q.b.children[0].material.opacity = 1 - k * k;
    }
  }

  // ---- shapes (other forms a letter can take) ----------------------------------------------------
  const gltfCache = new Map();
  const loadGltf = (url) => { if (!gltfCache.has(url)) gltfCache.set(url, loader.loadAsync(url)); return gltfCache.get(url); };
  const mixers = [];

  function normalise(root, size) {
    root.updateMatrixWorld(true);
    root.traverse((n) => { if (n.isSkinnedMesh) n.skeleton.update(); }); // so the box follows the pose
    const box = new THREE.Box3().setFromObject(root, true);
    const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(s.x, s.y);
    const holder = new THREE.Group();
    holder.add(root);
    root.position.sub(c); root.position.multiplyScalar(k); root.scale.multiplyScalar(k);
    return { holder, outline: OUTLINE / (size * k) };
  }

  async function buildForm(letter, spec) {
    let root, tint = spec.tint || YELLOW, mixer = null;
    if (spec.kind === "hand" || spec.kind === "head") {
      const gltf = await loadGltf(HAND_URL);
      root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => {
        if (!n.isMesh) return;
        const mat = n.material;
        if (["FaceInk", "FaceTongue", "FaceGlint"].includes(mat.name)) n.visible = false;
        if (mat.name === "HandSkin") {
          n.material = new THREE.MeshPhysicalMaterial({ color: YELLOW, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0.45, sheenRoughness: 0.8 });
        }
        if (n.morphTargetDictionary && spec.kind === "head" && "shapeSphere" in n.morphTargetDictionary) {
          n.morphTargetInfluences[n.morphTargetDictionary.shapeSphere] = 1;
        }
      });
      mixer = new THREE.AnimationMixer(root);
      const clip = gltf.animations.find((c) => c.name === (spec.clip || "Idle"));
      if (clip) mixer.clipAction(clip).play();
      mixer.update(spec.kind === "head" ? 0.8 : 0.5);
      tint = YELLOW;
    } else {
      const gltf = await loadGltf(PROPS + spec.file);
      root = gltf.scene.clone(true);
      root.traverse((n) => {
        if (!n.isMesh) return;
        n.material = n.material.clone();
        if (n.material.name === "Clay") n.material.color.set(tint);
        n.material.clearcoat = 0.4; n.material.clearcoatRoughness = 0.3; // glossy like the letters, when physical
      });
    }
    const { holder, outline } = normalise(root, spec.size);
    addOutline(holder, outline);
    const sway = new THREE.Group();
    sway.add(holder);
    const pivot = new THREE.Group();
    pivot.add(sway);
    pivot.position.copy(letter.home); pivot.position.z = 0.08;
    pivot.visible = false;
    scene.add(pivot);
    if (mixer) mixers.push({ mixer, pivot });
    return { pivot, sway, size: spec.size, tint, spec };
  }

  // ---- morph scheduling ------------------------------------------------------------------------
  let clock = 0, nextSlot = 0.9, orderIdx = 0;
  function startMorph(letter) {
    if (letter.morph) return false;
    const list = letter.forms;
    for (let n = 0; n < list.length; n++) {
      const f = list[(letter.count + n) % list.length];
      if (f) { letter.count += n + 1; letter.morph = { start: clock, form: f, popped: 0 }; return true; }
    }
    return false;
  }
  function pickNext() {
    for (let n = 0; n < ORDER.length; n++) {
      const l = letters[ORDER[(orderIdx + n) % ORDER.length]];
      if (startMorph(l)) { orderIdx = (orderIdx + n + 1) % ORDER.length; return; }
    }
  }

  function applyScale(obj, s, q) {
    if (s < 0.002) { obj.visible = false; return; }
    obj.visible = true;
    obj.scale.set(s * (1 + q), s * (1 - q), s * (1 + (q > 0 ? 0.5 * q : 0)));
  }

  function step(dt) {
    clock += dt;
    for (const m of mixers) if (m.pivot.visible) m.mixer.update(dt);
    if (clock >= nextSlot) { nextSlot += SLOT; pickNext(); }
    for (const l of letters) {
      const p = l.pivot;
      p.position.y = l.home.y + Math.sin(clock * 1.7 + l.phase) * 0.012;
      p.rotation.y = Math.sin(clock * 0.9 + l.phase) * 0.14;
      p.rotation.z = Math.sin(clock * 1.1 + l.phase * 1.3) * 0.03;
      const m = l.morph;
      if (!m) { p.visible = true; p.scale.setScalar(1); continue; }
      const age = clock - m.start, f = m.form;
      // letter
      if (age < T_POP) applyScale(p, vanish(age), 0);
      else if (age < T_BACK) p.visible = false;
      else applyScale(p, spring(age - T_BACK), squash(age - T_BACK));
      // shape
      if (age >= T_POP && age < T_BACK + 0.001) {
        if (m.popped < 1) { m.popped = 1; pop(l.home, f.tint, f.size); }
        const s = age < T_OUT ? spring(age - T_POP) : vanish(age - T_OUT);
        const q = age < T_OUT ? squash(age - T_POP) : 0;
        applyScale(f.pivot, s * f.size, q);
        f.pivot.position.y = l.home.y + Math.sin(clock * 2.1 + l.phase) * 0.02;
        f.sway.rotation.y = Math.sin(clock * 1.5 + l.phase) * 0.4;
        f.sway.rotation.z = Math.sin(clock * 1.9 + l.phase) * 0.06;
      } else f.pivot.visible = false;
      if (age >= T_BACK && m.popped < 2) { m.popped = 2; pop(l.home, YELLOW, 0.55); }
      if (age >= T_END) { l.morph = null; p.visible = true; p.scale.setScalar(1); }
    }
    stepEffects(dt);
    dirty = true;
  }

  // ---- loop: 30 fps, only while on screen and the tab is visible ---------------------------------------
  let onScreen = true, raf = 0, last = 0, ready = false, revealed = false, dead = false;
  const running = () => ready && !dead && onScreen && !document.hidden && !reduce;
  function draw() { renderer.render(scene, camera); dirty = false; }
  function reveal() {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(() => link.classList.add("is-3d")); // the SVG hides only now, no gap
  }
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    const el = now - last;
    if (el < 1000 / FPS - 2) return;
    const dt = Math.min(el / 1000, 0.1);
    last = now;
    step(dt);
    draw();
  }
  function kick() { if (!raf && running()) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; kick(); }).observe(link);
  document.addEventListener("visibilitychange", kick);
  new ResizeObserver(() => { resize(); if (ready && !running()) draw(); }).observe(canvas);
  link.addEventListener("pointerenter", () => { // a nudge: pop a letter on hover
    if (!running() || letters.filter((l) => l.morph).length > 1) return;
    pickNext();
  });
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault(); dead = true; link.classList.remove("is-3d");
  });
  addEventListener("pagehide", () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });

  resize();
  ready = true;
  draw();
  reveal();
  kick();

  // shapes load in the background, after the first frame; the scheduler uses what has arrived
  if (!reduce) {
    for (const l of letters) {
      const specs = FORMS[l.name];
      l.forms = specs.map(() => null);
      specs.forEach((spec, i) => {
        buildForm(l, spec).then((f) => { l.forms[i] = f; }).catch((err) => console.warn("Kamiji logo: shape unavailable", err));
      });
    }
  }
}

if (link && img && webglOk()) {
  whenIdle().then(start).catch((err) => console.warn("Kamiji logo: staying with the flat SVG", err));
}
