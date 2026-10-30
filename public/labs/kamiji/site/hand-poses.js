// Hand poses for the library browser. Ported from the React component so the
// page shows the same finger shapes:
//   - POSE_FINGERS, POSE_TWEAKS, knuckle lift: src/kamiji-pose-tween.ts (copied)
//   - applyCurls (bone maths): src/kamiji-stage.ts (copied, scale fixed at 1)
//   - HAND_EMOJI list: src/kamiji-hand-emoji.ts (copied)
//   - single-hand loops: evaluateLoop in src/kamiji-motion.ts (copied)
// Approximated here: the loops move the whole rigid hand through a pivot group
// (the component also eases toward the loop and adds a slow sway); pair loops
// follow the CSS keyframes in src/kamiji.css with a simple ease-in-out between
// keyframes; pair layout and the black impact lines are placed by eye, not
// pixel-matched. No outline or toon shading.

const STRAIGHT = [0, 0, 0];
// Anatomy: MCP : PIP : DIP curl about 1 : 1.3 : 0.9 when a finger is rolled into the palm, and the outer fingers
// close a little tighter than the index, so the four fingertips stagger instead of piling up.
const CURLED_INDEX = [40, 64, 40];
const CURLED_LONG = [50, 70, 48];
const CURLED_RING = [52, 66, 44];
const CURLED_PINKY = [54, 62, 40];
const THUMB_TUCKED = [12, 30, 18];
const THUMB_UP = [0, 0, 0];
const THUMB_RING = [34, 38, 26];
const INDEX_RING = [40, 60, 40];
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const fing = (Thumb, Index, Middle, Ring, Pinky) => ({ Thumb, Index, Middle, Ring, Pinky });

const POSE_FINGERS = {
  open: fing(STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT, STRAIGHT),
  fist: fing(THUMB_TUCKED, CURLED_INDEX, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  point: fing(THUMB_TUCKED, STRAIGHT, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  peace: fing(THUMB_TUCKED, STRAIGHT, STRAIGHT, CURLED_RING, CURLED_PINKY),
  thumbsUp: fing(THUMB_UP, CURLED_INDEX, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  rock: fing(THUMB_TUCKED, STRAIGHT, CURLED_LONG, CURLED_RING, STRAIGHT),
  ok: fing(THUMB_RING, INDEX_RING, STRAIGHT, STRAIGHT, STRAIGHT),
  // Thumbs down is the thumbs-up hand turned upside down (item.rotate in HAND_EMOJI), so the finger table is shared.
  thumbsDown: fing(THUMB_UP, CURLED_INDEX, CURLED_LONG, CURLED_RING, CURLED_PINKY),
  callMe: fing(THUMB_UP, CURLED_INDEX, CURLED_LONG, CURLED_RING, STRAIGHT),
};

const THUMB_ACROSS = 54;
const POSE_TWEAKS = {
  open: { splay: { Thumb: -8, Index: 4, Ring: -3, Pinky: -8 } }, // even fan: the rest pose spreads the pinky to ~55 deg from the middle finger and the index only ~14
  fist: { splay: { Thumb: THUMB_ACROSS }, stretch: { Thumb: 1.12 } },
  point: { splay: { Thumb: THUMB_ACROSS, Index: 14 }, stretch: { Thumb: 1.12, Index: 1.1 } },
  peace: { splay: { Thumb: THUMB_ACROSS, Index: -4, Middle: 6 }, stretch: { Thumb: 1.12 } },
  thumbsUp: { splay: { Thumb: 26 }, stretch: { Thumb: 1.35 } },
  thumbsDown: { splay: { Thumb: 26 }, stretch: { Thumb: 1.35 } },
  rock: { splay: { Thumb: THUMB_ACROSS, Index: 4, Pinky: -13 }, stretch: { Thumb: 1.12 } },
  callMe: { splay: { Thumb: 4, Pinky: -6 } },
  ok: { splay: { Thumb: 18, Index: -14, Middle: 4, Ring: -6, Pinky: -14 } },
};

const knuckleLift = (deg) => 0.25 * Math.min(1, Math.abs(deg) / 60);

// name, label, kind, pose, animation, pair, expression, rotate, loop (as in src/kamiji-hand-emoji.ts)
export const HAND_EMOJI = [
  { name: "thumbs_up", label: "Thumbs up", kind: "pose", pose: "thumbsUp", expression: "happy", rotate: 8, loop: "thumbsUp" },
  { name: "thumbs_down", label: "Thumbs down", kind: "pose", pose: "thumbsDown", expression: "sad", rotate: 172, upright: true, loop: "thumbsDown" },
  { name: "victory", label: "Victory", kind: "pose", pose: "peace", expression: "happy", loop: "victory" },
  { name: "raised_hand", label: "Raised hand", kind: "pose", pose: "open", expression: "neutral", loop: "raisedHand" },
  { name: "wave_hand", label: "Waving hand", kind: "animation", pose: "open", animation: "Wave", expression: "happy" },
  { name: "ok_hand", label: "OK hand", kind: "pose", pose: "ok", expression: "happy", rotate: -15, yaw: -20, loop: "okHand" },
  { name: "point_up", label: "Point up", kind: "pose", pose: "point", expression: "neutral", loop: "pointUp" },
  { name: "rock_on", label: "Rock on", kind: "pose", pose: "rock", expression: "excited", loop: "rockOn" },
  { name: "fist", label: "Fist", kind: "pose", pose: "fist", expression: "angry", loop: "fist" },
  { name: "call_me", label: "Call me", kind: "pose", pose: "callMe", expression: "happy", loop: "callMe" },
  { name: "clap", label: "Clap", kind: "pair", pair: "clap", expression: "happy", loop: "clap" },
  { name: "pray", label: "Pray", kind: "pair", pair: "pray", expression: "neutral", loop: "pray" },
  { name: "fist_bump", label: "Fist bump", kind: "pair", pair: "fistBump", expression: "excited", loop: "fistBump" },
].map((e) => ({
  ...e, id: e.name, keywords: [e.kind, e.pose || e.pair || e.animation, e.expression].filter(Boolean),
}));

const TAU = Math.PI * 2;
const PERIOD = {
  thumbsUp: 1.8, thumbsDown: 1.8, victory: 1.6, raisedHand: 1.8, okHand: 2, pointUp: 1.4,
  rockOn: 1.2, fist: 1.4, callMe: 1.8, clap: 1.2, pray: 2.4, fistBump: 1.6,
};
const bump = (u, active) => { const k = u / active; return k >= 1 ? 0 : 0.5 - 0.5 * Math.cos(TAU * k); };
const wiggle = (u, active, swings) => { const k = u / active; return k >= 1 ? 0 : Math.sin(Math.PI * k) * Math.sin(TAU * swings * k); };
const REST = { dx: 0, dy: 0, roll: 0, scale: 1, yaw: 0 };

function evaluateLoop(loop, t) {
  const period = PERIOD[loop];
  const u = (((t % period) + period) % period) / period;
  const swing = Math.sin(TAU * u);
  switch (loop) {
    case "thumbsUp": return { ...REST, dy: 0.1 * bump(u, 0.6), roll: 0.08 * bump(u, 0.6) };
    case "thumbsDown": return { ...REST, dy: -0.1 * bump(u, 0.6), roll: -0.08 * bump(u, 0.6) };
    case "victory": return { ...REST, roll: 0.2 * wiggle(u, 0.7, 2) };
    case "raisedHand": return { ...REST, roll: 0.22 * swing, dx: 0.04 * swing };
    case "okHand": return { ...REST, scale: 1 + 0.07 * bump(u, 0.55), roll: 0.1 * wiggle(u, 0.55, 1) };
    case "pointUp": return { ...REST, dy: 0.07 * (0.5 - 0.5 * Math.cos(TAU * u)) };
    case "rockOn": return { ...REST, roll: 0.2 * wiggle(u, 0.75, 3), dy: -0.03 * bump(u, 0.75) };
    case "fist": return { ...REST, dy: 0.09 * bump(u, 0.55), scale: 1 + 0.05 * bump(u, 0.55) };
    case "callMe": return { ...REST, roll: 0.26 * swing, yaw: 0.12 * swing };
    default: return REST;
  }
}

// Pair keyframes copied from kamiji.css: [u, value in % of one hand's width/height].
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
function keyframes(points, u) {
  for (let i = 1; i < points.length; i += 1) {
    if (u <= points[i][0]) {
      const [u0, a] = points[i - 1], [u1, b] = points[i];
      return a + (b - a) * ease((u - u0) / (u1 - u0 || 1));
    }
  }
  return points[points.length - 1][1];
}
const PAIR_KF = {
  clap: {
    left: [[0, -5], [0.38, 8], [0.46, 6], [1, -5]],
    right: [[0, 5], [0.38, -8], [0.46, -6], [1, 5]],
    lines: [[0, 0], [0.3, 0], [0.42, 1], [0.7, 0], [1, 0]],
  },
  pray: { all: [[0, 0], [0.4, -5], [0.7, 2], [1, 0]] },
  fistBump: {
    left: [[0, -6], [0.42, 5], [0.5, 3], [1, -6]],
    right: [[0, 6], [0.42, -5], [0.5, -3], [1, 6]],
    lines: [[0, 0], [0.34, 0], [0.46, 1], [0.75, 0], [1, 0]],
  },
};
// Layouts from kamiji-hands-up.tsx and kamiji-hand-pair.tsx.
const PAIR_LAYOUT = {
  clap: { pose: "open", scale: 0.64, tilt: 10, overlap: 0.4, rotate: 0, lines: { w: 0.36, bottom: 0.74 * 0.64 } },
  pray: { pose: "open", scale: 0.7, tilt: 4, overlap: 0.8, rotate: 8, lines: null },
  fistBump: { pose: "fist", scale: 0.7, tilt: 0, overlap: 0.42, rotate: 0, lines: { w: 0.34, top: 0.02 } },
};
const CLAP_LINES = ["M15 20 L22 36", "M32 6 V30", "M49 20 L42 36"];
const BUMP_LINES = ["M10 24 L18 30", "M32 4 V16", "M54 24 L46 30"];


// assets/kamiji.glb weights a number of distal-phalanx vertices to the neighbouring finger as well (pinky tip -> Ring_2/3
// about 0.4), so a curled ring finger tears the tip of an extended pinky open (rock on, call me). The GLB is shared and must
// not be rebuilt, so the weights are cleaned here, once, on a private copy of the Hand geometry: a vertex that is mostly pinky fades its Ring_x weights out. (Stripping the other fingers' tip blends too leaves long streaks between curled fingers; they stay.)
const cleanedGeometry = new WeakMap();
function cleanHandGeometry(geo, boneNames) {
  let out = cleanedGeometry.get(geo);
  if (out) return out;
  out = geo.clone();
  const si = out.attributes.skinIndex, sw = out.attributes.skinWeight;
  const kind = boneNames.map((n) => (/^Pinky_/.test(n) ? 1 : /^Ring_/.test(n) ? 2 : 0));
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < si.count; i += 1) {
    let pinky = 0, ring = 0;
    for (let k = 0; k < 4; k += 1) { const c = kind[si.getComponent(i, k)], w = sw.getComponent(i, k); if (c === 1) pinky += w; else if (c === 2) ring += w; }
    if (!ring || !pinky) continue;
    const keep = 1 - smooth(0.05, 0.35, pinky / (pinky + ring)); // fade, not a hard cut, so no triangle spans the seam
    let sum = 0;
    for (let k = 0; k < 4; k += 1) { if (kind[si.getComponent(i, k)] === 2) sw.setComponent(i, k, sw.getComponent(i, k) * keep); sum += sw.getComponent(i, k); }
    if (sum > 0) for (let k = 0; k < 4; k += 1) sw.setComponent(i, k, sw.getComponent(i, k) / sum);
  }
  sw.needsUpdate = true;
  cleanedGeometry.set(geo, out);
  return out;
}

/** Build the hand-pose content factory on top of the page's three.js helpers. */
export function createHandPoses(api) {
  const { THREE, SkeletonUtils, reduceMotion, EXPRESSIONS } = api;
  const HIDDEN = ["FaceInk", "FaceTongue", "FaceGlint"];
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  const FRONT = new THREE.Vector3(0, 0, 1);
  const DEG = Math.PI / 180;

  // One cloned, posable hand (skin material of its own).
  function unit(gltf, color, expression, v) {
    const root = SkeletonUtils.clone(gltf.scene);
    root.updateMatrixWorld(true);
    const bones = new Map();
    const meshes = [];
    let skin = null;
    root.traverse((n) => {
      if (n.isBone && /^(Thumb|Index|Middle|Ring|Pinky)_[123]$/.test(n.name)) {
        const pq = new THREE.Quaternion();
        n.parent?.getWorldQuaternion(pq);
        bones.set(n.name, {
          bone: n, rest: n.quaternion.clone(), restPosition: n.position.clone(),
          front: n.name.endsWith("_1") ? FRONT.clone().applyQuaternion(pq.invert()) : null,
        });
      }
      if (!n.isMesh) return;
      n.frustumCulled = false;
      if (HIDDEN.includes(n.material.name)) n.visible = false;
      if (n.material.name === "HandSkin") {
        skin = new THREE.MeshPhysicalMaterial({ color: n.material.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
        n.material = skin;
      }
      if (n.isSkinnedMesh && n.name === "Hand") n.geometry = cleanHandGeometry(n.geometry, n.skeleton.bones.map((b) => b.name));
      if (n.morphTargetDictionary) meshes.push(n);
    });
    const u = { root, skin, bones };
    u.setColor = (col) => skin?.color.set(col);
    u.setColor(color);
    // Expression: the same morph weights as the hero, applied once (no blinking).
    const applyWeights = (name) => {
      const weights = EXPRESSIONS[name] || {};
      meshes.forEach((m) => {
        for (const k in m.morphTargetDictionary) m.morphTargetInfluences[m.morphTargetDictionary[k]] = weights[k] || 0;
      });
    };
    applyWeights(expression);
    // Same maths as KamijiStage.applyCurls with the finger scale fixed at 1.
    const q = new THREE.Quaternion(), swing = new THREE.Quaternion();
    u.setPose = (pose) => {
      const fingers = POSE_FINGERS[pose], tw = POSE_TWEAKS[pose] || {};
      bones.forEach(({ bone, rest, restPosition, front }, name) => {
        const [finger, seg] = name.split("_");
        const curl = fingers[finger][Number(seg) - 1];
        q.setFromAxisAngle(AXIS_X, curl * DEG);
        bone.quaternion.copy(rest).multiply(q);
        if (front) {
          swing.setFromAxisAngle(front, (tw.splay?.[finger] || 0) * DEG);
          bone.quaternion.premultiply(swing);
          bone.scale.y = tw.stretch?.[finger] ?? 1;
          bone.position.copy(restPosition).addScaledVector(front, knuckleLift(curl));
        }
      });
    };
    // Counter-roll of the Face bone (the eyes and the RTK / tube mouth decals are skinned to it, the hand skin is not):
    // keeps the face upright while the whole hand is turned, as lockFace does in src/kamiji-stage.ts (roll only here).
    const faceBone = root.getObjectByName("Face");
    const faceRest = faceBone?.position.clone();
    // The eyes and mouth were modelled on the palm's own dome. Rolled by 180 degrees they sit over a different part of it and
    // sink into the skin, so an upside-down hand also lifts the face off the palm a little.
    // It also slides toward the wrist (hand-local -y, screen-up once inverted) so the mouth, which hangs below the eyes, stays
    // clear of the curled fingers that now cover the lower palm.
    u.setFaceRoll = (rad, lift = 0.1, slide = -0.26) => { if (!faceBone) return; faceBone.quaternion.setFromAxisAngle(AXIS_Z, rad); faceBone.position.copy(faceRest); faceBone.position.z += lift; faceBone.position.y += slide; };
    const face = api.faceFor?.(root, expression, v); // RTK mouth decal on the Face bone (site/rtk-mouth.js)
    u.setExpression = (name) => { applyWeights(name); face?.setExpression?.(name); }; // rail tiles cycle expressions
    u.dispose = () => { skin?.dispose(); face?.dispose(); };
    return u;
  }

  function content(v, item, color = "#ffd23f") {
    const c = { disposed: false };
    let units = [];
    const tv = api.isTile?.(v) ? api.tileVariation(item.id || item.name) : null; // rail tile: own rate, reach, phase, expression timer
    const faceStep = tv && !reduceMotion
      ? api.tileFaceCycle(tv, { base: item.expression || "neutral", exprs: ["happy", "excited", "surprised"], apply: (n) => { units.forEach((u) => u.setExpression(n)); v.dirty = true; } })
      : null;
    c.setColor = (col) => { color = col; units.forEach((u) => u.setColor(col)); v.dirty = true; };
    c.attach = async () => {
      const gltf = await api.handAsset;
      if (c.disposed) return;
      if (item.kind === "pair") attachPair(gltf); else attachSingle(gltf);
    };

    function centeredHand(gltf) {
      const u = unit(gltf, color, item.expression, v);
      u.setPose("open"); // measure at the open pose so every tile has the same scale
      u.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(u.root);
      const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      u.root.position.sub(centre);
      u.square = Math.max(size.x, size.y) * 1.25; // the square the React component fits a hand into
      units.push(u);
      return u;
    }

    function attachSingle(gltf) {
      const u = centeredHand(gltf);
      const outer = new THREE.Group(), loopG = new THREE.Group();
      loopG.add(u.root); outer.add(loopG);
      outer.rotation.z = -(item.rotate || 0) * DEG; // component turns the hand clockwise
      v.scene.add(outer); v.root = outer;
      const unitSize = u.square / 1.25;
      let t = 0;
      if (item.animation) {
        v.mixer = new THREE.AnimationMixer(u.root);
        const clip = gltf.animations.find((x) => x.name === item.animation);
        if (clip) v.mixer.clipAction(clip).play();
        v.mixer.update(reduceMotion ? 0.4 : 0);
        if (tv && !reduceMotion) { v.mixer.timeScale = tv.speed; v.mixer.update(tv.phase * (clip?.duration || 1)); }
      } else u.setPose(item.pose);
      const baseYaw = (item.yaw || 0) * DEG; // static three-quarter turn (the OK ring only reads from a little to the side)
      const baseRoll = -(item.rotate || 0) * DEG; // the wrapper's roll about the view axis
      if (item.upright) u.setFaceRoll(-baseRoll); // upside-down hands keep a right-side-up face
      if (tv && !reduceMotion && !item.animation) t = tv.phase * (PERIOD[item.loop] || 1);
      api.fit(v, outer, 0, false);
      v.camera.position.multiplyScalar(1.18); // room for the loop motion
      const amp = tv ? tv.amp : 1, rate = tv ? tv.speed : 1;
      v.tick = (dt) => {
        if (faceStep && dt > 0) faceStep(dt);
        if (item.animation) { if (dt > 0) v.mixer.update(dt); return dt > 0; }
        if (!item.loop) return false;
        t += dt * rate;
        const l = evaluateLoop(item.loop, t);
        const wx = l.dx * unitSize * amp, wy = l.dy * unitSize * amp; // loop moves in screen space: undo the wrapper's roll
        loopG.position.set(wx * Math.cos(baseRoll) + wy * Math.sin(baseRoll), wy * Math.cos(baseRoll) - wx * Math.sin(baseRoll), 0);
        loopG.rotation.set(0, baseYaw + l.yaw * amp, l.roll * amp);
        if (item.upright) u.setFaceRoll(-(baseRoll + l.roll * amp));
        loopG.scale.setScalar(1 + (l.scale - 1) * amp);
        return dt > 0;
      };
      c.stage = outer;
      v.dirty = true;
    }

    function attachPair(gltf) {
      const lay = PAIR_LAYOUT[item.pair], kf = PAIR_KF[item.pair];
      const P = 1; // the square the pair lives in, in scene units
      const handSize = P * lay.scale;
      const pairG = new THREE.Group();
      const slots = ["left", "right"].map((side) => {
        const u = centeredHand(gltf);
        u.setPose(lay.pose);
        const hg = new THREE.Group();
        hg.scale.setScalar(handSize / u.square);
        if (side === "right") hg.scale.x *= -1; // the right hand is the mirror image
        hg.position.y = handSize / 2;
        hg.add(u.root);
        const slot = new THREE.Group();
        slot.add(hg);
        slot.position.set((side === "left" ? -1 : 1) * handSize * (1 - lay.overlap) / 2, -P / 2, 0);
        slot.rotation.z = (side === "left" ? 1 : -1) * lay.tilt * DEG; // leans like the CSS rotate
        slot.userData.baseX = slot.position.x;
        pairG.add(slot);
        return slot;
      });
      pairG.rotation.z = -lay.rotate * DEG;
      v.scene.add(pairG); v.root = pairG;
      const vis = P * 1.08, dist = (vis / 2) / Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2));
      v.camera.position.set(0, 0, dist); v.camera.lookAt(0, 0, 0);
      // Impact lines (always black): an SVG over the canvas, driven by the loop.
      let svg = null;
      if (lay.lines) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 64 40"); svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("class", "lb-lines");
        svg.style.width = `${lay.lines.w * 100 / 1.08}%`;
        if (lay.lines.top != null) svg.style.top = `${lay.lines.top * 100}%`; else svg.style.bottom = `${lay.lines.bottom * 100}%`;
        svg.innerHTML = `<g fill="none" stroke="#000" stroke-width="7" stroke-linecap="round">${(item.pair === "clap" ? CLAP_LINES : BUMP_LINES).map((d) => `<path d="${d}"/>`).join("")}</g>`;
        v.el.append(svg);
        c.svg = svg;
      }
      let t = tv && !reduceMotion ? tv.phase * PERIOD[item.pair] : 0;
      const rate = tv ? tv.speed : 1;
      v.tick = (dt) => {
        if (faceStep && dt > 0) faceStep(dt);
        t += dt * rate;
        const period = PERIOD[item.pair], u = (((t % period) + period) % period) / period;
        if (kf.left) {
          slots[0].position.x = slots[0].userData.baseX + keyframes(kf.left, u) / 100 * handSize;
          slots[1].position.x = slots[1].userData.baseX + keyframes(kf.right, u) / 100 * handSize;
        }
        if (kf.all) pairG.position.y = -keyframes(kf.all, u) / 100 * handSize;
        if (svg) {
          const o = reduceMotion ? 1 : keyframes(kf.lines, u);
          svg.style.opacity = String(o);
          svg.style.transform = `translateX(-50%) scale(${0.5 + 0.8 * o})`;
        }
        return dt > 0;
      };
      v.dirty = true;
    }

    c.dispose = () => {
      c.disposed = true;
      if (v.root) v.scene.remove(v.root);
      v.mixer?.stopAllAction();
      c.svg?.remove();
      units.forEach((u) => u.dispose());
      units = [];
      v.mixer = null; v.tick = null; v.root = null;
    };
    return c;
  }
  return { content };
}
