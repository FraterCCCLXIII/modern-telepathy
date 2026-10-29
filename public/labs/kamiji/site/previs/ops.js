// Edits on the shot sequence that the timeline, the storyboard strip and the inspector all share.
import { makeShot, uid } from "./store.js";
import { PRESET_BY_ID } from "./catalog.js";

export function reorderShot(store, from, to) {
  const seq = store.d.seq;
  if (from === to || !seq[from]) return false;
  const moved = seq[from].shot;
  const rest = seq.filter((_, i) => i !== from);
  store.update((p) => {
    const src = p.nodes.find((n) => n.id === seq[from].node.id);
    src.shots.splice(src.shots.indexOf(moved), 1);
    if (to >= rest.length) { // after the last shot: stay with the last shot's node
      const dst = p.nodes.find((n) => n.id === rest[rest.length - 1].node.id);
      dst.shots.push(moved);
    } else {
      const target = rest[to], dst = p.nodes.find((n) => n.id === target.node.id);
      dst.shots.splice(dst.shots.findIndex((s) => s.id === target.shot.id), 0, moved);
    }
  });
  store.fix(); store.emit("all"); store.commit();
  return true;
}

export function addShot(store, nodeId) {
  const n = store.p.nodes.find((x) => x.id === nodeId);
  if (!n || n.type !== "scene") return null;
  const last = n.shots[n.shots.length - 1];
  const pr = PRESET_BY_ID.get(n.preset) || PRESET_BY_ID.get("hand-wave");
  const s = last ? { ...JSON.parse(JSON.stringify(last)), id: uid("s"), off: last.off + last.len, notes: "" } : makeShot(pr);
  store.update((p) => p.nodes.find((x) => x.id === nodeId).shots.push(s));
  store.selectShot(s.id); store.commit();
  return s;
}

export function deleteShot(store, shotId) {
  const seq = store.d.seq, i = seq.findIndex((s) => s.shot.id === shotId);
  if (i < 0) return false;
  const next = seq[i + 1] || seq[i - 1];
  store.update((p) => { const n = p.nodes.find((x) => x.id === seq[i].node.id); n.shots = n.shots.filter((s) => s.id !== shotId); p.script.lines.forEach((l) => { if (l.shot === shotId) l.shot = null; }); });
  store.sel.shot = null; store.fix();
  if (next) store.sel.shot = next.shot.id;
  store.emit("all"); store.commit();
  return true;
}

// "Camera move" labels fill in the B keyframe relative to A so the label and the camera agree.
export function applyMove(shot, move) {
  const a = shot.cam.a, b = { p: a.p.slice(), t: a.t.slice(), fov: a.fov };
  const dir = [a.t[0] - a.p[0], a.t[1] - a.p[1], a.t[2] - a.p[2]], len = Math.hypot(...dir) || 1;
  const u = dir.map((v) => v / len);
  const side = [u[2], 0, -u[0]]; // horizontal vector to the camera's right
  const sl = Math.hypot(side[0], side[2]) || 1; side[0] /= sl; side[2] /= sl;
  switch (move) {
    case "Push in": b.p = a.p.map((v, i) => v + u[i] * len * 0.35); break;
    case "Pull out": b.p = a.p.map((v, i) => v - u[i] * len * 0.4); break;
    case "Pan": b.t = a.t.map((v, i) => v + side[i] * len * 0.35); break;
    case "Track": b.p = a.p.map((v, i) => v + side[i] * len * 0.35); b.t = a.t.map((v, i) => v + side[i] * len * 0.35); break;
    case "Crane up": b.p = [a.p[0], a.p[1] + len * 0.5, a.p[2]]; break;
    case "Orbit": { const r = [a.p[0] - a.t[0], a.p[2] - a.t[2]], ang = 0.7, c = Math.cos(ang), s = Math.sin(ang); b.p = [a.t[0] + r[0] * c - r[1] * s, a.p[1], a.t[2] + r[0] * s + r[1] * c]; break; }
    default: break;
  }
  shot.cam.b = b; shot.move = move;
}

// Move a scene to just before / after another by rewiring the cut edges (straight chains only).
export function reorderScene(store, id, targetId, after = false) {
  const flow = (n) => n && (n.type === "scene" || n.type === "branch"), byId = (i) => store.p.nodes.find((n) => n.id === i);
  const fe = (e) => flow(byId(e.from)) && flow(byId(e.to));
  if (id === targetId) return { ok: false, why: "Drop it on a different scene." };
  const ins = store.p.edges.filter((e) => e.to === id && fe(e)), outs = store.p.edges.filter((e) => e.from === id && fe(e));
  const tIns = store.p.edges.filter((e) => e.to === targetId && fe(e)), tOuts = store.p.edges.filter((e) => e.from === targetId && fe(e));
  if (ins.length > 1 || outs.length > 1 || tIns.length > 1 || tOuts.length > 1) return { ok: false, why: "Reordering works on straight chains. Rewire branches on the map." };
  if (!after && tIns[0]?.from === id || after && tOuts[0]?.to === id) return { ok: false, why: "Already there." };
  const edge = (a, b) => ({ id: uid("e"), from: a, to: b, kind: "cut" });
  store.update((p) => {
    const prev = ins[0]?.from, next = outs[0]?.to;
    p.edges = p.edges.filter((e) => !(fe(e) && (e.to === id || e.from === id)));
    if (prev && next && prev !== next) p.edges.push(edge(prev, next));
    const tIn = p.edges.find((e) => e.to === targetId && fe(e)), tOut = p.edges.find((e) => e.from === targetId && fe(e));
    if (!after) { if (tIn) { p.edges = p.edges.filter((e) => e !== tIn); p.edges.push(edge(tIn.from, id)); } p.edges.push(edge(id, targetId)); }
    else { if (tOut) { p.edges = p.edges.filter((e) => e !== tOut); p.edges.push(edge(id, tOut.to)); } p.edges.push(edge(targetId, id)); }
  });
  store.fix(); store.emit("all"); store.commit();
  return { ok: true };
}
