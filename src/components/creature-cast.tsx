import { useEffect, useRef } from "react";
import { fluxOrb } from "@/lib/creatures/flux-engine";
import { mittSvg, pixlingSvg, spookletSvg, wispSvg } from "@/lib/creatures/svg";

/** One character in an app's cast. `kind` picks the drawing; `fill` tints it. */
export type CastMember = { kind: "wisp" | "mitt" | "spooklet" | "wanderer" | "tinker" | "flux" | "cubit"; name: string; fill?: string; variant?: string };

function Flux({ variant, mode }: { variant: string; mode: "smooth" | "voxel" }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = fluxOrb({ variant, mode, seed: `${variant}${mode}`, size: 96 });
    canvas.style.width = "96px";
    canvas.style.height = "96px";
    el.replaceChildren(canvas);
    return () => el.replaceChildren();
  }, [variant, mode]);
  return <div ref={host} className="size-24" aria-hidden />;
}

function Drawing({ m }: { m: CastMember }) {
  const fill = m.fill ?? "#8B5CF6";
  if (m.kind === "flux" || m.kind === "cubit") return <Flux variant={m.variant ?? "aurora"} mode={m.kind === "cubit" ? "voxel" : "smooth"} />;
  const html = m.kind === "wisp" ? wispSvg(fill) : m.kind === "mitt" ? mittSvg(fill) : m.kind === "spooklet" ? spookletSvg(fill) : pixlingSvg(m.kind, fill);
  return <div className="size-24" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The Kamiji characters an app uses, as a tiled list. */
export function CreatureCast({ cast }: { cast: CastMember[] }) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0">
      {cast.map((m) => (
        <li key={`${m.kind}-${m.name}`} className="rounded-2xl bg-card ring-1 ring-black/5 p-4 flex flex-col items-center gap-2 text-center">
          <Drawing m={m} />
          <span className="text-sm font-medium">{m.name}</span>
        </li>
      ))}
    </ul>
  );
}
