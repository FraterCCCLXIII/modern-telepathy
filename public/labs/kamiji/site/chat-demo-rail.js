// Left controls rail for the chat demo: icon buttons that open flyout panels. Controls are declared as data below;
// each change goes through ctx (store, avatar, voice, plane ...) and applies live. Esc and outside click close a panel.
import { START_CMD, KAMIJI_VOICE } from "./chat-demo-audio.js";

const SWATCHES = [["#ffd23f", "Yellow"], ["#ff7a59", "Coral"], ["#5ec27a", "Green"], ["#4aa8ff", "Blue"], ["#b583ff", "Violet"], ["#ff7eb6", "Pink"]];
const MOODS = ["neutral", "happy", "excited", "thinking", "sad", "angry", "surprised", "sleepy"];
const ICON = {
  body: '<path d="M8 21v-6M12 21v-9M16 21v-6M6 12V8M10 12V5M14 12V6M18 12V9"/><path d="M5 12h14v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/>',
  face: '<circle cx="12" cy="12" r="9"/><path d="M9 10v1M15 10v1M8.5 15a4.5 4.5 0 0 0 7 0"/>',
  voice: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  motion: '<path d="M3 17c3-8 6-8 9 0s6 8 9 0"/>',
  scene: '<path d="M3 18l4-9h10l4 9z"/><path d="M5.5 13.5h13"/>',
  convo: '<path d="M4 5h16v11H9l-5 4z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',
};

export function mountRail(host, ctx) {
  const { store, avatar, section } = ctx;
  const panels = {
    body: { label: "Body", controls: [
      { t: "seg", key: "shape", label: "Shape", opts: [["hand", "Hand"], ["sphere", "Sphere"], ["cube", "Cube"]] },
      { t: "swatch", key: "tint", label: "Colour" },
      { t: "range", key: "zoom", label: "Size", min: 0.7, max: 1.4, step: 0.05, fmt: (v) => Math.round(v * 100) + "%" },
      { t: "select", key: "clip", label: "Pose", opts: [["", "Auto"], ["Idle", "Idle"], ["Wave", "Wave"], ["Think", "Think"], ["Celebrate", "Celebrate"]] },
      { t: "note", text: "Kamikin characters, accessories and an outline/toon effect are not available on the <kamiji-avatar> tile yet, so they are not offered here." },
    ] },
    face: { label: "Face", controls: [
      { t: "select", key: "expression", label: "Expression", opts: [["", "Auto (follows the conversation)"], ...MOODS.map((m) => [m, m])] },
      { t: "select", key: "mouth", label: "Mouth", opts: [["none", "None"], ["classic", "Classic"]] },
    ] },
    voice: { label: "Voice", build: voicePanel },
    motion: { label: "Motion", controls: [
      { t: "toggle", key: "reactions", label: "Reactions to what is said" },
      { t: "range", key: "intensity", label: "Intensity", min: 0, max: 1.5, step: 0.1, fmt: (v) => v.toFixed(1) },
      { t: "toggle", key: "wander", label: "Wander (plane style)" },
      { t: "note", text: "With reduced motion switched on in your system, Kamiji does not walk or bounce: it holds a static pose and emoji only fade. This demo follows that setting." },
    ] },
    scene: { label: "Scene", controls: [
      { t: "seg", key: "style", label: "Style", opts: ctx.STYLES.map(([id, l]) => [id, l]), wrap: true },
      { t: "toggle", key: "plane:grid", label: "Plane: dot grid", plane: "grid" },
      { t: "toggle", key: "plane:surface", label: "Plane: surface and outline", plane: "surface" },
      { t: "toggle", key: "plane:circles", label: "Plane: station circles", plane: "circles" },
    ] },
    convo: { label: "Conversation", controls: [
      { t: "select", key: "conversation", label: "Conversation", opts: ctx.CONVERSATIONS.map((c, i) => [String(i), c.label]), num: true },
      { t: "range", key: "speed", label: "Reply speed", min: 0.5, max: 2, step: 0.25, fmt: (v) => v + "x" },
      { t: "button", label: "Replay", act: () => ctx.replay() },
      { t: "button", label: "Clear", act: () => ctx.clear() },
    ] },
    layout: { label: "Layout", controls: [
      { t: "select", key: "bg", label: "Window background", opts: [["paper", "Paper"], ["white", "White"], ["warm", "Warm"], ["grey", "Grey"]] },
      { t: "select", key: "height", label: "Window height", opts: [["compact", "Compact"], ["default", "Default"], ["tall", "Tall"]] },
    ] },
  };

  host.innerHTML = `<nav class="kcd-rail" aria-label="Kamiji controls">${Object.entries(panels).map(([id, p]) => `<button type="button" class="kcd-rb" data-panel="${id}" aria-haspopup="dialog" aria-expanded="false" aria-label="${p.label}" title="${p.label}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg></button>`).join("")}
  <button type="button" class="kcd-rb kcd-rb-reset" aria-label="Reset all controls" title="Reset all"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON.reset}</svg></button></nav>
  <div class="kcd-fly" role="dialog" aria-modal="false" hidden><div class="kcd-fly-h"><h3 class="kcd-fly-t"></h3><button type="button" class="kcd-fly-x" aria-label="Close panel">×</button></div><div class="kcd-fly-b"></div></div>`;
  const rail = host.querySelector(".kcd-rail"), fly = host.querySelector(".kcd-fly"), body = fly.querySelector(".kcd-fly-b"), title = fly.querySelector(".kcd-fly-t");
  let openId = null, uid = 0;

  const val = (c) => (c.get ? c.get() : c.plane ? ctx.planeOpts.get(c.plane) : store.get(c.key));
  const put = (c, v) => { if (c.set) c.set(v); else if (c.plane) ctx.planeOpts.set(c.plane, v); else store.set(c.key, v); };
  function render(c) {
    const id = "kcd-c" + ++uid, row = document.createElement("div"); row.className = "kcd-row";
    const lab = (t, f) => `<label class="kcd-rl" ${f ? `for="${id}"` : `id="${id}-l"`}>${t}</label>`;
    if (c.t === "note") { row.innerHTML = `<p class="kcd-note">${c.text.replace(/</g, "&lt;")}</p>`; return row; }
    if (c.t === "button") { row.innerHTML = `<button type="button" class="kcd-fb">${c.label}</button>`; row.firstChild.addEventListener("click", c.act); return row; }
    if (c.t === "toggle") {
      row.innerHTML = `<label class="kcd-tg"><input type="checkbox" id="${id}"> <span>${c.label}</span></label>`;
      const i = row.querySelector("input"); i.checked = !!val(c); i.addEventListener("change", () => put(c, i.checked)); row._sync = () => { i.checked = !!val(c); };
    } else if (c.t === "range") {
      row.innerHTML = `${lab(c.label, 1)}<div class="kcd-rg"><input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.step}"><output for="${id}"></output></div>`;
      const i = row.querySelector("input"), o = row.querySelector("output");
      const sync = () => { i.value = val(c); o.textContent = c.fmt ? c.fmt(+i.value) : i.value; };
      i.addEventListener("input", () => { put(c, +i.value); sync(); }); row._sync = sync; sync();
    } else if (c.t === "select") {
      row.innerHTML = `${lab(c.label, 1)}<select id="${id}">${c.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`;
      const i = row.querySelector("select"); const sync = () => { i.value = String(val(c)); }; sync();
      i.addEventListener("change", () => put(c, c.num ? +i.value : i.value)); row._sync = sync;
    } else if (c.t === "seg") {
      row.innerHTML = `${lab(c.label)}<div class="kcd-sg${c.wrap ? " wrap" : ""}" role="radiogroup" aria-labelledby="${id}-l">${c.opts.map(([v, l]) => `<button type="button" role="radio" data-v="${v}" aria-checked="false">${l}</button>`).join("")}</div>`;
      const bs = [...row.querySelectorAll("button")]; const sync = () => bs.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === val(c)))); sync();
      bs.forEach((b) => b.addEventListener("click", () => { put(c, b.dataset.v); }));
      row._sync = sync;
    } else if (c.t === "swatch") {
      row.innerHTML = `${lab(c.label)}<div class="kcd-sw" role="radiogroup" aria-labelledby="${id}-l">${SWATCHES.map(([v, l]) => `<button type="button" role="radio" data-v="${v}" aria-checked="false" aria-label="${l}" style="background:${v}"></button>`).join("")}</div>`;
      const bs = [...row.querySelectorAll("button")]; const sync = () => bs.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === val(c)))); sync();
      bs.forEach((b) => b.addEventListener("click", () => put(c, b.dataset.v)));
      row._sync = sync;
    }
    return row;
  }
  function voicePanel(el) {
    const { vset, audio } = ctx, V = () => vset.values;
    const chip = document.createElement("p"); chip.className = "kcd-note"; chip.setAttribute("role", "status");
    const cmd = document.createElement("div"); cmd.className = "kcd-cmd"; cmd.innerHTML = `<code>${START_CMD}</code><button type="button" class="kcd-fb">Copy</button>`;
    cmd.querySelector("button").addEventListener("click", (e) => { try { navigator.clipboard.writeText(START_CMD); e.target.textContent = "Copied"; setTimeout(() => (e.target.textContent = "Copy"), 1500); } catch { /* clipboard blocked */ } });
    const rows = [
      { t: "toggle", key: "sound", label: "Sound (speak replies)" },
      { t: "select", key: "engine", label: "Voice engine", opts: [["system", "System voice"], ["better", "Kamiji voice (Qwen, local)"]], get: () => V().mode, set: (v) => { vset.set(v === "better" ? { mode: "better", betterVoice: V().betterVoice === "auto" ? KAMIJI_VOICE : V().betterVoice, speed: 1.08 } : { mode: "system" }); probe(); } },
      { t: "select", key: "sysvoice", label: "System voice", opts: [["", "Auto (cutest available)"], ...(audio.ensure(), audio.voice.systemVoices().map((v) => [v.name, v.name]))], get: () => V().voiceName, set: (v) => vset.set({ voiceName: v }) },
      { t: "range", key: "rate", label: "Rate (system)", min: 0.5, max: 2, step: 0.05, get: () => V().rate, set: (v) => vset.set({ rate: v }) },
      { t: "range", key: "pitch", label: "Pitch (system)", min: 0.5, max: 2, step: 0.05, get: () => V().pitch, set: (v) => vset.set({ pitch: v }) },
      { t: "range", key: "speed", label: "Speed (Kamiji voice)", min: 0.6, max: 1.5, step: 0.05, get: () => V().speed, set: (v) => vset.set({ speed: v }) },
      { t: "select", key: "mood", label: "Mood (Kamiji voice)", opts: ["neutral", "happy", "sad", "scared", "angry"].map((m) => [m, m]), get: () => V().mood, set: (v) => vset.set({ mood: v }) },
      { t: "range", key: "volume", label: "Volume", min: 0, max: 1, step: 0.05, get: () => V().volume, set: (v) => vset.set({ volume: v }) },
      { t: "toggle", key: "cap", label: "Captions", get: () => audio.caps?.settings.captions ?? true, set: (v) => { audio.ensure(); audio.caps.set({ captions: v }); } },
      { t: "range", key: "capsize", label: "Caption size", min: 0.6, max: 2.2, step: 0.1, get: () => audio.caps?.settings.size ?? 1, set: (v) => { audio.ensure(); audio.caps.set({ size: v }); } },
      { t: "range", key: "capbg", label: "Caption background", min: 0.3, max: 1, step: 0.05, get: () => audio.caps?.settings.bg ?? 0.72, set: (v) => { audio.ensure(); audio.caps.set({ bgOpacity: v }); } },
    ];
    rows.forEach((c) => { el.append(render(c)); if (c.key === "engine") el.append(chip, cmd); });
    el.append(Object.assign(document.createElement("div"), { className: "kcd-row", innerHTML: '<button type="button" class="kcd-fb kcd-test">Test voice</button>' }));
    el.querySelector(".kcd-test").addEventListener("click", () => audio.speak("Hi! I am Kamiji. This is how I sound.", { force: true }));
    el.append(Object.assign(document.createElement("p"), { className: "kcd-note", textContent: "Voice and caption settings are shared with the site chat. The Kamiji voice runs only on this computer (127.0.0.1:4650), is never started by this page, needs a Mac with enough free memory (up to about 15 GB while generating), and its first line is slower while the model loads; later lines are cached. If it is not running or too slow, the system voice is used." }));
    async function probe() {
      chip.textContent = "Kamiji voice server: checking…";
      audio.ensure();
      try { const a = await audio.voice.available(true); chip.textContent = a.better ? "Kamiji voice server: ready" + (a.qwen ? " (Qwen3-TTS)" : "") : "Kamiji voice server: not running. Start it yourself with:"; cmd.hidden = !!a.better; }
      catch { chip.textContent = "Kamiji voice server: not running. Start it yourself with:"; cmd.hidden = false; }
    }
    probe();
  }
  function openPanel(id, focus = true) {
    closePanel(false);
    const p = panels[id]; openId = id; title.textContent = p.label; fly.setAttribute("aria-label", p.label + " controls"); body.textContent = "";
    if (p.build) p.build(body); else p.controls.forEach((c) => body.append(render(c)));
    fly.hidden = false;
    rail.querySelectorAll("[data-panel]").forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.panel === id)));
    const b = rail.querySelector(`[data-panel="${id}"]`); fly.style.top = b.offsetTop + "px";
    if (focus) (body.querySelector("input,select,button") || fly.querySelector(".kcd-fly-x")).focus();
  }
  function closePanel(refocus = true) {
    if (!openId) return;
    const b = rail.querySelector(`[data-panel="${openId}"]`); openId = null; fly.hidden = true;
    rail.querySelectorAll("[data-panel]").forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (refocus) b.focus();
  }
  rail.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("kcd-rb-reset")) { ctx.resetAll(); if (openId) openPanel(openId, false); return; }
    if (b.dataset.panel === openId) closePanel(); else openPanel(b.dataset.panel);
  });
  fly.querySelector(".kcd-fly-x").addEventListener("click", () => closePanel());
  host.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId) { e.stopPropagation(); closePanel(); } });
  document.addEventListener("pointerdown", (e) => { if (openId && !host.contains(e.target)) closePanel(false); });
  store.subscribe(() => { body.querySelectorAll(".kcd-row").forEach((r) => r._sync?.()); });
  return { open: openPanel, close: closePanel };
}
