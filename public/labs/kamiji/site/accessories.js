// Accessories library (assets/props/accessories): hats, glasses, bows, headphones, neckwear.
// Every GLB is modelled for a unit-diameter head at the origin (front +Z), already placed where it is worn, so
// wearing one = parent it to a head frame { centre, radius } and scale it by the head diameter. See docs/accessories.md.
//
//   const acc = createAccessories({ THREE, loader, hero, getContent, fit, reduceMotion, tileVariation });
//   acc.rowConfig()        -> config for the hero "Accessory" rail row (multi-select, grouped by slot)
//   acc.tileContent(v, it) -> library tile content (the accessory on a small sphere head)
//   window.kamijiAccessories = { wear(id), remove(id), clear(), list(), toggle(id) }   (driven by chat / editor later)
//
// Supported hero targets: the Kamiji hand (sphere and cube shapes; hidden while it is an open hand), Shapes and
// Emoji heads. Kamikin, Rubbernose, hand poses and plain props have no Accessory row.

const DIR = "../assets/props/accessories/";
const SLOT_ORDER = ["head", "face", "ears", "bow", "neck"];
const SLOT_HEADING = { head: "Hats", face: "Face", ears: "Ears", bow: "Hair", neck: "Neck" };
const SWAY = { head: 0.02, bow: 0.04, ears: 0.012, neck: 0.01, face: 0 };
// Head frame tweaks per shape (s = size multiplier, dx / dy = shift as a fraction of the head diameter, dz likewise).
// The default is: head = the largest sphere that fits the bounding box width/height, sitting at its top for tall bodies.
const SHAPE_HEAD = {
  shape_cat_head: { s: 0.86, dy: -0.07 }, shape_bunny_head: { s: 0.95, dy: -0.22, mid: true }, shape_bear_head: { s: 0.86 },
  shape_fox_head: { s: 0.9, dy: -0.04 }, shape_ghost: { s: 0.9, dy: 0.02 }, shape_star_body: { s: 0.74, dy: 0.0 },
  shape_heart_body: { s: 0.8, dy: -0.04 }, shape_cloud_body: { s: 0.86, dy: 0.0 }, shape_flower: { s: 0.5 },
  shape_donut: { s: 0.7 }, shape_dango: { s: 0.8, dy: 0.18 }, shape_mushroom: { s: 0.9, dy: 0.1 },
};

export function createAccessories({ THREE, loader, hero, getContent, fit, reduceMotion, tileVariation, onChange }) {
  let items = [];
  const byId = new Map(), byLabel = new Map();
  const worn = new Map();                // id -> item, in the order worn; survives hero switches
  const gltfs = new Map();
  const loadGltf = (file) => { if (!gltfs.has(file)) gltfs.set(file, loader.loadAsync(DIR + file)); return gltfs.get(file); };
  const labelOf = (name) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  const ready = (async () => {
    const r = await fetch(DIR + "index.json");
    const rows = await r.json();
    items = rows.map((p) => ({ id: p.name, ...p, label: labelOf(p.name), slot: p.anchor.slot }));
    items.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    items.forEach((it) => { byId.set(it.id, it); byLabel.set(it.label, it); });
    return items;
  })();
  ready.catch((e) => console.warn("Kamiji site: accessories index failed", e));

  const resolve = (x) => (typeof x === "string" ? byId.get(x) || byLabel.get(x) || byId.get(x.toLowerCase().replace(/\s+/g, "_")) : x && byId.get(x.id || x.name));
  const zones = (it) => new Set([it.anchor.zone, ...(it.anchor.conflicts || [])]);
  const clash = (a, b) => { const z = zones(a); for (const k of zones(b)) if (z.has(k)) return true; return false; };

  // ---- worn state ----------------------------------------------------------------------------------------
  let changeSeq = 0;
  function changed() { changeSeq++; syncPills(); onChange?.(); document.dispatchEvent(new CustomEvent("kamiji-accessories", { detail: api.list().filter((x) => x.worn) })); }
  function wear(x) {
    const it = resolve(x); if (!it) return false;
    for (const [id, other] of [...worn]) if (id !== it.id && clash(it, other)) worn.delete(id);   // conflicts resolve by zone: the newcomer wins
    worn.set(it.id, it); changed(); return true;
  }
  function remove(x) { const it = resolve(x); if (!it || !worn.delete(it.id)) return false; changed(); return true; }
  function clear() { if (!worn.size) return; worn.clear(); changed(); }

  // ---- hero Accessory row ----------------------------------------------------------------------------------
  const pills = () => [...document.querySelectorAll("#g-accessory .pill")];
  function syncPills() { pills().forEach((b) => b.setAttribute("aria-pressed", String(!!byLabel.get(b.textContent) && worn.has(byLabel.get(b.textContent).id)))); }
  function rowConfig() {
    const groups = {};
    items.forEach((it) => { groups[it.label] = SLOT_HEADING[it.slot]; });
    return {
      items: items.map((it) => it.label), multi: true, groups, noun: "accessories",
      initial: items.filter((it) => worn.has(it.id)).map((it) => it.label),
      normalize: (list) => (list || []).filter((l) => byLabel.has(l)),
      onPick(list) {
        const now = new Set(list.map((l) => byLabel.get(l)?.id));
        for (const id of [...worn.keys()]) if (!now.has(id)) worn.delete(id);
        const added = items.filter((it) => now.has(it.id) && !worn.has(it.id));
        added.forEach((it) => wear(it));
        changed();
      },
    };
  }

  // ---- instance building ---------------------------------------------------------------------------------------
  async function build(it) {
    const gltf = await loadGltf(it.file);
    const root = gltf.scene.clone(true);
    const mats = [], band = [];
    root.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone(); mats.push(n.material);
      if (n.material.name === "Clay") n.material.color.set(it.tint);
      if (n.material.name in (it.anchor.hideRoles || {})) band.push({ mesh: n, hideFor: it.anchor.hideRoles[n.material.name] });
    });
    const a = it.anchor;
    const holder = new THREE.Group();        // sway pivot (head centre)
    const inner = new THREE.Group();         // default anchor offset / scale / rotation
    inner.position.set(...a.offset); inner.scale.setScalar(a.scale);
    inner.rotation.set(...a.rotation.map((d) => (d * Math.PI) / 180));
    inner.add(root); holder.add(inner);
    return { it, holder, mats, band, phase: Math.random() * 6.28 };
  }

  // ---- the hero: attach to whatever head the current hero has ---------------------------------------------------
  let att = null;           // { content, root, group, nodes: Map(id -> inst), metrics, seq, loading: Set }
  function supports(content) { return !!content && (typeof content.setShape === "function" || content.face === "shape" || content.face === "emoji" || content.kind === "shape" || content.kind === "emoji"); }
  const isHand = (c) => typeof c.setShape === "function";
  function detach() {
    if (!att) return;
    att.group.parent?.remove(att.group);
    att.nodes.forEach((n) => n.mats.forEach((m) => m.dispose()));
    att = null; hero.dirty = true;
  }
  function modelBox(att) {
    const root = att.root, model = root.children.find((c) => c !== att.group);
    const y = root.rotation.y; root.rotation.y = 0; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    root.rotation.y = y; root.updateMatrixWorld(true);
    return box;
  }
  function headFrame(att) {
    const c = att.content;
    if (isHand(c)) {
      const sh = c.shape || "sphere";
      if (sh === "hand") return { visible: false, key: "hand" };
      return { visible: true, key: sh, c: new THREE.Vector3(0, 0, 0), R: sh === "cube" ? 0.9 : 0.9 };
    }
    if (!att.box) att.box = modelBox(att);
    const box = att.box, size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const o = SHAPE_HEAD[c.item?.name] || {};
    let R = 0.5 * Math.min(size.x, size.y) * (o.s || 1);
    const cy = size.y > size.x * 1.08 && !o.mid ? box.max.y - R : ctr.y;
    const depth = THREE.MathUtils.clamp(size.z / (2 * R), 0, 1);
    const cz = box.max.z - R * (0.5 + 0.5 * depth);
    return { visible: true, key: "box", c: new THREE.Vector3(ctr.x + (o.dx || 0) * 2 * R, cy + (o.dy || 0) * 2 * R, cz + (o.dz || 0) * 2 * R), R };
  }
  function applyFrame(fr) {
    att.group.visible = fr.visible;
    if (!fr.visible) { att.frame = fr; return; }
    att.group.position.copy(fr.c); att.group.scale.setScalar(2 * fr.R);
    att.frame = fr;
  }
  function updateHidden() {
    const slots = new Set([...att.nodes.values()].filter((n) => n.it.id !== "halo").map((n) => n.it.slot));
    att.nodes.forEach((n) => n.band.forEach((b) => { b.mesh.visible = !b.hideFor.some((s) => slots.has(s)); }));
  }
  function refit() {
    const c = att.content;
    att.group.updateMatrixWorld(true);
    fit(hero, att.root, 0, !isHand(c));
    hero.dirty = true;
  }

  let t0 = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    if (!items.length) return;
    const content = getContent(), root = hero.root;
    const ok = supports(content) && root && root.parent === hero.scene;
    if (!ok) { if (att) detach(); return; }
    if (!att || att.content !== content || att.root !== root) {
      detach();
      const group = new THREE.Group(); group.name = "accessories"; root.add(group);
      att = { content, root, group, nodes: new Map(), loading: new Set(), seq: -1, frame: null, box: null };
    }
    // reconcile worn <-> instances
    let touched = false;
    for (const [id, inst] of [...att.nodes]) if (!worn.has(id)) { att.group.remove(inst.holder); inst.mats.forEach((m) => m.dispose()); att.nodes.delete(id); touched = true; }
    for (const [id, it] of worn) {
      if (att.nodes.has(id) || att.loading.has(id)) continue;
      att.loading.add(id);
      const mine = att;
      build(it).then((inst) => {
        mine.loading.delete(id);
        if (att !== mine || !worn.has(id) || mine.nodes.has(id)) { inst.mats.forEach((m) => m.dispose()); return; }
        mine.nodes.set(id, inst); mine.group.add(inst.holder); mine.seq = -1;
        mine.refit = true; hero.dirty = true;
      }).catch((e) => { mine.loading.delete(id); console.warn("Kamiji site: accessory failed", id, e); });
    }
    const fr = headFrame(att);
    const moved = !att.frame || att.frame.key !== fr.key || att.frame.R !== fr.R;
    if (moved) { applyFrame(fr); hero.dirty = true; if (fr.visible && att.nodes.size) att.refit = true; }
    if (touched || att.seq !== changeSeq) { updateHidden(); att.seq = changeSeq; att.refit = true; }
    if (att.refit && att.frame?.visible) { att.refit = false; refit(); }
    if (!reduceMotion && att.frame?.visible && att.nodes.size) {
      const t = (performance.now() - t0) / 1000;
      att.nodes.forEach((n) => { n.holder.rotation.z = Math.sin(t * 1.7 + n.phase) * (SWAY[n.it.slot] || 0); });
      hero.dirty = true;
    }
  }
  requestAnimationFrame(loop);

  // ---- library tiles: the accessory worn by a small sphere head -----------------------------------------------------
  let headGeo = null, eyeGeo = null;
  function tileContent(v, it) {
    const c = { disposed: false };
    let pivot = null; const mats = [];
    c.attach = async () => {
      const inst = await build(it);
      if (c.disposed) { inst.mats.forEach((m) => m.dispose()); return; }
      headGeo ||= new THREE.SphereGeometry(0.5, 36, 24);
      eyeGeo ||= new THREE.CapsuleGeometry(0.054, 0.09, 4, 10);
      const skin = new THREE.MeshStandardMaterial({ color: "#f4e6c4", roughness: 0.7 });
      const eye = new THREE.MeshStandardMaterial({ color: "#2a2224", roughness: 0.3 });
      mats.push(skin, eye, ...inst.mats);
      pivot = new THREE.Group();
      pivot.add(new THREE.Mesh(headGeo, skin));
      for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeGeo, eye); e.position.set(s * 0.1, 0, 0.49); e.scale.set(1, 1, 0.5); pivot.add(e); }
      pivot.add(inst.holder);
      pivot.rotation.y = 0.4;
      v.scene.add(pivot); v.root = pivot;
      fit(v, pivot, 0, true);
      const tv = tileVariation(it.id);
      let t = tv.phase * Math.PI * 2 / 0.9;
      v.tick = (dt) => { t += dt * tv.speed; pivot.rotation.y = Math.sin(t * 0.9) * 0.7 * tv.amp; return dt > 0; };
      v.dirty = true;
    };
    c.dispose = () => { c.disposed = true; if (pivot) v.scene.remove(pivot); mats.forEach((m) => m.dispose()); v.tick = null; v.root = null; };
    return c;
  }

  const api = {
    ready, wear, remove, clear, rowConfig, tileContent, supports,
    toggle(x) { const it = resolve(x); if (!it) return false; return worn.has(it.id) ? !remove(it) : wear(it); },
    isWorn: (x) => { const it = resolve(x); return !!it && worn.has(it.id); },
    list: () => items.map((it) => ({ id: it.id, label: it.label, slot: it.slot, zone: it.anchor.zone, worn: worn.has(it.id) })),
    get items() { return items; },
  };
  return api;
}
