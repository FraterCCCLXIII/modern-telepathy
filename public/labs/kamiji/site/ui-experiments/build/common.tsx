// Shared mount helper for the three gallery bundles (core, apps, site).
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

const roots = new WeakMap<Element, Root>();
export function unmountTile(el: Element) {
  const r = roots.get(el);
  if (r) { r.unmount(); roots.delete(el); }
}
export function mountInto(el: Element, node: ReactNode) {
  let root = roots.get(el);
  if (!root) { root = createRoot(el); roots.set(el, root); }
  root.render(<Boundary><Demote><div className="lf-root uix-lf" data-lf-theme="light">{node}</div></Demote></Boundary>);
}

import { Component, useEffect, useRef } from "react";
// previews are page content: a preview's own <h1> must not become a second page title
function Demote({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Gallery-side accessibility patches on the preview DOM (the workspace sources are not modified): demote h1, make scrollable code
    // focusable, and give icon-only or placeholder-only controls a name.
    const named = (e: Element) => !!(e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title") || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest("label") || ((e as HTMLElement).innerText || "").trim());
    const fix = () => {
      const r = ref.current; if (!r) return;
      r.querySelectorAll("h1").forEach((h) => { h.setAttribute("role", "heading"); h.setAttribute("aria-level", "3"); });
      r.querySelectorAll("pre").forEach((p) => { if (!p.hasAttribute("tabindex")) { p.setAttribute("tabindex", "0"); if (!p.getAttribute("aria-label")) p.setAttribute("aria-label", "Code or output sample"); } });
      r.querySelectorAll("input, textarea, select").forEach((i) => { if (!named(i) && (i as HTMLInputElement).type !== "hidden") i.setAttribute("aria-label", (i as HTMLInputElement).placeholder || "Text field"); });
      r.querySelectorAll("button").forEach((b) => {
        if (named(b)) return;
        const svg = b.querySelector("svg"); const m = svg && String(svg.getAttribute("class") || "").match(/lucide-([a-z0-9-]+)/);
        b.setAttribute("aria-label", m ? m[1].replace(/-/g, " ") : "Action");
      });
    };
    fix();
    const mo = new MutationObserver(fix);
    if (ref.current) mo.observe(ref.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref} style={{ height: "100%" }}>{children}</div>;
}
class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) { return { err: String(e && e.message || e) }; }
  componentDidCatch(e: Error) { console.warn("[ui-experiments] preview error:", e && e.message); }
  render() {
    return this.state.err ? <p className="ux-err" role="alert" data-error-boundary="1">This preview failed to render.</p> : this.props.children;
  }
}
export const noop = () => {};
