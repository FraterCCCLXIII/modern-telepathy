// Figures built from real GLBs: Kamikin (14 bases), Rubbernose (16 bases), Shapes (one mesh, 34 morph targets), Kamiji hand.
// Same interface as the procedural figure (root, update, setClip, setExpression, sockets, applyColors, dispose...).
import { THREE } from "./geo.js";
import { A, STYLE_BY_ID, MORPH_BY_ID, SHAPE_TARGETS } from "./data.js";
import { PARTS } from "./parts.js";
import { loadGltf, cloneScene, extract } from "./glbparts.js";
import { createClassicFace, createDecalFace } from "./faces.js";

export const INDEX = { kamikin: [], rubbernose: [] };
export async function registerGlbBodies() {
  const [m, r] = await Promise.all([fetch(A + "mochi/index.json").then((x) => x.json()), fetch(A + "rubbernose/index.json").then((x) => x.json())]);
  INDEX.kamikin = m.characters; INDEX.rubbernose = r.characters;
  for (const c of m.characters) PARTS.push({ slot: "body", id: c.id, label: (c.name || c.id) + " (" + c.species + ")", kind: "glb", for: ["kamikin"], focus: "all", meta: c, note: "Real GLB: assets/mochi/" + c.glb });
  for (const c of r.characters) PARTS.push({ slot: "body", id: c.id, label: c.name + " (" + c.species + ")", kind: "glb", for: ["rubbernose"], focus: "all", meta: c, note: "Real GLB: assets/rubbernose/" + c.glb });
  for (const t of SHAPE_TARGETS) PARTS.push({ slot: "body", id: t, label: t.replace(/_/g, " "), kind: "glb", for: ["shapes"], focus: "all", note: "Morph target of kamiji-shapes-morph.glb" });
  PARTS.push({ slot: "hands", id: "glove", label: "Gloves on", kind: "glb", for: ["rubbernose"], focus: "all", showMat: "Glove" }, { slot: "hands", id: "bare", label: "No gloves", kind: "glb", for: ["rubbernose"], focus: "all", hideMat: "Glove" },
    { slot: "feet", id: "shoe", label: "Shoes on", kind: "glb", for: ["rubbernose"], focus: "all" }, { slot: "feet", id: "bare", label: "No shoes", kind: "glb", for: ["rubbernose"], focus: "all", hideMat: "Shoe" });
}

const FACE_STATE = { neutral: "neutral", happy: "happy", excited: "joy", thinking: "neutral", sad: "sad", angry: "sad", surprised: "surprised", sleepy: "blink" };
export const KAMIJI_EXPR = {
  neutral: {}, happy: { mouthSmile: 0.9, browUpLeft: 0.3, browUpRight: 0.3 }, excited: { mouthSmile: 1, mouthOpen: 0.6, eyeWideLeft: 0.7, eyeWideRight: 0.7, browUpLeft: 0.6, browUpRight: 0.6 },
  thinking: { browUpLeft: 0.6, mouthFrown: 0.15 }, sad: { mouthFrown: 1, browUpLeft: 0.2, browUpRight: 0.2 }, angry: { browAngryLeft: 1, browAngryRight: 1, mouthFrown: 0.5 },
  surprised: { mouthO: 1, eyeWideLeft: 1, eyeWideRight: 1, browUpLeft: 1, browUpRight: 1 }, sleepy: { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9, mouthSmile: 0.2 },
};

const fakeD = (u) => ({ S: u, torsoLen: u * 0.3, shW: u * 0.12, hipW: u * 0.08, footR: u * 0.05, handR: u * 0.05, legLen: u * 0.3, thigh: u * 0.1, rLeg: u * 0.04, rLimb: u * 0.03, neckR: u * 0.03, headR: u * 0.12 });
const mountOn = (bone, wp, s, quat) => { // socket matrix relative to a bone, from a world position and world scale (rest pose)
  bone.updateWorldMatrix(true, false);
  const m = new THREE.Matrix4().compose(wp, quat || new THREE.Quaternion(), new THREE.Vector3(s, s, s));
  return { parent: bone, matrix: new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(m) };
};

export async function buildGlbFigure(ch, env = {}) {
  const style = ch.style, S = STYLE_BY_ID[style];
  const root = new THREE.Group(); root.name = "Character";
  const holder = new THREE.Group(); holder.name = "Holder"; root.add(holder);
  const fig = { kind: "glb", style, root, holder, mats: {}, regions: [], regionDefaults: {}, sockets: {}, clips: [], faces: [], expression: ch.face?.expression || "neutral", playing: true, reduceMotion: !!env.reduceMotion, joints: {}, upright: false, D: fakeD(1.3), head: null, noOutline: false, outlineWidth: 0.006 };
  let gltf, url, model, k = 1;
  const bodyId = ch.parts?.body;
  if (style === "kamikin") { const m = INDEX.kamikin.find((c) => c.id === bodyId) || INDEX.kamikin.find((c) => c.id === "kamikin-kon") || INDEX.kamikin[0]; fig.bodyId = m.id; url = A + "mochi/" + m.glb; }
  else if (style === "rubbernose") { const m = INDEX.rubbernose.find((c) => c.id === bodyId) || INDEX.rubbernose[0]; fig.bodyId = m.id; url = A + "rubbernose/" + m.glb; fig.noOutline = true; }
  else if (style === "shapes") { url = A + "props/shapes/kamiji-shapes-morph.glb"; fig.bodyId = SHAPE_TARGETS.includes(bodyId) ? bodyId : "drop"; }
  else { url = A + "kamiji.glb"; fig.bodyId = "kamiji"; }
  gltf = await loadGltf(url);
  model = await cloneScene(gltf); holder.add(model);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model), sz = box.getSize(new THREE.Vector3());
  k = style === "shapes" ? 0.62 : style === "kamiji" ? 0.7 : 1.25 / Math.max(sz.y, sz.x * 0.85);
  holder.scale.setScalar(k); holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); root.updateMatrixWorld(true);
  fig.k = k; fig.outlineWidth = 0.0075 / k;
  if (style === "shapes") { holder.position.y = 0.62 * 0.968; }
  const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; }); fig.joints = bones;
  const meshes = []; model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const textures = new Map(); let faceMat = null, texIdx = {};

  // ---- materials by region (GLB material names). Colours start from the GLB's own.
  const cfg = ch.materials || {};
  const regionsDef = { kamikin: ["MochiBody"], rubbernose: ["Clay", "Accent", "Arm", "Leg", "Glove", "Shoe", "Ink"], shapes: ["Clay"], kamiji: ["HandSkin"] }[style];
  const own = [];
  for (const m of meshes) {
    m.material = m.material.clone(); own.push(m.material); m.frustumCulled = false;
    const n = m.material.name;
    if (regionsDef.includes(n)) { (fig.mats[n] ||= []).push(m.material); m.userData.region = n; if (!(n in fig.regionDefaults)) fig.regionDefaults[n] = "#" + m.material.color.getHexString(); }
    m.userData.slot = "body";
    if (n === "face") { faceMat = m.material; m.userData.noOutline = true; m.userData.isFace = true; m.userData.slot = "body"; }
    if (n === "MochiFace") { faceMat = m.material; m.userData.noOutline = true; m.userData.isFace = true; }
    if (n === "Ink") m.userData.noOutline = true;
    if (style === "kamiji" && /^Face/.test(m.name)) { m.userData.noOutline = true; m.userData.isFace = true; }
  }
  fig.regions = regionsDef;
  fig.applyColors = (cur) => { for (const r of regionsDef) { const c = cur.materials?.[r]?.color || fig.regionDefaults[r]; (fig.mats[r] || []).forEach((m) => { m.color.set(c); }); } };
  fig.applyColors(ch);
  if (style === "rubbernose") { // hide gloves / shoes
    const hide = new Set(); for (const slot of ["hands", "feet"]) { const p = PARTS.find((x) => x.slot === slot && x.id === ch.parts?.[slot] && x.for.includes("rubbernose")); if (p?.hideMat) hide.add(p.hideMat); }
    meshes.forEach((m) => { if (hide.has(m.material.name)) m.visible = false; });
  }

  // ---- faces: texture states (Kamikin, Rubbernose) ----
  if (faceMat && (style === "kamikin" || style === "rubbernose")) {
    texIdx = gltf.parser.json.materials.find((x) => x.name === faceMat.name)?.extras?.faceStates || {};
    const apply = async (state) => {
      if (texIdx[state] == null) return;
      if (!textures.has(state)) { const t = await gltf.parser.getDependency("texture", texIdx[state]); t.colorSpace = THREE.SRGBColorSpace; textures.set(state, t); }
      faceMat.map = textures.get(state); faceMat.needsUpdate = true; env.onDirty?.();
    };
    fig.faceStates = Object.keys(texIdx);
    fig.setExpression = (e) => { fig.expression = e; apply(FACE_STATE[e] || "neutral"); };
    let blinkAt = 2 + Math.random() * 2, blinkUntil = 0, t = 0;
    fig.faceTick = (dt) => { if (fig.reduceMotion || fig.expression !== "neutral") return; t += dt; if (t > blinkAt) { blinkUntil = t + 0.12; blinkAt = t + 2.5 + Math.random() * 3; apply("blink"); } else if (blinkUntil && t > blinkUntil) { blinkUntil = 0; apply("neutral"); } };
    fig.setMouthOpen = () => {};
    fig.noMouthOpen = "Texture faces have no mouth-open control; the expression buttons swap the baked face states.";
    if (fig.expression !== "neutral") apply(FACE_STATE[fig.expression] || "neutral");
  }

  // ---- morph targets ----
  const morphMeshes = meshes.filter((m) => m.morphTargetDictionary);
  const eff = (id) => { const d = MORPH_BY_ID[id]; const v = ch.morphs?.[id]; return v == null ? (style === "shapes" && id === "sh_" + fig.bodyId ? 1 : d?.def ?? 0) : v; };
  fig.applyMorphs = (cur) => {
    for (const m of morphMeshes) {
      if (style === "shapes") { for (const t of SHAPE_TARGETS) { const i = m.morphTargetDictionary[t]; if (i != null) { const v = cur.morphs?.["sh_" + t]; m.morphTargetInfluences[i] = v == null ? (t === fig.bodyId ? 1 : 0) : v; } } }
      else if (style === "kamiji") { for (const [name, i] of Object.entries(m.morphTargetDictionary)) { const d = MORPH_BY_ID[name]; if (d) { const v = cur.morphs?.[name]; m.morphTargetInfluences[i] = v == null ? d.def : v; } } }
    }
  };
  fig.applyMorphs(ch);

  // ---- clips ----
  const clipsSrc = gltf.animations;
  fig.clips = clipsSrc;
  fig.mixer = new THREE.AnimationMixer(model);
  fig.setClip = (name) => {
    const clip = clipsSrc.find((c) => c.name === name) || clipsSrc.find((c) => /idle/i.test(c.name)) || clipsSrc[0];
    if (!clip) return;
    const next = fig.mixer.clipAction(clip);
    if (fig.action && fig.action !== next) fig.action.fadeOut(0.2);
    next.reset().fadeIn(0.2).play(); fig.action = next; fig.clipName = clip.name; fig.mixer.update(0.0001);
  };
  fig.setPlaying = (b) => { fig.playing = b; }; fig.setTime = (t) => fig.mixer.setTime(t);
  fig.setClip(ch.pose?.clip || "idle");
  fig.update = (dt) => {
    let c = false;
    if (fig.playing && dt > 0 && clipsSrc.length) { fig.mixer.update(dt); c = true; }
    if (fig.faceTick) fig.faceTick(dt);
    for (const f of fig.faces) if (f.update(dt, fig.reduceMotion)) c = true;
    return c;
  };
  fig.setHats = () => {};

  // ---- head frame and sockets ----
  const R0 = () => new THREE.Vector3();
  const hpos = (b) => b.getWorldPosition(new THREE.Vector3());
  let hf = null; // { c: world centre, R: world radius }
  if (style === "kamikin") {
    const ex = await extract(url, "MochiBody", (b) => /ear|tail|tuft/.test(b), "nonbody");
    const body = ex.body.clone(); const bw2 = (body.max.x - body.min.x) / 2;
    const Rm = bw2 * 0.95; const c = new THREE.Vector3(0, body.max.y - Rm, (body.min.z + body.max.z) / 2);
    // model space -> world (holder transform)
    hf = { c: c.applyMatrix4(holder.matrixWorld), R: Rm * k };
  } else if (style === "rubbernose") {
    const clay = meshes.find((m) => m.material.name === "Clay"); const b = new THREE.Box3().setFromObject(clay); const s2 = b.getSize(new THREE.Vector3());
    const R = 0.5 * Math.min(s2.x, s2.y) * 0.85; hf = { c: new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - R, b.max.z - R * 0.6), R };
  } else if (style === "shapes") {
    fig.headFrame = () => { const b = new THREE.Box3().expandByObject(holder, true); const s2 = b.getSize(new THREE.Vector3()); const R = 0.5 * Math.min(s2.x, s2.y) * 0.8; const c = b.getCenter(new THREE.Vector3()); return { c: new THREE.Vector3(c.x, c.y + (s2.y > s2.x * 1.1 ? s2.y / 2 - R : 0), c.z), R }; };
    hf = fig.headFrame();
  } else { hf = { c: new THREE.Vector3(0.05, 0, 0).applyMatrix4(holder.matrixWorld), R: 0.9 * k }; }
  const headBone = style === "kamikin" ? bones.head : style === "rubbernose" ? bones.body : style === "kamiji" ? bones.Palm : null;
  const mk = (bone, c, R, off = new THREE.Vector3()) => { const p = c.clone().add(off); return bone ? mountOn(bone, p, 2 * R) : { parent: model, matrix: new THREE.Matrix4().compose(model.worldToLocal(p.clone()), new THREE.Quaternion(), new THREE.Vector3(2 * R / k, 2 * R / k, 2 * R / k)) }; };
  const frame = (off) => mk(headBone, hf.c, hf.R, off);
  fig.hf = hf;
  fig.sockets = { head: [frame()], hair: [frame()], ears: [frame()], neck: [frame()], face: [frame()] };
  const unit = hf.R * 2.6; fig.D = fakeD(unit);
  const one = (bone, off = new THREE.Vector3()) => bone ? [mountOn(bone, hpos(bone).add(off), unit)] : [];
  if (style === "kamikin") { fig.sockets.back = one(bones.chest, new THREE.Vector3(0, 0, -hf.R * 0.7)); fig.sockets.waist = one(bones.hips); fig.sockets.hand_L = one(bones.arm_L); fig.sockets.hand_R = one(bones.arm_R); fig.sockets.feet = [bones.leg_L, bones.leg_R].filter(Boolean).map((b) => mountOn(b, hpos(b), unit)); fig.sockets.tail = bones.tail0 ? one(bones.tail0) : []; }
  if (style === "rubbernose") { fig.sockets.back = one(bones.body, new THREE.Vector3(0, 0, -hf.R * 0.9)); fig.sockets.waist = one(bones.body, new THREE.Vector3(0, -hf.R * 0.6, 0)); fig.sockets.hand_L = one(bones.arm_L_9); fig.sockets.hand_R = one(bones.arm_R_9); fig.sockets.feet = [bones.leg_L_9, bones.leg_R_9].filter(Boolean).map((b) => mountOn(b, hpos(b), unit)); }
  fig.head = { rx: hf.R, ry: hf.R, rz: hf.R, cy: 0 };
  fig.headCenter = () => hf.c; fig.headRadius = () => hf.R;
  fig.dropFrame = { c: hf.c, R: hf.R };

  // ---- decal / classic faces on Shapes ----
  if (style === "shapes") {
    const faceRoot = new THREE.Group(); faceRoot.name = "FaceRoot"; holder.add(faceRoot);
    fig.buildFace = (cur) => {
      fig.faces.forEach((f) => { f.dispose?.(); f.group?.parent?.remove(f.group); f.mesh?.parent?.remove(f.mesh); }); fig.faces = [];
      const kind = cur.face?.rig || "classic";
      const b = new THREE.Box3().expandByObject(holder, true), loc = (v) => holder.worldToLocal(v.clone());
      const lo = loc(b.min), hi = loc(b.max);
      const h = { rx: (hi.x - lo.x) / 2, ry: (hi.y - lo.y) / 2, rz: (hi.z - lo.z) / 2, cy: (hi.y + lo.y) / 2, snout: 0 };
      const morph = { eyeSize: cur.morphs?.eyeSize || 0, eyeGap: cur.morphs?.eyeGap || 0, eyeY: cur.morphs?.eyeY || 0, mouthY: cur.morphs?.mouthY || 0 };
      root.updateMatrixWorld(true);
      const mkClassic = () => { const f = createClassicFace(h, { eye: new THREE.MeshStandardMaterial({ color: "#2a2224", roughness: 0.4 }), glint: new THREE.MeshBasicMaterial({ color: "#fff" }), mouthIn: new THREE.MeshStandardMaterial({ color: "#5a1d22" }) }, morph); faceRoot.add(f.group); fig.faces.push(f); };
      if (kind === "classic") mkClassic();
      else { try { const f = createDecalFace(kind, faceRoot, h, morph, meshes.filter((m) => m.visible), { expression: fig.expression, reduceMotion: fig.reduceMotion, onDirty: () => env.onDirty?.() }); if (f && !f.disposed) { if (f.mesh) f.mesh.userData.noOutline = true; fig.faces.push(f); } else mkClassic(); } catch (e) { console.warn("decal face failed", e); mkClassic(); } }
      fig.faces.forEach((f) => { f.setExpression?.(fig.expression); if (fig.openV != null) f.setOpen?.(fig.openV); });
    };
    fig.buildFace(ch);
    fig.setExpression = (e) => { fig.expression = e; fig.faces.forEach((f) => f.setExpression?.(e)); env.onDirty?.(); };
    fig.setMouthOpen = (v) => { fig.openV = v; fig.faces.forEach((f) => f.setOpen?.(v)); env.onDirty?.(); };
  }
  if (style === "kamiji") {
    fig.setExpression = (e) => { fig.expression = e; };
    fig.setMouthOpen = (v) => { for (const m of morphMeshes) { const i = m.morphTargetDictionary.mouthOpen; if (i != null) m.morphTargetInfluences[i] = v; } env.onDirty?.(); };
  }
  fig.dispose = () => { fig.mixer.stopAllAction(); fig.mixer.uncacheRoot(model); fig.faces.forEach((f) => f.dispose?.()); own.forEach((m) => m.dispose()); };
  return fig;
}
