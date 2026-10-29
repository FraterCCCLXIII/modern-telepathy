// Generic nodal canvas: pan / zoom, draggable cards, typed ports and edges, marquee, minimap, LOD, roving-tabindex keyboard.
// The story map and every scene artboard use this one implementation; each supplies an adapter that knows its own data.
import { svg, el, clamp, inlineEdit, announce } from "./ui.js";

export const ZMIN = 0.15, ZMAX = 2.5, BUBBLE_Z = 0.4;
const SHAPE_CLASS = (t) => "type-" + t;

export function createGraph({ store, vp, adapter }) {
  const world = vp.querySelector(".pv-world"), edgesSvg = vp.querySelector(".pv-edges"), chipsEl = vp.querySelector(".pv-chips");
  const marquee = vp.querySelector(".pv-marquee"), empty = vp.querySelector(".pv-empty"), mini = vp.querySelector(".pv-mini-svg");
  const ghint = el("div", { class: "pv-ghint", role: "presentation", hidden: true }); vp.append(ghint);
  const cards = new Map();
  const view = { x: 40, y: 30, z: 0.8 };
  let activeId = null, focusId = null, spaceDown = false, tempPath = null;
  const api = { cards, view, vp, get lod() { return view.z < BUBBLE_Z ? "bubble" : "live"; }, get activeId() { return activeId; } };
  const A = adapter;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { const c = [...cards.values()].find((x) => x.el === e.target); if (c) c.visible = e.isIntersecting; }
  }, { root: vp, rootMargin: "80px" });

  // ---- view ------------------------------------------------------------------------------------------
  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
    vp.classList.toggle("lod-bubble", view.z < BUBBLE_Z);
    vp.style.setProperty("--grid", `${40 * view.z}px`); vp.style.backgroundPosition = `${view.x}px ${view.y}px`;
    drawMini(); api.onView?.();
  }
  const toWorld = (cx, cy) => { const r = vp.getBoundingClientRect(); return [(cx - r.left - view.x) / view.z, (cy - r.top - view.y) / view.z]; };
  function zoomAt(cx, cy, nz) { nz = clamp(nz, ZMIN, ZMAX); const r = vp.getBoundingClientRect(), px = cx - r.left, py = cy - r.top; view.x = px - ((px - view.x) / view.z) * nz; view.y = py - ((py - view.y) / view.z) * nz; view.z = nz; applyView(); }
  function fit(nodes = A.nodes(), { minZ = 0 } = {}) {
    const r = vp.getBoundingClientRect(); if (!r.width) return;
    if (!nodes.length) { view.x = 40; view.y = 30; view.z = 0.8; applyView(); return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of nodes) { const [w, h] = A.size(n); x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h); }
    const pad = 40, z = clamp(Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0)), ZMIN, 1.1);
    if (minZ && z < minZ) { view.z = minZ; view.x = pad - x0 * minZ; view.y = pad - y0 * minZ; applyView(); return; } // too big to fit legibly: start at the top left, pan from there
    view.z = z; view.x = (r.width - (x1 - x0) * z) / 2 - x0 * z; view.y = (r.height - (y1 - y0) * z) / 2 - y0 * z; applyView();
  }
  const panBy = (dx, dy) => { view.x += dx; view.y += dy; applyView(); };
  function centreOn(n) { const r = vp.getBoundingClientRect(), [w, h] = A.size(n); view.x = r.width / 2 - (n.x + w / 2) * view.z; view.y = r.height / 2 - (n.y + h / 2) * view.z; applyView(); }
  function ensureVisible(n) { const r = vp.getBoundingClientRect(), [w, h] = A.size(n), sx = n.x * view.z + view.x, sy = n.y * view.z + view.y; if (sx < 0 || sy < 0 || sx + w * view.z > r.width || sy + h * view.z > r.height) centreOn(n); }

  // ---- cards -----------------------------------------------------------------------------------------
  function makeCard(n) {
    const c = el("div", { class: "pv-card " + (A.cardClass?.(n) || ""), role: "option", tabindex: "-1", "data-id": n.id });
    const rec = { el: c, canvas: null, msg: null, visible: false, drawn: false, node: n, live: false, vp, render: null, sigFn: null };
    world.append(c); A.makeCard(n, rec, c);
    c._ports = new Map();
    const ps = A.ports(n);
    for (const side of ["in", "out"]) for (const p of ps[side]) {
      const [x, y] = A.portOffset(n, side, p.id);
      const pe = el("span", { class: `pv-port pv-port-${side} ${SHAPE_CLASS(p.type)}`, "data-port": p.id, "data-side": side, "data-type": p.type, title: p.label ? `${side === "in" ? "Input" : "Output"}: ${p.label}` : "", "aria-hidden": "true" });
      pe.style.left = x - 9 + "px"; pe.style.top = y - 9 + "px"; c.append(pe); c._ports.set(side + ":" + p.id, pe);
    }
    cards.set(n.id, rec); io.observe(c);
    return rec;
  }
  function sync() {
    const nodes = A.nodes(), ids = new Set(nodes.map((n) => n.id)), sel = A.sel.nodes();
    for (const [id, rec] of cards) if (!ids.has(id)) { io.unobserve(rec.el); rec.el.remove(); cards.delete(id); A.disposeCard?.(id, rec); }
    if (focusId && !ids.has(focusId)) focusId = null;
    if (!focusId && nodes.length) focusId = sel[0] || nodes[0].id;
    for (const n of nodes) {
      let rec = cards.get(n.id);
      if (rec && A.ports && JSON.stringify(A.ports(n)) !== rec.portsKey) { io.unobserve(rec.el); rec.el.remove(); cards.delete(n.id); A.disposeCard?.(n.id, rec); rec = null; } // port set changed (e.g. content kind): rebuild
      rec ||= makeCard(n); rec.portsKey = JSON.stringify(A.ports(n));
      rec.node = n; const c = rec.el, [w, h] = A.size(n);
      c.style.transform = `translate(${n.x}px, ${n.y}px)`; c.style.width = w + "px"; c.style.height = h + "px";
      const s = sel.includes(n.id);
      c.classList.toggle("is-sel", s); c.classList.toggle("is-active", n.id === activeId);
      c.setAttribute("aria-selected", s ? "true" : "false"); c.tabIndex = n.id === focusId ? 0 : -1;
      A.syncCard(n, rec, { selected: s, active: n.id === activeId });
      c.setAttribute("aria-label", A.ariaLabel(n, n.id === activeId));
    }
    drawEdges(); drawMini();
    if (empty) empty.hidden = nodes.length > 0 && !A.alwaysEmptyHidden;
  }
  const portPos = (n, side, id) => { const [x, y] = A.portOffset(n, side, id); return [n.x + x, n.y + y]; };
  const curve = (a, b) => { const dx = Math.max(60, Math.abs(b[0] - a[0]) * 0.5); return `M${a[0]} ${a[1]} C${a[0] + dx} ${a[1]} ${b[0] - dx} ${b[1]} ${b[0]} ${b[1]}`; };
  const head = (b) => `M${b[0] - 10} ${b[1] - 6} L${b[0]} ${b[1]} L${b[0] - 10} ${b[1] + 6}`;
  function drawEdges() {
    edgesSvg.replaceChildren(); chipsEl.replaceChildren();
    const byId = new Map(A.nodes().map((n) => [n.id, n])), selEdge = A.sel.edge();
    for (const e of A.edges()) {
      const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b) continue;
      const pa = portPos(a, "out", e.fp || "out"), pb = portPos(b, "in", e.tp || "in"), sel = selEdge === e.id;
      const g = svg("g", { class: "pv-edge" + (sel ? " is-sel" : "") + (A.edgeClass?.(e) ? " " + A.edgeClass(e) : ""), "data-kind": A.edgeKind?.(e) || "", "data-id": e.id, "data-type": A.edgeType?.(e) || "" });
      g.append(svg("path", { d: curve(pa, pb), class: "pv-edge-line" }), svg("path", { d: head(pb), class: "pv-edge-head" }), svg("path", { d: curve(pa, pb), class: "pv-edge-hit", "data-edge": e.id }));
      edgesSvg.append(g);
      const label = A.chip?.(e);
      if (label) {
        const chip = el("button", { class: "pv-chip" + (sel ? " is-sel" : ""), type: "button", tabindex: "-1", "data-edge": e.id, "data-kind": A.edgeKind?.(e) || "", title: `${label}: click to change, then Delete removes`, text: label });
        chip.style.transform = `translate(${(pa[0] + pb[0]) / 2}px, ${(pa[1] + pb[1]) / 2}px) translate(-50%, -50%)`; chipsEl.append(chip);
      }
    }
    if (tempPath) edgesSvg.append(tempPath);
  }

  // ---- mini map --------------------------------------------------------------------------------------
  let miniQueued = false, miniBox = null;
  function drawMini() {
    if (miniQueued || !mini) return; miniQueued = true;
    requestAnimationFrame(() => {
      miniQueued = false; const r = vp.getBoundingClientRect(); if (!r.width) return;
      const nodes = A.nodes(); let x0 = -40, y0 = -40, x1 = 400, y1 = 300;
      for (const n of nodes) { const [w, h] = A.size(n); x0 = Math.min(x0, n.x - 40); y0 = Math.min(y0, n.y - 40); x1 = Math.max(x1, n.x + w + 40); y1 = Math.max(y1, n.y + h + 40); }
      const vx = -view.x / view.z, vy = -view.y / view.z, vw = r.width / view.z, vh = r.height / view.z;
      x0 = Math.min(x0, vx); y0 = Math.min(y0, vy); x1 = Math.max(x1, vx + vw); y1 = Math.max(y1, vy + vh);
      miniBox = { x0, y0, w: x1 - x0, h: y1 - y0 };
      mini.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`); mini.replaceChildren();
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const e of A.edges()) { const a = byId.get(e.from), b = byId.get(e.to); if (a && b) mini.append(svg("path", { d: curve(portPos(a, "out", e.fp || "out"), portPos(b, "in", e.tp || "in")), class: "pv-mini-edge" })); }
      const sel = A.sel.nodes();
      for (const n of nodes) { const [w, h] = A.size(n); mini.append(svg("rect", { x: n.x, y: n.y, width: w, height: h, rx: 14, class: "pv-mini-node" + (sel.includes(n.id) ? " is-sel" : "") + (n.id === activeId ? " is-active" : "") })); }
      mini.append(svg("rect", { x: vx, y: vy, width: vw, height: vh, class: "pv-mini-view" }));
    });
  }
  mini?.parentElement?.addEventListener("pointerdown", (e) => {
    if (!miniBox) return; const host = e.currentTarget; host.setPointerCapture(e.pointerId);
    const go = (ev) => {
      const r = mini.getBoundingClientRect(), s = Math.min(r.width / miniBox.w, r.height / miniBox.h);
      const wx = miniBox.x0 + (ev.clientX - r.left - (r.width - miniBox.w * s) / 2) / s, wy = miniBox.y0 + (ev.clientY - r.top - (r.height - miniBox.h * s) / 2) / s;
      const vr = vp.getBoundingClientRect(); view.x = vr.width / 2 - wx * view.z; view.y = vr.height / 2 - wy * view.z; applyView();
    };
    go(e); const up = () => { host.removeEventListener("pointermove", go); host.removeEventListener("pointerup", up); };
    host.addEventListener("pointermove", go); host.addEventListener("pointerup", up);
  });

  // ---- pointer interaction ---------------------------------------------------------------------------
  const setSel = (ids, edge = null) => { A.sel.setNodes(ids); A.sel.setEdge(edge); A.emitSel(); };
  vp.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target.closest(".pv-mini, .pv-map-tools, .pv-zoombar, .pv-empty button, .pv-inline, .pv-card-ctl")) return;
    vp.focus({ preventScroll: true });
    const chip = e.target.closest(".pv-chip"), hit = e.target.closest(".pv-edge-hit"), port = e.target.closest(".pv-port"), cardEl = e.target.closest(".pv-card");
    if (chip || hit) { const id = (chip || hit).dataset.edge; setSel([], id); if (chip) A.onChip?.(id); return; }
    if (port && cardEl) { startConnect(e, cardEl.dataset.id, port.dataset.side, port.dataset.port); return; }
    if (e.button === 1 || spaceDown || !cardEl) {
      if (!cardEl && e.shiftKey && e.button === 0) { startMarquee(e); return; }
      startPan(e, !cardEl && !spaceDown && e.button === 0); return;
    }
    startCardDrag(e, cardEl);
  });
  function startPan(e, clearOnClick) {
    const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y; let moved = false;
    vp.setPointerCapture(e.pointerId); vp.classList.add("is-panning");
    const mv = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.hypot(dx, dy) > 3) moved = true; view.x = ox + dx; view.y = oy + dy; applyView(); };
    const up = () => { vp.removeEventListener("pointermove", mv); vp.removeEventListener("pointerup", up); vp.removeEventListener("pointercancel", up); vp.classList.remove("is-panning"); if (!moved && clearOnClick && (A.sel.nodes().length || A.sel.edge())) setSel([], null); };
    vp.addEventListener("pointermove", mv); vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
  }
  function startMarquee(e) {
    const r = vp.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, base = [...A.sel.nodes()];
    vp.setPointerCapture(e.pointerId); marquee.hidden = false;
    const mv = (ev) => {
      const x = ev.clientX - r.left, y = ev.clientY - r.top, l = Math.min(sx, x), t = Math.min(sy, y), w = Math.abs(x - sx), h = Math.abs(y - sy);
      Object.assign(marquee.style, { left: l + "px", top: t + "px", width: w + "px", height: h + "px" });
      const hit = A.nodes().filter((n) => { const [nw, nh] = A.size(n), nx = n.x * view.z + view.x, ny = n.y * view.z + view.y; return !A.noMarquee?.(n) && nx < l + w && nx + nw * view.z > l && ny < t + h && ny + nh * view.z > t; }).map((n) => n.id);
      setSel([...new Set([...base, ...hit])]);
    };
    const up = () => { marquee.hidden = true; vp.removeEventListener("pointermove", mv); vp.removeEventListener("pointerup", up); vp.removeEventListener("pointercancel", up); announce(`${A.sel.nodes().length} selected`, { line: false }); };
    vp.addEventListener("pointermove", mv); vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
  }
  function startCardDrag(e, cardEl) {
    const id = cardEl.dataset.id, sx = e.clientX, sy = e.clientY, sel = A.sel.nodes(), wasSel = sel.includes(id);
    if (!wasSel && !e.shiftKey) { A.sel.setNodes([id]); A.sel.setEdge(null); A.onSelectNode?.(id); A.emitSel(); }
    else if (!wasSel && e.shiftKey) { A.sel.setNodes([...sel, id]); A.emitSel(); }
    focusId = id; roving();
    const group = A.sel.nodes().length ? A.sel.nodes() : [id];
    const start = new Map(A.nodes().filter((n) => group.includes(n.id)).map((n) => [n.id, [n.x, n.y]]));
    let moved = false; vp.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const dx = (ev.clientX - sx) / view.z, dy = (ev.clientY - sy) / view.z;
      if (!moved && Math.hypot(dx, dy) * view.z < 4) return; moved = true; vp.classList.add("is-dragging");
      A.move(start, dx, dy, ev.altKey ? 1 : 10);
    };
    const up = () => {
      vp.removeEventListener("pointermove", mv); vp.removeEventListener("pointerup", up); vp.removeEventListener("pointercancel", up); vp.classList.remove("is-dragging");
      if (moved) { store.commit(); announce("Moved " + (group.length > 1 ? group.length + " nodes" : A.name(A.nodes().find((n) => n.id === id)))); }
      else if (wasSel && e.shiftKey) { A.sel.setNodes(A.sel.nodes().filter((x) => x !== id)); A.emitSel(); }
      else if (wasSel && !e.shiftKey && A.sel.nodes().length > 1) { A.sel.setNodes([id]); A.emitSel(); }
      if (!moved && A.sel.nodes().length === 1) A.onSelectNode?.(id, true);
    };
    vp.addEventListener("pointermove", mv); vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
  }

  // typed connect-by-drag. Dragging from an output or an input both work; compatible ports light up, others dim.
  function startConnect(e, fromId, side, portId) {
    vp.setPointerCapture(e.pointerId); vp.classList.add("is-connecting");
    const nodes = new Map(A.nodes().map((n) => [n.id, n])), n0 = nodes.get(fromId), anchor = portPos(n0, side, portId);
    const type = A.ports(n0)[side].find((p) => p.id === portId)?.type;
    tempPath = svg("path", { class: "pv-edge-temp" }); edgesSvg.append(tempPath);
    cards.forEach((r, id) => r.el._ports.forEach((pe, k) => { const ok = id !== fromId && pe.dataset.side !== side && pe.dataset.type === type; pe.classList.toggle("is-ok", ok); pe.classList.toggle("is-dim", !ok && id !== fromId); }));
    const resolve = (ev) => {
      const t = document.elementFromPoint(ev.clientX, ev.clientY), pe = t?.closest?.(".pv-port"), ce = t?.closest?.(".pv-card");
      if (!ce || ce.dataset.id === fromId || !nodes.has(ce.dataset.id)) return { ce: null };
      const other = nodes.get(ce.dataset.id);
      const op = pe && pe.dataset.side !== side ? pe.dataset.port : A.pickPort(n0, portId, side, other);
      if (!op) return { ce, ok: false, reason: `${A.name(other)} has no matching ${side === "out" ? "input" : "output"} for this connection.` };
      const c = side === "out" ? { a: n0, ap: portId, b: other, bp: op } : { a: other, ap: op, b: n0, bp: portId };
      return { ce, ...A.canConnect(c.a, c.ap, c.b, c.bp), c };
    };
    const mv = (ev) => {
      const w = toWorld(ev.clientX, ev.clientY);
      tempPath.setAttribute("d", side === "out" ? curve(anchor, w) : curve(w, anchor));
      const r = resolve(ev);
      cards.forEach((rc) => { rc.el.classList.toggle("is-target", !!r.ce && rc.el === r.ce && r.ok); rc.el.classList.toggle("is-bad", !!r.ce && rc.el === r.ce && !r.ok); });
      if (r.ce && !r.ok) { const vr = vp.getBoundingClientRect(); ghint.textContent = "Cannot connect: " + r.reason; ghint.hidden = false; ghint.style.left = Math.min(vr.width - 260, Math.max(8, ev.clientX - vr.left + 14)) + "px"; ghint.style.top = ev.clientY - vr.top + 16 + "px"; }
      else ghint.hidden = true;
    };
    const up = (ev) => {
      vp.removeEventListener("pointermove", mv); vp.removeEventListener("pointerup", up); vp.removeEventListener("pointercancel", up); vp.classList.remove("is-connecting");
      const r = resolve(ev); ghint.hidden = true;
      cards.forEach((rc) => { rc.el.classList.remove("is-target", "is-bad"); rc.el._ports.forEach((pe) => pe.classList.remove("is-ok", "is-dim")); });
      tempPath.remove(); tempPath = null;
      if (r.ce && r.ok) A.connect(r.c.a, r.c.ap, r.c.b, r.c.bp);
      else if (r.ce) announce("Cannot connect: " + r.reason);
      else drawEdges();
    };
    vp.addEventListener("pointermove", mv); vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
  }
  vp.addEventListener("dblclick", (e) => {
    const tg = document.elementFromPoint(e.clientX, e.clientY) || e.target; // pointer capture retargets click events to the viewport
    const title = tg.closest(".pv-card-title, .pv-card-bubble"), card = tg.closest(".pv-card");
    if (card && title && !title.closest(".is-group")) { rename(card.dataset.id); return; }
    if (card && !tg.closest(".pv-port, .pv-card-ctl, input, textarea, select")) { const n = A.nodes().find((x) => x.id === card.dataset.id); if (n) A.onOpen?.(n); return; }
    if (!card && !tg.closest(".pv-mini, .pv-chip, .pv-map-tools, .pv-zoombar, .pv-empty")) A.onAddMenu?.(e.clientX, e.clientY, toWorld(e.clientX, e.clientY));
  });
  vp.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) panBy(-(e.deltaX || e.deltaY), 0);
    else zoomAt(e.clientX, e.clientY, view.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  addEventListener("keydown", (e) => { if (e.code === "Space" && vp.contains(document.activeElement) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { spaceDown = true; vp.classList.add("is-space"); } });
  addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; vp.classList.remove("is-space"); } });

  // ---- commands --------------------------------------------------------------------------------------
  function rename(id) {
    const rec = cards.get(id); if (!rec || A.noRename?.(rec.node)) return;
    const t = rec.el.querySelector(".pv-card-title"); if (!t) return;
    inlineEdit(t, A.name(rec.node), (v) => A.rename(rec.node, v));
  }
  function nudge(dx, dy) {
    const sel = A.sel.nodes(); if (!sel.length) return;
    const start = new Map(A.nodes().filter((n) => sel.includes(n.id)).map((n) => [n.id, [n.x, n.y]]));
    A.move(start, dx, dy, 1); store.commit();
  }
  const roving = () => cards.forEach((r, id) => { r.el.tabIndex = id === focusId ? 0 : -1; });
  function moveFocus(dir) {
    const nodes = A.nodes(), cur = nodes.find((n) => n.id === focusId); if (!cur) return;
    const [cw, ch] = A.size(cur), cx = cur.x + cw / 2, cy = cur.y + ch / 2; let best = null, bd = 1e12;
    for (const n of nodes) {
      if (n === cur) continue; const [w, h] = A.size(n), dx = n.x + w / 2 - cx, dy = n.y + h / 2 - cy;
      const along = dir === "ArrowRight" ? dx : dir === "ArrowLeft" ? -dx : dir === "ArrowDown" ? dy : -dy;
      const across = dir === "ArrowRight" || dir === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4 || across > along * 2.2 + 80) continue;
      const dd = along * along + across * across * 2.5; if (dd < bd) { bd = dd; best = n; }
    }
    if (best) { focusId = best.id; roving(); cards.get(best.id).el.focus({ preventScroll: true }); ensureVisible(best); }
  }
  vp.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select") || e.target.closest?.(".pv-card-ctl")) return;
    const onCard = e.target.closest?.(".pv-card"), k = e.key, arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (arrows.includes(k)) {
      e.preventDefault(); const step = e.shiftKey ? 50 : 10;
      if (e.altKey) nudge(k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0, k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0);
      else if (e.ctrlKey || e.metaKey || !onCard) panBy(k === "ArrowLeft" ? 80 : k === "ArrowRight" ? -80 : 0, k === "ArrowUp" ? 80 : k === "ArrowDown" ? -80 : 0);
      else moveFocus(k);
    } else if ((k === "Enter" || k === " ") && onCard) {
      e.preventDefault(); const id = onCard.dataset.id, cur = A.sel.nodes();
      if (e.shiftKey) A.sel.setNodes(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]); else A.sel.setNodes([id]);
      A.sel.setEdge(null); if (A.sel.nodes().length === 1) A.onSelectNode?.(id); A.emitSel();
      if (k === "Enter" && !e.shiftKey) { const n = A.nodes().find((x) => x.id === id); if (n) A.onOpen?.(n, true); }
    } else if (k === "+" || k === "=") { e.preventDefault(); api.zoomBy(1.2); }
    else if (k === "-" || k === "_") { e.preventDefault(); api.zoomBy(1 / 1.2); }
    else if (k === "0") { e.preventDefault(); api.zoomTo(1); }
    else if (k === "Escape") { setSel([], null); }
  });
  vp.addEventListener("focusin", (e) => { const c = e.target.closest?.(".pv-card"); if (c) { focusId = c.dataset.id; roving(); } });
  new ResizeObserver(() => drawMini()).observe(vp);
  Object.assign(api, {
    sync, fit, centreOn, ensureVisible, nudge, rename, toWorld,
    zoomBy(f) { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z * f); },
    zoomTo(z) { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, z); },
    setActive(id) { if (id === activeId) return; activeId = id; cards.forEach((r, k) => r.el.classList.toggle("is-active", k === id)); drawMini(); },
    focusNode(id) { focusId = id; roving(); cards.get(id)?.el.focus({ preventScroll: true }); },
    get focusId() { return focusId; },
  });
  applyView();
  return api;
}
