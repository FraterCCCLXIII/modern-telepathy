export type ProjectLink = { label: string; href: string };
export type Milestone = { label: string; note: string; status: "done" | "active" | "planned" };

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoSrc: string;
  imageSrc?: string;
  role: string;
  about: string[];
  pitchHeadline: string;
  pitchBody: string;
  links: ProjectLink[];
  progress: Milestone[];
};

export const projects: Project[] = [
  {
    slug: "kosmos",
    name: "Kosmos",
    tagline: "A generative AI operating system for integrated work and life.",
    description: "One shell for chat, code, files, and generated apps — agents and UI sharing a single session.",
    logoSrc: "/projects/kosmos/logo.svg",
    imageSrc: "/projects/kosmos/image.png",
    role: "Founder. Product, architecture, and open-source direction.",
    about: [
      "Kosmos is a generative AI operating system: a unified shell where agents, files, code, and generated apps share focus across workspaces.",
      "It composes OpenClaw, coding runtimes, and Arco so you work in one session instead of a pile of SaaS tabs — with a desktop client, gateway-backed stores, and a public design-system surface.",
    ],
    pitchHeadline: "One shell for agents and apps",
    pitchBody:
      "Plug in agents and Arco-generated UI so intelligence and interface share context — files, code, and live apps included.",
    links: [
      { label: "Website", href: "https://www.kosmos.computer" },
      { label: "App", href: "https://app.kosmos.computer" },
      { label: "Docs", href: "https://docs.kosmos.computer" },
      { label: "GitHub", href: "https://github.com/Kosmos-computer/www" },
    ],
    progress: [
      { label: "Marketing site & brand", note: "Live", status: "done" },
      { label: "Desktop shell prototype", note: "Active", status: "active" },
      { label: "Public SDK surfaces", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "doctransit",
    name: "DocTransit",
    tagline: "E-signatures that just work.",
    description: "Send, sign, and track agreements — with Agents API, MCP, CLI, and webhooks for AI-driven contract flows.",
    logoSrc: "/projects/doctransit/logo.svg",
    imageSrc: "/projects/doctransit/image.jpeg",
    role: "Founder. Product, agents platform, and signing workflows.",
    about: [
      "DocTransit is an e-signature platform: request signatures, reuse templates, track envelopes in real time, and ship completion certificates with a clear audit trail.",
      "Business plans include an Agents API with MCP, CLI, SDK, and webhooks so AI tools can create and send contracts while humans sign in DocTransit.",
    ],
    pitchHeadline: "Get it signed.",
    pitchBody:
      "Core e-signature workflows without incumbent envelope caps — and agent tooling so contracts can start in Cursor or Claude.",
    links: [
      { label: "Website", href: "https://doctransit.com" },
      { label: "Docs", href: "https://docs.doctransit.com" },
      { label: "GitHub", href: "https://github.com/Modern-Telepathy/doctransit-app" },
    ],
    progress: [
      { label: "Signing app & templates", note: "Live", status: "done" },
      { label: "Agents API + MCP/CLI", note: "Active", status: "active" },
      { label: "Enterprise SSO", note: "Sales-assisted", status: "planned" },
    ],
  },
  {
    slug: "nextpresser",
    name: "NextPresser",
    tagline: "Next.js headless toolkit for WordPress and WooCommerce.",
    description: "Faust.js + WPGraphQL storefront with cart, checkout, auth, and multi-gateway payments.",
    logoSrc: "/projects/nextpresser/logo.svg",
    imageSrc: "/projects/nextpresser/image.png",
    role: "Creator. Headless commerce toolkit and docs.",
    about: [
      "NextPresser is a headless e-commerce toolkit: Next.js against WordPress/WooCommerce via Faust.js and WPGraphQL, covering catalog, cart, checkout, and accounts.",
      "Payments include Stripe, PayPal, and COD; UI uses Tailwind and shadcn/ui with Gutenberg block support through WPGraphQL Content Blocks.",
    ],
    pitchHeadline: "WordPress commerce, Next.js speed",
    pitchBody:
      "Ship a Faust-powered headless store with WooCommerce data and modern UI without rebuilding the CMS.",
    links: [
      { label: "Website", href: "https://nextpresser.com" },
      { label: "GitHub", href: "https://github.com/NextPresser/NextPresser" },
      { label: "Docs", href: "https://docs.nextpresser.com" },
    ],
    progress: [
      { label: "Core storefront", note: "Shipped", status: "done" },
      { label: "Docs & installers", note: "Live", status: "active" },
    ],
  },
  {
    slug: "prompt",
    name: "Prompt",
    tagline: "A minimal anonymous writing app.",
    description: "Leave a text post — public or link-only — at a human-readable five-word URL.",
    logoSrc: "/projects/prompt/logo.svg",
    role: "Creator. Full-stack Next.js + SQLite writing space.",
    about: [
      "Prompt is a quiet archive for anonymous messages: optional titles, public or link-only visibility, and memorable slugs — no social graph.",
      "Readers browse previous, random, and next public posts; moderation covers reports, bans, spam limits, backups, and analytics settings.",
    ],
    pitchHeadline: "Write something. Leave it.",
    pitchBody:
      "Anonymous posts with memorable URLs and enough moderation to keep a calm public writing space running.",
    links: [
      { label: "Website", href: "https://theprompt.site" },
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/Prompt" },
    ],
    progress: [
      { label: "Core writing app", note: "Live", status: "done" },
      { label: "Moderation admin", note: "Shipped", status: "done" },
    ],
  },
  {
    slug: "newsphere",
    name: "Newsphere",
    tagline: "Built to read, not to scroll.",
    description: "Desktop RSS/Atom reader with a column grid, focused reader, and optional on-device AI.",
    logoSrc: "/projects/newsphere/logo.svg",
    imageSrc: "/projects/newsphere/image.png",
    role: "Creator. Tauri desktop reader and local AI tools.",
    about: [
      "Newsphere is a Tauri + React desktop app organized around topic pages of feed columns, with drag-and-drop layout, readability extraction, history, and bookmarks.",
      "Data stays local; an optional AI assistant uses your own keys over cached feed snippets — off by default. Primarily developed for Apple Silicon macOS.",
    ],
    pitchHeadline: "Feeds without the feed frenzy",
    pitchBody:
      "A calm desktop grid for the sources you choose — read extracted articles, keep history, optionally ask AI over your cache.",
    links: [
      { label: "Website", href: "https://newsphere.site" },
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/newsphere" },
    ],
    progress: [
      { label: "Beta 1.0", note: "Released", status: "done" },
      { label: "macOS distribution", note: "Active", status: "active" },
    ],
  },
  {
    slug: "castflow",
    name: "Castbook",
    tagline: "Casting companion for actors, projects, roles, and assignments.",
    description: "Manage talent and productions — with public actor submissions and multilingual UI.",
    logoSrc: "/projects/castflow/logo.svg",
    role: "Builder. Casting ops app with Express + SQLite.",
    about: [
      "Castbook is a Vite/React casting tool with an Express + SQLite API for actors, projects, roles, and assignments.",
      "Admins bootstrap the first account; talent can submit public profiles. English, French, and German are supported, with Docker/Coolify deployment for a single container.",
    ],
    pitchHeadline: "Casting ops in one place",
    pitchBody:
      "Track actors and projects, assign roles, and collect applications without spreadsheet sprawl.",
    links: [
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/castflow-companion" },
    ],
    progress: [
      { label: "CRUD + auth", note: "Shipped", status: "done" },
      { label: "Public actor intake", note: "Live", status: "active" },
    ],
  },
  {
    slug: "openbook",
    name: "OpenBook",
    tagline: "TypeScript appointment platform — NestJS API + React SPA.",
    description: "Modern booking for services and providers with public scheduling and staff tools.",
    logoSrc: "/projects/openbook/logo.svg",
    imageSrc: "/projects/openbook/image.png",
    role: "Architect. Typed monorepo for appointments and scheduling.",
    about: [
      "OpenBook is a pnpm/Turborepo stack: NestJS API, React/Vite web app, and shared Zod contracts for appointments, staff, customers, and integrations.",
      "Anonymous booking, staff tools, Stripe webhooks, Google Calendar OAuth, SMTP mail, and optional BullMQ jobs.",
    ],
    pitchHeadline: "Bookings without the busywork",
    pitchBody:
      "A typed Nest + React appointment platform with public booking, staff tools, and Stripe.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/OpenBook" }],
    progress: [
      { label: "Monorepo + shared contracts", note: "Done", status: "done" },
      { label: "Feature parity port", note: "Ongoing", status: "active" },
    ],
  },
  {
    slug: "kosmographica",
    name: "Kosmographica",
    tagline: "A knowledge graph of human thought, culture, and history.",
    description: "Federated, citation-backed encyclopedia with trust-rated claims across religion and mythology.",
    logoSrc: "/projects/kosmographica/logo.svg",
    role: "Founder. Provenance-first knowledge graph design.",
    about: [
      "Kosmographica federates comparative mythology, lineage transmission, integral models, and historical timelines into one provenance-first graph.",
      "Entries follow publish-then-verify authorship; every claim carries a cited source and a trust tier from machine-unverified to expert-endorsed.",
    ],
    pitchHeadline: "A graph of human thought",
    pitchBody:
      "Search a federated, citation-backed map of religion, mythology, and ideas — with transparent trust on every claim.",
    links: [
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/kosmographica-engine" },
      { label: "Website repo", href: "https://github.com/FraterCCCLXIII/kosmographica" },
    ],
    progress: [
      { label: "Spec & federation design", note: "Active", status: "active" },
      { label: "Public graph UI", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "holons",
    name: "Holons",
    tagline: "Learning communities of people evolving together.",
    description: "LMS where each Holon hosts courses, modules, members, and a social feed.",
    logoSrc: "/projects/holons/logo.svg",
    imageSrc: "/projects/holons/image.png",
    role: "Creator. Community LMS and related P2P experiments.",
    about: [
      "Holons is a React + Firebase learning app where communities (“holons”) host courses, modules, member lists, feeds, and media.",
      "Sibling experiments explore P2P chat (OrbitDB/LibP2P) and holon protocol ideas around the same community metaphor.",
    ],
    pitchHeadline: "Learning communities, as Holons",
    pitchBody:
      "Create a Holon, add courses and members, and grow knowledge together in a community-first LMS.",
    links: [{ label: "GitHub", href: "https://github.com/openartist/holons" }],
    progress: [
      { label: "Web LMS", note: "Shipped", status: "done" },
      { label: "P2P experiments", note: "Exploratory", status: "active" },
    ],
  },
  {
    slug: "public-search",
    name: "Public Search",
    tagline: "Private, peer-to-peer search for the free web.",
    description: "Modern YaCy front end — no tracking, themeable UI, optional SearxNG.",
    logoSrc: "/projects/public-search/logo.svg",
    role: "Creator. Decentralized search interface for YaCy.",
    about: [
      "Public Search wraps YaCy’s decentralized engine with a lightweight HTML/JS UI and a React + Material UI app.",
      "Positioned as “Public”: private search without a central gatekeeper — P2P indexing, light/dark/sepia themes, and local setup scripts.",
    ],
    pitchHeadline: "Private, decentralized search",
    pitchBody:
      "Search through a modern UI on YaCy’s peer-to-peer engine — without handing queries to a megacorp.",
    links: [
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/Public-Search" },
      { label: "YaCy", href: "https://yacy.net/" },
    ],
    progress: [
      { label: "YaCy UI + React app", note: "Shipped", status: "done" },
      { label: "SearxNG compose notes", note: "Documented", status: "active" },
    ],
  },
  {
    slug: "public-translate",
    name: "Public Translate",
    tagline: "Open-source live voice translation for cross-cultural dialogue.",
    description: "Speech-to-text, bilingual display, and TTS — built for temples, classrooms, and cast-to-TV.",
    logoSrc: "/projects/public-translate/logo.svg",
    role: "Creator. Live translation for dharma and philosophy settings.",
    about: [
      "Public:Translate (言語機) began from translating while speaking with Japanese monks — audience-facing live translation when no interpreter is available.",
      "It covers transcription and translation across 150+ languages, TTS, LTR/RTL/CJK alignment, full transcripts, and cast-friendly layouts.",
    ],
    pitchHeadline: "Live speech, bilingual display",
    pitchBody:
      "Speak once; show and speak the translation for an audience — on laptop, phone, or TV.",
    links: [
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/public-translate" },
    ],
    progress: [
      { label: "Live translation UI", note: "Shipped", status: "done" },
      { label: "Multi-speaker + history", note: "Roadmap", status: "planned" },
    ],
  },
  {
    slug: "dharma-atlas",
    name: "Dharma Atlas",
    tagline: "Discover temples, monasteries, and ashrams worldwide.",
    description: "Interactive map and list of 5,600+ spiritual places with tradition filters.",
    logoSrc: "/projects/dharma-atlas/logo.svg",
    imageSrc: "/projects/dharma-atlas/image.jpg",
    role: "Creator. Place discovery for Buddhist and contemplative practice.",
    about: [
      "Dharma Atlas is a Next.js app with Leaflet and Motion for exploring temples, monasteries, meditation centers, and ashrams on a synced map and list.",
      "Locations are assembled from Google Places, BuddhaNet, dhamma.org, Shambhala KML, and related pipelines into Postgres-backed discovery.",
    ],
    pitchHeadline: "Find temples & practice places",
    pitchBody:
      "Browse thousands of temples, monasteries, and ashrams with search and tradition filters.",
    links: [
      { label: "Website", href: "https://dharmaatlas.com" },
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/dharma-atlas" },
    ],
    progress: [
      { label: "Map + list UX", note: "Live", status: "done" },
      { label: "Data pipeline expansion", note: "Ongoing", status: "active" },
    ],
  },
  {
    slug: "podium",
    name: "Podium",
    tagline: "AI show notes, chapters, transcripts, and clips for podcasts.",
    description: "Podcast post-production that turns episodes into editable transcripts and shareable collateral.",
    logoSrc: "/projects/podium/logo.png",
    imageSrc: "/projects/podium/image.png",
    role: "Product/engineering. Podcast AI post-production (podium.page).",
    about: [
      "Podium generates diarized transcripts, Spotify/YouTube-ready chapters, show notes, audiogram clips, and marketing copy from podcast episodes.",
      "The Nuxt app (podium.page) talks to the Fathom web API — part of the same audio intelligence lineage as Fathom Labs.",
    ],
    pitchHeadline: "AI podcast post-production",
    pitchBody:
      "Upload an episode and get transcripts, chapters, show notes, and clips without the usual grind.",
    links: [
      { label: "Website", href: "https://podium.page" },
      { label: "GitHub", href: "https://github.com/fathom-labs/podium-web" },
    ],
    progress: [
      { label: "Core enrichment pipeline", note: "Production", status: "done" },
      { label: "Editor & clips UX", note: "Live", status: "active" },
    ],
  },
  {
    slug: "fathom",
    name: "Fathom",
    tagline: "Audio intelligence — ingest, transcribe, chapterize, enrich.",
    description: "The podcast pipeline behind diarized transcripts, vectors, and episode enrichment at fathom.fm.",
    logoSrc: "/projects/fathom/logo.png",
    role: "Prior art / labs lineage. Transcription and enrichment infrastructure.",
    about: [
      "Fathom is the audio content pipeline: load podcasts from RSS, transcribe with diarization, normalize word-level transcripts, and run chapterization, summaries, and clip suggestions.",
      "Orchestration workers handle continuous ingest, vector updates, and notifications; ASR cores and web APIs power products like Podium — reference architecture now informing Arco/Longformer.",
    ],
    pitchHeadline: "Transcribe the feed",
    pitchBody:
      "Battle-tested podcast ASR and enrichment — the substrate under Podium and the pattern migrating into Kosmos/Arco.",
    links: [
      { label: "Website", href: "https://fathom.fm" },
      { label: "Podium", href: "https://podium.page" },
    ],
    progress: [
      { label: "Production ASR pipeline", note: "Mature", status: "done" },
      { label: "Port patterns into Arco", note: "In design", status: "active" },
    ],
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);
