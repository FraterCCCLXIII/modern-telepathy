// The artboard: a second nodal canvas inside a scene node. Its sub-nodes are the single source of truth for what the scene shows.
import { el, svg, announce } from "./ui.js";
import { createGraph } from "./graph.js";
import { SUB_LABEL, CONTROL_KINDS, CONTROL_RENDERED, OTHER_KINDS, PORT_TYPES, portsOf, subSize, portOffset, canConnect, pickPort, outputNode, effectiveRef,
  makeSub, removeSub, reachable, uid, defaultLabel } from "./art.js";
import { CHAR_BY_ID, LIGHTS } from "./catalog.js";
import { charName, linesOfScriptNode, scriptNodeChar, KINDS as LINE_KINDS } from "./script.js";
import { addShot } from "./ops.js";

const PREVIEW = new Set(["model", "output"]);
const hasPreview = (n) => n.type === "model" || n.type === "output" || (n.type === "content" && !["accessory", "background"].includes(n.kind));

export function createArtboard({ store, vp, deps }) {
  const sel = store.sel;
  const scene = () => store.p.nodes.find((n) => n.id === sel.open && n.type === "scene") || null;
  let graph = null, reach = new Set();
  const title = (n) => {
    const sc = scene(); if (!sc) return "";
    switch (n.type) {
      case "model": return CHAR_BY_ID.get(n.ref)?.label || n.ref;
      case "content": return n.label || (n.kind === "background" ? "Background" : defaultLabel(n.ref));
      case "control": return n.label || CONTROL_KINDS[n.kind];
      case "script": return n.label || charName(store.p, scriptNodeChar(sc.art, n));
      case "camera": { const i = sc.shots.findIndex((s) => s.id === n.shot); return n.label || (i >= 0 ? `Camera: shot ${i + 1}` : "Camera"); }
      case "light": return n.label || `Light: ${LIGHTS[n.preset] || n.preset}`;
      case "audio": return n.label || n.text || "Audio";
      case "other": return n.kind === "group" ? n.text || "Group" : n.label || OTHER_KINDS[n.kind];
      default: return "Scene output";
    }
  };
  // nodes that stand for a speaking character get a voice chip: Model (rigged), Content (character) and Script
  const speaker = (n) => n.type === "script" || (n.type === "content" && n.kind === "character") || (n.type === "model" && !!CHAR_BY_ID.get(n.ref)?.rigged);
  const speakerId = (sc, n) => (n.type === "script" ? scriptNodeChar(sc.art, n) : n.type === "model" ? n.ref : effectiveRef(sc.art, n));
  const typeTag = (n) => (n.type === "content" ? `Content · ${n.kind}` : n.type === "other" ? OTHER_KINDS[n.kind] : n.type === "control" ? `Control · ${n.kind}` : SUB_LABEL[n.type]);

  const adapter = {
    nodes: () => scene()?.art.nodes || [], edges: () => scene()?.art.edges || [],
    size: subSize, ports: (n) => portsOf(n), portOffset: (n, side, id) => portOffset(n, side, id),
    sel: { nodes: () => sel.sub, setNodes: (ids) => { sel.sub = ids; }, edge: () => sel.subEdge, setEdge: (id) => { sel.subEdge = id; } },
    emitSel: () => store.emit("sel"),
    alwaysEmptyHidden: false,
    name: title, noRename: (n) => n.type === "output" || n.type === "model",
    rename: (n, v) => { store.update(() => { if (n.type === "other" && n.kind === "group") n.text = v; else n.label = v; }); store.commit(); },
    cardClass: (n) => `pv-sub t-${n.type}${hasPreview(n) ? " has-prev" : ""}${n.type === "other" ? " k-" + n.kind : ""}${n.type === "other" && n.kind === "group" ? " is-group" : ""}`,
    noMarquee: (n) => false,
    edgeType: (e) => { const a = scene()?.art.nodes.find((x) => x.id === e.from); return a ? portsOf(a).out.find((p) => p.id === e.fp)?.type : ""; },
    makeCard(n, rec, c) {
      c.append(el("div", { class: "pv-card-bar" }, el("span", { class: "pv-sub-type" }), el("span", { class: "pv-card-title" })));
      const body = el("div", { class: "pv-sub-body" }); c.append(body);
      if (hasPreview(n)) {
        rec.canvas = el("canvas", { width: 256, height: 144, "aria-hidden": "true" }); rec.msg = el("span", { class: "pv-card-msg", text: "Loading model" });
        body.append(el("div", { class: "pv-card-view" }, rec.canvas, rec.msg, el("span", { class: "pv-live-dot", "aria-hidden": "true" })));
        rec.render = (now, poster) => deps.drawSub(rec, scene(), now, poster);
        rec.sigFn = () => deps.subSig(scene(), rec.node);
      }
      body.append(el("div", { class: "pv-sub-meta" }));
    },
    syncCard(n, rec) {
      const c = rec.el, sc = scene(); if (!sc) return;
      if (!rec.voiceChip && deps.voiceChip && speaker(n)) { rec.voiceChip = deps.voiceChip(() => { const s = scene(), r = s && speaker(n) ? speakerId(s, n) : null; return r ? [r] : []; }); if (rec.voiceChip) c.append(rec.voiceChip); }
      rec.voiceChip?.update();
      c.querySelector(".pv-sub-type").textContent = typeTag(n);
      const t = c.querySelector(".pv-card-title"); if (t.textContent !== title(n) && !c.querySelector(".pv-inline")) t.textContent = title(n);
      const orphan = !["output", "other"].includes(n.type) && !reach.has(n.id); c.classList.toggle("is-orphan", orphan);
      const meta = c.querySelector(".pv-sub-meta"); let key = "", build = null;
      switch (n.type) {
        case "model": key = n.ref; build = () => [el("span", { text: CHAR_BY_ID.get(n.ref)?.group || "" }), el("span", { text: (CHAR_BY_ID.get(n.ref)?.clips?.length || 0) + " clips" })]; break;
        case "content": {
          const ref = n.kind === "background" || n.kind === "accessory" ? "" : effectiveRef(sc.art, n);
          key = [n.kind, ref, n.color, n.acc, orphan].join("|");
          build = () => n.kind === "background" ? [el("span", { class: "pv-sw-chip", style: `background:${n.color}` }), el("span", { text: n.color })] : n.kind === "accessory" ? [el("span", { text: "wears: " + String(n.acc).replace(/_/g, " ") })] : [el("span", { text: n.kind }), el("span", { text: orphan ? "not in scene" : "in scene" })];
          break; }
        case "control": key = [n.kind, n.value].join("|"); build = () => [el("span", { text: n.value || "(none)" }), CONTROL_RENDERED[n.kind] ? null : el("span", { class: "pv-stub", text: "not rendered yet" })]; break;
        case "script": {
          const ls = linesOfScriptNode(store.p, sc, n); key = JSON.stringify(ls.map((l) => [l.kind, l.text, l.status]));
          build = () => ls.length ? [el("span", { class: "pv-sub-lines" }, ...ls.slice(0, 2).map((l) => el("span", { class: "pv-sub-line k-" + l.kind, text: (l.kind === "paren" ? "" : "") + l.text })), ls.length > 2 ? el("em", { text: `+${ls.length - 2} more` }) : null)] : [el("span", { class: "pv-hint", text: "No lines in this scene yet. Enter opens the Script drawer." })];
          break; }
        case "camera": { const s = sc.shots.find((x) => x.id === n.shot); key = JSON.stringify([s?.cam, s?.type, s?.move]); build = () => s ? [frustum(s.cam), el("span", { class: "pv-sub-cap", text: `${s.type} · ${s.move}` })] : [el("span", { text: "no shot" })]; break; }
        case "light": key = n.preset; build = () => [el("span", { class: "pv-light-glyph", "aria-hidden": "true" }), el("span", { text: LIGHTS[n.preset] || n.preset })]; break;
        case "audio": key = [n.text, n.frame, n.len].join("|"); build = () => [el("span", { text: `cue at frame ${n.frame}, ${n.len}f` })]; break;
        case "other":
          key = [n.kind, n.text, n.img ? n.img.length : 0, n.w, n.h].join("|");
          build = () => n.kind === "note" ? [el("span", { class: "pv-note-text", text: n.text || "Empty note" })] : n.kind === "reference" ? [n.img ? el("img", { src: n.img, alt: "Reference", class: "pv-ref-img" }) : el("span", { class: "pv-hint", text: "Add an image in the inspector." })] : [];
          break;
        case "output": key = "o"; build = () => [el("span", { text: "what the story map and viewport show" })]; break;
        default: break;
      }
      if (meta._key !== key && build) { meta._key = key; meta.replaceChildren(...build().filter(Boolean)); }
      if (n.type === "other" && n.kind === "group") { c.style.zIndex = 0; }
    },
    ariaLabel: (n) => `${typeTag(n)}: ${title(n)}${!["output", "other"].includes(n.type) && !reach.has(n.id) ? ", not connected to the scene output" : ""}. ${portsOf(n).in.length} inputs, ${portsOf(n).out.length} outputs.`,
    move(start, dx, dy, snap) { store.update(() => { const art = scene()?.art; if (!art) return; for (const n of art.nodes) if (start.has(n.id)) { const [ox, oy] = start.get(n.id); n.x = Math.round((ox + dx) / snap) * snap; n.y = Math.round((oy + dy) / snap) * snap; } }, "move"); },
    canConnect: (a, fp, b, tp) => canConnect(scene().art, a, fp, b, tp),
    pickPort: (n0, pid, side, other) => { const art = scene().art; return side === "out" ? pickPort(art, n0, pid, other) : portsOf(other).out.find((o) => o.type === portsOf(n0).in.find((i) => i.id === pid)?.type)?.id || null; },
    connect: (a, fp, b, tp) => connect(a, fp, b, tp),
    onOpen: (n) => { if (n.type === "script") deps.openScript(scene(), n); },
    onAddMenu: (x, y, world) => deps.addMenu?.(x, y, world),
    onSelectNode: () => {},
  };
  graph = createGraph({ store, vp, adapter });
  const baseSync = graph.sync;
  graph.sync = () => { const sc = scene(); reach = sc ? reachable(sc.art) : new Set(); baseSync(); };
  const baseDispose = adapter.disposeCard; adapter.disposeCard = (id) => { baseDispose?.(id); deps.dropSub?.(sel.open, id); };

  function frustum(cam) { // top-down plan of the shot camera: A and B positions with their field of view
    const W = 120, H = 66, X = (x) => Math.max(4, Math.min(W - 4, 60 + x * 7)), Z = (z) => Math.max(4, Math.min(H - 4, 14 + z * 6));
    const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "pv-frustum", role: "img", "aria-label": `Camera plan: A to B, field of view ${cam.a.fov} degrees`, width: "100%", height: "100%" });
    g.append(svg("circle", { cx: 60, cy: 14, r: 9, class: "fr-scene" }));
    const wedge = (k, cls) => { const ax = X(k.p[0]), az = Z(k.p[2]), tx = X(k.t[0]), tz = Z(k.t[2]), ang = Math.atan2(tz - az, tx - ax), half = (k.fov * Math.PI / 180) / 2 * 0.9, r = 26;
      g.append(svg("path", { d: `M${ax} ${az} L${ax + Math.cos(ang - half) * r} ${az + Math.sin(ang - half) * r} L${ax + Math.cos(ang + half) * r} ${az + Math.sin(ang + half) * r} Z`, class: "fr-wedge " + cls }), svg("circle", { cx: ax, cy: az, r: 2.6, class: "fr-cam " + cls })); };
    wedge(cam.b, "fr-b"); wedge(cam.a, "fr-a");
    g.append(svg("path", { d: `M${X(cam.a.p[0])} ${Z(cam.a.p[2])} L${X(cam.b.p[0])} ${Z(cam.b.p[2])}`, class: "fr-path" }));
    return g;
  }

  // ---- edits -------------------------------------------------------------------------------------------
  function connect(a, fp, b, tp) {
    const sc = scene(); if (!sc) return false;
    const r = canConnect(sc.art, a, fp, b, tp); if (!r.ok) { announce("Cannot connect: " + r.reason); return false; }
    const id = uid("x");
    store.update(() => {
      sc.art.edges.push({ id, from: a.id, fp, to: b.id, tp });
      if (a.type === "script" && b.type === "content") a.char = effectiveRef(sc.art, b); // bind the script to that character
    });
    sel.subEdge = id; sel.sub = []; store.emit("sel"); store.commit();
    announce(`Connected ${title(a)} (${PORT_TYPES[portsOf(a).out.find((p) => p.id === fp).type].label}) to ${title(b)}`);
    return true;
  }
  function del() {
    const sc = scene(); if (!sc) return false;
    if (sel.subEdge) { const id = sel.subEdge; store.update(() => { sc.art.edges = sc.art.edges.filter((e) => e.id !== id); }); sel.subEdge = null; store.emit("sel"); store.commit(); announce("Connection removed"); return true; }
    const ids = sel.sub.filter((id) => sc.art.nodes.find((n) => n.id === id)?.type !== "output"); if (!ids.length) { if (sel.sub.length) announce("The Scene output cannot be deleted."); return false; }
    store.update(() => { for (const id of ids) { const n = sc.art.nodes.find((x) => x.id === id); if (n?.type === "camera") { announce("A camera belongs to a shot; delete the shot to remove it."); continue; } removeSub(sc.art, id); } });
    sel.sub = []; store.fix(); store.emit("all"); store.commit(); announce(`Deleted ${ids.length} sub-node${ids.length > 1 ? "s" : ""}. Undo brings them back.`);
    return true;
  }
  function dup() {
    const sc = scene(); if (!sc) return false;
    const ids = new Set(sel.sub.filter((id) => !["output", "camera"].includes(sc.art.nodes.find((n) => n.id === id)?.type))); if (!ids.size) return false;
    const map = new Map(), made = [];
    store.update(() => {
      for (const n of sc.art.nodes.filter((x) => ids.has(x.id))) { const c = JSON.parse(JSON.stringify(n)); c.id = uid("a"); c.x += 30; c.y += 30; map.set(n.id, c.id); made.push(c); }
      sc.art.nodes.push(...made);
      for (const e of [...sc.art.edges]) if (map.has(e.from) && (map.has(e.to) || sc.art.nodes.find((n) => n.id === e.to)?.type === "output")) sc.art.edges.push({ id: uid("x"), from: map.get(e.from), fp: e.fp, to: map.get(e.to) || e.to, tp: e.tp });
    });
    sel.sub = made.map((n) => n.id); store.emit("sel"); store.commit(); announce(`Duplicated ${made.length}`);
    return true;
  }
  function connectSelected() {
    const sc = scene(); if (!sc || sel.sub.length < 2) { announce("Select two sub-nodes: the first feeds the second."); return false; }
    const a = sc.art.nodes.find((n) => n.id === sel.sub[0]), b = sc.art.nodes.find((n) => n.id === sel.sub[1]);
    const fp = portsOf(a).out[0]?.id, tp = fp && pickPort(sc.art, a, fp, b);
    if (!tp) { announce(`Cannot connect: ${SUB_LABEL[a.type]} has no matching input on ${SUB_LABEL[b.type]}.`); return false; }
    return connect(a, fp, b, tp);
  }
  // Add a sub-node of a type at a world position (or the view centre). Camera adds a shot, which owns its camera node.
  function addSub(type, opts = {}, at = null) {
    const sc = scene(); if (!sc) return null;
    if (type === "camera") { const s = addShot(store, sc.id); announce("Added a shot with its own camera sub-node"); return s; }
    let pos = at;
    if (!pos) { const r = vp.getBoundingClientRect(); pos = graph.toWorld(r.left + r.width / 2, r.top + r.height / 2); pos = [pos[0] - 100, pos[1] - 60]; }
    let [x, y] = [Math.round(pos[0] / 10) * 10, Math.round(pos[1] / 10) * 10];
    while (sc.art.nodes.some((n) => Math.abs(n.x - x) < 20 && Math.abs(n.y - y) < 20)) { x += 30; y += 30; }
    const n = makeSub(type, opts, [x, y]);
    store.update(() => sc.art.nodes.push(n)); sel.sub = [n.id]; sel.subEdge = null; store.emit("sel"); store.commit();
    graph.ensureVisible(n); graph.focusNode(n.id); announce(`Added ${SUB_LABEL[type]}${opts.kind ? " (" + opts.kind + ")" : ""}. Connect its port to use it.`);
    return n;
  }
  return Object.assign(graph, { connect, del, dup, connectSelected, addSub, scene, title,
    open(id) { const n = store.p.nodes.find((x) => x.id === id && x.type === "scene"); if (!n) return false; sel.open = id; sel.nodes = [id]; sel.sub = [outputNode(n.art).id]; sel.subEdge = null; sel.shot = n.shots[0]?.id ?? sel.shot; store.emit("sel"); requestAnimationFrame(() => graph.fit(undefined, { minZ: 0.42 })); return true; },
    close() { if (!sel.open) return; const id = sel.open; sel.open = null; sel.sub = []; sel.subEdge = null; store.emit("sel"); requestAnimationFrame(() => graph.focusNode?.(id)); },
  });
}
