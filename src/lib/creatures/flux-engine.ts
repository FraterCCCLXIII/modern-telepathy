// @ts-nocheck
/* The Flux engine: the metaball orb behind the Hangout welcome screen, in plain JS.
 *
 * Ported from OpenHands Agent Canvas, examples/canvas-apps/hangout/extension.js (the blob scene,
 * eyes on a sphere, ten colourings, nine shapes, and the small animated Flux orb). It needs a DOM
 * canvas; `createBlobScene` and `stepBlobScene` are pure and run anywhere. Keep in sync by hand.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

function hashOf(text) {
  let h = 0;
  for (let i = 0; i < String(text).length; i += 1) h = (h * 31 + String(text).charCodeAt(i)) >>> 0;
  return h;
}

export function seededRandom(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ─── Pill eyes on the blob: they blink, look around and curve with a sphere ──

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function createEyes(rand) {
  return { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, look: 0.6, blinkAt: 1.5 + rand() * 2, blinkP: -1, again: false, closed: 0, pointer: null };
}

/** Moves the gaze toward its target, picks new glances, and runs blinks (a quick close and open, sometimes twice). */
function stepEyes(s, dt) {
  const e = s.eyes;
  const { rand, t } = s;
  const fresh = e.pointer && t - e.pointer.at < 2.5;
  if (fresh) {
    const R = s.eyeR;
    e.ty = clampN(((e.pointer.x - s.fx) / R) * 1.1, -0.55, 0.55);
    e.tp = clampN(((e.pointer.y - s.fy) / R) * 0.9, -0.38, 0.38);
  } else {
    e.look -= dt;
    if (e.look <= 0) {
      e.look = 0.9 + rand() * 2.4;
      e.ty = (rand() - 0.5) * 1.0;
      e.tp = (rand() - 0.5) * 0.6;
      if (rand() < 0.3) { e.ty = 0; e.tp = 0; }
    }
  }
  // A spring with damping: the eyes arrive quickly and settle without snapping.
  e.vy += (e.ty - e.yaw) * 90 * dt; e.vp += (e.tp - e.pitch) * 90 * dt;
  const damp = Math.max(0, 1 - 11 * dt);
  e.vy *= damp; e.vp *= damp;
  e.yaw += e.vy * dt; e.pitch += e.vp * dt;
  e.blinkAt -= dt;
  if (e.blinkP < 0 && e.blinkAt <= 0) { e.blinkP = 0; e.again = rand() < 0.2; }
  if (e.blinkP >= 0) {
    e.blinkP += dt / 0.18;
    e.closed = Math.sin(Math.PI * Math.min(1, e.blinkP));
    if (e.blinkP >= 1) {
      e.blinkP = -1; e.closed = 0;
      e.blinkAt = e.again ? 0.12 : 2 + rand() * 3.5;
      e.again = false;
    }
  }
}

/** The outline of one pill eye, bent onto the sphere: [{x, y}], for an eye centred at (yaw, pitch). */
export function eyeOutline(s, yaw, pitch, squash = 1) {
  const R = s.eyeR;
  const a = 0.1, b = 0.27;
  const pts = [];
  const N = 14;
  const add = (u, v) => {
    const lat = pitch + v * squash;
    const lon = yaw + u / Math.max(0.3, Math.cos(pitch));
    pts.push({ x: s.fx + R * Math.sin(lon) * Math.cos(lat), y: s.fy + R * Math.sin(lat) });
  };
  for (let k = 0; k <= N; k += 1) { const f = (Math.PI * k) / N; add(a * Math.cos(f), -(b - a) - a * Math.sin(f)); }
  for (let k = 0; k <= N; k += 1) { const f = (Math.PI * k) / N; add(-a * Math.cos(f), b - a + a * Math.sin(f)); }
  return pts;
}

/** Both eyes for the current gaze and blink. */
export function eyesOf(s) {
  const e = s.eyes;
  const squash = 1 - e.closed * 0.92;
  return [-0.3, 0.3].map((dx) => eyeOutline(s, e.yaw + dx, e.pitch, squash));
}

export function drawEyes(ctx, s, color) {
  ctx.fillStyle = color || "#1a0f33";
  eyesOf(s).forEach((pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  });
}

export function createBlobScene(w, h, rand = Math.random) {
  const base = Math.min(w, h) * 0.105;
  const lobes = Array.from({ length: LOBE_COUNT }, (_, i) => ({ a: (i / LOBE_COUNT) * Math.PI * 2, d: base * 0.42, r: base * (0.5 + 0.12 * (i % 3)), sp: 0.4 + i * 0.07, ph: i * 1.3, ox: null, oy: null, or: base * 0.5 }));
  const scene = { w, h, base, rand, t: 0, lobes, minis: [], next: 0.6, bump: 0, balls: [], melted: 0, shed: 0, eyes: createEyes(rand), fx: w / 2, fy: h * 0.4, eyeR: base * 2, variant: null, shape: null, mainR: base };
  setBlobVariant(scene, "solid");
  scene.shape = BLOB_SHAPES[0];
  stepBlobScene(scene, 0);
  return scene;
}

const MAX_MINIS = 16;
const BLOB_RGB = [139, 92, 246];
const MINI_HUES = [[244, 114, 182], [52, 211, 153], [251, 191, 36], [56, 189, 248], [251, 113, 133], [163, 230, 53], [34, 211, 238], [249, 115, 22]];
const mixRgb = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

/** Advances the scene by dt seconds: the mass wobbles, small blobs leave it or approach it, and melt when they arrive. */
export function stepBlobScene(s, dt) {
  s.t += dt;
  const { t, base, w, h, rand } = s;
  const cx = w / 2 + Math.sin(t * 0.7) * base * 0.1;
  const cy = h * 0.4 + Math.cos(t * 0.55) * base * 0.08;
  s.fx = cx; s.fy = cy;
  stepEyes(s, dt);
  s.bump = Math.max(0, s.bump - dt * 0.35);
  s.next -= dt;
  if (s.next <= 0 && s.minis.length < MAX_MINIS) {
    s.next = 0.5 + rand() * 0.8;
    if (rand() < 0.78) {
      // Shed: a small blob pinches off the edge and drifts away. Sometimes two or three leave together.
      const burst = rand() < 0.35 ? 2 + Math.floor(rand() * 2) : 1;
      const a0 = rand() * Math.PI * 2;
      for (let k = 0; k < burst && s.minis.length < MAX_MINIS; k += 1) {
        const a = a0 + (k - (burst - 1) / 2) * 0.55 + (rand() - 0.5) * 0.3;
        const sp = 75 + rand() * 80;
        s.minis.push({ x: cx + Math.cos(a) * base * 0.95, y: cy + Math.sin(a) * base * 0.95, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: base * (0.13 + rand() * 0.2), state: "out", age: 0, ttl: 2.4 + rand() * 3, ph: rand() * 6, hue: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] });
        s.shed += 1;
      }
    } else {
      const a = rand() * Math.PI * 2;
      const far = Math.max(w, h) * 0.5;
      s.minis.push({ x: cx + Math.cos(a) * far, y: cy + Math.sin(a) * far * 0.7, vx: 0, vy: 0, r: base * (0.13 + rand() * 0.2), state: "in", age: 0, ttl: 0, ph: rand() * 6, hue: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] });
    }
  }
  s.minis.forEach((m) => {
    m.age += dt;
    if (m.state === "out") {
      m.x += m.vx * dt; m.y += m.vy * dt;
      const drag = Math.max(0, 1 - 0.45 * dt);
      m.vx *= drag; m.vy *= drag;
      if (m.age > m.ttl) m.state = "in";
    } else {
      const dx = cx - m.x, dy = cy - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.vx += (dx / d) * 170 * dt; m.vy += (dy / d) * 170 * dt;
      const drag = Math.max(0, 1 - 0.8 * dt);
      m.vx *= drag; m.vy *= drag;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (d < base * 0.62) {
        const before = m.r;
        m.r *= Math.max(0, 1 - 2.4 * dt);
        s.bump = Math.min(0.4, s.bump + (before - m.r) / base);
      }
    }
  });
  const gone = s.minis.filter((m) => m.state === "in" && m.r < base * 0.035).length;
  s.melted += gone;
  s.minis = s.minis.filter((m) => !(m.state === "in" && m.r < base * 0.035));
  const baseRgb = (s.variant && s.variant.base) || BLOB_RGB;
  const grow = 1 + s.bump * 0.3;
  const sh = s.shape || BLOB_SHAPES[0];
  const ease = dt === 0 ? 1 : Math.min(1, dt * 6);
  const mainTarget = base * grow * (sh.pts ? sh.main : 1) * (1 + 0.05 * Math.sin(t * 1.9));
  s.mainR += (mainTarget - s.mainR) * ease;
  const balls = [{ x: cx, y: cy, r: s.mainR, rgb: baseRgb }];
  s.lobes.forEach((l, i) => {
    let tx, ty, tr;
    if (sh.pts) {
      const p = sh.pts[i % sh.pts.length];
      tx = p[0] * base * sh.k + Math.sin(t * 1.3 + l.ph) * base * 0.07;
      ty = p[1] * base * sh.k + Math.cos(t * 1.1 + l.ph) * base * 0.07;
      tr = base * sh.lr * (1 + 0.1 * Math.sin(t * 2.1 + l.ph));
    } else {
      const reach = l.d * (1 + 0.28 * Math.sin(t * 1.3 + l.ph)) * grow;
      tx = Math.cos(l.a + t * l.sp) * reach;
      ty = Math.sin(l.a + t * l.sp * 0.9) * reach;
      tr = l.r * (1 + 0.14 * Math.sin(t * 2.1 + l.ph));
    }
    if (l.ox === null) { l.ox = tx; l.oy = ty; l.or = tr; }
    l.ox += (tx - l.ox) * ease; l.oy += (ty - l.oy) * ease; l.or += (tr - l.or) * ease;
    balls.push({ x: cx + l.ox, y: cy + l.oy, r: l.or, rgb: baseRgb });
  });
  s.minis.forEach((m) => {
    // Violet at the surface, its own hue once it is clear of the mass, violet again as it melts back in.
    const away = clampN((Math.hypot(m.x - cx, m.y - cy) - s.eyeR * 1.15) / (s.eyeR * 0.7), 0, 1);
    m.rgb = mixRgb(baseRgb, m.hue || baseRgb, away);
    balls.push({ x: m.x, y: m.y, r: m.r * (1 + 0.1 * Math.sin(t * 3 + m.ph)), rgb: m.rgb });
  });
  // Vibration: every blob's radius shakes at the variation's frequency, and some jitter in place.
  const vibe = s.variant && s.variant.vibe;
  if (vibe) {
    balls.forEach((b, i) => {
      b.r *= 1 + vibe.amp * Math.sin(t * vibe.freq * Math.PI * 2 + i * 1.7);
      if (vibe.jit) { b.x += Math.sin(t * 47 + i * 5) * base * 0.02; b.y += Math.cos(t * 53 + i * 3) * base * 0.02; }
    });
  }
  s.balls = balls;
  // The eyes live on a sphere that is the mass itself: centred on the mass's real centroid, with its radius measured from there.
  const mass = balls.slice(0, 1 + s.lobes.length);
  let sx = 0, sy = 0, n = 0;
  const grid = base * 0.2, span = base * 4;
  for (let y = cy - span; y <= cy + span; y += grid) {
    for (let x = cx - span; x <= cx + span; x += grid) {
      if (blobField(mass, x, y) >= 1) { sx += x; sy += y; n += 1; }
    }
  }
  if (n) { s.fx = sx / n; s.fy = sy / n; }
  let sum = 0;
  for (let k = 0; k < 12; k += 1) {
    const ang = (k / 12) * Math.PI * 2;
    let r = base * 0.4;
    while (r < base * 5 && blobField(mass, s.fx + Math.cos(ang) * r, s.fy + Math.sin(ang) * r) >= 1) r += base * 0.04;
    sum += r;
  }
  s.eyeR += (sum / 12 * 0.9 - s.eyeR) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
}

/** The blob field at a point: 1 or more is inside the mass. */
export function blobField(balls, x, y) {
  let f = 0;
  for (let i = 0; i < balls.length; i += 1) {
    const b = balls[i];
    const dx = x - b.x, dy = y - b.y;
    f += (b.r * b.r) / (dx * dx + dy * dy + 1);
  }
  return f;
}


// ─── Variations of the blob: colours, gradients and vibrations ───────────────

const hslToRgb = (h, sat, l) => {
  const hh = (((h % 360) + 360) % 360) / 30;
  const a = sat * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + hh) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const stops = (list, u) => {
  const x = clampN(u, 0, 1) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(x));
  return mixRgb(list[i], list[i + 1], x - i);
};

/** A point on the mass as a point on a sphere: unit-sphere x, y and depth, longitude and latitude. Points outside the rim sit on the rim. */
export function sphereCoords(s, x, y) {
  const R = Math.max(1, s.eyeR / 0.9);
  let u = (x - s.fx) / R, v = (y - s.fy) / R;
  const r = Math.hypot(u, v);
  if (r > 1) { u /= r; v /= r; }
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return { u, v, w, lon: Math.atan2(u, w), lat: Math.asin(v) };
};

const DEG = 180 / Math.PI;

/**
 * Each variation is a look for the mass: a flat base colour, or a colour function of position and time,
 * and how much it vibrates (radius wobble at a frequency in Hz, and optional jitter). The gradients are
 * drawn on a sphere, so their bands curve around the mass and bunch up toward its edge.
 */
export const BLOB_VARIANTS = [
  { id: "solid", label: "Violet", dot: "#8b5cf6", base: [139, 92, 246] },
  { id: "rainbow", label: "Rainbow", dot: "#f59e0b", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); return hslToRgb(t * 40 + c.lon * 110 + c.lat * 50, 0.85, 0.6); } },
  { id: "gradient", label: "Gradient", dot: "#ec4899", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const a = t * 0.3; const g = (c.u * Math.cos(a) + c.v * Math.sin(a)) * 0.8 + c.w * 0.6; return stops([[139, 92, 246], [236, 72, 153], [249, 115, 22]], (g + 0.9) / 1.9); } },
  { id: "aurora", label: "Aurora", dot: "#2dd4bf", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); return hslToRgb(150 + 110 * (0.5 + 0.5 * Math.sin(c.lon * 2.4 + t * 0.9)) + 36 * Math.sin(c.lat * 3.2 - t * 0.6), 0.75, 0.58); } },
  { id: "sunset", label: "Sunset", dot: "#f97316", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const e = s.eyes; const sun = (c.u * Math.sin(e.yaw) * Math.cos(e.pitch) + c.v * Math.sin(e.pitch) + c.w * Math.cos(e.yaw) * Math.cos(e.pitch)); return stops([[76, 29, 149], [219, 39, 119], [249, 115, 22], [253, 224, 71]], (sun + 0.2) / 1.2); } },
  { id: "prism", label: "Prism", dot: "#3b82f6", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const a = t * 0.7; const lon = Math.atan2(c.u * Math.cos(a) + c.w * Math.sin(a), c.w * Math.cos(a) - c.u * Math.sin(a)); return hslToRgb(lon * DEG * 2 + c.lat * 40, 0.8, 0.6); } },
  { id: "neon", label: "Neon", dot: "#22d3ee", base: [34, 211, 238], color: (x, y, t) => mixRgb([34, 211, 238], [205, 255, 255], 0.18 + 0.17 * Math.sin(t * 6)), vibe: { amp: 0.05, freq: 6 } },
  { id: "jelly", label: "Jelly", dot: "#4ade80", base: [52, 211, 153], vibe: { amp: 0.1, freq: 2.2 } },
  { id: "fizz", label: "Fizz", dot: "#f43f5e", base: [244, 63, 94], vibe: { amp: 0.07, freq: 22, jit: true } },
  { id: "paper", label: "Paper", dot: "#efece4", base: [239, 236, 228], eye: "#2b2433" },
];

export function setBlobVariant(scene, id) {
  scene.variant = BLOB_VARIANTS.find((v) => v.id === id) || BLOB_VARIANTS[0];
}

/** The colour a variation gives a point: its own function, or the blobs' flat colours. */
export function variantColorAt(scene, x, y) {
  const v = scene.variant;
  return v.color ? v.color(x, y, scene.t, scene) : blobColorAt(scene.balls, x, y, v.base || BLOB_RGB);
}


// ─── Shapes the mass can take: each is an SVG outline, and the lobes glide to points along it ──

const perimeter = (poly, n) => {
  const pts = [...poly, poly[0]];
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, k) => {
    let d = (k / n) * total;
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i += 1; }
    const f = lens[i] ? d / lens[i] : 0;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  });
};
const around = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));
const LOBE_COUNT = 10;

/** The outlines, in unit coordinates (about -1 to 1), as polygons. The same points draw the rail icons and place the lobes. */
const SHAPE_POLYS = {
  square: [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]],
  triangle: [[0, -1.12], [1.05, 0.82], [-1.05, 0.82]],
  star: around(10, (a, i) => { const r = i % 2 ? 0.42 : 1.2; const t = a - Math.PI / 2; return [Math.cos(t) * r, Math.sin(t) * r]; }),
  heart: around(32, (a) => [(16 * Math.sin(a) ** 3) / 16 * 1.05, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * 1.05 + 0.08]),
  cross: [[-0.36, -1], [0.36, -1], [0.36, -0.36], [1, -0.36], [1, 0.36], [0.36, 0.36], [0.36, 1], [-0.36, 1], [-0.36, 0.36], [-1, 0.36], [-1, -0.36], [-0.36, -0.36]],
  pill: [...Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i / 10) * Math.PI; return [0.95 + Math.cos(a) * 0.46, Math.sin(a) * 0.46]; }), ...Array.from({ length: 11 }, (_, i) => { const a = Math.PI / 2 + (i / 10) * Math.PI; return [-0.95 + Math.cos(a) * 0.46, Math.sin(a) * 0.46]; })],
  hexagon: around(6, (a) => { const t = a - Math.PI / 2; return [Math.cos(t) * 1.08, Math.sin(t) * 1.08]; }),
  drop: around(32, (a) => [Math.sin(a) * Math.sin(a / 2) * 1.2, -Math.cos(a) * 1.08]),
};

// How each outline is built from blobs: how far out the lobes sit (k), how big they are (lr) and how much the centre fills (main).
const SHAPE_TUNING = {
  square: { k: 1.25, lr: 0.6, main: 0.75 },
  triangle: { k: 1.45, lr: 0.5, main: 0.5 },
  star: { k: 1.7, lr: 0.4, main: 0.3 },
  heart: { k: 1.45, lr: 0.52, main: 0.55 },
  cross: { k: 1.6, lr: 0.5, main: 0.55 },
  pill: { k: 1.6, lr: 0.56, main: 0.6 },
  hexagon: { k: 1.35, lr: 0.6, main: 0.7 },
  drop: { k: 1.5, lr: 0.5, main: 0.55 },
};

export const BLOB_SHAPES = [
  { id: "blob", label: "Blob" },
  ...Object.keys(SHAPE_POLYS).map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), poly: SHAPE_POLYS[id], pts: perimeter(SHAPE_POLYS[id], LOBE_COUNT), ...SHAPE_TUNING[id] })),
];

export function setBlobShape(scene, id) {
  scene.shape = BLOB_SHAPES.find((sh) => sh.id === id) || BLOB_SHAPES[0];
  scene.bump = Math.min(0.4, scene.bump + 0.25);
}

/** An SVG icon for a shape: its outline, or a loose blob for the organic one. */
export function shapeIcon(shape) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linejoin", "round");
  if (shape.poly) {
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", shape.poly.map(([x, y]) => `${(12 + x * 9).toFixed(1)},${(12 + y * 9).toFixed(1)}`).join(" "));
    svg.append(poly);
  } else {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M12 3c4 0 8 2.2 8.6 6.4.5 3.5-1.7 4.6-1.6 7C18.8 20 14.8 21.5 11 21 6.6 20.4 3.4 17.6 3.5 13.4 3.6 10 6 8.8 6.4 6.6 6.8 4.4 9 3 12 3Z");
    svg.append(path);
  }
  return svg;
}

/** The flat colour at a point: each blob's colour weighted by how much of the field it supplies there. */
export function blobColorAt(balls, x, y, fallback = BLOB_RGB) {
  let f = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    const dx = x - ball.x, dy = y - ball.y;
    const c = (ball.r * ball.r) / (dx * dx + dy * dy + 1);
    const rgb = ball.rgb || fallback;
    f += c; r += c * rgb[0]; g += c * rgb[1]; b += c * rgb[2];
  }
  return f ? [Math.round(r / f), Math.round(g / f), Math.round(b / f)] : fallback;
}

/** Draws the scene in one flat colour per blob. Smooth mode softens the edge; voxel mode keeps hard square cells. */
export function drawBlobScene(ctx, off, scene, mode, rgb, cellSize) {
  const voxel = mode === "voxel";
  const cell = cellSize || (voxel ? 14 : 4);
  const gw = Math.ceil(scene.w / cell), gh = Math.ceil(scene.h / cell);
  if (off.width !== gw || off.height !== gh) { off.width = gw; off.height = gh; }
  const octx = off.getContext("2d");
  const img = octx.createImageData(gw, gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const f = blobField(scene.balls, (gx + 0.5) * cell, (gy + 0.5) * cell);
      const a = voxel ? (f > 1 ? 255 : 0) : Math.max(0, Math.min(1, (f - 0.9) / 0.18)) * 255;
      if (a) {
        const i = (gy * gw + gx) * 4;
        const c = variantColorAt(scene, (gx + 0.5) * cell, (gy + 0.5) * cell);
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, scene.w, scene.h);
  ctx.imageSmoothingEnabled = !voxel;
  ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
}

// ─── Flux orbs: the welcome blob in miniature, with its own colour variation and shape ──
const fluxLive = new Set();
let fluxTimer = 0;
const FLUX_VARIANTS = ["aurora", "sunset", "prism", "gradient", "rainbow", "neon"];

function fluxTick() {
  fluxLive.forEach((orb) => {
    if (!orb.canvas.isConnected) { fluxLive.delete(orb); return; }
    const r = orb.canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    stepBlobScene(orb.scene, 0.1);
    orb.paint();
  });
  if (!fluxLive.size) { clearInterval(fluxTimer); fluxTimer = 0; }
}

/** An animated orb avatar: colours that drift and a body that wobbles or morphs into a shape. */
export function fluxOrb({ variant = "aurora", shape = "blob", seed = "orb", size = 72, mode = "smooth" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "flux";
  canvas.width = size; canvas.height = size;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.variant = variant;
  canvas.dataset.shape = shape;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return canvas;
  const W = 320;
  const scene = createBlobScene(W, W, seededRandom(hashOf(seed)));
  setBlobVariant(scene, variant);
  setBlobShape(scene, shape);
  for (let i = 0; i < 40; i += 1) stepBlobScene(scene, 0.1);
  const big = document.createElement("canvas");
  big.width = W; big.height = W;
  const bctx = big.getContext("2d");
  const off = document.createElement("canvas");
  const paint = () => {
    drawBlobScene(bctx, off, scene, mode, BLOB_RGB, mode === "voxel" ? 14 : 5);
    drawEyes(bctx, scene, scene.variant.eye);
    const side = scene.base * 6.8;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(big, scene.fx - side / 2, scene.fy - side / 2, side, side, 0, 0, size, size);
  };
  paint();
  fluxLive.add({ canvas, scene, paint });
  if (!fluxTimer) fluxTimer = setInterval(fluxTick, 100);
  return canvas;
}

export { hashOf, BLOB_RGB, MINI_HUES };
