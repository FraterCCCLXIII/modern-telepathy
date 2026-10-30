// voice-settings.js: a compact, accessible voice settings panel for voice.js.
//
//   import { createVoice } from "./voice.js";
//   import { mountVoiceSettings } from "./voice-settings.js";
//   const voice = createVoice({ lang: "en" });
//   mountVoiceSettings(document.querySelector("#voice-slot"), voice, { lang: "en", sample: "Hi! I am so happy to see you." });
//   // add { inline: true } to show the panel open on the page (the voice lab does) instead of behind a button.
// Optional { captions } (a createCaptions() object from captions.js) adds a Captions section: on/off, size, background opacity.
// Needs voice-settings.css. The button opens a popover (Escape or an outside click closes it and returns focus to the button).

import { settings } from "./voice.js";

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>';
let uid = 0;
const SLIDERS = [ // [key, label, min, max, step, format, group]
  ["cute", "Cute amount", 0, 1, 0.01, (v) => Math.round(v * 100) + "%", "sys"],
  ["pitch", "Pitch", 0, 2, 0.01, (v) => v.toFixed(2), "sys"],
  ["rate", "Speed", 0.5, 2, 0.01, (v) => v.toFixed(2) + "x", "sys"],
  ["volume", "Volume", 0, 1, 0.01, (v) => Math.round(v * 100) + "%", "all"],
  ["wobble", "Pitch wobble", 0, 1, 0.01, (v) => Math.round(v * 100) + "%", "sys"],
  ["speed", "Better voice speed", 0.6, 1.5, 0.05, (v) => v.toFixed(2) + "x", "better"],
  ["shift", "Better voice pitch shift", -6, 8, 0.5, (v) => (v > 0 ? "+" : "") + v + " st", "better"],
];
const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.innerHTML = html; return e; };

export function mountVoiceSettings(host, voice, { lang = "en", sample = "Hello! I am so happy to see you today.", inline = false, label = "Voice", captions = null } = {}) {
  const id = "kv" + ++uid, wrap = el("div", { class: "kv-wrap" + (inline ? " kv-inline" : "") });
  const panel = el("div", { class: "kv-panel", id: id + "-panel", role: inline ? "group" : "dialog", "aria-label": "Voice settings" });
  let btn = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  panel.innerHTML = `
    <fieldset><legend>Voice type</legend>
      <label class="kv-radio"><input type="radio" name="${id}-mode" value="system"><span>System voice (default)<small>Your device's own voice, made cuter with the controls below.</small></span></label>
      <label class="kv-radio"><input type="radio" name="${id}-mode" value="better"><span>Better voice (needs local server)<small>Qwen3-TTS, then Kokoro, from tools/voice-server. Falls back to the system voice if it is not running.</small></span></label>
    </fieldset>
    <div class="kv-row"><label for="${id}-voice">System voice</label><output></output><select id="${id}-voice" class="kv-select" data-k="voiceName"></select></div>
    ${SLIDERS.map(([k, name, min, max, step, , g]) => `<div class="kv-row ${g === "better" ? "kv-better" : ""}"><label for="${id}-${k}">${name}</label><output id="${id}-${k}-o"></output><input id="${id}-${k}" type="range" data-k="${k}" min="${min}" max="${max}" step="${step}"></div>`).join("")}
    <label class="kv-check"><input type="checkbox" data-k="breaths"> Little breaths between clauses</label>
    <label class="kv-check"><input type="checkbox" data-k="lilt"> Question lilt (experimental)</label>
    <div class="kv-row kv-better"><label for="${id}-bv">Better voice</label><output></output><select id="${id}-bv" class="kv-select" data-k="betterVoice"><option value="auto">Auto (by character)</option></select></div>
    <div class="kv-row kv-better"><label for="${id}-mood">Mood (Qwen)</label><output></output><select id="${id}-mood" class="kv-select" data-k="mood">${["neutral", "happy", "sad", "scared", "angry"].map((m) => `<option>${m}</option>`).join("")}</select></div>
    ${captions ? `<fieldset class="kv-caps"><legend>Captions</legend>
      <label class="kv-check"><input type="checkbox" data-cap="captions"> Show captions while speaking<small class="kv-hint">Recommended: they follow the spoken words.</small></label>
      <div class="kv-row"><label for="${id}-capsize">Caption size</label><output id="${id}-capsize-o"></output><input id="${id}-capsize" type="range" data-cap="size" min="0.6" max="2.2" step="0.05"></div>
      <div class="kv-row"><label for="${id}-capbg">Caption background</label><output id="${id}-capbg-o"></output><input id="${id}-capbg" type="range" data-cap="bg" min="0.3" max="1" step="0.05"></div>
    </fieldset>` : ""}
    <div class="kv-actions"><button type="button" class="kv-act primary" data-act="test">Test voice</button><button type="button" class="kv-act" data-act="stop">Stop</button><button type="button" class="kv-act" data-act="reset">Reset</button></div>
    <p class="kv-status" role="status" aria-live="polite"><span class="kv-dot" aria-hidden="true"></span><span class="kv-msg">Checking for the local voice server...</span></p>`;

  const $ = (sel) => panel.querySelector(sel), $$ = (sel) => [...panel.querySelectorAll(sel)];
  const msg = $(".kv-msg"), dot = $(".kv-dot");

  function fillVoices() {
    const sel = $('[data-k="voiceName"]'), list = voice.systemVoices(lang);
    sel.innerHTML = `<option value="">Cutest available${list[0] ? " (" + esc(list[0].name) + ")" : ""}</option>` + list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join("");
    sel.value = settings.values.voiceName;
  }
  function sync(s = settings.values) {
    $$('input[type="radio"]').forEach((r) => (r.checked = r.value === s.mode));
    for (const [k, , , , , fmt] of SLIDERS) { $(`[data-k="${k}"]`).value = s[k]; $(`#${id}-${k}-o`).textContent = fmt(+s[k]); }
    $$('input[type="checkbox"][data-k]').forEach((c) => (c.checked = !!s[c.dataset.k]));
    $('[data-k="voiceName"]').value = s.voiceName; $('[data-k="mood"]').value = s.mood;
    if ([...$('[data-k="betterVoice"]').options].some((o) => o.value === s.betterVoice)) $('[data-k="betterVoice"]').value = s.betterVoice;
    const better = s.mode === "better";
    $$(".kv-better").forEach((r) => { r.setAttribute("aria-disabled", String(!better)); r.querySelectorAll("input,select").forEach((i) => (i.disabled = !better)); });
    $$(".kv-row").forEach((r) => { if (!r.classList.contains("kv-better")) r.style.opacity = ""; });
  }
  function syncCaps(c = captions?.settings) {
    if (!c) return;
    $('[data-cap="captions"]').checked = !!c.captions; $('[data-cap="size"]').value = c.size; $('[data-cap="bg"]').value = c.bg;
    $(`#${id}-capsize-o`).textContent = c.size.toFixed(2) + "x"; $(`#${id}-capbg-o`).textContent = Math.round(c.bg * 100) + "%";
    $$("[data-cap]").forEach((i) => i !== $('[data-cap="captions"]') && (i.disabled = !c.captions));
  }
  async function refreshStatus(force) {
    msg.textContent = "Checking for the local voice server..."; dot.className = "kv-dot";
    let a; try { a = await voice.available(force); } catch { a = { better: false }; }
    const sel = $('[data-k="betterVoice"]');
    if (a.better) {
      const engines = [a.qwen && "Qwen3-TTS", a.kokoro && "Kokoro"].filter(Boolean).join(" + ");
      dot.className = "kv-dot on"; msg.textContent = `Local server found: ${engines || "ready"}${a.g2p ? ", Japanese reading on" : ""}.`;
      const pick = a.voices.filter((v) => v.startsWith("qwen:") || /^kokoro:(af_|am_|bf_|jf_|jm_)/.test(v));
      sel.innerHTML = '<option value="auto">Auto (by character)</option>' + pick.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      sel.value = settings.values.betterVoice in Object.fromEntries(pick.map((v) => [v, 1])) ? settings.values.betterVoice : "auto";
    } else {
      dot.className = "kv-dot off";
      msg.textContent = settings.values.mode === "better" ? "Local server not found: using the system voice. Start it with tools/voice-server/run.sh." : "Local server not found (optional). Start it with tools/voice-server/run.sh to use the better voice.";
    }
  }

  panel.addEventListener("input", (e) => {
    const cp = e.target.dataset?.cap;
    if (cp && captions) { const t = e.target; captions.set({ [cp === "bg" ? "bgOpacity" : cp]: t.type === "checkbox" ? t.checked : +t.value }); return; }
    const k = e.target.dataset?.k; if (!k) return;
    const t = e.target;
    settings.set({ [k]: t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value });
  });
  panel.addEventListener("change", (e) => {
    if (e.target.type === "radio") { settings.set({ mode: e.target.value }); if (e.target.value === "better") refreshStatus(true); }
  });
  panel.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "test") { const r = await voice.speak(sample, { lang }); if (r?.fellBack) refreshStatus(); }
    if (act === "stop") voice.stop();
    if (act === "reset") { settings.reset(); captions?.reset(); fillVoices(); }
  });
  const off0 = settings.subscribe((s) => sync(s)), offCaps = captions?.subscribe((c) => syncCaps(c));
  const off = () => { off0(); offCaps?.(); };

  if (!inline) {
    btn = el("button", { type: "button", class: "kv-btn", "aria-expanded": "false", "aria-controls": id + "-panel", "aria-haspopup": "dialog" }, ICON + `<span>${esc(label)}</span>`);
    panel.hidden = true;
    const close = (focus) => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); if (focus) btn.focus(); };
    btn.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) { fillVoices(); sync(); syncCaps(); refreshStatus(); panel.querySelector("input,select,button")?.focus(); } });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); close(true); } });
    document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !wrap.contains(e.target)) close(false); });
    wrap.append(btn);
  }
  wrap.append(panel); host.append(wrap);
  fillVoices(); sync(); syncCaps(); if (inline) refreshStatus();
  try { speechSynthesis.addEventListener("voiceschanged", () => { fillVoices(); sync(); }); } catch { /* no speech */ }
  return { element: wrap, refreshStatus, destroy() { off(); wrap.remove(); } };
}
