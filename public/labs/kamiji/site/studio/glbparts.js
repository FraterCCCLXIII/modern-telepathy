// Parts taken from the repository's real GLBs, registered into the same catalogue as the procedural ones.
//   kind "glb"      a static GLB used as is (shape heads from assets/props/shapes/)
//   kind "derived"  geometry cut out of a skinned GLB at runtime, by dominant bone weight (Kamikin ears and tails,
//                   Rubbernose gloves and shoes). The cut is rigid (bind pose, no skinning), so these parts do not bend.
import { THREE } from "./geo.js";
import { PARTS } from "./parts.js";
import { A } from "./data.js";

let loaderP = null;
export function getLoader() {
  return (loaderP ||= Promise.all([import("three/addons/loaders/GLTFLoader.js"), import("three/addons/utils/SkeletonUtils.js")]).then(([g, s]) => ({ loader: new g.GLTFLoader(), SU: s })));
}
const cache = new Map();
export function loadGltf(url) {
  if (!cache.has(url)) cache.set(url, getLoader().then(({ loader }) => loader.loadAsync(url)));
  return cache.get(url);
}
export async function cloneScene(gltf) { const { SU } = await getLoader(); return SU.clone(gltf.scene); }

// ---- geometry extraction ---------------------------------------------------------------------------------------
const extracted = new Map();
export async function extract(url, matName, pred, key) {
  const k = url + "|" + matName + "|" + key;
  if (extracted.has(k)) return extracted.get(k);
  const p = (async () => {
    const gltf = await loadGltf(url);
    gltf.scene.updateMatrixWorld(true);
    let mesh = null; gltf.scene.traverse((o) => { if (o.isSkinnedMesh && o.material.name === matName && !mesh) mesh = o; });
    if (!mesh) return null;
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
    const names = mesh.skeleton.bones.map((b) => b.name), n = pos.count, sel = new Uint8Array(n), body = new THREE.Box3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
      sel[i] = pred(names[best]) ? 1 : 0;
      if (!sel[i] && !/ear|tail|tuft|arm|leg/i.test(names[best])) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); body.expandByPoint(v); }
    }
    const map = new Int32Array(n).fill(-1), P = [], N = [], U = [], I = [];
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), t = new THREE.Vector3();
    const take = (i) => { if (map[i] < 0) { map[i] = P.length / 3; v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); P.push(v.x, v.y, v.z); if (nor) { t.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); N.push(t.x, t.y, t.z); } if (uv) U.push(uv.getX(i), uv.getY(i)); } return map[i]; };
    const tri = idx ? idx.count / 3 : n / 3;
    for (let f = 0; f < tri; f++) {
      const a = idx ? idx.getX(f * 3) : f * 3, b = idx ? idx.getX(f * 3 + 1) : f * 3 + 1, c = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
      if (sel[a] && sel[b] && sel[c]) I.push(take(a), take(b), take(c));
    }
    if (!I.length) return { geometry: null, body, mesh, gltf };
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); if (N.length) out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); if (U.length) out.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    out.setIndex(I);
    return { geometry: out, body, mesh, gltf };
  })();
  extracted.set(k, p); return p;
}

// ---- shape heads (real static GLBs) -------------------------------------------------------------------------------------
const SHAPE_HEADS = [["cat_head", "Cat head", true], ["bunny_head", "Bunny head", true], ["bear_head", "Bear head", true], ["fox_head", "Fox head", true], ["ghost", "Ghost", false], ["egg", "Egg", false], ["daruma", "Daruma", false], ["star_body", "Star", false], ["heart_body", "Heart", false], ["cloud_body", "Cloud", false]];
for (const [id, label, ears] of SHAPE_HEADS) {
  PARTS.push({
    slot: "head", id: "g_" + id, label: label + " (GLB)", kind: "glb", for: ["mix"], focus: "head", hasEars: ears, note: "Real GLB from assets/props/shapes/" + (ears ? "; has its own ears" : ""),
    async build(c) {
      const gltf = await loadGltf(`${A}props/shapes/shape_${id}.glb`), root = await cloneScene(gltf);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const k = (c.D.headR * 2.3) / Math.max(sz.x, sz.y);
      const holder = new THREE.Group(); holder.name = "HeadGlb"; holder.scale.setScalar(k);
      root.position.sub(ctr); holder.add(root);
      const rx = (sz.x * k) / 2, ry = (sz.y * k) / 2, rz = (sz.z * k) / 2;
      holder.position.set(0, ry * 0.9, 0);
      Object.assign(c.head, { rx, ry, rz, cy: ry * 0.9, snout: 0, hasEars: ears, noHair: true, fur: false });
      root.traverse((o) => {
        if (!o.isMesh) return;
        const clay = o.material.name === "Clay";
        o.material = clay ? c.rig.mats.skin : o.material.clone();
        o.userData.slot = "head"; o.userData.region = clay ? "skin" : undefined; if (!clay) o.userData.noOutline = false;
      });
      c.J.head.add(holder);
    },
  });
}

// ---- Kamikin ears and tails (cut from the mochi GLBs) ---------------------------------------------------------------------
const MOCHI = (n) => `${A}mochi/kamikin-${n}.glb`;
const EARS = [["player-bunny-3", "Bunny", /^ear_L/], ["player-cat-5", "Cat", /^ear_L/], ["pip", "Fox", /^ear_L/], ["player-panda-2", "Panda", /^ear_L/], ["player-pup-8", "Pup", /^ear_L/], ["kon", "Kitsune", /^ear_L/], ["kumo", "Lamb", /^ear_L/], ["hana", "Fawn", /^ear_L/], ["player-hamster-4", "Hamster", /^ear_L/]];
const TAILS = [["player-cat-5", "Cat", /^tail/], ["pip", "Fox", /^tail/], ["kon", "Kitsune fan (9)", /^tail/], ["player-bunny-3", "Bunny puff", /^tail0/], ["player-panda-2", "Panda", /^tail/], ["player-pup-8", "Pup", /^tail/], ["hana", "Fawn", /^tail/], ["kumo", "Lamb", /^tail0/]];
const earIdx = PARTS.findIndex((p) => p.slot === "ears");
for (const [n, label, re] of EARS) {
  PARTS.push({
    slot: "ears", id: "k_ear_" + n, label: `Kamikin ${label}`, kind: "derived", for: ["mix"], focus: "head", note: "Cut from assets/mochi/kamikin-" + n + ".glb (rigid, not skinned)",
    async build(c) {
      const ex = await extract(MOCHI(n), "MochiBody", (b) => re.test(b), "earL");
      if (!ex?.geometry) return;
      const hd = c.head, bw2 = Math.max(0.01, (ex.body.max.x - ex.body.min.x) / 2), hcy = ex.body.max.y - bw2;
      const bone = ex.mesh.skeleton.bones.find((b) => /^ear_L0$/.test(b.name)) || ex.mesh.skeleton.bones.find((b) => re.test(b.name));
      const piv = bone.getWorldPosition(new THREE.Vector3());
      const k = (hd.rx / bw2) * 0.95;
      for (const s of [1, -1]) {
        const side = s > 0 ? "L" : "R", sizeK = 1 + 0.6 * c.v("ear" + side);
        const geo = ex.geometry.clone().translate(-piv.x, -piv.y, -piv.z);
        const m = new THREE.Mesh(geo, c.rig.mats.hair); m.userData.region = "hair"; m.userData.slot = "ears"; m.name = "KamikinEar_" + side;
        m.scale.set(k * sizeK * s, k * sizeK, k * sizeK);
        m.position.set(s * hd.rx * (piv.x / bw2) * 0.98, hd.cy + hd.ry * ((piv.y - hcy) / bw2) * 0.98 - hd.ry * 0.05, hd.rz * (piv.z / bw2));
        c.J.head.add(m);
      }
    },
  });
}
const tailIdx = 0;
for (const [n, label, re] of TAILS) {
  PARTS.push({
    slot: "tail", id: "k_tail_" + n + (re.source === "^tail0" ? "_p" : ""), label: `Kamikin ${label}`, kind: "derived", for: ["mix"], focus: "tail", note: "Cut from assets/mochi/kamikin-" + n + ".glb (rigid, not skinned)",
    async build(c) {
      const ex = await extract(MOCHI(n), "MochiBody", (b) => re.test(b), "tail" + re.source);
      if (!ex?.geometry) return;
      const bw2 = Math.max(0.01, (ex.body.max.x - ex.body.min.x) / 2), bone = ex.mesh.skeleton.bones.find((b) => /^tail0$/.test(b.name));
      const piv = bone.getWorldPosition(new THREE.Vector3());
      const k = (c.D.S * 0.2) / bw2;
      const m = new THREE.Mesh(ex.geometry.clone().translate(-piv.x, -piv.y, -piv.z), c.rig.mats.hair); m.userData.region = "hair"; m.userData.slot = "tail"; m.name = "KamikinTail";
      m.scale.setScalar(k * (1 + 0.8 * c.v("tailLen")));
      m.rotation.x = c.plan === "upright" ? 0.5 : -0.3; // undo the tail base tilt: these cuts are authored level
      c.J.tailBase.add(m);
    },
  });
}

// ---- Rubbernose gloves and shoes ----------------------------------------------------------------------------------------------
const RN = `${A}rubbernose/rubbernose-rubby.glb`;
function rubberPart(slot, id, label, mat, side, scaleOf, offset) {
  PARTS.push({
    slot, id, label, kind: "derived", for: ["mix"], focus: slot === "hands" ? "hand" : "feet", note: "Cut from assets/rubbernose/rubbernose-rubby.glb (rigid, not skinned)",
    async build(c) {
      for (const s of ["L", "R"]) {
        const ex = await extract(RN, mat, () => true, "all");
        if (!ex?.geometry) return;
        // split by side: keep triangles whose centroid is on the +x (left) or -x side
        const key = "side" + s; ex[key] ||= sideGeo(ex.geometry, s === "L" ? 1 : -1);
        const g = ex[key]; if (!g) continue;
        g.computeBoundingBox(); const b = g.boundingBox, ctr = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
        const k = scaleOf(c.D) / Math.max(sz.y, sz.x);
        const m = new THREE.Mesh(g.clone().translate(-ctr.x, -ctr.y, -ctr.z), c.rig.mats[mat === "Glove" ? "cloth2" : "accent"]); m.userData.region = mat === "Glove" ? "cloth2" : "accent"; m.userData.slot = slot; m.scale.setScalar(k);
        m.name = (slot === "hands" ? "Glove_" : "Shoe_") + s;
        const holder = new THREE.Group(); holder.add(m);
        const [dx, dy, dz] = offset(c.D, sz.y * k);
        m.position.set(0, dy, dz);
        if (slot === "hands") { if (c.J["wrist_" + s]) c.J["wrist_" + s].add(holder); }
        else for (const n of c.legNames.filter((x) => x[0] === s)) c.J["ankle_" + n].add(holder.clone(true));
      }
    },
  });
}
function sideGeo(geo, sign) {
  const pos = geo.attributes.position, idx = geo.index, keep = [], c = new THREE.Vector3();
  for (let f = 0; f < idx.count; f += 3) { c.set(0, 0, 0); for (let j = 0; j < 3; j++) c.x += pos.getX(idx.getX(f + j)) / 3; if (c.x * sign > 0) keep.push(idx.getX(f), idx.getX(f + 1), idx.getX(f + 2)); }
  if (!keep.length) return null;
  const g = geo.clone(); g.setIndex(keep);
  // drop unused vertices by re-indexing via a copy
  const map = new Map(), P = [], N = [], U = [], I = [];
  for (const i of keep) { if (!map.has(i)) { map.set(i, P.length / 3); P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); const nn = geo.attributes.normal; if (nn) N.push(nn.getX(i), nn.getY(i), nn.getZ(i)); } I.push(map.get(i)); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); if (N.length) out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); out.setIndex(I); return out;
}
rubberPart("hands", "rn_glove", "Rubbernose glove", "Glove", "x", (D) => D.handR * 3.0, (D, h) => [0, -h * 0.5, 0]);
rubberPart("feet", "rn_shoe", "Rubbernose shoe", "Shoe", "x", (D) => D.footR * 3.2, (D, h) => [0, -h * 0.1, h * 0.2]);
