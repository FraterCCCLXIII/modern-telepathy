# STUDIO: design notes (prototype)

Studio is a character creator in the style of game and DCC character builders: pick a style, swap parts per slot, move morph sliders, recolour, add accessories, check a pose, save to a roster, export JSON and GLB. Static page, three.js 0.186.1 from the import map, no build step. Status is "prototype" (Projects menu badge only).

## Users and jobs
| User | Job | Needs first |
|---|---|---|
| Game artist | Block out a cast of related characters fast; export to an engine | Part grids, proportion sliders, GLB export with skeleton and clips |
| Hobbyist / avatar creator | Make "my" character, share it | Presets, randomise, palettes, accessories, PNG and share JSON |
| Kamiji family author | Dress and tint the family's own characters; feed Previs | Kamikin, Rubbernose, Shapes, Kamiji hand as bases; character JSON |

## Data model
A character is plain JSON (see README for the exact shape and the Previs interop).
- **Style** (archetype): human, creature, kamiji hand, kamikin, rubbernose, shapes, mix. A style picks an engine: `proc` (procedural rig) or `glb` (a real GLB wrapped as a base). Mix is the Human rig with every library unlocked.
- **Body plan**: the `body` slot decides the skeleton: upright (2 legs, 2 arms), quad (4 legs), hexa (6 legs). Plan decides which slots exist (arms, hands, outfits need upright).
- **Slots**: body, head, hair, torso, arms, hands, legs, feet, ears, tail, wings, horns, spines, clothing. Each holds one **part** (`slot` + `id`). A part is `procedural` (built in three.js), `glb` (a real asset used whole) or `derived` (geometry cut at runtime from a real skinned GLB by bone weight). The default for an unset slot is per style (`DEFAULT_PARTS`).
- **Morphs**: id to number. Head shape (6) are real GPU morph targets on the head mesh; other proportion sliders rebuild the rig; Kamiji hand and Shapes sliders are the GLBs' own morph targets. Pairs (left/right) honour the symmetry lock.
- **Materials**: per region (skin, hair, outfit, trim, accent, eye for procedural; the GLB's own material names for GLB bases): base, secondary, blend, roughness. Global: toon steps, outline, screen looks (effects.js: jitter, pencil, retro print, toon).
- **Sockets** (accessories): head, face, ears, hair, neck (all use the head frame, accessories are modelled for a unit head), back, hand L/R, waist, feet, tail. One accessory per socket; zone conflicts resolve newest-wins.
- **Face**: classic meshes, RTK mouth or tube face decals (the site's rigs, projected onto the head), or baked texture states on Kamikin and Rubbernose, or the Kamiji hand's morph targets.
- **Pose**: a clip name. Procedural clips are generated for the rig; GLB clips come from the file.

## The editing loop
Click a category, hover a tile to preview, click to swap (undo step), nudge sliders (one undo step per drag), recolour, drag accessories onto the model or a socket chip, orbit and play a clip, Save to roster. Everything goes through `store.commit()`; `studio.js` diffs the new character against the last built one and takes a fast path (head morphs, colours, face, clip, look) or rebuilds the figure. Thumbnails are rendered by the shared renderer into a corner of its canvas, one at a time, cached by what they depend on.

## Rules layer (`rules.js`)
Blocked parts show a reason in their tooltip, in the status line and in a live region: arms, hands and outfits need an upright body; heads with their own ears block Ears; fur or fixed-shape heads block Hair; wings occupy the back socket; tail accessories need a tail; GLB bases only expose sockets their skeleton has. Applying a part can fix other slots and says so (for example choosing a cat head removes the ears).

## Export
JSON (character, library, share-to-clipboard); PNG portrait; PNG turntable sheet (8 views); GLB through GLTFExporter. Procedural figures export one skinned mesh per source mesh on a cloned bone hierarchy (rigid weights), with the head morph targets and the procedural clips. GLB bases export their own skinned meshes, morph targets and clips. Shader looks, outlines and RTK/tube decals are viewport-only.

## Constraints that shaped it
Monochrome UI (`--sel` #1d1d1b), characters carry the colour. One shared WebGL renderer, 30 fps cap, render only when dirty or animating, IntersectionObserver gating, thumbnails cached. Reduced motion: no turntable, clips start paused. Desktop at 1100px and above is four columns; below that the viewport sits on top and Parts, Morphs and Roster become tabs (no horizontal page scroll at 375).

## Scope limits
Procedural parts are rigid (no skinning blend at joints). Kamikin and Rubbernose are single skinned meshes, so only the base, colours, face, clips and accessories vary; their ears, tails, gloves and shoes can be reused in Mix because they are cut out. No bring-your-own-part import, cloth, hair simulation, IK or retargeting.
