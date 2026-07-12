import type { ComponentType, SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement>;

const HypergraphLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <circle cx="5" cy="6" r="1.6" fill="currentColor" />
    <circle cx="19" cy="6" r="1.6" fill="currentColor" />
    <circle cx="12" cy="18" r="1.6" fill="currentColor" />
    <path d="M5 6L19 6M5 6L12 18M19 6L12 18" />
  </svg>
);

const SentientLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);

const RelayLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="4" y="12" width="3" height="8" />
    <rect x="10.5" y="6" width="3" height="14" />
    <rect x="17" y="10" width="3" height="10" />
  </svg>
);

const BasaltLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
    <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
  </svg>
);

const AxisLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="3" y="11" width="18" height="2" rx="1" />
    <rect x="11" y="3" width="2" height="18" rx="1" opacity="0.35" />
  </svg>
);

const HelioLogo = (props: LogoProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
    <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export type ProjectLink = { label: string; href: string };
export type Milestone = { label: string; note: string; status: "done" | "active" | "planned" };

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  Logo: ComponentType<LogoProps>;
  role: string;
  about: string[];
  pitchHeadline: string;
  pitchBody: string;
  links: ProjectLink[];
  progress: Milestone[];
};

export const projects: Project[] = [
  {
    slug: "hypergraph",
    name: "Hypergraph",
    tagline: "The backbone for global supply chain visibility.",
    description: "Unified data orchestration for modern logistics networks.",
    Logo: HypergraphLogo,
    role: "Founding Engineer & CEO. Led initial protocol design and secured first three enterprise pilots.",
    about: [
      "Hypergraph was founded to solve the fragmentation of logistics data. In an era of global commerce, most shipping containers still rely on paper bills of lading and siloed databases.",
      "We built a verifiable ledger that connects carriers, customs agents, and freight forwarders in real-time, reducing administrative friction by 40%.",
    ],
    pitchHeadline: "Single Source of Truth",
    pitchBody:
      "Hypergraph utilizes a directed acyclic graph (DAG) to maintain event order without the latency of traditional blocks. This allows for millisecond updates on cargo location and status changes, integrated directly into existing ERP systems.",
    links: [
      { label: "GitHub Repository", href: "#" },
      { label: "Technical Whitepaper", href: "#" },
      { label: "API Documentation", href: "#" },
    ],
    progress: [
      { label: "Series A Funding", note: "Completed March 2024", status: "done" },
      { label: "Maersk Integration Pilot", note: "Live", status: "done" },
      { label: "Hypergraph Core v2.0", note: "In Development", status: "active" },
      { label: "EU Customs Certification", note: "Q2 2026", status: "planned" },
    ],
  },
  {
    slug: "sentient",
    name: "Sentient",
    tagline: "Privacy-first compute layers for federated machine learning.",
    description: "Privacy-first compute layers for federated machine learning.",
    Logo: SentientLogo,
    role: "Co-founder & CTO.",
    about: ["Sentient lets teams train models across sensitive datasets without moving raw data."],
    pitchHeadline: "Learn without extracting.",
    pitchBody: "A federated runtime with hardware-backed attestation, so models improve while data stays put.",
    links: [{ label: "Website", href: "#" }, { label: "GitHub", href: "#" }],
    progress: [
      { label: "Seed Round", note: "Completed", status: "done" },
      { label: "Design Partner Pilots", note: "In progress", status: "active" },
      { label: "Public SDK", note: "Q3 2026", status: "planned" },
    ],
  },
  {
    slug: "relay",
    name: "Relay",
    tagline: "The operating system for international trade settlements.",
    description: "The operating system for international trade settlements.",
    Logo: RelayLogo,
    role: "Advisor.",
    about: ["Relay collapses letters of credit and settlement into a single programmable rail."],
    pitchHeadline: "Trade, cleared in seconds.",
    pitchBody: "Programmable escrow and multi-jurisdiction compliance for global trade counterparties.",
    links: [{ label: "Website", href: "#" }],
    progress: [
      { label: "Pre-seed", note: "Completed", status: "done" },
      { label: "First corridor live", note: "SG ↔ AE", status: "active" },
    ],
  },
  {
    slug: "basalt",
    name: "Basalt",
    tagline: "Modular smart contract security for high-frequency protocols.",
    description: "Modular smart contract security for high-frequency protocols.",
    Logo: BasaltLogo,
    role: "Founding Engineer.",
    about: ["Basalt provides drop-in guardrails for protocols that can't tolerate downtime."],
    pitchHeadline: "Security as an SLA.",
    pitchBody: "Continuous formal verification with a paid incident response layer for the top of the DeFi stack.",
    links: [{ label: "GitHub", href: "#" }],
    progress: [
      { label: "Audit engine v1", note: "Shipped", status: "done" },
      { label: "Response desk", note: "24/7 rollout", status: "active" },
    ],
  },
  {
    slug: "axis",
    name: "Axis",
    tagline: "Automated liquidity provisioning for cross-chain markets.",
    description: "Automated liquidity provisioning for cross-chain markets.",
    Logo: AxisLogo,
    role: "Founder.",
    about: ["Axis routes idle capital into the highest-quality liquidity venues across chains."],
    pitchHeadline: "One vault, every venue.",
    pitchBody: "A policy-driven vault engine that rebalances liquidity across chains and venues without manual intervention.",
    links: [{ label: "App", href: "#" }, { label: "Docs", href: "#" }],
    progress: [
      { label: "Mainnet beta", note: "Live", status: "done" },
      { label: "Institutional tier", note: "Q4 2026", status: "planned" },
    ],
  },
  {
    slug: "helio",
    name: "Helio",
    tagline: "Distributed energy accounting for grid operators.",
    description: "Distributed energy accounting for grid operators.",
    Logo: HelioLogo,
    role: "Technical advisor.",
    about: ["Helio reconciles distributed energy resources into a single settlement layer for utilities."],
    pitchHeadline: "Meter to market, in one ledger.",
    pitchBody: "A telemetry and settlement engine for utilities integrating rooftop solar, batteries, and V2G at scale.",
    links: [{ label: "Website", href: "#" }],
    progress: [
      { label: "Utility pilot", note: "Signed", status: "active" },
      { label: "Regulatory approval", note: "Pending", status: "planned" },
    ],
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);