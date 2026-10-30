// Bundle "site": sections of the Longformer marketing and spec site (parchment palette, tokens scoped to .uix-www).
import { useEffect, useRef, type ReactNode } from "react";
import "@ui/tokens/theme.css";
import "./uix-light.css";
import "@www/styles/www-scope.css";
import { mountInto } from "./common";
import { FeatureSection } from "@www/components/FeatureSection";
import { FAQSection } from "@www/components/FAQSection";
import { PrinciplesSection } from "@www/components/PrinciplesSection";
import { ArchitectureSection } from "@www/components/ArchitectureSection";
import { HeroSection } from "@www/components/HeroSection";
import { CTASection, SiteFooter } from "@www/components/CTASection";
import { SiteHeader } from "@www/components/SiteHeader";
import { IntegrationsMarquee } from "@www/components/IntegrationsMarquee";
import { IsometricTile } from "@www/components/IsometricTile";
import { SpecHero } from "@www/components/spec/SpecHero";
import { FoundationSection } from "@www/components/spec/FoundationSection";
import { DecisionsSection } from "@www/components/spec/DecisionsSection";
import { SpecArchitectureSection } from "@www/components/spec/SpecArchitectureSection";
import { RoadmapSection } from "@www/components/spec/RoadmapSection";
import { AdoptionSection } from "@www/components/spec/AdoptionSection";
import { ProductSection } from "@www/components/spec/ProductSection";
import { AppendixSection } from "@www/components/spec/AppendixSection";
import SpecPage from "@www/SpecPage";

// Links in the site sections point at localhost or other sites; the preview must go nowhere.
function WwFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fix = () => ref.current?.querySelectorAll("a").forEach((a) => { a.setAttribute("href", "#"); a.removeAttribute("target"); });
    fix();
    const mo = new MutationObserver(fix);
    if (ref.current) mo.observe(ref.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref} className="uix-www" onClickCapture={(e) => { if ((e.target as Element).closest("a")) e.preventDefault(); }}>{children}</div>;
}
const R: Record<string, () => JSX.Element> = {
  "www-features": () => <FeatureSection />, "www-principles": () => <PrinciplesSection />, "www-faq": () => <FAQSection />, "www-architecture": () => <ArchitectureSection />,
  "www-hero": () => <HeroSection />, "www-cta": () => <CTASection />, "www-footer": () => <SiteFooter />, "www-header": () => <SiteHeader />, "www-marquee": () => <IntegrationsMarquee />,
  "www-isometric": () => <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: 24 }}>{[0, 1, 2, 3].map((v) => <div key={v} style={{ width: 160 }}><IsometricTile variant={v} /></div>)}</div>,
  "spec-hero": () => <SpecHero />, "spec-foundation": () => <FoundationSection />, "spec-decisions": () => <DecisionsSection />, "spec-architecture": () => <SpecArchitectureSection />,
  "spec-roadmap": () => <RoadmapSection />, "spec-adoption": () => <AdoptionSection />, "spec-product": () => <ProductSection />, "spec-appendix": () => <AppendixSection />,
  "spec-page": () => <SpecPage />,
};
export function renderSite(el: Element, id: string) {
  const f = R[id];
  if (!f) throw new Error("No renderer for " + id);
  mountInto(el, <WwFrame>{f()}</WwFrame>);
}
export const siteIds = Object.keys(R);

export { unmountTile } from "./common";
