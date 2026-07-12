import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getProject, type Milestone, type ProjectLink } from "@/lib/projects";

export const Route = createFileRoute("/projects/$slug")({
  loader: ({ params }) => {
    const project = getProject(params.slug);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Project not found" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { project } = loaderData;
    const title = `${project.name} — Modern Telepathy`;
    return {
      meta: [
        { title },
        { name: "description", content: project.tagline },
        { property: "og:title", content: title },
        { property: "og:description", content: project.tagline },
      ],
    };
  },
  component: ProjectDetail,
  notFoundComponent: () => (
    <div className="max-w-screen-xl mx-auto px-6 py-32">
      <p className="text-sm uppercase tracking-widest text-zinc-400 mb-4">404</p>
      <h1 className="text-4xl font-medium tracking-tight mb-6">Project not found</h1>
      <Link to="/" className="text-sm font-medium underline">
        Back to portfolio
      </Link>
    </div>
  ),
});

const statusDot: Record<"done" | "active" | "planned", string> = {
  done: "bg-green-500",
  active: "bg-amber-500",
  planned: "bg-zinc-200",
};

function ProjectDetail() {
  const { project } = Route.useLoaderData();
  const { Logo } = project;

  return (
    <div className="bg-canvas pt-16 pb-32">
      <div className="max-w-screen-xl mx-auto px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-ink transition-colors mb-16"
        >
          <span className="text-zinc-400">←</span> All ventures
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 mb-24">
          <div className="flex-1">
            <div className="size-16 bg-zinc-900 text-canvas rounded-2xl flex items-center justify-center mb-8 shadow-sm">
              <Logo className="size-8" />
            </div>
            <h1 className="text-5xl font-medium tracking-tight mb-4">{project.name}</h1>
            <p className="text-xl text-zinc-500 max-w-[40ch] text-pretty">{project.tagline}</p>
          </div>
          <div className="w-full md:w-64 space-y-4">
            <a
              href={project.links[0]?.href ?? "#"}
              className="block text-center bg-zinc-900 text-canvas px-4 py-2.5 rounded-lg text-sm font-medium ring-1 ring-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              Launch Website
            </a>
            <a
              href="#"
              className="block text-center bg-canvas text-ink px-4 py-2.5 rounded-lg text-sm font-medium ring-1 ring-black/5 hover:bg-zinc-50 transition-colors"
            >
              Technical Deck
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
          <div className="md:col-span-8 space-y-24">
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-6">
                About
              </h2>
              <div className="text-lg text-zinc-800 leading-relaxed text-pretty max-w-[56ch] space-y-6">
                {project.about.map((p: string, i: number) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-6">
                The Pitch
              </h2>
              <div className="w-full aspect-video bg-zinc-100 rounded-xl outline-1 -outline-offset-1 outline-black/5 grid place-items-center mb-10 relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, rgba(24,24,27,0.08), transparent 40%), radial-gradient(circle at 80% 70%, rgba(24,24,27,0.06), transparent 40%), linear-gradient(to right, rgba(24,24,27,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,24,27,0.04) 1px, transparent 1px)",
                    backgroundSize: "auto, auto, 32px 32px, 32px 32px",
                  }}
                />
                <Logo className="size-20 text-zinc-400 relative" />
              </div>
              <div className="max-w-[56ch] space-y-6">
                <h3 className="text-2xl font-medium tracking-tight text-balance">
                  {project.pitchHeadline}
                </h3>
                <p className="text-zinc-600 leading-relaxed text-pretty">{project.pitchBody}</p>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-6">
                Progress
              </h2>
              <div className="space-y-6">
                {project.progress.map((m: Milestone) => (
                  <div key={m.label} className="flex items-center gap-6">
                    <div className={`size-2 rounded-full ${statusDot[m.status]}`} />
                    <div className="flex-1 flex justify-between items-center border-b border-zinc-950/5 pb-4">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-sm text-zinc-400">{m.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="md:col-span-4">
            <div className="sticky top-24 space-y-12">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400 mb-6">
                  Resources
                </h2>
                <ul className="space-y-4">
                  {project.links.map((link: ProjectLink) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="group flex items-center justify-between py-2 text-zinc-600 hover:text-ink transition-colors"
                      >
                        <span className="text-sm font-medium">{link.label}</span>
                        <span className="text-zinc-300 group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-50 ring-1 ring-black/5">
                <h3 className="text-sm font-medium mb-2">My Role</h3>
                <p className="text-sm text-zinc-500">{project.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}