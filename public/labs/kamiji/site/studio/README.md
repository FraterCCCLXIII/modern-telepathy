# Studio (prototype)

A browser character creator: swap parts, morph sliders, recolour, accessories, poses, roster, JSON and GLB export. Open `site/studio/index.html` from any static server rooted at the repository (it loads `../../assets/` and the site's `rtk-mouth.js`, `tube-face.js`, `effects.js`). No build step; three.js 0.186.1 comes from the import map.

Status: **prototype**. It is labelled that way in the Projects menu only.

## Intended workflow vs what works today
| Intended | Works today |
|---|---|
| Choose a style and body plan, swap parts per slot | 7 styles, 19 presets, about 100 procedural parts, 10 GLB shape heads, 9 ears and 8 tails cut from Kamikin GLBs, 14 Kamikin and 16 Rubbernose bases, 34 shape morph targets |
| Sliders, per-region colour, toon and outline | 35 sliders (6 real blendshapes on the head), symmetry lock, group locks, randomise, palettes, 4 screen looks |
| Dress and accessorise on sockets | 36 real accessory GLBs + 14 real held props + 8 procedural wearables, drag onto model or socket chip |
| Check in motion, expressions | procedural clips (idle, wave, walk, run, jump, cheer, sit, T-pose), GLB clips, 8 expressions, mouth-open test (not on texture-face bases) |
| Hand off to an engine or Previs | character JSON + GLB (below) |
| Bring your own parts | not built |

## Real GLB vs procedural
- Real GLB, used whole: Kamikin (14, `assets/mochi`), Rubbernose (16), Shapes morph mesh, Kamiji hand, accessories, held props, 10 shape heads for Mix.
- Cut from real GLBs at runtime (rigid, not skinned, tagged CUT): Kamikin ears and tails, Rubbernose glove and shoe.
- Procedural (tagged PROC): all Human and Creature bodies, heads, hair, torsos, limbs, hands, feet, ears, tails, wings, horns, outfits, and the back, waist, feet and tail wearables.
No new GLBs were authored: Blender is installed on the machine but the model/*.py pipeline was not used, so everything new is procedural.

## Character JSON (`kamiji.studio.character/1`)
```json
{
  "schema": "kamiji.studio.character/1",
  "name": "Mira, wizard",
  "style": "human",                       // human | creature | kamiji | kamikin | rubbernose | shapes | mix
  "parts":   { "head": "pointy", "hair": "long", "clothing": "robe", "ears": "k_ear_pip" },   // slot -> part id (unset = style default)
  "morphs":  { "height": 0.15, "chin": 0.3 },                  // id -> number in the slider's range
  "materials": { "skin": { "color": "#f4d3c2", "color2": "#f4d3c2", "grad": 0, "rough": 0.72 } },  // region -> colours
  "accessories": [ { "id": "wizard_hat", "socket": "head", "tint": "#7a5cff" } ],
  "face": { "rig": "classic", "expression": "thinking" },     // classic | rtk | tube
  "pose": { "clip": "wave" },
  "look": { "effects": [], "room": "studio", "outline": true, "steps": 3 }
}
```
Part ids and morph ids are stable strings (`data.js`, `parts.js`). Unknown ids are ignored on import with a warning. A library file is `{ "schema": "kamiji.studio.library/1", "characters": [ ... ] }`.

## Previs interop (spec)
A Previs Content/Models sub-node can reference a Studio character by embedding or linking:
```json
{ "kind": "studio-character", "character": { /* the JSON above */ }, "glb": "optional URL or file name of the exported GLB" }
```
Loader rules: (1) if `glb` is present, load it with GLTFLoader and play `pose.clip` from `gltf.animations` (names are the same clip names the JSON uses); head morph names are `cranium, width, jaw, chin, cheeks, brow` on the mesh whose name contains `HeadMesh`. (2) Otherwise rebuild from JSON with Studio's `buildProcFigure` / `buildGlbFigure` (`figure.js`, `glbfigure.js`, which only need `three` and the repository's `assets/`). Colour and look fields are viewport hints; the GLB carries plain colours. The GLB root is `Character`, bones are named `root, hips, spine, neck, head, shoulder_L/R, elbow_L/R, wrist_L/R, hip_*, knee_*, ankle_*, tailBase, tail0..n, wing_L/R`; accessory sockets are the bones above.

## GLB export limits
- Procedural: one SkinnedMesh per source mesh with rigid (1.0) weights on a cloned bone tree, six head morph targets, procedural clips. Re-imported in GLTFLoader it reports skinned meshes, bones, morph targets and animations (checked in `verify`).
- GLB bases: their own skinned meshes, morph targets and clips; recoloured materials export as plain colours.
- Not exported: toon steps, secondary-colour gradients, outline shells, screen looks, RTK and tube face decals (the classic face meshes are exported). No textures beyond the GLBs' own.

## Files
`index.html`, `studio.css`, `studio.js` (orchestration, diff to fast path or rebuild), `data.js` (styles, slots, morphs, palettes), `parts.js` (procedural catalogue), `glbparts.js` (GLB and cut parts), `figure.js` + `clips.js` (procedural rig and clips), `glbfigure.js` (GLB bases), `faces.js`, `acc.js`, `rules.js`, `store.js` (undo, roster, import), `viewport.js` (shared renderer, thumbnails), `thumbs.js`, `exporter.js`, `ui.js`, `morphs.js`, `presets.js`, `DESIGN.md`.

## Performance
One WebGLRenderer, 30 fps cap, redraw only when dirty or animating, paused when off-screen or the tab is hidden, thumbnails rendered one at a time and cached. The software renderer used in testing (SwiftShader) is slow: expect seconds to fill the first grid of thumbnails there; on a GPU it is instant.
