import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/*
 * One header for the whole site. It mirrors public/labs/kamiji/site/shared-header.js (the bar on every Kamiji page):
 * same height, mono labels and turning logo wheel. Keep NAV in step with MT in that file.
 */
const NAV = [
  { to: "/", label: "Projects", exact: true },
  { to: "/labs", label: "Labs" },
  { to: "/labs/templeos/docs/", label: "Docs", plain: true },
  { to: "/thesis", label: "Thesis" },
] as const;

const KAMIJI = [
  { label: "Kamiji", href: "/labs/kamiji/site/" },
  { label: "Studio", href: "/labs/kamiji/site/studio/" },
  { label: "Kosmos", href: "/labs/kamiji/site/kosmos/" },
];

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
const active = "text-ink font-semibold shadow-[inset_0_-2px_0_var(--primary)]";

export function SiteHeader() {
  return (
    <nav
      aria-label="Sites"
      className="sticky top-0 z-50 h-10 bg-canvas border-b border-border"
    >
      <div className="h-full px-[clamp(16px,5vw,80px)] flex items-center justify-between gap-x-6 overflow-x-auto no-scrollbar">
        <span className="flex items-center gap-x-4 flex-none">
          <LogoWheel />
          <Link to="/" className={`${bar} text-ink font-semibold`}>
            Modern Telepathy
          </Link>
        </span>
        <span className="flex items-center gap-x-6 flex-none">
          {KAMIJI.map((l) => (
            <a key={l.href} href={l.href} className={`${bar} hidden md:inline`}>
              {l.label}
            </a>
          ))}
          {NAV.map((n) =>
            "plain" in n ? (
              <a key={n.to} href={n.to} className={bar}>
                {n.label}
              </a>
            ) : (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                activeProps={{ className: active }}
                className={bar}
              >
                {n.label}
              </Link>
            ),
          )}
        </span>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="py-12 border-t border-zinc-950/5">
      <div className="max-w-screen-xl mx-auto px-6 flex justify-between items-center">
        <p className="text-xs text-zinc-400">© {new Date().getFullYear()} Modern Telepathy</p>
        <div className="flex gap-6">
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