# Website evaluation (2026-10-28)

Sources surveyed before merging into this repo. Read-only survey; nothing copied yet.

| Source | What it is | Tech | Size | Verdict |
|---|---|---|---|---|
| kamiji/site (22 sub-sites + landing, 58 root files) | Hub of static pages: studio, workshop, hands, kamikin, previs, arco, ui-experiments, games, subtitles, voice-lab, yakopop, kosmos, kosmos-computer, kosmographica, newsphere, sutraya, longformer, triunfi, castbook, sidekicks, kamae | Plain HTML/JS, no build. Relative `../assets/`. three.js via jsdelivr | 9.8 MB + 50 MB assets | **Base of the new site.** Keep layout. |
| kosmos-www | Kosmos marketing site: home, features, apps, platforms, education, download, spec | Vite + React, deploys to Vercel; `dist/` 33 MB | 8 pages | **Merge as /kosmos/** from built output. Overlaps kamiji/site/kosmos-computer (older, hand-written). Prefer kosmos-www, retire the copy. |
| kosmos-docs | Docusaurus docs (guide, kosmos, reference, sdk) at docs.kosmos.computer | Docusaurus, Vercel | 104 KB docs | **Keep separate** (own build, own domain). Link from nav. |
| kosmos-engine/apps/kosmos-web | Rust/WASM engine runner page + games.json + nginx/docker-compose deploy | Rust WASM, nginx | 6.7 KB html | **Merge as /play/**; its nginx.conf is a ready serving template. Needs built wasm. |
| kamiji/site/kosmos | "Reality Kosmos Engine" page | static | 660 KB | Overlaps the above; fold into /play/ or drop. |
| templeos-holyc/docs/index.html | Offline single-file viewer of 25 TempleOS docs (561 KB, generated) | generated HTML | 561 KB | **Merge as /templeos/ docs page**, regenerated from the markdown. Not hand-edited. |
| templeos-holyc/docs/theme-profiles-preview.html | Theme preview | static | small | Merge under /templeos/ |
| kosmos-dashboard, kosmos-live, kosmos-steamos, kosmos-sdk, kosmos-alignment, kosmos-business-model | Not websites (task app, OS image, SteamOS shell, npm SDK, markdown notes) | n/a | n/a | Out of scope. |

Open points: duplicated Kosmos pages (3 versions); mochi GLBs partly git-ignored pending licence; three.js should be vendored; docs.kosmos.computer stays on Vercel.

## Excluded from the merge (decided 2026-10-29)

Personal/content sites: Kosmotheon/site, Messiah/site, panentheon-2/site, collective/site, Interpretatio-Universalis, meditation-teacher-site, genetic-energetics, alpha-omega, website.

Third-party clones (not ours to publish): Flowise, LibreChat, OpenHands, OpenSign, twenty, puter-ui, Sefaria-Project, Rotating Globe/three.js-master, inkscape.

Candidates that remain: kamiji/site, kosmos-www, kosmos-engine/apps/kosmos-web, templeos-holyc/docs, templeos-docs/site, and the Kosmos/Kamiji-adjacent repos (kamae, kamiji-demo, kamiji-game, kosmica-site, kosmicons-*, yakopop/apps/web). Product pages (doctransit-web, openbook-web, etc.) are not yet decided.
