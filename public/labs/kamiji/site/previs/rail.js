// Left navigation rail: Outline, Library, Script, Sources & Exports, Project, Help. Collapsible; pushes the layout on desktop,
// becomes an overlay drawer below 1100px.
import { el, inlineEdit, announce } from "./ui.js";
import { CHARS, PRESETS, LIGHTS, CAM_PRESETS, CHAR_BY_ID } from "./catalog.js";
import { SOURCES, SINKS, STATUS_LABEL, PROVIDERS } from "./nodekinds.js";
import { SUB_LABEL, SUB_TYPES, outputNode, pickPort, canConnect, setLightPreset, defaultLabel, makeSub, uid, portsOf } from "./art.js";
import { reorderScene } from "./ops.js";
import { characters, markerOf, NARRATOR } from "./script.js";
import { timecode, seconds } from "./store.js";

const ICONS = {
  outline: "M4 6h3M10 6h10M7 12h3M13 12h7M10 18h3M16 18h4M4 6v6h3M7 12v6h3",
  library: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  script: "M5 5h14M5 9h9M5 13h14M5 17h8",
  io: "M3 8h9M9 5l3 3-3 3M21 16h-9M15 13l-3 3 3 3",
  project: "M4 7a1 1 0 011-1h5l2 2h7a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1z",
  help: "M12 17v.01M9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 3a9 9 0 100 18 9 9 0 000-18z",
  toggle: "M9 6l6 6-6 6",
};
const icon = (d) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "pv-ico"); const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.append(p); return s; };
const SECTIONS = [["outline", "Outline"], ["library", "Library"], ["script", "Script"], ["io", "Sources & Exports"], ["project", "Project"], ["help", "Help"]];

export function createRail({ root, store, stage, snaps, map, artboard, drawer, io, viewport, transport, pref, cmds, accessories }) {
  const desktop = matchMedia("(min-width: 1100px)");
  const state = { open: pref.get("rail") === "1", section: SECTIONS.some(([k]) => k === pref.get("railsec")) ? pref.get("railsec") : "outline" };
  const expanded = new Set(["g:cut", "g:src", "g:snk"]), of = { q: "", type: "all", status: "all" };
  let focusKey = null, items = [], mobileOpen = false;
  const api = { state };

  // ---- shell -----------------------------------------------------------------------------------------
  const bar = el("div", { class: "pv-rail-bar" }), tablist = el("div", { class: "pv-rail-tabs", role: "tablist", "aria-orientation": "vertical", "aria-label": "Sections" });
  const toggle = el("button", { class: "pv-rail-toggle", type: "button", "aria-label": "Collapse the left rail", "aria-expanded": "true", "aria-controls": "pv-rail-panels", title: "Collapse or expand the rail (B)" }, icon(ICONS.toggle));
  const tabs = {}, panels = {};
  const panelsEl = el("div", { class: "pv-rail-panels", id: "pv-rail-panels" });
  SECTIONS.forEach(([k, label]) => {
    const t = el("button", { class: "pv-rail-tab", type: "button", role: "tab", id: "pv-rt-" + k, "aria-controls": "pv-rp-" + k, "aria-selected": "false", tabindex: "-1", title: label }, icon(ICONS[k]), el("span", { class: "pv-rail-lbl", text: label }));
    t.addEventListener("click", () => { if (state.open && state.section === k && desktop.matches) setOpen(false); else { setSection(k); setOpen(true); } });
    t.addEventListener("keydown", (e) => { const ks = SECTIONS.map(([x]) => x), i = ks.indexOf(k), d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0; if (d) { e.preventDefault(); const nk = ks[(i + d + ks.length) % ks.length]; tabs[nk].focus(); setSection(nk); } else if (e.key === "Home") { e.preventDefault(); tabs[ks[0]].focus(); setSection(ks[0]); } else if (e.key === "End") { e.preventDefault(); tabs[ks.at(-1)].focus(); setSection(ks.at(-1)); } });
    tabs[k] = t; tablist.append(t);
    const pn = el("section", { class: "pv-rail-panel", id: "pv-rp-" + k, role: "tabpanel", "aria-labelledby": "pv-rt-" + k, hidden: true }, el("h2", { class: "pv-rail-h", text: label }));
    panels[k] = pn; panelsEl.append(pn);
  });
  const closeBtn = el("button", { class: "pv-btn pv-btn-sm pv-rail-close", type: "button", text: "Close", onclick: () => setOpen(false) });
  bar.append(toggle, tablist);
  root.append(bar, panelsEl); panelsEl.prepend(closeBtn);
  toggle.addEventListener("click", () => setOpen(!state.open));

  function apply() {
    const open = desktop.matches ? state.open : mobileOpen;
    document.body.dataset.rail = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", open ? "true" : "false"); toggle.setAttribute("aria-label", open ? "Collapse the left rail" : "Expand the left rail");
    document.querySelector("#pv-rail-open")?.setAttribute("aria-expanded", open ? "true" : "false");
    panelsEl.hidden = !open;
    Object.entries(panels).forEach(([k, p]) => { p.hidden = !(open && k === state.section); });
    Object.entries(tabs).forEach(([k, t]) => { const on = k === state.section; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; t.classList.toggle("is-on", on && open); });
    if (open) refresh();
  }
  function setOpen(v) { if (desktop.matches) { state.open = v; pref.set("rail", v ? "1" : "0"); } else mobileOpen = v; apply(); }
  function setSection(k) { state.section = k; pref.set("railsec", k); apply(); }
  api.open = setOpen; api.section = setSection; api.toggle = () => setOpen(!(desktop.matches ? state.open : mobileOpen)); api.isOpen = () => (desktop.matches ? state.open : mobileOpen);
  desktop.addEventListener("change", () => { mobileOpen = false; apply(); });

  // ---- outline -------------------------------------------------------------------------------------
  const ol = panels.outline, olq = el("input", { type: "search", class: "pv-text pv-sm", placeholder: "Filter by name", "aria-label": "Filter the outline" });
  const olType = el("select", { class: "pv-select pv-sm", "aria-label": "Filter by type" }, ...[["all", "All types"], ["scene", "Scenes"], ["branch", "Branches"], ["source", "Imports"], ["sink", "Exports"], ["provider", "Providers (mockup)"], ["chat", "Prompt chats (mockup)"], ...SUB_TYPES.filter((t) => t !== "output").map((t) => ["sub:" + t, "Sub-nodes: " + SUB_LABEL[t]])].map(([v, t]) => el("option", { value: v, text: t })));
  const olStatus = el("select", { class: "pv-select pv-sm", "aria-label": "Filter by status" }, ...[["all", "Any status"], ["draft", "Draft"], ["blocked", "Blocking"], ["approved", "Approved"]].map(([v, t]) => el("option", { value: v, text: t })));
  const olCount = el("p", { class: "pv-rail-count", "aria-live": "polite" });
  const tree = el("div", { class: "pv-tree", role: "tree", "aria-label": "Project outline" });
  ol.append(el("div", { class: "pv-rail-tools" }, olq, el("div", { class: "pv-rail-row" }, olType, olStatus)), olCount, tree);
  olq.addEventListener("input", () => { of.q = olq.value.trim().toLowerCase(); renderTree(); });
  olType.addEventListener("change", () => { of.type = olType.value; renderTree(); }); olStatus.addEventListener("change", () => { of.status = olStatus.value; renderTree(); });
  const subTitle = (sc, s) => (artboard.title ? (artboard.scene && sc ? subLabel(sc, s) : "") : "");
  function subLabel(sc, s) {
    switch (s.type) {
      case "model": return CHAR_BY_ID.get(s.ref)?.label || s.ref; case "content": return s.label || (s.kind === "background" ? "Background" : defaultLabel(s.ref)); case "control": return s.label || `${s.kind}${s.value ? ": " + s.value : ""}`;
      case "script": return s.label || "Script: " + (s.char === NARRATOR ? "narrator" : defaultLabel(s.char)); case "camera": return s.label || `Camera: shot ${sc.shots.findIndex((x) => x.id === s.shot) + 1}`; case "light": return s.label || "Light: " + (LIGHTS[s.preset] || s.preset);
      case "audio": return s.label || s.text || "Audio"; case "other": return s.label || (s.kind === "group" ? s.text : s.kind) || "Other"; default: return "Scene output";
    }
  }
  function buildItems() {
    const p = store.p, d = store.d, out = [], q = of.q, tf = of.type, sf = of.status, filtering = !!q || tf.startsWith("sub:");
    const nameOk = (s) => !q || s.toLowerCase().includes(q), statOk = (n) => sf === "all" || n.status === sf;
    const flowOk = (n) => (tf === "all" || tf === n.type) && nameOk(n.name) && (n.type !== "scene" || statOk(n));
    const subTypeF = tf.startsWith("sub:") ? tf.slice(4) : null;
    const groups = [["g:src", "Imports", p.nodes.filter((n) => n.type === "source")], ["g:cut", "Cut order", d.order], ["g:alt", "Alternates (not in the cut)", p.nodes.filter((n) => (n.type === "scene" || n.type === "branch") && !d.inCut.has(n.id))], ["g:gen", "Generation (mockup)", p.nodes.filter((n) => n.type === "chat" || n.type === "provider")], ["g:snk", "Exports", p.nodes.filter((n) => n.type === "sink")]];
    let ns = 0, nsub = 0;
    for (const [gk, glabel, nodes] of groups) {
      const rows = [];
      for (const n of nodes) {
        const subs = n.type === "scene" ? n.art.nodes.filter((s) => s.type !== "output" && (!subTypeF || s.type === subTypeF) && nameOk(subLabel(n, s))) : [];
        const selfOk = !subTypeF && flowOk(n), kidOk = (filtering && subs.length) || false;
        if (!(selfOk || kidOk)) continue;
        if (n.type === "scene") { ns++; nsub += n.art.nodes.length; }
        rows.push({ n, subs: n.type !== "scene" ? [] : (subTypeF || q) ? subs : n.art.nodes.filter((s) => s.type !== "output").sort((a, b) => SUB_TYPES.indexOf(a.type) - SUB_TYPES.indexOf(b.type)), exp: filtering || expanded.has("n:" + n.id) });
      }
      if (!rows.length && (filtering || ["g:alt", "g:src", "g:snk", "g:gen"].includes(gk))) continue;
      const gexp = filtering || expanded.has(gk);
      out.push({ key: gk, level: 1, label: glabel, meta: String(rows.length), group: true, exp: gexp, has: rows.length > 0 });
      if (gexp) for (const r of rows) {
        const n = r.n, has = n.type === "scene" && r.subs.length > 0;
        out.push({ key: "n:" + n.id, level: 2, label: n.name, tag: n.type === "scene" ? n.status : n.type === "branch" ? "branch" : n.type === "source" ? "import" : n.type === "provider" ? "provider" : n.type === "chat" ? "chat" : "export", meta: n.type === "scene" ? `${n.shots.length} sh` : "", node: n, has, exp: r.exp, kind: "node" });
        if (has && r.exp) for (const s of r.subs) out.push({ key: `s:${n.id}:${s.id}`, level: 3, label: subLabel(n, s), tag: s.type === "content" ? s.kind : s.type, node: n, sub: s, kind: "sub" });
      }
    }
    olCount.textContent = `${ns} scenes · ${nsub} sub-nodes · ${p.nodes.filter((n) => n.type === "source").length} imports · ${p.nodes.filter((n) => n.type === "sink").length} exports`;
    return out;
  }
  const isSelected = (it) => (it.kind === "node" ? (store.sel.open ? store.sel.open === it.node.id : store.sel.nodes.includes(it.node.id)) : it.kind === "sub" ? store.sel.open === it.node.id && store.sel.sub.includes(it.sub.id) : false);
  function renderTree() {
    items = buildItems(); const keep = document.activeElement?.closest?.(".pv-tree") ? document.activeElement.dataset.key : null;
    if (!items.some((i) => i.key === focusKey)) focusKey = items.find((i) => isSelected(i))?.key || items[0]?.key || null;
    tree.replaceChildren(...items.map((it, idx) => {
      const sel = isSelected(it);
      const row = el("div", { class: `pv-ti l${it.level}${sel ? " is-sel" : ""}${it.group ? " is-group" : ""}`, role: "treeitem", "aria-level": it.level, "aria-selected": it.group ? null : sel ? "true" : "false", "aria-expanded": it.has ? (it.exp ? "true" : "false") : null,
        tabindex: it.key === focusKey ? "0" : "-1", "data-key": it.key, draggable: it.group ? null : "true", "aria-label": `${it.label}${it.tag ? ", " + it.tag : ""}${it.meta ? ", " + it.meta : ""}` });
      const chev = el("button", { class: "pv-ti-chev" + (it.has ? "" : " is-empty"), type: "button", tabindex: "-1", "aria-hidden": "true", text: it.has ? (it.exp ? "▾" : "▸") : "", onclick: (e) => { e.stopPropagation(); toggleExp(it); } });
      row.append(...[chev, it.tag ? el("span", { class: "pv-ti-tag", "data-t": it.tag, text: it.tag }) : null, el("span", { class: "pv-ti-lbl", text: it.label }), it.meta ? el("span", { class: "pv-ti-meta", text: it.meta }) : null].filter(Boolean));
      return row;
    }));
    if (keep) tree.querySelector(`[data-key="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
  }
  function toggleExp(it, to) { const k = it.group ? it.key : "n:" + it.node.id, v = to ?? !expanded.has(k); v ? expanded.add(k) : expanded.delete(k); renderTree(); }
  function select(it, { open = false } = {}) {
    if (it.group) { toggleExp(it); return; }
    if (it.kind === "node") {
      if (store.sel.open && store.sel.open !== it.node.id) artboard.close(); else if (store.sel.open && !open) artboard.close();
      store.select([it.node.id]); requestAnimationFrame(() => map.centreOn(it.node));
      if (open && it.node.type === "scene") artboard.open(it.node.id);
    } else {
      if (store.sel.open !== it.node.id) artboard.open(it.node.id);
      store.sel.sub = [it.sub.id]; store.sel.subEdge = null; store.emit("sel"); requestAnimationFrame(() => requestAnimationFrame(() => artboard.centreOn(it.sub)));
    }
  }
  tree.addEventListener("click", (e) => { const r = e.target.closest(".pv-ti"); if (!r) return; focusKey = r.dataset.key; select(items.find((i) => i.key === r.dataset.key)); });
  tree.addEventListener("dblclick", (e) => { const r = e.target.closest(".pv-ti"), it = r && items.find((i) => i.key === r.dataset.key); if (it?.kind === "node") select(it, { open: true }); });
  tree.addEventListener("keydown", (e) => {
    const r = e.target.closest(".pv-ti"); if (!r) return; const i = items.findIndex((x) => x.key === r.dataset.key), it = items[i], focusAt = (j) => { const t = items[Math.max(0, Math.min(items.length - 1, j))]; if (!t) return; focusKey = t.key; tree.querySelectorAll(".pv-ti").forEach((x) => (x.tabIndex = x.dataset.key === t.key ? 0 : -1)); tree.querySelector(`[data-key="${CSS.escape(t.key)}"]`)?.focus(); };
    if (e.key === "ArrowDown") { e.preventDefault(); focusAt(i + 1); } else if (e.key === "ArrowUp") { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusAt(0); } else if (e.key === "End") { e.preventDefault(); focusAt(items.length - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); if (it.has && !it.exp) toggleExp(it, true); else if (it.has) focusAt(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (it.has && it.exp && !filteringNow()) toggleExp(it, false); else { let j = i - 1; while (j >= 0 && items[j].level >= it.level) j--; if (j >= 0) focusAt(j); } }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (it.group) toggleExp(it); else { const again = isSelected(it) && it.kind === "node" && it.node.type === "scene"; select(it, { open: again }); } }
    else if (e.key === "F2") { e.preventDefault(); rename(it, r); }
  });
  const filteringNow = () => !!of.q || of.type.startsWith("sub:");
  function rename(it, row) {
    if (it.group || (it.kind === "sub" && ["model", "output"].includes(it.sub.type))) return;
    inlineEdit(row.querySelector(".pv-ti-lbl"), it.label, (v) => { store.update(() => { if (it.kind === "node") it.node.name = v; else if (it.sub.type === "other" && it.sub.kind === "group") it.sub.text = v; else it.sub.label = v; }, "all"); store.commit(); });
  }
  // drag: scenes reorder; sub-nodes reparent (connect) when the typing rules allow
  tree.addEventListener("dragstart", (e) => { const r = e.target.closest(".pv-ti"); if (!r) return; const it = items.find((i) => i.key === r.dataset.key); e.dataTransfer.setData("application/x-previs-tree", JSON.stringify({ key: it.key })); e.dataTransfer.effectAllowed = "move"; tree._drag = it; });
  tree.addEventListener("dragend", () => { tree._drag = null; tree.querySelectorAll(".drop-before,.drop-after,.drop-into,.drop-bad").forEach((x) => x.classList.remove("drop-before", "drop-after", "drop-into", "drop-bad")); });
  const dropMode = (e, row) => { const it = items.find((i) => i.key === row.dataset.key), src = tree._drag; if (!src || !it || it === src) return null; const b = row.getBoundingClientRect(), upper = e.clientY < b.top + b.height / 2;
    if (src.kind === "node" && it.kind === "node" && src.node.type !== "source" && src.node.type !== "sink" && it.node.type !== "source" && it.node.type !== "sink") return upper ? "before" : "after";
    if (src.kind === "sub" && it.kind === "sub" && src.node === it.node) { const art = src.node.art, pp = pickPort(art, src.sub, "out", it.sub); return pp && canConnect(art, src.sub, "out", it.sub, pp).ok || pp ? "into" : "bad"; }
    return "bad"; };
  tree.addEventListener("dragover", (e) => { const row = e.target.closest(".pv-ti"); if (!row || !tree._drag) return; const m = dropMode(e, row); tree.querySelectorAll(".drop-before,.drop-after,.drop-into,.drop-bad").forEach((x) => x.classList.remove("drop-before", "drop-after", "drop-into", "drop-bad")); if (!m) return; row.classList.add("drop-" + m); if (m !== "bad") e.preventDefault(); });
  tree.addEventListener("drop", (e) => {
    const row = e.target.closest(".pv-ti"); if (!row || !tree._drag) return; const m = dropMode(e, row), src = tree._drag, it = items.find((i) => i.key === row.dataset.key); e.preventDefault();
    if (m === "before" || m === "after") { const r = reorderScene(store, src.node.id, it.node.id, m === "after"); announce(r.ok ? `${src.node.name} moved ${m} ${it.node.name} in the cut` : r.why); }
    else if (m === "into") {
      const art = src.node.art, fp = "out", tp = pickPort(art, src.sub, fp, it.sub), res = tp ? canConnect(art, src.sub, fp, it.sub, tp) : { ok: false, reason: "no matching port" };
      if (!res.ok) { announce(`Cannot move ${src.label} under ${it.label}: ${res.reason}`); return; }
      store.update(() => { art.edges = art.edges.filter((x) => !(x.from === src.sub.id)); art.edges.push({ id: uid("x"), from: src.sub.id, fp, to: it.sub.id, tp }); }); store.commit(); announce(`${src.label} now feeds ${it.label}`);
    } else if (src && it) announce(src.kind === "sub" && it.kind === "sub" && src.node !== it.node ? "Sub-nodes can only be reconnected inside their own scene." : "That drop is not allowed here.");
  });

  // ---- library ---------------------------------------------------------------------------------------
  const lib = panels.library; let libBuilt = false;
  const io_ = new IntersectionObserver((es) => { for (const x of es) if (x.isIntersecting) { const t = x.target; io_.unobserve(t); t._load?.(); } }, { root: panelsEl, rootMargin: "100px" });
  function tile(label, { drag, spec, key, onAdd, glyph }) {
    const t = el("button", { class: "pv-lib-tile", type: "button", draggable: "true", title: `${label}: click or press Enter to add, or drag onto the map or artboard`, "data-lib": drag.type + ":" + drag.id }, el("span", { class: "pv-lib-th" }, glyph ? el("span", { class: "pv-lib-g", text: glyph }) : null), el("span", { class: "pv-lib-l", text: label }));
    t.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-previs-lib", JSON.stringify(drag)); e.dataTransfer.effectAllowed = "copy"; });
    t.addEventListener("click", () => onAdd?.());
    if (spec && stage) t._load = () => { const url = snaps.get(key, spec, () => paint()); if (url) paint(); function paint() { const u = snaps.cache.get(key); if (u) { const th = t.querySelector(".pv-lib-th"); th.replaceChildren(el("img", { src: u, alt: "", draggable: "false" })); } } }, io_.observe(t);
    return t;
  }
  function buildLibrary() {
    if (libBuilt) return; libBuilt = true;
    const sec = (title, tiles, open = false) => el("details", { class: "pv-lib-sec", open: open || null }, el("summary", { text: title + ` (${tiles.length})` }), el("div", { class: "pv-lib-grid" }, ...tiles));
    const chars = (g, kind) => CHARS.filter((c) => c.group === g).map((c) => tile(c.label.replace(/^(Kamikin|Rubbernose) /, ""), { drag: { type: kind, id: c.id }, key: "c:" + c.id, spec: { cast: [{ ref: c.id }], cam: c.rigged ? "Close" : "Front" }, onAdd: () => place({ type: kind, id: c.id }) }));
    lib.append(el("p", { class: "pv-rail-note", text: "Drag a tile onto the story map or an open artboard, or press Enter on it. Thumbnails are cached renders, not live." }),
      sec("Characters: Kamiji hand", chars("Kamiji", "char"), true), sec("Characters: Kamikin", chars("Kamikin", "char")), sec("Characters: Rubbernose", chars("Rubbernose", "char")),
      sec("Props", [...chars("Objects", "prop"), ...chars("Emote props", "prop")]), sec("Shapes", chars("Shapes", "shape")),
      sec("Scene presets", PRESETS.map((p) => tile(p.label, { drag: { type: "scene", id: p.id }, key: "p:" + p.id, spec: { cast: p.cast, bg: p.bg, light: p.light, cam: p.cast.length > 1 ? "Wide" : "Front" }, onAdd: () => place({ type: "scene", id: p.id }) }))),
      sec("Light presets", Object.entries(LIGHTS).map(([id, label]) => tile(label, { drag: { type: "light", id }, key: "l:" + id, spec: { cast: [{ ref: "mochi/kumo" }], light: id, bg: id === "dusk" ? "#8b8a84" : "#e7e6e1" }, onAdd: () => place({ type: "light", id }) }))),
      sec("Camera presets", CAM_PRESETS.map((c) => tile(c, { drag: { type: "cam", id: c }, glyph: c, onAdd: () => { viewport.applyPreset(c); announce(`Viewport camera: ${c}`); } }))));
    const accSec = el("details", { class: "pv-lib-sec" }, el("summary", { text: "Accessories" }), el("div", { class: "pv-lib-grid" })); lib.append(accSec);
    accessories?.().then((list) => { const g = accSec.querySelector(".pv-lib-grid"); accSec.querySelector("summary").textContent = `Accessories (${list.length})`; list.forEach((a) => g.append(tile(a.label, { drag: { type: "acc", id: a.id }, key: "a:" + a.id, spec: { cast: [{ ref: "mochi/kumo", acc: a.id }], cam: "Close" }, onAdd: () => place({ type: "acc", id: a.id }) }))); });
  }
  // place a library item on the story map or the open artboard
  function place(item, at = null) {
    const open = store.sel.open && artboard.scene();
    if (!open) {
      if (item.type === "scene") return map.addNode(item.id, at);
      if (["char", "prop", "shape"].includes(item.type)) return map.addNode("ref:" + item.id, at);
      if (item.type === "source" || item.type === "sink") return map.addNode(item.type + ":" + item.id, at);
      if (item.type === "gen") return map.addNode(item.id === "chat" ? "chat:prompt" : "provider:" + item.id, at);
      if (item.type === "light") { const n = store.p.nodes.find((x) => x.id === store.sel.nodes[0] && x.type === "scene"); if (n) { store.update(() => setLightPreset(n, item.id)); store.commit(); announce(`Light "${LIGHTS[item.id]}" applied to ${n.name}`); } else announce("Select a scene first, then press Enter on a light preset."); return; }
      announce("Open a scene's artboard (double-click it) to place accessories."); return;
    }
    const out = outputNode(open.art), conn = (s, tp) => { if (s && out && canConnect(open.art, s, "out", out, tp).ok) artboard.connect(s, "out", out, tp); };
    if (["char", "prop", "shape"].includes(item.type)) { const kind = item.type === "char" ? "character" : item.type; const s = artboard.addSub("content", { kind, ref: item.id }, at ? [at[0] - 110, at[1] - 80] : null); conn(s, "scene"); return s; }
    if (item.type === "acc") return artboard.addSub("content", { kind: "accessory", acc: item.id, label: item.id.replace(/_/g, " ") }, at ? [at[0] - 100, at[1] - 40] : null);
    if (item.type === "light") { const s = artboard.addSub("light", { preset: item.id }, at ? [at[0] - 80, at[1] - 40] : null); conn(s, "light"); return s; }
    announce("Scene presets and import / export nodes belong on the story map. Close the artboard first.");
  }
  api.place = place;
  for (const vp of [map.vp, artboard.vp]) {
    vp.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("application/x-previs-lib")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; vp.classList.add("is-droptarget"); } });
    vp.addEventListener("dragleave", () => vp.classList.remove("is-droptarget"));
    vp.addEventListener("drop", (e) => { const raw = e.dataTransfer?.getData("application/x-previs-lib"); vp.classList.remove("is-droptarget"); if (!raw) return; e.preventDefault(); const item = JSON.parse(raw); place(item, (vp === artboard.vp ? artboard : map).toWorld(e.clientX, e.clientY)); });
  }

  // ---- script ----------------------------------------------------------------------------------------
  const sp = panels.script, spList = el("div", { class: "pv-rail-list" });
  sp.append(el("p", { class: "pv-rail-note", text: "Every line, by character, in story order. The drawer edits the same lines as the Script sub-nodes, the timeline and the storyboard." }), el("button", { class: "pv-btn pv-btn-primary", type: "button", text: "Open Script drawer (S)", onclick: () => drawer.show({}) }), spList);
  function renderScript() {
    const cs = characters(store); spList.replaceChildren(...cs.map((c) => { const mk = markerOf(cs, c.id), av = c.id !== NARRATOR ? snaps.get("c:" + c.id, { cast: [{ ref: c.id }], cam: "Close" }, () => renderScript()) : null;
      return el("button", { class: "pv-rail-item", type: "button", title: c.scenes.join(", "), onclick: () => drawer.show({ char: c.id }) }, av ? el("img", { class: "pv-av", src: av, alt: "" }) : el("span", { class: "pv-mk pv-mk-" + mk.shape, "aria-hidden": "true", text: mk.initial }), el("span", { class: "pv-ri-l", text: c.name }), el("span", { class: "pv-ri-m", text: `${c.lines} lines` })); }));
  }

  // ---- sources & exports --------------------------------------------------------------------------------
  const ip = panels.io, ipHist = el("ol", { class: "pv-rail-hist" });
  const palette = (title, defs, type) => el("details", { class: "pv-lib-sec", open: true }, el("summary", { text: title }), el("div", { class: "pv-pal" }, ...Object.entries(defs).map(([k, d]) => {
    const b = el("button", { class: "pv-pal-i", type: "button", draggable: "true", title: d.note, "data-pal": type + ":" + k }, el("span", { class: "pv-pal-n", text: d.label }), el("span", { class: "pv-badge", "data-s": d.status, text: STATUS_LABEL[d.status] }));
    b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-previs-lib", JSON.stringify({ type, id: k })); e.dataTransfer.effectAllowed = "copy"; }); b.addEventListener("click", () => place({ type, id: k })); return b; })));
  ip.append(el("p", { class: "pv-rail-note", text: "Import nodes start the graph, export nodes end it. Everything runs in your browser; nothing is uploaded." }), palette("Import (source nodes)", SOURCES, "source"), palette("Generation (mockup: simulated)", { chat: { label: "Prompt chat", status: "mockup", note: "Mockup. A scripted chat that drives a provider node." }, ...Object.fromEntries(Object.entries(PROVIDERS).map(([k, d]) => [k, { label: d.label, status: "mockup", note: d.note }])) }, "gen"), palette("Export and publish (sink nodes)", SINKS, "sink"), el("h3", { class: "pv-rail-sub", text: "Recent activity" }), ipHist);
  function renderIO() {
    const ev = [];
    for (const n of store.p.nodes) { if (n.type === "sink" && n.last?.at) ev.push({ at: n.last.at, t: `${n.name}: ${n.last.msg}`, ok: n.last.ok }); if (n.type === "source" && n.info?.at) ev.push({ at: n.info.at, t: `${n.name}: ${n.info.summary}`, ok: true }); }
    ev.sort((a, b) => b.at.localeCompare(a.at)); ipHist.replaceChildren(...(ev.length ? ev.slice(0, 8).map((x) => el("li", { class: x.ok ? "" : "is-err" }, el("time", { text: x.at.slice(11, 19) }), " ", x.t)) : [el("li", { class: "pv-hint", text: "Nothing imported or exported in this project yet." })]));
  }

  // ---- project ---------------------------------------------------------------------------------------
  const pp = panels.project, nameIn = el("input", { type: "text", class: "pv-text", maxlength: 80, "aria-label": "Project name" }), fpsS = el("select", { class: "pv-select", "aria-label": "Frame rate" }, ...[24, 25, 30].map((v) => el("option", { value: v, text: v + " fps" })));
  const saveSt = el("p", { class: "pv-hint", id: "pv-rail-save" }), histEl = el("ol", { class: "pv-rail-hist pv-undo" });
  nameIn.addEventListener("input", () => store.update((p) => { p.name = nameIn.value.slice(0, 80); }, "name")); nameIn.addEventListener("change", () => store.commit());
  fpsS.addEventListener("change", () => { store.update((p) => { p.fps = +fpsS.value; }); store.commit(); });
  const cbtn = (t, c, cls = "") => el("button", { class: "pv-btn pv-btn-sm " + cls, type: "button", "data-cmd": c, text: t });
  pp.append(el("label", { class: "pv-field pv-field-col" }, el("span", { class: "pv-lbl", text: "Name" }), nameIn), el("label", { class: "pv-field pv-field-col" }, el("span", { class: "pv-lbl", text: "Frame rate" }), fpsS),
    el("div", { class: "pv-btnrow" }, cbtn("New", "new"), cbtn("Open / Import", "import"), cbtn("Export", "export"), cbtn("Sample", "sample")), saveSt,
    el("h3", { class: "pv-rail-sub", text: "Undo history (newest first)" }), el("div", { class: "pv-btnrow" }, cbtn("Undo", "undo"), cbtn("Redo", "redo")), histEl);
  function renderProject() {
    if (document.activeElement !== nameIn) nameIn.value = store.p.name; fpsS.value = String(store.p.fps);
    saveSt.textContent = document.querySelector("#pv-save")?.textContent || "";
    const list = store.historyList(12); histEl.replaceChildren(...(list.length ? list.map((h) => el("li", {}, el("button", { class: "pv-linkbtn", type: "button", title: `Undo ${h.undoSteps} step${h.undoSteps > 1 ? "s" : ""} to before this`, text: h.label, onclick: () => { for (let i = 0; i < h.undoSteps; i++) store.undo(); announce(`Went back ${h.undoSteps} step${h.undoSteps > 1 ? "s" : ""}`); } }))) : [el("li", { class: "pv-hint", text: "No edits yet." })]));
    pp.querySelectorAll("[data-cmd=undo]").forEach((b) => (b.disabled = !store.canUndo)); pp.querySelectorAll("[data-cmd=redo]").forEach((b) => (b.disabled = !store.canRedo));
  }

  // ---- help ------------------------------------------------------------------------------------------
  panels.help.append(el("p", { class: "pv-rail-note", text: "Previs is a prototype. A short guide:" }), el("dl", { class: "pv-rail-keys" },
    ...[["Space", "Play / pause"], ["S", "Script drawer"], ["B", "This rail"], ["N", "Add node menu"], ["Enter", "Open a selected scene (artboard)"], ["C", "Connect"], ["F", "Fit"], ["Cmd/Ctrl+Z", "Undo"], ["?", "All shortcuts"]].flatMap(([k, d]) => [el("dt", {}, el("kbd", { text: k })), el("dd", { text: d })])),
    el("button", { class: "pv-btn pv-btn-sm", type: "button", text: "All keyboard shortcuts", onclick: () => cmds.help() }),
    el("h3", { class: "pv-rail-sub", text: "Intended vs what works today" }),
    el("p", { class: "pv-hint", text: "Works: story map, artboards with typed sub-nodes, timeline, storyboard, script drawer, imports and file exports, undo, autosave in this browser." }),
    el("p", { class: "pv-hint", text: "Stubs and gaps: no audio playback, dissolve plays as a cut, most control kinds are stored but not rendered, Godot / Unreal / share link are planned." }), el("a", { class: "pv-link", href: "#status", text: "Read the full note" }));

  // ---- refresh ---------------------------------------------------------------------------------------
  function refresh() {
    if (!api.isOpen()) return;
    if (state.section === "outline") renderTree(); else if (state.section === "library") buildLibrary(); else if (state.section === "script") renderScript(); else if (state.section === "io") renderIO(); else if (state.section === "project") renderProject();
  }
  let q = 0; store.on(() => { if (!api.isOpen() || q) return; q = setTimeout(() => { q = 0; if (state.section === "outline" && document.activeElement?.closest?.(".pv-tree") && document.activeElement.querySelector?.(".pv-inline")) return; refresh(); }, 60); });
  io.onChange(() => { if (state.section === "io") renderIO(); });
  api.refresh = refresh; api.focusTree = () => tree.querySelector("[tabindex='0']")?.focus();
  apply();
  return api;
}
