// Shared top header for the main pages: Kamiji, Kamikin, Hands and Kosmos. One file, one list, so a new page is one entry.
// Pages load it with <script type="module" src="shared-header.js"> (or ../shared-header.js from a subfolder).
// Google Analytics 4 (same property as the main site). Live domain only, so localhost and previews do not count.
(function () {
  const h = location.hostname;
  if (h !== "moderntelepathy.com" && h !== "www.moderntelepathy.com") return;
  if (window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-TNW89MKZKG";
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-TNW89MKZKG");
})();

const base = new URL(".", import.meta.url).href; // .../site/
const KAMIJI_PAGES = [
  { id: "kamiji", label: "Kamiji", href: "index.html", match: /\/site\/(index\.html)?$/ },
  { id: "kamikin", label: "Kamikin", href: "kamikin/index.html", match: /\/site\/kamikin\// },
  { id: "hands", label: "Hands", href: "hands/index.html", match: /\/site\/hands\// },
  { id: "kosmos", label: "Kosmos", href: "kosmos/index.html", match: /\/site\/kosmos\// },
  { id: "arco", label: "Arco", href: "arco/index.html", match: /\/site\/arco\// },
  { id: "castbook", label: "Castbook", href: "castbook/index.html", match: /\/site\/castbook\// },
  { id: "yakopop", label: "Yakopop", href: "yakopop/index.html", match: /\/site\/yakopop\// },
  { id: "longformer", label: "Longformer", href: "longformer/index.html", match: /\/site\/longformer\// },
  { id: "computer", label: "Computer", href: "kosmos-computer/index.html", match: /\/site\/kosmos-computer\// },
];
// On the TempleOS website (/labs/templeos/site/) the second row links within that product instead of the Kamiji family.
const TEMPLEOS_PAGES = [
  { id: "templeos", label: "TempleOS desktop", href: "/templeos", match: /^\/templeos\/?$/ },
  { id: "website", label: "Website", href: "/labs/templeos/site/", match: /\/labs\/templeos\/site\// },
  { id: "docs", label: "Docs", href: "/labs/templeos/docs/", match: /\/labs\/templeos\/docs\// },
];
const PAGES = location.pathname.indexOf("/labs/templeos/site") === 0 ? TEMPLEOS_PAGES : KAMIJI_PAGES;

// Modern Telepathy: the parent site. Keep in step with SiteHeader in src/components/site-chrome.tsx.
const MT = [
  { label: "Products", href: "/" },
  { label: "Labs", href: "/labs" },
  { label: "Thesis", href: "/thesis" },
  { label: "Contact", href: "/contact" },
];
const ELSEWHERE = [
  { label: "yakopop.com", href: "https://yakopop.com" },
];

// PROJECTS: the one list behind the "All products" mega-menu. Edit here. status: available | prototype | planned | unverified.
// g = tiny monochrome glyph (24x24 stroke paths, our own neutral marks). group: "family" or "more".
const PROJECTS = [
  { group: "family", name: "Kamiji", note: "Rigged 3D hand avatars and the characters around them.", status: "available", href: "index.html", g: "M12 4a8 8 0 100 16 8 8 0 000-16zM9 10v1M15 10v1M9 15c1.5 1.2 4.5 1.2 6 0" },
  { group: "family", name: "Kamikin", note: "Mochi friends who teach Japanese words, with Yakopop subtitles.", status: "available", href: "kamikin/index.html", g: "M7 19V9a5 5 0 0110 0v10M7 14h10M10 9v1M14 9v1" },
  { group: "family", name: "Hands", note: "The rigged 3D hand avatar library: poses, faces and accessories.", status: "available", href: "hands/index.html", g: "M8 20v-8M11 20V7M14 20V9M17 20v-6M8 12l-2-2M17 14l2-1" },
  { group: "family", name: "Kosmos engine", note: "The 3D engine behind the family.", status: "available", href: "kosmos/index.html", g: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9" },
  { group: "family", name: "Computer", note: "Kosmos Computer: a small desktop to try ideas on.", status: "available", href: "kosmos-computer/index.html", g: "M4 5h16v11H4zM9 20h6M12 16v4" },
  { group: "family", name: "Castbook", note: "Casting and actor management with voices and recordings.", status: "available", href: "castbook/index.html", g: "M6 4h11a1 1 0 011 1v15H7a1 1 0 01-1-1zM9 8h6M9 12h6" },
  { group: "family", name: "Arco UI", note: "Generative UI cards and a component library.", status: "available", href: "arco/index.html", g: "M4 20v-7a8 8 0 0116 0v7M9 20v-6a3 3 0 016 0v6" },
  { group: "family", name: "Yakopop", note: "Word-synced subtitles for language learning.", status: "available", href: "yakopop/index.html", g: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" },
  { group: "family", name: "Longformer", note: "A book planner for turning podcasts, video and text into books.", status: "available", href: "longformer/index.html", g: "M5 6h14M5 10h14M5 14h14M5 18h9" },
  { group: "more", name: "Kamae: Path of the Blade", note: "Browser fencing duel game with rules, multiplayer, replays and an AI opponent.", status: "prototype", href: "kamae/index.html", g: "M5 19L17 7M14 4l6 6M4 20l3-1-2-2z" },
  { group: "more", name: "Newsphere", note: "Desktop feed reader (Tauri) with a column grid, reader view and an optional bring-your-own-key assistant.", status: "prototype", href: "newsphere/index.html", g: "M4 5h16v14H4zM9 5v14M15 5v14M4 12h16" },
  { group: "more", name: "Sutraya", note: "Search-first library and layered reader for ancient texts.", status: "prototype", href: "sutraya/index.html", g: "M4 6c3-1 6-1 8 1 2-2 5-2 8-1v12c-3-1-6-1-8 1-2-2-5-2-8-1z M12 7v12" },
  { group: "more", name: "Triunfi", note: "Open modular trading card game: cards as JSON, swappable rule modules, deterministic engine, AI-vs-AI simulation.", status: "prototype", href: "triunfi/index.html", g: "M8 4h8a1 1 0 011 1v14a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1zM12 9l2 3-2 3-2-3z" },
  { group: "more", name: "Sidekicks", note: "Control plane that deploys and manages agent runtimes like apps.", status: "prototype", href: "sidekicks/index.html", g: "M4 6h16v5H4zM4 13h16v5H4zM7 8.5h.01M7 15.5h.01" },
  { group: "more", name: "Kosmographica", note: "Claim-based, provenance-first knowledge graph for culture and history.", status: "prototype", href: "kosmographica/index.html", g: "M6 7a2 2 0 100-4 2 2 0 000 4zM18 12a2 2 0 100-4 2 2 0 000 4zM8 21a2 2 0 100-4 2 2 0 000 4zM7.5 6.5l9 4M16.5 11.5l-7 6" },
  { group: "more", name: "UI Experiments", note: "Gallery of UI components from the owner's workspace: chat pieces, app shells, cards, forms and full app views.", status: "prototype", href: "ui-experiments/index.html", g: "M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" },
  { group: "more", name: "Previs", note: "Story map, timeline and storyboard where every scene node renders live in 3D. Working prototype; no audio or export yet.", status: "prototype", href: "previs/index.html", g: "M3 5h8v6H3zM13 13h8v6h-8zM11 8h4a2 2 0 012 2v3M3 18h6M3 21h10" },
  { group: "more", name: "Studio", note: "Character creator: swap parts, morph sliders, colours and accessories across human, creature and Kamiji styles. Prototype; GLB export is partial.", status: "prototype", href: "studio/index.html", g: "M12 4a3 3 0 100 6 3 3 0 000-6zM6 20v-3a6 6 0 0112 0v3M3 12h2M19 12h2M12 1v2" },
];
// Modern Telepathy projects (src/lib/projects.tsx), generated; each opens its page on the parent site.
const MT_PROJECTS = [
 {
  "group": "mt-knowledge",
  "name": "Sutraya",
  "note": "A search-first library and layered reader where the original, its translation and notes sit side by side, and answers come with checkable quotes.",
  "status": "link",
  "href": "/projects/sutraya",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Yakopop",
  "note": "Every word shows its script, reading, meaning and grammar, and lights up with its translation while the video plays.",
  "status": "link",
  "href": "/projects/yakopop",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-systems",
  "name": "Arco",
  "note": "The generative UI library inside Kosmos, with a component library and public documentation.",
  "status": "link",
  "href": "/projects/arco",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-systems",
  "name": "Kosmos engine",
  "note": "The 3D and simulation engine behind the Kosmos family, plus the official TypeScript client for Kosmos servers.",
  "status": "link",
  "href": "/projects/kosmos-engine",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-knowledge",
  "name": "Relay and MESH",
  "note": "Relay is a stack spec of signed, content-addressed facts and deterministic views. MESH combines ideas from Nostr, ActivityPub, SSB and AT Protocol.",
  "status": "link",
  "href": "/projects/relay",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-tools",
  "name": "Pressmark",
  "note": "A label editor for NIIMBOT printers over Bluetooth or USB. Offline by default; your labels stay in your browser.",
  "status": "link",
  "href": "/projects/pressmark",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-tools",
  "name": "Page",
  "note": "Replaces the home screen with a quiet list of actions and one search field. No network permission, no ads, no tracking.",
  "status": "link",
  "href": "/projects/page",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-games",
  "name": "Kosmica",
  "note": "Sign up for news and early access, with parent sign-up for younger players and referral ranks for invites.",
  "status": "link",
  "href": "/projects/kosmica",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-business",
  "name": "Formscaler",
  "note": "An open-core, AI-ready CMS for dynamic data: collections and permissions as data, published pages, and agents bound by the same rules as editors.",
  "status": "link",
  "href": "/projects/formscaler",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Longformer",
  "note": "Add podcast episodes, video, text and documents as sources, get a chapter plan, and edit it.",
  "status": "link",
  "href": "/projects/longformer",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Podbook",
  "note": "AI-powered conversion of feeds and podcasts into books for offline reading and curation.",
  "status": "link",
  "href": "/projects/podbook",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-creative",
  "name": "Caret",
  "note": "Rich text editing for .md and .rtf files, with inline AI, footnotes and review comments.",
  "status": "link",
  "href": "/projects/caret",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-systems",
  "name": "TempleOS desktop",
  "note": "Plans, specs and status for rebuilding a modern desktop and browser inside TempleOS.",
  "status": "link",
  "href": "/templeos",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-systems",
  "name": "Keybox",
  "note": "A vault for Cursor, VS Code, Claude, and Codex. Highlight a key, send a handle, and the agent spends it without seeing the value.",
  "status": "link",
  "href": "/projects/keybox",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-systems",
  "name": "Kosmos",
  "note": "One shell for chat, code, files, and generated apps — agents and UI sharing a single session.",
  "status": "link",
  "href": "/projects/kosmos",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-business",
  "name": "DocTransit",
  "note": "Send, sign, and track agreements — with Agents API, MCP, CLI, and webhooks for AI-driven contract flows.",
  "status": "link",
  "href": "/projects/doctransit",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-business",
  "name": "NextPresser",
  "note": "Faust.js + WPGraphQL storefront with cart, checkout, auth, and multi-gateway payments.",
  "status": "link",
  "href": "/projects/nextpresser",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-creative",
  "name": "Prompt",
  "note": "Leave a text post — public or link-only — at a human-readable five-word URL.",
  "status": "link",
  "href": "/projects/prompt",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Newsphere",
  "note": "Desktop RSS/Atom reader with a column grid, focused reader, and optional on-device AI.",
  "status": "link",
  "href": "/projects/newsphere",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-creative",
  "name": "Castbook",
  "note": "Manage talent and productions — with public actor submissions and multilingual UI.",
  "status": "link",
  "href": "/projects/castflow",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-business",
  "name": "OpenBook",
  "note": "Modern booking for services and providers with public scheduling and staff tools.",
  "status": "link",
  "href": "/projects/openbook",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-knowledge",
  "name": "Kosmographica",
  "note": "Federated, citation-backed encyclopedia with trust-rated claims across religion and mythology.",
  "status": "link",
  "href": "/projects/kosmographica",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-knowledge",
  "name": "Holons",
  "note": "LMS where each Holon hosts courses, modules, members, and a social feed.",
  "status": "link",
  "href": "/projects/holons",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-knowledge",
  "name": "Public Search",
  "note": "Modern YaCy front end — no tracking, themeable UI, optional SearxNG.",
  "status": "link",
  "href": "/projects/public-search",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Public Translate",
  "note": "Speech-to-text, bilingual display, and TTS — built for temples, classrooms, and cast-to-TV.",
  "status": "link",
  "href": "/projects/public-translate",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-knowledge",
  "name": "Dharma Atlas",
  "note": "Interactive map and list of 5,600+ spiritual places with tradition filters.",
  "status": "link",
  "href": "/projects/dharma-atlas",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Podium",
  "note": "Podcast post-production that turns episodes into editable transcripts and shareable collateral.",
  "status": "link",
  "href": "/projects/podium",
  "g": "M5 12h14M13 6l6 6-6 6"
 },
 {
  "group": "mt-language",
  "name": "Fathom",
  "note": "The podcast pipeline behind diarized transcripts, vectors, and episode enrichment at fathom.fm.",
  "status": "link",
  "href": "/projects/fathom",
  "g": "M5 12h14M13 6l6 6-6 6"
 }
];
PROJECTS.push(...MT_PROJECTS);
const GROUPS = [
  { id: "family", label: "Kamiji family" },
  { id: "more", label: "More products" },
  { id: "mt-systems", label: "Kosmos & systems" },
  { id: "mt-creative", label: "Characters & creative" },
  { id: "mt-language", label: "Language, audio & reading" },
  { id: "mt-knowledge", label: "Knowledge & community" },
  { id: "mt-games", label: "Games" },
  { id: "mt-tools", label: "Everyday tools" },
  { id: "mt-business", label: "Business & web tools" },
];

const css = `
.sx { position: absolute; top: 0; left: 0; right: 0; z-index: 30; display: flex; flex-direction: column; align-items: stretch; background: var(--bg, #f0efe7); border-bottom: 1px solid var(--faint, rgba(31,42,34,.13)); }
.sx-in { width: 100%; max-width: none; margin: 0; padding: 0 var(--gutter, 24px); box-sizing: border-box; display: flex; align-items: center; gap: 6px 22px; }
.sx a { font: .66rem/1 var(--mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .16em; color: var(--muted, #5f665a); text-decoration: none; padding: 12px 0; white-space: nowrap; }
.sx a:hover, .sx a:focus-visible { color: var(--fg, #1f2a22); }
.sx a[aria-current="page"] { color: var(--fg, #1f2a22); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent, #1d1d1b); }
.sx-logo { display: block; height: 20px; width: auto; margin-right: 6px; }
.sx-turn { position: relative; flex: none; width: 56px; height: 20px; margin-right: 6px; perspective: 160px; }
.sx-wheel { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .8s cubic-bezier(.5, 0, .2, 1); }
.sx-face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-start; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.sx-face img { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; }
.sx-face:nth-child(1) { transform: rotateX(0deg) translateZ(10px); }
.sx-face:nth-child(2) { transform: rotateX(90deg) translateZ(10px); }
.sx-face:nth-child(3) { transform: rotateX(180deg) translateZ(10px); }
.sx-face:nth-child(4) { transform: rotateX(270deg) translateZ(10px); }
.sx .sx-brand { display: flex; align-items: center; margin-right: 10px; }
.sx-lead, .sx-end { display: flex; align-items: center; gap: 6px 22px; flex: none; }
.sx-mt { display: flex; align-items: center; gap: 6px 22px; }
.sx-dark .sx-turn img { filter: invert(1); }
@media (prefers-reduced-motion: reduce) { .sx-wheel { transition: none; } }
.sx-sp { flex: 1; }
.sx-links { display: flex; align-items: center; gap: 6px 22px; justify-self: center; }
@media (max-width: 1099px) { .sx-in { overflow-x: auto; scrollbar-width: none; } .sx-in::-webkit-scrollbar { display: none; } }
.sx-ext::after { content: " \\2197"; opacity: .6; }
body { padding-top: 76px; }
.site-header { top: 76px; }
.sx-in { height: 40px; justify-content: space-between; }
.sx-sub { height: 36px; border-top: 1px solid var(--faint, rgba(31,42,34,.13)); }
.sx-sub .sx-in { height: 36px; justify-content: flex-start; }
.sx-sub .sx-ext { margin-left: auto; }
.sx-badge[data-s="link"] { opacity: .8; }
.sx-dark .sx { background: #0d0d0f; border-bottom-color: rgba(255,255,255,.09); }
.sx-dark .sx a { color: #a8a8ae; }
.sx-dark .sx a:hover, .sx-dark .sx a:focus-visible, .sx-dark .sx a[aria-current="page"] { color: #ececee; }
.sx-dark .sx a[aria-current="page"] { box-shadow: inset 0 -2px 0 #7c9dff; }
.sx-dark .sx-logo { filter: invert(1); }
@media (max-width: 560px) { .sx-in { overflow-x: auto; scrollbar-width: none; } .sx-in::-webkit-scrollbar { display: none; } .sx-in { gap: 4px 14px; } .sx-ext { display: none; } }
@media (max-width: 420px) { .sx-in { gap: 4px 11px; padding: 0 16px; } .sx a { font-size: .6rem; letter-spacing: .08em; } .sx-logo { margin-right: 0; height: 18px; } }
.sx-pj { position: static; }
.sx.sx-open { z-index: 9999; }
.sx .sx-panel a.sx-tile[aria-current="page"] { box-shadow: none; font-weight: inherit; border-color: var(--sel, #1d1d1b); border-width: 2px; padding: 11px; }
.sx-pjbtn { display: inline-flex; align-items: center; gap: .6em; font: .66rem/1 var(--mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .16em; color: var(--muted, #5f665a); background: none; border: 0; padding: 12px 0; cursor: pointer; white-space: nowrap; }
.sx-pjbtn:hover, .sx-pjbtn:focus-visible, .sx-pjbtn[aria-expanded="true"] { color: var(--fg, #1f2a22); }
.sx-pjbtn:focus-visible, .sx-panel a:focus-visible { outline: 2px solid var(--sel, #1d1d1b); outline-offset: 3px; }
.sx-pjbtn svg { transition: transform .15s; }
.sx-pjbtn[aria-expanded="true"] svg { transform: rotate(180deg); }
.sx-panel { position: absolute; z-index: 40; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: min(1000px, calc(100vw - 48px)); max-height: calc(100vh - 64px); overflow-y: auto; box-sizing: border-box; padding: 22px; border-radius: 28px; background: var(--card, #fff); color: var(--sel, #1d1d1b); box-shadow: 0 1px 0 var(--faint, rgba(31,42,34,.13)), 0 30px 70px -26px rgba(0,0,0,.4); overscroll-behavior: contain; }
.sx-panel[hidden] { display: none; }
.sx-panel h2 { margin: 4px 6px 10px; font: 600 .62rem/1 var(--mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .18em; color: var(--muted, #5f665a); }
.sx-panel h2:not(:first-child) { margin-top: 22px; }
.sx-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; list-style: none; margin: 0; padding: 0; }
.sx .sx-panel a.sx-tile { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 4px 12px; align-content: start; padding: 12px; border-radius: 18px; border: 1px solid var(--faint, rgba(31,42,34,.13)); background: transparent; color: var(--sel, #1d1d1b); text-transform: none; letter-spacing: 0; white-space: normal; height: 100%; box-sizing: border-box; font: inherit; }
.sx .sx-panel a.sx-tile:hover, .sx .sx-panel a.sx-tile:focus-visible { background: var(--sel, #1d1d1b); border-color: var(--sel, #1d1d1b); color: var(--sel-fg, #fff); }
.sx-mark { grid-row: span 3; width: 34px; height: 34px; border-radius: 10px; border: 1px solid currentColor; display: grid; place-items: center; opacity: .85; }
.sx-mark svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.sx-name { font: 600 .74rem/1.3 var(--mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .1em; }
.sx-note { font: .84rem/1.4 var(--sans, system-ui, sans-serif); opacity: .75; }
.sx-badge { justify-self: start; margin-top: 2px; font: .56rem/1 var(--mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .14em; padding: 4px 8px; border-radius: 999px; border: 1px solid currentColor; opacity: .8; }
.sx-badge[data-s="available"] { background: currentColor; }
.sx-badge[data-s="available"] > span { color: var(--card, #fff); }
.sx-badge[data-s="planned"] { border-style: dashed; }
.sx-badge[data-s="unverified"] { border-style: dotted; }
.sx-dark .sx-panel { background: #17171a; color: #ececee; box-shadow: 0 30px 70px -26px #000; }
.sx-dark .sx a.sx-tile { color: #ececee; border-color: rgba(255,255,255,.12); }
.sx-dark .sx a.sx-tile:hover, .sx-dark .sx a.sx-tile:focus-visible { background: #ececee; color: #17171a; }
.sx-dark .sx-badge[data-s="available"] > span { color: #17171a; }
.sx-dark .sx-pjbtn { color: #a8a8ae; }
.sx-dark .sx-pjbtn:hover, .sx-dark .sx-pjbtn[aria-expanded="true"] { color: #ececee; }
@media (max-width: 899px) { .sx-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 599px) {
  .sx-panel { left: 8px; right: 8px; width: auto; transform: none; padding: 16px 12px; border-radius: 22px; max-height: calc(100vh - 56px); }
  .sx-grid { grid-template-columns: 1fr; }
}
@media (max-width: 420px) { .sx-pjbtn { font-size: .6rem; letter-spacing: .08em; } }
@media (prefers-reduced-motion: reduce) { .sx-pjbtn svg { transition: none; } }
`;

function build() {
  if (document.getElementById("shared-header")) return;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const bar = document.createElement("div");
  bar.id = "shared-header";
  bar.className = "sx";
  const nav = document.createElement("nav");
  nav.className = "sx-in";
  nav.setAttribute("aria-label", "Sites");
  // The Modern Telepathy mark turns like a turnstile through the Artec and Kosmos logos (a four-sided wheel).
  const turn = document.createElement("span");
  turn.className = "sx-turn";
  turn.setAttribute("role", "img");
  turn.setAttribute("aria-label", "Modern Telepathy");
  const wheel = document.createElement("span");
  wheel.className = "sx-wheel";
  [
    ["/favicon.svg", 20, 20],
    ["img/artek-logo.svg", 46, 20],
    ["kosmos-computer/img/kosmos-mark-dark.svg", 28, 20],
    ["img/kosmos-logo.svg", 56, 11],
  ].forEach(([src, w, h]) => {
    const face = document.createElement("span");
    face.className = "sx-face";
    face.setAttribute("aria-hidden", "true");
    const im = document.createElement("img");
    im.src = src.startsWith("/") ? src : new URL(src, base).href;
    im.alt = "";
    im.width = w;
    im.height = h;
    face.append(im);
    wheel.append(face);
  });
  turn.append(wheel);
  const lead = document.createElement("span");
  lead.className = "sx-lead";
  const brand = document.createElement("a");
  brand.className = "sx-brand";
  brand.href = "/";
  brand.setAttribute("aria-label", "Modern Telepathy home");
  brand.style.margin = "0";
  brand.style.padding = "0";
  brand.append(turn);
  lead.append(brand);
  nav.append(lead);
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) {
    let step = 0;
    let timer = 0;
    const tick = () => {
      step += 1;
      wheel.style.transform = "rotateX(" + (-90 * step) + "deg)";
    };
    const start = () => { if (!timer) timer = setInterval(tick, 3600); };
    const stop = () => { clearInterval(timer); timer = 0; };
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    start();
  }
  const path = location.pathname;
  const links = document.createElement("span");
  links.className = "sx-links";
  const sub = document.createElement("div");
  sub.className = "sx-sub";
  const nav2 = document.createElement("nav");
  nav2.className = "sx-in";
  nav2.setAttribute("aria-label", "Products");
  nav2.append(links);
  sub.append(nav2);
  PAGES.forEach((p) => {
    const a = document.createElement("a");
    a.href = new URL(p.href, base).href;
    a.textContent = p.label;
    if (p.match.test(path)) a.setAttribute("aria-current", "page");
    links.append(a);
  });

  // Projects mega-menu. The panel is a child of the bar (not of the scrolling nav) so it is never clipped.
  const pj = document.createElement("span");
  pj.className = "sx-pj";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sx-pjbtn";
  btn.id = "sx-pjbtn";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "sx-panel");
  btn.innerHTML = 'All products <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  pj.append(btn);
  links.append(pj);
  const panel = document.createElement("div");
  panel.id = "sx-panel";
  panel.className = "sx-panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Products");
  panel.hidden = true;
  GROUPS.forEach((g) => {
    const h = document.createElement("h2");
    h.textContent = g.label;
    const ul = document.createElement("ul");
    ul.className = "sx-grid";
    PROJECTS.filter((p) => p.group === g.id).forEach((p) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "sx-tile";
      a.href = new URL(p.href, base).href;
      const mark = document.createElement("span");
      mark.className = "sx-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + p.g + '"/></svg>';
      const nm = document.createElement("span");
      nm.className = "sx-name";
      nm.textContent = p.name;
      const nt = document.createElement("span");
      nt.className = "sx-note";
      nt.textContent = p.note;
      const bd = document.createElement("span");
      bd.className = "sx-badge";
      bd.dataset.s = p.status;
      const bt = document.createElement("span");
      bt.textContent = p.status;
      bd.append(bt);
      a.append(mark, nm, nt, bd);
      if (new URL(a.href).pathname.replace(/index\.html$/, "") === path.replace(/index\.html$/, "")) a.setAttribute("aria-current", "page");
      li.append(a);
      ul.append(li);
    });
    panel.append(h, ul);
  });
  bar.append(panel);
  const tiles = () => [...panel.querySelectorAll("a.sx-tile")];
  const setOpen = (open, focusBtn) => {
    panel.hidden = !open;
    bar.classList.toggle("sx-open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) tiles()[0].focus();
    else if (focusBtn) btn.focus();
  };
  btn.addEventListener("click", () => setOpen(panel.hidden));
  btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" && panel.hidden) { e.preventDefault(); setOpen(true); } });
  document.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false, true); return; }
    const list = tiles();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = getComputedStyle(panel.querySelector(".sx-grid")).gridTemplateColumns.split(" ").length;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (step) {
      e.preventDefault();
      const n = i + step;
      if (n >= 0 && n < list.length) list[n].focus();
      else if (n < 0) btn.focus();
    } else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
  });
  document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) setOpen(false); });
  panel.addEventListener("focusout", (e) => { if (!panel.hidden && e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== btn) setOpen(false); });
  const mt = document.createElement("span");
  mt.className = "sx-mt";
  MT.forEach((l) => {
    const a = document.createElement("a");
    a.href = l.href;
    a.textContent = l.label;
    if (l.href !== "/" && path.startsWith(l.href)) a.setAttribute("aria-current", "page");
    mt.append(a);
  });
  const end = document.createElement("span");
  end.className = "sx-end";
  end.append(mt);
  nav.append(end);
  ELSEWHERE.forEach((l) => {
    const a = document.createElement("a");
    a.className = "sx-ext";
    a.href = l.href;
    a.rel = "noopener";
    a.textContent = l.label;
    nav2.append(a);
  });
  bar.append(nav, sub);
  document.body.prepend(bar);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
else build();
