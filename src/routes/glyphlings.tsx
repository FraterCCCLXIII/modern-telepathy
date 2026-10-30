import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { glyphlings, type Glyphling } from "@/lib/glyphlings";

export const Route = createFileRoute("/glyphlings")({
  head: () => ({
    meta: [
      { title: "Glyphlings — Modern Telepathy" },
      { name: "description", content: "Nine Greek letters from Courier New Regular, in capitals and lowercase, each given eyes in its empty spaces." },
    ],
  }),
  component: Glyphlings,
});

const mono = "font-mono text-[.7rem] uppercase tracking-[.16em]";

type EyeSet = "dots" | "wide" | "pills";
type Settings = { eyes: EyeSet; size: number; distance: number; highlight: boolean };
const DEFAULTS: Settings = { eyes: "pills", size: 100, distance: 100, highlight: true };

const BLINK = `.gl-eye{transform-box:fill-box;transform-origin:center;animation:gl-blink 5.5s infinite}
.gl-eye:nth-of-type(2){animation-delay:.07s}@keyframes gl-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@media (prefers-reduced-motion:reduce){.gl-eye{animation:none}}`;

/** Eyes for one character with the live settings. Positions are in font units (y up); the group is flipped by the caller. */
function eyeShapes(g: Glyphling, s: Settings) {
  const eyes = s.eyes === "pills" && g.pillEyes ? g.pillEyes : g.eyes;
  const cx = eyes.reduce((a, e) => a + e[0], 0) / eyes.length;
  const cy = eyes.reduce((a, e) => a + e[1], 0) / eyes.length;
  const k = s.size / 100;
  const dk = s.distance / 100;
  return eyes.map(([x0, y0, r0], i) => {
    const x = cx + (x0 - cx) * dk;
    const y = cy + (y0 - cy) * dk;
    const r = r0 * k;
    if (s.eyes === "pills") {
      const w = r * 1.2;
      const h = r * 2.7;
      return (
        <g className="gl-eye" key={i}>
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill="#111" />
        </g>
      );
    }
    if (s.eyes === "wide") {
      const pr = r * 0.58;
      const px = x + r * 0.2;
      const py = y + r * 0.12;
      return (
        <g className="gl-eye" key={i}>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke="#111" strokeWidth={r * 0.16} />
          <circle cx={px} cy={py} r={pr} fill="#111" />
          {s.highlight && <circle cx={px + pr * 0.34} cy={py + pr * 0.36} r={pr * 0.28} fill="#fff" />}
        </g>
      );
    }
    return (
      <g className="gl-eye" key={i}>
        <circle cx={x} cy={y} r={r} fill="#111" />
        {s.highlight && <circle cx={x + r * 0.32} cy={y + r * 0.34} r={r * 0.3} fill="#fff" />}
      </g>
    );
  });
}

function Character({ g, s, plain, svgRef }: { g: Glyphling; s: Settings; plain: boolean; svgRef?: (el: SVGSVGElement | null) => void }) {
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={g.vb} role="img" aria-label={g.name} className="max-h-full max-w-full" style={{ width: "100%", height: "100%" }}>
      <style>{BLINK}</style>
      <g transform="scale(1,-1)">
        <path d={g.d} fill="#111" />
        {!plain && eyeShapes(g, s)}
      </g>
    </svg>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className={`${mono} text-zinc-500 w-20`}>{label}</span>
      <input type="range" min={min} max={max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-36 accent-[#1d1d1b]" />
      <span className="font-mono text-xs text-zinc-500 w-10 text-right">{value}%</span>
    </label>
  );
}

function Pills<T extends string | boolean>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-secondary p-1">
      {options.map(([v, text]) => (
        <button key={text} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`${mono} rounded-full px-4 py-2 ${value === v ? "bg-primary text-primary-foreground" : "text-zinc-500"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

const rules = [
  ["The letter is the body", "Every character is a Greek letter, capital or lowercase, from Courier New Regular. The outline is never redrawn, stretched or smoothed."],
  ["Eyes live in the empty spaces", "Eyes go in a letter's counters or open pockets: the bowl of the Omega, the triangle of the Delta, each half of the Phi. They should not touch the stroke."],
  ["Three eye sets", "Dots: a round black eye with one white highlight. Wide: a white eye with a dark rim and a big pupil. Pills: a tall black bar with rounded ends, as in the Temple logo. All blink every few seconds, and you can change their size, distance and highlight."],
  ["Soft colour behind", "Each character sits on its own pastel tile. The letter and the eyes stay black."],
] as const;

function Glyphlings() {
  const [lower, setLower] = useState(false);
  const [plain, setPlain] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const refs = useRef<Record<string, SVGSVGElement | null>>({});
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((o) => ({ ...o, [k]: v }));

  function download(g: Glyphling) {
    const el = refs.current[g.slug];
    if (!el) return;
    const text = new XMLSerializer().serializeToString(el);
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${g.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const changed = JSON.stringify(s) !== JSON.stringify(DEFAULTS);

  return (
    <>
      <header className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-6`}>Characters</p>
          <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-balance leading-[1.0]">Glyphlings</h1>
          <p className="mt-8 text-xl text-zinc-500 max-w-[48ch] text-pretty leading-relaxed">
            Nine Greek letters, in capitals and lowercase, set in Courier New Regular, each given eyes in its empty spaces.
          </p>
        </div>
      </header>

      <section className="pb-20 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <style>{BLINK}</style>
          <div className="flex flex-wrap items-center gap-4">
            <Pills label="Case" value={lower} onChange={setLower} options={[[false, "Capitals"], [true, "Lowercase"]] as const} />
            <Pills label="Eye set" value={s.eyes} onChange={(v) => { set("eyes", v); setPlain(false); }} options={[["dots", "Dots"], ["wide", "Wide"], ["pills", "Pills"]] as const} />
            <button type="button" aria-pressed={plain} onClick={() => setPlain((v) => !v)} className={`${mono} rounded-full px-4 py-2 ${plain ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              {plain ? "Show the characters" : "Show the plain letters"}
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-black/5">
            <Slider label="Size" value={s.size} min={40} max={160} onChange={(v) => set("size", v)} />
            <Slider label="Distance" value={s.distance} min={30} max={200} onChange={(v) => set("distance", v)} />
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={s.highlight} onChange={(e) => set("highlight", e.target.checked)} className="size-4 accent-[#1d1d1b]" />
              <span className={`${mono} text-zinc-500`}>White dot</span>
            </label>
            <button type="button" disabled={!changed} onClick={() => setS(DEFAULTS)} className={`${mono} ml-auto text-zinc-500 hover:text-ink disabled:opacity-40`}>
              Reset
            </button>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Size and distance apply to the eyes. The white dot applies to Dots and Wide. Download saves the character as you see it.</p>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {glyphlings.filter((g) => g.lower === lower).map((g) => (
              <figure key={g.slug} className="rounded-3xl overflow-hidden ring-1 ring-black/5 bg-card">
                <div style={{ background: g.colour }} className="aspect-square flex items-center justify-center p-10">
                  <Character g={g} s={s} plain={plain} svgRef={(el) => { refs.current[g.slug] = el; }} />
                </div>
                <figcaption className="px-5 py-4 flex items-center justify-between">
                  <span className="font-medium">{g.name} <span className="text-zinc-400 font-normal ml-1">{g.letter}</span></span>
                  <button type="button" onClick={() => download(g)} className={`${mono} !text-[.6rem] text-zinc-500 hover:text-ink`}>SVG</button>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-zinc-100">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-balance leading-[1.05] max-w-[18ch]">How a Glyphling is made</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {rules.map(([t, b], i) => (
              <div key={t} className="rounded-2xl bg-card p-7 ring-1 ring-black/5">
                <p className={`${mono} text-zinc-400 mb-3`}>{String(i + 1).padStart(2, "0")}</p>
                <h3 className="text-lg font-medium mb-2">{t}</h3>
                <p className="text-zinc-500 leading-relaxed text-pretty">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-2xl font-medium mb-8">Colours</h2>
          <div className="flex flex-wrap gap-3">
            {glyphlings.filter((g) => !g.lower).map((g) => (
              <div key={g.slug} className="flex items-center gap-3 rounded-full bg-card pr-5 ring-1 ring-black/5">
                <span style={{ background: g.colour }} className="size-10 rounded-full ring-1 ring-black/10" />
                <span className="text-sm"><b className="font-medium">{g.name}</b> <span className="font-mono text-[.7rem] text-zinc-400">{g.colour}</span></span>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-zinc-400 max-w-[60ch]">
            The characters are vector: the letter, the eyes and the blink. They are set from Courier New Regular, a typeface licensed from Monotype, so check its terms before using them commercially.
          </p>
        </div>
      </section>
    </>
  );
}
