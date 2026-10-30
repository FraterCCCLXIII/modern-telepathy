// Emoji studio: a character made from one 3D face prop. The expression table
// and the procedural animations are ported from
// src/kamiji-emoji-character-logic.ts (KamijiEmojiCharacter).
import {
  mountStudio, TINTS, reduceMotion, jsxElement, jsxList, shadowProps, lookProps, lookLayers, LOOK_DEFAULTS, makeProp,
} from "./shared.js";

const EXPRESSION_FACES = {
  neutral: "face_neutral", happy: "face_smile", excited: "face_grin", thinking: "face_thinking",
  sad: "face_sad", angry: "face_angry", surprised: "face_surprised", sleepy: "face_sleepy",
};
const ANIMATIONS = ["none", "idle", "bounce", "squash", "wobble", "spin", "shake", "hop", "nod"];
const TAU = Math.PI * 2;
const OPTS = (arr, l = (x) => x) => arr.map((v) => ({ v, l: l(v) }));

const landing = (u, span) => Math.max(0, 1 - u / span) + Math.max(0, 1 - (1 - u) / (span * 0.4)) * 0.6;
const REST = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
function poseAt(animation, t) {
  if (reduceMotion || animation === "none" || animation === "spin") return REST;
  switch (animation) {
    case "idle": { const b = Math.sin((t * TAU) / 3.2); return { x: 0, y: -0.022 * Math.sin((t * TAU) / 2.4), scaleX: 1 - 0.014 * b, scaleY: 1 + 0.028 * b, rotate: 0 }; }
    case "bounce": { const u = (t / 0.9) % 1, k = landing(u, 0.16); return { x: 0, y: -0.22 * 4 * u * (1 - u), scaleX: 1 + 0.14 * k, scaleY: 1 - 0.18 * k, rotate: 0 }; }
    case "squash": { const s = Math.sin((t * TAU) / 1.1); return { x: 0, y: 0, scaleX: 1 + 0.13 * s, scaleY: 1 - 0.13 * s, rotate: 0 }; }
    case "wobble": return { ...REST, rotate: 10 * Math.sin((t * TAU) / 1.3) * Math.cos((t * TAU) / 5) };
    case "shake": { const c = t % 2, e = c < 0.8 ? Math.sin((c / 0.8) * Math.PI) : 0; return { ...REST, x: 0.045 * e * Math.sin(t * TAU * 8), rotate: 3 * e * Math.sin(t * TAU * 8 + 1) }; }
    case "hop": {
      const u = (t / 1.5) % 1, air = u < 0.42 ? Math.sin((u / 0.42) * Math.PI) : 0;
      const k = u < 0.42 ? 0 : landing(u - 0.42, 0.14) * (u - 0.42 < 0.14 ? 1 : 0);
      return { x: 0.02 * air, y: -0.3 * air, scaleX: 1 - 0.06 * air + 0.12 * k, scaleY: 1 + 0.08 * air - 0.16 * k, rotate: 6 * air };
    }
    case "nod": { const c = t % 2.4, dip = c < 1.2 ? Math.sin((c / 1.2) * TAU) ** 2 * (c < 0.6 ? 1 : 0.8) : 0; return { x: 0, y: 0.05 * dip, scaleX: 1, scaleY: 1 - 0.04 * dip, rotate: 7 * dip }; }
    default: return REST;
  }
}
function blinkScale(t, seed) {
  const period = 3.8 + (Math.abs(seed) % 7) * 0.2, phase = (t + seed * 0.37) % period;
  return phase >= 0.16 ? 1 : 1 - 0.55 * Math.sin((phase / 0.16) * Math.PI);
}

async function createEmoji({ engine, catalog, state }) {
  const { THREE } = engine;
  const entry = catalog.byId.get(state.face);
  const prop = await makeProp(engine, entry, state.tint);
  const outer = new THREE.Group();
  const mover = new THREE.Group(); // pivot at the bottom edge, like transform-origin 50% 100%
  mover.position.set(0, -0.5, 0);
  const blinker = new THREE.Group(); // blink squashes about 62% down from the top
  blinker.position.set(0, 0.38, 0);
  prop.object.position.set(0, 0.12, 0);
  prop.object.rotation.set(0.14, -0.45, 0);
  blinker.add(prop.object); mover.add(blinker); outer.add(mover);
  const seed = Math.floor(Math.random() * 1000);
  let t = 0, spinY = -0.45, S = state;
  return {
    root: outer, center: new THREE.Vector3(0, 0, 0), edge: 1, floor: -0.5, margin: 1.8, // headroom for hop and bounce
    apply(s) { S = s; prop.setTint(s.tint); if (reduceMotion) this.tick(0); },
    tick(dt) {
      t += dt;
      const p = poseAt(S.animation, t);
      mover.position.set(p.x, -0.5 - p.y, 0);
      mover.rotation.z = -(p.rotate * Math.PI) / 180;
      mover.scale.set(p.scaleX, p.scaleY, p.scaleX);
      blinker.scale.y = S.blink && !reduceMotion ? blinkScale(t, seed) : 1;
      if (S.animation === "spin" && !reduceMotion) { spinY += dt * 1.4; prop.object.rotation.y = spinY; }
      else { spinY = -0.45; prop.object.rotation.y = -0.45; }
    },
    dispose() { prop.inner.traverse((n) => n.isMesh && n.material.dispose()); },
  };
}

mountStudio(async ({ catalog }) => {
  const faces = catalog.entries.filter((e) => e.group === "faces");
  return {
    id: "emoji",
    title: "Emoji studio",
    blurb: "Make a character from a 3D face and copy it as a KamijiEmojiCharacter.",
    note: "Approximate here: the library animates the emoji with CSS transforms on a flat canvas, this editor moves the 3D object with the same curves. Accessory emoji are in-scene 3D, and outline and toon also apply to them, as they do through KamijiToonProvider.",
    defaults: { expression: "happy", face: "face_smile", tint: TINTS[0], animation: "bounce", blink: true, ...LOOK_DEFAULTS, halo: [], haloArr: "arc" },
    layers: [
      { key: "expression", title: "Expression", type: "pills", options: OPTS(Object.keys(EXPRESSION_FACES)), note: "Picks the matching face from the table. Face below wins, as in the library.", pick: (v) => ({ expression: v, face: EXPRESSION_FACES[v] }) },
      { key: "face", title: "Face", type: "pills", options: faces.map((f) => ({ v: f.id, l: f.label, dot: f.tint })) },
      { key: "tint", title: "Tint (Clay material)", type: "swatches", options: TINTS, note: "Eyes and mouth keep their baked colours." },
      { key: "animation", title: "Animation", type: "pills", options: OPTS(ANIMATIONS) },
      { key: "blink", title: "Blink", type: "toggle", randomOn: 0.7 },
      ...lookLayers(),
      { key: "halo", title: "Accessory emoji", type: "emoji", max: 3, groups: ["root", "objects", "symbols", "shapes", "faces"], note: "Placed around the head." },
      { key: "haloArr", title: "Accessory arrangement", type: "pills", options: OPTS(["arc", "orbit", "burst"]), when: (s) => s.halo.length > 0 },
    ],
    modelKey: (s) => s.face,
    halo: { key: "halo", arrangementKey: "haloArr", max: 3 },
    haloToon: true,
    createModel: createEmoji,
    describe: (s) => `Live 3D emoji character, ${s.face.replace("face_", "").replace(/_/g, " ")} face, ${s.animation} animation`,
    code(s) {
      const props = [EXPRESSION_FACES[s.expression] === s.face ? `expression="${s.expression}"` : `face="${s.face}"`, `animation="${s.animation}"`, `color="${s.tint}"`];
      if (!s.blink) props.push("blink={false}");
      if (s.halo.length) props.push(`halo={${jsxList(s.halo)}}`, `haloArrangement="${s.haloArr}"`);
      props.push(...shadowProps(s), "size={240}");
      const look = lookProps(s);
      const inner = jsxElement("KamijiEmojiCharacter", props, look.length ? 1 : 0);
      const body = look.length ? jsxElement("KamijiToonProvider", look, 0, inner) : inner;
      const jsx = `${s.shadow ? "// Note: KamijiEmojiCharacter has no shadow prop in src yet, so this prop is the intended shape.\n" : ""}import { KamijiEmojiCharacter${look.length ? ", KamijiToonProvider" : ""} } from "./vendor/kamiji/src";\n\nexport function MyEmojiCharacter() {\n  return (\n${body.split("\n").map((l) => `    ${l}`).join("\n")}\n  );\n}\n`;
      return { jsx, json: JSON.stringify({ studio: "emoji", component: "KamijiEmojiCharacter", character: s }, null, 2) };
    },
  };
});
