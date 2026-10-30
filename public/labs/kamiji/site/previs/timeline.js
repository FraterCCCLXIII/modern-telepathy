// Timeline: ruler with scrub, four tracks (Shots, Camera, Audio notes, Dialogue), clips with reorder / trim, markers, in-out range.
import { timecode, uid, seconds } from "./store.js";
import { el, clamp, inlineEdit, dragReorder, announce } from "./ui.js";
import { reorderShot, deleteShot } from "./ops.js";
import { shotText, charName, NARRATOR } from "./script.js";

export function createTimeline({ store, transport, thumbs, root }) {
  const scroll = root.querySelector(".pv-tl-scroll"), content = root.querySelector(".pv-tl-content");
  const tcEl = root.querySelector(".pv-tc"), frEl = root.querySelector(".pv-tc-frame");
  const playBtn = root.querySelector("[data-act=play]"), loopBtn = root.querySelector("[data-act=loop]"), fpsSel = root.querySelector(".pv-fps");
  const zoomIn = root.querySelector("[data-act=zin]"), zoomOutB = root.querySelector("[data-act=zout]"), zoomFit = root.querySelector("[data-act=zfit]");
  let ppf = 6, userZoom = false, ph = null, rows = {}, rangeEl = null;
  const LABEL_W = 0;
  const api = { get ppf() { return ppf; }, scroll, subs: null };

  const fitPpf = () => clamp((scroll.clientWidth - 48) / Math.max(store.d.total, 48), 0.6, 18);
  function setZoom(v, anchorX) {
    const old = ppf; ppf = clamp(v, 0.5, 24); userZoom = true;
    const ax = anchorX ?? scroll.clientWidth / 2, frameAt = (scroll.scrollLeft + ax) / old;
    render(); scroll.scrollLeft = frameAt * ppf - ax;
  }
  zoomIn.addEventListener("click", () => setZoom(ppf * 1.4));
  zoomOutB.addEventListener("click", () => setZoom(ppf / 1.4));
  zoomFit.addEventListener("click", () => { userZoom = false; render(); scroll.scrollLeft = 0; });
  scroll.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(ppf * Math.exp(-e.deltaY * 0.01), e.clientX - scroll.getBoundingClientRect().left); } }, { passive: false });
  fpsSel.addEventListener("change", () => { store.update((p) => { p.fps = +fpsSel.value; }); store.commit(); announce("Frame rate " + fpsSel.value + " fps. Frame counts stay, durations change."); });
  loopBtn.addEventListener("click", () => { store.update((p) => { p.loop = !p.loop; }); store.commit(); });
  playBtn.addEventListener("click", () => transport.toggle());
  root.querySelector("[data-act=stop]").addEventListener("click", () => transport.stop());
  root.querySelector("[data-act=prev]").addEventListener("click", () => transport.step(-1));
  root.querySelector("[data-act=next]").addEventListener("click", () => transport.step(1));
  root.querySelector("[data-act=in]").addEventListener("click", () => setIn());
  root.querySelector("[data-act=out]").addEventListener("click", () => setOut());
  root.querySelector("[data-act=clear]").addEventListener("click", () => { store.update((p) => { p.range = null; }); store.commit(); });
  root.querySelector("[data-act=marker]").addEventListener("click", () => addMarker());
  root.querySelector("[data-act=note]").addEventListener("click", () => addNote(Math.floor(transport.frame)));

  function setIn() { const f = Math.floor(transport.frame); store.update((p) => { const o = p.range?.out ?? store.d.total; p.range = { in: f, out: Math.max(o, f + 1) }; }); store.commit(); announce(`In point ${timecode(f, store.p.fps)}`); }
  function setOut() { const f = Math.floor(transport.frame) + 1; store.update((p) => { const i = p.range?.in ?? 0; p.range = { in: Math.min(i, f - 1), out: f }; }); store.commit(); announce(`Out point ${timecode(f, store.p.fps)}`); }
  function addMarker() { const f = Math.floor(transport.frame); const n = store.p.markers.length + 1; const m = { id: uid("m"), frame: f, label: "Marker " + n }; store.update((p) => p.markers.push(m)); store.sel.item = { type: "marker", id: m.id }; store.commit(); announce(`Marker ${n} at ${timecode(f, store.p.fps)}`); }
  function addNote(f) { const m = { id: uid("a"), frame: f, len: 24, label: "Audio note" }; store.update((p) => p.notes.push(m)); store.sel.item = { type: "note", id: m.id }; store.commit(); announce("Audio note added"); }
  api.setIn = setIn; api.setOut = setOut; api.addMarker = addMarker; api.addNote = addNote;

  // ---- drawing ---------------------------------------------------------------------------------------
  const px = (f) => Math.round(f * ppf * 100) / 100;
  function render() {
    const p = store.p, d = store.d, fps = p.fps;
    if (!userZoom) ppf = fitPpf();
    const W = Math.max(scroll.clientWidth - 8, px(Math.max(d.total, 48)) + 80);
    content.style.width = W + "px"; content.style.setProperty("--ppf", ppf + "px");
    content.replaceChildren();
    fpsSel.value = String(fps); loopBtn.setAttribute("aria-pressed", p.loop ? "true" : "false");
    // ruler
    const ruler = el("div", { class: "pv-ruler", "data-scrub": "1" });
    const steps = [1, 2, 5, 10, fps, fps * 2, fps * 5, fps * 10, fps * 30, fps * 60];
    const step = steps.find((s) => s * ppf >= 70) || steps[steps.length - 1];
    for (let f = 0; f <= W / ppf; f += step) {
      const sec = f % fps === 0;
      ruler.append(el("span", { class: "pv-tick" + (sec ? " is-sec" : ""), style: `left:${px(f)}px`, text: sec ? `${Math.floor(f / fps / 60)}:${String(Math.floor(f / fps) % 60).padStart(2, "0")}` : `${f % fps}f` }));
    }
    for (const m of p.markers) {
      const sel = store.sel.item?.id === m.id;
      ruler.append(el("button", { class: "pv-marker" + (sel ? " is-sel" : ""), type: "button", style: `left:${px(m.frame)}px`, "data-marker": m.id, title: `${m.label} (${timecode(m.frame, fps)}). Drag to move, double-click to rename, Delete removes.` }, el("span", { text: m.label })));
    }
    content.append(ruler);
    // range
    const r = p.range;
    if (r) {
      content.append(el("div", { class: "pv-range", style: `left:${px(r.in)}px;width:${px(r.out - r.in)}px` }));
      ruler.append(el("span", { class: "pv-rh pv-rh-in", "data-range": "in", style: `left:${px(r.in)}px`, title: "In point (drag)" }), el("span", { class: "pv-rh pv-rh-out", "data-range": "out", style: `left:${px(r.out)}px`, title: "Out point (drag)" }));
    }
    // tracks
    const tr = (name, cls) => { const row = el("div", { class: "pv-row " + cls, "data-track": name }); content.append(row); return row; };
    const shotsRow = tr("shots", "pv-row-shots"), camRow = tr("camera", "pv-row-cam"), audRow = tr("audio", "pv-row-aud"), dlgRow = tr("dialogue", "pv-row-dlg");
    rows = { shotsRow, audRow };
    const focusShot = store.sel.shot && d.seq.some((s) => s.shot.id === store.sel.shot) ? store.sel.shot : d.seq[0]?.shot.id;
    if (!d.seq.length) shotsRow.append(el("div", { class: "pv-row-empty", text: "No shots yet. Add a scene node, or press Shift+S on a selected scene, and its shots appear here." }));
    d.seq.forEach((s) => {
      const sel = store.sel.shot === s.shot.id, w = px(s.len), url = thumbs.get(s.node, s.shot, () => scheduleThumbs());
      const clip = el("div", { class: "pv-clip" + (sel ? " is-sel" : "") + (transport.entryAt()?.shot.id === s.shot.id ? " is-active" : ""), role: "button", tabindex: s.shot.id === focusShot ? "0" : "-1",
        "data-shot": s.shot.id, style: `left:${px(s.start)}px;width:${Math.max(4, w - 2)}px`,
        "aria-label": `Shot ${s.n}, ${s.node.name}, ${s.shot.type}, ${seconds(s.len, fps)}, frames ${s.start} to ${s.end}${sel ? ", selected" : ""}. Alt+arrows reorder, Shift+arrows trim.` },
      el("span", { class: "pv-trim pv-trim-l", "data-trim": "l", title: "Trim start" }),
      url ? el("img", { src: url, alt: "", class: "pv-clip-th", draggable: "false" }) : null,
      el("span", { class: "pv-clip-t" }, el("b", { text: String(s.n) }), " ", s.shot.label || s.node.name, el("small", { text: ` ${s.shot.type}` })),
      el("span", { class: "pv-trim pv-trim-r", "data-trim": "r", title: "Trim end" }));
      shotsRow.append(clip);
      camRow.append(el("div", { class: "pv-cblock" + (sel ? " is-sel" : ""), "data-shot": s.shot.id, style: `left:${px(s.start)}px;width:${Math.max(4, w - 2)}px`, title: `${s.shot.move}, ${s.shot.cam.ease}` },
        el("span", { text: `${s.shot.move}` }), el("i", { class: "pv-arrow", "aria-hidden": "true" })));
      const dl = shotText(p, s.shot.id, "dialogue").lines;
      if (dl.length) {
        const txt = dl.map((l) => (l.char === NARRATOR ? "" : charName(p, l.char).toUpperCase() + ": ") + l.text).join("  /  "), wn = api.subs?.warningsFor(s.shot.id) || [];
        dlgRow.append(el("div", { class: "pv-dblock" + (sel ? " is-sel" : "") + (wn.length ? " is-warn" : ""), "data-shot": s.shot.id, style: `left:${px(s.start)}px;width:${Math.max(4, w - 2)}px`, title: wn.length ? `${txt}\nSubtitle check: ${[...new Set(wn.map((x) => x.message))].join(" ")}` : txt },
          wn.length ? el("b", { class: "pv-warn", "aria-hidden": "true", text: "!" }) : null, el("span", { text: txt }), wn.length ? el("span", { class: "sr-only", text: ` Warning: ${wn[0].message}` }) : null));
      }
    });
    for (const n of p.notes) {
      const sel = store.sel.item?.id === n.id;
      audRow.append(el("div", { class: "pv-note" + (sel ? " is-sel" : ""), tabindex: "0", role: "button", "data-note": n.id, style: `left:${px(n.frame)}px;width:${Math.max(24, px(n.len) - 2)}px`,
        "aria-label": `Audio note: ${n.label}, at ${timecode(n.frame, fps)}`, title: "Drag to move, drag the right edge to resize, double-click to rename" }, n.wave ? waveSvg(n.wave) : null, el("span", { text: n.label }), el("span", { class: "pv-nresize", "data-nresize": "1" })));
    }
    // playhead
    ph = el("div", { class: "pv-ph", "aria-hidden": "true" }, el("span", { class: "pv-ph-h" }));
    content.append(ph); placePlayhead();
    api.clipsRow = shotsRow;
  }
  function waveSvg(w) { const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"); s.setAttribute("viewBox", `0 0 ${w.length} 20`); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("class", "pv-wave"); s.setAttribute("aria-hidden", "true");
    w.forEach((v, i) => { const r = document.createElementNS(ns, "rect"); const h = Math.max(1, v * 18); r.setAttribute("x", i + 0.15); r.setAttribute("y", 10 - h / 2); r.setAttribute("width", 0.7); r.setAttribute("height", h); s.append(r); }); return s; }
  let thumbTimer = 0;
  const scheduleThumbs = () => { clearTimeout(thumbTimer); thumbTimer = setTimeout(() => { if (!drag) render(); }, 120); };
  function placePlayhead() {
    if (!ph) return;
    ph.style.transform = `translateX(${px(transport.frame)}px)`;
    const fps = store.p.fps; tcEl.textContent = timecode(transport.frame, fps); frEl.textContent = `f ${Math.floor(transport.frame)} / ${store.d.total}`;
    if (transport.playing) { const x = transport.frame * ppf; if (x > scroll.scrollLeft + scroll.clientWidth - 30 || x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 60); }
  }
  function markActive() {
    const id = transport.entryAt()?.shot.id;
    content.querySelectorAll(".pv-clip").forEach((c) => c.classList.toggle("is-active", c.dataset.shot === id));
  }
  api.onFrame = () => { placePlayhead(); markActive(); };
  api.onState = () => {
    playBtn.setAttribute("aria-pressed", transport.playing ? "true" : "false"); playBtn.textContent = transport.playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", transport.playing ? "Pause" : "Play");
  };

  // ---- interaction -----------------------------------------------------------------------------------
  let drag = false;
  const frameAt = (clientX) => (clientX - content.getBoundingClientRect().left) / ppf;
  const targets = (excludeShot) => {
    const out = [Math.floor(transport.frame), ...store.p.markers.map((m) => m.frame)]; if (store.p.range) out.push(store.p.range.in, store.p.range.out);
    store.d.seq.forEach((s) => { if (s.shot.id !== excludeShot) out.push(s.start, s.end); }); return out;
  };
  const snapTo = (f, ex, alt) => { f = Math.round(f); if (alt) return f; let best = f, bd = 6 / ppf; for (const t of targets(ex)) if (Math.abs(t - f) <= bd) { bd = Math.abs(t - f); best = t; } return best; };

  function scrubStart(e) {
    scroll.setPointerCapture(e.pointerId); drag = true; transport.pause();
    const go = (ev) => transport.seek(frameAt(ev.clientX), { scrub: true });
    go(e); const up = () => { scroll.removeEventListener("pointermove", go); scroll.removeEventListener("pointerup", up); scroll.removeEventListener("pointercancel", up); drag = false; transport.scrubbing = false; transport.emit("frame"); };
    scroll.addEventListener("pointermove", go); scroll.addEventListener("pointerup", up); scroll.addEventListener("pointercancel", up);
  }
  function trimStart(e, side) {
    const clip = e.target.closest(".pv-clip"), id = clip.dataset.shot, s0 = store.d.seq.find((s) => s.shot.id === id); if (!s0) return;
    const shot = s0.shot, len0 = shot.len, off0 = shot.off, x0 = e.clientX; drag = true; scroll.setPointerCapture(e.pointerId); store.selectShot(id); e.preventDefault();
    const mv = (ev) => {
      const df = Math.round((ev.clientX - x0) / ppf);
      store.update(() => {
        if (side === "r") { const end = snapTo(s0.start + len0 + df, id, ev.altKey); shot.len = Math.max(6, end - s0.start); }
        else { const nl = Math.max(6, len0 - df); shot.len = nl; shot.off = Math.max(0, off0 + (len0 - nl)); }
      }, "all");
    };
    const up = () => { scroll.removeEventListener("pointermove", mv); scroll.removeEventListener("pointerup", up); scroll.removeEventListener("pointercancel", up); drag = false; if (store.commit()) announce(`Shot trimmed to ${shot.len} frames`); render(); };
    scroll.addEventListener("pointermove", mv); scroll.addEventListener("pointerup", up); scroll.addEventListener("pointercancel", up);
  }
  function itemDrag(e, kind, id) {
    const list = kind === "marker" ? store.p.markers : store.p.notes, it = list.find((x) => x.id === id); if (!it) return;
    const resize = !!e.target.closest("[data-nresize]"); const f0 = it.frame, l0 = it.len || 0, x0 = e.clientX; let moved = false; drag = true;
    scroll.setPointerCapture(e.pointerId); store.sel.item = { type: kind, id }; store.sel.edge = null; store.emit("sel");
    const mv = (ev) => {
      const df = Math.round((ev.clientX - x0) / ppf); if (!moved && Math.abs(ev.clientX - x0) < 3) return; moved = true;
      store.update(() => { if (resize) it.len = Math.max(1, l0 + df); else it.frame = Math.max(0, snapTo(f0 + df, null, ev.altKey)); }, "time");
    };
    const up = () => { scroll.removeEventListener("pointermove", mv); scroll.removeEventListener("pointerup", up); scroll.removeEventListener("pointercancel", up); drag = false; if (moved) { store.commit(); announce(`${kind === "marker" ? "Marker" : "Note"} moved to ${timecode(it.frame, store.p.fps)}`); } else if (kind === "marker") transport.seek(it.frame); render(); };
    scroll.addEventListener("pointermove", mv); scroll.addEventListener("pointerup", up); scroll.addEventListener("pointercancel", up);
  }
  function rangeDrag(e, which) {
    drag = true; scroll.setPointerCapture(e.pointerId);
    const mv = (ev) => { const f = clamp(Math.round(frameAt(ev.clientX)), 0, store.d.total); store.update((p) => { if (which === "in") p.range.in = Math.min(f, p.range.out - 1); else p.range.out = Math.max(f, p.range.in + 1); }, "time"); };
    const up = () => { scroll.removeEventListener("pointermove", mv); scroll.removeEventListener("pointerup", up); scroll.removeEventListener("pointercancel", up); drag = false; store.commit(); render(); };
    scroll.addEventListener("pointermove", mv); scroll.addEventListener("pointerup", up); scroll.addEventListener("pointercancel", up);
  }
  content.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("input")) return;
    const t = e.target;
    if (t.closest("[data-range]")) return rangeDrag(e, t.closest("[data-range]").dataset.range);
    if (t.closest("[data-marker]")) return itemDrag(e, "marker", t.closest("[data-marker]").dataset.marker);
    if (t.closest("[data-note]")) return itemDrag(e, "note", t.closest("[data-note]").dataset.note);
    if (t.closest("[data-trim]")) return trimStart(e, t.closest("[data-trim]").dataset.trim);
    if (t.closest(".pv-clip")) { drag = true; addEventListener("pointerup", () => setTimeout(() => { drag = false; }, 50), { once: true }); return; } // reorder / click handled by dragReorder
    const cb = t.closest(".pv-cblock, .pv-dblock"); if (cb) { store.selectShot(cb.dataset.shot); return; }
    if (t.closest(".pv-ruler") || t.closest(".pv-row-shots") || t.closest(".pv-row-cam") || t.closest(".pv-row-dlg")) scrubStart(e);
  });
  dragReorder({ container: content, handle: ".pv-clip", items: () => [...content.querySelectorAll(".pv-clip")],
    onDrop: (from, to) => { if (reorderShot(store, from, to)) announce(`Shot moved to position ${to + 1}`); },
    onClick: (item) => { store.selectShot(item.dataset.shot); const s = store.d.seq.find((x) => x.shot.id === item.dataset.shot); if (s) { transport.pause(); transport.seek(s.start); } } });
  content.addEventListener("dblclick", (e) => {
    const m = e.target.closest("[data-marker]"), n = e.target.closest("[data-note]");
    if (m) { const it = store.p.markers.find((x) => x.id === m.dataset.marker); inlineEdit(m.querySelector("span"), it.label, (v) => { store.update(() => { it.label = v; }); store.commit(); }, { max: 40 }); }
    else if (n) { const it = store.p.notes.find((x) => x.id === n.dataset.note); inlineEdit(n.querySelector("span"), it.label, (v) => { store.update(() => { it.label = v; }); store.commit(); }, { max: 80 }); }
    else if (e.target.closest(".pv-row-aud")) addNote(Math.round(frameAt(e.clientX)));
  });
  content.addEventListener("keydown", (e) => {
    const clip = e.target.closest(".pv-clip");
    if (e.target.matches("input")) return;
    if (clip) {
      const seq = store.d.seq, i = seq.findIndex((s) => s.shot.id === clip.dataset.shot);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const dir = e.key === "ArrowLeft" ? -1 : 1; e.preventDefault(); e.stopPropagation();
        if (e.altKey) { if (reorderShot(store, i, clamp(i + dir, 0, seq.length - 1))) { announce(`Shot moved to position ${i + dir + 1}`); requestAnimationFrame(() => content.querySelector(`.pv-clip[data-shot="${clip.dataset.shot}"]`)?.focus()); } }
        else if (e.shiftKey) { const step = e.ctrlKey || e.metaKey ? 10 : 1, shot = seq[i].shot; store.update(() => { shot.len = Math.max(6, shot.len + dir * step); }); store.commit(); announce(`Shot is ${shot.len} frames`); requestAnimationFrame(() => content.querySelector(`.pv-clip[data-shot="${shot.id}"]`)?.focus()); }
        else { const nx = seq[clamp(i + dir, 0, seq.length - 1)]; store.selectShot(nx.shot.id); transport.pause(); transport.seek(nx.start); requestAnimationFrame(() => content.querySelector(`.pv-clip[data-shot="${nx.shot.id}"]`)?.focus()); }
      } else if (e.key === "Enter") { e.preventDefault(); store.selectShot(seq[i].shot.id); transport.pause(); transport.seek(seq[i].start); }
    }
    const note = e.target.closest("[data-note]");
    if (note && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); e.stopPropagation(); const it = store.p.notes.find((x) => x.id === note.dataset.note); store.update(() => { it.frame = Math.max(0, it.frame + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1)); }); store.commit(); requestAnimationFrame(() => content.querySelector(`[data-note="${it.id}"]`)?.focus()); }
  });
  api.deleteSelected = () => {
    const it = store.sel.item;
    if (it) { store.update((p) => { if (it.type === "marker") p.markers = p.markers.filter((m) => m.id !== it.id); else p.notes = p.notes.filter((m) => m.id !== it.id); }); store.sel.item = null; store.commit(); announce("Removed"); return true; }
    if (store.sel.shot) { const ok = deleteShot(store, store.sel.shot); if (ok) announce("Shot deleted. Undo brings it back."); return ok; }
    return false;
  };
  new ResizeObserver(() => { if (!drag) render(); }).observe(scroll);
  api.render = render; api.focusClip = () => content.querySelector(".pv-clip.is-sel, .pv-clip")?.focus();
  return api;
}
