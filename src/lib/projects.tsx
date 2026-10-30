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
  /** "What it does": short titled blurbs shown as a grid. */
  features?: { title: string; body: string }[];
  /** Extra images under the pitch. */
  gallery?: { src: string; alt: string; caption?: string }[];
  /** "At a glance" facts for the sidebar. */
  facts?: { label: string; value: string }[];
};

export const projects: Project[] = [
  {
    slug: "glyphlings",
    href: "/glyphlings",
    group: "creative",
    name: "Glyphlings",
    tagline: "Nine Greek letters with eyes in their empty spaces.",
    description: "A character set made from Courier New Regular capitals, each given eyes in its counters.",
    logoSrc: "/glyphlings/omega-tile.svg",
    role: "Creator.",
    about: ["Glyphlings turn the Greek capitals into small characters by setting eyes into the empty spaces of each letter."],
    pitchHeadline: "Letters that look back",
    pitchBody: "Open the character page to meet all nine.",
    links: [],
    progress: [{ label: "Nine characters as SVG", note: "Done", status: "done" }],
  },
  {
    slug: "sutraya",
    group: "knowledge",
    name: "Sutraya",
    tagline: "Search ancient texts, then read them in layers.",
    description: "A search-first library and layered reader where the original, its translation and notes sit side by side, and answers come with checkable quotes.",
    logoSrc: "/projects/sutraya/logo.svg",
    imageSrc: "/projects/sutraya/preview.webp",
    role: "Creator.",
    about: [
      "Sutraya is a library for ancient texts. You search first, then open a work in a reader that shows the original text, a transliteration and a translation in aligned layers, with commentary, parallels and footnotes beside them.",
      "Ask answers questions from the library with citations you can follow back to the passage, and checks its own quotes before it shows them. The first corpus is a curated set of Pali root texts from SuttaCentral with Bhikkhu Sujato's English translations, both recorded as CC0. Every text keeps its source and licence on record.",
    ],
    pitchHeadline: "Read the text, not just the answer",
    pitchBody: "Open the demo page to see how the layered reader is organised. The app runs today as a working prototype.",
    links: [],
    features: [
      { title: "Search first", body: "Search runs on PostgreSQL with diacritic-insensitive matching, so results work whether or not you type the marks." },
      { title: "A layered reader", body: "Read the original, a transliteration and a translation together, stacked or in parallel, with notes, parallels and footnote panels." },
      { title: "Ask, with checks", body: "Ask a question and get an answer with citations that link to the passage. Quotes are checked against the text and citations against what was retrieved, then shown with a trust badge." },
      { title: "Provenance for every text", body: "Each text records its source, licence, attribution and import date. The layers of a passage share segment IDs, so they stay aligned." },
      { title: "Translate and OCR", body: "A translation helper with an AI drafting dialog, and an OCR page that sends PDFs or images to Dharmamitra's MITRA OCR." },
      { title: "An MCP server", body: "Tools to search the corpus, read a passage, fetch parallels and resolve a stable sutraya: URN, so other agents can use the library." },
    ],
    gallery: [
      { src: "/projects/sutraya/g1.webp", alt: "What the prototype includes: library, reader, parallels, Ask, translate and OCR", caption: "The Sutraya page" },
      { src: "/projects/sutraya/g2.webp", alt: "The layered reader", caption: "Illustrative mock, not a screenshot" },
    ],
    facts: [
      { label: "Status", value: "Working prototype" },
      { label: "Runs", value: "On a laptop with Docker, or hosted" },
      { label: "First corpus", value: "SuttaCentral Pali and English (CC0)" },
      { label: "Stack", value: "Next.js, TypeScript, PostgreSQL, Drizzle" },
      { label: "Source", value: "Private repository" },
    ],
    progress: [
      { label: "Library, layered reader and search", note: "Prototype", status: "active" },
      { label: "Ask with citation checks", note: "Prototype", status: "active" },
      { label: "Public launch", note: "Planned", status: "planned" },
    ],
  },
  {
    slug: "yakopop",
    group: "language",
    name: "Yakopop",
    tagline: "Word-synced, colour-coded bilingual subtitles for language learners.",
    description: "Every word shows its script, reading, meaning and grammar, and lights up with its translation while the video plays.",
    logoSrc: "/projects/yakopop/logo.png",
    imageSrc: "/projects/yakopop/preview.webp",
    role: "Creator. Product, learning player, creator studio and translation pipeline.",
    about: [
      "Yakopop turns a video into a lesson. Each word carries its original script, reading, transliteration, meaning and grammar, and it lights up together with the part of the translation it matches while the video plays.",
      "Learners can hover for dictionary cards and audio, cut short clips into a personal library, and publish them to Reels. Creators import YouTube videos, playlists or whole channels in a Studio and choose languages, layers and level. Lessons cover Japanese, Mandarin, Korean, Russian, Spanish, Hindi, Nepali, Thai and Tibetan, with translations into 12 languages and a 12-language interface.",
    ],
    pitchHeadline: "Learn from the video you already want to watch",
    pitchBody: "Pick a video, read along word by word, and keep the clips you want to remember.",
    links: [{ label: "Website", href: "https://yakopop.com" }],
    features: [
      { title: "Layers you can read at a glance", body: "Each word is stacked with its script, reading, romanization, meaning and grammar, colour-linked to the part of the translation it matches." },
      { title: "Tap any word", body: "Hover or tap for a word card with the dictionary entry and audio, and play that single word from the video." },
      { title: "Practice that sticks", body: "Every video comes with a five-minute quiz built from its own words, with hearts, XP and streaks, and a word list to keep." },
      { title: "Clips and Reels", body: "Cut a 2 second to 3 minute clip with a word-snapped trimmer, loop it, keep it in a personal library and publish it to Reels." },
      { title: "A Studio for creators", body: "Import YouTube videos, playlists or whole channels and choose languages, caption source, annotator, level, style and glossary before publishing." },
      { title: "Nine languages, twelve translations", body: "Videos in Japanese, Mandarin, Korean, Russian, Spanish, Hindi, Nepali, Thai and Tibetan, translated into 12 languages, with a 12-language interface." },
    ],
    gallery: [
      { src: "/projects/yakopop/g1.webp", alt: "Tap any word: a word card with its reading, meaning and audio", caption: "Screenshot of yakopop.com" },
      { src: "/projects/yakopop/g2.webp", alt: "Practice: a quiz built from the words in a video", caption: "Screenshot of yakopop.com" },
    ],
    facts: [
      { label: "Status", value: "Live, free in beta" },
      { label: "Where", value: "Web, plus a browser extension for Netflix and YouTube" },
      { label: "Video languages", value: "9" },
      { label: "Interface languages", value: "12" },
      { label: "Source", value: "Private repository" },
    ],
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
    imageSrc: "/projects/arco/preview.webp",
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
    features: [
      { title: "Typed cards, not walls of text", body: "An agent picks typed cards from a fixed vocabulary, and Arco draws them themed and consistent." },
      { title: "Nine block types", body: "Task lists, stats, calendars, weather and more. Each type has its own schema in the card prototype." },
      { title: "Live demo", body: "Pick a prompt and watch the agent reply and the cards stream into the feed one by one. It is scripted: nothing is sent over the network." },
      { title: "Design tokens", body: "Light and dark surfaces and a single accent, so a generated screen looks like the rest of the system." },
      { title: "Documentation", body: "The library has its own docs site with guides and a reference." },
    ],
    gallery: [
      { src: "/projects/arco/g1.webp", alt: "The scripted demo: a plan arrives as a checklist, a calendar and more cards", caption: "The Arco demo page, with made-up content" },
      { src: "/projects/arco/g2.webp", alt: "Card types drawn from the same renderer", caption: "The Arco demo page" },
      { src: "/projects/arco/g4.webp", alt: "The Kosmos documentation site", caption: "docs.kosmos.computer" },
    ],
    facts: [
      { label: "Part of", value: "Kosmos" },
      { label: "Docs", value: "docs.kosmos.computer" },
      { label: "Status", value: "Prototype, with public docs" },
      { label: "Source", value: "Open repository" },
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
    imageSrc: "/projects/kosmos-engine/preview.webp",
    role: "Creator. Engine architecture, SDK and tooling.",
    about: [
      "The Kosmos Reality Engine is written in Rust and runs headless for replay and testing as well as in a window, so a scene can be stepped, snapshotted and compared by state hash. It is the engine behind the Kosmos experiments.",
      "The Kosmos SDK is a separate, MIT-licensed TypeScript client. It connects scripts and apps to a Kosmos environment (a local desktop, a self-hosted server or a hosted tenant) for chat, streaming and tools.",
    ],
    pitchHeadline: "An engine you can replay",
    pitchBody: "The engine repository is private for now. The SDK is open, and the engine page here explains how it works.",
    links: [{ label: "SDK on GitHub", href: "https://github.com/Kosmos-computer/kosmos-sdk" }],
    features: [
      { title: "Replayable simulation", body: "A fixed 1/64 second tick, seeded random numbers, a state hash, snapshot, restore and replay. CI compares the hash of native builds with the wasm32 build." },
      { title: "A wgpu renderer", body: "Flat, toon and PBR looks, shadows, sky and clouds, grass, water, motion blur and an HDR tone map." },
      { title: "A headless protocol", body: "Typed JSON messages over stdio or WebSocket, a typed TypeScript client and an MCP server, so people and AI agents can build and test through the same commands." },
      { title: "An editor", body: "An egui editor in the native app with a scene tree, inspector, gizmos and undo." },
      { title: "Characters and faces", body: "An animation graph with 45 face channels, a face plate for heads without morph targets, and importers for glTF, FBX, OBJ and mochi." },
      { title: "The Kosmos SDK", body: "A separate MIT-licensed TypeScript client that connects scripts and apps to a Kosmos environment for chat, streaming and tools." },
    ],
    gallery: [
      { src: "/projects/kosmos-engine/g1.webp", alt: "Kamikin characters in the engine", caption: "Capture from the native app" },
      { src: "/projects/kosmos-engine/g2.webp", alt: "A Kosmica prototype running on the engine", caption: "Capture from the native app" },
      { src: "/projects/kosmos-engine/g3.webp", alt: "The editor beside a scene of cubes", caption: "Capture from the native app" },
      { src: "/projects/kosmos-engine/g4.webp", alt: "The Kosmos documentation site, for the platform the SDK talks to", caption: "docs.kosmos.computer" },
    ],
    facts: [
      { label: "Language", value: "Rust, edition 2024" },
      { label: "Renderer", value: "wgpu 30 (Metal, Vulkan, DX12, WebGPU)" },
      { label: "Size", value: "45 crates plus runner apps" },
      { label: "Runners", value: "Native window, headless CLI and MCP" },
      { label: "Licence", value: "MIT or Apache-2.0" },
      { label: "Started", value: "15 October 2026" },
      { label: "Source", value: "Private repository; SDK is open" },
    ],
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
    imageSrc: "/projects/relay/preview.webp",
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
    features: [
      { title: "Facts first", body: "Relay's truth layer is signed, content-addressed facts: identity, an append-only event log, state and attestations." },
      { title: "Deterministic views", body: "Feeds and lists are projections over those facts. Anyone who computes a view from the same inputs gets the same answer." },
      { title: "Self-sovereign identity", body: "In MESH an Ed25519 key is your identity, with device keys for multiple devices and optional social, custodial or hardware recovery." },
      { title: "Private by default", body: "MESH uses X25519 and AES-256-GCM for direct messages and groups." },
      { title: "Composable moderation", body: "Third parties publish attestations, and each person chooses whose to trust." },
      { title: "A working reference", body: "MESH has a Python implementation on SQLite or PostgreSQL, and the repository reports its own benchmarks." },
    ],
    facts: [
      { label: "Relay", value: "Stack spec, drafts v1.0 to v2" },
      { label: "MESH", value: "Spec v1.1 with a Python implementation" },
      { label: "Compared with", value: "Nostr, ActivityPub, SSB, AT Protocol" },
      { label: "Source", value: "Open repositories" },
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
    imageSrc: "/projects/pressmark/preview.webp",
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
    features: [
      { title: "Private and offline", body: "The app works completely in the browser and stores labels there. It sends nothing except downloading the app files." },
      { title: "Bluetooth and USB", body: "Connect a NIIMBOT printer either way." },
      { title: "A real label editor", body: "Design labels, save, import and export them, and check a print preview with several post-processing options such as threshold and dithering." },
      { title: "Batch and templates", body: "Print many labels from a table of data with variables, and use date templates in label text." },
      { title: "Runs everywhere", body: "Browser, desktop (Electron), Android (Capacitor) and Windows (Tauri, Edge-backed)." },
      { title: "The NIIMBOT protocol", body: "It uses NiimBlueLib for printer communication, a very complete implementation of the protocol." },
    ],
    gallery: [
      { src: "/projects/pressmark/g1.webp", alt: "Saving and loading labels in browser storage", caption: "Screenshot from the repository" },
      { src: "/projects/pressmark/g2.webp", alt: "Date templates in label text", caption: "Screenshot from the repository" },
      { src: "/projects/pressmark/g3.webp", alt: "Label size, density and layout settings", caption: "Screenshot from the repository" },
    ],
    facts: [
      { label: "Platforms", value: "Browser, desktop, Android, Windows" },
      { label: "Printers", value: "NIIMBOT, over Bluetooth or USB" },
      { label: "Licence", value: "MIT" },
      { label: "Based on", value: "NiimBlue" },
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
    imageSrc: "/projects/page/preview.webp",
    role: "Creator. Android app and design.",
    about: [
      "Page is a launcher, not a custom ROM: install it like any app and set it as your home screen. The home screen asks one question, what do you need, and offers a short list of actions plus a search and command field. Type is large, icons are off by default, and the theme is a quiet monochrome.",
      "It is built to be audited quickly. The manifest has no internet permission, there is no telemetry or Google Play Services dependency, and settings stay on the device. It is licensed GPL v3.",
    ],
    pitchHeadline: "A phone that asks one question",
    pitchBody: "Page is an early build. The launcher, app search, default actions and settings shortcuts work today.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/Page" }],
    features: [
      { title: "Text first", body: "Large type, an alphabetical app list and no icons by default. The home screen asks one question." },
      { title: "Actions, not grids", body: "Phone, Messages, Maps, Books, Notes, Music, Camera, Calendar, Files and Settings each open your chosen companion app." },
      { title: "A search and command bar", body: "Find an app or type a simple command." },
      { title: "Safe fallbacks", body: "If your preferred app is missing, Page falls back to a generic Android intent, and says so if nothing can handle the action." },
      { title: "Private by construction", body: "No internet permission, no analytics or ads, no Google Play Services, and settings stay on the device." },
      { title: "Bring your own apps", body: "A script sets up Page and companion apps over ADB from F-Droid and GitHub releases. An in-app first-run setup is planned." },
    ],
    facts: [
      { label: "Version", value: "0.1.0, early MVP" },
      { label: "Android", value: "10 and up (API 29), built for 35" },
      { label: "Permissions", value: "None for the network" },
      { label: "Licence", value: "GPL v3" },
    ],
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
    imageSrc: "/projects/kosmica/preview.webp",
    role: "Creator.",
    about: [
      "Kosmica is a game in development. Its pre-launch site collects a waitlist with double opt-in email, so only confirmed addresses count.",
      "Players who could be under 16 are switched to a parent or guardian sign-up for the rest of their visit. Confirmed players get an invite link and a rank that grows with referrals: Deckhand, Navigator, Captain, Admiral. Sign-ups are stored on our own server in the EU.",
    ],
    pitchHeadline: "Get in line early",
    pitchBody: "The waitlist site is built and runs on our own server. More about the game will be shared here as it is ready.",
    links: [],
    features: [
      { title: "Wake worlds", body: "Find the old names, restore the land, and watch colour roll back across a planet." },
      { title: "Sail the sky, then space", body: "Build and fly airships, trim sails against the wind, then climb out of the atmosphere." },
      { title: "Pilot mechs", body: "Take the helm of walkers and striders built for the hardest worlds." },
      { title: "Befriend creatures", body: "Log every creature in your Kosmodex and raise a companion." },
      { title: "Talk to anyone", body: "Characters answer in their own voices, and many quests are won with words." },
      { title: "Fight when you must", body: "Turn-based battles, sword action and arena duels, with enemies who can be talked down." },
    ],
    gallery: [
      { src: "/projects/kosmica/g1.webp", alt: "A Kosmica prototype running in the Kosmos engine", caption: "Capture from the native app, not a final build" },
    ],
    facts: [
      { label: "Status", value: "In development; rating pending" },
      { label: "Waitlist", value: "Site built; not yet live" },
      { label: "Engine", value: "Kosmos engine" },
      { label: "Privacy", value: "Confirmed emails only, stored in the EU" },
    ],
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
    imageSrc: "/projects/formscaler/preview.webp",
    role: "Creator. Product, marketing site and demo.",
    about: [
      "Formscaler lets you define collections and permissions as data, publish pages from them, and let agents work through the same rules your editors use.",
      "It is open core. The marketing site has an interactive demo and a brand page; pricing and limits on the site are still placeholders.",
    ],
    pitchHeadline: "Agents that follow the same rules",
    pitchBody: "Try the interactive demo on the product site.",
    links: [{ label: "Website", href: "https://formscaler-website.vercel.app" }],
    features: [
      { title: "Collections and fields", body: "Define your own content types with field types, validation and relations. Shipped." },
      { title: "Schema versioning", body: "Every schema change is diffed. Shipped." },
      { title: "Generated admin", body: "An editing screen generated from your schema. Planned." },
      { title: "Agents under the same rules", body: "AI agents work through the same permissions as your editors." },
      { title: "Open core", body: "Self-host the free core, or start a 14-day Team trial with no credit card." },
      { title: "Honest status", body: "Every capability on the site is tagged shipped or planned." },
    ],
    gallery: [
      { src: "/projects/formscaler/g1.webp", alt: "The interactive demo: a dashboard with an AI assistant proposing a change", caption: "Screenshot of formscaler-website.vercel.app" },
      { src: "/projects/formscaler/g2.webp", alt: "The features page, with each capability tagged shipped or planned", caption: "Screenshot of formscaler-website.vercel.app" },
    ],
    facts: [
      { label: "Status", value: "Early access" },
      { label: "Model", value: "Open core" },
      { label: "Trial", value: "14-day Team trial" },
      { label: "Source", value: "Private repository" },
    ],
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
    imageSrc: "/projects/longformer/preview.webp",
    role: "Creator. Product design and front end.",
    about: [
      "Longformer is a book planner. You add sources, such as audio, video, text and documents or the episodes of a podcast feed, and it proposes a chapter outline: a title, a summary and the sources each chapter draws on.",
      "Today it is a working front end on a mock backend. The upload, feed import and chapter screens exist; transcription, AI planning and export to DOCX, EPUB, PDF and Markdown are designed but not built.",
    ],
    pitchHeadline: "Plan the book your episodes already contain",
    pitchBody: "Open the prototype to walk through the screens with sample data.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/longformer" }],
    features: [
      { title: "Upload or import", body: "Drop audio, video, text or documents, or paste a podcast RSS feed and pick episodes. The screens exist; the server side is simulated." },
      { title: "Plan chapters", body: "The planner turns the chosen sources into chapters, each with a title, a summary and the sources it draws on. The mock returns the same three chapters every time." },
      { title: "Edit the plan", body: "The planner store can rename, add, remove and reorder chapters. There is no editing screen yet." },
      { title: "Export", body: "The data model knows DOCX, EPUB, PDF and Markdown. Nothing builds a file yet." },
      { title: "Transcription and AI", body: "Planned. No transcription or AI code exists in the repository yet." },
    ],
    gallery: [
      { src: "/projects/longformer/g1.webp", alt: "How it works: four steps, each marked prototype or planned", caption: "The Longformer page" },
      { src: "/projects/longformer/g2.webp", alt: "What the app offers, with honest status badges", caption: "The Longformer page" },
    ],
    facts: [
      { label: "Status", value: "Early prototype on a mock backend" },
      { label: "Stack", value: "Nuxt" },
      { label: "Inside it is called", value: "Podbook" },
      { label: "Source", value: "Open repository" },
    ],
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
    imageSrc: "/projects/podbook/preview.webp",
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
    features: [
      { title: "RSS in, book out", body: "Point it at a feed and get a formatted book for offline reading." },
      { title: "Projects and accounts", body: "Sign up, log in and manage book projects. Done." },
      { title: "A real backend", body: "An Express server with PostgreSQL and a REST API for users, projects, content and AI processing." },
      { title: "AI formatting", body: "Content extraction and AI-generated book structure. In progress." },
      { title: "Export", body: "PDF, EPUB and more. Planned." },
      { title: "Billing", body: "Subscriptions and usage limits. Planned." },
    ],
    facts: [
      { label: "Stack", value: "React, Express, PostgreSQL, Prisma, Docker" },
      { label: "From", value: "Fathom Labs" },
      { label: "Status", value: "Work in progress" },
      { label: "Related", value: "Longformer" },
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
    imageSrc: "/projects/caret/preview.webp",
    role: "Creator. Editor extension and the Caret build of VS Code.",
    about: [
      "Caret is a custom editor for Markdown and RTF files, built on TipTap. It gives you a Notion-style document view instead of raw markup, with footnotes and review comments kept in a side panel, not in the file.",
      "Write Next continues your text at the cursor in the style of the surrounding passage. It can read other files in the workspace, such as outlines, research notes or chapter drafts, before it writes. It runs on whichever language model VS Code offers, such as GitHub Copilot.",
    ],
    pitchHeadline: "Write next, with your notes open",
    pitchBody: "Press Cmd+Return at the cursor, and Caret continues from what you have written, using the files in your workspace.",
    links: [{ label: "GitHub", href: "https://github.com/FraterCCCLXIII/vscode-writer" }],
    features: [
      { title: "A document, not markup", body: "Edit .md and .rtf files in a Notion-style view built on TipTap, with tables, task lists and images." },
      { title: "Write Next", body: "Press Cmd+Return, or click the Write button that appears when the cursor rests, and Caret continues in the style and tone of the passage." },
      { title: "Reads your workspace", body: "Before writing it can open outlines, research notes or chapter drafts from your workspace, and search them for facts." },
      { title: "Review comments", body: "Comments sit in a side panel, not in the file, and an agent in Chat can add one to your selection." },
      { title: "Footnotes", body: "Insert footnotes from the editor or from an agent." },
      { title: "Your model", body: "It uses whichever language model VS Code offers, such as GitHub Copilot." },
    ],
    facts: [
      { label: "Works in", value: "VS Code (custom editor)" },
      { label: "Files", value: "Markdown and RTF" },
      { label: "Version", value: "1.0.0" },
      { label: "Licence", value: "MIT" },
    ],
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
