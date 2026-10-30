// "In conversations" section: how the Kamiji UI component libraries look inside threaded conversations.
// Vanilla JS, no build step. ONE shared WebGL renderer draws every 3D avatar into per-item 2D canvases
// (same pattern as main.js, but self-contained: nothing is imported from it). Props are rendered once to
// small images ("snapshots") so reaction chips and badges cost nothing per frame.
// All conversation text is made up demo text. Prototype.

const ASSETS = new URL("../assets/", import.meta.url).href;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.getElementById("th-app");

// ---------------------------------------------------------------- tiny DOM helpers
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
function svgEl(inner, size = 14, cls = "", viewBox = "0 0 24 24") {
  const t = document.createElement("template");
  t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false" class="th-ico ${cls}">${inner}</svg>`;
  return t.content.firstChild;
}

// Octicon shapes, the same paths src/kamiji-git-icon.tsx draws through react-icons/go.
const P = {
  commit: "M16.944 11h4.306a.75.75 0 0 1 0 1.5h-4.306a5.001 5.001 0 0 1-9.888 0H2.75a.75.75 0 0 1 0-1.5h4.306a5.001 5.001 0 0 1 9.888 0Zm-1.444.75a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0Z",
  merge: ["M15 13.25a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Zm-12.5 6a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Zm0-14.5a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0ZM5.75 6.5a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 5.75 6.5Zm0 14.5a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 5.75 21Zm12.5-6a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 18.25 15Z", "M6.5 7.25c0 2.9 2.35 5.25 5.25 5.25h4.5V14h-4.5A6.75 6.75 0 0 1 5 7.25Z", "M5.75 16.75A.75.75 0 0 1 5 16V8a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-.75.75Z"],
  pullRequest: ["M16 19.25a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Zm-14.5 0a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Zm0-14.5a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0ZM4.75 3a1.75 1.75 0 1 0 .001 3.501A1.75 1.75 0 0 0 4.75 3Zm0 14.5a1.75 1.75 0 1 0 .001 3.501A1.75 1.75 0 0 0 4.75 17.5Zm14.5 0a1.75 1.75 0 1 0 .001 3.501 1.75 1.75 0 0 0-.001-3.501Z", "M13.405 1.72a.75.75 0 0 1 0 1.06L12.185 4h4.065A3.75 3.75 0 0 1 20 7.75v8.75a.75.75 0 0 1-1.5 0V7.75a2.25 2.25 0 0 0-2.25-2.25h-4.064l1.22 1.22a.75.75 0 0 1-1.061 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06l2.5-2.5a.75.75 0 0 1 1.06 0ZM4.75 7.25A.75.75 0 0 1 5.5 8v8A.75.75 0 0 1 4 16V8a.75.75 0 0 1 .75-.75Z"],
  error: "M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12Zm8.036-4.024a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L10.939 12l-2.963 2.963a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L12 13.06l2.963 2.964a.75.75 0 0 0 1.061-1.06L13.061 12l2.963-2.964a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L12 10.939Z",
  pass: "M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12Zm16.28-2.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018l-5.97 5.97-2.47-2.47a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l3 3a.75.75 0 0 0 1.06 0Z",
  branch: ["M15 4.75a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0ZM2.5 19.25a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Zm0-14.5a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0ZM5.75 6.5a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 5.75 6.5Zm0 14.5a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 5.75 21Zm12.5-14.5a1.75 1.75 0 1 0-.001-3.501A1.75 1.75 0 0 0 18.25 6.5Z", "M5.75 16.75A.75.75 0 0 1 5 16V8a.75.75 0 0 1 1.5 0v8a.75.75 0 0 1-.75.75Z", "M17.5 8.75v-1H19v1a3.75 3.75 0 0 1-3.75 3.75h-7a1.75 1.75 0 0 0-1.75 1.75H5A3.25 3.25 0 0 1 8.25 11h7a2.25 2.25 0 0 0 2.25-2.25Z"],
  files: ["M12.5 6.75a.75.75 0 0 0-1.5 0V9H8.75a.75.75 0 0 0 0 1.5H11v2.25a.75.75 0 0 0 1.5 0V10.5h2.25a.75.75 0 0 0 0-1.5H12.5V6.75ZM8.75 16a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-6Z", "M5 1h9.982a2 2 0 0 1 1.414.586l4.018 4.018A2 2 0 0 1 21 7.018V21a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm-.5 2v18a.5.5 0 0 0 .5.5h14a.5.5 0 0 0 .5-.5V7.018a.5.5 0 0 0-.146-.354l-4.018-4.018a.5.5 0 0 0-.354-.146H5a.5.5 0 0 0-.5.5Z"],
};
const paths = (k) => [].concat(P[k]).map((d) => `<path d="${d}"/>`).join("");
const icon = (k, size = 14, cls = "") => svgEl(paths(k), size, cls);
const spinIcon = (size = 14) => svgEl('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".25"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', size, "th-spin");
const personIcon = (size) => svgEl('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7Z"/>', size, "th-person");

// ---------------------------------------------------------------- the made-up cast and thread
const CAST = {
  you: { name: "You", role: "", color: "#8a8f84" },
  pip: { name: "Pip", role: "lead agent", mochi: "kamikin-pip", color: "#ff7a59", hand: "#ff7a59" },
  hana: { name: "Hana", role: "subagent", mochi: "kamikin-hana", color: "#5ec27a", hand: "#5ec27a" },
  kon: { name: "Kon", role: "subagent", mochi: "kamikin-kon", color: "#b583ff", hand: "#b583ff" },
};
// Moods per conversation status. face = mochi face texture, clip = mochi animation, expr = hand expression.
const MOODS = {
  running: { label: "Working", face: "neutral", clip: "walk", expr: "thinking", prop: "gear" },
  waiting: { label: "Needs you", face: "surprised", clip: "idle", expr: "surprised", prop: "question" },
  done: { label: "Done", face: "joy", clip: "happy", expr: "excited", prop: "check" },
  failed: { label: "Error", face: "sad", clip: "sad", expr: "sad", prop: "warning" },
  idle: { label: "Idle", face: "blink", clip: "sit", expr: "sleepy", prop: "zzz" },
};
const EXPRESSIONS = {
  neutral: {}, happy: { mouthSmile: 1, browUpLeft: 0.3, browUpRight: 0.3 },
  excited: { mouthSmile: 1, mouthOpen: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, browUpLeft: 1, browUpRight: 1 },
  thinking: { browUpLeft: 1, browDownRight: 0.5, eyeLookUp: 0.8, eyeLookLeft: 0.5, mouthFrown: 0.2 },
  sad: { mouthFrown: 1, browSadLeft: 1, browSadRight: 1, eyeLookDown: 0.5 },
  surprised: { mouthO: 1, eyeWideLeft: 1, eyeWideRight: 1, browUpLeft: 1, browUpRight: 1 },
  sleepy: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.8, browDownLeft: 0.3, browDownRight: 0.3, mouthFrown: 0.15 },
};
const HIDDEN_FACE = ["FaceInk", "FaceTongue", "FaceGlint"];

const RAILS = {
  head: { add: 61, del: 9, files: 4, branch: "fix/upload-retry", sha: "a3f9c1e", pr: 128 },
  pip1: { add: 61, del: 9, files: 4, branch: "fix/upload-retry", sha: "a3f9c1e", pr: 128 },
  hana: { add: 0, del: 0, files: 1, branch: "repro/upload-flaky", sha: "5b07d42", fixed: "passed", kind: "commit", note: "test only" },
  kon: { add: 47, del: 6, files: 3, branch: "fix/fake-clock", sha: "e81c3a9", pr: 129 },
  pip2: { add: 61, del: 9, files: 4, branch: "fix/upload-retry", sha: "a3f9c1e", pr: 128 },
};
const THREAD = [
  { id: "sys0", t: "sys", text: "Workspace ready. Branch fix/upload-retry, 4 tools enabled." },
  { id: "h1", t: "human", who: "you", time: "10:41", text: "The upload test fails once in a while. Can you fix it and open a PR?" },
  {
    id: "p1", t: "agent", who: "pip", time: "10:41", mood: "running", rail: "pip1", emote: "lightbulb",
    text: "On it. Hana will reproduce the failure and Kon will write the patch.",
    kids: [
      { id: "sys1", t: "sys", text: "Pip started 2 subagents" },
      { id: "n1", t: "agent", who: "hana", sub: true, time: "10:43", mood: "done", rail: "hana", emote: "magnifier", text: "Reproduced. It fails about 1 run in 5, when the retry timer fires early." },
      { id: "n2", t: "agent", who: "kon", sub: true, time: "10:46", mood: "running", rail: "kon", emote: "wrench", text: "The patch is small: the test now uses a fake clock instead of real time." },
    ],
  },
  { id: "sys2", t: "sys", text: "CI: 42 of 42 tests passed" },
  { id: "p2", t: "agent", who: "pip", time: "10:48", mood: "done", rail: "pip2", emote: "sparkle", text: "All green. I opened a pull request with both changes for you to review." },
];
// Japanese lines for the subtitle stack tab. Hand written, not checked by a native speaker.
const STACKS = {
  p1: { en: "Leave it to me. Hana investigates, Kon fixes.", w: [["まかせて", "makasete", "leave it to me"], ["ハナ", "hana", "Hana"], ["は", "wa", "", 1], ["しらべて", "shirabete", "look into it"], ["コン", "kon", "Kon"], ["は", "wa", "", 1], ["なおして", "naoshite", "fix it"]] },
  n1: { en: "The test sometimes fails.", w: [["テスト", "tesuto", "test"], ["が", "ga", "", 1], ["ときどき", "tokidoki", "sometimes"], ["おちる", "ochiru", "fails"]] },
  n2: { en: "I made the clock fake.", w: [["とけい", "tokei", "clock"], ["を", "o", "", 1], ["にせもの", "nisemono", "fake"], ["に", "ni", "", 1], ["したよ", "shita yo", "did it"]] },
  p2: { en: "All the tests passed.", w: [["テスト", "tesuto", "test"], ["は", "wa", "", 1], ["ぜんぶ", "zenbu", "all"], ["とおったよ", "tootta yo", "passed"]] },
};

// ---------------------------------------------------------------- the one shared renderer
let glPromise = null;
function gl() {
  if (!glPromise) {
    glPromise = (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setClearColor(0x000000, 0);
      const loader = new GLTFLoader();
      let propIndex = [];
      try { propIndex = await (await fetch(`${ASSETS}props/index.json`)).json(); } catch (e) { console.warn("threads: props index missing", e); }
      return { THREE, renderer, loader, SkeletonUtils, propIndex, cache: new Map() };
    })();
  }
  return glPromise;
}
const asset = (G, url) => { if (!G.cache.has(url)) G.cache.set(url, G.loader.loadAsync(url)); return G.cache.get(url); };

function fitCamera(G, camera, root, aspect, lift = 0, all3 = false) {
  const { THREE } = G;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const ext = all3 ? Math.max(size.x, size.y, size.z) * 1.35 : 0;
  const dist = all3 ? ext / 2 / half : Math.max((size.y * 1.1) / 2 / half, (size.x * 1.3) / 2 / (half * aspect));
  camera.aspect = aspect; camera.updateProjectionMatrix();
  camera.position.set(c.x, c.y + lift, c.z + dist);
  camera.lookAt(c.x, c.y, c.z);
}
function newScene(G) {
  const { THREE } = G;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
  const key = new THREE.DirectionalLight(0xffefd2, 1.8); key.position.set(-1.5, 2, 4); scene.add(key);
  return { scene, camera: new THREE.PerspectiveCamera(30, 1, 0.01, 50) };
}

// ---- viewers: only the ones on screen load and render, at most 30 fps
const viewers = new Set();
let sectionVisible = false, running = false, last = 0, acc = 0;
const dpr = Math.min(devicePixelRatio || 1, 2);

function makeViewer(el, aspect) {
  const canvas = el.querySelector("canvas");
  const v = { el, canvas, ctx: canvas.getContext("2d"), aspect, near: false, dirty: true, started: false, load: null, tick: null, scene: null, camera: null, content: null };
  v.io = new IntersectionObserver((es) => { v.near = es[es.length - 1].isIntersecting; v.dirty = true; kick(); }, { rootMargin: "120px" });
  v.io.observe(el);
  v.ro = new ResizeObserver(() => { v.dirty = true; });
  v.ro.observe(el);
  viewers.add(v);
  return v;
}
function destroyViewer(v) {
  v.io.disconnect(); v.ro.disconnect(); viewers.delete(v);
  v.content?.dispose?.();
}
function draw(G, v) {
  const w = Math.max(1, Math.round(v.el.clientWidth * dpr)), hh = Math.max(1, Math.round(v.el.clientHeight * dpr));
  if (v.canvas.width !== w || v.canvas.height !== hh) { v.canvas.width = w; v.canvas.height = hh; }
  G.renderer.setPixelRatio(1); G.renderer.setSize(w, hh, false);
  G.renderer.render(v.scene, v.camera);
  v.ctx.clearRect(0, 0, w, hh);
  v.ctx.drawImage(G.renderer.domElement, 0, 0, w, hh);
}
function kick() { if (!running && sectionVisible && viewers.size) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
function frame() {
  if (!sectionVisible || !viewers.size || document.hidden) { running = false; return; }
  const now = performance.now(); acc += Math.min((now - last) / 1000, 0.1); last = now;
  if (acc >= 1 / 30) {
    const step = acc; acc = 0;
    glPromise?.then((G) => {
      for (const v of viewers) {
        if (!v.near || !v.started || !v.scene) continue;
        const moving = v.tick ? v.tick(reduceMotion ? 0 : step) : false;
        if (moving || v.dirty) { draw(G, v); v.dirty = false; }
      }
    });
    // start loads for newly visible viewers
    for (const v of viewers) {
      if (v.near && !v.started && v.load) {
        v.started = true;
        v.load().catch((err) => { console.warn("threads: load failed", err); v.el.classList.add("th-nogl"); });
      }
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

// ---- contents
function mochiContent(v, id, mood) {
  const c = { disposed: false, face: mood.face, clip: mood.clip };
  let root3, mixer, action = null, faceMat = null, texIdx = {}, gltf = null, tx = new Map(), G, t = 0, blinkAt = 2 + Math.random() * 3, blinkUntil = 0;
  const applyTex = async (state) => {
    if (!faceMat || texIdx[state] == null) return;
    if (!tx.has(state)) { const tex = await gltf.parser.getDependency("texture", texIdx[state]); tex.colorSpace = G.THREE.SRGBColorSpace; tx.set(state, tex); }
    if (c.disposed) return;
    faceMat.map = tx.get(state); faceMat.needsUpdate = true; v.dirty = true;
  };
  c.setMood = (m) => { c.face = m.face; c.clip = m.clip; applyTex(m.face); playClip(m.clip); };
  function playClip(n) {
    if (!gltf || !mixer) return;
    const clip = gltf.animations.find((x) => x.name === n) || gltf.animations[0]; if (!clip) return;
    const next = mixer.clipAction(clip);
    if (action && action !== next) action.fadeOut(0.25);
    next.reset().fadeIn(0.25).play(); action = next; v.dirty = true;
  }
  v.load = async () => {
    G = await gl();
    gltf = await asset(G, `${ASSETS}mochi/${id}.glb`);
    if (c.disposed) return;
    root3 = G.SkeletonUtils.clone(gltf.scene);
    root3.traverse((n) => { if (n.isMesh && n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; } });
    texIdx = gltf.parser.json.materials.find((x) => x.name === "face")?.extras?.faceStates || {};
    const s = newScene(G); v.scene = s.scene; v.camera = s.camera;
    v.scene.add(root3);
    mixer = new G.THREE.AnimationMixer(root3);
    playClip(c.clip);
    mixer.update(reduceMotion ? 0.6 : 0);
    fitCamera(G, v.camera, root3, v.aspect, 0.02);
    if (c.face !== "neutral") applyTex(c.face);
    v.tick = (dt) => {
      t += dt;
      if (!reduceMotion && c.face === "neutral") {
        if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2 + Math.random() * 3; applyTex("blink"); }
        else if (blinkUntil && t > blinkUntil) { blinkUntil = 0; applyTex("neutral"); }
      }
      if (dt > 0) mixer.update(dt);
      return dt > 0;
    };
    v.dirty = true;
  };
  c.dispose = () => {
    c.disposed = true;
    if (mixer && root3) { mixer.stopAllAction(); mixer.uncacheRoot(root3); }
    faceMat?.dispose(); v.tick = null; v.scene = null;
  };
  v.content = c;
  return c;
}

function handContent(v, color, mood) {
  const c = { disposed: false, expr: mood.expr };
  let skin = null, meshes = [], G, root3, mixer;
  const applyMorphs = () => {
    const target = EXPRESSIONS[c.expr] || {};
    meshes.forEach((m) => { const d = m.morphTargetDictionary; for (const k in d) m.morphTargetInfluences[d[k]] = k === "shapeSphere" ? 1 : (target[k] || 0); });
    v.dirty = true;
  };
  c.setMood = (m) => { c.expr = m.expr; applyMorphs(); };
  v.load = async () => {
    G = await gl();
    const gltf = await asset(G, `${ASSETS}kamiji.glb`);
    if (c.disposed) return;
    root3 = G.SkeletonUtils.clone(gltf.scene);
    root3.traverse((n) => {
      if (!n.isMesh) return;
      const mat = n.material;
      if (HIDDEN_FACE.includes(mat.name)) n.visible = false;
      if (mat.name === "HandSkin") { skin = new G.THREE.MeshPhysicalMaterial({ color: new G.THREE.Color(color), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 }); n.material = skin; }
      if (n.morphTargetDictionary) meshes.push(n);
    });
    const s = newScene(G); v.scene = s.scene; v.camera = s.camera; v.scene.add(root3);
    mixer = new G.THREE.AnimationMixer(root3);
    const idle = gltf.animations.find((x) => x.name === "Idle"); if (idle) mixer.clipAction(idle).play();
    mixer.update(0.8); // the sphere keeps still, like the page hero
    applyMorphs();
    fitCamera(G, v.camera, root3, v.aspect, 0, true);
    v.tick = () => false;
    v.dirty = true;
  };
  c.dispose = () => { c.disposed = true; if (mixer && root3) { mixer.stopAllAction(); mixer.uncacheRoot(root3); } skin?.dispose(); v.tick = null; v.scene = null; };
  v.content = c;
  return c;
}

// A prop rendered once to a PNG data URL (cached). Only the 'Clay' material is tinted.
const snaps = new Map();
function snapshot(name, tint, px = 112) {
  const key = `${name}|${tint || ""}|${px}`;
  if (!snaps.has(key)) {
    snaps.set(key, (async () => {
      const G = await gl();
      const item = G.propIndex.find((p) => p.name === name); if (!item) throw new Error("no prop " + name);
      const gltf = await asset(G, `${ASSETS}props/${item.file}`);
      const rootN = gltf.scene.clone(true); const mats = [];
      rootN.traverse((n) => { if (n.isMesh) { n.material = n.material.clone(); mats.push(n.material); } });
      const clay = mats.filter((m) => m.name === "Clay");
      (clay.length ? clay : mats).forEach((m) => m.color.set(tint || item.tint));
      const pivot = new G.THREE.Group();
      rootN.position.sub(new G.THREE.Box3().setFromObject(rootN).getCenter(new G.THREE.Vector3()));
      pivot.add(rootN); pivot.rotation.y = 0.45;
      const s = newScene(G); s.scene.add(pivot);
      fitCamera(G, s.camera, pivot, 1, 0, true);
      G.renderer.setPixelRatio(1); G.renderer.setSize(px, px, false); G.renderer.render(s.scene, s.camera);
      const cv = document.createElement("canvas"); cv.width = cv.height = px;
      cv.getContext("2d").drawImage(G.renderer.domElement, 0, 0, px, px);
      mats.forEach((m) => m.dispose());
      return cv.toDataURL("image/png");
    })());
  }
  return snaps.get(key);
}
function propImg(name, size, cls = "") {
  const img = h("img", { class: "th-prop " + cls, alt: "", width: size, height: size, draggable: "false" });
  snapshot(name, null, Math.min(160, size * 3)).then((u) => { img.src = u; img.classList.add("on"); }).catch(() => img.setAttribute("hidden", ""));
  return img;
}

// ---------------------------------------------------------------- state
const state = {
  tab: "avatars", style: "mochi", mood: "running", emote: "heart", halo: false, haloList: ["heart", "sparkle", "star"],
  rail: "passed", cycle: false, layout: "current", layers: { kana: true, romaji: true, gloss: true },
  reacts: {}, notif: [],
};
let panelViewers = [];   // 3D avatars of the current panel
let railSlots = [];      // holders whose rail follows state.rail
let timers = [];

const TABS = [
  { id: "avatars", label: "Avatars", blurb: "Full-body mochi or the sphere Kamiji hand stand beside each message, unclipped, with a soft shadow. The lead agent is larger than its subagents.", lib: "kamiji-avatar, kamiji-mochi" },
  { id: "moods", label: "Moods and status", blurb: "The conversation status drives the face and the motion: working walks, needs-you looks surprised, done jumps for joy, an error is sad, idle sits and blinks. A 3D prop sits beside the avatar.", lib: "kamiji-avatar (expressions), kamiji-mochi (face states and clips)" },
  { id: "emotes", label: "Emotes and halo", blurb: "A small emote floats by the avatar. The halo arranges up to three emoji around the head. Pick emoji below; the lead agent shows them, subagents keep one each.", lib: "kamiji-emote, kamiji-halo, kamiji-emoji-character" },
  { id: "reactions", label: "Reactions", blurb: "A reaction bar sits under agent messages. Press a reaction to add yours and see a small burst; the notification row above the thread reports it.", lib: "kamiji-reactions" },
  { id: "git", label: "Git and status icons", blurb: "A metadata rail in the thread header and in each agent message: pull request or commit, status, branch, short sha, files changed and a +/- diff bar. Pick a state or let it cycle.", lib: "kamiji-git-icon" },
  { id: "layouts", label: "Thread layouts", blurb: "The same conversation in the six feed styles from the OpenHands mock: Current, Compact, Agent accent, Tinted, Thread and Chat bubbles.", lib: "feed cards in OpenHands (src/routes/mock-feed-styles.tsx)" },
  { id: "subtitles", label: "Subtitle stack", blurb: "Yakopop-style word columns: reading, romaji and meaning under each word, particles in grey, the English line below. Agents can speak in a language-learning thread.", lib: "site/kamikin/chat.js (prototype, not in src/ yet)" },
];

// ---------------------------------------------------------------- rail
const RAIL_STATES = {
  running: { label: "Running", tone: "run" },
  passed: { label: "Checks passed", tone: "ok" },
  failed: { label: "2 checks failed", tone: "bad" },
  merged: { label: "Merged", tone: "merged" },
};
function makeRail(key, stateKey, compact) {
  const r = RAILS[key];
  const sKey = r.fixed || (stateKey === "merged" && key === "kon" ? "merged" : stateKey);
  const st = RAIL_STATES[sKey];
  const kind = r.kind || (sKey === "running" ? "commit" : sKey === "merged" ? "merge" : "pullRequest");
  const kindText = kind === "commit" ? "Commit" : `PR #${r.pr}`;
  const total = r.add + r.del;
  const greens = total ? Math.max(1, Math.round((5 * r.add) / total)) : 0;
  const reds = total ? Math.min(5 - greens, Math.max(r.del ? 1 : 0, 5 - greens)) : 0;
  const bar = h("span", { class: "th-bar", "aria-hidden": "true" });
  for (let i = 0; i < 5; i++) bar.append(h("i", { class: i < greens ? "g" : i < greens + reds ? "r" : "n" }));
  const statusIcon = sKey === "running" ? spinIcon(14) : sKey === "passed" ? icon("pass", 14) : sKey === "failed" ? icon("error", 14) : icon("merge", 14);
  const diffText = total ? `${r.add} additions, ${r.del} deletions` : "no code changes";
  const el = h("div", { class: "th-rail" + (compact ? " th-rail-c" : ""), role: "group", "aria-label": `Changes: ${kindText}, ${st.label}, ${diffText}, ${r.files} file${r.files === 1 ? "" : "s"}, branch ${r.branch}, commit ${r.sha}` },
    h("span", { class: "th-r th-r-kind" + (kind === "merge" ? " th-t-merged" : "") }, icon(kind, 14), kindText),
    h("span", { class: `th-r th-r-status th-t-${st.tone}` }, statusIcon, st.label),
    h("span", { class: "th-r th-r-diff" }, total ? [h("b", { class: "add" }, `+${r.add}`), h("b", { class: "del" }, `−${r.del}`), bar] : [h("span", { class: "th-note" }, r.note || "no diff")]),
    h("span", { class: "th-r" }, icon("files", 14), `${r.files} file${r.files === 1 ? "" : "s"}`),
    h("span", { class: "th-r th-r-br" }, icon("branch", 14), h("span", { class: "th-br" }, r.branch)),
    h("code", { class: "th-sha" }, r.sha));
  return el;
}
function railHolder(key, compact) {
  const holder = h("div", { class: "th-railwrap" });
  const make = () => makeRail(key, state.rail, compact);
  holder.append(make());
  railSlots.push({ holder, make });
  return holder;
}
function refreshRails() { railSlots.forEach((s) => s.holder.replaceChildren(s.make())); const lv = document.getElementById("th-live"); if (lv) lv.textContent = `Status: ${RAIL_STATES[state.rail].label}`; }

// ---------------------------------------------------------------- avatar
function avatar(who, big, cfg, mood, id) {
  const c = CAST[who];
  if (who === "you") return h("div", { class: "th-av th-av-you", role: "img", "aria-label": "You" }, personIcon(big ? 30 : 26));
  const useHand = state.style === "hand";
  const size = big ? "lg" : "sm";
  const el = h("div", { class: `th-av th-av-${size}`, role: "img", "aria-label": `${c.name}, ${c.role}${cfg.mood ? ", " + MOODS[mood].label.toLowerCase() : ""}`, "data-who": who },
    h("span", { class: "th-av-sh", "aria-hidden": "true" }),
    h("canvas", { "aria-hidden": "true" }),
    h("span", { class: "th-av-fb", "aria-hidden": "true" }, c.name[0]));
  const v = makeViewer(el, 0.8);
  if (useHand) handContent(v, c.hand, MOODS[mood]); else mochiContent(v, c.mochi, MOODS[mood]);
  panelViewers.push({ v, who, id });
  return el;
}
// floating prop(s) next to the avatar
function floaters(m, big) {
  const out = [];
  if (m.t === "human") return out;
  if (state.tab === "moods") out.push(h("span", { class: "th-fl th-fl-tr" }, propImg(MOODS[moodOf(m)].prop, big ? 34 : 26)));
  if (state.tab === "emotes") {
    if (m.who === "pip" && state.halo) {
      state.haloList.slice(-3).forEach((n, i) => out.push(h("span", { class: `th-fl th-halo-${i}` }, propImg(n, 28))));
    } else {
      out.push(h("span", { class: "th-fl th-fl-tr" }, propImg(m.who === "pip" ? state.emote : m.emote, big ? 34 : 26)));
    }
  }
  if (state.tab === "git" && m.who === "pip") {
    const p = { running: "gear", passed: "pull_request", failed: "warning", merged: "merge" }[state.rail];
    out.push(h("span", { class: "th-fl th-fl-tr", "data-gitbadge": "" }, propImg(p, 34)));
  }
  return out;
}
const moodOf = (m) => (state.tab === "moods" && m.id === "p1" ? state.mood : m.mood || "idle");

// ---------------------------------------------------------------- reactions
const REACTION_SET = ["heart", "star", "fire", "sparkle", "check", "lightbulb"];
const REACTION_MORE = ["question", "music_note", "sweat", "tear", "anger", "clock"];
const prettyName = (n) => n.replace(/_/g, " ");
function reactionBar(msgId) {
  const seeds = { p1: { heart: [3, false], star: [1, false], sparkle: [2, false] }, n2: { check: [2, false], fire: [1, false] }, p2: { heart: [5, false], sparkle: [3, false], lightbulb: [1, false] } };
  const counts = state.reacts[msgId] || (state.reacts[msgId] = seeds[msgId] || {});
  const bar = h("div", { class: "th-reacts", role: "group", "aria-label": "Reactions" });
  const burst = h("span", { class: "th-burst", "aria-hidden": "true" });
  const more = h("div", { class: "th-more", role: "group", "aria-label": "More reactions", hidden: true });
  const add = h("button", { type: "button", class: "th-radd", "aria-expanded": "false", "aria-label": "Add a reaction", onclick: () => { more.hidden = !more.hidden; add.setAttribute("aria-expanded", String(!more.hidden)); } }, "+");
  const chip = (n) => {
    const [cnt, mine] = counts[n] || [0, false];
    const b = h("button", { type: "button", class: "th-react", "aria-pressed": String(mine), "aria-label": `${prettyName(n)}, ${cnt}` }, propImg(n, 22), h("span", { class: "th-rc" }, String(cnt)));
    b.addEventListener("click", () => {
      const cur = counts[n] || [0, false];
      counts[n] = cur[1] ? [cur[0] - 1, false] : [cur[0] + 1, true];
      if (!counts[n][0]) delete counts[n];
      if (counts[n]?.[1]) { spawnBurst(burst, n); pushNotif(n, msgId); }
      rebuild();
      live(`${prettyName(n)} ${counts[n] ? counts[n][1] ? "added" : "removed" : "removed"}`);
    });
    return b;
  };
  function rebuild() {
    const shown = [...REACTION_SET.filter((n) => counts[n]), ...Object.keys(counts).filter((n) => !REACTION_SET.includes(n))];
    bar.replaceChildren(...shown.map(chip), add, burst);
    more.replaceChildren(...[...REACTION_SET, ...REACTION_MORE].filter((n) => !counts[n]).map((n) => h("button", { type: "button", class: "th-react th-react-ghost", "aria-label": `React with ${prettyName(n)}`, onclick: () => { counts[n] = [1, true]; spawnBurst(burst, n); pushNotif(n, msgId); more.hidden = true; add.setAttribute("aria-expanded", "false"); rebuild(); live(`${prettyName(n)} added`); } }, propImg(n, 22))));
  }
  rebuild();
  return h("div", { class: "th-reactwrap" }, bar, more);
}
function spawnBurst(host, name) {
  if (reduceMotion) return;
  for (let i = 0; i < 5; i++) {
    const img = propImg(name, 20, "th-bit");
    img.style.setProperty("--dx", `${(i - 2) * 14 + Math.round(Math.random() * 8)}px`);
    img.style.animationDelay = `${i * 40}ms`;
    img.addEventListener("animationend", () => img.remove());
    host.append(img);
  }
}
function pushNotif(name, msgId) {
  const to = msgId === "p2" ? "Pip's last message" : msgId === "n2" ? "Kon's patch note" : "Pip's message";
  state.notif.unshift({ name, text: `You reacted ${prettyName(name)} to ${to}`, t: "now" });
  state.notif = state.notif.slice(0, 3);
  const box = document.getElementById("th-notifs"); if (box) box.replaceChildren(...notifRows());
}
function notifRows() {
  const base = [{ name: "heart", text: "Hana reacted heart to your message", t: "2 min" }, { name: "sparkle", text: "Pip reacted sparkle to Kon's patch note", t: "5 min" }];
  return [...state.notif, ...base].slice(0, 3).map((n, i) => h("li", { class: "th-notif" + (i === 0 && state.notif.length ? " fresh" : "") }, propImg(n.name, 24), h("span", { class: "th-nt" }, n.text), h("time", null, n.t)));
}
function live(t) { const lv = document.getElementById("th-live"); if (lv) lv.textContent = t; }

// ---------------------------------------------------------------- subtitle stack
function stackFor(id) {
  const s = STACKS[id]; if (!s) return null;
  const words = h("div", { class: "th-words" }, s.w.map(([jp, ro, gl, part]) => h("span", { class: "th-tok" + (part ? " th-part" : "") }, h("span", { class: "th-s" }, jp), h("span", { class: "th-ro" }, ro), h("span", { class: "th-g" }, gl || " "))));
  return h("div", { class: "th-stack", lang: "ja" }, words, h("p", { class: "th-en", lang: "en" }, s.en));
}

// ---------------------------------------------------------------- messages
function renderMsg(m, cfg) {
  if (m.t === "sys") return h("li", { class: "th-sys" }, h("span", null, m.text));
  const isHuman = m.t === "human";
  const mood = isHuman ? "idle" : moodOf(m);
  const big = !m.sub;
  const li = h("li", { class: `th-m th-m-${isHuman ? "human" : "agent"}${m.sub ? " th-m-sub" : ""}`, "data-who": m.who, "data-id": m.id });
  const gut = h("div", { class: "th-gut" }, avatar(m.who, big, cfg, mood, m.id), floaters(m, big));
  const status = cfg.mood && !isHuman ? h("span", { class: `th-chip th-st-${mood}` }, MOODS[mood].label) : null;
  const meta = h("div", { class: "th-meta" }, h("b", { class: "th-name" }, CAST[m.who].name), CAST[m.who].role ? h("span", { class: "th-role" }, CAST[m.who].role) : null, status, h("time", null, m.time));
  const body = h("div", { class: "th-body" }, meta, cfg.stack && STACKS[m.id] ? stackFor(m.id) : h("p", { class: "th-text" }, m.text));
  if (m.rail) body.append(railHolder(m.rail, !!m.sub));
  if (cfg.react && !isHuman && (m.id === "p1" || m.id === "n2" || m.id === "p2")) body.append(reactionBar(m.id));
  if (m.kids) {
    const ol = h("ol", { class: "th-sublist", "aria-label": "Subagent thread" });
    m.kids.forEach((x) => ol.append(renderMsg(x, cfg)));
    body.append(ol);
  }
  li.append(gut, body);
  return li;
}

function renderThread(cfg) {
  railSlots = [];
  const head = h("header", { class: "th-head" },
    h("div", { class: "th-head-t" }, h("h4", null, "Fix flaky upload test"), h("span", { class: "badge plan" }, "prototype")),
    railHolder("head", false));
  const ol = h("ol", { class: "th-thread", "data-layout": cfg.layout || "current", "aria-label": "Demo conversation" });
  THREAD.forEach((m) => ol.append(renderMsg(m, cfg)));
  const frame = h("div", { class: "th-frame" + (state.tab === "emotes" ? " th-has-halo" : ""), role: "region", "aria-label": "Demo conversation, made up text" }, head, ol);
  return frame;
}

// ---------------------------------------------------------------- controls per tab
function chipRow(label, items, current, onPick, opts = {}) {
  const row = h("div", { class: "th-ctl" }, h("span", { class: "lbl", id: "lbl-" + label.replace(/\W/g, "") }, label));
  const g = h("div", { class: "pills", role: "group", "aria-labelledby": "lbl-" + label.replace(/\W/g, "") });
  items.forEach(([val, text, prop]) => {
    const b = h("button", { type: "button", class: "pill th-pill", "aria-pressed": String(val === current), onclick: () => { onPick(val); if (!opts.multi) g.querySelectorAll(".pill").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); } }, prop ? propImg(prop, 18, "th-pillimg") : null, text);
    g.append(b);
  });
  row.append(g);
  return row;
}

function controlsFor(tab) {
  const wrap = h("div", { class: "th-controls" });
  if (tab === "avatars") {
    wrap.append(chipRow("Avatar", [["mochi", "Mochi"], ["hand", "Sphere hand"]], state.style, (v) => { state.style = v; renderPanel(); }));
  } else if (tab === "moods") {
    wrap.append(chipRow("Lead status", Object.entries(MOODS).map(([k, m]) => [k, m.label, m.prop]), state.mood, (v) => {
      state.mood = v;
      const m = MOODS[v];
      panelViewers.filter((p) => p.id === "p1").forEach((p) => p.v.content.setMood(m));
      document.querySelectorAll('.th-m[data-id="p1"] .th-chip').forEach((c) => { c.textContent = m.label; c.className = `th-chip th-st-${v}`; });
      document.querySelectorAll('.th-m[data-id="p1"] .th-fl-tr').forEach((s) => s.replaceChildren(propImg(m.prop, 34)));
      document.querySelectorAll('.th-m[data-id="p1"] .th-av').forEach((a) => a.setAttribute("aria-label", `Pip, lead agent, ${m.label.toLowerCase()}`));
      live(`Lead status: ${m.label}`);
    }));
  } else if (tab === "emotes") {
    const names = ["heart", "sparkle", "star", "lightbulb", "fire", "question", "check", "music_note"];
    const row = chipRow("Emoji", names.map((n) => [n, prettyName(n), n]), state.halo ? "" : state.emote, (v) => {
      state.emote = v;
      state.haloList = state.haloList.filter((x) => x !== v).concat(v).slice(-3);
      renderPanel(true);
    }, { multi: true });
    wrap.append(row, chipRow("Arrangement", [["single", "Single emote"], ["halo", "Halo (3)"]], state.halo ? "halo" : "single", (v) => { state.halo = v === "halo"; renderPanel(true); }));
  } else if (tab === "git") {
    wrap.append(chipRow("State", Object.entries(RAIL_STATES).map(([k, s]) => [k, { running: "Running", passed: "Passed", failed: "Failed", merged: "Merged" }[k]]), state.rail, (v) => { state.rail = v; syncGit(); }));
    const cyc = h("button", { type: "button", class: "pill th-pill th-cyc", "aria-pressed": String(state.cycle), disabled: reduceMotion ? true : null, onclick: () => { state.cycle = !state.cycle; cyc.setAttribute("aria-pressed", String(state.cycle)); startCycle(); } }, reduceMotion ? "Auto-cycle (paused, reduced motion)" : "Auto-cycle");
    wrap.append(h("div", { class: "th-ctl" }, h("span", { class: "lbl" }, "Cycle"), h("div", { class: "pills" }, cyc)));
    wrap.append(h("div", { class: "th-key", "aria-label": "Icon key" }, ...[["commit", "commit"], ["pullRequest", "pull request"], ["merge", "merge"], ["pass", "pass"], ["error", "error"]].map(([k, t]) => h("span", { class: "th-keyi th-k-" + k }, icon(k, 16), t))));
  } else if (tab === "layouts") {
    const L = [["current", "Current"], ["compact", "Compact"], ["accent", "Agent accent"], ["tinted", "Tinted"], ["thread", "Thread"], ["bubbles", "Chat bubbles"]];
    wrap.append(chipRow("Style", L, state.layout, (v) => { state.layout = v; const t = document.querySelector(".th-thread"); if (t) t.dataset.layout = v; }));
  } else if (tab === "subtitles") {
    const row = h("div", { class: "th-ctl" }, h("span", { class: "lbl" }, "Layers"));
    const g = h("div", { class: "pills", role: "group", "aria-label": "Subtitle layers" });
    [["kana", "Kana"], ["romaji", "Romaji"], ["gloss", "Meaning"]].forEach(([k, t]) => {
      const b = h("button", { type: "button", class: "pill th-pill", "aria-pressed": String(state.layers[k]), onclick: () => {
        const on = Object.values(state.layers).filter(Boolean).length;
        if (state.layers[k] && on === 1) return; // keep one layer on
        state.layers[k] = !state.layers[k]; b.setAttribute("aria-pressed", String(state.layers[k])); applyLayers();
      } }, t);
      g.append(b);
    });
    row.append(g); wrap.append(row);
  }
  return wrap;
}
function applyLayers() { const t = document.querySelector(".th-thread"); if (!t) return; for (const k in state.layers) t.dataset[k] = state.layers[k] ? "1" : "0"; }

function syncGit() {
  refreshRails();
  document.querySelectorAll('[data-gitbadge]').forEach((s) => s.replaceChildren(propImg({ running: "gear", passed: "pull_request", failed: "warning", merged: "merge" }[state.rail], 34)));
  const pills = document.querySelectorAll(".th-controls .th-ctl:first-child .pill");
  const keys = Object.keys(RAIL_STATES);
  pills.forEach((p, i) => p.setAttribute("aria-pressed", String(keys[i] === state.rail)));
}
function startCycle() {
  timers.filter((t) => t.kind === "cycle").forEach((t) => clearInterval(t.id));
  timers = timers.filter((t) => t.kind !== "cycle");
  if (!state.cycle || reduceMotion) return;
  const order = Object.keys(RAIL_STATES);
  timers.push({ kind: "cycle", id: setInterval(() => {
    if (!sectionVisible || document.hidden) return;
    state.rail = order[(order.indexOf(state.rail) + 1) % order.length]; syncGit();
  }, 2400) });
}

// ---------------------------------------------------------------- shell
const panelHost = h("div", { class: "th-panel", id: "th-panel", role: "tabpanel", tabindex: "0" });
function renderPanel(keepScroll) {
  const t = TABS.find((x) => x.id === state.tab);
  panelViewers.forEach((p) => destroyViewer(p.v)); panelViewers = [];
  timers.filter((x) => x.kind === "cycle").forEach((x) => clearInterval(x.id)); timers = [];
  panelHost.setAttribute("aria-labelledby", "th-tab-" + t.id);
  const cfg = {
    mood: t.id === "moods", react: t.id === "reactions", stack: t.id === "subtitles", layout: t.id === "layouts" ? state.layout : "current",
  };
  const stackNote = t.id === "subtitles" ? h("p", { class: "th-quiet" }, "Japanese lines are hand written and not checked by a native speaker.") : null;
  const notif = t.id === "reactions" ? h("ul", { class: "th-notifs", id: "th-notifs", "aria-label": "Notifications" }, notifRows()) : null;
  const frame = renderThread(cfg);
  panelHost.replaceChildren(
    h("div", { class: "th-phead" }, h("h3", null, t.label), h("span", { class: "badge plan" }, "prototype")),
    h("p", { class: "th-blurb" }, t.blurb),
    h("p", { class: "th-lib" }, "Library: ", h("code", null, t.lib)),
    ...[controlsFor(t.id), notif, frame, stackNote].filter(Boolean));
  if (t.id === "subtitles") applyLayers();
  if (t.id === "git") startCycle();
  kick();
}

function build() {
  if (!root) return;
  const tabs = h("div", { class: "th-tabs", role: "tablist", "aria-label": "UI component libraries", "aria-orientation": "vertical" });
  const btns = TABS.map((t, i) => {
    const b = h("button", { type: "button", role: "tab", id: "th-tab-" + t.id, class: "th-tab", "aria-selected": String(t.id === state.tab), "aria-controls": "th-panel", tabindex: t.id === state.tab ? "0" : "-1", onclick: () => select(i, false) }, h("span", { class: "th-tabn" }, String(i + 1).padStart(2, "0")), t.label);
    return b;
  });
  tabs.append(...btns);
  function select(i, focus) {
    state.tab = TABS[i].id;
    btns.forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    if (focus) btns[i].focus();
    renderPanel();
  }
  tabs.addEventListener("keydown", (e) => {
    const cur = btns.indexOf(document.activeElement); if (cur < 0) return;
    let n = cur;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (cur + 1) % btns.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (cur - 1 + btns.length) % btns.length;
    else if (e.key === "Home") n = 0; else if (e.key === "End") n = btns.length - 1; else return;
    e.preventDefault(); select(n, true);
  });

  const lay = h("div", { class: "th-lay" }, h("div", { class: "th-nav" }, tabs), panelHost);
  const work = workStrip();
  root.replaceChildren(lay, h("p", { class: "visually-hidden th-sr", id: "th-live", role: "status", "aria-live": "polite" }), work);
  renderPanel();

  new IntersectionObserver((es) => { sectionVisible = es[es.length - 1].isIntersecting; if (sectionVisible) kick(); }, { rootMargin: "100px" }).observe(root);
  addEventListener("pagehide", () => { panelViewers.forEach((p) => destroyViewer(p.v)); });
  gl().catch((err) => { console.warn("threads: 3D unavailable", err); root.classList.add("th-nogl-all"); document.querySelectorAll(".th-av").forEach((a) => a.classList.add("th-nogl")); });
}

function workStrip() {
  const groups = [
    ["Pages", [
      ["index.html", "Kamiji (this page)", "Hand, mochi and props gallery, and these demos."],
      ["kamikin/index.html", "Kamikin", "14 mochi, with the scripted Japanese chat and subtitle stack."],
      ["hands/index.html", "Hands", "The little-hand page for the Hands agent platform."],
      ["kosmos/index.html", "Kosmos engine", "Reality Kosmos Engine, an experimental Rust 3D engine."],
      ["kosmos-computer/index.html", "Kosmos computer", "A generative AI operating system and its UI library."],
    ]],
    ["Studios", [
      ["workshop/hand.html", "Hand studio", "Build a Kamiji hand: tint, face, pose, shape, halo."],
      ["workshop/kamikin.html", "Kamikin studio", "Pick one of 14 mochi, then face, clip, tint."],
      ["workshop/emoji.html", "Emoji studio", "Make a character from a 3D emoji face."],
    ]],
    ["Docs", [
      ["../docs/history.md", "History", "How Kamiji grew out of earlier face and avatar engines."],
      ["../docs/kamikin-chat.md", "Kamikin chat notes", "The chat modal and subtitle stack, and what they borrow."],
      ["../docs/plans/01-integrations.md", "Plan 01: integrations", "Using Kamiji in open-source chat and IDE products."],
      ["../docs/plans/02-emoji-library-and-mochi.md", "Plan 02: emoji and mochi", "The 3D emoji library and the Kamikin port."],
      ["../docs/plans/03-kosmos-tts-anime-voices.md", "Plan 03: voices", "Text to speech and anime voices for characters."],
      ["../docs/plans/04-face-rig-options.md", "Plan 04: face rigs", "Selectable face rigs over the 3D characters."],
    ]],
  ];
  const el = h("div", { class: "th-work", role: "region", "aria-labelledby": "th-work-h" }, h("h3", { id: "th-work-h" }, "See all our work"),
    h("div", { class: "th-work-g" }, groups.map(([title, items]) => h("section", { class: "th-wg", "aria-label": title },
      h("p", { class: "mono-h" }, title),
      h("ul", null, items.map(([href, name, line]) => h("li", null, h("a", { href }, name), h("span", null, line))))))));
  return el;
}

build();
