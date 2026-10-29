// Accessories: the 36 real GLBs (assets/props/accessories), held props (assets/props/objects, real GLBs) and a few procedural wearables.
import { THREE } from "./geo.js";
import { A, SOCKETS, HELD, PROC_ACC } from "./data.js";
import { loadGltf, cloneScene } from "./glbparts.js";
import { buildProcAccessory } from "./parts.js";

export const ACC = { list: [], byId: new Map(), ready: null };
const label = (s) => s.replace(/_obj$|_on$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
ACC.ready = (async () => {
  const rows = await fetch(A + "props/accessories/index.json").then((r) => r.json());
  const list = rows.map((p) => ({ id: p.name, label: label(p.name), socket: p.anchor.slot === "bow" ? "hair" : p.anchor.slot, kind: "glb", file: A + "props/accessories/" + p.file, zone: p.anchor.zone, conflicts: p.anchor.conflicts || [], tint: p.tint, tints: p.tints, anchor: p.anchor, keywords: p.keywords || [] }));
  for (const n of HELD) list.push({ id: "held_" + n, label: label(n), socket: "hand", kind: "held", file: `${A}props/objects/${n}.glb`, zone: "hand", conflicts: [], tint: null });
  for (const p of PROC_ACC) list.push({ id: p.id, label: p.label, socket: p.socket, kind: "proc", zone: p.socket, conflicts: [], tint: null });
  ACC.list = list; list.forEach((a) => ACC.byId.set(a.id, a));
  return list;
})();
export const GROUPS = [["head", "Hats"], ["face", "Face"], ["ears", "Ears"], ["hair", "Hair clips"], ["neck", "Neck"], ["back", "Back"], ["hand", "Held in a hand"], ["waist", "Waist"], ["feet", "Feet"], ["tail", "Tail"]];

/** Build one accessory instance: a Group sized for its socket. Real head-frame GLBs use their own anchor offsets. */
export async function buildAccessory(entry, tint, fig) {
  const holder = new THREE.Group(); holder.name = "Acc_" + entry.id;
  if (entry.kind === "proc") { const g = buildProcAccessory(entry.id, fig.rig || { D: fig.D, plan: "upright" }); g.traverse((o) => { if (o.isMesh) { o.userData.slot = "acc"; if (tint) o.material.color.set(tint); } }); holder.add(g); return holder; }
  const gltf = await loadGltf(entry.file), root = await cloneScene(gltf);
  root.traverse((n) => {
    if (!n.isMesh) return;
    n.material = n.material.clone(); n.userData.slot = "acc"; n.userData.noBounds = false;
    if (n.material.name === "Clay" && (tint || entry.tint)) n.material.color.set(tint || entry.tint);
  });
  if (entry.kind === "held") {
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = (fig.D.S * 0.13) / Math.max(s.x, s.y, s.z);
    root.position.sub(c); const inner = new THREE.Group(); inner.add(root); inner.scale.setScalar(k); holder.add(inner); return holder;
  }
  const a = entry.anchor, inner = new THREE.Group();
  inner.position.set(...a.offset); inner.scale.setScalar(a.scale); inner.rotation.set(...a.rotation.map((d) => (d * Math.PI) / 180));
  inner.add(root); holder.add(inner); return holder;
}

/** Attach the character's accessories to the figure's sockets. Returns the group list (for cleanup). */
export async function attachAccessories(fig, ch) {
  const made = [];
  for (const e of ch.accessories || []) {
    const entry = ACC.byId.get(e.id); if (!entry) continue;
    const targets = fig.sockets?.[e.socket] || [];
    if (!targets.length) continue;
    let inst0 = null;
    for (const t of targets) {
      const inst = inst0 ? inst0.clone(true) : await buildAccessory(entry, e.tint, fig);
      inst0 = inst0 || inst;
      if (t.matrix) { inst.matrix.copy(t.matrix); inst.matrix.decompose(inst.position, inst.quaternion, inst.scale); }
      else {
        inst.position.set(...t.pos);
        const proc = entry.kind === "proc" || entry.kind === "held";
        inst.scale.setScalar(proc ? 1 : t.scale);
        if (entry.kind === "held" && e.socket === "hand_L") inst.rotation.y = 0.4;
      }
      if (t.parent) { t.parent.add(inst); made.push(inst); }
    }
  }
  return made;
}
export const worn = (ch, socket) => (ch.accessories || []).find((a) => a.socket === socket);
export const socketLabel = (id) => SOCKETS.find((s) => s.id === id)?.label || id;
