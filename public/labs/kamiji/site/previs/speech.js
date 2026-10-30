// Previs audio: speaks each dialogue line with its character's voice, locked to the playhead.
//  - voices come from site/voice.js (local Qwen / Kokoro server on 127.0.0.1:4650 when it is up, the browser's system voices otherwise)
//  - the per-character choice lives in project.script.voices[charId] = { voice, speed, shift }, so it is saved, undoable and exported
//  - Audio is OFF until the user turns it on (that click is the user gesture browsers need); the on/off state is remembered
//  - pause, stop, seek and loop wrap cancel speech; the line a bubble shows is the line being spoken, because both read the same timeline
import { createVoice, settings as voiceSettings } from "../voice.js";
import { clamp } from "./ui.js";

export const DEFAULT_VOICE = Object.freeze({ voice: "", speed: 1, shift: 0 });
const KOKORO = ["kokoro:af_heart", "kokoro:af_bella", "kokoro:af_sky", "kokoro:af_nicole"];
const SERVER_HELP = "tools/voice-server/run.sh start";
const SAMPLE = (name) => `Hello, I'm ${name}. This is my voice.`;

export function voiceLabel(id) {
  if (!id) return "Auto";
  const [kind, name = ""] = id.split(/:(.*)/s);
  const nice = name.replace(/[-_]/g, " ");
  return kind === "system" ? nice : `${kind === "qwen" ? "Qwen" : kind === "kokoro" ? "Kokoro" : kind} ${nice}`;
}

export function createPrevisSpeech({ store, transport, subs, pref, announce, charName }) {
  const st = { on: pref.get("audio") === "1" };
  const cat = { checked: false, server: false, qwen: [], kokoro: [], system: [] };
  const api = { st, cat, log: [], notice: { text: "", warn: false } };
  const listeners = new Set();
  api.onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = (what) => listeners.forEach((f) => f(what));
  const probe = createVoice({ lang: "en", characterId: "probe" });
  const instances = new Map();
  let active = null, lastFrame = -1, spokenId = null;
  const note = (kind, extra = {}) => { api.log.push({ kind, t: Math.round(performance.now()), ...extra }); if (api.log.length > 200) api.log.shift(); };

  // ---- the voices that exist right now ----------------------------------------------------------------------
  api.refresh = async (force = false) => {
    let r = null;
    try { r = await probe.available(force); } catch (e) { /* offline */ }
    cat.checked = true; cat.server = !!r?.better;
    cat.qwen = r?.better ? (r.voices || []).filter((v) => v.startsWith("qwen:")) : [];
    cat.kokoro = r?.better && r.kokoro ? KOKORO : [];
    cat.system = probe.systemVoices().map((v) => "system:" + v.name);
    api.setNotice(); emit("catalog");
    return cat;
  };
  api.options = () => ({ qwen: cat.qwen, kokoro: cat.kokoro, system: cat.system });

  // ---- per-character settings (project.script.voices) -----------------------------------------------------------
  api.voiceOf = (charId) => ({ ...DEFAULT_VOICE, ...(store.p.script.voices?.[charId] || {}) });
  api.setVoice = (charId, patch, { commit = true } = {}) => {
    const cur = api.voiceOf(charId), next = { ...cur, ...patch };
    next.speed = clamp(+next.speed || 1, 0.6, 1.5); next.shift = clamp(Math.round(+next.shift || 0), -6, 8);
    store.update((p) => { p.script.voices ||= {}; p.script.voices[charId] = next; }, "script");
    if (commit) store.commit();
    emit("voice");
  };
  api.chipText = (charId) => voiceLabel(api.voiceOf(charId).voice);

  // ---- speaking -------------------------------------------------------------------------------------------
  const voiceFor = (cid) => {
    if (!instances.has(cid)) {
      instances.set(cid, createVoice({
        lang: "en", characterId: cid,
        onstatus: (m) => { note("status", { msg: m }); api.setNotice(m, true); },
        onstart: (e) => { note("start", { cid, engine: e.engine, voice: e.voice }); active && (active.engine = e.engine); api.setNotice(`Speaking as ${charName(cid)}: ${e.engine === "system" ? "system voice " : ""}${e.voice}`, false, true); },
        onend: (e) => { note("end", { cid, engine: e.engine, reason: e.reason, fellBack: !!e.fellBack }); if (active?.cid === cid) active = null; if (e.reason === "done") api.setNotice(); },
      }));
    }
    return instances.get(cid);
  };
  const optsFor = (cid) => {
    const v = api.voiceOf(cid), base = voiceSettings.values;
    const pitch = clamp(base.pitch * 2 ** (v.shift / 12), 0, 2), rate = clamp(base.rate * v.speed, 0.5, 2);
    if (v.voice.startsWith("system:")) return { settings: { mode: "system", voiceName: v.voice.slice(7), pitch, rate } };
    // auto and server voices: use the server when it answers; voice.js falls back to the system voice by itself when it does not
    return { settings: { mode: v.voice || cat.server ? "better" : "system", betterVoice: v.voice || "auto", speed: v.speed, shift: v.shift, pitch, rate } };
  };
  api.stopSpeech = () => { const a = active; active = null; if (a) { try { a.v.stop(); } catch (e) { /* ignore */ } note("stop", { cid: a.cid }); } };
  async function speak(cid, text, lineId) {
    api.stopSpeech();
    const v = voiceFor(cid); active = { cid, v, lineId, engine: "" };
    note("speak", { cid, lineId, text: String(text).slice(0, 60), opts: optsFor(cid).settings });
    try { await v.speak(text, optsFor(cid)); } catch (e) { note("error", { msg: String(e?.message || e) }); api.setNotice("Speech failed: " + (e?.message || e), true); }
  }
  api.stopPreview = () => { if (active?.lineId === "preview") api.stopSpeech(); };
  api.preview = (cid) => { spokenId = null; return speak(cid, SAMPLE(charName(cid)), "preview"); };

  // ---- Audio on / off ----------------------------------------------------------------------------------------
  api.setOn = async (on) => {
    st.on = !!on; pref.set("audio", on ? "1" : "0"); emit("on");
    if (!on) { api.stopSpeech(); spokenId = null; api.setNotice(); announce("Audio off", { line: false }); return; }
    try { const u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* no speech engine */ } // the click that turns audio on unlocks speech
    announce("Audio on", { line: false });
    await api.refresh(true);
    if (transport.playing) { spokenId = null; lastFrame = -1; onFrame(); }
  };
  api.toggle = () => api.setOn(!st.on);

  // ---- the visible notice (warnings stay on screen) ---------------------------------------------------------------
  api.setNotice = (msg, warn = false, transient = false) => {
    let text = msg, w = warn;
    if (!msg) {
      if (!st.on) { text = ""; w = false; }
      else if (!cat.checked) text = "Audio on. Checking for the voice server.";
      else if (cat.server) text = "Audio on. Voices from the local server (Qwen, Kokoro).";
      else if (cat.system.length) { text = `Audio on, but the local voice server is not running, so your system voice is used. Start it with ${SERVER_HELP}.`; w = true; }
      else { text = `Audio on, but no voice is available: the local voice server is not running and this browser has no speech voice. Start the server with ${SERVER_HELP}.`; w = true; }
    }
    if (!st.on && !/^Speaking/.test(String(msg || "")) && !warn) text = "";
    api.notice = { text, warn: w, transient }; emit("notice");
  };

  // ---- sync with the playhead -------------------------------------------------------------------------------------
  const dialogueAt = (ms) => subs.lines.find((l) => l.kind === "dialogue" && l.startMs != null && l.text && ms >= l.startMs && ms < l.startMs + l.durationMs) || null;
  function onFrame() {
    if (!st.on) return;
    if (!transport.playing) { if (spokenId != null || active) { api.stopSpeech(); spokenId = null; } lastFrame = -1; return; }
    const f = transport.frame, fps = store.p.fps;
    if (lastFrame < 0 || Math.abs(f - lastFrame) > fps * 0.5) { if (lastFrame >= 0) api.stopSpeech(); spokenId = null; } // a seek or a loop wrap
    lastFrame = f;
    const ms = (f / fps) * 1000, l = dialogueAt(ms);
    if (!l || l.id === spokenId) return;
    if ((ms - l.startMs) / l.durationMs > 0.6) return; // joined the line too late to speak it
    spokenId = l.id; speak(l.characterId, l.text, l.id);
  }
  transport.on((kind) => {
    if (kind === "state") { lastFrame = -1; spokenId = null; if (!transport.playing) api.stopSpeech(); else onFrame(); }
    else if (kind === "frame") onFrame();
  });
  addEventListener("pagehide", () => api.stopSpeech());
  api.refresh(false).then(() => { if (st.on) api.setNotice(); });
  return api;
}
