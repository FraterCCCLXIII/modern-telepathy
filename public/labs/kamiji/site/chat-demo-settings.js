// Persisted settings for the chat demo (one JSON blob in localStorage, always inside try/catch).
// Voice and caption settings are NOT kept here: they use the site chat's own stores (voice.js, captions.js) so they are shared.
const KEY = "kamiji.chatdemo.settings.v1";
export const DEFAULTS = Object.freeze({
  style: "centred", conversation: 0,
  tint: "#ffd23f", shape: "hand", zoom: 1, clip: "", expression: "",   // Body / Face (expression "" = driven by the conversation)
  reactions: true, intensity: 1, wander: true, speed: 1, showWhy: false,  // Motion / Conversation
  sound: false, useSTT: false, bg: "paper",                               // Voice / Layout
});
let values = { ...DEFAULTS };
try { Object.assign(values, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* private mode */ }
const subs = new Set();
export const store = {
  get: (k) => values[k],
  all: () => ({ ...values }),
  set(k, v) {
    values = { ...values, [k]: v };
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* blocked */ }
    subs.forEach((f) => { try { f(k, v); } catch { /* ignore */ } });
  },
  reset() { const keys = Object.keys(DEFAULTS); keys.forEach((k) => store.set(k, DEFAULTS[k])); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};
