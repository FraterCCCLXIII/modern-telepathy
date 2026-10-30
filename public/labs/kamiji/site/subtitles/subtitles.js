// Kamiji subtitles: a reusable, dependency-free subtitle module for characters that talk.
// Plain ES module, no build step, no network. See README.md for the API, data model and integration plan.
//
//   import { createSubtitles } from "./subtitles/subtitles.js";
//   const subs = createSubtitles(stageElement, { style: "classic", characters: { kami: { name: "Kami" } } });
//   subs.play([{ id: "a", characterId: "kami", text: "Hello there!", startMs: 0, durationMs: 1800 }]);
//   subs.on("talking", (e) => avatar.setMouth(e.amplitude));
//
// Pure helpers (usable in Node): splitLines, layoutText, tokenize, estimateWordTimes, mouthAmplitude, checkLine, autoExtend,
// parseSRT/parseVTT/toSRT/toVTT/toJSON/fromJSON, fromPrevisScript. DOM only inside createSubtitles(); canvas only in drawSubtitleToCanvas().

// ============================================================ constants =====================================================
export const STYLES = Object.freeze({
  classic: { label: "Classic", maxChars: 37 },
  boxed: { label: "Boxed", maxChars: 37 },
  karaoke: { label: "Karaoke", maxChars: 37 },
  bubble: { label: "Comic bubble", maxChars: 22 },
  cinematic: { label: "Cinematic", maxChars: 42 },
  typewriter: { label: "Typewriter", maxChars: 37 },
});
const STYLE_ALIAS = { comic: "bubble", minimal: "cinematic", "lower-third": "cinematic", type: "typewriter" };
export const resolveStyle = (s) => { const k = STYLE_ALIAS[s] || s; return STYLES[k] ? k : "classic"; };

/** Reading-speed limits in characters per second (broadcast guidance; CJK counts characters, not width). */
export const CPS_LIMITS = Object.freeze({ default: 17, ja: 4, zh: 9, ko: 12 });
export const LIMITS = Object.freeze({ minDurationMs: 833, maxDurationMs: 7000, gapMs: 80, wordsPerSecond: 2.7 }); // 2.7 wps = Previs WPS

const CJK_RE = /[ᄀ-ᇿ⺀-〿぀-ヿ㄰-㆏㆐-ㇿ㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-￯]/;
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const baseLang = (l) => String(l || "").toLowerCase().split(/[-_]/)[0];
export const isCJKChar = (c) => CJK_RE.test(c);
export const hasCJK = (t) => CJK_RE.test(t);
export const detectDir = (t) => { const m = String(t).match(/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-ࣿיִ-﷿ﹰ-﻿]/); return m && RTL_RE.test(m[0]) ? "rtl" : "ltr"; };
const isFullWidth = (c) => CJK_RE.test(c);
/** Display width in units: 1 per narrow character, 2 per full-width (CJK) character. */
export const textWidth = (s) => { let w = 0; for (const c of s) w += isFullWidth(c) ? 2 : 1; return w; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SENT_END = /[.!?…。！？؟।]["'”’»)\]]*$/;
const CLAUSE_END = /[,;:、，；：—–،]["'”’»)\]]*$/;
const OPENERS = /^[¿¡(\[{"'“‘«「『（［｛【〈《]+$/;
const CLOSER_START = /^[)\]}"'”’»」』）］｝】〉》、。，．！？：；ー゛゜ゝゞ々ぁぃぅぇぉっゃゅょァィゥェォッャュョ,.!?:;…%]/;
const OPEN_END = /[(\[{“‘«「『（［｛【〈《¿¡]$/;
const FUNC = new Set("a an the of to in on at by for and or but nor so yet with from as if than that this these those my your his her its our their i he she we they it is are was were be been am do does did not no into onto over via per".split(" "));

// ============================================================ markup & tokens ==============================================
/** Light markup: <i>..</i> and *..* give italics; other tags are stripped. Returns plain text and italic char ranges. */
export function parseMarkup(src) {
  const s = String(src ?? "").replace(/\r\n?/g, "\n");
  let plain = "", italic = false, start = 0, starOpen = -1;
  const spans = [];
  const close = () => { if (italic && plain.length > start) spans.push({ c0: start, c1: plain.length }); italic = false; };
  for (let i = 0; i < s.length;) {
    if (s[i] === "<") {
      const m = /^<(\/?)([a-zA-Z][\w.:-]*)[^>]*>/.exec(s.slice(i, i + 200));
      if (m) {
        const tag = m[2].toLowerCase();
        if (tag === "i" || tag === "em") { if (m[1]) close(); else if (!italic) { italic = true; start = plain.length; } }
        i += m[0].length; continue;
      }
    }
    if (s[i] === "*" && !italic && starOpen < 0 && /\S/.test(s[i + 1] || "") && s.indexOf("*", i + 2) > 0 && /\S/.test(s[s.indexOf("*", i + 2) - 1])) { italic = true; start = plain.length; starOpen = 1; i++; continue; }
    if (s[i] === "*" && starOpen > 0 && italic) { close(); starOpen = -1; i++; continue; }
    plain += s[i]; i++;
  }
  close();
  return { plain, spans };
}
const segmenterCache = new Map();
function wordSegments(plain, lang) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const key = lang || "";
    let seg = segmenterCache.get(key);
    if (!seg) { try { seg = new Intl.Segmenter(lang || undefined, { granularity: "word" }); } catch { seg = new Intl.Segmenter(undefined, { granularity: "word" }); } segmenterCache.set(key, seg); }
    const out = [];
    for (const x of seg.segment(plain)) out.push({ s: x.segment, i: x.index, wl: !!x.isWordLike });
    return out;
  }
  // Fallback without Intl.Segmenter: whitespace words; every CJK character is its own word.
  const out = []; const re = /\s+|[㐀-鿿぀-ヿ가-퟿]|[^\s㐀-鿿぀-ヿ가-퟿]+/gu;
  let m; while ((m = re.exec(plain))) out.push({ s: m[0], i: m.index, wl: /[\p{L}\p{N}]/u.test(m[0]) });
  return out;
}
/** Tokens: {text, c0, c1, sp (a space follows), nl (a newline follows), w (is a word), wi (word index or -1)}. Punctuation sticks to its word. */
export function tokenize(plain, lang) {
  const toks = []; let open = "", openAt = -1;
  const segs = wordSegments(plain, lang);
  for (const g of segs) {
    if (/^\s+$/.test(g.s)) { const t = toks[toks.length - 1]; if (t) { t.sp = true; if (g.s.includes("\n")) t.nl = true; } open = open && toks.length ? open : open; continue; }
    if (g.wl) {
      const t = { text: open + g.s, c0: open ? openAt : g.i, c1: g.i + g.s.length, sp: false, nl: false, w: true, wi: -1 };
      toks.push(t); open = ""; openAt = -1; continue;
    }
    const prevCh = plain[g.i - 1];
    const quote = /^["'“”‘’]$/.test(g.s);
    const isOpen = OPENERS.test(g.s) && (!quote || prevCh === undefined || /\s/.test(prevCh)) && g.i + g.s.length < plain.length && !/^\s/.test(plain[g.i + g.s.length]);
    if (isOpen) { if (!open) openAt = g.i; open += g.s; continue; }
    const last = toks[toks.length - 1];
    if (last && !last.sp) { last.text += g.s; last.c1 = g.i + g.s.length; }
    else toks.push({ text: g.s, c0: g.i, c1: g.i + g.s.length, sp: false, nl: false, w: /[\p{L}\p{N}]/u.test(g.s), wi: -1 });
  }
  if (open) toks.push({ text: open, c0: openAt, c1: openAt + open.length, sp: false, nl: false, w: false, wi: -1 });
  let n = 0; for (const t of toks) if (t.w) t.wi = n++;
  return toks;
}

// ============================================================ line splitting ================================================
const lastCh = (t) => t.text[t.text.length - 1] || "";
function breakCost(a, b) { // cost of breaking between token a and token b (lower = better); Infinity = forbidden
  if (!a.sp && !a.hard && !/[-–—]$/.test(a.text) && !(isCJKChar(lastCh(a)) || isCJKChar(b.text[0] || ""))) return Infinity;
  if (OPEN_END.test(a.text)) return Infinity;
  if (CLOSER_START.test(b.text) && isCJKChar(b.text[0] || "")) return Infinity;
  let c = 0;
  if (SENT_END.test(a.text)) c -= 10; else if (CLAUSE_END.test(a.text)) c -= 6;
  else if (FUNC.has(a.text.toLowerCase().replace(/[^\p{L}']/gu, ""))) c += 6;
  if (!b.w && !isCJKChar(b.text[0] || "")) c += 6;
  return c;
}
function hardSplit(tokens, maxW, measure) { // a single token wider than the line is cut into pieces
  const out = [];
  for (const t of tokens) {
    if (measure(t.text) <= maxW) { out.push(t); continue; }
    let piece = "", c0 = t.c0, n = 0; const chars = [...t.text];
    chars.forEach((ch, k) => {
      if (piece && measure(piece + ch) > maxW) { out.push({ ...t, text: piece, c0, c1: c0 + piece.length, sp: false, hard: true, wi: n++ === 0 ? t.wi : -1, w: n === 1 ? t.w : false }); c0 += piece.length; piece = ""; }
      piece += ch; if (k === chars.length - 1) out.push({ ...t, text: piece, c0, c1: t.c1, wi: -1, w: false, hard: false });
    });
  }
  return out;
}
function layoutPage(tokens, maxW, maxLines, measure) {
  const n = tokens.length; if (!n) return { lines: [] };
  const w = tokens.map((t) => measure(t.text)), sp = tokens.map((t) => (t.sp ? measure(" ") : 0));
  const pre = [0]; for (let i = 0; i < n; i++) pre.push(pre[i] + w[i] + sp[i]);
  const width = (a, b) => pre[b] - pre[a] - sp[b - 1]; // tokens a..b-1 without the trailing space
  const total = width(0, n);
  const kMin = Math.max(1, Math.ceil(total / maxW));
  // honour authored line breaks when they all fit
  const manual = []; let cur = 0; for (let i = 0; i < n; i++) if (tokens[i].nl && i < n - 1) { manual.push([cur, i + 1]); cur = i + 1; } manual.push([cur, n]);
  if (manual.length > 1 && manual.length <= maxLines && manual.every(([a, b]) => width(a, b) <= maxW)) return { lines: manual.map(([a, b]) => tokens.slice(a, b)) };
  for (let k = kMin; k <= maxLines; k++) {
    if (k === 1) { if (total <= maxW) return { lines: [tokens] }; continue; }
    const target = total / k, INF = 1e9;
    const dp = Array.from({ length: k + 1 }, () => new Float64Array(n + 1).fill(INF)), from = Array.from({ length: k + 1 }, () => new Int16Array(n + 1).fill(-1));
    dp[0][0] = 0;
    for (let j = 1; j <= k; j++) for (let i = j; i <= n; i++) for (let a = j - 1; a < i; a++) {
      if (dp[j - 1][a] >= INF) continue;
      const lw = width(a, i); if (lw > maxW) continue;
      let c = dp[j - 1][a] + ((lw - target) / maxW) ** 2 * 10 + (j === 1 && k === 2 && i < n ? 0 : 0);
      if (a > 0) { const bc = breakCost(tokens[a - 1], tokens[a]); if (bc === Infinity) continue; c += bc; }
      if (j < k && lw > width(a, i) * 2) continue;
      if (c < dp[j][i]) { dp[j][i] = c; from[j][i] = a; }
    }
    if (dp[k][n] < INF) {
      const cuts = []; let i = n; for (let j = k; j >= 1; j--) { const a = from[j][i]; cuts.unshift([a, i]); i = a; }
      // pyramid preference: if two lines and the top is clearly longer, a slightly shorter top is already favoured by balance
      return { lines: cuts.map(([a, b]) => tokens.slice(a, b)) };
    }
  }
  return null;
}
function paginate(tokens, maxW, maxLines, measure) {
  const page = layoutPage(tokens, maxW, maxLines, measure);
  if (page) return [page];
  const n = tokens.length; if (n < 2) return [{ lines: [tokens] }];
  const w = tokens.map((t) => measure(t.text) + (t.sp ? 1 : 0)); const total = w.reduce((a, b) => a + b, 0);
  let best = -1, bestC = Infinity, acc = 0;
  for (let i = 1; i < n; i++) {
    acc += w[i - 1]; const bc = breakCost(tokens[i - 1], tokens[i]); if (bc === Infinity) continue;
    const c = Math.abs(acc - (total - acc)) / maxW * 4 + bc * 0.8; if (c < bestC) { bestC = c; best = i; }
  }
  if (best < 0) best = Math.ceil(n / 2);
  return [...paginate(tokens.slice(0, best), maxW, maxLines, measure), ...paginate(tokens.slice(best), maxW, maxLines, measure)];
}
export function defaultMaxChars(text, lang) { const l = baseLang(lang); return ["ja", "zh", "ko"].includes(l) || (hasCJK(text) && !/[A-Za-z]{3}/.test(text)) ? 32 : 37; }
/**
 * Lay a text out into pages of at most maxLines lines. Options: maxChars (width units: Latin char = 1, CJK char = 2), maxLines (2),
 * lang, measure(str)->width and maxWidth (to wrap by real pixel width, as the canvas renderer does).
 * Returns {plain, spans, dir, tokens, pages: [{lines: [{tokens, text}], w0, w1}]}.
 */
export function layoutText(text, opts = {}) {
  const { plain, spans } = parseMarkup(text);
  const lang = opts.lang, maxLines = Math.max(1, opts.maxLines || 2);
  const measure = opts.measure || textWidth, maxW = opts.measure ? (opts.maxWidth || 400) : (opts.maxChars || defaultMaxChars(plain, lang));
  const trimmed = plain.replace(/[ \t]+\n/g, "\n");
  const tokens = hardSplit(tokenize(trimmed, lang), maxW, measure);
  const pages = paginate(tokens, maxW, maxLines, measure).map((p) => {
    const lines = p.lines.map((tk) => { let s = ""; tk.forEach((t, i) => { s += t.text + (i < tk.length - 1 && t.sp ? " " : ""); }); return { tokens: tk, text: s }; });
    const wis = lines.flatMap((l) => l.tokens.map((t) => t.wi)).filter((x) => x >= 0);
    return { lines, w0: wis.length ? Math.min(...wis) : -1, w1: wis.length ? Math.max(...wis) : -1 };
  });
  if (!pages.length) pages.push({ lines: [], w0: -1, w1: -1 });
  return { plain, spans, dir: detectDir(plain), tokens, pages };
}
/** Pure splitter: text -> pages -> lines of strings. splitLines("...") => [["line 1", "line 2"], [..next cue..]] */
export function splitLines(text, opts = {}) { return layoutText(text, opts).pages.map((p) => p.lines.map((l) => l.text)); }

// ============================================================ timing =======================================================
export function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); if (!w) return 0;
  let n = 0; const run = w.match(/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu) || [];
  for (const r of run) {
    if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u.test(r)) { n += /[ぁぃぅぇぉゃゅょァィゥェォャュョ]/.test(r) ? 0 : 1; continue; }
    if (/^\p{N}+$/u.test(r)) { n += Math.max(1, Math.ceil(r.length * 0.8)); continue; }
    if (/\p{Script=Latin}|\p{Script=Cyrillic}|\p{Script=Greek}/u.test(r)) {
      let g = (r.match(/[aeiouyàáâãäåèéêëìíîïòóôõöùúûüœæаеёиоуыэюяіїє]+/g) || []).length;
      if (g > 1 && /[^aeiouy]e$/.test(r) && !/(le|[^aeiouy]ee)$/.test(r)) g--;
      n += Math.max(1, g);
    } else n += Math.max(1, Math.ceil(r.length / 2.5)); // Arabic, Hebrew, Thai...: vowels are not written; ~2.5 letters per syllable
  }
  return Math.max(1, n);
}
const pauseAfter = (t) => (SENT_END.test(t) ? 1.4 : /[,;:、，；：—–،]/.test(lastCh({ text: t.replace(/["'”’»)\]]+$/, "") })) ? 0.7 : 0);
/** Estimated speech duration for a text, in ms: 2.7 words per second (Previs' WPS) or 5.5 characters per second for CJK, plus punctuation pauses. */
export function estimateDurationMs(text, lang) {
  const { plain } = parseMarkup(text), toks = tokenize(plain, lang).filter((t) => t.w);
  const cjk = hasCJK(plain) && !/[A-Za-z]{3}/.test(plain);
  const base = cjk ? ([...plain].filter(isCJKChar).length / 5.5) * 1000 : (toks.length / LIMITS.wordsPerSecond) * 1000;
  const pauses = toks.reduce((a, t) => a + pauseAfter(t.text) * 120, 0);
  return Math.max(1000, Math.round(base + pauses));
}
/** Word timings estimated from text length: weights ~ syllables, plus pauses after punctuation. Times are relative to the line start. */
export function estimateWordTimes(text, durationMs, opts = {}) {
  const { plain } = parseMarkup(text), toks = tokenize(plain, opts.lang).filter((t) => t.w);
  if (!toks.length) return [];
  const wt = toks.map((t) => 0.6 * syllables(t.text) + 0.04 * [...t.text].length + 0.3);
  const ps = toks.map((t, i) => (i === toks.length - 1 ? 0 : pauseAfter(t.text)));
  const sum = wt.reduce((a, b, i) => a + b + ps[i], 0), k = durationMs / sum;
  let cum = 0;
  return toks.map((t, i) => {
    const startMs = cum * k, endMs = (cum + wt[i]) * k; cum += wt[i] + ps[i];
    return { text: t.text, startMs: Math.round(startMs), endMs: Math.round(i === toks.length - 1 ? durationMs : endMs), c0: t.c0, c1: t.c1, syl: syllables(t.text) };
  });
}
export function wordIndexAt(words, rel) { // last word with startMs <= rel, or -1
  let lo = 0, hi = words.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (words[m].startMs <= rel) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}
/**
 * Mouth-open amplitude 0..1 from word timing, for a talking avatar. One pulse per syllable inside each word, closed in the gaps
 * between words. Returns {open, viseme (A E I O U or null), wordIndex, speaking}. Feed `open` to the rig (rtk-mouth `setOpen`, chat-widget `avatar.setMouth`).
 */
export function mouthAmplitude(words, rel) {
  const i = wordIndexAt(words, rel);
  if (i < 0) return { open: 0, viseme: null, wordIndex: -1, speaking: false };
  const w = words[i];
  if (rel >= w.endMs) return { open: 0, viseme: null, wordIndex: i, speaking: false };
  const dur = Math.max(1, w.endMs - w.startMs), ph = (rel - w.startMs) / dur, n = w.syl || syllables(w.text);
  const env = Math.abs(Math.sin(Math.PI * n * ph)), edge = Math.min(1, ph / 0.1, (1 - ph) / 0.1);
  const open = clamp((0.18 + 0.82 * env ** 0.7) * (0.55 + 0.45 * edge), 0, 1);
  const groups = String(w.text).toLowerCase().match(/[aeiouy]+/g), g = groups && groups[Math.min(groups.length - 1, Math.floor(ph * n))];
  const v = g ? g[0].toUpperCase().replace("Y", "I") : null;
  return { open, viseme: v, wordIndex: i, speaking: true };
}

// ============================================================ lines: normalising & checks ==================================
let idSeq = 0;
const fr2ms = (f, fps) => Math.round((f / fps) * 1000);
/** Normalise one script line (also accepts Previs names: char, startFrame/durationFrames with opts.fps). Never mutates the input. */
export function normalizeLine(raw, opts = {}) {
  const r = raw || {}, fps = opts.fps || r.fps || 24;
  const text = String(r.text ?? ""), characterId = r.characterId ?? r.char ?? r.speaker ?? null;
  let kind = r.kind;
  if (kind === "action") kind = "narration";
  if (kind === "paren") kind = "dialogue";
  const trim = text.trim();
  if (!kind) kind = /^\[[^\]]*\]$/.test(trim) ? "sfx" : /^[♪♫]/.test(trim) ? "music" : (characterId == null || characterId === "narrator") ? "narration" : "dialogue";
  let presence = r.presence || "on"; const paren = r.parenthetical ? String(r.parenthetical) : "";
  if (/^\(?\s*(V\.?O\.?|voice[- ]?over)\s*\)?$/i.test(paren)) presence = "vo"; else if (/^\(?\s*(O\.?S\.?|O\.?C\.?|off[- ]?screen)\s*\)?$/i.test(paren)) presence = "os";
  const startMs = r.startMs ?? (r.startFrame != null ? fr2ms(r.startFrame, fps) : null);
  let durationMs = r.durationMs ?? (r.durationFrames != null ? fr2ms(r.durationFrames, fps) : r.endMs != null && startMs != null ? r.endMs - startMs : null);
  const lang = r.lang || opts.lang || undefined;
  let estimated = false; if (durationMs == null || !(durationMs > 0)) { durationMs = estimateDurationMs(text, lang); estimated = true; }
  const out = { ...r, id: String(r.id ?? `l${++idSeq}`), characterId, text, kind, presence, startMs: startMs == null ? null : Math.round(startMs), durationMs: Math.round(durationMs), lang };
  out.endMs = out.startMs == null ? null : out.startMs + out.durationMs;
  if (estimated) out.estimated = true;
  delete out.char; delete out.startFrame; delete out.durationFrames; delete out.fps;
  return out;
}
/** Characters per second for a line (visible characters incl. spaces, markup excluded). */
export function lineCps(line) {
  const n = normalizeLine(line), plain = parseMarkup(n.text).plain.replace(/\s*\n\s*/g, " ").trim();
  const cjk = hasCJK(plain) && !/[A-Za-z]{3}/.test(plain), chars = cjk ? [...plain.replace(/\s/g, "")].length : [...plain].length;
  return { chars, cps: n.durationMs > 0 ? chars / (n.durationMs / 1000) : Infinity, lang: n.lang };
}
export function cpsLimitFor(lang, text) { const l = baseLang(lang) || (hasCJK(text || "") ? (/[぀-ヿ]/.test(text) ? "ja" : /[가-퟿]/.test(text) ? "ko" : "zh") : ""); return CPS_LIMITS[l] || CPS_LIMITS.default; }
/** Warnings for one line: cps (too fast), short, long, pages (needs more than one page), empty. */
export function checkLine(line, opts = {}) {
  const n = normalizeLine(line, opts), { chars, cps } = lineCps(n), limit = opts.cpsLimit || cpsLimitFor(n.lang, n.text), warnings = [];
  if (!chars) warnings.push({ code: "empty", message: "Line has no text." });
  if (n.kind !== "sfx" && cps > limit + 1e-9) warnings.push({ code: "cps", message: `${cps.toFixed(1)} chars/s is above the ${limit} chars/s limit.`, needMs: Math.ceil((chars / limit) * 1000) });
  if (n.durationMs < (opts.minMs || LIMITS.minDurationMs) && chars) warnings.push({ code: "short", message: `Shown for ${n.durationMs} ms; at least ${opts.minMs || LIMITS.minDurationMs} ms reads better.` });
  if (n.durationMs > (opts.maxMs || LIMITS.maxDurationMs)) warnings.push({ code: "long", message: `Shown for ${(n.durationMs / 1000).toFixed(1)} s; over ${(opts.maxMs || LIMITS.maxDurationMs) / 1000} s.` });
  const pages = layoutText(n.text, { lang: n.lang, maxChars: opts.maxChars || defaultMaxChars(n.text, n.lang), maxLines: opts.maxLines || 2 }).pages.length;
  if (pages > 1) warnings.push({ code: "pages", message: `Text needs ${pages} subtitle pages.` });
  return { id: n.id, cps, chars, limit, warnings, ok: warnings.length === 0 };
}
/** Lengthen lines that read too fast, as far as the next line allows. Returns {lines (new), changed, unresolved}. Never mutates. */
export function autoExtend(lines, opts = {}) {
  const gap = opts.gapMs ?? LIMITS.gapMs, max = opts.maxMs || LIMITS.maxDurationMs;
  const list = lines.map((l) => normalizeLine(l, opts)), order = list.map((l, i) => i).filter((i) => list[i].startMs != null).sort((a, b) => list[a].startMs - list[b].startMs);
  const changed = [], unresolved = [], out = list.map((l) => ({ ...l }));
  for (const i of order) {
    const l = out[i], { chars } = lineCps(l), limit = opts.cpsLimit || cpsLimitFor(l.lang, l.text);
    if (!chars || l.kind === "sfx") continue;
    const need = Math.max(Math.ceil((chars / limit) * 1000), opts.minMs || LIMITS.minDurationMs);
    if (l.durationMs >= need) continue;
    const next = order.map((j) => out[j]).find((o) => o !== l && o.startMs >= l.endMs);
    const room = next ? next.startMs - gap - l.startMs : Infinity, to = Math.min(need, max, Math.max(room, l.durationMs));
    if (to > l.durationMs) { changed.push({ id: l.id, fromMs: l.durationMs, toMs: to }); l.durationMs = to; l.endMs = l.startMs + to; if (l.words) delete l.words; }
    if (to < need) unresolved.push(l.id);
  }
  return { lines: out, changed, unresolved };
}
/** Sorted by start, with a binary-search index for "which lines are active at t" (O(log n + k)). */
export function createIndex(lines) {
  const list = lines.filter((l) => l.startMs != null).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  let maxDur = 0; for (const l of list) maxDur = Math.max(maxDur, l.durationMs);
  return {
    list, end: list.reduce((m, l) => Math.max(m, l.endMs), 0),
    at(t) {
      let lo = 0, hi = list.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m].startMs <= t) { r = m; lo = m + 1; } else hi = m - 1; }
      const out = []; for (let i = r; i >= 0 && list[i].startMs >= t - maxDur; i--) if (list[i].endMs > t) out.push(list[i]);
      return out.reverse();
    },
  };
}

// ============================================================ characters ===================================================
export const SHAPES = ["circle", "square", "diamond", "triangle", "hex", "pill"];
export const UNDERLINES = ["solid", "dotted", "dashed", "double", "wavy", "none"];
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const titleCase = (s) => String(s).split(/[\s/_-]+/).filter(Boolean).pop()?.replace(/^./, (c) => c.toUpperCase()) || "";
/** Resolve a character to {id, name, initial, shape, underline, anchor, avatar, dir}; unknown ids get a stable generated marker. */
export function resolveCharacter(characters, id) {
  if (id == null || id === "narrator") return { id: "narrator", name: (characters?.narrator?.name) || "Narrator", initial: "N", shape: "bar", underline: "none", narrator: true, ...(characters?.narrator || {}) };
  const c = characters?.[id] || {}, h = hash(id), keys = characters ? Object.keys(characters) : [], idx = keys.indexOf(id);
  const name = c.name || titleCase(id);
  return { anchor: null, avatar: null, dir: null, ...c, id, name, initial: (c.initial || [...name][0] || "?").toUpperCase(), shape: c.shape || SHAPES[(idx >= 0 ? idx : h) % SHAPES.length], underline: c.underline || UNDERLINES[(idx >= 0 ? idx : h >> 3) % 5] };
}

// ============================================================ time formats =================================================
const pad = (n, l = 2) => String(Math.floor(n)).padStart(l, "0");
export function formatTime(ms, sep = ",") { ms = Math.max(0, Math.round(ms)); return `${pad(ms / 3600000)}:${pad((ms % 3600000) / 60000)}:${pad((ms % 60000) / 1000)}${sep}${pad(ms % 1000, 3)}`; }
export function parseTime(s) { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/.exec(String(s).trim()); return m ? (+(m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4].padEnd(3, "0") : null; }

// ============================================================ import / export ==============================================
const VOICE_PRESENCE = { vo: "V.O.", os: "O.S." };
function exportCues(lines, opts = {}) { // one cue per page; page times follow the word times
  const cues = [];
  for (const raw of lines) {
    const l = normalizeLine(raw, opts); if (l.startMs == null || l.status === "cut") continue;
    const words = l.words || estimateWordTimes(l.text, l.durationMs, { lang: l.lang });
    const lay = opts.reflow === false ? null : layoutText(l.text, { lang: l.lang, maxChars: opts.maxChars, maxLines: opts.maxLines });
    if (!lay || lay.pages.length === 1) { cues.push({ line: l, startMs: l.startMs, endMs: l.endMs, text: lay ? lay.pages[0].lines.map((x) => x.text).join("\n") : parseMarkup(l.text).plain, words, spans: lay?.spans || parseMarkup(l.text).spans, pageWords: [0, words.length - 1], lay }); continue; }
    lay.pages.forEach((p, k) => {
      const s = k === 0 ? l.startMs : l.startMs + (words[p.w0]?.startMs ?? 0), e = k === lay.pages.length - 1 ? l.endMs : l.startMs + (words[lay.pages[k + 1].w0]?.startMs ?? l.durationMs);
      cues.push({ line: l, startMs: s, endMs: Math.max(s + 1, e), text: p.lines.map((x) => x.text).join("\n"), words, spans: lay.spans, pageWords: [p.w0, p.w1], lay, page: k });
    });
  }
  return cues.sort((a, b) => a.startMs - b.startMs);
}
const withItalics = (cue) => { // re-insert <i> tags (by char range) into the text of a cue; tags are closed per line
  if (!cue.lay) return cue.text.replace(/\*([^*\s][^*]*)\*/g, "<i>$1</i>");
  const page = cue.page ?? 0, lay = cue.lay, pg = lay.pages[page] || lay.pages[0];
  return pg.lines.map((ln) => {
    const segs = [];
    ln.tokens.forEach((t, ti) => {
      const runs = runsOf(t, lay.spans); if (ti > 0 && segs.length && ln.tokens[ti - 1].sp) segs.push({ it: segs[segs.length - 1].it && runs[0].it, text: " " });
      for (const r of runs) segs.push({ it: r.it, text: r.text });
    });
    const merged = []; for (const g of segs) { const l = merged[merged.length - 1]; if (l && l.it === g.it) l.text += g.text; else merged.push({ ...g }); }
    return merged.map((g) => (g.it ? `<i>${g.text}</i>` : g.text)).join("");
  }).join("\n");
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&lt;(\/?i)&gt;/g, "<$1>");
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lrm;|&rlm;/g, "");
/** SRT export. Speakers are written as "NAME: text" (upper case, "(V.O.)" / "(O.S.)" after the name); italics as <i>. */
export function toSRT(lines, opts = {}) {
  const chars = opts.characters || {}, cues = exportCues(lines, opts);
  return cues.map((c, i) => {
    const l = c.line, ch = l.characterId && l.characterId !== "narrator" && l.kind === "dialogue" ? resolveCharacter(chars, l.characterId) : null;
    let body = withItalics(c);
    const first = c.page ? "" : l.parenthetical && !VOICE_PRESENCE[l.presence] ? `(${l.parenthetical.replace(/^\(|\)$/g, "")}) ` : "";
    if (ch && opts.speakers !== false && !c.page) body = `${ch.name.toUpperCase()}${VOICE_PRESENCE[l.presence] ? ` (${VOICE_PRESENCE[l.presence]})` : ""}: ${first}${body}`;
    else body = first + body;
    return `${i + 1}\n${formatTime(c.startMs, ",")} --> ${formatTime(c.endMs, ",")}\n${body}\n`;
  }).join("\n");
}
/** WebVTT export with <v Speaker> voice tags, cue settings and optional word timestamps (karaoke) via opts.wordTimings. */
export function toVTT(lines, opts = {}) {
  const chars = opts.characters || {}, cues = exportCues(lines, opts);
  const out = ["WEBVTT" + (opts.title ? ` - ${opts.title}` : ""), ""];
  if (opts.language) out.push(`NOTE language: ${opts.language}`, "");
  for (const c of cues) {
    const l = c.line, ch = l.characterId && l.characterId !== "narrator" && l.kind === "dialogue" ? resolveCharacter(chars, l.characterId) : null;
    const set = l.settings || {}, sets = ["vertical", "line", "position", "size", "align"].filter((k) => set[k] != null).map((k) => `${k}:${set[k]}`);
    if (!set.line && l.position) sets.unshift(`line:${l.position === "top" ? "10%" : l.position === "middle" ? "50%" : "88%"}`);
    let body;
    if (opts.wordTimings && c.lay && !c.page) {
      body = withItalics(c).split("\n").map((ln) => ln).join("\n"); // timestamps are added per word below
      const ws = c.words; let k = 0;
      body = body.replace(/[^\s<>]+/g, (m, off, str) => { if (/^[<]/.test(m)) return m; const w = ws[k++]; return w && k > 1 ? `<${formatTime(l.startMs + w.startMs, ".")}>${esc(m)}` : esc(m); });
    } else body = esc(withItalics(c));
    const par = l.parenthetical && !VOICE_PRESENCE[l.presence] && !c.page ? `(${l.parenthetical.replace(/^\(|\)$/g, "")}) ` : "";
    body = par + body;
    if (l.lang && l.lang !== opts.language) body = `<lang ${l.lang}>${body}</lang>`;
    if (ch && opts.speakers !== false) body = `<v${l.presence !== "on" ? "." + l.presence : ""} ${ch.name}>${body}</v>`;
    out.push(`${l.id}${c.page ? "#" + (c.page + 1) : ""}`, `${formatTime(c.startMs, ".")} --> ${formatTime(c.endMs, ".")}${sets.length ? " " + sets.join(" ") : ""}`, body, "");
  }
  return out.join("\n");
}
function splitBlocks(text) { // blocks of lines with their 1-based starting line number
  const src = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n"), blocks = []; let cur = null;
  src.forEach((ln, i) => { if (ln.trim() === "") { cur = null; return; } if (!cur) { cur = { at: i + 1, lines: [] }; blocks.push(cur); } cur.lines.push(ln); });
  return blocks;
}
const TIMING = /^\s*((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[,.]\d{1,3})(.*)$/;
function speakerFromText(text, chars) {
  const m = /^([^\s:()<>][^:()<>\n]{0,30}?)(?:\s*\((V\.O\.|O\.S\.|O\.C\.)\))?:\s+([\s\S]*)$/.exec(text); if (!m) return null;
  const name = m[1].trim(), known = Object.entries(chars || {}).find(([id, c]) => (c.name || "").toLowerCase() === name.toLowerCase() || id.toLowerCase() === name.toLowerCase());
  if (!known && !(name === name.toUpperCase() && /\p{L}/u.test(name))) return null;
  return { id: known ? known[0] : slug(name), name: known ? known[1].name || name : name, presence: m[2] === "V.O." ? "vo" : m[2] ? "os" : "on", rest: m[3] };
}
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "speaker";
function finishCue(id, startMs, endMs, textRaw, extra, ctx) {
  let text = textRaw, speaker = null, parenthetical;
  if (!ctx.vtt) { speaker = speakerFromText(text, ctx.characters); if (speaker) text = speaker.rest; }
  const pm = /^\(([^()]{1,40})\)\s+([\s\S]+)$/.exec(text); if (pm && !/^\d+$/.test(pm[1])) { parenthetical = pm[1]; text = pm[2]; }
  const line = { id, characterId: speaker?.id ?? extra.characterId ?? null, text, startMs, durationMs: Math.max(1, endMs - startMs) };
  if (speaker && ctx.names && !ctx.characters?.[speaker.id]) ctx.names[speaker.id] = { name: speaker.name };
  if (speaker?.presence && speaker.presence !== "on") line.presence = speaker.presence; else if (extra.presence) line.presence = extra.presence;
  if (parenthetical) line.parenthetical = parenthetical;
  if (extra.lang) line.lang = extra.lang; if (extra.words) line.words = extra.words; if (extra.settings) line.settings = extra.settings;
  if (line.characterId == null) line.kind = /^\s*\[[^\]]*\]\s*$/.test(text) ? "sfx" : /^\s*[♪♫]/.test(text) ? "music" : "narration";
  return line;
}
/** Parse SRT. Returns {lines, characters (names found), errors: [{line, message}], warnings}. Pass opts.characters to resolve "NAME:" prefixes. */
export function parseSRT(text, opts = {}) {
  const res = { lines: [], characters: {}, errors: [], warnings: [] }, ctx = { characters: opts.characters, names: res.characters, vtt: false };
  for (const b of splitBlocks(text)) {
    let ti = b.lines.findIndex((l) => l.includes("-->")); if (ti < 0 || ti > 1) { res.errors.push({ line: b.at, message: "Cue has no timing line (expected 00:00:01,000 --> 00:00:02,000)." }); continue; }
    const m = TIMING.exec(b.lines[ti]); if (!m) { res.errors.push({ line: b.at + ti, message: `Bad timing line: "${b.lines[ti].slice(0, 40)}".` }); continue; }
    const s = parseTime(m[1]), e = parseTime(m[2]); if (s == null || e == null) { res.errors.push({ line: b.at + ti, message: "Unreadable timestamp." }); continue; }
    if (e <= s) res.warnings.push({ line: b.at + ti, message: "End time is not after start time; kept with a 1 ms length." });
    const idx = ti === 1 ? b.lines[0].trim() : String(res.lines.length + 1);
    if (ti === 1 && !/^\d+$/.test(idx)) res.warnings.push({ line: b.at, message: `Cue number "${idx}" is not numeric.` });
    res.lines.push(finishCue("c" + idx, s, Math.max(e, s + 1), b.lines.slice(ti + 1).join("\n"), {}, ctx));
  }
  return res;
}
/** Parse WebVTT: cue settings, <v Speaker> / <v.vo Speaker>, <i>, <lang>, and <00:00:01.000> word timestamps. */
export function parseVTT(text, opts = {}) {
  const res = { lines: [], characters: {}, errors: [], warnings: [], language: undefined }, blocks = splitBlocks(text), ctx = { characters: opts.characters, names: res.characters, vtt: true };
  if (!blocks.length || !/^WEBVTT(\s|$)/.test(blocks[0].lines[0])) { res.errors.push({ line: 1, message: "Missing WEBVTT header." }); if (!blocks.length) return res; } else blocks.shift();
  for (const b of blocks) {
    const first = b.lines[0]; if (/^(NOTE|STYLE|REGION)(\s|$)/.test(first)) { const lm = /^NOTE language:\s*(\S+)/.exec(first); if (lm) res.language = lm[1]; continue; }
    const ti = b.lines.findIndex((l) => l.includes("-->")); if (ti < 0 || ti > 1) { res.errors.push({ line: b.at, message: "Cue has no timing line." }); continue; }
    const m = TIMING.exec(b.lines[ti]); const s = m && parseTime(m[1]), e = m && parseTime(m[2]);
    if (!m || s == null || e == null) { res.errors.push({ line: b.at + ti, message: `Bad timing line: "${b.lines[ti].slice(0, 40)}".` }); continue; }
    if (e <= s) res.warnings.push({ line: b.at + ti, message: "End time is not after start time; kept with a 1 ms length." });
    const settings = {}; for (const kv of m[3].trim().split(/\s+/).filter(Boolean)) { const [k, v] = kv.split(":"); if (v != null) settings[k] = v; else res.warnings.push({ line: b.at + ti, message: `Ignored cue setting "${kv}".` }); }
    const idRaw = ti === 1 ? b.lines[0].trim() : `v${res.lines.length + 1}`, id = idRaw.replace(/#\d+$/, "");
    const payload = b.lines.slice(ti + 1).join("\n"), parts = splitVoices(payload, res, b.at + ti + 1);
    parts.forEach((p, k) => {
      const wordsAbs = []; let body = p.text.replace(/<lang\s+([^>]+)>([\s\S]*?)<\/lang>/g, (_, lg, inner) => { p.lang = lg.trim(); return inner; });
      body = body.replace(/<(\d+:)?\d{1,2}:\d{2}\.\d{3}>/g, (ts) => { wordsAbs.push({ at: parseTime(ts.slice(1, -1)), pos: -1 }); return `\u0001${wordsAbs.length - 1}\u0001`; });
      body = unesc(body.replace(/<(?!\/?i[>\s])[^>]*>/g, "").replace(/<\/?i>/g, (t) => t));
      let words; if (wordsAbs.length) { const plain = body; const ts = []; const re = /\u0001(\d+)\u0001/g; let mm, rem = 0; while ((mm = re.exec(plain))) { ts.push({ idx: mm.index - rem, at: wordsAbs[+mm[1]].at }); rem += mm[0].length; } body = plain.replace(/\u0001\d+\u0001/g, ""); words = wordsFromStamps(body, ts, s, e, p.lang); }
      const line = finishCue(parts.length > 1 ? `${id}.${k + 1}` : id, s, Math.max(e, s + 1), body, { characterId: p.id, presence: p.presence, lang: p.lang, words, settings: Object.keys(settings).length ? settings : null }, ctx);
      if (!line.settings) delete line.settings; if (!line.lang) delete line.lang; if (!line.words) delete line.words;
      if (p.id != null) line.kind = "dialogue"; else if (line.kind === undefined) line.kind = "narration";
      const ln = Number.parseFloat(settings.line); if (/%$/.test(settings.line || "") && !Number.isNaN(ln)) line.position = ln <= 33 ? "top" : ln <= 66 ? "middle" : "bottom";
      res.lines.push(line);
    });
  }
  return res;
}
function wordsFromStamps(body, stamps, s, e, lang) { // body has timestamps removed; stamps give the char index where each timestamp sat
  const est = estimateWordTimes(body, e - s, { lang }); if (!est.length) return undefined;
  const starts = new Map(); stamps.forEach((st) => { const w = est.findIndex((x) => x.c0 >= st.idx - 0); if (w >= 0) starts.set(w, st.at - s); });
  starts.set(0, starts.get(0) ?? 0);
  const ws = est.map((w, i) => ({ text: w.text, startMs: starts.has(i) ? starts.get(i) : w.startMs, endMs: w.endMs }));
  for (let i = 0; i < ws.length; i++) ws[i].endMs = i < ws.length - 1 ? Math.max(ws[i].startMs, Math.min(ws[i].endMs, ws[i + 1].startMs)) : e - s;
  return ws;
}
function splitVoices(payload, res, at) { // [{id, presence, text}] one per <v ...> section; no tag = one narrator part
  const re = /<v((?:\.[\w-]+)*)[ \t]+([^>]*)>/g, parts = []; let m, last = 0, cur = null;
  const names = res.characters;
  while ((m = re.exec(payload))) {
    if (cur === null && m.index > 0 && payload.slice(0, m.index).trim()) parts.push({ id: null, presence: undefined, text: payload.slice(0, m.index) });
    else if (cur) cur.text = payload.slice(last, m.index).replace(/<\/v>\s*$/, "");
    const name = m[2].trim(), id = slug(name), cls = m[1].split(".").filter(Boolean);
    names[id] = { name }; cur = { id, presence: cls.includes("vo") ? "vo" : cls.includes("os") ? "os" : undefined, text: "" }; parts.push(cur); last = m.index + m[0].length;
  }
  if (cur) cur.text = payload.slice(last).replace(/<\/v>\s*$/, ""); else parts.push({ id: null, text: payload });
  if (!parts.length) res.errors.push({ line: at, message: "Empty cue." });
  return parts;
}
export function parseAuto(text, opts) { return /^﻿?\s*WEBVTT/.test(text) ? parseVTT(text, opts) : /^\s*[\[{]/.test(text) ? fromJSON(text) : parseSRT(text, opts); }
export const JSON_FORMAT = "kamiji-subtitles";
/** Project JSON. {format, version, language, fps, characters, tracks: {lang: [lines]}}. */
export function toJSON(project) {
  const p = project || {}, lines = p.lines || p.tracks?.[p.language || "en"] || [];
  const tracks = p.tracks ? Object.fromEntries(Object.entries(p.tracks).map(([k, v]) => [k, v.map((l) => normalizeLine(l, { fps: p.fps }))])) : { [p.language || "en"]: lines.map((l) => normalizeLine(l, { fps: p.fps })) };
  for (const t of Object.values(tracks)) for (const l of t) { delete l.estimated; if (l.endMs != null) delete l.endMs; }
  return JSON.stringify({ format: JSON_FORMAT, version: 1, language: p.language || "en", fps: p.fps || undefined, characters: p.characters || {}, tracks }, null, 2);
}
export function fromJSON(src) {
  const res = { lines: [], tracks: {}, characters: {}, errors: [], warnings: [], language: "en", fps: undefined };
  let o; try { o = typeof src === "string" ? JSON.parse(src) : src; } catch (e) { res.errors.push({ line: 0, message: "Not valid JSON: " + e.message }); return res; }
  if (Array.isArray(o)) o = { format: JSON_FORMAT, version: 1, tracks: { en: o } };
  if (!o || o.format !== JSON_FORMAT) { res.errors.push({ line: 0, message: `Not a ${JSON_FORMAT} file (format field missing or different).` }); return res; }
  if (o.version !== 1) res.warnings.push({ line: 0, message: `Unknown version ${o.version}; reading as version 1.` });
  res.language = o.language || "en"; res.fps = o.fps; res.characters = o.characters && typeof o.characters === "object" ? o.characters : {};
  for (const [lang, arr] of Object.entries(o.tracks || {})) {
    if (!Array.isArray(arr)) { res.errors.push({ line: 0, message: `Track "${lang}" is not a list.` }); continue; }
    res.tracks[lang] = arr.flatMap((l, i) => {
      if (!l || typeof l.text !== "string") { res.errors.push({ line: i, message: `Track "${lang}" line ${i + 1} has no text.` }); return []; }
      if (l.startMs != null && !Number.isFinite(l.startMs)) { res.errors.push({ line: i, message: `Track "${lang}" line ${i + 1} has a bad startMs.` }); return []; }
      return [normalizeLine(l, { fps: o.fps, lang })];
    });
  }
  res.lines = res.tracks[res.language] || Object.values(res.tracks)[0] || [];
  return res;
}

// ============================================================ Previs adapter ===============================================
/**
 * Convert Previs' project.script ({lines: [{id, char, kind: dialogue|action|paren, text, node, shot, status}], names}) into subtitle lines.
 * `timing(previsLine)` returns {startFrame, durationFrames} or {startMs, durationMs} (from the shot's position in the cut), or null (untimed, duration estimated).
 * A "paren" line directly before a dialogue line of the same shot becomes its `parenthetical`. Cut lines are dropped.
 */
export function fromPrevisScript(script, opts = {}) {
  const src = (script?.lines || []).filter((l) => l.status !== "cut"), out = [], fps = opts.fps || 24;
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    if (l.kind === "paren") { const nx = src[i + 1]; if (nx && nx.kind === "dialogue" && nx.shot === l.shot && nx.char === l.char) { nx._par = l.text.replace(/^\(|\)$/g, ""); continue; } }
    const t = opts.timing?.(l) || {}, o = { id: l.id, characterId: l.char, text: l.text, kind: l.kind === "action" ? "narration" : "dialogue", shot: l.shot, node: l.node, ...t };
    if (l._par) { o.parenthetical = l._par; delete l._par; }
    out.push(normalizeLine(o, { fps, lang: opts.lang }));
  }
  return out;
}
export function charactersFromPrevis(chars, names = {}) { // chars: [{id, name}] -> characters map with Previs-like shapes
  const m = {}; chars.forEach((c, i) => { m[c.id] = { name: names[c.id] || c.name, initial: (names[c.id] || c.name || "?")[0].toUpperCase(), shape: c.id === "narrator" ? "bar" : SHAPES[i % SHAPES.length], underline: UNDERLINES[i % 5] }; });
  return m;
}

// ============================================================ settings (localStorage) ======================================
const PREF_KEY = "kamiji.subtitles.v1";
function loadPrefs(key) { try { const o = JSON.parse(localStorage.getItem(key) || "{}"); return o && typeof o === "object" ? o : {}; } catch { return {}; } }
function savePrefs(key, o) { try { localStorage.setItem(key, JSON.stringify(o)); } catch { /* private mode */ } }

// ============================================================ the controller ===============================================
const NS = "kmj-";
function el(tag, cls, attrs) { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
const runsOf = (tok, spans) => { // split a token into italic / roman runs
  const out = []; let cur = null;
  for (let k = 0; k < tok.text.length; k++) {
    const idx = tok.c0 + k, it = spans.some((s) => idx >= s.c0 && idx < s.c1);
    if (!cur || cur.it !== it) { cur = { it, text: "" }; out.push(cur); } cur.text += tok.text[k];
  }
  return out;
};
const ANCHOR_NUM = (v, total) => (typeof v === "string" && v.endsWith("%") ? (parseFloat(v) / 100) * total : Number(v) || 0);

export function createSubtitles(container, options = {}) {
  if (!container || !container.appendChild) throw new Error("createSubtitles: container element required");
  const prefKey = options.storageKey || PREF_KEY, persist = options.persist !== false;
  const saved = persist ? loadPrefs(prefKey) : {};
  const S = {
    style: resolveStyle(options.style || "classic"), size: clamp(saved.size ?? options.size ?? 1, 0.6, 2.2), bgOpacity: saved.bgOpacity ?? options.bgOpacity ?? null,
    captions: saved.captions ?? options.captions ?? true, labels: saved.labels ?? options.speakerLabels ?? "change", // change | always | off
    place: options.placement || "bottom", safe: clamp(options.safeArea ?? 0.9, 0.6, 1), insetBottom: options.insetBottom || 0,
    maxChars: options.maxChars || null, maxLines: options.maxLines || 2, maxStack: options.maxStack || 2,
    lang: options.language || "en", a11y: options.a11y || "live", characters: options.characters || {}, avatar: options.avatar || null,
    anchorOf: options.anchorOf || null, cpsLimit: options.cpsLimit || null, autoExtend: !!options.autoExtend,
    reduced: options.reducedMotion === true || options.reducedMotion === false ? options.reducedMotion : null,
  };
  const reduceMQ = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)"); } catch { return null; } })();
  const reduced = () => (S.reduced != null ? S.reduced : !!reduceMQ?.matches);
  const listeners = new Map();
  const emit = (name, detail) => { const a = listeners.get(name); if (a) for (const f of [...a]) { try { f(detail); } catch (e) { console.error(e); } } };
  const on = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); return () => listeners.get(name)?.delete(fn); };

  // ---- DOM ----
  const cs = getComputedStyle(container); if (cs.position === "static") container.style.position = "relative";
  const root = el("div", NS + "root"); root.setAttribute("data-kmj", "");
  const vis = el("div", NS + "vis", { "aria-hidden": S.a11y === "off" ? "false" : "true" });
  const safe = el("div", NS + "safe"), stacks = { top: el("div", NS + "stack", { "data-pos": "top" }), middle: el("div", NS + "stack", { "data-pos": "middle" }), bottom: el("div", NS + "stack", { "data-pos": "bottom" }) };
  const bubbles = el("div", NS + "bubbles");
  safe.append(stacks.top, stacks.middle, stacks.bottom); vis.append(safe, bubbles);
  const mirror = el("div", NS + "sr", S.a11y === "log" ? { role: "log", "aria-live": "polite", "aria-relevant": "additions" } : S.a11y === "live" ? { "aria-live": "polite", "aria-atomic": "false", "aria-relevant": "additions" } : { hidden: "" });
  root.append(vis, mirror); container.appendChild(root);
  if (options.css !== false && getComputedStyle(root).position !== "absolute" && !document.querySelector("link[data-kmj-css]")) { // stylesheet not loaded by the page: load it next to this file
    const lk = document.createElement("link"); lk.rel = "stylesheet"; lk.href = new URL("./subtitles.css", import.meta.url).href; lk.setAttribute("data-kmj-css", ""); document.head.append(lk);
  }

  let W = container.clientWidth || 640, H = container.clientHeight || 360;
  function applyVars() {
    const inset = ((1 - S.safe) / 2) * 100;
    safe.style.inset = `${inset}%`; safe.style.bottom = `calc(${inset}% + ${S.insetBottom}px)`;
    const baseFs = Math.min(H * 0.056, ((W * S.safe * 0.9) / ((STYLES[S.style].maxChars) * 0.56)) * 1.0) * (S.style === "bubble" ? 0.86 : S.style === "cinematic" ? 0.82 : 1);
    root.style.setProperty("--kmj-fs", `${clamp(baseFs * S.size, 9, 96).toFixed(2)}px`);
    root.style.setProperty("--kmj-bg", S.bgOpacity == null ? "" : String(S.bgOpacity)); if (S.bgOpacity == null) root.style.removeProperty("--kmj-bg");
    root.setAttribute("data-style", S.style); root.setAttribute("data-motion", reduced() ? "reduce" : "full"); root.setAttribute("data-captions", S.captions ? "on" : "off");
    vis.hidden = !S.captions;
  }
  function effMax() { const fs = parseFloat(root.style.getPropertyValue("--kmj-fs")) || 18, avail = W * S.safe * (S.style === "bubble" ? 0.55 : 1); const byWidth = Math.floor(avail / (fs * 0.56)); return clamp(Math.min(S.maxChars || STYLES[S.style].maxChars, byWidth), 12, 80); }
  let ro = null;
  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver((es) => { const r = es[0].contentRect; if (Math.abs(r.width - W) > 0.5 || Math.abs(r.height - H) > 0.5) { W = r.width || W; H = r.height || H; applyVars(); relayout(); } }); ro.observe(container); }
  const onMQ = () => { applyVars(); relayout(); }; reduceMQ?.addEventListener?.("change", onMQ);

  // ---- state ----
  let seekTimer = 0, tracks = { [S.lang]: [] }, idx = createIndex([]), t = 0, playing = false, rate = 1, loop = false, raf = 0, lastNow = 0, follower = null, destroyed = false, seeking = false, mirrorTimer = 0, sawPlayInfo = false;
  const pinned = new Map(); // id -> rec shown by show()
  const cues = new Map(); // id -> cue (DOM) ; also the set of active lines
  const recs = new WeakMap(); // normalized line -> rec cache
  const talkLast = new Map(); // characterId -> last amplitude
  const live = new Map(); // id -> {rec, wi, wordAt (perf ms), source}
  let lastSpeaker = null;

  const recFor = (line) => {
    let r = recs.get(line); if (r) return r;
    const words = line.words?.length ? line.words.map((w) => ({ ...w, syl: w.syl || syllables(w.text) })) : estimateWordTimes(line.text, line.durationMs, { lang: line.lang || S.lang });
    r = { line, words, layoutKey: "", lay: null, wi: -2, page: -1 }; recs.set(line, r); return r;
  };
  const layoutFor = (rec) => {
    const mc = effMax(), key = `${mc}|${S.maxLines}|${S.style}`;
    if (rec.layoutKey !== key) { rec.lay = layoutText(rec.line.text, { lang: rec.line.lang || S.lang, maxChars: mc, maxLines: S.maxLines }); rec.layoutKey = key; }
    return rec.lay;
  };
  const setLines = (arr, lang = S.lang) => {
    let lines = arr.map((l) => normalizeLine(l, { lang, fps: options.fps })).filter((l) => l.status !== "cut");
    if (S.autoExtend) { const r = autoExtend(lines, { cpsLimit: S.cpsLimit }); lines = r.lines; }
    return lines;
  };
  const rebuildIndex = () => { idx = createIndex(tracks[S.lang] || []); };

  // ---- cue DOM ----
  const placeOf = (rec) => rec.line.position || S.place;
  const whoNeeded = (rec, speakerChanged, overlapping) => rec.line.kind !== "sfx" && rec.line.kind !== "music" && (rec.line.characterId != null) && (S.labels === "always" || (S.labels === "change" && (speakerChanged || overlapping)) || rec.line.presence !== "on");
  function buildCue(rec, pageIdx, speakerChanged, overlapping) {
    const l = rec.line, lay = layoutFor(rec), page = lay.pages[pageIdx] || lay.pages[0], ch = resolveCharacter(S.characters, l.characterId);
    const c = el("div", NS + "cue", { "data-kind": l.kind, "data-presence": l.presence, "data-who": ch.id });
    c.lang = l.lang || S.lang; c.dir = l.dir || ch.dir || lay.dir;
    if (l.settings?.align) c.style.textAlign = l.settings.align === "start" ? "start" : l.settings.align === "end" ? "end" : l.settings.align;
    if (whoNeeded(rec, speakerChanged, overlapping)) {
      const who = el("div", NS + "who"), mk = el("span", NS + "mark", { "data-shape": ch.shape }); mk.append(el("i", "", {}));
      mk.firstChild.textContent = ch.initial;
      who.append(mk);
      const av = S.avatar ? S.avatar(ch, l) : ch.avatar; if (av) { const slot = el("span", NS + "av"); if (typeof av === "string") { const im = el("img", "", { alt: "", width: 24, height: 24, src: av }); slot.append(im); } else if (av.nodeType) slot.append(av); who.prepend(slot); }
      const nm = el("span", NS + "name", { "data-ul": ch.underline }); nm.textContent = ch.name; who.append(nm);
      const tag = l.presence === "vo" ? "V.O." : l.presence === "os" ? "O.S." : l.parenthetical && !/^\(?\s*(V\.?O|O\.?S)/i.test(l.parenthetical) ? l.parenthetical.replace(/^\(|\)$/g, "") : "";
      if (tag) { const tg = el("span", NS + "tag"); tg.textContent = `(${tag})`; who.append(tg); }
      c.append(who);
    } else if (l.parenthetical && l.presence === "on" && l.kind === "dialogue") { const tg = el("div", NS + "who"), t2 = el("span", NS + "tag"); t2.textContent = `(${l.parenthetical.replace(/^\(|\)$/g, "")})`; tg.append(t2); c.append(tg); }
    const body = el("div", NS + "text"), words = [], chars = [];
    const charMode = S.style === "typewriter" && !reduced();
    page.lines.forEach((ln) => {
      const row = el("div", NS + "l");
      ln.tokens.forEach((tok, ti) => {
        const sp = el("span", NS + "w"); sp.dataset.i = tok.wi;
        for (const run of runsOf(tok, lay.spans)) {
          let host = sp; if (run.it) { host = el("em"); sp.append(host); }
          if (charMode) for (const ch2 of run.text) { const cs2 = el("span", NS + "c"); cs2.textContent = ch2; host.append(cs2); chars.push({ node: cs2, idx: tok.c0 + chars.length }); } else host.append(document.createTextNode(run.text));
        }
        if (tok.wi >= 0) words[tok.wi - page.w0] = sp;
        row.append(sp); if (tok.sp && ti < ln.tokens.length - 1) row.append(document.createTextNode(" "));
      });
      body.append(row);
    });
    c.append(body);
    return { node: c, rec, page: pageIdx, words, w0: page.w0, wi: -2, chars, revealed: -1, ch, sentinel: { speaker: ch.id } , born: performance.now(), tail: null, placed: false };
  }
  const bubbleQueue = [];
  function placeBubble(cue) {
    const l = cue.rec.line, ch = cue.ch, a = l.anchor || ch.anchor || S.anchorOf?.(ch.id, l) || null;
    cue.node.style.left = "0px"; cue.node.style.top = "0px"; cue.anchor = a; bubbleQueue.push(cue);
  }
  function flushBubbles() {
    if (!bubbleQueue.length) return;
    const items = bubbleQueue.splice(0), inset = ((1 - S.safe) / 2), sx0 = W * inset, sx1 = W * (1 - inset), sy0 = H * inset, sy1 = H * (1 - inset) - S.insetBottom;
    const m = items.map((c) => ({ c, w: c.node.offsetWidth, h: c.node.offsetHeight })); // single read pass
    const taken = [];
    for (const { c, w, h } of m) { // single write pass
      if (c.node.parentNode !== bubbles) continue;
      const a = c.anchor || { x: "50%", y: `${25 + taken.length * 18}%` }, ax = ANCHOR_NUM(a.x, W), ay = ANCHOR_NUM(a.y, H), narr = c.rec.line.kind === "narration" || c.ch.narrator, sfx = c.rec.line.kind === "sfx" || c.rec.line.kind === "music";
      const gapTail = 14 * (parseFloat(root.style.getPropertyValue("--kmj-fs")) / 18 || 1);
      let up = ay - h - gapTail >= sy0, x = clamp(ax - w / 2, sx0, Math.max(sx0, sx1 - w)), y = up ? ay - h - gapTail : ay + gapTail;
      if (!up && y + h > sy1) y = Math.max(sy0, sy1 - h);
      if (!c.anchor || narr || sfx) { x = clamp(ax - w / 2, sx0, Math.max(sx0, sx1 - w)); y = clamp(narr ? sy0 + taken.length * (h + 6) : ay, sy0, Math.max(sy0, sy1 - h)); }
      for (const r of taken) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) y = r.y + r.h + 6 <= sy1 - h ? r.y + r.h + 6 : Math.max(sy0, r.y - h - 6);
      taken.push({ x, y, w, h });
      c.node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; c.node.style.left = "0"; c.node.style.top = "0";
      const hasTail = !!c.anchor && !narr && !sfx;
      c.node.setAttribute("data-tail", hasTail ? (up && y + h <= ay ? "down" : "up") : "none");
      if (hasTail) c.node.style.setProperty("--tail-x", `${Math.round(clamp(ax - x, 18, w - 18))}px`);
    }
  }
  function relayout() { // style / size / language changed: rebuild what is on screen
    for (const [id, c] of [...cues]) { c.node.remove(); cues.delete(id); }
    bubbleQueue.length = 0; render(t, { force: true });
  }

  // ---- mirror for assistive tech ----
  const mirrorQ = [];
  function mirrorPush(rec) { if (S.a11y === "off" || !S.captions) return; mirrorQ.push(rec); clearTimeout(mirrorTimer); mirrorTimer = setTimeout(mirrorFlush, 140); }
  function mirrorFlush() {
    const q = mirrorQ.splice(0); for (const rec of q) {
      const l = rec.line, ch = l.characterId != null ? resolveCharacter(S.characters, l.characterId) : null, p = el("p"); p.lang = l.lang || S.lang;
      const who = ch && l.kind === "dialogue" ? `${ch.name}${l.presence === "vo" ? " (voice over)" : l.presence === "os" ? " (off screen)" : ""}${l.parenthetical && l.presence === "on" ? ` (${l.parenthetical.replace(/^\(|\)$/g, "")})` : ""}: ` : "";
      p.textContent = who + parseMarkup(l.text).plain.replace(/\s+/g, " ").trim(); mirror.append(p);
    }
    while (mirror.childNodes.length > 4) mirror.removeChild(mirror.firstChild);
  }

  // ---- render ----
  const activeSet = new Set();
  function renderWords(cue, wi, rel, rec, immediate) {
    if (cue.wi === wi && S.style !== "typewriter") return;
    const w0 = cue.w0 < 0 ? 0 : cue.w0, from = cue.wi === -2 ? -1 : cue.wi, lo = Math.min(from, wi), hi = Math.max(from, wi);
    const full = cue.wi === -2 || Math.abs(wi - from) > 24;
    const a = full ? 0 : Math.max(0, lo - w0), b = full ? cue.words.length - 1 : Math.min(cue.words.length - 1, hi - w0);
    for (let k = a; k <= b; k++) { const n = cue.words[k]; if (!n) continue; const g = k + w0, st = g < wi ? "p" : g === wi ? (rec.words[g] && rel >= rec.words[g].endMs && !rec.liveMode ? "p" : "n") : "f"; if (n.dataset.s !== st) n.dataset.s = st; }
    if (S.style === "typewriter" && cue.chars.length) {
      let upto = 0; if (reduced() || wi < 0 && rel < 0) upto = reduced() ? Infinity : 0;
      else if (wi >= 0) { const w = rec.words[wi], span = Math.max(1, (w.endMs - w.startMs) * 0.8), f = clamp((rel - w.startMs) / span, 0, 1); upto = w.c0 + Math.ceil(f * (w.c1 - w.c0)); if (rel >= w.endMs) upto = w.c1; }
      const last = cue.revealed; if (upto !== last) { for (let k = 0; k < cue.chars.length; k++) { const on = cue.chars[k].idx < upto; if (!!cue.chars[k].on !== on) { cue.chars[k].on = on; cue.chars[k].node.dataset.r = on ? "1" : "0"; } } cue.revealed = upto; cue.node.classList.toggle(NS + "typing", upto < Infinity && wi >= 0 && upto < (rec.words[rec.words.length - 1]?.c1 ?? 0)); }
    }
    cue.wi = wi;
  }
  function pageFor(lay, wi) { if (wi < 0) return 0; for (let i = 0; i < lay.pages.length; i++) if (wi <= lay.pages[i].w1 || i === lay.pages.length - 1) return i; return 0; }
  function mountCue(cue, rec) {
    const bub = S.style === "bubble";
    if (bub) { bubbles.append(cue.node); placeBubble(cue); } else stacks[placeOf(rec) === "middle" ? "middle" : placeOf(rec) === "top" ? "top" : "bottom"].append(cue.node);
    const st = rec.line.settings; if (!bub && st?.size && /%$/.test(st.size)) cue.node.style.maxWidth = st.size;
  }
  function render(now, o = {}) {
    if (destroyed) return;
    let list = [...pinned.values(), ...idx.at(now).map(recFor)];
    // overlap policy: keep the latest started lines up to maxStack (sound captions yield first)
    if (list.length > S.maxStack) { list = list.sort((a, b) => (a.line.kind === "sfx" || a.line.kind === "music") - (b.line.kind === "sfx" || b.line.kind === "music") || (b.line.startMs ?? 0) - (a.line.startMs ?? 0)).slice(0, S.maxStack).sort((a, b) => (a.line.startMs ?? 0) - (b.line.startMs ?? 0)); }
    const nextSet = new Set(list.map((r) => r.line.id)), overlapping = list.filter((r) => r.line.kind !== "sfx").length > 1;
    // ends
    for (const id of [...activeSet]) if (!nextSet.has(id)) {
      activeSet.delete(id); const c = cues.get(id);
      if (c) { cues.delete(id); if (seeking || reduced() || !S.captions) c.node.remove(); else { c.node.classList.add(NS + "out"); setTimeout(() => c.node.remove(), 180); } }
      const rec = c?.rec || recsById.get(id); if (rec) { emit("lineEnd", { line: rec.line, t: now, seeking }); talkOff(rec); }
    }
    for (const rec of list) {
      const l = rec.line, id = l.id, lv = live.get(id);
      const rel = lv ? lv.rel() : now - (l.startMs ?? 0);
      recsById.set(id, rec); rec.liveMode = !!lv;
      let wi = lv ? lv.wi : wordIndexAt(rec.words, rel);
      const lay = layoutFor(rec), pg = pageFor(lay, wi);
      let cue = cues.get(id);
      if (!activeSet.has(id)) {
        activeSet.add(id);
        const changed = lastSpeaker !== l.characterId && l.kind === "dialogue"; if (l.kind === "dialogue") { if (changed && lastSpeaker !== null) emit("speakerChange", { from: lastSpeaker, to: l.characterId, line: l, t: now }); lastSpeaker = l.characterId; }
        rec.speakerChanged = changed; emit("lineStart", { line: l, t: now, seeking, midLine: rel > 120 });
        if (!seeking && !o.silentMirror) mirrorPush(rec);
        const warn = checkLine(l, { cpsLimit: S.cpsLimit }); if (!warn.ok && !seeking) emit("warning", { line: l, warnings: warn.warnings, cps: warn.cps });
      }
      if (S.captions && (!cue || cue.page !== pg)) {
        const old = cue; cue = buildCue(rec, pg, rec.speakerChanged, overlapping); cues.set(id, cue); mountCue(cue, rec); if (old) old.node.remove();
      }
      if (cue) { renderWords(cue, wi, rel, rec); }
      if (wi !== rec.wi) { rec.wi = wi; if (wi >= 0) emit("wordStart", { line: l, index: wi, word: rec.words[wi]?.text, charStart: rec.words[wi]?.c0, charEnd: rec.words[wi]?.c1, t: now, seeking }); }
      talk(rec, rel, now);
    }
    if (bubbleQueue.length) flushBubbles();
  }
  const recsById = new Map();
  function talk(rec, rel, now) {
    const l = rec.line; if (l.kind === "sfx" || l.kind === "music") return;
    const m = mouthAmplitude(rec.words, rel), key = l.characterId ?? "narrator", prev = talkLast.get(key);
    if (!prev || prev.id !== l.id || Math.abs(prev.a - m.open) > 0.015 || prev.s !== m.speaking) { talkLast.set(key, { id: l.id, a: m.open, s: m.speaking }); emit("talking", { characterId: key, speaking: m.speaking, amplitude: playing || live.has(l.id) || seeking ? m.open : 0, viseme: m.viseme, line: l, wordIndex: m.wordIndex, t: now }); }
  }
  function talkOff(rec) { const key = rec.line.characterId ?? "narrator", p = talkLast.get(key); if (p && p.id === rec.line.id) { talkLast.delete(key); emit("talking", { characterId: key, speaking: false, amplitude: 0, viseme: null, line: rec.line, wordIndex: -1, t }); } }

  // ---- clock ----
  function frame(ts) {
    raf = 0; if (destroyed) return;
    if (follower) { const v = follower(); if (Number.isFinite(v)) t = v; } else if (playing) { t += (ts - lastNow) * rate; }
    lastNow = ts;
    if (playing && !follower && t >= idx.end && !live.size && !pinned.size) { t = idx.end; if (loop) { t = 0; } else { playing = false; render(t); emit("ended", { t }); emit("state", { playing: false }); return; } }
    render(t);
    if (playing || follower || live.size) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && !destroyed) { lastNow = performance.now(); raf = requestAnimationFrame(frame); } };

  // ---- public controller ----
  const ctl = {
    el: root, get time() { return t; }, get playing() { return playing; }, get style() { return S.style; }, get language() { return S.lang; }, get settings() { return { size: S.size, bgOpacity: S.bgOpacity, captions: S.captions, speakerLabels: S.labels, style: S.style, placement: S.place }; },
    on, off(name, fn) { listeners.get(name)?.delete(fn); },
    /** Show one line or a list immediately; untimed lines stay until clear() (or `holdMs`). */
    show(lineOrLines, o = {}) {
      const arr = (Array.isArray(lineOrLines) ? lineOrLines : [lineOrLines]).map((l) => normalizeLine(l, { lang: S.lang, fps: options.fps }));
      for (const l of arr) { const rec = recFor({ ...l, startMs: null }); rec.line = rec.line; pinned.set(l.id, rec); rec.pinned = true; const hold = o.holdMs ?? l.holdMs; if (hold > 0) setTimeout(() => { if (pinned.get(l.id) === rec) { pinned.delete(l.id); render(t); } }, hold); }
      render(t); return ctl;
    },
    /** Set the timeline (array, or {lang: array}) and start playing it. */
    play(timeline, o = {}) {
      if (timeline) ctl.setTimeline(timeline);
      if (o.rate) rate = o.rate; loop = !!o.loop; if (o.from != null) t = o.from;
      pinned.clear(); playing = true; seeking = false; emit("state", { playing: true }); kick(); render(t); return ctl;
    },
    setTimeline(timeline) {
      if (Array.isArray(timeline)) tracks[S.lang] = setLines(timeline); else for (const [k, v] of Object.entries(timeline || {})) tracks[k] = setLines(v, k);
      if (!tracks[S.lang]) S.lang = Object.keys(tracks)[0]; rebuildIndex(); clearDom(); render(t); return ctl;
    },
    addTrack(lang, lines) { tracks[lang] = setLines(lines, lang); if (lang === S.lang) { rebuildIndex(); clearDom(); render(t); } return ctl; },
    get tracks() { return Object.keys(tracks); },
    get duration() { return idx.end; },
    get lines() { return (tracks[S.lang] || []).slice(); },
    pause() { if (!playing) return ctl; playing = false; emit("state", { playing: false }); for (const r of [...activeSet].map((i) => recsById.get(i))) if (r) talkOff(r); return ctl; },
    resume() { if (playing) return ctl; playing = true; emit("state", { playing: true }); kick(); return ctl; },
    /** Jump to a time. Synchronous and cheap (a binary search plus diffing the few visible cues), so it is safe at 60 Hz while scrubbing. */
    seek(ms) {
      t = Math.max(0, +ms || 0); seeking = true; render(t); seeking = false; clearTimeout(mirrorTimer); clearTimeout(seekTimer); mirrorQ.length = 0;
      seekTimer = setTimeout(() => { if (!destroyed && !playing) { mirror.textContent = ""; for (const id of activeSet) { const r = recsById.get(id); if (r) mirrorPush(r); } } }, 350); // announce once, after scrubbing settles
      return ctl;
    },
    /** Push-mode clock for hosts that own the playhead (Previs). Call on every playhead change; playing=true while it advances. */
    tick(ms, o = {}) { t = Math.max(0, +ms || 0); seeking = !!o.seeking; render(t); seeking = false; return ctl; },
    /** Pull-mode clock: a function returning ms, an HTMLMediaElement (currentTime in s) or {now():ms}. follow(null) stops. */
    follow(src) { follower = !src ? null : typeof src === "function" ? src : typeof src.now === "function" ? () => src.now() : () => src.currentTime * 1000; if (follower) kick(); return ctl; },
    setRate(r) { rate = clamp(+r || 1, 0.1, 4); return ctl; },
    clear() { pinned.clear(); for (const id of [...live.keys()]) live.delete(id); t = 0; playing = false; follower = null; clearDom(); for (const r of [...activeSet].map((i) => recsById.get(i))) if (r) talkOff(r); activeSet.clear(); mirror.textContent = ""; return ctl; },
    setStyle(preset) { S.style = resolveStyle(preset); applyVars(); relayout(); emit("style", { style: S.style }); return ctl; },
    setLanguage(lang) { if (tracks[lang] == null) tracks[lang] = []; S.lang = lang; root.lang = lang; rebuildIndex(); clearDom(); render(t); return ctl; },
    setCharacters(map) { S.characters = map || {}; relayout(); return ctl; },
    setPlacement(p) { S.place = ["top", "middle", "bottom"].includes(p) ? p : "bottom"; relayout(); return ctl; },
    setInsetBottom(px) { S.insetBottom = Math.max(0, +px || 0); applyVars(); relayout(); return ctl; },
    setSpeakerLabels(m) { S.labels = ["change", "always", "off"].includes(m) ? m : "change"; if (persist) save(); relayout(); return ctl; },
    setSize(v) { S.size = clamp(+v || 1, 0.6, 2.2); if (persist) save(); applyVars(); relayout(); return ctl; },
    setBackgroundOpacity(v) { S.bgOpacity = v == null ? null : clamp(+v, 0, 1); if (persist) save(); applyVars(); return ctl; },
    setCaptions(on) { S.captions = !!on; if (persist) save(); applyVars(); if (on) relayout(); else clearDom(); return ctl; },
    setReducedMotion(v) { S.reduced = v == null ? null : !!v; applyVars(); relayout(); return ctl; },
    setMaxChars(n) { S.maxChars = n || null; relayout(); return ctl; },
    resetSettings() { S.size = 1; S.bgOpacity = null; S.captions = true; S.labels = "change"; if (persist) save(); applyVars(); relayout(); return ctl; },
    check(o) { return (tracks[S.lang] || []).map((l) => checkLine(l, { cpsLimit: S.cpsLimit, ...o })); },
    /**
     * Live (speech-driven) lines. beginLive(line) shows the line and returns {boundary(e), end(), source}. `boundary` takes a speechSynthesis
     * boundary event or voice.js' onboundary payload ({charIndex}); each call advances the highlight to the word at charIndex of `line.spokenText || line.text`.
     */
    beginLive(rawLine) {
      const line = normalizeLine({ ...rawLine, startMs: null, words: null }, { lang: S.lang }); line.words = null;
      const rec = recFor(line); pinned.set(line.id, rec);
      const spoken = parseMarkup(rawLine.spokenText ?? line.text).plain, spokenToks = tokenize(spoken, line.lang || S.lang).filter((x) => x.w);
      const lv = { wi: -1, at: performance.now(), base: 0, rel() { const w = rec.words[this.wi]; return this.wi < 0 ? -1 : Math.min(w.startMs + (performance.now() - this.at), w.endMs - 1); } };
      live.set(line.id, lv); kick(); render(t);
      const h = {
        id: line.id, line,
        boundary(e) {
          if (!live.has(line.id)) return; const ci = e?.charIndex ?? 0; let k = -1; for (let i = 0; i < spokenToks.length; i++) if (spokenToks[i].c0 <= ci) k = i; else break;
          const ratio = spokenToks.length ? rec.words.length / spokenToks.length : 1; lv.wi = clamp(Math.round(k * (ratio === 1 ? 1 : ratio)), -1, rec.words.length - 1); lv.at = performance.now();
        },
        advance(i) { lv.wi = clamp(i, -1, rec.words.length - 1); lv.at = performance.now(); },
        end(o = {}) { live.delete(line.id); setTimeout(() => { if (pinned.get(line.id) === rec) { pinned.delete(line.id); render(t); } }, o.lingerMs ?? 500); render(t); },
      };
      return h;
    },
    /** Speak a line with the browser's system voice (speechSynthesis; no network) with highlight driven by boundary events. Resolves when done. */
    speak(rawLine, o = {}) {
      return new Promise((resolve) => {
        const h = ctl.beginLive(rawLine), line = h.line, text = parseMarkup(rawLine.spokenText ?? line.text).plain;
        if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") { simulate(h, line, resolve); return; }
        const u = new SpeechSynthesisUtterance(text); u.lang = line.lang || S.lang; if (o.rate) u.rate = o.rate; if (o.pitch) u.pitch = o.pitch;
        let got = 0, done = false, fallback = 0;
        const finish = () => { if (done) return; done = true; clearInterval(fallback); h.end(); resolve({ boundaries: got }); };
        u.onboundary = (e) => { if (e.name && e.name !== "word") return; got++; h.boundary(e); };
        u.onstart = () => { const t0 = performance.now(); fallback = setInterval(() => { if (got > 0) { clearInterval(fallback); return; } h.advance(wordIndexAt(recFor(line).words, performance.now() - t0)); }, 60); };
        u.onend = u.onerror = finish; ctl._utter = u;
        try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { finish(); }
        setTimeout(finish, line.durationMs * 2 + 4000);
      });
    },
    stopSpeaking() { try { speechSynthesis.cancel(); } catch { /* none */ } },
    destroy() { destroyed = true; cancelAnimationFrame(raf); clearTimeout(mirrorTimer); clearTimeout(seekTimer); ro?.disconnect(); reduceMQ?.removeEventListener?.("change", onMQ); try { speechSynthesis.cancel(); } catch { /* none */ } root.remove(); listeners.clear(); cues.clear(); pinned.clear(); live.clear(); },
  };
  function simulate(h, line, resolve) { // no speech engine: advance by estimated word times so the demo still shows the live path
    const ws = recFor(line).words, t0 = performance.now(); const iv = setInterval(() => { const rel = performance.now() - t0; h.advance(wordIndexAt(ws, rel)); if (rel > line.durationMs) { clearInterval(iv); h.end(); resolve({ boundaries: 0, simulated: true }); } }, 50);
  }
  function clearDom() { for (const c of cues.values()) c.node.remove(); cues.clear(); activeSet.clear(); bubbleQueue.length = 0; for (const s of Object.values(stacks)) s.textContent = ""; bubbles.textContent = ""; }
  function save() { savePrefs(prefKey, { size: S.size, bgOpacity: S.bgOpacity, captions: S.captions, labels: S.labels }); }
  root.lang = S.lang; applyVars(); rebuildIndex();
  return ctl;
}

// ============================================================ canvas (storyboard thumbnails) ===============================
function shapePath(ctx, shape, x, y, s) { // monochrome identity marker, s = size
  const cx = x + s / 2, cy = y + s / 2, r = s / 2; ctx.beginPath();
  if (shape === "circle") ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (shape === "diamond") { ctx.moveTo(cx, y); ctx.lineTo(x + s, cy); ctx.lineTo(cx, y + s); ctx.lineTo(x, cy); ctx.closePath(); }
  else if (shape === "triangle") { ctx.moveTo(cx, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath(); }
  else if (shape === "hex") { for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); }
  else if (shape === "pill") { const h = s * 0.62; ctx.rect(x, cy - h / 2, s, h); }
  else if (shape === "bar") ctx.rect(x + s * 0.3, y, s * 0.4, s); else ctx.rect(x, y, s, s);
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); } }
/**
 * Static render of one subtitle onto a 2D canvas (storyboard thumbnails, exports). No DOM, no timers.
 * style: preset name or {preset, size, bgOpacity}. opts: {characters, anchor:{x,y}, progress (0..1 of the line, for karaoke / typewriter), safe (0.9), placement, label}.
 * Returns {x, y, w, h, lines} of the drawn box, or null when nothing was drawn.
 */
export function drawSubtitleToCanvas(ctx, line, style, w, h, opts = {}) {
  const st = typeof style === "string" ? { preset: style } : style || {}, preset = resolveStyle(st.preset || "classic"), size = st.size || 1, bg = st.bgOpacity ?? (preset === "classic" ? 0 : preset === "cinematic" ? 0 : 0.7);
  const l = normalizeLine(line, { lang: opts.lang }); if (!l.text.trim()) return null;
  const safe = opts.safe ?? 0.9, ins = (1 - safe) / 2, sx0 = w * ins, sx1 = w * (1 - ins), sy1 = h * (1 - ins), sy0 = h * ins;
  const fs = clamp(Math.min(h * 0.056, (w * safe * 0.9) / (STYLES[preset].maxChars * 0.56)) * size * (preset === "bubble" ? 0.86 : preset === "cinematic" ? 0.82 : 1), 7, 120);
  const fam = preset === "typewriter" ? "ui-monospace, Menlo, monospace" : "system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif";
  const font = (it) => `${it ? "italic " : ""}600 ${fs}px ${fam}`;
  ctx.save(); ctx.font = font(false); ctx.textBaseline = "alphabetic";
  if (preset === "cinematic" && "letterSpacing" in ctx) ctx.letterSpacing = `${(fs * 0.06).toFixed(2)}px`;
  const maxWpx = (preset === "bubble" ? w * 0.5 : (sx1 - sx0) * 0.9);
  const text = preset === "cinematic" ? l.text.toUpperCase() : l.text;
  const lay = layoutText(text, { lang: l.lang, maxLines: 2, measure: (s) => ctx.measureText(s).width, maxWidth: maxWpx });
  const page = lay.pages[0], rows = page.lines, lh = fs * 1.28, pad = fs * 0.4, sw = ctx.measureText(" ").width;
  const prog = opts.progress == null ? 1 : opts.progress, est = estimateWordTimes(text, 1000, { lang: l.lang }), t = prog * 1000, wi = prog >= 1 ? 1e9 : est.length ? wordIndexAt(est, t) : -1;
  const widths = rows.map((r) => r.tokens.reduce((a, tk, i) => a + ctx.measureText(tk.text).width + (i < r.tokens.length - 1 && tk.sp ? sw : 0), 0)), boxW = Math.max(...widths, 1), boxH = rows.length * lh;
  const ch = l.characterId != null && l.kind === "dialogue" ? resolveCharacter(opts.characters, l.characterId) : null, showWho = ch && opts.label !== false;
  const whoH = showWho ? fs * 0.9 : 0;
  let x0, y0;
  const place = l.position || opts.placement || "bottom";
  if (preset === "bubble") {
    const a = l.anchor || ch?.anchor || opts.anchor || { x: "50%", y: "70%" }, ax = ANCHOR_NUM(a.x, w), ay = ANCHOR_NUM(a.y, h), bw = boxW + pad * 2.4, bh = boxH + pad * 1.6 + whoH;
    const up = ay - bh - fs * 0.9 >= sy0; x0 = clamp(ax - bw / 2, sx0, Math.max(sx0, sx1 - bw)) + pad * 1.2; y0 = (up ? ay - bh - fs * 0.8 : ay + fs * 0.8) + pad * 0.8 + whoH;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = Math.max(1.5, fs * 0.1); rr(ctx, x0 - pad * 1.2, y0 - pad * 0.8 - whoH, bw, bh, fs * 0.7); ctx.fill(); ctx.stroke();
    const tx = clamp(ax, x0 - pad * 1.2 + fs, x0 - pad * 1.2 + bw - fs), by = up ? y0 - pad * 0.8 - whoH + bh : y0 - pad * 0.8 - whoH;
    ctx.beginPath(); ctx.moveTo(tx - fs * 0.45, by); ctx.lineTo(ax, up ? by + fs * 0.8 : by - fs * 0.8); ctx.lineTo(tx + fs * 0.45, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillRect(tx - fs * 0.4, by + (up ? -ctx.lineWidth : ctx.lineWidth * 0.2), fs * 0.8, ctx.lineWidth * 1.1);
    ctx.fillStyle = "#111"; y0 += fs; var box = { x: x0 - pad * 1.2, y: y0 - fs - pad * 0.8 - whoH, w: bw, h: bh };
  } else {
    const left = preset === "cinematic"; x0 = left ? sx0 + fs * 0.9 : (w - boxW) / 2; const total = boxH + whoH;
    y0 = place === "top" ? sy0 + whoH + fs : place === "middle" ? (h - total) / 2 + whoH + fs : sy1 - boxH + fs * 0.9 - (opts.insetBottom || 0);
    var box = { x: x0 - pad, y: y0 - fs * 0.95 - whoH, w: boxW + pad * 2, h: total + pad * 0.4 };
  }
  // speaker label (marker + name, monochrome)
  if (showWho) {
    const s = fs * 0.62, lx = preset === "bubble" ? box.x + pad * 1.2 : x0, ly = (preset === "bubble" ? box.y + pad * 0.5 : y0 - fs * 0.95 - s - fs * 0.12);
    ctx.fillStyle = preset === "bubble" ? "#111" : "#fff"; ctx.strokeStyle = preset === "bubble" ? "#fff" : "#000"; ctx.lineWidth = 1.4; shapePath(ctx, ch.shape, lx, ly, s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = preset === "bubble" ? "#fff" : "#000"; ctx.font = `700 ${s * 0.72}px ${fam}`; ctx.textAlign = "center"; ctx.fillText(ch.initial, lx + s / 2, ly + s * 0.78); ctx.textAlign = "left";
    ctx.font = `700 ${fs * 0.58}px ${fam}`; const nm = ch.name.toUpperCase() + (l.presence === "vo" ? " (V.O.)" : l.presence === "os" ? " (O.S.)" : "");
    if (preset !== "bubble") { ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.lineWidth = fs * 0.14; ctx.lineJoin = "round"; ctx.strokeText(nm, lx + s * 1.3, ly + s * 0.8); }
    ctx.fillStyle = preset === "bubble" ? "#111" : "#fff"; ctx.fillText(nm, lx + s * 1.3, ly + s * 0.8); ctx.font = font(false);
  }
  const italic = (tk) => lay.spans.some((s) => tk.c0 >= s.c0 && tk.c0 < s.c1);
  rows.forEach((r, ri) => {
    let x = preset === "cinematic" ? x0 : x0 + (boxW - widths[ri]) / 2, y = y0 + ri * lh; if (preset === "bubble") x = x0 + (boxW - widths[ri]) / 2;
    if ((preset === "boxed" || preset === "karaoke" || preset === "typewriter" || (bg > 0 && preset === "classic")) ) { ctx.fillStyle = `rgba(0,0,0,${bg || 0.5})`; rr(ctx, x - pad * 0.7, y - fs * 0.95, widths[ri] + pad * 1.4, lh, fs * 0.3); ctx.fill(); }
    r.tokens.forEach((tk, ti) => {
      ctx.font = font(italic(tk)); const tw = ctx.measureText(tk.text).width;
      let txt = tk.text; if (preset === "typewriter" && prog < 1) { const up = Math.ceil(prog * l.text.length); txt = tk.text.slice(0, Math.max(0, up - tk.c0)); }
      const state = tk.wi < 0 ? "p" : tk.wi < wi ? "p" : tk.wi === wi ? "n" : "f";
      if (preset === "karaoke" && state === "n") { ctx.fillStyle = "#fff"; rr(ctx, x - fs * 0.1, y - fs * 0.88, tw + fs * 0.2, lh * 0.9, fs * 0.2); ctx.fill(); }
      if (preset === "bubble") ctx.fillStyle = "#111"; else if (preset === "karaoke" && state === "n") ctx.fillStyle = "#000"; else ctx.fillStyle = "#fff";
      if (preset === "karaoke" && state === "f") ctx.globalAlpha = 0.62;
      if (preset === "classic" || preset === "cinematic") { ctx.strokeStyle = "rgba(0,0,0,.88)"; ctx.lineJoin = "round"; ctx.lineWidth = fs * 0.2; ctx.strokeText(txt, x, y); }
      ctx.fillText(txt, x, y);
      if (preset === "karaoke" && state === "p") { ctx.fillRect(x, y + fs * 0.12, tw, Math.max(1, fs * 0.05)); }
      ctx.globalAlpha = 1; x += tw + (tk.sp && ti < r.tokens.length - 1 ? sw : 0);
    });
  });
  if (preset === "cinematic") { ctx.fillStyle = "#fff"; ctx.fillRect(sx0 + fs * 0.35, box.y + fs * 0.2, Math.max(2, fs * 0.08), box.h - fs * 0.2); }
  ctx.restore();
  return { ...box, lines: rows.map((r) => r.text) };
}
