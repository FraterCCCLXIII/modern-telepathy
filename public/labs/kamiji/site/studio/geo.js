// Small geometry kit for the procedural parts. Everything is low-poly, soft-shaded and built in three.js.
// Units are metres. Limbs hang down -Y; heads are ellipsoids with real morph targets.
import * as THREE from "three";
export { THREE };

const TAU = Math.PI * 2;

/** Tapered capsule from y = 0 down to y = -len (r0 at the top, r1 at the bottom). */
export function limb(len, r0, r1, seg = 10) {
  const cap = 4, p = [];
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); p.push(new THREE.Vector2(Math.sin(a) * r1, -len - Math.cos(a) * r1)); }
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); p.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  const q = p.map((v) => new THREE.Vector2(Math.max(v.x, 0.0001), v.y));
  const g = new THREE.LatheGeometry(q, seg);
  g.computeVertexNormals();
  return g;
}

/** Lathe body from a list of [y, radius] stations (bottom to top), elliptical by depth (z scale). */
export function lathe(stations, depth = 1, seg = 14, square = false) {
  let pts = stations.map(([y, r]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  if (!square && pts.length > 2) pts = new THREE.SplineCurve(pts).getPoints(pts.length * 4);
  const g = new THREE.LatheGeometry(pts, square ? 4 : seg);
  if (square) g.rotateY(Math.PI / 4);
  g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}

export function sphere(rx, ry = rx, rz = rx, w = 16, h = 12) { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); return g; }
export function cone(r, h, seg = 8) { return new THREE.ConeGeometry(r, h, seg); }

/** A tube along points (CatmullRom), radius tapering r0 -> r1. */
export function tube(points, r0, r1, seg = 20, rad = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const pos = g.attributes.position, c = new THREE.Vector3();
  const n = rad + 1;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * t, ctr = curve.getPointAt(t);
    for (let j = 0; j < n; j++) { const k = i * n + j; c.fromBufferAttribute(pos, k).sub(ctr).multiplyScalar(r).add(ctr); pos.setXYZ(k, c.x, c.y, c.z); }
  }
  g.computeVertexNormals();
  return g;
}

export function merge(geos) {
  const prepared = geos.map((g) => { const c = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(c.attributes)) if (!["position", "normal", "uv"].includes(k)) c.deleteAttribute(k); if (!c.attributes.uv) c.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); return c; });
  let total = 0; prepared.forEach((g) => (total += g.attributes.position.count));
  const out = { position: new Float32Array(total * 3), normal: new Float32Array(total * 3), uv: new Float32Array(total * 2) };
  let o = 0;
  for (const g of prepared) { out.position.set(g.attributes.position.array, o * 3); out.normal.set(g.attributes.normal.array, o * 3); out.uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.BufferAttribute(out.position, 3)); m.setAttribute("normal", new THREE.BufferAttribute(out.normal, 3)); m.setAttribute("uv", new THREE.BufferAttribute(out.uv, 2));
  return m;
}
export function at(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); return g;
}

/**
 * Head: an ellipsoid with a parametric shape. The base shape is `shape`; every entry in HEAD_MORPHS is a real morph
 * target (relative deltas) so the sliders drive GPU blendshapes and survive GLB export.
 */
export const HEAD_MORPHS = ["cranium", "width", "jaw", "chin", "cheeks", "brow"];
export function headShape(v, p) {
  // v: unit-sphere point (x,y,z); p: params. returns [x,y,z]
  let { x, y, z } = v;
  const lower = Math.max(0, -y), upper = Math.max(0, y);
  const front = Math.max(0, z);
  let sx = p.rx, sy = p.ry, sz = p.rz;
  sx *= 1 + (p.cranium || 0) * 0.0 + (p.width || 0) * 0.22;
  sy *= 1 + (p.cranium || 0) * 0.2;
  // jaw: widen / narrow the lower half
  x *= 1 + (p.jaw || 0) * 0.35 * lower * lower * (1 + front);
  // chin: pull the lowest front point down and forward
  const chin = (p.chin || 0);
  const lowFront = lower * lower * front;
  y -= chin * 0.22 * lowFront; z += chin * 0.15 * lowFront;
  // cheeks: puff out the mid-lower front sides
  const cheek = Math.max(0, 1 - Math.abs(y + 0.25) * 2.4) * Math.abs(x) * front;
  x += Math.sign(x) * (p.cheeks || 0) * 0.28 * cheek; z += (p.cheeks || 0) * 0.06 * cheek;
  // brow: ridge above the eyes
  const brow = Math.max(0, 1 - Math.abs(y - 0.28) * 4) * front * front;
  z += (p.brow || 0) * 0.14 * brow;
  // superellipsoid squareness
  if (p.square) { const e = p.square; x = Math.sign(x) * Math.pow(Math.abs(x), 1 - e); y = Math.sign(y) * Math.pow(Math.abs(y), 1 - e * 0.8); z = Math.sign(z) * Math.pow(Math.abs(z), 1 - e); }
  // taper to a point (pointy chins, egg heads)
  if (p.egg) { x *= 1 - p.egg * 0.28 * Math.max(0, -y); z *= 1 - p.egg * 0.12 * Math.max(0, -y); y -= p.egg * 0.04 * Math.max(0, -y); }
  return [x * sx, y * sy, z * sz];
}
export function makeHead(shape, w = 28, h = 20) {
  const g = new THREE.SphereGeometry(1, w, h);
  const pos = g.attributes.position, v = new THREE.Vector3();
  const base = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const q = headShape(v, shape); pos.setXYZ(i, q[0], q[1], q[2]); base.set(q, i * 3); }
  g.computeVertexNormals();
  g.morphTargetsRelative = true;
  const arrs = [];
  const raw = new THREE.SphereGeometry(1, w, h).attributes.position;
  for (const name of HEAD_MORPHS) {
    const a = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(raw, i); const q = headShape(v, { ...shape, [name]: 1 });
      a[i * 3] = q[0] - base[i * 3]; a[i * 3 + 1] = q[1] - base[i * 3 + 1]; a[i * 3 + 2] = q[2] - base[i * 3 + 2];
    }
    arrs.push(new THREE.BufferAttribute(a, 3));
  }
  g.morphAttributes.position = arrs;
  return g;
}

/** Soft vertical gradient (toon steps) texture. steps 0 = none. */
const gradCache = new Map();
export function gradient(steps) {
  if (!steps) return null;
  if (gradCache.has(steps)) return gradCache.get(steps);
  const d = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) { const v = Math.round(255 * (0.35 + 0.65 * (i / Math.max(1, steps - 1)))); d.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(d, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; gradCache.set(steps, t); return t;
}

/** Inverted-hull outline: a back-faced shell pushed out along the normal. Works on skinned meshes too. */
export function outlineMaterial(color = "#1d1d1b", width = 0.006) {
  const m = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: color, side: THREE.BackSide });
  m.name = "Outline";
  const u = { value: width }; m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uW = u;
    sh.vertexShader = "uniform float uW;\n" + sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * uW;");
  };
  m.userData.noExport = true;
  return m;
}

export function matcapTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(46, 40, 4, 64, 64, 64);
  r.addColorStop(0, "#ffffff"); r.addColorStop(0.45, "#c9c7c0"); r.addColorStop(1, "#4a4944");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export { TAU };
