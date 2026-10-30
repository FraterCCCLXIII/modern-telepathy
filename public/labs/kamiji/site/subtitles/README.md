# Subtitles module

Reusable subtitles for characters that talk. Plain ES modules, no build, no network, no dependencies.

| File | What |
|---|---|
| `subtitles.js` | the module (pure helpers + `createSubtitles` + `drawSubtitleToCanvas`) |
| `subtitles.css` | styles, scoped under `.kmj-root`, monochrome |
| `index.html`, `demo.js`, `demo.css` | playground |
| `subtitles.test.mjs` | `node --test site/subtitles/subtitles.test.mjs` (31 tests) |
| `verify.py` | Playwright check of the demo (system Chrome, server on 127.0.0.1:8792) |

```js
import { createSubtitles } from "./subtitles/subtitles.js";   // and <link rel="stylesheet" href="subtitles/subtitles.css">
const subs = createSubtitles(stageEl, { style: "classic", characters: { kami: { name: "Kami" } } });
subs.play([{ id: "a", characterId: "kami", text: "Hello *there*!", startMs: 0, durationMs: 1800 }]);
subs.on("talking", (e) => avatar.setMouth(e.amplitude));
```
`stageEl` gets `position: relative` if it is static. If the stylesheet is not on the page the module loads `subtitles.css` from its own folder.

## Data model (one subtitle line)

Matches Previs' script line (`id, char, kind, text, shot, node, status`) plus timing.

| Field | Meaning |
|---|---|
| `id` | string, stable |
| `characterId` | speaker id or `null` / `"narrator"` (Previs calls this `char`; both are accepted) |
| `text` | `<i>..</i>` or `*..*` for emphasis, `[door slams]` = sound caption, leading `♪` = music; `\n` = authored line break |
| `parenthetical` | "whispering"; `"V.O."` / `"O.S."` also set `presence` |
| `kind` | `dialogue` `narration` `sfx` `music` (Previs `action` = narration, `paren` merged into the next dialogue line) |
| `presence` | `on` (default) `vo` `os` |
| `startMs`, `durationMs` | or `startFrame`, `durationFrames` with `fps` (default 24). Missing duration is estimated at 2.7 words/s (Previs' WPS) and flagged `estimated` |
| `words` | optional `[{text, startMs, endMs}]`, times relative to the line start. Otherwise estimated (syllable-like weights plus pauses at punctuation) |
| `lang`, `dir` | per-line language attribute and `ltr`/`rtl` (auto-detected) |
| `shot`, `node` | links back to Previs (carried through, not used for display) |
| `anchor` | `{x, y}` px or `"40%"`, Comic bubble tail target. Falls back to `characters[id].anchor` or `options.anchorOf(id, line)` |
| `position` | `top` `middle` `bottom` per line; `settings` holds WebVTT cue settings |
| `spokenText` | text actually sent to TTS when it differs (used to map speech boundary `charIndex` to words) |

Characters: `{ [id]: { name, initial, shape (circle square diamond triangle hex pill bar), underline (solid dotted dashed double wavy none), anchor, avatar (url | Node), dir } }`. Missing fields are generated stably from the id, so identity is never hue-only.

## API

`createSubtitles(container, options)` returns a controller.

Options: `style`, `characters`, `language`, `placement` (bottom/top/middle), `safeArea` (0.9 = title-safe), `maxChars`, `maxLines` (2), `maxStack` (2), `speakerLabels` (`change` | `always` | `off`), `a11y` (`live` | `log` | `off`), `avatar(character, line)`, `anchorOf`, `cpsLimit`, `autoExtend`, `reducedMotion` (`true`/`false`, default follows the system), `persist`, `storageKey`, `fps`.

| Method | |
|---|---|
| `show(line \| lines, {holdMs})` | show now (untimed lines stay until `clear()`) |
| `play(timeline?, {from, rate, loop})`, `pause()`, `resume()`, `seek(ms)`, `setRate(r)` | internal clock. `seek` is synchronous and cheap (binary search, diff of 1-2 cues) |
| `tick(ms)` / `follow(fn \| mediaElement \| {now()})` | host-driven clock (Previs playhead, audio `currentTime`) |
| `setTimeline(lines \| {lang: lines})`, `addTrack(lang, lines)`, `setLanguage(lang)` | tracks |
| `setStyle(preset)` | `classic boxed karaoke bubble cinematic typewriter` (live switch) |
| `setSize`, `setBackgroundOpacity`, `setCaptions`, `setSpeakerLabels`, `setPlacement`, `setInsetBottom(px)`, `setCharacters`, `setReducedMotion`, `resetSettings` | settings; size, opacity, captions, labels persist in `localStorage` (try/catch) |
| `beginLive(line)` -> `{boundary(e), advance(i), end()}`, `speak(line)`, `stopSpeaking()` | speech-driven words (system voice only) |
| `check()` | reading-speed report for the track |
| `on(event, fn)` returns an off function; `destroy()` | |

Events: `lineStart`, `lineEnd`, `wordStart {line,index,word,charStart,charEnd}`, `speakerChange`, `talking`, `warning`, `state`, `ended`, `style`. During a seek, events carry `seeking: true`.

`talking`: `{characterId, speaking, amplitude 0..1, viseme (A E I O U | null), line, wordIndex, t}`, fired when the value changes (about every frame while speaking), and once with `speaking:false` at line end or pause.

Pure functions (Node-safe): `splitLines(text, {maxChars, maxLines, lang, measure, maxWidth})` -> pages -> lines; `layoutText`, `tokenize`, `parseMarkup`, `estimateWordTimes`, `estimateDurationMs`, `mouthAmplitude(words, relMs)`, `checkLine`, `autoExtend`, `createIndex`, `toSRT/parseSRT`, `toVTT/parseVTT`, `toJSON/fromJSON`, `parseAuto`, `fromPrevisScript`, `charactersFromPrevis`, `resolveCharacter`.

Line splitting follows broadcast conventions: 37 width units per line (CJK full-width = 2 units, so 16 characters), at most 2 lines, balanced by a small DP; prefers breaks after sentence and clause punctuation, avoids ending a line on a function word, never starts a line with closing punctuation (kinsoku). Over-long text becomes several pages that switch on word times. Words come from `Intl.Segmenter` when present (CJK, Thai), with a plain fallback. Reading speed: 17 cps (ja 4, zh 9, ko 12), min 833 ms, max 7 s; `checkLine` warns, `autoExtend` lengthens as far as the next line allows and reports what it could not fix.

Import/export: SRT (speakers as `NAME (V.O.): text`, `<i>`), WebVTT (`<v Name>`, `<v.vo Name>`, cue settings `line position size align vertical`, `<lang>`, optional `<00:00:01.000>` word stamps with `wordTimings:true`, overlapping speakers = two cues), JSON `{format:"kamiji-subtitles", version:1, language, fps, characters, tracks}`. Parsers return `{lines, errors:[{line,message}], warnings}`.

Canvas: `drawSubtitleToCanvas(ctx, line, style, w, h, {characters, anchor, progress, placement, safe})` draws any preset with no DOM; returns the box or `null`.

## Accessibility

Visible captions are `aria-hidden`; a visually hidden mirror (`aria-live="polite"`, or `role="log"`) announces `Speaker: text` once per line, debounced, and announces the current line once after scrubbing settles. `a11y:"off"` removes the mirror and exposes the visible captions instead. Captions toggle, size and background settings, per-line `lang`/`dir`, speaker labels with (V.O.)/(O.S.), sound and music captions, `forced-colors` and `prefers-contrast` support. `prefers-reduced-motion` (or `setReducedMotion(true)`) removes typing, bounce and fades; lines appear instantly.

## Integration plan

All steps are outside this folder and not yet done.

### 1. Previs
- Data source: the script drawer's `project.script.lines`. `fromPrevisScript(project.script, {fps: p.fps, timing: (l) => { const r = rowByLineId.get(l.id); return r?.start != null ? {startFrame: r.start, durationFrames: shotOrLineFrames} : null; }})`, where rows come from `orderedLines(store)` in `script.js` (its `start` is the shot's frame). Rebuild on the store's `script` change; call `subs.setTimeline(lines)`.
- Viewport overlay: `createSubtitles(viewportEl, {characters: charactersFromPrevis(characters(store), p.script.names), anchorOf})`. Do not use the WebGL canvas as container; a sibling `div` over it works inside the scaled viewport because sizes come from `ResizeObserver` content boxes (not transforms). Feed `anchorOf(id)` from projected character screen positions for Comic bubble.
- Clock: the Dialogue track playhead. Call `subs.tick(frameToMs(playhead), {seeking})` from the transport's per-frame update (or `subs.follow(() => playheadMs)`). Never call `play()` in Previs; Previs owns time.
- Storyboard thumbnails: `drawSubtitleToCanvas(ctx, line, style, w, h, {characters})` after the shot render, for the shot's first dialogue line.
- Timeline Dialogue track: `checkLine` per clip for a "too fast" outline; `autoExtend` as a menu action.
- Reduced motion: Previs already avoids autoplay; subtitles follow the same media query.

### 2. Site chat and voice
- `voice.js` already exposes `onboundary({charIndex, length, name})` with `charIndex` relative to the text it spoke (after `cleanForSpeech`). Wire: `const h = subs.beginLive({id, characterId, text: shown, spokenText: cleaned}); createVoice({onboundary: h.boundary, onend: () => h.end()})`. `spokenText` is what lets word indexes line up when markdown was stripped.
- `chat-widget.js` `speak(text)`: create the live line before `voice.speak`, end it in `onend`. Kamikin `chat.js` is the same with `lang: "ja"`.
- Voices without boundary events: `beginLive` + `h.advance(i)` from a timer using `estimateWordTimes`, as `subs.speak()` does.

### 3. Avatar mouth
Subscribe to `talking` and feed `amplitude` to the rig. Existing sinks: `avatar.setMouth(open)` in `chat-widget.js` (0..1), and `rtk-mouth.js` controller `setOpen(v)` or `setViseme(letter)` (use `e.viseme`). Close it on `speaking:false`. For `<kamiji-avatar>` set its expression with the mood protocol (`kamiji:mood`) separately; the element has no direct mouth-open property today, so use the rtk-mouth controller of the same character. Amplitude is one pulse per syllable inside each word and closed in gaps; it is independent of reduced motion because it drives a character, not the captions (the host may choose to damp it).

## Known gaps

No real alignment of recorded audio (word times are estimates unless supplied); `line` cue setting is honoured only as top/middle/bottom; WebVTT regions and `vertical` are parsed, not rendered; hyphenation and Thai dictionary breaking depend on the browser's `Intl.Segmenter`; the demo uses SVG stand-ins, not `<kamiji-avatar>`; no ARIA label translations.
