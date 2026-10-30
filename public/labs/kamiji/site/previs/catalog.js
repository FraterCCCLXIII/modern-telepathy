// Catalog of things a scene can contain, and the scene presets offered by "Add node".
// All URLs point at the repository's existing GLBs under assets/. Nothing is copied.
const A = new URL("../../assets/", import.meta.url).href;

const mochi = ["player", "kumo", "kon", "hana", "shizuku", "koke", "chochin", "pip"];
const rubber = ["joe", "appy", "bowie", "puddin", "sunny", "rocko", "binky", "fizz", "rubby", "dinger", "bulby", "puff", "lockie", "candi", "champ", "tick"];
const objects = ["apple", "balloon", "book", "cake", "camera", "coffee", "crown", "gem", "gift", "globe", "key_obj", "lightbulb_on", "palette", "pizza", "rocket", "trophy"];
const emotes = ["heart", "star", "music_note", "sparkle", "fire", "check"];
const label = (s) => s.replace(/_obj$|_on$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const CHARS = [
  { id: "kamiji", label: "Kamiji hand", group: "Kamiji", url: A + "kamiji.glb", size: 1.5, rigged: true, clips: ["Idle", "Wave", "Think", "Celebrate"] },
  ...mochi.map((n) => ({ id: "mochi/" + n, label: "Kamikin " + n, group: "Kamikin", url: `${A}mochi/kamikin-${n}.glb`, size: 1.5, rigged: true, head: "head",
    clips: ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"] })),
  ...rubber.map((n) => ({ id: "rubbernose/" + n, label: "Rubbernose " + n, group: "Rubbernose", url: `${A}rubbernose/rubbernose-${n}.glb`, size: 1.7, rigged: true,
    clips: ["idle", "strut", "run", "wave", "charleston", "cheer", "point", "shrug", "thumbs-up"] })),
  ...objects.map((n) => ({ id: "obj/" + n, label: label(n), group: "Objects", url: `${A}props/objects/${n}.glb`, size: 0.7 })),
  ...emotes.map((n) => ({ id: "prop/" + n, label: label(n), group: "Emote props", url: `${A}props/${n}.glb`, size: 0.6 })),
  { id: "morph", label: "Shapes morph", group: "Shapes", url: A + "props/shapes/kamiji-shapes-morph.glb", size: 1.3, morph: true },
];
export const CHAR_BY_ID = new Map(CHARS.map((c) => [c.id, c]));
export const ACCESSORY_INDEX = A + "props/accessories/index.json";
export const ACCESSORY_DIR = A + "props/accessories/";

export const LIGHTS = { soft: "Soft", hard: "Hard side", rim: "Rim", dusk: "Dusk" };
export const BG_SWATCHES = ["#e7e6e1", "#d9d8d1", "#f3f1ea", "#c9c8c1", "#2b2b29", "#8b8a84"];
export const SHOT_TYPES = ["WS", "MS", "MCU", "CU", "ECU", "OTS", "2S", "POV", "TOP"];
export const MOVES = ["Static", "Push in", "Pull out", "Pan", "Orbit", "Crane up", "Track"];
export const EASES = ["linear", "ease in-out", "ease in", "ease out"];
export const CAM_PRESETS = ["Front", "3/4", "Low", "High", "Close", "Wide", "Top"];

// Hand-tuned cameras for the normalised scene sizes (characters about 1.5 to 1.7 tall, centred on x = 0).
const cam1 = { p: [0, 1.0, 4.4], t: [0, 0.8, 0], fov: 35 };
const cam2 = { p: [0, 1.15, 6.4], t: [0, 0.8, 0], fov: 35 };
const camProps = { p: [0, 1.0, 4.2], t: [0, 0.35, 0], fov: 35 };
export const PRESETS = [
  { id: "hand-wave", label: "Kamiji hand wave", note: "One rigged hand, Wave clip", cast: [{ ref: "kamiji", anim: "Wave" }], bg: "#e7e6e1", light: "soft", cam: cam1, shotType: "MS" },
  { id: "kamikin-duo", label: "Kamikin duo", note: "Two mochi friends", cast: [{ ref: "mochi/kumo", anim: "idle" }, { ref: "mochi/kon", anim: "wave" }], bg: "#d9d8d1", light: "soft", cam: cam2, shotType: "2S" },
  { id: "rubbernose-dance", label: "Rubbernose dance", note: "Charleston, two characters", cast: [{ ref: "rubbernose/joe", anim: "charleston" }, { ref: "rubbernose/candi", anim: "charleston" }], bg: "#f3f1ea", light: "rim", cam: { p: [0, 1.1, 7.0], t: [0, 0.85, 0], fov: 35 }, shotType: "WS" },
  { id: "still-life", label: "Prop still-life", note: "Objects on a ground plane", cast: [{ ref: "obj/book" }, { ref: "obj/coffee" }, { ref: "obj/apple" }], bg: "#c9c8c1", light: "hard", cam: camProps, shotType: "CU" },
  { id: "shapes-morph", label: "Shapes morph", note: "One mesh, 34 morph targets", cast: [{ ref: "morph" }], bg: "#2b2b29", light: "rim", cam: { p: [0, 0.9, 4.0], t: [0, 0.65, 0], fov: 35 }, shotType: "MS" },
];
export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

// Models the user dropped in this session (kept in memory as blob URLs). The project stores only their metadata.
export function registerUserModel({ id, name, url, rigged = false, clips = [] }) {
  const def = { id, label: name, group: "Imported", url, size: 1.5, rigged, clips, user: true };
  const i = CHARS.findIndex((c) => c.id === id); if (i >= 0) CHARS[i] = def; else CHARS.push(def);
  CHAR_BY_ID.set(id, def); return def;
}
