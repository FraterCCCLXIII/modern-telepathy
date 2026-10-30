import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { groups, type GroupId } from "@/lib/groups";
import { labsInGroup } from "@/lib/labs";
import { projectsInGroup, type Project } from "@/lib/projects";

/*
 * One header for the whole site. It mirrors public/labs/kamiji/site/shared-header.js (the bar on every Kamiji page):
 * same height, mono labels and turning logo wheel. Keep NAV in step with MT in that file.
 */
const NAV = [
  { to: "/", label: "Products", exact: true },
  { to: "/labs", label: "Labs" },
  { to: "/thesis", label: "Thesis" },
  { to: "/contact", label: "Contact" },
] as const;

// Wheel faces: [src, width, height]. Four sides, 90 degrees apart, apothem = 20px / 2.
const FACES: [string, number, number][] = [
  ["/favicon.svg", 20, 20],
  ["/labs/kamiji/site/img/artek-logo.svg", 46, 20],
  ["/labs/kamiji/site/kosmos-computer/img/kosmos-mark-dark.svg", 28, 20],
  ["/labs/kamiji/site/img/kosmos-logo.svg", 56, 11],
];

function LogoWheel() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const start = () => {
      if (!timer) timer = window.setInterval(() => setStep((n) => n + 1), 3600);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return (
    <span
      role="img"
      aria-label="Modern Telepathy"
      className="relative flex-none block h-5 w-14"
      style={{ perspective: "160px" }}
    >
      <span
        className="absolute inset-0 block motion-safe:transition-transform motion-safe:duration-[800ms]"
        style={{ transformStyle: "preserve-3d", transform: `rotateX(${-90 * step}deg)`, transitionTimingFunction: "cubic-bezier(.5,0,.2,1)" }}
      >
        {FACES.map(([src, w, h], i) => (
          <span
            key={src}
            aria-hidden
            className="absolute inset-0 flex items-center"
            style={{ backfaceVisibility: "hidden", transform: `rotateX(${i * 90}deg) translateZ(10px)` }}
          >
            <img src={src} alt="" width={w} height={h} className="block max-h-full max-w-full" />
          </span>
        ))}
      </span>
    </span>
  );
}

const bar =
  "font-mono text-[.66rem] leading-none uppercase tracking-[.16em] text-muted-foreground hover:text-ink focus-visible:text-ink transition-colors py-3";
const pad = "px-[clamp(16px,5vw,80px)]";
const active = "text-ink font-semibold shadow-[inset_0_-2px_0_var(--primary)]";

/** Link to a project's page: its own route when it has one, else /projects/$slug. */
export function ProjectLink({ p, ...rest }: { p: Project; className?: string; onClick?: () => void; children: ReactNode }) {
  return p.href ? (
    <Link to={p.href as "/templeos"} {...rest} />
  ) : (
    <Link to="/projects/$slug" params={{ slug: p.slug }} {...rest} />
  );
}

function Menu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div
      className="relative flex-none"
      onMouseLeave={close}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        className={`${bar} inline-flex items-center gap-2`}
      >
        {label}
        <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden className={open ? "rotate-180" : ""}>
          <path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-50 min-w-60 max-w-80 rounded-2xl bg-card p-2 shadow-[0_18px_40px_-20px_rgba(31,42,34,.35)] ring-1 ring-black/5">
          {children(close)}
        </ul>
      )}
    </div>
  );
}

const itemCls = "block rounded-xl px-3 py-2 hover:bg-primary hover:text-primary-foreground";
function Item({ name, note }: { name: string; note: string }) {
  return (
    <>
      <span className="block font-mono text-[.7rem] font-semibold uppercase tracking-[.1em]">{name}</span>
      <span className="block text-sm opacity-70 text-pretty">{note}</span>
    </>
  );
}

/** Second row. Its items follow the top tab: Products, Labs, or nothing (Thesis). */
function SubNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const inLabs = path.startsWith("/labs");
  if (path.startsWith("/thesis")) return null;
  return (
    <nav aria-label={inLabs ? "Labs" : "Products"} className="h-9 border-b border-border">
      <div className={`${pad} h-full flex items-center gap-x-6`}>
        {inLabs ? (
          <>
            {groups
              .filter((g) => labsInGroup(g.id).length > 0)
              .map((g) => (
                <Menu key={g.id} label={g.label}>
                  {() =>
                    labsInGroup(g.id).map((l) => (
                      <li key={l.id}>
                        <a href={l.href} className={itemCls}>
                          <Item name={l.title} note={l.blurb} />
                        </a>
                      </li>
                    ))
                  }
                </Menu>
              ))}
            <Link to="/labs" className={`${bar} ml-auto flex-none`}>
              All labs →
            </Link>
          </>
        ) : (
          <>
            {groups
              .filter((g) => projectsInGroup(g.id).length > 0)
              .map((g) => (
                <Menu key={g.id} label={g.label}>
                  {(close) =>
                    projectsInGroup(g.id).map((p) => (
                      <li key={p.slug}>
                        <ProjectLink p={p} onClick={close} className={itemCls}>
                          <Item name={p.name} note={p.tagline} />
                        </ProjectLink>
                      </li>
                    ))
                  }
                </Menu>
              ))}
            <Link to="/" className={`${bar} ml-auto flex-none`}>
              All products →
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-canvas">
      <nav aria-label="Sites" className="h-10 border-b border-border">
        <div className={`${pad} h-full flex items-center justify-between gap-x-6 overflow-x-auto no-scrollbar`}>
          <span className="flex items-center gap-x-4 flex-none">
            <LogoWheel />
            <Link to="/" className={`${bar} text-ink font-semibold`}>
              Modern Telepathy
            </Link>
          </span>
          <span className="flex items-center gap-x-6 flex-none">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                activeProps={{ className: active }}
                className={bar}
              >
                {n.label}
              </Link>
            ))}
          </span>
        </div>
      </nav>
      <SubNav />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="py-12 border-t border-zinc-950/5">
      <div className="max-w-screen-xl mx-auto px-6 flex justify-between items-center">
        <p className="text-xs text-zinc-400">© {new Date().getFullYear()} Modern Telepathy</p>
        <div className="flex gap-6">
          <Link to="/contact" className="text-xs text-zinc-400 hover:text-ink transition-colors">
            Contact
          </Link>
          <a href="#" className="text-xs text-zinc-400 hover:text-ink transition-colors">
            Twitter
          </a>
          <a href="#" className="text-xs text-zinc-400 hover:text-ink transition-colors">
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}