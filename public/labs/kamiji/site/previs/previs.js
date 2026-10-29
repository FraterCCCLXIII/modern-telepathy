// PREVIS prototype: wires the store, the 3D stage and the panels together, and runs the render scheduler.
import { createStore, sampleProject, emptyProject, normalise, loadStored, timecode } from "./store.js";
import { createStage } from "./stage.js";
import { createMap } from "./map.js";
import { createArtboard } from "./artboard.js";
import { createTimeline } from "./timeline.js";
import { createBoard } from "./board.js";
import { createViewport } from "./viewport.js";
import { createInspector } from "./inspector.js";
import { createTransport } from "./transport.js";
import { createThumbs } from "./thumbs.js";
import { createPrevisSubs } from "./subs.js";
import { createPrevisSpeech } from "./speech.js";
import { createVoiceUI } from "./voiceui.js";
import { createSnaps } from "./snaps.js";
import { createIO } from "./io.js";
import { createDrawer } from "./drawer.js";
import { createRail } from "./rail.js";
import { PRESETS } from "./catalog.js";
import { SOURCES, SINKS, STATUS_LABEL, PROVIDERS } from "./nodekinds.js";
import { SUB_LABEL, CONTROL_KINDS, OTHER_KINDS, previewCast, outputNode, effectiveRef } from "./art.js";
import { ensureScriptNode, scriptNodeChar, NARRATOR, charName } from "./script.js";
import { el, initStatus, announce, clamp } from "./ui.js";
import { addShot } from "./ops.js";

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const qs = new URLSearchParams(location.search);
const MAX_LIVE = Math.max(1, +qs.get("live") || 6); // never more than this many live cards, across the map and the artboard
const CARD_BUDGET_MS = 12, CARD_W = 320, CARD_H = 180;
const pref = { get(k) { try { return localStorage.getItem("kamiji.previs." + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem("kamiji.previs." + k, v); } catch (e) { /* ignore */ } } };

initStatus($("#pv-live"), $("#pv-status-line"));
let stage = null;
try { stage = await createStage(); } catch (err) { console.warn("Previs: 3D unavailable", err); }

const store = createStore();
let storageOk = true;
try { localStorage.setItem("kamiji.previs.probe", "1"); localStorage.removeItem("kamiji.previs.probe"); } catch (e) { storageOk = false; }
$("#pv-save").textContent = storageOk ? "Autosaved in this browser" : "Storage blocked: use Export to keep your work";
const restored = loadStored();
store.set(restored || sampleProject());
if (restored) announce("Restored your project from this browser", { line: true });

const transport = createTransport(store);
const thumbs = createThumbs(stage, store);
const snaps = createSnaps(stage);
const fileInput = $("#pv-srcfile");
const board = createBoard({ store, thumbs, transport, root: $("#pv-board"), printHost: $("#pv-print") });
const io = createIO({ store, stage, board, transport, announce, fileInput });
io.ensureUserModels(store.p);

// ---- card rendering (the scheduler below decides who may draw) ---------------------------------------
function drawNode(rec, node, now, poster) {
  const inst = stage.instance(node);
  if (inst.state === "loading") { rec.msg.textContent = "Loading model"; rec.msg.hidden = false; return false; }
  if (inst.state === "error") { rec.msg.textContent = "3D unavailable"; rec.msg.hidden = false; rec.drawn = true; return false; }
  rec.msg.hidden = true;
  const shot = node.shots[0], fps = store.p.fps; let t = 0, u = 0;
  if (shot) { t = shot.off / fps; if (!poster) { const dur = shot.len / fps, ph = (now / 1000) % (dur + 0.8), k = Math.min(dur, ph); t += k; u = k / dur; } }
  inst.setTime(t); rec.cam ||= stage.camera();
  if (shot) stage.camAt(rec.cam, shot.cam, u); else stage.applyKey(rec.cam, { p: [0, 1, 4.4], t: [0, 0.8, 0], fov: 35 });
  const z = rec.vp.__z?.() ?? 1, W = z > 1.2 ? Math.min(768, Math.round(264 * z * Math.min(devicePixelRatio || 1, 2) / 1.2 / 2) * 2) : CARD_W, H = Math.round(W * 9 / 16);
  stage.draw(inst, rec.cam, rec.canvas, W, H); rec.drawn = true; rec.lastDraw = now; rec.draws = (rec.draws || 0) + 1; stats.cards++;
  return true;
}
const sigOf = (n) => { const s = n.shots[0]; return JSON.stringify([n.props, s ? [s.off, s.cam.a, s.cam.b, s.len] : 0, store.p.fps]); };
const deps = {
  sigOf, drawStory: (rec, now, poster) => drawNode(rec, rec.node, now, poster),
  drawSub(rec, scene, now, poster) {
    const sub = rec.node; if (!scene) return false;
    if (sub.type === "output") return drawNode(rec, scene, now, poster);
    const cast = previewCast(scene.art, sub); if (!cast) return false;
    const tmp = { id: `ab:${scene.id}:${sub.id}`, type: "scene", props: { cast, bg: "#e9e8e1", light: "soft" }, shots: [] }, inst = stage.instance(tmp);
    if (inst.state === "loading") { rec.msg.textContent = "Loading model"; rec.msg.hidden = false; return false; }
    if (inst.state === "error") { rec.msg.textContent = "3D unavailable"; rec.msg.hidden = false; rec.drawn = true; return false; }
    rec.msg.hidden = true; inst.setTime(poster ? 0.6 : (now / 1000) % 4); rec.cam ||= stage.camera(); stage.applyKey(rec.cam, stage.presetKey(inst, cast[0] && inst.actors[0]?.def.rigged ? "Close" : "Front"));
    stage.draw(inst, rec.cam, rec.canvas, 256, 144); rec.drawn = true; rec.lastDraw = now; rec.draws = (rec.draws || 0) + 1; stats.cards++; return true;
  },
  subSig: (scene, sub) => (!scene ? "" : sub.type === "output" ? sigOf(scene) : JSON.stringify(previewCast(scene.art, sub))),
  dropSub: (sceneId, subId) => stage?.drop(`ab:${sceneId}:${subId}`),
  openScript: (scene, sub, char) => { if (sub) { drawer.show({ char: scriptNodeChar(scene.art, sub), node: scene.id }); } else openArtboardScript(scene, char); },
  addMenu: (x, y, w) => openMenu(x, y, w),
  avatar: (ref, cb) => snaps.get("c:" + ref, { cast: [{ ref }], cam: "Close" }, cb),
};
// voice chips and caption overlays on the cards (the chips come from voiceui.js, created below once the speech engine exists)
let voiceUI = null, speech = null, subs = null;
Object.assign(deps, {
  voiceChip: (idsOf) => voiceUI?.chip(idsOf) || null,
  speakers(node) { const ids = new Set(); for (const c of node.art.nodes) if (c.type === "content" && c.kind === "character") ids.add(effectiveRef(node.art, c)); for (const l of store.p.script.lines) if (l.node === node.id && l.kind === "dialogue" && l.char !== NARRATOR && l.status !== "cut") ids.add(l.char); return [...ids]; },
  // the line a story-map card shows: the one being spoken while the cut plays through this scene, otherwise the scene's first dialogue line
  captionFor(node) {
    if (!subs?.available || !subs.st.captions) return null;
    let l = null; const e = transport.playing || transport.scrubbing ? transport.entryAt() : null;
    if (e && e.node.id === node.id) l = subs.activeAt(transport.frame)?.line || null;
    l ||= subs.lines.find((x) => x.kind === "dialogue" && x.node === node.id && x.startMs != null) || null;
    return l ? { who: charName(store.p, l.characterId), text: String(l.text).replace(/<[^>]*>/g, "") } : null;
  },
  paintCaption(rec) {
    const cap = rec.view?.querySelector(".pv-card-cap"); if (!cap) return;
    const c = deps.captionFor(rec.node), key = c ? c.who + "|" + c.text : "";
    if (cap._k === key) return; cap._k = key; cap.replaceChildren(); cap.hidden = !c;
    if (c) cap.append(el("b", { text: c.who }), c.text);
  },
});
const mapVp = $(".pv-map-vp"), abVp = $(".pv-ab-vp");
const map = createMap({ store, root: $("#pv-map"), onAddMenu: (x, y, w) => openMenu(x, y, w), onOpen: (n) => artboard.open(n.id), deps, io, thumbs });
const artboard = createArtboard({ store, vp: abVp, deps });
const pipeHost = $("#pv-pipe"), dock = map.pipe.dock($("#pv-map"), () => (store.sel.open ? store.p.nodes.find((n) => n.id === store.sel.open && n.type === "scene") : null));
mapVp.__z = () => map.view.z; abVp.__z = () => artboard.view.z;
const viewport = await createViewport({ store, stage, transport, root: $("#pv-view"), reduceMotion, onUserOrbit: () => transport.pause() });
window.__pv = { store, map, artboard }; // debug / test hook (no UI uses it)
const timeline = createTimeline({ store, transport, thumbs, root: $("#pv-timeline") });
const drawer = createDrawer({ store, root: $("#pv-script"), transport, printHost: $("#pv-print"), pref, deps: {
  avatar: deps.avatar, jump, openScript: (node, sub, char) => deps.openScript(node, sub, char) } });
const inspector = createInspector({ store, stage, viewport, root: $("#pv-view"), io, deps: { openArtboard: (n) => artboard.open(n.id), closeArtboard: () => artboard.close(), openScript: deps.openScript } });
const rail = createRail({ root: $("#pv-rail"), store, stage, snaps, map, artboard, drawer, io, viewport, transport, pref, cmds: { help: () => $("#pv-help").showModal() }, accessories: stage ? () => stage.accessories() : null });
// ---- subtitles (site/subtitles module): Previs owns the clock, the module renders ---------------------------------
subs = createPrevisSubs({ store, stage, viewport, transport, container: $(".pv-subs"), safeEl: $(".pv-safe"), pref, announce });
thumbs.overlay = subs.available ? subs : null; timeline.subs = subs; io.setSubs(subs); subs.changed = () => store.emit("subs");
speech = createPrevisSpeech({ store, transport, subs, pref, announce, charName: (id) => charName(store.p, id) });
voiceUI = createVoiceUI({ speech, store, charName: (id) => charName(store.p, id) });
{ // Audio on / off (viewport header and transport) and its visible notice
  const btns = [...document.querySelectorAll("[data-audio]")], noteEl = $(".pv-audio-note");
  const ico = () => { const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("width", "13"); s.setAttribute("height", "13"); s.setAttribute("aria-hidden", "true"); s.classList.add("pv-vi");
    s.innerHTML = '<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path class="pv-wave" d="M11.5 5.5a3.5 3.5 0 010 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="pv-slash" d="M11 5l4 6M15 5l-4 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'; return s; };
  btns.forEach((b) => { b.prepend(ico()); b.addEventListener("click", () => speech.toggle()); });
  const sync = () => {
    btns.forEach((b) => { b.setAttribute("aria-pressed", speech.st.on ? "true" : "false"); const t = b.querySelector(".pv-audio-t"); if (t) t.textContent = b.dataset.audio === "full" ? (speech.st.on ? "Audio on" : "Audio off") : "Audio"; });
    const n = speech.notice; noteEl.hidden = !n.text; noteEl.textContent = n.text; noteEl.classList.toggle("is-warn", n.warn);
  };
  speech.onChange(sync); sync();
  window.__audioToggle = () => speech.toggle();
}
{
  const tg = $("[data-act=subs]"), sty = $("#pv-ss-style"), size = $("#pv-ss-size"), bg = $("#pv-ss-bg"), lab = $("#pv-ss-labels"), safe = $("#pv-ss-safe"), ext = $("#pv-ss-extend"), det = $(".pv-subs-set");
  if (!subs.available) { tg.hidden = true; det.hidden = true; }
  else {
    const sync = () => { tg.setAttribute("aria-pressed", subs.st.captions ? "true" : "false"); tg.textContent = subs.st.captions ? "Captions on" : "Captions off";  sty.value = subs.st.style; size.value = subs.st.size; bg.value = subs.st.bg ?? 0.7; lab.checked = subs.st.labels; safe.checked = subs.st.safe; };
    sync();
    tg.addEventListener("click", () => { subs.setCaptions(!subs.st.captions); sync(); });
    sty.addEventListener("change", () => subs.setStyle(sty.value)); size.addEventListener("input", () => subs.setSize(size.value)); bg.addEventListener("input", () => subs.setBg(bg.value));
    lab.addEventListener("change", () => subs.setLabels(lab.checked)); safe.addEventListener("change", () => subs.setSafe(safe.checked)); ext.addEventListener("click", () => subs.autoExtendShots());
    window.__subsToggle = () => { subs.setCaptions(!subs.st.captions); sync(); };
  }
}
if (!stage) { const m = $(".pv-view-msg"); m.textContent = "3D is unavailable in this browser (WebGL could not start). The map, storyboard and timeline still work; pictures are missing."; m.hidden = false; }
stage && (stage.onLost = () => announce("The 3D context was lost. Reload the page to restore pictures."));

function jump(line) {
  const n = store.p.nodes.find((x) => x.id === line.node); if (!n) return;
  if (store.sel.open) artboard.close();
  store.select([n.id], { shot: line.shot || n.shots[0]?.id || null }); map.centreOn(n);
  const se = line.shot && store.d.seq.find((s) => s.shot.id === line.shot); if (se) { transport.pause(); transport.seek(se.start); }
  announce(`Jumped to ${n.name}${se ? `, shot ${se.n}` : ""}`);
}
function openArtboardScript(scene, char) {
  const sub = ensureScriptNode(store, scene, char || NARRATOR);
  artboard.open(scene.id); store.sel.sub = [sub.id]; store.emit("sel"); requestAnimationFrame(() => requestAnimationFrame(() => { artboard.centreOn(sub); artboard.focusNode(sub.id); }));
}

// ---- store -> panels (coalesced to one pass per frame) ----------------------------------------------
let pend = new Set(), queued = false;
store.on((scope) => { pend.add(scope); if (!queued) { queued = true; requestAnimationFrame(flush); } });
io.onChange(() => map.sync());
function flush() {
  queued = false; const s = pend; pend = new Set();
  const moveOnly = [...s].every((x) => x === "move" || x === "history");
  const open = !!store.sel.open;
  $("#pv-map").classList.toggle("is-art", open);
  if (open) { const sc = store.p.nodes.find((n) => n.id === store.sel.open); $("#pv-crumb-name").textContent = sc?.name || ""; }
  $("[data-cmd=add]").textContent = open ? "Add sub-node" : "Add node";
  map.sync(); if (open || artboard.cards.size) artboard.sync();
  if (!pipeHost.hidden) map.pipe.lanes(pipeHost); dock.sync();
  if (!moveOnly) {
    timeline.render(); board.render();
    const name = $("#pv-name"); if (document.activeElement !== name) name.value = store.p.name;
    if (stage) { const keep = new Set(store.p.nodes.map((n) => n.id)); for (const n of store.p.nodes) if (n.type === "scene") for (const a of n.art.nodes) keep.add(`ab:${n.id}:${a.id}`); stage.prune(keep); }
    document.body.dataset.empty = store.p.nodes.length ? "0" : "1"; io.ensureUserModels(store.p);
    updateActive();
  }
  if (s.has("history")) { $("[data-cmd=undo]").disabled = !store.canUndo; $("[data-cmd=redo]").disabled = !store.canRedo; }
  timeline.onState();
}
store.emit("all"); store.emit("history"); timeline.onState();

// ---- transport ---------------------------------------------------------------------------------------
let touched = false, lastAnnounced = null;
let lastCap = 0;
function updateActive() { const e = transport.entryAt(); map.setActive(touched && e && store.d.inCut.has(e.node.id) ? e.node.id : null); }
transport.on((kind) => {
  if (kind === "state") {
    timeline.onState(); touched = true;
    if (transport.playing) { viewport.setMode("shot"); announce(`Playing from ${timecode(transport.frame, store.p.fps)}`); }
    else announce(`Paused at ${timecode(transport.frame, store.p.fps)}`, { line: false });
  }
  if (kind === "frame") {
    if (transport.scrubbing) { touched = true; viewport.setMode("shot"); }
    timeline.onFrame(); updateActive();
    const e = transport.entryAt();
    if (e && e.shot.id !== lastAnnounced && (transport.playing || transport.scrubbing)) {
      lastAnnounced = e.shot.id; announce(`Shot ${e.n} of ${store.d.seq.length}: ${e.node.name}`, { line: false });
      if (store.sel.shot !== e.shot.id) { store.sel.shot = e.shot.id; if (!store.sel.open) store.sel.nodes = [e.node.id]; store.emit("sel"); }
    }
    viewport.dirty = true;
    if (transport.playing && performance.now() - lastCap > 150) { lastCap = performance.now(); for (const r of map.cards.values()) if (r.view) deps.paintCaption(r); }
  }
  $("#pv-mini-tc").textContent = timecode(transport.frame, store.p.fps);
  $("#pv-mini-play").textContent = transport.playing ? "Pause" : "Play"; $("#pv-mini-play").setAttribute("aria-pressed", transport.playing ? "true" : "false");
});
$("#pv-mini-play").addEventListener("click", () => transport.toggle());

// ---- render scheduler: ONE shared renderer, 30 fps cap, a budget for cards on the map AND the artboard ----
const stats = { raf: 0, ticks: 0, vp: 0, cards: 0, shown: { raf: 0, ticks: 0, vp: 0, cards: 0 }, cardMs: 0, live: 0, visible: 0, total: 0, t: performance.now() };
let last = 0, starve = 0, ranked = [], rankedAt = 0;
const FRAME_MS = 1000 / 30;
const isSelected = (r) => (r.node.shots ? !store.sel.open && store.sel.nodes.includes(r.node.id) : store.sel.open && store.sel.sub.includes(r.node.id));
function rank(now) {
  if (now - rankedAt < 250) return; rankedAt = now;
  const list = [], all = [...map.cards.values(), ...artboard.cards.values()];
  for (const r of all) {
    if (!r.canvas || !r.render) continue;
    const sig = r.sigFn?.() ?? ""; if (sig !== r.sig) { r.sig = sig; r.drawn = false; }
    if (!r.visible) continue;
    const vr = r.vp.getBoundingClientRect(), b = r.el.getBoundingClientRect();
    r.dist = Math.hypot(b.left + b.width / 2 - (vr.left + vr.width / 2), b.top + b.height / 2 - (vr.top + vr.height / 2)) + (isSelected(r) ? -1e6 : 0);
    r.lodLive = !r.vp.classList.contains("lod-bubble"); list.push(r);
  }
  list.sort((a, b) => a.dist - b.dist); ranked = list;
  const liveOk = stage && !reduceMotion; let n = 0;
  for (const r of list) { const live = liveOk && r.lodLive && n < MAX_LIVE; if (live) n++; if (live !== r.live) { r.live = live; r.el.classList.toggle("is-live", live); } }
  for (const r of all) if (!list.includes(r) && r.live) { r.live = false; r.el.classList.remove("is-live"); }
  stats.live = n; stats.visible = list.length; stats.total = all.filter((r) => r.canvas).length;
}
function cardPass(now) {
  rank(now);
  const t0 = performance.now(); let did = 0;
  for (const r of ranked) { if (!r.drawn) { r.render(now, true); if (++did >= 2 || performance.now() - t0 > CARD_BUDGET_MS * 2) return; } }
  const live = ranked.filter((r) => r.live); if (!live.length) return;
  for (const r of live) if (isSelected(r)) r.render(now, false);
  const rest = live.filter((r) => !isSelected(r) && now - (r.lastDraw || 0) >= 100).sort((a, b) => (a.lastDraw || 0) - (b.lastDraw || 0));
  let n = 0;
  for (const r of rest) { const over = performance.now() - t0 >= CARD_BUDGET_MS; if (over && !(n === 0 && starve >= 1)) break; r.render(now, false); n++; }
  starve = n ? 0 : starve + 1;
}
function tick(now) {
  requestAnimationFrame(tick); stats.raf++;
  if (document.hidden || now - last < FRAME_MS - 2) return;
  const dt = Math.min((now - last) / 1000, 0.1); last = now; stats.ticks++;
  transport.advance(now);
  const t0 = performance.now();
  if (stage && !stage.lost) { if (viewport.render(now, dt)) stats.vp++; cardPass(now); }
  stats.cardMs = performance.now() - t0;
  if (!debugEl.hidden && now - stats.t > 500) debugUpdate(now);
}
const debugEl = $("#pv-debug");
function debugUpdate(now) {
  const s = (now - stats.t) / 1000, f = (v) => (v / s).toFixed(1), info = stage ? stage.info() : {};
  debugEl.textContent = [`raf ${f(stats.raf)}/s  ticks ${f(stats.ticks)}/s (cap 30)`, `viewport ${f(stats.vp)}/s  cards ${f(stats.cards)}/s`, `live ${stats.live}/${MAX_LIVE}  visible ${stats.visible}  cards ${stats.total}  lod ${map.lod}`, `last tick ${stats.cardMs.toFixed(1)} ms  draw ${stage ? stage.stats.lastMs.toFixed(1) : 0} ms`, `draw calls ${info.calls ?? 0}  tris ${info.tris ?? 0}  geoms ${info.geoms ?? 0}  reduced-motion ${reduceMotion}`].join("\n");
  stats.shown = { raf: stats.raf / s, ticks: stats.ticks / s, vp: stats.vp / s, cards: stats.cards / s }; stats.raf = stats.ticks = stats.vp = stats.cards = 0; stats.t = now;
}
requestAnimationFrame(tick);
setInterval(() => { if (debugEl.hidden) { const now = performance.now(), s = (now - stats.t) / 1000; stats.shown = { raf: stats.raf / s, ticks: stats.ticks / s, vp: stats.vp / s, cards: stats.cards / s }; stats.raf = stats.ticks = stats.vp = stats.cards = 0; stats.t = now; } }, 2000);
function toggleDebug() { debugEl.hidden = !debugEl.hidden; announce(debugEl.hidden ? "Debug overlay hidden" : "Debug overlay shown", { line: false }); }
if (qs.has("debug")) debugEl.hidden = false; // never remembered: it is a diagnostic, not a setting

// ---- add menu: scenes / import / export on the story map, sub-nodes in an artboard -------------------------
const menu = $("#pv-menu");
let menuAt = null, menuFrom = null;
function closeMenu(refocus = true) { if (menu.hidden) return; menu.hidden = true; $("[data-cmd=add]").setAttribute("aria-expanded", "false"); if (refocus) menuFrom?.focus?.(); }
const mi = (title, note, fn) => el("button", { role: "menuitem", class: "pv-menu-i", type: "button", onclick: () => { closeMenu(false); fn(); } }, el("b", { text: title }), note ? el("small", { text: note }) : null);
function openMenu(x, y, world) {
  menuFrom = document.activeElement; menuAt = world || null; menu.replaceChildren();
  const h = (t) => menu.append(el("div", { class: "pv-menu-h", text: t, role: "presentation" }));
  if (store.sel.open) {
    const add = (type, opts) => () => artboard.addSub(type, opts, menuAt);
    h("Add content"); [["Character", "character"], ["Prop", "prop"], ["Shape", "shape"], ["Accessory", "accessory"], ["Background", "background"]].forEach(([t, k]) => menu.append(mi(t, k === "accessory" ? "Hats, glasses, bows" : "", add("content", { kind: k }))));
    h("Add model"); menu.append(mi("Model", "A GLB asset: Kamiji, Kamikin, Rubbernose, props", add("model", {})));
    h("Add control"); Object.entries(CONTROL_KINDS).forEach(([k, t]) => menu.append(mi(t, k === "clip" ? "Drives the character's animation" : "Stored, not rendered yet", add("control", { kind: k }))));
    h("Add script"); menu.append(mi("Script", "Dialogue and action lines for one character", add("script", {})));
    h("Add camera"); menu.append(mi("Camera (a new shot)", "Each shot owns one camera", add("camera", {})));
    h("Add light"); menu.append(mi("Light", "One light feeds the Scene output", add("light", {})));
    h("Add audio"); menu.append(mi("Audio cue", "A cue note; nothing plays", add("audio", {})));
    h("Add note"); Object.entries(OTHER_KINDS).forEach(([k, t]) => menu.append(mi(t, "", add("other", { kind: k }))));
  } else {
    h("Add a scene node"); PRESETS.forEach((p) => menu.append(mi(p.label, p.note, () => map.addNode(p.id, menuAt)))); menu.append(mi("Branch node", "Split the story into alternates", () => map.addNode("branch", menuAt)));
    h("Import (start of the graph)"); Object.entries(SOURCES).forEach(([k, d]) => menu.append(mi(d.label, `${STATUS_LABEL[d.status]}. ${d.note}`, () => map.addNode("source:" + k, menuAt))));
    h("Generation (MOCKUP, simulated)"); menu.append(mi("Prompt chat", "Mockup. A scripted chat whose prompts drive a provider node", () => map.addNode("chat:prompt", menuAt))); Object.entries(PROVIDERS).forEach(([k, d]) => menu.append(mi(d.label + " provider", "Mockup. " + d.note, () => map.addNode("provider:" + k, menuAt))));
    h("Export and publish (end of the graph)"); Object.entries(SINKS).forEach(([k, d]) => menu.append(mi(d.label, `${STATUS_LABEL[d.status]}. ${d.note}`, () => map.addNode("sink:" + k, menuAt))));
  }
  menu.hidden = false; $("[data-cmd=add]").setAttribute("aria-expanded", "true");
  const w = menu.offsetWidth, hh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px"; menu.style.top = Math.max(8, Math.min(y, innerHeight - Math.min(hh, innerHeight - 16) - 8)) + "px"; menu.scrollTop = 0;
  menu.querySelector("button").focus();
}
menu.addEventListener("keydown", (e) => {
  const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); } else if (e.key === "Tab") closeMenu(false);
});
document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest("[data-cmd=add]")) closeMenu(false); });

// ---- commands ----------------------------------------------------------------------------------------
const dlg = $("#pv-dialog"), help = $("#pv-help");
const cur = () => (store.sel.open ? artboard : map);
function newProject() { store.replace(emptyProject()); touched = false; transport.frame = 0; map.fit(); announce("New empty project. Undo brings the previous one back."); }
function loadSample() { store.replace(sampleProject()); touched = false; transport.frame = 0; requestAnimationFrame(() => map.fit()); announce("Sample project loaded"); }
function exportJson() {
  const blob = new Blob([JSON.stringify(store.p, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: (store.p.name || "previs").replace(/[^\w.-]+/g, "-").toLowerCase() + ".previs.json" });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); announce("Exported project JSON");
}
const fileIn = $("#pv-file");
fileIn.addEventListener("change", async () => {
  const f = fileIn.files[0]; fileIn.value = ""; if (!f) return;
  try {
    if (f.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB. Nothing was read.");
    const p = normalise(JSON.parse(await f.text()));
    store.replace(p); touched = false; transport.frame = 0; requestAnimationFrame(() => map.fit()); announce(`Imported "${p.name}": ${p.nodes.length} nodes, ${store.d.seq.length} shots`);
  } catch (err) { announce("Import failed: " + err.message + " The current project is unchanged."); }
});
async function printBoard() { await board.buildPrint(); window.print(); }
addEventListener("beforeprint", () => { if ($("#pv-print").dataset.kind !== "script") board.buildPrint(); });
$("#pv-name").addEventListener("input", (e) => { store.update((p) => { p.name = e.target.value.slice(0, 80); }, "name"); });
$("#pv-name").addEventListener("change", () => store.commit());
const cmds = {
  undo: () => { if (store.undo()) announce("Undone"); }, redo: () => { if (store.redo()) announce("Redone"); },
  new: newProject, sample: loadSample, import: () => fileIn.click(), export: exportJson, print: printBoard, help: () => help.showModal(), debug: toggleDebug,
  script: () => drawer.toggle(), rail: () => rail.toggle(),
  pipeview: () => { pipeHost.hidden = !pipeHost.hidden; $("[data-cmd=pipeview]").setAttribute("aria-pressed", String(!pipeHost.hidden)); if (!pipeHost.hidden) map.pipe.lanes(pipeHost); },
  add: () => { const b = $("[data-cmd=add]").getBoundingClientRect(); openMenu(b.left, b.bottom + 4, null); },
  dup: () => cur().dup(), del: () => cur().del(), rename: () => { const g = cur(), id = store.sel.open ? store.sel.sub[0] : store.sel.nodes[0]; if (id) g.rename(id); }, connect: () => cur().connectSelected(), fit: () => cur().fit(),
  zin: () => cur().zoomBy(1.25), zout: () => cur().zoomBy(1 / 1.25), z100: () => cur().zoomTo(1), closeart: () => artboard.close(), openart: () => { const n = store.p.nodes.find((x) => x.id === store.sel.nodes[0] && x.type === "scene"); if (n) artboard.open(n.id); else announce("Select a scene first."); },
};
document.addEventListener("click", (e) => { const b = e.target.closest("[data-cmd]"); if (b && cmds[b.dataset.cmd]) cmds[b.dataset.cmd](e); });
$("#pv-help-close")?.addEventListener("click", () => help.close());
$("#pv-rail-open").addEventListener("click", () => rail.toggle());
const onZoom = () => { const g = cur(); $(".pv-zoom-read").textContent = Math.round(g.view.z * 100) + "%"; };
map.onView = onZoom; artboard.onView = onZoom;

// ---- panels: tabs (below 1100 px), storyboard splitter -----------------------------------------------
const tabs = [...document.querySelectorAll(".pv-tab")], panels = { map: $("#pv-map"), view: $("#pv-view"), board: $("#pv-board"), timeline: $("#pv-timeline") };
function setTab(name, focus = false) {
  if (name === "timeline" && matchMedia("(min-width: 700px)").matches) name = "map";
  document.body.dataset.tab = name; pref.set("tab", name);
  tabs.forEach((t) => { const on = t.dataset.tab === name; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
  Object.entries(panels).forEach(([k, p]) => p.classList.toggle("is-tab-active", k === name));
  viewport.resize(); requestAnimationFrame(() => { timeline.render(); cur().sync(); });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => setTab(t.dataset.tab));
  t.addEventListener("keydown", (e) => { const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { e.preventDefault(); setTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true); } });
});
setTab(["map", "view", "board", "timeline"].includes(pref.get("tab")) ? pref.get("tab") : "map");
addEventListener("resize", () => { viewport.resize(); if (document.body.dataset.tab === "timeline" && matchMedia("(min-width: 700px)").matches) setTab("map"); });

const boardEl = $("#pv-board"), main = $(".pv-main"), boardBtn = $("[data-act=toggleboard]"), split = $(".pv-split");
const defH = clamp(Math.round(innerHeight * 0.23), 190, 250);
const setBoardH = (h, save = true) => { h = clamp(Math.round(h), 96, Math.round(innerHeight * 0.5)); main.style.setProperty("--board-h", h + "px"); split.setAttribute("aria-valuenow", h); if (save) pref.set("boardh", String(h)); };
setBoardH(+pref.get("boardh") || defH, false);
function setBoardOpen(open) { boardEl.classList.toggle("is-collapsed", !open); boardBtn.setAttribute("aria-expanded", open ? "true" : "false"); boardBtn.textContent = open ? "Collapse" : "Expand"; }
boardBtn.addEventListener("click", () => setBoardOpen(boardEl.classList.contains("is-collapsed")));
setBoardOpen(true); // open by default every time; only the height is remembered
split.addEventListener("pointerdown", (e) => { split.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = boardEl.getBoundingClientRect().height; setBoardOpen(true); const mv = (ev) => setBoardH(h0 + (y0 - ev.clientY)), up = () => { split.removeEventListener("pointermove", mv); split.removeEventListener("pointerup", up); }; split.addEventListener("pointermove", mv); split.addEventListener("pointerup", up); });
split.addEventListener("keydown", (e) => { const h = boardEl.getBoundingClientRect().height; if (e.key === "ArrowUp") { e.preventDefault(); setBoardH(h + 24); } else if (e.key === "ArrowDown") { e.preventDefault(); setBoardH(h - 24); } });
split.addEventListener("dblclick", () => setBoardH(defH));

// ---- keyboard ----------------------------------------------------------------------------------------
const areaOf = (t) => t.closest?.("[data-area]")?.dataset.area || "";
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
  const t = e.target, typing = t.matches?.("input,textarea,select,[contenteditable=true]"), mod = e.metaKey || e.ctrlKey, k = e.key;
  if (typing) return;
  if (mod && k.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? cmds.redo() : cmds.undo(); return; }
  if (mod && k.toLowerCase() === "y") { e.preventDefault(); cmds.redo(); return; }
  if (mod && k.toLowerCase() === "d") { e.preventDefault(); cmds.dup(); return; }
  if (mod || e.altKey) return;
  const area = areaOf(t), onBtn = t.matches?.("button,a,summary,[role=tab]"), inTree = !!t.closest?.(".pv-tree"), fps = store.p.fps;
  switch (k) {
    case "?": e.preventDefault(); cmds.help(); break;
    case " ": if (onBtn || inTree) return; e.preventDefault(); transport.toggle(); break;
    case "k": case "K": transport.pause(); break;
    case "j": case "J": transport.pause(); transport.seek(transport.frame - fps); break;
    case "l": case "L": transport.pause(); transport.seek(transport.frame + fps); break;
    case ",": transport.step(-1); break;
    case ".": transport.step(1); break;
    case "ArrowLeft": if (area === "timeline" && !onBtn) { e.preventDefault(); transport.step(e.shiftKey ? -10 : -1); } break;
    case "ArrowRight": if (area === "timeline" && !onBtn) { e.preventDefault(); transport.step(e.shiftKey ? 10 : 1); } break;
    case "Home": if (area === "timeline" || area === "viewport" || !area) { e.preventDefault(); transport.pause(); transport.seek(0); } break;
    case "End": if (area === "timeline" || area === "viewport" || !area) { e.preventDefault(); transport.pause(); transport.seek(store.d.total - 1); } break;
    case "i": case "I": timeline.setIn(); break;
    case "o": case "O": timeline.setOut(); break;
    case "m": case "M": timeline.addMarker(); break;
    case "\\": store.update((p) => { p.loop = !p.loop; }); store.commit(); announce(store.p.loop ? "Loop on" : "Loop off", { line: false }); break;
    case "f": case "F": cur().fit(); break;
    case "+": case "=": if (area !== "map") cur().zoomBy(1.2); break;
    case "-": case "_": if (area !== "map") cur().zoomBy(1 / 1.2); break;
    case "n": case "N": { e.preventDefault(); const b = cur().vp.getBoundingClientRect(); openMenu(b.left + 40, b.top + 40, null); } break;
    case "d": case "D": cmds.dup(); break;
    case "c": case "C": cmds.connect(); break;
    case "e": case "E": if (!store.sel.open) map.cycleSelectedEdge(); break;
    case "s": drawer.toggle(); break;
    case "S": { const n = store.p.nodes.find((x) => x.id === (store.sel.open || store.sel.nodes[0]) && x.type === "scene"); if (n) addShot(store, n.id); } break;
    case "b": case "B": rail.toggle(); break;
    case "t": case "T": if (subs.available) window.__subsToggle(); break;
    case "a": case "A": speech.toggle(); break;
    case "F2": e.preventDefault(); if (!inTree) cmds.rename(); break;
    case "p": case "P": printBoard(); break;
    case "g": case "G": toggleDebug(); break;
    case "Delete": case "Backspace":
      if (inTree) return; e.preventDefault();
      if (area === "timeline" || area === "board") timeline.deleteSelected(); else if (!cur().del()) timeline.deleteSelected();
      break;
    case "Escape": if (!menu.hidden) closeMenu(); else if (transport.playing) transport.pause(); else if (store.sel.open && area === "map" && !store.sel.sub.length && !store.sel.subEdge) artboard.close(); else if (rail.isOpen() && !desktopRail()) rail.open(false); break;
    default: break;
  }
});
const desktopRail = () => matchMedia("(min-width: 1100px)").matches;
addEventListener("resize", () => { viewport.resize(); });

Object.assign(window, { __previs: { store, stage, map, artboard, timeline, board, viewport, transport, stats, thumbs, cmds, drawer, rail, io, snaps, inspector, subs, speech, voiceUI, MAX_LIVE } });
document.documentElement.dataset.ready = "1";
requestAnimationFrame(() => map.fit());
