import { createFileRoute } from "@tanstack/react-router";
import { groups } from "@/lib/groups";
import { labs } from "@/lib/labs";

export const Route = createFileRoute("/labs")({
  head: () => ({
    meta: [
      { title: "Labs — Modern Telepathy" },
      {
        name: "description",
        content: "Live demos, tools and docs from Modern Telepathy products: Kamiji, Kosmos, TempleOS and more.",
      },
    ],
  }),
  component: LabsPage,
});

function LabsPage() {
  return (
    <>
      <header className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-none">Labs</h1>
          <p className="mt-8 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            Working demos, tools and docs from our products. Each opens as its own page; most run in the browser with no sign-in.
          </p>
        </div>
      </header>
      {groups
        .filter((g) => labs.some((l) => l.group === g.id))
        .map((group, i) => (
        <section key={group.id} id={group.id} className={`py-16 ${i % 2 === 0 ? "bg-zinc-100" : "bg-canvas"}`}>
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-2xl font-medium">{group.label}</h2>
            <p className="text-sm text-zinc-500 mt-2 mb-10">{group.blurb}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {labs
                .filter((l) => l.group === group.id)
                .map((lab) => (
                  <a
                    key={lab.id}
                    href={lab.href}
                    className="group bg-canvas p-6 rounded-2xl ring-1 ring-black/5 hover:ring-black/10 transition-shadow flex flex-col"
                  >
                    <h3 className="text-lg font-medium mb-2">{lab.title}</h3>
                    <p className="text-sm text-zinc-500 mb-6 leading-relaxed text-pretty">{lab.blurb}</p>
                    <span className="mt-auto text-sm font-medium text-zinc-600 group-hover:text-ink">
                      <span className="mr-2 text-zinc-400">→</span>Open
                    </span>
                  </a>
                ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
