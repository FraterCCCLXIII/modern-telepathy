# Yakopop page

`index.html`, `yakopop.css`, `yakopop.js` and `assets/` make the Yakopop study page. Yakopop is a separate project; its repository is private and was only read. Nothing in it was changed or built.

## Rebuild the live components

```sh
sh site/yakopop/build/build.sh [/path/to/yakopop]
```

The script copies these files from the yakopop checkout into a temp dir, installs `esbuild@0.25.10`, `react@18.3.1` and `react-dom@18.3.1` there, bundles `build/entry.tsx`, and writes `assets/yakopop-demo.js` (about 316 KB minified, 99 KB gzip) and `assets/yakopop-demo.css`:

| Copied unchanged | Used for |
|---|---|
| `packages/overlay/src/**` (tests removed) | SubtitlePlayer, SubtitleStack, WordCard, LayersPanel, engine, hooks, prefs, `overlay.css`, `player/player.css` |
| `packages/shared/src/{types,text,langs,fonts,subtitles}.ts` | Line and Token types, colours, timing, `translationOf`, `parseSubtitles`, sample sentences with translations |
| `apps/world/src/features/meeting/logic/talkView.ts`, `dialogue.ts`, `talkLangs/*.ts` | said(), subsPanel(), talk prefs, the fox dialogue, the talk languages |

`@yakopop/shared` is aliased to a trimmed index in the temp dir. `build.mjs` also prefixes every selector of the two overlay style sheets with `.ykd`, so they cannot clash with `../style.css` (which also defines `.track`, `.tag`, `.pill`, `.panel`).

## What is ours

- `build/entry.tsx`: a timer-driven `PlayerEngine`, the four demo components, SRT/VTT writers, the Talk bubble markup (a re-implementation of the markup in `Talk.tsx`/`talk.css`, which is tied to the game engine and cannot be bundled).
- `yakopop.css`: page styles, monochrome buttons, and a few resets for site classes that share names with the overlay's. The player's accent colour is set to off-white to match the site.
- `yakopop.js`: loads `assets/yakopop-demo.js` only when a demo is within 400 px of the viewport.
- Not extracted: the Godot HUD (`apps/godot/hud/subtitle_view.gd`, GDScript) and the Solid talk bubbles for Godot. No re-implementation was made; the web stack is the reference they are held to.

## Notes

- No network and no model calls: demos use the sample sentences in `packages/shared/src/langs.ts`.
- The overlay stores layer and profile choices in `localStorage` under `yakopop.*` keys, as in the app. The Jisho link in the word card is a plain link; the dictionary lookup is off.
- `dialogue.ts` has a type-only import of `../../audio/talkSfx` that esbuild drops.
- Voice demo skipped: the word card's play button replays the sample timeline, and the Talk demo uses the browser's `speechSynthesis` for word clicks. `../voice.js` is not used.
