// Hands landing page. One shared WebGL renderer draws the hero hand and the agent
// avatars and copies each frame into a 2D canvas, as the Kamiji landing page does.
// The rail dropdowns come from ../rail.js, which mirrors the pill groups filled here.

import { enableSpin, applyOrbit } from "../spin.js";
const HAND_URL = "../../assets/kamiji.glb";
const MOCHI_DIR = "../../assets/mochi/";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const EXPRESSIONS = {
  neutral: {},
  happy: { mouthSmile: 1, browUpLeft: 0.3, browUpRight: 0.3 },
  excited: { mouthSmile: 1, mouthOpen: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, browUpLeft: 1, browUpRight: 1 },
  thinking: { browUpLeft: 1, browDownRight: 0.5, eyeLookUp: 0.8, eyeLookLeft: 0.5, mouthFrown: 0.2 },
  sad: { mouthFrown: 1, browSadLeft: 1, browSadRight: 1, eyeLookDown: 0.5 },
  angry: { mouthFrown: 0.7, browAngryLeft: 1, browAngryRight: 1 },
  surprised: { mouthO: 1, eyeWideLeft: 1, eyeWideRight: 1, browUpLeft: 1, browUpRight: 1 },
  sleepy: { eyeBlinkLeft: 0.8, eyeBlinkRight: 0.8, browDownLeft: 0.3, browDownRight: 0.3, mouthFrown: 0.15 },
};
const TINTS = ["#ffd23f", "#ff7a59", "#5ec27a", "#4aa8ff", "#b583ff", "#ff7eb6"];
const TINT_NAMES = ["yellow", "coral", "green", "blue", "violet", "pink"];
const HAND_CLIPS = ["Idle", "Wave", "Think", "Celebrate"];
const HIDDEN_FACE_MATERIALS = ["FaceInk", "FaceTongue", "FaceGlint"];

const $ = (id) => document.getElementById(id);

function showFallback(el, message) {
  const p = el.querySelector(".fallback");
  if (p) { p.textContent = message; p.hidden = false; }
  el.querySelector("canvas")?.setAttribute("hidden", "");
}

function chipGroup(container, items, onPick, initial) {
  container.replaceChildren();
  const buttons = [];
  items.forEach((name) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pill"; b.textContent = name;
    b.setAttribute("aria-pressed", String(name === initial));
    b.addEventListener("click", () => { buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); onPick(name); });
    buttons.push(b); container.append(b);
  });
}

function swatchGroup(container, colors, initial, onPick) {
  container.replaceChildren();
  colors.forEach((col) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch"; b.style.background = col;
    b.setAttribute("aria-label", `Tint ${TINT_NAMES[TINTS.indexOf(col)] || col}`);
    b.setAttribute("aria-pressed", String(col === initial));
    b.addEventListener("click", () => {
      container.querySelectorAll(".swatch").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(col);
    });
    container.append(b);
  });
}

async function boot() {
  const heroEl = $("hero-hand");
  const agentEls = [...document.querySelectorAll("#agent-grid .agent .viewer")];
  const introEls = [...document.querySelectorAll("#intro-avatars .agent .viewer")];
  const gitEls = [...document.querySelectorAll("#git-avatars .agent .viewer")];
  let THREE, GLTFLoader, SkeletonUtils, renderer;
  try {
    THREE = await import("three");
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setClearColor(0x000000, 0);
  } catch (err) {
    console.warn("Hands site: 3D unavailable", err);
    const msg = "3D preview unavailable in this browser.";
    showFallback(heroEl, msg);
    agentEls.forEach((el) => showFallback(el, ""));
    introEls.forEach((el) => showFallback(el, ""));
    gitEls.forEach((el) => showFallback(el, ""));
    return;
  }

  const loader = new GLTFLoader();
  const viewers = new Set();
  const dpr = Math.min(devicePixelRatio || 1, 2);

  function makeViewer(el) {
    const canvas = el.querySelector("canvas");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4de, 0xb59a8a, 1.5));
    const key = new THREE.DirectionalLight(0xffefd2, 1.8);
    key.position.set(-1.5, 2, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const v = { el, canvas, ctx: canvas.getContext("2d"), scene, camera, mixer: null, near: false, dirty: true, loadStarted: false, load: null, tick: null };
    new IntersectionObserver((entries) => { v.near = entries[entries.length - 1].isIntersecting; v.dirty = true; }, { rootMargin: "200px" }).observe(el);
    viewers.add(v);
    return v;
  }

  function fit(v, root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const extent = Math.max(size.y, size.x) * (v.fitScale || 1.25);
    const dist = (extent / 2) / Math.tan(THREE.MathUtils.degToRad(v.camera.fov / 2));
    v.camera.position.set(center.x, center.y, center.z + dist);
    v.camera.lookAt(center.x, center.y, center.z);
    v.orbit = { cx: center.x, cy: center.y, cz: center.z, dist, lift: 0 };
  }

  function draw(v) {
    const w = Math.max(1, Math.round(v.el.clientWidth * dpr)), h = Math.max(1, Math.round(v.el.clientHeight * dpr));
    if (v.canvas.width !== w || v.canvas.height !== h) { v.canvas.width = w; v.canvas.height = h; }
    v.camera.aspect = w / h; v.camera.updateProjectionMatrix();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    applyOrbit(v);
    renderer.render(v.scene, v.camera);
    v.ctx.clearRect(0, 0, w, h);
    v.ctx.drawImage(renderer.domElement, 0, 0, w, h);
  }

  let last = performance.now(), acc = 0;
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
    acc += dt;
    if (acc >= 1 / 30) {
      const step = acc; acc = 0;
      for (const v of viewers) {
        if (!v.near) continue;
        if (!v.loadStarted && v.load) {
          v.loadStarted = true;
          v.load().catch((err) => { console.warn("Hands site: load failed", err); showFallback(v.el, "Could not load this model."); });
          continue;
        }
        if (!v.tick) continue;
        const moving = v.tick(reduceMotion ? 0 : step);
        if (moving || v.dirty) { draw(v); v.dirty = false; }
      }
    }
    requestAnimationFrame(frame);
  }
  addEventListener("resize", () => viewers.forEach((v) => (v.dirty = true)));

  const handAsset = loader.loadAsync(HAND_URL);

  function handContent(v, color, opts = {}) {
    const c = { disposed: false };
    const state = { expr: "neutral", weights: {}, nextBlink: 2 };
    let action = null, gltf = null, skin = null;
    const meshes = [];
    c.setColor = (col) => { color = col; skin?.color.set(col); v.dirty = true; };
    c.setExpression = (n) => { state.expr = n; v.dirty = true; };
    c.setClip = (n) => {
      if (!gltf) return;
      const clip = gltf.animations.find((x) => x.name === n); if (!clip) return;
      const next = v.mixer.clipAction(clip);
      if (action && action !== next) action.fadeOut(0.2);
      next.reset().fadeIn(0.2).play(); action = next; v.dirty = true;
    };
    c.attach = async () => {
      gltf = await handAsset;
      const root = SkeletonUtils.clone(gltf.scene);
      root.traverse((n) => {
        if (!n.isMesh) return;
        const mat = n.material;
        if (HIDDEN_FACE_MATERIALS.includes(mat.name)) n.visible = false;
        if (opts.faceless && mat.name.startsWith("Face")) n.visible = false; // the little logo hand has no eyes
        if (mat.name === "HandSkin") {
          skin = new THREE.MeshPhysicalMaterial({ color: mat.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
          n.material = skin;
        }
        if (n.morphTargetDictionary) meshes.push(n);
      });
      v.scene.add(root);
      v.mixer = new THREE.AnimationMixer(root);
      c.setColor(color);
      c.setClip("Idle");
      v.mixer.update(reduceMotion ? 0.8 : 0);
      fit(v, root);
      v.tick = (dt) => {
        const f = 1 - Math.exp(-12 * dt);
        const target = EXPRESSIONS[state.expr] || {};
        state.nextBlink -= dt;
        if (state.nextBlink < -0.12) state.nextBlink = 2 + Math.random() * 3;
        const blinking = state.nextBlink < 0 && !reduceMotion ? 1 : 0;
        let moving = false;
        new Set([...Object.keys(state.weights), ...Object.keys(target)]).forEach((k) => {
          let goal = target[k] || 0;
          if (blinking && (k === "eyeBlinkLeft" || k === "eyeBlinkRight")) goal = Math.max(goal, 1);
          const cur = state.weights[k] || 0;
          const nv = dt === 0 ? goal : cur + (goal - cur) * f;
          if (Math.abs(nv - cur) > 0.001) moving = true;
          state.weights[k] = Math.abs(nv - goal) < 0.002 ? goal : nv;
        });
        meshes.forEach((m) => {
          const d = m.morphTargetDictionary;
          for (const k in d) m.morphTargetInfluences[d[k]] = k === "shapeSphere" || k === "shapeCube" ? 0 : (state.weights[k] || 0); // hand shape
        });
        if (dt > 0) { v.mixer.update(dt); moving = true; }
        return moving;
      };
      v.dirty = true;
    };
    return c;
  }

  function mochiContent(v, id) {
    const c = {};
    c.attach = async () => {
      const gltf = await loader.loadAsync(`${MOCHI_DIR}${id}.glb`);
      const root = SkeletonUtils.clone(gltf.scene);
      v.scene.add(root);
      v.mixer = new THREE.AnimationMixer(root);
      const clip = gltf.animations.find((x) => x.name === "idle") || gltf.animations[0];
      if (clip) v.mixer.clipAction(clip).play();
      v.mixer.update(reduceMotion ? 0.5 : 0);
      fit(v, root);
      v.tick = (dt) => { if (dt > 0) v.mixer.update(dt); return dt > 0; };
      v.dirty = true;
    };
    return c;
  }

  // ---- hero
  const hero = makeViewer(heroEl);
  enableSpin(hero);
  const content = handContent(hero, TINTS[0], { faceless: true }); // the hero hand has no eyes
  hero.load = () => content.attach();
  // The hero controls were removed from this page; the pill and swatch groups only exist if a page brings them back.
  if ($("g-expr")) chipGroup($("g-expr"), Object.keys(EXPRESSIONS), content.setExpression, "neutral");
  if ($("g-clip")) chipGroup($("g-clip"), HAND_CLIPS, content.setClip, "Idle");
  if ($("g-tint")) swatchGroup($("g-tint"), TINTS, TINTS[0], content.setColor);

  // ---- small floating hand beside the wordmark
  const brandEl = $("brand-hand");
  if (brandEl) {
    const bv = makeViewer(brandEl);
    bv.fitScale = 1.95; // room around the hand so a wave or a jump never touches the canvas edge
    const bc = handContent(bv, TINTS[0], { faceless: true });
    bv.load = () => bc.attach();
    // The logo hand cycles a few moves: wave, jump, celebrate, rest. Reduced motion keeps it still.
    if (!reduceMotion) {
      const moves = [
        { clip: "Wave", ms: 2600 },
        { clip: "Idle", jump: true, ms: 1100 },
        { clip: "Celebrate", ms: 2200 },
        { clip: "Idle", ms: 1800 },
        { clip: "Think", ms: 1800 },
        { clip: "Idle", jump: true, ms: 1100 },
      ];
      let i = 0;
      const step = () => {
        const m = moves[i++ % moves.length];
        bc.setClip(m.clip);
        brandEl.classList.toggle("jump", !!m.jump);
        setTimeout(step, m.ms);
      };
      setTimeout(step, 2500);
    }
  }


  // A dozen hands on one plane: a little tribe, each with its own colour and cycle of moves.
  function tribeContent(v) {
    const c = {};
    const COLORS = ["#ffd23f", "#ff7a59", "#5ec27a", "#4aa8ff", "#b583ff", "#ff7eb6", "#ffb703", "#2ec4b6", "#ef476f", "#8ecae6", "#a7c957", "#f4a261"];
    const CYCLES = [
      [["Wave", 2.4], ["Idle", 1.6], ["Celebrate", 2.2]],
      [["Idle", 2], ["Think", 2.4], ["Wave", 2]],
      [["Celebrate", 2.2], ["Idle", 1.4], ["Think", 2.2]],
      [["Think", 2.4], ["Celebrate", 2], ["Idle", 1.6]],
    ];
    const hands = [];
    c.attach = async () => {
      const gltf = await handAsset;
      const scene = v.scene;
      // no ground is drawn: the tribe stands on the invisible top arc of a small globe, each hand with its own soft shadow
      const R = 11;
      // soft blob shadow texture
      const sc = document.createElement("canvas"); sc.width = sc.height = 64;
      const sx = sc.getContext("2d"), g = sx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, "rgba(40,40,30,.46)"); g.addColorStop(1, "rgba(40,40,30,0)");
      sx.fillStyle = g; sx.fillRect(0, 0, 64, 64);
      const shadowTex = new THREE.CanvasTexture(sc);
      // size the model once: about 1.9 units tall
      const probe = SkeletonUtils.clone(gltf.scene);
      const box = new THREE.Box3().setFromObject(probe), sz = box.getSize(new THREE.Vector3());
      const scale = 1.9 / Math.max(sz.y, 0.001), baseY = -box.min.y * scale;
      // formation: three ranks of four, staggered, a little jitter
      const spots = [];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) spots.push([(k - 1.5) * 2.5 + (r % 2 ? 1.1 : 0) + ((k * 7 + r * 3) % 5 - 2) * 0.12, (r - 1) * 2.3 - 0.4 + ((k * 3 + r) % 3 - 1) * 0.15]);
      spots.forEach(([x, z], i) => {
        const root = SkeletonUtils.clone(gltf.scene);
        let skin = null;
        root.traverse((n) => {
          if (!n.isMesh) return;
          const mat = n.material;
          if (HIDDEN_FACE_MATERIALS.includes(mat.name)) n.visible = false;
          if (mat.name === "HandSkin") {
            skin = new THREE.MeshPhysicalMaterial({ color: mat.color.clone(), roughness: 1, metalness: 0, specularIntensity: 0.12, sheen: 0.45, sheenRoughness: 0.8 });
            n.material = skin;
          }
          n.frustumCulled = false;
        });
        skin?.color.set(COLORS[i % COLORS.length]);
        // anchor: a point on the globe, standing along the surface normal
        const ySurf = Math.sqrt(Math.max(R * R - x * x - z * z, 0)) - R;
        const anchor = new THREE.Group();
        anchor.position.set(x, ySurf, z);
        anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, ySurf + R, z).normalize());
        const holder = new THREE.Group();
        root.scale.setScalar(scale); root.position.y = baseY;
        holder.add(root);
        holder.rotation.y = -x * 0.05 + ((i * 5) % 7 - 3) * 0.05; // face roughly forward, turned a touch toward the middle
        anchor.add(holder);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; anchor.add(shadow);
        scene.add(anchor);
        const mixer = new THREE.AnimationMixer(root);
        const cycle = CYCLES[i % CYCLES.length];
        const h = { holder, shadow, mixer, cycle, step: i % cycle.length, left: 0.4 + (i * 0.37) % 1.8, phase: i * 0.9, hop: 0, action: null, clipName: "", gltf };
        hands.push(h);
      });
      const play = (h, name) => {
        const clip = h.gltf.animations.find((x) => x.name === name); if (!clip) return;
        const next = h.mixer.clipAction(clip);
        if (h.action && h.action !== next) h.action.fadeOut(0.25);
        next.reset().fadeIn(0.25).play(); h.action = next; h.clipName = name;
      };
      hands.forEach((h) => { play(h, h.cycle[h.step][0]); h.mixer.update(reduceMotion ? 0.8 : h.phase * 0.2); });
      let t = 0;
      v.tick = (dt) => {
        t += dt;
        hands.forEach((h) => {
          if (dt > 0) {
            h.left -= dt;
            if (h.left <= 0) { h.step = (h.step + 1) % h.cycle.length; const [n, d] = h.cycle[h.step]; play(h, n); h.left = d; }
            h.mixer.update(dt);
          }
          const hopping = h.clipName === "Celebrate" ? 1 : 0;
          h.hop += ((hopping ? Math.abs(Math.sin(t * 5 + h.phase)) * 0.34 : 0) - h.hop) * Math.min(1, dt * 10);
          h.holder.position.y = h.hop;
          const s = 1 - h.hop * 0.35;
          h.shadow.scale.setScalar(Math.max(0.55, s)); h.shadow.material.opacity = 0.5 + 0.5 * (s - 0.6);
          h.holder.rotation.z = h.clipName === "Think" ? Math.sin(t * 1.4 + h.phase) * 0.05 : 0;
        });
        const a = reduceMotion ? 0.0 : Math.sin(t * 0.18) * 0.22;
        const back = 11 * Math.max(1, 2.15 / v.camera.aspect); // narrow screens pull back so the whole tribe fits
        v.camera.position.set(Math.sin(a) * back, 6.2 * back / 11, Math.cos(a) * back);
        v.camera.lookAt(0, 0.1, 0);
        return dt > 0;
      };
      v.camera.fov = 32; v.camera.updateProjectionMatrix();
      v.camera.position.set(0, 6.2, 11); v.camera.lookAt(0, 0.1, 0);
      v.dirty = true;
    };
    return c;
  }

  // ---- the tribe
  const tribeEl = $("tribe-viewer");
  if (tribeEl) {
    const tv = makeViewer(tribeEl);
    const tc = tribeContent(tv);
    tv.load = () => tc.attach();
  }


  // ---- Introducing Hands: six hands, each with its own faces, moves and emoji that bubble in and out
  const PROPS_DIR = "../../assets/props/";
  const propsIndex = fetch(`${PROPS_DIR}index.json`).then((r) => r.json()).catch(() => []);
  const propCache = new Map();
  const loadProp = (name) => {
    if (!propCache.has(name)) propCache.set(name, loader.loadAsync(`${PROPS_DIR}${name}.glb`));
    return propCache.get(name);
  };
  // beats: [expression, clip, emoji]; one emoji at a time per hand, always followed by a gap with none
  const INTRO = [
    { beats: [["happy", "Wave", "heart"], ["excited", "Celebrate", "sparkle"], ["happy", "Idle", "star"]] },
    { beats: [["angry", "Think", "anger"], ["surprised", "Idle", "exclamation"], ["neutral", "Celebrate", "fire"]] },
    { beats: [["happy", "Celebrate", "check"], ["neutral", "Idle", "plus"], ["excited", "Wave", "star"]] },
    { beats: [["thinking", "Think", "lightbulb"], ["surprised", "Idle", "question"], ["thinking", "Wave", "magnifier"]] },
    { beats: [["sleepy", "Idle", "zzz"], ["neutral", "Wave", "music_note"], ["happy", "Think", "clock"]] },
    { beats: [["sad", "Idle", "tear"], ["happy", "Celebrate", "heart"], ["excited", "Wave", "sparkle"]] },
  ];
  const BEAT_S = 4.2;
  function introContent(v, color, spec, index) {
    const base = handContent(v, color);
    const c = { attach: null };
    c.attach = async () => {
      await base.attach();
      const gltf = await handAsset;
      const tints = Object.fromEntries((await propsIndex).map((e) => [e.name, e.tint]));
      const box = new THREE.Box3().setFromObject(v.scene);
      const size = box.getSize(new THREE.Vector3());
      const anchor = new THREE.Group();
      anchor.position.set(box.max.x - size.x * 0.06, box.max.y - size.y * 0.04, box.max.z);
      v.scene.add(anchor);
      let beat = index % spec.beats.length, t = (index * 0.9) % BEAT_S, current = null, shownName = "";
      const apply = () => {
        const [expr, clip] = spec.beats[beat];
        base.setExpression(expr); base.setClip(clip);
      };
      const setAccessory = async (name) => {
        if (shownName === name) return;
        shownName = name;
        if (current) { anchor.remove(current); current = null; }
        if (!name) return;
        const prop = await loadProp(name);
        if (shownName !== name) return;
        const obj = SkeletonUtils.clone(prop.scene);
        obj.traverse((n) => {
          if (n.isMesh && n.material?.name === "Clay") { n.material = n.material.clone(); n.material.color.set(tints[name] || "#ffd23f"); }
        });
        const pb = new THREE.Box3().setFromObject(obj), ps = pb.getSize(new THREE.Vector3());
        const k = (size.y * 0.5) / Math.max(ps.y, ps.x, 0.001);
        obj.scale.setScalar(k); obj.position.set(-pb.getCenter(new THREE.Vector3()).x * k, -pb.getCenter(new THREE.Vector3()).y * k, 0);
        const wrap = new THREE.Group(); wrap.add(obj); wrap.scale.setScalar(0.001);
        current = wrap; anchor.add(wrap);
      };
      apply();
      const pop = (u) => (u < 0.5 ? 0.15 + (1.22 - 0.15) * (u / 0.5) : u < 0.75 ? 1.22 - (1.22 - 0.94) * ((u - 0.5) / 0.25) : 0.94 + 0.06 * ((u - 0.75) / 0.25));
      const baseTick = v.tick;
      v.tick = (dt) => {
        const moving = baseTick(dt);
        if (reduceMotion) { if (!current) setAccessory(spec.beats[beat][2]); if (current) current.scale.setScalar(1); return moving; }
        t += dt;
        if (t >= BEAT_S) { t -= BEAT_S; beat = (beat + 1) % spec.beats.length; apply(); }
        // none (0.7s), pop in (0.35s), hold, pop out (0.3s), none (0.6s)
        const inAt = 0.7, hold = 1.6, outAt = inAt + 0.35 + hold, end = outAt + 0.3;
        if (t < inAt || t >= end) { if (shownName) setAccessory(""); }
        else {
          if (shownName !== spec.beats[beat][2]) setAccessory(spec.beats[beat][2]);
          if (current) {
            let s = 1, rot = 0;
            if (t < inAt + 0.35) { const u = (t - inAt) / 0.35; s = pop(u); rot = (1 - u) * -0.35; }
            else if (t >= outAt) { const u = (t - outAt) / 0.3; s = Math.max(0.001, 1 - u * u); rot = u * 0.3; }
            else rot = Math.sin((t - inAt) * 3) * 0.06;
            current.scale.setScalar(s); current.rotation.z = rot;
          }
        }
        v.dirty = true;
        return true;
      };
    };
    return c;
  }
  introEls.forEach((el, i) => {
    const v = makeViewer(el);
    v.fitScale = 1.9; // room above and to the right for the emoji
    const c = introContent(v, el.dataset.tint || TINTS[0], INTRO[i % INTRO.length], i);
    v.load = () => c.attach();
  });

  // ---- Git, in 3D: six hands, each holding one steady 3D git icon that matches what the agent is doing.
  // Same pattern as introContent, and the accessory bobs while it pops in and out on a loop.
  // beats: [expression, clip]; hop lifts the hand now and then. Only the icon's Clay material is tinted.
  const GIT_DIR = `${PROPS_DIR}git/`;
  const gitIndex = fetch(`${GIT_DIR}index.json`).then((r) => r.json()).catch(() => []);
  const GIT_ROW = {
    git_commit: { beats: [["happy", "Idle"]] },
    git_pull_request: { beats: [["excited", "Wave"]] },
    git_pull_request_merged: { beats: [["excited", "Celebrate"]], hop: true },
    git_check_pass: { beats: [["happy", "Celebrate"]] },
    git_ci_fail: { beats: [["sad", "Idle"]] },
    git_conflict: { beats: [["thinking", "Think"], ["surprised", "Think"]] },
  };
  function gitContent(v, color, icon, index) {
    const base = handContent(v, color);
    const spec = GIT_ROW[icon] || { beats: [["happy", "Idle"]] };
    const c = { attach: null };
    c.attach = async () => {
      await base.attach();
      const root = v.scene.children.find((o) => !o.isLight);
      const box = new THREE.Box3().setFromObject(v.scene);
      const size = box.getSize(new THREE.Vector3());
      const anchor = new THREE.Group();
      anchor.position.set(box.max.x - size.x * 0.02, box.max.y - size.y * 0.02, box.max.z);
      v.scene.add(anchor);
      const [gltf, rows] = await Promise.all([loader.loadAsync(`${GIT_DIR}${icon}.glb`), gitIndex]);
      const obj = SkeletonUtils.clone(gltf.scene);
      const tint = rows.find((e) => e.name === icon)?.tint || "#ffd23f";
      obj.traverse((n) => {
        if (n.isMesh && n.material?.name === "Clay") { n.material = n.material.clone(); n.material.color.set(tint); }
      });
      const pb = new THREE.Box3().setFromObject(obj), ps = pb.getSize(new THREE.Vector3()), pc = pb.getCenter(new THREE.Vector3());
      const k = (size.y * 0.64) / Math.max(ps.y, ps.x, 0.001);
      obj.scale.setScalar(k); obj.position.set(-pc.x * k, -pc.y * k, 0);
      const bob = new THREE.Group(); bob.add(obj); anchor.add(bob);
      let beat = 0, t = index * 0.9, clock = index * 0.7;
      const apply = () => { base.setExpression(spec.beats[beat][0]); base.setClip(spec.beats[beat][1]); };
      apply();
      const baseY = root ? root.position.y : 0;
      const baseTick = v.tick;
      v.tick = (dt) => {
        const moving = baseTick(dt);
        if (reduceMotion) return moving;
        t += dt; clock += dt;
        if (spec.beats.length > 1 && t >= BEAT_S) { t -= BEAT_S; beat = (beat + 1) % spec.beats.length; apply(); }
        bob.position.y = Math.sin(clock * 2.1) * size.y * 0.025;
        // Pop in with a little overshoot, hold, shrink out, pause, repeat.
        const cyc = clock % 4.2;
        const pop = cyc < 0.45 ? 1 + Math.sin(Math.PI * Math.min(cyc / 0.45, 1) * 1.15) * 0.12 * (1 - cyc / 0.45) - Math.pow(1 - cyc / 0.45, 3)
          : cyc < 3.3 ? 1 : cyc < 3.65 ? Math.pow(1 - (cyc - 3.3) / 0.35, 2) : 0;
        bob.scale.setScalar(Math.max(pop, 0.0001));
        bob.rotation.z = Math.sin(clock * 1.3) * 0.05;
        if (spec.hop && root) {
          const u = (clock % 1.9) / 1.9;
          root.position.y = baseY + (u < 0.4 ? Math.sin(Math.PI * (u / 0.4)) * size.y * 0.09 : 0);
        }
        v.dirty = true;
        return true;
      };
      v.dirty = true;
    };
    return c;
  }
  gitEls.forEach((el, i) => {
    const v = makeViewer(el);
    v.fitScale = 1.9;
    const c = gitContent(v, el.dataset.tint || TINTS[0], el.dataset.icon, i);
    v.load = () => c.attach();
  });

  // ---- agent avatars (concept)
  agentEls.forEach((el) => {
    const v = makeViewer(el);
    const c = el.dataset.kind === "hand" ? handContent(v, el.dataset.tint || TINTS[0]) : mochiContent(v, el.dataset.id);
    v.load = () => c.attach();
  });

  requestAnimationFrame(frame);
}

boot().catch((err) => console.error("Hands site error", err));
