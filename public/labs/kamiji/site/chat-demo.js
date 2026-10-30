// Agent chat demo: a SCRIPTED, auto-playing conversation with the Kamiji avatar and inline Arco-style cards.
// No model, no network. Card markup follows site/arco/arco.js (weatherCard, taskCard, statCard, codeBlock),
// re-implemented here in a few lines so the Arco page script (which drives its own page) is not imported.
// Avatar: <kamiji-avatar> from packages/kamiji-avatar (shared WebGL renderer, 30 fps cap, IntersectionObserver
// gating live inside the element). Mood protocol: the `expression` attribute (neutral, thinking, happy, excited ...).
// To iterate: edit CONVERSATIONS for content, chat-demo.css (--kcd-* tokens) for looks, TIMING for pacing.

// Style variants: the value is the data-style attribute on the section; the look lives in chat-demo.css.
const STYLES = [["centred", "Centred"], ["rail", "Side rail"], ["stage", "Stage"], ["editorial", "Editorial"], ["dark", "Dark"], ["dock", "Dock"], ["board", "Board"], ["plane", "Plane"]];
const CHIPS = ["Weather on Saturday", "What is left to ship?", "Sales this month", "Port the UI library"];

// Plane style: three stations on a tilted ground plane (u = 0..1 across, side = which way Kamiji stands from its card).
const ZONES = [{ id: "left", name: "Desk", u: 0.2, side: 0 }, { id: "centre", name: "Board", u: 0.5, side: 0 }, { id: "right", name: "Shelf", u: 0.8, side: 0 }];
const ZONE_BY_TYPE = { weatherCard: "left", taskCard: "centre", statCard: "left", codeBlock: "right" };

import { store } from "./chat-demo-settings.js";
import { createAudio } from "./chat-demo-audio.js";
import { mountRail } from "./chat-demo-rail.js";
import { buildTeam } from "./chat-demo-team.js";
import { settings as vset } from "./voice.js";
import { createReactor, match as matchRule, CHIPS as RX_CHIPS, ACCENT } from "./chat-demo-reactions.js";

const TIMING = { userPause: 500, think: 1300, afterText: 450, cardGap: 650, hold: 5000 };
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- the three scripted conversations ----------
// A step is { user } or { agent, mood, cards:[spec], after? }. `after(cardEls)` runs once the cards are in.
const CONVERSATIONS = [
  {
    id: "plan", label: "Plan", steps: [
      { user: "Will it rain on Saturday? I want to walk the coast.", react: "question" },
      { agent: "Mostly dry, with a light shower after four. Here is the day.", mood: "happy", cards: [
        { zone: "left", type: "weatherCard", location: "Lisbon, Saturday", current: { temp: 21, condition: "partly_cloudy", humidity: 58, wind: "12 km/h" }, high: 23, low: 16,
          forecast: [{ day: "Fri", condition: "sunny", high: 24 }, { day: "Sat", condition: "partly_cloudy", high: 23 }, { day: "Sun", condition: "rain", high: 19 }, { day: "Mon", condition: "cloudy", high: 20 }] },
      ] },
      { user: "Good. Remind me to bring a jacket.", react: "thanks" },
      { agent: "Noted. I added it to your list.", mood: "happy", cards: [
        { zone: "centre", type: "taskCard", title: "Saturday walk", items: [{ label: "Pack a light jacket", completed: true }, { label: "Leave by 10:00", completed: false }] },
      ] },
    ],
  },
  {
    id: "tasks", label: "Tasks", steps: [
      { user: "What is left before we ship on Friday?", react: "question" },
      { agent: "Four things. The first is blocking, so I would start there.", mood: "thinking", cards: [
        { zone: "centre", type: "taskCard", title: "Before Friday", items: [
          { label: "Fix the login redirect", completed: false, priority: "high" },
          { label: "Update the release notes", completed: false },
          { label: "Run the smoke tests", completed: false },
          { label: "Tag the build", completed: false },
        ], tick: [0, 2] },
      ] },
      { user: "Nice. Anything I should read first?" },
      { agent: "The redirect bug is a one-line change. Here it is.", mood: "excited", cards: [
        { zone: "right", type: "codeBlock", filename: "redirect.ts", code: "if (!session) {\n  return redirect(\"/login?next=\" + path);\n}" },
      ] },
    ],
  },
  {
    id: "numbers", label: "Numbers", steps: [
      { user: "How did sales go this month?", react: "question" },
      { agent: "Up on last month, with a dip in week three.", mood: "happy", cards: [
        { zone: "left", type: "statCard", label: "Revenue", value: "$45,231", change: { amount: "+12.5%", direction: "up" }, caption: "Month to date, sample data" },
        { zone: "centre", type: "statCard", label: "Revenue by week", value: "$13.8k", caption: "In thousands", chartValues: [9.8, 11.2, 10.4, 13.8], chartLabels: ["W1", "W2", "W3", "W4"] },
      ] },
      { user: "Show me what you ran." },
      { agent: "Just one query.", mood: "neutral", cards: [
        { zone: "right", type: "codeBlock", filename: "query", code: "$ sum revenue --by week\nW1   9.8k\nW2  11.2k\nW3  10.4k\nW4  13.8k" },
      ] },
    ],
  },
  {
    id: "team", label: "Team", steps: [
      { user: "Port the UI library to Rust and Lit.", react: "question" },
      { agent: "I will conduct it: five leads, thirteen workers, and a fresh verifier on every handoff. Here is the example run.", mood: "excited", react: "team-spawn", cards: [{ zone: "centre", type: "teamCard" }] },
    ],
  },
];

// ---------- tiny DOM helpers ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const NS = "http://www.w3.org/2000/svg";
let uid = 0;
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 9.5a4.2 4.2 0 0 1 .5 8.5z"/>',
  partly: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M9 20a3.5 3.5 0 0 1-.4-7A4.8 4.8 0 0 1 18 12.6 3.7 3.7 0 0 1 17.5 20z"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.6-7.9A5.5 5.5 0 0 1 17 6.5a4.2 4.2 0 0 1 .5 8.5z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
};
function icon(name, size) {
  const s = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" })) s.setAttribute(k, v);
  s.innerHTML = ICONS[name] || ICONS.cloud;
  return s;
}
const condIcon = (c) => (/sun|clear/.test(c) ? "sun" : /partly/.test(c) ? "partly" : /rain/.test(c) ? "rain" : "cloud");
const condLabel = (c) => c.replace(/_/g, " ");

// ---------- Arco card bodies ----------
const BODY = {
  weatherCard(spec) {
    const d = el("div");
    const now = el("div", "wx-now");
    const t = el("div");
    t.append(el("div", "big", spec.current.temp + "°"), el("div", "dim", condLabel(spec.current.condition)));
    now.append(icon(condIcon(spec.current.condition), 40), t);
    now.firstChild.classList.add("wx-ic");
    d.append(now, el("div", "dim wx-meta", `H ${spec.high}° / L ${spec.low}°  ·  Humidity ${spec.current.humidity}%  ·  Wind ${spec.current.wind}`));
    const f = el("ul", "wx-fc");
    spec.forecast.forEach((x) => { const li = el("li"); li.title = x.day + ": " + condLabel(x.condition); li.append(el("span", "dim", x.day), icon(condIcon(x.condition), 18), el("b", null, x.high + "°")); f.append(li); });
    d.append(f);
    return d;
  },
  taskCard(spec, ctx) {
    const d = el("div");
    d.style.display = "grid"; d.style.gap = "10px";
    const prog = el("div", "prog"); const bar = el("i"); prog.append(bar); prog.setAttribute("aria-hidden", "true");
    const count = el("p", "dim");
    const ul = el("ul", "task-list");
    const boxes = spec.items.map((item) => {
      const li = el("li"), id = "kcd-t" + ++uid;
      const cb = el("input"); cb.type = "checkbox"; cb.id = id; cb.checked = !!item.completed;
      const lab = el("label", null, item.label); lab.htmlFor = id;
      li.append(cb, lab);
      if (item.priority) li.append(el("span", "pri " + item.priority, item.priority));
      cb.addEventListener("change", () => { item.completed = cb.checked; upd(); });
      ul.append(li);
      return cb;
    });
    const upd = () => {
      const n = spec.items.filter((i) => i.completed).length;
      bar.style.width = (100 * n) / spec.items.length + "%";
      count.textContent = `${n} of ${spec.items.length} done`;
    };
    d.append(prog, count, ul);
    upd();
    ctx.tick = (i) => { boxes[i].checked = true; spec.items[i].completed = true; upd(); };
    return d;
  },
  statCard(spec) {
    const d = el("div");
    d.style.display = "grid"; d.style.gap = "10px";
    const row = el("div", "stat-row");
    row.append(el("span", "big", spec.value));
    if (spec.change) row.append(el("span", "delta " + spec.change.direction, (spec.change.direction === "up" ? "▲ " : "▼ ") + spec.change.amount));
    d.append(row);
    if (spec.caption) d.append(el("p", "dim", spec.caption));
    if (spec.chartValues) {
      const max = Math.max(...spec.chartValues), chart = el("div", "bars");
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", "Bar chart: " + spec.chartValues.join(", "));
      spec.chartValues.forEach((v, i) => {
        const col = el("span"), b = el("i");
        b.style.setProperty("--h", Math.max(6, (100 * v) / max) + "%"); b.style.setProperty("--b", i);
        col.append(b, el("em", null, spec.chartLabels[i]));
        chart.append(col);
      });
      d.append(chart);
    }
    return d;
  },
  teamCard() { return buildTeam({ reduced: reduced.matches, onEvent: (e, n) => teamHooks.onEvent(e, n), onSpawn: { reset: () => teamHooks.reset() } }); },
  codeBlock(spec) {
    const p = el("pre", "kcode"); p.textContent = spec.code; p.tabIndex = 0;
    p.setAttribute("aria-label", "Code: " + spec.filename);
    return p;
  },
};
const teamHooks = { onEvent: () => {}, reset: () => {} };
const TITLE = { teamCard: () => "Port the UI library", weatherCard: (s) => s.location, taskCard: (s) => s.title, statCard: (s) => s.label, codeBlock: (s) => s.filename };

// Cards fade and rise in as a stagger: header, body, then the rest via --i on direct children.
function buildCard(spec) {
  spec = structuredClone(spec);
  const card = el("article", "kcard");
  const head = el("header", "kcard-h");
  head.append(el("h4", null, TITLE[spec.type](spec)));
  const ctx = {};
  const body = BODY[spec.type](spec, ctx);
  card.append(head, body);
  [...card.children].forEach((c, i) => c.style.setProperty("--i", i));
  return { card, ctx, spec };
}

// Canned replies for the composer, picked by keyword. Anything else gets the scripted fallback.
const REPLIES = [
  [/^\s*(hi|hello|hey|yo)\b/, { agent: "Hello! Ask me about the weather, your tasks or sales.", mood: "happy" }],
  [/thank/, { agent: "You are welcome.", mood: "happy", react: "thanks" }],
  [/weather|rain|forecast|umbrella|saturday|sun/, CONVERSATIONS[0].steps[1]],
  [/task|todo|left|ship|friday|checklist|list/, CONVERSATIONS[1].steps[1]],
  [/team|subagent|sub-agent|hierarch|orchestrat|delegat|spawn|port the ui|library/, CONVERSATIONS[3].steps[1]],
  [/sale|revenue|number|order|metric|stat|month/, CONVERSATIONS[2].steps[1]],
];
const FALLBACK = { agent: "I am a scripted demo, so I only know three things: the weather, your tasks and sales. Try one of the suggestions.", mood: "neutral" };
const replyFor = (text) => (REPLIES.find(([re]) => re.test(text.toLowerCase())) || [0, FALLBACK])[1];

// ---------- the player ----------
function init(root) {
  const section = root.closest(".kcd") || root;
  root.innerHTML = `
<div class="kcd-intro">
  <h2 id="kcd-h">A quiet chat</h2>
  <p class="sub">The Kamiji avatar as an agent presence: it thinks while it works and brightens when it answers, with Arco cards inline. Three short, scripted conversations, eight ways to dress them. Try the suggestions or type your own.</p>
</div>
<div class="kcd-stage"><div class="kcd-railhost"></div>
<div class="kcd-window" id="kcd-panel" role="tabpanel" aria-labelledby="kcd-tab-0">
  <div class="kcd-scene">
    <canvas class="kcd-floor" aria-hidden="true"></canvas>
    <div class="kcd-hit" tabindex="0" role="group" aria-label="Kamiji's plane. Click or tap to send Kamiji there, or use the arrow keys to move a marker and Enter to send Kamiji to it."></div>
    <div class="kcd-stations" role="group" aria-label="Kamiji stations. Choose one to send Kamiji there.">${ZONES.map((z, i) => `<button type="button" class="kcd-station" data-zone="${z.id}" tabindex="${i === 1 ? 0 : -1}" aria-label="Send Kamiji to ${z.name}"><span class="kcd-ring"></span><span class="kcd-zl">${z.name}</span></button>`).join("")}</div>
    <i class="kcd-target" aria-hidden="true"></i>
    <i class="kcd-shadow" aria-hidden="true"></i>
    <div class="kcd-sprites" aria-hidden="true"></div><span class="kcd-more" hidden aria-hidden="true"></span>
    <div class="kcd-pcards"></div>
    <div class="kcd-ptools" role="group" aria-label="View"><button type="button" class="kcd-pt" data-ptool="grid" aria-pressed="true" title="Show or hide the dot grid">Grid</button><button type="button" class="kcd-pt" data-ptool="surface" aria-pressed="true" title="Show or hide the plane surface and outline">Plane</button><button type="button" class="kcd-pt" data-ptool="circles" aria-pressed="true" title="Show or hide the station circles and labels">Circles</button></div>
  </div>
  <p class="kcd-sr" role="status" aria-live="polite" data-kcd-move></p>
  <div class="kcd-head">
    <div class="kcd-avatar"><kamiji-avatar size="100%" shape="hand" expression="neutral" color="#ffd23f" src="../assets/"><span class="kcd-fallback" aria-hidden="true"></span></kamiji-avatar></div>
    <p class="kcd-name" aria-hidden="true">Kamiji</p>
    <p class="kcd-mood" aria-hidden="true"></p>
  </div>
  <div class="kcd-main">
    <div class="kcd-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Scripted demo conversation" tabindex="0"></div>
    <p class="kcd-say" aria-hidden="true"></p>
    <div class="kcd-caps" aria-hidden="true"></div>
    <div class="kcd-stack kcd-strip">
      <div class="kcd-chips" role="group" aria-label="Suggestions">${CHIPS.map((c) => `<button type="button" class="kcd-chip">${c}</button>`).join("")}</div>
      <p class="kcd-micmsg" role="status" aria-live="polite"></p>
    </div>
    <form class="kcd-form kcd-strip" autocomplete="off">
      <label class="kcd-sr" for="kcd-in">Message (scripted demo, no live model)</label>
      <input id="kcd-in" class="kcd-in" type="text" maxlength="80" placeholder="Ask about weather, tasks or sales">
      <button type="button" class="kcd-ib kcd-mic" aria-label="Record audio" aria-pressed="false" title="Record audio (stays in your browser)"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><i class="kcd-lvl" aria-hidden="true"></i></button>
      <button type="button" class="kcd-ib kcd-snd" aria-label="Sound" aria-pressed="false" title="Sound is off: click to hear replies"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="kcd-waves" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="kcd-mute" d="M16 9l5 6M21 9l-5 6"/></svg></button>
      <button type="submit" class="kcd-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
    </form>
  </div>
</div>
</div>
<div class="kcd-ctl">
  <div class="kcd-tabs" role="tablist" aria-label="Sample conversations">
    ${CONVERSATIONS.map((c, i) => `<button type="button" class="kcd-tab" role="tab" id="kcd-tab-${i}" aria-controls="kcd-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${c.label}</button>`).join("")}
  </div>
  <button type="button" class="kcd-replay">Replay</button>
</div>
<div class="kcd-ctl kcd-styles-row">
  <span class="kcd-ctl-l" id="kcd-style-l">Style</span>
  <div class="kcd-styles" role="radiogroup" aria-labelledby="kcd-style-l">
    ${STYLES.map(([id, label], i) => `<button type="button" class="kcd-style" role="radio" data-style="${id}" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join("")}
  </div>
</div>
<div class="kcd-ctl kcd-opts"><button type="button" class="kcd-pt kcd-opt" data-opt="reactions" aria-pressed="true" title="Kamiji reacts to what is said with movement and emoji">Reactions</button><button type="button" class="kcd-pt kcd-opt" data-opt="showWhy" aria-pressed="false" title="Show which reaction rule fired">Show why</button><button type="button" class="kcd-pt kcd-opt" data-opt="useSTT" aria-pressed="false" hidden title="Off by default. Some browsers send microphone audio to their own speech service when this is on.">Use browser speech recognition</button></div>
<p class="kcd-why" role="note" hidden></p>
<p class="kcd-cap">Scripted demo. No live model: every reply and card is written in advance. The microphone, if you use it, stays in your browser: nothing is uploaded or stored.</p>`;

  const $ = (s) => root.querySelector(s);
  const log = $(".kcd-log"), moodEl = $(".kcd-mood"), sayEl = $(".kcd-say"), input = $(".kcd-in");
  const avatar = $("kamiji-avatar"), win = $(".kcd-window");
  const head = $(".kcd-head"), avBox = $(".kcd-avatar"), mainEl = $(".kcd-main");
  const tabs = [...root.querySelectorAll(".kcd-tab")], replay = $(".kcd-replay");
  const styleBtns = [...root.querySelectorAll(".kcd-style")];

  const whyEl = $(".kcd-why");
  const reactor = createReactor({
    avatar, head, motionEl: avBox, baseClip: () => store.get("clip") || "Idle",
    setMood: (m) => setMood(m, m === "neutral" ? "" : m),
    enabled: () => store.get("reactions"), intensity: () => store.get("intensity"), reduced: () => reduced.matches,
    why: (t) => { whyEl.textContent = t ? "Why: " + t : ""; whyEl.hidden = !store.get("showWhy") || !t; },
  });
  const react = (m) => reactor.react(m);
  teamHooks.onEvent = (e, n) => {
    if (e.event === "verdict" && /reject/i.test(e.text)) react({ role: "event", event: "team-reject" });
    else if (e.event === "verdict" && /accept/i.test(e.text)) react({ role: "event", event: "team-accept" });
    else if (e.event === "complete") react({ role: "event", event: "team-done" });
    else if (e.event === "spawn" && n.level === 1) react({ role: "event", event: "team-spawn" });
    plane.team(e, n);
  };
  teamHooks.reset = () => plane.teamReset();
  root.querySelectorAll("[data-opt]").forEach((b) => {
    const k = b.dataset.opt, sync = () => { b.setAttribute("aria-pressed", String(!!store.get(k))); if (k === "showWhy") whyEl.hidden = !store.get(k) || !whyEl.textContent; };
    sync(); b.addEventListener("click", () => store.set(k, !store.get(k))); store.subscribe((key) => { if (key === k) sync(); });
  });
  // ---------- sound and microphone ----------
  const sndBtn = $(".kcd-snd"), micBtn = $(".kcd-mic"), micMsg = $(".kcd-micmsg"), stack = $(".kcd-stack");
  const audio = createAudio({
    store, capsStage: $(".kcd-caps"),
    setOpen: (o) => avatar.setAttribute("expression", o ? "excited" : "happy"),
    restore: () => avatar.setAttribute("expression", moodNow || "neutral"),
    notify: (t) => { micMsg.textContent = t; stack.classList.add("has-msg"); setTimeout(() => { if (micMsg.textContent === t) { micMsg.textContent = ""; stack.classList.remove("has-msg"); } }, 6000); },
    onMicChange: (on) => { micBtn.setAttribute("aria-pressed", String(on)); head.classList.toggle("is-listening", on); if (!on) { micBtn.style.setProperty("--lvl", "0"); } },
  });
  let moodNow = "neutral";
  const syncSound = () => { const on = store.get("sound"); sndBtn.setAttribute("aria-pressed", String(on)); sndBtn.title = on ? "Sound is on: replies are spoken (click to mute)" : "Sound is off: click to hear replies"; };
  syncSound();
  sndBtn.addEventListener("click", () => {
    const on = !store.get("sound"); store.set("sound", on); syncSound();
    if (!on) audio.stop(); else { audio.ensure(); say2("Sound on."); }
    if (on) audio.speak("Sound is on.");
  });
  store.subscribe((k) => { if (k === "sound") syncSound(); });
  function say2(t) { micMsg.textContent = t; stack.classList.add("has-msg"); setTimeout(() => { if (micMsg.textContent === t) { micMsg.textContent = ""; stack.classList.remove("has-msg"); } }, 3500); }
  const sttBtn = root.querySelector('[data-opt="useSTT"]'); if (audio.sttAvailable) sttBtn.hidden = false;
  micBtn.addEventListener("click", () => {
    if (audio.mic.active) { audio.mic.stop((st, t) => say2(t)); return; }
    manual = true; token++; dropDots();
    audio.mic.start({
      onLevel: (v) => micBtn.style.setProperty("--lvl", v.toFixed(2)),
      onText: (t) => { input.value = t; },
      onState: (st, t) => { micMsg.textContent = t; stack.classList.toggle("has-msg", !!t); if (st === "listening") setMood("thinking", "listening"); if (st !== "listening") { setMood("neutral"); if (st === "stopped") setTimeout(() => { micMsg.textContent = ""; stack.classList.remove("has-msg"); }, 2500); } },
    });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { audio.stop(); audio.mic.stop(); } });

  // one-tap reaction chips under an agent message: Kamiji reacts back
  function reactionRow() {
    const row = el("div", "kcd-rx"); row.setAttribute("role", "group"); row.setAttribute("aria-label", "React to this message");
    RX_CHIPS.forEach((e) => {
      const b = el("button", "kcd-rxb", e); b.type = "button"; b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", "React " + e);
      b.addEventListener("click", () => { const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); if (on) react({ role: "event", event: e }); });
      row.append(b);
    });
    return row;
  }

  let current = 0, token = 0, paused = false, onScreen = false, started = false, manual = false;
  const setMood = (m, label) => { moodNow = m; avatar.setAttribute("expression", store.get("expression") || m); moodEl.textContent = label ?? (m === "neutral" ? "" : m); };
  const toEnd = () => { log.scrollTop = log.scrollHeight; };
  const sync = () => win.classList.toggle("has-msgs", log.children.length > 0);
  const clearLog = () => { log.textContent = ""; sayEl.textContent = ""; sync(); };
  const dropDots = () => log.querySelectorAll(".kcd-think").forEach((n) => n.remove());

  // ---------- Plane style: Kamiji walks between stations on a tilted ground plane ----------
  // Faked: the plane is drawn with my own perspective projection (canvas floor, DOM billboards); Kamiji is the
  // regular <kamiji-avatar> tile moved and scaled by depth, with a CSS hop, tilt and mirror for walking and facing.
  const scene = $(".kcd-scene"), floor = $(".kcd-floor"), hit = $(".kcd-hit"), target = $(".kcd-target"), cardsLayer = $(".kcd-pcards"), shadowEl = $(".kcd-shadow"), liveEl = $("[data-kcd-move]");
  const stationEls = [...root.querySelectorAll(".kcd-station")], spritesLayer = $(".kcd-sprites"), moreEl = $(".kcd-more");
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const P = { active: false, W: 0, H: 0, small: false, D: 2.2, yN: 0, yH: 0, Wn: 0, A: 200, zone: "centre", dir: -1, pos: { u: 0.5, v: 0.88 }, rest: { u: 0.5, v: 0.88 }, move: null, raf: 0, last: 0, cards: new Map(), order: [], queue: Promise.resolve(), said: "", cursor: { u: 0.5, v: 0.8 } };
  const plane = { get queue() { return P.queue; } };

  // Narrow planes get two stations at the edges (a card then fits beside the hand); "centre" maps to the right one.
  const zoneKey = (id) => (P.small && id === "centre" ? "right" : id);
  const zoneOf = (id) => ZONES.find((z) => z.id === zoneKey(id)) || ZONES[1];
  const zoneU = (z) => (P.small ? (z.id === "left" ? 0.15 : z.id === "right" ? 0.85 : 0.5) : z.u);
  const stationPt = (id) => ({ u: zoneU(zoneOf(id)), v: 0.88 });
  function proj(u, v) {
    const d = 1 + (1 - v) * (P.D - 1), k = 1 / d;
    return { x: P.W / 2 + (u - 0.5) * P.Wn * k, y: P.yH + (P.yN - P.yH) * k, k };
  }
  function unproj(x, y) {
    const k = (y - P.yH) / (P.yN - P.yH), d = 1 / k;
    return { u: (x - P.W / 2) / (P.Wn * k) + 0.5, v: 1 - (d - 1) / (P.D - 1) };
  }
  const clampPt = (p) => ({ u: Math.max(0.06, Math.min(0.94, p.u)), v: Math.max(0.5, Math.min(0.95, p.v)) });
  function measure() {
    P.W = scene.clientWidth; P.H = scene.clientHeight;
    if (!P.W) return false;
    P.small = P.W < 520;
    P.D = P.small ? 1.75 : 2.2;
    P.A = parseFloat(getComputedStyle(head).width) || 200;
    P.Wn = P.W * (P.small ? 1.0 : 0.98);
    P.yN = P.H - 14;
    P.yH = P.yN - (P.yN - P.H * 0.2) / (1 - 1 / P.D);
    return true;
  }
  function drawFloor() {
    const dpr = Math.min(devicePixelRatio || 1, 2), c = floor.getContext("2d");
    floor.width = P.W * dpr; floor.height = P.H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, P.W, P.H);
    const ink = getComputedStyle(scene).color;
    const a = proj(0, 0), b = proj(1, 0), d1 = proj(1, 1), e = proj(0, 1);
    if (pset.surface) {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d1.x, d1.y); c.lineTo(e.x, e.y); c.closePath();
      c.globalAlpha = 0.04; c.fillStyle = ink; c.fill();
      c.globalAlpha = 0.14; c.strokeStyle = ink; c.lineWidth = 1; c.stroke();
    }
    c.fillStyle = ink;
    for (let j = 0; pset.grid && j <= 12; j++) {
      const d = 1 + (j * (P.D - 1)) / 12, v = 1 - (d - 1) / (P.D - 1);
      for (let i = 0; i <= 14; i++) {
        const p = proj(i / 14, v);
        c.globalAlpha = 0.1 + 0.3 * p.k; c.beginPath(); c.arc(p.x, p.y, 0.6 + 1.3 * p.k, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  // Stations: ring widths are capped by the gap to the neighbouring station so ellipses never intersect;
  // if two labels would still collide, the later one is hidden until hover or focus.
  function placeStations() {
    const vis = stationEls.filter((b) => !(P.small && b.dataset.zone === "centre"));
    stationEls.forEach((b) => { b.hidden = !vis.includes(b); });
    const us = vis.map((b) => proj(zoneU(zoneOf(b.dataset.zone)), 0.88)).sort((p, q) => p.x - q.x);
    let gap = Infinity;
    for (let i = 1; i < us.length; i++) gap = Math.min(gap, us[i].x - us[i - 1].x);
    vis.forEach((b) => {
      const p = proj(zoneU(zoneOf(b.dataset.zone)), 0.88);
      const w = Math.min((P.small ? 108 : 150) * p.k * 1.15, gap - 14);
      b.style.width = w + "px"; b.style.setProperty("--ring-h", w * 0.3 + "px");
      b.style.transform = `translate(${p.x - w / 2}px, ${p.y - w * 0.15}px)`;
      b.setAttribute("aria-current", String(zoneKey(b.dataset.zone) === zoneKey(P.zone)));
      b.classList.remove("no-label");
    });
    let prev = null;
    vis.sort((p, q) => p.getBoundingClientRect().left - q.getBoundingClientRect().left).forEach((b) => {
      const r = b.querySelector(".kcd-zl").getBoundingClientRect(), w = r.width, cx = b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2;
      if (prev && cx - w / 2 < prev + 6) b.classList.add("no-label"); else prev = cx + w / 2;
    });
  }
  // Card layout solver: cards sit beside the hand (side with most room first, then the other side, then above),
  // never over the hand or each other; the newest card is full strength, an older one stacks behind it.
  function handRect() {
    const p = proj(P.rest.u, P.rest.v), A = P.A, hx = Math.max(A * p.k * 0.3, Math.min(P.W - A * p.k * 0.3, p.x));
    const wob = 0.03 * P.Wn * p.k; // the idle wander moves the hand a little; keep clear of that too
    return { l: hx - 0.34 * A * p.k - wob, r: hx + 0.34 * A * p.k + wob, t: p.y - 0.66 * A * p.k, b: p.y + 6 };
  }
  const hits = (a, b, pad = 8) => a.l < b.r + pad && a.r + pad > b.l && a.t < b.b + pad && a.b + pad > b.t;
  // Top strip (36px) is reserved for the view toggles and collapsed card chips, so nothing ever overlaps them.
  const TOP = 44;
  function bringForward(key) { P.order = P.order.filter((x) => x !== key).concat(key); placeCards(); }
  function placeCards() {
    const cw = P.small ? 190 : 250, cs0 = P.small ? 0.82 : 0.86, gap = 14, hr = handRect(), placed = [], chips = [];
    const ids = [...P.order];
    for (let n = ids.length - 1; n >= 0; n--) {
      const key = ids[n], c = P.cards.get(key); if (!c) continue;
      c.wrap.classList.remove("is-chip"); c.wrap.removeAttribute("role"); c.wrap.removeAttribute("tabindex"); c.wrap.removeAttribute("aria-label");
      const h0 = c.wrap.offsetHeight || 220, cs = Math.min(cs0, (P.H - TOP - 6) / h0);
      const roomR = P.W - 6 - (hr.r + gap), roomL = hr.l - gap - 6;
      const sides = roomL > roomR ? ["l", "r"] : ["r", "l"];
      let pick = null;
      for (const side of sides) {
        let sc = cs, w = cw * sc;
        if (n === ids.length - 1) { const room = side === "r" ? roomR : roomL; if (room < w) { sc = Math.max(0.6, Math.min(sc, room / cw)); w = cw * sc; } } // newest may shrink a little
        const h = h0 * sc, l = side === "r" ? hr.r + gap : hr.l - gap - w, t = Math.max(TOP, Math.min(hr.b - h, P.H - h - 6));
        const r = { l, r: l + w, t, b: t + h, side, sc };
        if (r.l >= 6 && r.r <= P.W - 6 && !hits(r, hr, 6) && !placed.some((q) => hits(r, q, 8))) { pick = r; break; }
      }
      if (!pick) { c.wrap.classList.add("is-chip"); chips.push([key, c]); continue; }
      placed.push(pick);
      c.wrap.dataset.side = pick.side;
      c.wrap.style.zIndex = String(n + 1);
      c.wrap.style.setProperty("--tilt", (pick.side === "r" ? 3 : -3) + "deg");
      c.wrap.style.transform = `translate(${pick.l}px, ${pick.t}px) scale(${pick.sc})`;
    }
    P.cards.forEach((c, key) => { if (c.team) { c.wrap.classList.add("is-chip"); chips.push([key, c]); } });
    let l = 10;
    chips.forEach(([key, c]) => {
      c.wrap.classList.toggle("is-open", c.team && c.wrap.dataset.open === "true");
      if (c.team && c.wrap.dataset.open === "true") { c.wrap.removeAttribute("role"); c.wrap.style.zIndex = "30"; c.wrap.style.transform = "none"; return; }
      c.wrap.setAttribute("role", "button"); c.wrap.tabIndex = 0; c.wrap.setAttribute("aria-label", (c.team ? "Open the card: " : "Bring forward the card: ") + c.title);
      c.wrap.style.zIndex = "9"; c.wrap.style.transform = `translate(${l}px, 8px)`;
      l += c.wrap.offsetWidth + 6;
    });
  }
  function place(hop = 0, tilt = 0) {
    if (!P.active || !P.W) return;
    const p = proj(P.pos.u, P.pos.v), A = P.A, k = p.k;
    const hx = Math.max(A * k * 0.3, Math.min(P.W - A * k * 0.3, p.x));
    const bottom = p.y + 0.2 * A * k - hop;
    head.style.transform = `translate3d(${hx - A / 2}px, ${bottom - A}px, 0) scale(${k})`;
    avBox.style.transform = `scaleX(${P.dir}) rotate(${tilt}deg)`;
    const sw = A * 0.5 * k * (1 - Math.min(hop / 40, 0.5) * 0.6);
    shadowEl.style.width = sw + "px"; shadowEl.style.height = sw * 0.3 + "px";
    shadowEl.style.opacity = String(0.9 - Math.min(hop / 60, 0.4));
    shadowEl.style.transform = `translate(${hx - sw / 2}px, ${p.y - sw * 0.15}px)`;
  }
  function placeTarget(pt, show) {
    const p = proj(pt.u, pt.v), w = 46 * p.k * 1.4;
    target.style.width = w + "px"; target.style.height = w * 0.3 + "px";
    target.style.transform = `translate(${p.x - w / 2}px, ${p.y - w * 0.15}px)`;
    if (show) { target.classList.remove("on"); void target.offsetWidth; target.classList.add("on"); }
  }
  function relayout() {
    if (!P.active || !measure()) return;
    drawFloor(); placeStations(); placeCards(); place(); relayoutSprites();
  }
  const clipTimer = { id: 0 };
  function setClip(c, back = 0) {
    avatar.setAttribute("clip", c); clearTimeout(clipTimer.id);
    if (back) clipTimer.id = setTimeout(() => avatar.setAttribute("clip", "Idle"), back);
  }
  function nearestZone(pt) {
    let best = null, bd = 1e9;
    ZONES.forEach((z) => { if (P.small && z.id === "centre") return; const d = Math.hypot(zoneU(z) - pt.u, (0.88 - pt.v) * 0.8); if (d < bd) { bd = d; best = z; } });
    return { z: best, near: bd < 0.12 };
  }
  function say(text) {
    if (P.said === text) return; P.said = text;
    liveEl.textContent = ""; setTimeout(() => { liveEl.textContent = text; }, 30);
  }
  function arrive() {
    const m = P.move; P.move = null;
    P.pos = { ...m.to };
    setClip("Wave", 1100); say("Kamiji moved to " + m.label); placeStations(); placeCards(); place(); m.res();
  }
  function step(ts) {
    if (P.move) {
      const m = P.move, t = Math.min(1, (ts - m.t0) / m.dur), e = ease(t);
      P.pos = { u: m.from.u + (m.to.u - m.from.u) * e, v: m.from.v + (m.to.v - m.from.v) * e - Math.sin(Math.PI * e) * 0.05 };
      const hop = Math.abs(Math.sin(t * Math.PI * m.hops)) * 16 * proj(P.pos.u, P.pos.v).k;
      place(hop, m.dir * 5 * Math.sin(Math.PI * t * m.hops));
      if (t >= 1) arrive();
    } else if (!reduced.matches && store.get("wander")) {
      const s = ts / 1000;
      P.pos = { u: P.rest.u + 0.02 * Math.sin(s / 2.3), v: P.rest.v + 0.02 * Math.sin(s / 1.9 + 1) };
      place(0, 0);
    }
  }
  function loop(ts) {
    P.raf = requestAnimationFrame(loop);
    if (ts - P.last < 33) return; // 30 fps cap
    P.last = ts; step(ts);
  }
  function kick() {
    const run = P.active && onScreen && !document.hidden && P.W > 0;
    if (run && !P.raf) P.raf = requestAnimationFrame(loop);
    if (!run && P.raf) { cancelAnimationFrame(P.raf); P.raf = 0; }
  }
  function finishMove() { if (P.move) { const m = P.move; P.pos = { ...m.to }; P.move = null; m.res(); } }
  // Walk to a point on the plane (a station or any clicked spot).
  function goToPt(pt, opts = {}) {
    finishMove();
    pt = clampPt(pt);
    const near = nearestZone(pt);
    P.zone = near.z.id; P.rest = pt;
    const label = opts.label || (near.near ? near.z.name : "a new spot");
    const moveOn = P.active && !reduced.matches && P.W > 0;
    if (opts.marker && P.active && P.W) placeTarget(pt, true);
    if (!moveOn) { P.pos = { ...pt }; placeStations(); placeCards(); place(); if (P.active) say("Kamiji moved to " + label); return Promise.resolve(); }
    const from = { ...P.pos }, dist = Math.hypot(pt.u - from.u, (pt.v - from.v) * 0.8);
    if (dist < 0.01) { placeCards(); return Promise.resolve(); }
    const dir = Math.sign(pt.u - from.u) || P.dir;
    P.dir = dir; setClip("Think");
    placeStations();
    return new Promise((res) => { P.move = { from, to: pt, dir, res, label, t0: performance.now(), dur: 900 + dist * 1900, hops: Math.max(2, Math.round(dist * 9)) }; kick(); });
  }
  const goTo = (id, o) => goToPt(stationPt(id), { label: zoneOf(id).name, ...o });
  // sub-agents on the plane: small monogram walkers that leave the Conductor when spawned (cap 8 visible, the rest as +N)
  const sprites = new Map(); let spriteMore = 0;
  const LEAD_U = { "lead-contract": 0.12, "lead-conf": 0.31, "lead-web": 0.5, "lead-rust": 0.69, "lead-verify": 0.88 };
  const spotOf = (n) => { const lead = n.level === 1 ? n.id : n.parent; const sib = n.level === 1 ? 0 : (n.id.length % 3) - 1; return { u: Math.max(0.08, Math.min(0.92, (LEAD_U[lead] ?? 0.5) + sib * 0.05)), v: n.level === 1 ? 0.6 : 0.68 + (n.id.length % 3) * 0.04 }; };
  function placeSprite(sp) {
    if (!P.W) return; const p = proj(sp.u, sp.v), s = 34 * p.k * (P.small ? 0.9 : 1);
    sp.el.style.width = sp.el.style.height = s + "px"; sp.el.style.fontSize = s * 0.38 + "px";
    sp.el.style.transform = `translate(${p.x - s / 2}px, ${p.y - s}px)`;
  }
  function relayoutSprites() { sprites.forEach(placeSprite); }
  Object.assign(plane, {
    team(e, n) {
      if (n.id === "orch") return;
      let sp = sprites.get(n.id);
      if (!sp) {
        const dom = el("div", "kcd-sprite " + n.status, n.name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join(""));
        dom.setAttribute("aria-hidden", "true"); dom.title = n.name;
        const from = { u: P.rest.u, v: P.rest.v - 0.05 }; sp = { el: dom, ...from };
        spritesLayer.append(dom); sprites.set(n.id, sp); placeSprite(sp);
        if (!reduced.matches) void dom.offsetWidth;
        Object.assign(sp, spotOf(n)); placeSprite(sp);
        // cap: drop the oldest finished sprites beyond 8 and show +N
        while (sprites.size > 8) { const [k, o] = [...sprites].find(([, x]) => x.done) || [...sprites][0]; o.el.remove(); sprites.delete(k); spriteMore++; }
        moreEl.textContent = spriteMore ? "+" + spriteMore : ""; moreEl.hidden = !spriteMore;
      }
      sp.el.classList.toggle("is-done", e.status === "Done" || e.status === "Landed");
      sp.done = e.status === "Done" || e.status === "Landed";
      sp.el.classList.toggle("is-rejected", e.status === "Rejected");
      sp.el.dataset.s = e.status;
    },
    teamReset() { sprites.forEach((s) => s.el.remove()); sprites.clear(); spriteMore = 0; moreEl.hidden = true; },
  });
  const nap = (ms) => new Promise((r) => setTimeout(r, reduced.matches ? 0 : ms));
  function dropCard(id) { const c = P.cards.get(id); if (c) { c.wrap.remove(); P.cards.delete(id); P.order = P.order.filter((x) => x !== id); } }
  Object.assign(plane, {
    clear() { finishMove(); [...P.cards.keys()].forEach(dropCard); P.queue = Promise.resolve(); P.said = ""; plane.teamReset?.(); goTo("centre"); },
    show(spec, t) {
      const id = spec.zone || ZONE_BY_TYPE[spec.type] || "centre", isTeam = spec.type === "teamCard";
      P.queue = P.queue.then(async () => {
        if (t !== token) return;
        await goTo(id);
        if (t !== token) return;
        await nap(450);
        if (t !== token) return;
        const key = id + ":" + spec.type + ":" + uid++;
        const b = buildCard(spec), wrap = el("div", "kcd-pcard fresh" + (isTeam ? " is-team" : ""));
        wrap.append(b.card);
        cardsLayer.append(wrap); P.cards.set(key, { wrap, title: TITLE[spec.type](spec), team: isTeam }); wrap.dataset.open = "false";
        const act = () => { if (isTeam) { wrap.dataset.open = wrap.dataset.open === "true" ? "false" : "true"; placeCards(); } else bringForward(key); };
        wrap.addEventListener("click", (e) => { if (wrap.classList.contains("is-chip") || e.target.closest(".kcd-pcard-x")) act(); });
        wrap.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && wrap.classList.contains("is-chip") && e.target === wrap) { e.preventDefault(); act(); } });
        if (isTeam) { const x = el("button", "kcd-pcard-x", "Close"); x.type = "button"; wrap.append(x); } else P.order.push(key);
        while (P.order.length > 2) dropCard(P.order[0]);
        if (b.spec.tick) b.spec.tick.forEach((i, n) => setTimeout(() => { if (t === token) b.ctx.tick(i); }, reduced.matches ? 0 : 900 + n * 600));
        placeCards();
        requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.remove("fresh")));
        await nap(500);
      });
    },
    setActive(on) {
      if (on === P.active) return;
      P.active = on;
      if (on) { relayout(); kick(); }
      else { finishMove(); head.style.transform = ""; avBox.style.transform = ""; setClip("Idle"); kick(); }
    },
    goToPt, goTo, relayout,
    get P() { return P; },
  });
  // click / tap anywhere on the plane, and a keyboard cursor (arrow keys, Enter)
  hit.addEventListener("pointerdown", (e) => {
    if (!P.active) return;
    const r = scene.getBoundingClientRect(), pt = unproj(e.clientX - r.left, e.clientY - r.top);
    goToPt(pt, { marker: true });
  });
  hit.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.06, 0], ArrowRight: [0.06, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (d) { e.preventDefault(); P.cursor = clampPt({ u: P.cursor.u + d[0], v: P.cursor.v + d[1] }); placeTarget(P.cursor, false); target.classList.add("on", "held"); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); placeTarget(P.cursor, true); target.classList.add("held"); goToPt(P.cursor); }
  });
  hit.addEventListener("focus", () => { placeTarget(P.cursor, false); target.classList.add("on", "held"); });
  hit.addEventListener("blur", () => target.classList.remove("held"));
  stationEls.forEach((b, i) => {
    b.addEventListener("click", () => goTo(b.dataset.zone));
    b.addEventListener("keydown", (e) => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      const vis = stationEls.filter((x) => !x.hidden), j = vis.indexOf(b), n = vis[(j + k + vis.length) % vis.length];
      stationEls.forEach((x) => (x.tabIndex = x === n ? 0 : -1)); n.focus();
    });
  });
  // plane / zones visibility (persisted)
  const ptools = [...root.querySelectorAll("[data-ptool]")];
  const PKEY = "kcd.plane.v1";
  const pset = (() => { try { return { grid: true, surface: true, circles: true, ...JSON.parse(localStorage.getItem(PKEY) || "{}") }; } catch { return { grid: true, surface: true, circles: true }; } })();
  function applyPlaneOpts() {
    scene.dataset.grid = pset.grid ? "on" : "off"; scene.dataset.surface = pset.surface ? "on" : "off"; scene.dataset.circles = pset.circles ? "on" : "off";
    ptools.forEach((b) => b.setAttribute("aria-pressed", String(pset[b.dataset.ptool])));
    try { localStorage.setItem(PKEY, JSON.stringify(pset)); } catch { /* storage blocked */ }
    if (P.active && P.W) drawFloor();
  }
  ptools.forEach((b) => b.addEventListener("click", () => { pset[b.dataset.ptool] = !pset[b.dataset.ptool]; applyPlaneOpts(); store.set("_planeRev", Date.now()); }));
  applyPlaneOpts();
  new ResizeObserver(() => { if (P.active) { relayout(); kick(); } }).observe(scene);
  new ResizeObserver(() => { scene.style.setProperty("--kcd-plane-bottom", mainEl.offsetHeight + "px"); }).observe(mainEl);
  document.addEventListener("visibilitychange", kick);
  reduced.addEventListener?.("change", () => { if (reduced.matches) finishMove(); });

  // Pausable wait. Throws when a newer run has started (tab switch, replay, typing).
  async function wait(ms, t) {
    let left = ms;
    while (left > 0) {
      await new Promise((r) => setTimeout(r, 100));
      if (t !== token) throw new Error("stale");
      if ((!paused || manual) && onScreen && !document.hidden) left -= 100 * (store.get("speed") || 1);
    }
    if (t !== token) throw new Error("stale");
  }

  function addCards(turn, step, t) {
    const wrap = el("div", "kcd-cards");
    turn.append(wrap);
    return wrap;
  }
  function addCard(wrap, spec, t) {
    const b = buildCard(spec);
    wrap.append(b.card); toEnd(); sync();
    setTimeout(toEnd, 350);
    plane.show(spec, t);
    if (b.spec.tick) b.spec.tick.forEach((i, n) => setTimeout(() => { if (t === token) { b.ctx.tick(i); react({ role: "event", event: "tick" }); } }, reduced.matches ? 0 : 900 + n * 600));
    return b;
  }

  // One step of a conversation: a user line, or a thinking beat and an agent reply with cards.
  async function runStep(step, t) {
    const fast = reduced.matches;
    const w = (ms) => (fast ? Promise.resolve() : wait(ms, t));
    if (step.user) {
      setMood("neutral");
      log.append(el("p", "kcd-msg user", step.user)); sayEl.textContent = step.user; toEnd(); sync();
      audio.stop();
      react({ role: "user", text: step.user, id: step.react });
      return w(TIMING.userPause);
    }
    setMood("thinking");
    let dots = null;
    if (!fast) { dots = el("span", "kcd-think"); dots.setAttribute("aria-hidden", "true"); dots.append(el("i"), el("i"), el("i")); log.append(dots); toEnd(); }
    await w(TIMING.think);
    dots?.remove();
    const turn = el("div", "kcd-turn");
    const info = { role: "agent", text: step.agent, cards: step.cards, id: step.react };
    const rule = matchRule(info);
    const text = rule && ACCENT[rule.id] && !/\p{Extended_Pictographic}/u.test(step.agent) && store.get("reactions") ? step.agent + ACCENT[rule.id] : step.agent;
    turn.append(el("p", "kcd-msg agent", text), reactionRow());
    const cards = addCards(turn);
    log.append(turn); sayEl.textContent = text; toEnd(); sync();
    setMood(step.mood || "happy");
    if (audio.willSpeak()) { let done = false; const once = () => { if (!done) { done = true; react(info); } }; audio.speak(text, { onStart: once }); setTimeout(once, 3500); }
    else react(info);
    await w(TIMING.afterText);
    for (const spec of step.cards || []) {
      const b = addCard(cards, spec, t);
      await w(TIMING.cardGap + (b.spec.tick ? 1200 : 0));
    }
    await plane.queue;
    if (t !== token) throw new Error("stale");
    await w(500);
  }

  // Static, complete conversation (reduced motion).
  function renderAll() {
    clearLog(); plane.clear();
    CONVERSATIONS[current].steps.forEach((s) => {
      if (s.user) { log.append(el("p", "kcd-msg user", s.user)); return; }
      const turn = el("div", "kcd-turn");
      turn.append(el("p", "kcd-msg agent", s.agent), reactionRow());
      const wrap = addCards(turn);
      (s.cards || []).forEach((c) => { plane.show(c, token); const b = buildCard(c); (b.spec.tick || []).forEach((i) => b.ctx.tick(i)); wrap.append(b.card); });
      log.append(turn);
    });
    setMood("happy", "");
    log.style.scrollBehavior = "auto"; toEnd(); sync();
  }

  async function play() {
    const t = ++token;
    manual = false; dropDots(); clearLog(); plane.clear();
    log.style.scrollBehavior = "";
    setMood("neutral");
    try {
      await wait(600, t);
      for (const step of CONVERSATIONS[current].steps) await runStep(step, t);
      setMood("happy", "");
      await wait(TIMING.hold, t);
      play(); // loop the same conversation
    } catch (e) { if (e.message !== "stale") throw e; }
  }

  // The composer: the user's line, then a canned reply chosen by keyword. Stops the auto-play.
  async function ask(text) {
    text = text.trim();
    if (!text) return;
    const t = ++token;
    manual = true; dropDots();
    log.style.scrollBehavior = "";
    try {
      await runStep({ user: text }, t);
      const rep = replyFor(text);
      await runStep(/rain|storm|shower/i.test(text) && rep.cards?.[0]?.type === "weatherCard" ? { ...rep, react: "rain" } : rep, t);
    } catch (e) { if (e.message !== "stale") throw e; }
  }
  $(".kcd-form").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; ask(v); });
  input.addEventListener("input", () => { if (!manual) { token++; manual = true; dropDots(); } react({ role: "event", event: "typing" }); });
  root.querySelectorAll(".kcd-chip").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));

  function start() {
    if (reduced.matches) { token++; renderAll(); } else play();
  }
  function select(i, focus) {
    current = i;
    tabs.forEach((b, j) => { b.setAttribute("aria-selected", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    win.setAttribute("aria-labelledby", "kcd-tab-" + i); if (Number(store.get("conversation")) !== i) store.set("conversation", i);
    if (focus) tabs[i].focus();
    if (started) start();
  }
  // Roving-tabindex keys shared by the conversation tabs and the style radios.
  function arrows(list, pick) {
    list.forEach((b, i) => b.addEventListener("keydown", (e) => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (k) { e.preventDefault(); pick((i + k + list.length) % list.length, true); }
      else if (e.key === "Home") { e.preventDefault(); pick(0, true); }
      else if (e.key === "End") { e.preventDefault(); pick(list.length - 1, true); }
    }));
  }
  tabs.forEach((b, i) => b.addEventListener("click", () => select(i)));
  arrows(tabs, select);

  function setStyle(i, focus) {
    section.dataset.style = STYLES[i][0]; if (store.get("style") !== STYLES[i][0]) store.set("style", STYLES[i][0]);
    plane.setActive(STYLES[i][0] === "plane");
    styleBtns.forEach((b, j) => { b.setAttribute("aria-checked", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    if (focus) styleBtns[i].focus();
    setTimeout(toEnd, 50);
  }
  styleBtns.forEach((b, i) => b.addEventListener("click", () => setStyle(i)));
  arrows(styleBtns, setStyle);
  { const q = new URLSearchParams(location.search).get("style") || store.get("style"), i = STYLES.findIndex((s) => s[0] === q); setStyle(i < 0 ? 0 : i); const c = Number(store.get("conversation")) || 0; if (c > 0 && c < CONVERSATIONS.length) select(c); }

  replay.addEventListener("click", start);
  win.addEventListener("pointerenter", () => { paused = true; });
  win.addEventListener("pointerleave", () => { paused = false; });
  win.addEventListener("focusin", () => { paused = true; });
  win.addEventListener("focusout", () => { paused = false; });
  reduced.addEventListener?.("change", () => { if (started) start(); });

  // ---------- controls rail: live application of every setting ----------
  const planeOpts = { get: (k) => pset[k], set: (k, v) => { pset[k] = v; applyPlaneOpts(); store.set("_planeRev", Date.now()); } };
  function applySetting(k) {
    const v = store.get(k);
    if (k === "tint") { avatar.setAttribute("color", v); root.querySelector(".kcd-fallback")?.style.setProperty("background", v); }
    else if (k === "shape") avatar.setAttribute("shape", v);
    else if (k === "mouth") avatar.setAttribute("mouth", v || "none");
    else if (k === "zoom") win.style.setProperty("--kcd-zoom", String(v));
    else if (k === "clip") avatar.setAttribute("clip", v || "Idle");
    else if (k === "expression") avatar.setAttribute("expression", v || moodNow);
    else if (k === "bg") section.dataset.bg = v;
    else if (k === "height") section.dataset.height = v;
    else if (k === "style") { const i = STYLES.findIndex((s) => s[0] === v); if (i >= 0 && section.dataset.style !== v) setStyle(i); }
    else if (k === "conversation") { if (Number(v) !== current) select(Number(v)); }
    else if (k === "sound") { if (!v) audio.stop(); }
  }
  store.subscribe((k) => applySetting(k));
  ["tint", "shape", "mouth", "zoom", "clip", "expression", "bg", "height"].forEach(applySetting);
  mountRail(root.querySelector(".kcd-railhost"), {
    store, avatar, section, STYLES, CONVERSATIONS, vset, audio, planeOpts,
    replay: start, clear: () => { token++; dropDots(); clearLog(); plane.clear(); setMood("neutral"); },
    resetAll: () => { store.reset(); Object.assign(pset, { grid: true, surface: true, circles: true }); applyPlaneOpts(); },
  });

  // Load the avatar element and start playing when the section scrolls near the viewport.
  const io = new IntersectionObserver((es) => {
    onScreen = es[es.length - 1].isIntersecting; kick();
    if (onScreen && !started) { started = true; boot3d(); start(); }
  }, { threshold: 0.25 });
  io.observe(win);

  let booted = false;
  async function boot3d() {
    if (booted) return; booted = true;
    try {
      await import("../packages/kamiji-avatar/kamiji-avatar.js");
      const K = customElements.get("kamiji-avatar");
      if (!K || !K.supported()) return;
      avatar.addEventListener("kamiji-ready", () => root.querySelector(".kcd-fallback")?.remove(), { once: true });
    } catch { /* the flat circle stays */ }
  }
}

const root = document.querySelector("[data-kcd]");
if (root) init(root);
