// captions.js: live captions for a talking chat character. Glue between voice.js and subtitles/subtitles.js (that folder is not edited).
//
//   import { createCaptions } from "./captions.js";
//   const cap = createCaptions(stageEl, { characterId: "kamikin-pip", name: "Pip", lang: "en", onTalking: (e) => avatar.setMouth(e.amplitude) });
//   voice.onboundary = cap.boundary;                         // word boundaries from the system voice
//   voice.onstart = (info) => { cap.started(info); ... };    // info.engine "system" | anything else (server voice)
//   voice.onend = () => { cap.end(); ... };
//   cap.begin({ text: replyText, rate: 1 });                 // BEFORE voice.speak(replyText)
//   mountVoiceSettings(slot, voice, { captions: cap });      // Captions section in the voice panel; a header button can use cap.set/subscribe
//
// - Only the character's own speech is captioned. Nothing is shown unless speech is playing, so text-only visitors never see captions.
// - Words follow speechSynthesis boundary events. If none arrive (believed: Chrome network "Google" voices, most Android/Chrome voices; Safari, Firefox and Chrome desktop with local voices send them; unverified here) or the better voice is used,
//   the highlight is advanced from estimated word times, with no errors.
// - Mouth: `onTalking` is called ONLY while real boundary events drive the line (amplitude per syllable, closed between words).
//   `drivesMouth()` tells the host to ignore voice.onmouth meanwhile, so the two never fight. Otherwise voice.js' own mouth runs as before.
// - The stage is aria-hidden and the module's screen-reader mirror is off: the chat log is already aria-live, so nothing is announced twice.
// - subtitles.js is loaded on first use (dynamic import), so pages that never open the chat do not pay for it.
// - Settings (on, size, background opacity) live in localStorage["kamiji.chat.captions.v1"] (try/catch); the default is ON.

import { cleanForSpeech } from "./voice.js";

const KEY = "kamiji.chat.captions.v1";
const DEFAULT_BG = 0.72; // karaoke/boxed default background opacity in subtitles.css
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const read = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } };
const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode */ } };
let seq = 0;

export function createCaptions(stage, { characterId = "agent", name = "", lang = "en", style = "karaoke", onTalking } = {}) {
  const saved = read();
  const prefs = {
    captions: saved.captions !== false,                                   // default ON (shown only while speech plays)
    size: clamp(+saved.size || 1, 0.6, 2.2),
    bgOpacity: saved.bgOpacity == null ? null : clamp(+saved.bgOpacity, 0.3, 1),
    labels: "off",                                                         // one speaker: the chat header already names it
  };
  const subs$ = new Set();
  let subs = null, loading = null, cur = null, who = { id: characterId, name };

  stage.setAttribute("aria-hidden", "true");
  const persist = () => write({ ...prefs });
  const view = () => ({ captions: prefs.captions, size: prefs.size, bgOpacity: prefs.bgOpacity, bg: prefs.bgOpacity ?? DEFAULT_BG });
  const notify = () => subs$.forEach((f) => { try { f(view()); } catch { /* ignore */ } });

  function load() {
    if (subs) return Promise.resolve(subs);
    if (!loading) {
      loading = import("./subtitles/subtitles.js").then((m) => {
        api.mod = m;
        subs = m.createSubtitles(stage, { style, language: lang, a11y: "off", speakerLabels: "off", maxStack: 1, storageKey: KEY + ".module", characters: { [who.id]: { name: who.name } } });
        subs.setSize(prefs.size); subs.setCaptions(prefs.captions);
        if (prefs.bgOpacity != null) subs.setBackgroundOpacity(prefs.bgOpacity);
        subs.on("talking", (e) => {
          if (!cur || !cur.got || e.line?.id !== cur.id) return;
          try { onTalking?.(e); } catch { /* ignore */ }
        });
        return subs;
      }).catch((err) => { loading = null; console.warn("captions: subtitles module not loaded", err); return null; });
    }
    return loading;
  }

  function stopEstimate(c) { if (c) { clearInterval(c.iv); clearTimeout(c.wait); c.iv = c.wait = 0; } }
  function startEstimate(c) {
    if (c.ended || c.got || c.iv || !api.mod) return;
    const { estimateWordTimes, estimateDurationMs, wordIndexAt } = api.mod;
    const words = estimateWordTimes(c.text, estimateDurationMs(c.text, lang) / (c.rate || 1), { lang });
    const t0 = c.t0 || performance.now();
    c.iv = setInterval(() => { if (c.ended || c.got) return stopEstimate(c); c.h.advance(wordIndexAt(words, performance.now() - t0)); }, 60);
  }

  const api = {
    mod: null,
    /** Visible-caption settings for UIs: {captions, size, bgOpacity (null = style default), bg (effective 0..1)}. */
    get settings() { return view(); },
    set(patch = {}) {
      if ("captions" in patch) prefs.captions = !!patch.captions;
      if ("size" in patch) prefs.size = clamp(+patch.size || 1, 0.6, 2.2);
      if ("bgOpacity" in patch) prefs.bgOpacity = patch.bgOpacity == null ? null : clamp(+patch.bgOpacity, 0.3, 1);
      persist();
      if (subs) { subs.setCaptions(prefs.captions); subs.setSize(prefs.size); subs.setBackgroundOpacity(prefs.bgOpacity); }
      else if (prefs.captions) load();
      if (!prefs.captions) api.end();
      notify();
    },
    reset() { api.set({ captions: true, size: 1, bgOpacity: null }); },
    subscribe(fn) { subs$.add(fn); return () => subs$.delete(fn); },
    /** Loads the module ahead of the first line (call when the chat opens). */
    preload() { if (prefs.captions) load(); },
    setCharacter(id, nm) { who = { id: id || who.id, name: nm || who.name }; subs?.setCharacters({ [who.id]: { name: who.name } }); },
    /** Call right before voice.speak(text). `rate` = how fast the voice talks (1 = normal) for the estimated fallback. */
    begin({ text, rate = 1, lang: l } = {}) {
      api.end();
      if (!prefs.captions) return null;
      if (!subs) { load(); return null; }                                  // first line while the module loads: no caption for it
      const t = cleanForSpeech(text).replace(/\[/g, "(").replace(/\]/g, ")"); // "[...]" would be an SFX caption; same length, so charIndex still lines up
      if (!t) return null;
      const id = "live" + ++seq;
      const h = subs.beginLive({ id, characterId: who.id, text: t, spokenText: t, lang: l || lang });
      cur = { id, h, text: t, rate, got: 0, ended: false, iv: 0, wait: 0, t0: 0 };
      return h;
    },
    /** voice.onboundary: {charIndex, length, name} */
    boundary(e) {
      const c = cur; if (!c || c.ended) return;
      if (e && e.name && e.name !== "word") return;
      c.got++; stopEstimate(c);
      try { c.h.boundary(e); } catch { /* ignore */ }
    },
    /** voice.onstart: {engine}. The server voice sends no boundaries: estimate right away; the system voice gets 700 ms to prove it sends some. */
    started(info) {
      const c = cur; if (!c || c.ended) return;
      c.t0 = performance.now();
      if (info && info.engine && info.engine !== "system") startEstimate(c);
      else c.wait = setTimeout(() => startEstimate(c), 700);
    },
    /** voice.onend, or any time the speech is cut. Safe to call twice. */
    end() {
      const c = cur; if (!c) return;
      cur = null; c.ended = true; stopEstimate(c);
      try { c.h.end(); } catch { /* ignore */ }
    },
    /** True while real boundary events drive the current line: the host should take the mouth from onTalking, not from voice.onmouth. */
    drivesMouth() { return !!(cur && cur.got && !cur.ended); },
    /** Test/debug hook. */
    get live() { return cur ? { id: cur.id, boundaries: cur.got, estimating: !!cur.iv } : null; },
    destroy() { api.end(); subs?.destroy(); subs = null; subs$.clear(); },
  };
  return api;
}
