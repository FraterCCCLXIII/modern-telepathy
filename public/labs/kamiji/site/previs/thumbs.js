// Storyboard thumbnails: real renders of each shot's first frame, captured from the shared renderer.
// One capture per idle slot; results are cached by what the picture depends on, so edits only re-render what changed.
export function createThumbs(stage, store) {
  const cache = new Map(), pending = new Map(); // key -> dataURL ; key -> Set<callback>
  const queue = [];
  let busy = false;
  const self = { overlay: null }; // subtitles painter (subs.js): { overlayKey(node, shot), paint(ctx, w, h, shot, inst, cam) }
  const keyOf = (node, shot) => JSON.stringify([node.props, shot.off, shot.cam.a, store.p.fps, self.overlay?.overlayKey(node, shot) || ""]);
  const cam = stage.camera();
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const job = queue.shift();
      try {
        const inst = stage.instance(job.node);
        await inst.ready;
        if (inst.state === "ready") {
          inst.setTime(job.shot.off / store.p.fps);
          stage.applyKey(cam, job.shot.cam.a);
          const url = stage.snapshot(inst, cam, 320, 180, self.overlay ? (ctx, w, h) => self.overlay.paint(ctx, w, h, job.shot, inst, cam) : null);
          cache.set(job.key, url); if (cache.size > 300) cache.delete(cache.keys().next().value);
        }
      } catch (e) { /* leave without thumbnail */ }
      pending.get(job.key)?.forEach((cb) => cb()); pending.delete(job.key);
      await new Promise((r) => setTimeout(r, 30));
    }
    busy = false;
  }
  return Object.assign(self, {
    cache,
    // returns a cached data URL or null; `cb` is called when a fresh capture lands
    get(node, shot, cb) {
      if (!stage || node.type !== "scene") return null;
      const key = keyOf(node, shot), hit = cache.get(key);
      if (hit) return hit;
      if (!pending.has(key)) { pending.set(key, new Set()); queue.push({ key, node, shot: JSON.parse(JSON.stringify(shot)) }); }
      if (cb) pending.get(key).add(cb);
      queueMicrotask(pump);
      return null;
    },
    keyOf,
    // wait until every shot in the sequence has a thumbnail (used before printing)
    async all() {
      const jobs = store.d.seq.map((s) => new Promise((res) => { const u = this.get(s.node, s.shot, res); if (u) res(); }));
      await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 15000))]);
    },
  });
}
