// Storyboard strip + print board: a frame per shot with a real render of its first frame.
import { SHOT_TYPES, MOVES } from "./catalog.js";
import { el, dragReorder, announce } from "./ui.js";
import { applyMove, reorderShot, addShot } from "./ops.js";
import { seconds, timecode } from "./store.js";
import { shotText, setShotText, charName, NARRATOR } from "./script.js";

export function createBoard({ store, thumbs, transport, root, printHost }) {
  const strip = root.querySelector(".pv-strip");
  const frames = new Map(); // shot id -> element
  const api = {};

  function field(tag, attrs, get, set, scope = "all") {
    const i = el(tag, attrs);
    i.value = get();
    i.addEventListener("input", () => { if (i.type === "number" && i.value === "") return; store.update(() => set(i.type === "number" ? +i.value : i.value), scope); });
    i.addEventListener("change", () => store.commit());
    i._sync = () => { if (document.activeElement !== i && String(i.value) !== String(get())) i.value = get(); };
    return i;
  }
  function make(s) {
    const shot = () => store.d.seq.find((x) => x.shot.id === s.shot.id)?.shot || s.shot;
    const li = el("li", { class: "pv-frame", "data-shot": s.shot.id, tabindex: "-1" });
    const grip = el("button", { class: "pv-grip", type: "button", "aria-label": "Drag to reorder, or Alt+arrow keys", title: "Drag to reorder (Alt+Left / Right with the grip focused)", text: "☰" });
    grip.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); const seq = store.d.seq, i = seq.findIndex((x) => x.shot.id === s.shot.id), to = Math.min(seq.length - 1, Math.max(0, i + (e.key === "ArrowLeft" ? -1 : 1)));
        if (reorderShot(store, i, to)) { announce(`Shot moved to position ${to + 1}`); requestAnimationFrame(() => frames.get(s.shot.id)?.querySelector(".pv-grip")?.focus()); } }
    });
    const img = el("img", { class: "pv-frame-img", alt: "", draggable: "false", width: 320, height: 180 });
    const type = field("select", { class: "pv-select pv-sm", "aria-label": "Shot type" }, () => shot().type, (v) => { shot().type = v; });
    SHOT_TYPES.forEach((t) => type.append(el("option", { value: t, text: t }))); type.value = shot().type;
    const move = el("select", { class: "pv-select pv-sm", "aria-label": "Camera move" }, ...MOVES.map((t) => el("option", { value: t, text: t }))); move.value = shot().move;
    move.addEventListener("change", () => { store.update(() => applyMove(shot(), move.value)); store.commit(); announce(`${move.value}: camera B keyframe updated`); });
    move._sync = () => { if (document.activeElement !== move) move.value = shot().move; };
    const len = field("input", { type: "number", min: 6, max: 2000, step: 1, class: "pv-num pv-sm", "aria-label": "Duration in frames" }, () => shot().len, (v) => { shot().len = Math.max(6, Math.round(v)); });
    const dur = el("span", { class: "pv-dur" });
    // caption and dialogue are views of the script lines assigned to this shot: typing edits the first line of that kind (or creates one)
    const lineField = (tag, attrs, kind) => {
      const i = el(tag, attrs), cur = () => shotText(store.p, s.shot.id, kind);
      i.addEventListener("input", () => { const sc = store.d.seq.find((x) => x.shot.id === s.shot.id); if (sc) { setShotText(store, sc.node, sc.shot, kind, i.value); } });
      i.addEventListener("change", () => store.commit());
      i._sync = () => { const c = cur(); if (document.activeElement !== i) i.value = c.first?.text || ""; i.title = c.count > 1 ? `${c.count} lines on this shot; the Script drawer edits all of them.` : ""; i.dataset.more = c.count > 1 ? `+${c.count - 1}` : ""; };
      i._sync(); return i;
    };
    const cap = lineField("textarea", { class: "pv-text pv-sm", rows: 2, maxlength: 2000, placeholder: "Action / caption", "aria-label": "Caption (action line)" }, "action");
    const dlg = lineField("input", { type: "text", class: "pv-text pv-sm", maxlength: 2000, placeholder: "Dialogue", "aria-label": "Dialogue" }, "dialogue");
    const nts = field("input", { type: "text", class: "pv-text pv-sm", maxlength: 2000, placeholder: "Notes", "aria-label": "Shot notes" }, () => shot().notes, (v) => { shot().notes = v; });
    li.append(el("div", { class: "pv-frame-body" },
      el("div", { class: "pv-frame-l" }, el("div", { class: "pv-frame-th" }, img, el("span", { class: "pv-th-empty", text: "rendering\u2026" }), el("span", { class: "pv-frame-n" }), el("span", { class: "pv-gen-badge", hidden: true }), grip), el("div", { class: "pv-frame-row" }, type, len), el("div", { class: "pv-frame-row" }, move, dur)),
      el("div", { class: "pv-frame-r" }, el("span", { class: "pv-frame-node" }), cap, dlg, nts)));
    li._f = { img, type, move, len, cap, dlg, nts, dur };
    return li;
  }
  function render() {
    const d = store.d, ids = new Set(d.seq.map((s) => s.shot.id));
    for (const [id, li] of frames) if (!ids.has(id)) { li.remove(); frames.delete(id); }
    strip.querySelector(".pv-strip-empty")?.remove();
    if (!d.seq.length) strip.append(el("li", { class: "pv-strip-empty", text: store.p.nodes.length ? "No shots in the cut. Select a scene node and press Shift+S to add one." : "The storyboard fills in as you add scene nodes. Each shot gets a frame, a caption and a real render of its first frame." }));
    let prev = null;
    d.seq.forEach((s, i) => {
      let li = frames.get(s.shot.id);
      if (!li) { li = make(s); frames.set(s.shot.id, li); }
      const want = prev ? prev.nextElementSibling : strip.firstElementChild;
      if (want !== li) strip.insertBefore(li, want);
      prev = li;
      const f = li._f;
      li.classList.toggle("is-sel", store.sel.shot === s.shot.id);
      li.querySelector(".pv-frame-n").textContent = String(s.n).padStart(2, "0");
      li.querySelector(".pv-frame-node").textContent = s.node.name;
      { const g = s.shot.gen, gb = li.querySelector(".pv-gen-badge"); gb.hidden = !g; if (g) { gb.textContent = `gen v${g.v}${g.accepted ? " ✓" : ""}`; gb.title = `Mockup generation: v${g.v} by ${g.by}${g.note ? " (" + g.note + ")" : ""}. Prompt: ${g.prompt}`; } }
      li.setAttribute("aria-label", `Shot ${s.n}, ${s.node.name}`);
      [f.type, f.move, f.len, f.cap, f.dlg, f.nts].forEach((c) => c._sync?.());
      f.dur.textContent = `${seconds(s.len, store.p.fps)} · ${timecode(s.start, store.p.fps).slice(3)}`;
      const url = thumbs.get(s.node, s.shot, () => paintThumb(s.shot.id));
      if (url) setImg(li, url);
    });
  }
  function setImg(li, url) { const im = li._f.img; if (im.src !== url) im.src = url; li.classList.add("has-img"); im.alt = "Start frame of this shot"; }
  function paintThumb(id) { const s = store.d.seq.find((x) => x.shot.id === id), li = frames.get(id); if (!s || !li) return; const u = thumbs.get(s.node, s.shot); if (u) setImg(li, u); }
  dragReorder({ container: strip, handle: ".pv-grip, .pv-frame-th, .pv-frame-node", items: () => [...strip.querySelectorAll(".pv-frame")],
    onDrop: (from, to) => { if (reorderShot(store, from, to)) announce(`Shot moved to position ${to + 1}`); },
    onClick: (item) => { store.selectShot(item.dataset.shot); const s = store.d.seq.find((x) => x.shot.id === item.dataset.shot); if (s) { transport.pause(); transport.seek(s.start); } } });
  strip.addEventListener("focusin", (e) => { const li = e.target.closest(".pv-frame"); if (li && store.sel.shot !== li.dataset.shot) store.selectShot(li.dataset.shot); });
  root.querySelector("[data-act=addshot]")?.addEventListener("click", () => { const n = store.p.nodes.find((x) => x.id === store.sel.nodes[0] && x.type === "scene"); if (n) addShot(store, n.id); else announce("Select a scene node first"); });

  // ---- print board (6 per page) ----------------------------------------------------------------------
  api.buildPrint = async (only = null) => {
    await thumbs.all();
    const d = store.d, p = store.p; printHost.replaceChildren(); printHost.dataset.kind = "board";
    printHost.append(el("header", { class: "pb-head" }, el("h1", { text: p.name }), el("p", { text: `Storyboard · ${d.seq.length} shots · ${timecode(d.total, p.fps)} at ${p.fps} fps · Previs prototype` })));
    const grid = el("ol", { class: "pb-grid" });
    d.seq.filter((s) => !only || only.includes(s.shot.id)).forEach((s) => {
      const url = thumbs.get(s.node, s.shot);
      const act = shotText(p, s.shot.id, "action").lines.map((l) => l.text).join(" "), dia = shotText(p, s.shot.id, "dialogue").lines.map((l) => (l.char === NARRATOR ? "" : charName(p, l.char).toUpperCase() + ": ") + l.text).join(" / ");
      grid.append(el("li", { class: "pb-cell" }, el("div", { class: "pb-img" }, url ? el("img", { src: url, alt: `Shot ${s.n} start frame` }) : el("span", { text: "no render" })),
        el("div", { class: "pb-meta" }, el("b", { text: `${String(s.n).padStart(2, "0")}` }), el("span", { text: `${s.shot.type} · ${s.shot.move} · ${seconds(s.len, p.fps)}` }), el("span", { class: "pb-node", text: s.node.name })),
        act ? el("p", { class: "pb-cap", text: act }) : null, dia ? el("p", { class: "pb-dlg", text: dia }) : null, s.shot.notes ? el("p", { class: "pb-note", text: "Note: " + s.shot.notes }) : null));
    });
    printHost.append(grid);
  };
  api.render = render;
  return api;
}
