// The Script drawer: every script line in the project, organised by character, in story order. Edits the same lines as the
// Script sub-nodes, the timeline Dialogue track and the storyboard caption / dialogue fields.
import { el, dragReorder, announce, clamp } from "./ui.js";
import { characters, orderedLines, charName, markerOf, addLine, patchLine, deleteLine, moveLine, findLine, NARRATOR, KINDS, STATUSES, words, WPS, toMarkdown, toFountain, toText } from "./script.js";
import { download } from "./io.js";
import { timecode } from "./store.js";

export function createDrawer({ store, root, transport, printHost, pref, deps }) {
  const list = root.querySelector(".pv-sc-list"), chipsEl = root.querySelector(".pv-sc-chars"), stats = root.querySelector(".pv-sc-stats");
  const q = root.querySelector(".pv-sc-q"), sceneSel = root.querySelector(".pv-sc-scene"), byBtn = root.querySelector("[data-sc=by]");
  const addChar = root.querySelector(".pv-sc-addchar"), addKind = root.querySelector(".pv-sc-addkind"), addText = root.querySelector(".pv-sc-addtext");
  const f = { char: "all", node: "all", q: "", byScene: false };
  const rows = new Map(); // line id -> li
  let open = false, opener = null;
  const api = { get isOpen() { return open; }, filter: f };

  // ---- open / close / resize ------------------------------------------------------------------------
  function setOpen(v, focus = true) {
    open = v; root.hidden = !v; document.body.classList.toggle("has-drawer", v);
    document.querySelector("[data-cmd=script]")?.setAttribute("aria-expanded", v ? "true" : "false");
    if (v) { opener = document.activeElement; render(); if (focus) (root.querySelector(".pv-sc-chip[aria-selected=true]") || q).focus(); }
    else if (focus && root.contains(document.activeElement)) (opener && document.contains(opener) ? opener : document.querySelector("[data-cmd=script]"))?.focus();
    pref.set("drawer", v ? "1" : "0");
  }
  const w0 = +pref.get("drawerw") || 380;
  document.body.style.setProperty("--drawer-w", clamp(w0, 280, 640) + "px");
  const grip = root.querySelector(".pv-drawer-grip");
  const setW = (w) => { w = clamp(Math.round(w), 280, 640); document.body.style.setProperty("--drawer-w", w + "px"); grip.setAttribute("aria-valuenow", w); pref.set("drawerw", String(w)); };
  grip.addEventListener("pointerdown", (e) => { grip.setPointerCapture(e.pointerId); const mv = (ev) => setW(innerWidth - ev.clientX - 12), up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); }; grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
  grip.addEventListener("keydown", (e) => { const cur = parseInt(getComputedStyle(document.body).getPropertyValue("--drawer-w")) || 380; if (e.key === "ArrowLeft") { e.preventDefault(); setW(cur + 24); } else if (e.key === "ArrowRight") { e.preventDefault(); setW(cur - 24); } });
  root.querySelector("[data-sc=close]").addEventListener("click", () => setOpen(false));
  root.addEventListener("keydown", (e) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); setOpen(false); } });

  // ---- filters ---------------------------------------------------------------------------------------
  q.addEventListener("input", () => { f.q = q.value.trim().toLowerCase(); render(); });
  sceneSel.addEventListener("change", () => { f.node = sceneSel.value; render(); });
  byBtn.addEventListener("click", () => { f.byScene = !f.byScene; byBtn.setAttribute("aria-pressed", f.byScene ? "true" : "false"); render(); });
  api.focusLine = (id) => { const li = rows.get(id); li?.scrollIntoView({ block: "nearest" }); li?.querySelector("textarea")?.focus(); };
  api.show = ({ char = "all", node = "all", line = null } = {}) => { f.char = char; f.node = node; f.q = ""; q.value = ""; setOpen(true, !line); render(); if (line) requestAnimationFrame(() => api.focusLine(line)); };
  api.open = setOpen; api.toggle = () => setOpen(!open);

  // ---- exports ---------------------------------------------------------------------------------------
  const fname = (ext) => (store.p.name || "script").replace(/[^\w.-]+/g, "-").toLowerCase() + "." + ext;
  root.querySelector("[data-sc=md]").addEventListener("click", () => { download(fname("md"), toMarkdown(store), "text/markdown"); announce("Script exported as Markdown"); });
  root.querySelector("[data-sc=fountain]").addEventListener("click", () => { download(fname("fountain"), toFountain(store), "text/plain"); announce("Script exported as Fountain"); });
  root.querySelector("[data-sc=txt]").addEventListener("click", () => { download(fname("txt"), toText(store), "text/plain"); announce("Script exported as plain text"); });
  root.querySelector("[data-sc=print]").addEventListener("click", () => api.print());
  api.print = () => {
    const p = store.p, rows_ = orderedLines(store).filter((r) => r.line.status !== "cut"); printHost.replaceChildren(); printHost.dataset.kind = "script";
    printHost.append(el("header", { class: "pb-head" }, el("h1", { text: p.name }), el("p", { text: `Script · story order · ${rows_.length} lines · Previs prototype` })));
    let scene = "\u0000", shot = "\u0000";
    for (const r of rows_) {
      const sn = r.node?.name || "Unassigned"; if (sn !== scene) { scene = sn; printHost.append(el("h2", { class: "ps-scene", text: sn })); shot = "\u0000"; }
      const sk = r.shot ? `Shot ${r.n} · ${r.shot.type} · ${r.tc}` : "Whole scene"; if (sk !== shot) { shot = sk; printHost.append(el("h3", { class: "ps-shot", text: sk })); }
      const l = r.line; printHost.append(l.kind === "dialogue" ? el("p", { class: "ps-dlg" }, el("b", { text: charName(p, l.char).toUpperCase() }), el("span", { text: l.text })) : el("p", { class: l.kind === "paren" ? "ps-paren" : "ps-act", text: l.text }));
    }
    window.print();
  };

  // ---- rendering -------------------------------------------------------------------------------------
  function chars() { return characters(store); }
  function renderChips(cs) {
    const total = store.p.script.lines.length;
    const items = [{ id: "all", name: "All characters", lines: total }, ...cs];
    const key = JSON.stringify(items.map((c) => [c.id, c.name, c.lines])) + f.char;
    if (chipsEl._key === key) return; chipsEl._key = key; chipsEl.replaceChildren();
    items.forEach((c) => {
      const mk = c.id === "all" ? null : markerOf(cs, c.id), sel = f.char === c.id;
      const av = c.id !== "all" && c.id !== NARRATOR && deps.avatar ? deps.avatar(c.id, () => { chipsEl._key = ""; render(); }) : null;
      const b = el("button", { class: "pv-sc-chip", type: "button", role: "option", "aria-selected": sel ? "true" : "false", tabindex: sel ? "0" : "-1", "data-char": c.id, title: c.id === "all" ? "Every line in story order" : `${c.name}: ${c.lines} lines, ${c.scenes?.length || 0} scenes` },
        mk ? (av ? el("img", { class: "pv-av", src: av, alt: "" }) : el("span", { class: "pv-mk pv-mk-" + mk.shape, "aria-hidden": "true", text: mk.initial })) : el("span", { class: "pv-mk pv-mk-all", "aria-hidden": "true", text: "∗" }),
        el("span", { class: "pv-chip-n", text: c.name }), el("span", { class: "pv-chip-c", text: String(c.lines) }));
      b.addEventListener("click", () => { f.char = c.id; render(); });
      chipsEl.append(b);
    });
  }
  chipsEl.addEventListener("keydown", (e) => {
    const bs = [...chipsEl.querySelectorAll(".pv-sc-chip")], i = bs.indexOf(document.activeElement); if (i < 0) return;
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0; if (!d) return;
    e.preventDefault(); const nb = bs[(i + d + bs.length) % bs.length]; bs.forEach((b) => (b.tabIndex = -1)); nb.tabIndex = 0; nb.focus();
  });
  function renderStats(cs) {
    const c = cs.find((x) => x.id === f.char); stats.replaceChildren();
    if (!c) { const n = store.p.script.lines.filter((l) => l.status !== "cut"), w = n.reduce((a, l) => a + words(l.text), 0); stats.append(el("span", { text: `${cs.length} characters · ${store.p.script.lines.length} lines · ${w} words` })); return; }
    stats.append(el("b", { text: c.name }), el("span", { text: ` ${c.lines} lines · ${c.words} words · about ${Math.round(c.secs)} s spoken · ` }), el("span", { text: c.scenes.length ? c.scenes.join(", ") : "not in a scene yet" }));
    if (c.id !== NARRATOR) { const rn = el("button", { class: "pv-linkbtn", type: "button", text: "Rename", onclick: () => renameChar(c) }); stats.append(" ", rn); }
  }
  function renameChar(c) {
    const input = el("input", { type: "text", class: "pv-inline", value: c.name, maxlength: 40, "aria-label": "Character name" }); stats.replaceChildren(input); input.focus(); input.select();
    const end = (ok) => { const v = input.value.trim(); if (ok && v) { store.update((p) => { p.script.names[c.id] = v; const cc = p.script.cast.find((x) => x.id === c.id); if (cc) cc.name = v; }, "script"); store.commit(); } render(); };
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") end(true); else if (e.key === "Escape") end(false); }); input.addEventListener("blur", () => end(true));
  }
  function make(r, cs) {
    const id = r.line.id;
    const li = el("li", { class: "pv-line", "data-id": id });
    const grip = el("button", { class: "pv-line-grip", type: "button", "aria-label": "Drag to reorder (Alt+Up or Down with this focused)", title: "Drag to reorder", text: "☰" });
    grip.addEventListener("keydown", (e) => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); const vis = visibleRows(), i = vis.findIndex((x) => x.line.id === id), t = vis[i + (e.key === "ArrowUp" ? -1 : 2)]; const ok = e.key === "ArrowUp" ? i > 0 && moveLine(store, id, vis[i - 1].line.id) : i < vis.length - 1 && moveLine(store, id, null, vis[i + 1].line.id); if (ok) { store.commit(); announce("Line moved"); requestAnimationFrame(() => rows.get(id)?.querySelector(".pv-line-grip")?.focus()); } } });
    const mk = el("span", { class: "pv-mk", "aria-hidden": "true" });
    const charS = el("select", { class: "pv-select pv-sm", "aria-label": "Character" }); charS.addEventListener("change", () => { patchLine(store, id, { char: charS.value }); store.commit(); });
    const kindS = el("select", { class: "pv-select pv-sm", "aria-label": "Line type" }, ...Object.entries(KINDS).map(([v, t]) => el("option", { value: v, text: t }))); kindS.addEventListener("change", () => { patchLine(store, id, { kind: kindS.value }); store.commit(); });
    const statS = el("select", { class: "pv-select pv-sm", "aria-label": "Status" }, ...Object.entries(STATUSES).map(([v, t]) => el("option", { value: v, text: t }))); statS.addEventListener("change", () => { patchLine(store, id, { status: statS.value }); store.commit(); });
    const text = el("textarea", { class: "pv-text pv-sm pv-line-text", rows: 2, maxlength: 2000, "aria-label": "Line text", placeholder: "Line text" });
    text.addEventListener("input", () => { patchLine(store, id, { text: text.value }); autosize(text); }); text.addEventListener("change", () => store.commit());
    const nodeS = el("select", { class: "pv-select pv-sm", "aria-label": "Scene" }); nodeS.addEventListener("change", () => { patchLine(store, id, { node: nodeS.value || null, shot: null }); store.commit(); });
    const shotS = el("select", { class: "pv-select pv-sm", "aria-label": "Shot" }); shotS.addEventListener("change", () => { patchLine(store, id, { shot: shotS.value || null }); store.commit(); announce(shotS.value ? "Line assigned to the shot; it now shows in the timeline and storyboard" : "Line is no longer on a shot"); });
    const jump = el("button", { class: "pv-linkbtn pv-line-tag", type: "button", title: "Jump to this scene and shot", onclick: () => deps.jump(findLine(store.p, id)) });
    const openN = el("button", { class: "pv-btn pv-btn-sm", type: "button", text: "Script node", title: "Open this scene's artboard at the Script sub-node", onclick: () => { const l = findLine(store.p, id), n = store.p.nodes.find((x) => x.id === l.node); if (n) deps.openScript(n, null, l.char); } });
    const del = el("button", { class: "pv-btn pv-btn-sm pv-btn-icon", type: "button", "aria-label": "Delete line", text: "×", onclick: () => { deleteLine(store, id); store.commit(); announce("Line deleted. Undo brings it back."); } });
    li.append(el("div", { class: "pv-line-top" }, grip, mk, charS, kindS, statS), text, el("div", { class: "pv-line-meta" }, jump, nodeS, shotS, openN, del));
    li._f = { mk, charS, kindS, statS, text, nodeS, shotS, jump, openN };
    return li;
  }
  const autosize = (t) => { t.style.height = "auto"; t.style.height = Math.min(160, t.scrollHeight + 2) + "px"; };
  function visibleRows() {
    return orderedLines(store).filter((r) => (f.char === "all" || r.line.char === f.char) && (f.node === "all" || (f.node === "-" ? !r.node : r.node?.id === f.node)) && (!f.q || (r.line.text + " " + charName(store.p, r.line.char) + " " + (r.node?.name || "")).toLowerCase().includes(f.q)));
  }
  function sync(li, r, cs) {
    const l = r.line, F = li._f, p = store.p, mk = markerOf(cs, l.char);
    li.className = `pv-line k-${l.kind} s-${l.status}`; F.mk.className = "pv-mk pv-mk-" + mk.shape; F.mk.textContent = mk.initial;
    const ck = cs.map((c) => c.id + c.name).join("|"); if (F.charS._k !== ck) { F.charS._k = ck; F.charS.replaceChildren(...cs.map((c) => el("option", { value: c.id, text: c.name }))); }
    if (!cs.some((c) => c.id === l.char)) F.charS.append(el("option", { value: l.char, text: charName(p, l.char) }));
    const set = (i, v) => { if (document.activeElement !== i && i.value !== v) i.value = v; };
    set(F.charS, l.char); set(F.kindS, l.kind); set(F.statS, l.status);
    if (document.activeElement !== F.text && F.text.value !== l.text) { F.text.value = l.text; } autosize(F.text);
    F.text.placeholder = l.kind === "paren" ? "(how it is said)" : l.kind === "action" ? "What happens" : "What they say";
    const scenes = p.nodes.filter((n) => n.type === "scene"), nk = scenes.map((n) => n.id + n.name).join("|"); if (F.nodeS._k !== nk) { F.nodeS._k = nk; F.nodeS.replaceChildren(el("option", { value: "", text: "(no scene)" }), ...scenes.map((n) => el("option", { value: n.id, text: n.name }))); }
    set(F.nodeS, l.node || "");
    const sk = (r.node?.id || "") + (r.node?.shots.map((s) => s.id).join(",") || ""); if (F.shotS._k !== sk) { F.shotS._k = sk; F.shotS.replaceChildren(el("option", { value: "", text: "whole scene" }), ...(r.node?.shots || []).map((s, i) => el("option", { value: s.id, text: `shot ${i + 1}` }))); }
    set(F.shotS, l.shot || "");
    F.shotS.disabled = !r.node; F.openN.disabled = !r.node;
    F.jump.textContent = r.node ? `${r.shot ? "Shot " + r.n + " · " : ""}${r.tc || ""}${l.t0 != null ? " (" + l.t0.toFixed(1) + " s)" : ""}` : "unassigned"; F.jump.disabled = !r.node;
  }
  function render() {
    if (!open) return;
    const cs = chars(); if (f.char !== "all" && !cs.some((c) => c.id === f.char)) f.char = "all";
    renderChips(cs); renderStats(cs);
    const sn = store.p.nodes.filter((n) => n.type === "scene"), sk = sn.map((n) => n.id + n.name).join("|") + "-";
    if (sceneSel._k !== sk) { sceneSel._k = sk; sceneSel.replaceChildren(el("option", { value: "all", text: "All scenes" }), ...sn.map((n) => el("option", { value: n.id, text: n.name })), el("option", { value: "-", text: "Unassigned" })); }
    sceneSel.value = f.node;
    const vis = visibleRows(), ids = new Set(vis.map((r) => r.line.id));
    for (const [id, li] of rows) if (!ids.has(id)) { li.remove(); rows.delete(id); }
    list.querySelectorAll(".pv-sc-head, .pv-sc-empty").forEach((x) => x.remove());
    let prev = null, scene = "\u0000";
    const place = (node) => { const want = prev ? prev.nextElementSibling : list.firstElementChild; if (want !== node) list.insertBefore(node, want); prev = node; };
    if (!vis.length) { list.append(el("li", { class: "pv-sc-empty", text: store.p.script.lines.length ? "No lines match the filters." : "No script lines yet. Add one below, or import a script with an Import node." })); }
    for (const r of vis) {
      if (f.byScene && (r.node?.id || "-") !== scene) { scene = r.node?.id || "-"; const h = el("li", { class: "pv-sc-head", role: "presentation", text: r.node?.name || "Unassigned" }); place(h); }
      let li = rows.get(r.line.id); if (!li) { li = make(r, cs); rows.set(r.line.id, li); }
      sync(li, r, cs); place(li);
    }
    const sel = (i, v) => { if (document.activeElement !== i) i.value = v; };
    const ak = cs.map((c) => c.id + c.name).join("|"); if (addChar._k !== ak) { addChar._k = ak; addChar.replaceChildren(...cs.map((c) => el("option", { value: c.id, text: c.name }))); } if (f.char !== "all") sel(addChar, f.char);
  }
  dragReorder({ container: list, handle: ".pv-line-grip", items: () => [...list.querySelectorAll(".pv-line")],
    onDrop: (from, to) => { const vis = visibleRows(), moved = vis[from]?.line.id; if (!moved) return; const rest = vis.filter((_, i) => i !== from); const ok = to < rest.length ? moveLine(store, moved, rest[to].line.id) : moveLine(store, moved, null, rest[rest.length - 1]?.line.id); if (ok) { store.commit(); announce(`Line moved to position ${to + 1}`); } } });
  root.querySelector(".pv-sc-addform").addEventListener("submit", (e) => {
    e.preventDefault(); const text = addText.value.trim(); if (!text) { addText.focus(); return; }
    const node = f.node !== "all" && f.node !== "-" ? f.node : store.sel.open || store.sel.nodes[0] || null, nd = store.p.nodes.find((n) => n.id === node && n.type === "scene");
    const l = addLine(store, { char: addChar.value || NARRATOR, kind: addKind.value, text, node: nd?.id || null, shot: nd && store.sel.shot && nd.shots.some((s) => s.id === store.sel.shot) ? store.sel.shot : null });
    store.commit(); addText.value = ""; announce("Line added"); requestAnimationFrame(() => { rows.get(l.id)?.scrollIntoView({ block: "nearest" }); });
  });
  store.on((scope) => { if (open) { clearTimeout(api._t); api._t = setTimeout(render, 0); } });
  return api;
}
