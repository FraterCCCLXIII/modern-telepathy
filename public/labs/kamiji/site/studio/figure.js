// Procedural figure builder: character JSON -> Object3D with a bone hierarchy, parts, materials, face, sockets and clips.
import { THREE, limb, sphere, gradient } from "./geo.js";
import { PARTS, partsFor, partById, defaultPart } from "./parts.js";
import { SLOTS_BY_STYLE, MORPH_BY_ID, PALETTES, DEFAULT_PARTS } from "./data.js";
import { createClassicFace, createDecalFace } from "./faces.js";

export const morphValue = (ch, id) => { const d = MORPH_BY_ID[id]; const v = ch.morphs?.[id]; return v == null ? (d ? d.def : 0) : v; };
export const partOf = (ch, slot) => {
  const style = ch.style, id = ch.parts?.[slot];
  const found = id && PARTS.find((p) => p.slot === slot && p.id === id && p.for.includes(style));
  if (found) return found;
  const d = DEFAULT_PARTS[style]?.[slot];
  return (d && PARTS.find((p) => p.slot === slot && p.id === d && p.for.includes(style))) || partsFor(slot, style)[0] || null;
};
export function resolveColors(ch) {
  const pal = PALETTES[0].c, out = {};
  for (const k of Object.keys(pal)) out[k] = { color: pal[k], color2: pal[k], grad: 0, rough: k === "eye" ? 0.35 : 0.72, ...(ch.materials?.[k] || {}) };
  return out;
}

// ---------------------------------------------------------------- materials
export function makeMaterial(region, cfg, look) {
  const steps = look.steps || 0;
  const isEye = region === "eye";
  const mat = steps && !isEye
    ? new THREE.MeshToonMaterial({ color: cfg.color, gradientMap: gradient(steps), side: region === "accent" ? THREE.DoubleSide : THREE.FrontSide })
    : new THREE.MeshStandardMaterial({ color: cfg.color, roughness: cfg.rough, metalness: 0, side: region === "accent" ? THREE.DoubleSide : THREE.FrontSide });
  mat.name = region;
  const u = { uC2: { value: new THREE.Color(cfg.color2) }, uGrad: { value: cfg.grad || 0 }, uY0: { value: 0 }, uY1: { value: 1.7 } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;").replace("#include <project_vertex>", "#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWY;\nuniform vec3 uC2; uniform float uGrad; uniform float uY0; uniform float uY1;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uC2, uGrad * smoothstep(uY0, uY1, vWY));");
  };
  mat.customProgramCacheKey = () => "studio-grad";
  return mat;
}

// ---------------------------------------------------------------- dimensions
function dims(ch, bodyP) {
  const m = (id) => morphValue(ch, id), b = bodyP;
  const S = b.h * (1 + 0.18 * m("height")), girth = b.w * (1 + 0.28 * m("build")), sq = Math.sqrt(girth);
  const plan = b.plan, up = plan === "upright";
  const D = { S, plan, girth };
  D.ankleH = 0.06 * S;
  const legTot = (s) => (up ? 0.86 : 0.86) * S * b.legK * (1 + 0.22 * m("legLen" + s)) * (up ? 1 : 1);
  D.legLenL = legTot("L"); D.legLenR = legTot("R");
  for (const s of ["L", "R"]) { const t = D["legLen" + s] - D.ankleH; D["thigh" + s] = t * 0.5; D["shin" + s] = t * 0.5; D["arm" + s] = 0.56 * S * (1 + 0.25 * m("armLen" + s)); D["upperArm" + s] = D["arm" + s] * 0.5; D["foreArm" + s] = D["arm" + s] * 0.5; }
  D.thigh = D.thighL; D.legLen = Math.max(D.legLenL, D.legLenR);
  D.torsoLen = (up ? 0.5 : 0.5) * S * (1 + 0.2 * m("torsoLen"));
  D.neckLen = 0.055 * S * (1 + 0.7 * m("neckLen")); D.neckR = 0.045 * S * sq;
  D.headR = 0.135 * S * b.head * (1 + 0.35 * m("headSize"));
  D.shW = 0.19 * S * (1 + 0.3 * m("shoulderW")) * sq; D.hipW = 0.09 * S * (1 + 0.3 * m("hipW")) * sq;
  D.rLimb = 0.046 * S * Math.pow(girth, 0.8) * b.limb; D.rLeg = 0.07 * S * Math.pow(girth, 0.7) * b.limb;
  D.handR = 0.056 * S * (1 + 0.3 * m("handSize")) * Math.sqrt(b.limb); D.footR = 0.06 * S * (1 + 0.3 * m("footSize")) * Math.sqrt(b.limb);
  D.waistK = 1;
  if (!up) {
    D.bl = b.bl * S * (1 + 0.4 * m("bodyLen")); D.rBody = 0.17 * S * sq * 1.3;
    D.torsoLen = D.bl; D.hipW = D.rBody / 1.35; D.shW = D.rBody / 0.92 * 1.0; D.neckR = D.rBody * 0.45;
    D.rLeg = 0.05 * S * Math.pow(girth, 0.6) * b.limb * 1.4;
    D.neckLen = 0.12 * S * (1 + 0.7 * m("neckLen"));
  } else { D.bl = D.torsoLen; D.rBody = D.shW; }
  return D;
}

// ---------------------------------------------------------------- the builder
export async function buildProcFigure(ch, env = {}) {
  const style = ch.style;
  const bodyPart = partOf(ch, "body");
  const bodyP = bodyPart?.params || { plan: "upright", w: 1, h: 1, head: 1, limb: 1, legK: 1, bl: 0.7 };
  const D = dims(ch, bodyP), plan = D.plan, up = plan === "upright";
  const look = ch.look || {}, colors = resolveColors(ch);
  const mats = {};
  for (const r of Object.keys(colors)) mats[r] = makeMaterial(r, colors[r], look);
  mats.glint = new THREE.MeshBasicMaterial({ color: "#ffffff" }); mats.mouthIn = new THREE.MeshStandardMaterial({ color: "#5a1d22", roughness: 0.6 });
  const root = new THREE.Group(); root.name = "Character";
  const J = {}, rig = { D, plan, root, joints: J, mats, colors, torso: null };
  const joint = (name, parent, pos = [0, 0, 0]) => { const b = new THREE.Bone(); b.name = name; b.position.set(...pos); (parent.isObject3D ? parent : J[parent]).add(b); J[name] = b; return b; };
  const rootBone = new THREE.Bone(); rootBone.name = "root"; root.add(rootBone); J.root = rootBone;
  const legNames = up ? ["L", "R"] : plan === "quad" ? ["LF", "RF", "LB", "RB"] : ["LF", "RF", "LM", "RM", "LB", "RB"];
  const legSide = (n) => n[0];
  const rest = {};
  const setRest = (n, pos, rot) => { rest[n] = { pos: pos ? [...pos] : null, rot: rot ? [...rot] : [0, 0, 0] }; };

  // skeleton
  const hips = joint("hips", rootBone, [0, up ? D.legLen : D.legLen, up ? 0 : -D.bl / 2]);
  const spine = joint("spine", hips);
  const T = D.torsoLen;
  const neck = joint("neck", spine, up ? [0, T * 0.99, 0] : [0, D.rBody * 0.55, D.bl * 0.98]);
  if (!up) neck.rotation.x = 0.85;
  const head = joint("head", neck, [0, D.neckLen, 0]);
  if (!up) head.rotation.x = -0.85;
  if (up) {
    for (const s of ["L", "R"]) {
      const x = s === "L" ? 1 : -1;
      const sh = joint("shoulder_" + s, spine, [x * D.shW * 0.93, T * 0.93, 0]);
      sh.rotation.z = x * 0.1;
      const el = joint("elbow_" + s, sh, [0, -D["upperArm" + s], 0]);
      joint("wrist_" + s, el, [0, -D["foreArm" + s], 0]);
    }
  }
  for (const n of legNames) {
    const s = legSide(n), x = s === "L" ? 1 : -1;
    const parentSpine = up ? hips : (n.endsWith("B") ? hips : spine);
    const z = up ? 0 : n.endsWith("F") ? D.bl * 0.86 : n.endsWith("M") ? D.bl * 0.5 : 0;
    const h = joint("hip_" + n, parentSpine, [x * (up ? D.hipW : D.rBody * 0.72), up ? 0 : 0, z]);
    const k = joint("knee_" + n, h, [0, -D["thigh" + s], 0]);
    const a = joint("ankle_" + n, k, [0, -D["shin" + s], 0]);
  }
  const tb = joint("tailBase", hips, up ? [0, D.hipW * 0.3, -D.hipW * 1.1] : [0, D.rBody * 0.35, -0.02]);
  tb.rotation.x = up ? -0.5 : 0.3;
  for (const s of ["L", "R"]) { const x = s === "L" ? 1 : -1; joint("wing_" + s, spine, up ? [x * D.shW * 0.12, T * 0.78, -D.shW * 0.5] : [x * D.rBody * 0.35, D.rBody * 0.95, D.bl * 0.5]); }
  const backMount = up ? new THREE.Vector3(0, T * 0.62, -D.shW * 0.62) : new THREE.Vector3(0, D.rBody * 1.1, D.bl * 0.5);

  // ctx
  const slotMeshes = new Map();
  const matOf = (region) => mats[region] || mats.skin;
  const resolveJ = (j) => (typeof j === "string" ? J[j] : j);
  const c = {
    rig, D, J, plan, legNames, legSide, head: { rx: D.headR, ry: D.headR, rz: D.headR, cy: D.headR },
    v: (id) => morphValue(ch, id), joint,
    add(jn, geo, region, slot, o = {}) {
      const m = new THREE.Mesh(geo, matOf(region));
      m.userData.region = region; m.userData.slot = slot; if (o.name) m.name = o.name;
      if (o.pos) m.position.set(...o.pos); if (o.rot) m.rotation.set(...o.rot); if (o.scale) m.scale.set(...o.scale);
      resolveJ(jn).add(m); return m;
    },
    attachGroup(jn, holder, slot) {
      holder.traverse((m) => { if (m.isMesh) { m.material = matOf(m.userData.region); m.userData.slot = slot; } });
      resolveJ(jn).add(holder);
    },
  };

  // neck (always) and the parts, in dependency order
  const style0 = SLOTS_BY_STYLE[style] || [];
  const order = ["head", "torso", "arms", "hands", "legs", "feet", "ears", "hair", "horns", "spines", "tail", "wings", "clothing"];
  const uprightOnly = new Set(["arms", "hands", "clothing"]);
  const used = { body: bodyPart?.id };
  for (const slot of order) {
    if (!style0.includes(slot) && slot !== "head" && slot !== "torso" && slot !== "arms" && slot !== "hands" && slot !== "legs" && slot !== "feet") continue;
    if (!style0.includes(slot)) continue;
    if (uprightOnly.has(slot) && !up) continue;
    const part = partOf(ch, slot);
    if (!part || !part.build) continue;
    used[slot] = part.id;
    if (slot === "head") {
      c.add("neck", limb(D.neckLen + D.headR * 0.4, D.neckR, D.neckR * 0.95, 10).translate(0, D.neckLen + D.headR * 0.4, 0), "skin", "body", { name: "Neck" });
      if (!up) c.add("spine", sphere(D.rBody * 0.7), "skin", "body", { pos: [0, 0, D.bl], name: "Shoulder" });
    }
    await part.build(c);
    if (slot === "head" && !c.head.mesh) c.head.mesh = null;
  }
  // when the style has no arms/hands (impossible today) nothing else to add; wings/horns follow the style's slots
  // head morph targets (real blendshapes)
  const headMesh = c.head.mesh;
  const setHeadMorphs = (cur) => {
    if (!headMesh?.morphTargetInfluences) return;
    for (const id of ["cranium", "width", "jaw", "chin", "cheeks", "brow"]) headMesh.morphTargetInfluences[MORPH_BY_ID[id].real] = morphValue(cur, id);
  };
  if (headMesh) { headMesh.updateMorphTargets?.(); setHeadMorphs(ch); }

  // hide hair crown under hats that clear hair (updated by setHats)
  const crownMeshes = []; head.traverse((o) => { if (o.userData.crown) crownMeshes.push(o); });

  // ground the figure: lowest point of the rest pose on y = 0
  root.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(root);
  const lift = -box0.min.y;
  root.position.y = lift;
  rootBone.userData.lift = lift;
  // gradient range from the figure height
  for (const m of Object.values(mats)) if (m.userData.u) { m.userData.u.uY0.value = 0; m.userData.u.uY1.value = Math.max(0.5, box0.max.y - box0.min.y); }

  // ---- face
  const faceRoot = new THREE.Group(); faceRoot.name = "FaceRoot"; head.add(faceRoot);
  const fig = {
    kind: "proc", root, rig, D, head: c.head, mats, joints: J, used, plan, colors, rest, crownMeshes, lift,
    faceKind: ch.face?.rig || "classic", faces: [], expression: ch.face?.expression || "neutral", openV: null,
    reduceMotion: !!env.reduceMotion, clips: [], mixer: null, action: null, playing: true,
    setHeadMorphs,
  };
  fig.buildFace = (cur) => {
    fig.faces.forEach((f) => { f.dispose?.(); f.group?.parent?.remove(f.group); f.mesh?.parent?.remove(f.mesh); });
    fig.faces = [];
    const kind = cur.face?.rig || "classic", h = fig.head;
    fig.faceKind = kind;
    const morph = { eyeSize: morphValue(cur, "eyeSize"), eyeGap: morphValue(cur, "eyeGap"), eyeY: morphValue(cur, "eyeY"), mouthY: morphValue(cur, "mouthY") };
    root.updateMatrixWorld(true);
    // decals are projected at rest pose
    const saved = fig.mixer ? fig.mixer.timeScale : 1;
    if (kind === "classic" || h.noEyes) {
      const f = createClassicFace(h, mats, morph); head.add(f.group); fig.faces.push(f);
    } else {
      const targets = []; head.traverse((o) => { if (o.isMesh && (o.userData.slot === "head")) targets.push(o); });
      try {
        const f = createDecalFace(kind, faceRoot, h, morph, targets, { expression: fig.expression, reduceMotion: fig.reduceMotion, onDirty: () => env.onDirty?.() });
        if (f && !f.disposed) fig.faces.push(f); else throw new Error("no coverage");
      } catch (e) { console.warn("Studio: decal face failed, using classic", e); const f = createClassicFace(h, mats, morph); head.add(f.group); fig.faces.push(f); }
    }
    fig.faces.forEach((f) => { if (f.mesh) { f.mesh.userData.noOutline = true; f.mesh.userData.isFace = true; } f.setExpression?.(fig.expression); if (fig.openV != null) f.setOpen?.(fig.openV); });
  };
  fig.buildFace(ch);
  fig.setExpression = (e) => { fig.expression = e; fig.faces.forEach((f) => f.setExpression?.(e)); env.onDirty?.(); };
  fig.setMouthOpen = (v) => { fig.openV = v; fig.faces.forEach((f) => f.setOpen?.(v)); env.onDirty?.(); };

  // ---- sockets (accessory mounts)
  const hd = fig.head;
  const frameR = Math.min(hd.rx, hd.ry * 0.95);
  const frame = { parent: head, pos: [0, hd.cy + Math.max(0, hd.ry - frameR) * 0.75, 0], scale: 2 * frameR };
  const frameFace = { parent: head, pos: [0, hd.cy, 0], scale: 2 * frameR };
  fig.sockets = {
    head: [frame], hair: [frame], neck: [frameFace], face: [{ ...frameFace, pos: [0, hd.cy, (hd.snout ? hd.snout * 0.15 : 0)] }], ears: [frameFace],
    back: [{ parent: spine, pos: backMount.toArray(), scale: D.S }], waist: [{ parent: hips, pos: [0, up ? D.torsoLen * 0.03 : 0, 0], scale: D.S }],
    feet: legNames.filter((n) => n.endsWith("L") || n.endsWith("R")).map((n) => ({ parent: J["ankle_" + n], pos: [0, 0, 0], scale: D.S })),
    tail: J.tail0 ? [{ parent: J.tailTip || J.tail0, pos: [0, 0, 0], scale: D.S }] : [],
  };
  if (up) { fig.sockets.hand_L = [{ parent: J.wrist_L, pos: [0, -D.handR * 1.7, D.handR * 0.2], scale: D.S }]; fig.sockets.hand_R = [{ parent: J.wrist_R, pos: [0, -D.handR * 1.7, D.handR * 0.2], scale: D.S }]; }
  fig.legNames = legNames;
  fig.upright = up;

  // ---- clips
  const { makeClips } = await import("./clips.js");
  fig.clips = makeClips(fig);
  const restState = Object.values(J).map((b) => [b, b.position.clone(), b.quaternion.clone()]);
  fig.toRest = () => { fig.mixer.stopAllAction(); fig.action = null; restState.forEach(([b, p, q]) => { b.position.copy(p); b.quaternion.copy(q); }); root.updateMatrixWorld(true); };
  fig.toPose = () => { fig.setClip(fig.clipName || "idle"); };
  fig.mixer = new THREE.AnimationMixer(root);
  fig.setClip = (name) => {
    const clip = fig.clips.find((k) => k.name === name) || fig.clips[0];
    if (!clip) return;
    const next = fig.mixer.clipAction(clip);
    if (fig.action && fig.action !== next) fig.action.fadeOut(0.15);
    next.reset().fadeIn(0.15).play(); fig.action = next; fig.clipName = clip.name;
    if (!fig.playing) { fig.mixer.update(0.0001); }
  };
  fig.setPlaying = (b) => { fig.playing = b; };
  fig.setTime = (t) => { fig.mixer.setTime(t); };
  fig.update = (dt) => {
    let ch2 = false;
    if (fig.playing && dt > 0) { fig.mixer.update(dt); ch2 = true; }
    for (const f of fig.faces) { if (f.update(dt, fig.reduceMotion)) ch2 = true; }
    return ch2;
  };
  fig.setClip(ch.pose?.clip || "idle");
  fig.mixer.update(0.0001);
  fig.dispose = () => {
    fig.mixer.stopAllAction(); fig.mixer.uncacheRoot(root);
    fig.faces.forEach((f) => f.dispose?.());
    root.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
    Object.values(mats).forEach((m) => m.dispose());
  };
  fig.setHats = (hide) => { crownMeshes.forEach((m) => { m.visible = !hide; }); };
  fig.applyColors = (cur, lookCur) => {
    const cols = resolveColors(cur);
    for (const [r, cfg] of Object.entries(cols)) {
      const m = mats[r]; if (!m) continue;
      m.color.set(cfg.color); if ("roughness" in m) m.roughness = cfg.rough;
      m.userData.u.uC2.value.set(cfg.color2); m.userData.u.uGrad.value = cfg.grad || 0;
    }
  };
  fig.regions = Object.keys(colors);
  return fig;
}
