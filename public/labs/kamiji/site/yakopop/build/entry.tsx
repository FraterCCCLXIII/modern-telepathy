// Yakopop component demos for the Kamiji site. This file is the only code written for the site; everything it
// renders is copied, unchanged, from the yakopop repository (see README.md next to the built files):
//   SubtitlePlayer, SubtitleStack, WordCard, LayersPanel, the engine hook   <- packages/overlay/src
//   Line / Token types, colours, timing, translationOf, parseSubtitles       <- packages/shared/src
//   said(), subsPanel(), talkPrefs(), the dialogue and the talk languages    <- apps/world/src/features/meeting
// Re-implemented here (labelled on the page): the clock that stands in for a video, the Talk bubble markup and the
// transcript demo page. No network, no model calls: the sample lines are the ones shipped in packages/shared/src/langs.ts.
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  colorsFor, DEMO_GRADIENT, LANGS, OUTPUT_LANGS, outputsFor, parseSubtitles, segmentsText, translationOf, type Line, type Piece,
} from "@yakopop/shared";
import {
  BUILTIN_PROFILES, emitter, OverlayProvider, profileStyle, SubtitlePlayer, SubtitleStack, useEnginePlayer, type PlayerEngine, type LayerKey, type Look, type Profile,
} from "./overlay";
import { DIALOGUE } from "./talk/meeting/dialogue";
import { langOf, TALK_LANGS } from "./talk/meeting/talkLangs";
import { blipsAt, lingerMs, said, subsPanel, talkPrefs, typeStepMs, type SaidView, type TalkPrefs } from "./talk/meeting/logic/talkView";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ENV = { frame: ".ykd-frame" };

/* ---------------------------------------------------------------- the clock that stands in for a video */

/** A PlayerEngine (packages/overlay/src/engine.ts) over a timer: the same interface a <video> or a YouTube player is wrapped in. */
function clockEngine(duration: number): PlayerEngine {
  const { emit, subscribe } = emitter();
  let t = 0, rate = 1, playing = false, last = 0;
  const sync = () => {
    const now = performance.now();
    if (playing) {
      t += ((now - last) / 1000) * rate;
      if (t >= duration) { t = duration; playing = false; emit({ type: "state", state: "ended" }); }
    }
    last = now;
  };
  return {
    time: () => { sync(); return t; },
    duration: () => duration,
    play: () => { sync(); if (t >= duration) t = 0; playing = true; emit({ type: "state", state: "playing" }); },
    pause: () => { sync(); playing = false; emit({ type: "state", state: "paused" }); },
    seek: s => { sync(); t = Math.min(Math.max(0, s), duration); emit({ type: "state", state: playing ? "playing" : "paused" }); },
    setRate: r => { sync(); rate = r; },
    subscribe,
  };
}

/** The shared sample sentences, given the times a transcript would give them (start and end in seconds). */
function timed(langId: string): { lines: Line[]; duration: number } {
  const src = LANGS[langId]!.lines;
  let at = 0.8;
  const lines = src.map(l => {
    const words = l.t.length;
    const len = Math.max(3.4, Math.min(5.2, 0.55 * words + 1.6));
    const out: Line = { ...l, start: Math.round(at * 10) / 10, end: Math.round((at + len) * 10) / 10 };
    at += len + 0.5;
    return out;
  });
  return { lines, duration: Math.ceil(at) };
}

function rememberLearnerProfile() {
  try {
    if (localStorage.getItem("yakopop.profile") === null) localStorage.setItem("yakopop.profile", JSON.stringify("learner"));
  } catch { /* storage blocked: the stock "classic" profile shows */ }
}

/* ---------------------------------------------------------------- 1. the full SubtitlePlayer */

function PlayerDemo({ langId }: { langId: string }) {
  const { lines, duration } = useMemo(() => timed(langId), [langId]);
  const engine = useMemo(() => clockEngine(duration), [duration]);
  const grad = DEMO_GRADIENT[langId] ?? ["#2a2f3a", "#4a3a5a"];
  return (
    <OverlayProvider env={ENV}>
      <div className="ykd ykd-frame ykd-video" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
        <SubtitlePlayer lines={lines} engine={engine} lang={langId} primary="en" title="Sample timeline" captureKeys={false} linger={Infinity}>
          <div className="ykd-scene" aria-hidden>
            <span>Sample timeline: a clock stands in for the video</span>
          </div>
        </SubtitlePlayer>
      </div>
    </OverlayProvider>
  );
}

/* ---------------------------------------------------------------- 2. SubtitleStack + WordCard + layer switches, outside the player */

const STACK_ROWS: { key: LayerKey; label: string }[] = [
  { key: "rd", label: "Reading" }, { key: "og", label: "Word" }, { key: "ro", label: "Romanisation" },
  { key: "gl", label: "Meaning" }, { key: "gr", label: "Grammar" }, { key: "en", label: "Translation" },
];

function StackDemo({ langId }: { langId: string }) {
  const { lines, duration } = useMemo(() => timed(langId), [langId]);
  const engine = useMemo(() => clockEngine(duration), [duration]);
  const { view, api } = useEnginePlayer(lines, engine);
  const outs = outputsFor(lines, "en");
  const [out, setOut] = useState("en");
  const [hidden, setHidden] = useState<LayerKey[]>(["gl", "gr"]);
  const [look, setLook] = useState<Look>({ box: true, boxOpacity: 55, shadow: false, colors: true, highlight: true, ball: false });
  useEffect(() => setOut("en"), [langId]);
  const base = BUILTIN_PROFILES.learner as Profile;
  const prof: Profile = { ...base, hidden, look };
  const ps = profileStyle(prof);
  const line = lines[view.idx] ?? lines[0]!;
  const shownOut = outs.includes(out) ? out : "en";
  const toggle = (k: LayerKey) => setHidden(h => (h.includes(k) ? h.filter(x => x !== k) : [...h, k]));
  const clock = useCallback(() => api.time(), [api]);
  return (
    <OverlayProvider env={ENV}>
      <div className="ykd-stackdemo">
        <div className="ykd ykd-frame ykd-free">
          <SubtitleStack
            line={line} out={shownOut} primary="en" mark={view.mark} lang={langId} className={ps.className}
            style={ps.style as CSSProperties} paused={!view.playing} clock={clock}
            onWord={i => api.wordClicked(i)}
          />
        </div>
        <div className="ykd-bar" role="group" aria-label="Playback">
          <button type="button" className="ykd-btn" onClick={() => api.toggle()} aria-pressed={view.playing}>{view.playing ? "Pause" : "Play"}</button>
          <button type="button" className="ykd-btn" onClick={() => api.step(-1)}>Previous line</button>
          <button type="button" className="ykd-btn" onClick={() => api.step(1)}>Next line</button>
          <span className="ykd-time">Line {view.idx + 1} of {lines.length}</span>
        </div>
        <fieldset className="ykd-set">
          <legend>Layers (profileStyle hides rows with <code>hide-*</code> classes)</legend>
          {STACK_ROWS.map(r => (
            <label key={r.key} className="ykd-chip">
              <input type="checkbox" checked={!hidden.includes(r.key)} onChange={() => toggle(r.key)} /> <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="ykd-set">
          <legend>Look</legend>
          <label className="ykd-chip"><input type="checkbox" checked={look.colors} onChange={e => setLook({ ...look, colors: e.target.checked })} /> <span>Colour by word</span></label>
          <label className="ykd-chip"><input type="checkbox" checked={look.ball} onChange={e => setLook({ ...look, ball: e.target.checked })} /> <span>Bouncing ball</span></label>
          <label className="ykd-chip"><input type="checkbox" checked={look.box} onChange={e => setLook({ ...look, box: e.target.checked })} /> <span>Dark box</span></label>
        </fieldset>
        {outs.length > 1 && (
          <fieldset className="ykd-set">
            <legend>Translation language (<code>line.tr</code>)</legend>
            {outs.map(o => (
              <label key={o} className="ykd-chip">
                <input type="radio" name={`ykd-out-${langId}`} checked={o === shownOut} onChange={() => setOut(o)} /> <span>{OUTPUT_LANGS[o]?.name ?? o}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </OverlayProvider>
  );
}

/* ---------------------------------------------------------------- 3. Talk bubbles: the logic is apps/world's, the markup is ours */

function sayWord(text: string, bcp: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp;
    synth.speak(u);
  } catch { /* no system voice */ }
}

function Said({ v, kind }: { v: SaidView; kind: "say" | "think" | "shout" }) {
  if (v.plain) return <span className="ykd-tk-text">{v.plain.typed}<span className="ykd-tk-ghost">{v.plain.ghost}</span></span>;
  return (
    <span className="ykd-tk-words" data-kind={kind}>
      {v.words.map((w, i) => (
        <button type="button" key={i} className={`ykd-tk-word${w.full ? " full" : ""}`} title={w.title} onClick={() => sayWord(w.hear, v.bcp)} aria-label={`Hear ${w.hear}`}>
          {w.rd !== null && <span className="rd">{w.full ? w.rd : " "}</span>}
          <span className="og">{w.typed}<span className="ykd-tk-ghost">{w.ghost}</span></span>
          {w.ro !== null && <span className="ro">{w.full ? w.ro : " "}</span>}
        </button>
      ))}
      {v.en !== null && <span className={`en${v.enGhosted ? " ghost" : ""}`}>{v.en}</span>}
    </span>
  );
}

interface Shown { key: number; who: "them" | "me"; kind: "say" | "think" | "shout"; text: string }

function TalkDemo() {
  const [prefs, setPrefs] = useState<TalkPrefs>(() => talkPrefs(null, null));
  const lang = langOf(prefs.lang);
  const panel = subsPanel(prefs);
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState("start");
  const [bubbles, setBubbles] = useState<Shown[]>([]);
  const [typed, setTyped] = useState(0);
  const [queue, setQueue] = useState<Shown[]>([]);
  const [done, setDone] = useState(false);
  const key = useRef(0);
  const timer = useRef(0);
  const cur = bubbles.at(-1);
  const curText = cur ? (lang.id === "en" ? cur.text : said(cur.text, Infinity, lang, prefs).words.map(w => w.og).join(lang.sep)) : "";
  const typing = !!cur && typed < curText.length;

  const enter = useCallback((id: string) => {
    const n = DIALOGUE[id];
    if (!n) { setDone(true); return; }
    setNode(id);
    setQueue(n.lines.map(l => ({ key: ++key.current, who: l.who === "you" ? "me" : "them", kind: l.kind ?? "say", text: l.text })));
  }, []);
  useEffect(() => { enter("start"); }, [enter]);

  // the next queued line appears once the current one has typed out and been read (talkView.lingerMs)
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (queue.length === 0 || typing) return;
    const wait = cur ? Math.min(2600, lingerMs(curText.length, lang.id !== "en")) : 200;
    timer.current = window.setTimeout(() => {
      const [next, ...rest] = queue;
      if (!next) return;
      setBubbles(b => [...b.slice(-2), next]);
      setQueue(rest);
      setTyped(reduced() ? Infinity : 0);
    }, reduced() ? 300 : wait);
    return () => window.clearTimeout(timer.current);
  }, [queue, typing, cur, curText.length, lang.id]);

  // typewriter, one letter at a time (talkView.typeStepMs)
  useEffect(() => {
    if (!cur || !typing) return;
    const ch = curText[typed] ?? "";
    const id = window.setTimeout(() => setTyped(n => n + 1), typeStepMs(cur.kind, ch));
    return () => window.clearTimeout(id);
  }, [cur, typing, typed, curText]);

  const choices = !typing && queue.length === 0 ? DIALOGUE[node]?.choices : undefined;
  const pick = (c: { text: string; next: string; think?: boolean; shout?: boolean }) => {
    setBubbles(b => [...b.slice(-2), { key: ++key.current, who: "me", kind: c.think ? "think" : c.shout ? "shout" : "say", text: c.text }]);
    setTyped(reduced() ? Infinity : 0);
    if (c.next.startsWith("@")) { setDone(true); setQueue([]); } else enter(c.next);
  };
  const restart = () => { setBubbles([]); setDone(false); setTyped(0); setQueue([]); enter("start"); };
  const noChoices = !!(!typing && queue.length === 0 && !DIALOGUE[node]?.choices);
  useEffect(() => {
    // a node with neither choices nor a next ends the talk; with a next it continues
    if (noChoices && !done) {
      const next = DIALOGUE[node]?.next;
      const id = window.setTimeout(() => (next && !next.startsWith("@") ? enter(next) : setDone(true)), 700);
      return () => window.clearTimeout(id);
    }
  }, [noChoices, done, node, enter]);
  const setLang = (id: string) => { setPrefs(p => ({ ...p, lang: id })); setTyped(Infinity); };
  const toggle = (k: "reading" | "romanization" | "english" | "readAloud") => setPrefs(p => ({ ...p, [k]: !p[k] }));
  const spoke = useRef(-1);
  useEffect(() => {
    if (prefs.readAloud && cur && cur.key !== spoke.current && lang.id !== "en") { spoke.current = cur.key; sayWord(curText, lang.bcp); }
  }, [prefs.readAloud, cur, curText, lang]);

  return (
    <OverlayProvider env={ENV}>
      <div className="ykd-talk">
        <div className="ykd-talk-top">
          <span className="ykd-talk-who" aria-hidden>Kitsune</span>
          <button type="button" className="ykd-btn" aria-expanded={open} onClick={() => setOpen(o => !o)} title="Language and layers">文A</button>
        </div>
        {open && (
          <div className="ykd-card" role="group" aria-label="Language and layers">
            <p className="ykd-card-h">Language</p>
            <div className="ykd-langs">
              {panel.langs.map(l => (
                <button type="button" key={l.id} className={`ykd-pill${l.on ? " on" : ""}`} aria-pressed={l.on} onClick={() => setLang(l.id)} title={l.name}>{l.native}</button>
              ))}
            </div>
            {panel.layers.length > 0 && <p className="ykd-card-h">Layers</p>}
            {panel.layers.map(l => (
              <label key={l.key} className="ykd-chip"><input type="checkbox" checked={l.on} onChange={() => toggle(l.key)} /> <span>{l.label}</span></label>
            ))}
            {panel.note && <p className="ykd-note">{panel.note}</p>}
          </div>
        )}
        <div className="ykd-bubbles" aria-live="polite">
          {bubbles.map((b, i) => {
            const last = i === bubbles.length - 1;
            const v = said(b.text, last ? typed : Infinity, lang, prefs);
            return (
              <div key={b.key} className={`ykd-bub ${b.who} ${b.kind}${last ? "" : " old"}`}>
                <Said v={v} kind={b.kind} />
                {last && typing && blipsAt(b.kind, curText, typed) ? <span className="ykd-blip" aria-hidden /> : null}
              </div>
            );
          })}
        </div>
        <div className="ykd-choices">
          {choices?.map(c => (
            <button type="button" key={c.text} className={`ykd-choice${c.think ? " think" : ""}${c.shout ? " shout" : ""}`} onClick={() => pick(c)}>
              <Said v={said(c.text, Infinity, lang, prefs, true)} kind={c.think ? "think" : c.shout ? "shout" : "say"} />
            </button>
          ))}
          {done && !typing && <button type="button" className="ykd-btn" onClick={restart}>Talk again</button>}
        </div>
      </div>
    </OverlayProvider>
  );
}

/* ---------------------------------------------------------------- 4. transcript -> translation -> SRT / VTT */

const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
const lineText = (l: Line, sep: string) => l.t.map(t => t[0]).join(sep);

const clockSrt = (s: number, comma: boolean) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${comma ? "," : "."}${p(ms % 1000, 3)}`;
};
export function toSrt(cues: { start: number; end: number; text: string }[]): string {
  return cues.map((c, i) => `${i + 1}\n${clockSrt(c.start, true)} --> ${clockSrt(c.end, true)}\n${c.text}\n`).join("\n");
}
export function toVtt(cues: { start: number; end: number; text: string }[]): string {
  return "WEBVTT\n\n" + cues.map(c => `${clockSrt(c.start, false)} --> ${clockSrt(c.end, false)}\n${c.text}\n`).join("\n");
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const SAMPLES = ["ja", "ko", "zh", "es"] as const;
const sampleCues = (id: string): Piece[] => timed(id).lines.map(l => ({ start: l.start!, end: l.end!, text: lineText(l, LANGS[id]!.sep) }));

function parseInput(text: string): Piece[] | string {
  const s = text.trim();
  if (!s) return "Nothing to read yet.";
  if (s.startsWith("[")) {
    try {
      const a = JSON.parse(s) as unknown;
      if (!Array.isArray(a)) return "Expected a JSON array of cues.";
      const out = a.map(c => c as Piece).filter(c => c && typeof c.text === "string" && Number.isFinite(c.start) && Number.isFinite(c.end));
      return out.length ? out : "No cue had start, end and text.";
    } catch (e) { return `Not valid JSON: ${(e as Error).message}`; }
  }
  const p = parseSubtitles(s);
  return p.length ? p : "No cues found. Paste WebVTT, SRT or a JSON array of {start, end, text}.";
}

function TranscriptDemo() {
  const [sample, setSample] = useState<(typeof SAMPLES)[number]>("ja");
  const [text, setText] = useState(() => JSON.stringify(sampleCues("ja"), null, 1));
  const [out, setOut] = useState("en");
  const [sel, setSel] = useState(0);
  const [both, setBoth] = useState(false);
  const pick = (id: (typeof SAMPLES)[number]) => { setSample(id); setText(JSON.stringify(sampleCues(id), null, 1)); setSel(0); setOut("en"); };
  const cues = useMemo(() => parseInput(text), [text]);
  const meta = LANGS[sample]!;
  const lang = useMemo(() => (Array.isArray(cues) ? detect(cues) : sample), [cues, sample]);
  const L = LANGS[lang] ?? meta;
  const rows = useMemo(() => {
    if (!Array.isArray(cues)) return [];
    return cues.map(c => {
      const hit = L.lines.find(l => norm(lineText(l, L.sep)) === norm(c.text));
      return { cue: c, line: hit };
    });
  }, [cues, L]);
  const outs = outputsFor(L.lines, "en");
  const shownOut = outs.includes(out) ? out : "en";
  const cueOut = rows.map(r => ({ start: r.cue.start, end: r.cue.end, text: r.line ? segmentsText(translationOf(r.line, shownOut, "en").segs) : "" })).filter(c => c.text);
  const bilingual = rows.map(r => ({ start: r.cue.start, end: r.cue.end, text: r.line ? `${r.cue.text}\n${segmentsText(translationOf(r.line, shownOut, "en").segs)}` : "" })).filter(c => c.text);
  const missing = rows.filter(r => !r.line).length;
  const chosen = rows[Math.min(sel, rows.length - 1)];
  const name = `${lang}-to-${shownOut}`;
  const files = both ? bilingual : cueOut;
  return (
    <OverlayProvider env={ENV}>
      <div className="ykd-tr">
        <div className="ykd-tr-col">
          <div className="ykd-tr-h"><b>1. Transcript</b><span>cues: <code>{"{start, end, text}"}</code></span></div>
          <div className="ykd-bar" role="group" aria-label="Sample transcripts">
            {SAMPLES.map(id => (
              <button type="button" key={id} className={`ykd-pill${sample === id ? " on" : ""}`} aria-pressed={sample === id} onClick={() => pick(id)}>{LANGS[id]!.name}</button>
            ))}
          </div>
          <label className="ykd-vh" htmlFor="ykd-tr-in">Transcript (JSON cues, WebVTT or SRT)</label>
          <textarea id="ykd-tr-in" className="ykd-ta" spellCheck={false} value={text} onChange={e => setText(e.target.value)} rows={9} />
          {typeof cues === "string" && <p className="ykd-err" role="alert">{cues}</p>}
          {Array.isArray(cues) && <p className="ykd-note">{cues.length} cues read{` (language guessed from the text: ${LANGS[lang]?.name ?? "unknown"})`}. {missing > 0 ? `${missing} not in the sample data: the real pipeline would send these to the annotator.` : ""}</p>}
        </div>
        <div className="ykd-tr-col">
          <div className="ykd-tr-h"><b>2. Annotate and translate</b><span>Sample data</span></div>
          <div className="ykd-bar" role="group" aria-label="Translation language">
            {outs.map(o => (
              <button type="button" key={o} className={`ykd-pill${shownOut === o ? " on" : ""}`} aria-pressed={shownOut === o} onClick={() => setOut(o)}>{OUTPUT_LANGS[o]?.native ?? o}</button>
            ))}
          </div>
          <ol className="ykd-cues">
            {rows.map((r, i) => (
              <li key={i}>
                <button type="button" className={`ykd-cue${i === sel ? " on" : ""}`} aria-pressed={i === sel} onClick={() => setSel(i)}>
                  <small>{clockSrt(r.cue.start, false).slice(3, 11)}</small>
                  <span className="o">{r.cue.text}</span>
                  <span className="t">{r.line ? segmentsText(translationOf(r.line, shownOut, "en").segs) : "no sample annotation for this cue"}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="ykd ykd-frame ykd-free ykd-mini">
            {chosen?.line ? (
              <SubtitleStack line={chosen.line} out={shownOut} primary="en" mark={{ active: null, spokenBefore: 0 }} lang={lang} className="hide-gl hide-gr" style={{ ...(profileStyle(BUILTIN_PROFILES.learner as Profile).style) } as CSSProperties} />
            ) : <p className="ykd-note">Pick a cue that has sample data to see its subtitle stack.</p>}
          </div>
        </div>
        <div className="ykd-tr-col wide">
          <div className="ykd-tr-h"><b>3. Subtitle file</b><span>made in your browser</span></div>
          <label className="ykd-chip"><input type="checkbox" checked={both} onChange={e => setBoth(e.target.checked)} /> <span>Source and translation on two lines</span></label>
          <div className="ykd-bar">
            <button type="button" className="ykd-btn" disabled={!files.length} data-dl="srt" onClick={() => download(`${name}.srt`, toSrt(files), "application/x-subrip")}>Download .srt</button>
            <button type="button" className="ykd-btn" disabled={!files.length} data-dl="vtt" onClick={() => download(`${name}.vtt`, toVtt(files), "text/vtt")}>Download .vtt</button>
          </div>
          <pre className="ykd-pre" aria-label="Preview of the WebVTT file"><code>{toVtt(files).slice(0, 700)}</code></pre>
        </div>
      </div>
    </OverlayProvider>
  );
}

/** Which sample language a set of cues is: the one whose lines match most of them. */
function detect(cues: Piece[]): string {
  let best = "ja", score = -1;
  for (const [id, m] of Object.entries(LANGS)) {
    const set = new Set(m.lines.map(l => norm(lineText(l, m.sep))));
    const n = cues.filter(c => set.has(norm(c.text))).length;
    if (n > score) { best = id; score = n; }
  }
  return best;
}

/* ---------------------------------------------------------------- mount */

type Demo = "player" | "stack" | "talk" | "transcript";
const roots = new WeakMap<Element, ReturnType<typeof createRoot>>();

export function mount(kind: Demo, el: HTMLElement, opts: { lang?: string } = {}) {
  rememberLearnerProfile();
  roots.get(el)?.unmount();
  const root = createRoot(el);
  roots.set(el, root);
  const lang = opts.lang && LANGS[opts.lang] ? opts.lang : "ja";
  if (kind === "player") root.render(<PlayerDemo langId={lang} />);
  else if (kind === "stack") root.render(<StackDemo langId={lang} />);
  else if (kind === "talk") root.render(<TalkDemo />);
  else root.render(<TranscriptDemo />);
}

/** Languages that have sample sentences and the translations each offers (used by the page's own switches). */
export const sampleLanguages = () => Object.entries(LANGS).filter(([id]) => ["ja", "ko", "zh", "es"].includes(id)).map(([id, m]) => ({ id, name: m.name, native: m.native }));
export const talkLanguages = () => TALK_LANGS.map(l => ({ id: l.id, name: l.name, native: l.native }));
export const sampleLine = (lang: string, i = 0) => LANGS[lang]?.lines[i];
export const colours = (lang: string, i = 0) => colorsFor(LANGS[lang]!.lines[i]!);
