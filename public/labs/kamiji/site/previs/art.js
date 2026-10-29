// Artboard model: the sub-node graph inside every scene node. This is the single source of truth for what a scene shows.
// node.art = { nodes: [sub], edges: [{ id, from, fp, to, tp }] }; node.props is a DERIVED cache (compile) used by the renderer.
import { CHAR_BY_ID, PRESET_BY_ID } from "./catalog.js";

export const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));

export const SUB_TYPES = ["model", "content", "control", "script", "camera", "light", "audio", "other", "output"];
export const SUB_LABEL = { model: "Model", content: "Content", control: "Control", script: "Script", camera: "Camera", light: "Light", audio: "Audio", other: "Other", output: "Scene output" };
export const CONTENT_KINDS = ["character", "prop", "shape", "accessory", "background"];
export const CONTROL_KINDS = { clip: "Animation clip", expression: "Expression", mouth: "Mouth", effects: "Effects", morph: "Morph / face" };
export const CONTROL_RENDERED = { clip: true }; // the other control kinds are stored but not rendered yet (stub)
export const OTHER_KINDS = { note: "Note", group: "Group frame", reference: "Reference image" };

// Port types, shape-coded in the UI (no colour): see DESIGN.md.
export const PORT_TYPES = {
  model: { label: "Model", shape: "square" }, entity: { label: "Entity", shape: "circle" }, ctrl: { label: "Control", shape: "diamond" },
  text: { label: "Script", shape: "triangle" }, attach: { label: "Attachment", shape: "cross" }, cam: { label: "Camera", shape: "pill" },
  light: { label: "Light", shape: "ring" }, audio: { label: "Audio", shape: "hex" }, link: { label: "Reference", shape: "dot" },
};

export function portsOf(n) {
  const P = (id, type, label, max) => ({ id, type, label, max });
  switch (n.type) {
    case "model": return { in: [], out: [P("out", "model", "model")] };
    case "content":
      if (n.kind === "accessory") return { in: [], out: [P("out", "attach", "attach")] };
      if (n.kind === "background") return { in: [P("refs", "link", "refs")], out: [P("out", "entity", "scene")] };
      if (n.kind === "character") return { in: [P("model", "model", "model", 1), P("ctrl", "ctrl", "control"), P("text", "text", "script"), P("attach", "attach", "attach"), P("refs", "link", "refs")], out: [P("out", "entity", "scene")] };
      return { in: [P("model", "model", "model", 1), P("ctrl", "ctrl", "control"), P("refs", "link", "refs")], out: [P("out", "entity", "scene")] };
    case "control": return { in: [], out: [P("out", "ctrl", "control")] };
    case "script": return { in: [], out: [P("out", "text", "script")] };
    case "camera": return { in: [], out: [P("out", "cam", "camera")] };
    case "light": return { in: [], out: [P("out", "light", "light", 1)] };
    case "audio": return { in: [], out: [P("out", "audio", "audio")] };
    case "other": return n.kind === "group" ? { in: [], out: [] } : { in: [], out: [P("out", "link", "ref")] };
    case "output": return { in: [P("scene", "entity", "scene"), P("cam", "cam", "camera"), P("light", "light", "light", 1), P("audio", "audio", "audio"), P("refs", "link", "refs")], out: [] };
    default: return { in: [], out: [] };
  }
}
export function subSize(n) {
  switch (n.type) {
    case "model": return [204, 158];
    case "content": return n.kind === "character" ? [224, 196] : n.kind === "accessory" || n.kind === "background" ? [208, 92] : [224, 172];
    case "control": return [196, 88];
    case "script": return [236, 148];
    case "camera": return [212, 132];
    case "light": return [176, 88];
    case "audio": return [196, 88];
    case "other": return n.kind === "group" ? [Math.max(160, n.w || 320), Math.max(100, n.h || 200)] : n.kind === "reference" ? [196, 136] : [196, 112];
    case "output": return [248, 206];
    default: return [200, 100];
  }
}
// Port anchors in card coordinates (card-local). Ports stack down the left (inputs) and right (outputs) edges.
export function portOffset(n, side, id) {
  const p = portsOf(n), list = side === "in" ? p.in : p.out, i = Math.max(0, list.findIndex((x) => x.id === id));
  const [w] = subSize(n);
  const y0 = n.type === "output" ? 56 : 54;
  return [side === "in" ? 0 : w, y0 + i * 24];
}

// ---- typed connection rules ----------------------------------------------------------------------------
// Returns { ok, reason }. The reason is shown to the user when a connection is refused.
export function canConnect(art, from, fp, to, tp) {
  if (from.id === to.id) return { ok: false, reason: "A node cannot connect to itself." };
  const o = portsOf(from).out.find((p) => p.id === fp), i = portsOf(to).in.find((p) => p.id === tp);
  if (!o) return { ok: false, reason: `${SUB_LABEL[from.type]} has no output there.` };
  if (!i) return { ok: false, reason: `${SUB_LABEL[from.type]} (${PORT_TYPES[o.type].label.toLowerCase()}) cannot connect to ${SUB_LABEL[to.type]}: it has no matching input.` };
  if (o.type !== i.type) return { ok: false, reason: `${PORT_TYPES[o.type].label} output does not fit a ${PORT_TYPES[i.type].label.toLowerCase()} input. ${hint(o.type)}` };
  if (art.edges.some((e) => e.from === from.id && e.fp === fp && e.to === to.id && e.tp === tp)) return { ok: false, reason: "Already connected." };
  if (i.max && art.edges.filter((e) => e.to === to.id && e.tp === tp).length >= i.max) return { ok: false, reason: `${SUB_LABEL[to.type]} takes only ${i.max} ${PORT_TYPES[i.type].label.toLowerCase()} connection. Remove the existing one first.` };
  return { ok: true, reason: "" };
}
const hint = (t) => ({ model: "Models feed Content.", ctrl: "Controls feed Content.", text: "Scripts feed a character.", attach: "Accessories attach to a character.", entity: "Content feeds the Scene output.", cam: "Cameras feed the Scene output.", light: "Lights feed the Scene output.", audio: "Audio feeds the Scene output.", link: "References attach to Content or the Scene output." })[t] || "";
// the first input port on `to` that accepts what `from.fp` sends, or null
export function pickPort(art, from, fp, to) {
  const o = portsOf(from).out.find((p) => p.id === fp); if (!o) return null;
  for (const i of portsOf(to).in) if (i.type === o.type && canConnect(art, from, fp, to, i.id).ok) return i.id;
  return portsOf(to).in.find((i) => i.type === o.type)?.id || null;
}

// ---- derived helpers -------------------------------------------------------------------------------------
export const subById = (art, id) => art.nodes.find((n) => n.id === id);
export const inputsOf = (art, id, tp) => art.edges.filter((e) => e.to === id && (!tp || e.tp === tp)).map((e) => subById(art, e.from)).filter(Boolean);
export const outputsOf = (art, id) => art.edges.filter((e) => e.from === id).map((e) => subById(art, e.to)).filter(Boolean);
export const outputNode = (art) => art.nodes.find((n) => n.type === "output");
export const effectiveRef = (art, c) => inputsOf(art, c.id, "model").find((m) => m.type === "model")?.ref || c.ref || "kamiji";
export function charRefOfScript(art, s) { const c = outputsOf(art, s.id).find((n) => n.type === "content" && n.kind === "character"); return c ? effectiveRef(art, c) : s.char || "narrator"; }

// one entry of the cast list for a Content node: what the renderer needs to draw it
export function castEntry(art, c) {
  const ctl = inputsOf(art, c.id, "ctrl").filter((x) => x.type === "control" && x.kind === "clip").pop();
  const acc = inputsOf(art, c.id, "attach").find((x) => x.type === "content" && x.kind === "accessory");
  return { ref: effectiveRef(art, c), anim: ctl?.value || "", acc: acc?.acc || "" };
}
// what a card preview should draw, or null when the sub-node has no 3D preview
export function previewCast(art, sub) {
  if (sub.type === "model") return [{ ref: sub.ref, anim: "", acc: "" }];
  if (sub.type === "content" && !["accessory", "background"].includes(sub.kind)) return [castEntry(art, sub)];
  return null;
}
// art -> props (what the renderer consumes). Everything shown on the story map and the viewport is decided here.
export function compile(node) {
  if (node.type !== "scene" || !node.art) return;
  const art = node.art, out = outputNode(art);
  const fed = out ? art.edges.filter((e) => e.to === out.id && e.tp === "scene").map((e) => subById(art, e.from)).filter(Boolean) : [];
  const cast = [];
  let bg = null;
  for (const c of fed) {
    if (c.type !== "content") continue;
    if (c.kind === "background") { bg ||= c.color || "#e7e6e1"; continue; }
    if (c.kind === "accessory") continue;
    cast.push(castEntry(art, c));
  }
  const lightN = out ? art.edges.filter((e) => e.to === out.id && e.tp === "light").map((e) => subById(art, e.from)).find((n) => n?.type === "light") : null;
  node.props = { cast, bg: bg || "#e7e6e1", light: lightN?.preset || "soft" };
}
// sub-nodes with a path to the Scene output (the rest are "not in the scene")
export function reachable(art) {
  const out = outputNode(art), seen = new Set(); if (!out) return seen;
  const stack = [out.id]; while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); for (const e of art.edges) if (e.to === id) stack.push(e.from); }
  return seen;
}

// make sure every shot has a Camera sub-node (bound by shot id) and no camera points at a deleted shot
export function syncCameras(node) {
  if (node.type !== "scene" || !node.art) return;
  const art = node.art, out = outputNode(art); if (!out) return;
  const ids = new Set(node.shots.map((s) => s.id));
  for (const c of art.nodes.filter((n) => n.type === "camera" && !ids.has(n.shot))) removeSub(art, c.id);
  const have = new Set(art.nodes.filter((n) => n.type === "camera").map((n) => n.shot));
  let k = 0;
  for (const s of node.shots) if (!have.has(s.id)) {
    const base = art.nodes.filter((n) => n.type === "camera").length + k++;
    const cam = { id: uid("c"), type: "camera", x: out.x - 300, y: out.y + 240 + base * 150, shot: s.id };
    art.nodes.push(cam); art.edges.push({ id: uid("x"), from: cam.id, fp: "out", to: out.id, tp: "cam" });
  }
}

export function removeSub(art, id) { art.nodes = art.nodes.filter((n) => n.id !== id); art.edges = art.edges.filter((e) => e.from !== id && e.to !== id); }

// ---- building an artboard from the old flat properties (migration) and from presets ----------------------
export function kindOfRef(ref) {
  const d = CHAR_BY_ID.get(ref); if (!d) return "prop";
  return d.morph ? "shape" : d.rigged ? "character" : "prop";
}
export const defaultLabel = (ref) => { const d = CHAR_BY_ID.get(ref); const s = String(ref || "").split("/").pop(); return ref === "kamiji" ? "Kamiji hand" : ref === "morph" ? "Shapes" : (d?.label || s).replace(/^(Kamikin|Rubbernose) /, "").replace(/^./, (c) => c.toUpperCase()); };

export function artFromProps(props, shots) {
  const nodes = [], edges = [];
  const add = (n) => { n.id = uid("a"); nodes.push(n); return n; };
  const link = (a, fp, b, tp) => edges.push({ id: uid("x"), from: a.id, fp, to: b.id, tp });
  const out = add({ type: "output", x: 0, y: 0 });
  (props.cast || []).forEach((c) => {
    const kind = kindOfRef(c.ref);
    const model = add({ type: "model", ref: c.ref });
    const cont = add({ type: "content", kind, ref: c.ref, label: defaultLabel(c.ref) });
    link(model, "out", cont, "model"); link(cont, "out", out, "scene");
    const d = CHAR_BY_ID.get(c.ref);
    if (c.anim && d?.clips) { const ctl = add({ type: "control", kind: "clip", value: c.anim }); link(ctl, "out", cont, "ctrl"); }
    if (c.acc && kind === "character") { const a = add({ type: "content", kind: "accessory", acc: c.acc, label: String(c.acc).replace(/_/g, " ") }); link(a, "out", cont, "attach"); }
  });
  const bg = add({ type: "content", kind: "background", color: props.bg || "#e7e6e1", label: "Background" }); link(bg, "out", out, "scene");
  const light = add({ type: "light", preset: props.light || "soft" }); link(light, "out", out, "light");
  (shots || []).forEach((s) => { const cam = add({ type: "camera", shot: s.id }); link(cam, "out", out, "cam"); });
  const art = { nodes, edges };
  layoutArt(art);
  return art;
}
export function layoutArt(art) {
  // six columns: models | controls + accessories | scripts | content | background, light, cameras, audio, notes | scene output
  const col = { model: 0, control: 1, script: 2, content: 3, camera: 4, light: 4, audio: 4, other: 4, output: 5 };
  const X = [0, 250, 500, 790, 1070, 1350], ys = [0, 0, 0, 0, 0, 0];
  const order = [...art.nodes].sort((a, b) => (a.type === "other" ? 1 : 0) - (b.type === "other" ? 1 : 0));
  for (const n of order) {
    let c = col[n.type] ?? 4; if (n.type === "content" && n.kind === "accessory") c = 1; if (n.type === "content" && n.kind === "background") c = 4;
    n.x = X[c]; n.y = ys[c]; ys[c] += subSize(n)[1] + 24;
  }
  const out = outputNode(art); if (out) out.y = Math.max(0, (Math.max(...ys.slice(0, 5)) - subSize(out)[1]) / 3);
}

export function makeSub(type, opts = {}, at = [0, 0]) {
  const n = { id: uid("a"), type, x: at[0], y: at[1], ...opts };
  if (type === "model") n.ref ||= "mochi/kumo";
  if (type === "content") { n.kind ||= "character"; if (n.kind === "background") n.color ||= "#e7e6e1"; if (n.kind === "accessory") { n.acc ||= "party_hat"; n.label ||= "party hat"; } else if (n.kind !== "background") { n.ref ||= n.kind === "prop" ? "obj/book" : n.kind === "shape" ? "morph" : "mochi/kumo"; n.label ||= defaultLabel(n.ref); } else n.label ||= "Background"; }
  if (type === "control") { n.kind ||= "clip"; n.value ||= ""; }
  if (type === "script") n.char ||= "narrator";
  if (type === "light") n.preset ||= "soft";
  if (type === "audio") { n.text ||= "Audio cue"; n.frame ??= 0; n.len ??= 24; }
  if (type === "other") { n.kind ||= "note"; n.text ||= n.kind === "group" ? "Group" : ""; if (n.kind === "group") { n.w ||= 320; n.h ||= 200; } }
  return n;
}
export const defaultArtProps = (presetId) => clone(PRESET_BY_ID.get(presetId) || PRESET_BY_ID.get("hand-wave"));

// set the scene's light through its artboard (creates and connects a Light sub-node when there is none)
export function setLightPreset(node, preset) {
  const art = node.art, o = outputNode(art); if (!o) return;
  let l = art.edges.filter((e) => e.to === o.id && e.tp === "light").map((e) => subById(art, e.from)).find((n) => n?.type === "light");
  if (!l) { l = makeSub("light", { preset }, [o.x - 300, o.y - 140]); art.nodes.push(l); art.edges.push({ id: uid("x"), from: l.id, fp: "out", to: o.id, tp: "light" }); }
  l.preset = preset;
}

// the Script sub-node bound to a character in this scene (created and wired to that character's Content node when missing)
export function ensureScriptSub(node, char) {
  const art = node.art; let s = art.nodes.find((n) => n.type === "script" && charRefOfScript(art, n) === char); if (s) return s;
  const cont = art.nodes.find((c) => c.type === "content" && c.kind === "character" && effectiveRef(art, c) === char);
  s = makeSub("script", { char }, [cont ? cont.x - 330 : -340, cont ? cont.y + 200 : 560 + art.nodes.filter((n) => n.type === "script").length * 140]);
  art.nodes.push(s); if (cont) art.edges.push({ id: uid("x"), from: s.id, fp: "out", to: cont.id, tp: "text" });
  return s;
}
