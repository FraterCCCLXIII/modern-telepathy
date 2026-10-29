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
