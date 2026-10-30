// Previs <-> subtitles module (site/subtitles). Previs owns the clock; the module only renders what the playhead says.
//  - lines: project.script dialogue lines, timed from their shot (fromPrevisScript), rebuilt on every script / shot change, undo, import
//  - overlay: a sibling <div> over the viewport canvas (never the WebGL canvas)
//  - thumbnails and exports paint the same lines with drawSubtitleToCanvas
import { SUBS } from "./subsmod.js";
import { orderedLines, characters, words, NARRATOR } from "./script.js";

const DEF = { style: "bubble", size: 1.3, bg: null, labels: true, captions: true, safe: false }; // speech bubbles at the speaker, on by default
const KEY = "kamiji.previs.subs";
export const SUB_STYLES = ["classic", "boxed", "karaoke", "bubble", "cinematic", "typewriter"];

export function createPrevisSubs({ store, stage, viewport, transport, container, safeEl, pref, announce }) {
  const st = { ...DEF };
  try { Object.assign(st, JSON.parse(pref.get("subs") || "{}")); } catch (e) { /* defaults */ }
  if (!SUB_STYLES.includes(st.style)) st.style = "classic";
  const api = { available: !!SUBS, st, lines: [], changed: null, onChange: () => {} };
  if (!SUBS) { Object.assign(api, { rebuild() {}, tickNow() {}, warningsFor: () => [], overlayKey: () => "", paint() {}, burn: () => false, autoExtendShots: () => 0, setStyle() {}, setSize() {}, setBg() {}, setLabels() {}, setCaptions() {}, setSafe() {}, lineFor: () => null, activeAt: () => null, linesForScope: () => [], charMap: () => ({}) }); return api; }

  const save = () => { try { pref.set("subs", JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const charMap = () => SUBS.charactersFromPrevis(characters(store).map((c) => ({ id: c.id, name: c.name })), store.p.script.names);
  const subs = SUBS.createSubtitles(container, {
    style: st.style, size: st.size, bgOpacity: st.bg, captions: st.captions, speakerLabels: st.labels ? "change" : "off", characters: charMap(), fps: store.p.fps,
    anchorOf: (id, line) => viewport.headScreen(id, line?.node) || null,
  });
  api.module = subs;
  subs.setSize(st.size).setBackgroundOpacity(st.bg).setCaptions(st.captions).setSpeakerLabels(st.labels ? "change" : "off");
  safeEl.hidden = !st.safe;

  // ---- timing: a shot's dialogue lines share its frames in proportion to their words; imported timed lines keep their own times ----
  function build(scope = null) {
    const p = store.p, fps = p.fps, rows = orderedLines(store).filter((r) => r.line.status !== "cut");
    const spans = new Map(), glob = new Map(store.d.seq.map((s) => [s.shot.id, s.start]));
    (scope || store.d.seq).forEach((r) => spans.set(r.shot.id, { start: r.start, len: r.len }));
    const byShot = new Map(), alloc = new Map();
    for (const r of rows) { const l = r.line; if (l.kind !== "dialogue" || !l.shot || !spans.has(l.shot) || l.t0 != null) continue; if (!byShot.has(l.shot)) byShot.set(l.shot, []); byShot.get(l.shot).push(l); }
    for (const [sid, ls] of byShot) {
      const sp = spans.get(sid), tot = ls.reduce((a, l) => a + Math.max(1, words(l.text)), 0); let cur = sp.start;
      for (const l of ls) { const f = Math.max(1, Math.round(sp.len * Math.max(1, words(l.text)) / tot)); alloc.set(l.id, { startFrame: cur, durationFrames: f }); cur += f; }
    }
    const list = rows.map((r) => r.line), keep = list.filter((l, i) => l.kind === "dialogue" || (l.kind === "paren" && list[i + 1]?.kind === "dialogue" && list[i + 1].shot === l.shot && list[i + 1].char === l.char));
    const timing = (l) => {
      if (alloc.has(l.id)) return alloc.get(l.id);
      if (l.t0 != null && (!scope || spans.has(l.shot))) { const shift = scope && l.shot ? ((spans.get(l.shot).start - glob.get(l.shot)) / fps) * 1000 : 0; return { startMs: l.t0 * 1000 + shift, durationMs: Math.max(1, ((l.t1 ?? l.t0 + 2) - l.t0) * 1000) }; }
      return null;
    };
    return SUBS.fromPrevisScript({ lines: keep }, { fps, timing });
  }
  api.linesForScope = (scope) => build(scope).filter((l) => l.startMs != null);
  api.charMap = charMap;

  // ---- rebuild when anything that affects timing or text changes ----------------------------------------
  let sig = "", idx = SUBS.createIndex([]), warn = new Map();
  api.rebuild = () => {
    const p = store.p, key = JSON.stringify([p.fps, store.d.seq.map((s) => [s.shot.id, s.start, s.len]), p.script.lines.map((l) => [l.id, l.char, l.kind, l.text, l.shot, l.status, l.t0, l.t1]), Object.entries(p.script.names), p.script.cast.map((c) => c.name)]);
    if (key === sig) return false; sig = key;
    api.lines = build(); idx = SUBS.createIndex(api.lines); warn = new Map();
    for (const l of api.lines) { if (l.startMs == null || l.kind !== "dialogue") continue; const r = SUBS.checkLine(l, { fps: p.fps }); if (!r.ok) { const k = l.shot || l.id; if (!warn.has(k)) warn.set(k, []); warn.get(k).push(...r.warnings.map((w) => ({ lineId: l.id, code: w.code, message: w.message }))); } }
    subs.setCharacters(charMap()); subs.setTimeline(api.lines.filter((l) => l.startMs != null)); api.tickNow(true); api.changed?.("timeline"); return true;
  };
  api.warningsFor = (shotId) => warn.get(shotId) || [];
  api.lineFor = (shotId) => api.lines.find((l) => l.shot === shotId && l.kind === "dialogue" && l.startMs != null) || null;
  api.activeAt = (frame) => { const ms = (frame / store.p.fps) * 1000, l = idx.at(ms)[0]; return l ? { line: l, progress: Math.min(1, Math.max(0, (ms - l.startMs) / l.durationMs)) } : null; };

  // ---- the clock: Previs' playhead. Never subs.play(). ----------------------------------------------------
  // Captions follow the playhead whenever they are on (shot camera, free orbit, playing or paused). Paused with nothing spoken at the playhead,
  // the viewport previews the selected shot's own line so a bubble is there to see; playing and scrubbing always follow the playhead exactly.
  const stagedMs = () => {
    const ms = (transport.frame / store.p.fps) * 1000;
    if (transport.playing || transport.scrubbing || idx.at(ms).length) return ms;
    const se = store.d.seq.find((x) => x.shot.id === store.sel.shot), l = se && api.lineFor(se.shot.id);
    return l ? l.startMs + l.durationMs * 0.45 : ms;
  };
  api.tickNow = (seeking) => { container.classList.toggle("is-off", !st.captions); subs.tick(stagedMs(), { seeking: seeking ?? !transport.playing }); };
  const relayout = () => { clearTimeout(api._r); api._r = setTimeout(() => { if (st.style === "bubble") subs.setStyle("bubble"); }, 160); }; // after the viewport redraws, re-anchor the tail
  transport.on((kind) => { if (kind === "frame" || kind === "state") api.tickNow(kind === "frame" ? !transport.playing : undefined); });
  store.on((scope) => { if (scope === "sel") { api.tickNow(true); relayout(); } });
  const om = viewport.onMode; viewport.onMode = (m) => { om?.(m); api.tickNow(true); relayout(); };
  let lastRe = 0; transport.on((k) => { if (k === "frame" && transport.playing && st.style === "bubble" && performance.now() - lastRe > 300) { lastRe = performance.now(); subs.setStyle("bubble"); } }); // follow the speaker while the camera moves

  // ---- talking -> mouth (only rigs with a mouth morph: the Kamiji hand) ---------------------------------------
  subs.on("talking", (e) => { const n = e.line?.node; if (!n || !stage) return; stage.setTalking(n, e.characterId, e.speaking ? e.amplitude : 0, e.viseme); viewport.dirty = true; });

  // ---- settings (also persisted by the module for size / opacity / captions / labels; style and safe area here) ----
  const changed = () => { save(); api.changed?.("style"); };
  api.setStyle = (s) => { st.style = s; subs.setStyle(s); changed(); };
  api.setSize = (v) => { st.size = +v; subs.setSize(+v); changed(); };
  api.setBg = (v) => { st.bg = v == null ? null : +v; subs.setBackgroundOpacity(st.bg); changed(); };
  api.setLabels = (on) => { st.labels = !!on; subs.setSpeakerLabels(on ? "change" : "off"); changed(); };
  api.setCaptions = (on) => { st.captions = !!on; subs.setCaptions(on); changed(); announce(on ? "Subtitles on" : "Subtitles off", { line: false }); };
  api.setSafe = (on) => { st.safe = !!on; safeEl.hidden = !on; save(); };

  // ---- thumbnails and exports: the same lines painted with drawSubtitleToCanvas -----------------------------------
  const styleObj = () => ({ preset: st.style, size: st.size, ...(st.bg != null ? { bgOpacity: st.bg } : {}) });
  api.overlayKey = (node, shot) => { const l = st.captions ? api.lineFor(shot.id) : null; return l ? JSON.stringify([st.style, st.size, st.bg, st.labels, l.id, l.text, l.characterId, l.parenthetical, Object.values(charMap()).map((c) => c.name).join()]) : ""; };
  function draw(ctx, w, h, line, progress, inst, cam, label = st.labels) {
    const anchor = st.style === "bubble" && inst && cam ? stage.headScreen(inst, cam, line.characterId, w, h) : null;
    return SUBS.drawSubtitleToCanvas(ctx, line, styleObj(), w, h, { characters: charMap(), progress, anchor: anchor || undefined, label });
  }
  api.paint = (ctx, w, h, shot, inst, cam) => { const l = st.captions ? api.lineFor(shot.id) : null; if (l) draw(ctx, w, h, l, 1, inst, cam); };
  // burn the line active at a global frame into an export canvas
  api.burn = (cv, frame, inst, cam) => { const a = api.activeAt(frame); if (!a) return false; draw(cv.getContext("2d"), cv.width, cv.height, a.line, a.progress, inst, cam); return true; };

  // ---- reading speed: lengthen shots whose dialogue reads too fast -----------------------------------------------
  api.autoExtendShots = () => {
    const need = new Map();
    for (const l of api.lines) {
      if (l.kind !== "dialogue" || !l.shot || l.t0 != null || l.startMs == null) continue;
      const one = SUBS.autoExtend([{ ...l, startMs: 0, endMs: l.durationMs }], { fps: store.p.fps }).lines[0];
      const shot = store.d.seq.find((x) => x.shot.id === l.shot), shotMs = shot ? (shot.len / store.p.fps) * 1000 : 0, frac = shotMs ? l.durationMs / shotMs : 1; // lines share the shot in proportion to their words
      need.set(l.shot, Math.max(need.get(l.shot) || 0, Math.max(one.durationMs, l.durationMs) / Math.max(0.05, frac)));
    }
    let n = 0; const fps = store.p.fps;
    store.update((p) => { for (const nd of p.nodes) for (const s of nd.shots) { const ms = need.get(s.id); if (!ms) continue; const f = Math.ceil((ms / 1000) * fps); if (f > s.len) { s.len = f; n++; } } });
    if (n) store.commit(); announce(n ? `Lengthened ${n} shot${n > 1 ? "s" : ""} so the dialogue reads comfortably. Undo restores them.` : "Every dialogue line already reads at a comfortable speed.");
    return n;
  };
  store.on((scope) => { if (scope === "sel" || scope === "move" || scope === "history") return; clearTimeout(api._t); api._t = setTimeout(() => api.rebuild(), 20); });
  api.rebuild();
  return api;
}
