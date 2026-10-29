// Voice lab: every control of voice.js on sample sentences in English and Japanese. Not linked from other pages.
import { createVoice } from "../voice.js";
import { mountVoiceSettings } from "../voice-settings.js";

const $ = (id) => document.getElementById(id);
const SAMPLES = [
  ["en", "Hello! I am so happy to see you today."],
  ["en", "Do you want to play with me? We can find the little star."],
  ["en", "Oh no, the rain is coming, so we must run home quickly!"],
  ["ja", "こんにちは！今日はいい天気ですね。"],
  ["ja", "いっしょに遊ぼう。おいしいお茶を飲もうよ。"],
  ["ja", "わあ、すごい！ありがとう、だいすき！"],
];
const voice = createVoice({ lang: "en", characterId: "voice-lab" });
const last = $("last"), mouth = $("mouth");
voice.onmouth = (open) => { mouth.style.height = 4 + open * 34 + "px"; mouth.style.width = 44 - open * 10 + "px"; };
voice.onstart = (i) => { last.textContent = `Speaking with ${i.engine}: ${i.voice}`; };
voice.onend = (i) => { last.textContent = i.reason === "stopped" ? "Stopped." : `Done (${i.engine}${i.fellBack ? ", fell back from the better voice" : ""}).`; };
voice.onstatus = (m) => { last.textContent = m; };

const panel = mountVoiceSettings($("panel-slot"), voice, { lang: "en", inline: true, sample: SAMPLES[0][1] });

for (const [lang, text] of SAMPLES) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = text; if (lang === "ja") b.className = "ja"; b.lang = lang; b.dataset.lang = lang;
  b.addEventListener("click", () => voice.speak(text, { lang }));
  $("samples").append(b);
}
$("say-en").addEventListener("click", () => voice.speak($("custom").value, { lang: "en" }));
$("say-ja").addEventListener("click", () => voice.speak($("custom").value, { lang: "ja" }));
$("stop").addEventListener("click", () => voice.stop());

async function status(force) {
  const dot = $("srv-dot"), msg = $("srv-msg"); msg.textContent = "Checking http://127.0.0.1:4650 ..."; dot.className = "kv-dot";
  const a = await voice.available(force);
  if (a.better) { dot.className = "kv-dot on"; msg.textContent = `Found: ${[a.qwen && "Qwen3-TTS", a.kokoro && "Kokoro"].filter(Boolean).join(" + ")}; ${a.voices.length} voices.`; }
  else { dot.className = "kv-dot off"; msg.textContent = "Not running (optional). The system voice is used."; }
  panel.refreshStatus(force);
}
$("srv-recheck").addEventListener("click", () => status(true));
status();
