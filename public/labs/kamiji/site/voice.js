// voice.js: one small voice layer for the whole site. Plain ES module, no dependencies, no build step.
//
//   import { createVoice } from "./voice.js";
//   const voice = createVoice({ lang: "en", characterId: "mochi-3" });
//   voice.onmouth = (open, viseme) => avatar.setMouth(open);          // 0..1, for lip sync
//   await voice.speak("Hello! Shall we play?");                       // call from a click/key, never on load
//   voice.stop();
//
// Order of preference (see docs/voice.md in the report):
//   1. DEFAULT: the browser's SYSTEM voice (speechSynthesis), made cute by controls browsers do not normally surface:
//      a "cute" macro (pitch + rate together), per-clause pitch wobble, breaths between clauses, an optional question lilt.
//   2. UPGRADE: the local better-voice server (tools/voice-server/run.sh, http://127.0.0.1:4650): Qwen3-TTS first, Kokoro next.
//      Used only when the user picked "Better voice" in settings AND a probe (1.5 s abort) finds the server. If the server is
//      down or a request fails, it falls back to the system voice quietly (onstatus says why; nothing is thrown at the user).
// Never autoplays: speak() only does something when called. Every setting is kept in localStorage (try/catch, optional).

const LS_KEY = "kamiji.voice.settings.v1";
const SERVER_DEFAULT = "http://127.0.0.1:4650";

/** Defaults. "cute" 0..1 is a macro: pitch = 1 + .5*cute, rate = .95 + .15*cute (0.7 gives pitch 1.35, rate 1.055). */
export const DEFAULTS = Object.freeze({
  mode: "system",          // "system" (default) | "better"
  voiceName: "",           // system voice name; "" = cutest available for the language
  cute: 0.7, pitch: 1.35, rate: 1.05, volume: 1,
  wobble: 0.5,             // 0..1 per-clause pitch variation (a little, so it sounds alive)
  breaths: true,           // short pauses between clauses and sentences
  lilt: false,             // experimental: the last word of a question is spoken a little higher (re-queues one utterance)
  // better-voice path
  betterVoice: "auto",     // "auto" | "qwen:girl-teen" | "kokoro:af_heart" ...
  speed: 1, mood: "neutral", shift: 0, // Qwen: speed, mood (neutral|happy|sad|scared|angry), pitch+size shift in semitones
  server: SERVER_DEFAULT,
});
const LIMITS = { cute: [0, 1], pitch: [0, 2], rate: [0.5, 2], volume: [0, 1], wobble: [0, 1], speed: [0.6, 1.5], shift: [-6, 8] };
const MOODS = ["neutral", "happy", "sad", "scared", "angry"];

// ---- settings: one shared store for every createVoice() and the settings panel on a page ----
const listeners = new Set();
let values = { ...DEFAULTS };
try { Object.assign(values, JSON.parse(localStorage.getItem(LS_KEY) || "{}")); } catch { /* private mode etc. */ }
const clean = (k, v) => {
  if (!(k in DEFAULTS)) return undefined;
  if (LIMITS[k]) { const n = Number(v); return Number.isFinite(n) ? Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], n)) : DEFAULTS[k]; }
  if (typeof DEFAULTS[k] === "boolean") return !!v;
  if (k === "mode") return v === "better" ? "better" : "system";
  if (k === "mood") return MOODS.includes(v) ? v : "neutral";
  return String(v ?? "");
};
export const settings = {
  get values() { return { ...values }; },
  /** change settings; setting "cute" also moves pitch and rate (the macro), setting pitch/rate alone does not move "cute" */
  set(patch) {
    const next = { ...values };
    for (const [k, raw] of Object.entries(patch)) {
      const v = clean(k, raw); if (v === undefined) continue;
      next[k] = v;
      if (k === "cute" && !("pitch" in patch)) next.pitch = +(1 + 0.5 * v).toFixed(2);
      if (k === "cute" && !("rate" in patch)) next.rate = +(0.95 + 0.15 * v).toFixed(2);
    }
    values = next;
    try { localStorage.setItem(LS_KEY, JSON.stringify(values)); } catch { /* ignore */ }
    listeners.forEach((f) => { try { f(this.values); } catch { /* ignore */ } });
  },
  reset() { this.set({ ...DEFAULTS }); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
try { addEventListener("storage", (e) => { if (e.key === LS_KEY && e.newValue) { try { values = { ...DEFAULTS, ...JSON.parse(e.newValue) }; listeners.forEach((f) => f(settings.values)); } catch { /* ignore */ } } }); } catch { /* no window */ }

// ---- small helpers ----
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hasJa = (t) => /[぀-ヿ㐀-鿿]/.test(t);
const ssAvailable = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/** Make text fit for a voice: no markdown, links, code or emoji (they get read out loud as nonsense). */
export function cleanForSpeech(t) {
  return String(t)
    .replace(/```[\s\S]*?```/g, " ").replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>~|]+/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}‍]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

/** Clauses: [{text, end: ",", "." "?" "!" or ""}]; sentences and commas are where breaths and pitch changes go. */
export function splitClauses(text) {
  const out = [];
  for (const m of text.matchAll(/[^.!?。！？…,、，;；:：]+[.!?。！？…,、，;；:：]*\s*/g)) {
    const s = m[0].trim(); if (!s) continue;
    const end = (s.match(/[.!?。！？…,、，;；:：]+$/) || [""])[0].slice(-1);
    const q = /[?？]/.test(end) ? "?" : /[!！]/.test(end) ? "!" : /[,、，;；:：]/.test(end) ? "," : /[.。…]/.test(end) ? "." : "";
    if (out.length && s.replace(/[.!?。！？…,、，;；:：\s]/g, "").length < 2) out[out.length - 1].text += " " + s; // lone punctuation sticks to the clause before
    else out.push({ text: s, end: q });
  }
  return out;
}

// Cutest-first name lists; matched as a case-insensitive prefix of the voice name. macOS voices on this Mac were checked with `say -v '?'`.
const CUTE = {
  en: ["flo", "samantha", "sandy", "shelley", "kathy", "karen", "tessa", "moira", "fiona", "google uk english female", "microsoft aria", "microsoft jenny", "microsoft zira", "google us english", "junior", "fred"],
  ja: ["kyoko", "o-ren", "microsoft nanami", "microsoft haruka", "google 日本語", "flo", "sandy", "shelley"],
};
/** Voices for a language ("en", "ja"), best first: enhanced/premium builds and the CUTE list before the rest. */
export function systemVoices(lang = "en") {
  if (!ssAvailable()) return [];
  const pre = lang.slice(0, 2).toLowerCase(), order = CUTE[pre] || [];
  const list = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(pre));
  const score = (v) => {
    const n = v.name.toLowerCase(), i = order.findIndex((p) => n.startsWith(p));
    return (i < 0 ? 100 : i) - (/premium|enhanced|neural|natural/.test(n) ? 3 : 0) + (v.localService ? 0 : 0.5);
  };
  return list.sort((a, b) => score(a) - score(b));
}

const VISEME_OPEN = { aa: 0.95, oh: 0.65, ou: 0.4, ee: 0.5, e: 0.5, ih: 0.4, fv: 0.18, ff: 0.18, mbp: 0, pp: 0, sil: 0 };
const QWEN_BASES = ["girl-child", "girl-teen", "woman", "boy-child", "boy-teen", "trickster"]; // cute-leaning library voices, picked by character
const KOKORO = { en: ["af_heart", "af_bella", "af_sky", "af_nicole"], ja: ["jf_alpha", "jf_tebukuro", "jf_nezumi", "jf_gongitsune"] };

export function createVoice({ lang = "en", characterId = "", onmouth, onstart, onend, onboundary, onstatus } = {}) {
  const v = { settings, onmouth, onstart, onend, onboundary, onstatus };
  let token = 0, timers = new Map(), ctx = null, src = null, abort = null, raf = 0, speaking = false;
  let downUntil = 0, probeCache = null;
  const wait = (ms) => new Promise((r) => { const t = setTimeout(() => { timers.delete(t); r(); }, ms); timers.set(t, r); }); // stop() resolves pending waits
  const say = (msg) => { try { v.onstatus?.(msg); } catch { /* ignore */ } };
  const mouth = (o, vis) => { try { v.onmouth?.(Math.max(0, Math.min(1, o)), vis); } catch { /* ignore */ } };
  const seedOf = (text) => hash(characterId + "|" + text);

  // ---- 1. system voice ----
  function pickSystemVoice(l) {
    const list = systemVoices(l), want = settings.values.voiceName;
    return list.find((x) => x.name === want) || list[0] || null; // null: the browser default for lang
  }
  /** The plan for a line: clauses with their own pitch/rate and the gap after them. Seeded, so a line always sounds the same. */
  function plan(text, s) {
    const rand = rng(seedOf(text)), who = ((hash(characterId) % 100) / 100 - 0.5) * 0.12; // a character's own small pitch offset
    const out = [];
    for (const c of splitClauses(text)) {
      const wob = 1 + (rand() - 0.5) * 0.2 * s.wobble;                        // up to +-10% at full wobble, a lively voice
      let pitch = s.pitch * wob * (1 + who * (characterId ? 1 : 0)), rate = s.rate * (1 + (rand() - 0.5) * 0.06 * s.wobble);
      if (c.end === "!") { pitch *= 1 + 0.05 * s.wobble; rate *= 1.03; }
      const gap = !s.breaths ? 0 : c.end === "," ? 130 : c.end ? 260 : 0;
      const words = c.text.split(/\s+/);
      if (s.lilt && c.end === "?" && words.length >= 3) {                      // question lilt: the last word alone, higher
        const last = words.pop();
        out.push({ text: words.join(" "), pitch, rate, gap: 0 }, { text: last, pitch: pitch * 1.18, rate: rate * 0.95, gap });
      } else out.push({ text: c.text, pitch, rate, gap });
    }
    return out;
  }
  function utter(chunk, offset, s, l, my) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(chunk.text), voice = pickSystemVoice(l);
      u.lang = l === "ja" ? "ja-JP" : (voice?.lang || "en-US"); if (voice) u.voice = voice;
      u.pitch = Math.min(2, Math.max(0, chunk.pitch)); u.rate = Math.min(2, Math.max(0.5, chunk.rate)); u.volume = s.volume;
      let pulse = 0, done = false;
      const finish = () => { if (!done) { done = true; cancelAnimationFrame(raf); resolve(); } };
      u.onboundary = (e) => {
        if (my !== token) return;
        pulse = 1;
        try { v.onboundary?.({ charIndex: offset + e.charIndex, length: e.charLength, name: e.name }); } catch { /* ignore */ }
      };
      u.onend = u.onerror = finish;
      u.onstart = () => {
        const tick = () => { // mouth: a pulse on each word boundary, decaying, plus a small base wiggle so voices without boundary events still move
          if (done || my !== token) return;
          pulse *= 0.86; mouth(0.12 + 0.55 * pulse + (reduceMotion() ? 0 : 0.18 * Math.abs(Math.sin(performance.now() / 95))));
          raf = requestAnimationFrame(tick);
        };
        tick();
      };
      // watchdog: some browsers never fire onend (e.g. a voice removed mid-speech)
      wait(3000 + (chunk.text.length * 110) / u.rate).then(finish);
      try { speechSynthesis.speak(u); } catch { finish(); }
    });
  }
  async function speakSystem(text, s, l, my) {
    if (!ssAvailable()) { say("This browser has no speech voice."); return; }
    let offset = 0;
    for (const chunk of plan(text, s)) {
      if (my !== token) return;
      const at = text.indexOf(chunk.text, offset); if (at >= 0) offset = at;
      await utter(chunk, offset, s, l, my);
      offset += chunk.text.length;
      if (chunk.gap && my === token) { mouth(0); await wait(chunk.gap); }
    }
    mouth(0);
  }

  // ---- 2. better voice (local server: Qwen3-TTS, then Kokoro) ----
  const base = () => settings.values.server.replace(/\/+$/, "");
  const fetchT = async (url, opt = {}, ms = 1500) => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, { ...opt, signal: opt.signal ? anySignal([opt.signal, ac.signal]) : ac.signal }); } finally { clearTimeout(t); }
  };
  const anySignal = (list) => { const ac = new AbortController(); list.forEach((x) => x.aborted ? ac.abort() : x.addEventListener("abort", () => ac.abort())); return ac.signal; };

  /** Probe the server (1.5 s abort, cached 30 s). Resolves {ok, qwen, kokoro, g2p, voices} and never rejects. */
  async function probe(force) {
    if (!force && probeCache && Date.now() - probeCache.at < 30000) return probeCache.r;
    let r = { ok: false, qwen: false, kokoro: false, g2p: false, voices: [] };
    try {
      const res = await fetchT(base() + "/", {}, 1500);
      const j = await res.json();
      r = { ok: j.status === "ready", qwen: !!j.library, kokoro: (j.engines || []).includes("kokoro"), g2p: false, voices: [] };
      try { const vj = await (await fetchT(base() + "/v1/voices", {}, 4000)).json(); r.voices = vj.voices || []; r.g2p = !!vj.g2p; } catch { /* list is a bonus */ }
    } catch { /* down */ }
    probeCache = { at: Date.now(), r }; if (r.ok) downUntil = 0;
    return r;
  }
  /** Voice strings to try for a line, best first: the chosen/auto Qwen voice, then a Kokoro voice. */
  function betterChain(l, s) {
    const pick = (a) => a[hash(characterId) % a.length], chain = [];
    const suffix = (s.mood !== "neutral" ? "/" + s.mood : "") + (s.shift ? "@" + s.shift : "");
    const chosen = s.betterVoice;
    if (chosen.startsWith("kokoro:")) chain.push({ voice: chosen, engine: "kokoro" });
    else {
      const q = chosen.startsWith("qwen:") ? chosen : "qwen:" + pick(QWEN_BASES);
      chain.push({ voice: /[\/@~]/.test(q) ? q : q + suffix, engine: "qwen" });
    }
    if (chain[0].engine !== "kokoro") chain.push({ voice: "kokoro:" + pick(KOKORO[l] || KOKORO.en), engine: "kokoro" });
    return chain;
  }
  async function fetchClip(text, l, s, my) {
    let lastErr;
    for (const c of betterChain(l, s)) {
      if (my !== token) throw new Error("stopped");
      try {
        const res = await fetchT(base() + "/v1/audio/speech", {
          method: "POST", headers: { "content-type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ input: text, voice: c.voice, speed: s.speed, lang: l, reading: text }),
        }, c.engine === "qwen" ? 40000 : 15000);
        if (!res.ok) throw new Error(c.voice + " " + res.status);
        let vis = null; try { vis = JSON.parse(res.headers.get("x-visemes") || "null"); } catch { /* none */ }
        return { buf: await res.arrayBuffer(), vis, engine: c.engine, voice: c.voice };
      } catch (e) { lastErr = e; if (my !== token) throw e; say(`${c.engine} voice failed (${e.message}); trying the next one`); }
    }
    throw lastErr || new Error("no voice");
  }
  function playClip(clip, s, my) {
    return new Promise(async (resolve) => {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume();
        const audio = await ctx.decodeAudioData(clip.buf.slice(0));
        if (my !== token) return resolve();
        const gain = ctx.createGain(); gain.gain.value = s.volume;
        const an = ctx.createAnalyser(); an.fftSize = 512; const data = new Float32Array(an.fftSize);
        src = ctx.createBufferSource(); src.buffer = audio; src.connect(gain); gain.connect(an); an.connect(ctx.destination);
        const t0 = ctx.currentTime + 0.02; let open = 0;
        const tick = () => {
          if (my !== token) return;
          let o;
          const t = ctx.currentTime - t0;
          if (clip.vis?.length) { const seg = clip.vis.find((x) => t >= x[1] && t < x[2]); o = seg ? VISEME_OPEN[seg[0]] ?? 0.4 : 0; mouth(o, seg?.[0]); }
          else { an.getFloatTimeDomainData(data); let sum = 0; for (const x of data) sum += x * x; o = Math.min(1, Math.sqrt(sum / data.length) * 6); open = o > open ? o : open * 0.8; mouth(open); }
          raf = requestAnimationFrame(tick);
        };
        src.onended = () => { cancelAnimationFrame(raf); mouth(0); resolve(); };
        src.start(t0); tick();
      } catch (e) { say("Could not play the better voice: " + e.message); resolve("failed"); }
    });
  }
  async function speakBetter(text, s, l, my) {
    const clauses = splitClauses(text), chunks = [];
    for (const c of clauses) { // sentences up to ~160 characters: Qwen is slow and can run on for very long lines
      const last = chunks[chunks.length - 1];
      if (last && last.length + c.text.length < 160 && !/[.!?。！？…]$/.test(last)) chunks[chunks.length - 1] = last + " " + c.text; else chunks.push(c.text);
    }
    abort = new AbortController();
    let next = fetchClip(chunks[0], l, s, my), i = 0, used = "";
    next.catch(() => {});
    for (; i < chunks.length; i++) {
      let clip; try { clip = await next; } catch (e) { if (my !== token) return used; throw Object.assign(e, { rest: chunks.slice(i).join(" "), used }); }
      if (i + 1 < chunks.length) { next = fetchClip(chunks[i + 1], l, s, my); next.catch(() => {}); } // fetch the next while this one plays
      used = clip.engine;
      if (i === 0) try { v.onstart?.({ engine: clip.engine, voice: clip.voice }); } catch { /* ignore */ }
      if (await playClip(clip, s, my) === "failed") throw Object.assign(new Error("playback"), { rest: chunks.slice(i).join(" "), used });
      if (my !== token) return used;
    }
    return used;
  }

  // ---- public ----
  v.speak = async function speak(text, opts = {}) {
    const my = ++token; hardStop(false);
    const s = { ...settings.values, ...(opts.settings || {}) }, t = cleanForSpeech(text);
    if (!t) return { engine: null };
    const l = (opts.lang || lang || (hasJa(t) ? "ja" : "en")).slice(0, 2);
    speaking = true; let engine = "system", fellBack = false, rest = t;
    if (s.mode === "better" && Date.now() >= downUntil) {
      const p = await probe();
      if (my !== token) return { engine: null };
      if (p.ok) {
        try { engine = (await speakBetter(t, s, l, my)) || "better"; rest = ""; if (my !== token) return { engine: null }; }
        catch (e) { downUntil = Date.now() + 30000; fellBack = true; rest = e.rest || t; say("Better voice unavailable, using the system voice."); }
      } else { downUntil = Date.now() + 30000; fellBack = true; say("Local voice server not found, using the system voice."); }
    } else if (s.mode === "better") { fellBack = true; }
    if (rest && my === token) {
      engine = "system";
      try { v.onstart?.({ engine, voice: pickSystemVoice(l)?.name || "default" }); } catch { /* ignore */ }
      await speakSystem(rest, s, l, my);
    }
    if (my === token) { speaking = false; mouth(0); try { v.onend?.({ engine, fellBack, reason: "done" }); } catch { /* ignore */ } }
    return { engine, fellBack };
  };
  function hardStop(report) {
    timers.forEach((r, t) => { clearTimeout(t); r(); }); timers.clear(); cancelAnimationFrame(raf);
    try { abort?.abort(); } catch { /* ignore */ } abort = null;
    try { src?.stop(); } catch { /* ignore */ } src = null;
    if (ssAvailable()) try { speechSynthesis.cancel(); } catch { /* ignore */ }
    if (report && speaking) { speaking = false; mouth(0); try { v.onend?.({ engine: null, reason: "stopped" }); } catch { /* ignore */ } }
  }
  v.stop = () => { token++; hardStop(true); };
  v.speaking = () => speaking;
  /** Resolves {system, better, qwen, kokoro, g2p, voices, systemVoices}: what can speak right now. Probes the server (cached 30 s). */
  v.available = async (force) => { const p = await probe(force); return { system: ssAvailable() && systemVoices(lang).length > 0, better: p.ok, qwen: p.qwen, kokoro: p.kokoro, g2p: p.g2p, voices: p.voices, systemVoices: systemVoices(lang).map((x) => x.name) }; };
  v.systemVoices = (l = lang) => systemVoices(l);
  if (ssAvailable()) { try { speechSynthesis.getVoices(); } catch { /* ignore */ } }
  return v;
}
