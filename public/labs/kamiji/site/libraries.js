// Library browser for the "Live gallery" section.
//
// TO ADD A LIBRARY: push one object onto LIBRARIES below.
//   id           unique, used in the URL hash (#lib=<id>)
//   label        list text
//   group        list heading (libraries with the same group are listed together)
//   description  one honest sentence under the title
//   count        number shown in the badge (corrected to the real count once loaded)
//   load(api)    async, returns items [{ id, name, keywords?, ... }]
//   tile(item)   returns { name, sub, aria } for the tile caption
//   make(api, item, viewer, color, opts) returns a content object
//                { attach(), dispose(), setColor(hex) }  (opts.live = keep it moving)
// Optional: tintable (default true), note, logo, onClick(api, tile) to replace the
// default "open the detail card", toHero(api, item, color), noHero, detail(item).
// Everything else (list, search, tint row, lazy tiles, card, hash) is shared below.

import { createHandPoses, HAND_EMOJI } from "./hand-poses.js";

const ASSETS = "../assets/";

// ---- shared helpers ------------------------------------------------------
const jsonCache = new Map();
const getJson = (url) => {
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }));
  return jsonCache.get(url);
};
const glbCache = new Map();
const loadGlb = (api, url) => {
  if (!glbCache.has(url)) glbCache.set(url, api.loader.loadAsync(url));
  return glbCache.get(url);
};
async function propIndex(dir, filter = () => true) {
  const data = await getJson(`${ASSETS}props/${dir}index.json`);
  return data.filter(filter).map((p) => ({ id: p.name, url: `${ASSETS}props/${dir}${p.file}`, ...p }));
}
const pretty = (name, prefix = "") => name.replace(prefix, "").replace(/_/g, " ");
let handPoses = null;

// Props and shapes: static frame, spins on hover or focus (and always in the card).
// Only the material named "Clay" takes the tint; role materials keep their baked colours.
function propContent(api, v, item, color, opts = {}) {
  const { THREE } = api;
  const c = { disposed: false };
  const clay = [], own = [];
  let pivot = null;
  c.setColor = (col) => { color = col; clay.forEach((m) => m.color.set(col)); v.dirty = true; };
  c.attach = async () => {
    const gltf = await loadGlb(api, item.url);
    if (c.disposed) return;
    const root = gltf.scene.clone(true);
    root.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone(); own.push(n.material);
      if (n.material.name === "Clay") clay.push(n.material);
    });
    if (!clay.length) clay.push(...own); // a model with no Clay material: tint everything
    clay.forEach((m) => m.color.set(color));
    pivot = new THREE.Group();
    root.position.sub(new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));
    pivot.add(root); pivot.rotation.y = 0.45;
    v.scene.add(pivot); v.root = pivot;
    api.fit(v, pivot, 0, true);
    let t = 0.7;
    v.tick = (dt) => {
      // Sway rather than spin: a full turn shows flat props edge-on, which looks squashed.
      if ((opts.live || v.hover) && dt > 0) { t += dt; pivot.rotation.y = Math.sin(t * 0.9) * 0.7; return true; }
      return false;
    };
    v.dirty = true;
  };
  c.dispose = () => {
    c.disposed = true;
    if (pivot) v.scene.remove(pivot);
    own.forEach((m) => m.dispose());
    v.tick = null; v.root = null;
  };
  return c;
}

// The shapes morph model: sphere basis plus 11 absolute targets. Tweens sphere to
// each target and back, one at a time, as the model's own note describes.
function morphContent(api, v, item, color) {
  const { THREE } = api;
  const c = { disposed: false, onLabel: null };
  const mats = [];
  let pivot = null;
  c.setColor = (col) => { color = col; mats.forEach((m) => m.color.set(col)); v.dirty = true; };
  c.attach = async () => {
    const gltf = await loadGlb(api, item.url);
    if (c.disposed) return;
    const root = gltf.scene.clone(true);
    let mesh = null;
    root.traverse((n) => {
      if (!n.isMesh) return;
      n.material = n.material.clone(); mats.push(n.material);
      if (n.material.name === "Clay") n.material.color.set(color);
      if (n.morphTargetDictionary) mesh = n;
    });
    if (!mesh) throw new Error("no morph targets");
    const dict = mesh.morphTargetDictionary;
    const names = (item.morphTargets || Object.keys(dict)).filter((k) => k in dict);
    pivot = new THREE.Group(); pivot.add(root); pivot.rotation.y = 0.45;
    v.scene.add(pivot); v.root = pivot;
    api.fit(v, pivot, 0, true);
    v.camera.position.multiplyScalar(0.66); // fit counts the largest target; come closer so the sphere reads at tile size
    const HOLD = 0.5, MOVE = 0.9, CYCLE = HOLD + MOVE + 0.7 + MOVE;
    let t = 0, shown = -1;
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    v.tick = (dt) => {
      t += dt;
      const k = Math.floor(t / CYCLE) % names.length, s = t % CYCLE;
      const w = s < HOLD ? 0 : s < HOLD + MOVE ? ease((s - HOLD) / MOVE) : s < HOLD + MOVE + 0.7 ? 1 : 1 - ease((s - HOLD - MOVE - 0.7) / MOVE);
      mesh.morphTargetInfluences.fill(0);
      mesh.morphTargetInfluences[dict[names[k]]] = w;
      if (k !== shown) { shown = k; c.onLabel?.(`sphere to ${pretty(names[k])}`); }
      return dt > 0;
    };
    v.dirty = true;
  };
  c.dispose = () => {
    c.disposed = true;
    if (pivot) v.scene.remove(pivot);
    mats.forEach((m) => m.dispose());
    v.tick = null; v.root = null;
  };
  return c;
}

function propLibrary(o) {
  return {
    tintable: true,
    tile: (item) => ({
      name: pretty(item.name, o.strip), sub: o.sub(item),
      aria: `${pretty(item.name, o.strip)}, ${o.label} item: details`,
    }),
    make: (api, item, v, color, opts) => propContent(api, v, item, color, opts),
    async load() { return propIndex(o.dir, o.filter); },
    ...o,
  };
}

// Glyphlings: Greek letters from Courier New Regular, extruded with rounded edges, with eyes floating in their empty spaces.
// The outlines and eye positions come from assets/glyphlings/index.json (written by scripts/make-glyphlings.py).
// Every letter is a SkinnedMesh on a seven-bone spine running up its height, so it can bend like a rubber-hose character.
// The eyes are parented to the spine bone nearest them and ride along with the bend.
const GLYPH_BONES = 7;
function glyphlingContent(api, v, item, color, opts = {}) {
  const { THREE } = api;
  const c = { disposed: false, eyeSet: "dots", skeleton: null };
  const mats = [], geos = [];
  let pivot = null, bones = [], eyes = [];
  const DEPTH = 130;
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25, metalness: 0 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0 });
  const body = new THREE.MeshStandardMaterial({ color: color || item.colour, roughness: 0.55, metalness: 0 });
  mats.push(dark, white, body);
  let minY = Infinity, maxY = -Infinity;
  item.polys.forEach((r) => r[0].forEach(([, y]) => { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
  const spacing = (maxY - minY) / (GLYPH_BONES - 1);

  function buildEyes() {
    eyes.forEach((e) => { e.parent?.remove(e); });
    eyes = [];
    const set = c.eyeSet === "pills" ? item.pills : item.dots;
    set.forEach(([x, y, r]) => {
      const eye = new THREE.Group();
      if (c.eyeSet === "pills") {
        const w = r * 1.2, h = r * 2.7;
        const g = new THREE.CapsuleGeometry(w / 2, Math.max(h - w, 1), 8, 16); geos.push(g);
        const m = new THREE.Mesh(g, dark); m.scale.set(1, 1, 0.55); eye.add(m);
      } else {
        const g = new THREE.SphereGeometry(r, 24, 16); geos.push(g);
        const m = new THREE.Mesh(g, dark); m.scale.set(1, 1, 0.65); eye.add(m);
        const hg = new THREE.SphereGeometry(r * 0.3, 16, 12); geos.push(hg);
        const hl = new THREE.Mesh(hg, white); hl.position.set(r * 0.32, r * 0.34, r * 0.55); eye.add(hl);
      }
      const i = Math.max(0, Math.min(GLYPH_BONES - 1, Math.round((y - minY) / spacing)));   // nearest spine bone
      eye.position.set(x, y - (minY + i * spacing), 0);
      bones[i].add(eye); eyes.push(eye);
    });
    v.dirty = true;
  }
  c.setColor = (col) => { color = col; body.color.set(col || item.colour); v.dirty = true; };
  c.setEyes = (name) => { c.eyeSet = name; if (pivot) buildEyes(); };
  c.attach = async () => {
    try { await attachInner(); } catch (e) { console.error("Glyphlings attach failed", e); throw e; }
  };
  const attachInner = async () => {
    if (c.disposed) return;
    pivot = new THREE.Group();
    // the spine: a chain of bones, root at the letter's foot, each one a step higher than the last
    bones = [];
    for (let i = 0; i < GLYPH_BONES; i++) {
      const b = new THREE.Bone(); b.name = `spine${i}`;
      b.position.set(0, i === 0 ? minY : spacing, 0);
      if (i) bones[i - 1].add(b); else pivot.add(b);
      bones.push(b);
    }
    c.skeleton = new THREE.Skeleton(bones);
    pivot.updateMatrixWorld(true);
    item.polys.forEach((rings) => {
      const shape = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)));
      rings.slice(1).forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 18, bevelSize: 12, bevelSegments: 4, curveSegments: 6 });
      g.translate(0, 0, -DEPTH / 2); geos.push(g);
      // skin weights: each vertex blends the two spine bones either side of its height
      const pos = g.attributes.position, idx = new Uint16Array(pos.count * 4), wt = new Float32Array(pos.count * 4);
      for (let k = 0; k < pos.count; k++) {
        const t = Math.max(0, Math.min(GLYPH_BONES - 1.0001, (pos.getY(k) - minY) / spacing)), i0 = Math.floor(t), f = t - i0;
        idx[k * 4] = i0; idx[k * 4 + 1] = i0 + 1; wt[k * 4] = 1 - f; wt[k * 4 + 1] = f;
      }
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wt, 4));
      const mesh = new THREE.SkinnedMesh(g, body);
      mesh.frustumCulled = false;
      pivot.add(mesh);
      mesh.bind(c.skeleton);
    });
    v.scene.add(pivot); v.root = pivot;
    buildEyes();
    pivot.scale.setScalar(0.0022);   // the outlines are in font units (about 1000 wide); the viewers expect props about 2 units across
    pivot.rotation.y = 0.3;
    api.fit(v, pivot, 0, true);
    let t = 0.7, nextBlink = 2;
    const rest = () => bones.forEach((b, i) => { b.rotation.z = 0; b.scale.set(1, 1, 1); });
    v.tick = (dt) => {
      if (!(opts.live || v.hover) || dt <= 0) { if (bones.some((b) => b.rotation.z)) { rest(); return true; } return false; }
      t += dt;
      // rubber-hose idle: a bend that travels up the spine, a small squash and stretch at the foot, and a slow turn
      bones.forEach((b, i) => { b.rotation.z = Math.sin(t * 2.6 - i * 0.6) * 0.1 * (0.35 + i / GLYPH_BONES); });
      bones[0].scale.y = 1 + Math.sin(t * 5.2) * 0.035;
      bones[0].scale.x = 1 - Math.sin(t * 5.2) * 0.02;
      pivot.rotation.y = Math.sin(t * 0.9) * 0.5;
      nextBlink -= dt;
      const k = nextBlink < 0 && nextBlink > -0.14 ? 0.1 : 1;
      if (nextBlink < -0.14) nextBlink = 3 + Math.random() * 3;
      eyes.forEach((e) => { e.scale.y = k; });
      return true;
    };
    v.dirty = true;
  };
  c.dispose = () => {
    c.disposed = true;
    if (pivot) v.scene.remove(pivot);
    c.skeleton?.dispose?.();
    geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose());
    v.tick = null; v.root = null;
  };
  return c;
}

// ---- the libraries ---------------------------------------------------------
export const LIBRARIES = [
  {
    id: "kamikin", label: "Kamikin mochi", group: "Characters", count: 14, tintable: false,
    description: "Skinned mochi characters with idle clips and six swappable face states. Click a tile to change its face.",
    logo: "img/kamikin-game-logo-light.svg",
    async load(api) {
      const { ids, index, meta } = api.mochi;
      const all = [...ids, ...index.map((c) => c.id).filter((id) => !ids.includes(id))];
      return all.map((id) => { const m = meta(id); return { id, ...m, keywords: [m.species, m.persona, m.stance].filter(Boolean) }; });
    },
    tile: (item) => ({ name: item.name, sub: item.species, aria: `${item.name}, ${item.species || "mochi"}` }),
    make: (api, item, v) => api.mochi.content(v, item.id),
    toHero: (api, item) => api.showMochi(item.id),
    onClick(api, tile) {
      const c = tile.content;
      const pick = c.states.filter((s) => s !== "blink");
      c.setFace(pick[(pick.indexOf(c.face) + 1) % pick.length]);
      tile.btn.setAttribute("aria-label", `${tile.item.name}: change face, now ${c.face}`);
    },
    initTile: (api, tile) => tile.btn.setAttribute("aria-label", `${tile.item.name}: change face, now ${tile.content.face}`),
  },
  {
    id: "rubbernose", label: "Rubbernose", group: "Characters", count: 16, tintable: true,
    description: "1930s cartoon characters: things with faces, elbowless hose limbs, gloved hands and big round shoes. Six faces, nine clips, body colour tintable.",
    note: "Non-human characters only. Ink outlines are a baked hull, not the shared toon pass.",
    async load(api) { return api.rubbernose.index.map((m) => ({ ...m, keywords: [m.species, m.persona, m.body].filter(Boolean) })); },
    tile: (item) => ({ name: item.name, sub: item.species, aria: `${item.name}, ${item.species || "Rubbernose"}` }),
    make: (api, item, v, color) => api.rubbernose.content(v, item.id, color),
    toHero: (api, item, color) => api.showRubbernose(item.id, color),
    onClick(api, tile) {
      const c = tile.content;
      const pick = c.states.filter((s) => s !== "blink");
      c.setFace(pick[(pick.indexOf(c.face) + 1) % pick.length]);
      tile.btn.setAttribute("aria-label", `${tile.item.name}: change face, now ${c.face}`);
    },
    initTile: (api, tile) => tile.btn.setAttribute("aria-label", `${tile.item.name}: change face, now ${tile.content.face}`),
  },
  {
    id: "glyphlings", label: "Glyphlings", group: "Characters", count: 18, tintable: true,
    description: "Nine Greek letters, capitals and lowercase, from Courier New Regular, extruded with rounded edges, given eyes in their empty spaces, and rigged on a seven-bone spine so they bend like rubber-hose characters. Hover a tile to see it move. Click to switch between round and pill eyes.",
    note: "The eyes float in the letter's counters and follow the spine bone nearest them. Set the tint to colour the letters.",
    async load() {
      const data = await getJson(`${ASSETS}glyphlings/index.json`);
      return data.map((d) => ({ ...d, keywords: [d.letter, d.lower ? "lowercase" : "capital", "greek", "letter"] }));
    },
    tile: (item) => ({ name: item.name, sub: `${item.lower ? "lowercase" : "capital"} ${item.letter}`, aria: `${item.name} ${item.letter}: switch eyes` }),
    make: (api, item, v, color, opts) => glyphlingContent(api, v, item, color, opts),
    noHero: true,
    onClick(api, tile) {
      const c = tile.content;
      c.setEyes(c.eyeSet === "dots" ? "pills" : "dots");
      tile.btn.setAttribute("aria-label", `${tile.item.name} ${tile.item.letter}: ${c.eyeSet} eyes, switch`);
    },
    initTile: (api, tile) => tile.btn.setAttribute("aria-label", `${tile.item.name} ${tile.item.letter}: switch eyes`),
  },
  {
    id: "hands", label: "Hand poses", group: "Hands", count: HAND_EMOJI.length, tintable: true,
    description: "The hand emoji set: single poses with their small loops, and three two-hand pairs.",
    note: "Finger curls come from the React component's pose table. The loops are approximated here: the motion is close, not frame-exact, and there is no outline shading.",
    async load() { return HAND_EMOJI.map((e) => ({ ...e, tint: "#ffd23f" })); },
    tile: (item) => ({ name: item.label, sub: item.kind === "pair" ? "pair" : item.pose || item.animation, aria: `${item.label}: details` }),
    make(api, item, v, color) {
      handPoses ||= createHandPoses(api);
      return handPoses.content(v, item, color);
    },
    detail: (item) => ({
      title: item.label,
      meta: `${item.kind}${item.pose ? ` · pose ${item.pose}` : ""}${item.pair ? ` · ${item.pair}` : ""} · expression ${item.expression}`,
      keywords: item.keywords, materials: null, path: "assets/kamiji.glb",
    }),
    heroColors: true,
  },
  propLibrary({
    id: "emotes", label: "Emotes", group: "Emoji", count: 24, dir: "", strip: "",
    description: "The first 24 clay props: hearts, stars, status marks and developer icons.",
    sub: (i) => i.category,
    async load() { return propIndex("").then((l) => l.map((i) => ({ ...i, keywords: [i.category] }))); },
  }),
  propLibrary({
    id: "faces", label: "Faces", group: "Emoji", count: 33, dir: "faces/", strip: "face_",
    description: "Face props with baked eye, mouth and teeth colours. Only the clay body takes the tint.",
    sub: (i) => i.kamijiExpression || "",
  }),
  propLibrary({
    id: "reactions", label: "Reactions", group: "Emoji", count: 6, dir: "shapes/", strip: "",
    filter: (p) => p.category === "reaction",
    description: "Small compound props for reactions: hundred, eyes, hearts and confetti.",
    sub: (i) => i.keywords?.[0] || "",
  }),
  propLibrary({
    id: "symbols", label: "Symbols", group: "Objects", count: 36, dir: "symbols/", strip: "",
    description: "Status, interface, security and communication marks.",
    sub: (i) => i.category,
  }),
  propLibrary({
    id: "objects", label: "Objects", group: "Objects", count: 34, dir: "objects/", strip: "",
    description: "Developer, office, food, celebration and idea objects.",
    sub: (i) => i.category,
  }),
  propLibrary({
    id: "git", label: "Git", group: "Developer", count: 18, dir: "git/", strip: "git_",
    description: "Chubby 3D git and CI icons: commits, branches, pull requests, checks, conflicts and releases. The clay body takes the tint; status marks keep their green, red, purple and amber.",
    sub: (i) => i.keywords?.[0] || "",
  }),
  propLibrary({
    id: "accessories", label: "Accessories", group: "Accessories", count: 36, dir: "accessories/", strip: "",
    description: "Hats, glasses, bows, headphones and neckwear modelled for a unit-diameter head, ready to wear on any Kamiji head. The clay part takes the tint; trim keeps its colours. Anchors live in index.json.",
    sub: (i) => i.anchor?.slot || i.category,
  }),
  propLibrary({
    id: "shapes", label: "Body shapes", group: "Shapes", count: 37, dir: "shapes/", strip: "shape_",
    description: "Alternative bodies the avatar can take instead of the hand, plus a tile that tweens between them.",
    note: "In progress: more shapes are being built.",
    sub: (i) => i.keywords?.[0] || "",
    async load() {
      const [shapes, morph] = await Promise.all([
        propIndex("shapes/", (p) => p.category === "shape"),
        propIndex("shapes/", (p) => p.category === "morph"),
      ]);
      return [...morph, ...shapes];
    },
    tile: (item) => item.category === "morph"
      ? { name: "morph", sub: "sphere to ...", aria: "Shape morph: tweens between body shapes, details" }
      : { name: pretty(item.name, "shape_"), sub: item.keywords?.[0] || "", aria: `${pretty(item.name, "shape_")} body shape: details` },
    make: (api, item, v, color, opts) => (item.category === "morph" ? morphContent(api, v, item, color) : propContent(api, v, item, color, opts)),
  }),
];

// ---- the browser -------------------------------------------------------------
export function initLibraryBrowser(api) {
  const $ = (id) => document.getElementById(id);
  const nav = $("lb-nav"), body = $("lb-body"), grid = $("lb-grid"), status = $("lb-status");
  const search = $("lb-search"), tintRow = $("lb-tint"), tintWrap = $("lb-tintwrap");
  const card = $("lb-detail"), cardEl = $("lb-dv");
  if (!nav || !grid) return;
  const reduce = api.reduceMotion;

  let galleryIn = false;
  new IntersectionObserver((e) => { galleryIn = e[e.length - 1].isIntersecting; }, { rootMargin: "300px" }).observe($("gallery"));
  const gate = () => galleryIn;
  const VOPTS = { hemi: 1.6, key: 2, gate };

  let current = null, token = 0, tiles = [], selected = null, tint = null;
  const options = new Map();

  // list ----------------------------------------------------------------------
  [...new Set(LIBRARIES.map((l) => l.group))].forEach((g, gi) => {
    const grp = document.createElement("div");
    grp.className = "lb-group"; grp.setAttribute("role", "group"); grp.setAttribute("aria-labelledby", `lb-g${gi}`);
    grp.innerHTML = `<span class="lb-gh" id="lb-g${gi}"></span>`;
    grp.firstChild.textContent = g;
    LIBRARIES.filter((l) => l.group === g).forEach((lib) => {
      const o = document.createElement("div");
      o.className = "lb-opt"; o.id = `lb-o-${lib.id}`; o.setAttribute("role", "option");
      o.setAttribute("aria-selected", "false"); o.tabIndex = -1; o.dataset.lib = lib.id;
      o.innerHTML = `<span class="lb-lab"></span><span class="lb-n"></span>`;
      o.querySelector(".lb-lab").textContent = lib.label;
      o.querySelector(".lb-n").textContent = String(lib.count);
      o.addEventListener("click", () => setLibrary(lib, true));
      options.set(lib.id, o); grp.append(o);
    });
    nav.append(grp);
  });
  nav.addEventListener("keydown", (e) => {
    const i = LIBRARIES.indexOf(current);
    const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: LIBRARIES.length - 1 }[e.key];
    if (to !== undefined) {
      e.preventDefault();
      const lib = LIBRARIES[(to + LIBRARIES.length) % LIBRARIES.length];
      setLibrary(lib, true); options.get(lib.id).focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); const o = e.target.closest(".lb-opt"); if (o) setLibrary(LIBRARIES.find((l) => l.id === o.dataset.lib), true);
    }
  });

  // tint row ------------------------------------------------------------------
  const COLORS = api.TINTS;
  function buildTint(lib) {
    tintRow.replaceChildren();
    tintWrap.hidden = !lib.tintable;
    if (!lib.tintable) return;
    const make = (col, label, on) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = col ? "swatch" : "swatch swatch-own";
      if (col) b.style.background = col;
      b.setAttribute("aria-label", label); b.setAttribute("aria-pressed", String(on));
      b.addEventListener("click", () => {
        tintRow.querySelectorAll(".swatch").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        tint = col; applyTint();
      });
      tintRow.append(b);
    };
    make(null, "Default colours", true);
    COLORS.forEach((col, i) => make(col, `Tint ${api.TINT_NAMES[i]}`, false));
  }
  const colorFor = (item) => tint || item.tint || COLORS[0];
  function applyTint() {
    tiles.forEach((t) => t.content.setColor(colorFor(t.item)));
    cardState?.content.setColor(colorFor(cardState.item));
  }

  // tiles ---------------------------------------------------------------------
  function buildTile(lib, item) {
    const d = lib.tile(item);
    const li = document.createElement("li");
    li.className = "tile";
    li.innerHTML = `<button type="button"><span class="viewer" aria-hidden="true"><canvas></canvas><span class="fallback" hidden></span></span><span class="nm"></span><span class="sp"></span></button>`;
    const btn = li.querySelector("button");
    li.querySelector(".nm").textContent = d.name;
    const sp = li.querySelector(".sp");
    sp.textContent = d.sub;
    btn.setAttribute("aria-label", d.aria);
    btn.setAttribute("aria-pressed", "false");
    const v = api.makeViewer(li.querySelector(".viewer"), VOPTS);
    const content = lib.make(api, item, v, colorFor(item), {});
    if (content.onLabel !== undefined) content.onLabel = (s) => { sp.textContent = s; };
    v.load = () => content.attach();
    const tile = { item, li, btn, v, content };
    const on = () => { v.hover = true; }, off = () => { v.hover = false; };
    btn.addEventListener("pointerenter", on); btn.addEventListener("pointerleave", off);
    btn.addEventListener("focus", on); btn.addEventListener("blur", off);
    btn.addEventListener("click", () => (lib.onClick ? lib.onClick(api, tile) : selectTile(lib, tile)));
    lib.initTile?.(api, tile);
    item._hay = [d.name, item.name, item.label, item.category, ...(item.keywords || [])].join(" ").toLowerCase();
    return tile;
  }
  function clearTiles() {
    tiles.forEach((t) => { t.v.destroy(); t.content.dispose(); });
    tiles = []; selected = null;
    grid.replaceChildren();
    closeCard();
  }

  // detail card -----------------------------------------------------------------
  const cardV = api.makeViewer(cardEl, { ...VOPTS, hemi: 1.6, key: 2 });
  let cardState = null;
  const defaultDetail = (item) => ({
    title: item.name,
    meta: [item.category, item.triangles && `${item.triangles} triangles`, item.bytes && `${Math.round(item.bytes / 1024)} KB`].filter(Boolean).join(" · "),
    keywords: item.keywords || [], materials: item.materials || {}, path: item.url?.replace("../", ""),
  });
  function openCard(lib, item) {
    closeCard(true);
    const d = (lib.detail || defaultDetail)(item);
    $("lb-dname").textContent = d.title;
    $("lb-dmeta").textContent = d.meta;
    $("lb-dpath").textContent = d.path || "";
    $("lb-dchips").replaceChildren(...d.keywords.map((k) => Object.assign(document.createElement("li"), { textContent: k })));
    const mats = $("lb-dmats");
    mats.replaceChildren();
    const entries = Object.entries(d.materials || {});
    mats.hidden = false;
    const add = (label, hex, note) => {
      const s = document.createElement("span");
      s.className = "lb-mat";
      s.innerHTML = `<i></i><span></span>`;
      s.querySelector("i").style.background = hex || "var(--pill)";
      if (!hex) s.querySelector("i").className = "lb-mat-clay";
      s.querySelector("span").textContent = `${label}${note ? ` ${note}` : ""}`;
      mats.append(s);
    };
    if (lib.tintable) add("Clay", colorFor(item), "(takes the tint)");
    entries.forEach(([k, hex]) => add(k, hex, hex));
    mats.hidden = !mats.children.length;
    $("lb-dhero").hidden = !!lib.noHero;
    const content = lib.make(api, item, cardV, colorFor(item), { live: true });
    if (content.onLabel !== undefined) content.onLabel = (s) => { $("lb-dmeta").textContent = `${d.meta} · ${s}`; };
    cardV.loadStarted = false; cardV.load = () => content.attach(); cardV.tick = null; cardV.dirty = true;
    cardV.canvas.removeAttribute("hidden"); cardEl.querySelector(".fallback").hidden = true;
    cardEl.setAttribute("aria-label", `Live 3D preview of ${d.title}`);
    cardState = { lib, item, content };
    card.hidden = false;
  }
  function closeCard(keepHidden) {
    if (cardState) { cardState.content.dispose(); cardState = null; }
    cardV.ctx.clearRect(0, 0, cardV.canvas.width, cardV.canvas.height);
    if (!keepHidden) card.hidden = true;
  }
  function selectTile(lib, tile) {
    selected = tile;
    tiles.forEach((t) => t.btn.setAttribute("aria-pressed", String(t === tile)));
    openCard(lib, tile.item);
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }
  $("lb-dclose").addEventListener("click", () => { const t = selected; closeCard(); tiles.forEach((x) => x.btn.setAttribute("aria-pressed", "false")); selected = null; t?.btn.focus(); });
  $("lb-dhero").addEventListener("click", () => {
    if (!cardState) return;
    const { lib, item } = cardState, color = colorFor(item);
    if (lib.toHero) lib.toHero(api, item, color);
    else {
      const c = lib.make(api, item, api.hero, color, { live: true });
      const d = (lib.detail || defaultDetail)(item);
      api.setHero(c, `Live 3D ${d.title}, slowly moving`, `${d.title} · ${lib.label}`);
      const colors = lib.heroColors ? COLORS : [...new Set([item.tint, ...COLORS].filter(Boolean))];
      api.setControls({ label: `${d.title} controls`, tint: { colors, initial: color, onPick: c.setColor } });
    }
    api.revealHero();
  });
  card.addEventListener("keydown", (e) => { if (e.key === "Escape") $("lb-dclose").click(); });

  // search ----------------------------------------------------------------------
  function filter() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    tiles.forEach((t) => {
      const ok = !q || t.item._hay.includes(q);
      t.li.hidden = !ok; if (ok) shown += 1;
    });
    status.textContent = !tiles.length ? "" : q ? (shown ? `${shown} of ${tiles.length}` : "No match") : `${tiles.length} items`;
  }
  search.addEventListener("input", filter);
  search.addEventListener("keydown", (e) => { if (e.key === "Escape" && search.value) { search.value = ""; filter(); } });

  // switching -------------------------------------------------------------------
  async function setLibrary(lib, user) {
    if (lib === current) return;
    const mine = ++token;
    current = lib;
    options.forEach((o, id) => { const on = id === lib.id; o.setAttribute("aria-selected", String(on)); o.tabIndex = on ? 0 : -1; o.classList.toggle("is-on", on); });
    if (user) history.replaceState(null, "", `#lib=${lib.id}`);
    if (nav.scrollWidth > nav.clientWidth) { // phone pill row: keep the active pill in view
      const o = options.get(lib.id);
      nav.scrollTo({ left: nav.scrollLeft + o.getBoundingClientRect().left - nav.getBoundingClientRect().left - 72, behavior: reduce ? "auto" : "smooth" });
    }
    if (!reduce) { body.classList.add("is-out"); await new Promise((r) => setTimeout(r, 140)); }
    if (mine !== token) return;
    clearTiles();
    tint = null; search.value = ""; buildTint(lib);
    $("lb-title").textContent = lib.label;
    $("lb-count").textContent = String(lib.count);
    $("lb-desc").textContent = lib.description;
    $("lb-note").textContent = lib.note || ""; $("lb-note").hidden = !lib.note;
    const logo = $("lb-logo"); logo.hidden = !lib.logo; if (lib.logo) logo.src = lib.logo;
    $("lb-main").setAttribute("aria-label", lib.label);
    status.textContent = "Loading";
    try {
      lib.items ||= lib.load(api);
      const items = await lib.items;
      if (mine !== token) return;
      tiles = items.map((item) => buildTile(lib, item));
      tiles.forEach((t) => grid.append(t.li));
      if (items.length !== lib.count) {
        if (lib.count !== items.length) console.warn("Kamiji site: library count differs", lib.id, lib.count, items.length);
        lib.count = items.length; options.get(lib.id).querySelector(".lb-n").textContent = String(items.length); $("lb-count").textContent = String(items.length);
      }
      filter();
    } catch (err) {
      console.warn("Kamiji site: library failed", lib.id, err);
      lib.items = null;
      grid.innerHTML = `<li class="hint-note">Could not load the ${lib.label} library.</li>`;
      status.textContent = "";
    }
    body.classList.remove("is-out");
  }

  const fromHash = () => {
    const m = location.hash.match(/^#lib=([\w-]+)/);
    return m ? LIBRARIES.find((l) => l.id === m[1]) : null;
  };
  addEventListener("hashchange", () => { const l = fromHash(); if (l) setLibrary(l, false); });
  const start = fromHash();
  setLibrary(start || LIBRARIES[0], false);
  if (start) requestAnimationFrame(() => $("gallery").scrollIntoView({ behavior: "instant", block: "start" }));
}
