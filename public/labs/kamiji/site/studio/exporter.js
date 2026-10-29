// Export: character JSON, GLB (GLTFExporter), PNG portrait and turntable sheet.
//   Procedural figures are re-built as ONE skinned mesh per source mesh on a cloned bone hierarchy (rigid weights),
//   with their head morph targets and the procedural clips. GLB-based figures export their own skinned meshes, morph targets and clips.
import { THREE } from "./geo.js";

export function download(data, name, type = "application/octet-stream") {
  const url = typeof data === "string" && data.startsWith("data:") ? data : URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  if (!url.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const stdMat = (m) => {
  if (m.isMeshStandardMaterial && !m.onBeforeCompile.toString().includes("uC2")) return m;
  const s = new THREE.MeshStandardMaterial({ color: m.color ? m.color.clone() : 0xffffff, roughness: m.roughness ?? 0.8, metalness: 0, side: m.side, map: m.map || null, name: m.name });
  return s;
};

async function parseGLB(root, animations) {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const ex = new GLTFExporter();
  return new Promise((res, rej) => ex.parse(root, res, rej, { binary: true, animations, onlyVisible: true, maxTextureSize: 1024 }));
}

function skinnedExportScene(fig, name) {
  const out = new THREE.Group(); out.name = name || "Character";
  fig.toRest?.(); fig.root.updateMatrixWorld(true);
  const boneMap = new Map(), bones = [];
  const cloneBone = (src, parent) => { const b = new THREE.Bone(); b.name = src.name; b.position.copy(src.position); b.quaternion.copy(src.quaternion); b.scale.copy(src.scale); parent.add(b); boneMap.set(src, b); bones.push(b); src.children.forEach((c) => c.isBone && cloneBone(c, b)); return b; };
  const rootBone = cloneBone(fig.joints.root, out); rootBone.position.y += fig.lift || 0;
  out.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  let nMeshes = 0, nMorph = 0;
  const m3 = new THREE.Matrix3(), v = new THREE.Vector3();
  fig.root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.visible || o.userData.shell || o.userData.overlay || o.userData.noExport || o.userData.glint && false) return;
    let vis = true; o.traverseAncestors((a) => { if (!a.visible) vis = false; }); if (!vis) return;
    if (/RtkMouth|TubeFace/.test(o.name)) return;
    let bone = o.parent; while (bone && !bone.isBone) bone = bone.parent;
    const target = bone ? boneMap.get(bone) : rootBone;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (g.morphAttributes.position) {
      m3.setFromMatrix4(o.matrixWorld);
      g.morphAttributes.position = g.morphAttributes.position.map((a) => { const b = a.clone(); for (let i = 0; i < b.count; i++) { v.fromBufferAttribute(b, i).applyMatrix3(m3); b.setXYZ(i, v.x, v.y, v.z); } b.name = a.name; return b; });
    }
    const n = g.attributes.position.count, idx = bones.indexOf(target);
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? idx : 0)), 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    const mat = stdMat(o.userData.m0 || o.material);
    const sm = new THREE.SkinnedMesh(g, Array.isArray(mat) ? mat[0] : mat);
    sm.name = (o.userData.slot ? o.userData.slot + "_" : "") + (o.name || "mesh") + "_" + nMeshes++;
    if (g.morphAttributes.position?.length) { sm.updateMorphTargets(); sm.morphTargetInfluences = o.morphTargetInfluences ? [...o.morphTargetInfluences] : sm.morphTargetInfluences; nMorph += g.morphAttributes.position.length; }
    out.add(sm); sm.bind(skeleton);
  });
  return { out, bones: bones.length, meshes: nMeshes, morphTargets: nMorph };
}

export async function exportGLB(fig, ch) {
  const notes = [];
  let root, animations, info = {};
  if (fig.kind === "proc") {
    const s = skinnedExportScene(fig, ch.name); root = s.out; animations = fig.clips; info = { bones: s.bones, meshes: s.meshes, morphTargets: s.morphTargets };
    notes.push("Procedural parts are exported as rigid-weight skinned meshes (one bone per part). RTK and tube face decals, toon steps, gradients and outlines are not exported.");
  } else {
    const hidden = []; fig.root.traverse((o) => { if ((o.userData.shell || o.userData.overlay || /RtkMouth|TubeFace/.test(o.name)) && o.visible) { o.visible = false; hidden.push(o); } });
    const mats = []; fig.root.traverse((o) => { if (o.isMesh && o.userData.m0 && o.material !== o.userData.m0) { mats.push([o, o.material]); o.material = o.userData.m0; } });
    root = fig.root; animations = fig.clips || []; fig.__restore = () => { hidden.forEach((o) => (o.visible = true)); mats.forEach(([o, m]) => (o.material = m)); };
    info = { bones: Object.keys(fig.joints || {}).length };
    notes.push("GLB bases export their own skinned meshes, morph targets and clips; outline shells and decals are left out.");
  }
  let buf;
  try { buf = await parseGLB(root, animations); } finally { fig.__restore?.(); fig.__restore = null; fig.toPose?.(); }
  return { buffer: buf, bytes: buf.byteLength, notes, ...info, clips: animations.map((a) => a.name) };
}

/** Load a GLB buffer back with GLTFLoader and report what is in it (used by the page and by the tests). */
export async function inspectGLB(buffer) {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(buffer.slice(0), "");
  let skinned = 0, meshes = 0, morph = 0, bones = 0; const names = new Set();
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned++; if (o.isMesh) { meshes++; if (o.morphTargetDictionary) { morph += Object.keys(o.morphTargetDictionary).length; Object.keys(o.morphTargetDictionary).forEach((k) => names.add(k)); } } if (o.isBone) bones++; });
  return { skinned, meshes, morphTargets: morph, morphNames: [...names], bones, animations: gltf.animations.map((a) => a.name) };
}

export function turntableSheet(vp, n = 8, cell = 240) {
  const cols = 4, rows = Math.ceil(n / cols), c = document.createElement("canvas"); c.width = cols * cell; c.height = rows * cell;
  const g = c.getContext("2d"); g.fillStyle = vp.bg; g.fillRect(0, 0, c.width, c.height);
  const off = vp.camera.position.clone().sub(vp.controls.target), tgt = vp.controls.target.clone();
  const prevAuto = vp.controls.autoRotate; vp.controls.autoRotate = false;
  const img = new Image();
  const frames = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, o = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    vp.camera.position.copy(tgt).add(o); vp.camera.lookAt(tgt);
    frames.push(vp.snapshot(cell, cell));
  }
  vp.camera.position.copy(tgt).add(off); vp.camera.lookAt(tgt); vp.controls.autoRotate = prevAuto; vp.controls.update(); vp.dirty = true;
  return Promise.all(frames.map((u, i) => new Promise((res) => { const im = new Image(); im.onload = () => { g.drawImage(im, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell); res(); }; im.src = u; }))).then(() => c.toDataURL("image/png"));
}
