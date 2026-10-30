# Arco UI components and docs

`index.html` is a static page (no build step to view it). The previews are real React components from the
owner's **UI Experiments** workspace (`packages/longformer-ui`, v0.1.0, author FraterCCCLXIII), prebuilt into
`assets/`. They are not a released Arco package; the workspace plan (`APP-INDEX-AND-LIBRARY-PLAN.md`, DRAFT v0.1,
Phase 3) is to wire them to Arco.

## Files
- `index.html`, `docs.css`, `docs.js` - the navigation + doc sections (vanilla JS, renders from `assets/docs-data.js`).
- `assets/arco-ui.js` / `arco-ui.css` - lazy-loaded bundle: React 18.3.1 + react-dom + the 25 chosen blocks + 6 primitives + the kit's `theme.css` (scoped; `:root` dark default removed) + `build/arco-light.css` (Arco colours on the light page).
- `assets/docs-data.js` - generated: props tables (from `types.ts`/primitive TS), Zod snippets (`registry/schemas.ts`), registry descriptions/status, examples (from `longformer-demo/src/mock-data` and `design-system/samples.ts`), build-time validation results.
- `build/` - `build.mjs`, `entry.tsx`, `extract.mjs`, `examples-entry.ts`, `components.mjs` (the chosen set), `arco-light.css`.

## Rebuild
Sources are read-only; the build copies them to a temp dir.
```
WORK=/private/tmp/claude-501/arco-docs-build
mkdir -p $WORK && cd $WORK && npm init -y >/dev/null
npm i esbuild@0.25.9 react@18.3.1 react-dom@18.3.1 zod@4.4.3 lucide-react@1.23.0 typescript@5.9.2
UIX="/Users/paulbloch/Documents/github/UI Experiments" WORK=$WORK node /path/to/kamiji/site/arco/docs/build/build.mjs
```

## Status labels
From the registry: `strict: true` (14 blocks with a full Zod schema) = **available**; `strict: false` (envelope-only `{ id, type }` check) = **prototype**. Primitives are labelled available (Tier 1 in the plan). These describe the workspace, not a shipped Arco release.

## Skipped
`reference/` (third-party clones), `longformer-ui-tailwind` (duplicate tree), the other workspace views and shell components, and other blocks not chosen. Note on `chat/emoji-data.ts`: it IS part of the bundle (the kit's Composer imports it, and the Arco blocks pull the kit in), but its provenance is unclear and it was not reviewed. Most workspace views and the hover overlays can be previewed (only the email, chat and assistant views use richer demo state hooks); the UI Experiments gallery (`../../ui-experiments/`) shows them. Icons come from `lucide-react` (ISC). No env files or keys are copied.
