import type { GroupId } from "@/lib/groups";

export type ProjectLink = { label: string; href: string };
export type Milestone = { label: string; note: string; status: "done" | "active" | "planned" };

export type Project = {
  slug: string;
  /** Logo is a bare glyph with no tile of its own: show it padded instead of full-bleed. */
  logoPad?: boolean;
  /** Own page instead of /projects/$slug. */
  href?: string;
  group: GroupId;
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
    slug: "yakopop",
    group: "language",
    name: "Yakopop",
    tagline: "Word-synced, colour-coded bilingual subtitles for language learners.",
    description: "Every word shows its script, reading, meaning and grammar, and lights up with its translation while the video plays.",
    logoSrc: "/projects/yakopop/logo.png",
    role: "Creator. Product, learning player, creator studio and translation pipeline.",
    about: [
      "Yakopop turns a video into a lesson. Each word carries its original script, reading, transliteration, meaning and grammar, and it lights up together with the part of the translation it matches while the video plays.",
      "Learners can hover for dictionary cards and audio, cut short clips into a personal library, and publish them to Reels. Creators import YouTube videos, playlists or whole channels in a Studio and choose languages, layers and level. Lessons cover Japanese, Mandarin, Korean, Russian, Spanish, Hindi, Nepali, Thai and Tibetan, with translations into 12 languages and a 12-language interface.",
    ],
    pitchHeadline: "Learn from the video you already want to watch",
    pitchBody: "Pick a video, read along word by word, and keep the clips you want to remember.",
    links: [{ label: "Website", href: "https://yakopop.com" }],
    progress: [
      { label: "Learning player, clips and Reels", note: "Live", status: "done" },
      { label: "Creator Studio and YouTube import", note: "Live", status: "done" },
      { label: "Video uploads and speech-to-text", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "arco",
    group: "systems",
    name: "Arco",
    tagline: "Generative UI for agents: cards and components an agent can compose.",
    description: "The generative UI library inside Kosmos, with a component library and public documentation.",
    logoSrc: "/projects/arco/logo.svg",
    role: "Creator. Design system, component library and docs.",
    about: [
      "Arco is the generative UI library inside Kosmos. Instead of replying in text alone, an agent can answer with cards and components drawn from a shared design system, in the same session as the rest of the work.",
      "It has its own documentation site and an open repository. The demo page here shows the card renderer with made-up content.",
    ],
    pitchHeadline: "Let the agent answer with an interface",
    pitchBody: "Read the docs for the components, or open the demo to see cards rendered.",
    links: [
      { label: "Docs", href: "https://docs.kosmos.computer" },
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/arco-os" },
    ],
    progress: [
      { label: "Component library and card renderer", note: "Prototype", status: "active" },
      { label: "Public documentation", note: "Live", status: "done" },
    ],
  },
  {
    slug: "kosmos-engine",
    group: "systems",
    name: "Kosmos engine",
    tagline: "A Rust reality engine, and a TypeScript SDK for the Kosmos platform.",
    description: "The 3D and simulation engine behind the Kosmos family, plus the official TypeScript client for Kosmos servers.",
    logoSrc: "/projects/kosmos-engine/logo.svg",
    role: "Creator. Engine architecture, SDK and tooling.",
    about: [
      "The Kosmos Reality Engine is written in Rust and runs headless for replay and testing as well as in a window, so a scene can be stepped, snapshotted and compared by state hash. It is the engine behind the Kosmos experiments.",
      "The Kosmos SDK is a separate, MIT-licensed TypeScript client. It connects scripts and apps to a Kosmos environment (a local desktop, a self-hosted server or a hosted tenant) for chat, streaming and tools.",
    ],
    pitchHeadline: "An engine you can replay",
    pitchBody: "The engine repository is private for now. The SDK is open, and the engine page here explains how it works.",
    links: [{ label: "SDK on GitHub", href: "https://github.com/Kosmos-computer/kosmos-sdk" }],
    progress: [
      { label: "Rust engine with replay and state hashing", note: "Active", status: "active" },
      { label: "TypeScript SDK", note: "Open source", status: "done" },
      { label: "Public engine release", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "relay",
    group: "knowledge",
    name: "Relay and MESH",
    tagline: "Open specifications for decentralized social networks.",
    description: "Relay is a stack spec of signed, content-addressed facts and deterministic views. MESH combines ideas from Nostr, ActivityPub, SSB and AT Protocol.",
    logoSrc: "/projects/relay/logo.svg",
    role: "Author. Protocol specifications and reference implementations.",
    about: [
      "Relay splits a social protocol into two layers. The truth layer holds signed, content-addressed facts: identities, an append-only event log, state and attestations. The view layer holds deterministic projections over those facts, such as feeds and ordered lists. The stack spec has gone through several drafts and is now at version 2.",
      "MESH, the Modular Extensible Social Hybrid Protocol, is a sibling specification that layers privacy, integrity, moderation, views and network over a self-sovereign identity, with a Python implementation.",
    ],
    pitchHeadline: "Facts first, feeds second",
    pitchBody: "Read the specifications and the reference code.",
    links: [
      { label: "Relay on GitHub", href: "https://github.com/FraterCCCLXIII/Relay" },
      { label: "MESH on GitHub", href: "https://github.com/FraterCCCLXIII/mesh-protocol" },
    ],
    progress: [
      { label: "Relay stack spec", note: "Draft 2.0", status: "active" },
      { label: "MESH spec and Python implementation", note: "v1.1", status: "done" },
    ],
  },
  {
    slug: "pressmark",
    group: "tools",
    name: "Pressmark",
    tagline: "Design and print labels from your desktop or browser.",
    description: "A label editor for NIIMBOT printers over Bluetooth or USB. Offline by default; your labels stay in your browser.",
    logoSrc: "/projects/pressmark/logo.svg",
    role: "Maintainer. A NiimBlue-based fork, adapted and rebranded.",
    about: [
      "Pressmark is a label designer and printer client. It works completely offline in the browser, stores labels locally, shows a print preview with several post-processing options, and prints over Bluetooth or USB.",
      "It also ships as standalone apps for desktop (Electron), Android (Capacitor) and Windows (Tauri). It is based on the open-source NiimBlue project and its NIIMBOT protocol library, and is MIT licensed.",
    ],
    pitchHeadline: "Labels without the account",
    pitchBody: "Design a label, preview how it will print, and print it. No sign-in and no data leaves the browser.",
    links: [
      { label: "GitHub", href: "https://github.com/FraterCCCLXIII/pressmark" },
      { label: "Upstream: NiimBlue", href: "https://github.com/MultiMote/niimblue" },
    ],
    progress: [
      { label: "Browser editor and printing", note: "Working", status: "done" },
      { label: "Desktop, Android and Windows apps", note: "Included", status: "done" },
    ],
  },
  {
    slug: "page",
    group: "tools",
    name: "Page",
    tagline: "A calm, private, text-first Android launcher.",
    description: "Replaces the home screen with a quiet list of actions and one search field. No network permission, no ads, no tracking.",
    logoSrc: "/projects/page/logo.svg",
    role: "Creator. Android app and design.",
    about: [
      "Page is a launcher, not a custom ROM: install it like any app and set it as your home screen. The home screen asks one question, what do you need, and offers a short list of actions plus a search and command field. Type is large, icons are off by default, and the theme is a quiet monochrome.",
      "It is built to be audited quickly. The manifest has no internet permission, there is no telemetry or Google Play Services dependency, and settings stay on the device. It is licensed GPL v3.",
    ],
    pitchHeadline: "A phone that asks one question",
    pitchBody: "Page is an early build. The launcher, app search, default actions and settings shortcuts work today.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/Page" }],
    progress: [
      { label: "Launcher, search, actions, settings", note: "v0.1.0", status: "done" },
      { label: "Light Phone style app set", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "kosmica",
    group: "games",
    name: "Kosmica",
    tagline: "A game in development, with a pre-launch waitlist.",
    description: "Sign up for news and early access, with parent sign-up for younger players and referral ranks for invites.",
    logoSrc: "/projects/kosmica/logo.svg",
    role: "Creator.",
    about: [
      "Kosmica is a game in development. Its pre-launch site collects a waitlist with double opt-in email, so only confirmed addresses count.",
      "Players who could be under 16 are switched to a parent or guardian sign-up for the rest of their visit. Confirmed players get an invite link and a rank that grows with referrals: Deckhand, Navigator, Captain, Admiral. Sign-ups are stored on our own server in the EU.",
    ],
    pitchHeadline: "Get in line early",
    pitchBody: "The waitlist site is built and runs on our own server. More about the game will be shared here as it is ready.",
    links: [],
    progress: [
      { label: "Pre-launch waitlist site", note: "Built", status: "done" },
      { label: "Game", note: "In development", status: "active" },
    ],
  },
  {
    slug: "formscaler",
    group: "business",
    name: "Formscaler",
    tagline: "Model anything. Let AI help. Stay in control.",
    description: "An open-core, AI-ready CMS for dynamic data: collections and permissions as data, published pages, and agents bound by the same rules as editors.",
    logoSrc: "/projects/formscaler/logo.svg",
    role: "Creator. Product, marketing site and demo.",
    about: [
      "Formscaler lets you define collections and permissions as data, publish pages from them, and let agents work through the same rules your editors use.",
      "It is open core. The marketing site has an interactive demo and a brand page; pricing and limits on the site are still placeholders.",
    ],
    pitchHeadline: "Agents that follow the same rules",
    pitchBody: "Try the interactive demo on the product site.",
    links: [{ label: "Website", href: "https://formscaler-website.vercel.app" }],
    progress: [
      { label: "Marketing site and demo", note: "Live", status: "done" },
      { label: "Product", note: "In development", status: "active" },
    ],
  },
  {
    slug: "longformer",
    group: "language",
    name: "Longformer",
    tagline: "From long-form audio to a book plan.",
    description: "Add podcast episodes, video, text and documents as sources, get a chapter plan, and edit it.",
    logoSrc: "/projects/longformer/logo.svg",
    role: "Creator. Product design and front end.",
    about: [
      "Longformer is a book planner. You add sources, such as audio, video, text and documents or the episodes of a podcast feed, and it proposes a chapter outline: a title, a summary and the sources each chapter draws on.",
      "Today it is a working front end on a mock backend. The upload, feed import and chapter screens exist; transcription, AI planning and export to DOCX, EPUB, PDF and Markdown are designed but not built.",
    ],
    pitchHeadline: "Plan the book your episodes already contain",
    pitchBody: "Open the prototype to walk through the screens with sample data.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/longformer" }],
    progress: [
      { label: "Source upload, feed import, chapter plan screens", note: "Prototype", status: "active" },
      { label: "Transcription and AI planning", note: "Planned", status: "planned" },
      { label: "Export to DOCX, EPUB, PDF, Markdown", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "podbook",
    group: "language",
    name: "Podbook",
    tagline: "Turn any RSS feed into a professionally formatted book.",
    description: "AI-powered conversion of feeds and podcasts into books for offline reading and curation.",
    logoSrc: "/projects/podbook/logo.svg",
    logoPad: true,
    role: "Product/engineering at Fathom Labs.",
    about: [
      "Podbook turns an RSS feed into a book. The idea is to transform a podcast or blog into something you can read offline and keep, with the structure and formatting of a real book instead of a pile of posts.",
      "The web app has user accounts, projects and a full API behind a React front end, and a separate landing site. Feed processing, AI content generation and export to PDF and EPUB are still to be built, so treat it as a work in progress.",
    ],
    pitchHeadline: "From feed to book",
    pitchBody: "Longformer is a related book planner built on the same idea.",
    links: [
      { label: "Web app on GitHub", href: "https://github.com/Fathom-labs/podbook-web" },
      { label: "Landing site on GitHub", href: "https://github.com/Fathom-labs/podbook-landing" },
    ],
    progress: [
      { label: "Accounts, projects and API", note: "Built", status: "done" },
      { label: "Feed processing and AI generation", note: "In progress", status: "active" },
      { label: "Book export", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "caret",
    group: "creative",
    name: "Caret",
    tagline: "A Notion-style Markdown and RTF editor with AI writing help, inside VS Code.",
    description: "Rich text editing for .md and .rtf files, with inline AI, footnotes and review comments.",
    logoSrc: "/projects/caret/logo.png",
    role: "Creator. Editor extension and the Caret build of VS Code.",
    about: [
      "Caret is a custom editor for Markdown and RTF files, built on TipTap. It gives you a Notion-style document view instead of raw markup, with footnotes and review comments kept in a side panel, not in the file.",
      "Write Next continues your text at the cursor in the style of the surrounding passage. It can read other files in the workspace, such as outlines, research notes or chapter drafts, before it writes. It runs on whichever language model VS Code offers, such as GitHub Copilot.",
    ],
    pitchHeadline: "Write next, with your notes open",
    pitchBody: "Press Cmd+Return at the cursor, and Caret continues from what you have written, using the files in your workspace.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/vscode-writer" }],
    progress: [
      { label: "Rich editor, comments, footnotes", note: "Working", status: "done" },
      { label: "Write Next with workspace context", note: "Working", status: "done" },
    ],
  },
  {
    slug: "kamiji",
    group: "creative",
    name: "Kamiji",
    tagline: "A rigged, expressive 3D hand avatar, plus the characters and tools around it.",
    description: "A three.js hand avatar for React with faces, poses and motions, a character Studio and the Kamikin cast.",
    logoSrc: "/projects/kamiji/logo.png",
    role: "Creator. Rig, characters, library and tools.",
    about: [
      "Kamiji gives each agent or character a tinted, animated hand with a morph-target face: expressions, poses, whole-hand motions, emotes and status icons. One shared WebGL renderer draws many avatars on a page, with a flat SVG fallback.",
      "Around the hand sit the Studio character creator, the Kamikin and Rubbernose casts, a voice lab and a subtitles playground. All of them run here in the browser.",
    ],
    pitchHeadline: "Give your agent a hand",
    pitchBody: "Open the Studio to build a character, or the workshop to try poses and expressions.",
    links: [],
    progress: [
      { label: "Hand rig, poses and motions", note: "Done", status: "done" },
      { label: "Studio character creator", note: "Prototype", status: "active" },
      { label: "Embeddable JS library on this site", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "templeos",
    href: "/templeos",
    group: "systems",
    name: "TempleOS desktop",
    tagline: "A HolyC desktop with its own browser, apps and a host bridge.",
    description: "Plans, specs and status for rebuilding a modern desktop and browser inside TempleOS.",
    logoSrc: "/projects/templeos/logo.svg",
    role: "Author. Architecture, HolyC apps and host services.",
    about: [
      "The TempleOS desktop project explores how far a HolyC system can go as a daily desktop: a browser, mail, contacts, a dev box and ports of existing apps, with a host hub that does the work TempleOS cannot.",
      "The documentation site collects the plans, feasibility studies and specs in one place.",
    ],
    pitchHeadline: "A modern desktop in HolyC",
    pitchBody: "Read the browser architecture, the app plans and the dev box study.",
    links: [{ label: "Docs", href: "/templeos" }, { label: "GitHub", href: "https://github.com/Modern-Telepathy/templeos" }],
    progress: [
      { label: "Desktop shell and host hub", note: "Active", status: "active" },
      { label: "Browser v0", note: "In progress", status: "active" },
    ],
  },
  {
    slug: "keybox",
    group: "systems",
    name: "Keybox",
    tagline: "Seal a secret. The agent can spend it. The model never reads it.",
    description:
      "A vault for Cursor, VS Code, Claude, and Codex. Highlight a key, send a handle, and the agent spends it without seeing the value.",
    logoSrc: "/projects/keybox/logo.svg",
    imageSrc: "/projects/keybox/image.png",
    role: "Creator. Vault, host installers, and the public site.",
    about: [
      "Keybox replaces a pasted key with a handle such as «kb:openai». The agent calls the API through that handle. There is no tool that returns the value.",
      "Cursor, Claude Code, and Codex block a raw key on send. VS Code and Claude Desktop use the same vault and MCP server, and you seal before you send. One install covers every host.",
    ],
    pitchHeadline: "Spend the handle, not the key",
    pitchBody:
      "The site and the download are hosted on Vercel. The case study lives here. The source is on GitHub.",
    links: [
      { label: "Site", href: "https://keybox-cyan.vercel.app" },
      { label: "GitHub", href: "https://github.com/Modern-Telepathy/keybox" },
    ],
    progress: [
      { label: "Vault, MCP, and host installers", note: "0.1.0", status: "done" },
      { label: "Public site on Vercel", note: "Live", status: "done" },
    ],
  },
  {
    slug: "kosmos",
    group: "systems",
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
    group: "business",
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
    group: "business",
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
    group: "creative",
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
    logoPad: true,
    group: "language",
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
    group: "creative",
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
    logoPad: true,
    group: "business",
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
    group: "knowledge",
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
    logoPad: true,
    group: "knowledge",
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
    group: "knowledge",
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
    group: "language",
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
    group: "knowledge",
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
    group: "language",
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
    group: "language",
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

export const projectsInGroup = (id: GroupId) => projects.filter((p) => p.group === id);
export const projectHref = (p: Project) => p.href ?? `/projects/${p.slug}`;
