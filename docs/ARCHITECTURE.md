# Site architecture

One deploy (TanStack Start on Vercel) with two kinds of content.

| Layer | Where | What |
|---|---|---|
| App pages | `src/routes/` | `/` projects, `/projects/$slug`, `/thesis`, `/labs` |
| Data | `src/lib/projects.tsx`, `src/lib/labs.ts` | Project entries and the catalog of labs |
| Static sites | `public/labs/<name>/` | Plain HTML served as-is; the app only links to them |

## Navigation

Header: **Projects** (/) · **Labs** (/labs) · **Docs** (/labs/templeos/docs/) · **Thesis**.
A project page shows a "Try it" list built from labs whose `project` equals its slug.

## Labs layout

- `public/labs/kamiji/site/`   the 22 Kamiji sub-sites (studio, workshop, hands, previs, ...), unchanged
- `public/labs/kamiji/assets/` GLBs they load via `../../assets/` (keep `site/` and `assets/` as siblings)
- `public/labs/kamiji/vendor/three/` three.js 0.186.1, only the files the pages import; import maps point here, not at a CDN
- `public/labs/templeos/docs/` the generated TempleOS docs site (source: `templeos-docs`, rebuild with its `build.py`)

## Adding a site

1. Copy it to `public/labs/<name>/` with relative links (or `/labs/<name>/...` absolute).
2. Add an entry to `src/lib/labs.ts`; set `project` to show it on a project page.
3. `bun run build`, then `node .output/server/index.mjs` to check.

## Before deploying

- `public/labs/kamiji/assets/PROVENANCE.md` still has TODO rows (Kamikin authorship and licence, Meshy terms). The Kamiji README says the mochi exports other than `kamikin-pip` stay unpublished until the licence is confirmed. Remove or confirm before pushing to production.
- Not merged: `kosmos-www` (its Vite build assumes it is served from `/`; link to www.kosmos.computer instead), `kosmos-docs` (own domain), `kosmos-web` (needs the WASM build).
- The Kamiji embeddable library (built bundle on a versioned URL) is planned, not built.
- Project copy for Kamiji and TempleOS is draft text.

## One header, one theme

- **Header:** `SiteHeader` (`src/components/site-chrome.tsx`) and `public/labs/kamiji/site/shared-header.js` draw the same bar: 40px, mono uppercase labels, and a logo wheel that turns through the Modern Telepathy mark, Artec and the two Kosmos logos. The React bar links to Kamiji, Studio and Kosmos; the Kamiji bar adds Modern Telepathy, Projects, Labs, Docs and Thesis. The link lists are duplicated, so change both.
- **Theme:** Kamiji is the base. `src/styles.css` holds Kamiji's palette (`site/style.css`: bg `#f0efe7`, fg `#1f2a22`, card `#fafaf3`, selection `#1d1d1b`) in oklch, remaps the Tailwind `zinc-*` scale to its warm neutrals, and uses its system-ui and mono font stacks. The Google Fonts links (Instrument Sans and Serif) are gone.
- The `.dark` block in `styles.css` is unused and still has the old blue-grey values. Kamiji has no site-wide dark theme (only per-page `sx-dark`).
