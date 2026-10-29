// RTK mouth for the Kamiji face: the owner's older "ChatRTK" talking-head mouth (rounded box with
// teeth and tongue, one shape per letter, 150 ms eased tween, 100 ms letter steps), redrawn on a small
// canvas texture and laid on the model surface as a thin decal. No dependencies beyond the page's three.
//
// Ported from (all the owner's code):
//   chatty-face-plugin/src/components/TalkingHead/TalkingHead.tsx   phoneme + expression tables, text to letters, 100 ms steps
//   chatty-face-plugin/src/components/TalkingHead/TalkingHead.css   .mouth/.teeth/.tongue geometry, 0.15s cubic-bezier(.4,0,.2,1)
//   kamiji-rig/src/services/AnimationService.ts                     the letters the RTK table lacks (C H J Q W X Y), TEXT_FALLBACK
// See docs/rtk-mouth.md.
//
// Three ways to place it (all return the same controller):
//   target "hand"    thin skinned patch on the Face bone of assets/kamiji.glb, with the same shapeSphere/shapeCube
//                    morph targets as FaceMesh, so it follows the hand, sphere and cube shapes (eyes come from FaceMesh).
//   target "surface" patch projected onto any model by ray casting (library shapes: eyes + mouth; emoji heads: mouth only).
// Public API: attach, setExpression, setViseme, setOpen, speakText, stop, setVisible, setInk, setTint, update, dispose.

// ---- RTK shape tables (CSS px of the original; width, height, radius, tongue w/h/bottom, teeth top/bottom y, teeth width) ----
const S = (w, h, r, tw, th, tb, ty, by, tW) => ({ w, h, r, tw, th, tb, ty, by, tW });
const LETTERS = {
  A: S(50, 35, "40%", 28, 14, -4, -12, 12, 1.2),
  E: S(65, 25, "15px", 35, 10, -6, -8, 8, 1.25),
  I: S(40, 20, "15px", 20, 8, -4, -6, 6, 1.15),
  O: S(40, 40, "50%", 22, 16, -2, -14, 14, 1.15),
  U: S(35, 35, "50%", 18, 14, -2, -12, 12, 1.1),
  M: S(55, 10, "5px", 0, 0, 0, -4, 4, 1.1),
  B: S(55, 10, "5px", 0, 0, 0, -4, 4, 1.1),
  P: S(55, 10, "5px", 0, 0, 0, -4, 4, 1.1),
  F: S(55, 20, "5px", 0, 0, 0, -8, 8, 1.2),
  V: S(55, 20, "5px", 0, 0, 0, -8, 8, 1.2),
  L: S(50, 25, "15px", 30, 20, -8, -8, 8, 1.15),
  T: S(50, 15, "10px", 25, 8, -6, -6, 6, 1.15),
  D: S(50, 15, "10px", 25, 8, -6, -6, 6, 1.15),
  S: S(50, 15, "10px", 25, 8, -6, -6, 6, 1.15),
  Z: S(50, 15, "10px", 25, 8, -6, -6, 6, 1.15),
  N: S(50, 15, "10px", 25, 8, -6, -6, 6, 1.15),
  R: S(50, 20, "15px", 30, 12, -6, -8, 8, 1.15),
  K: S(50, 20, "15px", 30, 12, -8, -8, 8, 1.15),
  G: S(50, 20, "15px", 30, 12, -8, -8, 8, 1.15),
  rest: S(30, 10, "5px", 20, 6, -4, -4, 4, 1.05),
};
// Letters the RTK table has no entry for: RTK falls back to the expression shape; Kamiji borrows the nearest letter
// (the kamiji-rig textToPhonemes mapping: c, q, x -> K; y -> I; w -> U; j -> S; h -> E).
const LETTER_ALIAS = { C: "K", Q: "K", X: "K", Y: "I", W: "U", J: "S", H: "E" };
const EXPRESSIONS = { // RTK `expressions` table, plus Kamiji's own (closed, excited, sleepy, wide, open, round, frown, smile)
  neutral: S(60, 25, "15px", 30, 12, -4, -6, 6, 1.1),
  happy: S(70, 35, "15px 15px 40px 40px", 35, 16, -2, -10, 10, 1.15),
  sad: { ...S(65, 30, "40px 40px 15px 15px", 25, 10, -6, -8, 8, 1.15), noTeeth: true }, // Kamiji: no teeth on a frown, it reads as a frown
  surprised: S(45, 45, "50%", 25, 18, 0, -14, 14, 1.1),
  angry: S(60, 25, "5px", 30, 10, -6, -8, 8, 1.2),
  thinking: { ...S(50, 20, "15px", 25, 8, -4, -6, 6, 1.1), noTeeth: true },
};
// Kamiji additions: a calm closed mouth is what the resting face wants (RTK "neutral" is a grin with teeth).
const EXTRA = {
  closed: { ...S(38, 7, "3.5px 3.5px 10px 10px", 0, 0, 0, 0, 0, 1), noTeeth: true },
  calm: { ...S(52, 14, "4px 4px 16px 16px", 0, 0, 0, 0, 0, 1), noTeeth: true },
  excited: S(78, 46, "15px 15px 40px 40px", 40, 20, -2, -12, 12, 1.15),
  sleepy: { ...S(30, 9, "4px 4px 8px 8px", 0, 0, 0, 0, 0, 1), noTeeth: true },
};
const NAMED = { // public shape names -> table entries
  closed: EXTRA.closed, calm: EXTRA.calm, smile: EXPRESSIONS.happy, frown: EXPRESSIONS.sad, open: LETTERS.A, round: LETTERS.O, wide: LETTERS.E,
};
// Kamiji expression names (site/main.js EXPRESSIONS) and the face-prop expression names -> mouth shape.
const EXPRESSION_SHAPE = {
  neutral: EXTRA.calm, happy: EXPRESSIONS.happy, excited: EXTRA.excited, thinking: EXPRESSIONS.thinking, sad: EXPRESSIONS.sad,
  angry: EXPRESSIONS.angry, surprised: EXPRESSIONS.surprised, sleepy: EXTRA.sleepy,
};
// OVR / VRChat style viseme ids -> letter, so audio visemes from a TTS can drive the same mouth.
const VISEME_ALIAS = { sil: "rest", pp: "P", ff: "F", th: "T", dd: "T", kk: "K", ch: "S", ss: "S", nn: "N", rr: "R", aa: "A", e: "E", ih: "I", oh: "O", ou: "U" };
const EYE_SCALE = { neutral: 1, happy: 1, excited: 1.12, thinking: 1, sad: 1, angry: 0.82, surprised: 1.22, sleepy: 0.5 };

export const RTK_SHAPE_NAMES = [...Object.keys(LETTERS).filter((k) => k !== "rest"), "rest", ...Object.keys(NAMED)];
export const RTK_EXPRESSIONS = Object.keys(EXPRESSION_SHAPE);

// ---- shape vectors (so the tween is a plain lerp) ----
// [w, h, rx0..3, ry0..3 (tl, tr, br, bl), tongueW, tongueH, tongueBottom, teethTopY, teethBottomY, teethW, teethAlpha]
function radii(spec, w, h) {
  const [hs, vs = hs] = spec.split("/").map((x) => x.trim().split(/\s+/));
  const expand = (t) => (t.length === 1 ? [t[0], t[0], t[0], t[0]] : t.length === 2 ? [t[0], t[1], t[0], t[1]] : t.length === 3 ? [t[0], t[1], t[2], t[1]] : t);
  const px = (s, ref) => (s.endsWith("%") ? (parseFloat(s) / 100) * ref : parseFloat(s));
  return [expand(hs).map((s) => px(s, w)), expand(vs).map((s) => px(s, h))];
}
const vecCache = new Map();
function toVec(sh) {
  if (!vecCache.has(sh)) {
    const [rx, ry] = radii(sh.r, sh.w, sh.h);
    vecCache.set(sh, [sh.w, sh.h, ...rx, ...ry, sh.tw, sh.th, sh.tb, sh.ty, sh.by, sh.tW, sh.noTeeth ? 0 : 1]);
  }
  return vecCache.get(sh);
}
const lerpVec = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

function shapeFor(id, expression) {
  if (id == null) return EXPRESSION_SHAPE[expression] || EXTRA.calm;
  const raw = String(id);
  const low = raw.toLowerCase();
  if (NAMED[low]) return NAMED[low];
  if (EXPRESSION_SHAPE[low]) return EXPRESSION_SHAPE[low];
  const key = VISEME_ALIAS[low] || raw.toUpperCase();
  const letter = LETTER_ALIAS[key] || key;
  return LETTERS[letter] || (low === "rest" ? LETTERS.rest : null);
}

// CSS cubic-bezier(0.4, 0, 0.2, 1)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) { const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const EASE = bezier(0.4, 0, 0.2, 1);

// ---- painter ----
export const LAYOUTS = {
  // canvas covers 0.52 x 0.28 hand units (one palm face mouth region); mouth only
  mouth: { w: 512, h: 288, unitsW: 0.52, mouthY: 144, eyes: false },
  // canvas covers 0.60 x 0.75 hand units: eyes (+-0.13, 0) and the mouth 0.34 below, as on the hand
  face: { w: 512, h: 640, unitsW: 0.60, eyeY: 0.18, mouthY: 0.52, eyes: true, boost: 1.3 },
};
const RTK_UNIT = 0.27 / 65; // hand units per RTK px (the E mouth, 65 px, is 0.27 of the palm face)
const EYE = { hw: 0.077, hh: 0.14, dx: 0.13 }; // the hand rig's stadium eyes (build_hand_rig.py RECT_HALF, EYE_X)

function rrPath(g, x, y, w, h, rx, ry) { // rounded box with elliptical corners; rx/ry: tl tr br bl, CSS-scaled to fit
  let f = Math.min(1, w / ((rx[0] + rx[1]) || 1e-6), w / ((rx[3] + rx[2]) || 1e-6), h / ((ry[0] + ry[3]) || 1e-6), h / ((ry[1] + ry[2]) || 1e-6));
  f = Math.max(0, f);
  const [a, b, c, d] = rx.map((v) => Math.max(0, v) * f), [e, ff, gg, hh] = ry.map((v) => Math.max(0, v) * f);
  g.beginPath();
  g.moveTo(x + a, y);
  g.lineTo(x + w - b, y); g.ellipse(x + w - b, y + ff, b, ff, 0, -Math.PI / 2, 0);
  g.lineTo(x + w, y + h - gg); g.ellipse(x + w - c, y + h - gg, c, gg, 0, 0, Math.PI / 2);
  g.lineTo(x + d, y + h); g.ellipse(x + d, y + h - hh, d, hh, 0, Math.PI / 2, Math.PI);
  g.lineTo(x, y + e); g.ellipse(x + a, y + e, a, e, 0, Math.PI, Math.PI * 1.5);
  g.closePath();
}
function plainRR(g, x, y, w, h, tl, tr, br, bl) { rrPath(g, x, y, w, h, [tl, tr, br, bl], [tl, tr, br, bl]); }

function paintMouth(g, v, k, cx, cy, col) {
  const [w, h, rx0, rx1, rx2, rx3, ry0, ry1, ry2, ry3, tw, th, tb, ty, by, tW, tA] = v;
  const W = w * k, H = h * k, x = cx - W / 2, y = cy - H / 2;
  g.save();
  rrPath(g, x, y, W, H, [rx0 * k, rx1 * k, rx2 * k, rx3 * k], [ry0 * k, ry1 * k, ry2 * k, ry3 * k]);
  g.fillStyle = col.inside; g.fill();
  g.clip();
  if (tw > 0.5 && th > 0.5) { // tongue: bottom-anchored, drawn under the teeth, clipped by the mouth box
    const TW = tw * k, TH = th * k, tx = cx - TW / 2, tY = y + H - tb * k - TH;
    plainRR(g, tx, tY, TW, TH, 15 * k, 15 * k, 5 * k, 5 * k);
    g.fillStyle = col.tongue; g.fill();
  }
  if (tA > 0.02) {
    g.globalAlpha = Math.min(1, tA);
    const TWd = W * tW, bar = 12 * k, line = Math.max(1.5, 0.6 * k);
    g.fillStyle = col.teeth; g.strokeStyle = col.teethEdge; g.lineWidth = line;
    plainRR(g, cx - TWd / 2, y + ty * k, TWd, bar, 0, 0, 8 * k, 8 * k); g.fill(); g.stroke();
    plainRR(g, cx - TWd / 2, y + H - bar + by * k, TWd, bar, 8 * k, 8 * k, 0, 0); g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
  rrPath(g, x, y, W, H, [rx0 * k, rx1 * k, rx2 * k, rx3 * k], [ry0 * k, ry1 * k, ry2 * k, ry3 * k]);
  g.strokeStyle = col.ink; g.lineWidth = Math.max(3.5, 1.15 * k); g.lineJoin = "round"; g.stroke();
}

function paintEyes(g, L, U, openness, eyeScale, col) {
  const y = L.eyeY * U, hh = EYE.hh * U * eyeScale * Math.max(0.06, openness), hw = EYE.hw * U * (0.95 + 0.05 * eyeScale);
  for (const s of [-1, 1]) {
    const x = L.w / 2 + s * EYE.dx * U;
    plainRR(g, x - hw, y - hh, hw * 2, hh * 2, hw, hw, hw, hw);
    g.fillStyle = col.eye; g.fill();
    if (openness > 0.5) { // small glint, as the hand's FaceGlint material
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath(); g.ellipse(x - s * hw * 0.28, y - hh * 0.45, hw * 0.22, hw * 0.3, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

const COLORS = { ink: "#3a2a28", inside: "#4a1b24", tongue: "#ff7d9d", teeth: "#ffffff", teethEdge: "#dddddd", eye: "#2a2430" };

function paintFace(g, layout, vec, state, col) {
  const L = LAYOUTS[layout], U = L.w / L.unitsW, k = U * RTK_UNIT * (L.boost || 1);
  g.clearRect(0, 0, L.w, L.h);
  if (L.eyes) paintEyes(g, L, U, 1 - state.blink, state.eyeScale, col);
  const cy = L.eyes ? (L.eyeY + (L.mouthY - L.eyeY)) * U : L.mouthY;
  if (!state.noMouth) paintMouth(g, vec, k, L.w / 2, cy, col);
}

// Shared textures for static (tile) faces: one canvas per (layout, expression or shape, colours), never repainted.
const staticCache = new Map();
function staticTexture(THREE, layout, key, vec, state, col) {
  const id = `${layout}|${key}|${col.ink}|${col.inside}|${state.eyeScale}|${state.noMouth ? 1 : 0}`;
  let e = staticCache.get(id);
  if (!e) {
    const L = LAYOUTS[layout], canvas = document.createElement("canvas");
    canvas.width = L.w; canvas.height = L.h;
    paintFace(canvas.getContext("2d"), layout, vec, state, col);
    e = { canvas, tex: makeTexture(THREE, canvas), refs: 0 };
    staticCache.set(id, e);
  }
  e.refs++;
  return { tex: e.tex, release() { if (--e.refs <= 0) { e.tex.dispose(); staticCache.delete(id); } } };
}
function makeTexture(THREE, canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---- geometry: hand patch (skinned to the Face bone, same shape morphs as FaceMesh) ----
// Ports model/build_hand_rig.py face_shape_pos(): hand -> sphere / rounded cube mapping of a point on the face.
const SH = { R: 0.9, P: 8, RC: 0.8, SCALE: { sphere: 1.15, cube: 1.3 }, CX: 0.08, CZ: -0.40 };
const MOUTH_Z = -0.74, OFF = 0.016; // MOUTH_Z: the Blender build's hidden mouth row, below the eyes (z -0.40)
const handPatchCache = new WeakMap();

function shapePoint(phi, alpha, kind) { // Blender coordinates (front is -Y)
  const d = [Math.sin(phi) * Math.cos(alpha), -Math.cos(phi), Math.sin(phi) * Math.sin(alpha)];
  if (kind === "sphere") return { P: d.map((c) => c * SH.R), n: d };
  const nrm = (Math.abs(d[0]) ** SH.P + Math.abs(d[1]) ** SH.P + Math.abs(d[2]) ** SH.P) ** (1 / SH.P);
  const P = d.map((c) => (c / nrm) * SH.RC);
  const g = P.map((c) => Math.sign(c) * Math.abs(c / SH.RC) ** (SH.P - 1)), gl = Math.hypot(...g) || 1;
  return { P, n: g.map((c) => c / gl) };
}
function faceShapePos(xb, yb, zb, surfY, kind) {
  const dx = xb - SH.CX, dz = zb - SH.CZ;
  const { P, n } = shapePoint(Math.hypot(dx, dz) * SH.SCALE[kind] / SH.R, Math.atan2(dz, dx), kind);
  const h = surfY - yb;
  return [P[0] + n[0] * h, P[1] + n[1] * h, P[2] + n[2] * h];
}

function handPatchGeometry(THREE, handMesh, boneIndex) {
  const hit = handPatchCache.get(handMesh.geometry);
  if (hit) return hit;
  const probe = new THREE.Mesh(handMesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, 0, -1), o = new THREE.Vector3();
  const surf = (x, zb) => { rc.set(o.set(x, zb, 3), down); const h = rc.intersectObject(probe, false)[0]; return h ? -h.point.z : -0.12; };
  const NX = 30, NZ = 14, hw = 0.26, hh = 0.14, cx = SH.CX;
  const pos = [], dS = [], dC = [], uv = [], idx = [], si = [], sw = [];
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const u = i / NX, w = j / NZ, xb = cx - hw + u * 2 * hw, zb = MOUTH_Z + hh - w * 2 * hh;
      const sy = surf(xb, zb), yb = sy - OFF;
      const toG = (p) => [p[0], p[2], -p[1]];
      const rest = toG([xb, yb, zb]);
      pos.push(...rest);
      for (const [kind, out] of [["sphere", dS], ["cube", dC]]) { const p = toG(faceShapePos(xb, yb, zb, sy, kind)); out.push(p[0] - rest[0], p[1] - rest[1], p[2] - rest[2]); }
      uv.push(u, 1 - w); si.push(boneIndex, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  const a1 = new THREE.Float32BufferAttribute(dS, 3), a2 = new THREE.Float32BufferAttribute(dC, 3);
  a1.name = "shapeSphere"; a2.name = "shapeCube";
  geo.morphAttributes.position = [a1, a2]; geo.morphTargetsRelative = true;
  handPatchCache.set(handMesh.geometry, geo);
  return geo;
}

// ---- geometry: surface patch by ray casting (library shapes and emoji heads) ----
// anchor: { x, y, w, h } rectangle in the model's xy plane (centre + size); rays go along -z from the front.
function surfacePatchGeometry(THREE, root, targets, anchor, grid = [28, 28], off = 0.01) {
  root.updateMatrixWorld(true);
  const [NX, NY] = grid, rc = new THREE.Raycaster(), dir = new THREE.Vector3(0, 0, -1), o = new THREE.Vector3();
  const pts = [], ok = [], tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], nn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3();
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = anchor.x - anchor.w / 2 + (i / NX) * anchor.w, y = anchor.y + anchor.h / 2 - (j / NY) * anchor.h;
      rc.set(o.set(x, y, 10).applyMatrix4(root.matrixWorld), dir);
      const h = rc.intersectObjects(targets, false)[0];
      if (!h) { pts.push(0, 0, 0); ok.push(false); continue; }
      const m = h.object, g = m.geometry, f = h.face;
      let p = h.point.clone().applyMatrix4(invRoot);
      if (g.attributes.normal) {
        for (let q = 0; q < 3; q++) { const vi = [f.a, f.b, f.c][q]; tri[q].fromBufferAttribute(g.attributes.position, vi); nn[q].fromBufferAttribute(g.attributes.normal, vi); }
        const local = m.worldToLocal(h.point.clone());
        THREE.Triangle.getInterpolation(local, tri[0], tri[1], tri[2], nn[0], nn[1], nn[2], n);
        n.transformDirection(m.matrixWorld).transformDirection(invRoot);
      } else n.copy(f.normal).transformDirection(m.matrixWorld).transformDirection(invRoot);
      p = p.addScaledVector(n.normalize(), off);
      pts.push(p.x, p.y, p.z); ok.push(true);
    }
  }
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i; pos.push(pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]); uv.push(i / NX, 1 - j / NY); }
  let cells = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    if (ok[a] && ok[b] && ok[c] && ok[d]) { idx.push(a, c, b, b, c, d); cells++; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.userData.coverage = cells / (NX * NY);
  return geo;
}
const surfaceCache = new Map(); // geometry per (model file + anchor), shared between hero and tiles (never mutated)

// ---- controller ----
/**
 * @param THREE  the page's three.js
 * @param faceRoot  hand: the cloned GLB root (needs FaceMesh + Hand); surface: the model root the decal is added to
 * @param opts {
 *   target: "hand" | "surface", layout: "mouth" | "face" (default mouth; "face" paints eyes too),
 *   expression, live (animate + own canvas; false = one shared static texture), reduceMotion, onDirty(),
 *   targets (surface: meshes the rays may hit), anchor ({x,y,w,h} for surface), cacheKey, ink, tint, eyeScale,
 *   offset (surface: distance above the surface), renderOrder }
 */
export function createRtkMouth(THREE, faceRoot, opts = {}) {
  const layout = opts.layout || "mouth", live = opts.live !== false;
  const c = { disposed: false, visible: true, mesh: null, covered: 1 };
  const col = { ...COLORS, ...(opts.ink ? { ink: opts.ink } : {}), ...(opts.tint ? { inside: opts.tint } : {}) };
  const st = { expression: opts.expression || "neutral", viseme: null, open: null, letter: null, blink: 0, eyeScale: 1 };
  st.eyeScale = EYE_SCALE[st.expression] ?? 1;
  let from = toVec(shapeFor(null, st.expression)), to = from, cur = from, t = 0, dur = 0;
  let speak = null; // { letters, step, i, acc, onend }
  let blinkIn = 2 + Math.random() * 2, blinkT = -1;
  let canvas = null, g = null, tex = null, release = null, material = null, dirty = true, lastKey = "";
  const dirtyCb = () => opts.onDirty?.();

  const goal = () => {
    let sh;
    if (st.viseme != null && (sh = shapeFor(st.viseme, st.expression))) return toVec(sh);
    if (st.open != null) return lerpVec(toVec(EXTRA.closed), toVec(LETTERS.A), Math.min(1, Math.max(0, st.open)));
    if (st.letter != null && (sh = shapeFor(st.letter, st.expression))) return toVec(sh);
    return toVec(shapeFor(null, st.expression));
  };
  const retarget = (ms) => {
    const g2 = goal();
    if (g2.every((x, i) => x === to[i])) return;
    from = cur; to = g2; t = 0; dur = opts.reduceMotion || !live ? 0 : ms;
    if (dur === 0) { cur = to; from = to; }
    dirty = true; dirtyCb();
  };

  c.setExpression = (name) => {
    st.expression = name in EXPRESSION_SHAPE || name in EXPRESSIONS ? name : "neutral";
    st.eyeScale = EYE_SCALE[st.expression] ?? 1;
    dirty = true; retarget(150); if (!live) restyle();
  };
  c.setViseme = (id) => { st.viseme = id == null ? null : id; retarget(opts.visemeMs ?? 90); };
  c.setOpen = (v) => { st.open = v == null ? null : Math.min(1, Math.max(0, +v || 0)); retarget(70); };
  c.stop = () => { speak = null; st.letter = null; retarget(150); };
  // RTK convertTextToPhonemes: upper-case letters; punctuation and spaces are "rest"; one letter every ~100 ms.
  c.speakText = (text, durationMs, onend) => {
    const letters = [...String(text || "").toUpperCase()].map((ch) => (/[A-Z]/.test(ch) ? ch : "rest"));
    if (!letters.length) return;
    const step = durationMs ? Math.min(300, Math.max(50, durationMs / letters.length)) / 1000 : 0.1;
    speak = { letters, step, i: 0, acc: 0, onend };
    st.letter = letters[0]; retarget(150);
  };
  // face layout only: hide the mouth but keep the eyes (shapes with Mouth = none)
  c.setMouthShown = (b) => { st.noMouth = !b; dirty = true; lastKey = ""; if (!live) restyle(); dirtyCb(); };
  c.setVisible = (b) => { c.visible = !!b; if (c.mesh) c.mesh.visible = c.visible; dirtyCb(); };
  c.setInk = (hex) => { col.ink = hex; dirty = true; lastKey = ""; if (!live) restyle(); dirtyCb(); };
  c.setTint = (hex) => { col.inside = hex; dirty = true; lastKey = ""; if (!live) restyle(); dirtyCb(); };

  // static faces swap their shared texture when the expression (or colours) change
  function restyle() {
    if (live || !material) return;
    release?.();
    const vec = toVec(shapeFor(null, st.expression));
    ({ tex, release } = staticTexture(THREE, layout, st.expression, vec, st, col));
    material.map = tex; material.needsUpdate = true; dirtyCb();
  }

  function makeMaterial() {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    m.name = "RtkMouth";
    return m;
  }

  c.attach = () => {
    if (live) {
      const L = LAYOUTS[layout];
      canvas = document.createElement("canvas"); canvas.width = L.w; canvas.height = L.h; g = canvas.getContext("2d");
      tex = makeTexture(THREE, canvas);
      paintFace(g, layout, cur, st, col);
    } else {
      ({ tex, release } = staticTexture(THREE, layout, st.expression, toVec(shapeFor(null, st.expression)), st, col));
    }
    material = makeMaterial();
    let mesh;
    if (opts.target === "hand") {
      let faceMesh = null, handMesh = null;
      faceRoot.traverse((n) => {
        if (!n.isSkinnedMesh || !n.morphTargetDictionary) return;
        if ("mouthSmile" in n.morphTargetDictionary) faceMesh = n; else if (n.material?.name === "HandSkin" || !handMesh) handMesh = n;
      });
      if (!faceMesh || !handMesh) { c.disposed = true; return c; }
      const bi = faceMesh.geometry.attributes.skinIndex.getX(0);
      mesh = new THREE.SkinnedMesh(handPatchGeometry(THREE, handMesh, bi), material);
      mesh.updateMorphTargets();
      mesh.bindMode = faceMesh.bindMode;
      faceMesh.parent.add(mesh);
      mesh.bind(faceMesh.skeleton, faceMesh.bindMatrix);
      c.morphMesh = mesh; // the page's tick drives shapeSphere/shapeCube on every mesh with a morphTargetDictionary
    } else {
      const key = opts.cacheKey && `${opts.cacheKey}|${layout}`;
      let geo = key && surfaceCache.get(key);
      if (!geo) { geo = surfacePatchGeometry(THREE, faceRoot, opts.targets || [], opts.anchor, opts.grid, opts.offset); if (key) surfaceCache.set(key, geo); }
      c.covered = geo.userData.coverage;
      mesh = new THREE.Mesh(geo, material);
      faceRoot.add(mesh);
    }
    mesh.frustumCulled = false; mesh.renderOrder = opts.renderOrder ?? 2; mesh.name = "RtkMouth";
    mesh.visible = c.visible;
    c.mesh = mesh;
    return c;
  };

  // advance the tween, letter steps and blink; returns true when the texture changed (the page should redraw)
  c.update = (dt) => {
    if (c.disposed || !c.mesh || !c.visible) return false;
    if (!live) return false;
    let changed = false;
    if (speak) {
      speak.acc += dt;
      while (speak && speak.acc >= speak.step) {
        speak.acc -= speak.step; speak.i++;
        if (speak.i >= speak.letters.length) { const end = speak.onend; speak = null; st.letter = null; retarget(150); end?.(); break; }
        st.letter = speak.letters[speak.i]; retarget(150);
      }
    }
    if (t < dur) { t = Math.min(dur, t + dt * 1000); cur = lerpVec(from, to, EASE(t / dur)); changed = true; } else if (cur !== to) { cur = to; changed = true; }
    if (LAYOUTS[layout].eyes && !opts.reduceMotion) { // RTK blink: every 2 to 4 s
      if (blinkT >= 0) { blinkT += dt; st.blink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) { blinkT = -1; st.blink = 0; } changed = true; }
      else { blinkIn -= dt; if (blinkIn <= 0) { blinkT = 0; blinkIn = 2 + Math.random() * 2; } }
    }
    if (changed || dirty) {
      const key = cur.map((x) => Math.round(x * 4)).join(",") + "|" + Math.round(st.blink * 20) + st.expression + col.ink + col.inside + (st.noMouth ? "n" : "");
      if (key !== lastKey) { lastKey = key; paintFace(g, layout, cur, st, col); tex.needsUpdate = true; changed = true; }
      dirty = false;
    }
    return changed;
  };

  c.dispose = () => {
    c.disposed = true;
    if (c.mesh) { c.mesh.parent?.remove(c.mesh); c.mesh.dispose?.(); }
    material?.dispose();
    if (live) tex?.dispose(); else release?.();
  };
  return c;
}


// ---- where the face goes on a library item ----
// Shapes have no face of their own: the "face" layout (eyes + mouth, 0.60 x 0.75 hand units) is projected onto the front (+z)
// of the body. SHAPE_FACE tunes awkward bodies: s = size multiplier, dx / dy = shift as a fraction of the body box.
const SHAPE_FACE = {
  shape_bunny_head: { s: 1.35, dy: -0.2 }, shape_pill: { s: 1.5 }, shape_dango: { s: 1.6, dy: 0.2 }, shape_flower: { s: 0.62 },
  shape_moon_crescent: { s: 0.6, dx: -0.2 }, shape_onigiri: { s: 0.8, dy: 0.2 }, shape_star_body: { s: 0.8 }, shape_crown_blob: { s: 0.85, dy: -0.08 },
  shape_jellyfish: { dy: 0.08 },
  shape_drop: { s: 1.15, dy: -0.2, follow: true }, // slime: eyes on the widest part of the round belly, mouth on the lower dome (face centre ~30% up) shape_mushroom: { s: 0.9, dy: 0.2 },
  shape_donut: { s: 0.55, dy: -0.34 }, // a ring: the face is squeezed onto the bottom band
  shape_daruma: { mouthOnly: true, s: 0.9, dy: -0.12 }, // already has baked eyes in a white mask: only the mouth
};
export function shapeFaceAnchor(THREE, name, root) {
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()), box = new THREE.Box3().setFromObject(root), cen = box.getCenter(new THREE.Vector3());
  const o = SHAPE_FACE[name] || {};
  if (o.skip) return null;
  const s = 0.6 * Math.min(size.x, size.y) * (o.s || 1);
  const eyeY = cen.y + 0.145 * s + (o.dy || 0) * size.y;
  let eyeX = cen.x + (o.dx || 0) * size.x;
  if (o.follow) { // leaning body: centre on the middle of the cross-section at the face height, not on the bbox centre
    let lo = Infinity, hi = -Infinity;
    const v = new THREE.Vector3(), band = 0.04 * size.y;
    root.traverse((n) => {
      const pos = n.isMesh && n.geometry?.attributes.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld); if (Math.abs(v.y - eyeY) < band) { lo = Math.min(lo, v.x); hi = Math.max(hi, v.x); } }
    });
    if (hi > lo) eyeX = (lo + hi) / 2 + (o.dx || 0) * size.x;
  }
  if (o.mouthOnly) {
    const M = LAYOUTS.mouth, mh = (M.h / (M.w / M.unitsW)) * s;
    return { rect: { x: eyeX, y: cen.y + (o.dy || 0) * size.y, w: M.unitsW * s, h: mh }, offset: 0.012 * Math.max(size.x, size.y), scale: s, mouthOnly: true };
  }
  const L = LAYOUTS.face;
  return { rect: { x: eyeX, y: eyeY - (L.h / (L.w / L.unitsW) / 2 - L.eyeY) * s, w: L.unitsW * s, h: (L.h / (L.w / L.unitsW)) * s }, offset: 0.012 * Math.max(size.x, size.y), scale: s };
}
// Emoji heads: the RTK mouth is centred on the baked mouth meshes (Mouth, Teeth, Tongue), which the page then hides.
export function emojiMouthAnchor(THREE, name, baked) {
  const box = new THREE.Box3();
  baked.forEach((m) => box.expandByObject(m));
  const cen = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const s = Math.min(1.9, Math.max(1.15, (size.x / 0.27) * 0.85));
  const L = LAYOUTS.mouth;
  return { rect: { x: cen.x, y: cen.y, w: L.unitsW * s, h: (L.h / (L.w / L.unitsW)) * s }, offset: 0.012, scale: s };
}

export const rtkLayout = { LAYOUTS, RTK_UNIT, EYE };

// Hand rig mapping helpers, shared with site/tube-face.js (no behaviour change here).
export const handRigMap = { SH, MOUTH_Z, faceShapePos };
