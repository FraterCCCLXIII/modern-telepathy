// Tube face for the Kamiji characters: the 3D emoji heads' face (assets/props/faces/*.glb, built by
// model/props_faces.py) rebuilt live. The MOUTH is a round-profile tube swept along a parametric curve (the emoji
// heads' `line()` / `tube()` mouths), with an inner fill, a tongue tube and a teeth tube for open mouths. The EYES are the
// emoji heads' eye shapes (round dots, ^ ^, u u, > <, stars, hearts) with their brows, re-created from props_faces.py.
// Depends only on the page's three (plus the hand rig mapping exported by rtk-mouth.js). See docs/tube-face.md.
//
// One merged BufferGeometry with vertex colours (a single draw call and a single MeshStandardMaterial). Every vertex
// count is fixed, so expressions are tweened by lerping the pose numbers (curve control values and eye variant weights)
// and rewriting the position attribute, never by swapping meshes.
//
// Targets:
//   "hand"     SkinnedMesh bound to the Face bone of assets/kamiji.glb. Rest positions follow the palm surface and the
//              shapeSphere / shapeCube morph weights are applied on the CPU (hand, sphere and cube heads).
//   "surface"  plain mesh laid on any model by ray casting (library shapes, emoji heads).
// Public API (same as site/rtk-mouth.js, so window.kamijiFace drives either):
//   attach, setExpression, setViseme, setOpen, speakText, stop, setVisible, setInk, setTint, setMouthShown, setGaze,
//   update(dt) -> changed, dispose, plus .visible .covered .mesh .morphMesh (always null: no morph targets needed)
import { handRigMap } from "./rtk-mouth.js";

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Role palette copied from model/props_faces.py PALETTE (sRGB hex). "Inside" is a darker Mouth for the open mouth fill.
const PALETTE = { eye: "#3a2a28", brow: "#5a4036", mouth: "#8c3a34", inside: "#5e2227", tongue: "#ee8c98", teeth: "#f8f2e6", red: "#d9574c", gold: "#f3c455", glint: "#ffffff" };

// ---------------------------------------------------------------- poses
// A pose is a bag of numbers; the tween is a lerp over KEYS. Units are the emoji head's (head radius 0.5, EX 0.17, EY 0.08).
export const VARIANTS = ["dot", "up", "down", "squint", "star", "heart"];
const BASE = {
  w: 0.12, cy: -0.19, d: 0, top: 0, bot: 0, skew: 0, mx: 0, teeth: 0, tongue: 0, mr: 0.034, // mouth: half width, corner line y, corner lift, upper/lower lip bulge ...
  ex: 0.17, ey: 0.08, rx: 0.05, ry: 0.075,                                                    // eyes: half spacing, y, dot radii
  bon: 0, bYL: 0.2, bYR: 0.2, bInL: 0, bInR: 0, bW: 0.14, bArch: 0.012,                       // brows
};
for (const s of ["L", "R"]) for (const v of VARIANTS) BASE[`${s}_${v}`] = 0;
const KEYS = Object.keys(BASE);
function pose(o) {
  const { eyes = "dot", eyesL, eyesR, ...rest } = o;
  const p = { ...BASE, ...rest };
  p[`L_${eyesL || eyes}`] = 1; p[`R_${eyesR || eyes}`] = 1;
  return p;
}
// Kamiji expression -> emoji head face (props_faces.py function in the comment).
const EXPR = {
  neutral: pose({ eyes: "dot", w: 0.12, cy: -0.19, d: 0.012 }),                                                      // f_neutral (+ a hint of smile)
  happy: pose({ eyes: "up", w: 0.2, cy: -0.14, d: 0.1 }),                                                            // f_smile
  excited: pose({ eyes: "star", ex: 0.175, ey: 0.1, w: 0.24, cy: -0.1, bot: 0.2, teeth: 1 }),                          // f_star_eyes
  thinking: pose({ eyes: "dot", rx: 0.045, ry: 0.065, ey: 0.1, bon: 1, bYL: 0.23, bYR: 0.25, bInL: -0.035, bInR: 0.02, bArch: 0.005, w: 0.13, mx: -0.01, cy: -0.2, d: -0.012, skew: -0.012, mr: 0.032 }), // f_thinking
  sad: pose({ eyes: "dot", rx: 0.045, ry: 0.065, ey: 0.05, bon: 1, bYL: 0.2, bYR: 0.2, bInL: 0.04, bInR: 0.04, w: 0.15, cy: -0.22, d: -0.08 }), // f_sad
  angry: pose({ eyes: "dot", rx: 0.045, ry: 0.06, ey: 0.06, bon: 1, bYL: 0.19, bYR: 0.19, bInL: -0.05, bInR: -0.05, bW: 0.17, bArch: 0, w: 0.15, cy: -0.2, d: -0.065, mr: 0.036 }), // f_angry
  surprised: pose({ eyes: "dot", rx: 0.06, ry: 0.1, ey: 0.06, bon: 1, bYL: 0.17, bYR: 0.17, bInL: 0, bInR: 0, bW: 0.15, bArch: 0.035, w: 0.065, cy: -0.18, top: 0.085, bot: 0.085 }), // f_surprised
  sleepy: pose({ eyes: "down", ey: 0.07, w: 0.05, mx: -0.04, cy: -0.18, top: 0.04, bot: 0.04 }),                      // f_sleeping
  // extras (not in the 8): reachable through setExpression
  love: pose({ eyes: "heart", ex: 0.175, ey: 0.1, w: 0.19, cy: -0.12, bot: 0.17, tongue: 1 }),                         // f_heart_eyes
  joy: pose({ eyes: "squint", ey: 0.1, w: 0.26, cy: -0.09, bot: 0.23, teeth: 1, tongue: 1 }),                          // f_joy
  wink: pose({ eyesL: "dot", eyesR: "down", w: 0.2, cy: -0.14, d: 0.1, skew: 0.02 }),                                 // f_wink
};
export const TUBE_EXPRESSIONS = ["neutral", "happy", "excited", "thinking", "sad", "angry", "surprised", "sleepy"];
// emoji kamijiExpression / RTK names that are not tube names
const ALIAS = { calm: "neutral", closed: "neutral" };
const exprPose = (n) => EXPR[n] || EXPR[ALIAS[n]] || EXPR.neutral;

// Letters -> [RTK width px, height px, round]. Same table as rtk-mouth.js, reduced to what a tube mouth needs.
const LET = {
  A: [50, 35, 0], E: [65, 25, 0], I: [40, 20, 0], O: [40, 40, 1], U: [35, 35, 1], M: [55, 10, 0], B: [55, 10, 0], P: [55, 10, 0],
  F: [55, 20, 0], V: [55, 20, 0], L: [50, 25, 0], T: [50, 15, 0], D: [50, 15, 0], S: [50, 15, 0], Z: [50, 15, 0], N: [50, 15, 0],
  R: [50, 20, 0], K: [50, 20, 0], G: [50, 20, 0], rest: [30, 10, 0],
};
const LETTER_ALIAS = { C: "K", Q: "K", X: "K", Y: "I", W: "U", J: "S", H: "E" };
const VISEME_ALIAS = { sil: "rest", pp: "P", ff: "F", th: "T", dd: "T", kk: "K", ch: "S", ss: "S", nn: "N", rr: "R", aa: "A", e: "E", ih: "I", oh: "O", ou: "U" };
const NAMED = { closed: [30, 6, 0], calm: [40, 9, 0], smile: [60, 18, 0], frown: [55, 14, 0], open: LET.A, round: LET.O, wide: LET.E };
function specFor(id) {
  const raw = String(id), low = raw.toLowerCase();
  if (NAMED[low]) return NAMED[low];
  if (EXPR[low]) return null; // expression names are handled by setExpression
  const key = VISEME_ALIAS[low] || raw.toUpperCase();
  return LET[LETTER_ALIAS[key] || key] || (low === "rest" ? LET.rest : null);
}
// Open mouth for a letter spec, on top of the expression's own corner line and smile.
function visemePose(base, [w, h, round]) {
  const p = { ...base, top: 0, bot: 0, teeth: 0, tongue: 0 };
  const open = 0.24 * (h / 45);
  if (h <= 12) { p.w = 0.07 + 0.07 * (w / 65); p.bot = 0; p.d = base.d * 0.5; }
  else if (round) { p.w = 0.04 + 0.05 * (w / 40); p.top = p.bot = open * 0.5; p.d = 0; p.cy = base.cy - 0.0; }
  else { p.w = 0.06 + 0.13 * (w / 65); p.bot = open; p.d = base.d * 0.3; p.cy = base.cy + open * 0.25; p.teeth = h >= 20 ? 0.9 : 0; p.tongue = h >= 25 ? 0.8 : 0; }
  p.mx = base.mx * 0.5; p.skew = base.skew * 0.5;
  return p;
}
function openPose(base, v) { // setOpen(0..1): closed line to a wide "A"
  const p = { ...base };
  p.bot = 0.2 * v; p.w = base.w + (0.14 - base.w) * v * 0.6; p.d = base.d * (1 - 0.7 * v); p.cy = base.cy + p.bot * 0.25;
  p.teeth = v > 0.45 ? Math.min(1, (v - 0.45) * 3) : 0; p.tongue = v > 0.6 ? Math.min(0.8, (v - 0.6) * 3) : 0;
  return p;
}

// CSS cubic-bezier(0.4, 0, 0.2, 1), as the RTK mouth
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => { let t = x; for (let i = 0; i < 6; i++) { const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; } return Y(clamp(t)); };
}
const EASE = bezier(0.4, 0, 0.2, 1);

// ---------------------------------------------------------------- mouth curves
// upper(t) / lower(t), t in [-1, 1]: the lip centre lines. A smile is upper = lower (the tube retraces itself); an open
// mouth is the D / O loop of the emoji heads (props_faces.py dloop / ellipse).
const rt = (t) => Math.sqrt(Math.max(0, 1 - t * t));
const upperY = (P, t) => P.cy - P.d * (1 - t * t) + P.skew * t + P.top * rt(t);
const lowerY = (P, t) => P.cy - P.d * (1 - t * t) + P.skew * t - P.bot * rt(t);

// ---------------------------------------------------------------- vertex part builders
// Every part has a fixed vertex count `n`, `tris` (indices relative to the part) and `write(loc, o, P, st)`.
const SEG = 8, CAP = [(65 * Math.PI) / 180, (35 * Math.PI) / 180];
const COS = Array.from({ length: 16 }, (_, j) => Math.cos((TAU * j) / 16)), SIN = Array.from({ length: 16 }, (_, j) => Math.sin((TAU * j) / 16));
const cosT = (segs, j) => (segs === 16 ? COS[j] : Math.cos((TAU * j) / segs)), sinT = (segs, j) => (segs === 16 ? SIN[j] : Math.sin((TAU * j) / segs));

function rowsTris(R, segs) { // apex0, R rings of `segs`, apex1
  const idx = [], v = (r, j) => 1 + r * segs + (j % segs), a1 = 1 + R * segs;
  for (let j = 0; j < segs; j++) idx.push(0, v(0, j), v(0, j + 1));
  for (let r = 0; r < R - 1; r++) for (let j = 0; j < segs; j++) { const a = v(r, j), b = v(r + 1, j), b1 = v(r + 1, j + 1), a2 = v(r, j + 1); idx.push(a, b, b1, a, b1, a2); }
  for (let j = 0; j < segs; j++) idx.push(v(R - 1, j), a1, v(R - 1, j + 1));
  return idx;
}
function writeRing(loc, k, cx, cy, cz, mx, my, rM, rZ, segs) {
  for (let j = 0; j < segs; j++) {
    const c = cosT(segs, j), s = sinT(segs, j), q = (k + j) * 3;
    loc[q] = cx + s * rM * mx; loc[q + 1] = cy + s * rM * my; loc[q + 2] = cz + c * rZ;
  }
}
const TX = new Float64Array(128), TY = new Float64Array(128), MT = new Float64Array(128);
/** Round-capped tube along pts (flat x,y,z * n), radius rad[i], z squash zs. Vertex count 2 + (n + 4) * segs. */
function writeTube(loc, o, pts, rad, n, zs, segs) {
  let px = 1, py = 0;
  for (let i = 0; i < n; i++) {
    let ax = 0, ay = 0, bx = 0, by = 0, la = 0, lb = 0;
    if (i > 0) { ax = pts[i * 3] - pts[(i - 1) * 3]; ay = pts[i * 3 + 1] - pts[(i - 1) * 3 + 1]; la = Math.hypot(ax, ay); }
    if (i < n - 1) { bx = pts[(i + 1) * 3] - pts[i * 3]; by = pts[(i + 1) * 3 + 1] - pts[i * 3 + 1]; lb = Math.hypot(bx, by); }
    if (la > 1e-6) { ax /= la; ay /= la; } else la = 0;
    if (lb > 1e-6) { bx /= lb; by /= lb; } else lb = 0;
    let tx, ty, mt = 1;
    if (la && lb) {
      const sx = ax + bx, sy = ay + by, sl = Math.hypot(sx, sy);
      if (sl < 1e-3) { tx = ax; ty = ay; } else { tx = sx / sl; ty = sy / sl; mt = 1 / Math.max(0.55, ax * tx + ay * ty); }
    } else if (la) { tx = ax; ty = ay; } else if (lb) { tx = bx; ty = by; } else { tx = px; ty = py; }
    TX[i] = tx; TY[i] = ty; MT[i] = mt; px = tx; py = ty;
  }
  const last = n - 1;
  let k = o + 1; // vertex cursor: apex0 sits at o
  const r0 = rad[0], r1 = rad[last];
  loc[o * 3] = pts[0] - TX[0] * r0; loc[o * 3 + 1] = pts[1] - TY[0] * r0; loc[o * 3 + 2] = pts[2];
  for (const a of CAP) { // start cap rows
    const sn = Math.sin(a), cs = Math.cos(a);
    writeRing(loc, k, pts[0] - TX[0] * r0 * sn, pts[1] - TY[0] * r0 * sn, pts[2], -TY[0], TX[0], r0 * cs, r0 * cs * zs, segs); k += segs;
  }
  for (let i = 0; i < n; i++) { writeRing(loc, k, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], -TY[i], TX[i], rad[i] * MT[i], rad[i] * zs, segs); k += segs; }
  for (let c = CAP.length - 1; c >= 0; c--) {
    const a = CAP[c], sn = Math.sin(a), cs = Math.cos(a);
    writeRing(loc, k, pts[last * 3] + TX[last] * r1 * sn, pts[last * 3 + 1] + TY[last] * r1 * sn, pts[last * 3 + 2], -TY[last], TX[last], r1 * cs, r1 * cs * zs, segs); k += segs;
  }
  loc[k * 3] = pts[last * 3] + TX[last] * r1; loc[k * 3 + 1] = pts[last * 3 + 1] + TY[last] * r1; loc[k * 3 + 2] = pts[last * 3 + 2];
}
const tubeCount = (n, segs) => 2 + (n + 2 * CAP.length) * segs;
const tubeTris = (n, segs) => rowsTris(n + 2 * CAP.length, segs);

/** Ellipsoid (sphere dots) built as a ring sequence along y. Vertex count 2 + rows * segs. */
function writeEllipsoid(loc, o, cx, cy, cz, rx, ry, rz, rows, segs) {
  loc[o * 3] = cx; loc[o * 3 + 1] = cy - ry; loc[o * 3 + 2] = cz;
  let k = o + 1;
  for (let r = 0; r < rows; r++) {
    const phi = -Math.PI / 2 + (Math.PI * (r + 1)) / (rows + 1), c = Math.cos(phi);
    writeRing(loc, k, cx, cy + ry * Math.sin(phi), cz, -1, 0, rx * c, rz * c, segs); k += segs;
  }
  loc[k * 3] = cx; loc[k * 3 + 1] = cy + ry; loc[k * 3 + 2] = cz;
}
function collapse(loc, o, n, x, y, z) { for (let i = o * 3, e = (o + n) * 3; i < e; i += 3) { loc[i] = x; loc[i + 1] = y; loc[i + 2] = z; } }

// Filled outline with a domed profile (props_faces.py pillow()): rings from the rim to the top, then the centre.
const BLOB_S = [1, 0.9, 0.66, 0.34], BLOB_Z = [-0.25, 0.35, 0.8, 1];
function blobTris(nL) {
  const K = BLOB_S.length, idx = [], v = (k, i) => k * nL + (i % nL);
  for (let k = 0; k < K - 1; k++) for (let i = 0; i < nL; i++) { const o0 = v(k, i), o1 = v(k, i + 1), i0 = v(k + 1, i), i1 = v(k + 1, i + 1); idx.push(o0, o1, i0, o1, i1, i0); }
  for (let i = 0; i < nL; i++) idx.push(v(K - 1, i), v(K - 1, i + 1), K * nL);
  return idx;
}
function writeBlob(loc, o, lx, ly, nL, cx, cy, sc, depth, z0) {
  for (let k = 0; k < BLOB_S.length; k++) for (let i = 0; i < nL; i++) {
    const q = (o + k * nL + i) * 3;
    loc[q] = cx + lx[i] * sc * BLOB_S[k]; loc[q + 1] = cy + ly[i] * sc * BLOB_S[k]; loc[q + 2] = z0 + BLOB_Z[k] * depth * sc;
  }
  const q = (o + BLOB_S.length * nL) * 3;
  loc[q] = cx; loc[q + 1] = cy; loc[q + 2] = z0 + depth * sc;
}
const blobCount = (nL) => BLOB_S.length * nL + 1;

function chaikin(pts, n = 2) { // closed
  let p = pts;
  for (let it = 0; it < n; it++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } p = o; }
  return p;
}
function ccw(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? pts : pts.slice().reverse(); }
const STAR = (() => { // props_faces.py star_outline(5, 0.135, 0.065) + chaikin 2
  const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.065 : 0.135, a = (Math.PI / 2) + (TAU * i) / 10; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  return ccw(chaikin(pts, 2));
})();
const HEART = (() => { // props_faces.py heart_loop(cx, cy, 0.23)
  const s = 0.23, pts = []; for (let i = 0; i < 48; i++) { const t = (TAU * i) / 48; pts.push([(s * 16 * Math.sin(t) ** 3) / 34, (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 34 - 0.01]); }
  return ccw(pts);
})();
const split = (pts) => [pts.map((p) => p[0]), pts.map((p) => p[1])];
const STAR_XY = split(STAR), HEART_XY = split(HEART);

// ---------------------------------------------------------------- layout (parts in one geometry)
const layoutCache = new Map();
const MN = 25, FC = 25, FR = 5; // mouth tube samples, fill columns and rows
const rad2 = (d) => (d * Math.PI) / 180;

function buildLayout(eyes, variants, brows) {
  const key = `${eyes ? 1 : 0}|${variants.join(",")}|${brows ? 1 : 0}`;
  let L = layoutCache.get(key);
  if (L) return L;
  let n = 0;
  const index = [], parts = [], roles = []; // roles: [role, start, count]
  const add = (role, count, tris, write) => {
    const o = n; n += count;
    for (const t of tris) index.push(o + t);
    roles.push([role, o, count]);
    parts.push((loc, P, st) => write(loc, o, P, st));
  };
  const sc = new Float64Array(256), rad = new Float64Array(64);

  // ---- mouth: fill (under), tube, tongue, teeth
  add("inside", FC * FR, (() => { const t = []; for (let r = 0; r < FR - 1; r++) for (let c = 0; c < FC - 1; c++) { const a = r * FC + c, b = (r + 1) * FC + c, d = (r + 1) * FC + c + 1, e = r * FC + c + 1; t.push(a, b, d, a, d, e); } return t; })(),
    (loc, o, P, st) => {
      for (let c = 0; c < FC; c++) {
        const t = -1 + (2 * c) / (FC - 1), x = P.mx + P.w * t, yu = upperY(P, t), yl = lowerY(P, t);
        for (let r = 0; r < FR; r++) { const q = (o + r * FC + c) * 3; loc[q] = x; loc[q + 1] = yu + ((yl - yu) * r) / (FR - 1); loc[q + 2] = 0; }
      }
      if (st.noMouth) collapse(loc, o, FC * FR, 0, 0, 0);
    });
  // Two open tubes, upper lip then lower lip, each with round caps meeting at the corners (a closed mouth makes them coincide).
  // (A single retraced loop had a cusp where the path reverses; scratch buffers were also too small for 49 points.)
  for (const lip of [upperY, lowerY]) {
    add("mouth", tubeCount(MN, SEG), tubeTris(MN, SEG), (loc, o, P, st) => {
      for (let i = 0; i < MN; i++) {
        const t = -1 + (2 * i) / (MN - 1);
        sc[i * 3] = P.mx + P.w * t; sc[i * 3 + 1] = lip(P, t); sc[i * 3 + 2] = 0.012; rad[i] = st.noMouth ? 0 : P.mr;
      }
      writeTube(loc, o, sc, rad, MN, 1, SEG);
    });
  }
  const NT = 9;
  add("tongue", tubeCount(NT, SEG), tubeTris(NT, SEG), (loc, o, P, st) => {
    const r = st.noMouth ? 0 : Math.max(0, Math.min(0.045, (P.bot - 0.04) * 0.34)) * P.tongue;
    for (let i = 0; i < NT; i++) { const t = -0.55 + (1.1 * i) / (NT - 1); sc[i * 3] = P.mx + P.w * t; sc[i * 3 + 1] = lowerY(P, t) + P.mr + r * 0.45; sc[i * 3 + 2] = 0.01; rad[i] = r; }
    writeTube(loc, o, sc, rad, NT, 1, SEG);
  });
  const NTH = 11;
  add("teeth", tubeCount(NTH, SEG), tubeTris(NTH, SEG), (loc, o, P, st) => {
    const r = st.noMouth ? 0 : 0.021 * P.teeth * smooth(0.03, 0.08, P.bot);
    for (let i = 0; i < NTH; i++) { const t = -0.7 + (1.4 * i) / (NTH - 1); sc[i * 3] = P.mx + P.w * t; sc[i * 3 + 1] = upperY(P, t) - P.mr - r * 0.3; sc[i * 3 + 2] = 0.004; rad[i] = r; }
    writeTube(loc, o, sc, rad, NTH, 0.55, SEG);
  });

  // ---- eyes
  if (eyes) {
    for (const [si, side] of [["L", -1], ["R", 1]]) {
      const eyeXY = (P, st) => [side * P.ex + st.gx, P.ey + st.gy];
      if (variants.includes("dot")) {
        add("eye", 2 + 7 * 10, rowsTris(7, 10), (loc, o, P, st) => {
          const w = P[`${si}_dot`], [cx, cy] = eyeXY(P, st);
          if (w < 0.02) return collapse(loc, o, 72, cx, cy, 0.02);
          const rx = P.rx * w, ry = P.ry * w * (1 - 0.93 * st.blink);
          writeEllipsoid(loc, o, cx, cy, 0.02, rx, ry, Math.min(P.rx, P.ry) * 0.85 * w, 7, 10);
        });
        add("glint", 2 + 3 * 6, rowsTris(3, 6), (loc, o, P, st) => {
          const w = P[`${si}_dot`] * (1 - st.blink), [cx, cy] = eyeXY(P, st);
          if (w < 0.05) return collapse(loc, o, 20, cx, cy, 0.02);
          const r = P.rx * 0.3 * w;
          writeEllipsoid(loc, o, cx + P.rx * 0.28 * w, cy + P.ry * 0.38 * w, 0.02 + Math.min(P.rx, P.ry) * 0.62 * w, r, r * 1.15, r * 0.7, 3, 6);
        });
      }
      const arcTube = (name, ax, ay, rx, ry, a0, a1, r) => {
        const NP = 9;
        add("eye", tubeCount(NP, SEG), tubeTris(NP, SEG), (loc, o, P, st) => {
          const w = P[`${si}_${name}`], [cx, cy] = eyeXY(P, st);
          if (w < 0.02) return collapse(loc, o, tubeCount(NP, SEG), cx, cy, 0.02);
          for (let i = 0; i < NP; i++) { const a = rad2(a0 + ((a1 - a0) * i) / (NP - 1)); sc[i * 3] = cx + ax * 0 + rx * Math.cos(a) * w; sc[i * 3 + 1] = cy + ay + ry * Math.sin(a) * w; sc[i * 3 + 2] = 0.016; rad[i] = r * w; }
          writeTube(loc, o, sc, rad, NP, 1, SEG);
        });
      };
      if (variants.includes("up")) arcTube("up", 0, -0.03, 0.075, 0.07, 25, 155, 0.032);     // eyes_happy ^ ^
      if (variants.includes("down")) arcTube("down", 0, 0.03, 0.075, 0.045, 205, 335, 0.03);  // eyes_closed_down u u
      if (variants.includes("squint")) {
        add("eye", tubeCount(5, SEG), tubeTris(5, SEG), (loc, o, P, st) => { // eyes_squint > <
          const w = P[`${si}_squint`], [cx, cy] = eyeXY(P, st), hw = 0.085 * w;
          if (w < 0.02) return collapse(loc, o, tubeCount(5, SEG), cx, cy, 0.02);
          const xs = [side, 0, -side, 0, side], ys = [0.075, 0.0375, 0, -0.0375, -0.075];
          for (let i = 0; i < 5; i++) { sc[i * 3] = cx + xs[i] * hw; sc[i * 3 + 1] = cy + ys[i] * w; sc[i * 3 + 2] = 0.016; rad[i] = 0.032 * w; }
          writeTube(loc, o, sc, rad, 5, 1, SEG);
        });
      }
      if (variants.includes("star")) {
        add("gold", blobCount(STAR_XY[0].length), blobTris(STAR_XY[0].length), (loc, o, P, st) => {
          const w = P[`${si}_star`], [cx, cy] = eyeXY(P, st);
          if (w < 0.02) return collapse(loc, o, blobCount(STAR_XY[0].length), cx, cy, 0.02);
          writeBlob(loc, o, STAR_XY[0], STAR_XY[1], STAR_XY[0].length, cx, cy, w, 0.16, 0.0);
        });
      }
      if (variants.includes("heart")) {
        add("red", blobCount(HEART_XY[0].length), blobTris(HEART_XY[0].length), (loc, o, P, st) => {
          const w = P[`${si}_heart`], [cx, cy] = eyeXY(P, st);
          if (w < 0.02) return collapse(loc, o, blobCount(HEART_XY[0].length), cx, cy, 0.02);
          writeBlob(loc, o, HEART_XY[0], HEART_XY[1], HEART_XY[0].length, cx, cy, w, 0.17, 0.0);
        });
      }
    }
  }
  // ---- brows (props_faces.py brow(): 3-point parabola, round tube)
  if (brows) {
    const NB = 7;
    for (const [si, side] of [["L", -1], ["R", 1]]) {
      add("brow", tubeCount(NB, SEG), tubeTris(NB, SEG), (loc, o, P, st) => {
        const x = side * P.ex + st.gx, y = (side < 0 ? P.bYL : P.bYR) + st.gy, inner = side < 0 ? P.bInL : P.bInR, w = P.bW, on = P.bon;
        if (on < 0.02) return collapse(loc, o, tubeCount(NB, SEG), x, y, 0.02);
        const xi = x - (side * w) / 2, xo = x + (side * w) / 2, yi = y + inner, ym = y + P.bArch, yo = y - inner;
        for (let i = 0; i < NB; i++) { const s = i / (NB - 1), cx = x + (xi + (xo - xi) * s - x) * on; sc[i * 3] = cx; sc[i * 3 + 1] = yi * (1 - s) * (1 - 2 * s) + 4 * ym * s * (1 - s) + yo * s * (2 * s - 1); sc[i * 3 + 2] = 0.012; rad[i] = 0.03 * on; }
        writeTube(loc, o, sc, rad, NB, 1, SEG);
      });
    }
  }
  L = { key, n, index: n > 65535 ? new Uint32Array(index) : new Uint16Array(index), parts, roles };
  layoutCache.set(key, L);
  return L;
}

// ---------------------------------------------------------------- surface fields
// A field turns face-plane points (x, y, z in emoji units) into positions on the target:
//   map(loc, out, n, frame) with frame { ox, oy, K } (K = target units per emoji unit)

/** Surface by ray casting along -z (library shapes and emoji heads). region: { cx, cy, hw, hh } in the root's xy plane. */
function surfaceField(THREE, root, targets, region, grid = [34, 28]) {
  root.updateMatrixWorld(true);
  const [NX, NY] = grid, nodes = (NX + 1) * (NY + 1);
  const P = new Float32Array(nodes * 3), N = new Float32Array(nodes * 3), hit = new Uint8Array(nodes);
  const rc = new THREE.Raycaster(), dir = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld), o = new THREE.Vector3(); // rays run along the root's own -z
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], nn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], n = new THREE.Vector3();
  const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const gxOf = (i) => region.cx - region.hw + (i / NX) * 2 * region.hw, gyOf = (j) => region.cy + region.hh - (j / NY) * 2 * region.hh;
  let hits = 0;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i;
    rc.set(o.set(gxOf(i), gyOf(j), 10).applyMatrix4(root.matrixWorld), dir);
    const h = rc.intersectObjects(targets, false)[0];
    if (!h) continue;
    const m = h.object, g = m.geometry, f = h.face;
    const p = h.point.clone().applyMatrix4(invRoot);
    if (g.attributes.normal) {
      for (let q = 0; q < 3; q++) { const vi = [f.a, f.b, f.c][q]; tri[q].fromBufferAttribute(g.attributes.position, vi); nn[q].fromBufferAttribute(g.attributes.normal, vi); }
      THREE.Triangle.getInterpolation(m.worldToLocal(h.point.clone()), tri[0], tri[1], tri[2], nn[0], nn[1], nn[2], n);
      n.transformDirection(m.matrixWorld).transformDirection(invRoot);
    } else n.copy(f.normal).transformDirection(m.matrixWorld).transformDirection(invRoot);
    n.normalize();
    P.set([p.x, p.y, p.z], k * 3); N.set([n.x, n.y, n.z], k * 3); hit[k] = 1; hits++;
  }
  // extend into the misses (outside the silhouette) from the nearest hits so tubes never jump to the origin
  for (let pass = 0; pass < 40; pass++) {
    const fill = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const k = j * (NX + 1) + i;
      if (hit[k]) continue;
      let c = 0, z = 0, nx = 0, ny = 0, nz = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a > NX || b > NY) continue;
        const q = b * (NX + 1) + a; if (!hit[q]) continue;
        c++; z += P[q * 3 + 2]; nx += N[q * 3]; ny += N[q * 3 + 1]; nz += N[q * 3 + 2];
      }
      if (c) fill.push([k, gxOf(i), gyOf(j), z / c, nx / c, ny / c, nz / c]);
    }
    if (!fill.length) break;
    for (const [k, x, y, z, a, b, c] of fill) { P.set([x, y, z], k * 3); const l = Math.hypot(a, b, c) || 1; N.set([a / l, b / l, c / l], k * 3); hit[k] = 1; }
  }
  const stepX = (2 * region.hw) / NX, stepY = (2 * region.hh) / NY, x0 = region.cx - region.hw, yTop = region.cy + region.hh;
  return {
    coverage: hits / nodes,
    map(loc, out, count, fr) {
      for (let v = 0; v < count; v++) {
        const gx = fr.ox + loc[v * 3] * fr.K, gy = fr.oy + loc[v * 3 + 1] * fr.K, h = loc[v * 3 + 2] * fr.K + fr.lift;
        const fx = clamp((gx - x0) / stepX, 0, NX - 1e-4), fy = clamp((yTop - gy) / stepY, 0, NY - 1e-4);
        const i = fx | 0, j = fy | 0, u = fx - i, w = fy - j;
        const k00 = (j * (NX + 1) + i) * 3, k10 = k00 + 3, k01 = k00 + (NX + 1) * 3, k11 = k01 + 3;
        const a = (1 - u) * (1 - w), b = u * (1 - w), c = (1 - u) * w, d = u * w;
        let nx = N[k00] * a + N[k10] * b + N[k01] * c + N[k11] * d, ny = N[k00 + 1] * a + N[k10 + 1] * b + N[k01 + 1] * c + N[k11 + 1] * d, nz = N[k00 + 2] * a + N[k10 + 2] * b + N[k01 + 2] * c + N[k11 + 2] * d;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const sz = P[k00 + 2] * a + P[k10 + 2] * b + P[k01 + 2] * c + P[k11 + 2] * d;
        out[v * 3] = gx + nx * h; out[v * 3 + 1] = gy + ny * h; out[v * 3 + 2] = sz + nz * h;
      }
    },
  };
}

/** Hand rig: rest surface of the palm by ray casting the Hand mesh, then the sphere / cube morphs applied on the CPU. */
const handFieldCache = new WeakMap();
function handField(THREE, handMesh) {
  let g = handFieldCache.get(handMesh.geometry);
  if (g) return g;
  const { SH, faceShapePos } = handRigMap;
  const probe = new THREE.Mesh(handMesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, 0, -1), o = new THREE.Vector3();
  const NX = 44, NZ = 40, X0 = SH.CX - 0.55, X1 = SH.CX + 0.55, Z0 = -1.15, Z1 = -0.1;
  const Y = new Float32Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = X0 + ((X1 - X0) * i) / NX, zb = Z1 - ((Z1 - Z0) * j) / NZ;
    rc.set(o.set(x, zb, 3), down);
    const h = rc.intersectObject(probe, false)[0];
    Y[j * (NX + 1) + i] = h ? -h.point.z : -0.12;
  }
  const surf = (x, zb) => {
    const fx = clamp(((x - X0) / (X1 - X0)) * NX, 0, NX - 1e-4), fz = clamp(((Z1 - zb) / (Z1 - Z0)) * NZ, 0, NZ - 1e-4), i = fx | 0, j = fz | 0, u = fx - i, w = fz - j;
    const k = j * (NX + 1) + i;
    return Y[k] * (1 - u) * (1 - w) + Y[k + 1] * u * (1 - w) + Y[k + NX + 1] * (1 - u) * w + Y[k + NX + 2] * u * w;
  };
  g = {
    coverage: 1,
    map(loc, out, count, fr) {
      const ns = fr.ws, nc = fr.wc;
      for (let v = 0; v < count; v++) {
        const xb = SH.CX + loc[v * 3] * fr.K, zb = fr.zb0 + loc[v * 3 + 1] * fr.K, sy = surf(xb, zb), yb = sy - (loc[v * 3 + 2] * fr.K + fr.lift);
        // glTF = [x, z, -y]
        let X = xb, Yg = zb, Z = -yb;
        if (ns > 0.001) { const p = faceShapePos(xb, yb, zb, sy, "sphere"); X += ns * (p[0] - xb); Yg += ns * (p[2] - zb); Z += ns * (-p[1] + yb); }
        if (nc > 0.001) { const p = faceShapePos(xb, yb, zb, sy, "cube"); X += nc * (p[0] - xb); Yg += nc * (p[2] - zb); Z += nc * (-p[1] + yb); }
        out[v * 3] = X; out[v * 3 + 1] = Yg; out[v * 3 + 2] = Z;
      }
    },
  };
  handFieldCache.set(handMesh.geometry, g);
  return g;
}
const surfaceFieldCache = new Map();

// ---------------------------------------------------------------- controller
/**
 * @param THREE the page's three
 * @param root hand: the cloned GLB root; surface: the model root the face is added to
 * @param opts {
 *   target: "hand" | "surface", live (animate; false = static tile, snaps), reduceMotion, expression, onDirty(),
 *   eyes (default true: false keeps the model's own eyes, emoji heads), followPointer,
 *   surface: targets (meshes the rays may hit), frame { ox, oy, K } and region { cx, cy, hw, hh } (see tubeShapeAnchor),
 *   cacheKey, ink (mouth colour), tint (mouth inside colour), lift (extra distance above the surface, emoji units) }
 */
export function createTubeFace(THREE, root, opts = {}) {
  const live = opts.live !== false, withEyes = opts.eyes !== false;
  const c = { disposed: false, visible: true, mesh: null, morphMesh: null, covered: 1, expression: "neutral" };
  const col = { ...PALETTE, ...(opts.ink ? { mouth: opts.ink } : {}), ...(opts.tint ? { inside: opts.tint } : {}) };
  const st = { blink: 0, gx: 0, gy: 0, noMouth: false };
  const want = { expression: opts.expression || "neutral", viseme: null, open: null, letter: null };
  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  let from = exprPose(want.expression), to = from, cur = from, t = 0, dur = 0;
  let speak = null, blinkIn = 2 + Math.random() * 2, blinkT = -1;
  let layout = null, geo = null, material = null, loc = null, field = null, frame = null, skinMesh = null, hiddenEyes = [], dirty = true;
  let pointerFn = null;
  const dirtyCb = () => opts.onDirty?.();

  const goal = () => {
    const base = exprPose(want.expression);
    let spec;
    if (want.viseme != null && (spec = specFor(want.viseme))) return visemePose(base, spec);
    if (want.open != null) return openPose(base, want.open);
    if (want.letter != null && (spec = specFor(want.letter))) return visemePose(base, spec);
    return base;
  };
  const lerpPose = (a, b, k) => { const o = {}; for (const key of KEYS) o[key] = a[key] + (b[key] - a[key]) * k; return o; };
  const retarget = (ms) => {
    const g2 = goal();
    if (g2 === to) return;
    from = cur; to = g2; t = 0; dur = opts.reduceMotion || !live ? 0 : ms;
    if (dur === 0) { cur = to; from = to; }
    dirty = true; if (!live) ensureLayout(); dirtyCb();
  };
  const variantsOf = (p) => VARIANTS.filter((v) => p[`L_${v}`] > 0.001 || p[`R_${v}`] > 0.001);

  function ensureLayout() { // live faces hold every variant; static ones only what the pose shows (rebuilt on change)
    const need = live ? VARIANTS : variantsOf(to);
    const next = buildLayout(withEyes, withEyes ? need : [], withEyes && (live || to.bon > 0.001));
    if (next === layout) return;
    layout = next;
    if (!c.mesh) return;
    const old = geo; geo = makeGeometry(); c.mesh.geometry = geo; old?.dispose();
    dirty = true;
  }
  function makeGeometry() {
    const g = new THREE.BufferGeometry();
    loc = new Float64Array(layout.n * 3);
    const pos = new THREE.BufferAttribute(new Float32Array(layout.n * 3), 3); pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", pos);
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(layout.n * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(layout.n * 3), 3));
    g.setIndex(new THREE.BufferAttribute(layout.index, 1));
    if (skinMesh) {
      const si = new Uint16Array(layout.n * 4), sw = new Float32Array(layout.n * 4);
      for (let i = 0; i < layout.n; i++) { si[i * 4] = skinMesh.boneIndex; sw[i * 4] = 1; }
      g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    }
    paintColors(g);
    return g;
  }
  const tmp = new THREE.Color();
  function paintColors(g) {
    const a = g.attributes.color.array;
    for (const [role, o, n] of layout.roles) {
      tmp.set(col[role] || col.eye);
      for (let i = o; i < o + n; i++) { a[i * 3] = tmp.r; a[i * 3 + 1] = tmp.g; a[i * 3 + 2] = tmp.b; }
    }
    g.attributes.color.needsUpdate = true;
  }

  function shapeWeights() {
    if (!skinMesh) return [0, 0];
    const d = skinMesh.face.morphTargetDictionary, inf = skinMesh.face.morphTargetInfluences;
    return [inf[d.shapeSphere] || 0, inf[d.shapeCube] || 0];
  }
  let lastShape = "";
  function rebuild() {
    for (const w of layout.parts) w(loc, cur, st);
    const n = layout.n, pos = geo.attributes.position;
    if (skinMesh) { const [ws, wc] = shapeWeights(); frame.ws = ws; frame.wc = wc; lastShape = `${ws.toFixed(3)}|${wc.toFixed(3)}`; }
    field.map(loc, pos.array, n, frame);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function setKamijiEyesHidden(h) {
    for (const m of hiddenEyes) m.visible = !h;
  }

  c.setExpression = (name) => { want.expression = name in EXPR || name in ALIAS ? name : "neutral"; c.expression = want.expression; retarget(150); };
  c.setViseme = (id) => { want.viseme = id == null ? null : id; retarget(opts.visemeMs ?? 90); };
  c.setOpen = (v) => { want.open = v == null ? null : clamp(+v || 0); retarget(70); };
  c.stop = () => { speak = null; want.letter = null; retarget(150); };
  c.speakText = (text, durationMs, onend) => {
    const letters = [...String(text || "").toUpperCase()].map((ch) => (/[A-Z]/.test(ch) ? ch : "rest"));
    if (!letters.length) return;
    const step = durationMs ? Math.min(300, Math.max(50, durationMs / letters.length)) / 1000 : 0.1;
    speak = { letters, step, i: 0, acc: 0, onend };
    want.letter = letters[0]; retarget(150);
  };
  c.setMouthShown = (b) => { st.noMouth = !b; dirty = true; dirtyCb(); };
  c.setGaze = (x, y) => { gaze.tx = clamp(+x || 0, -1, 1); gaze.ty = clamp(+y || 0, -1, 1); };
  c.setVisible = (b) => {
    c.visible = !!b; if (c.mesh) c.mesh.visible = c.visible;
    if (withEyes) setKamijiEyesHidden(c.visible); // the face rig version replaces the Kamiji eyes
    if (c.visible && live && !pointerFn && opts.followPointer && !opts.reduceMotion) {
      pointerFn = (e) => { gaze.tx = clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1); gaze.ty = clamp(-(e.clientY / innerHeight - 0.5) * 2, -1, 1); };
      addEventListener("pointermove", pointerFn, { passive: true });
    } else if (!c.visible && pointerFn) { removeEventListener("pointermove", pointerFn); pointerFn = null; }
    dirty = true; dirtyCb();
  };
  c.setInk = (hex) => { col.mouth = hex; if (geo) paintColors(geo); dirtyCb(); };
  c.setTint = (hex) => { col.inside = hex; if (geo) paintColors(geo); dirtyCb(); };

  c.attach = () => {
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
    material.name = "TubeFace";
    if (opts.target === "hand") {
      let faceMesh = null, handMesh = null;
      root.traverse((n) => {
        if (!n.isSkinnedMesh || !n.morphTargetDictionary) return;
        if ("mouthSmile" in n.morphTargetDictionary) faceMesh = n; else if (n.material?.name === "HandSkin" || !handMesh) handMesh = n;
      });
      if (!faceMesh || !handMesh) { c.disposed = true; return c; }
      root.traverse((n) => { if (n.isMesh && n.material?.name === "FacePupil") hiddenEyes.push(n); });
      skinMesh = { boneIndex: faceMesh.geometry.attributes.skinIndex.getX(0), face: faceMesh };
      field = handField(THREE, handMesh);
      const K = opts.scale ?? 0.9;
      frame = { K, zb0: handRigMap.SH.CZ - 0.075 * K + (opts.dy || 0), lift: 0.016, ws: 0, wc: 0 };
    } else {
      const region = opts.region, key = opts.cacheKey && `${opts.cacheKey}|${region.cx.toFixed(3)}|${region.cy.toFixed(3)}|${region.hw.toFixed(3)}`;
      field = key && surfaceFieldCache.get(key);
      if (!field) { field = surfaceField(THREE, root, opts.targets || [], region, opts.grid); if (key) surfaceFieldCache.set(key, field); }
      c.covered = field.coverage;
      frame = { ...opts.frame, lift: (opts.lift ?? 0.02) * opts.frame.K };
    }
    layout = null; ensureLayout();
    geo = makeGeometry();
    const mesh = skinMesh ? new THREE.SkinnedMesh(geo, material) : new THREE.Mesh(geo, material);
    if (skinMesh) {
      mesh.bindMode = skinMesh.face.bindMode;
      skinMesh.face.parent.add(mesh);
      mesh.bind(skinMesh.face.skeleton, skinMesh.face.bindMatrix);
    } else root.add(mesh);
    mesh.frustumCulled = false; mesh.name = "TubeFace"; mesh.visible = c.visible;
    c.mesh = mesh;
    rebuild(); dirty = false;
    if (withEyes) setKamijiEyesHidden(c.visible);
    return c;
  };

  // advance tween, letter steps, blink and gaze; true when the geometry changed (the page should redraw)
  c.update = (dt) => {
    if (c.disposed || !c.mesh || !c.visible) return false;
    if (!live) { if (dirty) { rebuild(); dirty = false; return true; } return false; }
    let changed = false;
    if (speak) {
      speak.acc += dt;
      while (speak && speak.acc >= speak.step) {
        speak.acc -= speak.step; speak.i++;
        if (speak.i >= speak.letters.length) { const end = speak.onend; speak = null; want.letter = null; retarget(150); end?.(); break; }
        want.letter = speak.letters[speak.i]; retarget(150);
      }
    }
    if (t < dur) { t = Math.min(dur, t + dt * 1000); cur = lerpPose(from, to, EASE(t / dur)); changed = true; } else if (cur !== to) { cur = to; changed = true; }
    if (withEyes && !opts.reduceMotion) {
      if (blinkT >= 0) { blinkT += dt; st.blink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) { blinkT = -1; st.blink = 0; } changed = true; }
      else { blinkIn -= dt; if (blinkIn <= 0) { blinkT = 0; blinkIn = 2 + Math.random() * 2.5; } }
    }
    if (withEyes && (gaze.x !== gaze.tx || gaze.y !== gaze.ty)) {
      const f = 1 - Math.exp(-10 * dt);
      gaze.x += (gaze.tx - gaze.x) * f; gaze.y += (gaze.ty - gaze.y) * f;
      if (Math.abs(gaze.tx - gaze.x) < 0.003) gaze.x = gaze.tx;
      if (Math.abs(gaze.ty - gaze.y) < 0.003) gaze.y = gaze.ty;
      st.gx = gaze.x * 0.02; st.gy = gaze.y * 0.014; changed = true;
    }
    if (skinMesh) { const [ws, wc] = shapeWeights(); if (`${ws.toFixed(3)}|${wc.toFixed(3)}` !== lastShape) changed = true; }
    if (changed || dirty) { rebuild(); dirty = false; return true; }
    return false;
  };

  c.dispose = () => {
    c.disposed = true;
    if (pointerFn) removeEventListener("pointermove", pointerFn);
    setKamijiEyesHidden(false);
    if (c.mesh) { c.mesh.parent?.remove(c.mesh); }
    geo?.dispose(); material?.dispose();
  };
  return c;
}

// ---------------------------------------------------------------- where the face goes on a library item
// Shapes: reuse shapeFaceAnchor() of rtk-mouth.js (its size / shift overrides per shape) and place the emoji face on it.
// anchor = shapeFaceAnchor(THREE, name, root); returns { frame, region, mouthOnly } for createTubeFace's surface target.
export const TUBE_SHAPE_FACE = { // extra per-shape tuning on top of SHAPE_FACE: s = size multiplier, dx / dy = shift in face widths
};
export function tubeShapeAnchor(THREE, name, anchor) {
  if (!anchor) return null;
  const o = TUBE_SHAPE_FACE[name] || {};
  const K = anchor.scale * (o.s || 1) * 1.0;
  const eyeX = anchor.rect.x + (o.dx || 0) * K;
  let oy;
  if (anchor.mouthOnly) oy = anchor.rect.y + 0.19 * K + (o.dy || 0) * K; // rect is centred on the mouth
  else oy = anchor.rect.y + 0.195 * anchor.scale - 0.08 * K + (o.dy || 0) * K; // the rtk face rect is centred 0.195 s below the eyes
  const region = { cx: eyeX, cy: oy - 0.1 * K, hw: 0.56 * K, hh: 0.44 * K };
  return { frame: { ox: eyeX, oy, K }, region, mouthOnly: !!anchor.mouthOnly };
}
// Emoji heads are authored in the face units themselves (head radius 0.5 at the origin): K = 1.
export function tubeEmojiAnchor() {
  return { frame: { ox: 0, oy: 0, K: 1 }, region: { cx: 0, cy: -0.05, hw: 0.4, hh: 0.34 } };
}
