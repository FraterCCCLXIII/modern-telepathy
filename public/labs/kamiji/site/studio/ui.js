// Panels: category nav, part grids, face / pose / materials / accessories / presets panels, the viewport bars, the roster.
import { STYLES, STYLE_BY_ID, CATEGORIES, CAT_BY_ID, SLOT_LABEL, SLOTS_BY_STYLE, REGIONS, PALETTES, ROOMS, LIGHTS, LOOKS, EXPRESSIONS, FACE_RIGS, SOCKETS, POSES } from "./data.js";
import { PARTS, partsFor } from "./parts.js";
import { partOf } from "./figure.js";
import { PRESETS } from "./presets.js";
import { ACC, GROUPS, socketLabel } from "./acc.js";
import { categoryBlock, partBlock, socketBlock, heldSocketFor } from "./rules.js";
import { renderMorphs } from "./morphs.js";

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(e.dataset, v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const KIND_LABEL = { procedural: "PROC", glb: "GLB", derived: "CUT" };
const KIND_TITLE = { procedural: "Procedural part built in three.js", glb: "Real GLB asset from this repository", derived: "Cut out of a real GLB at runtime (rigid)" };

export function createUI(app) {
  const { store, vp } = app;
  const $ = (s) => document.querySelector(s);
  const nav = $("#st-nav"), body = $("#st-parts-body"), insp = $("#st-insp-body");
  let lastFocusKey = null;

  // ---------------------------------------------------------------- roving grids
  function roving(container, selector = ".st-tile") {
    const items = () => [...container.querySelectorAll(selector)];
    const setTab = (el) => { items().forEach((i) => i.setAttribute("tabindex", i === el ? "0" : "-1")); };
    const first = items().find((i) => i.getAttribute("aria-checked") === "true" || i.getAttribute("aria-pressed") === "true") || items()[0];
    if (first) setTab(first);
    container.addEventListener("keydown", (e) => {
      const list = items(), i = list.indexOf(document.activeElement); if (i < 0) return;
      let n = i;
      if (e.key === "ArrowRight") n = i + 1; else if (e.key === "ArrowLeft") n = i - 1; else if (e.key === "Home") n = 0; else if (e.key === "End") n = list.length - 1;
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const top = list[i].offsetTop, cols = list.filter((x) => x.offsetTop === list[0].offsetTop).length || 1;
        n = i + (e.key === "ArrowDown" ? cols : -cols);
      } else return;
      e.preventDefault(); if (n < 0 || n >= list.length) return; setTab(list[n]); list[n].focus();
    });
    container.addEventListener("focusin", (e) => { if (e.target.matches?.(selector)) setTab(e.target); });
  }

  // ---------------------------------------------------------------- tiles
  function tile({ id, label, kind, checked, blocked, title, role = "radio", thumbKey, thumbMake, onPick, onEnter, onLeave, drag }) {
    const img = h("div", { class: "st-ph" });
    const b = h("button", { class: "st-tile", type: "button", role, "aria-checked": role === "radio" ? String(!!checked) : null, "aria-pressed": role === "button" ? String(!!checked) : null, "aria-disabled": blocked ? "true" : null, title: title || label, "data-id": id, draggable: drag ? "true" : null },
      img, h("span", { class: "st-nm", text: label }), kind ? h("span", { class: "st-kind", "data-k": kind, title: KIND_TITLE[kind], text: KIND_LABEL[kind], "aria-hidden": "true" }) : null);
    b.addEventListener("click", () => onPick?.(blocked));
    if (onEnter) { let t = 0; b.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse" || blocked) return; clearTimeout(t); t = setTimeout(() => onEnter(), 220); }); b.addEventListener("pointerleave", () => { clearTimeout(t); onLeave?.(); }); b.addEventListener("blur", () => { clearTimeout(t); onLeave?.(); }); }
    if (drag) { b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/x-studio-acc", id); e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "copy"; app.dragging = id; document.getElementById("st-drop").hidden = false; }); b.addEventListener("dragend", () => { app.dragging = null; document.getElementById("st-drop").hidden = true; }); }
    if (thumbKey) {
      const li = img; // swap placeholder for an <img> when ready
      app.thumbs.request(thumbKey, thumbMake, (url) => { if (!url || !b.isConnected && false) return; const im = h("img", { src: url, alt: "", width: 112, height: 112, loading: "lazy" }); li.replaceWith(im); }, () => b.isConnected);
    }
    return h("div", { class: "st-cell" }, b);
  }

  // ---------------------------------------------------------------- nav
  function renderNav() {
    const ch = store.ch, cur = store.ui.category;
    nav.replaceChildren(...CATEGORIES.map((c) => {
      const blocked = categoryBlock(ch, c.id);
      return h("button", { class: "st-cat", type: "button", "aria-current": cur === c.id ? "true" : "false", "aria-disabled": blocked ? "true" : null, "data-cat": c.id, title: blocked || c.label, onclick: () => app.setCategory(c.id) }, c.label, blocked ? h("small", { text: "n/a", "aria-hidden": "true" }) : null);
    }));
  }
  nav.addEventListener("keydown", (e) => {
    const list = [...nav.querySelectorAll(".st-cat")], i = list.indexOf(document.activeElement); if (i < 0) return;
    const horiz = getComputedStyle(nav).flexDirection === "row";
    const next = { ArrowDown: !horiz ? 1 : 0, ArrowUp: !horiz ? -1 : 0, ArrowRight: horiz ? 1 : 0, ArrowLeft: horiz ? -1 : 0 }[e.key];
    if (next) { e.preventDefault(); list[(i + next + list.length) % list.length].focus(); }
  });

  // ---------------------------------------------------------------- the part panels
  function sectionHead(title, slot) {
    const locked = !!store.ui.locks["slot:" + slot];
    return h("div", { class: "st-sec" }, h("h3", { text: title }), slot ? h("button", { class: "st-mini", type: "button", "aria-pressed": String(locked), title: "Lock this slot: Randomise keeps it", onclick: () => { app.toggleLock("slot:" + slot); } }, locked ? "Locked" : "Lock") : null);
  }
  function slotGrid(slot) {
    const ch = store.ch, style = ch.style, cur = partOf(ch, slot);
    const list = partsFor(slot, style);
    const sb = categoryBlock(ch, slot) ;
    const ul = h("div", { class: "st-grid", role: "radiogroup", "aria-label": SLOT_LABEL[slot] });
    for (const p of list) {
      const block = partBlock(ch, slot, p);
      ul.append(tile({ id: p.id, label: p.label, kind: p.kind, checked: cur?.id === p.id, blocked: !!block, title: block || p.note || p.label,
        thumbKey: app.thumbKey("part", slot, p.id), thumbMake: () => app.thumbForPart(slot, p), onPick: (b) => (b ? app.say(block || "Not available.", true) : app.setPart(slot, p.id)),
        onEnter: () => app.previewPart(slot, p.id), onLeave: () => app.previewPart(null) }));
    }
    roving(ul);
    return ul;
  }
  function renderSlots(cat) {
    const ch = store.ch, frag = [];
    const blk = categoryBlock(ch, cat.id);
    if (blk) { frag.push(h("p", { class: "st-warn", role: "note", text: blk })); }
    for (const slot of cat.slots) {
      if (!SLOTS_BY_STYLE[ch.style].includes(slot)) continue;
      if (blk && cat.slots.length === 1) continue;
      frag.push(sectionHead(SLOT_LABEL[slot], slot), slotGrid(slot));
      const cur = partOf(ch, slot); if (cur?.note) frag.push(h("p", { class: "st-note", text: cur.note }));
    }
    if (STYLE_BY_ID[ch.style].engine === "glb" && ch.style !== "shapes" && cat.id === "body") frag.push(h("p", { class: "st-note", text: "These are real GLBs used as whole bases. Parts inside them are not separable, so the other categories cover colours, face, pose and accessories." }));
    return frag;
  }
  function renderStyle() {
    const ch = store.ch;
    const ul = h("div", { class: "st-grid", role: "radiogroup", "aria-label": "Style" });
    for (const s of STYLES) ul.append(tile({ id: s.id, label: s.label, kind: s.engine === "glb" ? "glb" : "procedural", checked: ch.style === s.id, title: s.note, thumbKey: app.thumbKey("style", s.id), thumbMake: () => app.thumbForStyle(s.id), onPick: () => app.setStyle(s.id) }));
    roving(ul);
    return [sectionHead("Style"), ul, h("p", { class: "st-note", text: STYLE_BY_ID[ch.style].note }), h("p", { class: "st-note", text: "Mix keeps the Human rig and unlocks creature parts, GLB shape heads and Kamikin ears and tails where sockets allow." })];
  }
  function renderFace() {
    const ch = store.ch, st = STYLE_BY_ID[ch.style], fig = app.fig;
    const out = [sectionHead("Face rig")];
    const rigs = st.engine === "proc" || ch.style === "shapes" ? FACE_RIGS : null;
    if (rigs) {
      const g = h("div", { class: "st-face-btns", role: "radiogroup", "aria-label": "Face rig" });
      for (const [id, lb] of rigs) g.append(h("button", { class: "st-btn st-btn-sm", type: "button", role: "radio", "aria-checked": String(ch.face.rig === id), "aria-pressed": String(ch.face.rig === id), onclick: () => app.setFace({ rig: id }) }, lb));
      out.push(g, h("p", { class: "st-note", text: "RTK and tube are the site's own face rigs (rtk-mouth.js, tube-face.js) projected onto the head. On heads with a snout the classic rig places the mouth on the snout." }));
    } else if (ch.style === "kamiji") out.push(h("p", { class: "st-note", text: "The Kamiji hand has its own morph-target face: use the expression buttons and the Face, Eyes and Brows sliders." }));
    else out.push(h("p", { class: "st-note", text: "Kamikin and Rubbernose faces are baked texture states (neutral, happy, joy, sad, surprised, blink). The expression buttons swap between them." }));
    out.push(sectionHead("Expression"));
    const eg = h("div", { class: "st-face-btns", role: "radiogroup", "aria-label": "Expression" });
    for (const e of EXPRESSIONS) eg.append(h("button", { class: "st-btn st-btn-sm", type: "button", role: "radio", "aria-checked": String(ch.face.expression === e), "aria-pressed": String(ch.face.expression === e), onclick: () => app.setExpression(e), text: e }));
    out.push(eg);
    out.push(h("p", { class: "st-note", text: fig?.noMouthOpen || "Mouth-open test: use the slider in the viewport bar. It drives the face rig live and is not saved." }));
    return out;
  }
  function renderPose() {
    const ch = store.ch, fig = app.fig, st = STYLE_BY_ID[ch.style];
    const names = fig ? (fig.clips || []).map((c) => c.name) : [];
    const out = [sectionHead("Pose and animation")];
    if (!names.length) out.push(h("p", { class: "st-note", text: "This style has no animation clips. Use the turntable and camera presets." }));
    const g = h("div", { class: "st-pose", role: "radiogroup", "aria-label": "Clip" });
    for (const n of names) g.append(h("button", { class: "st-btn st-btn-sm", type: "button", role: "radio", "aria-checked": String(fig.clipName === n), "aria-pressed": String(fig.clipName === n), onclick: () => app.setClip(n), text: n }));
    out.push(g);
    if (names.length) {
      out.push(h("div", { class: "st-ctl" }, h("button", { class: "st-btn st-btn-sm", type: "button", id: "st-play2", "aria-pressed": String(!!fig?.playing), onclick: () => app.togglePlay() }, fig?.playing ? "Playing" : "Paused"), h("label", { class: "st-mouth" }, "Time", h("input", { type: "range", min: 0, max: 100, value: 0, id: "st-scrub", "aria-label": "Scrub the clip", oninput: (e) => app.scrub(+e.target.value / 100) }))));
      out.push(h("p", { class: "st-note", text: app.reduceMotion ? "Reduced motion is on: clips start paused and the turntable is disabled." : st.engine === "proc" ? "Procedural clips are generated for the rig and play on any body plan (quadrupeds walk in pairs, six-legged bodies in tripods)." : "These are the clips baked into the GLB." }));
    }
    return out;
  }
  function renderMaterials() {
    const ch = store.ch, st = STYLE_BY_ID[ch.style], fig = app.fig;
    const out = [h("div", { class: "st-sec" }, h("h3", { text: "Palettes" }))];
    if (st.engine === "proc") {
      const chips = h("div", { class: "st-chips" });
      for (const p of PALETTES) chips.append(h("button", { class: "st-chip", type: "button", title: p.label, "aria-label": "Palette " + p.label, onclick: () => app.setPalette(p) }, ["skin", "cloth", "accent"].map((k) => h("i", { style: `background:${p.c[k]}`, "aria-hidden": "true" })), h("span", { text: p.label })));
      out.push(chips);
    } else out.push(h("p", { class: "st-note", text: "Colours below recolour the GLB's own materials by name." }));
    out.push(h("div", { class: "st-sec" }, h("h3", { text: "Regions" })));
    const regions = REGIONS[ch.style] || [];
    const cols = app.currentColors();
    for (const [rid, lb] of regions) {
      const c = cols[rid] || { color: "#cccccc", color2: "#cccccc", grad: 0, rough: 0.7 };
      const row = h("div", { class: "st-mat", "data-region": rid }, h("span", { class: "st-mn", text: lb }));
      row.append(h("label", { class: "st-sub" }, "Base", h("input", { class: "st-color", type: "color", value: c.color, "aria-label": lb + " base colour", oninput: (e) => app.setRegion(rid, { color: e.target.value }, true), onchange: () => store.endLive() })));
      if (st.engine === "proc") {
        row.append(h("label", { class: "st-sub" }, "Second", h("input", { class: "st-color", type: "color", value: c.color2 || c.color, "aria-label": lb + " secondary colour", oninput: (e) => app.setRegion(rid, { color2: e.target.value }, true), onchange: () => store.endLive() })));
        row.append(h("label", { class: "st-sub" }, "Blend", h("input", { type: "range", min: 0, max: 1, step: 0.01, value: c.grad || 0, "aria-label": lb + " gradient to secondary colour", oninput: (e) => app.setRegion(rid, { grad: +e.target.value }, true), onchange: () => store.endLive() })));
        row.append(h("label", { class: "st-sub" }, "Rough", h("input", { type: "range", min: 0, max: 1, step: 0.01, value: c.rough ?? 0.72, "aria-label": lb + " roughness", oninput: (e) => app.setRegion(rid, { rough: +e.target.value }, true), onchange: () => store.endLive() })));
      }
      out.push(row);
    }
    out.push(h("div", { class: "st-sec" }, h("h3", { text: "Look" })));
    const look = ch.look;
    const lg = h("div", { class: "st-face-btns" });
    if (st.engine === "proc") lg.append(h("label", { class: "st-sub" }, "Toon steps ", h("select", { class: "st-select st-sm", "aria-label": "Toon steps", onchange: (e) => app.setLook({ steps: +e.target.value }) }, [[0, "Smooth"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]].map(([v, t]) => h("option", { value: v, selected: look.steps === v ? "" : null, text: t })))));
    lg.append(h("button", { class: "st-btn st-btn-sm", type: "button", "aria-pressed": String(look.outline), onclick: () => app.setLook({ outline: !look.outline }) }, "Outline"));
    out.push(lg);
    const fx = h("div", { class: "st-face-btns", role: "group", "aria-label": "Screen looks" });
    for (const [id, lb] of LOOKS) fx.append(h("button", { class: "st-btn st-btn-sm", type: "button", "aria-pressed": String(look.effects.includes(id)), onclick: () => app.toggleEffect(id) }, lb));
    out.push(fx, h("p", { class: "st-note", text: "Looks reuse the site's screen effects (effects.js). They draw in the viewport only: exports are plain colours." }));
    return out;
  }
  function renderPresets() {
    const ul = h("div", { class: "st-grid", role: "group", "aria-label": "Presets" });
    for (const p of PRESETS) ul.append(tile({ id: p.name, label: p.name, role: "button", kind: null, checked: store.ch.name === p.name, thumbKey: app.thumbKey("preset", p.name), thumbMake: () => app.thumbForCharacter(p, "all"), onPick: () => app.loadPreset(p) }));
    roving(ul);
    return [sectionHead("Presets"), h("p", { class: "st-note", text: `${PRESETS.length} presets across the styles. Loading one replaces the character (undo restores it).` }), ul];
  }
  function renderAccessories() {
    const ch = store.ch, fig = app.fig, out = [];
    out.push(h("div", { class: "st-sec" }, h("h3", { text: "Sockets" })));
    const ul = h("ul", { class: "st-sockets", "aria-label": "Accessory sockets. Drop an accessory on a row." });
    for (const s of SOCKETS) {
      const w = ch.accessories.find((a) => a.socket === s.id), entry = w && ACC.byId.get(w.id), block = socketBlock(ch, fig, s.id);
      const row = h("li", { class: "st-socket" + (block ? " is-blocked" : ""), "data-socket": s.id, title: block || "Drop an accessory here" },
        h("b", { text: s.label }), h("span", { text: entry ? entry.label : "empty" }));
      const act = h("span", {});
      if (entry && (entry.tints || entry.kind === "proc")) act.append(h("input", { class: "st-color", type: "color", value: w.tint || entry.tint || "#cccccc", "aria-label": entry.label + " colour", oninput: (e) => app.tintAccessory(s.id, e.target.value, true), onchange: () => store.endLive() }));
      if (entry) act.append(h("button", { class: "st-x", type: "button", "aria-label": "Remove " + entry.label, onclick: () => app.removeAcc(s.id) }, "×"));
      row.append(act);
      row.addEventListener("dragover", (e) => { if (app.dragging && !block) { e.preventDefault(); row.classList.add("is-over"); } });
      row.addEventListener("dragleave", () => row.classList.remove("is-over"));
      row.addEventListener("drop", (e) => { e.preventDefault(); row.classList.remove("is-over"); const id = e.dataTransfer.getData("text/x-studio-acc") || app.dragging; app.dropAccessory(id, s.id); });
      ul.append(row);
    }
    out.push(ul);
    const q = h("input", { class: "st-text", type: "search", placeholder: "Filter accessories", "aria-label": "Filter accessories", value: app.accFilter || "", style: "width:100%;margin:6px 0", oninput: (e) => { app.accFilter = e.target.value; renderAccLib(); } });
    out.push(q);
    const lib = h("div", { id: "st-acc-lib" }); out.push(lib);
    out.push(h("p", { class: "st-note", text: "Drag a tile onto the model or onto a socket row, or press Enter on a tile. 36 head, face, ear, hair and neck accessories and 14 held props are real GLBs; back, waist, feet and tail items are procedural." }));
    function renderAccLib() {
      lib.replaceChildren();
      const f = (app.accFilter || "").toLowerCase();
      for (const [sock, title] of GROUPS) {
        const items = ACC.list.filter((a) => a.socket === sock && (!f || a.label.toLowerCase().includes(f) || (a.keywords || []).some((k) => k.includes(f))));
        if (!items.length) continue;
        const g = h("div", { class: "st-grid", role: "group", "aria-label": title });
        for (const a of items) {
          const wornNow = ch.accessories.some((x) => x.id === a.id);
          g.append(tile({ id: a.id, label: a.label, role: "button", kind: a.kind === "proc" ? "procedural" : "glb", checked: wornNow, drag: true, thumbKey: app.thumbKey("acc", a.id), thumbMake: () => app.thumbForAccessory(a), onPick: () => app.toggleAcc(a) }));
        }
        lib.append(h("div", { class: "st-sec" }, h("h3", { text: title })), g); roving(g);
      }
    }
    renderAccLib();
    return out;
  }

  function renderParts() {
    const ch = store.ch, cat = CAT_BY_ID[store.ui.category] || CAT_BY_ID.style;
    const active = document.activeElement, key = active?.closest?.("#st-parts-body") ? (active.dataset?.id || active.id || null) : null;
    $("#st-parts-h").textContent = cat.label;
    $("#st-legend").textContent = "PROC procedural / GLB real asset / CUT cut from a GLB";
    let nodes;
    if (cat.id === "style") nodes = renderStyle();
    else if (cat.id === "face") nodes = renderFace();
    else if (cat.id === "pose") nodes = renderPose();
    else if (cat.id === "materials") nodes = renderMaterials();
    else if (cat.id === "presets") nodes = renderPresets();
    else if (cat.id === "accessories") nodes = renderAccessories();
    else nodes = renderSlots(cat);
    body.replaceChildren(...nodes);
    if (key) { const el = [...body.querySelectorAll("[data-id]")].find((e) => e.dataset.id === key) || (active.id ? document.getElementById(active.id) : null); el?.focus?.({ preventScroll: true }); }
  }

  // ---------------------------------------------------------------- morphs
  function renderInsp() { renderMorphs(app, insp); }

  // ---------------------------------------------------------------- viewport bars
  function buildBars() {
    const top = document.querySelector(".st-vp-top"), bot = document.querySelector(".st-vp-bot");
    const sel = (id, label, opts, val, onchange) => h("label", { class: "st-sel" }, h("span", { class: "sr-only", text: label }), h("select", { class: "st-select st-sm", id, "aria-label": label, onchange: (e) => onchange(e.target.value) }, opts.map(([v, t]) => h("option", { value: v, selected: v === val ? "" : null, text: t }))));
    top.replaceChildren(
      ...[["front", "Front"], ["three", "3/4"], ["side", "Side"], ["back", "Back"], ["top", "Top"]].map(([k, t]) => h("button", { class: "st-btn st-btn-sm", type: "button", "data-cam": k, onclick: () => vp.cameraPreset(k), "aria-label": "Camera " + t }, t)),
      h("button", { class: "st-btn st-btn-sm", type: "button", id: "st-turn", "aria-pressed": "false", onclick: () => app.toggleTurntable(), title: app.reduceMotion ? "Turntable is disabled when reduced motion is on" : "Auto-rotate the camera" }, "Turntable"),
      h("button", { class: "st-btn st-btn-sm", type: "button", id: "st-mirror", "aria-pressed": "false", onclick: () => app.toggleMirror(), title: "Mirror the model left to right (view only)" }, "Mirror"),
      sel("st-view-mode", "View mode", [["shaded", "Shaded"], ["wire", "Wireframe"], ["matcap", "Matcap"]], "shaded", (v) => app.setViewMode(v)),
      sel("st-room", "Background", Object.entries(ROOMS).map(([k, r]) => [k, r.label]), store.ch.look.room, (v) => app.setLook({ room: v })),
      sel("st-light", "Lighting", Object.entries(LIGHTS), vp.lightId, (v) => { vp.setLight(v); }));
    bot.replaceChildren(
      sel("st-pose-sel", "Animation", [["idle", "idle"]], "idle", (v) => app.setClip(v)),
      h("button", { class: "st-btn st-btn-sm", type: "button", id: "st-play", "aria-pressed": "true", onclick: () => app.togglePlay() }, "Play"),
      sel("st-expr", "Expression", EXPRESSIONS.map((e) => [e, e]), "neutral", (v) => app.setExpression(v)),
      h("label", { class: "st-mouth" }, "Mouth", h("input", { type: "range", id: "st-mouth", min: 0, max: 1, step: 0.01, value: 0, "aria-label": "Mouth open test", oninput: (e) => app.setMouthOpen(+e.target.value) })));
  }
  function syncBars() {
    const ch = store.ch, fig = app.fig;
    const set = (id, v) => { const e = document.getElementById(id); if (e && e.value !== String(v)) e.value = v; };
    set("st-room", ch.look.room); set("st-light", vp.lightId); set("st-expr", ch.face.expression);
    const ps = document.getElementById("st-pose-sel");
    if (ps && fig) { const names = (fig.clips || []).map((c) => c.name); if (ps.options.length !== names.length || [...ps.options].some((o, i) => o.value !== names[i])) ps.replaceChildren(...names.map((n) => h("option", { value: n, text: n }))); ps.disabled = !names.length; if (fig.clipName) ps.value = fig.clipName; }
    const pl = document.getElementById("st-play"); if (pl) { pl.setAttribute("aria-pressed", String(!!fig?.playing)); pl.textContent = fig?.playing ? "Pause" : "Play"; pl.disabled = !(fig?.clips || []).length; }
    const tt = document.getElementById("st-turn"); if (tt) { tt.setAttribute("aria-pressed", String(vp.turntable())); tt.disabled = app.reduceMotion; }
    const mo = document.getElementById("st-mouth"); if (mo) { const no = !!fig?.noMouthOpen; mo.disabled = no; mo.title = no ? fig.noMouthOpen : "Mouth open test"; }
    document.querySelectorAll("[data-cam]").forEach((b) => b.removeAttribute("aria-pressed"));
  }

  // ---------------------------------------------------------------- roster
  function renderRoster() {
    const strip = $("#st-strip"), r = store.roster;
    $("#st-roster-note").textContent = store.storageOk() ? "Saved in this browser" : "Browser storage is blocked: the roster lasts for this session only";
    strip.replaceChildren(...(r.length ? r.map((c) => h("li", { class: "st-card" }, h("button", { class: "st-load", type: "button", title: `Load ${c.name} (${STYLE_BY_ID[c.ch.style]?.label || c.ch.style})`, onclick: () => app.loadRoster(c.id) }, c.thumb ? h("img", { src: c.thumb, alt: "", width: 96, height: 52 }) : h("div", { class: "st-ph", style: "height:52px;border-radius:8px" }), h("span", { text: c.name })), h("button", { class: "st-del", type: "button", "aria-label": "Delete " + c.name, onclick: () => app.deleteRoster(c.id) }, "×"))) : [h("li", { class: "st-empty", text: "Nothing saved yet. Press Save to keep this character here." })]));
  }
  function renderTop() {
    const nm = $("#st-name"); if (document.activeElement !== nm) nm.value = store.ch.name;
    document.querySelector('[data-cmd="undo"]').disabled = !store.canUndo; document.querySelector('[data-cmd="redo"]').disabled = !store.canRedo;
  }
  function renderLegendBox() {
    const box = $("#st-legend-box"); if (!box) return;
    const rows = [["GLB", "Kamikin (14), Rubbernose (16), Shapes (1 mesh, 34 morph targets), the Kamiji hand, 36 accessories, 14 held props, 10 shape heads for Mix."], ["CUT", "Kamikin ears (9 characters) and tails (8), Rubbernose glove and shoe: geometry cut from the real GLBs at runtime by bone weight. Rigid, not skinned."], ["PROC", `${PARTS.filter((p) => p.kind === "procedural").length} procedural parts built from capsules, lathes, tubes and ellipsoids; heads carry six real blendshapes. Back, waist, feet and tail accessories are procedural too.`]];
    box.replaceChildren(...rows.map(([k, t]) => h("p", {}, h("b", { text: k }), t)));
  }

  const ui = { renderNav, renderParts, renderInsp, renderRoster, renderTop, buildBars, syncBars, renderLegendBox, all() { renderNav(); renderParts(); renderInsp(); renderRoster(); renderTop(); syncBars(); } };
  return ui;
}
