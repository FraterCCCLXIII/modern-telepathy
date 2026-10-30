/** The creature library: every character family made for Agent Canvas (Hangout, Team chat, Feed) and where it lives. */

export type CreatureRender = "svg" | "canvas" | "react";

export interface CreatureKind {
  id: string;
  name: string;
  note: string;
}

export interface CreatureFamily {
  id: string;
  /** Plural family name, e.g. "Wisps". */
  name: string;
  /** One kind of creature, singular, e.g. "Wisp". */
  singular: string;
  tagline: string;
  description: string;
  render: CreatureRender;
  /** Where it appears today. */
  appearsIn: string[];
  /** Source of truth for the drawing code. */
  source: string;
  /** Present in this package as code. */
  exported: boolean;
  /** Not shown on the site. */
  hidden?: boolean;
  kinds: CreatureKind[];
}

export const WISP_COLOURS = [
  { id: "violet", name: "Violet", fill: "#8B5CF6" },
  { id: "blue", name: "Blue", fill: "#2D9CF0" },
  { id: "green", name: "Green", fill: "#2FBF71" },
  { id: "teal", name: "Teal", fill: "#19B5A5" },
  { id: "brown", name: "Brown", fill: "#8A5A3C" },
  { id: "orange", name: "Orange", fill: "#F5760A" },
  { id: "red", name: "Red", fill: "#EF4444" },
  { id: "pink", name: "Pink", fill: "#EC4899" },
  { id: "indigo", name: "Indigo", fill: "#5B5BF0" },
] as const;

export const FLUX_COLOURINGS: CreatureKind[] = [
  { id: "solid", name: "Violet", note: "One flat colour." },
  { id: "rainbow", name: "Rainbow", note: "Hue wraps around the sphere." },
  { id: "gradient", name: "Gradient", note: "Orange to pink to violet, curved on the sphere." },
  { id: "aurora", name: "Aurora", note: "Teal to violet bands that drift." },
  { id: "sunset", name: "Sunset", note: "A sun on the sphere that follows the eyes." },
  { id: "prism", name: "Prism", note: "Blue to magenta, turning slowly." },
  { id: "neon", name: "Neon", note: "Cyan that pulses and vibrates." },
  { id: "jelly", name: "Jelly", note: "Green and wobbly." },
  { id: "fizz", name: "Fizz", note: "Rose that jitters fast." },
  { id: "paper", name: "Paper", note: "Off-white with dark eyes." },
];

export const FLUX_SHAPES: CreatureKind[] = [
  { id: "blob", name: "Blob", note: "The loose organic mass." },
  { id: "square", name: "Square", note: "" },
  { id: "triangle", name: "Triangle", note: "" },
  { id: "star", name: "Star", note: "" },
  { id: "heart", name: "Heart", note: "" },
  { id: "cross", name: "Cross", note: "" },
  { id: "pill", name: "Pill", note: "" },
  { id: "hexagon", name: "Hexagon", note: "" },
  { id: "drop", name: "Drop", note: "" },
];

export const CREATURE_FAMILIES: CreatureFamily[] = [
  {
    id: "wisps",
    name: "Wisps",
    singular: "Wisp",
    tagline: "The colourful orbs.",
    description:
      "A flat blob with two tall pill eyes that glance around and blink. The wobble is slow and each outline is slightly different so a column of them does not look stamped. Wisps are the avatars of agents in Hangout.",
    render: "svg",
    appearsIn: ["Hangout agent lists", "Hangout Team tab", "Bitsocial, Holons and MESH Hangout"],
    source: "OpenHands examples/canvas-apps/hangout/extension.js (orbSvg, BLOBS)",
    exported: true,
    kinds: WISP_COLOURS.map((c) => ({ id: c.id, name: `${c.name} Wisp`, note: c.fill })),
  },
  {
    id: "fluxes",
    name: "Fluxes",
    singular: "Flux",
    tagline: "The living gradient orbs.",
    description:
      "A metaball mass that wobbles, emits Motes and takes them back, with pill eyes that sit on a sphere and turn with it. Ten colourings and nine shapes. The Flux is the Hangout welcome blob, and a small animated version is used as an avatar.",
    render: "canvas",
    appearsIn: ["Hangout welcome screen", "Hangout avatars (Flux look)"],
    source: "OpenHands examples/canvas-apps/hangout/extension.js (createBlobScene, fluxOrb)",
    exported: true,
    kinds: FLUX_COLOURINGS,
  },
  {
    id: "flux-shapes",
    name: "Flux forms",
    singular: "Flux form",
    tagline: "The shapes a Flux can take.",
    description: "The lobes of a Flux glide to points along an outline, so it can become a square, star, heart and more, then relax back to a blob.",
    render: "canvas",
    appearsIn: ["Hangout welcome screen (shape rail)"],
    source: "OpenHands examples/canvas-apps/hangout/extension.js (BLOB_SHAPES)",
    exported: true,
    kinds: FLUX_SHAPES,
  },
  {
    id: "motes",
    name: "Motes",
    singular: "Mote",
    tagline: "The small ones a Flux sheds.",
    description:
      "Small blobs that drift out of a Flux, wander, and come back in, each in its own hue. They are part of the Flux simulation, not a separate drawing.",
    render: "canvas",
    appearsIn: ["Hangout welcome screen"],
    source: "OpenHands examples/canvas-apps/hangout/extension.js (stepBlobScene, MINI_HUES)",
    exported: true,
    kinds: [
      { id: "pink", name: "Pink Mote", note: "rgb(244, 114, 182)" },
      { id: "mint", name: "Mint Mote", note: "rgb(52, 211, 153)" },
      { id: "amber", name: "Amber Mote", note: "rgb(251, 191, 36)" },
      { id: "sky", name: "Sky Mote", note: "rgb(56, 189, 248)" },
      { id: "rose", name: "Rose Mote", note: "rgb(251, 113, 133)" },
      { id: "lime", name: "Lime Mote", note: "rgb(163, 230, 53)" },
      { id: "cyan", name: "Cyan Mote", note: "rgb(34, 211, 238)" },
      { id: "tangerine", name: "Tangerine Mote", note: "rgb(249, 115, 22)" },
    ],
  },
  {
    id: "cubits",
    name: "Cubits",
    singular: "Cubit",
    tagline: "A Flux in hard square cells.",
    description: "The voxel mode of the Flux: the same simulation and colours, thresholded into square cells with no soft edge, so it reads as a pixel creature.",
    render: "canvas",
    appearsIn: ["Hangout welcome screen (Voxel toggle)"],
    source: "OpenHands examples/canvas-apps/hangout/extension.js (drawBlobScene, mode 'voxel')",
    exported: true,
    kinds: [{ id: "cubit", name: "Cubit", note: "Any Flux colouring and shape, in voxel mode." }],
  },
  {
    id: "mitts",
    hidden: true,
    name: "Mitts",
    singular: "Mitt",
    tagline: "Hands made of cubes.",
    description: "A hand on a 16 by 16 grid of lit-and-shaded cubes with pill eyes and a smile. Each cube is lit on top and shaded underneath.",
    render: "svg",
    appearsIn: ["Hangout avatar style (retired in favour of smooth avatars; kept in history)"],
    source: "OpenHands commit 49203e9e55, Hangout extension.js (HAND_VOXELS, drawVoxels)",
    exported: true,
    kinds: [{ id: "mitt", name: "Mitt", note: "Tinted per agent." }],
  },
  {
    id: "spooklets",
    hidden: true,
    name: "Spooklets",
    singular: "Spooklet",
    tagline: "Ghosts made of cubes.",
    description: "A rounded body with a wavy hem on the same grid as the Mitts, with tall pill eyes and a small mouth.",
    render: "svg",
    appearsIn: ["Hangout avatar style (retired; kept in history)"],
    source: "OpenHands commit 49203e9e55, Hangout extension.js (GHOST_VOXELS)",
    exported: true,
    kinds: [{ id: "spooklet", name: "Spooklet", note: "Tinted per agent." }],
  },
  {
    id: "pixlings",
    name: "Pixlings",
    singular: "Pixling",
    tagline: "The pixel crew of Team chat.",
    description:
      "Tiny 12 by 12 sprites that wander the Team chat welcome screen, ask each other questions and answer with speech glyphs. There are two kinds: people and agents.",
    render: "svg",
    appearsIn: ["Team chat welcome screen"],
    source: "OpenHands src/components/features/team-chat/team-chat-welcome.tsx, src/utils/team-chat-sprites.ts",
    exported: true,
    kinds: [
      { id: "wanderer", name: "Wanderer", note: "The person Pixling: a round head, two eyes, a mouth." },
      { id: "tinker", name: "Tinker", note: "The agent Pixling: a square head with a visor and an antenna." },
    ],
  },
  {
    id: "handlings",
    name: "Handlings",
    singular: "Handling",
    tagline: "Kamiji hands with eyes.",
    description: "The Team chat welcome crew in its second look: the smooth Kamiji hand drawn flat in a team colour, with two small eyes in the palm.",
    render: "react",
    appearsIn: ["Team chat welcome screen (hands toggle)"],
    source: "OpenHands src/components/features/team-chat/team-chat-welcome.tsx",
    exported: false,
    kinds: [{ id: "handling", name: "Handling", note: "Uses the Kamiji hand model; see KamijiAvatar." }],
  },
];

export const RELATED_FAMILIES = [
  { name: "Kamikin", where: "docs/kamikin-context.md", note: "The mochi cast of the Kamikin game." },
  { name: "Glyphlings", where: "modern-telepathy /glyphlings", note: "Greek letters with eyes in their empty spaces." },
  { name: "Kamiji faces", where: "docs/kamiji-avatar-api.md", note: "Body shapes, expressions and a character studio." },
];

export function creatureFamily(id: string): CreatureFamily | undefined {
  return CREATURE_FAMILIES.find((f) => f.id === id);
}
