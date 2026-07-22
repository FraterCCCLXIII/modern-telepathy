import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { projects } from "@/lib/projects";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateScrollEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // No overflow → hide both. Otherwise hide the fade on the hard edge.
    if (maxScroll <= 1) {
      setShowLeftFade(false);
      setShowRightFade(false);
      return;
    }
    setShowLeftFade(el.scrollLeft > 1);
    setShowRightFade(el.scrollLeft < maxScroll - 1);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    el.addEventListener("scrollend", updateScrollEdges);
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      el.removeEventListener("scrollend", updateScrollEdges);
      ro.disconnect();
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <>
      <header className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-none max-w-[22ch]">
            Making intelligence a shared sense.
          </h1>
          <p className="mt-8 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            We research, release, and refine open-source AI—models, tools, and systems that keep
            innovation public, inspectable, and in the hands of builders.
          </p>
        </div>
      </header>

      <section className="py-20 bg-zinc-100">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12">
            <h2 className="text-2xl font-medium">Projects</h2>
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

          <div className="relative">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-zinc-100 to-transparent transition-opacity duration-200 ${
                showLeftFade ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-zinc-100 to-transparent transition-opacity duration-200 ${
                showRightFade ? "opacity-100" : "opacity-0"
              }`}
            />
            <div
              ref={scrollerRef}
              className="flex gap-6 overflow-x-auto no-scrollbar snap-x pb-4"
            >
              {projects.map(({ slug, name, description, logoSrc }) => (
                <div key={slug} className="flex-none w-80 snap-start">
                  <Link
                    to="/projects/$slug"
                    params={{ slug }}
                    className="group bg-canvas p-6 rounded-2xl ring-1 ring-black/5 hover:ring-black/10 transition-shadow h-full flex flex-col"
                  >
                    <div className="size-12 bg-zinc-100 rounded-xl mb-6 flex items-center justify-center outline-1 -outline-offset-1 outline-black/5 overflow-hidden p-2">
                      <img
                        src={logoSrc}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <h3 className="text-lg font-medium mb-2">{name}</h3>
                    <p className="text-sm text-zinc-500 mb-8 leading-relaxed text-pretty">
                      {description}
                    </p>
                    <span className="mt-auto inline-flex items-center text-sm font-medium py-2 pr-3 pl-2 group-hover:bg-zinc-50 rounded-lg transition-colors">
                      <span className="mr-2 text-zinc-400">→</span>
                      View
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
