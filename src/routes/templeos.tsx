import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { IMG, apps, hubServices, perf, profiles, styles, type AppState } from "@/lib/templeos";

const DOCS = "/labs/templeos/docs/";

export const Route = createFileRoute("/templeos")({
  head: () => ({
    meta: [
      { title: "TempleOS desktop — Modern Telepathy" },
      {
        name: "description",
        content:
          "A modern desktop written in HolyC: themes, a dock, a browser, clock, weather and music, with a host hub that does the work TempleOS cannot.",
      },
    ],
  }),
  component: TempleOSPage,
});

const chapters = [
  ["look", "Look"],
  ["apps", "Apps"],
  ["browser", "Browser"],
  ["speed", "Speed"],
  ["inside", "Inside"],
  ["next", "Next"],
] as const;

const mono = "font-mono text-[.7rem] uppercase tracking-[.16em]";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  dark,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  dark?: boolean;
}) {
  return (
    <div role="group" className={`inline-flex rounded-full p-1 ${dark ? "bg-white/10" : "bg-secondary"}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`${mono} rounded-full px-4 py-2 transition-colors ${
            value === o.id
              ? dark
                ? "bg-white text-black"
                : "bg-primary text-primary-foreground"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-zinc-500 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Frame({ src, alt, w, h, className = "" }: { src: string; alt: string; w: number; h: number; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      loading="lazy"
      className={`w-full h-auto rounded-3xl shadow-[0_30px_80px_-40px_rgba(31,42,34,.55)] ring-1 ring-black/10 ${className}`}
    />
  );
}

function Spread({
  id,
  eyebrow,
  title,
  body,
  media,
  flip,
  dark,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  media: ReactNode;
  flip?: boolean;
  dark?: boolean;
}) {
  return (
    <section id={id} className={`py-24 ${dark ? "bg-[#1d1d1b] text-white" : ""}`}>
      <div className="max-w-screen-xl mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">
        <div className={`md:col-span-5 ${flip ? "md:order-2" : ""}`}>
          <p className={`${mono} ${dark ? "text-white/50" : "text-zinc-500"} mb-5`}>{eyebrow}</p>
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-balance leading-[1.05]">{title}</h2>
          <div className={`mt-6 text-lg leading-relaxed text-pretty space-y-4 ${dark ? "text-white/70" : "text-zinc-500"}`}>{body}</div>
        </div>
        <div className={`md:col-span-7 ${flip ? "md:order-1" : ""}`}>{media}</div>
      </div>
    </section>
  );
}

const stateCls: Record<AppState, string> = {
  Built: "bg-primary text-primary-foreground",
  Prototype: "ring-1 ring-inset ring-black/30 text-ink",
  Planned: "ring-1 ring-inset ring-black/15 text-zinc-500",
};

function TempleOSPage() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [profile, setProfile] = useState("gilded");
  const [tmode, setTmode] = useState<"light" | "dark">("light");
  const [style, setStyle] = useState("glass");
  const p = profiles.find((x) => x.id === profile)!;

  return (
    <>
      {/* Hero */}
      <header className="pt-24 pb-16 bg-canvas text-center">
        <div className="max-w-screen-xl mx-auto px-6">
          <h1 className="text-5xl md:text-8xl font-medium tracking-tight text-balance leading-[0.98]">
            TempleOS,
            <br />
            with a desktop.
          </h1>
          <p className="mt-8 text-xl md:text-2xl text-zinc-500 max-w-[40ch] mx-auto text-pretty leading-snug">
            Windows, a dock, a browser, ten themes and a set of apps. All written in HolyC and drawn by its own renderer.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <a href="/labs/templeos/site/" className={`${mono} inline-flex items-center rounded-full bg-primary text-primary-foreground px-6 py-3.5`}>
              Website →
            </a>
            <a href={DOCS} className={`${mono} inline-flex items-center rounded-full bg-secondary px-6 py-3.5`}>
              Read the docs
            </a>
            <a
              href="https://github.com/Modern-Telepathy/templeos"
              target="_blank"
              rel="noreferrer"
              className={`${mono} inline-flex items-center rounded-full bg-secondary px-6 py-3.5`}
            >
              GitHub ↗
            </a>
          </div>
          <div className="mt-14 flex justify-center">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
            />
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 mt-8">
          <Frame src={`${IMG}/desk-${mode}.webp`} alt={`The desktop in ${mode} mode, with Settings, Files and Calculator open`} w={2000} h={1250} />
          <p className={`${mono} text-zinc-400 mt-4`}>Screenshot of the running desktop at 2880 × 1800</p>
        </div>
      </header>

      {/* Chapter bar */}
      <nav aria-label="On this page" className="sticky top-[76px] z-40 bg-canvas/85 backdrop-blur border-y border-border">
        <div className="max-w-screen-xl mx-auto px-6 h-12 flex items-center gap-x-8 overflow-x-auto no-scrollbar">
          {chapters.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={`${mono} text-zinc-500 hover:text-ink flex-none`}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* Look: themes */}
      <section id="look" className="py-24 bg-[#1d1d1b] text-white">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-white/50 mb-5`}>Look</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[18ch]">
            Ten ways to look at the day.
          </h2>
          <p className="mt-6 text-lg text-white/70 max-w-[56ch] text-pretty leading-relaxed">
            A profile sets the typography, the calendar and clock on the wallpaper, and the palette. Pair any of them with a window style, in light or dark.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Segmented
              dark
              value={tmode}
              onChange={setTmode}
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
            />
            <p className="text-white/60">
              <span className="text-white font-medium">{p.name}</span> — {p.mood}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {profiles.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={profile === x.id}
                onClick={() => setProfile(x.id)}
                className={`${mono} rounded-full px-4 py-2 transition-colors ${
                  profile === x.id ? "bg-white text-black" : "bg-white/10 text-white/70 hover:text-white"
                }`}
              >
                {x.name}
              </button>
            ))}
          </div>
          <div className="mt-10">
            <Frame src={`${IMG}/theme-${profile}-${tmode}.webp`} alt={`${p.name} profile, ${tmode} mode`} w={1200} h={750} className="ring-white/10" />
            <p className={`${mono} text-white/40 mt-4`}>Design renders of each profile, drawn from the palettes in the spec. The profiles are not built into the desktop yet.</p>
          </div>
        </div>
      </section>

      {/* Window styles */}
      <section className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-5`}>Windows</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[20ch]">
            Five styles. Change one, and every window follows.
          </h2>
          <p className="mt-6 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            Chrome, menu bar and dock come as a set: light, dark, glass, and two that borrow the look of other desktops. The Windows and Icons editors adjust shape, gradients, shadows and glow live.
          </p>
          <div className="mt-10">
            <Segmented value={style} onChange={setStyle} options={styles.map((s) => ({ id: s.id, label: s.name }))} />
          </div>
          <div className="mt-8 grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8">
              <Frame src={`${IMG}/style-${style}.webp`} alt={`The ${style} style`} w={1000} h={625} />
            </div>
            <div className="md:col-span-4">
              <Frame src={`${IMG}/window-style.webp`} alt="The Windows style editor with live previews" w={1600} h={1000} />
              <p className={`${mono} text-zinc-400 mt-4`}>The Windows editor</p>
            </div>
          </div>
        </div>
      </section>

      <Spread
        dark
        eyebrow="Wallpapers"
        title="Gradients built in a blink, photos on the way."
        body={
          <>
            <p>The default wallpapers are generated: smooth gradients built in about 60 ms, with banding removed.</p>
            <p>Photos come next. The Mac prepares each picture, since the desktop has no image decoder, and sends a small file the desktop can paint directly.</p>
          </>
        }
        media={<Frame src={`${IMG}/wallpapers.webp`} alt="A sheet of generated wallpapers" w={1380} h={1152} className="ring-white/10" />}
      />

      {/* Apps */}
      <section id="apps" className="pt-24 pb-12 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-5`}>Apps</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[18ch]">
            Apps that feel at home.
          </h2>
          <p className="mt-6 text-lg text-zinc-500 max-w-[56ch] text-pretty leading-relaxed">
            Each app is a HolyC function drawing into a window. Ten run on the desktop today, three more are working prototypes, and the rest are written up as plans.
          </p>
        </div>
      </section>

      <Spread
        eyebrow="Launchpad"
        title="Everything, one key away."
        body={<p>A full-screen grid of every app. Type to search, arrow keys to move, Return to open.</p>}
        media={<Frame src={`${IMG}/launchpad.webp`} alt="Launchpad with a grid of app icons" w={1600} h={1000} />}
      />
      <Spread
        flip
        eyebrow="Clock"
        title="Time zones, timers and alarms."
        body={<p>A world clock with an analog face, a timer, a stopwatch and alarms that fire on screen.</p>}
        media={<Frame src={`${IMG}/clock.webp`} alt="The Clock app showing a world clock" w={1600} h={1000} />}
      />
      <Spread
        eyebrow="Weather"
        title="Live forecasts, with permission first."
        body={
          <>
            <p>Twelve cities, hourly and daily charts, Celsius or Fahrenheit. The data comes from MET Norway through the host.</p>
            <p>The first request waits for an approval prompt. Until you say yes, nothing leaves the machine.</p>
          </>
        }
        media={<Frame src={`${IMG}/weather.webp`} alt="Weather for London with an hourly chart" w={1600} h={1000} />}
      />

      <section className="pb-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <h3 className="text-2xl font-medium mb-8">All apps</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => (
              <div key={a.name} className="rounded-2xl bg-card p-5 ring-1 ring-black/5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium">{a.name}</h4>
                  <span className={`${mono} !text-[.6rem] rounded-full px-2.5 py-1 flex-none ${stateCls[a.state]}`}>{a.state}</span>
                </div>
                <p className="text-sm text-zinc-500 text-pretty leading-relaxed">{a.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browser */}
      <section id="browser" className="py-24 bg-[#1d1d1b] text-white">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-white/50 mb-5`}>Browser</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[18ch]">
            The web, painted by the desktop.
          </h2>
          <p className="mt-6 text-lg text-white/70 max-w-[56ch] text-pretty leading-relaxed">
            TempleOS has no network stack. The host fetches and prepares each page, and the desktop paints it with its own renderer and fonts.
            Wikipedia and Hacker News load today, with links, history and scrolling.
          </p>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <Frame src={`${IMG}/browser-wikipedia.webp`} alt="The browser showing a Wikipedia article" w={1600} h={1000} className="ring-white/10" />
            <Frame src={`${IMG}/browser-hn.webp`} alt="The browser showing Hacker News" w={1600} h={1000} className="ring-white/10" />
          </div>
        </div>
      </section>

      <Spread
        eyebrow="Kamiji Studio"
        title="A character creator, inside the desktop."
        body={<p>The Kamiji Studio opens in the Browser tab: swap parts, drag morph sliders, recolour, and export. The host starts it and the desktop shows it.</p>}
        media={<Frame src={`${IMG}/kamiji.webp`} alt="Kamiji Studio with a fox character" w={1280} h={800} />}
      />

      {/* Speed */}
      <section id="speed" className="py-24 bg-[#1d1d1b] text-white">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-white/50 mb-5`}>Speed</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[18ch]">
            Fast, on an emulated CPU.
          </h2>
          <p className="mt-6 text-lg text-white/70 max-w-[56ch] text-pretty leading-relaxed">
            Measured in QEMU on an Apple Silicon Mac, with the x86 guest emulated in software. A recent pass cut full redraws from 19.8 ms to 3.4 ms at 1440 × 900.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {perf.map((x) => (
              <div key={x.n} className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
                <p className="text-5xl md:text-6xl font-medium tracking-tight">{x.n}</p>
                <p className="mt-4 text-white/60 text-sm leading-relaxed text-pretty">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inside */}
      <section id="inside" className="py-24 bg-canvas">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-5`}>Inside</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[20ch]">
            A small OS with a big helper.
          </h2>
          <p className="mt-6 text-lg text-zinc-500 max-w-[60ch] text-pretty leading-relaxed">
            TempleOS cannot do networking, containers or modern file formats. So the desktop talks over a serial line to a host hub on the Mac, which does that work and hands back small, ready-to-paint results.
          </p>
          <div className="mt-12 grid md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch">
            <div className="rounded-3xl bg-card p-8 ring-1 ring-black/5">
              <p className={`${mono} text-zinc-500 mb-4`}>Guest</p>
              <h3 className="text-2xl font-medium mb-3">TempleOS desktop</h3>
              <p className="text-zinc-500 leading-relaxed">HolyC all the way down: the renderer, the window manager, the dock and every app. It runs in QEMU, or natively on Apple Silicon through Aiwnios, with no emulation.</p>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center text-zinc-400 gap-2">
              <span className={mono}>Serial</span>
              <span className="text-2xl">⇄</span>
              <span className={mono}>Asks first</span>
            </div>
            <div className="rounded-3xl bg-card p-8 ring-1 ring-black/5">
              <p className={`${mono} text-zinc-500 mb-4`}>Host</p>
              <h3 className="text-2xl font-medium mb-3">The hub</h3>
              <p className="text-zinc-500 leading-relaxed mb-5">A Python service with one module per job. Nothing is sent, deleted or bought without a prompt on the desktop.</p>
              <div className="flex flex-wrap gap-2">
                {hubServices.map((s) => (
                  <span key={s} className={`${mono} !text-[.6rem] rounded-full bg-secondary px-3 py-1.5`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Next */}
      <section id="next" className="py-24 bg-zinc-100">
        <div className="max-w-screen-xl mx-auto px-6">
          <p className={`${mono} text-zinc-500 mb-5`}>Next</p>
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-balance leading-[1.02] max-w-[18ch]">
            Where it goes from here.
          </h2>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              ["Themes in the desktop", "The ten profiles are designed and rendered. Next is building them into the desktop, with their fonts."],
              ["More apps", "Maps, mail, contacts, slides, spreadsheets and podcasts are written up. Each follows the same host pattern as Weather."],
              ["A Linux foundation", "The foundation plan moves the base to Linux with our own compositor, so unmodified Electron and Tauri apps can run. The look and feel built here carries over."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-3xl bg-card p-8 ring-1 ring-black/5">
                <h3 className="text-xl font-medium mb-3">{t}</h3>
                <p className="text-zinc-500 leading-relaxed text-pretty">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap gap-3">
            <a href={DOCS} className={`${mono} inline-flex items-center rounded-full bg-primary text-primary-foreground px-6 py-3.5`}>
              Read the docs →
            </a>
            <a href="https://github.com/Modern-Telepathy/templeos" target="_blank" rel="noreferrer" className={`${mono} inline-flex items-center rounded-full bg-secondary px-6 py-3.5`}>
              GitHub ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
