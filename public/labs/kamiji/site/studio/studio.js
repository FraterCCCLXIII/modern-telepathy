// STUDIO: orchestration. Character JSON in the store -> figure (procedural or GLB) in the shared viewport; panels render from the store.
import { THREE } from "./geo.js";
import { STYLES, STYLE_BY_ID, CATEGORIES, CAT_BY_ID, SLOT_LABEL, SLOTS_BY_STYLE, MORPHS, MORPH_BY_ID, PALETTES, ROOMS, EXPRESSIONS, emptyCharacter, SHAPE_TARGETS, DEFAULT_PARTS, SOCKET_BY_ID } from "./data.js";
import { PARTS, partsFor } from "./parts.js";
import "./glbparts.js";
import { registerGlbBodies, buildGlbFigure, KAMIJI_EXPR } from "./glbfigure.js";
import { buildProcFigure, partOf, resolveColors, morphValue } from "./figure.js";
import { ACC, attachAccessories, buildAccessory } from "./acc.js";
import { createViewport } from "./viewport.js";
import { createStore, normalize } from "./store.js";
import { createThumbs } from "./thumbs.js";
import { createUI } from "./ui.js";
import { visibleMorphs } from "./morphs.js";
import { PRESETS } from "./presets.js";
import { setPartRules, addAccessory, standingNotes, partBlock, categoryBlock, planOf } from "./rules.js";
import { exportGLB, inspectGLB, download, turntableSheet } from "./exporter.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const HEAD_REAL = new Set(["cranium", "width", "jaw", "chin", "cheeks", "brow"]);
const FACE_FEATURES = new Set(["eyeSize", "eyeGap", "eyeY", "mouthY"]);
const SLOT_TO_CAT = { head: "head", face: "face", hair: "hair", torso: "torso", body: "body", arms: "arms", hands: "hands", legs: "legs", feet: "feet", ears: "ears", tail: "tail", wings: "wings", horns: "horns", spines: "horns", clothing: "clothing", acc: "accessories" };

async function boot() {
  const store = createStore();
  const [vp] = await Promise.all([createViewport($("#st-host"), { reduceMotion }), registerGlbBodies(), ACC.ready]);
  const thumbs = createThumbs(vp);
  const app = { store, vp, thumbs, reduceMotion, fig: null, dragging: null, accFilter: "", openGroups: null };
  let lastBuilt = null, building = false, again = false, buildTok = 0, preview = null, lastFrameKey = "";
  const env = { reduceMotion, onDirty: () => (vp.dirty = true) };
  const live = $("#st-live"), rulesEl = $("#st-rules");

  // ---------------------------------------------------------------- announce
  let liveT = 0;
  app.say = (msg, rule = false) => { clearTimeout(liveT); live.textContent = ""; liveT = setTimeout(() => { live.textContent = msg; }, 30); rulesEl.textContent = msg; if (rule) { const m = $("#st-vp-msg"); m.textContent = msg; m.hidden = false; clearTimeout(app._mt); app._mt = setTimeout(() => (m.hidden = true), 3200); } };
  const cur = () => preview || store.ch;

  // ---------------------------------------------------------------- figure building
  const buildFig = (ch, e = env) => (STYLE_BY_ID[ch.style].engine === "proc" ? buildProcFigure(ch, e) : buildGlbFigure(ch, e));
  async function rebuild() {
    if (building) { again = true; return; }
    building = true;
    try {
      do {
        again = false;
        const ch = cur(), tok = ++buildTok;
        let f;
        try { f = await buildFig(ch); await attachAccessories(f, ch); } catch (e) { console.error("Studio build failed", e); app.say("This combination could not be built: " + (e.message || e), true); break; }
        if (again) { f.dispose?.(); continue; }
        const old = app.fig, t = old?.action?.time || 0;
        applyHatRule(f, ch);
        vp.setFigure(f); old?.dispose?.();
        app.fig = f; lastBuilt = clone(ch);
        if (f.action && t && f.kind === "proc") f.action.time = t % f.action.getClip().duration;
        f.setPlaying(!reduceMotion || app.userPlay === true);
        if (reduceMotion && app.userPlay !== true) f.update(0);
        applyLook(ch, f);
        const key = ch.style + "|" + (partOf(ch, "body")?.id || ch.parts.body) + "|" + (planOf(ch));
        if (key !== lastFrameKey) { lastFrameKey = key; vp.frame(); }
        if (vp.mirrored) vp.setMirror(true);
        afterBuild();
      } while (again);
    } finally { building = false; }
  }
  function applyHatRule(f, ch) { const hats = ch.accessories.some((a) => ACC.byId.get(a.id)?.conflicts?.includes("hair")); f.setHats?.(hats); }
  function applyLook(ch, f) {
    vp.setRoom(ch.look.room); vp.setEffects(ch.look.effects);
    vp.setOutline(ch.look.outline && !f.noOutline);
    app.ui.syncBars();
  }
  function afterBuild() {
    app.ui.syncBars();
    if (!preview) { const notes = standingNotes(store.ch, app.fig); rulesEl.textContent = notes.join("  ") || rulesEl.textContent; }
    document.dispatchEvent(new CustomEvent("studio-built"));
  }

  // ---------------------------------------------------------------- diff -> fast path or rebuild
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function sync() {
    const next = cur(), prev = lastBuilt, fig = app.fig;
    if (!fig || !prev) { rebuild(); return; }
    if (same(prev, next)) return;
    const structural = prev.style !== next.style || !same(prev.parts, next.parts) || !same(prev.accessories, next.accessories) || prev.look.steps !== next.look.steps;
    if (structural) { rebuild(); return; }
    const ids = new Set([...Object.keys(prev.morphs), ...Object.keys(next.morphs)].filter((k) => prev.morphs[k] !== next.morphs[k]));
    const isProc = fig.kind === "proc";
    if (ids.size) {
      if (isProc) {
        const other = [...ids].filter((k) => !HEAD_REAL.has(k) && !FACE_FEATURES.has(k));
        if (other.length) { rebuild(); return; }
        if ([...ids].some((k) => HEAD_REAL.has(k))) { fig.setHeadMorphs(next); if (fig.faceKind !== "classic") debounceFace(next); }
        if ([...ids].some((k) => FACE_FEATURES.has(k))) fig.buildFace(next);
      } else if (next.style === "kamiji") fig.applyMorphs(next);
      else if (next.style === "shapes") { fig.applyMorphs(next); if ([...ids].some((k) => FACE_FEATURES.has(k))) fig.buildFace(next); else debounceFace(next); }
    }
    if (!same(prev.materials, next.materials)) fig.applyColors(next, next.look);
    if (prev.face.rig !== next.face.rig) { if (fig.buildFace) fig.buildFace(next); }
    if (prev.face.expression !== next.face.expression) fig.setExpression?.(next.face.expression);
    if (prev.pose.clip !== next.pose.clip) { fig.setClip(next.pose.clip); app.ui.syncBars(); }
    if (!same(prev.look, next.look)) applyLook(next, fig);
    lastBuilt = clone(next); vp.dirty = true;
    if (next.style === "shapes" || ids.size) vp.fitShadow();
  }
  let faceT = 0;
  function debounceFace(next) { clearTimeout(faceT); faceT = setTimeout(() => { if (app.fig?.buildFace) { app.fig.buildFace(cur()); vp.dirty = true; } }, 250); }

  // ---------------------------------------------------------------- the ui
  const ui = createUI(app); app.ui = ui;
  ui.buildBars(); ui.renderLegendBox();
  const skipRender = new Set(["live"]);
  store.subscribe((why) => {
    sync();
    if (why === "live") return;
    app.thumbs.requestStale?.();
    ui.all(); if (why !== "roster") reflectTabs();
  });
  function reflectTabs() {}

  // ---------------------------------------------------------------- actions
  app.thumbKey = (kind, ...ids) => { const ch = store.ch; return [kind, kind === "preset" ? "" : ch.style, ...ids, kind === "part" || kind === "acc" ? JSON.stringify(ch.materials) + ch.look.steps : ""].join("|"); };
  const refChar = (style, over = {}) => {
    const base = emptyCharacter(style), live = store.ch;
    if (STYLE_BY_ID[style].engine === "proc" && STYLE_BY_ID[live.style].engine === "proc") { base.materials = clone(live.materials); }
    base.look.steps = live.look.steps; base.name = "ref"; base.face = { rig: "classic", expression: "neutral" };
    return { ...base, ...over, parts: { ...base.parts, ...(over.parts || {}) }, morphs: over.morphs || {} };
  };
  const thumbEnv = { reduceMotion: true, onDirty() {} };
  app.thumbForPart = async (slot, part) => {
    const ch = store.ch, st = ch.style;
    const over = { parts: { [slot]: part.id } };
    if (st === "mix" || st === "creature") { // keep the body plan so legs / arms thumbnails match
      const bp = partOf(ch, "body"); if (bp && slot !== "body") over.parts.body = bp.id;
      if (slot === "ears" || slot === "tail" || slot === "wings" || slot === "horns" || slot === "spines") { over.parts.head = st === "creature" ? partOf(ch, "head")?.id : "round"; }
      if (st === "mix" && slot === "ears") over.parts.head = "round";
    }
    const c = refChar(st, over);
    const f = await buildFig(c, thumbEnv);
    const focus = part.focus || CAT_BY_ID[SLOT_TO_CAT[slot]]?.focus || "all";
    return { fig: f, focus: slot === "body" ? "all" : focus };
  };
  app.thumbForStyle = async (id) => ({ fig: await buildFig(refChar(id, id === "shapes" ? { parts: { body: "drop" } } : {}), thumbEnv), focus: "all" });
  app.thumbForCharacter = async (c, focus) => ({ fig: await buildFigWithAcc(c), focus });
  async function buildFigWithAcc(c) { const f = await buildFig(c, thumbEnv); await attachAccessories(f, c); applyHatRule(f, c); return f; }
  app.thumbForAccessory = async (a) => {
    const style = a.socket === "tail" ? "creature" : "human";
    const sock = a.kind === "held" ? "hand_R" : a.socket;
    const c = refChar(style, a.socket === "tail" ? { parts: { tail: "cat" } } : {}); c.accessories = [{ id: a.id, socket: sock }];
    const f = await buildFigWithAcc(c);
    const focus = ["head", "face", "ears", "hair", "neck"].includes(a.socket) ? "head" : { back: "torso", waist: "legs", hand: "hand", feet: "feet", tail: "tail" }[a.socket] || "all";
    return { fig: f, focus: a.socket === "neck" ? "torso" : focus };
  };

  const commit = (next, why) => store.commit(next, why);
  app.setCategory = (id) => {
    store.ui.category = id; ui.renderNav(); ui.renderParts(); ui.renderInsp();
    const b = categoryBlock(store.ch, id); app.say(CAT_BY_ID[id].label + (b ? ". " + b : ""));
    const sel = document.querySelector(`[data-cat="${id}"]`); if (sel && document.activeElement && document.activeElement.closest("#st-nav")) sel.focus();
  };
  app.setStyle = (id) => {
    const prev = store.ch; if (prev.style === id) return;
    const next = emptyCharacter(id); next.name = prev.name; next.look = clone(prev.look);
    const was = STYLE_BY_ID[prev.style].engine, now = STYLE_BY_ID[id].engine;
    if (was === "proc" && now === "proc") { next.materials = clone(prev.materials); next.face = clone(prev.face); for (const [k, v] of Object.entries(prev.parts)) { if (PARTS.some((p) => p.slot === k && p.id === v && p.for.includes(id)) && SLOTS_BY_STYLE[id].includes(k)) next.parts[k] = v; } for (const [k, v] of Object.entries(prev.morphs)) { const m = MORPH_BY_ID[k]; if (m && m.styles.includes("proc") && (!m.only || m.only.includes(id))) next.morphs[k] = v; } }
    if (id === "shapes") { next.parts.body = "drop"; next.materials = { Clay: { color: "#7fd1b0" } }; }
    if (id === "kamikin") next.parts.body = "kamikin-kon";
    if (id === "rubbernose") { next.parts = { body: "rubbernose-rubby", hands: "glove", feet: "shoe" }; }
    next.accessories = prev.accessories.filter((a) => ["head", "face", "ears", "hair", "neck"].includes(a.socket) || (now === "proc" && was === "proc"));
    if (now === "glb") next.accessories = next.accessories.filter((a) => ["head", "face", "ears", "hair", "neck"].includes(a.socket));
    next.pose.clip = now === "glb" ? (POSE0[id] || "idle") : "idle";
    // mix/creature body plan may block accessories
    store.ui.category = ["kamikin", "rubbernose", "shapes"].includes(id) ? "body" : store.ui.category === "body" && id === "kamiji" ? "style" : store.ui.category;
    commit(next, "style"); app.say(`Style: ${STYLE_BY_ID[id].label}. ${STYLE_BY_ID[id].note}`);
  };
  const POSE0 = { kamikin: "idle", rubbernose: "idle", kamiji: "Idle", shapes: "" };
  app.setPart = (slot, id) => {
    const ch = store.ch, p = PARTS.find((x) => x.slot === slot && x.id === id && x.for.includes(ch.style));
    const block = p && partBlock(ch, slot, p); if (block) { app.say(block, true); return; }
    let { ch: next, notes } = setPartRules(ch, slot, id);
    if (ch.style === "shapes" && slot === "body") { next.morphs = Object.fromEntries(Object.entries(next.morphs).filter(([k]) => !k.startsWith("sh_"))); }
    if (preview) { preview = null; }
    commit(next, "part");
    app.say(`${SLOT_LABEL[slot] || slot}: ${p?.label || id}.${notes.length ? " " + notes.join(" ") : ""}`, notes.length > 0);
  };
  app.previewPart = (slot, id) => {
    clearTimeout(app._pv);
    if (slot == null) { if (preview) { preview = null; app._pv = setTimeout(() => sync(), 40); } return; }
    app._pv = setTimeout(() => { const { ch } = setPartRules(store.ch, slot, id); preview = ch; sync(); }, 60);
  };
  app.toggleLock = (key) => { const l = { ...store.ui.locks }; if (l[key]) delete l[key]; else l[key] = true; store.setLocks(l); store.ui.locks = l; ui.renderParts(); ui.renderInsp(); app.say(`${key.split(":")[1]} ${l[key] ? "locked" : "unlocked"}`); };

  app.setMorph = (id, v, liveEdit) => {
    const ch = clone(store.ch), m = MORPH_BY_ID[id]; v = Math.min(m.max, Math.max(m.min, +v));
    const setOne = (k) => { ch.morphs[k] = v; };
    setOne(id);
    const paired = [];
    if (store.ui.symmetry && m.pair) { setOne(m.pair); paired.push(m.pair); }
    if (liveEdit) store.live(ch, "live"); else commit(ch, "morph");
    for (const k of paired) { const r = document.querySelector(`[data-morph="${k}"]`); if (r) { r.value = v; const n = r.parentElement.querySelector(".st-num"); if (n) n.value = v.toFixed(2); } }
    if (!liveEdit) ui.renderInsp();
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  app.randomMorphs = () => {
    const ch = clone(store.ch), list = visibleMorphs(ch).filter((m) => !store.ui.locks["morph:" + m.group]);
    if (ch.style === "shapes") { for (const k of Object.keys(ch.morphs)) if (k.startsWith("sh_")) delete ch.morphs[k]; const picks = [...SHAPE_TARGETS].sort(() => Math.random() - 0.5).slice(0, 3); let rest = 1; picks.forEach((t, i) => { const w = i === 2 ? rest : +rnd(0.2, rest).toFixed(2); ch.morphs["sh_" + t] = w; rest = Math.max(0, +(rest - w).toFixed(2)); }); }
    else for (const m of list) { const span = (m.max - m.min) * 0.5; const v = m.min < 0 ? rnd(-0.75, 0.75) : rnd(0, 0.9); ch.morphs[m.id] = +Math.min(m.max, Math.max(m.min, v)).toFixed(2); }
    if (store.ui.symmetry) for (const m of list) if (m.pair && ch.morphs[m.pair] != null) ch.morphs[m.pair] = ch.morphs[m.id];
    commit(ch, "morph"); app.say("Morphs randomised" + (Object.keys(store.ui.locks).some((k) => k.startsWith("morph:")) ? " (locked groups kept)" : ""));
  };
  app.resetMorphs = (group) => {
    const ch = clone(store.ch);
    for (const m of visibleMorphs(ch)) { if (group ? m.group !== group : store.ui.locks["morph:" + m.group]) continue; delete ch.morphs[m.id]; }
    if (ch.style === "shapes" && !group) ch.parts.body = ch.parts.body || "drop";
    commit(ch, "morph"); app.say(group ? `${group} reset` : "Morphs reset");
  };
  app.currentColors = () => {
    const ch = store.ch, fig = app.fig;
    if (STYLE_BY_ID[ch.style].engine === "proc") return resolveColors(ch);
    const out = {}; for (const [r] of (REG[ch.style] || [])) out[r] = { color: ch.materials?.[r]?.color || fig?.regionDefaults?.[r] || "#cccccc" }; return out;
  };
  const REG = { kamikin: [["MochiBody"]], rubbernose: [["Clay"], ["Accent"], ["Arm"], ["Leg"], ["Glove"], ["Shoe"], ["Ink"]], shapes: [["Clay"]], kamiji: [["HandSkin"]] };
  app.setPalette = (p) => { const ch = clone(store.ch); for (const [k, c] of Object.entries(p.c)) ch.materials[k] = { ...(ch.materials[k] || {}), color: c, color2: c, grad: 0 }; commit(ch, "palette"); app.say("Palette " + p.label); };
  app.setRegion = (rid, patch, liveEdit) => { const ch = clone(store.ch); ch.materials[rid] = { ...(ch.materials[rid] || {}), ...patch }; if (patch.color && STYLE_BY_ID[ch.style].engine === "proc" && !ch.materials[rid].color2) ch.materials[rid].color2 = patch.color; if (liveEdit) store.live(ch, "live"); else commit(ch, "material"); };
  app.setLook = (patch) => { const ch = clone(store.ch); ch.look = { ...ch.look, ...patch }; commit(ch, "look"); };
  app.toggleEffect = (id) => { const ch = clone(store.ch), s = new Set(ch.look.effects); s.has(id) ? s.delete(id) : s.add(id); ch.look.effects = [...s]; commit(ch, "look"); app.say("Look " + id + (s.has(id) ? " on" : " off")); };
  app.setFace = (patch) => { const ch = clone(store.ch); ch.face = { ...ch.face, ...patch }; commit(ch, "face"); app.say("Face rig: " + ch.face.rig); };
  app.setExpression = (e) => {
    const ch = clone(store.ch); ch.face.expression = e;
    if (ch.style === "kamiji") { for (const m of MORPHS.filter((m) => m.styles.includes("kamiji") && ["Face", "Eyes", "Brows"].includes(m.group))) delete ch.morphs[m.id]; Object.assign(ch.morphs, KAMIJI_EXPR[e] || {}); }
    commit(ch, "face"); app.say("Expression: " + e);
  };
  app.setMouthOpen = (v) => { app.fig?.setMouthOpen?.(v); vp.dirty = true; };
  app.setClip = (n) => { const ch = clone(store.ch); ch.pose.clip = n; commit(ch, "pose"); app.fig?.setClip(n); if (reduceMotion) { app.userPlay = true; app.fig?.setPlaying(true); } ui.syncBars(); app.say("Animation: " + n); };
  app.togglePlay = () => { const f = app.fig; if (!f) return; const on = !f.playing; f.setPlaying(on); app.userPlay = on; ui.syncBars(); vp.dirty = true; app.say(on ? "Playing" : "Paused"); const b = document.getElementById("st-play2"); if (b) { b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "Playing" : "Paused"; } };
  app.scrub = (u) => { const f = app.fig; if (!f?.action) return; f.setPlaying(false); f.action.paused = false; f.action.time = u * f.action.getClip().duration; f.mixer.update(0); vp.dirty = true; };
  app.toggleTurntable = () => { if (reduceMotion) return; vp.setTurntable(!vp.turntable()); ui.syncBars(); app.say("Turntable " + (vp.turntable() ? "on" : "off")); };
  app.toggleMirror = () => { vp.setMirror(!vp.mirrored); const b = document.getElementById("st-mirror"); if (b) b.setAttribute("aria-pressed", String(vp.mirrored)); app.say("Mirror " + (vp.mirrored ? "on" : "off")); };
  app.setViewMode = (m) => { vp.setViewMode(m); app.say("View: " + m); };

  // accessories
  const defaultSocket = (a) => (a.kind === "held" ? heldSocket() : a.socket);
  const heldSocket = () => ["hand_R", "hand_L"].find((s) => !store.ch.accessories.some((x) => x.socket === s)) || "hand_R";
  app.addAcc = (entry, socket) => {
    const r = addAccessory(store.ch, entry, socket, app.fig);
    if (r.error) { app.say(r.error, true); return false; }
    commit(r.ch, "acc"); app.say(`${entry.label} on ${SOCKET_BY_ID[socket].label}.${r.notes.length ? " " + r.notes.join(" ") : ""}`, r.notes.length > 0); return true;
  };
  app.toggleAcc = (entry) => { const w = store.ch.accessories.find((a) => a.id === entry.id); if (w) app.removeAcc(w.socket); else app.addAcc(entry, defaultSocket(entry)); };
  app.removeAcc = (socket) => { const ch = clone(store.ch), w = ch.accessories.find((a) => a.socket === socket); if (!w) return; ch.accessories = ch.accessories.filter((a) => a !== w && a.socket !== socket); commit(ch, "acc"); app.say(`${ACC.byId.get(w.id)?.label || w.id} removed from ${SOCKET_BY_ID[socket].label}.`); };
  app.tintAccessory = (socket, color, liveEdit) => { const ch = clone(store.ch), w = ch.accessories.find((a) => a.socket === socket); if (!w) return; w.tint = color; if (liveEdit) { store.live(ch, "live"); debounceAccRebuild(); } else commit(ch, "acc"); };
  let accT = 0; const debounceAccRebuild = () => { clearTimeout(accT); accT = setTimeout(() => { lastBuilt = null; sync(); }, 120); };
  app.dropAccessory = (id, socket) => { const e = ACC.byId.get(id); if (!e) return; const ok = e.kind === "held" ? socket.startsWith("hand_") : (socket === e.socket); if (!ok) { app.say(`${e.label} does not go on the ${SOCKET_BY_ID[socket].label.toLowerCase()} socket. It belongs on ${e.kind === "held" ? "a hand" : SOCKET_BY_ID[e.socket].label.toLowerCase()}.`, true); return; } app.addAcc(e, socket); };
  const dropEl = $("#st-drop");
  const host = $("#st-host");
  host.addEventListener("dragover", (e) => { if (app.dragging) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; dropEl.hidden = false; } });
  host.addEventListener("dragleave", () => { dropEl.hidden = true; });
  host.addEventListener("drop", (e) => {
    e.preventDefault(); dropEl.hidden = true;
    const id = e.dataTransfer.getData("text/x-studio-acc") || app.dragging; const entry = ACC.byId.get(id); if (!entry) return;
    let socket = entry.socket;
    if (entry.kind === "held") { // nearest hand to the drop ray
      const ray = vp.worldRay(e.clientX, e.clientY); let best = null, bd = Infinity;
      for (const s of ["hand_L", "hand_R"]) { const t = app.fig?.sockets?.[s]?.[0]; if (!t) continue; const p = t.parent.getWorldPosition(new THREE.Vector3()); const d = ray.ray.distanceToPoint(p); if (d < bd) { bd = d; best = s; } }
      socket = best || heldSocket();
    }
    app.addAcc(entry, socket);
  });

  // whole-character commands
  app.loadPreset = (p) => { const { ch } = normalize(clone(p)); commit(ch, "preset"); app.say("Preset loaded: " + p.name); };
  app.loadRoster = (id) => { store.loadFromRoster(id); app.say("Loaded " + store.ch.name + " from the roster"); };
  app.deleteRoster = (id) => { store.removeFromRoster(id); app.say("Deleted from the roster"); };
  app.saveRoster = async () => {
    let thumb = null; try { const c = await app.thumbForCharacterNow(store.ch); thumb = c; } catch (e) { console.warn(e); }
    const ok = store.saveToRoster(thumb); app.say(ok ? `${store.ch.name} saved to the roster.` : "Saved for this session only: browser storage is full or blocked.", !ok);
  };
  app.thumbForCharacterNow = async (c) => { const made = await app.thumbForCharacter(c, "all"); const url = vp.thumb(made.fig, "all", 112); made.fig.dispose?.(); return url; };
  app.newChar = () => { const style = store.ch.style; const n = emptyCharacter(style); if (style === "kamikin") n.parts.body = "kamikin-kon"; if (style === "shapes") n.parts.body = "drop"; if (style === "rubbernose") n.parts = { body: "rubbernose-rubby", hands: "glove", feet: "shoe" }; if (style === "kamiji") n.pose.clip = "Idle"; n.look = clone(store.ch.look); commit(n, "new"); app.say("New " + STYLE_BY_ID[style].label + " character."); };
  app.randomise = () => {
    let ch = clone(store.ch), notes = [];
    const st = ch.style;
    if (STYLE_BY_ID[st].engine === "proc") {
      for (const slot of SLOTS_BY_STYLE[st]) {
        if (store.ui.locks["slot:" + slot]) continue;
        const opts = partsFor(slot, st).filter((p) => !partBlock(ch, slot, p));
        if (!opts.length) continue;
        const nonNone = opts.filter((p) => p.id !== "none"); const pick = (Math.random() < 0.2 && opts.find((p) => p.id === "none")) || nonNone[Math.floor(Math.random() * nonNone.length)] || opts[0];
        ch = setPartRules(ch, slot, pick.id).ch;
      }
      const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)]; for (const [k, c] of Object.entries(pal.c)) ch.materials[k] = { ...(ch.materials[k] || {}), color: c, color2: c, grad: 0 };
    } else if (st === "kamikin" || st === "rubbernose") { const list = partsFor("body", st); ch.parts.body = list[Math.floor(Math.random() * list.length)].id; ch.materials = {}; const hue = Math.floor(Math.random() * 360); const col = new THREE.Color().setHSL(hue / 360, 0.5, 0.78).getStyle(); const r = st === "kamikin" ? "MochiBody" : "Clay"; ch.materials[r] = { color: "#" + new THREE.Color().setHSL(hue / 360, 0.55, 0.78).getHexString() }; }
    ch.face.expression = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
    const ml = visibleMorphs(ch).filter((m) => !store.ui.locks["morph:" + m.group]);
    if (st === "shapes") { ch.morphs = {}; const t = SHAPE_TARGETS[Math.floor(Math.random() * SHAPE_TARGETS.length)]; ch.parts.body = t; ch.materials = { Clay: { color: "#" + new THREE.Color().setHSL(Math.random(), 0.5, 0.75).getHexString() } }; }
    else for (const m of ml) if (STYLE_BY_ID[st].engine === "proc" || st === "kamiji") ch.morphs[m.id] = +(m.min < 0 ? rnd(-0.6, 0.6) : rnd(0, st === "kamiji" ? 0.5 : 1)).toFixed(2);
    if (store.ui.symmetry) for (const m of ml) if (m.pair && ch.morphs[m.pair] != null) ch.morphs[m.pair] = ch.morphs[m.id];
    ch.name = "Random " + Math.floor(Math.random() * 900 + 100);
    ch.accessories = ch.accessories.filter((a) => !ACC.byId.get(a.id)?.socket || true);
    if (Math.random() < 0.7) { const heads = ACC.list.filter((a) => ["head", "face", "neck"].includes(a.socket)); const e = heads[Math.floor(Math.random() * heads.length)]; const r = addAccessory(ch, e, e.socket, app.fig); if (!r.error) ch = r.ch; }
    commit(ch, "random"); app.say("Randomised: " + ch.name);
  };

  // exports
  const stamp = () => store.ch.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
  app.cmd = async (name) => {
    try {
      if (name === "export-json") { download(new Blob([JSON.stringify(store.toJSON(), null, 2)], { type: "application/json" }), stamp() + ".studio.json"); app.say("Character JSON downloaded."); }
      else if (name === "export-library") { download(new Blob([JSON.stringify(store.libraryJSON(), null, 2)], { type: "application/json" }), "studio-roster.json"); app.say("Roster library downloaded."); }
      else if (name === "copy-json") { const t = JSON.stringify(store.toJSON()); try { await navigator.clipboard.writeText(t); app.say("Share JSON copied to the clipboard."); } catch { const ta = document.createElement("textarea"); ta.value = t; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); app.say("Share JSON copied."); } }
      else if (name === "export-glb") { const r = await app.exportGLB(); download(new Blob([r.buffer], { type: "model/gltf-binary" }), stamp() + ".glb"); app.say(`GLB exported: ${(r.bytes / 1024).toFixed(0)} KB. ${r.notes[0] || ""}`); }
      else if (name === "export-png") { download(vp.snapshot(720, 720), stamp() + "-portrait.png"); app.say("PNG portrait downloaded."); }
      else if (name === "export-turn") { app.say("Rendering turntable sheet..."); download(await turntableSheet(vp), stamp() + "-turntable.png"); app.say("Turntable sheet downloaded."); }
    } catch (e) { console.error(e); app.say("Export failed: " + (e.message || e), true); }
  };
  app.exportGLB = async () => { if (building) await new Promise((r) => document.addEventListener("studio-built", r, { once: true })); return exportGLB(app.fig, store.ch); };

  // ---------------------------------------------------------------- top bar wiring
  document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => {
    const c = b.dataset.cmd;
    if (c === "undo") { if (store.undo()) app.say("Undone"); } else if (c === "redo") { if (store.redo()) app.say("Redone"); }
    else if (c === "new") app.newChar(); else if (c === "random") app.randomise(); else if (c === "save") app.saveRoster();
    else if (c === "import") $("#st-file").click();
    else { closeMenu(); app.cmd(c); }
  }));
  const menuBtn = $("#st-export-btn"), menu = $("#st-export-menu");
  const closeMenu = (focus) => { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); if (focus) menuBtn.focus(); };
  menuBtn.addEventListener("click", () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute("aria-expanded", String(open)); if (open) menu.querySelector("button").focus(); });
  menu.addEventListener("keydown", (e) => { const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement); if (e.key === "Escape") { e.preventDefault(); closeMenu(true); } else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); } });
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== menuBtn) closeMenu(); });
  $("#st-file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return; const text = await f.text(); e.target.value = "";
    const r = store.importJSON(text); app.say(r.ok ? `Imported ${r.count} character${r.count > 1 ? "s" : ""}.${r.warnings?.length ? " " + r.warnings.slice(0, 2).join(" ") : ""}` : r.error, !r.ok);
  });
  const nameEl = $("#st-name"); nameEl.addEventListener("change", () => { const ch = clone(store.ch); ch.name = nameEl.value.trim().slice(0, 60) || "Untitled"; commit(ch, "name"); });
  const ps = $("#st-preset"); ps.append(...PRESETS.map((p) => Object.assign(document.createElement("option"), { value: p.name, textContent: p.name })));
  ps.addEventListener("change", () => { const p = PRESETS.find((x) => x.name === ps.value); if (p) app.loadPreset(p); ps.value = ""; });
  document.querySelectorAll(".st-tab").forEach((t) => t.addEventListener("click", () => { document.body.dataset.tab = t.dataset.tab; document.querySelectorAll(".st-tab").forEach((x) => x.setAttribute("aria-selected", String(x === t))); vp.dirty = true; }));
  // keyboard
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase(), typing = tag === "input" && !["range", "checkbox", "color"].includes(e.target.type) || tag === "textarea" || tag === "select";
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) store.redo(); else store.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); store.redo(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "r" || e.key === "R") { e.preventDefault(); app.randomise(); }
  });
  host.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowLeft") vp.orbitBy(0.12, 0); else if (k === "ArrowRight") vp.orbitBy(-0.12, 0); else if (k === "ArrowUp") vp.orbitBy(0, 0.08); else if (k === "ArrowDown") vp.orbitBy(0, -0.08);
    else if (k === "+" || k === "=") vp.orbitBy(0, 0, 0.9); else if (k === "-") vp.orbitBy(0, 0, 1.1); else if (k.toLowerCase() === "f") vp.frame(); else if (k === " ") app.togglePlay(); else return;
    e.preventDefault();
  });
  // viewport picking -> category
  vp.onPick = (hit) => { const cat = SLOT_TO_CAT[hit.slot]; if (!cat) return; app.setCategory(cat); app.say(`Selected ${CAT_BY_ID[cat].label} from the model.`); };
  vp.onHover = (slot) => { if (slot) rulesEl.textContent = `Hover: ${SLOT_LABEL[slot] || (slot === "acc" ? "Accessory" : slot)}. Click to edit.`; };
  // reflect narrow-layout tab on first paint
  ui.all();
  await rebuild();
  document.body.dataset.ready = "1";

  // debug / test hooks
  window.studio = {
    app, store, vp, ui, thumbs, PARTS,
    get fig() { return app.fig; },
    bounds() { const b = vp.bounds(); return { min: b.min.toArray(), max: b.max.toArray(), size: b.getSize(new THREE.Vector3()).toArray() }; },
    async idle() { while (building || again) await new Promise((r) => setTimeout(r, 30)); },
    async thumbsIdle() { await thumbs.idle(); },
    inspectGLB, exportGLB: () => app.exportGLB(),
    stats() { return { ...vp.stats, queued: thumbs.queued, thumbCache: thumbs.cache.size }; },
  };
  window.studioReady = true;
  document.dispatchEvent(new CustomEvent("studio-ready"));
}
boot().catch((e) => { console.error(e); const m = document.getElementById("st-vp-msg"); if (m) { m.hidden = false; m.textContent = "Studio could not start: " + (e.message || e); } });
