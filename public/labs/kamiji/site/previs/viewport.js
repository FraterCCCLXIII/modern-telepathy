// The big viewport: orbit camera in "free" mode, keyframed camera in "shot" mode.
import { timecode } from "./store.js";
import { el, clamp } from "./ui.js";
import { CAM_PRESETS } from "./catalog.js";

export async function createViewport({ store, stage, transport, root, onUserOrbit, reduceMotion }) {
  const stageEl = root.querySelector(".pv-view-stage"), canvas = root.querySelector(".pv-view-canvas");
  const hud = root.querySelector(".pv-view-hud"), msg = root.querySelector(".pv-view-msg"), presetsEl = root.querySelector(".pv-cam-presets");
  const modeBtn = root.querySelector("[data-act=mode]");
  const api = { mode: "free", visible: true, dirty: true, fps: 0 };
  let lastCam = null, freeCam = null, shotCam = null, controls = null, lastShotId = null, clock = 0, lastTarget = null, lastKey = "";
  if (stage) {
    const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
    freeCam = stage.camera(); shotCam = stage.camera();
    controls = new OrbitControls(freeCam, canvas);
    controls.enableDamping = false; controls.screenSpacePanning = true; controls.minDistance = 0.4; controls.maxDistance = 30;
    controls.addEventListener("change", () => { api.dirty = true; });
    canvas.addEventListener("pointerdown", () => { if (api.mode === "shot" || transport.playing) { onUserOrbit?.(); setMode("free", true); } }, true);
    canvas.addEventListener("wheel", () => { if (api.mode === "shot") { onUserOrbit?.(); setMode("free", true); } }, { capture: true, passive: true });
  }
  const io = new IntersectionObserver((e) => { api.visible = e[e.length - 1].isIntersecting; api.dirty = true; });
  io.observe(stageEl);

  function setMode(m, keepCurrent = false) {
    if (m === "free" && api.mode === "shot" && keepCurrent && shotCam) { // continue from what the shot camera shows right now
      freeCam.position.copy(shotCam.position); freeCam.fov = shotCam.fov; freeCam.updateProjectionMatrix();
      if (lastTarget) controls.target.copy(lastTarget); controls.update();
    }
    api.mode = m; api.onMode?.(m); modeBtn?.setAttribute("aria-pressed", m === "shot" ? "true" : "false"); if (modeBtn) modeBtn.textContent = m === "shot" ? "Shot camera" : "Free camera";
    api.dirty = true;
  }
  const entry = () => {
    const sel = store.sel;
    if ((transport.playing || transport.scrubbing || api.mode === "shot") && transport.total) { const e = transport.entryAt(); if (e) return e; }
    const e = store.d.seq.find((s) => s.shot.id === sel.shot); if (e) return e;
    const n = store.p.nodes.find((x) => x.id === sel.nodes[0] && x.type === "scene");
    return n ? { node: n, shot: n.shots[0] || null, start: 0, len: 48, n: 0 } : null;
  };
  function syncFreeToShot(shot, node) {
    if (!freeCam) return;
    const k = shot?.cam.a; if (!k) return;
    freeCam.position.fromArray(k.p); freeCam.fov = k.fov; freeCam.updateProjectionMatrix(); controls.target.fromArray(k.t); controls.update(); api.dirty = true;
  }
  function currentKey() {
    const r = (v) => Math.round(v * 1000) / 1000;
    if (api.mode === "shot" && lastTarget) return { p: shotCam.position.toArray().map(r), t: lastTarget.toArray().map(r), fov: r(shotCam.fov) };
    return { p: freeCam.position.toArray().map(r), t: controls.target.toArray().map(r), fov: r(freeCam.fov) };
  }
  function applyKeyToFree(k) { if (!freeCam) return; setMode("free"); freeCam.position.fromArray(k.p); freeCam.fov = k.fov; freeCam.updateProjectionMatrix(); controls.target.fromArray(k.t); controls.update(); api.dirty = true; }
  function applyPreset(name) {
    const e = entry(); if (!e || !stage) return;
    applyKeyToFree(stage.presetKey(stage.instance(e.node), name));
  }
  CAM_PRESETS.forEach((n) => presetsEl?.append(el("button", { class: "pv-btn pv-btn-sm", type: "button", text: n, "data-preset": n, onclick: () => applyPreset(n) })));
  modeBtn?.addEventListener("click", () => { if (api.mode === "free") { setMode("shot"); } else setMode("free", true); });

  // keyboard orbit when the stage has focus
  stageEl.addEventListener("keydown", (e) => {
    if (!controls || e.altKey || e.metaKey || e.ctrlKey) return;
    const k = e.key, off = freeCam.position.clone().sub(controls.target);
    const sph = new stage.THREE.Spherical().setFromVector3(off);
    let used = true;
    if (api.mode === "shot") setMode("free", true);
    if (k === "ArrowLeft") sph.theta -= 0.12; else if (k === "ArrowRight") sph.theta += 0.12;
    else if (k === "ArrowUp") sph.phi = clamp(sph.phi - 0.1, 0.1, 3.04); else if (k === "ArrowDown") sph.phi = clamp(sph.phi + 0.1, 0.1, 3.04);
    else if (k === "+" || k === "=") sph.radius *= 0.9; else if (k === "-" || k === "_") sph.radius *= 1.1;
    else if (k === "0") { const en = entry(); if (en) syncFreeToShot(en.shot, en.node); return; } else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); off.setFromSpherical(sph); freeCam.position.copy(controls.target).add(off); controls.update(); api.dirty = true; }
  });

  // one render call per tick, from the scheduler
  api.render = (now, dt) => {
    if (!stage || !api.visible) return false;
    const e = entry();
    if (!e) { if (hud.firstChild) { hud.textContent = ""; lastKey = ""; canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); } msg.textContent = store.p.nodes.length ? "Select a scene node to see it here." : "Add a scene in the map to see it here."; msg.hidden = false; return false; }
    const inst = stage.instance(e.node);
    if (inst.state !== "ready") { msg.textContent = inst.state === "error" ? "3D unavailable for this scene." : "Loading model"; msg.hidden = false; hudUpdate(e, 0); return false; }
    msg.hidden = true;
    const shot = e.shot, id = shot?.id || e.node.id;
    if (id !== lastShotId) { lastShotId = id; syncFreeToShot(shot, e.node); api.dirty = true; }
    const animating = transport.playing || (api.mode === "free" && !reduceMotion);
    if (!animating && !api.dirty) return false;
    const fps = store.p.fps; let t, camToUse;
    if (api.mode === "shot" && shot) {
      const local = clamp(transport.frame - e.start, 0, e.len);
      t = (shot.off + local) / fps;
      lastTarget = stage.camAt(shotCam, shot.cam, e.len > 1 ? local / (e.len - 1) : 0); camToUse = shotCam;
    } else {
      if (!reduceMotion) clock += dt; t = (shot ? shot.off / fps : 0) + clock; camToUse = freeCam;
    }
    inst.setTime(t); lastCam = camToUse;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(Math.min(960, Math.max(160, stageEl.clientWidth * dpr))), H = Math.round(W * 9 / 16);
    stage.draw(inst, camToUse, canvas, W, H);
    api.dirty = false; api.renders = (api.renders || 0) + 1;
    hudUpdate(e, t);
    return true;
  };
  function hudUpdate(e, t) {
    const s = e.shot, fps = store.p.fps;
    const key = [e.node.name, s?.id, s?.type, Math.floor(transport.frame), api.mode].join("|");
    if (key === lastKey) return; lastKey = key;
    hud.textContent = "";
    hud.append(el("span", { class: "pv-hud-a", text: e.node.name }), el("span", { class: "pv-hud-b", text: s ? `Shot ${e.n || "-"} · ${s.type} · ${api.mode === "shot" ? timecode(transport.frame, fps) : "free orbit"}` : "no shots" }));
    stageEl.setAttribute("aria-label", `3D viewport: ${e.node.name}. ${e.node.props.cast.map((c) => c.ref.replace(/^.*\//, "") + (c.anim ? " (" + c.anim + ")" : "")).join(", ")}. Arrow keys orbit, plus and minus zoom, 0 resets to the shot camera.`);
  }
  store.on((scope) => { api.dirty = true; if (scope === "sel") { const e = entry(); if (e && api.mode === "free") { /* shot change handled in render */ } } });
  // screen position of a character's head inside the viewport (for the bubble subtitle tail)
  api.headScreen = (ref, nodeId) => { const n = store.p.nodes.find((x) => x.id === nodeId && x.type === "scene"); if (!stage || !lastCam || !n) return null; return stage.headScreen(stage.instance(n), lastCam, ref, stageEl.clientWidth, stageEl.clientHeight); };
  return Object.assign(api, { setMode, currentKey, applyKeyToFree, syncFreeToShot, applyPreset, entry, get target() { return controls?.target; },
    resize() { api.dirty = true; } });
}
