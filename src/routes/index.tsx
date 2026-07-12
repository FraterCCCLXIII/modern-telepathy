import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { projects } from "@/lib/projects";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <>
      <header className="py-24 px-6 bg-canvas">
        <div className="max-w-screen-xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-none max-w-[20ch]">
            Building infrastructure for the{" "}
            <span className="font-serif italic">distributed</span> economy.
          </h1>
          <p className="mt-8 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            Founder-operator focused on protocol design, high-throughput systems, and vertical
            SaaS tools that empower independent creators.
          </p>
        </div>
      </header>

      <section className="py-20 bg-zinc-100/50">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-3">
                Active Portfolio
              </h2>
              <p className="text-2xl font-medium">Select Ventures</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollBy(-1)}
                className="size-10 rounded-full border border-zinc-950/5 bg-canvas flex items-center justify-center hover:bg-zinc-50 transition-colors"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollBy(1)}
                className="size-10 rounded-full border border-zinc-950/5 bg-canvas flex items-center justify-center hover:bg-zinc-50 transition-colors"
              >
                →
              </button>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="flex gap-6 overflow-x-auto no-scrollbar snap-x pb-4"
          >
            {projects.map(({ slug, name, description, Logo }) => (
              <div key={slug} className="flex-none w-80 snap-start">
                <Link
                  to="/projects/$slug"
                  params={{ slug }}
                  className="group bg-canvas p-6 rounded-2xl ring-1 ring-black/5 hover:ring-black/10 transition-shadow h-full flex flex-col"
                >
                  <div className="size-12 bg-zinc-100 rounded-xl mb-6 flex items-center justify-center outline-1 -outline-offset-1 outline-black/5 text-zinc-800">
                    <Logo className="size-6" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">{name}</h3>
                  <p className="text-sm text-zinc-500 mb-8 leading-relaxed text-pretty">
                    {description}
                  </p>
                  <span className="mt-auto inline-flex items-center text-sm font-medium py-2 pr-3 pl-2 group-hover:bg-zinc-50 rounded-lg transition-colors">
                    <span className="mr-2 text-zinc-400">→</span>
                    View breakdown
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
