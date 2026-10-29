// Procedural part catalogue (kind "procedural"). Each part adds meshes to named joints of the rig through `c`.
//   c.add(joint, geometry, region, slot, { pos, rot, scale, name, double })  -> Mesh
//   c.D  rig dimensions   c.J  joints   c.head  head dims { rx, ry, rz, cy }   c.v(id)  morph value   c.side(L|R)
// Parts for GLB-derived content (Kamikin ears and tails, GLB shape heads) are registered by glbparts.js into the same list.
import { THREE, limb, lathe, sphere, cone, tube, merge, at, makeHead } from "./geo.js";

export const PARTS = [];
const H = ["human", "mix"], C = ["creature", "mix"], ALL = ["human", "creature", "mix"], MIXONLY = ["mix"];
function P(slot, id, label, forStyles, build, o = {}) { PARTS.push({ slot, id, label, kind: "procedural", for: forStyles, build, ...o }); }
export const partsFor = (slot, style) => PARTS.filter((p) => p.slot === slot && p.for.includes(style));
export const partById = (slot, id) => PARTS.find((p) => p.slot === slot && p.id === id);
export const defaultPart = (slot, style) => partsFor(slot, style)[0]?.id ?? null;

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sides = ["L", "R"];
const sg = (s) => (s === "L" ? 1 : -1);

// ---------------------------------------------------------------- Body (proportions and plan)
const bodyDef = (plan, k) => ({ plan, w: 1, h: 1, head: 1, limb: 1, legK: 1, bl: 0.7, ...k });
P("body", "average", "Average", H, null, { params: bodyDef("upright", {}) });
P("body", "slim", "Slim", H, null, { params: bodyDef("upright", { w: 0.82, h: 1.02, limb: 0.9 }) });
P("body", "athletic", "Athletic", H, null, { params: bodyDef("upright", { w: 1.12, h: 1.03, head: 0.97, limb: 1.15 }) });
P("body", "heavy", "Heavy", H, null, { params: bodyDef("upright", { w: 1.38, h: 0.98, limb: 1.2 }) });
P("body", "child", "Child", H, null, { params: bodyDef("upright", { w: 0.9, h: 0.62, head: 1.35, limb: 0.9 }) });
P("body", "chibi", "Chibi", H, null, { params: bodyDef("upright", { w: 1.05, h: 0.5, head: 1.9, limb: 1.1, legK: 0.8 }) });
P("body", "c_biped", "Biped", C, null, { params: bodyDef("upright", { h: 0.8, w: 1.1, head: 1.15, legK: 0.85 }) });
P("body", "c_imp", "Imp (tiny biped)", C, null, { params: bodyDef("upright", { h: 0.5, w: 0.9, head: 1.5, legK: 0.8, limb: 0.9 }) });
P("body", "c_quad", "Quadruped", C, null, { params: bodyDef("quad", { h: 0.7, w: 1.1, head: 1.1, legK: 0.55, bl: 0.75 }) });
P("body", "c_hexa", "Six-legged", C, null, { params: bodyDef("hexa", { h: 0.55, w: 0.95, head: 0.95, legK: 0.5, bl: 1.0 }) });

// ---------------------------------------------------------------- Head
// shape: ellipsoid proportions + shape params; extras add muzzles, beaks, brows.
function headPart(id, label, fors, shape, extras, o = {}) {
  P("head", id, label, fors, (c) => {
    const R = c.D.headR, s = { rx: 1, ry: 1.05, rz: 1, ...shape };
    const hd = { rx: R * s.rx, ry: R * s.ry, rz: R * s.rz, cy: R * s.ry * 0.88 };
    c.head.rx = hd.rx; c.head.ry = hd.ry; c.head.rz = hd.rz; c.head.cy = hd.cy; c.head.snout = 0; c.head.hasEars = !!o.hasEars; c.head.noHair = !!o.noHair; c.head.fur = !!o.fur;
    const g = makeHead({ ...s, rx: hd.rx, ry: hd.ry, rz: hd.rz }, 28, 20);
    const m = c.add("head", g, o.fur ? "hair" : "skin", "head", { pos: [0, hd.cy, 0], name: "HeadMesh" });
    c.head.mesh = m; m.userData.isHead = true;
    extras?.(c, hd);
  }, { focus: "head", ...o });
}
headPart("round", "Round", H, { rx: 1, ry: 1.02, rz: 0.98 });
headPart("oval", "Oval", H, { rx: 0.9, ry: 1.16, rz: 0.95, egg: 0.5 });
headPart("square", "Square jaw", H, { rx: 1, ry: 0.98, rz: 0.95, square: 0.22, jaw: 0.3 });
headPart("pointy", "Pointed chin", H, { rx: 0.92, ry: 1.1, rz: 0.95, egg: 1, chin: 0.3 });
headPart("bigcranium", "Big cranium", H, { rx: 1.12, ry: 1.0, rz: 1.06, jaw: -0.3, cranium: 0.4 });
headPart("block", "Blocky", H, { rx: 1, ry: 0.98, rz: 0.98, square: 0.5 });
const snout = (c, hd, len, r0, r1, y, nose = true) => {
  const L = hd.rz * len * (1 + 0.6 * c.v("snoutLen"));
  y += hd.cy;
  c.add("head", tube([[0, y, hd.rz * 0.6], [0, y - 0.01, hd.rz * 0.6 + L * 0.5], [0, y - 0.02, hd.rz * 0.6 + L]], r0 * hd.rx, r1 * hd.rx, 10, 10), "hair", "head", { name: "Snout" });
  if (nose) c.add("head", sphere(r1 * hd.rx * 0.6), "eye", "head", { pos: [0, y + 0.0, hd.rz * 0.6 + L + 0.005], name: "Nose" });
  c.head.snout = L; c.head.snoutY = y - hd.cy;
};
headPart("c_cat", "Cat", C, { rx: 1.05, ry: 0.92, rz: 0.95 }, (c, hd) => snout(c, hd, 0.45, 0.42, 0.3, -hd.ry * 0.18), { fur: true, noHair: true });
headPart("c_wolf", "Wolf", C, { rx: 0.95, ry: 0.95, rz: 1.0 }, (c, hd) => snout(c, hd, 1.0, 0.45, 0.2, -hd.ry * 0.22), { fur: true, noHair: true });
headPart("c_reptile", "Reptile", C, { rx: 1.0, ry: 0.78, rz: 1.1, square: 0.1 }, (c, hd) => {
  snout(c, hd, 1.15, 0.5, 0.36, -hd.ry * 0.1);
  for (const s of [-1, 1]) c.add("head", sphere(hd.rx * 0.2, hd.rx * 0.2, hd.rx * 0.2), "skin", "head", { pos: [s * hd.rx * 0.42, hd.ry * 0.5, hd.rz * 0.55], name: "EyeRidge" });
}, { noHair: true });
headPart("c_bird", "Bird", C, { rx: 0.9, ry: 1.0, rz: 0.95 }, (c, hd) => {
  c.add("head", cone(hd.rx * 0.36, hd.rz * 0.9, 12), "accent", "head", { pos: [0, -hd.ry * 0.05, hd.rz + hd.rz * 0.35], rot: [Math.PI / 2, 0, 0], name: "Beak" });
  c.head.snout = hd.rz * 0.9;
}, { noHair: true });
headPart("c_dragon", "Dragon", C, { rx: 1.0, ry: 0.9, rz: 1.05, square: 0.12, brow: 0.7 }, (c, hd) => {
  snout(c, hd, 1.0, 0.55, 0.38, -hd.ry * 0.2);
  for (const s of [-1, 1]) c.add("head", cone(hd.rx * 0.1, hd.rx * 0.5, 6), "accent", "head", { pos: [s * hd.rx * 0.5, hd.ry * 0.62, hd.rz * 0.55], rot: [-1.2, 0, s * -0.3], name: "BrowSpike" });
}, { noHair: true });

// ---------------------------------------------------------------- Hair (head frame)
function capGeo(hd, k, theta) { const g = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, theta); g.rotateX(-0.42); g.scale(hd.rx * k, hd.ry * k, hd.rz * k); return g; }
function spikesOn(c, hd, n, len, r, region = "hair", y0 = 0.3) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, t = 0.3 + (i % 3) * 0.12;
    const d = V3(Math.cos(a) * Math.sin(t * 1.4), Math.cos(t * 1.4), Math.sin(a) * Math.sin(t * 1.4)).normalize();
    const m = c.add("head", cone(r, len, 6), region, "hair", { pos: [d.x * hd.rx, hd.cy + d.y * hd.ry, d.z * hd.rz], name: "Spike" });
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d); m.userData.crown = true;
  }
}
const hairCap = (c, hd, k, th) => { const m = c.add("head", capGeo(hd, k, th), "hair", "hair", { pos: [0, hd.cy + hd.ry * 0.02, -hd.rz * 0.03], name: "HairCap" }); m.userData.crown = true; return m; };
P("hair", "none", "Bald", H, () => {}, { noGeo: true });
P("hair", "buzz", "Buzz cut", H, (c) => hairCap(c, c.head, 1.025, 0.52 * Math.PI), { focus: "head" });
P("hair", "crop", "Short crop", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.06, 0.54 * Math.PI);
  const f = c.add("head", sphere(hd.rx * 0.8, hd.ry * 0.16, hd.rz * 0.35), "hair", "hair", { pos: [0, hd.cy + hd.ry * 0.62, hd.rz * 0.7], rot: [-0.35, 0, 0], name: "Fringe" }); f.userData.crown = true;
});
P("hair", "bob", "Bob", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.08, 0.58 * Math.PI);
  for (const s of [-1, 1]) c.add("head", limb(hd.ry * 1.05, hd.rx * 0.2, hd.rx * 0.24, 8), "hair", "hair", { pos: [s * hd.rx * 0.88, hd.cy + hd.ry * 0.3, -hd.rz * 0.1], name: "BobSide" });
  c.add("head", sphere(hd.rx * 0.95, hd.ry * 0.62, hd.rz * 0.5), "hair", "hair", { pos: [0, hd.cy - hd.ry * 0.25, -hd.rz * 0.6], name: "BobBack" });
});
P("hair", "long", "Long", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.08, 0.58 * Math.PI);
  c.add("head", limb(hd.ry * 2.6, hd.rx * 0.95, hd.rx * 0.55, 12), "hair", "hair", { pos: [0, hd.cy + hd.ry * 0.1, -hd.rz * 0.55], scale: [1, 1, 0.5], name: "LongBack" });
  for (const s of [-1, 1]) c.add("head", limb(hd.ry * 1.5, hd.rx * 0.18, hd.rx * 0.14, 8), "hair", "hair", { pos: [s * hd.rx * 0.9, hd.cy + hd.ry * 0.2, 0], name: "LongSide" });
});
P("hair", "ponytail", "Ponytail", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.06, 0.54 * Math.PI);
  c.add("head", tube([[0, hd.cy + hd.ry * 0.3, -hd.rz * 0.9], [0, hd.cy + hd.ry * 0.35, -hd.rz * 1.5], [0, hd.cy - hd.ry * 0.5, -hd.rz * 1.7], [0, hd.cy - hd.ry * 1.4, -hd.rz * 1.4]], hd.rx * 0.2, hd.rx * 0.07, 16, 8), "hair", "hair", { name: "Ponytail" });
});
P("hair", "bun", "Bun", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.06, 0.54 * Math.PI);
  const b = c.add("head", sphere(hd.rx * 0.38), "hair", "hair", { pos: [0, hd.cy + hd.ry * 1.1, -hd.rz * 0.1], name: "Bun" }); b.userData.crown = true;
});
P("hair", "afro", "Afro", H, (c) => {
  const hd = c.head; const m = c.add("head", sphere(hd.rx * 1.45, hd.ry * 1.3, hd.rz * 1.3, 20, 14), "hair", "hair", { pos: [0, hd.cy + hd.ry * 0.35, -hd.rz * 0.2], name: "Afro" }); m.userData.crown = true;
});
P("hair", "mohawk", "Mohawk", H, (c) => {
  const hd = c.head; hairCap(c, hd, 1.02, 0.46 * Math.PI);
  for (let i = 0; i < 7; i++) { const a = -0.9 + (i / 6) * 2.2; const m = c.add("head", cone(hd.rx * 0.2, hd.ry * 0.7, 6), "hair", "hair", { pos: [0, hd.cy + Math.cos(a) * hd.ry * 1.02, Math.sin(a) * hd.rz * 1.02], rot: [a, 0, 0], name: "MohawkSpike" }); m.userData.crown = true; }
});
P("hair", "spiky", "Spiky", H, (c) => { hairCap(c, c.head, 1.04, 0.52 * Math.PI); spikesOn(c, c.head, 10, c.head.ry * 0.6, c.head.rx * 0.18); });

// ---------------------------------------------------------------- Torso
function torsoPart(id, label, fors, k, o = {}) {
  P("torso", id, label, fors, (c) => {
    const D = c.D, T = D.torsoLen;
    const rh = D.hipW * 1.35 * k[0], rw = D.hipW * 1.25 * k[1] * D.waistK, rc = D.shW * 0.86 * k[2], rs = D.shW * 0.82 * k[3];
    const st = [[-0.04, rh * 0.75], [0.02, rh * 0.98], [0.2 * T, (rh + rw) / 2], [0.45 * T, rw], [0.72 * T, rc], [0.88 * T, rc * 1.02], [0.96 * T, rs * 0.92], [T * 1.0, D.neckR * 1.9], [T * 1.03, D.neckR * 1.25]];
    const depth = o.depth ?? 0.66;
    c.rig.torso = { stations: st, depth, square: !!o.square, T };
    const dep = c.plan === "upright" ? depth : 1;
    c.rig.torso.depth = dep;
    let g = lathe(st, dep, 16, !!o.square);
    if (c.plan !== "upright") g.rotateX(Math.PI / 2);
    c.add("spine", g, "skin", "torso", { name: "Torso" });
    if (o.belly) c.add("spine", sphere(rw * 0.75, T * 0.2, rw * 0.6), "cloth2", "torso", { pos: [0, T * 0.3, rw * 0.6], name: "Belly" });
    if (o.chest) c.add("spine", sphere(rc * 0.55, T * 0.16, rc * 0.6), "hair", "torso", { pos: [0, T * 0.62, rc * 0.5], name: "ChestFur" });
  }, { focus: "torso", ...o.part });
}
torsoPart("standard", "Standard", ALL, [1, 0.82, 1, 0.9]);
torsoPart("slim", "Slim", ALL, [0.85, 0.72, 0.82, 0.82], { depth: 0.55 });
torsoPart("athletic", "V taper", ALL, [0.9, 0.74, 1.22, 1.12], { depth: 0.7 });
torsoPart("round", "Round", ALL, [1.15, 1.15, 1.05, 0.82], { depth: 0.92 });
torsoPart("boxy", "Boxy", ALL, [1, 1, 1, 0.98], { square: true, depth: 0.8 });
torsoPart("bell", "Bell", ALL, [1.45, 1.05, 0.8, 0.8], { depth: 0.8 });
torsoPart("c_belly", "Creature belly", C, [1.1, 1, 1.0, 0.85], { depth: 0.9, belly: true });
torsoPart("c_furchest", "Furred chest", C, [0.95, 0.8, 1.15, 1], { depth: 0.78, chest: true });

// ---------------------------------------------------------------- Arms
function armPart(id, label, fors, k) {
  P("arms", id, label, fors, (c) => {
    const D = c.D;
    c.rig.armR = [D.rLimb * k[0], D.rLimb * k[1], D.rLimb * k[2]];
    for (const s of sides) {
      const up = D["upperArm" + s], fo = D["foreArm" + s];
      c.add("shoulder_" + s, limb(up, D.rLimb * k[0], D.rLimb * k[1], 10), "skin", "arms", { name: "UpperArm_" + s });
      c.add("elbow_" + s, limb(fo, D.rLimb * k[1], D.rLimb * k[2], 10), "skin", "arms", { name: "ForeArm_" + s });
      c.add("shoulder_" + s, sphere(D.rLimb * k[0] * 1.08), "skin", "arms", { name: "Shoulder_" + s });
    }
  }, { focus: "torso" });
}
armPart("standard", "Standard", ALL, [1, 0.85, 0.72]);
armPart("slim", "Slim", ALL, [0.7, 0.6, 0.5]);
armPart("muscle", "Muscular", ALL, [1.4, 1.05, 0.9]);
armPart("noodle", "Noodle", ALL, [0.42, 0.42, 0.42]);
armPart("puffy", "Puffy", ALL, [1.45, 0.9, 0.62]);

// ---------------------------------------------------------------- Hands
function handPart(id, label, fors, build, o = {}) {
  P("hands", id, label, fors, (c) => {
    const r = c.D.handR;
    for (const s of sides) {
      const holder = new THREE.Group(); holder.name = "Hand_" + s;
      // build facing down (-y); thumb toward the body
      const tmp = { add: (geo, region, opts = {}) => { const m = new THREE.Mesh(geo); m.userData.region = region; m.userData.slot = "hands"; if (opts.pos) m.position.set(...opts.pos); if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale); holder.add(m); return m; } };
      build(tmp, r, -sg(s));
      c.attachGroup("wrist_" + s, holder, "hands");
    }
  }, { focus: "hand", ...o });
}
handPart("mitten", "Mitten", ALL, (h, r, ts) => { h.add(sphere(r, r * 1.3, r * 0.6), "skin", { pos: [0, -r * 1.1, 0] }); h.add(sphere(r * 0.4, r * 0.6, r * 0.4), "skin", { pos: [ts * r * 0.95, -r * 0.8, r * 0.1], rot: [0, 0, ts * 0.5] }); });
handPart("blocky", "Fingers", ALL, (h, r, ts) => {
  h.add(sphere(r * 0.95, r * 0.75, r * 0.45), "skin", { pos: [0, -r * 0.75, 0] });
  for (let i = 0; i < 4; i++) h.add(limb(r * (1.0 + (i === 1 || i === 2 ? 0.2 : 0)), r * 0.2, r * 0.17, 6), "skin", { pos: [(i - 1.5) * r * 0.5, -r * 1.2, 0] });
  h.add(limb(r * 0.8, r * 0.22, r * 0.18, 6), "skin", { pos: [ts * r * 1.0, -r * 0.8, 0], rot: [0, 0, ts * 0.8] });
});
handPart("fist", "Fist", ALL, (h, r) => { h.add(sphere(r * 1.05, r * 0.95, r * 0.85), "skin", { pos: [0, -r * 0.9, 0] }); });
handPart("claw", "Claws", C, (h, r, ts) => {
  h.add(sphere(r * 0.95, r * 0.85, r * 0.6), "skin", { pos: [0, -r * 0.8, 0] });
  for (let i = -1; i <= 1; i++) h.add(cone(r * 0.2, r * 1.2, 6), "accent", { pos: [i * r * 0.5, -r * 1.7, r * 0.1], rot: [0.2, 0, 0], scale: [1, -1, 1] });
  h.add(cone(r * 0.18, r * 0.9, 6), "accent", { pos: [ts * r, -r * 1.2, 0], rot: [0, 0, ts * 0.6], scale: [1, -1, 1] });
});
handPart("paw", "Paw", C, (h, r) => {
  h.add(sphere(r * 1.0, r * 0.8, r * 0.8), "hair", { pos: [0, -r * 0.8, 0] });
  for (let i = -1; i <= 1; i++) h.add(sphere(r * 0.28), "eye", { pos: [i * r * 0.5, -r * 1.35, r * 0.55] });
  h.add(sphere(r * 0.42, r * 0.3, r * 0.3), "eye", { pos: [0, -r * 0.9, r * 0.7] });
});

// ---------------------------------------------------------------- Legs and feet
function legPart(id, label, fors, k, o = {}) {
  P("legs", id, label, fors, (c) => {
    const D = c.D;
    c.rig.legR = [D.rLeg * k[0], D.rLeg * k[1], D.rLeg * k[2]];
    for (const name of c.legNames) {
      const s = c.legSide(name), th = D["thigh" + s] * (o.len ?? 1), sh = D["shin" + s] * (o.len ?? 1);
      c.add("hip_" + name, limb(th, D.rLeg * k[0], D.rLeg * k[1], 10), o.fur ? "hair" : "skin", "legs", { name: "Thigh_" + name });
      c.add("knee_" + name, limb(sh, D.rLeg * k[1], D.rLeg * k[2], 10), o.fur ? "hair" : "skin", "legs", { name: "Shin_" + name });
      c.add("hip_" + name, sphere(D.rLeg * k[0] * 1.08), o.fur ? "hair" : "skin", "legs", { name: "Hip_" + name });
    }
  }, { focus: "legs" });
}
legPart("standard", "Standard", ALL, [1, 0.8, 0.65]);
legPart("slim", "Slim", ALL, [0.72, 0.58, 0.48]);
legPart("muscle", "Muscular", ALL, [1.4, 1.0, 0.8]);
legPart("noodle", "Noodle", ALL, [0.42, 0.42, 0.42]);
legPart("stubby", "Stubby", ALL, [1.25, 1.1, 1.0], { len: 1 });
legPart("c_fur", "Furred", C, [1.15, 0.9, 0.75], { fur: true });

function footPart(id, label, fors, build, o = {}) {
  P("feet", id, label, fors, (c) => {
    const r = c.D.footR;
    for (const name of c.legNames) {
      const holder = new THREE.Group(); holder.name = "Foot_" + name;
      const tmp = { add: (geo, region, opts = {}) => { const m = new THREE.Mesh(geo); m.userData.region = region; m.userData.slot = "feet"; if (opts.pos) m.position.set(...opts.pos); if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale); holder.add(m); return m; } };
      build(tmp, r, c);
      c.attachGroup("ankle_" + name, holder, "feet");
    }
  }, { focus: "feet", ...o });
}
footPart("shoe", "Round shoe", ALL, (f, r) => { f.add(sphere(r * 0.9, r * 0.6, r * 1.55), "accent", { pos: [0, -r * 0.35, r * 0.55] }); });
footPart("sneaker", "Sneaker", ALL, (f, r) => { f.add(sphere(r * 0.85, r * 0.55, r * 1.5), "cloth2", { pos: [0, -r * 0.2, r * 0.55] }); f.add(sphere(r * 0.9, r * 0.2, r * 1.6), "accent", { pos: [0, -r * 0.62, r * 0.55] }); });
footPart("boot", "Boot", ALL, (f, r) => { f.add(sphere(r * 0.95, r * 0.65, r * 1.55), "accent", { pos: [0, -r * 0.3, r * 0.5] }); f.add(limb(r * 1.4, r * 0.85, r * 0.9, 10), "accent", { pos: [0, r * 0.9, 0] }); });
footPart("bare", "Barefoot", ALL, (f, r) => { f.add(sphere(r * 0.75, r * 0.45, r * 1.35), "skin", { pos: [0, -r * 0.3, r * 0.45] }); for (let i = -2; i <= 2; i++) f.add(sphere(r * 0.16), "skin", { pos: [i * r * 0.28, -r * 0.4, r * 1.7 - Math.abs(i) * r * 0.06] }); });
footPart("paw", "Paw", C, (f, r) => { f.add(sphere(r * 0.9, r * 0.5, r * 1.2), "hair", { pos: [0, -r * 0.3, r * 0.4] }); for (let i = -1; i <= 1; i++) f.add(sphere(r * 0.2), "eye", { pos: [i * r * 0.42, -r * 0.5, r * 1.45] }); });
footPart("hoof", "Hoof", C, (f, r) => { f.add(limb(r * 0.5, r * 0.55, r * 0.7, 8), "accent", { pos: [0, -r * 0.1, r * 0.2], scale: [1, 1, 1.3] }); });
footPart("talon", "Talons", C, (f, r) => { for (let i = -1; i <= 1; i++) f.add(cone(r * 0.2, r * 1.5, 6), "accent", { pos: [i * r * 0.55, -r * 0.35, r * 0.75], rot: [Math.PI / 2 + 0.2, 0, 0] }); f.add(sphere(r * 0.5, r * 0.3, r * 0.6), "skin", { pos: [0, -r * 0.2, r * 0.1] }); });

// ---------------------------------------------------------------- Ears (head sides)
P("ears", "none", "No ears", C, () => {}, {});
function earPart(id, label, fors, build, o = {}) {
  P("ears", id, label, fors, (c) => {
    const hd = c.head;
    for (const s of sides) {
      const holder = new THREE.Group(); holder.name = "Ear_" + s;
      const k = 1 + 0.6 * c.v("ear" + s);
      holder.scale.setScalar(k);
      const x = sg(s), tmp = { add: (geo, region, opts = {}) => { const m = new THREE.Mesh(geo); m.userData.region = region; m.userData.slot = "ears"; if (opts.pos) m.position.set(...opts.pos); if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale); holder.add(m); return m; } };
      build(tmp, hd, x);
      holder.position.set(x * hd.rx * (o.dx ?? 0.92), hd.cy + hd.ry * (o.dy ?? 0.1), (o.dz ?? 0) * hd.rz);
      c.attachGroup("head", holder, "ears");
    }
  }, { focus: "head", ...o });
}
earPart("human", "Human", H, (e, h, x) => { e.add(sphere(h.rx * 0.14, h.ry * 0.28, h.rz * 0.12), "skin", { pos: [x * h.rx * 0.04, 0, 0] }); }, { dy: 0.0 });
earPart("elf", "Pointed", ALL, (e, h, x) => { e.add(cone(h.rx * 0.2, h.rx * 0.8, 4), "skin", { rot: [0, 0, -x * 1.2], pos: [x * h.rx * 0.2, h.ry * 0.12, 0], scale: [0.5, 1, 1] }); }, { dy: 0.05 });
earPart("round", "Round", ALL, (e, h, x) => { e.add(sphere(h.rx * 0.32, h.rx * 0.32, h.rx * 0.12), "hair", { pos: [x * h.rx * 0.15, h.ry * 0.2, 0], rot: [0, x * 0.6, 0] }); e.add(sphere(h.rx * 0.2, h.rx * 0.2, h.rx * 0.08), "skin", { pos: [x * h.rx * 0.18, h.ry * 0.2, h.rz * 0.08], rot: [0, x * 0.6, 0] }); }, { dy: 0.62, dx: 0.7 });
earPart("cat", "Cat", C, (e, h, x) => { e.add(cone(h.rx * 0.32, h.rx * 0.6, 4), "hair", { pos: [0, h.ry * 0.3, 0], rot: [0, Math.PI / 4, -x * 0.3], scale: [1, 1, 0.45] }); }, { dy: 0.78, dx: 0.62 });
earPart("bunny", "Long bunny", C, (e, h, x) => { e.add(limb(h.ry * 1.6, h.rx * 0.18, h.rx * 0.12, 8), "hair", { pos: [0, h.ry * 1.5, 0], rot: [0, 0, -x * 0.2], scale: [1, -1, 0.5] }); }, { dy: 0.7, dx: 0.45 });
earPart("floppy", "Floppy", C, (e, h, x) => { e.add(limb(h.ry * 0.9, h.rx * 0.2, h.rx * 0.28, 8), "hair", { pos: [x * h.rx * 0.1, h.ry * 0.1, 0], rot: [0, 0, x * 0.3], scale: [0.6, 1, 1] }); }, { dy: 0.5, dx: 0.8 });
earPart("bat", "Bat", C, (e, h, x) => { e.add(cone(h.rx * 0.45, h.rx * 1.1, 3), "skin", { pos: [x * h.rx * 0.1, h.ry * 0.5, 0], rot: [0, 0, -x * 0.25], scale: [1, 1, 0.12] }); }, { dy: 0.65, dx: 0.6 });
earPart("fin", "Fin", C, (e, h, x) => { e.add(cone(h.rx * 0.5, h.rx * 0.9, 3), "accent", { pos: [x * h.rx * 0.5, 0, 0], rot: [0, 0, -x * Math.PI / 2], scale: [1, 1, 0.1] }); }, { dy: 0.1, dx: 0.88 });

// ---------------------------------------------------------------- Tail (nested joints so it can sway)
P("tail", "none", "No tail", ["creature", "mix"], () => {}, {});
function tailPart(id, label, fors, o) {
  P("tail", id, label, fors, (c) => {
    const D = c.D, n = o.n, len = o.len * D.S * (1 + 0.8 * c.v("tailLen")), seg = len / n;
    let parent = c.J.tailBase;
    for (let i = 0; i < n; i++) {
      const j = c.joint("tail" + i, parent, i === 0 ? [0, 0, 0] : [0, 0, -seg]);
      const t = i / n, r0 = o.r0 + (o.r1 - o.r0) * t, r1 = o.r0 + (o.r1 - o.r0) * (t + 1 / n);
      c.add(j, limb(seg, r0 * D.S, r1 * D.S, 8).rotateX(Math.PI / 2), o.region || "hair", "tail", { name: "Tail" + i });
      if (o.puff && i === n - 1) c.add(j, sphere(o.puff * D.S), o.puffRegion || "cloth2", "tail", { pos: [0, 0, -seg], name: "TailTip" });
      parent = j;
    }
    c.J.tailTip = parent;
  }, { focus: "tail" });
}
tailPart("stub", "Stub", ALL, { n: 1, len: 0.1, r0: 0.05, r1: 0.04, puff: 0.06, region: "skin", puffRegion: "hair" });
tailPart("cat", "Long thin", C, { n: 5, len: 0.7, r0: 0.03, r1: 0.018, region: "hair" });
tailPart("fluffy", "Fluffy", C, { n: 4, len: 0.55, r0: 0.11, r1: 0.14, region: "hair", puff: 0.14, puffRegion: "hair" });
tailPart("lizard", "Lizard", C, { n: 6, len: 0.95, r0: 0.08, r1: 0.012, region: "skin" });
tailPart("devil", "Spade", C, { n: 5, len: 0.65, r0: 0.025, r1: 0.02, region: "skin", puff: 0.07, puffRegion: "accent" });
tailPart("pony", "Puff (bunny)", ALL, { n: 1, len: 0.06, r0: 0.07, r1: 0.1, region: "hair", puff: 0.1, puffRegion: "cloth2" });

// ---------------------------------------------------------------- Wings (hinge on the back)
P("wings", "none", "No wings", ["creature", "mix"], () => {}, {});
function wingPart(id, label, fors, build) {
  P("wings", id, label, fors, (c) => {
    const span = c.D.S * 0.9 * (1 + 0.6 * c.v("wingSpan"));
    for (const s of sides) {
      const j = c.J["wing_" + s];
      const holder = new THREE.Group(); holder.name = "WingMesh_" + s;
      const tmp = { add: (geo, region, opts = {}) => { const m = new THREE.Mesh(geo); m.userData.region = region; m.userData.slot = "wings"; m.userData.double = true; if (opts.pos) m.position.set(...opts.pos); if (opts.rot) m.rotation.set(...opts.rot); if (opts.scale) m.scale.set(...opts.scale); holder.add(m); return m; } };
      build(tmp, span, sg(s));
      c.attachGroup(j, holder, "wings");
    }
  }, { focus: "torso" });
}
const wingShape = (pts) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return new THREE.ShapeGeometry(sh, 6); };
wingPart("bat", "Bat", C, (w, span, x) => {
  const s = span;
  w.add(wingShape([[0, 0], [0.55 * s, 0.35 * s], [0.95 * s, 0.1 * s], [0.78 * s, -0.12 * s], [0.62 * s, -0.04 * s], [0.5 * s, -0.3 * s], [0.34 * s, -0.12 * s], [0.18 * s, -0.4 * s]]), "accent", { scale: [x, 1, 1] });
  w.add(limb(0.62 * s, 0.012 * s, 0.01 * s, 6), "skin", { pos: [0, 0, 0.003], rot: [0, 0, x * -1.1] });
});
wingPart("feather", "Feathered", ALL.filter((x) => x !== "human"), (w, span, x) => {
  for (let i = 0; i < 7; i++) { const l = span * (0.55 + 0.07 * (6 - i) / 2); w.add(sphere(l * 0.5, l * 0.1, l * 0.04, 8, 6), "cloth2", { pos: [x * l * 0.46, 0.04 * span - i * 0.045 * span, -i * 0.002], rot: [0, 0, x * (0.15 + i * 0.12) * -1] }); }
});
wingPart("fairy", "Fairy", ALL.filter((x) => x !== "human"), (w, span, x) => {
  w.add(sphere(span * 0.35, span * 0.16, span * 0.01, 12, 8), "accent", { pos: [x * span * 0.35, span * 0.18, 0], rot: [0, 0, x * -0.5] });
  w.add(sphere(span * 0.26, span * 0.12, span * 0.01, 12, 8), "accent", { pos: [x * span * 0.26, -span * 0.08, 0], rot: [0, 0, x * 0.5] });
});
wingPart("dragonfly", "Dragonfly", C, (w, span, x) => {
  for (const [dy, k] of [[0.08, 1], [-0.05, 0.8]]) w.add(sphere(span * 0.5 * k, span * 0.07, span * 0.008, 12, 6), "accent", { pos: [x * span * 0.5 * k, dy * span, 0], rot: [0, 0, x * -0.1] });
});

// ---------------------------------------------------------------- Horns and spines
function hornPart(id, label, fors, build) {
  P("horns", id, label, fors, (c) => {
    const hd = c.head, k = (hd.rx) * (1 + 0.7 * c.v("hornSize"));
    c.head.hornTop = k;
    build({ add: (geo, region, opts = {}) => { const m = c.add("head", geo, region, "horns", opts); return m; } }, hd, k);
  }, { focus: "head" });
}
hornPart("small", "Small horns", C, (h, hd, k) => { for (const s of [-1, 1]) h.add(cone(k * 0.12, k * 0.5, 8), "accent", { pos: [s * hd.rx * 0.5, hd.cy + hd.ry * 0.85, hd.rz * 0.1], rot: [0, 0, -s * 0.35], name: "Horn" }); });
hornPart("curved", "Curved", C, (h, hd, k) => { for (const s of [-1, 1]) h.add(tube([[s * hd.rx * 0.5, hd.cy + hd.ry * 0.8, 0], [s * hd.rx * 1.0, hd.cy + hd.ry * 1.2, 0], [s * hd.rx * 1.05, hd.cy + hd.ry * 1.8, 0.02], [s * hd.rx * 0.7, hd.cy + hd.ry * 2.1, 0.06]], k * 0.14, k * 0.015, 14, 8), "accent", { name: "Horn" }); });
hornPart("ram", "Ram", C, (h, hd, k) => { for (const s of [-1, 1]) h.add(tube(Array.from({ length: 12 }, (_, i) => { const a = i * 0.55; const r = hd.rx * (0.3 + 0.07 * i); return [s * (hd.rx * 0.55 + Math.sin(a) * r * 0.9), hd.cy + hd.ry * 0.4 + Math.cos(a) * r * 0.8 - r * 0.2, -hd.rz * 0.1 + i * 0.002]; }), k * 0.13, k * 0.03, 40, 8), "accent", { name: "Horn" }); });
hornPart("unicorn", "Unicorn", C, (h, hd, k) => { h.add(cone(k * 0.13, k * 1.1, 10), "accent", { pos: [0, hd.cy + hd.ry * 1.05, hd.rz * 0.5], rot: [0.25, 0, 0], name: "Horn" }); });
hornPart("antlers", "Antlers", C, (h, hd, k) => { for (const s of [-1, 1]) { h.add(tube([[s * hd.rx * 0.4, hd.cy + hd.ry * 0.8, 0], [s * hd.rx * 0.6, hd.cy + hd.ry * 1.4, 0], [s * hd.rx * 0.5, hd.cy + hd.ry * 2.0, 0]], k * 0.06, k * 0.03, 10, 6), "accent", { name: "Antler" }); h.add(tube([[s * hd.rx * 0.55, hd.cy + hd.ry * 1.3, 0], [s * hd.rx * 1.0, hd.cy + hd.ry * 1.6, 0], [s * hd.rx * 1.2, hd.cy + hd.ry * 2.0, 0]], k * 0.045, k * 0.02, 10, 6), "accent", { name: "AntlerTine" }); } });
hornPart("none", "No horns", C, () => {});
function spinePart(id, label, build) {
  P("spines", id, label, C, (c) => build(c), { focus: "all" });
}
spinePart("none", "None", () => {});
spinePart("dorsal", "Dorsal spikes", (c) => { const D = c.D; const n = 6; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const up = c.plan === "upright"; const k = (1 - 0.5 * Math.abs(t - 0.5)) * D.S * 0.07; const m = c.add("spine", cone(k * 0.6, k * 1.8, 6), "accent", "spines", { pos: up ? [0, D.torsoLen * (0.1 + 0.85 * t), -D.torsoLen * 0.2] : [0, D.rBody * 0.9, D.bl * (0.05 + 0.9 * t)], rot: up ? [-1.2, 0, 0] : [0, 0, 0], name: "Spike" + i }); } });
spinePart("crest", "Head crest", (c) => { const hd = c.head; for (let i = 0; i < 4; i++) c.add("head", cone(hd.rx * 0.12, hd.ry * (0.9 - i * 0.12), 4), "accent", "spines", { pos: [0, hd.cy + hd.ry * 0.9, hd.rz * (0.5 - i * 0.4)], rot: [-0.3 - i * 0.2, 0, 0], scale: [0.4, 1, 1], name: "Crest" + i }); });
spinePart("fin", "Back fin", (c) => { const D = c.D; const up = c.plan === "upright"; c.add("spine", sphere(D.S * 0.02, D.S * 0.2, D.S * 0.14), "accent", "spines", { pos: up ? [0, D.torsoLen * 0.65, -D.torsoLen * 0.3] : [0, D.rBody * 1.3, D.bl * 0.5], rot: [up ? -0.3 : 0, 0, 0], name: "BackFin" }); });

// ---------------------------------------------------------------- Outfits (shells over the body)
function shell(c, stFrom, grow) { const t = c.rig.torso; return lathe(stFrom.map(([y, r]) => [y, r * grow]), t.depth, 16, t.square); }
function outfit(id, label, build) { P("clothing", id, label, H.concat(["creature"]), (c) => { if (c.plan !== "upright") return; build(c, c.D); }, { focus: "all", needs: "upright" }); }
P("clothing", "none", "None", ALL, () => {}, {});
outfit("tee", "Tee and shorts", (c, D) => {
  const t = c.rig.torso, st = t.stations.filter(([y]) => y >= 0.08 * t.T);
  c.add("spine", shell(c, st.map(([y, r]) => [y, r]), 1.07), "cloth", "clothing", { name: "Tee" });
  for (const s of sides) { c.add("shoulder_" + s, limb(D["upperArm" + s] * 0.42, c.rig.armR[0] * 1.2, c.rig.armR[0] * 1.15, 10), "cloth", "clothing", { name: "Sleeve_" + s }); }
  for (const n of c.legNames) c.add("hip_" + n, limb(D["thigh" + c.legSide(n)] * 0.55, c.rig.legR[0] * 1.15, c.rig.legR[1] * 1.2, 10), "cloth2", "clothing", { name: "Short_" + n });
  c.add("hips", lathe([[-0.02, D.hipW * 1.25], [D.torsoLen * 0.1, D.hipW * 1.45]], 0.7, 14), "cloth2", "clothing", { name: "ShortsTop" });
});
outfit("hoodie", "Hoodie and jeans", (c, D) => {
  const t = c.rig.torso, st = t.stations.filter(([y]) => y >= 0.0);
  c.add("spine", shell(c, st, 1.1), "cloth", "clothing", { name: "Hoodie" });
  for (const s of sides) { c.add("shoulder_" + s, limb(D["upperArm" + s], c.rig.armR[0] * 1.25, c.rig.armR[1] * 1.25, 10), "cloth", "clothing", { name: "SleeveU_" + s }); c.add("elbow_" + s, limb(D["foreArm" + s] * 0.95, c.rig.armR[1] * 1.25, c.rig.armR[2] * 1.4, 10), "cloth", "clothing", { name: "SleeveF_" + s }); }
  c.add("spine", sphere(D.shW * 0.5, D.shW * 0.4, D.shW * 0.4), "cloth", "clothing", { pos: [0, t.T * 1.0, -D.shW * 0.35], name: "Hood" });
  for (const n of c.legNames) { const s = c.legSide(n); c.add("hip_" + n, limb(D["thigh" + s], c.rig.legR[0] * 1.14, c.rig.legR[1] * 1.14, 10), "cloth2", "clothing", { name: "JeanU_" + n }); c.add("knee_" + n, limb(D["shin" + s], c.rig.legR[1] * 1.14, c.rig.legR[2] * 1.3, 10), "cloth2", "clothing", { name: "JeanL_" + n }); }
});
outfit("dress", "Dress", (c, D) => {
  const t = c.rig.torso, T = t.T;
  c.add("spine", lathe([[0.42 * T, D.hipW * 1.1], [0.6 * T, D.shW * 0.98], [0.9 * T, D.shW * 0.82]].map(([y, r]) => [y, r * 1.0]), t.depth, 16), "cloth", "clothing", { name: "Bodice" });
  c.add("hips", lathe([[-D.thigh * 0.95, D.hipW * 3.3], [-D.thigh * 0.5, D.hipW * 2.6], [0, D.hipW * 2.1], [T * 0.2, D.hipW * 1.7], [T * 0.45, D.hipW * 1.25]], t.depth + 0.15, 20), "cloth", "clothing", { name: "Skirt" });
  c.add("hips", lathe([[-D.thigh * 0.97, D.hipW * 3.22], [-D.thigh * 0.9, D.hipW * 3.1]], t.depth + 0.15, 20), "cloth2", "clothing", { name: "Hem" });
});
outfit("robe", "Robe", (c, D) => {
  const t = c.rig.torso, T = t.T;
  c.add("hips", lathe([[-D.legLen * 0.92, D.hipW * 3.6], [-D.legLen * 0.4, D.hipW * 2.2], [0, D.hipW * 1.4], [T * 0.45, D.shW * 0.82], [T * 0.9, D.shW * 0.95], [T * 1.0, D.neckR * 2.2]], t.depth + 0.1, 20), "cloth", "clothing", { name: "Robe" });
  c.add("hips", lathe([[T * 0.3, D.hipW * 1.5], [T * 0.38, D.hipW * 1.55]], t.depth + 0.1, 20), "cloth2", "clothing", { name: "Sash" });
  for (const s of sides) c.add("shoulder_" + s, cone(c.rig.armR[0] * 3.2, D["upperArm" + s] * 2.1, 10).translate(0, -D["upperArm" + s] * 0.85, 0), "cloth", "clothing", { name: "Sleeve_" + s, scale: [1, 1, 1] });
});
outfit("armor", "Armour", (c, D) => {
  const t = c.rig.torso, T = t.T;
  c.add("spine", lathe(t.stations.filter(([y]) => y >= 0.25 * T).map(([y, r]) => [y, r * 1.1]), t.depth * 1.05, 14), "accent", "clothing", { name: "Breastplate" });
  for (const s of sides) { c.add("shoulder_" + s, sphere(c.rig.armR[0] * 1.5, c.rig.armR[0] * 1.0, c.rig.armR[0] * 1.5), "accent", "clothing", { pos: [sg(s) * c.rig.armR[0] * 0.3, c.rig.armR[0] * 0.5, 0], name: "Pauldron_" + s }); c.add("elbow_" + s, limb(D["foreArm" + s] * 0.6, c.rig.armR[1] * 1.3, c.rig.armR[2] * 1.4, 10), "accent", "clothing", { name: "Vambrace_" + s }); }
  c.add("hips", lathe([[-0.02, D.hipW * 1.4], [T * 0.2, D.hipW * 1.5]], 0.75, 14), "cloth2", "clothing", { name: "Belt" });
});
outfit("overalls", "Overalls", (c, D) => {
  const t = c.rig.torso, T = t.T;
  c.add("spine", lathe([[0.0, D.hipW * 1.4], [0.45 * T, D.hipW * 1.3], [0.7 * T, D.shW * 0.9], [0.86 * T, D.shW * 0.9]], t.depth + 0.05, 16), "cloth", "clothing", { name: "Bib" });
  for (const s of [-1, 1]) c.add("spine", limb(0.3 * T, D.shW * 0.07, D.shW * 0.07, 6), "cloth", "clothing", { pos: [s * D.shW * 0.42, 0.92 * T, 0], name: "Strap" });
  for (const n of c.legNames) { const s = c.legSide(n); c.add("hip_" + n, limb(D["thigh" + s], c.rig.legR[0] * 1.14, c.rig.legR[1] * 1.14, 10), "cloth", "clothing", { name: "OvU_" + n }); c.add("knee_" + n, limb(D["shin" + s] * 0.55, c.rig.legR[1] * 1.14, c.rig.legR[2] * 1.2, 10), "cloth", "clothing", { name: "OvL_" + n }); }
});

// ---------------------------------------------------------------- Procedural accessories for the non-head sockets
export function buildProcAccessory(id, rig) {
  const g = new THREE.Group(); g.name = id; const D = rig.D;
  const mk = (geo, color, pos = [0, 0, 0], rot = [0, 0, 0]) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); m.position.set(...pos); m.rotation.set(...rot); m.userData.acc = true; g.add(m); return m; };
  const T = D.torsoLen, up = rig.plan === "upright";
  if (id === "p_backpack") { mk(sphere(D.shW * 0.7, T * 0.3, D.shW * 0.42), "#c4533c", [0, 0, 0]); mk(sphere(D.shW * 0.5, T * 0.1, D.shW * 0.2), "#8a3a2a", [0, -T * 0.12, -D.shW * 0.28]); }
  if (id === "p_cape") { const m = mk(limb(T * 1.45, D.shW * 0.85, D.shW * 1.1, 12), "#b53c3c", [0, T * 0.05, 0]); m.scale.set(1, 1, 0.12); }
  if (id === "p_jetpack") { for (const s of [-1, 1]) { mk(limb(T * 0.55, D.shW * 0.2, D.shW * 0.2, 10), "#9a988f", [s * D.shW * 0.3, T * 0.3, 0]); mk(cone(D.shW * 0.17, T * 0.22, 8), "#f2b84b", [s * D.shW * 0.3, -T * 0.34, 0], [Math.PI, 0, 0]); } }
  if (id === "p_belt") { mk(lathe([[0, D.hipW * 1.38], [0.07 * T, D.hipW * 1.38]], 0.7, 16), "#5a3e2a"); mk(sphere(D.hipW * 0.25, D.hipW * 0.2, D.hipW * 0.1), "#f2b84b", [0, 0.035 * T, D.hipW * 0.98]); }
  if (id === "p_sash") { mk(lathe([[0, D.hipW * 1.4], [0.09 * T, D.hipW * 1.4]], 0.7, 16), "#4aa8ff"); mk(limb(T * 0.35, D.hipW * 0.14, D.hipW * 0.1, 6), "#4aa8ff", [D.hipW * 1.1, 0.05 * T, D.hipW * 0.5]); }
  if (id === "p_anklets") { mk(lathe([[0, D.footR * 0.75], [0.35 * D.footR, D.footR * 0.75]], 1, 12), "#f2b84b"); }
  if (id === "p_tailbow") { mk(sphere(D.S * 0.04, D.S * 0.025, D.S * 0.025), "#ff7eb6", [D.S * 0.04, 0, 0]); mk(sphere(D.S * 0.04, D.S * 0.025, D.S * 0.025), "#ff7eb6", [-D.S * 0.04, 0, 0]); mk(sphere(D.S * 0.022), "#ff5a7a"); }
  if (id === "p_tailbell") { mk(sphere(D.S * 0.04), "#f2b84b"); mk(sphere(D.S * 0.008), "#2f3340", [0, -D.S * 0.015, D.S * 0.04]); }
  return g;
}
