// Kamiji home page chat widget (prototype).
//  - A floating Kamikin mochi (assets/mochi/<id>.glb, one random pick per page load) in the lower right, a real <button>,
//    with a tiny speech-bubble glyph on its corner so it still reads as "chat".
//  - Click: a right-side drawer with a SCRIPTED conversation about Kamiji. No AI model, no API key, no network
//    for the chat itself. The only network use is optional: audio, only after the user turns it on, uses the shared
//    voice layer (voice.js): the browser's system voice by default, the local better-voice server if chosen.
//  - The mochi and the header avatar (the SAME mochi) are lazy: three.js and the one picked GLB load when the page is
//    idle, a WebGL failure leaves a flat tinted circle with two eyes.
// Loading, posing and face swapping follow site/main.js mochiContent() and site/kamikin/kamikin.js (skinned GLB, face
// state textures from the "face" material extras, clips idle/wave/happy). Mochi are drawn without an ink outline, as
// everywhere else on the site. 30 fps, pause off-screen/hidden/drawer open, reduced motion = one static frame.
// Audio: docs/kamikin-chat.md and voice.js.

import { createVoice, settings } from "./voice.js";
import { mountVoiceSettings } from "./voice-settings.js";
import { createCaptions } from "./captions.js";

const MOCHI_DIR = "../assets/mochi/";
const BUBBLE_URL = "../assets/props/symbols/speech_bubble.glb";
const YELLOW = "#ffd23f";
const INK = "#1d2a20";
const FPS = 30;
const LS_AUDIO = "kamiji.chat.audio";
const LS_SEEN = "kamiji.chat.seen";
const SS_PICK = "kamiji.chat.mochi";

// The 14 characters of assets/mochi/index.json (same cast as site/kamikin/kamikin.js) and a flat tint for the no-WebGL
// fallback circle (the body colour as rendered, sampled once from the live models).
const MOCHI_TINT = {
  "kamikin-player": "#6898a8", "kamikin-pip": "#e86818", "kamikin-shizuku": "#88b8c8", "kamikin-hana": "#c87838",
  "kamikin-koke": "#98b858", "kamikin-kumo": "#a888c8", "kamikin-chochin": "#e89838", "kamikin-kon": "#f8d8b8",
  "kamikin-player-bunny-3": "#e88898", "kamikin-player-cat-5": "#2b2628", "kamikin-player-chick-6": "#e8b818",
  "kamikin-player-hamster-4": "#c8a878", "kamikin-player-panda-2": "#f8d8c8", "kamikin-player-pup-8": "#f5d252",
};
const MOCHI_IDS = Object.keys(MOCHI_TINT);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileMQ = matchMedia("(max-width: 700px)");

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// A random mochi per page load, never the same one twice in a row within a tab session.
// "?mochi=<id>" (e.g. ?mochi=kamikin-pip) pins one for previews and tests.
function pickMochi() {
  try { const q = new URLSearchParams(location.search).get("mochi"); if (q && MOCHI_IDS.includes(q)) return q; } catch { /* no URL params */ }
  let prev = null;
  try { prev = sessionStorage.getItem(SS_PICK); } catch { /* storage blocked */ }
  const pool = MOCHI_IDS.filter((id) => id !== prev);
  const id = pool[Math.floor(Math.random() * pool.length)];
  try { sessionStorage.setItem(SS_PICK, id); } catch { /* storage blocked */ }
  return id;
}
const mochi = { id: pickMochi(), name: "", species: "" };
const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const mochiName = () => cap(mochi.name) || "Kamiji";

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
function whenIdle() {
  return new Promise((res) => {
    const go = () => ("requestIdleCallback" in window ? requestIdleCallback(res, { timeout: 3000 }) : setTimeout(res, 800));
    if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
  });
}
const el = (tag, cls, attrs) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

// ---------------------------------------------------------------------------------------------
// mochi data and three.js, loaded once on demand
// ---------------------------------------------------------------------------------------------
let indexP = null;
const mochiIndex = () => {
  if (!indexP) {
    indexP = fetch(`${MOCHI_DIR}index.json`).then((r) => r.json()).then((j) => {
      const m = (j.characters || []).find((c) => c.id === mochi.id);
      if (m) { mochi.name = m.name || ""; mochi.species = m.species || ""; }
    }).catch(() => { /* names fall back to "Kamiji" */ }).then(() => applyName());
  }
  return indexP;
};

let libP = null;
function loadLib() {
  if (!libP) {
    libP = (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
      return { THREE, loader: new GLTFLoader(), SkeletonUtils };
    })();
    libP.catch(() => { libP = null; });
  }
  return libP;
}
let gltfP = null; // only the picked mochi is ever fetched, and once, for both the launcher and the avatar
const loadMochi = (lib) => {
  if (!gltfP) { gltfP = lib.loader.loadAsync(`${MOCHI_DIR}${mochi.id}.glb`); gltfP.catch(() => { gltfP = null; }); }
  return gltfP;
};

// Same lighting as the mochi viewers in main.js / kamikin.js: hemisphere + one key light, transparent canvas.
function makeStage(lib, canvas, fov) {
  const { THREE } = lib;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
  const key = new THREE.DirectionalLight(0xffefd2, 1.8);
  key.position.set(-1.5, 2, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 50);
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  };
  const dispose = () => {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    renderer.dispose(); renderer.forceContextLoss();
  };
  return { renderer, scene, camera, resize, dispose };
}

// One skinned mochi: face-state textures, idle loop, one-shot clips. `onFace` fires when a new face texture is on.
function mochiRig(lib, gltf, onFace) {
  const { THREE, SkeletonUtils } = lib;
  const root = SkeletonUtils.clone(gltf.scene);
  let faceMat = null;
  root.traverse((n) => { if (n.isMesh && n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; } });
  const texIdx = gltf.parser.json.materials.find((x) => x.name === "face")?.extras?.faceStates || {};
  const texP = new Map();
  let want = "neutral";
  const texture = (state) => {
    if (!texP.has(state)) texP.set(state, gltf.parser.getDependency("texture", texIdx[state]).then((t) => { t.colorSpace = THREE.SRGBColorSpace; return t; }));
    return texP.get(state);
  };
  const mixer = new THREE.AnimationMixer(root);
  const clip = (n) => gltf.animations.find((c) => c.name === n);
  const idle = mixer.clipAction(clip("idle") || gltf.animations[0]);
  idle.play();
  let once = null;
  const rig = {
    root, mixer, waving: false,
    setFace(state) {
      if (state === want || texIdx[state] == null || !faceMat) return;
      want = state;
      texture(state).then((tex) => { if (want !== state) return; faceMat.map = tex; faceMat.needsUpdate = true; onFace?.(); });
    },
    preload() { for (const s of ["blink", "happy", "joy", "surprised", "sad"]) if (texIdx[s] != null) texture(s); },
    playOnce(name) {
      const c = clip(name);
      if (!c || once) return false;
      once = mixer.clipAction(c);
      once.reset().setLoop(THREE.LoopOnce, 1);
      once.clampWhenFinished = true;
      once.fadeIn(0.2).play();
      idle.fadeOut(0.2);
      rig.waving = true;
      const done = (e) => {
        if (e.action !== once) return;
        mixer.removeEventListener("finished", done);
        idle.reset().fadeIn(0.25).play();
        once.fadeOut(0.25);
        once = null; rig.waving = false;
      };
      mixer.addEventListener("finished", done);
      return true;
    },
    // Put the feet at the origin; returns the size of the settled pose.
    ground(size) {
      mixer.update(reduce ? 0.5 : 0.01);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -box.min.y, -c.z);
      return box.getSize(size || new THREE.Vector3());
    },
  };
  return rig;
}

// ---------------------------------------------------------------------------------------------
// The floating mochi button
// ---------------------------------------------------------------------------------------------
const flatSvg = (cls) => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<circle cx="32" cy="34" r="26" fill="${MOCHI_TINT[mochi.id]}"/><ellipse cx="22.5" cy="33" rx="3.1" ry="4" fill="#2a1d1a"/><ellipse cx="41.5" cy="33" rx="3.1" ry="4" fill="#2a1d1a"/></svg>`;
const GLYPH_SVG = `<svg class="kj-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<path d="M6 5h20a4.5 4.5 0 0 1 4.5 4.5v9A4.5 4.5 0 0 1 26 23h-9l-7 6v-6H6a4.5 4.5 0 0 1-4.5-4.5v-9A4.5 4.5 0 0 1 6 5z" fill="${YELLOW}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
<circle cx="9.5" cy="14" r="1.9" fill="${INK}"/><circle cx="16" cy="14" r="1.9" fill="${INK}"/><circle cx="22.5" cy="14" r="1.9" fill="${INK}"/></svg>`;

const fab = el("button", "kj-fab", {
  type: "button", id: "kj-fab", "aria-label": "Chat with Kamiji", title: "Chat with Kamiji", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": "kj-chat",
  "data-mochi": mochi.id,
});
fab.innerHTML = flatSvg("kj-flat") + GLYPH_SVG;
const dot = el("span", "kj-dot", { "aria-hidden": "true" });
dot.textContent = "1";
if (lsGet(LS_SEEN)) dot.hidden = true;
fab.append(dot);
document.body.append(fab);

// The accessible name stays "Chat with Kamiji"; the tooltip and the drawer title carry the mochi's name.
function applyName() {
  fab.title = mochi.name ? `Chat with ${mochiName()}` : "Chat with Kamiji";
  fab.dataset.mochiName = mochiName();
  if (ui) { ui.title.textContent = drawerTitle(); }
}
const drawerTitle = () => mochiName();

const spring = (u) => (u <= 0 ? 0 : 1 - Math.exp(-7 * u) * Math.cos(11 * u));
const squash = (u) => (u <= 0 ? 0 : 0.28 * Math.exp(-6 * u) * Math.sin(16 * u));

const launcher = { pop: () => {}, kick: () => {} };

async function startLauncher() {
  const lib = await loadLib();
  const { THREE } = lib;
  // The chat bubble prop is optional: without it the CSS glyph stays.
  const [gltf, bubbleGltf] = await Promise.all([loadMochi(lib), lib.loader.loadAsync(BUBBLE_URL).catch(() => null), mochiIndex()]);
  const canvas = el("canvas", null, { "aria-hidden": "true" });
  fab.prepend(canvas);
  let stage;
  try { stage = makeStage(lib, canvas, 24); } catch (err) { canvas.remove(); throw err; }
  const { scene, camera, renderer } = stage;

  let ready = false, dead = false;
  const rig = mochiRig(lib, gltf, () => { if (ready && !running()) draw(); });
  rig.preload();
  const size = rig.ground();
  const sway = new THREE.Group(); // origin at the feet: squash and jump happen around the ground
  sway.add(rig.root);
  scene.add(sway);
  // Frame. The canvas is bigger than the button (CSS: extra transparent room above and to the left, pointer-events none),
  // so the jump arc, the squash/stretch overshoot and the bubble never touch its edge. E0 is the world height that maps to
  // the 88 px button (the mochi's own footprint is unchanged); the camera is derived from the real canvas size on resize.
  const E0 = Math.max(size.x, size.y) * 1.3;
  const unit = size.y;
  const fit = () => {
    const cw = canvas.clientWidth, ch = canvas.clientHeight, fw = fab.clientWidth;
    if (!cw || !ch || !fw) return;
    const k = fw / E0, cr = canvas.getBoundingClientRect(), fr = fab.getBoundingClientRect();
    const dx = (fr.left + fr.width / 2) - (cr.left + cr.width / 2);
    const camX = -dx / k, camY = ch / k / 2 - 0.03 * E0;
    camera.position.set(camX, camY, (ch / k / 2) / Math.tan(THREE.MathUtils.degToRad(12)));
    camera.lookAt(camX, camY, 0);
  };

  // The speech_bubble.glb prop: local +z is its front, the tail is the spike at the lower LEFT of its lower edge (tip at
  // about (-0.41, -0.47) for a unit-wide body). It is mirrored with scale.x = -1 (the three dots are symmetric, so they
  // read the same; three.js flips the winding for a negative determinant) so the tail points to the lower RIGHT, then
  // rotated about z until the tail direction points exactly at the mochi's head.
  let bubble = null;
  const bubSize = 0.3 * E0, bubBase = new THREE.Vector3(-0.38 * E0, 0.8 * E0, 0);
  if (bubbleGltf) {
    const prop = lib.SkeletonUtils.clone(bubbleGltf.scene);
    prop.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone();
      if (n.material.name === "Clay") { n.material = new THREE.MeshPhysicalMaterial({ color: YELLOW, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 }); n.material.name = "Clay"; }
    });
    const head = new THREE.Vector3(0, size.y * 0.7, 0);
    const tail = Math.atan2(-0.47, 0.41); // tail direction from the body centre after the mirror
    const aim = Math.atan2(head.y - bubBase.y, head.x - bubBase.x);
    bubble = { g: new THREE.Group(), rot: aim - tail, aim };
    bubble.g.add(prop);
    bubble.g.position.copy(bubBase);
    bubble.g.rotation.z = bubble.rot;
    bubble.g.scale.set(-bubSize, bubSize, bubSize);
    scene.add(bubble.g);
  }

  let t = 0, popT = 9, bubT = 9, hover = 0, hoverTarget = 0, onScreen = true, raf = 0, last = 0, revealed = false;
  let nextWave = 4 + Math.random() * 3, nextBlink = 1.5 + Math.random() * 3, blinkUntil = 0, surpriseUntil = 0;
  const running = () => ready && !dead && onScreen && !document.hidden && !reduce && !panelOpen;
  const faceNow = () => (surpriseUntil > t ? "surprised" : hoverTarget || rig.waving ? "happy" : blinkUntil > t ? "blink" : "neutral");
  const pose = () => {
    const jump = popT < 0.5 ? Math.sin((popT / 0.5) * Math.PI) * 0.16 * unit : 0;
    const q = squash(popT), s = 1 + 0.06 * hover;
    sway.position.y = jump;
    sway.scale.set(s * (1 + q), s * (1 - q), s);
    if (bubble) {
      const k = bubSize * (1 + 0.16 * Math.max(0, 1 - spring(bubT)) + 0.06 * hover);
      bubble.g.scale.set(-k, k, k);
      bubble.g.position.set(bubBase.x, bubBase.y + Math.sin(t * 1.7 + 1) * 0.012 * E0 + (bubT < 0.4 ? Math.sin((bubT / 0.4) * Math.PI) * 0.03 * E0 : 0), 0);
      bubble.g.rotation.z = bubble.rot + Math.sin(t * 1.2 + 2) * 0.07;
      bubble.g.rotation.y = Math.sin(t * 0.9) * 0.14; // a little turn; the dots stay readable
    }
  };
  const draw = () => { if (!reduce) pose(); renderer.render(scene, camera); };
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    const dt0 = now - last;
    if (dt0 < 1000 / FPS - 2) return;
    const dt = Math.min(dt0 / 1000, 0.1);
    last = now; t += dt; popT += dt; bubT += dt;
    hover += (hoverTarget - hover) * (1 - Math.exp(-10 * dt));
    if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2 + Math.random() * 3; }
    if (t > nextWave && !hoverTarget) { if (rig.playOnce("wave")) { bubT = 0; nextWave = t + 2.4 + 6 + Math.random() * 3; } else nextWave = t + 3; }
    rig.setFace(faceNow());
    rig.mixer.update(dt);
    draw();
  }
  const kick = () => { if (!raf && running()) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const resizeObs = new ResizeObserver(() => { if (stage.resize() && (fit(), ready) && !running()) draw(); });
  resizeObs.observe(canvas);
  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; kick(); }).observe(fab);
  document.addEventListener("visibilitychange", kick);
  const hoverOn = () => { hoverTarget = 1; popT = 0; bubT = 0; rig.setFace("happy"); kick(); };
  const hoverOff = () => { hoverTarget = 0; rig.setFace(faceNow()); kick(); };
  fab.addEventListener("pointerenter", hoverOn);
  fab.addEventListener("pointerleave", hoverOff);
  fab.addEventListener("focus", hoverOn);
  fab.addEventListener("blur", hoverOff);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); dead = true; fab.classList.remove("is-3d"); });
  addEventListener("pagehide", () => { dead = true; if (raf) cancelAnimationFrame(raf); stage.dispose(); });

  stage.resize(); fit();
  ready = true;
  draw();
  requestAnimationFrame(() => {
    if (revealed) return;
    revealed = true; fab.classList.add("is-3d"); if (bubble) fab.classList.add("has-bubble");
    // the unread badge is on screen: the mochi is surprised for a moment and hops
    if (!dot.hidden && !reduce) { surpriseUntil = t + 1.6; popT = 0; bubT = 0; rig.setFace("surprised"); }
    kick();
  });
  kick();
  launcher.pop = () => { popT = 0; bubT = 0; if (!running()) draw(); kick(); };
  launcher.kick = () => { if (ready) { if (!running()) draw(); kick(); } };
}

if (webglOk()) whenIdle().then(startLauncher).catch((err) => console.warn("Kamiji chat: staying with the flat mochi", err));
else whenIdle().then(mochiIndex);

// ---------------------------------------------------------------------------------------------
// Scripted conversation
// ---------------------------------------------------------------------------------------------
const MAILTO = () => document.querySelector("#contact a.cta")?.getAttribute("href") || "mailto:openartist@gmail.com";
const EXPR_ORDER = ["neutral", "happy", "excited", "thinking", "sad", "angry", "surprised", "sleepy"];

// Each reply: mood for the avatar, paragraphs (with `code` marked by backticks), optional action buttons,
// optional `cycle` (the avatar runs through the expressions) and `chips` (list the suggested prompts inline).
const R = {
  greeting: {
    mood: "excited",
    get p() { return [`Hi, I'm ${mochiName()}. Ask me about Kamiji. This is a scripted demo: I only know a few things about Kamiji itself, so pick a prompt below or type a question.`]; },
  },
  what: {
    mood: "happy",
    p: [
      "Kamiji is a rigged, expressive 3D hand avatar for AI agents, plus a set of characters and 3D icons around it. The hand is one GLB with a finger skeleton, face morph targets and four clips: Idle, Wave, Think and Celebrate. You tint it per agent.",
      "Around the hand: 14 Kamikin mochi, 6 Rubbernose characters, 3D emoji, props, body shapes and Git icons. All of them are on this page, rendered live from the real files.",
    ],
  },
  expr: {
    mood: "happy", cycle: true,
    p: [
      "Kamiji has eight expressions: neutral, happy, excited, thinking, sad, angry, surprised and sleepy. Watch my face at the top of this panel while I run through them. I only have six faces, so I use the closest one.",
      "On the hero hand you can pick them yourself, together with shape, clip, mouth, effect and tint. There are hand poses too, and a talking mouth.",
    ],
    actions: [{ label: "Try them on the hero hand", goto: "top" }],
  },
  install: {
    mood: "thinking",
    p: [
      "Today the code lives in a private repository, so you need access first. There is no public download, npm package or CDN build yet. The steps on the page, in short:",
      "1. `git clone https://github.com/FraterCCCLXIII/kamiji.git`\n2. In your React 19+ app: `npm install three@0.186.1 react-icons@5.6.0`\n3. Copy `src/` and `assets/kamiji.glb` into your app, keeping that layout.\n4. `import { KamijiAvatar } from \"./vendor/kamiji/src\"` and render it.",
      "Planned, not published: an npm package and a `<kamiji-avatar>` web component for non-React apps. Mochi have no React component yet; you load those GLBs with three.js yourself.",
    ],
    actions: [{ label: "Open the Install section", goto: "install" }],
  },
  licence: {
    mood: "happy",
    p: [
      "Code is MIT. The characters and assets (the hand, Kamikin mochi, models, textures, props) are free for non-commercial use under CC BY-NC 4.0, with credit: \"Kamiji by Paul Bloch\".",
      "For-profit apps need the paid Premium Licence. It is a draft term sheet, not yet a contract, and no prices are fixed. \"Kamiji\" and \"Kamikin\" are trademarks of Paul Bloch. Ask by email to get the details.",
    ],
    actions: [{ label: "Licence section", goto: "licence" }, { label: "Email about a licence", mailto: true }],
  },
  brand: {
    mood: "excited",
    p: [
      "You can commission a Kamiji set made for your brand: your colours, your mascots, emoji and hands, your expressions, motion and props, delivered as rigged glTF models plus the React component that plays them. A web component is planned, not built.",
      "Custom sets for commercial use come under the Premium Licence (still a draft). No prices or delivery times are fixed yet, so tell us about your brand and we will reply with what a set could include.",
    ],
    actions: [{ label: "Go to the contact section", goto: "contact" }, { label: "Open an email", mailto: true }],
  },
  library: {
    mood: "excited",
    p: [
      "The live gallery on this page lists: Kamikin mochi (14), Rubbernose (6), hand poses, 24 emotes, 33 faces, 6 reactions, 36 symbols, 34 objects, 18 Git icons and 37 body shapes.",
      "Props are clay-style GLBs you can tint by material colour.",
    ],
    actions: [{ label: "Open the gallery", goto: "gallery" }],
  },
  works: {
    mood: "thinking",
    p: [
      "Works today: OpenHands, where Kamiji is vendored in Agent Canvas for feed and agent avatars. Planned: Odysseus, Hermes WebUI, OpenClaw, VS Code, JetBrains, MCP and ACP mood hooks, and a terminal sprite version. Planned means not built yet.",
    ],
    actions: [{ label: "Works with", goto: "works-with" }],
  },
  thanks: { mood: "happy", p: ["You're welcome! Ask me anything else about Kamiji."] },
  bye: { mood: "happy", p: ["Bye for now. Press Escape any time to close this panel."] },
  fallback: {
    mood: "thinking", chips: true,
    p: ["I'm only a scripted demo, so I don't know that one. I can talk about these:"],
  },
};

const CHIPS = [
  { label: "What is Kamiji?", key: "what" },
  { label: "Show me expressions", key: "expr" },
  { label: "How do I install it?", key: "install" },
  { label: "Can I use it commercially?", key: "licence" },
  { label: "Get my own branded Kamiji", key: "brand" },
  { label: "What is in the library?", key: "library" },
];

// Loose keyword matching: the intent with the most matching patterns wins; ties go to the earlier one.
const INTENTS = [
  ["greeting", [/\b(hi|hello|hey|yo|hiya|howdy)\b/]],
  ["thanks", [/\b(thanks?|thank you|thx|cheers)\b/]],
  ["bye", [/\b(bye|goodbye|see you|cya)\b/]],
  ["expr", [/express/, /emotion/, /\bmood/, /\b(happy|sad|angry|sleepy|surpris\w*|excit\w*|thinking|neutral)\b/, /\bpose/, /\bfaces?\b/, /\banimat/, /\bmouth/]],
  ["install", [/install/, /set ?up/, /get started/, /\bnpm\b/, /\breact\b/, /\bclone/, /download/, /how (do|can|to)\b.*\b(use|add|get)/, /\bcode\b/, /\bdocs?\b/]],
  ["licence", [/licen[sc]/, /commerc/, /\bfree\b/, /\bpa(y|id)\b/, /premium/, /\bcc\b/, /\bmit\b/, /trademark/, /pric/, /cost/, /for.?profit/, /\bbusiness\b/, /\bcredit/, /attribution/]],
  ["brand", [/brand/, /custom/, /commission/, /\bown\b/, /mascot/, /\bhire\b/, /\bcontact/, /e-?mail/, /\bquote\b/, /\bagency\b/]],
  ["library", [/librar/, /mochi/, /kamikin/, /rubber/, /emoji/, /\bprops?\b/, /shape/, /\bgit\b/, /\bicons?\b/, /bubble/, /emote/, /gallery/, /\bwhat('s| is) (in|there)/]],
  ["works", [/works? with/, /openhands/, /integrat/, /vs ?code/, /jetbrains/, /\bmcp\b/, /\bacp\b/, /terminal/, /compatib/]],
  ["what", [/what is/, /what'?s kamiji/, /\bkamiji\b/, /\babout\b/, /\bwho\b/, /\bhand\b/, /avatar/, /\brigged?\b/, /\b3d\b/, /explain/, /tell me/]],
];
function matchIntent(text) {
  const s = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const [key, pats] of INTENTS) {
    const score = pats.reduce((n, re) => n + (re.test(s) ? 1 : 0), 0);
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best || "fallback";
}

// ---------------------------------------------------------------------------------------------
// Panel (built on first open)
// ---------------------------------------------------------------------------------------------
let panel = null, panelOpen = false, ui = null;

const ICON_SPEAKER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path class="kj-on" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/><path class="kj-off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
const ICON_TUNE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2" fill="currentColor"/><circle cx="9" cy="17" r="2" fill="currentColor"/></svg>`;
const ICON_CC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.2a2.4 2.4 0 1 0 0 3.6M16.6 10.2a2.4 2.4 0 1 0 0 3.6"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function buildPanel() {
  panel = el("aside", "kj-panel", { id: "kj-chat", role: "dialog", "aria-modal": "false", "aria-labelledby": "kj-title", tabindex: "-1" });
  panel.hidden = true;
  panel.innerHTML = `
    <div class="kj-head">
      <div class="kj-avatar" id="kj-avatar">${flatSvg("")}</div>
      <div class="kj-titles"><h2 class="kj-title" id="kj-title">${drawerTitle()}</h2><p class="kj-mood" id="kj-mood" aria-hidden="true"></p></div>
      <button type="button" class="kj-ibtn" id="kj-stop" aria-label="Stop speaking" hidden>${ICON_STOP}</button>
      <span class="kj-voiceslot" id="kj-voiceslot"></span>
      <button type="button" class="kj-ibtn" id="kj-cc" aria-pressed="true" aria-label="Captions" title="Captions">${ICON_CC}</button>
      <button type="button" class="kj-ibtn" id="kj-audio" aria-pressed="false" aria-label="Read replies aloud">${ICON_SPEAKER}</button>
      <button type="button" class="kj-ibtn" id="kj-close" aria-label="Close chat">${ICON_CLOSE}</button>
    </div>
    <div class="kj-logwrap">
      <div class="kj-log" id="kj-log" role="log" aria-live="polite" aria-label="Conversation with Kamiji" tabindex="0"></div>
      <div class="kj-caps" id="kj-caps"></div>
    </div>
    <p class="kj-note" id="kj-note" role="status"></p>
    <div class="kj-chips" id="kj-chips" role="group" aria-label="Suggested prompts"></div>
    <form class="kj-form" id="kj-form" autocomplete="off">
      <label class="kj-sr" for="kj-input">Message to Kamiji</label>
      <input class="kj-input" id="kj-input" type="text" placeholder="Ask about Kamiji" maxlength="200" enterkeyhint="send">
      <button class="kj-send" type="submit">Send</button>
    </form>
    <p class="kj-foot">Scripted demo. Nothing you type leaves this page.</p>`;
  document.body.append(panel);
  const $ = (id) => panel.querySelector("#" + id);
  ui = { title: $("kj-title"), avatarBox: $("kj-avatar"), mood: $("kj-mood"), stop: $("kj-stop"), audio: $("kj-audio"), cc: $("kj-cc"), caps: $("kj-caps"), close: $("kj-close"), log: $("kj-log"), note: $("kj-note"), chips: $("kj-chips"), form: $("kj-form"), input: $("kj-input") };

  for (const c of CHIPS) {
    const b = el("button", "kj-chip", { type: "button" });
    b.textContent = c.label;
    b.addEventListener("click", () => ask(c.label, c.key));
    ui.chips.append(b);
  }
  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = ui.input.value.trim();
    if (!v) return;
    ui.input.value = "";
    ask(v, matchIntent(v));
  });
  ui.close.addEventListener("click", closePanel);
  ui.stop.addEventListener("click", stopSpeech);
  ui.audio.addEventListener("click", () => setAudio(ui.audio.getAttribute("aria-pressed") !== "true"));
  panel.addEventListener("keydown", trapTab);
  ui.audio.setAttribute("aria-pressed", String(audioOn));
  setAudio(lsGet(LS_AUDIO) === "1", true);
  // Captions: word-synced, only while a reply is spoken; default on (an accessibility feature), shared with the voice settings panel.
  caps = createCaptions(ui.caps, { characterId: mochi.id, name: mochiName(), lang: "en", onTalking: (e) => avatar.setMouth(e.speaking ? (reduce ? (e.amplitude > 0.15 ? 0.35 : 0) : e.amplitude) : 0) });
  const syncCc = (c) => { ui.cc.setAttribute("aria-pressed", String(c.captions)); ui.cc.setAttribute("aria-label", c.captions ? "Captions: on" : "Captions: off"); ui.cc.title = c.captions ? "Captions on (click to turn off)" : "Captions off"; };
  caps.subscribe(syncCc); syncCc(caps.settings); caps.preload();
  ui.cc.addEventListener("click", () => caps.set({ captions: !caps.settings.captions }));
  const voiceForPanel = { // "Test voice" shows the captions too
    speak: (t, o) => { caps.setCharacter(mochi.id, mochiName()); caps.begin({ text: t, rate: voiceRate() }); return voice.speak(t, o).finally(() => { if (!voice.speaking()) caps.end(); }); },
    stop: () => { voice.stop(); caps.end(); }, systemVoices: (l) => voice.systemVoices(l), available: (f) => voice.available(f) };
  const vs = mountVoiceSettings($("kj-voiceslot"), voiceForPanel, { captions: caps, lang: "en", sample: `Hi! I am ${mochiName()}. I am so happy to see you.`, label: "Voice settings" });
  const vbtn = vs.element.querySelector(".kv-btn");
  if (vbtn) { vbtn.classList.add("kj-ibtn"); vbtn.innerHTML = ICON_TUNE; vbtn.setAttribute("aria-label", "Voice settings"); vbtn.title = "Voice settings"; }
}

// ---- messages ----------------------------------------------------------------------------
let stream = null; // { finish() } for the reply currently typing
let thinkTimer = 0, cycleTimer = 0, moodTimer = 0;

function inlineMarkup(text) { // `code` only; everything else is text
  const frag = document.createDocumentFragment();
  text.split(/(`[^`]+`)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith("`")) { const c = el("code"); c.textContent = part.slice(1, -1); frag.append(c); }
    else frag.append(document.createTextNode(part));
  });
  return frag;
}
function scrollDown() { ui.log.scrollTop = ui.log.scrollHeight; }

function addUser(text) {
  const m = el("div", "kj-msg kj-user");
  m.textContent = text;
  ui.log.append(m);
  scrollDown();
}

function buildReply(r) {
  const m = el("div", "kj-msg kj-agent");
  for (const para of r.p) {
    const p = el("p");
    const lines = para.split("\n");
    lines.forEach((line, i) => { if (i) p.append(el("br")); p.append(inlineMarkup(line)); });
    m.append(p);
  }
  const acts = el("div", "kj-acts");
  if (r.chips) {
    for (const c of CHIPS) {
      const b = el("button", "kj-act", { type: "button" });
      b.textContent = c.label;
      b.addEventListener("click", () => ask(c.label, c.key));
      acts.append(b);
    }
  }
  for (const a of r.actions || []) {
    let n;
    if (a.mailto) { n = el("a", "kj-act", { href: MAILTO() }); }
    else {
      n = el("a", "kj-act", { href: "#" + a.goto });
      n.addEventListener("click", (e) => {
        e.preventDefault();
        const t = document.getElementById(a.goto);
        if (mobileMQ.matches) closePanel(false);
        t?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    }
    n.textContent = a.label;
    acts.append(n);
  }
  if (acts.childNodes.length) m.append(acts);
  return { m, acts };
}

// Reveal a reply by typing into its existing text nodes, so inline <code> and <br> keep their structure.
function typeInto(root, done) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let tn;
  while ((tn = walker.nextNode())) nodes.push({ n: tn, full: tn.nodeValue });
  const acts = root.querySelector(".kj-acts");
  let finished = false, timer = 0;
  const finish = () => {
    if (finished) return;
    finished = true; clearTimeout(timer);
    nodes.forEach((x) => { x.n.nodeValue = x.full; });
    if (acts) acts.hidden = false;
    done();
  };
  if (reduce) { finish(); return { finish }; }
  nodes.forEach((x) => { x.n.nodeValue = ""; });
  const inActs = (n) => acts && acts.contains(n);
  const textNodes = nodes.filter((x) => !inActs(x.n));
  nodes.filter((x) => inActs(x.n)).forEach((x) => { x.n.nodeValue = x.full; }); // buttons appear at the end
  if (acts) acts.hidden = true;
  let i = 0, c = 0;
  const tick = () => {
    if (finished) return;
    let budget = 3;
    while (budget > 0 && i < textNodes.length) {
      const x = textNodes[i];
      const take = Math.min(budget, x.full.length - c);
      c += take; budget -= take;
      x.n.nodeValue = x.full.slice(0, c);
      if (c >= x.full.length) { i++; c = 0; }
    }
    scrollDown();
    if (i >= textNodes.length) finish(); else timer = setTimeout(tick, 22);
  };
  tick();
  return { finish };
}

function plainText(r) { return r.p.join(" ").replace(/`/g, "").replace(/\s*\n\s*/g, ". ").replace(/\s+/g, " "); }

function ask(label, key) {
  if (stream) stream.finish();
  clearTimeout(thinkTimer); stopCycle();
  stopSpeech();
  addUser(label);
  reply(R[key] || R.fallback);
}

function reply(r) {
  setMood("thinking");
  const typing = el("div", "kj-msg kj-agent");
  typing.innerHTML = '<span class="kj-typing" aria-hidden="true"><i></i><i></i><i></i></span>';
  ui.log.append(typing);
  scrollDown();
  ui.log.setAttribute("aria-busy", "true");
  const go = () => {
    typing.remove();
    const { m } = buildReply(r);
    ui.log.append(m);
    setMood(r.mood || "happy", r.cycle ? 99999 : 2200);
    if (r.cycle) startCycle();
    speak(plainText(r));
    const s = typeInto(m, () => { stream = null; ui.log.removeAttribute("aria-busy"); scrollDown(); });
    stream = s;
  };
  if (reduce) go(); else thinkTimer = setTimeout(go, 650);
}

function setMood(name, holdMs = 2200) {
  clearTimeout(moodTimer);
  avatar.setExpr(name);
  ui.mood.textContent = name === "happy" && !speaking ? "" : name;
  if (holdMs < 99999) moodTimer = setTimeout(() => { avatar.setExpr("happy"); ui.mood.textContent = ""; }, holdMs);
}

function startCycle() {
  let i = 0;
  const step = () => {
    if (i >= EXPR_ORDER.length) { stopCycle(); setMood("happy"); return; }
    const name = EXPR_ORDER[i++];
    avatar.setExpr(name); ui.mood.textContent = name;
    cycleTimer = setTimeout(step, reduce ? 1400 : 1000);
  };
  step();
}
function stopCycle() { clearTimeout(cycleTimer); cycleTimer = 0; }

// ---- audio ---------------------------------------------------------------------------------
// Speech comes from the shared voice layer (site/voice.js): system voice by default, the local better-voice server
// only when the user picks it in the voice settings popover. Audio stays OFF until the header toggle is pressed.
let audioOn = lsGet(LS_AUDIO) === "1";
let speaking = false, speakEnd = 0;
const voice = createVoice({ lang: "en", characterId: mochi.id });
let caps = null; // captions.js controller, created with the panel
const voiceRate = () => (settings.values.mode === "better" ? settings.values.speed : settings.values.rate);
voice.onmouth = (open) => { if (!caps || !caps.drivesMouth()) avatar.setMouth(open); }; // real word boundaries (captions) drive the mouth instead when present
voice.onboundary = (e) => caps?.boundary(e);
voice.onstart = (info) => { clearTimeout(speakEnd); setSpeaking(true); note(""); caps?.started(info); };
voice.onend = () => { clearTimeout(speakEnd); caps?.end(); if (speaking) setSpeaking(false); };
voice.onstatus = () => { /* fallbacks are quiet here; the settings popover shows the server status */ };

function note(msg) { if (ui) ui.note.textContent = msg || ""; }

function setAudio(on, initial) {
  audioOn = on;
  ui.audio.setAttribute("aria-pressed", String(on));
  ui.audio.setAttribute("aria-label", on ? "Read replies aloud: on" : "Read replies aloud: off");
  ui.audio.title = on ? "Reading replies aloud (click to turn off)" : "Read replies aloud";
  if (!initial) lsSet(LS_AUDIO, on ? "1" : "0");
  if (!on) { stopSpeech(); note(""); }
}

function setSpeaking(v) {
  speaking = v;
  if (ui) ui.stop.hidden = !v;
  avatar.setSpeaking(v);
  if (!v && ui) ui.mood.textContent = "";
}

function stopSpeech() {
  clearTimeout(speakEnd);
  voice.stop();
  caps?.end();
  if (speaking) setSpeaking(false);
}

async function speak(text) {
  if (!audioOn || !panelOpen) return;
  stopSpeech();
  // safety net: never leave the stop button up if a browser drops its end event
  speakEnd = setTimeout(() => { if (speaking) stopSpeech(); }, Math.min(120000, 8000 + text.length * 250));
  caps?.setCharacter(mochi.id, mochiName());
  caps?.begin({ text, lang: "en", rate: voiceRate() });
  const r = await voice.speak(text, { lang: "en" });
  if (r && r.engine === null && !speaking) { clearTimeout(speakEnd); caps?.end(); }
  if (r && r.engine === "system" && typeof window.speechSynthesis === "undefined") note("No audio: this browser has no speech voice.");
}

// ---- avatar (header) ---------------------------------------------------------------------------
// The same mochi as the launcher. The conversation mood picks one of its six face textures (neutral, blink, happy, joy,
// surprised, sad); while the voice speaks, its mouth level swaps the face like site/kamikin/chat.js does.
const MOOD_FACE = { neutral: "neutral", happy: "happy", excited: "joy", thinking: "neutral", sad: "sad", angry: "sad", surprised: "surprised", sleepy: "blink" };
const mouthFace = (o) => (o > 0.6 ? "surprised" : o > 0.3 ? "happy" : null);

const avatar = (() => {
  let expr = "happy", talking = false, active = false, mouthLevel = null; // mouthLevel: 0..1 from the voice
  let api = null; // set when the 3D avatar is ready
  return {
    setExpr(n) { expr = n; api?.kick(); },
    setSpeaking(v) { talking = v; if (!v) mouthLevel = null; api?.kick(); },
    setMouth(o) { mouthLevel = o; api?.kick(); },
    get mouthLevel() { return mouthLevel; },
    get expr() { return expr; },
    get talking() { return talking; },
    setActive(v) { active = v; api?.kick(); },
    get active() { return active; },
    attach(a) { api = a; },
    get ready() { return !!api; },
  };
})();

let avatarStarting = false;
async function startAvatar() {
  if (avatar.ready || avatarStarting || !webglOk()) return;
  avatarStarting = true;
  try {
    const lib = await loadLib();
    const { THREE } = lib;
    const gltf = await loadMochi(lib);
    const canvas = el("canvas", null, { "aria-hidden": "true" });
    ui.avatarBox.append(canvas);
    let stage;
    try { stage = makeStage(lib, canvas, 22); } catch (err) { canvas.remove(); throw err; }
    const { scene, camera, renderer } = stage;
    let dead = false, t = 0, raf = 0, last = 0, nextBlink = 2, blinkUntil = 0, lastAt = 0, clipHappy = false;
    const rig = mochiRig(lib, gltf, () => kick());
    rig.preload();
    const size = rig.ground();
    const sway = new THREE.Group();
    sway.add(rig.root);
    scene.add(sway);
    // frame the head and shoulders: the upper part of the body fills the round avatar
    const fy = size.y * 0.66, ext = Math.max(size.x * 0.95, size.y * 0.62);
    camera.position.set(0, fy, (ext / 2) / Math.tan(THREE.MathUtils.degToRad(11)));
    camera.lookAt(0, fy, 0);

    let mouthF = null;
    const faceNow = () => {
      const base = MOOD_FACE[avatar.expr] || "neutral";
      if (avatar.talking) {
        const o = avatar.mouthLevel != null ? avatar.mouthLevel : reduce ? 0.35 : 0.1 + 0.5 * Math.abs(Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 3.1));
        const f = reduce ? (o > 0.15 ? "happy" : null) : mouthFace(o), now = performance.now();
        if (f !== mouthF && now - lastAt > 70) { mouthF = f; lastAt = now; }
        return mouthF || base;
      }
      mouthF = null;
      return base === "neutral" && blinkUntil > t && !reduce ? "blink" : base;
    };
    const step = (dt) => {
      t += dt;
      if (t > nextBlink) { blinkUntil = t + 0.12; nextBlink = t + 2 + Math.random() * 3; }
      const wantHappy = avatar.expr === "excited" && !reduce;
      if (wantHappy && !clipHappy && rig.playOnce("happy")) clipHappy = true;
      if (!wantHappy) clipHappy = false;
      rig.setFace(faceNow());
      if (!reduce) { rig.mixer.update(dt); sway.rotation.y = Math.sin(t * 0.9) * 0.16; }
    };
    const running = () => !dead && avatar.active && !document.hidden;
    function loop(now) {
      raf = 0;
      if (!running() || reduce) return;
      raf = requestAnimationFrame(loop);
      const dt0 = now - last;
      if (dt0 < 1000 / FPS - 2) return;
      last = now; step(Math.min(dt0 / 1000, 0.1));
      renderer.render(scene, camera);
    }
    function kick() {
      if (!running()) return;
      if (reduce) { step(0); renderer.render(scene, camera); return; }
      if (!raf) { last = performance.now() - 40; raf = requestAnimationFrame(loop); }
    }
    document.addEventListener("visibilitychange", kick);
    new ResizeObserver(() => { if (stage.resize()) kick(); }).observe(canvas);
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); dead = true; canvas.remove(); });
    addEventListener("pagehide", () => { dead = true; if (raf) cancelAnimationFrame(raf); stage.dispose(); });
    stage.resize();
    avatar.attach({ kick });
    ui.avatarBox.querySelector("svg")?.remove();
    kick();
  } finally { avatarStarting = false; }
}

// ---- open / close ----------------------------------------------------------------------------
let greeted = false, closeTimer = 0;

function focusables() {
  return [...panel.querySelectorAll("button, input, a[href], [tabindex='0']")].filter((n) => !n.hidden && !n.disabled && n.offsetParent !== null);
}
function trapTab(e) {
  if (e.key !== "Tab") return;
  const f = focusables();
  if (!f.length) return;
  const first = f[0], lastEl = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); lastEl.focus(); }
  else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
}
function onDocKey(e) {
  if (e.key === "Escape" && panelOpen) { e.preventDefault(); closePanel(); }
}

function openPanel() {
  if (panelOpen) return;
  if (!panel) buildPanel();
  clearTimeout(closeTimer);
  panelOpen = true;
  fab.setAttribute("aria-expanded", "true");
  fab.classList.add("is-hidden");
  dot.hidden = true; lsSet(LS_SEEN, "1");
  panel.hidden = false;
  if (mobileMQ.matches) document.documentElement.classList.add("kj-lock");
  void panel.offsetWidth; // start the slide from the closed position
  panel.classList.add("is-open");
  document.addEventListener("keydown", onDocKey);
  (mobileMQ.matches ? panel : ui.input).focus({ preventScroll: true });
  avatar.setActive(true);
  startAvatar().catch((err) => console.warn("Kamiji chat: flat avatar", err));
  if (!greeted) { greeted = true; mochiIndex().then(() => { if (panelOpen) reply(R.greeting); else greeted = false; }); }
}

function closePanel(restoreFocus = true) {
  if (!panelOpen) return;
  panelOpen = false;
  document.removeEventListener("keydown", onDocKey);
  stopSpeech(); stopCycle(); clearTimeout(moodTimer);
  avatar.setExpr("happy");
  avatar.setActive(false);
  document.documentElement.classList.remove("kj-lock");
  panel.classList.remove("is-open");
  fab.setAttribute("aria-expanded", "false");
  fab.classList.remove("is-hidden");
  if (restoreFocus) fab.focus({ preventScroll: true });
  const hide = () => { if (!panelOpen) panel.hidden = true; };
  if (reduce) hide(); else closeTimer = setTimeout(hide, 300);
  launcher.kick();
}

fab.addEventListener("click", () => { launcher.pop(); openPanel(); });
