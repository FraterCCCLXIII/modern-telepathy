// Face rigs for procedural heads and Shapes. "classic" is built here (eye and mouth meshes, expressions, blink, mouth-open).
// "rtk" and "tube" reuse the site's own rigs (site/rtk-mouth.js, site/tube-face.js) as decals projected onto the head.
import { THREE, sphere, tube } from "./geo.js";
import { createRtkMouth, rtkLayout } from "../rtk-mouth.js";
import { createTubeFace, tubeShapeAnchor } from "../tube-face.js";

// expression -> eye openness, mouth curve (+smile / -frown), open amount, brow height and tilt (+ = angry inward-down)
const EXPR = {
  neutral: { eye: 1, curve: 0.15, open: 0, browY: 0, tilt: 0 },
  happy: { eye: 0.85, curve: 1, open: 0.15, browY: 0.2, tilt: 0 },
  excited: { eye: 1.25, curve: 1, open: 0.7, browY: 0.5, tilt: 0 },
  thinking: { eye: 0.9, curve: -0.1, open: 0, browY: 0.3, tilt: -0.2, off: 0.35 },
  sad: { eye: 0.8, curve: -0.9, open: 0, browY: 0.1, tilt: -0.5 },
  angry: { eye: 0.65, curve: -0.6, open: 0.1, browY: -0.15, tilt: 0.55 },
  surprised: { eye: 1.35, curve: 0, open: 0.9, browY: 0.7, tilt: 0, round: true },
  sleepy: { eye: 0.12, curve: 0.1, open: 0, browY: -0.1, tilt: 0 },
};

/** Surface point of the head ellipsoid (head-joint space) at height `y` offset and lateral `x`. */
function onHead(h, x, yRel) {
  const nx = x / h.rx, ny = yRel / h.ry, r = 1 - nx * nx - ny * ny;
  return h.rz * Math.sqrt(Math.max(0.02, r));
}

export function createClassicFace(h, mats, morph) {
  const g = new THREE.Group(); g.name = "ClassicFace";
  const st = { expr: "neutral", open: null, blink: 0, t: 1 + Math.random() * 2, blinkT: -1 };
  const eyeMat = mats.eye, w = h.rx;
  const es = 1 + 0.5 * (morph.eyeSize || 0), gap = 1 + 0.45 * (morph.eyeGap || 0), ey = (morph.eyeY || 0) * h.ry * 0.12, my = (morph.mouthY || 0) * h.ry * 0.12;
  const eyeY = h.cy + h.ry * 0.12 + ey, eyeX = w * 0.36 * gap;
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const ball = new THREE.Mesh(sphere(w * 0.125 * es, w * 0.17 * es, w * 0.07 * es, 12, 8), eyeMat); ball.userData = { region: "eye", slot: "face" };
    const glint = new THREE.Mesh(sphere(w * 0.03 * es, w * 0.03 * es, w * 0.02 * es, 8, 6), mats.glint); glint.position.set(w * 0.03 * es, w * 0.05 * es, w * 0.05 * es); glint.userData = { slot: "face", glint: true };
    e.add(ball, glint);
    const x = s * eyeX; e.position.set(x, eyeY, onHead(h, x, eyeY - h.cy) - w * 0.02);
    e.rotation.y = s * 0.15; g.add(e); eyes.push(e);
    const b = new THREE.Mesh(sphere(w * 0.19, w * 0.025, w * 0.03, 10, 6), eyeMat); b.userData = { region: "eye", slot: "face" };
    const by = eyeY + w * 0.2 * es; b.position.set(x, by, onHead(h, x, by - h.cy) - w * 0.01); g.add(b); brows.push({ m: b, s, y: by });
  }
  const mouth = new THREE.Mesh(new THREE.BufferGeometry(), eyeMat); mouth.userData = { region: "eye", slot: "face" };
  const inner = new THREE.Mesh(sphere(1, 1, 0.3, 14, 10), mats.mouthIn); inner.userData = { slot: "face", inner: true };
  g.add(mouth, inner);
  const mouthBase = h.snout ? h.snoutY ?? -h.ry * 0.2 : -h.ry * 0.42;
  const mouthY0 = h.cy + mouthBase + my;
  const mz = h.snout ? h.rz * 0.6 + h.snout + 0.005 : onHead(h, 0, mouthY0 - h.cy) - w * 0.015;
  let lastKey = "";
  function paint() {
    const ex = EXPR[st.expr] || EXPR.neutral;
    const open = st.open != null ? st.open : ex.open;
    const key = [st.expr, st.open, st.blink.toFixed(2)].join("|");
    if (key === lastKey) return; lastKey = key;
    const mw = w * (h.snout ? 0.16 : 0.26) * (ex.round ? 0.55 : 1);
    const curve = ex.curve;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const u = (i / 8) * 2 - 1; pts.push([u * mw, -curve * mw * 0.55 * (1 - u * u) * (open > 0.3 ? 0.6 : 1) + curve * mw * 0.18 * u * u, 0]); }
    mouth.geometry.dispose();
    mouth.geometry = tube(pts, w * 0.022, w * 0.022, 16, 6);
    mouth.position.set(0, mouthY0, mz);
    inner.visible = open > 0.06;
    inner.scale.set(mw * (ex.round ? 0.55 : 0.85), Math.max(0.001, mw * 0.8 * open), mw * 0.3);
    inner.position.set(0, mouthY0 - mw * 0.3 * open - (curve > 0.5 ? mw * 0.1 : 0), mz - 0.004);
    const bl = Math.max(0.08, (ex.eye) * (1 - st.blink * 0.92));
    eyes.forEach((e) => { e.scale.y = Math.min(1.3, bl); });
    brows.forEach((b) => { b.m.position.y = b.y + ex.browY * w * 0.12; b.m.rotation.z = b.s * -ex.tilt * 0.7; });
    eyes.forEach((e) => { e.children[1].visible = bl > 0.35; });
  }
  paint();
  g.traverse((o) => { o.userData.noOutline = true; if (o.isMesh) o.userData.isFace = true; });
  return {
    group: g,
    setExpression(e) { st.expr = EXPR[e] ? e : "neutral"; paint(); },
    setOpen(v) { st.open = v == null ? null : Math.min(1, Math.max(0, v)); paint(); },
    update(dt, still) {
      if (still) return false;
      let ch = false;
      if (st.blinkT >= 0) { st.blinkT += dt; st.blink = Math.sin(Math.min(1, st.blinkT / 0.16) * Math.PI); if (st.blinkT > 0.16) { st.blinkT = -1; st.blink = 0; } paint(); ch = true; }
      else { st.t -= dt; if (st.t <= 0) { st.blinkT = 0; st.t = 2.5 + Math.random() * 2.5; } }
      return ch;
    },
    dispose() { mouth.geometry.dispose(); g.traverse((o) => { if (o.isMesh && o !== mouth) o.geometry.dispose?.(); }); },
  };
}

/** RTK / tube decal on a procedural head. root = a Group at head-joint origin. targets = head meshes. */
export function createDecalFace(kind, root, h, morph, targets, opts) {
  const size = { x: 2 * h.rx, y: 2 * h.ry };
  const k = 1 + 0.35 * (morph.eyeSize || 0);
  const s = 0.6 * Math.min(size.x, size.y) * k;
  const L = rtkLayout.LAYOUTS.face;
  const eyeY = h.cy + 0.145 * s + (morph.eyeY || 0) * h.ry * 0.12;
  const rect = { x: 0, y: eyeY - (L.h / (L.w / L.unitsW) / 2 - L.eyeY) * s - (morph.mouthY || 0) * h.ry * 0.06, w: L.unitsW * s, h: (L.h / (L.w / L.unitsW)) * s };
  const offset = 0.012 * Math.max(size.x, size.y);
  root.updateMatrixWorld(true);
  if (kind === "rtk") {
    return createRtkMouth(THREE, root, { target: "surface", layout: "face", expression: opts.expression, live: true, reduceMotion: opts.reduceMotion, onDirty: opts.onDirty, targets, anchor: rect, offset, grid: [30, 30] }).attach();
  }
  const a = tubeShapeAnchor(THREE, "head", { rect, scale: s, mouthOnly: false });
  return createTubeFace(THREE, root, { target: "surface", expression: opts.expression, live: true, reduceMotion: opts.reduceMotion, onDirty: opts.onDirty, targets, frame: a.frame, region: a.region, lift: 0.02 }).attach();
}
export { EXPR };
