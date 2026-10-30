// Playground for site/subtitles/subtitles.js. Everything here is demo wiring; the module itself is subtitles.js.
import * as SUB from "./subtitles.js";

const $ = (id) => document.getElementById(id);
const CHARS = {
  kami: { name: "Kami", shape: "circle", underline: "solid", anchor: { x: "27%", y: "38%" } },
  mochi: { name: "Mochi", shape: "square", underline: "dashed", anchor: { x: "68%", y: "42%" } },
};
const L = (id, who, text, startMs, durationMs, extra = {}) => ({ id, characterId: who, text, startMs, durationMs, ...extra });
const SAMPLES = {
  en: [
    L("e1", null, "[wind chimes]", 0, 2200, { kind: "sfx" }),
    L("e2", "kami", "Oh! You found the *old lantern*.", 500, 2600),
    L("e3", "mochi", "Shh. Someone is standing behind the door.", 3300, 2700, { parenthetical: "whispering" }),
    L("e4", "kami", "I told you yesterday, but you did not listen to me at all.", 6400, 4000),
    L("e5", "kami", "Is anybody there?", 10800, 1700, { presence: "os" }),
    L("e6", "kami", "Wait, wait!", 12800, 1500),
    L("e7", "mochi", "Look at the light!", 13300, 1500),
    L("e8", null, "Later that evening, the two friends walked home along the river.", 15200, 3800, { presence: "vo" }),
    L("e9", null, "♪ soft piano ♪", 19200, 2200, { kind: "music" }),
    L("e10", "mochi", "This line is deliberately far too long to read in such a short time.", 21600, 1800),
  ],
  ja: [
    L("j1", null, "[風鈴の音]", 0, 2200, { kind: "sfx" }),
    L("j2", "kami", "あ！古いランタンを見つけたんだね。", 500, 2800),
    L("j3", "mochi", "しーっ。ドアの後ろに誰かいるよ。", 3300, 2700, { parenthetical: "ささやき" }),
    L("j4", "kami", "昨日言ったのに、ぜんぜん聞いてくれなかったよね、もう。", 6400, 4000),
    L("j5", "kami", "誰かいますか？", 10800, 1700, { presence: "os" }),
    L("j6", "kami", "待って、待って！", 12800, 1500),
    L("j7", "mochi", "光を見て！", 13300, 1500),
    L("j8", null, "その夜、二人は川沿いを歩いて家に帰りました。", 15200, 3800, { presence: "vo" }),
    L("j9", null, "♪ やさしいピアノ ♪", 19200, 2200, { kind: "music" }),
    L("j10", "mochi", "この文はわざと長くしてあるので、こんなに短い時間では読めません。", 21600, 1800),
  ],
  ar: [
    L("a1", null, "[صوت أجراس الرياح]", 0, 2200, { kind: "sfx" }),
    L("a2", "kami", "آه! لقد وجدت *الفانوس القديم*.", 500, 2600),
    L("a3", "mochi", "هس. هناك شخص يقف خلف الباب.", 3300, 2700, { parenthetical: "همسا" }),
    L("a4", "kami", "قلت لك بالأمس، لكنك لم تستمع إلي أبدا ولا مرة واحدة.", 6400, 4000),
    L("a5", "kami", "هل من أحد هناك؟", 10800, 1700, { presence: "os" }),
    L("a6", "kami", "انتظر، انتظر!", 12800, 1500),
    L("a7", "mochi", "انظر إلى الضوء!", 13300, 1500),
    L("a8", null, "في وقت لاحق من تلك الليلة، مشى الصديقان إلى البيت على طول النهر.", 15200, 3800, { presence: "vo" }),
    L("a9", null, "♪ بيانو هادئ ♪", 19200, 2200, { kind: "music" }),
    L("a10", "mochi", "هذا السطر طويل عمدا ولا يمكن قراءته في مثل هذا الوقت القصير.", 21600, 1800),
  ],
};
const LANG_LABEL = { en: "English", ja: "日本語", ar: "العربية" };

const stage = $("stage");
const subs = SUB.createSubtitles(stage, { style: "classic", characters: CHARS, language: "en", persist: true, storageKey: "kamiji.subtitles.demo.v1" });
for (const [k, v] of Object.entries(SAMPLES)) subs.addTrack(k, v);
subs.setLanguage("en");
window.__subs = subs; // handy in the console and for tests

// ---- figures: the talking event drives the mouth (SVG stand-ins for <kamiji-avatar>) ----
subs.on("talking", (e) => {
  const m = document.querySelector(`#fig-${e.characterId} .sb-mouth`); if (!m) return;
  const rest = e.characterId === "kami" ? 1.2 : 1.2; m.setAttribute("ry", (rest + (e.speaking ? e.amplitude : 0) * 9).toFixed(2));
});
const fig = (id) => $("fig-" + id);
subs.on("lineStart", (e) => { const f = e.line.characterId && fig(e.line.characterId); if (f && e.line.kind === "dialogue") f.dataset.talk = "1"; });

// ---- controls ----
const pills = (host, items, current, onPick) => {
  host.textContent = "";
  for (const [val, label] of items) { const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = label; b.dataset.v = val; b.setAttribute("aria-pressed", String(val === current)); b.onclick = () => { onPick(val); [...host.children].forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === val))); }; host.append(b); }
};
pills($("styles"), Object.entries(SUB.STYLES).map(([k, v]) => [k, v.label]), "classic", (v) => subs.setStyle(v));
pills($("langs"), Object.entries(LANG_LABEL), "en", (v) => { subs.setLanguage(v); stage.dir = "ltr"; refreshAll(); });
pills($("place"), [["bottom", "Bottom"], ["top", "Top"], ["middle", "Middle"]], "bottom", (v) => subs.setPlacement(v));
pills($("labels"), [["change", "On speaker change"], ["always", "Always"], ["off", "Off"]], subs.settings.speakerLabels, (v) => subs.setSpeakerLabels(v));
const size = $("size"), bg = $("bg");
size.value = subs.settings.size; $("size-o").textContent = Math.round(subs.settings.size * 100) + "%";
size.oninput = () => { subs.setSize(+size.value); $("size-o").textContent = Math.round(size.value * 100) + "%"; };
if (subs.settings.bgOpacity != null) { bg.value = subs.settings.bgOpacity; $("bg-o").textContent = Math.round(bg.value * 100) + "%"; } else $("bg-o").textContent = "style default";
bg.oninput = () => { subs.setBackgroundOpacity(+bg.value); $("bg-o").textContent = Math.round(bg.value * 100) + "%"; };
const cap = $("cap"); cap.setAttribute("aria-pressed", String(subs.settings.captions)); cap.textContent = subs.settings.captions ? "On" : "Off";
cap.onclick = () => { const on = cap.getAttribute("aria-pressed") !== "true"; subs.setCaptions(on); cap.setAttribute("aria-pressed", String(on)); cap.textContent = on ? "On" : "Off"; };
$("reset").onclick = () => { subs.resetSettings(); size.value = 1; $("size-o").textContent = "100%"; $("bg-o").textContent = "style default"; cap.setAttribute("aria-pressed", "true"); cap.textContent = "On"; };
$("rm").onclick = (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); subs.setReducedMotion(on ? true : null); };
$("rate").onchange = (e) => subs.setRate(+e.target.value);

const who = $("a-who"); for (const [id, c] of Object.entries(CHARS)) who.add(new Option(c.name, id)); who.add(new Option("Narrator / sound", ""));

// ---- transport ----
const scrub = $("scrub"), timeEl = $("time"), lane = $("lane"), lctx = lane.getContext("2d");
const fmt = (ms) => { const s = ms / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; };
let dur = () => Math.max(1000, subs.duration + 1500), voicing = false;
function drawLane() {
  const r = lane.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (lane.width !== w || lane.height !== h) { lane.width = w; lane.height = h; }
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, r.width, r.height);
  const D = dur(), rows = 3, rh = r.height / rows, checks = new Map(subs.check().map((c) => [c.id, c]));
  const rowOf = (l) => (l.characterId === "kami" ? 0 : l.characterId === "mochi" ? 1 : 2);
  for (const l of subs.lines) {
    if (l.startMs == null) continue;
    const x = (l.startMs / D) * r.width, wpx = Math.max(2, (l.durationMs / D) * r.width), y = rowOf(l) * rh + 3, bad = checks.get(l.id)?.warnings.some((k) => k.code === "cps");
    lctx.fillStyle = l.kind === "sfx" || l.kind === "music" ? "#8b8b84" : l.characterId === "kami" ? "#1d1d1b" : l.characterId === "mochi" ? "#55554f" : "#a9a9a1";
    lctx.fillRect(x, y, wpx, rh - 6);
    if (bad) { lctx.strokeStyle = "#c0301b"; lctx.lineWidth = 2; lctx.setLineDash([4, 2]); lctx.strokeRect(x + 1, y + 1, wpx - 2, rh - 8); lctx.setLineDash([]); }
  }
  lctx.fillStyle = "#fff"; lctx.font = "600 10px ui-monospace, Menlo, monospace"; ["Kami", "Mochi", "Other"].forEach((n, i) => { lctx.fillStyle = "rgba(0,0,0,.45)"; lctx.fillText(n, 4, i * rh + 12); });
  const px = (subs.time / D) * r.width; lctx.fillStyle = "#c0301b"; lctx.fillRect(px - 1, 0, 2, r.height);
}
function updateReadout() {
  const t = subs.time, now = subs.lines.filter((l) => l.startMs <= t && l.endMs > t), el = $("cps-now");
  if (!now.length) { el.textContent = "-"; el.classList.remove("bad"); return; }
  const parts = now.map((l) => SUB.checkLine(l)); el.textContent = parts.map((c) => `${c.cps.toFixed(1)} cps / ${c.limit}`).join("  +  "); el.classList.toggle("bad", parts.some((c) => c.cps > c.limit));
}
function refreshWarnings() {
  const ul = $("warns"); ul.textContent = "";
  const all = subs.check(), bad = all.filter((c) => c.warnings.length); const lines = new Map(subs.lines.map((l) => [l.id, l]));
  $("cps-scene").textContent = bad.length ? `${bad.length} of ${all.length} lines flagged` : `${all.length} lines, all fine`; $("cps-scene").classList.toggle("bad", bad.length > 0);
  for (const c of bad) for (const w of c.warnings) { const li = document.createElement("li"); const s = document.createElement("strong"); s.textContent = `${fmt(lines.get(c.id).startMs)} ${w.code}`; li.append(s, " " + w.message + " "); const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = "Go to"; b.onclick = () => { subs.seek(lines.get(c.id).startMs + 200); }; li.append(b); ul.append(li); }
  if (!bad.length) { const li = document.createElement("li"); li.textContent = "No warnings in this track."; ul.append(li); }
}
function refreshAll() { updateReadout(); refreshWarnings(); drawLane(); thumbs(); }
function tickUI() {
  const D = dur(); if (document.activeElement !== scrub) scrub.value = Math.round((subs.time / D) * 1000);
  timeEl.textContent = `${fmt(subs.time)} / ${fmt(D)}`; updateReadout(); drawLane(); requestAnimationFrame(tickUI);
}
scrub.oninput = () => { subs.stopSpeaking(); voicing = false; subs.seek((+scrub.value / 1000) * dur()); };
$("b-play").onclick = () => {
  stopVoice();
  if (subs.playing) { subs.pause(); $("b-play").textContent = "Play"; return; }
  if (subs.time >= subs.duration) subs.seek(0);
  subs.play(null, { rate: +$("rate").value }); $("b-play").textContent = "Pause";
};
subs.on("ended", () => { $("b-play").textContent = "Play"; });
subs.on("state", (e) => { $("b-play").textContent = e.playing ? "Pause" : "Play"; });
async function stopVoice() { if (!voicing) return; voicing = false; subs.stopSpeaking(); subs.clear(); $("b-voice").textContent = "Play with voice"; }
$("b-voice").onclick = async () => {
  if (voicing) { await stopVoice(); return; }
  subs.pause(); subs.clear(); voicing = true; $("b-voice").textContent = "Stop voice";
  for (const l of subs.lines.filter((x) => x.kind === "dialogue" || x.kind === "narration")) {
    if (!voicing) break;
    const spoken = await subs.speak({ ...l, startMs: null }); void spoken;
  }
  voicing = false; $("b-voice").textContent = "Play with voice";
};
$("b-extend").onclick = () => { const r = SUB.autoExtend(subs.lines); subs.setTimeline(r.lines); refreshAll(); $("io-status").textContent = `Auto-extend changed ${r.changed.length} line(s); ${r.unresolved.length} still too fast (no room before the next line).`; };

// warnings also arrive as events while playing
subs.on("warning", (e) => { $("lane-note").textContent = `Warning: ${e.warnings.map((w) => w.code).join(", ")} on "${SUB.parseMarkup(e.line.text).plain.slice(0, 30)}"`; });

// ---- add a line ----
$("add").onsubmit = (e) => {
  e.preventDefault();
  const id = "n" + Math.random().toString(36).slice(2, 7), line = { id, characterId: who.value || null, text: $("a-text").value, startMs: Math.round(subs.time), durationMs: Math.round(+$("a-dur").value * 1000), presence: $("a-pres").value };
  subs.setTimeline([...subs.lines, line]); refreshAll(); subs.seek(subs.time);
};

// ---- import / export ----
const io = $("io"), status = $("io-status");
function say(msg, err) { status.textContent = msg; status.classList.toggle("err", !!err); }
function exportAs(kind) {
  const opts = { characters: CHARS, language: subs.language }, lines = subs.lines;
  io.value = kind === "srt" ? SUB.toSRT(lines, opts) : kind === "vtt" ? SUB.toVTT(lines, opts) : kind === "vttw" ? SUB.toVTT(lines, { ...opts, wordTimings: true }) : SUB.toJSON({ language: subs.language, characters: CHARS, tracks: Object.fromEntries(subs.tracks.map((k) => [k, k === subs.language ? lines : []])) });
  say(`Exported ${lines.length} lines as ${kind === "vttw" ? "WebVTT with word times" : kind.toUpperCase()}.`);
}
document.querySelectorAll("[data-exp]").forEach((b) => (b.onclick = () => exportAs(b.dataset.exp)));
function load(text) {
  const r = SUB.parseAuto(text, { characters: CHARS });
  if (r.errors.length && !r.lines.length) { say(`Could not read the file: ${r.errors.map((e) => (e.line ? `line ${e.line}: ` : "") + e.message).join(" | ")}`, true); return; }
  Object.assign(CHARS, Object.fromEntries(Object.entries(r.characters || {}).filter(([k]) => !CHARS[k]).map(([k, v]) => [k, { ...v }]))); subs.setCharacters(CHARS);
  subs.setTimeline(r.lines); subs.seek(0); refreshAll();
  say(`Loaded ${r.lines.length} lines` + (r.errors.length ? `; ${r.errors.length} problem(s): ${r.errors.slice(0, 3).map((e) => `line ${e.line}: ${e.message}`).join(" | ")}` : "") + (r.warnings.length ? `; ${r.warnings.length} warning(s)` : "") + ".", r.errors.length > 0);
}
$("file").onchange = async (e) => { const f = e.target.files[0]; if (f) { try { load(await f.text()); } catch (err) { say("Could not read that file: " + err.message, true); } } e.target.value = ""; };
$("b-load-text").onclick = () => load(io.value);
document.querySelector(".sb-file").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
document.querySelector(".sb-file").setAttribute("tabindex", "0"); document.querySelector(".sb-file").setAttribute("role", "button");

// ---- storyboard thumbnails (canvas, no DOM) ----
function thumbs() {
  const host = $("thumbs"); host.textContent = ""; const pick = subs.lines.filter((l) => l.kind !== "sfx").slice(0, 4), style = subs.style;
  for (const l of pick) {
    const c = document.createElement("canvas"); c.width = 480; c.height = 270; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 270); g.addColorStop(0, "#9a9b92"); g.addColorStop(0.7, "#d9d8cf"); g.addColorStop(1, "#3b3c38"); x.fillStyle = g; x.fillRect(0, 0, 480, 270);
    x.fillStyle = "#fff"; x.strokeStyle = "#111"; x.lineWidth = 3; x.beginPath(); x.arc(l.characterId === "mochi" ? 327 : 129, 150, 40, Math.PI, 0); x.lineTo(l.characterId === "mochi" ? 367 : 169, 200); x.lineTo(l.characterId === "mochi" ? 287 : 89, 200); x.closePath(); x.fill(); x.stroke();
    SUB.drawSubtitleToCanvas(x, l, { preset: style, size: 1.3 }, 480, 270, { characters: CHARS, progress: style === "karaoke" || style === "typewriter" ? 0.55 : 1, anchor: l.characterId === "mochi" ? { x: "68%", y: "48%" } : { x: "27%", y: "48%" } });
    const f = document.createElement("figure"), cap2 = document.createElement("figcaption"); cap2.textContent = `${fmt(l.startMs)} ${CHARS[l.characterId]?.name || "Narrator"}`; f.append(c, cap2); host.append(f);
  }
}
subs.on("style", thumbs);

new ResizeObserver(() => drawLane()).observe(lane);
subs.seek(500); refreshAll(); requestAnimationFrame(tickUI);
