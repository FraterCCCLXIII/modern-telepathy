// Kamikin chat modal (prototype). A scripted Japanese lesson with the hero character: no AI model, no network
// beyond an optional local voice server. Plain ES module, no build step. See docs/kamikin-chat.md.
//
// Pieces: LEX/WORDS (the lesson data), conversation (keyword matching and chips), subtitle stack (Yakopop-style
// word columns), voice (shared voice.js: system voice, optional local server, silent note) and the lip sync that drives the face.

import { createVoice, settings } from "../voice.js";
import { mountVoiceSettings } from "../voice-settings.js";
import { createCaptions } from "../captions.js";

const MOCHI_DIR = "../../assets/mochi/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- lesson data (words from docs/kamikin-context.md and the Season 1 episodes on the page) ----------
// Token lexicon: surface -> [romaji, gloss]. Words that are taught are listed in WORDS; the rest are helper tokens.
const EP = { 0: "Hello phrases", 1: "Hello Meadow", 2: "Pond Friends", 3: "Count the Stones", 4: "Snack Share", 6: "Song Night" };
// [kana, romaji, gloss, english keywords, episode, example line tokens, example translation]
const WORDS = [
  ["こんにちは", "konnichiwa", "hello", ["hello", "hi", "hey"], 0, ["こんにちは", "！"], "Hello!"],
  ["げんき", "genki", "well / fine", ["well", "fine", "okay"], 1, ["げんき", "？"], "Are you well?"],
  ["ひろば", "hiroba", "square / plaza", ["square", "plaza"], 1, ["ひろば", "へ", "いこう", "！"], "Let's go to the square!"],
  ["みて", "mite", "look!", ["look", "see"], 2, ["みて", "！", "きつね", "だよ", "！"], "Look! It's a fox!"],
  ["きつね", "kitsune", "fox", ["fox"], 2, ["これ", "は", "きつね", "だよ"], "This is a fox."],
  ["みず", "mizu", "water", ["water"], 2, ["みず", "が", "あるよ", "！"], "There is water!"],
  ["かわいい", "kawaii", "cute", ["cute"], 2, ["きつね", "、", "かわいい", "！"], "The fox is so cute!"],
  ["いし", "ishi", "stone", ["stone", "stones", "rock"], 3, ["いし", "だよ"], "It's a stone."],
  ["ふたつ", "futatsu", "two (things)", ["two"], 3, ["いし", "が", "ふたつ", "！"], "Two stones!"],
  ["みっつ", "mittsu", "three (things)", ["three"], 3, ["いし", "が", "みっつ", "！"], "Three stones!"],
  ["これ", "kore", "this", ["this"], 3, ["これ", "は", "いし", "？"], "Is this a stone?"],
  ["それ", "sore", "that", ["that"], 3, ["それ", "は", "いし", "だよ"], "That is a stone."],
  ["ちょうちん", "chōchin", "lantern", ["lantern", "lanterns"], 3, ["これ", "は", "ちょうちん", "だよ"], "This is a lantern."],
  ["ください", "kudasai", "please (give me)", ["please"], 4, ["みず", "、", "ください"], "Water, please."],
  ["おいしい", "oishii", "delicious", ["delicious", "tasty", "yummy"], 4, ["これ", "、", "おいしい", "！"], "This is delicious!"],
  ["あか", "aka", "red", ["red"], 4, ["これ", "は", "あか", "だよ"], "This is red."],
  ["あお", "ao", "blue", ["blue"], 4, ["これ", "は", "あお", "だよ"], "This is blue."],
  ["しろ", "shiro", "white", ["white"], 4, ["これ", "は", "しろ", "だよ"], "This is white."],
  ["ごめんね", "gomen ne", "sorry", ["sorry"], 4, ["ごめんね", "！"], "Sorry!"],
  ["ありがとう", "arigatō", "thank you", ["thanks", "thank"], 0, ["ありがとう", "！"], "Thank you!"],
  ["おやすみ", "oyasumi", "good night", ["night", "goodnight"], 6, ["おやすみ", "！"], "Good night!"],
  ["またね", "mata ne", "see you", ["bye", "goodbye", "later"], 0, ["またね", "！"], "See you!"],
].map(([s, r, g, keys, ep, ex, exEn]) => ({ s, r, g, keys, ep, ex, exEn }));
const HELPERS = {
  "は": ["wa", "topic marker"], "が": ["ga", "subject marker"], "へ": ["e", "to (toward)"], "だよ": ["da yo", "it is!"],
  "いこう": ["ikō", "let's go"], "あるよ": ["aru yo", "there is"], "うん": ["un", "yes / yeah"],
};
const PUNCT = new Set(["！", "？", "、", "。"]);
const byKana = new Map(WORDS.map((w) => [w.s, w]));
const tokenOf = (s) => {
  if (PUNCT.has(s)) return { s, punct: true };
  const w = byKana.get(s);
  if (w) return { s, r: w.r, g: w.g, ep: w.ep };
  const h = HELPERS[s];
  return { s, r: h[0], g: h[1], particle: true };
};
const lineOf = (tokens, en) => ({ tokens: tokens.map(tokenOf), en });
const plainOf = (line) => line.tokens.map((t) => (t.s === "！" || t.s === "？" || t.s === "。" ? "" : t.s)).join("");

const HELLO_PHRASES = ["こんにちは", "ありがとう", "おやすみ", "またね"];
const POINT_AT = ["いし", "ちょうちん", "きつね", "みず"];
const POINT_EN = { "いし": "This is a stone.", "ちょうちん": "This is a lantern.", "きつね": "This is a fox.", "みず": "This is water." };

// ---------- small helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 40) : ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem(`kamikin.chat.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`kamikin.chat.${k}`, JSON.stringify(v)); } catch { /* storage may be blocked */ } },
};
const prefs = { kana: store.get("kana", true), romaji: store.get("romaji", true), meaning: store.get("meaning", true), auto: store.get("auto", false) };

// ---------- character ----------
let index = [];
let charId = (/^#character=(.+)$/.exec(location.hash) || [])[1] ? decodeURIComponent(/^#character=(.+)$/.exec(location.hash)[1]) : "kamikin-player";
const meta = (id) => index.find((c) => c.id === id) || { id, name: id.replace("kamikin-", ""), species: "mochi", persona: "" };
const currentId = () => (window.kamikinHero && window.kamikinHero.id) || charId;
const capName = () => cap(meta(currentId()).name); // for the caption speaker
const indexReady = fetch(`${MOCHI_DIR}index.json`).then((r) => r.json()).then((d) => { index = d.characters || []; }).catch(() => {});

function syncOpeners() {
  const m = meta(currentId());
  document.querySelectorAll("[data-kc-open]").forEach((b) => b.setAttribute("aria-label", `Chat with ${cap(m.name)}`));
}
window.addEventListener("kamikin:character", (e) => { charId = e.detail.id; indexReady.then(syncOpeners); });
indexReady.then(syncOpeners);

// ---------- voice: the shared layer (site/voice.js): system voice by default, local better voice if chosen ----------
// One createVoice() per character (its characterId picks the better-voice base voice and a small pitch offset).
let caps = null; // captions.js controller (created with the dialog)
const voice = (() => {
  let v = null, forId = null, onFace = () => {}, onState = () => {};
  // Mouth openness 0..1 -> the six face textures (the mochi have no mouth shapes, only these faces).
  const faceOf = (o) => (o > 0.6 ? "surprised" : o > 0.3 ? "happy" : "neutral");
  let lastFace = "neutral", lastAt = 0;
  const mouth = (o) => {
    const f = reduceMotion ? (o > 0.15 ? "happy" : "neutral") : faceOf(o), now = performance.now();
    if (f !== lastFace && now - lastAt > 70) { lastFace = f; lastAt = now; onFace(f); }
  };
  function current() {
    const id = currentId();
    if (v && forId === id) return v;
    if (v) v.stop();
    forId = id;
    v = createVoice({ lang: "ja", characterId: id });
    v.onmouth = (o) => { if (!caps || !caps.drivesMouth()) mouth(o); }; // real word boundaries (captions) drive the face instead when present
    v.onboundary = (e) => caps?.boundary(e);
    v.onstart = (info) => { onState(info && info.engine === "system" ? "browser" : "server"); caps?.started(info); };
    v.onend = () => { caps?.end(); lastFace = "neutral"; onFace("neutral"); onState(null); };
    return v;
  }
  /** Resolves "server", "browser", "none" or "cancelled". speed multiplies the user's speed settings. */
  async function speak(text, { speed = 1 } = {}) {
    const vv = current(), s = settings.values;
    const noSystem = typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined";
    if (noSystem && s.mode !== "better") return "none";
    caps?.setCharacter(currentId(), capName());
    caps?.begin({ text, lang: "ja", rate: rateOf(s, speed) });
    const r = await vv.speak(text, { lang: "ja", settings: { rate: Math.min(2, s.rate * speed), speed: Math.min(1.5, Math.max(0.6, s.speed * speed)) } });
    if (!r || r.engine === null) { caps?.end(); return "cancelled"; }
    if (r.engine === "system") return noSystem ? "none" : "browser";
    return "server";
  }
  const rateOf = (s, speed) => (s.mode === "better" ? s.speed : s.rate) * speed;
  /** talking event from the captions: amplitude 0..1 per syllable, 0 between words */
  function talk(e) { mouth(e.speaking ? e.amplitude : 0); }
  return { speak, talk, stop() { if (v) v.stop(); caps?.end(); }, current, set onFace(f) { onFace = f; }, set onState(f) { onState = f; } };
})();

// ---------- conversation state (per character, kept while the page is open) ----------
const convos = new Map();
const convoOf = (id) => {
  if (!convos.has(id)) convos.set(id, { msgs: [], taught: [], next: 0, last: null, quiz: null, point: 0, greeted: false });
  return convos.get(id);
};

// ---------- UI ----------
let dlg, list, chipsEl, form, input, card, noteEl, avatar, titleEl, subEl, autoBtn, layerBtns = {}, opener = null, busy = 0;
let moodT = 0, speaking = false, cardPinned = false, cardFor = null, audioNote = false;

function build() {
  dlg = el("dialog", "kc-dialog");
  dlg.innerHTML = `
    <div class="kc-sheet">
      <header class="kc-head">
        <div class="kc-avatar" aria-hidden="true"></div>
        <div class="kc-who"><h2 id="kc-title"></h2><p class="kc-sub"></p></div>
        <span class="kc-badge" title="Scripted lines, no AI model">Prototype</span>
        <button type="button" class="kc-x" aria-label="Close chat"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></button>
      </header>
      <div class="kc-tools" role="group" aria-label="Subtitle layers and audio">
        <span class="kc-tools-l" aria-hidden="true">Show</span>
        <button type="button" class="kc-tog" data-layer="kana" aria-pressed="true"><span lang="ja">かな</span> Kana</button>
        <button type="button" class="kc-tog" data-layer="romaji" aria-pressed="true">Rōmaji</button>
        <button type="button" class="kc-tog" data-layer="meaning" aria-pressed="true">Meaning</button>
        <button type="button" class="kc-tog kc-cc" aria-pressed="true">Captions</button>
        <button type="button" class="kc-tog kc-auto" role="switch" aria-checked="false">Auto-play</button>
        <span class="kc-voiceslot"></span>
      </div>
      <div class="kc-listwrap">
        <ol class="kc-list" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></ol>
        <div class="kc-caps"></div>
      </div>
      <p class="kc-note" role="status" hidden></p>
      <div class="kc-chips" role="group" aria-label="Quick replies"></div>
      <form class="kc-form" autocomplete="off">
        <input class="kc-input" type="text" maxlength="120" aria-label="Type a message" placeholder="Type a word or a question" enterkeyhint="send" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button type="submit" class="kc-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 11.5L20 4l-6 16-3-7z" fill="currentColor"/></svg></button>
      </form>
      <p class="kc-foot">Typed text stays in this page; audio uses your device's voice, or an optional local voice server on localhost:4650 if you choose Better voice.</p>
    </div>
    <div class="kc-card" role="tooltip" id="kc-card" hidden></div>`;
  document.body.append(dlg);
  list = $(".kc-list", dlg); chipsEl = $(".kc-chips", dlg); form = $(".kc-form", dlg); input = $(".kc-input", dlg);
  card = $(".kc-card", dlg); noteEl = $(".kc-note", dlg); avatar = $(".kc-avatar", dlg); titleEl = $("#kc-title", dlg); subEl = $(".kc-sub", dlg);
  autoBtn = $(".kc-auto", dlg);
  dlg.querySelectorAll("[data-layer]").forEach((b) => { layerBtns[b.dataset.layer] = b; b.addEventListener("click", () => toggleLayer(b.dataset.layer)); });
  applyPrefs();
  autoBtn.addEventListener("click", () => { prefs.auto = !prefs.auto; store.set("auto", prefs.auto); applyPrefs(); });
  $(".kc-x", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });       // the backdrop
  let popWasOpen = false;                                                                     // Esc closes the voice popover first, not the dialog
  dlg.addEventListener("keydown", (e) => { if (e.key === "Escape") popWasOpen = !!dlg.querySelector(".kv-panel:not([hidden])"); }, true);
  dlg.addEventListener("cancel", (e) => { if (popWasOpen) { popWasOpen = false; e.preventDefault(); } else if (!card.hidden) { e.preventDefault(); hideCard(true); } });  // first Esc closes a word card
  dlg.addEventListener("close", onClose);
  dlg.addEventListener("pointerdown", (e) => { if (!e.target.closest(".kc-tok, .kc-card")) hideCard(true); });
  list.addEventListener("scroll", () => hideCard(true), { passive: true });
  form.addEventListener("submit", (e) => { e.preventDefault(); const t = input.value.trim(); input.value = ""; if (t) userSays(t); });
  const voiceForSettings = { // always the current character's voice, so Test and Stop act on the live instance
    speak: (t, o) => { caps.setCharacter(currentId(), capName()); caps.begin({ text: t, lang: "ja", rate: settings.values.mode === "better" ? settings.values.speed : settings.values.rate }); return voice.current().speak(t, o); }, stop: () => voice.stop(),
    systemVoices: (l) => voice.current().systemVoices(l), available: (f) => voice.current().available(f) };
  // Captions: word-synced while the character speaks; default on (accessibility), settings shared with the voice panel and the Captions toggle.
  caps = createCaptions($(".kc-caps", dlg), { characterId: currentId(), name: capName(), lang: "ja", onTalking: (e) => voice.talk(e) });
  const ccBtn = $(".kc-cc", dlg);
  caps.subscribe((c) => ccBtn.setAttribute("aria-pressed", String(c.captions)));
  ccBtn.setAttribute("aria-pressed", String(caps.settings.captions));
  ccBtn.addEventListener("click", () => caps.set({ captions: !caps.settings.captions }));
  caps.preload();
  mountVoiceSettings($(".kc-voiceslot", dlg), voiceForSettings, { captions: caps, lang: "ja", sample: "こんにちは！ げんき？", label: "Voice" });
  voice.onFace = (f) => setFace(f);
  voice.onState = (s) => { speaking = !!s; dlg.classList.toggle("kc-speaking", !!s); };
}

function applyPrefs() {
  for (const k of ["kana", "romaji", "meaning"]) { layerBtns[k].setAttribute("aria-pressed", String(prefs[k])); list.dataset[k] = prefs[k] ? "1" : "0"; }
  autoBtn.setAttribute("aria-checked", String(prefs.auto));
}
function toggleLayer(k) {
  // keep at least one of kana and rōmaji visible so a line never turns blank
  if (prefs[k] && ((k === "kana" && !prefs.romaji) || (k === "romaji" && !prefs.kana))) return;
  prefs[k] = !prefs[k]; store.set(k, prefs[k]); applyPrefs();
}

// avatar: the character's face texture, cropped to the face. Swaps with the lip sync.
const FACE_PNG = new Set(["neutral", "blink", "happy", "joy", "surprised", "sad"]);
function setFace(f, heroToo = true) {
  if (!FACE_PNG.has(f)) f = "neutral";
  avatar.style.backgroundImage = `url("${MOCHI_DIR}${currentId()}.faces/${f}.png")`;
  if (heroToo && window.kamikinHero) window.kamikinHero.setFace(f);
}

// ---- subtitle stack: one Japanese line ----
function renderLine(line, voiceId) {
  const wrap = el("div", "kc-line");
  if (line.tokens.filter((t) => !t.punct).length === 1) wrap.classList.add("kc-one");
  const row = el("div", "kc-words"); row.lang = "ja";
  line.tokens.forEach((t) => {
    if (t.punct) { row.append(el("span", "kc-punct", t.s)); return; }
    const b = el("button", `kc-tok${t.particle ? " kc-part" : ""}`);
    b.type = "button";
    b.setAttribute("aria-label", `${t.s}, ${t.r}, ${t.g}`);
    b.append(el("span", "kc-s", t.s), el("span", "kc-r", t.r), el("span", "kc-g", t.g));
    b.querySelectorAll("span").forEach((s) => (s.lang = s.classList.contains("kc-s") ? "ja" : "en"));
    b.addEventListener("mouseenter", () => showCard(b, t, false));
    b.addEventListener("mouseleave", () => hideCard(false));
    b.addEventListener("focus", () => showCard(b, t, false));
    b.addEventListener("blur", () => hideCard(false));
    b.addEventListener("click", () => { showCard(b, t, true); say(t.s, voiceId, 0.9); });
    row.append(b);
  });
  const foot = el("div", "kc-linefoot");
  const en = el("p", "kc-en", line.en);
  const play = el("button", "kc-play"); play.type = "button";
  play.setAttribute("aria-label", `Play: ${line.en}`);
  play.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>';
  play.addEventListener("click", () => say(plainOf(line), voiceId, 1));
  foot.append(en, play);
  wrap.append(row, foot);
  return wrap;
}

// ---- word card ----
function showCard(btn, t, pin) {
  if (pin) cardPinned = true; else if (cardPinned && cardFor !== btn) cardPinned = false;
  cardFor = btn;
  const w = byKana.get(t.s);
  card.replaceChildren(
    Object.assign(el("b", "kc-card-s", t.s), { lang: "ja" }),
    el("span", "kc-card-r", t.r),
    el("span", "kc-card-g", t.g),
    el("span", "kc-card-m", w ? `Word from ${EP[w.ep]}. Tap to hear it.` : "A small helper word. Tap to hear it."),
  );
  card.hidden = false;
  btn.setAttribute("aria-describedby", "kc-card");
  const r = btn.getBoundingClientRect(), dr = dlg.getBoundingClientRect();
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let x = Math.min(Math.max(r.left + r.width / 2 - cw / 2, dr.left + 8), dr.right - cw - 8);
  let y = r.top - ch - 8; if (y < dr.top + 8) y = r.bottom + 8;
  card.style.left = `${x}px`; card.style.top = `${y}px`;
}
function hideCard(force) {
  if (cardPinned && !force) return;
  if (!force && cardFor && document.activeElement === cardFor) return;
  card.hidden = true; cardPinned = false;
  if (cardFor) { cardFor.removeAttribute("aria-describedby"); cardFor = null; }
}

// ---- messages ----
function addMsg(m, persist = true) {
  const c = convoOf(currentId());
  if (persist) c.msgs.push(m);
  const li = el("li", `kc-msg ${m.who === "me" ? "kc-me" : "kc-bot"}${m.kind === "typing" ? " kc-typing" : ""}`);
  if (m.kind === "ja") li.append(renderLine(m.line, currentId()));
  else if (m.kind === "typing") { li.setAttribute("aria-label", "typing"); li.append(el("i"), el("i"), el("i")); }
  else li.append(el("p", "kc-text", m.text));
  list.append(li);
  list.scrollTop = list.scrollHeight;
  return li;
}
function renderAll() {
  list.replaceChildren();
  convoOf(currentId()).msgs.forEach((m) => addMsg(m, false));
  list.scrollTop = list.scrollHeight;
}

async function say(text, _who, speed) {
  hideAudioNote();
  const res = await voice.speak(text, { speed });
  if (res === "none") showAudioNote();
}
function showAudioNote() {
  noteEl.hidden = false;
  noteEl.textContent = "No audio: this browser has no speech voice. Install a Japanese voice, or start the optional local voice server (tools/voice-server/run.sh) and pick Better voice in the voice settings.";
  list.scrollTop = list.scrollHeight;
}
function hideAudioNote() { noteEl.hidden = true; }

// A character reply: optional pause, then lines one by one. Japanese lines can auto-play.
async function botSays(parts) {
  const my = ++busy;
  setChips([]);
  for (const p of parts) {
    if (my !== busy || !dlg.open) return;
    const t = addMsg({ who: "bot", kind: "typing" }, false);
    await sleep(p.kind === "ja" ? 650 : 480);
    t.remove();
    list.scrollTop = list.scrollHeight;
    if (my !== busy) return;
    const m = typeof p === "string" ? { who: "bot", kind: "text", text: p } : { who: "bot", ...p };
    addMsg(m);
    if (m.kind === "ja") {
      convoOf(currentId()).last = m.line;
      if (m.mood) { setFace(m.mood); clearTimeout(moodT); moodT = setTimeout(() => { if (!speaking) setFace("neutral"); }, 1800); }
      if (prefs.auto) say(plainOf(m.line), currentId(), m.speed || 1);
    }
  }
  if (my === busy) { setChips(chipsFor()); }
}
const ja = (tokens, en, extra = {}) => ({ kind: "ja", line: lineOf(tokens, en), ...extra });

// ---- the script ----
function chipsFor() {
  const c = convoOf(currentId());
  if (c.quiz) return [...c.quiz.options.map((o) => ({ label: o.label, ja: o.ja, run: () => answer(o.value) })), { label: "Skip", run: () => { c.quiz = null; botSays(["No problem. We can try another one."]); } }];
  if (c.taught.length) return [{ label: "Say it again", run: sayAgain }, { label: "Teach me a word", run: teach }, { label: "Quiz me", run: quiz }, { label: "What is this?", run: whatIsThis }, { label: "Hello", run: hello }];
  return [{ label: "Hello", run: hello }, { label: "What is this?", run: whatIsThis }, { label: "Teach me a word", run: teach }, { label: "Say it again", run: sayAgain }, { label: "Quiz me", run: quiz }];
}
function setChips(chips) {
  chipsEl.replaceChildren();
  chips.forEach((c) => {
    const b = el("button", "kc-chip", c.label); b.type = "button";
    if (c.ja) b.lang = "ja";
    b.addEventListener("click", () => { userSays(c.label, c.run); });
    chipsEl.append(b);
  });
}

function greet() {
  const c = convoOf(currentId()); if (c.greeted) return; c.greeted = true;
  const m = meta(currentId());
  const flavour = (m.persona || "").split(":")[1];
  const intro = `Hi! I'm ${cap(m.name)}, a ${m.species || "mochi"} friend.${flavour ? ` ${cap(flavour.trim())}` : ""}`;
  botSays([intro, ja(["こんにちは", "！"], "Hello!", { mood: "happy" }), "Tap a word to see it and hear it. Pick a reply below or type your own."]);
}
function hello() { botSays([ja(["こんにちは", "！"], "Hello!", { mood: "happy" }), ja(["げんき", "？"], "Are you well?")]); taught("こんにちは"); taught("げんき"); }
function taught(kana) { const c = convoOf(currentId()); if (!c.taught.includes(kana)) c.taught.push(kana); }

function whatIsThis() {
  const c = convoOf(currentId());
  const k = POINT_AT[c.point++ % POINT_AT.length]; const w = byKana.get(k);
  taught("これ"); taught(k);
  const sore = c.point % 2 === 0;
  botSays([
    sore ? "Look near you. That one over there:" : "I'm pointing at something right here:",
    ja([sore ? "それ" : "これ", "は", k, "だよ"], POINT_EN[k].replace("This", sore ? "That" : "This"), { mood: "happy" }),
    `${k} (${w.r}) means "${w.g}". ${sore ? "それ points to something near you, これ to something near me." : ""}`.trim(),
  ]);
  taught("それ");
}

function teach() {
  const c = convoOf(currentId());
  let w = WORDS.find((x) => !c.taught.includes(x.s));
  const again = !w;
  if (again) { w = WORDS[0]; c.taught.length = 0; }
  taught(w.s);
  botSays([
    ...(again ? ["You have met every word! Let's go around again."] : []),
    `New word from ${EP[w.ep]}:`,
    ja([w.s], w.g, { mood: "happy" }),
    ...(w.ex.length <= 2 && w.ex[0] === w.s && (!w.ex[1] || PUNCT.has(w.ex[1])) ? [] : [ja(w.ex, w.exEn)]),
    "Tap the speaker to hear it, or say it back.",
  ]);
}

function sayAgain() {
  const c = convoOf(currentId());
  if (!c.last) { botSays(["I haven't said anything in Japanese yet. Try Hello!"]); return; }
  botSays(["Slowly this time:", { kind: "ja", line: c.last, speed: 0.75, mood: "happy" }]);
}

function pool(exceptKana) { return WORDS.filter((w) => w.s !== exceptKana); }
function quiz() {
  const c = convoOf(currentId());
  if (!c.taught.length) { botSays(["We need a word first. Let's start with one."]); setTimeout(teach, 1400); return; }
  const kana = c.taught[Math.floor(Math.random() * c.taught.length)];
  const target = byKana.get(kana);
  const wrong = pool(kana).sort(() => Math.random() - 0.5).slice(0, 2);
  const type = Math.random() < 0.5 ? "meaning" : "kana";
  const opts = [target, ...wrong].sort(() => Math.random() - 0.5);
  c.quiz = type === "meaning"
    ? { target, type, options: opts.map((w) => ({ label: w.g, value: w.s })) }
    : { target, type, options: opts.map((w) => ({ label: w.s, ja: true, value: w.s })) };
  if (type === "meaning") botSays([`Quiz time! What does this mean?`, ja([target.s], target.g)]);
  else botSays([`Quiz time! Which one is "${target.g}"?`]);
}
function answer(value) {
  const c = convoOf(currentId()); const q = c.quiz; if (!q) return false;
  if (value === q.target.s) {
    c.quiz = null;
    const mood = { mood: "joy" };
    botSays([`Yes! ${q.target.s} (${q.target.r}) is "${q.target.g}".`, ja(q.target.ex, q.target.exEn, mood)]);
    return true;
  }
  q.misses = (q.misses || 0) + 1;
  if (q.misses >= 2) { c.quiz = null; botSays([`Nearly. It is ${q.target.s} (${q.target.r}), "${q.target.g}".`, ja([q.target.s], q.target.g)]); return true; }
  botSays(["Not quite. Have another look."]); setFace("sad");
  setTimeout(() => setFace("neutral"), reduceMotion ? 0 : 900);
  return true;
}

const norm = (s) => s.toLowerCase().replace(/[!?.,、。！？]/g, " ").replace(/\s+/g, " ").trim();
function findWord(text) {
  const t = norm(text); const words = new Set(t.split(" "));
  for (const w of [...WORDS].sort((a, b) => b.s.length - a.s.length)) {
    if (t.includes(w.s) || words.has(norm(w.r)) || (w.r.includes(" ") && t.includes(w.r)) || w.keys.some((k) => words.has(k))) return w;
  }
  return null;
}
function explain(w) {
  taught(w.s);
  botSays([`${w.s} is "${w.g}" (${w.r}), from ${EP[w.ep]}.`, ja([w.s], w.g, { mood: "happy" }), ja(w.ex, w.exEn)]);
}

function userSays(text, run) {
  hideAudioNote();
  addMsg({ who: "me", kind: "text", text });
  if (run) { run(); return; }
  const c = convoOf(currentId()); const t = norm(text);
  if (c.quiz) {
    const q = c.quiz; const keys = [q.target.s, norm(q.target.r), ...q.target.keys, norm(q.target.g)];
    const hit = keys.some((k) => t === k || t.split(" ").includes(k));
    if (hit) { answer(q.target.s); return; }
    if (/skip|stop|no more/.test(t)) { c.quiz = null; botSays(["No problem. We can try another one."]); return; }
    if (!/quiz/.test(t)) { answer("?"); return; }
  }
  if (/what('?s| is) (this|that|it)|これ.*なに|なに.*これ/.test(t)) return whatIsThis();
  if (/quiz|test me|question/.test(t)) return quiz();
  if (/again|repeat|slow|もういち/.test(t)) return sayAgain();
  if (/thank|ありがとう|arigato/.test(t)) { taught("ありがとう"); return botSays(["You're welcome!", ja(["ありがとう", "！"], "Thank you!", { mood: "joy" })]); }
  if (/bye|see you|goodbye|またね|mata ne/.test(t)) { taught("またね"); return botSays([ja(["またね", "！"], "See you!", { mood: "happy" })]); }
  if (/good ?night|sleep|おやすみ|oyasumi/.test(t)) { taught("おやすみ"); return botSays([ja(["おやすみ", "！"], "Good night!", { mood: "happy" })]); }
  if (/sorry|ごめん|gomen/.test(t)) { taught("ごめんね"); return botSays(["That's okay!", ja(["ごめんね", "！"], "Sorry!"), "That is how you say sorry, between friends."]); }
  if (/\b(hello|hi|hey)\b|こんにちは|konnichiwa/.test(t)) return hello();
  const w = findWord(text);
  if (w) return explain(w);
  if (/teach|new word|learn|next|word/.test(t)) return teach();
  botSays(["Hmm, I only know a few words so far, and I can't answer everything yet. Try one of these:"]);
}

// ---------- open and close ----------
async function open(from) {
  await indexReady;
  if (!dlg) build();
  opener = from || document.activeElement;
  const id = currentId(); charId = id;
  const m = meta(id);
  titleEl.textContent = `${cap(m.name)}`;
  subEl.textContent = `${m.species || "mochi"} · Kamikin`;
  dlg.setAttribute("aria-label", `Chat with ${cap(m.name)}`);
  setFace("neutral", false);
  renderAll();
  hideAudioNote(); hideCard(true);
  document.documentElement.classList.add("kc-lock");
  dlg.showModal();
  const c = convoOf(id);
  if (!c.greeted) greet(); else setChips(chipsFor());
  input.focus({ preventScroll: true });
}
function onClose() {
  busy++; voice.stop(); hideCard(true); hideAudioNote();
  document.documentElement.classList.remove("kc-lock");
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
}

document.querySelectorAll("[data-kc-open]").forEach((b) => b.addEventListener("click", () => open(b)));
