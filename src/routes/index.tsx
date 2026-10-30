import { createFileRoute } from "@tanstack/react-router";
import { groups } from "@/lib/groups";
import { ProjectLink } from "@/components/site-chrome";
import { projectsInGroup } from "@/lib/projects";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
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

      {groups
        .filter((g) => projectsInGroup(g.id).length > 0)
        .map((group, i) => (
          <section key={group.id} id={group.id} className={`py-16 ${i % 2 === 0 ? "bg-zinc-100" : "bg-canvas"}`}>
            <div className="max-w-screen-xl mx-auto px-6">
              <h2 className="text-2xl font-medium">{group.label}</h2>
              <p className="text-sm text-zinc-500 mt-2 mb-10">{group.blurb}</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projectsInGroup(group.id).map((p) => {
                  const { slug, name, description, logoSrc } = p;
                  return (
                  <ProjectLink
                    key={slug}
                    p={p}
                    className="group bg-card p-6 rounded-2xl ring-1 ring-black/5 hover:ring-black/10 transition-shadow flex flex-col"
                  >
                    <div className={`size-12 bg-zinc-100 rounded-xl mb-6 flex items-center justify-center outline-1 -outline-offset-1 outline-black/5 overflow-hidden ${p.logoPad ? "p-2" : ""}`}>
                      <img src={logoSrc} alt="" className={p.logoPad ? "max-h-full max-w-full object-contain" : "size-full object-cover"} />
                    </div>
                    <h3 className="text-lg font-medium mb-2">{name}</h3>
                    <p className="text-sm text-zinc-500 mb-8 leading-relaxed text-pretty">{description}</p>
                    <span className="mt-auto inline-flex items-center text-sm font-medium py-2 pr-3 pl-2 group-hover:bg-zinc-50 rounded-lg transition-colors">
                      <span className="mr-2 text-zinc-400">→</span>
                      View
                    </span>
                  </ProjectLink>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
    </>
  );
}
