import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CREATURE_FAMILIES, FLUX_COLOURINGS, FLUX_SHAPES, RELATED_FAMILIES, WISP_COLOURS } from "@/lib/creatures/catalog";
import { mittSvg, pixlingSvg, spookletSvg, wispSvg } from "@/lib/creatures/svg";
import { fluxOrb } from "@/lib/creatures/flux-engine";

export const Route = createFileRoute("/creatures")({
  head: () => ({
    meta: [
      { title: "Creatures — Modern Telepathy" },
      { name: "description", content: "The library of characters made for Agent Canvas: Wisps, Fluxes, Motes, Cubits, Pixlings and Handlings." },
    ],
  }),
  component: Creatures,
});

const mono = "font-mono text-[.7rem] uppercase tracking-[.16em]";

/** A live Flux: the engine draws into a canvas that it animates and removes itself when the page leaves. */
function Flux({ variant, shape = "blob", mode = "smooth", size = 120 }: { variant: string; shape?: string; mode?: "smooth" | "voxel"; size?: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = fluxOrb({ variant, shape, mode, seed: `${variant}${shape}${mode}`, size });
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    el.replaceChildren(canvas);
    return () => el.replaceChildren();
  }, [variant, shape, mode, size]);
  return <div ref={host} style={{ width: size, height: size }} aria-hidden />;
}

function Svg({ html }: { html: string }) {
  return <div className="size-24" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Tile({ children, label, note }: { children: React.ReactNode; label: string; note?: string }) {
  return (
    <figure className="rounded-2xl bg-card ring-1 ring-black/5 p-4 flex flex-col items-center text-center gap-2">
      <div className="h-28 flex items-center justify-center">{children}</div>
      <figcaption>
        <span className="font-medium">{label}</span>
        {note ? <span className="block text-xs text-zinc-500 mt-0.5">{note}</span> : null}
      </figcaption>
    </figure>
  );
}

const PIXLING_COLOURS = ["#f59e0b", "#f97316", "#ec4899", "#8b5cf6", "#3b82f6", "#22d3ee", "#34d399", "#a3e635"];

function Specimens({ id }: { id: string }) {
  const family = CREATURE_FAMILIES.find((f) => f.id === id)!;
  switch (id) {
    case "wisps":
      return <>{WISP_COLOURS.map((c, i) => <Tile key={c.id} label={`${c.name} Wisp`}><Svg html={wispSvg(c.fill, i)} /></Tile>)}</>;
    case "fluxes":
      return <>{FLUX_COLOURINGS.map((k) => <Tile key={k.id} label={`${k.name} Flux`} note={k.note}><Flux variant={k.id} /></Tile>)}</>;
    case "flux-shapes":
      return <>{FLUX_SHAPES.map((k) => <Tile key={k.id} label={k.name}><Flux variant="aurora" shape={k.id} /></Tile>)}</>;
    case "cubits":
      return <>{["aurora", "gradient", "neon", "rainbow"].map((v) => <Tile key={v} label={`${v[0].toUpperCase()}${v.slice(1)} Cubit`}><Flux variant={v} mode="voxel" /></Tile>)}</>;
    case "mitts":
      return <>{WISP_COLOURS.slice(0, 5).map((c) => <Tile key={c.id} label={`${c.name} Mitt`}><Svg html={mittSvg(c.fill)} /></Tile>)}</>;
    case "spooklets":
      return <>{WISP_COLOURS.slice(0, 5).map((c) => <Tile key={c.id} label={`${c.name} Spooklet`}><Svg html={spookletSvg(c.fill)} /></Tile>)}</>;
    case "pixlings":
      return (
        <>
          {PIXLING_COLOURS.map((c, i) => (
            <Tile key={c} label={i % 2 ? "Tinker" : "Wanderer"}><Svg html={pixlingSvg(i % 2 ? "tinker" : "wanderer", c)} /></Tile>
          ))}
        </>
      );
    default:
      return <>{family.kinds.map((k) => <Tile key={k.id} label={k.name} note={k.note} ><span className="text-zinc-400 text-sm">See the Team chat welcome screen</span></Tile>)}</>;
  }
}

function Creatures() {
  return (
    <>
      <header className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-6`}>Characters</p>
          <h1 className="text-5xl md:text-7xl font-medium tracking-tight text-balance leading-[1.0]">Creatures</h1>
          <p className="mt-8 text-xl text-zinc-500 max-w-[52ch] text-pretty leading-relaxed">
            Every character made for Agent Canvas, by family: the colourful Wisps, the living Fluxes and the Motes they shed, Cubits, pixel crews and hands. The drawing code ships in the Kamiji package as <span className="font-mono text-base">src/creatures</span>.
          </p>
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Families">
            {CREATURE_FAMILIES.filter((f) => !f.hidden).map((f) => (
              <a key={f.id} href={`#${f.id}`} className={`${mono} rounded-full bg-secondary px-4 py-2 hover:bg-primary hover:text-primary-foreground`}>{f.name}</a>
            ))}
          </nav>
        </div>
      </header>

      {CREATURE_FAMILIES.filter((f) => !f.hidden).map((f, i) => (
        <section key={f.id} id={f.id} className={`py-16 ${i % 2 ? "bg-zinc-100" : "bg-canvas"}`}>
          <div className="max-w-screen-xl mx-auto px-6">
            <p className={`${mono} text-zinc-500 mb-3`}>{f.tagline}</p>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight">{f.name}</h2>
            <p className="mt-4 text-zinc-500 max-w-[62ch] text-pretty leading-relaxed">{f.description}</p>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <Specimens id={f.id} />
            </div>
            <dl className="mt-6 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className={`${mono} text-zinc-400`}>Seen in</dt><dd>{f.appearsIn.join(" · ")}</dd>
              <dt className={`${mono} text-zinc-400`}>Source</dt><dd className="font-mono text-xs text-zinc-500">{f.source}</dd>
              <dt className={`${mono} text-zinc-400`}>In Kamiji</dt><dd>{f.exported ? "Exported from src/creatures" : "Catalogued only"}</dd>
            </dl>
          </div>
        </section>
      ))}

      <section className="py-16 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-2xl font-medium mb-6">Related families</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {RELATED_FAMILIES.map((r) => (
              <li key={r.name} className="rounded-2xl bg-card p-6 ring-1 ring-black/5">
                <h3 className="font-medium">{r.name}</h3>
                <p className="text-sm text-zinc-500 mt-1">{r.note}</p>
                <p className="font-mono text-xs text-zinc-400 mt-3">{r.where}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
