// "In motion" section: live 3D Kamiji samples that cycle through movements and
// expressions, with ONE 3D emoji accessory at a time that pops in and out.
//
// Rules this file enforces:
//   - ONE shared WebGL renderer draws every sample into its own 2D canvas
//     (same pattern as main.js, own instance here), 30 fps cap, only visible
//     samples load and render; far-away samples release their models.
//   - Each sample owns a single accessory slot (sample.acc). A new accessory is
//     only created when the slot is empty, and a beat change empties it first.
//   - A beat is laid out as: none, pop in, hold, pop out, none. So every cycle
//     alternates "no accessory" with "one accessory", never two at once.
// Prototype: motions Spin/Bounce/TurnPoint/Hello/Typing and the halo pop-in are
// ported from src/kamiji-motion.ts and src/kamiji.css; the demo motions Nod,
// Shake, Droop and Sway exist only on this page.

const HAND_URL = "../assets/kamiji.glb";
const MOCHI_DIR = "../assets/mochi/";
const PROPS_DIR = "../assets/props/";
const PROP_GROUPS = ["", "symbols/", "objects/", "shapes/"];
const FACE_DIR = `${PROPS_DIR}faces/`;

const $ = (id) => document.getElementById(id);
const reduceQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduce = reduceQuery.matches;

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
const HIDDEN_FACE_MATERIALS = ["FaceInk", "FaceTongue", "FaceGlint"];

// ---- samples: what each one cycles through ------------------------------------
// Beat fields: move (caption), expr (caption), emoji (library id), dur (seconds),
// motion (rigid motion), clip (baked clip), cspeed, pose, hexpr (hand morphs),
// face (mochi face state, or the face-emoji model name).
const B = (move, expr, emoji, o = {}) => ({ move, expr, emoji, dur: 4.4, ...o });

const HAND_BEATS = {
  wave: B("Wave", "happy", "heart", { clip: "Wave", hexpr: "happy", dur: 4.8 }),
  hello: B("Hello", "happy", "sparkle", { motion: "Hello", clip: "Wave", hexpr: "happy" }),
  think: B("Think", "thinking", "lightbulb", { clip: "Think", hexpr: "thinking" }),
  celebrate: B("Celebrate", "excited", "party_popper", { clip: "Celebrate", hexpr: "excited" }),
  point: B("TurnPoint", "surprised", "exclamation", { motion: "TurnPoint", pose: "point", clip: "Idle", hexpr: "surprised", dur: 3.2 }),
  typing: B("Typing", "thinking", "gear", { motion: "Typing", clip: "Think", cspeed: 2.6, hexpr: "thinking", dur: 4 }),
  bounce: B("Bounce", "happy", "star", { motion: "Bounce", clip: "Idle", hexpr: "happy", dur: 4 }),
  spin: B("Spin", "excited", "fire", { motion: "Spin", clip: "Idle", hexpr: "excited" }),
  sleepy: B("Sway", "sleepy", "zzz", { motion: "Sway", clip: "Idle", hexpr: "sleepy", dur: 4.8 }),
  sad: B("Droop", "sad", "sweat", { motion: "Droop", clip: "Idle", hexpr: "sad" }),
  angry: B("Shake", "angry", "anger", { motion: "Shake", clip: "Idle", hexpr: "angry", dur: 4 }),
};
const withEmoji = (key, emoji, move) => ({ ...HAND_BEATS[key], emoji, ...(move ? { move } : {}) });

const SAMPLES = [
  {
    id: "hand-yellow", kind: "hand", title: "Hand, yellow", tint: "#ffd23f", still: 0,
    beats: [HAND_BEATS.wave, HAND_BEATS.think, HAND_BEATS.celebrate, HAND_BEATS.point, HAND_BEATS.sleepy, HAND_BEATS.typing],
  },
  {
    id: "sphere-coral", kind: "sphere", title: "Sphere head, coral", tint: "#ff7a59", still: 1,
    beats: [withEmoji("bounce", "heart"), withEmoji("spin", "sparkles_small"), withEmoji("hello", "music_note"), withEmoji("angry", "anger"), withEmoji("sleepy", "zzz")],
  },
  {
    id: "hand-blue", kind: "hand", title: "Hand, blue", tint: "#4aa8ff", still: 2,
    beats: [withEmoji("typing", "terminal_window"), withEmoji("think", "question"), withEmoji("hello", "bolt"), withEmoji("sad", "tear"), withEmoji("spin", "rocket")],
  },
  {
    id: "mochi-kon", kind: "mochi", mochi: "kamikin-kon", title: "Kon, kitsune", still: 0,
    beats: [
      B("dance", "joy", "music_note", { clip: "dance", face: "joy" }),
      B("wave", "happy", "heart", { clip: "wave", face: "happy" }),
      B("sit", "neutral", "coffee", { clip: "sit", face: "neutral" }),
      B("sad", "sad", "tear", { clip: "sad", face: "sad" }),
      B("hop", "surprised", "exclamation", { clip: "hop", face: "surprised", dur: 3.6 }),
    ],
  },
  {
    id: "sphere-green", kind: "sphere", title: "Sphere head, green", tint: "#5ec27a", still: 3,
    beats: [withEmoji("typing", "check"), { ...withEmoji("think", "question", "Nod"), motion: "Nod" }, withEmoji("bounce", "double_exclamation"), withEmoji("sad", "tear"), withEmoji("spin", "trophy")],
  },
  {
    id: "face-grin", kind: "face", title: "Face emoji, yellow", tint: "#ffd23f", still: 4,
    beats: [
      B("Bounce", "grin", "sparkle", { motion: "Bounce", face: "face_grin", dur: 4 }),
      B("Spin", "star eyes", "star", { motion: "Spin", face: "face_star_eyes" }),
      B("TurnPoint", "thinking", "lightbulb", { motion: "TurnPoint", face: "face_thinking", dur: 3.2 }),
      B("Droop", "cry", "tear", { motion: "Droop", face: "face_cry" }),
      B("Shake", "angry", "anger", { motion: "Shake", face: "face_angry", dur: 4 }),
      B("Sway", "sleepy", "zzz", { motion: "Sway", face: "face_sleepy", dur: 4.8 }),
    ],
  },
  {
    id: "mochi-pip", kind: "mochi", mochi: "kamikin-pip", title: "Pip, fox", still: 1,
    beats: [
      B("walk", "neutral", "map_pin", { clip: "walk", face: "neutral" }),
      B("hop", "joy", "gem", { clip: "hop", face: "joy", dur: 3.6 }),
      B("idle", "surprised", "question", { clip: "idle", face: "surprised" }),
      B("sad", "sad", "sweat", { clip: "sad", face: "sad" }),
      B("dance", "joy", "music_note", { clip: "dance", face: "joy" }),
    ],
  },
  {
    id: "hand-violet", kind: "hand", title: "Hand, violet", tint: "#b583ff", still: 4,
    beats: [withEmoji("point", "magnifier"), withEmoji("wave", "sparkle"), withEmoji("angry", "anger"), withEmoji("bounce", "bolt"), withEmoji("think", "lightbulb_on")],
  },
  {
    id: "sphere-pink", kind: "sphere", title: "Sphere head, pink", tint: "#ff7eb6", still: 3,
    beats: [withEmoji("hello", "heart"), withEmoji("spin", "star"), withEmoji("sad", "sweat"), withEmoji("bounce", "gift"), { ...withEmoji("think", "brain", "Nod"), motion: "Nod" }],
  },
  {
    id: "mochi-ren", kind: "mochi", mochi: "kamikin-player", title: "Ren, bunny", still: 2,
    beats: [
      B("sit", "neutral", "book", { clip: "sit", face: "neutral" }),
      B("happy", "joy", "party_popper", { clip: "happy", face: "joy", dur: 4 }),
      B("wave", "happy", "sparkle", { clip: "wave", face: "happy" }),
      B("hop", "surprised", "double_exclamation", { clip: "hop", face: "surprised", dur: 3.6 }),
      B("sad", "sad", "sweat", { clip: "sad", face: "sad" }),
    ],
  },
  {
    id: "face-cool", kind: "face", title: "Face emoji, coral", tint: "#ff9a6b", still: 3,
    beats: [
      B("Hello", "wink", "heart", { motion: "Hello", face: "face_wink" }),
      B("Bounce", "laugh cry", "fire", { motion: "Bounce", face: "face_laugh_cry", dur: 4 }),
      B("Spin", "dizzy", "question", { motion: "Spin", face: "face_dizzy" }),
      B("Typing", "nerd", "check", { motion: "Typing", face: "face_nerd", dur: 4 }),
      B("Sway", "sleeping", "zzz", { motion: "Sway", face: "face_sleeping", dur: 4.8 }),
    ],
  },
  {
    id: "mochi-kumo", kind: "mochi", mochi: "kamikin-kumo", title: "Kumo, lamb", still: 2,
    beats: [
      B("sit", "sleepy", "zzz", { clip: "sit", face: "blink", dur: 4.8 }),
      B("happy", "joy", "heart", { clip: "happy", face: "joy", dur: 4 }),
      B("walk", "neutral", "clock", { clip: "walk", face: "neutral" }),
      B("dance", "happy", "music_note", { clip: "dance", face: "happy" }),
      B("sad", "sad", "tear", { clip: "sad", face: "sad" }),
    ],
  },
];

// ---- motion maths (ported from src/kamiji-motion.ts) ------------------------------
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x;
const wrapAngle = (r) => { const w = ((((r + Math.PI) % TAU) + TAU) % TAU) - Math.PI; return w === -Math.PI ? Math.PI : w; };
const ID = () => ({ rotX: 0, rotY: 0, rotZ: 0, posY: 0, scaleX: 1, scaleY: 1 });

function evaluateMotion(motion, t) {
  const o = ID();
  switch (motion) {
    case "Spin": {
      const k = clamp01(((t % 2.2) / 2.2) / 0.75);
      o.rotY = easeInOutCubic(k) * TAU; o.posY = 0.08 * Math.sin(Math.PI * k); break;
    }
    case "Bounce": {
      const lift = Math.abs(Math.sin((Math.PI * t) / 0.8)), grounded = (1 - lift) ** 3;
      o.posY = 0.2 * lift; o.scaleY = 1 - 0.18 * grounded; o.scaleX = 1 + 0.18 * 0.65 * grounded; break;
    }
    case "TurnPoint": {
      const s = t % 3.2;
      let turn;
      if (s < 0.55) turn = easeInOutCubic(s / 0.55);
      else if (s < 2.35) turn = 1;
      else turn = 1 - easeInOutCubic(clamp01((s - 2.35) / 0.55));
      const holding = s >= 0.55 && s < 2.35 ? 1 : 0;
      o.rotZ = (-Math.PI / 2) * turn + holding * 0.05 * Math.sin((s - 0.55) * 9); break;
    }
    case "Hello": {
      const ph = (TAU * t) / 1.1;
      o.rotY = 0.6 * Math.sin(ph); o.rotZ = 0.12 * Math.sin(ph + Math.PI / 2); break;
    }
    case "Typing": o.rotX = (50 * Math.PI) / 180; o.posY = 0.012 * Math.sin(t * 14); break;
    // demo-only motions of this page
    case "Nod": o.rotX = 0.32 * Math.sin((TAU * t) / 1.1); o.posY = -0.02 * Math.abs(Math.sin((TAU * t) / 1.1)); break;
    case "Shake": o.rotY = 0.5 * Math.sin((TAU * t) / 0.5); o.rotZ = 0.05 * Math.sin((TAU * t) / 0.25); break;
    case "Droop": o.rotZ = -0.3 * easeOut(clamp01(t / 1)) + 0.02 * Math.sin(t * 2); o.posY = -0.07 * easeOut(clamp01(t / 1)); o.scaleY = 1 - 0.04 * easeOut(clamp01(t / 1)); break;
    case "Sway": o.rotZ = 0.14 * Math.sin((TAU * t) / 2.4); o.posY = 0.015 * Math.sin((TAU * t) / 2.4 + 1); break;
    default: break;
  }
  return o;
}

// Finger curls for the poses used here (copied from site/hand-poses.js / src/kamiji-pose-tween.ts).
const CURLED_LONG = [50, 70, 50], CURLED_RING = [50, 45, 45], CURLED_PINKY = [50, 40, 35], THUMB_TUCKED = [45, 40, 25], STRAIGHT = [0, 0, 0];
const POSES = {
  point: {
    fingers: { Thumb: THUMB_TUCKED, Index: STRAIGHT, Middle: CURLED_LONG, Ring: CURLED_RING, Pinky: CURLED_PINKY },
    splay: { Thumb: 45, Index: 14 },
  },
};

// ---- accessory pop (the halo keyframes in src/kamiji.css) -----------------------------
const DEG = Math.PI / 180;
const TILT = 6 * DEG;
const POP_STOPS = [[0, 0.15, -18 * DEG, 0], [0.55, 1.22, 6 * DEG, 1], [0.8, 0.94, -2 * DEG, 1], [1, 1, TILT, 1]];
function popIn(k) {
  for (let i = 1; i < POP_STOPS.length; i += 1) {
    if (k <= POP_STOPS[i][0]) {
      const a = POP_STOPS[i - 1], b = POP_STOPS[i], f = easeOut((k - a[0]) / (b[0] - a[0]));
      return { scale: a[1] + (b[1] - a[1]) * f, rot: a[2] + (b[2] - a[2]) * f, alpha: a[3] + (b[3] - a[3]) * f };
    }
  }
  return { scale: 1, rot: TILT, alpha: 1 };
}
const popOut = (k) => { const f = easeIn(clamp01(k)); return { scale: 1 - 0.9 * f, rot: TILT + (14 * DEG - TILT) * f, alpha: 1 - f }; };

const IN_AT = 0.7, IN_DUR = 0.42, OUT_DUR = 0.24, OUT_GAP = 0.85; // pop out starts OUT_GAP before the beat ends
const MOTION_FADE = 0.2;
const SPEEDS = [{ name: "slow", v: 0.55 }, { name: "normal", v: 1 }, { name: "fast", v: 1.7 }];
const labelOf = (id) => id.replace(/_/g, " ");

// ---- boot ------------------------------------------------------------------------------
async function boot() {
  const section = $("motion"), grid = $("mo-grid");
  if (!section || !grid) return;
  const fail = (msg) => { grid.replaceChildren(); const p = document.createElement("li"); p.className = "mo-fail"; p.textContent = msg; grid.append(p); };

  let THREE, GLTFLoader, SkeletonUtils, renderer;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("Kamiji motion: 3D unavailable", err);
    fail("3D preview unavailable in this browser. The files are in the repository.");
    return;
  }

  const loader = new GLTFLoader();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const state = { paused: false, accessories: "auto", speed: 1 };

  // ---- library index: real emoji ids -> files ----------------------------------------
  const propFiles = new Map(); // id -> { url, tint, label }
  await Promise.all(PROP_GROUPS.map(async (g) => {
    try {
      const list = await (await fetch(`${PROPS_DIR}${g}index.json`)).json();
      list.forEach((p) => { if (!propFiles.has(p.name)) propFiles.set(p.name, { url: `${PROPS_DIR}${g}${p.file}`, tint: p.tint, label: labelOf(p.name) }); });
    } catch (err) { console.warn("Kamiji motion: prop index missing", g, err); }
  }));
  let mochiIndex = [];
  try { mochiIndex = (await (await fetch(`${MOCHI_DIR}index.json`)).json()).characters || []; } catch (err) { console.warn("Kamiji motion: mochi index missing", err); }

  const glbCache = new Map();
  // Cached per URL; a failed fetch (flaky network, aborted request) is retried twice before giving up.
  const fetchGlb = async (url, tries = 3) => {
    try { return await loader.loadAsync(url); } catch (err) {
      if (tries <= 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
      return fetchGlb(url, tries - 1);
    }
  };
  const loadGlb = (url) => {
    if (!glbCache.has(url)) glbCache.set(url, fetchGlb(url).catch((err) => { glbCache.delete(url); throw err; }));
    return glbCache.get(url);
  };
  const handAsset = () => loadGlb(HAND_URL);

  // ---- helpers ------------------------------------------------------------------------
  function preciseBox(obj) {
    obj.updateMatrixWorld(true);
    return new THREE.Box3().expandByObject(obj, true);
  }

  // ---- the accessory slot ---------------------------------------------------------------
  // Exactly one accessory object can exist per sample: sample.acc. makeAccessory is only
  // called when the slot is empty (see syncAccessory) and removeAccessory empties it.
  const resolved = new Map(); // url -> loaded gltf (synchronous lookup once loaded)
  const preload = (id) => {
    const info = propFiles.get(id);
    if (!info) return Promise.resolve();
    return loadGlb(info.url).then((g) => { resolved.set(info.url, g); });
  };

  function buildAccessory(sm, id) {
    const info = propFiles.get(id);
    const gltf = info && resolved.get(info.url);
    if (!gltf) return null;
    const root = gltf.scene.clone(true);
    const mats = [];
    root.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone(); mats.push(n.material);
      n.material.transparent = true;
      if (n.material.name === "Clay") n.material.color.set(info.tint);
    });
    if (!mats.some((m) => m.name === "Clay")) mats.forEach((m) => m.color.set(info.tint));
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    root.position.sub(centre);
    const inner = new THREE.Group(); inner.add(root);
    inner.scale.setScalar(sm.emojiSize / Math.max(size.x, size.y, size.z, 1e-6));
    const pivot = new THREE.Group(); pivot.add(inner);
    pivot.position.copy(sm.anchor);
    pivot.userData.accessory = id;
    sm.scene.add(pivot);
    return { id, pivot, inner, mats, seed: Math.random() * 6 };
  }
  function removeAccessory(sm) {
    const a = sm.acc;
    if (!a) return;
    sm.scene.remove(a.pivot);
    a.mats.forEach((m) => m.dispose());
    sm.acc = null; sm.dirty = true;
  }
  const setAcc = (a, pop, time) => {
    a.pivot.scale.setScalar(Math.max(0.001, pop.scale));
    a.pivot.rotation.set(0, reduce ? 0.3 : Math.sin(time * 1.6 + a.seed) * 0.4, pop.rot);
    a.mats.forEach((m) => { m.opacity = pop.alpha; });
    a.pivot.visible = pop.alpha > 0.01;
  };

  // Called every tick with the beat-local time s. Decides, from s alone, whether the
  // slot should hold the beat's emoji, and animates it. Never creates a second one.
  function syncAccessory(sm, beat, s, rawDt) {
    const D = beat.dur, outAt = D - OUT_GAP;
    const want = state.accessories === "auto" && s >= IN_AT && s < outAt + OUT_DUR;
    if (sm.acc && (sm.acc.id !== beat.emoji || sm.acc.beatIndex !== sm.beat)) removeAccessory(sm);
    if (!want) {
      if (sm.acc) {
        // switched off (or the beat ended): pop out quickly from wherever it is, then free the slot
        sm.acc.exit = (sm.acc.exit ?? 0) + rawDt;
        const k = sm.acc.exit / OUT_DUR;
        if (k >= 1 || reduce) removeAccessory(sm); else { setAcc(sm.acc, popOut(k), sm.time); sm.dirty = true; }
      }
      return;
    }
    if (!sm.acc) {
      sm.acc = buildAccessory(sm, beat.emoji);
      if (!sm.acc) return; // not loaded yet: show none this beat rather than guess
      sm.acc.beatIndex = sm.beat;
    }
    sm.acc.exit = undefined;
    let pop;
    if (reduce) pop = { scale: 1, rot: TILT, alpha: 1 };
    else if (s < IN_AT + IN_DUR) pop = popIn((s - IN_AT) / IN_DUR);
    else if (s < outAt) pop = { scale: 1, rot: TILT, alpha: 1 };
    else pop = popOut((s - outAt) / OUT_DUR);
    setAcc(sm.acc, pop, sm.time);
    // gentle float while it stays
    const bob = reduce ? 0 : Math.sin(sm.time * 2.2 + sm.acc.seed) * 0.035 * sm.emojiSize;
    sm.acc.pivot.position.set(sm.anchor.x, sm.anchor.y + bob, sm.anchor.z);
    sm.dirty = true;
  }

  // ---- characters --------------------------------------------------------------------------
  // Every character object: { root(group in scene), unitSize, region(Box3), start(beat, instant), update(dt, s, beat, w), dispose() }
  const rigged = (sm, group, box) => {
    // holder rotates about the character's centre; group is positioned so the scene looks unchanged
    const centre = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.position.copy(centre);
    group.position.sub(centre);
    holder.add(group);
    sm.scene.add(holder);
    return { holder, centre, unit: Math.max(box.max.x - box.min.x, box.max.y - box.min.y) };
  };
  const applyRigid = (rig, beat, s, w) => {
    const tr = beat.motion ? evaluateMotion(beat.motion, reduce ? (beat.motion === "Spin" ? 1.9 : 0.55) : s) : ID();
    rig.holder.position.set(rig.centre.x, rig.centre.y + tr.posY * rig.unit * w, rig.centre.z);
    rig.holder.rotation.set(tr.rotX * w, wrapAngle(tr.rotY) * w, tr.rotZ * w);
    rig.holder.scale.set(1 + (tr.scaleX - 1) * w, 1 + (tr.scaleY - 1) * w, 1 + (tr.scaleX - 1) * w);
  };

  async function makeHand(sm) {
    const sphere = sm.cfg.kind === "sphere";
    const gltf = await handAsset();
    const root = SkeletonUtils.clone(gltf.scene);
    root.updateMatrixWorld(true);
    const bones = new Map(), meshes = [];
    let skin = null;
    const FRONT = new THREE.Vector3(0, 0, 1);
    root.traverse((n) => {
      if (n.isBone && /^(Thumb|Index|Middle|Ring|Pinky)_[123]$/.test(n.name)) {
        const pq = new THREE.Quaternion(); n.parent?.getWorldQuaternion(pq);
        bones.set(n.name, { bone: n, rest: n.quaternion.clone(), restPosition: n.position.clone(), front: n.name.endsWith("_1") ? FRONT.clone().applyQuaternion(pq.invert()) : null });
      }
      if (!n.isMesh) return;
      n.frustumCulled = false;
      if (HIDDEN_FACE_MATERIALS.includes(n.material.name)) n.visible = false;
      if (n.material.name === "HandSkin") {
        skin = new THREE.MeshPhysicalMaterial({ color: n.material.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
        n.material = skin;
      }
      if (n.morphTargetDictionary) meshes.push(n);
    });
    skin?.color.set(sm.cfg.tint);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    gltf.animations.forEach((c) => { actions[c.name] = mixer.clipAction(c); });
    const weights = {};
    const writeMorphs = (shapeW) => meshes.forEach((m) => {
      const d = m.morphTargetDictionary;
      for (const k in d) m.morphTargetInfluences[d[k]] = k === "shapeSphere" ? shapeW : (weights[k] || 0);
    });
    const shapeW = sphere ? 1 : 0;
    writeMorphs(shapeW);
    actions.Idle?.play(); mixer.update(0.01);
    const box = preciseBox(root);
    const rig = rigged(sm, root, box);
    const q = new THREE.Quaternion(), swing = new THREE.Quaternion(), axisX = new THREE.Vector3(1, 0, 0);
    const curl = (pose) => {
      const def = POSES[pose]; if (!def) return;
      bones.forEach(({ bone, rest, restPosition, front }, name) => {
        const [finger, seg] = name.split("_");
        const deg = def.fingers[finger][Number(seg) - 1];
        q.setFromAxisAngle(axisX, deg * DEG);
        bone.quaternion.copy(rest).multiply(q);
        if (front) {
          swing.setFromAxisAngle(front, (def.splay?.[finger] || 0) * DEG);
          bone.quaternion.premultiply(swing);
          bone.position.copy(restPosition).addScaledVector(front, 0.25 * Math.min(1, Math.abs(deg) / 60));
        }
      });
    };
    let action = actions.Idle, blinkAt = 2;
    const ch = {
      box, rig,
      start(beat, instant) {
        const next = actions[beat.clip || "Idle"] || actions.Idle;
        next.setEffectiveTimeScale(beat.cspeed || 1);
        if (action !== next) { if (!instant) action?.fadeOut(0.25); else action?.stop(); next.reset(); if (!instant) next.fadeIn(0.25); next.play(); action = next; }
        if (instant) mixer.update(0.5);
      },
      update(dt, s, beat, w) {
        const f = 1 - Math.exp(-12 * dt), target = EXPRESSIONS[beat.hexpr] || {};
        blinkAt -= dt;
        if (blinkAt < -0.12) blinkAt = 2 + Math.random() * 3;
        const blink = blinkAt < 0 && !reduce ? 1 : 0;
        new Set([...Object.keys(weights), ...Object.keys(target)]).forEach((k) => {
          let goal = target[k] || 0;
          if (blink && (k === "eyeBlinkLeft" || k === "eyeBlinkRight")) goal = Math.max(goal, 1);
          const cur = weights[k] || 0;
          weights[k] = dt === 0 ? goal : cur + (goal - cur) * f;
        });
        writeMorphs(shapeW);
        if (!sphere) {
          if (dt > 0) mixer.update(dt);
          if (beat.pose) curl(beat.pose);
        }
        applyRigid(rig, beat, s, w);
      },
      dispose() { sm.scene.remove(rig.holder); mixer.stopAllAction(); mixer.uncacheRoot(root); skin?.dispose(); },
    };
    return ch;
  }

  async function makeMochi(sm) {
    const id = sm.cfg.mochi;
    const gltf = await loadGlb(`${MOCHI_DIR}${id}.glb`);
    const root = SkeletonUtils.clone(gltf.scene);
    let faceMat = null;
    root.traverse((n) => { if (n.isMesh && n.material.name === "face") { n.material = n.material.clone(); faceMat = n.material; } });
    const faceDef = gltf.parser.json.materials.find((x) => x.name === "face");
    const texIdx = faceDef?.extras?.faceStates || {};
    const textures = new Map();
    let face = "neutral", disposed = false;
    const applyTex = async (st) => {
      if (!faceMat || texIdx[st] == null) return;
      if (!textures.has(st)) { const tex = await gltf.parser.getDependency("texture", texIdx[st]); tex.colorSpace = THREE.SRGBColorSpace; textures.set(st, tex); }
      if (disposed) return;
      faceMat.map = textures.get(st); faceMat.needsUpdate = true; sm.dirty = true;
    };
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    gltf.animations.forEach((c) => { actions[c.name] = mixer.clipAction(c); });
    actions.idle?.play(); mixer.update(0.01);
    const box = preciseBox(root);
    const rig = rigged(sm, root, box);
    let action = actions.idle, blinkAt = 1.5, blinkUntil = 0, t = 0;
    await applyTex("neutral");
    return {
      box, rig,
      start(beat, instant) {
        const next = actions[beat.clip] || actions.idle;
        if (action !== next) { if (!instant) action?.fadeOut(0.25); else action?.stop(); next.reset(); if (!instant) next.fadeIn(0.25); next.play(); action = next; }
        if (instant) mixer.update(0.45);
        face = beat.face || "neutral"; applyTex(face);
      },
      update(dt) {
        t += dt;
        if (!reduce && face === "neutral") {
          if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2 + Math.random() * 3; applyTex("blink"); }
          else if (blinkUntil && t > blinkUntil) { blinkUntil = 0; applyTex("neutral"); }
        }
        if (dt > 0) mixer.update(dt);
      },
      dispose() { disposed = true; sm.scene.remove(rig.holder); mixer.stopAllAction(); mixer.uncacheRoot(root); faceMat?.dispose(); },
    };
  }

  async function makeFace(sm) {
    const names = [...new Set(sm.cfg.beats.map((b) => b.face))];
    const gltfs = await Promise.all(names.map((n) => loadGlb(`${FACE_DIR}${n}.glb`)));
    const mats = [], bodies = new Map();
    const group = new THREE.Group();
    names.forEach((n, i) => {
      const r = gltfs[i].scene.clone(true);
      r.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone(); mats.push(m.material);
        if (m.material.name === "Clay") m.material.color.set(sm.cfg.tint);
      });
      r.visible = false; bodies.set(n, r); group.add(r);
    });
    const first = bodies.get(names[0]); first.visible = true;
    const box = preciseBox(group);
    const rig = rigged(sm, group, box);
    let current = names[0], since = 1;
    return {
      box, rig,
      start(beat) { current = beat.face; bodies.forEach((b, n) => { b.visible = n === current; }); since = 0; },
      update(dt, s, beat, w) {
        since += dt;
        applyRigid(rig, beat, s, w);
        // a small squash-and-settle each time the face swaps
        const k = reduce ? 1 : clamp01(since / 0.35), pulse = 1 + 0.14 * Math.sin(Math.PI * k) * (1 - k);
        rig.holder.scale.multiplyScalar(pulse);
      },
      dispose() { sm.scene.remove(rig.holder); mats.forEach((m) => m.dispose()); },
    };
  }

  // ---- samples: DOM, lifecycle --------------------------------------------------------------
  const samples = [];
  grid.replaceChildren();
  const DESCRIBE = {
    hand: "Live 3D Kamiji hand", sphere: "Live 3D Kamiji sphere head", mochi: "Live 3D Kamikin mochi", face: "Live 3D face emoji character",
  };
  SAMPLES.forEach((cfg, i) => {
    const li = document.createElement("li");
    li.className = "mo-item";
    li.innerHTML = `<figure class="mo-fig"><div class="mo-stage viewer" role="img"><canvas></canvas><p class="fallback" hidden></p></div><figcaption><span class="mo-name"></span><span class="mo-state"></span><span class="mo-acc"></span></figcaption></figure>`;
    li.querySelector(".mo-name").textContent = cfg.title;
    const stage = li.querySelector(".mo-stage");
    stage.setAttribute("aria-label", `${DESCRIBE[cfg.kind]}, ${cfg.title}, cycling through ${[...new Set(cfg.beats.map((b) => b.move))].join(", ")} with one emoji accessory at a time`);
    grid.append(li);
    const canvas = stage.querySelector("canvas");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.6));
    const key = new THREE.DirectionalLight(0xffefd2, 2); key.position.set(-1.5, 2, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const starts = []; let total = 0;
    cfg.beats.forEach((b) => { starts.push(total); total += b.dur; });
    const sm = {
      cfg, li, stage, canvas, ctx: canvas.getContext("2d"), scene, camera, starts, total,
      nameEl: li.querySelector(".mo-name"), stateEl: li.querySelector(".mo-state"), accEl: li.querySelector(".mo-acc"),
      near: false, far: false, loaded: false, loading: false, ch: null, acc: null, beat: -1, time: 0, dirty: true,
      anchor: new THREE.Vector3(), emojiSize: 0.3, shown: "", index: i,
    };
    sm.time = reduce ? stillTime(sm) : Math.random() * total; // random phase: the grid never moves in lockstep
    const near = new IntersectionObserver((e) => { sm.near = e[e.length - 1].isIntersecting; sm.dirty = true; }, { rootMargin: "120px" });
    const far = new IntersectionObserver((e) => { sm.far = e[e.length - 1].isIntersecting; if (!sm.far && sm.loaded) unload(sm); }, { rootMargin: "1400px" });
    near.observe(stage); far.observe(stage);
    sm.destroy = () => { near.disconnect(); far.disconnect(); unload(sm); };
    samples.push(sm);
    writeCaption(sm, cfg.beats[beatAt(sm, sm.time).i], false);
  });

  function stillTime(sm) {
    const b = sm.cfg.beats[sm.cfg.still];
    return sm.starts[sm.cfg.still] + Math.min(b.dur - OUT_GAP - 0.2, IN_AT + IN_DUR + 0.9);
  }
  function beatAt(sm, time) {
    let i = sm.starts.length - 1;
    while (i > 0 && time < sm.starts[i]) i -= 1;
    return { i, s: time - sm.starts[i] };
  }
  function writeCaption(sm, beat, withAcc) {
    const accName = sm.acc && sm.acc.pivot.visible && !sm.acc.exit ? labelOf(sm.acc.id) : "none";
    const line1 = `${beat.move} · ${beat.expr}`, line2 = `accessory: ${accName}`;
    if (sm.shown === line1 + line2) return;
    sm.shown = line1 + line2;
    sm.stateEl.textContent = line1; sm.accEl.textContent = line2;
  }

  async function load(sm) {
    sm.loading = true;
    try {
      const make = { hand: makeHand, sphere: makeHand, mochi: makeMochi, face: makeFace }[sm.cfg.kind];
      const [ch] = await Promise.all([make(sm), ...sm.cfg.beats.map((b) => preload(b.emoji))]);
      if (!sm.far && !sm.near) { ch.dispose(); sm.loading = false; return; }
      // Frame the character plus the accessory spot, then fix the camera for good.
      const b = ch.box, u = ch.rig.unit, sx = b.max.x - b.min.x;
      sm.emojiSize = 0.38 * u;
      const c = b.getCenter(new THREE.Vector3());
      sm.anchor.set(c.x + sx / 2 + 0.1 * u, b.max.y - 0.02 * u + 0.04 * u, c.z);
      const e = sm.emojiSize / 2;
      const minX = b.min.x - 0.06 * u, maxX = sm.anchor.x + e + 0.08 * u;
      const minY = b.min.y - 0.06 * u - 0.05 * u, maxY = sm.anchor.y + e + 0.08 * u + 0.06 * u;
      const extent = Math.max(maxX - minX, maxY - minY) * 1.12;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const dist = (extent / 2) / Math.tan(THREE.MathUtils.degToRad(sm.camera.fov / 2));
      sm.camera.position.set(cx, cy, c.z + dist + (b.max.z - b.min.z) / 2);
      sm.camera.lookAt(cx, cy, c.z);
      sm.ch = ch; sm.loaded = true; sm.loading = false;
      sm.beat = -1; sm.dirty = true;
      const { i } = beatAt(sm, sm.time);
      enterBeat(sm, i, true);
    } catch (err) {
      sm.loading = false;
      console.warn("Kamiji motion: load failed", sm.cfg.id, err);
      const p = sm.stage.querySelector(".fallback"); p.textContent = "Could not load this model."; p.hidden = false;
      sm.canvas.setAttribute("hidden", "");
    }
  }
  function unload(sm) {
    removeAccessory(sm);
    sm.ch?.dispose(); sm.ch = null; sm.loaded = false; sm.beat = -1;
    sm.ctx.clearRect(0, 0, sm.canvas.width, sm.canvas.height);
  }
  function enterBeat(sm, i, instant) {
    removeAccessory(sm); // the slot is always empty when a new beat begins
    sm.beat = i;
    sm.ch.start(sm.cfg.beats[i], instant || reduce);
  }

  function draw(sm) {
    const w = Math.max(1, Math.round(sm.stage.clientWidth * dpr)), h = Math.max(1, Math.round(sm.stage.clientHeight * dpr));
    if (sm.canvas.width !== w || sm.canvas.height !== h) { sm.canvas.width = w; sm.canvas.height = h; }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.render(sm.scene, sm.camera);
    sm.ctx.clearRect(0, 0, w, h);
    sm.ctx.drawImage(renderer.domElement, 0, 0, w, h);
  }

  function step(sm, rawDt) {
    const dt = reduce || state.paused ? 0 : rawDt * state.speed;
    if (dt > 0) { sm.time += dt; if (sm.time >= sm.total) sm.time -= sm.total * Math.floor(sm.time / sm.total); }
    const { i, s } = beatAt(sm, sm.time);
    if (i !== sm.beat) enterBeat(sm, i, false);
    const beat = sm.cfg.beats[i];
    // motions fade in and out at the beat edges so changing movement never snaps
    const w = reduce ? 1 : Math.min(1, s / MOTION_FADE, (beat.dur - s) / MOTION_FADE);
    sm.ch.update(dt, s, beat, clamp01(w));
    syncAccessory(sm, beat, s, rawDt);
    writeCaption(sm, beat);
    return dt > 0 || sm.dirty;
  }

  // ---- controls --------------------------------------------------------------------------------
  const playBtn = $("mo-play"), accBtns = [...document.querySelectorAll("[data-mo-acc]")];
  const speedIn = $("mo-speed"), speedOut = $("mo-speed-out"), note = $("mo-note");
  const syncControls = () => {
    playBtn.textContent = state.paused ? "Play" : "Pause";
    playBtn.setAttribute("aria-pressed", String(state.paused));
    playBtn.disabled = reduce; speedIn.disabled = reduce;
    note.hidden = !reduce;
    accBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.moAcc === state.accessories)));
    speedOut.textContent = SPEEDS[Number(speedIn.value)].name;
    speedIn.setAttribute("aria-valuetext", SPEEDS[Number(speedIn.value)].name);
  };
  playBtn.addEventListener("click", () => { state.paused = !state.paused; syncControls(); });
  accBtns.forEach((b) => b.addEventListener("click", () => { state.accessories = b.dataset.moAcc; samples.forEach((s) => { if (state.accessories === "none" && !s.near) removeAccessory(s); s.dirty = true; }); syncControls(); }));
  speedIn.addEventListener("input", () => { state.speed = SPEEDS[Number(speedIn.value)].v; syncControls(); });
  const onReduce = () => {
    reduce = reduceQuery.matches;
    samples.forEach((sm) => { if (reduce) { sm.time = stillTime(sm); if (sm.loaded) enterBeat(sm, sm.cfg.still, true); } sm.dirty = true; });
    syncControls();
  };
  reduceQuery.addEventListener?.("change", onReduce);
  speedIn.value = "1";
  syncControls();

  // ---- the loop: 30 fps, visible samples only ----------------------------------------------
  let last = performance.now(), acc = 0;
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
    acc += dt;
    if (acc >= 1 / 30) {
      const stepDt = acc; acc = 0;
      for (const sm of samples) {
        if (!sm.near) continue;
        if (!sm.loaded) { if (!sm.loading) load(sm); continue; }
        if (step(sm, stepDt)) { draw(sm); sm.dirty = false; }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("resize", () => samples.forEach((sm) => (sm.dirty = true)));
  addEventListener("pagehide", () => { samples.forEach((sm) => sm.destroy()); renderer.dispose(); });

  // Test and debugging hook: how many accessory meshes are visible around each sample.
  window.__kamijiMotion = {
    samples,
    counts: () => samples.map((sm) => {
      let n = 0, id = null;
      sm.scene.traverse((o) => { if (o.userData.accessory && o.visible) { n += 1; id = o.userData.accessory; } });
      return { id: sm.cfg.id, loaded: sm.loaded, near: sm.near, accessories: n, accessory: id, beat: sm.beat, move: sm.beat >= 0 ? sm.cfg.beats[sm.beat].move : null };
    }),
  };
}

boot();
