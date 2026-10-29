// Playback state: playhead frame, play / pause / loop, in-out range. Time advances from the wall clock, so it cannot drift.
export function createTransport(store) {
  const subs = new Set();
  const t = {
    frame: 0, playing: false, scrubbing: false, _t0: 0, _f0: 0,
    on(fn) { subs.add(fn); }, emit(kind) { subs.forEach((f) => f(kind)); },
    get total() { return store.d.total; },
    get range() { const r = store.p.range, T = t.total; return r ? { in: Math.max(0, r.in), out: Math.min(T, r.out) } : { in: 0, out: T }; },
    entryAt(frame = t.frame) { const seq = store.d.seq, f = Math.floor(frame); return seq.find((s) => f >= s.start && f < s.end) || (frame >= t.total ? seq[seq.length - 1] : null) || null; },
    play() {
      if (!t.total) return false;
      const r = t.range; if (t.frame >= r.out - 1 || t.frame < r.in) t.frame = r.in;
      t.playing = true; t._t0 = performance.now(); t._f0 = t.frame; t.emit("state"); return true;
    },
    pause() { if (!t.playing) return; t.playing = false; t.frame = Math.floor(t.frame); t.emit("state"); t.emit("frame"); },
    toggle() { return t.playing ? (t.pause(), false) : t.play(); },
    stop() { t.playing = false; t.frame = t.range.in; t.emit("state"); t.emit("frame"); },
    seek(f, { scrub = false } = {}) {
      t.frame = Math.max(0, Math.min(Math.max(0, t.total - 1), Math.round(f)));
      if (t.playing) { t._t0 = performance.now(); t._f0 = t.frame; }
      t.scrubbing = scrub; t.emit("frame");
    },
    step(n) { t.pause(); t.seek(t.frame + n, { scrub: true }); },
    advance(now) {
      if (!t.playing) return;
      const fps = store.p.fps, r = t.range;
      let f = t._f0 + ((now - t._t0) / 1000) * fps;
      if (f >= r.out) {
        if (store.p.loop && r.out > r.in) { const span = r.out - r.in; f = r.in + ((f - r.in) % span); t._t0 = now; t._f0 = f; }
        else { t.playing = false; t.frame = Math.max(r.in, r.out - 1); t.emit("state"); t.emit("frame"); return; }
      }
      t.frame = f; t.emit("frame");
    },
  };
  return t;
}
