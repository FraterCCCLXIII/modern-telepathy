// Drag a main model to spin it. Used by the hero viewers on the Kamiji, Kamikin, Hands and Kosmos pages.
// A page calls enableSpin(viewer) once, sets viewer.orbit when it frames a model (centre, distance, lift),
// and calls applyOrbit(viewer) just before it renders. The camera orbits the model, so the lights stay put.
// Release lets it coast. When you are not dragging, the model turns to face the mouse; with no mouse
// (touch, or the pointer left the window) it eases back to the front.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function enableSpin(v, { pitchLimit = 0.5, followAfterMs = 1100, followYaw = 0.6, followPitch = 0.3 } = {}) {
  const el = v.el;
  v.yaw = 0;
  v.pitch = 0;
  let drag = null, vYaw = 0, lastMove = 0, idleSince = performance.now(), running = false;
  const mouse = { x: 0, y: 0, active: false };
  el.classList.add("spinnable");
  if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
  el.setAttribute("aria-roledescription", "3D model you can turn by dragging or with the arrow keys");

  const touch = () => { idleSince = performance.now(); };
  running = true; requestAnimationFrame(loop);
  function loop() {
    if (document.hidden || v.near === false) { requestAnimationFrame(loop); return; }
    if (!drag) {
      if (Math.abs(vYaw) > 0.0004) {
        v.yaw += vYaw; vYaw *= 0.93; v.dirty = true; idleSince = performance.now();
      } else if (!reduceMotion && performance.now() - idleSince > followAfterMs) {
        // Not being moved by hand: face the mouse, or the front when there is no mouse.
        let ty = 0, tp = 0;
        if (mouse.active) {
          const r = el.getBoundingClientRect();
          const dx = clamp((mouse.x - (r.left + r.width / 2)) / (innerWidth * 0.5), -1, 1);
          const dy = clamp((mouse.y - (r.top + r.height / 2)) / (innerHeight * 0.5), -1, 1);
          ty = -dx * followYaw; tp = clamp(dy * followPitch, -pitchLimit, pitchLimit);
        }
        const d = v.yaw - ty;
        v.yaw = ty + (d - Math.round(d / TAU) * TAU); // shortest way round
        if (Math.abs(ty - v.yaw) > 0.0015 || Math.abs(tp - v.pitch) > 0.0015) {
          v.yaw += (ty - v.yaw) * 0.09; v.pitch += (tp - v.pitch) * 0.09; v.dirty = true;
        }
      }
    }
    requestAnimationFrame(loop);
  }
  if (!reduceMotion) {
    addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.active = false; });
    document.documentElement.addEventListener("mouseleave", () => { mouse.active = false; });
  }

  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY }; vYaw = 0; lastMove = performance.now();
    el.setPointerCapture?.(e.pointerId); el.classList.add("spinning"); touch();
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    v.yaw -= dx * 0.012; v.pitch = clamp(v.pitch + dy * 0.006, -pitchLimit, pitchLimit);
    vYaw = reduceMotion ? 0 : -dx * 0.012 * 0.9; lastMove = performance.now(); v.dirty = true; idleSince = performance.now();
  });
  const end = () => { if (!drag) return; if (performance.now() - lastMove > 90) vYaw = 0; drag = null; el.classList.remove("spinning"); touch(); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -0.3, ArrowRight: 0.3 }[e.key];
    if (step !== undefined) { v.yaw += step; v.dirty = true; touch(); e.preventDefault(); }
    if (e.key === "Home" || e.key === "Escape") { v.yaw = Math.round(v.yaw / TAU) * TAU; v.pitch = 0; v.dirty = true; touch(); }
  });
}

// Put the camera on its orbit. v.orbit = { cx, cy, cz, dist, lift } is set where the page frames the model.
export function applyOrbit(v) {
  const o = v.orbit;
  if (!o) return;
  const yaw = v.yaw || 0, p = v.pitch || 0;
  v.camera.position.set(
    o.cx + Math.sin(yaw) * Math.cos(p) * o.dist,
    o.cy + (o.lift || 0) + Math.sin(p) * o.dist,
    o.cz + Math.cos(yaw) * Math.cos(p) * o.dist,
  );
  v.camera.lookAt(o.cx, o.cy, o.cz);
}
