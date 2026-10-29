/*
 * Kosmos sprite mark: vanilla ES module port (canvas 2D, no dependencies).
 *
 * Ported from the archived Kosmos-computer repo
 *   archive/kosmos-computer/Kosmos-computer-Kosmos/src/components/
 *     spriteMarkSquares.ts          7x5 grid, logo cells, mask helpers
 *     sprite-mark/codec.ts          index list <-> boolean mask
 *     sprite-mark/patterns/geometric.ts   geometric pattern generators and the
 *                                         "boot" animation strings
 *     sprite-mark/data/patterns.json      faces and glyphs (index lists)
 *     sprite-mark/text.ts, library.ts     text as glyph frames, boot string pool
 *     SpriteWorkingMark.tsx               one lit/unlit square per cell
 *
 * One "screen" is a 7x5 grid of squares; a mask says which squares are lit.
 * The original plays one glyph per screen. Here a word is a row of screens,
 * each running the original boot strings and then locking to its glyph.
 *
 * Approximated (not in the original): the layout of several screens as a word,
 * the timeline that locks letters left to right, and the glyphs the original
 * lacks (it only has A C G H I N O R ! . and a heart; EXTRA_GLYPHS below
 * draws the other letters and digits as 5x5 shapes in the same style).
 */

export const COLS = 7;
export const ROWS = 5;
export const COUNT = COLS * ROWS;

const idx = (col, row) => row * COLS + col;
const coords = (i) => ({ col: i % COLS, row: Math.floor(i / COLS) });

/* codec.ts */
export const maskFromIndices = (indices) => {
  const on = new Set(indices);
  return Array.from({ length: COUNT }, (_, i) => on.has(i));
};
export const indicesFromMask = (mask) => mask.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);

/* spriteMarkSquares.ts: the static A-shaped logo (16 squares) */
const LOGO_CELLS = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [0, 2], [2, 2], [4, 2], [6, 2], [1, 3], [3, 3], [5, 3], [0, 4], [3, 4], [6, 4]];
export const LOGO_INDICES = new Set(LOGO_CELLS.map(([c, r]) => idx(c, r)));
export const logoPattern = () => maskFromIndices(LOGO_INDICES);

/* geometric.ts */
const CENTER_COL = Math.floor(COLS / 2);
const CENTER_ROW = Math.floor(ROWS / 2);
const fromPredicate = (fn) => Array.from({ length: COUNT }, (_, i) => { const { col, row } = coords(i); return fn(col, row, i); });
const fullPattern = () => maskFromIndices(Array.from({ length: COUNT }, (_, i) => i));

const diagonalSweep = () => Array.from({ length: COLS + ROWS - 1 }, (_, s) => fromPredicate((c, r) => c + r === s));
const antiDiagonalSweep = () => {
  const min = -(ROWS - 1), max = COLS - 1;
  return Array.from({ length: max - min + 1 }, (_, o) => fromPredicate((c, r) => c - r === min + o));
};
const diamonds = (inclusive = true) => {
  const maxR = Math.max(CENTER_COL, COLS - 1 - CENTER_COL, CENTER_ROW, ROWS - 1 - CENTER_ROW) + 1;
  return Array.from({ length: maxR + 1 }, (_, radius) => fromPredicate((c, r) => {
    const d = Math.abs(c - CENTER_COL) + Math.abs(r - CENTER_ROW);
    return inclusive ? d <= radius : d === radius;
  }));
};
const rings = () => diamonds(false);
const border = () => fromPredicate((c, r) => c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1);
const cross = () => fromPredicate((c, r) => c === CENTER_COL || r === CENTER_ROW);
const xShape = () => fromPredicate((c, r) => c - r === CENTER_COL - CENTER_ROW || c + r === CENTER_COL + CENTER_ROW);
const waves = () => Array.from({ length: 8 }, (_, p) => fromPredicate((c, r) => (c + r + p) % 4 === 0));
const logoPulse = () => [
  logoPattern(),
  fromPredicate((c, r, i) => LOGO_INDICES.has(i) || Math.abs(c - CENTER_COL) + Math.abs(r - CENTER_ROW) <= 2),
  fullPattern(),
  fromPredicate((_c, _r, i) => !LOGO_INDICES.has(i)),
];
const quadrants = () => [
  fromPredicate((c, r) => c < CENTER_COL && r < CENTER_ROW),
  fromPredicate((c, r) => c > CENTER_COL && r < CENTER_ROW),
  fromPredicate((c, r) => c < CENTER_COL && r > CENTER_ROW),
  fromPredicate((c, r) => c > CENTER_COL && r > CENTER_ROW),
];
const bands = () => [
  fromPredicate((c) => c % 2 === 0), fromPredicate((c) => c % 2 === 1),
  fromPredicate((_c, r) => r % 2 === 0), fromPredicate((_c, r) => r % 2 === 1),
];
const rowScan = () => Array.from({ length: ROWS }, (_, row) => fromPredicate((_c, r) => r === row));
const colScan = () => Array.from({ length: COLS }, (_, col) => fromPredicate((c) => c === col));
const checker = () => [fromPredicate((c, r) => (c + r) % 2 === 0), fromPredicate((c, r) => (c + r) % 2 === 1)];

/* patterns.json, category "faces": indices as in the original */
const FACE = {
  neutral: [16, 18, 30, 31, 32],
  smile: [16, 18, 30, 31, 32],
  grin: [16, 18, 29, 30, 31, 32, 33],
  blink: [29, 30, 31, 32, 33],
  wink: [16, 18, 11, 29, 30, 31, 32, 33],
  surprised: [9, 11, 16, 18, 31],
  sleep: [8, 9, 11, 12, 30, 31, 32],
};

/** The original "boot" animation strings (spriteMarkBootGeometricStrings + library faces). */
export const BOOT_STRINGS = [
  { id: 'boot.diag-sweep', name: 'Diagonal sweep', frames: diagonalSweep() },
  { id: 'boot.anti-diag', name: 'Anti-diagonal sweep', frames: antiDiagonalSweep() },
  { id: 'boot.rows', name: 'Row scan', frames: rowScan() },
  { id: 'boot.cols', name: 'Column scan', frames: colScan() },
  { id: 'boot.diamond-fill', name: 'Diamond fill', frames: diamonds(true) },
  { id: 'boot.ring-pulse', name: 'Ring pulse', frames: rings() },
  { id: 'boot.wave', name: 'Wave field', frames: waves() },
  { id: 'boot.logo-pulse', name: 'Logo pulse', frames: logoPulse() },
  { id: 'boot.quadrants', name: 'Quadrants', frames: quadrants() },
  { id: 'boot.bands', name: 'Alternating bands', frames: bands() },
  { id: 'boot.checker', name: 'Checker', frames: checker() },
  {
    id: 'boot.symmetry', name: 'Symmetry',
    frames: [
      logoPattern(), border(), cross(), xShape(),
      fromPredicate((_c, r) => r === 0 || r === ROWS - 1),
      fromPredicate((c) => c === 0 || c === COLS - 1),
      fromPredicate((c, r) => (c === 0 || c === COLS - 1) && (r === 0 || r === ROWS - 1)),
    ],
  },
  { id: 'boot.fill-flash', name: 'Fill flash', frames: [logoPattern(), fullPattern(), logoPattern()] },
  {
    id: 'faces.smile-cycle', name: 'Smile cycle',
    frames: [FACE.smile, FACE.smile, FACE.grin, FACE.blink, FACE.wink].map(maskFromIndices),
  },
  { id: 'boot.faces', name: 'Faces', frames: Object.values(FACE).map(maskFromIndices) },
];

/** Patterns offered to a picker: the random boot mix, or one named string. */
export const PATTERNS = [{ id: 'random', name: 'Boot (random mix)' }, ...BOOT_STRINGS.map(({ id, name }) => ({ id, name }))];

/* patterns.json, category "glyphs": the original glyphs, indices as in the source */
const GLYPH_INDICES = {
  A: [3, 8, 12, 14, 16, 18, 20, 22, 26, 28, 34],
  R: [0, 1, 2, 3, 7, 11, 14, 16, 17, 21, 25, 33],
  C: [1, 2, 3, 4, 7, 14, 21, 29, 30, 31, 32],
  O: [1, 2, 3, 4, 7, 12, 14, 19, 21, 26, 29, 30, 31, 32],
  I: [3, 10, 17, 24, 31],
  N: [0, 7, 14, 21, 28, 8, 16, 24, 32, 6, 13, 20, 27, 34],
  G: [1, 2, 3, 4, 7, 14, 17, 19, 21, 26, 29, 30, 31, 32],
  H: [0, 7, 14, 21, 28, 17, 2, 9, 16, 23, 30, 6, 13, 20, 27, 34],
  '!': [3, 10, 17, 31],
  '.': [17],
};

/* Not in the original (the original glyph.S, indices 1-4,7,9-11,19,28-31, reads as broken at this size, so S is redrawn too): the remaining letters and digits, 5x5 centred in the 7x5 screen. */
const EXTRA_GLYPHS = {
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '###..', '#....', '#####'],
  F: ['#####', '#....', '###..', '#....', '#....'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  Q: ['.###.', '#...#', '#...#', '#..#.', '.##.#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '..##.', '.#...', '#####'],
  3: ['####.', '....#', '.###.', '....#', '####.'],
  4: ['#..#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '####.'],
  6: ['.###.', '#....', '####.', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..'],
  8: ['.###.', '#...#', '.###.', '#...#', '.###.'],
  9: ['.###.', '#...#', '.####', '....#', '.###.'],
};

const GLYPHS = {};
for (const [ch, list] of Object.entries(GLYPH_INDICES)) GLYPHS[ch] = maskFromIndices(list);
for (const [ch, rows] of Object.entries(EXTRA_GLYPHS)) {
  GLYPHS[ch] = maskFromIndices(rows.flatMap((line, r) => [...line].flatMap((c, k) => (c === '#' ? [idx(k + 1, r)] : []))));
}
GLYPHS[' '] = maskFromIndices([]);

/** Characters the glyph set can draw (text.ts supportedTextChars, extended). */
export const SUPPORTED_CHARS = Object.keys(GLYPHS).join('');
export const ORIGINAL_CHARS = Object.keys(GLYPH_INDICES).join('');

export function cleanText(text, max = 10) {
  return [...String(text).toUpperCase()].filter((c) => GLYPHS[c]).slice(0, max).join('').replace(/^ +| +$/g, '');
}

/* Seeded PRNG so a given seed replays identically (the original uses Math.random). */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* geometric.ts pickRandomMaskIndex: random index, never an immediate repeat */
function pickIndex(rand, size, prev) {
  if (size <= 1) return 0;
  if (prev === undefined) return Math.floor(rand() * size);
  let next = Math.floor(rand() * (size - 1));
  if (next >= prev) next += 1;
  return next;
}

const FRAME_MS_BOOT = 100; // library.ts FRAME_MS.boot
const MAX_FPS = 30;
const MIN_PITCH = 9; // below this (CSS px) the word wraps onto more rows
const GAP_ROWS = 1;

function buildFrames(chars, patternId, rand) {
  const strings = patternId === 'random' ? BOOT_STRINGS : BOOT_STRINGS.filter((s) => s.id === patternId);
  const pool = strings.length ? strings : BOOT_STRINGS;
  return chars.map((ch, i) => {
    const frames = [];
    const lead = 8 + 4 * i; // letters lock left to right
    let prev;
    while (frames.length < lead) {
      prev = pickIndex(rand, pool.length, prev);
      for (const f of pool[prev].frames) { if (frames.length < lead) frames.push(f); }
    }
    frames.push(GLYPHS[ch]);
    return frames;
  });
}

/** Rows of letter indices for a given pixel width. */
export function layoutFor(count, width, minPitch = MIN_PITCH) {
  let rows = 1;
  while (rows < count && width / ((Math.ceil(count / rows)) * (COLS + 1) - 1) < minPitch) rows += 1;
  const perRow = Math.ceil(count / rows);
  const lines = [];
  for (let i = 0; i < count; i += perRow) lines.push(Array.from({ length: Math.min(perRow, count - i) }, (_, k) => i + k));
  return { perRow, lines, cols: perRow * (COLS + 1) - 1, rows: lines.length * ROWS + (lines.length - 1) * GAP_ROWS };
}

/**
 * createSpriteMark(el, { text, pattern, speed, color, loop, seed, onfinish })
 * el: the host element. Its existing children (the static wordmark SVG) are the
 * no-JS fallback and are replaced by the canvas once the module runs.
 */
export function createSpriteMark(el, options = {}) {
  const opts = { text: 'KOSMOS', pattern: 'random', speed: 1, color: '#1d1d1b', loop: false, seed: undefined, ...options };
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', opts.label || 'Kosmos sprite mark animation');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  const ctx = canvas.getContext('2d');

  let chars = [];
  let frames = [];
  let total = 0; // steps until all letters are locked
  let elapsed = 0; // ms of animation time
  let lastStep = -1;
  let userPaused = false;
  let visible = true;
  let finished = false;
  let raf = 0;
  let lastTs = 0;
  let lastDraw = 0;
  let seedCounter = 0;
  const minPitchNow = () => (typeof opts.minPitch === "function" ? opts.minPitch() : opts.minPitch) || MIN_PITCH; // a larger value wraps the word onto more rows, so each letter is bigger
  let layout = layoutFor(1, el.clientWidth || 1000, minPitchNow());
  let width = 0;
  let destroyed = false;
  const listeners = { finish: new Set(), state: new Set() };

  const reduced = () => reduceQuery.matches;
  const stepMs = () => FRAME_MS_BOOT / Math.max(0.1, opts.speed);

  function build() {
    chars = [...cleanText(opts.text)];
    if (!chars.length) chars = [...'KOSMOS'];
    const rand = mulberry32(opts.seed !== undefined ? opts.seed + seedCounter : (Math.random() * 2 ** 31) | 0);
    seedCounter += 1;
    frames = buildFrames(chars, opts.pattern, rand);
    total = Math.max(...frames.map((f) => f.length - 1));
    layout = layoutFor(chars.length, width || el.clientWidth || 1000, minPitchNow());
    el.style.aspectRatio = `${layout.cols} / ${layout.rows}`;
  }

  function maskAt(i, step) { const f = frames[i]; return f[Math.min(step, f.length - 1)]; }

  function paint(targetCtx, W, H, step, colorOverride, bg) {
    const { cols, rows, lines } = layout;
    const pitch = Math.max(1, Math.floor(Math.min(W / cols, H / rows)));
    const gap = pitch >= 6 ? Math.max(1, Math.round(pitch * 0.14)) : pitch >= 3 ? 1 : 0;
    const sq = pitch - gap;
    const offX = Math.floor((W - cols * pitch + gap) / 2);
    const offY = Math.floor((H - rows * pitch + gap) / 2);
    targetCtx.clearRect(0, 0, W, H);
    if (bg) { targetCtx.fillStyle = bg; targetCtx.fillRect(0, 0, W, H); }
    const color = colorOverride || opts.color;
    for (let li = 0; li < lines.length; li += 1) {
      const line = lines[li];
      const lineCols = line.length * (COLS + 1) - 1;
      const x0 = offX + Math.floor(((cols - lineCols) / 2) * pitch);
      const y0 = offY + li * (ROWS + GAP_ROWS) * pitch;
      line.forEach((ci, k) => {
        const mask = maskAt(ci, step);
        for (let n = 0; n < COUNT; n += 1) {
          const { col, row } = coords(n);
          targetCtx.globalAlpha = mask[n] ? 1 : 0.07;
          targetCtx.fillStyle = color;
          targetCtx.fillRect(x0 + (k * (COLS + 1) + col) * pitch, y0 + row * pitch, sq, sq);
        }
      });
    }
    targetCtx.globalAlpha = 1;
  }

  function draw() {
    if (!width) return;
    paint(ctx, canvas.width, canvas.height, finished || reduced() ? total + 1 : Math.min(Math.floor(elapsed / stepMs()), total + 1));
  }

  function resize() {
    const w = Math.round(el.clientWidth);
    if (!w) return;
    const before = layout.rows + ':' + layout.cols;
    width = w;
    layout = layoutFor(chars.length, w, minPitchNow());
    if (before !== layout.rows + ':' + layout.cols) el.style.aspectRatio = `${layout.cols} / ${layout.rows}`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const h = el.clientHeight || Math.round((w * layout.rows) / layout.cols);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw();
  }

  const shouldRun = () => !userPaused && visible && !document.hidden && !finished && !reduced() && !destroyed;

  function emit(kind) { listeners[kind].forEach((fn) => fn(api)); }

  function tick(ts) {
    raf = 0;
    if (!shouldRun()) { lastTs = 0; return; }
    raf = requestAnimationFrame(tick);
    if (lastTs && ts - lastDraw < 1000 / MAX_FPS - 1) return; // 30 fps cap
    const dt = lastTs ? Math.min(ts - lastTs, 100) : 0; // clamp after tab/visibility gaps
    lastTs = ts;
    lastDraw = ts;
    elapsed += dt;
    const step = Math.floor(elapsed / stepMs());
    if (step >= total + 1) {
      finished = true;
      draw();
      emit('state');
      emit('finish');
      if (opts.loop) setTimeout(() => { if (!destroyed && finished && opts.loop) api.replay(); }, 2400);
      return;
    }
    if (step !== lastStep) { lastStep = step; draw(); }
  }

  function kick() { if (!raf && shouldRun()) { lastTs = 0; raf = requestAnimationFrame(tick); } }

  const api = {
    el, canvas,
    get playing() { return shouldRun() || (!finished && !userPaused && !reduced()); },
    get paused() { return userPaused; },
    get finished() { return finished || reduced(); },
    get reducedMotion() { return reduced(); },
    get text() { return chars.join(''); },
    play() { userPaused = false; kick(); emit('state'); },
    pause() { userPaused = true; emit('state'); },
    toggle() { if (userPaused) api.play(); else api.pause(); return userPaused; },
    replay() {
      userPaused = false; finished = false; elapsed = 0; lastStep = -1;
      build(); resize(); kick(); emit('state');
    },
    set(next = {}) {
      Object.assign(opts, next);
      if ('speed' in next && !('text' in next) && !('pattern' in next)) return;
      api.replay();
    },
    setText(text) { api.set({ text }); },
    setPattern(pattern) { api.set({ pattern }); },
    on(kind, fn) { listeners[kind].add(fn); return () => listeners[kind].delete(fn); },
    /** PNG of the finished mark, 24 px squares, on a transparent or given background. */
    toBlob(cb, { bg = null, pitch = 24 } = {}) {
      const c = document.createElement('canvas');
      c.width = layout.cols * pitch + 2 * pitch;
      c.height = layout.rows * pitch + 2 * pitch;
      const x = c.getContext('2d');
      x.translate(pitch, pitch);
      paint(x, layout.cols * pitch, layout.rows * pitch, total + 1, null, bg);
      c.toBlob(cb, 'image/png');
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduceQuery.removeEventListener?.('change', onReduce);
      canvas.remove();
    },
  };

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) kick();
  }, { threshold: 0 });
  const ro = new ResizeObserver(() => resize());
  const onVis = () => { if (!document.hidden) kick(); };
  const onReduce = () => { if (reduced()) { finished = true; } draw(); emit('state'); kick(); };

  build();
  el.replaceChildren(canvas);
  el.dataset.spriteMark = 'ready';
  resize();
  if (reduced()) finished = true;
  draw();
  io.observe(el);
  ro.observe(el);
  document.addEventListener('visibilitychange', onVis);
  reduceQuery.addEventListener?.('change', onReduce);
  kick();
  return api;
}
