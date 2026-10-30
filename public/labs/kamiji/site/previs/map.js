// The story map: scene and branch nodes joined by cut / dissolve / branch edges. A thin adapter over graph.js.
import { NODE, makeNode, uid, nodeFrames, seconds } from "./store.js";
import { createGraph } from "./graph.js";
import { el, announce } from "./ui.js";
import { SOURCES, SINKS, STATUS_LABEL, NODE_SIZE, NODE_PORT_Y, SOCIAL } from "./nodekinds.js";
import { createPipeline } from "./pipeline.js";
const gate = (n) => (n.type === "source" || n.type === "sink") && !(n.type === "sink" && SOCIAL[n.kind]); // social / publish presets are rich cards (pipeline.js)
const rich = (n) => n.type === "provider" || n.type === "chat" || (n.type === "sink" && !!SOCIAL[n.kind]);
const def = (n) => (n.type === "source" ? SOURCES : SINKS)[n.kind];

const STATUS = { draft: "Draft", blocked: "Blocking", approved: "Approved" };
const KINDS = ["cut", "dissolve", "branch"];
export { ZMIN, ZMAX, BUBBLE_Z } from "./graph.js";

export function createMap({ store, root, onAddMenu, onOpen, deps, io, thumbs }) {
  const vp = root.querySelector(".pv-map-vp");
  let graph = null;
  const sel = store.sel;
  const pipe = createPipeline({ store, thumbs, io, getGraph: () => graph, announce });
  const adapter = {
    nodes: () => store.p.nodes, edges: () => store.p.edges.map((e) => ({ ...e, fp: "out", tp: e.kind === "prompt" ? "prompt" : "in" })),
    edgeClass: (e) => pipe.edgeClass(e),
    size: (n) => (rich(n) ? NODE_SIZE[n.type === "sink" ? "social" : n.type] : gate(n) ? NODE_SIZE[n.type] : n.type === "branch" ? [NODE.branchW, NODE.branchH] : [NODE.sceneW, NODE.sceneH]),
    ports: (n) => (pipe.portsOf(n) || (n.type === "source" ? { in: [], out: [{ id: "out", type: "flow", label: "data out" }] } : n.type === "sink" ? { in: [{ id: "in", type: "flow", label: "data in" }], out: [] } : { in: [{ id: "in", type: "flow", label: "flow in" }], out: [{ id: "out", type: "flow", label: "flow out" }] })),
    portOffset: (n, side, id) => [side === "out" ? adapter.size(n)[0] : 0, rich(n) ? pipe.portY(n, side, id) : gate(n) ? NODE_PORT_Y : n.type === "branch" ? NODE.branchPortY : NODE.portY],
    sel: { nodes: () => sel.nodes, setNodes: (ids) => { sel.nodes = ids; }, edge: () => sel.edge, setEdge: (id) => { sel.edge = id; } },
    emitSel: () => store.emit("sel"),
    onSelectNode: (id, clicked) => { const n = store.p.nodes.find((x) => x.id === id); if (n?.shots[0] && (!clicked || sel.nodes.length === 1)) sel.shot = n.shots[0].id; if (clicked) store.emit("sel"); },
    cardClass: (n) => (rich(n) ? "is-gate is-rich is-" + (n.type === "sink" ? "social" : n.type) : n.type === "branch" ? "is-branch" : gate(n) ? "is-gate is-" + n.type : ""),
    name: (n) => n.name,
    rename: (n, v) => { store.update((p) => { p.nodes.find((x) => x.id === n.id).name = v; }); store.commit(); },
    makeCard(n, rec, c) {
      if (rich(n)) { pipe.makeCard(n, rec, c); return; }
      if (gate(n)) { gateCard(n, rec, c); return; }
      const isB = n.type === "branch";
      c.append(el("div", { class: "pv-card-bar" }, el("span", { class: "pv-card-title" }), isB ? null : el("span", { class: "pv-badge" })));
      if (!isB) {
        rec.canvas = el("canvas", { width: 320, height: 180, "aria-hidden": "true" });
        rec.msg = el("span", { class: "pv-card-msg", text: "Loading model" });
        c.append(el("div", { class: "pv-card-view" }, rec.canvas, rec.msg, el("span", { class: "pv-live-dot", "aria-hidden": "true" }), el("span", { class: "pv-card-bubble", "aria-hidden": "true" })));
        c.append(el("div", { class: "pv-card-meta" }, el("span", { class: "pv-m-shots" }), el("span", { class: "pv-m-dur" }), el("span", { class: "pv-m-alt", text: "alternate" }), el("span", { class: "pv-m-gen", hidden: true }),
          el("span", { class: "pv-btn pv-btn-sm pv-card-ctl pv-open", "aria-hidden": "true", title: "Open this scene's artboard (Enter on a selected card, or double-click)", text: "Open", onclick: (e) => { e.stopPropagation(); onOpen?.(rec.node); } }), el("span", { class: "pv-m-sub", title: "Sub-nodes in this scene's artboard" })));
        rec.view = rec.canvas.parentElement; rec.view.append(el("span", { class: "pv-card-cap", "aria-hidden": "true" }));
        rec.render = (now, poster) => deps.drawStory(rec, now, poster);
        rec.sigFn = () => deps.sigOf(rec.node);
      } else c.append(el("div", { class: "pv-branch-glyph", "aria-hidden": "true", text: "branch" }));
    },
    syncCard(n, rec) {
      const c = rec.el, p = store.p, d = store.d;
      if (rich(n)) { pipe.syncCard(n, rec); return; }
      if (gate(n)) { syncGate(n, rec); return; }
      c.classList.toggle("is-alt", !d.inCut.has(n.id));
      const title = c.querySelector(".pv-card-title"); if (title.textContent !== n.name && !c.querySelector(".pv-inline")) title.textContent = n.name;
      if (n.type === "scene") {
        const b = c.querySelector(".pv-badge"); b.textContent = STATUS[n.status]; b.dataset.s = n.status;
        c.querySelector(".pv-m-shots").textContent = `${n.shots.length} shot${n.shots.length === 1 ? "" : "s"}`;
        c.querySelector(".pv-m-dur").textContent = seconds(nodeFrames(n), p.fps);
        c.querySelector(".pv-m-sub").textContent = `${n.art.nodes.length} sub-nodes`;
        { const gv = Math.max(0, ...n.shots.map((x) => x.gen?.v || 0)), gb = c.querySelector(".pv-m-gen"); gb.hidden = !gv; if (gv) { gb.textContent = `gen v${gv}${n.shots.some((x) => x.gen?.accepted) ? " \u2713" : ""}`; gb.title = "Mockup generation provenance: " + n.shots.filter((x) => x.gen).map((x) => `v${x.gen.v} "${x.gen.prompt}"`).join("; "); } }
        c.querySelector(".pv-card-bubble").textContent = n.name;
        if (!rec.voiceChip && deps.voiceChip) { rec.voiceChip = deps.voiceChip(() => deps.speakers(rec.node)); if (rec.voiceChip) rec.view.append(rec.voiceChip); }
        rec.voiceChip?.update(); deps.paintCaption?.(rec);
      }
    },
    ariaLabel(n, active) {
      if (rich(n)) return pipe.aria(n);
      if (gate(n)) return `${n.type === "source" ? "Import" : "Export"} node: ${n.name}. ${STATUS_LABEL[def(n).status]}. ${def(n).note}`;
      const p = store.p, d = store.d, leads = p.edges.filter((e) => e.from === n.id).map((e) => d.byId.get(e.to)?.name).filter(Boolean);
      return (n.type === "branch" ? `Branch, ${n.name}` : `${n.name}, ${n.shots.length} shots, ${n.art.nodes.length} sub-nodes, ${seconds(nodeFrames(n), p.fps)}, ${STATUS[n.status]}${d.inCut.has(n.id) ? "" : ", alternate, not in the cut"}${active ? ", on air" : ""}. Press Enter again to open the artboard`) + (leads.length ? ". Leads to " + leads.join(", ") : "");
    },
    move(start, dx, dy, snap) { store.update((p) => { for (const n of p.nodes) if (start.has(n.id)) { const [ox, oy] = start.get(n.id); n.x = Math.round((ox + dx) / snap) * snap; n.y = Math.round((oy + dy) / snap) * snap; } }, "move"); },
    canConnect: (a, fp, b) => (a.id === b.id ? { ok: false, reason: "A node cannot flow into itself." } : (a.type === "chat" || b.type === "chat" || a.type === "provider" || b.type === "provider") ? (store.p.edges.some((e) => e.from === a.id && e.to === b.id) ? { ok: false, reason: "Already connected." } : pipe.canConnect(a, b)) : b.type === "source" ? { ok: false, reason: "Import nodes have no input; they sit at the start of the graph." } : a.type === "sink" ? { ok: false, reason: "Export nodes have no output; they sit at the end of the graph." }
      : a.type === "source" && b.type !== "scene" ? { ok: false, reason: "An import node feeds a scene (its sub-nodes or script)." } : b.type === "sink" && a.type === "source" ? { ok: false, reason: "Import nodes cannot feed export nodes directly. Route them through a scene." }
      : store.p.edges.some((e) => e.from === a.id && e.to === b.id) ? { ok: false, reason: "Already connected." } : { ok: true }),
    pickPort: (n0, pid, side, other) => {
      const t = adapter.ports(n0)[side].find((q) => q.id === pid)?.type, op = adapter.ports(other)[side === "out" ? "in" : "out"].filter((q) => q.type === t);
      return op[0]?.id || null;
    },
    connect: (a, fp, b) => connect(a.id, b.id),
    chip: (e) => e.kind, edgeKind: (e) => e.kind, onChip: (id) => { if (KINDS.includes(store.p.edges.find((x) => x.id === id)?.kind)) cycleEdge(id); },
    onOpen: (n, fromKey) => { if (n.type === "scene") onOpen?.(n); },
    onAddMenu: (x, y, world) => onAddMenu?.(x, y, world),
  };
  // ---- import (source) and export (sink) cards -------------------------------------------------------
  function gateCard(n, rec, c) {
    const isSrc = n.type === "source", d = def(n);
    c.append(el("div", { class: "pv-card-bar" }, el("span", { class: "pv-gate-glyph", "aria-hidden": "true", text: isSrc ? "\u21E5" : "\u21E5" }), el("span", { class: "pv-card-title" }), el("span", { class: "pv-badge pv-status" })));
    const body = el("div", { class: "pv-gate-body" });
    body.append(el("p", { class: "pv-gate-note", text: d.note }), el("p", { class: "pv-gate-info" }));
    const act = el("div", { class: "pv-gate-act" });
    const btn = el("span", { class: "pv-btn pv-btn-sm pv-card-ctl", "aria-hidden": "true", onclick: (e) => { e.stopPropagation(); if (btn.classList.contains("is-disabled")) return; (isSrc ? io?.pickFile(rec.node) : io?.run(rec.node)); } }); // pointer-only: the inspector has the keyboard-accessible buttons
    act.append(btn, el("span", { class: "pv-gate-res", role: "status" }));
    body.append(act, el("div", { class: "pv-prog", hidden: true }, el("i")), el("p", { class: "pv-local", text: "Runs in your browser. Nothing is uploaded." }));
    c.append(body);
    if (isSrc && !d.disabled) {
      c.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); c.classList.add("is-drop"); } });
      c.addEventListener("dragleave", () => c.classList.remove("is-drop"));
      c.addEventListener("drop", (e) => { e.preventDefault(); c.classList.remove("is-drop"); io?.importFiles(rec.node, [...e.dataTransfer.files]); });
    }
  }
  function syncGate(n, rec) {
    const c = rec.el, d = def(n), isSrc = n.type === "source", st = io?.state(n.id) || { state: "idle" };
    const t = c.querySelector(".pv-card-title"); if (t.textContent !== n.name && !c.querySelector(".pv-inline")) t.textContent = n.name;
    const b = c.querySelector(".pv-status"); b.textContent = STATUS_LABEL[d.status]; b.dataset.s = d.status;
    c.classList.toggle("is-running", st.state === "running");
    const info = c.querySelector(".pv-gate-info"), btn = c.querySelector(".pv-card-ctl"), res = c.querySelector(".pv-gate-res"), prog = c.querySelector(".pv-prog");
    if (isSrc) info.textContent = n.info.summary ? `${n.info.summary}${n.info.file ? " (" + n.info.file + ")" : ""}` : d.disabled ? "Not connected." : "Nothing imported yet. Drop a file on this card or press Import.";
    else { const sc = io?.scopeOf(n); const fm = (d.formats ? ` as ${d.formats[n.opts.format]}` : "") + ((n.kind === "frames" || n.kind === "video") && n.opts.subtitles !== false ? ", subtitles on" : ""); info.textContent = !sc ? "Not connected: attach it to the last scene (whole cut) or to one scene." : `Exports ${sc.label}${fm}.`; }
    btn.textContent = st.state === "running" ? "Working\u2026" : isSrc ? (n.info.summary ? "Re-import" : "Import") : "Run export"; btn.classList.toggle("is-disabled", !!d.disabled || st.state === "running");
    res.textContent = st.msg || (isSrc ? "" : n.last?.msg || ""); res.classList.toggle("is-err", st.state === "error" || (!st.msg && n.last && !n.last.ok));
    prog.hidden = st.state !== "running"; if (st.state === "running") prog.firstChild.style.width = Math.round((st.pct || 0) * 100) + "%";
  }
  io?.onChange(() => graph.sync());
  graph = createGraph({ store, vp, adapter });

  function connect(a, b) {
    if (a === b) return false;
    { const A = store.p.nodes.find((n) => n.id === a), B = store.p.nodes.find((n) => n.id === b), r = adapter.canConnect(A, "out", B); if (!r.ok) { announce("Cannot connect: " + r.reason); return false; } }
    if (store.p.edges.some((e) => e.from === a && e.to === b)) { announce("Already connected"); return false; }
    const src = store.p.nodes.find((n) => n.id === a), dst = store.p.nodes.find((n) => n.id === b), id = uid("e");
    store.update((p) => p.edges.push({ id, from: a, to: b, kind: pipe.edgeKind(src, dst) || (src.type === "source" ? "import" : dst.type === "sink" ? "export" : src.type === "branch" ? "branch" : "cut") }));
    sel.edge = id; sel.nodes = []; store.emit("sel"); store.commit();
    announce(`Connected ${src.name} to ${store.p.nodes.find((n) => n.id === b).name}`);
    return true;
  }
  function cycleEdge(id) {
    store.update((p) => { const e = p.edges.find((x) => x.id === id); if (e) e.kind = KINDS[(KINDS.indexOf(e.kind) + 1) % 3]; });
    store.commit(); announce("Edge is now " + store.p.edges.find((x) => x.id === id).kind);
  }
  function del() {
    if (sel.edge) { const id = sel.edge; store.update((p) => { p.edges = p.edges.filter((e) => e.id !== id); }); sel.edge = null; store.emit("sel"); store.commit(); announce("Connection removed"); return true; }
    const ids = new Set(sel.nodes); if (!ids.size) return false;
    store.update((p) => { p.nodes = p.nodes.filter((n) => !ids.has(n.id)); p.edges = p.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)); p.script.lines.forEach((l) => { if (ids.has(l.node)) { l.node = null; l.shot = null; } }); });
    sel.nodes = []; store.fix(); store.emit("all"); store.commit(); announce(`Deleted ${ids.size} node${ids.size > 1 ? "s" : ""}. Undo brings them back.`);
    return true;
  }
  function dup() {
    const ids = new Set(sel.nodes); if (!ids.size) return false;
    const map = new Map(), made = [];
    store.update((p) => {
      for (const n of p.nodes.filter((x) => ids.has(x.id))) {
        const c = JSON.parse(JSON.stringify(n)); c.id = uid("n"); c.x += 40; c.y += 40; c.name = n.name + " copy";
        const sm = new Map(); c.shots.forEach((s) => { const o = s.id; s.id = uid("s"); sm.set(o, s.id); });
        if (c.art) { c.art.nodes.forEach((a) => { if (a.type === "camera" && sm.has(a.shot)) a.shot = sm.get(a.shot); }); }
        for (const l of p.script.lines.filter((x) => x.node === n.id)) p.script.lines.push({ ...l, id: uid("l"), node: c.id, shot: l.shot ? sm.get(l.shot) || null : null });
        map.set(n.id, c.id); made.push(c);
      }
      p.nodes.push(...made);
      for (const e of [...p.edges]) if (map.has(e.from) && map.has(e.to)) p.edges.push({ id: uid("e"), from: map.get(e.from), to: map.get(e.to), kind: e.kind });
    });
    sel.nodes = made.map((n) => n.id); store.select(sel.nodes); store.commit(); announce(`Duplicated ${made.length}`);
    return true;
  }
  function connectSelected() {
    const s = sel.nodes, list = store.p.nodes;
    if (s.length >= 2) { const ex = store.p.edges.find((e) => e.from === s[0] && e.to === s[1]); if (ex) { sel.edge = ex.id; return del(); } return connect(s[0], s[1]); }
    if (s.length === 1) { const me = list.find((n) => n.id === s[0]); const next = [...list].filter((n) => n.x > me.x).sort((a, b) => a.x - b.x)[0]; if (next) return connect(me.id, next.id); announce("Nothing to the right to connect to"); }
    return false;
  }
  function addNode(presetId, at) {
    const sel0 = sel.nodes.length === 1 ? store.p.nodes.find((n) => n.id === sel.nodes[0]) : null;
    const isSrc = /^source:/.test(presetId), isSink = /^sink:/.test(presetId);
    let from = sel0 && !gate(sel0) && (isSink || sel0.type === "branch" || !store.p.edges.some((e) => e.from === sel0.id)) ? sel0 : null; // only extend a chain that has an open end
    if (isSink && !from) from = store.d.order[store.d.order.length - 1] || null; // a sink with nothing selected takes the whole cut
    if (isSrc) from = null;
    const isProv = /^provider:/.test(presetId), isChat = /^chat:/.test(presetId);
    if (sel0 && (sel0.type === "chat" || (sel0.type === "provider" && !isSink))) from = null; // a pipeline node is never extended with a cut edge
    if (isSink && !from) from = store.d.order[store.d.order.length - 1] || null;
    if (isProv) from = sel0?.type === "scene" ? sel0 : null;
    if (isChat) from = null;
    let x, y;
    if (at) { x = at[0] - 130; y = at[1] - 80; }
    else if (isProv && from) { x = from.x + 330; y = from.y + 270; }
    else if (isChat && sel0?.type === "provider") { x = sel0.x - 380; y = sel0.y; }
    else if (isSrc && sel0?.type === "scene") { x = sel0.x - 320; y = sel0.y; }
    else if (isSink && from) { x = Math.max(...store.p.nodes.map((n) => n.x)) + 330; y = from.y; }
    else if (from) { x = from.x + 330; y = from.y; }
    else { const r = vp.getBoundingClientRect(); [x, y] = graph.toWorld(r.left + r.width / 2, r.top + r.height / 2); x -= 130; y -= 100; }
    x = Math.round(x / 10) * 10; y = Math.round(y / 10) * 10;
    while (store.p.nodes.some((n) => Math.abs(n.x - x) < 24 && Math.abs(n.y - y) < 24)) { x += 30; y += 30; }
    const n = makeNode(presetId, x, y, undefined, store.p);
    store.update((p) => { p.nodes.push(n); if (!at && from) p.edges.push({ id: uid("e"), from: from.id, to: n.id, kind: isProv ? "gen" : isSink ? "export" : from.type === "branch" ? "branch" : "cut" }); if (!at && isChat && sel0?.type === "provider") p.edges.push({ id: uid("e"), from: n.id, to: sel0.id, kind: "prompt" }); if (isSrc && sel0?.type === "scene") p.edges.push({ id: uid("e"), from: n.id, to: sel0.id, kind: "import" }); });
    store.select([n.id]); store.commit(); graph.ensureVisible(n); graph.focusNode(n.id);
    announce(`Added ${n.name}`);
    return n;
  }
  return Object.assign(graph, {
    connect, del, dup, addNode, connectSelected, cycleEdge, pipe,
    cycleSelectedEdge() { const id = sel.edge || (sel.nodes.length >= 2 ? store.p.edges.find((e) => e.from === sel.nodes[0] && e.to === sel.nodes[1])?.id : store.p.edges.find((e) => e.to === graph.focusId)?.id); if (id) { sel.edge = id; cycleEdge(id); return true; } return false; },
  });
}
