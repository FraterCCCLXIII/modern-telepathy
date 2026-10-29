// Procedural animation clips for the rigged procedural figures. Quaternion/position tracks on the bones, so the same
// clips play in the viewport (AnimationMixer) and export into the GLB (GLTFExporter animations).
import { THREE } from "./geo.js";

export function makeClips(fig) {
  const J = fig.joints, up = fig.upright, legs = fig.legNames, D = fig.D, S = D.S;
  const FPS = 20;
  const restQ = {}, restP = {};
  for (const [n, b] of Object.entries(J)) { restQ[n] = b.quaternion.clone(); restP[n] = b.position.clone(); }
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const tail = Object.keys(J).filter((k) => /^tail\d+$/.test(k));
  const phaseOf = (n) => (up ? (n[0] === "L" ? 0 : Math.PI) : (n === "LF" || n === "RB" || n === "RM" ? 0 : Math.PI));
  // pose helpers: r(name, x, y, z) adds an Euler delta; p(name, dx, dy, dz) adds a position delta
  function clip(name, dur, fn, loop = true) {
    const n = Math.max(2, Math.round(dur * FPS)), frames = [];
    for (let i = 0; i <= n; i++) {
      const u = loop && i === n ? 0 : i / n, pose = { r: {}, p: {} };
      const w = u * Math.PI * 2;
      fn(u, w, { r: (k, x = 0, y = 0, z = 0) => { if (!J[k]) return; const o = pose.r[k] || (pose.r[k] = [0, 0, 0]); o[0] += x; o[1] += y; o[2] += z; }, p: (k, x = 0, y = 0, z = 0) => { if (!J[k]) return; const o = pose.p[k] || (pose.p[k] = [0, 0, 0]); o[0] += x; o[1] += y; o[2] += z; } });
      frames.push(pose);
    }
    const times = frames.map((_, i) => i / FPS * (dur / (n / FPS)));
    const rk = new Set(), pk = new Set();
    frames.forEach((f) => { Object.keys(f.r).forEach((k) => rk.add(k)); Object.keys(f.p).forEach((k) => pk.add(k)); });
    const tracks = [];
    for (const k of rk) {
      const vals = [];
      frames.forEach((f) => { const d = f.r[k] || [0, 0, 0]; e.set(d[0], d[1], d[2], "XYZ"); q.setFromEuler(e); q.premultiply(restQ[k]); vals.push(q.x, q.y, q.z, q.w); });
      tracks.push(new THREE.QuaternionKeyframeTrack(k + ".quaternion", times, vals));
    }
    for (const k of pk) {
      const vals = [];
      frames.forEach((f) => { const d = f.p[k] || [0, 0, 0]; vals.push(restP[k].x + d[0], restP[k].y + d[1], restP[k].z + d[2]); });
      tracks.push(new THREE.VectorKeyframeTrack(k + ".position", times, vals));
    }
    return new THREE.AnimationClip(name, dur, tracks);
  }
  const sway = (P, w, amp = 0.15, k = 1) => tail.forEach((t, i) => P.r(t, 0, Math.sin(w * k - i * 0.6) * amp, 0));
  const wings = (P, w, amp, off = 0) => { P.r("wing_L", 0, 0, Math.sin(w + off) * amp); P.r("wing_R", 0, 0, -Math.sin(w + off) * amp); };
  const out = [];

  out.push(clip("idle", 3, (u, w, P) => {
    P.r("spine", Math.sin(w) * 0.02, 0, 0); P.r("head", Math.sin(w + 1) * 0.02, Math.sin(w) * 0.1, 0); P.p("hips", 0, Math.sin(w * 2) * 0.004 * S, 0);
    P.r("shoulder_L", 0, 0, Math.sin(w) * 0.02); P.r("shoulder_R", 0, 0, -Math.sin(w) * 0.02);
    sway(P, w, 0.12); wings(P, w, 0.08);
  }));

  out.push(clip("wave", 1.6, (u, w, P) => {
    P.r("head", 0, 0.1, Math.sin(w) * 0.05); P.r("spine", 0, -0.06, 0); sway(P, w * 2, 0.25);
    if (up) { P.r("shoulder_R", 0, 0, -2.45); P.r("elbow_R", 0, 0, -0.5 + Math.sin(w * 3) * 0.55); P.r("shoulder_L", 0, 0, Math.sin(w) * 0.03); }
    else { P.r("hip_RF", -1.0 + Math.sin(w * 3) * 0.3, 0, 0); P.r("knee_RF", 0.9, 0, 0); P.r("head", -0.1, 0, 0); }
    wings(P, w * 2, 0.15);
  }));

  const gait = (name, dur, amp, lean, arm) => out.push(clip(name, dur, (u, w, P) => {
    P.r("spine", lean, Math.sin(w) * 0.1, 0); P.r("head", -lean * 0.6, -Math.sin(w) * 0.06, 0); P.p("hips", 0, Math.cos(w * 2) * 0.012 * S * (amp * 2), 0);
    for (const n of legs) { const ph = phaseOf(n); const s = Math.sin(w + ph); P.r("hip_" + n, s * amp, 0, 0); P.r("knee_" + n, Math.max(0, Math.sin(w + ph + 1.6)) * amp * 1.4, 0, 0); P.r("ankle_" + n, -Math.max(0, s) * amp * 0.3, 0, 0); }
    if (up) for (const s of ["L", "R"]) { const ph = s === "L" ? Math.PI : 0; P.r("shoulder_" + s, Math.sin(w + ph) * amp * 0.8, 0, 0); P.r("elbow_" + s, -arm - 0.2 * Math.sin(w + ph), 0, 0); }
    sway(P, w, 0.2, 2); wings(P, w * 2, 0.25);
  }));
  gait("walk", 1.0, 0.5, 0.04, 0.25);
  gait("run", 0.6, 0.95, 0.22, 1.3);

  out.push(clip("jump", 1.3, (u, w, P) => {
    const crouch = u < 0.2 ? Math.sin((u / 0.2) * Math.PI / 2) : u < 0.3 ? 1 - (u - 0.2) / 0.1 : 0;
    const air = u > 0.25 && u < 0.85 ? Math.sin(((u - 0.25) / 0.6) * Math.PI) : 0;
    const land = u >= 0.85 ? Math.sin(((u - 0.85) / 0.15) * Math.PI) * 0.6 : 0;
    const bend = Math.max(crouch, land);
    P.p("hips", 0, -0.2 * S * bend + 0.4 * S * air, 0);
    for (const n of legs) { P.r("hip_" + n, -bend * 0.9 + air * 0.25, 0, 0); P.r("knee_" + n, bend * 1.5 - air * 0.3, 0, 0); P.r("ankle_" + n, bend * -0.5, 0, 0); }
    if (up) { P.r("shoulder_L", -air * 0.6 + bend * 0.7, 0, air * 2.2); P.r("shoulder_R", -air * 0.6 + bend * 0.7, 0, -air * 2.2); }
    P.r("spine", bend * 0.3, 0, 0); wings(P, w * 3, 0.5 * air + 0.1); sway(P, w, 0.3);
  }));

  out.push(clip("cheer", 1.2, (u, w, P) => {
    P.p("hips", 0, Math.abs(Math.sin(w * 2)) * 0.05 * S, 0); P.r("head", -0.2, Math.sin(w) * 0.2, 0); P.r("spine", -0.05, 0, 0);
    if (up) { P.r("shoulder_L", 0, 0, 2.7 + Math.sin(w * 2) * 0.15); P.r("shoulder_R", 0, 0, -2.7 - Math.sin(w * 2) * 0.15); P.r("elbow_L", 0, 0, Math.sin(w * 2) * 0.3); P.r("elbow_R", 0, 0, -Math.sin(w * 2) * 0.3); }
    else { for (const n of legs.filter((x) => x.endsWith("F"))) P.r("hip_" + n, -1.2 + Math.sin(w * 2) * 0.2, 0, 0); P.r("spine", -0.35, 0, 0); }
    for (const n of legs) { P.r("knee_" + n, Math.abs(Math.sin(w * 2)) * 0.3, 0, 0); }
    sway(P, w * 2, 0.3); wings(P, w * 4, 0.4);
  }));

  out.push(clip("sit", 3, (u, w, P) => {
    if (up) {
      const drop = D.shin + D.ankleH + D.rLeg - D.legLen;
      P.p("hips", 0, drop, 0);
      for (const n of legs) { P.r("hip_" + n, -1.45, 0, 0); P.r("knee_" + n, 1.45, 0, 0); P.r("ankle_" + n, 0, 0, 0); }
      P.r("shoulder_L", -0.5, 0, 0); P.r("shoulder_R", -0.5, 0, 0); P.r("elbow_L", -0.9, 0, 0); P.r("elbow_R", -0.9, 0, 0);
    } else {
      P.p("hips", 0, -D.legLen * 0.45, 0); P.r("spine", 0.35, 0, 0);
      for (const n of legs.filter((x) => x.endsWith("B"))) { P.r("hip_" + n, -1.1, 0, 0); P.r("knee_" + n, 1.5, 0, 0); }
    }
    P.r("spine", Math.sin(w) * 0.015, 0, 0); P.r("head", 0, Math.sin(w) * 0.08, 0); sway(P, w, 0.1);
  }));

  out.push(clip("tpose", 1, (u, w, P) => {
    if (up) { P.r("shoulder_L", 0, 0, Math.PI / 2 - 0.1); P.r("shoulder_R", 0, 0, -(Math.PI / 2 - 0.1)); }
    else for (const n of legs) P.r("hip_" + n, 0, 0, 0);
    P.r("hips", 0, 0, 0);
  }, false));
  return out;
}
