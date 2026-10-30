// Hero "Effect" post-process: jitter (line boil), pencil (hatched graphite outline) and retro print.
// The page owns ONE shared WebGLRenderer, so this renders the hero's scene into an offscreen target
// (colour with alpha, plus a depth texture) and runs one fullscreen pass over it into the shared
// canvas. Only the hero calls it; every other viewer keeps the plain renderer.render path.
//
// Ported from the owner's earlier work (see docs/shader-effects-found.md):
//   - pencil: Sobel edge detect (three.js SobelOperatorShader, MIT) on alpha + depth + luma, with the
//     "pencil" ink brush idea from yakopop render/toon.ts (broken, grainy line, noise stuck to the surface).
//   - jitter: yakopop film/restyle.ts "painted" mode (noise-nudged texture lookups near edges) and
//     player/cine/overlay.ts (lines redrawn every other frame so they boil), here as a screen-space
//     warp re-seeded at 12 fps.
//   - retro print: yakopop render/toonLooks.ts "retro" (2 bands, warm brown shadow, heavy ink, grain)
//     plus restyle.ts "retro" grain redrawn on twos.

// Effects are independent, additive flags (the Effect dropdown is a multi-select). They compose in ONE pass:
//   1 jitter  warps the sampling uv (the boil), so it moves everything below
//   2 colour  toon bands first, then retro's two-tone warm shadow / halftone / grain on top
//   3 pencil  wash + hatching on the near-black parts only (judged on the original colour), then
//   4 outline ONE line: pencil's broken graphite double line when pencil is on (a clean toon/retro line only
//             fills its gaps, never stacked as a second line), else retro's heavy ink, else toon's clean black.
export const EFFECT_FLAGS = ["jitter", "pencil", "retro print", "toon"];
export const EFFECTS = EFFECT_FLAGS;
const BOIL_FPS = 12;

// Accepts an array / Set of flag names, or a legacy single name ("none", "pencil + jitter", ...).
// Returns the active flags in EFFECT_FLAGS order, without duplicates or unknown names.
export function normalizeEffects(x) {
  if (x == null) return [];
  const names = typeof x === "string" ? x.split("+") : [...x].flatMap((n) => String(n).split("+"));
  const on = new Set(names.map((n) => n.trim().toLowerCase()));
  return EFFECT_FLAGS.filter((f) => on.has(f));
}

export const effectAnimates = (effects) => { const f = normalizeEffects(effects); return f.includes("jitter") || f.includes("retro print"); };

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uFrame;   // boil frame index (0 when motion is reduced)
uniform float uJitter;  // each flag is 0 or 1
uniform float uPencil;
uniform float uRetro;
uniform float uToon;
uniform float uNear;
uniform float uFar;
uniform float uDist;    // camera distance to the model, to scale depth edges
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 vnoise2(vec2 p) { return vec2(vnoise(p), vnoise(p + 41.7)); }

vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// premultiplied linear texel -> straight sRGB colour (rgb) and alpha (a)
vec4 fetch(vec2 uv) {
  vec4 t = texture2D(tColor, uv);
  vec3 c = t.a > 0.001 ? t.rgb / t.a : vec3(0.0);
  return vec4(toSrgb(c), t.a);
}
float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = (uNear * uFar) / (uFar - d * (uFar - uNear));   // view distance
  return min(z, uDist * 2.5) / uDist;
}

// Sobel magnitude of alpha, depth and luma. Returns (alpha edge, depth edge, luma edge).
vec3 sobel(vec2 uv, float r) {
  vec2 px = r / uRes;
  vec4 s[9];
  float z[9];
  int k = 0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 q = uv + vec2(float(i), float(j)) * px;
    vec4 f = fetch(q);
    s[k] = vec4(f.a, luma(f.rgb) * f.a, 0.0, 0.0);
    z[k] = linDepth(q) * step(0.01, f.a);
    k++;
  }
  // indices: 0 1 2 / 3 4 5 / 6 7 8
  float ax = (s[2].x + 2.0 * s[5].x + s[8].x) - (s[0].x + 2.0 * s[3].x + s[6].x);
  float ay = (s[6].x + 2.0 * s[7].x + s[8].x) - (s[0].x + 2.0 * s[1].x + s[2].x);
  float lx = (s[2].y + 2.0 * s[5].y + s[8].y) - (s[0].y + 2.0 * s[3].y + s[6].y);
  float ly = (s[6].y + 2.0 * s[7].y + s[8].y) - (s[0].y + 2.0 * s[1].y + s[2].y);
  float zx = (z[2] + 2.0 * z[5] + z[8]) - (z[0] + 2.0 * z[3] + z[6]);
  float zy = (z[6] + 2.0 * z[7] + z[8]) - (z[0] + 2.0 * z[1] + z[2]);
  return vec3(length(vec2(ax, ay)), length(vec2(zx, zy)), length(vec2(lx, ly)));
}

void main() {
  float sc = clamp(uRes.y / 760.0, 0.6, 2.4);       // px scale so the look is the same size at any canvas size
  vec2 uv = vUv;
  float seed = uFrame * 7.31;

  // JITTER: the picture is re-sampled through a warp that is redrawn on twos, so silhouettes and
  // lines wander a pixel or three and snap to a new pose, the way a hand-inked cel boils.
  vec2 warp = vec2(0.0);
  if (uJitter > 0.5) {
    vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
    vec2 w = (vnoise2(p * 7.0 + seed) - 0.5) * 2.2 + (vnoise2(p * 26.0 - seed * 1.7) - 0.5) * 1.1;
    warp = w * 3.4 * sc / uRes;
  }
  vec2 fuv = uv + warp;
  vec4 base = fetch(fuv);
  float a = base.a;
  vec3 col = base.rgb;

  bool pencil = uPencil > 0.5, retro = uRetro > 0.5, toon = uToon > 0.5;
  if (!pencil && !retro && !toon) {
    gl_FragColor = vec4(0.0);
    if (a > 0.0) { vec4 t = texture2D(tColor, fuv); gl_FragColor = vec4(toSrgb(a > 0.001 ? t.rgb / a : vec3(0.0)) * a, a); }
    return;
  }

  vec2 px = uv * uRes / sc;   // pixel coordinates at the 760px-tall reference
  float L0 = luma(col);       // luma of the rendered colour, before any colour stage (finds the black parts)
  vec3 rgb = col;

  // COLOUR 1, TOON: flat colour in three hard shading bands (hue kept, brightness stepped).
  // Near-black parts (eyes, marks) stay as they are.
  if (toon) {
    float v = max(max(rgb.r, rgb.g), rgb.b);
    vec3 hue = rgb / max(v, 0.001);
    float q = v < 0.5 ? 0.56 : (v < 0.78 ? 0.8 : 1.0);
    rgb = v < 0.2 ? rgb : hue * q * min(1.0, 0.5 + v);
  }

  // COLOUR 2, RETRO PRINT: two flat tones with a warm brown shadow, halftone dots and grain redrawn on twos.
  if (retro) {
    float L = luma(rgb);
    float band = smoothstep(0.455, 0.475, L);
    vec3 lit = mix(rgb, vec3(L), 0.1) * 1.04;
    vec3 shade = mix(lit, vec3(0.725, 0.54, 0.416), 0.55) * 0.82;
    rgb = mix(shade, lit, band);
    float grain = hash(floor(px) + seed * 3.1) - 0.5;
    rgb *= 1.0 + grain * 0.16;
    vec2 rp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px;
    vec2 cell = fract(rp / 4.5) - 0.5;
    float dots = smoothstep(0.34, 0.3, length(cell)) * (1.0 - band) * 0.18;
    rgb = mix(rgb, vec3(0.3, 0.2, 0.16), dots);
  }

  float line = 0.0;
  vec3 lineCol = vec3(0.02, 0.02, 0.025);   // toon ink

  // clean outline from alpha, depth and luma edges (toon: thin and black, retro: heavy warm ink)
  if (toon || retro) {
    vec3 e = retro ? sobel(uv + warp * 0.5, 1.6 * sc) : sobel(uv + warp * 0.5, 1.7 * sc);
    if (retro) {
      float m = max(e.x * 0.95, max(e.y * 5.0 * sc, e.z * 0.35));
      float speck = 0.6 + 0.6 * vnoise(px * 0.15);
      line = clamp(smoothstep(0.3, 0.8, m) * speck * 1.15, 0.0, 1.0);
      lineCol = vec3(0.09, 0.06, 0.07);
    } else {
      float m = max(e.x * 0.95, max(e.y * 5.0 * sc, e.z * 0.4));
      line = smoothstep(0.28, 0.6, m);
    }
  }

  // PENCIL: a pale coloured-pencil wash, graphite hatching that thickens in the shade, and a broken
  // double outline. The line sits on the model (alpha + depth + luma edges) and is re-drawn with the boil.
  if (pencil) {
    float L = L0;
    // only the black parts (eyes, mouth, marks) take the pencil; coloured fill stays as rendered
    float blk = 1.0 - smoothstep(0.2, 0.36, L);
    vec3 wash = rgb;
    float tooth = vnoise(px * 0.9) * 0.5 + vnoise(px * 2.3) * 0.5;
    wash *= 1.0 - 0.06 * tooth * blk;

    // hatch strokes: wavy parallel lines at 45 degrees, a second set across in the shade, a third in the dark
    float dark = 1.0 - L * 1.05;
    float wav = (vnoise(px * 0.011 + seed) - 0.5) * 3.0;
    float g1 = (px.x + px.y) / 5.6 + wav;
    float g2 = (px.x - px.y) / 6.0 + wav * 0.8 + 11.3;
    float g3 = px.x / 6.5 + wav * 0.6 + 4.1;
    float l1 = smoothstep(0.62, 0.9, abs(fract(g1) * 2.0 - 1.0));
    float l2 = smoothstep(0.62, 0.9, abs(fract(g2) * 2.0 - 1.0));
    float l3 = smoothstep(0.64, 0.9, abs(fract(g3) * 2.0 - 1.0));
    float broken = smoothstep(0.25, 0.6, vnoise(px * 0.35 + seed * 0.3));
    float h = l1 * smoothstep(0.22, 0.32, dark) + l2 * smoothstep(0.36, 0.48, dark) + l3 * smoothstep(0.55, 0.7, dark);
    h = clamp(h, 0.0, 1.0) * broken * blk;
    // black parts become a pencilled-in grey, with darker graphite strokes laid over it
    wash = mix(wash, vec3(0.36, 0.36, 0.39), blk * 0.85);
    rgb = mix(wash, vec3(0.07, 0.07, 0.09), h * 0.8 * a);

    // outline: two passes a hair apart, each with its own wobble, so it reads as drawn twice
    vec2 o1 = (vnoise2(px * 0.03 + seed) - 0.5) * 3.0 * sc / uRes;
    vec2 o2 = (vnoise2(px * 0.03 + 9.0 - seed) - 0.5) * 3.0 * sc / uRes;
    vec3 e1 = sobel(uv + warp * 0.6 + o1, 1.5 * sc);
    vec3 e2 = sobel(uv + warp * 0.6 + o2, 1.3 * sc);
    float m1 = max(e1.x * 0.9, max(e1.y * 5.0 * sc, e1.z * 0.45));
    float m2 = max(e2.x * 0.9, max(e2.y * 5.0 * sc, e2.z * 0.45));
    float s1 = smoothstep(0.25, 0.7, m1) * smoothstep(0.1, 0.4, vnoise(px * 0.09 + seed * 0.5 + 3.0));
    float s2 = smoothstep(0.3, 0.8, m2) * smoothstep(0.25, 0.55, vnoise(px * 0.07 - seed * 0.4)) * 0.8;
    float pl = clamp(max(s1, s2), 0.0, 1.0);
    // the stroke dries out toward the ends: grain from the paper
    pl *= 0.8 + 0.2 * tooth;
    // with a clean toon / retro line too, it only backs the pencil line up (fills its gaps): still one outline
    line = max(pl, line * 0.6);
    lineCol = vec3(0.14, 0.14, 0.17);
  }

  float outA = max(a, line);
  gl_FragColor = vec4(mix(rgb, lineCol, line) * outA, outA);
}
`;

export function createEffects(THREE, renderer) {
  let target = null;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uFrame: { value: 0 }, uJitter: { value: 0 }, uPencil: { value: 0 }, uRetro: { value: 0 }, uToon: { value: 0 },
      uNear: { value: 0.01 }, uFar: { value: 50 }, uDist: { value: 1 },
    },
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, transparent: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const fsScene = new THREE.Scene();
  fsScene.add(quad);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function ensureTarget(w, h) {
    if (target && target.width === w && target.height === h) return;
    target?.depthTexture?.dispose();
    target?.dispose();
    target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: 4, depthBuffer: true, colorSpace: THREE.LinearSRGBColorSpace,
    });
    target.depthTexture = new THREE.DepthTexture(w, h);
    target.texture.minFilter = target.texture.magFilter = THREE.LinearFilter;
  }

  let current = [];
  return {
    // Sets the active flags (array / Set / legacy single name); used when render() is not given any.
    setEffects(x) { current = normalizeEffects(x); return current; },
    // Draws `scene` through the effect flags into the renderer's canvas (already sized w x h).
    render(scene, camera, w, h, effects = current, { dist = 1, frame = 0 } = {}) {
      const fl = normalizeEffects(effects);
      ensureTarget(w, h);
      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(prevTarget);
      const u = material.uniforms;
      u.tColor.value = target.texture; u.tDepth.value = target.depthTexture;
      u.uRes.value.set(w, h);
      u.uFrame.value = frame;
      u.uJitter.value = fl.includes("jitter") ? 1 : 0;
      u.uPencil.value = fl.includes("pencil") ? 1 : 0;
      u.uRetro.value = fl.includes("retro print") ? 1 : 0;
      u.uToon.value = fl.includes("toon") ? 1 : 0;
      u.uNear.value = camera.near; u.uFar.value = camera.far; u.uDist.value = dist;
      renderer.render(fsScene, fsCam);
    },
    // boil frame index at BOIL_FPS; frozen at 0 when motion is reduced
    frame(reduceMotion) { return reduceMotion ? 0 : Math.floor(performance.now() / 1000 * BOIL_FPS) % 4096; },
  };
}
