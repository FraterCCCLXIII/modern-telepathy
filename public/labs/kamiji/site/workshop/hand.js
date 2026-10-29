// Hand studio: build a Kamiji hand. The rig maths (pose curls, splay and
// stretch tweaks, knuckle lift, motions, expression table) is ported from
// src/kamiji-pose-tween.ts, src/kamiji-motion.ts and src/kamiji-expressions.ts.
import {
  mountStudio, ASSETS, TINTS, reduceMotion, jsxElement, jsxList, shadowProps, lookProps, lookLayers, LOOK_DEFAULTS,
} from "./shared.js";

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
const HIDDEN_MATERIALS = ["FaceInk", "FaceTongue", "FaceGlint"]; // mouth, brows and glints are off in the library too
const SHAPES = { hand: [0, 0], sphere: [1, 0], cube: [0, 1] };
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const BONES = FINGERS.flatMap((f) => [1, 2, 3].map((i) => `${f}_${i}`));
const ANIMATIONS = ["Idle", "Wave", "Think", "Celebrate", "Spin", "Bounce", "TurnPoint", "Hello", "Typing"];
const POSES = ["none", "open", "fist", "point", "peace", "thumbsUp", "rock", "three", "one", "two", "four", "five", "ok", "thumbsDown", "callMe"];
const poseLabel = (p) => p.replace(/([A-Z])/g, " $1").toLowerCase();

// ---- pose table (kamiji-pose-tween.ts)
const STRAIGHT = [0, 0, 0], CURLED_LONG = [50, 70, 50], CURLED_RING = [50, 45, 45], CURLED_PINKY = [50, 40, 35];
const THUMB_TUCKED = [45, 40, 25], THUMB_UP = [0, 0, 0], THUMB_RING = [45, 45, 35], INDEX_RING = [60, 75, 50];
const pose = (Thumb, Index, Middle, Ring, Pinky) => ({ Thumb, Index, Middle, Ring, Pinky });
const POSE_FINGERS = {
  open: pose(STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT),
  fist: pose(THUMB_TUCKED, CURLED_LONG, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  point: pose(THUMB_TUCKED, STRAIGHT, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  peace: pose(THUMB_TUCKED, STRAIGHT, STRAIGHT, CURLED_RING, CURLED_PINKY),
  thumbsUp: pose(THUMB_UP, CURLED_LONG, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  rock: pose(THUMB_TUCKED, STRAIGHT, CURLED_LONG, CURLED_RING, STRAIGHT),
  three: pose(THUMB_TUCKED, STRAIGHT, STRAIGHT, STRAIGHT, CURLED_PINKY),
  one: pose(THUMB_TUCKED, STRAIGHT, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  two: pose(THUMB_TUCKED, STRAIGHT, STRAIGHT, CURLED_RING, CURLED_PINKY),
  four: pose(THUMB_TUCKED, STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT),
  ok: pose(THUMB_RING, INDEX_RING, STRAIGHT, STRAIGHT, STRAIGHT),
  thumbsDown: pose(THUMB_UP, CURLED_LONG, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  callMe: pose(THUMB_UP, CURLED_LONG, CURLED_LONG, CURLED_RING, STRAIGHT),
  five: pose(STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT),
};
const THUMB_ACROSS = 45;
const POSE_TWEAKS = {
  fist: { splay: { Thumb: THUMB_ACROSS } },
  point: { splay: { Thumb: THUMB_ACROSS, Index: 14 } },
  peace: { splay: { Thumb: THUMB_ACROSS, Index: -4, Middle: 6 } },
  thumbsUp: { splay: { Thumb: 26 }, stretch: { Thumb: 1.35 } },
  thumbsDown: { splay: { Thumb: -140 }, stretch: { Thumb: 1.35 } },
  rock: { splay: { Thumb: THUMB_ACROSS, Pinky: -20 } },
  callMe: { splay: { Thumb: 10 } },
  ok: { splay: { Thumb: 22, Index: -6, Middle: 4 } },
};
const perFinger = (v, o = {}) => ({ Thumb: v, Index: v, Middle: v, Ring: v, Pinky: v, ...o });
const getCurls = (p) => { const c = {}; FINGERS.forEach((f) => [0, 1, 2].forEach((i) => { c[`${f}_${i + 1}`] = POSE_FINGERS[p][f][i]; })); return c; };
const getTweak = (p) => ({ splay: perFinger(0, POSE_TWEAKS[p]?.splay), stretch: perFinger(1, POSE_TWEAKS[p]?.stretch) });
const easeInOut = (t) => { const x = Math.min(1, Math.max(0, t)); return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };
const knuckleLift = (deg) => 0.25 * Math.min(1, Math.abs(deg) / 60);

// ---- motions (kamiji-motion.ts)
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const IDENT = { posX: 0, rotX: 0, rotY: 0, rotZ: 0, posY: 0, scaleX: 1, scaleY: 1 };
const MOTION_BASE = { Spin: "Idle", Bounce: "Idle", TurnPoint: "Idle", Hello: "Wave", Typing: "Think" };
const MOTION_SPEED = { Typing: 2.6 };
const MOTION_POSE = { TurnPoint: "point" };
function evaluateMotion(m, t) {
  switch (m) {
    case "Spin": { const k = clamp01(((t % 2.2) / 2.2) / 0.75); return { ...IDENT, rotY: easeInOut(k) * TAU, posY: 0.08 * Math.sin(Math.PI * k) }; }
    case "Bounce": { const lift = Math.abs(Math.sin((Math.PI * t) / 0.8)); const g = (1 - lift) ** 3; return { ...IDENT, posY: 0.2 * lift, scaleY: 1 - 0.18 * g, scaleX: 1 + 0.18 * 0.65 * g }; }
    case "TurnPoint": {
      const s = t % 3.2; let turn;
      if (s < 0.55) turn = easeInOut(s / 0.55); else if (s < 2.35) turn = 1; else turn = 1 - easeInOut(clamp01((s - 2.35) / 0.55));
      const holding = s >= 0.55 && s < 2.35 ? 1 : 0;
      return { ...IDENT, rotZ: (-Math.PI / 2) * turn + holding * 0.05 * Math.sin((s - 0.55) * 9) };
    }
    case "Hello": { const ph = (TAU * t) / 1.1; return { ...IDENT, rotY: 0.6 * Math.sin(ph), rotZ: 0.12 * Math.sin(ph + Math.PI / 2) }; }
    case "Typing": return { ...IDENT, rotX: (50 * Math.PI) / 180, posY: 0.012 * Math.sin(t * 14) };
    default: return IDENT;
  }
}
const wrapAngle = (r) => { const w = (((r + Math.PI) % TAU) + TAU) % TAU - Math.PI; return w === -Math.PI ? Math.PI : w; };

async function createHand({ engine, stage, state }) {
  const { THREE, SkeletonUtils } = engine;
  const gltf = await engine.load(`${ASSETS}kamiji.glb`);
  const hand = SkeletonUtils.clone(gltf.scene);
  const outer = new THREE.Group();
  outer.add(hand);
  hand.updateMatrixWorld(true);

  const bones = new Map(), morphMeshes = [];
  let skin = null;
  hand.traverse((n) => {
    if (n.isBone && BONES.includes(n.name)) {
      const pq = new THREE.Quaternion();
      n.parent?.getWorldQuaternion(pq);
      bones.set(n.name, {
        bone: n, rest: n.quaternion.clone(), restPos: n.position.clone(),
        front: n.name.endsWith("_1") ? new THREE.Vector3(0, 0, 1).applyQuaternion(pq.invert()) : null,
      });
    }
    if (!n.isMesh) return;
    const mat = n.material;
    if (HIDDEN_MATERIALS.includes(mat.name)) n.visible = false;
    if (mat.name === "HandSkin") {
      skin = new THREE.MeshPhysicalMaterial({ name: "HandSkin", color: mat.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
      n.material = skin;
    } else n.material = mat.clone();
    if (n.morphTargetDictionary) morphMeshes.push(n);
  });
  const faceMesh = hand.getObjectByName("FaceMesh");

  const mixer = new THREE.AnimationMixer(hand);
  const clipOf = (name) => gltf.animations.find((c) => c.name === name);

  // live state
  const S = { expression: "neutral", shape: "hand", anim: null, pose: undefined };
  let weights = {}, shapeW = [0, 0], elapsed = 0, motionStart = 0, nextBlink = 2;
  let curls = getCurls("open"), tweak = getTweak("open"), tween = null, poseMode = false, resumeClip = false, action = null;
  const motion = { ...IDENT };

  function playClip() {
    const name = MOTION_BASE[S.anim] || S.anim;
    const clip = clipOf(name);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    next.setEffectiveTimeScale(MOTION_SPEED[S.anim] || 1);
    if (action && action !== next) action.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    action = next;
  }

  function applyCurls() {
    const scale = 1 - Math.min(1, shapeW[0] + shapeW[1]);
    const q = new THREE.Quaternion(), swing = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0);
    bones.forEach(({ bone, rest, restPos, front }, name) => {
      const curl = curls[name] * scale;
      q.setFromAxisAngle(axis, (curl * Math.PI) / 180);
      bone.quaternion.copy(rest).multiply(q);
      if (front) {
        const finger = name.split("_")[0];
        swing.setFromAxisAngle(front, (tweak.splay[finger] * scale * Math.PI) / 180);
        bone.quaternion.premultiply(swing);
        bone.scale.y = 1 + (tweak.stretch[finger] - 1) * scale;
        bone.position.copy(restPos).addScaledVector(front, knuckleLift(curl));
      }
    });
  }

  function setPose(p) {
    S.pose = p;
    const effective = p ?? MOTION_POSE[S.anim];
    if (!effective && !poseMode) return;
    if (!poseMode) {
      mixer.stopAllAction(); mixer.update(0); action = null;
      curls = getCurls("open"); tweak = getTweak("open"); poseMode = true;
    }
    resumeClip = !effective;
    const to = getCurls(effective || "open"), toTweak = getTweak(effective || "open");
    if (reduceMotion) {
      tween = null; curls = to; tweak = toTweak; applyCurls(); finishPose();
    } else {
      tween = { from: { ...curls }, to, fromTweak: structuredClone(tweak), toTweak, t: 0, dur: 0.45 };
    }
  }
  function finishPose() { if (!resumeClip) return; resumeClip = false; poseMode = false; playClip(); }

  function stepTween(dt) {
    tween.t = Math.min(tween.dur, tween.t + dt);
    const k = easeInOut(tween.t / tween.dur);
    const c = {};
    BONES.forEach((b) => { c[b] = tween.from[b] + (tween.to[b] - tween.from[b]) * k; });
    curls = c;
    const mix = (a, b) => { const o = {}; FINGERS.forEach((f) => { o[f] = a[f] + (b[f] - a[f]) * k; }); return o; };
    tweak = { splay: mix(tween.fromTweak.splay, tween.toTweak.splay), stretch: mix(tween.fromTweak.stretch, tween.toTweak.stretch) };
    if (tween.t >= tween.dur) { tween = null; finishPose(); }
  }

  function applyFace(dt) {
    const f = 1 - Math.exp(-12 * dt);
    const target = EXPRESSIONS[S.expression] || {};
    nextBlink -= dt;
    if (nextBlink < -0.12) nextBlink = 2 + Math.random() * 3;
    const blinking = nextBlink < 0 && !reduceMotion;
    new Set([...Object.keys(weights), ...Object.keys(target)]).forEach((k) => {
      let goal = target[k] || 0;
      if (blinking && (k === "eyeBlinkLeft" || k === "eyeBlinkRight")) goal = Math.max(goal, 1);
      const cur = weights[k] || 0;
      const nv = dt === 0 ? goal : cur + (goal - cur) * f;
      weights[k] = Math.abs(nv - goal) < 0.002 ? goal : nv;
    });
    const [s, c] = SHAPES[S.shape];
    shapeW = dt === 0 ? [s, c] : [shapeW[0] + (s - shapeW[0]) * f, shapeW[1] + (c - shapeW[1]) * f];
    morphMeshes.forEach((m) => {
      const d = m.morphTargetDictionary;
      for (const k in d) m.morphTargetInfluences[d[k]] = k === "shapeSphere" ? shapeW[0] : k === "shapeCube" ? shapeW[1] : weights[k] || 0;
    });
  }

  function applyMotion(dt) {
    let target;
    if (MOTION_BASE[S.anim]) target = evaluateMotion(S.anim, elapsed - motionStart);
    else target = { ...IDENT, rotY: Math.sin(elapsed * 0.6) * 0.2 };
    const blend = dt === 0 ? 1 : 1 - Math.exp(-14 * dt);
    motion.rotX += (target.rotX - motion.rotX) * blend;
    motion.rotY = wrapAngle(motion.rotY + wrapAngle(target.rotY - motion.rotY) * blend);
    motion.rotZ += (target.rotZ - motion.rotZ) * blend;
    motion.posY += (target.posY - motion.posY) * blend;
    motion.scaleX += (target.scaleX - motion.scaleX) * blend;
    motion.scaleY += (target.scaleY - motion.scaleY) * blend;
    hand.rotation.set(motion.rotX, motion.rotY, motion.rotZ);
    hand.position.set(0, motion.posY, 0);
    hand.scale.set(motion.scaleX, motion.scaleY, motion.scaleX);
  }

  // initial frame so the box is measured on the rest pose
  S.anim = "Idle"; playClip(); mixer.update(0);
  const box = new THREE.Box3().setFromObject(hand);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());

  const model = {
    root: outer, center, edge: Math.max(size.x, size.y), floor: box.min.y,
    apply(s) {
      skin?.color.set(s.tint);
      if (faceMesh) faceMesh.visible = s.eyes;
      S.expression = s.expression; S.shape = s.shape;
      const wanted = s.pose === "none" ? undefined : s.pose;
      const animChanged = s.animation !== S.anim;
      if (animChanged) { S.anim = s.animation; motionStart = elapsed; if (!poseMode) playClip(); }
      if (animChanged || wanted !== S.pose) setPose(wanted); // a motion may bring its own default pose
      if (reduceMotion) { applyFace(0); mixer.update(0); }
    },
    tick(dt) {
      elapsed += dt;
      if (tween) stepTween(dt);
      applyFace(dt);
      if (poseMode) applyCurls();
      else if (shapeW[0] + shapeW[1] < 0.5 && dt > 0) mixer.update(dt);
      if (!reduceMotion) applyMotion(dt); else applyMotion(0);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(hand); skin?.dispose(); },
  };
  S.pose = undefined;
  model.apply(state);
  return model;
}

const OPTS = (arr, label = (x) => x) => arr.map((v) => ({ v, l: label(v) }));

mountStudio(async () => ({
  id: "hand",
  title: "Hand studio",
  blurb: "Build a Kamiji hand and copy it as a KamijiAvatar.",
  note: "Approximate here: halo emoji and reactions are 3D objects in the same scene (the library draws each in its own canvas), and the outline and toon are a port of src/kamiji-toon.ts. Pose, shape and expression use the same tables as the library.",
  defaults: { tint: TINTS[0], expression: "happy", eyes: true, pose: "none", shape: "hand", animation: "Idle", ...LOOK_DEFAULTS, halo: [], haloArr: "arc" },
  layers: [
    { key: "tint", title: "Tint", type: "swatches", options: TINTS },
    { key: "expression", title: "Expression", type: "pills", options: OPTS(Object.keys(EXPRESSIONS)) },
    { key: "eyes", title: "Eyes", type: "toggle" },
    { key: "pose", title: "Pose", type: "pills", options: OPTS(POSES, (p) => (p === "none" ? "none (clip)" : poseLabel(p))), note: "A pose tweens the fingers and replaces the clip, as in the library." },
    { key: "shape", title: "Shape", type: "pills", options: OPTS(Object.keys(SHAPES)) },
    { key: "animation", title: "Animation clip", type: "pills", options: OPTS(ANIMATIONS) },
    ...lookLayers(),
    { key: "halo", title: "Halo emoji", type: "emoji", max: 3, groups: ["root", "symbols", "faces", "objects", "shapes"] },
    { key: "haloArr", title: "Halo arrangement", type: "pills", options: OPTS(["arc", "orbit", "burst"]), when: (s) => s.halo.length > 0 },
    { title: "React", type: "action", note: "Sends a burst of emoji. Not saved in the character.", options: OPTS(["heart", "star", "fire", "sparkle", "check", "lightbulb", "anger", "question"], (x) => x) },
  ],
  halo: { key: "halo", arrangementKey: "haloArr", max: 3 },
  reactions: true,
  createModel: createHand,
  describe: (s) => `Live 3D Kamiji hand, ${s.expression}${s.pose !== "none" ? `, pose ${poseLabel(s.pose)}` : ""}, ${s.shape} shape`,
  code(s) {
    const props = [`color="${s.tint}"`, `expression="${s.expression}"`];
    if (s.animation !== "Idle") props.push(`animation="${s.animation}"`);
    if (s.pose !== "none") props.push(`pose="${s.pose}"`);
    if (s.shape !== "hand") props.push(`shape="${s.shape}"`);
    if (!s.eyes) props.push("showFace={false}");
    props.push(...lookProps(s), ...shadowProps(s), "size={240}", 'alt="My Kamiji"');
    const ids = jsxList(s.halo);
    const wrapped = s.halo.length;
    const avatar = jsxElement("KamijiAvatar", props, wrapped ? 1 : 0);
    const body = wrapped ? jsxElement("KamijiHaloAny", [`halo={${ids}}`, `arrangement="${s.haloArr}"`, "size={240}"], 0, avatar) : avatar;
    const jsx = `import { KamijiAvatar${wrapped ? ", KamijiHaloAny" : ""} } from "./vendor/kamiji/src";\n\nexport function MyKamiji() {\n  return (\n${body.split("\n").map((l) => `    ${l}`).join("\n")}\n  );\n}\n\n// Optional: emoji bursts like the React row\n// import { useKamijiReactions, KamijiReactions } from "./vendor/kamiji/src";\n// const reactions = useKamijiReactions();\n// <KamijiReactions reactions={reactions}>{/* the avatar above */}</KamijiReactions>\n// reactions.react("heart", { count: 3 });\n`;
    return { jsx, json: JSON.stringify({ studio: "hand", component: "KamijiAvatar", character: s }, null, 2) };
  },
}));
