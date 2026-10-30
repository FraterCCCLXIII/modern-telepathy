// Kamikin studio: pick one of the 14 mochi and set face state, clip, tint,
// outline, toon and a halo. Mirrors the KamijiMochi props.
import {
  mountStudio, ASSETS, TINTS, reduceMotion, jsxElement, jsxList, shadowProps, lookProps, lookLayers, LOOK_DEFAULTS,
} from "./shared.js";

const FACES = ["neutral", "blink", "happy", "joy", "surprised", "sad"];
const CLIPS = ["idle", "walk", "run", "hop", "happy", "wave", "sad", "sit", "dance"];
const OPTS = (arr) => arr.map((v) => ({ v, l: v }));

async function loadIndex() {
  try { return (await (await fetch(`${ASSETS}mochi/index.json`)).json()).characters; }
  catch (err) { console.warn("Kamiji workshop: mochi index missing", err); return []; }
}

async function createMochi({ engine, stage, state }) {
  const { THREE, SkeletonUtils } = engine;
  const id = state.character;
  const gltf = await engine.load(`${ASSETS}mochi/${id}.glb`);
  const root = SkeletonUtils.clone(gltf.scene);
  const outer = new THREE.Group();
  outer.add(root);
  const bodyMats = [];
  let faceMat = null;
  root.traverse((n) => {
    if (!n.isMesh) return;
    n.frustumCulled = false;
    const src = n.material;
    n.material = src.clone();
    if (src.name === "face") faceMat = n.material; else if (src.name === "body") bodyMats.push(n.material);
  });
  const faceDef = gltf.parser.json.materials.find((x) => x.name === "face");
  const texIdx = faceDef?.extras?.faceStates || {};
  const textures = new Map();
  let face = null, token = 0;
  async function setFace(name) {
    if (!faceMat || texIdx[name] == null || name === face) return;
    face = name;
    const my = ++token;
    if (!textures.has(name)) {
      const tex = await gltf.parser.getDependency("texture", texIdx[name]);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.set(name, tex);
    }
    if (my !== token) return;
    faceMat.map = textures.get(name); faceMat.needsUpdate = true;
    stage.invalidate();
  }

  const mixer = new THREE.AnimationMixer(root);
  let action = null, clipName = null;
  function setClip(name) {
    if (name === clipName) return;
    const clip = gltf.animations.find((c) => c.name === name) || gltf.animations[0];
    if (!clip) return;
    clipName = name;
    const next = mixer.clipAction(clip);
    if (action && action !== next) action.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    action = next;
  }
  setClip("idle");
  mixer.update(0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());

  let want = "neutral", blinkAt = 1.5 + Math.random() * 3, blinkUntil = 0, t = 0, blinking = false;
  const model = {
    root: outer, center, edge: Math.max(size.x, size.y), floor: box.min.y,
    apply(s) {
      want = s.face;
      bodyMats.forEach((m) => { try { m.color.set(s.tint); } catch { m.color.set("#ffffff"); } });
      setClip(s.clip);
      if (!blinking) setFace(want);
      if (reduceMotion) mixer.update(0.5);
    },
    tick(dt) {
      t += dt;
      if (!reduceMotion && want === "neutral") {
        if (!blinking && t > blinkAt) { blinking = true; blinkUntil = t + 0.12; blinkAt = t + 2 + Math.random() * 3; setFace("blink"); }
        else if (blinking && t > blinkUntil) { blinking = false; setFace(want); }
      } else if (blinking) { blinking = false; setFace(want); }
      if (dt > 0) mixer.update(dt);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); bodyMats.forEach((m) => m.dispose()); faceMat?.dispose(); },
  };
  model.apply(state);
  return model;
}

mountStudio(async () => {
  const index = await loadIndex();
  const chars = index.length ? index : [{ id: "kamikin-hana", name: "hana", species: "fawn" }];
  const byId = new Map(chars.map((c) => [c.id, c]));
  return {
    id: "kamikin",
    title: "Kamikin studio",
    blurb: "Pick a Kamikin mochi and copy it as a KamijiMochi.",
    note: "Approximate here: the library draws the halo in separate canvases and the face decal gets no outline hull (the body silhouette does). Tint is a multiply on the body colour, so it darkens or shifts and never brightens.",
    defaults: { character: chars.find((c) => c.id === "kamikin-hana")?.id || chars[0].id, face: "happy", clip: "idle", tint: "#ffffff", ...LOOK_DEFAULTS, halo: [], haloArr: "arc" },
    layers: [
      { key: "character", title: "Kamikin", type: "pills", options: chars.map((c) => ({ v: c.id, l: `${c.name}${c.species ? ` · ${c.species}` : ""}` })) },
      { key: "face", title: "Face state", type: "pills", options: OPTS(FACES) },
      { key: "clip", title: "Animation clip", type: "pills", options: OPTS(CLIPS) },
      { key: "tint", title: "Tint (multiply)", type: "swatches", options: ["#ffffff", ...TINTS], note: "White leaves the baked colours alone." },
      ...lookLayers(),
      { key: "halo", title: "Halo emoji", type: "emoji", max: 3 },
      { key: "haloArr", title: "Halo arrangement", type: "pills", options: OPTS(["arc", "orbit", "burst"]), when: (s) => s.halo.length > 0 },
    ],
    modelKey: (s) => s.character,
    halo: { key: "halo", arrangementKey: "haloArr", max: 3 },
    createModel: createMochi,
    describe: (s) => `Live 3D ${byId.get(s.character)?.name || "Kamikin"}, a Kamikin mochi, ${s.face} face, ${s.clip} clip`,
    code(s) {
      const props = [`character="${s.character}"`, `face="${s.face}"`, `animation="${s.clip}"`];
      if (s.tint.toLowerCase() !== "#ffffff") props.push(`color="${s.tint}"`);
      props.push(...lookProps(s), ...shadowProps(s), "size={240}");
      const wrapped = s.halo.length;
      const el = jsxElement("KamijiMochi", props, wrapped ? 1 : 0);
      const body = wrapped ? jsxElement("KamijiHaloAny", [`halo={${jsxList(s.halo)}}`, `arrangement="${s.haloArr}"`, "size={240}"], 0, el) : el;
      const jsx = `import { KamijiMochi${wrapped ? ", KamijiHaloAny" : ""} } from "./vendor/kamiji/src";\n\nexport function MyKamikin() {\n  return (\n${body.split("\n").map((l) => `    ${l}`).join("\n")}\n  );\n}\n`;
      return { jsx, json: JSON.stringify({ studio: "kamikin", component: "KamijiMochi", character: s }, null, 2) };
    },
  };
});
