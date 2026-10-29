import { createFileRoute } from "@tanstack/react-router";

const DOCS = "/labs/templeos/docs";

export const Route = createFileRoute("/templeos")({
  head: () => ({
    meta: [
      { title: "TempleOS desktop — Modern Telepathy" },
      {
        name: "description",
        content: "A HolyC desktop with its own browser, apps and host bridge: plans, specs and status.",
      },
    ],
  }),
  component: TempleOSPage,
});

const sections = [
  { title: "Overview", blurb: "Where the project stands and how the pieces fit.", links: [["Desktop README", `${DOCS}/readme/`], ["OS foundation plan", `${DOCS}/docs/os-foundation-plan/`], ["Core apps plan", `${DOCS}/docs/core-apps-plan/`], ["HolyC native apps", `${DOCS}/docs/holyc-native-apps-plan/`]] },
  { title: "Browser", blurb: "A web browser written for the HolyC desktop.", links: [["Architecture and specification", `${DOCS}/docs/browser-architecture/`], ["Feature inventory", `${DOCS}/docs/browser-features/`], ["Plan", `${DOCS}/docs/browser-plan/`], ["Painter status", `${DOCS}/docs/browser-painter-status/`], ["Test sites", `${DOCS}/docs/browser-test-sites/`]] },
  { title: "Engine and platform", blurb: "Running the Kosmos engine, a dev box and other apps next to TempleOS.", links: [["Engine on TempleOS", `${DOCS}/docs/engine-on-templeos/`], ["Dev box", `${DOCS}/docs/dev-box/`], ["Web apps", `${DOCS}/docs/web-apps/`], ["Electron apps", `${DOCS}/docs/electron-apps/`], ["Kamiji on TempleOS", `${DOCS}/docs/kamiji-on-templeos/`]] },
];

function TempleOSPage() {
  return (
    <>
      <header className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className="font-mono text-[.7rem] uppercase tracking-[.16em] text-zinc-500 mb-6">Product</p>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-none max-w-[20ch]">
            TempleOS desktop
          </h1>
          <p className="mt-8 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            A modern desktop built in HolyC: its own browser, mail, contacts and ports of existing apps, with a host hub that
            does the work TempleOS cannot.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={`${DOCS}/`}
              className="inline-flex items-center rounded-xl bg-primary text-primary-foreground px-5 py-3 font-mono text-[.7rem] uppercase tracking-[.16em]"
            >
              Read the docs →
            </a>
            <a
              href="https://github.com/Modern-Telepathy/templeos"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl bg-secondary px-5 py-3 font-mono text-[.7rem] uppercase tracking-[.16em]"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </header>

      <section className="py-16 bg-zinc-100">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="text-2xl font-medium">Documentation</h2>
          <p className="text-sm text-zinc-500 mt-2 mb-10">
            The full docs site has more sections: apps, hub and host services, and research and reviews.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {sections.map((s) => (
              <div key={s.title} className="bg-card p-6 rounded-2xl ring-1 ring-black/5">
                <h3 className="text-lg font-medium mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{s.blurb}</p>
                <ul className="space-y-3">
                  {s.links.map(([label, href]) => (
                    <li key={href}>
                      <a href={href} className="group flex items-center justify-between text-sm font-medium text-zinc-600 hover:text-ink">
                        {label}
                        <span className="text-zinc-300 group-hover:translate-x-1 transition-transform">→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
