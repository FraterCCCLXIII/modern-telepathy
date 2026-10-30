# UI Experiments gallery

`index.html` is a static page (no build step to view it). Previews are real React components from the owner's
**UI Experiments** workspace (`packages/longformer-ui`, `longformer-demo` state and mock data, `longformer-www` sections),
prebuilt into `assets/`. Nothing here is a released package.

## Files
- `index.html`, `page.css`, `page.js`: left nav (search, category tree with scroll-spy, status and source filters, sort, clear; state in the URL query), tile grid, lazy mounting, props tables, sources and skipped lists (counts derived from the tile array).
- `assets/uix-core.js|css`, `uix-apps.js|css`, `uix-site.js|css`, `assets/chunks/`: four lazy-loaded bundles (React 18.3.1) that share chunks. core = primitives, shell, chat parts, card blocks; apps = workspace views, overlays and chat panels wired with the demo's own state slices; site = Longformer site sections. The kit's dark default on `:root` is removed; the site's tokens are scoped to `.uix-www`.
- `assets/tiles-data.js`: generated tile metadata (status, source paths, props tables, snippets). `assets/static/`: copies of `proto/static` output and the Forge page (brand names replaced, `<base target=_blank>` injected).
- `build/`: `build.mjs`, `entry-core.tsx`, `entry-apps.tsx`, `entry-site.tsx`, `common.tsx`, `tiles.mjs` (tile list and status rules), `examples-entry.ts`, `extract.mjs` (TypeScript prop extraction), `uix-light.css`.

## Mini apps
`build/mini/*.tsx` holds 17 small interactive apps (habit tracker, focus timer, expense splitter, recipe, flashcards, itinerary, mood journal, kanban, music queue, meeting notes, standup bot, agent monitor, unit converter, chat that answers with cards, plant care, reading list, mini CRM). They import only the kit's components (`@ui/...`) plus local state; `build/mini/meta.mjs` lists them (device frame, design size, description). The build derives each app's "components used" from its imports and maps them to tiles (or Arco docs entries), and each tile's "Used in N mini apps" from the same graph. They live in their own lazy bundle (`assets/uix-miniapps.js|css`) and render in a device frame, in a featured strip near the top, in the Mini apps category, and in a full-size modal with Reset.

## Rebuild
```
WORK=/private/tmp/claude-501/ui-exp-build
mkdir -p $WORK && cd $WORK && npm init -y >/dev/null
npm i esbuild@0.25.9 react@18.3.1 react-dom@18.3.1 zod@4.4.3 lucide-react@1.23.0 typescript@5.9.2
UIX="/Users/paulbloch/Documents/github/UI Experiments" WORK=$WORK node /path/to/kamiji/site/ui-experiments/build/build.mjs
```
Sources are read-only; the build copies them to the temp dir and patches only the copies: the demo's agent code gets a stubbed `fetch`, third-party image hosts become an inline placeholder, real company names in sample data become neutral words, and links in the site sections point to `#`.

## Status labels
available = named as a Tier 1 primitive in APP-INDEX-AND-LIBRARY-PLAN.md (DRAFT v0.1) or registry `strict: true`; prototype = demo/reference or planned-extraction tier, or envelope-only block; unverified = not classified; planned = named in the plans, no source (placeholder tile).
