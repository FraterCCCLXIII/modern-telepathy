// Inspector: story-level properties for the selected node (scene, branch, import, export), or, inside an artboard, the selected sub-node.
import { CHARS, CHAR_BY_ID, LIGHTS, BG_SWATCHES, SHOT_TYPES, MOVES, EASES } from "./catalog.js";
import { el, announce } from "./ui.js";
import { applyMove, addShot, deleteShot } from "./ops.js";
import { seconds } from "./store.js";
import { SOURCES, SINKS, STATUS_LABEL, PROVIDERS, SOCIAL } from "./nodekinds.js";
import { CONTROL_KINDS, CONTROL_RENDERED, OTHER_KINDS, outputNode, inputsOf, effectiveRef, makeSub, uid, SUB_LABEL } from "./art.js";
import { KINDS as LINE_KINDS, STATUSES, charName, linesOfScriptNode, scriptNodeChar, addLine, patchLine, deleteLine } from "./script.js";

export function createInspector({ store, stage, viewport, root, io, deps }) {
  const host = root.querySelector(".pv-inspector-body"), titleEl = root.querySelector(".pv-inspector > .pv-panel-h h2");
  let key = "", fields = [], accList = [], lastP = null;
  stage?.accessories().then((a) => { accList = a; key = ""; render(); });

  const selNode = () => store.p.nodes.find((n) => n.id === (store.sel.open || store.sel.nodes[0])) || null;
  const selShot = (n) => (n ? n.shots.find((s) => s.id === store.sel.shot) || null : null);

  function bind(input, get, set, { scope = "props", live = true } = {}) {
    fields.push(() => { if (document.activeElement !== input) { const v = get(); if (String(input.value) !== String(v ?? "")) input.value = v ?? ""; } });
    input.addEventListener(live ? "input" : "change", () => { if (input.type === "number" && input.value === "") return; store.update(() => set(input.type === "number" ? +input.value : input.value), scope); });
    input.addEventListener("change", () => store.commit());
    return input;
  }
  const row = (label, ...ctl) => el("label", { class: "pv-field" }, el("span", { class: "pv-lbl", text: label }), ...ctl);
  const group = (title, ...kids) => el("section", { class: "pv-ig" }, el("h3", { text: title }), ...kids);
  const sel = (opts) => el("select", { class: "pv-select" }, ...opts.map(([v, t]) => el("option", { value: v, text: t })));
  const num = (step, min, max, label) => el("input", { type: "number", step, min, max, class: "pv-num", "aria-label": label });
  const btn = (text, fn, cls = "") => el("button", { class: "pv-btn pv-btn-sm " + cls, type: "button", text, onclick: fn });
  const charSelect = (get, set, label) => {
    const cs = el("select", { class: "pv-select", "aria-label": label });
    const groups = new Map(); CHARS.forEach((d) => { if (!groups.has(d.group)) groups.set(d.group, el("optgroup", { label: d.group })); groups.get(d.group).append(el("option", { value: d.id, text: d.label })); });
    groups.forEach((g) => cs.append(g)); cs.value = get(); if (cs.value !== get()) { cs.append(el("option", { value: get(), text: get() })); cs.value = get(); }
    cs.addEventListener("change", () => { store.update(() => set(cs.value)); store.commit(); }); fields.push(() => { if (document.activeElement !== cs) cs.value = get(); });
    return cs;
  };

  // ---- shot / camera pieces (shared by scene inspector and Camera sub-node) ---------------------------
  function camBlock(shot, tag, title) {
    const k = () => (tag === "A" ? shot.cam.a : shot.cam.b);
    const g = (i, lab) => bind(num(0.1, undefined, undefined, `${title} ${lab}`), () => (i < 3 ? k().p[i] : i < 6 ? k().t[i - 3] : k().fov), (v) => { if (i === 6) k().fov = Math.min(100, Math.max(10, v)); else if (i < 3) k().p[i] = v; else k().t[i - 3] = v; });
    return el("fieldset", { class: "pv-cam" }, el("legend", { text: `${tag}: ${title}` }),
      el("div", { class: "pv-cam-grid" }, el("span", { class: "pv-lbl", text: "pos" }), g(0, "x"), g(1, "y"), g(2, "z"), el("span", { class: "pv-lbl", text: "look" }), g(3, "x"), g(4, "y"), g(5, "z"), el("span", { class: "pv-lbl", text: "fov" }), g(6, "fov")),
      el("div", { class: "pv-btnrow" },
        btn("Set from view", () => { store.update(() => { const v = viewport.currentKey(); if (tag === "A") shot.cam.a = v; else shot.cam.b = v; }); store.commit(); announce(`Keyframe ${tag} set from the current view`); key = ""; render(); }),
        btn("View " + tag, () => viewport.applyKeyToFree(k()))));
  }
  function shotSection(n, shot) {
    const idx = n.shots.indexOf(shot);
    const typeS = bind(sel(SHOT_TYPES.map((t) => [t, t])), () => shot.type, (v) => { shot.type = v; }, { scope: "all" });
    const moveS = sel(MOVES.map((t) => [t, t])); moveS.value = shot.move;
    moveS.addEventListener("change", () => { store.update(() => applyMove(shot, moveS.value), "all"); store.commit(); announce(`Camera move ${moveS.value}: B keyframe set from A`); key = ""; render(); });
    fields.push(() => { if (document.activeElement !== moveS) moveS.value = shot.move; });
    const len = bind(num(1, 6, 2000, "Duration in frames"), () => shot.len, (v) => { shot.len = Math.max(6, Math.round(v)); }, { scope: "all" });
    const off = bind(num(1, 0, 9999, "Start offset in frames"), () => shot.off, (v) => { shot.off = Math.max(0, Math.round(v)); }, { scope: "all" });
    const ease = bind(sel(EASES.map((t) => [t, t])), () => shot.cam.ease, (v) => { shot.cam.ease = v; });
    fields.push(() => { const u = host.querySelector("#pv-len-s"); if (u) u.textContent = seconds(shot.len, store.p.fps); });
    return group(`Shot ${idx + 1} of ${n.shots.length}`, row("Shot type", typeS), row("Camera move", moveS), row("Frames", len, el("span", { class: "pv-unit", id: "pv-len-s" })), row("Scene offset", off), row("Easing", ease),
      camBlock(shot, "A", "Start keyframe"), camBlock(shot, "B", "End keyframe"),
      el("div", { class: "pv-btnrow" }, btn("Add shot", () => addShot(store, n.id)), btn("Delete shot", () => deleteShot(store, shot.id))));
  }
  const notesGroup = (n) => group("Notes", bind(el("textarea", { class: "pv-text", rows: 3, maxlength: 4000, placeholder: "Notes for this node: intent, constraints, to-do." }), () => n.notes, (v) => { n.notes = v; }, { scope: "all" }));

  // ---- look helpers: the Look controls edit the artboard (the single source of truth) -----------------
  function lookSection(n) {
    const art = n.art, o = outputNode(art);
    const bgNode = () => art.edges.filter((e) => e.to === o.id && e.tp === "scene").map((e) => art.nodes.find((x) => x.id === e.from)).find((x) => x?.type === "content" && x.kind === "background");
    const lightNode = () => art.edges.filter((e) => e.to === o.id && e.tp === "light").map((e) => art.nodes.find((x) => x.id === e.from)).find((x) => x?.type === "light");
    const setBg = (c) => store.update(() => { let b = bgNode(); if (!b) { b = makeSub("content", { kind: "background", color: c }, [0, 0]); art.nodes.push(b); art.edges.push({ id: uid("x"), from: b.id, fp: "out", to: o.id, tp: "scene" }); } b.color = c; });
    const setLight = (v) => store.update(() => { let l = lightNode(); if (!l) { l = makeSub("light", { preset: v }, [0, 0]); art.nodes.push(l); art.edges.push({ id: uid("x"), from: l.id, fp: "out", to: o.id, tp: "light" }); } l.preset = v; });
    const color = el("input", { type: "color", class: "pv-color", "aria-label": "Background colour" });
    fields.push(() => { if (document.activeElement !== color) color.value = bgNode()?.color || "#e7e6e1"; });
    color.addEventListener("input", () => setBg(color.value)); color.addEventListener("change", () => store.commit());
    const light = sel(Object.entries(LIGHTS)); fields.push(() => { if (document.activeElement !== light) light.value = lightNode()?.preset || "soft"; });
    light.addEventListener("change", () => { setLight(light.value); store.commit(); });
    return group("Look (edits the artboard)", row("Background", el("span", { class: "pv-sw" }, ...BG_SWATCHES.map((c) => el("button", { type: "button", class: "pv-swatch", style: `background:${c}`, "aria-label": "Background " + c, onclick: () => { setBg(c); store.commit(); } })), color)), row("Light", light));
  }

  // ---- story-level renderers ------------------------------------------------------------------------
  function renderStory(n) {
    const nameIn = bind(el("input", { type: "text", class: "pv-text", maxlength: 80 }), () => n.name, (v) => { n.name = v; }, { scope: "all" });
    const kindLabel = n.type === "branch" ? "Branch node" : n.type === "source" ? "Import node" : n.type === "sink" ? "Export node" : n.type === "provider" ? "Generation node (mockup)" : n.type === "chat" ? "Prompt chat node (mockup)" : "Scene node";
    const head = [row("Name", nameIn)];
    if (n.type === "scene") head.push(row("Status", bind(sel([["draft", "Draft"], ["blocked", "Blocking"], ["approved", "Approved"]]), () => n.status, (v) => { n.status = v; })));
    host.append(group(kindLabel, ...head));
    if (n.type === "branch") { host.append(el("p", { class: "pv-hint", text: "A branch node has no picture. The top-most outgoing edge is the main path; others are alternates and are not in the cut." }), notesGroup(n)); return; }
    if (n.type === "provider" || n.type === "chat" || (n.type === "sink" && SOCIAL[n.kind])) {
      const note = n.type === "provider" ? PROVIDERS[n.kind].note : n.type === "chat" ? "A scripted chat. Prompts flow along its edge into a generation node, which writes a version badge onto the linked storyboard scene." : SOCIAL[n.kind].note;
      host.append(group("About this node", el("p", { class: "pv-hint" }, el("b", { text: "Mockup. " }), note), el("p", { class: "pv-hint", text: "Nothing here uses the network, a key or an upload. Edit the settings on the node card; connect it with the ports." })), notesGroup(n)); return;
    }
    if (n.type === "source" || n.type === "sink") {
      const d = (n.type === "source" ? SOURCES : SINKS)[n.kind];
      const kids = [el("p", { class: "pv-hint" }, el("b", { text: STATUS_LABEL[d.status] + ". " }), d.note), el("p", { class: "pv-hint", text: "Runs in your browser. Nothing is uploaded." })];
      if (n.type === "source") kids.push(el("p", { class: "pv-hint", text: n.info.summary || "Nothing imported yet." }), btn(n.info.summary ? "Re-import…" : "Import…", () => io.pickFile(n), "pv-btn-primary"));
      else { if (d.formats) kids.push(row("Format", bind(sel(Object.entries(d.formats)), () => n.opts.format, (v) => { n.opts.format = v; }, { scope: "all" }))); if (n.kind === "frames" || n.kind === "video") { const cb = el("input", { type: "checkbox", class: "pv-check", id: "pv-burn" }); cb.checked = n.opts.subtitles !== false; cb.addEventListener("change", () => { store.update(() => { n.opts.subtitles = cb.checked; }, "all"); store.commit(); }); kids.push(el("label", { class: "pv-field pv-field-check", for: "pv-burn" }, cb, el("span", { text: "Include subtitles (burned into the picture)" }))); } const sc = io.scopeOf(n); kids.push(el("p", { class: "pv-hint", text: sc ? `Scope: ${sc.label}.` : "Not connected: attach to the last scene (whole cut) or one scene." }), btn("Run export", () => io.run(n), "pv-btn-primary"), n.last ? el("p", { class: "pv-hint", text: `Last run: ${n.last.msg}` }) : null); }
      host.append(group(d.label, ...kids), notesGroup(n)); return;
    }
    const shot = selShot(n);
    if (shot) host.append(shotSection(n, shot)); else host.append(group("Shots", el("p", { class: "pv-hint", text: "This scene has no shots." }), btn("Add shot", () => addShot(store, n.id))));
    const cast = n.props.cast.map((c) => `${charName(store.p, c.ref)}${c.anim ? " (" + c.anim + ")" : ""}${c.acc ? ", " + c.acc.replace(/_/g, " ") : ""}`);
    host.append(group("Cast and sub-nodes", el("p", { class: "pv-hint", text: cast.length ? cast.join("; ") : "Nothing is connected to the Scene output." }), el("p", { class: "pv-hint", text: `${n.art.nodes.length} sub-nodes. The artboard decides what this scene shows.` }), btn("Open artboard", () => deps.openArtboard(n), "pv-btn-primary")), lookSection(n), notesGroup(n));
  }

  // ---- sub-node inspector ---------------------------------------------------------------------------
  function renderSub(sc, s) {
    const art = sc.art, head = group(`${SUB_LABEL[s.type]}${s.kind ? " · " + (OTHER_KINDS[s.kind] || s.kind) : ""}`);
    if (s.type !== "output" && s.type !== "model") head.append(row(s.type === "other" && s.kind === "group" ? "Title" : "Label", bind(el("input", { type: "text", class: "pv-text", maxlength: 60, placeholder: "Automatic" }), () => (s.type === "other" && s.kind === "group" ? s.text : s.label), (v) => { if (s.type === "other" && s.kind === "group") s.text = v; else s.label = v; }, { scope: "all" })));
    host.append(head);
    const kids = [];
    switch (s.type) {
      case "model": kids.push(row("GLB asset", charSelect(() => s.ref, (v) => { s.ref = v; }, "Model")), el("p", { class: "pv-hint", text: "Connect this Model to a Content node's model port. Models are the GLB files in assets/ (plus any you imported)." })); break;
      case "content":
        if (s.kind === "background") {
          const c = bind(el("input", { type: "color", class: "pv-color", "aria-label": "Background colour" }), () => s.color, (v) => { s.color = v; }, { scope: "all" });
          kids.push(row("Colour", el("span", { class: "pv-sw" }, ...BG_SWATCHES.map((col) => el("button", { type: "button", class: "pv-swatch", style: `background:${col}`, "aria-label": "Colour " + col, onclick: () => { store.update(() => { s.color = col; }); store.commit(); } })), c)));
        } else if (s.kind === "accessory") {
          const a = el("select", { class: "pv-select", "aria-label": "Accessory" }, ...accList.map((x) => el("option", { value: x.id, text: x.label })));
          a.value = s.acc; a.addEventListener("change", () => { store.update(() => { s.acc = a.value; s.label = a.value.replace(/_/g, " "); }, "all"); store.commit(); }); kids.push(row("Accessory", a), el("p", { class: "pv-hint", text: "Connect to a character's attach port. Placed by an estimated head size." }));
        } else {
          const hasModel = inputsOf(art, s.id, "model").length > 0;
          kids.push(row("Asset", charSelect(() => s.ref, (v) => { s.ref = v; s.label = ""; }, "Content asset")), hasModel ? el("p", { class: "pv-hint", text: "A connected Model overrides this asset." }) : null);
        }
        kids.push(el("p", { class: "pv-hint", text: s.kind === "accessory" ? "" : "Connect to the Scene output to show it." })); break;
      case "control": {
        const k = sel(Object.entries(CONTROL_KINDS)); k.value = s.kind; k.addEventListener("change", () => { store.update(() => { s.kind = k.value; s.value = ""; }, "all"); store.commit(); key = ""; render(); });
        kids.push(row("Kind", k));
        const target = art.edges.filter((e) => e.from === s.id).map((e) => art.nodes.find((x) => x.id === e.to)).find((x) => x?.type === "content");
        const clips = target ? CHAR_BY_ID.get(effectiveRef(art, target))?.clips || [] : [];
        if (s.kind === "clip" && clips.length) { const v = sel([["", "(none: idle)"], ...clips.map((c) => [c, c])]); kids.push(row("Clip", bind(v, () => s.value, (x) => { s.value = x; }, { scope: "all", live: false }))); }
        else kids.push(row("Value", bind(el("input", { type: "text", class: "pv-text", maxlength: 60 }), () => s.value, (x) => { s.value = x; }, { scope: "all" })));
        kids.push(el("p", { class: "pv-hint", text: CONTROL_RENDERED[s.kind] ? (target ? "Drives the connected Content node." : "Connect to a Content node's control port.") : "Stored with the scene but not rendered yet." })); break; }
      case "script": {
        const ch = scriptNodeChar(art, s), ls = linesOfScriptNode(store.p, sc, s);
        kids.push(el("p", { class: "pv-hint", text: `Lines for ${charName(store.p, ch)} in this scene. They are the same lines the Script drawer shows.` }));
        ls.forEach((l) => {
          const k = sel(Object.entries(LINE_KINDS)); k.value = l.kind; k.addEventListener("change", () => { patchLine(store, l.id, { kind: k.value }); store.commit(); });
          const t = el("textarea", { class: "pv-text pv-sm", rows: 2, "aria-label": "Line text" }); t.value = l.text; t.addEventListener("input", () => patchLine(store, l.id, { text: t.value })); t.addEventListener("change", () => store.commit());
          kids.push(el("div", { class: "pv-lineedit" }, k, t, btn("×", () => { deleteLine(store, l.id); store.commit(); }, "pv-btn-icon")));
        });
        kids.push(el("div", { class: "pv-btnrow" }, btn("Add line", () => { const l = addLine(store, { char: ch, kind: "dialogue", text: "", node: sc.id, shot: sc.shots[0]?.id || null }); store.commit(); key = ""; render(); }), btn("Open Script drawer", () => deps.openScript(sc, s)))); break; }
      case "camera": {
        const shot = sc.shots.find((x) => x.id === s.shot);
        const bs = sel(sc.shots.map((x, i) => [x.id, `Shot ${i + 1}`])); bs.value = s.shot; bs.addEventListener("change", () => { store.update(() => { s.shot = bs.value; }, "all"); store.commit(); });
        kids.push(row("Bound to", bs)); if (shot) kids.push(shotSection(sc, shot)); break; }
      case "light": kids.push(row("Preset", bind(sel(Object.entries(LIGHTS)), () => s.preset, (v) => { s.preset = v; }, { scope: "all" })), el("p", { class: "pv-hint", text: "Connect to the Scene output's light port (one light)." })); break;
      case "audio": kids.push(row("Cue text", bind(el("input", { type: "text", class: "pv-text", maxlength: 120 }), () => s.text, (v) => { s.text = v; }, { scope: "all" })), row("At frame", bind(num(1, 0, 99999, "Cue frame"), () => s.frame, (v) => { s.frame = Math.max(0, Math.round(v)); }, { scope: "all" })), row("Length", bind(num(1, 1, 99999, "Cue length"), () => s.len, (v) => { s.len = Math.max(1, Math.round(v)); }, { scope: "all" })), el("p", { class: "pv-hint", text: "A cue note. Nothing is played." })); break;
      case "other":
        if (s.kind === "note") kids.push(row("Note", bind(el("textarea", { class: "pv-text", rows: 4, maxlength: 2000 }), () => s.text, (v) => { s.text = v; }, { scope: "all" })));
        else if (s.kind === "group") kids.push(row("Width", bind(num(10, 160, 2000, "Group width"), () => s.w, (v) => { s.w = Math.max(160, v); }, { scope: "all" })), row("Height", bind(num(10, 100, 2000, "Group height"), () => s.h, (v) => { s.h = Math.max(100, v); }, { scope: "all" })), el("p", { class: "pv-hint", text: "A frame to group related nodes visually. It does not move them." }));
        else { const f = el("input", { type: "file", accept: "image/png,image/jpeg", "aria-label": "Reference image" }); f.addEventListener("change", async () => { const file = f.files[0]; if (!file) return; if (file.size > 25 * 1024 * 1024) { announce("Image is larger than 25 MB. Nothing was read."); return; } const bm = await createImageBitmap(file), k = Math.min(1, 640 / Math.max(bm.width, bm.height)), cv = document.createElement("canvas"); cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k); cv.getContext("2d").drawImage(bm, 0, 0, cv.width, cv.height); store.update(() => { s.img = cv.toDataURL("image/jpeg", 0.72); }, "all"); store.commit(); }); kids.push(row("Image", f), s.img ? btn("Remove image", () => { store.update(() => { delete s.img; }, "all"); store.commit(); }) : null, el("p", { class: "pv-hint", text: "Scaled to 640 px and stored in the project. Nothing is uploaded." })); }
        break;
      case "output": {
        const cams = art.nodes.filter((x) => x.type === "camera").length;
        kids.push(el("p", { class: "pv-hint", text: `Receives ${sc.props.cast.length} cast, ${cams} cameras, light "${sc.props.light}". Whatever reaches this node is what the story map card and the viewport render.` }), btn("Back to story map", () => deps.closeArtboard())); break; }
      default: break;
    }
    host.append(group("Properties", ...kids.filter(Boolean)));
  }

  function render() {
    if (store.p !== lastP) { lastP = store.p; key = ""; }
    const n = selNode(), shot = selShot(n), sc = store.sel.open && n?.type === "scene" ? n : null, sub = sc && store.sel.sub.length === 1 ? sc.art.nodes.find((x) => x.id === store.sel.sub[0]) : null;
    const inst = n && n.type === "scene" && stage ? stage.instance(n) : null;
    const nk = [n?.id, shot?.id, sub?.id, sub?.type, sub?.kind, sc && `${sc.art.nodes.length}/${sc.art.edges.length}`, n?.shots?.length, inst?.state, accList.length, store.sel.nodes.length, sc && sub?.type === "script" ? store.p.script.lines.length : 0, n?.type === "sink" || n?.type === "source" ? n.last?.at + n.info?.at : ""].join("|");
    if (nk === key) { fields.forEach((f) => f()); return; }
    key = nk; fields = []; host.replaceChildren();
    if (titleEl) titleEl.textContent = sc ? `Inspector · ${sub ? SUB_LABEL[sub.type] : "artboard"}` : "Inspector";
    if (!n) { host.append(el("p", { class: "pv-hint", text: store.sel.nodes.length > 1 ? `${store.sel.nodes.length} nodes selected. Select one to edit it.` : "Select a node in the map to edit it." })); return; }
    if (sc) { if (sub) renderSub(sc, sub); else host.append(el("p", { class: "pv-hint", text: store.sel.sub.length > 1 ? `${store.sel.sub.length} sub-nodes selected.` : "Select a sub-node in the artboard to edit it." })); fields.forEach((f) => f()); return; }
    renderStory(n); fields.forEach((f) => f());
  }
  store.on((scope) => { if (scope !== "move") render(); });
  render();
  return { render, refresh: () => { key = ""; render(); } };
}
