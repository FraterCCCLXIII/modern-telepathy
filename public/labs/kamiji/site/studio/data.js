// Studio data model: styles, categories, slots, morph definitions, palettes, rooms, poses, presets.
// A character is plain JSON (see README "Character JSON"): style + parts per slot + morph values + materials + accessories + face + pose.
export const SCHEMA = "kamiji.studio.character/1";
export const A = new URL("../../assets/", import.meta.url).href;

// Which engine builds a style. "proc" = procedural rig, "glb" = a real GLB wrapped as a base.
export const STYLES = [
  { id: "human", label: "Human", engine: "proc", chassis: "human", note: "Stylised low-poly humanoid. All parts are procedural (three.js), none are GLB." },
  { id: "creature", label: "Creature", engine: "proc", chassis: "creature", note: "Biped, quadruped or six-legged body with ears, horns, tails, wings. Procedural." },
  { id: "kamiji", label: "Kamiji hand", engine: "glb", note: "The rigged Kamiji hand GLB: shape (hand, sphere, cube), face morphs, accessories." },
  { id: "kamikin", label: "Kamikin", engine: "glb", note: "14 real Kamikin mochi GLBs as swappable bases with colour, face states and clips." },
  { id: "rubbernose", label: "Rubbernose", engine: "glb", note: "16 real 1930s rubber-hose GLBs as bases: swap body, recolour regions, hide gloves or shoes." },
  { id: "shapes", label: "Shapes", engine: "glb", note: "One real GLB with 34 morph targets (drop, star, ghost, slime...). Blend any of them." },
  { id: "mix", label: "Mix", engine: "proc", chassis: "human", note: "Human rig with every part library unlocked: creature parts, GLB shape heads and Kamikin-derived ears and tails." },
];
export const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));

// Categories in the left nav. `slots`: which part slots each shows. `focus`: where thumbnails look.
export const CATEGORIES = [
  { id: "style", label: "Style", slots: [], focus: "all" },
  { id: "body", label: "Body", slots: ["body"], focus: "all" },
  { id: "head", label: "Head", slots: ["head"], focus: "head" },
  { id: "face", label: "Face", slots: [], focus: "head" },
  { id: "hair", label: "Hair", slots: ["hair"], focus: "head" },
  { id: "torso", label: "Torso", slots: ["torso"], focus: "torso" },
  { id: "arms", label: "Arms", slots: ["arms"], focus: "torso" },
  { id: "hands", label: "Hands", slots: ["hands"], focus: "hand" },
  { id: "legs", label: "Legs", slots: ["legs"], focus: "legs" },
  { id: "feet", label: "Feet", slots: ["feet"], focus: "feet" },
  { id: "ears", label: "Ears", slots: ["ears"], focus: "head" },
  { id: "tail", label: "Tail", slots: ["tail"], focus: "tail" },
  { id: "wings", label: "Wings", slots: ["wings"], focus: "torso" },
  { id: "horns", label: "Horns", slots: ["horns", "spines"], focus: "head" },
  { id: "clothing", label: "Clothing", slots: ["clothing"], focus: "all" },
  { id: "accessories", label: "Accessories", slots: [], focus: "all" },
  { id: "materials", label: "Materials", slots: [], focus: "all" },
  { id: "pose", label: "Pose", slots: [], focus: "all" },
  { id: "presets", label: "Presets", slots: [], focus: "all" },
];
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const SLOT_LABEL = { body: "Body type", head: "Head", hair: "Hair", torso: "Torso", arms: "Arms", hands: "Hands", legs: "Legs", feet: "Feet", ears: "Ears", tail: "Tail", wings: "Wings", horns: "Horns", spines: "Crest and spines", clothing: "Outfit" };

// Which slots each style exposes, and the default part for each.
export const SLOTS_BY_STYLE = {
  human: ["body", "head", "hair", "torso", "arms", "hands", "legs", "feet", "clothing"],
  creature: ["body", "head", "torso", "arms", "hands", "legs", "feet", "ears", "tail", "wings", "horns", "spines", "clothing"],
  mix: ["body", "head", "hair", "torso", "arms", "hands", "legs", "feet", "ears", "tail", "wings", "horns", "spines", "clothing"],
  kamiji: [], kamikin: ["body"], rubbernose: ["body", "hands", "feet"], shapes: ["body"],
};

// Regions (materials/colours). Each mesh is tagged with one.
export const REGIONS = {
  human: [["skin", "Skin"], ["hair", "Hair"], ["cloth", "Outfit"], ["cloth2", "Outfit trim"], ["accent", "Shoes and accents"], ["eye", "Eyes"]],
  creature: [["skin", "Body"], ["hair", "Fur / belly"], ["cloth", "Outfit"], ["cloth2", "Outfit trim"], ["accent", "Horns, claws, wings"], ["eye", "Eyes"]],
  kamikin: [["MochiBody", "Body"]],
  rubbernose: [["Clay", "Body"], ["Accent", "Accent"], ["Arm", "Arms"], ["Leg", "Legs"], ["Glove", "Gloves"], ["Shoe", "Shoes"], ["Ink", "Ink and lines"]],
  shapes: [["Clay", "Body"]],
  kamiji: [["HandSkin", "Hand"]],
};
REGIONS.mix = REGIONS.creature;

export const PALETTES = [
  { id: "sand", label: "Sand", c: { skin: "#e8c39e", hair: "#4a3426", cloth: "#4f6d8c", cloth2: "#e7e6e1", accent: "#8a5a3c", eye: "#2a2224" } },
  { id: "umber", label: "Umber", c: { skin: "#8d5a3b", hair: "#1d1b1a", cloth: "#c4533c", cloth2: "#f1e2c4", accent: "#2f3340", eye: "#1d1b1a" } },
  { id: "rose", label: "Rose", c: { skin: "#f4d3c2", hair: "#c9732e", cloth: "#6b4f8d", cloth2: "#f4d36a", accent: "#2f3340", eye: "#3a5d7a" } },
  { id: "moss", label: "Moss", c: { skin: "#a8c48a", hair: "#3f5a35", cloth: "#d9a066", cloth2: "#f7f3ea", accent: "#5a3e2a", eye: "#2a2224" } },
  { id: "ink", label: "Ink", c: { skin: "#d9d6cd", hair: "#2b2b29", cloth: "#2b2b29", cloth2: "#9a988f", accent: "#e5534b", eye: "#1d1d1b" } },
  { id: "sky", label: "Sky", c: { skin: "#9fc7e8", hair: "#f7f3ea", cloth: "#e9a23a", cloth2: "#ffffff", accent: "#4a5f8a", eye: "#1d1d1b" } },
  { id: "ember", label: "Ember", c: { skin: "#d9573c", hair: "#f2b84b", cloth: "#2f3340", cloth2: "#f2b84b", accent: "#2b2b29", eye: "#f7f3ea" } },
  { id: "mint", label: "Mint", c: { skin: "#bfe3cf", hair: "#7a5cff", cloth: "#ff7eb6", cloth2: "#ffffff", accent: "#4a5f8a", eye: "#2a2224" } },
];

export const ROOMS = {
  studio: { label: "Studio", bg: "#e7e6e1", light: "soft" },
  paper: { label: "Paper", bg: "#f3f1ea", light: "soft" },
  grey: { label: "Grey", bg: "#a9a8a2", light: "hard" },
  night: { label: "Night", bg: "#2b2b29", light: "rim" },
  dusk: { label: "Dusk", bg: "#5a4a58", light: "dusk" },
};
export const LIGHTS = { soft: "Soft", hard: "Hard side", rim: "Rim", dusk: "Dusk" };
export const LOOKS = [["jitter", "Jitter (line boil)"], ["pencil", "Pencil"], ["retro print", "Retro print"], ["toon", "Toon edges"]];
export const EXPRESSIONS = ["neutral", "happy", "excited", "thinking", "sad", "angry", "surprised", "sleepy"];
export const FACE_RIGS = [["classic", "Classic (eyes + mouth meshes)"], ["rtk", "RTK mouth (decal)"], ["tube", "Tube face (decal)"]];

// Sockets: where accessories attach. `frame` sockets use the head frame (accessories are modelled for a unit head).
export const SOCKETS = [
  { id: "head", label: "Head", frame: true }, { id: "face", label: "Face", frame: true }, { id: "ears", label: "Ears", frame: true },
  { id: "hair", label: "Hair clip", frame: true }, { id: "neck", label: "Neck", frame: true },
  { id: "back", label: "Back" }, { id: "hand_L", label: "Left hand" }, { id: "hand_R", label: "Right hand" },
  { id: "waist", label: "Waist" }, { id: "feet", label: "Feet" }, { id: "tail", label: "Tail" },
];
export const SOCKET_BY_ID = Object.fromEntries(SOCKETS.map((s) => [s.id, s]));

// Held props (real GLBs from assets/props/objects) and procedural wearables for the non-head sockets.
export const HELD = ["apple", "book", "coffee", "camera", "key_obj", "trophy", "gift", "balloon", "lightbulb_on", "gem", "palette", "pizza", "globe", "rocket"];
export const PROC_ACC = [
  { id: "p_backpack", label: "Backpack", socket: "back" }, { id: "p_cape", label: "Cape", socket: "back" }, { id: "p_jetpack", label: "Jetpack", socket: "back" },
  { id: "p_belt", label: "Belt", socket: "waist" }, { id: "p_sash", label: "Sash", socket: "waist" },
  { id: "p_anklets", label: "Anklets", socket: "feet" }, { id: "p_tailbow", label: "Tail ribbon", socket: "tail" }, { id: "p_tailbell", label: "Tail bell", socket: "tail" },
];

export const POSES = {
  proc: ["idle", "wave", "walk", "run", "jump", "cheer", "sit", "tpose"],
  kamikin: ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"],
  rubbernose: ["idle", "strut", "run", "wave", "charleston", "cheer", "point", "shrug", "thumbs-up"],
  kamiji: ["Idle", "Wave", "Think", "Celebrate"],
  shapes: [],
};

// ---------------------------------------------------------------------------------------------------------------
// Morph definitions. v in [min, max], default def. `styles`: which engines show them. `real`: a GPU morph target on
// the head mesh (exported to GLB); everything else rebuilds proportions (baked into node transforms on export).
// ---------------------------------------------------------------------------------------------------------------
const bi = (id, label, group, extra = {}) => ({ id, label, group, min: -1, max: 1, def: 0, step: 0.01, ...extra });
const uni = (id, label, group, extra = {}) => ({ id, label, group, min: 0, max: 1, def: 0.5, step: 0.01, ...extra });
export const MORPHS = [
  bi("height", "Height", "Proportions", { styles: ["proc"] }),
  bi("build", "Build (slim to heavy)", "Proportions", { styles: ["proc"] }),
  bi("shoulderW", "Shoulder width", "Proportions", { styles: ["proc"] }),
  bi("hipW", "Hip width", "Proportions", { styles: ["proc"] }),
  bi("torsoLen", "Torso length", "Proportions", { styles: ["proc"] }),
  bi("neckLen", "Neck length", "Proportions", { styles: ["proc"] }),
  bi("headSize", "Head size", "Proportions", { styles: ["proc"] }),
  bi("armLenL", "Arm length, left", "Limbs", { styles: ["proc"], pair: "armLenR", slot: "arms" }),
  bi("armLenR", "Arm length, right", "Limbs", { styles: ["proc"], pair: "armLenL", slot: "arms" }),
  bi("legLenL", "Leg length, left", "Limbs", { styles: ["proc"], pair: "legLenR" }),
  bi("legLenR", "Leg length, right", "Limbs", { styles: ["proc"], pair: "legLenL" }),
  bi("handSize", "Hand size", "Limbs", { styles: ["proc"], slot: "hands" }),
  bi("footSize", "Foot size", "Limbs", { styles: ["proc"], slot: "feet" }),
  bi("cranium", "Cranium height", "Head shape", { styles: ["proc"], real: 0 }),
  bi("width", "Head width", "Head shape", { styles: ["proc"], real: 1 }),
  bi("jaw", "Jaw width", "Head shape", { styles: ["proc"], real: 2 }),
  bi("chin", "Chin point", "Head shape", { styles: ["proc"], real: 3 }),
  bi("cheeks", "Cheek fullness", "Head shape", { styles: ["proc"], real: 4 }),
  bi("brow", "Brow ridge", "Head shape", { styles: ["proc"], real: 5 }),
  bi("eyeSize", "Eye size", "Face features", { styles: ["proc"] }),
  bi("eyeGap", "Eye spacing", "Face features", { styles: ["proc"] }),
  bi("eyeY", "Eye height", "Face features", { styles: ["proc"] }),
  bi("mouthY", "Mouth height", "Face features", { styles: ["proc"] }),
  bi("snoutLen", "Snout length", "Creature", { styles: ["proc"], only: ["creature", "mix"] }),
  bi("bodyLen", "Body length", "Creature", { styles: ["proc"], only: ["creature", "mix"] }),
  bi("tailLen", "Tail length", "Creature", { styles: ["proc"], slot: "tail" }),
  bi("earL", "Ear size, left", "Creature", { styles: ["proc"], pair: "earR", slot: "ears" }),
  bi("earR", "Ear size, right", "Creature", { styles: ["proc"], pair: "earL", slot: "ears" }),
  bi("hornSize", "Horn size", "Creature", { styles: ["proc"], slot: "horns" }),
  bi("wingSpan", "Wing span", "Creature", { styles: ["proc"], slot: "wings" }),
  // Kamiji hand (real morph targets of kamiji.glb)
  uni("shapeSphere", "Hand to sphere", "Shape", { styles: ["kamiji"], def: 0, target: true }),
  uni("shapeCube", "Sphere to cube", "Shape", { styles: ["kamiji"], def: 0, target: true }),
  uni("mouthSmile", "Smile", "Face", { styles: ["kamiji"], def: 0, target: true }),
  uni("mouthFrown", "Frown", "Face", { styles: ["kamiji"], def: 0, target: true }),
  uni("mouthOpen", "Mouth open", "Face", { styles: ["kamiji"], def: 0, target: true }),
  uni("mouthO", "Mouth O", "Face", { styles: ["kamiji"], def: 0, target: true }),
  uni("eyeBlinkLeft", "Blink, left", "Eyes", { styles: ["kamiji"], def: 0, target: true, pair: "eyeBlinkRight" }),
  uni("eyeBlinkRight", "Blink, right", "Eyes", { styles: ["kamiji"], def: 0, target: true, pair: "eyeBlinkLeft" }),
  uni("eyeWideLeft", "Eye wide, left", "Eyes", { styles: ["kamiji"], def: 0, target: true, pair: "eyeWideRight" }),
  uni("eyeWideRight", "Eye wide, right", "Eyes", { styles: ["kamiji"], def: 0, target: true, pair: "eyeWideLeft" }),
  uni("browUpLeft", "Brow up, left", "Brows", { styles: ["kamiji"], def: 0, target: true, pair: "browUpRight" }),
  uni("browUpRight", "Brow up, right", "Brows", { styles: ["kamiji"], def: 0, target: true, pair: "browUpLeft" }),
  uni("browAngryLeft", "Brow angry, left", "Brows", { styles: ["kamiji"], def: 0, target: true, pair: "browAngryRight" }),
  uni("browAngryRight", "Brow angry, right", "Brows", { styles: ["kamiji"], def: 0, target: true, pair: "browAngryLeft" }),
  // Shapes: 34 real morph targets, shown as sliders in a few groups
];
export const SHAPE_TARGETS = ["cube_rounded", "bean", "drop", "star_body", "heart_body", "cloud_body", "ghost", "blob", "mochi_bun", "pill", "triangle_rounded", "egg", "onigiri", "dango", "mushroom", "flower", "moon_crescent", "sun_disc", "cat_head", "bunny_head", "bear_head", "fox_head", "jellyfish", "daruma", "bell", "acorn", "pear", "leaf_blob", "diamond_rounded", "hexagon_rounded", "octagon_rounded", "speech_blob", "shield_blob", "crown_blob"];
const SHAPE_GROUP = (n) => (/head$/.test(n) ? "Animal heads" : ["drop", "blob", "ghost", "jellyfish", "mochi_bun", "bean", "cloud_body"].includes(n) ? "Soft and slimy" : ["star_body", "heart_body", "flower", "moon_crescent", "sun_disc", "leaf_blob"].includes(n) ? "Symbols" : "Solids and objects");
for (const n of SHAPE_TARGETS) MORPHS.push(uni("sh_" + n, n.replace(/_/g, " "), SHAPE_GROUP(n), { styles: ["shapes"], def: 0, target: n }));
export const MORPH_BY_ID = Object.fromEntries(MORPHS.map((m) => [m.id, m]));

// Per-body-type proportion multipliers (Human). Creature body plans live in parts.js.
export const SHORTCUT_NOTE = "Slider values are stored per character. Locked groups are skipped by Randomise.";

export const emptyCharacter = (style = "human") => ({
  schema: SCHEMA, name: "Untitled", style,
  parts: {}, morphs: {}, materials: {}, accessories: [], face: { rig: "classic", expression: "neutral" },
  pose: { clip: "idle" }, look: { effects: [], room: "studio", outline: true, steps: 3 },
});

// Default part per slot when a character does not name one (the first part of the slot otherwise).
export const DEFAULT_PARTS = {
  human: { body: "average", head: "round", hair: "crop", torso: "standard", arms: "standard", hands: "mitten", legs: "standard", feet: "shoe", clothing: "tee" },
  creature: { body: "c_biped", head: "c_cat", torso: "c_belly", arms: "standard", hands: "paw", legs: "c_fur", feet: "paw", ears: "cat", tail: "cat", wings: "none", horns: "none", spines: "none", clothing: "none" },
  mix: { body: "average", head: "round", hair: "crop", torso: "standard", arms: "standard", hands: "mitten", legs: "standard", feet: "shoe", ears: "none", tail: "none", wings: "none", horns: "none", spines: "none", clothing: "tee" },
};
