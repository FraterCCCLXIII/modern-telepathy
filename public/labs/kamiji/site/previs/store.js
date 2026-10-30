// Project model, derived sequence, undo/redo (snapshot based) and persistence.
import { PRESET_BY_ID, CHAR_BY_ID } from "./catalog.js";
import { SOURCES, SINKS, PROVIDERS, PROVIDER_OPTS, SOCIAL } from "./nodekinds.js";
import { uid, defaultLabel, artFromProps, compile, syncCameras, SUB_TYPES, CONTENT_KINDS, layoutArt, outputNode, portsOf, ensureScriptSub } from "./art.js";
export { uid };

const KEY = "kamiji.previs.project.v2", KEY_V1 = "kamiji.previs.project.v1";
export const VERSION = 2;
export const NODE = { sceneW: 264, sceneH: 226, portY: 114, branchW: 140, branchH: 64, branchPortY: 32 };
const clone = (o) => JSON.parse(JSON.stringify(o));

export function makeShot(preset, over = {}) {
  const c = clone(preset.cam);
  return { id: uid("s"), label: "", len: 48, off: 0, type: preset.shotType || "MS", move: "Static", notes: "",
    cam: { a: c, b: clone(c), ease: "ease in-out" }, ...over };
}
// A scene node starts from flat properties (cast, bg, light) that upgradeNode turns into its artboard.
export const newProvider = (kind) => ({ res: "720p", dur: 5, aspect: "16:9", seed: 1234, style: "faithful", outcome: "ok" });
export const newSocial = () => ({ title: "", desc: "", tags: "", privacy: "private", thumb: 0, captions: "srt" });
function rawNode(presetId, x, y, name) {
  if (/^provider:/.test(presetId)) { const kind = presetId.split(":")[1]; return { id: uid("n"), type: "provider", kind, name: name || PROVIDERS[kind].label, x, y, status: "draft", notes: "", shots: [], opts: newProvider(kind), run: { state: "idle", at: "" }, takes: [], view: "", cmp: 50 }; }
  if (/^chat:/.test(presetId)) return { id: uid("n"), type: "chat", kind: "prompt", name: name || "Prompt chat", x, y, status: "draft", notes: "", shots: [], agent: true, msgs: [] };
  if (/^(source|sink):/.test(presetId)) {
    const [type, kind] = presetId.split(":"), def = (type === "source" ? SOURCES : SINKS)[kind];
    return type === "source" ? { id: uid("n"), type, kind, name: name || def.label, x, y, notes: "", shots: [], info: { file: "", summary: "", at: "" } }
      : { id: uid("n"), type, kind, name: name || def.label, x, y, notes: "", shots: [], opts: { format: "srt", subtitles: true }, last: null, ...(def.social ? { social: newSocial() } : {}) };
  }
  if (/^ref:/.test(presetId)) { // a single asset dropped from the Library becomes a one-actor scene
    const ref = presetId.slice(4), d = CHAR_BY_ID.get(ref), base = PRESET_BY_ID.get(d?.rigged ? (d.group === "Rubbernose" ? "rubbernose-dance" : "hand-wave") : d?.morph ? "shapes-morph" : "still-life");
    const sc = { ...base, cast: [{ ref, anim: "", acc: "" }], cam: d?.rigged ? { p: [0, 1.0, 4.4], t: [0, 0.8, 0], fov: 35 } : base.cam };
    return { id: uid("n"), type: "scene", name: name || defaultLabel(ref), x, y, status: "draft", notes: "", preset: base.id, props: { cast: sc.cast, bg: base.bg, light: base.light }, shots: [makeShot(sc)] };
  }
  const pr = PRESET_BY_ID.get(presetId);
  if (presetId === "branch") return { id: uid("n"), type: "branch", name: name || "Branch", x, y, status: "draft", notes: "", shots: [] };
  const n = { id: uid("n"), type: "scene", name: name || pr.label, x, y, status: "draft", notes: "", preset: presetId,
    props: { cast: clone(pr.cast).map((c) => ({ anim: "", acc: "", ...c })), bg: pr.bg, light: pr.light }, shots: [makeShot(pr)] };
  return n;
}
export function makeNode(presetId, x, y, name, p = null) {
  const n = rawNode(presetId, x, y, name);
  if (n.type === "scene") upgradeNode(p || { script: { lines: [], names: {} } }, n);
  return n;
}

// ---- migration: v1 flat scene properties -> artboard, shot caption/dialogue -> script lines -----------------
const lastSeg = (r) => String(r).split("/").pop().toLowerCase();
export function upgradeNode(p, n) {
  if (n.type !== "scene") return;
  p.script ||= { lines: [], names: {}, cast: [] };
  const fresh = !n.art;
  if (fresh) n.art = artFromProps(n.props || { cast: [], bg: "#e7e6e1", light: "soft" }, n.shots);
  const cast = (n.props?.cast || []).map((c) => c.ref).filter((r) => CHAR_BY_ID.get(r)?.rigged);
  for (const s of n.shots) {
    if (s.caption) p.script.lines.push({ id: uid("l"), char: "narrator", kind: "action", text: String(s.caption), node: n.id, shot: s.id, status: "draft" });
    if (s.dialogue) {
      const m = /^\s*([A-Za-z][\w ]{0,20}):\s*(.*)$/.exec(s.dialogue); let ch = null, text = String(s.dialogue);
      if (m) { const hit = cast.find((r) => lastSeg(r) === m[1].trim().toLowerCase()); if (hit) { ch = hit; text = m[2]; } else if (m[1] === m[1].toUpperCase()) { ch = cast[0] || "narrator"; text = s.dialogue; } }
      p.script.lines.push({ id: uid("l"), char: ch || cast[0] || "narrator", kind: "dialogue", text, node: n.id, shot: s.id, status: "draft" });
    }
    delete s.caption; delete s.dialogue;
  }
  if (fresh) { fixScripts(p, n); }
}
export function fixScripts(p, n) { for (const ch of new Set(p.script.lines.filter((l) => l.node === n.id).map((l) => l.char))) ensureScriptSub(n, ch); layoutArt(n.art); }
export function upgradeProject(p) { p.script ||= { lines: [], names: {}, cast: [] }; p.assets ||= { models: [] }; for (const n of p.nodes) upgradeNode(p, n); p.v = VERSION; return p; }

export function emptyProject(name = "Untitled previs") {
  return { v: VERSION, name, fps: 24, nodes: [], edges: [], markers: [], notes: [], range: null, loop: false, script: { lines: [], names: {}, cast: [], voices: {} }, assets: { models: [] } };
}

export function sampleProject() {
  const mk = (preset, x, y, name, shots, extra = {}) => {
    const n = rawNode(preset, x, y, name);
    const pr = PRESET_BY_ID.get(preset);
    n.shots = shots.map((s, i) => {
      const sh = makeShot(pr, { len: s.len, type: s.type, move: s.move || "Static", caption: s.caption || "", dialogue: s.dialogue || "", notes: s.notes || "", off: s.off || 0 });
      if (s.a) sh.cam.a = clone(s.a);
      sh.cam.b = clone(s.b || s.a || pr.cam);
      return sh;
    });
    Object.assign(n, extra);
    return n;
  };
  const hw = PRESET_BY_ID.get("hand-wave").cam, duo = PRESET_BY_ID.get("kamikin-duo").cam;
  const close = (c, k) => ({ p: [c.p[0], c.t[1] + (c.p[1] - c.t[1]) * k, c.t[2] + (c.p[2] - c.t[2]) * k], t: c.t.slice(), fov: c.fov });
  const n1 = mk("hand-wave", 40, 60, "1. Cold open: a wave", [
    { len: 60, type: "MS", move: "Push in", caption: "A hand waves at the viewer.", dialogue: "", a: { p: [0, 1.0, 5.4], t: [0, 0.8, 0], fov: 35 }, b: close(hw, 1) },
    { len: 36, type: "CU", move: "Static", caption: "Close on the palm.", dialogue: "Hello.", a: close(hw, 0.55) },
  ], { status: "approved", notes: "Open on silence. The wave should read before the voice comes in." });
  const n2 = mk("kamikin-duo", 360, 60, "2. Meet the Kamikin", [
    { len: 72, type: "2S", move: "Static", caption: "Kumo and Kon notice each other.", dialogue: "KON: Oh! A visitor.", a: duo },
    { len: 48, type: "MCU", move: "Pan", caption: "Kon turns, Kumo follows.", dialogue: "KUMO: Shh. Let it wave first.", a: { p: [-1.6, 1.1, 4.2], t: [-0.9, 0.9, 0], fov: 35 }, b: { p: [1.6, 1.1, 4.2], t: [0.9, 0.9, 0], fov: 35 } },
  ]);
  n2.props.cast[1].acc = "bow_tie";
  const nb = rawNode("branch", 680, 130, "What happens next?");
  const n3 = mk("rubbernose-dance", 880, 10, "3. Rubbernose dance", [
    { len: 96, type: "WS", move: "Orbit", caption: "Everyone dances.", dialogue: "", a: PRESET_BY_ID.get("rubbernose-dance").cam, b: { p: [3.6, 1.4, 6.0], t: [0, 0.85, 0], fov: 35 }, off: 12 },
  ], { status: "blocked", notes: "Charleston clip loops at about 2 seconds. Cut on the downbeat." });
  const n4 = mk("still-life", 880, 260, "3b. Still life (alternate)", [
    { len: 60, type: "CU", move: "Crane up", caption: "Quiet alternate: the letter on the desk.", dialogue: "", a: { p: [0, 0.7, 3.4], t: [0, 0.3, 0], fov: 35 }, b: { p: [0, 2.4, 3.0], t: [0, 0.3, 0], fov: 35 } },
  ]);
  n4.props.cast[0].acc = "";
  const n5 = mk("shapes-morph", 1200, 130, "4. Shapes morph finale", [
    { len: 96, type: "MS", move: "Pull out", caption: "Everything becomes everything.", dialogue: "", a: { p: [0, 0.8, 2.8], t: [0, 0.65, 0], fov: 35 }, b: { p: [0, 1.0, 4.6], t: [0, 0.65, 0], fov: 35 } },
  ]);
  const e = (a, b, kind) => ({ id: uid("e"), from: a.id, to: b.id, kind });
  const src = rawNode("source:script", -330, 60); src.info = { file: "(built-in sample)", summary: "Sample data: the dialogue and action lines are already in this project. Import a file to add more.", at: "" };
  const sk1 = rawNode("sink:pdf", 1560, 40), sk2 = rawNode("sink:subs", 1560, 270);
  // pipeline MOCKUP lane: Prompt chat -> Seedance (simulated) -> Storyboard scene 3, and the take -> YouTube / Shorts presets
  const ch = rawNode("chat:prompt", 520, 580), pv = rawNode("provider:seedance", 940, 540), yt = rawNode("sink:youtube", 1400, 500), sh = rawNode("sink:shorts", 1760, 500);
  ch.msgs = [{ id: uid("m"), role: "agent", text: "Mockup agent here. Try: make scene 3 moodier, slow push-in. Replies are scripted; nothing leaves your browser.", at: "" }];
  const proj = {
    ...emptyProject("Sample: the wave (5 scenes)"),
    nodes: [src, n1, n2, nb, n3, n4, n5, sk1, sk2, ch, pv, yt, sh],
    edges: [e(ch, pv, "prompt"), e(n3, pv, "gen"), e(pv, n3, "result"), e(pv, yt, "export"), e(pv, sh, "export"), e(src, n1, "import"), e(n5, sk1, "export"), e(n5, sk2, "export"), e(n1, n2, "cut"), e(n2, nb, "cut"), e(nb, n3, "branch"), e(nb, n4, "branch"), e(n3, n5, "dissolve"), e(n4, n5, "dissolve")],
    markers: [{ id: uid("m"), frame: 60, label: "Voice in" }],
    notes: [{ id: uid("a"), frame: 0, len: 48, label: "Room tone, quiet" }, { id: uid("a"), frame: 132, len: 72, label: "Music cue: soft marimba" }],
  };
  upgradeProject(proj);
  // a few extra script lines so the Script drawer has something to organise
  const L = proj.script.lines, shot2 = n2.shots[0].id, kon = "mochi/kon", kumo = "mochi/kumo";
  const at = (ch, kind, text, node, shot, i) => L.splice(i, 0, { id: uid("l"), char: ch, kind, text, node: node.id, shot, status: "draft" });
  const k = L.findIndex((l) => l.shot === shot2 && l.kind === "dialogue");
  at(kon, "paren", "(delighted, a little loud)", n2, shot2, k);
  at(kumo, "dialogue", "He can hear you, you know.", n2, n2.shots[1].id, L.length);
  at("narrator", "action", "Beat. The hand waves again, slower.", n1, n1.shots[1].id, L.length);
  fixScripts(proj, n1); fixScripts(proj, n2);
  return proj;
}

// ---- derived data ------------------------------------------------------------------------------
// The cut: follow the main path from every start node. Of several outgoing edges the top-most target is the main path.
export function derive(p) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const flow = (n) => n && (n.type === "scene" || n.type === "branch"); // sources and sinks sit outside the cut
  const fe = p.edges.filter((e) => flow(byId.get(e.from)) && flow(byId.get(e.to)));
  const incoming = new Set(fe.map((e) => e.to));
  const out = (n) => fe.filter((e) => e.from === n.id).map((e) => byId.get(e.to)).filter(Boolean).sort((a, b) => a.y - b.y || a.x - b.x);
  const roots = p.nodes.filter((n) => flow(n) && !incoming.has(n.id)).sort((a, b) => a.x - b.x || a.y - b.y);
  const order = [], seen = new Set();
  for (const r of roots) {
    let n = r;
    while (n && !seen.has(n.id)) { seen.add(n.id); order.push(n); n = out(n)[0]; }
  }
  const inCut = new Set(order.map((n) => n.id));
  const seq = [];
  let t = 0, i = 0;
  const nodeStart = new Map();
  for (const n of order) {
    nodeStart.set(n.id, t);
    for (const s of n.shots) { seq.push({ shot: s, node: n, start: t, len: s.len, end: t + s.len, n: ++i }); t += s.len; }
  }
  return { order, inCut, seq, total: t, nodeStart, byId };
}
export const nodeFrames = (n) => n.shots.reduce((a, s) => a + s.len, 0);
export const edgeKindOnEntry = (p, nodeId) => p.edges.find((e) => e.to === nodeId)?.kind || "cut";

export function timecode(frame, fps) {
  const f = Math.max(0, Math.round(frame));
  const s = Math.floor(f / fps), ff = f % fps;
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  const z = (n) => String(n).padStart(2, "0");
  return `${z(h)}:${z(m % 60)}:${z(s % 60)}:${z(ff)}`;
}
export const seconds = (frames, fps) => (frames / fps).toFixed(frames % fps === 0 ? 0 : 1) + "s";

// ---- validation of imported / stored JSON -----------------------------------------------------
const num = (v, d) => (Number.isFinite(+v) ? +v : d);
const vec = (a, d) => (Array.isArray(a) && a.length === 3 ? a.map((x, i) => num(x, d[i])) : d.slice());
function cleanArt(raw) {
  const str = (v, m = 80) => String(v ?? "").slice(0, m);
  const nodes = [], seen = new Set();
  for (const r of raw.nodes.slice(0, 150)) {
    if (!r || !SUB_TYPES.includes(r.type)) continue;
    const id = str(r.id || uid("a"), 40); if (seen.has(id)) continue; seen.add(id);
    const n = { id, type: r.type, x: num(r.x, 0), y: num(r.y, 0) };
    if (r.label) n.label = str(r.label, 60);
    if (r.type === "model") n.ref = CHAR_BY_ID.has(r.ref) || /^user\//.test(r.ref) ? r.ref : "kamiji";
    if (r.type === "content") { n.kind = CONTENT_KINDS.includes(r.kind) ? r.kind : "prop"; if (n.kind === "accessory") n.acc = str(r.acc, 40); else if (n.kind === "background") n.color = /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : "#e7e6e1"; else n.ref = CHAR_BY_ID.has(r.ref) || /^user\//.test(r.ref) ? r.ref : "kamiji"; }
    if (r.type === "control") { n.kind = ["clip", "expression", "mouth", "effects", "morph"].includes(r.kind) ? r.kind : "clip"; n.value = str(r.value, 60); }
    if (r.type === "script") n.char = str(r.char || "narrator", 60);
    if (r.type === "camera") n.shot = str(r.shot, 40);
    if (r.type === "light") n.preset = ["soft", "hard", "rim", "dusk"].includes(r.preset) ? r.preset : "soft";
    if (r.type === "audio") { n.text = str(r.text, 120); n.frame = Math.max(0, Math.round(num(r.frame, 0))); n.len = Math.max(1, Math.round(num(r.len, 24))); }
    if (r.type === "other") { n.kind = ["note", "group", "reference"].includes(r.kind) ? r.kind : "note"; n.text = str(r.text, 2000); if (n.kind === "group") { n.w = Math.min(2000, Math.max(160, num(r.w, 320))); n.h = Math.min(2000, Math.max(100, num(r.h, 200))); } if (n.kind === "reference" && typeof r.img === "string" && r.img.startsWith("data:image/") && r.img.length < 400000) n.img = r.img; }
    nodes.push(n);
  }
  if (!nodes.some((n) => n.type === "output")) nodes.push({ id: uid("a"), type: "output", x: 1240, y: 0 });
  const byId = new Map(nodes.map((n) => [n.id, n])), edges = [];
  for (const e of raw.edges || []) {
    const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b || a === b) continue;
    if (!portsOf(a).out.some((p) => p.id === e.fp) || !portsOf(b).in.some((p) => p.id === e.tp)) continue;
    edges.push({ id: str(e.id || uid("x"), 40), from: a.id, fp: e.fp, to: b.id, tp: e.tp });
  }
  return { nodes, edges };
}
export function compileAll(p) { for (const n of p.nodes) { if (n.type === "scene") { syncCameras(n); compile(n); } } }
export function normalise(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new Error("Not a Previs project (needs nodes and edges).");
  const p = emptyProject(String(raw.name || "Imported previs").slice(0, 80));
  p.fps = [24, 25, 30].includes(+raw.fps) ? +raw.fps : 24;
  const rs = raw.script || {};
  p.script = { lines: (Array.isArray(rs.lines) ? rs.lines : []).slice(0, 3000).map((l) => ({ id: String(l.id || uid("l")), char: String(l.char || "narrator").slice(0, 60), kind: ["dialogue", "action", "paren"].includes(l.kind) ? l.kind : "dialogue", text: String(l.text || "").slice(0, 2000), node: l.node ? String(l.node) : null, shot: l.shot ? String(l.shot) : null, status: ["draft", "approved", "cut"].includes(l.status) ? l.status : "draft", ...(Number.isFinite(+l.t0) && l.t0 !== null ? { t0: +l.t0, t1: Number.isFinite(+l.t1) ? +l.t1 : +l.t0 + 2 } : {}) })),
    cast: (Array.isArray(rs.cast) ? rs.cast : []).slice(0, 200).map((c) => ({ id: String(c.id || uid("c")).slice(0, 60), name: String(c.name || "Character").slice(0, 40), ref: c.ref ? String(c.ref).slice(0, 60) : "" })),
    names: Object.fromEntries(Object.entries(rs.names && typeof rs.names === "object" ? rs.names : {}).slice(0, 100).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 40)])),
    // per-character voice: { voice: "" (auto) | "qwen:girl-teen" | "kokoro:af_heart" | "system:Samantha", speed 0.6..1.5, shift -6..8 semitones }
    voices: Object.fromEntries(Object.entries(rs.voices && typeof rs.voices === "object" ? rs.voices : {}).slice(0, 100).filter(([, v]) => v && typeof v === "object")
      .map(([k, v]) => [String(k).slice(0, 60), { voice: String(v.voice || "").slice(0, 80), speed: Math.min(1.5, Math.max(0.6, +v.speed || 1)), shift: Math.min(8, Math.max(-6, Math.round(+v.shift || 0))) }])) };
  p.assets = { models: (Array.isArray(raw.assets?.models) ? raw.assets.models : []).slice(0, 50).map((m) => ({ id: String(m.id).slice(0, 60), name: String(m.name || "model").slice(0, 80), size: +m.size || 0, rigged: !!m.rigged, clips: Array.isArray(m.clips) ? m.clips.slice(0, 30).map((c) => String(c).slice(0, 40)) : [] })) };
  const ids = new Set();
  for (const r of raw.nodes) {
    if (!r || typeof r !== "object") continue;
    const id = String(r.id || uid("n"));
    if (ids.has(id)) continue;
    ids.add(id);
    const kindOk = (t) => (t === "source" ? SOURCES : SINKS)[r.kind];
    const n = { id, type: r.type === "branch" ? "branch" : r.type === "source" && kindOk("source") ? "source" : r.type === "sink" && kindOk("sink") ? "sink" : r.type === "provider" && PROVIDERS[r.kind] ? "provider" : r.type === "chat" ? "chat" : "scene", name: String(r.name || "Untitled").slice(0, 80), x: num(r.x, 0), y: num(r.y, 0),
      status: ["draft", "blocked", "approved"].includes(r.status) ? r.status : "draft", notes: String(r.notes || "").slice(0, 4000), shots: [] };
    if (n.type === "source" || n.type === "sink") {
      n.kind = r.kind;
      if (n.type === "source") { const i = r.info || {}; n.info = { file: String(i.file || "").slice(0, 200), summary: String(i.summary || "").slice(0, 300), at: String(i.at || "").slice(0, 40) }; }
      else { n.opts = { format: ["srt", "vtt", "fountain", "md", "txt"].includes(r.opts?.format) ? r.opts.format : "srt", subtitles: r.opts?.subtitles !== false }; n.last = r.last && typeof r.last === "object" ? { ok: !!r.last.ok, msg: String(r.last.msg || "").slice(0, 300), at: String(r.last.at || "").slice(0, 40) } : null; }
    }
    if (n.type === "sink" && SOCIAL[n.kind]) { const o = r.social || {}; n.social = { title: String(o.title || "").slice(0, 150), desc: String(o.desc || "").slice(0, 1000), tags: String(o.tags || "").slice(0, 200), privacy: ["private", "unlisted", "public"].includes(o.privacy) ? o.privacy : "private", thumb: Math.max(0, Math.min(5, Math.round(num(o.thumb, 0)))), captions: o.captions === "vtt" ? "vtt" : "srt" }; }
    if (n.type === "provider") {
      n.kind = r.kind; const o = r.opts || {}, P = PROVIDER_OPTS;
      n.opts = { res: P.res.includes(o.res) ? o.res : "720p", dur: P.dur.includes(+o.dur) ? +o.dur : 5, aspect: P.aspect.includes(o.aspect) ? o.aspect : "16:9", seed: Math.max(0, Math.min(999999999, Math.round(num(o.seed, 1234)))), style: P.style[o.style] ? o.style : "faithful", outcome: o.outcome === "fail" ? "fail" : "ok" };
      n.takes = (Array.isArray(r.takes) ? r.takes : []).slice(0, 60).map((t, i) => ({ id: String(t.id || uid("t")).slice(0, 40), v: Math.max(1, Math.round(num(t.v, i + 1))), state: t.state === "failed" ? "failed" : "done", prompt: String(t.prompt || "").slice(0, 400), prompts: (Array.isArray(t.prompts) ? t.prompts : []).slice(-8).map((x) => String(x).slice(0, 400)), by: t.by === "chat" ? "chat" : "manual", at: String(t.at || "").slice(0, 40),
        secs: Math.max(0.1, Math.min(600, num(t.secs, 5))), res: P.res.includes(t.res) ? t.res : n.opts.res, aspect: P.aspect.includes(t.aspect) ? t.aspect : n.opts.aspect, seed: Math.round(num(t.seed, 0)), style: P.style[t.style] ? t.style : "faithful", scenes: (Array.isArray(t.scenes) ? t.scenes : []).slice(0, 20).map((x) => String(x).slice(0, 40)), review: ["pending", "accepted", "rejected"].includes(t.review) ? t.review : "pending", msg: String(t.msg || "").slice(0, 200) }));
      const st = r.run?.state; n.run = { state: st === "done" || st === "failed" ? st : "idle", at: String(r.run?.at || "").slice(0, 40) }; // a render that was in flight at reload is not resumed: it goes back to idle
      n.view = n.takes.some((t) => t.id === r.view) ? r.view : n.takes[n.takes.length - 1]?.id || ""; n.cmp = Math.max(0, Math.min(100, num(r.cmp, 50)));
    }
    if (n.type === "chat") { n.agent = r.agent !== false; n.msgs = (Array.isArray(r.msgs) ? r.msgs : []).slice(-80).map((m) => ({ id: String(m.id || uid("m")).slice(0, 40), role: m.role === "agent" ? "agent" : "user", text: String(m.text || "").slice(0, 1200), at: String(m.at || "").slice(0, 40), ...(m.take ? { take: String(m.take).slice(0, 40) } : {}) })); }
    if (n.type === "scene") {
      const pr = PRESET_BY_ID.get(r.preset) || PRESET_BY_ID.get("hand-wave");
      n.preset = pr.id;
      const pp = r.props || {};
      n.props = { cast: (Array.isArray(pp.cast) ? pp.cast : pr.cast).slice(0, 4).map((c) => ({ ref: String(c.ref || "kamiji"), anim: String(c.anim || ""), acc: String(c.acc || "") })),
        bg: /^#[0-9a-f]{6}$/i.test(pp.bg) ? pp.bg : pr.bg, light: ["soft", "hard", "rim", "dusk"].includes(pp.light) ? pp.light : "soft" };
      for (const s of Array.isArray(r.shots) ? r.shots : []) {
        const c = s.cam || {};
        const ka = (k, d) => ({ p: vec(k?.p, d.p), t: vec(k?.t, d.t), fov: Math.min(100, Math.max(10, num(k?.fov, d.fov))) });
        n.shots.push({ id: String(s.id || uid("s")), label: String(s.label || "").slice(0, 60), len: Math.max(6, Math.round(num(s.len, 48))), off: Math.max(0, Math.round(num(s.off, 0))),
          type: String(s.type || "MS").slice(0, 6), move: String(s.move || "Static").slice(0, 20), caption: String(s.caption || "").slice(0, 300), dialogue: String(s.dialogue || "").slice(0, 300),
          notes: String(s.notes || "").slice(0, 2000), ...(s.gen && typeof s.gen === "object" ? { gen: { v: Math.max(1, Math.round(num(s.gen.v, 1))), prompt: String(s.gen.prompt || "").slice(0, 400), by: String(s.gen.by || "").slice(0, 60), take: String(s.gen.take || "").slice(0, 40), at: String(s.gen.at || "").slice(0, 40), note: String(s.gen.note || "").slice(0, 200), accepted: !!s.gen.accepted } } : {}), cam: { a: ka(c.a, pr.cam), b: ka(c.b || c.a, pr.cam), ease: ["linear", "ease in-out", "ease in", "ease out"].includes(c.ease) ? c.ease : "ease in-out" } });
      }
    }
    if (n.type === "scene" && r.art && Array.isArray(r.art.nodes)) n.art = cleanArt(r.art);
    p.nodes.push(n);
  }
  for (const n of p.nodes) upgradeNode(p, n);
  for (const e of raw.edges) if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) p.edges.push({ id: String(e.id || uid("e")), from: e.from, to: e.to, kind: ["cut", "dissolve", "branch", "import", "export", "prompt", "gen", "result"].includes(e.kind) ? e.kind : "cut" });
  p.markers = (raw.markers || []).slice(0, 200).map((m) => ({ id: String(m.id || uid("m")), frame: Math.max(0, Math.round(num(m.frame, 0))), label: String(m.label || "Marker").slice(0, 40) }));
  p.notes = (raw.notes || []).slice(0, 200).map((m) => ({ id: String(m.id || uid("a")), frame: Math.max(0, Math.round(num(m.frame, 0))), len: Math.max(1, Math.round(num(m.len, 24))), label: String(m.label || "Note").slice(0, 80), ...(Array.isArray(m.wave) ? { wave: m.wave.slice(0, 200).map((v) => Math.min(1, Math.max(0, +v || 0))) } : {}) }));
  p.range = raw.range && Number.isFinite(+raw.range.in) && Number.isFinite(+raw.range.out) && raw.range.out > raw.range.in ? { in: Math.round(+raw.range.in), out: Math.round(+raw.range.out) } : null;
  p.loop = !!raw.loop;
  compileAll(p);
  return p;
}

// ---- store ------------------------------------------------------------------------------------
export function createStore() {
  let p = null, rev = 0, cache = null;
  const subs = new Set();
  const hist = [], fut = [];
  let last = "";
  const sel = { nodes: [], edge: null, shot: null, item: null, open: null, sub: [], subEdge: null }; // item: {type:'note'|'marker'}; open: scene id whose artboard is shown; sub: selected sub-nodes
  const store = {
    sel,
    get p() { return p; },
    get rev() { return rev; },
    get d() { if (!cache || cache.rev !== rev) cache = { rev, d: derive(p) }; return cache.d; },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    emit(scope = "all") { if (p && scope !== "sel" && scope !== "history" && scope !== "move") compileAll(p); rev++; subs.forEach((f) => f(scope)); },
    set(project, { keepHistory = false } = {}) {
      p = project;
      last = JSON.stringify(p);
      if (!keepHistory) { hist.length = 0; fut.length = 0; }
      sel.nodes = []; sel.edge = null; sel.shot = null; sel.item = null; sel.open = null; sel.sub = []; sel.subEdge = null;
      const s0 = derive(p).seq[0]; if (s0) { sel.shot = s0.shot.id; sel.nodes = [s0.node.id]; }
      store.emit("all"); store.emit("history");
    },
    update(fn, scope = "all") { fn(p); store.emit(scope); },
    // Record the current state as an undo step if it differs from the last recorded one.
    commit() {
      const cur = JSON.stringify(p);
      if (cur === last) return false;
      hist.push(last); if (hist.length > 100) hist.shift();
      fut.length = 0; last = cur; persist(p); store.emit("history"); return true;
    },
    // swap in a whole new project as ONE undoable step (New, Import, Load sample)
    replace(project) {
      hist.push(last); if (hist.length > 100) hist.shift(); fut.length = 0;
      p = project; last = JSON.stringify(p); persist(p);
      sel.nodes = []; sel.edge = null; sel.shot = null; sel.item = null; sel.open = null; sel.sub = []; sel.subEdge = null;
      const s0 = derive(p).seq[0]; if (s0) { sel.shot = s0.shot.id; sel.nodes = [s0.node.id]; }
      store.emit("all"); store.emit("history");
    },
    undo() { if (!hist.length) return false; fut.push(last); last = hist.pop(); p = JSON.parse(last); persist(p); fix(); store.emit("all"); store.emit("history"); return true; },
    redo() { if (!fut.length) return false; hist.push(last); last = fut.pop(); p = JSON.parse(last); persist(p); fix(); store.emit("all"); store.emit("history"); return true; },
    // newest first: what each undo step would revert, and the redo steps above it
    historyList(max = 12) {
      const out = [], snaps = [...hist, last];
      for (let i = snaps.length - 1; i > 0 && out.length < max; i--) out.push({ undoSteps: out.length + 1, label: describe(snaps[i - 1], snaps[i]) });
      return out;
    },
    get redoCount() { return fut.length; },
    get canUndo() { return hist.length > 0; }, get canRedo() { return fut.length > 0; },
    select(ids, opts = {}) { sel.nodes = ids; sel.edge = null; if (opts.shot !== undefined) sel.shot = opts.shot; else sel.shot = firstShotOf(ids); store.emit("sel"); },
    selectShot(id) {
      const s = store.d.seq.find((x) => x.shot.id === id);
      sel.shot = id; sel.item = null; if (s) { sel.nodes = [s.node.id]; sel.edge = null; }
      store.emit("sel");
    },
  };
  function firstShotOf(ids) { const n = p && p.nodes.find((x) => x.id === ids[0]); return n && n.shots[0] ? n.shots[0].id : null; }
  function fix() { // keep the selection valid after undo / redo / delete
    sel.nodes = sel.nodes.filter((id) => p.nodes.some((n) => n.id === id));
    const open = sel.open && p.nodes.find((n) => n.id === sel.open && n.type === "scene");
    if (!open) { sel.open = null; sel.sub = []; sel.subEdge = null; }
    else { sel.sub = sel.sub.filter((id) => open.art.nodes.some((n) => n.id === id)); if (sel.subEdge && !open.art.edges.some((e) => e.id === sel.subEdge)) sel.subEdge = null; }
    if (sel.edge && !p.edges.some((e) => e.id === sel.edge)) sel.edge = null;
    if (!store.d.seq.some((s) => s.shot.id === sel.shot)) sel.shot = store.d.seq.find((s) => sel.nodes.includes(s.node.id))?.shot.id || store.d.seq[0]?.shot.id || null;
  }
  store.fix = fix;
  return store;
}

// A short human description of what changed between two snapshots (for the undo history list).
function describe(aStr, bStr) {
  try {
    const a = JSON.parse(aStr), b = JSON.parse(bStr), art = (p) => p.nodes.reduce((n, x) => n + (x.art ? x.art.nodes.length : 0), 0), aedges = (p) => p.nodes.reduce((n, x) => n + (x.art ? x.art.edges.length : 0), 0), shots = (p) => p.nodes.reduce((n, x) => n + x.shots.length, 0);
    const d = (x, y, w) => (y > x ? `Added ${y - x} ${w}${y - x > 1 ? "s" : ""}` : y < x ? `Removed ${x - y} ${w}${x - y > 1 ? "s" : ""}` : "");
    const r = d(a.nodes.length, b.nodes.length, "node") || d(art(a), art(b), "sub-node") || d(shots(a), shots(b), "shot") || d(a.script.lines.length, b.script.lines.length, "script line") || d(a.edges.length, b.edges.length, "connection") || d(aedges(a), aedges(b), "sub-connection") || d(a.markers.length, b.markers.length, "marker") || d(a.notes.length, b.notes.length, "audio note");
    if (r) return r;
    if (a.name !== b.name) return "Renamed project"; if (a.fps !== b.fps) return `Frame rate ${b.fps} fps`;
    const strip = (p) => JSON.stringify(p, (k, v) => (k === "x" || k === "y" || k === "props" ? undefined : v));
    if (strip(a) === strip(b)) return "Moved nodes";
    if (JSON.stringify(a.script) !== JSON.stringify(b.script)) return "Edited script"; if (JSON.stringify(a.nodes.map((n) => n.shots)) !== JSON.stringify(b.nodes.map((n) => n.shots))) return "Edited shots";
    return "Edited properties";
  } catch (e) { return "Edit"; }
}
let persistTimer = 0;
export function persist(p) {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private mode or quota: the app works without it */ } }, 250);
}
export function persistNow(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } }
export function loadStored() {
  // v2 first; a project saved by the first prototype (v1 key) is migrated on read
  for (const k of [KEY, KEY_V1]) { try { const s = localStorage.getItem(k); if (s) return normalise(JSON.parse(s)); } catch (e) { /* try the next key */ } }
  return null;
}
export function clearStored() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
