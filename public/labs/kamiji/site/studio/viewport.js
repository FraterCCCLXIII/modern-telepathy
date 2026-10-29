// The 3D side. ONE shared WebGLRenderer draws the viewport and every thumbnail (thumbnails are rendered into a corner
// of the same canvas and copied out), the pattern the rest of the site uses. 30 fps cap, IntersectionObserver gating.
import { THREE, outlineMaterial, matcapTexture } from "./geo.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createEffects } from "../effects.js";
import { ROOMS } from "./data.js";

const FPS_CAP = 30;
export async function createViewport(host, opts = {}) {
  const reduceMotion = !!opts.reduceMotion;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "st-canvas"; canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
  camera.position.set(0.4, 1.1, 4.4);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false; controls.enablePan = true; controls.screenSpacePanning = true;
  controls.minDistance = 0.4; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.62;
  controls.target.set(0, 0.85, 0);
  controls.autoRotateSpeed = 2.2;
  const vp = { THREE, renderer, scene, camera, controls, canvas, fig: null, dirty: true, visible: true, stats: { frames: 0, renders: 0, lastMs: 0, avgMs: 0 }, onPick: null, onHover: null };
  const effects = createEffects(THREE, renderer);

  // ---- lights, ground, shadow
  const lightGroup = new THREE.Group(); scene.add(lightGroup);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  const LIGHTS = {
    soft: () => [new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5), dir(0xffefd2, 1.8, -1.5, 2, 4)],
    hard: () => [new THREE.HemisphereLight(0xffffff, 0x666666, 0.55), dir(0xffffff, 3.4, 4, 3, 1.5)],
    rim: () => [new THREE.HemisphereLight(0xe8f0ff, 0x555566, 0.9), dir(0xffefd2, 1.4, -1, 2, 4), dir(0xcfe0ff, 3.2, 0, 2.5, -4)],
    dusk: () => [new THREE.HemisphereLight(0xffd2a8, 0x40385a, 0.7), dir(0xff9d5c, 2.4, -4, 0.8, 2)],
  };
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.003; ground.name = "ground"; scene.add(ground);
  const shadowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; shadow.name = "shadow"; scene.add(shadow);
  const figHolder = new THREE.Group(); figHolder.name = "figureHolder"; scene.add(figHolder);
  vp.roomId = "studio"; vp.lightId = "soft"; vp.bg = "#e7e6e1";
  vp.setRoom = (id, over = {}) => {
    const r = ROOMS[id] || ROOMS.studio; vp.roomId = id; vp.bg = over.bg || r.bg;
    const c = new THREE.Color(vp.bg), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    groundMat.color.copy(c).lerp(new THREE.Color(lum > 0.3 ? 0x000000 : 0xffffff), lum > 0.3 ? 0.07 : 0.08);
    host.style.setProperty("--st-bg", vp.bg);
    vp.setLight(over.light || r.light); applyBg(); vp.dirty = true;
  };
  vp.setLight = (id) => { vp.lightId = id; lightGroup.clear(); (LIGHTS[id] || LIGHTS.soft)().forEach((l) => lightGroup.add(l)); vp.dirty = true; };
  let fx = [];
  function applyBg() { scene.background = fx.length ? null : new THREE.Color(vp.bg); ground.visible = !fx.length; shadow.visible = !fx.length; }
  vp.setEffects = (list) => { fx = effects.setEffects(list); applyBg(); vp.dirty = true; };

  // ---- outline / view modes / highlight
  let outlineOn = true, outlineW = 0.006;
  const outMat = outlineMaterial("#1d1d1b", outlineW);
  let shells = [];
  function buildShells() {
    shells.forEach((s) => s.parent?.remove(s)); shells = [];
    if (!vp.fig) return;
    const list = []; vp.fig.root.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && !o.userData.overlay && !o.userData.shell && !o.userData.noOutline && o.material && !o.material.transparent && o.visible !== false && !o.userData.isFace) list.push(o); });
    const w = vp.fig.outlineWidth ?? 0.006;
    for (const m of list) {
      if (m.material.wireframe || m.userData.glint) continue;
      let s;
      if (m.isSkinnedMesh) { s = new THREE.SkinnedMesh(m.geometry, outMat); s.bind(m.skeleton, m.bindMatrix); s.bindMode = m.bindMode; }
      else s = new THREE.Mesh(m.geometry, outMat);
      s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale);
      if (m.morphTargetInfluences) { s.morphTargetInfluences = m.morphTargetInfluences; s.morphTargetDictionary = m.morphTargetDictionary; }
      s.userData.shell = true; s.userData.noExport = true; s.visible = outlineOn; s.frustumCulled = false; s.name = "outline";
      m.parent.add(s); shells.push(s);
    }
    outMat.userData.u.value = w;
  }
  vp.setOutline = (on) => { outlineOn = on; shells.forEach((s) => (s.visible = on)); vp.dirty = true; };
  let mode = "shaded"; const matcap = new THREE.MeshMatcapMaterial({ matcap: matcapTexture(), color: 0xffffff });
  const matcapMats = new Map();
  vp.setViewMode = (m) => {
    mode = m; if (!vp.fig) return;
    vp.fig.root.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh) || o.userData.shell || o.userData.overlay) return;
      if (!o.userData.m0) o.userData.m0 = o.material;
      const m0 = o.userData.m0;
      if (m === "shaded") o.material = m0;
      else if (m === "wire") { if (!o.userData.mw) { o.userData.mw = new THREE.MeshBasicMaterial({ color: m0.color ? m0.color.clone().multiplyScalar(0.55) : 0x444444, wireframe: true }); } o.userData.mw.color.copy(m0.color || new THREE.Color(0x444444)).multiplyScalar(0.5); o.material = o.userData.mw; }
      else { if (!matcapMats.has(m0)) matcapMats.set(m0, new THREE.MeshMatcapMaterial({ matcap: matcap.matcap, color: m0.color || 0xffffff })); const mm = matcapMats.get(m0); if (m0.color) mm.color.copy(m0.color); o.material = mm; }
    });
    vp.dirty = true;
  };
  let hoverSlot = null, overlays = [];
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  vp.setHighlight = (slot) => {
    if (slot === hoverSlot) return; hoverSlot = slot;
    overlays.forEach((o) => o.parent?.remove(o)); overlays = [];
    if (slot && vp.fig) {
      const list = []; vp.fig.root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.userData.slot === slot && !o.userData.overlay && !o.userData.shell && o.visible) list.push(o); });
      for (const m of list) {
        const ov = new THREE.Mesh(m.geometry, hlMat); ov.position.copy(m.position); ov.quaternion.copy(m.quaternion); ov.scale.copy(m.scale);
        if (m.morphTargetInfluences) { ov.morphTargetInfluences = m.morphTargetInfluences; ov.morphTargetDictionary = m.morphTargetDictionary; }
        ov.userData.overlay = true; ov.userData.noExport = true; ov.frustumCulled = false; m.parent.add(ov); overlays.push(ov);
      }
    }
    vp.dirty = true; vp.onHover?.(slot);
  };

  // ---- the figure
  vp.setFigure = (fig, { keepCamera = true } = {}) => {
    if (vp.fig) { figHolder.remove(vp.fig.root); }
    hoverSlot = null; overlays = [];
    vp.fig = fig;
    if (fig) { figHolder.add(fig.root); buildShells(); if (mode !== "shaded") vp.setViewMode(mode); vp.fitShadow(); if (!keepCamera) vp.frame(); }
    vp.dirty = true;
  };
  vp.refreshShells = buildShells;
  vp.bounds = () => {
    const b = new THREE.Box3(), v = new THREE.Vector3();
    if (!vp.fig) return b;
    vp.fig.root.updateMatrixWorld(true);
    vp.fig.root.traverse((o) => {
      if (!o.isMesh || o.userData.shell || o.userData.overlay || !o.visible || o.userData.noBounds) return;
      let vis = true; o.traverseAncestors((a) => { if (!a.visible) vis = false; }); if (!vis) return;
      const pos = o.geometry.attributes.position;
      if (o.morphTargetInfluences && o.morphTargetInfluences.some((x) => x) && pos.count < 40000) { for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, v); b.expandByPoint(v.applyMatrix4(o.matrixWorld)); } }
      else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    });
    return b;
  };
  vp.fitShadow = () => {
    const b = vp.bounds(); if (b.isEmpty()) return; const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const r = Math.max(s.x, s.z);
    shadow.position.set(c.x, 0.002, c.z); shadow.scale.set(r * 1.5 + 0.3, Math.max(s.z, r * 0.5) * 1.5 + 0.3, 1);
    ground.scale.setScalar(Math.max(1.5, r * 1.7));
  };
  vp.frame = (opts = {}) => {
    const b = vp.bounds(); if (b.isEmpty()) return;
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const half = Math.max(0.35, s.y * 0.5, (s.x * 0.5) / camera.aspect, s.z * 0.35);
    const dist = (half / Math.tan((camera.fov * Math.PI) / 360)) * 1.42;
    controls.target.set(c.x, c.y * 0.98, c.z);
    const az = opts.az ?? 0.35, el = opts.el ?? 0.12;
    camera.position.set(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.cos(az) * Math.cos(el) * dist);
    controls.update(); vp.dirty = true;
  };
  vp.cameraPreset = (name) => {
    const p = { front: [0, 0.08], three: [0.6, 0.15], side: [Math.PI / 2, 0.08], back: [Math.PI, 0.1], top: [0.2, 1.2] }[name] || [0.35, 0.12];
    vp.frame({ az: p[0], el: p[1] });
  };
  vp.orbitBy = (dAz, dEl, zoom = 1) => {
    const off = camera.position.clone().sub(controls.target); const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dAz; sph.phi = Math.min(Math.max(0.1, sph.phi - dEl), Math.PI * 0.62); sph.radius = Math.min(14, Math.max(0.4, sph.radius * zoom));
    camera.position.copy(controls.target).add(off.setFromSpherical(sph)); controls.update(); vp.dirty = true;
  };
  vp.setMirror = (on) => { figHolder.scale.x = on ? -1 : 1; vp.mirrored = !!on; vp.dirty = true; };
  vp.setTurntable = (on) => { controls.autoRotate = on && !reduceMotion; vp.dirty = true; };
  vp.turntable = () => controls.autoRotate;
  controls.addEventListener("change", () => { vp.dirty = true; });

  // ---- picking and hover
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  vp.pick = (clientX, clientY) => {
    if (!vp.fig) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = []; vp.fig.root.traverse((o) => { if (o.isMesh && !o.userData.shell && !o.userData.overlay && o.visible && o.userData.slot) list.push(o); });
    const hit = ray.intersectObjects(list, false)[0];
    return hit ? { slot: hit.object.userData.slot, point: hit.point, object: hit.object } : null;
  };
  vp.worldRay = (clientX, clientY) => { const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.clone(); };
  let moveT = 0, downX = 0, downY = 0, dragged = false;
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons) { if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) dragged = true; return; }
    const now = performance.now(); if (now - moveT < 60) return; moveT = now;
    const h = vp.pick(e.clientX, e.clientY); vp.setHighlight(h ? h.slot : null);
    canvas.style.cursor = h ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", () => vp.setHighlight(null));
  canvas.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; dragged = false; });
  canvas.addEventListener("click", (e) => { if (dragged) return; const h = vp.pick(e.clientX, e.clientY); if (h) vp.onPick?.(h); });

  // ---- sizing, visibility, loop
  const resize = () => { const w = Math.max(100, host.clientWidth), h = Math.max(100, host.clientHeight); if (canvas.width !== w || canvas.height !== h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); vp.dirty = true; } };
  new ResizeObserver(resize).observe(host); resize();
  new IntersectionObserver((es) => { vp.visible = es[es.length - 1].isIntersecting; if (vp.visible) vp.dirty = true; }).observe(host);
  let last = performance.now();
  vp.renderNow = () => {
    resize();
    const t0 = performance.now(), w = canvas.width, h = canvas.height;
    renderer.setViewport(0, 0, w, h); renderer.setScissorTest(false);
    if (fx.length) {
      renderer.setClearColor(0x000000, 0); renderer.clear();
      effects.render(scene, camera, w, h, fx, { dist: camera.position.distanceTo(controls.target), frame: effects.frame(reduceMotion) });
    } else { renderer.setClearColor(new THREE.Color(vp.bg), 1); renderer.render(scene, camera); }
    const ms = performance.now() - t0; vp.stats.renders++; vp.stats.lastMs = ms; vp.stats.avgMs = vp.stats.avgMs ? vp.stats.avgMs * 0.9 + ms * 0.1 : ms; vp.dirty = false;
  };
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden || !vp.visible) { last = now; return; }
    const dt = (now - last) / 1000;
    if (dt < 1 / FPS_CAP - 0.002) return;
    last = now; vp.stats.frames++;
    let need = vp.dirty;
    if (controls.autoRotate) { controls.update(); need = true; }
    if (vp.fig) { const step = Math.min(dt, 0.1); if (vp.fig.update(step)) need = true; }
    if (fx.length && !reduceMotion && fx.some((f) => f === "jitter" || f === "retro print")) need = true;
    if (need) vp.renderNow();
  }
  requestAnimationFrame(loop);

  // ---- thumbnails: render a figure into the corner of the shared canvas, copy to a 2D canvas, restore.
  const thumbScene = new THREE.Scene(), thumbCam = new THREE.PerspectiveCamera(30, 1, 0.05, 40), thumbLights = new THREE.Group(); thumbScene.add(thumbLights);
  (LIGHTS.soft)().forEach((l) => thumbLights.add(l));
  const tc = document.createElement("canvas");
  vp.thumb = (fig, focus = "all", size = 112, bg = "#ecebe4") => {
    thumbScene.background = new THREE.Color(bg);
    thumbScene.add(fig.root);
    fig.root.updateMatrixWorld(true);
    const frame = thumbFrame(fig, focus);
    thumbCam.position.copy(frame.pos); thumbCam.lookAt(frame.target); thumbCam.updateProjectionMatrix();
    const cw = canvas.width, ch = canvas.height; if (cw < size || ch < size) { thumbScene.remove(fig.root); return null; }
    renderer.setScissorTest(true); renderer.setViewport(0, 0, size, size); renderer.setScissor(0, 0, size, size);
    renderer.setClearColor(new THREE.Color(bg), 1); renderer.render(thumbScene, thumbCam);
    tc.width = tc.height = size; const g = tc.getContext("2d"); g.drawImage(canvas, 0, ch - size, size, size, 0, 0, size, size);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, cw, ch);
    thumbScene.remove(fig.root);
    vp.dirty = true;
    return tc.toDataURL("image/png");
  };
  function thumbFrame(fig, focus) {
    const b = new THREE.Box3(); fig.root.traverse((o) => { if (o.isMesh && !o.userData.shell) b.expandByObject(o, false); });
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    let tgt = c.clone(), rad = Math.max(s.y * 0.58, s.x * 0.8, 0.3), az = 0.5, el = 0.12;
    const J = fig.joints || {}, wp = (n) => { const o = J[n]; return o ? o.getWorldPosition(new THREE.Vector3()) : null; };
    const D = fig.D;
    if (focus === "head" && fig.head) { const hp = wp("head"); if (hp) { tgt = hp.clone().add(new THREE.Vector3(0, fig.head.cy * 0.9, 0)); rad = fig.head.ry * 1.95 + (fig.head.snout || 0) * 0.6; } else if (fig.headCenter) { tgt = fig.headCenter(); rad = fig.headRadius() * 2.4; } }
    else if (focus === "torso" && D) { const sp = wp("spine"); if (sp) { tgt = sp.clone().add(new THREE.Vector3(0, D.torsoLen * 0.5, 0)); rad = D.S * 0.5; } }
    else if (focus === "hand" && D) { const w = wp("wrist_L") || wp("ankle_LF"); if (w) { tgt = w.clone().add(new THREE.Vector3(0, -D.handR, 0)); rad = D.handR * 4; az = 0.2; } }
    else if (focus === "legs" && D) { const h = wp("hips"); if (h) { tgt = h.clone().add(new THREE.Vector3(0, -D.legLen * 0.5, 0)); rad = D.legLen * 0.72; } }
    else if (focus === "feet" && D) { const a = wp("ankle_L") || wp("ankle_LF"); if (a) { tgt = a.clone().add(new THREE.Vector3(0, D.footR * 0.2, D.footR * 0.6)); rad = D.footR * 4.2; az = 0.7; el = 0.25; } }
    else if (focus === "tail" && D) { const t = wp("tailBase"); if (t) { tgt = t.clone().add(new THREE.Vector3(0, -D.S * 0.05, -D.S * 0.2)); rad = D.S * 0.62; az = 2.3; } }
    const dist = rad / Math.sin((thumbCam.fov * Math.PI) / 360) * 0.95;
    return { target: tgt, pos: new THREE.Vector3(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z + Math.cos(az) * Math.cos(el) * dist) };
  }
  vp.snapshot = (w = 720, h = 720, { transparent = false } = {}) => {
    const cw = canvas.width, ch = canvas.height; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    vp.renderNow(); const url = canvas.toDataURL("image/png");
    renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); vp.dirty = true; return url;
  };
  vp.setRoom("studio"); vp.setLight("soft");
  return vp;
}
