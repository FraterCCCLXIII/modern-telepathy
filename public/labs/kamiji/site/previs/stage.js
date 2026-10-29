// The 3D side: ONE shared WebGL renderer draws every view (map cards, viewport, thumbnails) into per-view 2D canvases,
// the same pattern the Kamiji site uses. Scenes are built from the node's cast and cached per node.
import { CHAR_BY_ID, ACCESSORY_DIR, ACCESSORY_INDEX } from "./catalog.js";

export async function createStage() {
  const THREE = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  const loader = new GLTFLoader();
  const stats = { renders: 0, ms: 0, lastMs: 0 };
  const stage = { THREE, renderer, stats, lost: false, onLost: null };
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); stage.lost = true; stage.onLost?.(); });

  const glbs = new Map();
  const loadGlb = (url) => { if (!glbs.has(url)) glbs.set(url, loader.loadAsync(url)); return glbs.get(url); };
  let accIndex = null;
  stage.accessories = () => (accIndex ||= fetch(ACCESSORY_INDEX).then((r) => r.json()).then((rows) => rows.map((a) => ({ id: a.name, file: a.file, slot: a.anchor?.slot || "head", label: a.name.replace(/_/g, " ") }))).catch(() => []));

  // soft round contact shadow shared by every actor
  const shadowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  })();

  const MORPH_ORDER = ["star_body", "heart_body", "cat_head", "cloud_body", "bunny_head", "daruma", "dango", "mushroom", "bear_head", "moon_crescent"];
  const MORPH_COLORS = ["#ffd23f", "#ff7a99", "#9ad0ff", "#e9e9e9", "#ffb6d9", "#e5534b", "#b4e08a", "#ff9d5c", "#c9a27a", "#f7e08a"].map((c) => new THREE.Color(c));

  const LIGHTS = {
    soft: () => [new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5), dir(0xffefd2, 1.8, -1.5, 2, 4)],
    hard: () => [new THREE.HemisphereLight(0xffffff, 0x666666, 0.55), dir(0xffffff, 3.4, 4, 3, 1.5)],
    rim: () => [new THREE.HemisphereLight(0xe8f0ff, 0x555566, 0.9), dir(0xffefd2, 1.4, -1, 2, 4), dir(0xcfe0ff, 3.2, 0, 2.5, -4)],
    dusk: () => [new THREE.HemisphereLight(0xffd2a8, 0x40385a, 0.7), dir(0xff9d5c, 2.4, -4, 0.8, 2)],
  };
  function dir(color, intensity, x, y, z) { const l = new THREE.DirectionalLight(color, intensity); l.position.set(x, y, z); return l; }

  stage.cloneObject = (o) => SkeletonUtils.clone(o);
  stage.probe = async (url) => { const g = await loader.loadAsync(url); let skinned = false; g.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; }); return { clips: g.animations.map((a) => a.name), skinned }; };
  stage.loader = loader;
  const instances = new Map();
  class Instance {
    constructor(node) {
      this.id = node.id; this.scene = new THREE.Scene(); this.state = "loading"; this.token = 0; this.key = ""; this.actors = [];
      this.bounds = { center: new THREE.Vector3(0, 0.8, 0), radius: 1.6, min: new THREE.Vector3(), max: new THREE.Vector3(0, 1.6, 0) };
      this.lights = []; this.ready = Promise.resolve(); this.groundMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.groundMat); this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -0.002; this.scene.add(this.ground);
      this.t = 0;
    }
    sync(node) {
      const p = node.props, key = JSON.stringify(p.cast);
      this.setLook(p);
      if (key !== this.key) { this.key = key; this.ready = this.build(p.cast); }
      return this;
    }
    setLook(p) {
      const lk = p.bg + p.light; if (lk === this.lookKey) return; this.lookKey = lk;
      this.scene.background = new THREE.Color(p.bg);
      const c = new THREE.Color(p.bg), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      this.groundMat.color.copy(c).lerp(new THREE.Color(lum > 0.3 ? 0x000000 : 0xffffff), lum > 0.3 ? 0.07 : 0.08);
      if (this.lightName !== p.light) {
        this.lights.forEach((l) => this.scene.remove(l));
        this.lights = (LIGHTS[p.light] || LIGHTS.soft)(); this.lights.forEach((l) => this.scene.add(l)); this.lightName = p.light;
      }
    }
    async build(cast) {
      const token = ++this.token; this.state = "loading";
      try {
        const defs = cast.map((c) => CHAR_BY_ID.get(c.ref)).filter(Boolean);
        if (defs.some((d) => !d.url)) throw new Error("A model was imported in an earlier session. Re-import it to see it.");
        const gltfs = await Promise.all(defs.map((d) => loadGlb(d.url)));
        const accs = await Promise.all(cast.map(async (c) => {
          if (!c.acc) return null;
          const rows = await stage.accessories(); const row = rows.find((r) => r.id === c.acc);
          return row ? { row, gltf: await loadGlb(ACCESSORY_DIR + row.file) } : null;
        }));
        if (token !== this.token) return;
        this.root.clear(); this.actors = [];
        let x = 0; const gap = 0.35;
        defs.forEach((d, i) => {
          const gltf = gltfs[i], model = SkeletonUtils.clone(gltf.scene);
          const holder = new THREE.Group(); holder.add(model); this.root.add(holder);
          model.updateMatrixWorld(true);
          let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
          const k = d.size / (d.rigged ? size.y : Math.max(size.x, size.y, size.z));
          holder.scale.setScalar(k); holder.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(holder); size = box.getSize(new THREE.Vector3());
          const cxl = (box.min.x + box.max.x) / 2;
          holder.position.set(-cxl, -box.min.y, -(box.min.z + box.max.z) / 2);
          const slot = new THREE.Group(); slot.add(holder); this.root.add(slot); slot.userData.w = size.x;
          const a = { def: d, slot, holder, mixer: null, clips: gltf.animations.map((c) => c.name), morph: null, size, spin: !d.rigged && !d.morph };
          if (gltf.animations.length) {
            a.mixer = new THREE.AnimationMixer(model);
            const want = cast[i].anim || ""; const clip = gltf.animations.find((c) => c.name.toLowerCase() === want.toLowerCase()) || gltf.animations.find((c) => /idle/i.test(c.name)) || gltf.animations[0];
            a.clip = clip; a.mixer.clipAction(clip).play(); a.mixer.setTime(0);
          }
          model.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && "mouthOpen" in o.morphTargetDictionary) a.face = o; }); // the Kamiji hand exposes mouthOpen / mouthO morph targets
          if (d.morph) model.traverse((o) => { if (o.isMesh && o.morphTargetInfluences) { o.material = o.material.clone(); a.morph = o; } });
          const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: d.rigged ? 0.5 : 0.6 }));
          sh.rotation.x = -Math.PI / 2; sh.position.y = 0.003; sh.scale.set(size.x * 1.5 + 0.2, size.z * 1.5 + 0.2, 1); slot.add(sh);
          const acc = accs[i];
          if (acc) { // accessories are modelled for a unit-diameter head at the origin: scale by an estimated head diameter
            const D = Math.min(size.x, size.y) * (d.rigged ? 0.62 : 0.8);
            const ar = SkeletonUtils.clone(acc.gltf.scene); ar.scale.setScalar(D);
            ar.position.set(0, size.y - D * 0.5 - (d.rigged ? 0.02 : 0), 0);
            holder.updateMatrixWorld(true);
            const head = d.head && holder.getObjectByName(d.head);
            if (head) { slot.add(ar); ar.updateMatrixWorld(true); head.attach(ar); } else slot.add(ar);
          }
          a.w = size.x; this.actors.push(a);
        });
        const total = this.actors.reduce((s, a) => s + a.w, 0) + gap * Math.max(0, this.actors.length - 1);
        x = -total / 2; this.actors.forEach((a) => { a.slot.position.x = x + a.w / 2; x += a.w + gap; });
        const box = new THREE.Box3().setFromObject(this.root);
        if (!box.isEmpty()) {
          this.bounds.min.copy(box.min); this.bounds.max.copy(box.max); box.getCenter(this.bounds.center);
          this.bounds.radius = Math.max(0.6, box.getSize(new THREE.Vector3()).length() / 2);
        }
        const gr = Math.max(1.6, total * 0.75 + 0.4); this.ground.scale.setScalar(gr);
        this.state = "ready"; this.setTime(this.t);
      } catch (err) {
        if (token === this.token) { this.state = "error"; console.warn("Previs: scene failed to load", err); }
      }
    }
    get clips() { return this.actors.map((a) => a.clips); }
    // Talking mouth: only rigs that expose a mouth morph target take part (today: the Kamiji hand). Kamikin and Rubbernose have no mouth hook.
    setMouth(ref, amp, viseme) { this.mouth = amp > 0.01 ? { ref, amp, viseme } : null; this.applyMouth(); }
    applyMouth() {
      for (const a of this.actors) {
        if (!a.face) continue; const f = a.face, d = f.morphTargetDictionary, m = this.mouth && a.def.id === this.mouth.ref ? this.mouth : null;
        if (!m && !a.mouthSet) continue;
        const o = m ? (m.viseme === "O" || m.viseme === "U" ? 0.35 : 1) : 0, oo = m && (m.viseme === "O" || m.viseme === "U") ? 1 : 0;
        f.morphTargetInfluences[d.mouthOpen] = m ? m.amp * o : 0; if ("mouthO" in d) f.morphTargetInfluences[d.mouthO] = m ? m.amp * oo : 0; a.mouthSet = !!m;
      }
    }
    setTime(t) {
      this.t = t;
      for (const a of this.actors) {
        if (a.mixer) a.mixer.setTime(t);
        if (a.spin) a.holder.rotation.y = t * 0.6;
        if (a.morph) {
          const names = MORPH_ORDER.filter((n) => n in a.morph.morphTargetDictionary), N = names.length, period = 1.4, i = t / period;
          const ia = Math.floor(i) % N, ib = (ia + 1) % N, f = i - Math.floor(i), s = Math.min(1, Math.max(0, (f - 0.35) / 0.65)), e = s * s * (3 - 2 * s);
          a.morph.morphTargetInfluences.fill(0);
          a.morph.morphTargetInfluences[a.morph.morphTargetDictionary[names[ia]]] = 1 - e;
          a.morph.morphTargetInfluences[a.morph.morphTargetDictionary[names[ib]]] = e;
          a.morph.material.color?.copy(MORPH_COLORS[ia % MORPH_COLORS.length]).lerp(MORPH_COLORS[ib % MORPH_COLORS.length], e);
        }
      }
      this.applyMouth();
    }
    dispose() { this.token++; this.root.clear(); }
  }
  stage.instance = (node) => {
    let inst = instances.get(node.id);
    if (!inst) { inst = new Instance(node); instances.set(node.id, inst); }
    return inst.sync(node);
  };
  stage.drop = (id) => { instances.get(id)?.dispose(); instances.delete(id); };
  stage.prune = (ids) => { for (const id of [...instances.keys()]) if (!ids.has(id) && !id.startsWith("av:")) stage.drop(id); };

  // ---- cameras -----------------------------------------------------------------------------------
  stage.camera = () => new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 80);
  const EASE = { linear: (u) => u, "ease in-out": (u) => u * u * (3 - 2 * u), "ease in": (u) => u * u, "ease out": (u) => 1 - (1 - u) * (1 - u) };
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  stage.applyKey = (cam, k) => { cam.position.fromArray(k.p); cam.fov = k.fov; cam.lookAt(va.fromArray(k.t)); cam.updateProjectionMatrix(); };
  stage.camAt = (cam, c, u) => {
    const e = (EASE[c.ease] || EASE.linear)(Math.min(1, Math.max(0, u)));
    cam.position.copy(va.fromArray(c.a.p)).lerp(vb.fromArray(c.b.p), e);
    cam.fov = c.a.fov + (c.b.fov - c.a.fov) * e;
    const t = new THREE.Vector3().fromArray(c.a.t).lerp(vb.fromArray(c.b.t), e);
    cam.lookAt(t); cam.updateProjectionMatrix();
    return t;
  };
  stage.presetKey = (inst, name) => { // camera presets relative to the scene bounds
    const b = inst.bounds, c = b.center, h = b.max.y - b.min.y, D = b.radius * 2.55;
    const mk = (dx, dy, dz, d, ty = c.y, fov = 35) => { const v = new THREE.Vector3(dx, dy, dz).normalize().multiplyScalar(d); return { p: [c.x + v.x, ty + v.y, c.z + v.z], t: [c.x, ty, c.z], fov }; };
    switch (name) {
      case "Front": return mk(0, 0.12, 1, D);
      case "3/4": return mk(0.75, 0.28, 0.75, D);
      case "Low": return mk(0, -0.05, 1, D * 0.9, b.min.y + 0.2);
      case "High": return mk(0, 0.8, 0.6, D);
      case "Close": return mk(0, 0.08, 1, D * 0.5, b.min.y + h * 0.72);
      case "Wide": return mk(0.2, 0.2, 1, D * 1.6);
      case "Top": return mk(0, 1, 0.02, D * 1.1);
      default: return mk(0, 0.12, 1, D);
    }
  };

  // ---- drawing -----------------------------------------------------------------------------------
  const ctxs = new WeakMap();
  stage.draw = (inst, cam, canvas, w, h) => {
    const t0 = performance.now();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    renderer.render(inst.scene, cam);
    let g = ctxs.get(canvas); if (!g) { g = canvas.getContext("2d"); ctxs.set(canvas, g); }
    g.drawImage(renderer.domElement, 0, 0, w, h);
    const ms = performance.now() - t0; stats.renders++; stats.ms += ms; stats.lastMs = ms;
  };
  const off = document.createElement("canvas");
  // `after(ctx, w, h)` may paint over the render (subtitles) before it is encoded
  stage.snapshot = (inst, cam, w = 320, h = 180, after = null) => { stage.draw(inst, cam, off, w, h); if (after) after(off.getContext("2d"), w, h); return off.toDataURL("image/jpeg", 0.82); };
  stage.setTalking = (nodeId, ref, amp, viseme) => instances.get(nodeId)?.setMouth(ref, amp, viseme);
  // where a character's head is on screen (px in a w x h frame) for the given camera, or null when it is not in the scene
  const hv = new THREE.Vector3(), hb = new THREE.Box3();
  stage.headScreen = (inst, cam, ref, w, h) => {
    const a = inst?.actors.find((x) => x.def.id === ref); if (!a) return null;
    hb.setFromObject(a.holder); if (hb.isEmpty()) return null; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    hv.set((hb.min.x + hb.max.x) / 2, hb.max.y - (hb.max.y - hb.min.y) * 0.1, (hb.min.z + hb.max.z) / 2).project(cam);
    return { x: (hv.x * 0.5 + 0.5) * w, y: (-hv.y * 0.5 + 0.5) * h };
  };
  stage.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures });
  return stage;
}
