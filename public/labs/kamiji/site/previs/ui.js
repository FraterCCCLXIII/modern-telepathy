// Small DOM helpers shared by the panels.
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
export const svg = (tag, attrs = {}) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// polite live region + visible status line
let liveEl = null, lineEl = null, lineTimer = 0;
export function initStatus(live, line) { liveEl = live; lineEl = line; }
export function announce(msg, { line = true } = {}) {
  if (liveEl) { liveEl.textContent = ""; requestAnimationFrame(() => { liveEl.textContent = msg; }); }
  if (line && lineEl) { lineEl.textContent = msg; clearTimeout(lineTimer); lineTimer = setTimeout(() => { lineEl.textContent = ""; }, 5000); }
}

// Replace a text element with an input until Enter / blur / Escape.
export function inlineEdit(target, value, done, { max = 80 } = {}) {
  const input = el("input", { type: "text", class: "pv-inline", value, maxlength: max, "aria-label": "Rename" });
  const parent = target.parentNode, before = target.nextSibling;
  let finished = false;
  const end = (ok) => {
    if (finished) return; finished = true;
    const v = input.value.trim();
    input.remove(); target.hidden = false;
    if (ok && v && v !== value) done(v);
    target.closest("[tabindex]")?.focus?.();
  };
  input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") end(true); else if (e.key === "Escape") end(false); });
  input.addEventListener("blur", () => end(true));
  input.addEventListener("pointerdown", (e) => e.stopPropagation());
  target.hidden = true; parent.insertBefore(input, before); input.focus(); input.select();
}

// Modal confirm using <dialog>; resolves true / false.
export function confirmDialog(dlg, { title, body, ok = "OK" }) {
  return new Promise((resolve) => {
    dlg.innerHTML = "";
    const f = el("form", { method: "dialog", class: "pv-dlg-in" },
      el("h2", { text: title }), el("p", { text: body }),
      el("div", { class: "pv-dlg-actions" }, el("button", { class: "pv-btn", value: "no", text: "Cancel" }), el("button", { class: "pv-btn pv-btn-primary", value: "yes", text: ok, autofocus: true })));
    dlg.append(f);
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "yes"), { once: true });
    dlg.returnValue = "no"; dlg.showModal();
  });
}

// Pointer-driven reorder for a row of items. `items()` returns the current item elements (in order).
// onDrop(from, to): `to` is the index in the list after removing the dragged item. A press without movement calls onClick.
export function dragReorder({ container, items, handle, onDrop, onClick }) {
  container.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const h = e.target.closest(handle); if (!h || !container.contains(h)) return;
    if (e.target.closest("input,textarea,select,[data-trim]")) return;
    const list = items(); const item = list.find((it) => it === h || it.contains(h)); if (!item) return;
    const vertical = getComputedStyle(container).flexDirection === "column";
    const from = list.indexOf(item), startX = e.clientX, startY = e.clientY;
    const rects = list.map((it) => it.getBoundingClientRect());
    let dragging = false, to = from, ind = null;
    const move = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < 5) return;
      if (!dragging) { dragging = true; item.classList.add("is-dragging"); ind = el("div", { class: "pv-drop-ind" + (vertical ? " is-v" : ""), "aria-hidden": "true" }); container.append(ind); container.setPointerCapture?.(e.pointerId); }
      item.style.transform = vertical ? `translate(0, ${dy}px)` : `translate(${dx}px, 0)`;
      const c = vertical ? rects[from].top + rects[from].height / 2 + dy : rects[from].left + rects[from].width / 2 + dx;
      let idx = 0; rects.forEach((r, i) => { if (i !== from && c > (vertical ? r.top + r.height / 2 : r.left + r.width / 2)) idx++; });
      to = idx;
      const others = rects.filter((_, i) => i !== from), cr = container.getBoundingClientRect();
      const at = to < others.length ? others[to] : others[others.length - 1] || rects[from];
      const edge = to < others.length ? (vertical ? at.top : at.left) : (vertical ? at.bottom : at.right);
      if (vertical) { ind.style.top = edge - cr.top + container.scrollTop - 1 + "px"; ind.style.left = "0"; ind.style.width = container.scrollWidth + "px"; }
      else { ind.style.left = edge - cr.left + container.scrollLeft - 1 + "px"; ind.style.top = "0"; ind.style.height = container.scrollHeight + "px"; }
    };
    const up = (ev) => {
      container.removeEventListener("pointermove", move); container.removeEventListener("pointerup", up); container.removeEventListener("pointercancel", up);
      try { container.releasePointerCapture?.(e.pointerId); } catch (err) { /* ignore */ }
      item.classList.remove("is-dragging"); item.style.transform = ""; ind?.remove();
      if (dragging) { if (to !== from) onDrop(from, to); } else onClick?.(item, ev);
    };
    container.addEventListener("pointermove", move); container.addEventListener("pointerup", up); container.addEventListener("pointercancel", up);
  });
}
