// node --test site/subtitles/subtitles.test.mjs   (no dependencies)
import test from "node:test";
import assert from "node:assert/strict";
import * as S from "./subtitles.js";

const lens = (pages) => pages.flat().map((s) => S.textWidth(s));

test("splitLines: short text stays on one line", () => {
  assert.deepEqual(S.splitLines("Hello there!"), [["Hello there!"]]);
});
test("splitLines: 2 balanced lines under the limit, break after punctuation", () => {
  const p = S.splitLines("I told you yesterday, but you did not listen to me at all.", { maxChars: 37 });
  assert.equal(p.length, 1); assert.equal(p[0].length, 2);
  for (const n of lens(p)) assert.ok(n <= 37, "line " + n);
  assert.equal(p[0][0], "I told you yesterday,");
});
test("splitLines: never ends a line on a function word when avoidable", () => {
  const p = S.splitLines("We are going to walk along the river and then the old bridge", { maxChars: 37 });
  assert.ok(!/\b(the|and|to|a)$/.test(p[0][0]), p[0][0]);
});
test("splitLines: long text paginates, max 2 lines per page, 32-42 chars", () => {
  const long = "This is a much longer speech. It keeps going for a while, with several sentences, so that it cannot possibly fit into two lines of a subtitle.";
  const p = S.splitLines(long, { maxChars: 40 });
  assert.ok(p.length >= 2);
  for (const pg of p) { assert.ok(pg.length <= 2); for (const l of pg) assert.ok(S.textWidth(l) <= 40, l); }
  assert.equal(p.flat().join(" ").replace(/\s+/g, " "), long);
});
test("splitLines: honours authored newlines when they fit", () => {
  assert.deepEqual(S.splitLines("Wait.\nWhat?"), [["Wait.", "What?"]]);
});
test("splitLines: a word longer than the line is hard-split", () => {
  const p = S.splitLines("x".repeat(50), { maxChars: 20, maxLines: 3 });
  for (const l of p.flat()) assert.ok(l.length <= 20);
  assert.equal(p.flat().join(""), "x".repeat(50));
});
test("splitLines: custom measure wraps by pixel width", () => {
  const p = S.splitLines("one two three four five six", { measure: (s) => s.length * 10, maxWidth: 100, maxLines: 3 });
  for (const l of p.flat()) assert.ok(l.length * 10 <= 100);
});
test("markup: <i> and *x* give italics, plain text is clean", () => {
  const m = S.parseMarkup("a <i>b c</i> and *d* e");
  assert.equal(m.plain, "a b c and d e"); assert.equal(m.spans.length, 2);
  assert.equal(m.plain.slice(m.spans[0].c0, m.spans[0].c1), "b c");
});
test("CJK: breaks inside the line without leading closing punctuation (kinsoku)", () => {
  const t = "今日はとても良い天気ですね。散歩に行きませんか、それとも家でゆっくりしますか？";
  const p = S.splitLines(t, { lang: "ja", maxChars: 32 });
  for (const l of p.flat()) { assert.ok(S.textWidth(l) <= 32, l); assert.ok(!/^[、。？！」]/.test(l), l); }
  assert.equal(p.flat().join(""), t);
  assert.equal(S.defaultMaxChars(t, "ja"), 32);
});
test("RTL: direction detected, text split on word boundaries", () => {
  const t = "مرحبا بك في عالم الترجمة النصية للشخصيات المتحركة في المشهد الأول";
  const lay = S.layoutText(t, { lang: "ar", maxChars: 30 });
  assert.equal(lay.dir, "rtl");
  for (const p of lay.pages) for (const l of p.lines) assert.ok(S.textWidth(l.text) <= 30);
  assert.equal(lay.pages.flatMap((p) => p.lines.map((l) => l.text)).join(" "), t);
  assert.equal(S.detectDir("שלום עולם"), "rtl"); assert.equal(S.detectDir("Hello"), "ltr");
});

test("estimateWordTimes: covers the duration, monotonic, pauses at punctuation", () => {
  const w = S.estimateWordTimes("Well, I think so. Maybe!", 3000);
  assert.equal(w.length, 5); assert.equal(w[0].startMs, 0); assert.equal(w.at(-1).endMs, 3000);
  for (let i = 1; i < w.length; i++) { assert.ok(w[i].startMs >= w[i - 1].endMs); assert.ok(w[i].endMs > w[i].startMs); }
  assert.ok(w[1].startMs - w[0].endMs > 0, "pause after comma");
});
test("estimateWordTimes: longer words get more time", () => {
  const w = S.estimateWordTimes("a extraordinarily", 2000);
  assert.ok(w[1].endMs - w[1].startMs > 2 * (w[0].endMs - w[0].startMs));
});
test("syllables heuristic", () => {
  assert.deepEqual(["cat", "water", "make", "little", "beautiful", "I"].map(S.syllables), [1, 2, 1, 2, 3, 1]);
  assert.equal(S.syllables("こんにちは"), 5); assert.equal(S.syllables("きょう"), 2);
});
test("estimateDurationMs follows 2.7 words per second", () => {
  const d = S.estimateDurationMs("one two three four five six seven eight nine ten"); // 10 words
  assert.ok(Math.abs(d - 3704) < 50, String(d));
});
test("mouthAmplitude: open inside words, closed in gaps and outside", () => {
  const w = S.estimateWordTimes("Hello, wonderful world.", 3000);
  assert.equal(S.mouthAmplitude(w, -5).open, 0);
  const mid = (w[1].startMs + w[1].endMs) / 2; assert.equal(S.mouthAmplitude(w, mid).speaking, true);
  assert.equal(S.mouthAmplitude(w, w[0].endMs + 1).open, 0);
  assert.equal(S.mouthAmplitude(w, 9999).speaking, false);
  let max = 0; for (let t = w[1].startMs; t < w[1].endMs; t += 5) max = Math.max(max, S.mouthAmplitude(w, t).open);
  assert.ok(max > 0.8 && max <= 1);
});

test("cps warnings: fast, short, long, pages", () => {
  const fast = S.checkLine({ text: "This sentence is quite a bit too long for this time.", startMs: 0, durationMs: 1500 });
  assert.ok(fast.cps > 17); assert.ok(fast.warnings.some((w) => w.code === "cps")); assert.ok(fast.warnings.find((w) => w.code === "cps").needMs > 1500);
  assert.ok(S.checkLine({ text: "Hi.", startMs: 0, durationMs: 300 }).warnings.some((w) => w.code === "short"));
  assert.ok(S.checkLine({ text: "Hello", startMs: 0, durationMs: 9000 }).warnings.some((w) => w.code === "long"));
  assert.ok(S.checkLine({ text: "A fine pace for reading this line.", startMs: 0, durationMs: 3000 }).ok);
  assert.ok(S.checkLine({ text: "Ok. ".repeat(40), startMs: 0, durationMs: 20000 }).warnings.some((w) => w.code === "pages"));
  assert.equal(S.cpsLimitFor("ja"), 4); assert.equal(S.cpsLimitFor("en"), 17);
});
test("sfx lines are exempt from cps", () => {
  assert.ok(!S.checkLine({ text: "[a very long description of a thunderstorm]", startMs: 0, durationMs: 900 }).warnings.some((w) => w.code === "cps"));
});
test("autoExtend: extends up to the next line, reports what it could not fix, does not mutate", () => {
  const input = [
    { id: "a", characterId: "k", text: "This line needs more time to be read.", startMs: 0, durationMs: 1200 },
    { id: "b", characterId: "k", text: "Next.", startMs: 2000, durationMs: 1200 },
    { id: "c", characterId: "k", text: "Words words words words words words words words.", startMs: 3300, durationMs: 800 },
    { id: "d", characterId: "k", text: "Wall.", startMs: 4200, durationMs: 1000 },
  ];
  const copy = JSON.parse(JSON.stringify(input));
  const r = S.autoExtend(input);
  assert.deepEqual(input, copy);
  const a = r.lines.find((l) => l.id === "a"); assert.ok(a.durationMs > 1200 && a.endMs <= 2000 - S.LIMITS.gapMs);
  assert.ok(r.changed.some((c) => c.id === "a"));
  assert.ok(r.unresolved.includes("c"));
});

const sample = [
  { id: "c1", characterId: "kami", text: "Hello there, <i>friend</i>!", startMs: 1000, durationMs: 2500 },
  { id: "c2", characterId: "mochi", text: "Oh, hi.", parenthetical: "whispering", startMs: 4000, durationMs: 1500 },
  { id: "c3", characterId: "kami", text: "Where did you come from?", presence: "vo", startMs: 6000, durationMs: 2800 },
  { id: "c4", characterId: null, text: "[door slams]", startMs: 9000, durationMs: 1200 },
];
const chars = { kami: { name: "Kami" }, mochi: { name: "Mochi" } };
const essence = (l) => ({ s: l.startMs, d: l.durationMs, who: l.characterId, text: S.parseMarkup(l.text).plain.replace(/\s+/g, " "), par: l.parenthetical, pres: l.presence || "on" });

test("SRT round trip keeps timing, speakers, parenthetical, V.O., sfx and italics", () => {
  const srt = S.toSRT(sample, { characters: chars });
  assert.match(srt, /00:00:01,000 --> 00:00:03,500\nKAMI: Hello there, <i>friend<\/i>!/);
  const back = S.parseSRT(srt, { characters: chars });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.lines.map(essence), sample.map(essence));
  assert.equal(back.lines[3].kind, "sfx");
});
test("VTT round trip with <v> tags, V.O. class, cue settings and lang", () => {
  const withSettings = sample.map((l, i) => (i === 0 ? { ...l, settings: { line: "10%", align: "start" } } : i === 1 ? { ...l, lang: "fr" } : l));
  const vtt = S.toVTT(withSettings, { characters: chars, language: "en" });
  assert.match(vtt, /^WEBVTT/); assert.match(vtt, /<v Kami>Hello there, <i>friend<\/i>!<\/v>/); assert.match(vtt, /<v\.vo Kami>/); assert.match(vtt, /line:10% align:start/);
  const back = S.parseVTT(vtt, { characters: chars });
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.lines.map(essence), sample.map(essence));
  assert.deepEqual(back.lines[0].settings, { line: "10%", align: "start" }); assert.equal(back.lines[0].position, "top");
  assert.equal(back.lines[1].lang, "fr");
  assert.equal(back.characters.kami.name, "Kami");
  assert.deepEqual(S.parseVTT(S.toVTT(back.lines, { characters: back.characters })).lines.map(essence), sample.map(essence));
});
test("VTT word timestamps round trip as karaoke word timing", () => {
  const l = [{ id: "w", characterId: "kami", text: "one two three", startMs: 0, durationMs: 3000, words: [{ text: "one", startMs: 0, endMs: 500 }, { text: "two", startMs: 1000, endMs: 1500 }, { text: "three", startMs: 2000, endMs: 3000 }] }];
  const vtt = S.toVTT(l, { characters: chars, wordTimings: true });
  assert.match(vtt, /one <00:00:01\.000>two <00:00:02\.000>three/);
  const back = S.parseVTT(vtt, { characters: chars }).lines[0];
  assert.equal(back.text, "one two three"); assert.deepEqual(back.words.map((w) => w.startMs), [0, 1000, 2000]);
});
test("VTT: two <v> speakers in one cue become two overlapping lines", () => {
  const r = S.parseVTT("WEBVTT\n\n00:01.000 --> 00:03.000\n<v Ann>Hi!</v>\n<v Bo>Hey.</v>\n");
  assert.equal(r.lines.length, 2); assert.equal(r.lines[0].startMs, r.lines[1].startMs); assert.notEqual(r.lines[0].characterId, r.lines[1].characterId);
});
test("long lines export as several cues (one per page) that cover the line", () => {
  const long = [{ id: "L", characterId: "kami", text: "First sentence is here for you. Second sentence is also here for you. Third one follows closely behind.", startMs: 0, durationMs: 9000 }];
  const cues = S.parseSRT(S.toSRT(long, { characters: chars })).lines;
  assert.ok(cues.length >= 2); assert.equal(cues[0].startMs, 0); assert.equal(cues.at(-1).startMs + cues.at(-1).durationMs, 9000);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].startMs >= cues[i - 1].startMs);
});
test("parse errors are reported with line numbers", () => {
  const r = S.parseSRT("1\n00:00:01,000 --> 00:00:02,000\nok\n\n2\nnot a time\ntext\n\n3\n00:00:xx --> 00:00:04,000\nbad\n");
  assert.equal(r.lines.length, 1); assert.equal(r.errors.length, 2); assert.equal(r.errors[0].line, 5); assert.match(r.errors[0].message, /timing/i);
  const v = S.parseVTT("00:01.000 --> 00:02.000\nx"); assert.match(v.errors[0].message, /WEBVTT/);
  assert.ok(S.parseSRT("1\n00:00:02,000 --> 00:00:01,000\nx\n").warnings.length === 1);
});
test("SRT: BOM, CRLF, '.' separators and missing hours", () => {
  const r = S.parseSRT("﻿1\r\n01:02,500 --> 01:04.000\r\nHi\r\n");
  assert.deepEqual(r.errors, []); assert.equal(r.lines[0].startMs, 62500); assert.equal(r.lines[0].durationMs, 1500);
});
test("SRT: ordinary 'Note: x' is not mistaken for a speaker", () => {
  assert.equal(S.parseSRT("1\n00:00:01,000 --> 00:00:02,000\nNote: this is fine\n").lines[0].characterId, null);
});
test("JSON round trip and validation", () => {
  const json = S.toJSON({ language: "en", fps: 24, characters: chars, tracks: { en: sample, fr: [{ id: "f1", characterId: "kami", text: "Bonjour", startMs: 0, durationMs: 1000 }] } });
  const back = S.fromJSON(json);
  assert.deepEqual(back.errors, []); assert.deepEqual(back.lines.map(essence), sample.map(essence)); assert.deepEqual(Object.keys(back.tracks), ["en", "fr"]); assert.equal(back.characters.kami.name, "Kami");
  assert.match(S.fromJSON("{nope").errors[0].message, /valid JSON/);
  assert.match(S.fromJSON('{"format":"x"}').errors[0].message, /kamiji-subtitles/);
  assert.equal(S.fromJSON(JSON.stringify({ format: "kamiji-subtitles", version: 1, tracks: { en: [{ startMs: 1 }] } })).errors.length, 1);
  assert.equal(S.parseAuto(json).lines.length, 4); assert.equal(S.parseAuto(S.toVTT(sample)).lines.length, 4);
});
test("Previs script adapter: char/kind mapping, paren merge, cut dropped, frames to ms", () => {
  const script = { lines: [
    { id: "l1", char: "mochi/kon", kind: "paren", text: "(softly)", shot: "s1", status: "draft" },
    { id: "l2", char: "mochi/kon", kind: "dialogue", text: "Hi there", shot: "s1", status: "draft" },
    { id: "l3", char: "narrator", kind: "action", text: "A door opens.", shot: "s1", status: "approved" },
    { id: "l4", char: "kamiji", kind: "dialogue", text: "dropped", shot: "s2", status: "cut" },
  ] };
  const out = S.fromPrevisScript(script, { fps: 24, timing: (l) => (l.id === "l2" ? { startFrame: 48, durationFrames: 36 } : l.id === "l3" ? { startFrame: 0, durationFrames: 24 } : null) });
  assert.equal(out.length, 2); assert.equal(out[0].characterId, "mochi/kon"); assert.equal(out[0].parenthetical, "softly");
  assert.equal(out[0].startMs, 2000); assert.equal(out[0].durationMs, 1500); assert.equal(out[1].kind, "narration"); assert.equal(out[1].shot, "s1");
});
test("createIndex.at: overlap and fast random seeks", () => {
  const lines = Array.from({ length: 5000 }, (_, i) => S.normalizeLine({ id: "x" + i, text: "t", startMs: i * 400, durationMs: 700 }));
  const ix = S.createIndex(lines);
  assert.deepEqual(ix.at(800).map((l) => l.id), ["x1", "x2"]); assert.deepEqual(ix.at(-1), []);
  const t0 = performance.now(); for (let i = 0; i < 20000; i++) ix.at((i * 7919) % 2000000); assert.ok(performance.now() - t0 < 400);
});
test("character markers are stable, monochrome shapes", () => {
  const a = S.resolveCharacter({}, "mochi/kon"), b = S.resolveCharacter({}, "mochi/kon");
  assert.deepEqual(a, b); assert.ok(S.SHAPES.includes(a.shape)); assert.equal(a.initial, "K"); assert.equal(S.resolveCharacter({}, "narrator").shape, "bar");
});
test("drawSubtitleToCanvas draws every preset onto a 2D context", () => {
  const calls = []; const ctx = new Proxy({ measureText: (s) => ({ width: s.length * 7 }), font: "", save() {}, restore() {} }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, a[0]]); }), set: (t, k, v) => { t[k] = v; return true; } });
  for (const preset of Object.keys(S.STYLES)) {
    calls.length = 0;
    const box = S.drawSubtitleToCanvas(ctx, { characterId: "kami", text: "Hello there, friend. How are you doing today?", presence: "vo" }, preset, 320, 180, { characters: chars, anchor: { x: "40%", y: 120 }, progress: 0.5 });
    assert.ok(box && box.lines.length >= 1 && box.w > 0, preset); assert.ok(calls.some(([k]) => k === "fillText"), preset);
  }
  assert.equal(S.drawSubtitleToCanvas(ctx, { text: "  " }, "classic", 100, 100), null);
});
