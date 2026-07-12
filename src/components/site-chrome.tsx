import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <nav className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-zinc-950/5">
      <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-medium tracking-tight text-ink">
          Modern Telepathy
        </Link>
        <div className="flex gap-8 text-sm font-medium text-zinc-500">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-ink" }}
            className="hover:text-ink transition-colors"
          >
            Ventures
          </Link>
          <Link
            to="/thesis"
            activeProps={{ className: "text-ink" }}
            className="hover:text-ink transition-colors"
          >
            Thesis
          </Link>
          <a href="#" className="hover:text-ink transition-colors">
            Contact
          </a>
        </div>
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