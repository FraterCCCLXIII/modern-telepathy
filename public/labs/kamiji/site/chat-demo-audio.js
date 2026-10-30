// Sound (spoken replies) and Mic (level meter, optional browser speech recognition) for the chat demo.
// Reuses site/voice.js (system voice by default; the local Kamiji voice server on 127.0.0.1:4650 when chosen) and
// site/captions.js (karaoke captions) exactly as the site chat does, and their storage keys, so settings are shared.
// Nothing here talks to a non-local host. Nothing starts without a click.
import { createVoice, settings as vset } from "./voice.js";
import { createCaptions } from "./captions.js";

export const KAMIJI_VOICE = "qwen:girl-teen/happy@2~tone=bright"; // recommended default in tools/voice-server/VERIFY.md (unlistened)
export const START_CMD = "tools/voice-server/run.sh start";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createAudio(h) {
  // h: { store, capsStage, setOpen(bool), restore(), notify(text), onMicChange(active) }
  const S = { voice: null, caps: null, started: false, warm: false, mic: null, noticed: new Set() };
  let lastOpen = false, lastAt = 0;
  const notice = (key, text) => { if (!S.noticed.has(key)) { S.noticed.add(key); h.notify(text); } };
  const mouth = (o) => { // the hand has no mouth-level API: coarse open/close through two expressions, at most ~8 changes per second
    const now = performance.now(), open = o > 0.3;
    if (open === lastOpen || now - lastAt < 120) return;
    lastOpen = open; lastAt = now; h.setOpen(open);
  };
  function ensure() {
    if (S.voice) return;
    S.caps = createCaptions(h.capsStage, { characterId: "kamiji-hand", name: "Kamiji", lang: "en", onTalking: (e) => mouth(e.speaking ? (reduced() ? (e.amplitude > 0.15 ? 0.5 : 0) : e.amplitude) : 0) });
    S.voice = createVoice({
      lang: "en", characterId: "kamiji-hand",
      onstart: (info) => { S.started = true; S.caps.started(info); h.onStart?.(info); },
      onend: () => { S.caps.end(); lastOpen = false; h.restore(); },
      onboundary: (e) => S.caps.boundary(e),
      onmouth: (o) => { if (!S.caps.drivesMouth()) mouth(o); },
      onstatus: (m) => notice(m, m),
    });
    S.caps.preload();
  }
  const api = {
    get voice() { return S.voice; }, get caps() { return S.caps; },
    ensure,
    /** true when a reply would be spoken right now */
    willSpeak: () => h.store.get("sound") && !S.mic && (navigator.userActivation?.hasBeenActive ?? true),
    needsGesture: () => h.store.get("sound") && navigator.userActivation && !navigator.userActivation.hasBeenActive,
    stop() { try { S.voice?.stop(); } catch { /* ignore */ } S.caps?.end(); h.restore(); },
    // Speak one reply. Falls back to the system voice when the Kamiji voice is slow (20 s the first time while the model loads, 8 s after).
    async speak(text, { onStart, force } = {}) {
      if (!force && !api.willSpeak()) return null;
      ensure();
      S.started = false; let fired = false;
      const fire = () => { if (!fired) { fired = true; onStart?.(); } };
      h.onStart = fire;
      S.caps.begin({ text, rate: vset.values.mode === "better" ? vset.values.speed : vset.values.rate });
      const better = vset.values.mode === "better";
      let timer = 0;
      if (better) {
        if (!S.warm) notice("warm", "Kamiji voice is warming up: the first line can take about 15 seconds.");
        timer = setTimeout(() => {
          if (S.started) return;
          S.voice.stop(); notice("slow", "Kamiji voice was too slow, using the system voice.");
          S.caps.begin({ text, rate: vset.values.rate });
          S.voice.speak(text, { settings: { mode: "system" } }).catch(() => {});
        }, S.warm ? 8000 : 20000);
      }
      try { const r = await S.voice.speak(text); if (r?.engine && r.engine !== "system") S.warm = true; return r; }
      finally { clearTimeout(timer); fire(); }
    },
  };

  // ---------- microphone ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  api.sttAvailable = !!SR;
  api.mic = {
    get active() { return !!S.mic; },
    async start({ onLevel, onText, onState, max = 10 }) {
      if (S.mic) return;
      api.stop();
      if (!navigator.mediaDevices?.getUserMedia) { onState("error", "This browser cannot use a microphone here."); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { onState("error", e && e.name === "NotFoundError" ? "No microphone found. You can still type." : "Microphone blocked or unavailable. You can still type."); return; }
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
      const data = new Float32Array(an.fftSize), t0 = performance.now();
      const m = S.mic = { stream, ac, raf: 0, iv: 0, rec: null, stopped: false };
      let lastTick = 0, left = max;
      const loop = (ts) => {
        if (m.stopped) return; m.raf = requestAnimationFrame(loop);
        if (ts - lastTick < (reduced() ? 200 : 33)) return; lastTick = ts; // 30 fps (5 per second when reduced: a static bar, not an animation)
        an.getFloatTimeDomainData(data); let s = 0; for (const x of data) s += x * x;
        onLevel(Math.min(1, Math.sqrt(s / data.length) * 5));
      };
      m.raf = requestAnimationFrame(loop);
      m.iv = setInterval(() => { left = Math.max(0, Math.ceil(max - (performance.now() - t0) / 1000)); onState("listening", `Listening, ${left} s left. Audio stays in your browser.`); if (left <= 0) api.mic.stop(onState); }, 1000);
      m.onState = onState;
      if (h.store.get("useSTT") && SR) {
        try {
          const r = new SR(); r.lang = "en-US"; r.interimResults = true; r.continuous = false;
          r.onresult = (e) => onText([...e.results].map((x) => x[0].transcript).join(" "));
          r.onerror = () => {}; m.rec = r; r.start();
        } catch { /* no recognition */ }
      }
      onState("listening", `Listening, ${max} s left. Audio stays in your browser.`);
      h.onMicChange?.(true);
    },
    stop(onState) {
      const m = S.mic; if (!m) return; S.mic = null; m.stopped = true;
      cancelAnimationFrame(m.raf); clearInterval(m.iv);
      try { m.rec?.stop(); } catch { /* ignore */ }
      m.stream.getTracks().forEach((t) => t.stop()); try { m.ac.close(); } catch { /* ignore */ }
      (onState || m.onState)?.("stopped", "Microphone stopped.");
      h.onMicChange?.(false);
    },
  };
  return api;
}
