// Thumbnails: rendered with the shared renderer, one at a time, cached by what the picture depends on.
export function createThumbs(vp) {
  const cache = new Map(), pending = new Map(), queue = [];
  let busy = false;
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const job = queue.shift();
      if (job.alive && !job.alive()) { pending.delete(job.key); continue; }
      let url = cache.get(job.key);
      if (!url) {
        try {
          const made = await job.make();
          if (made) { url = vp.thumb(made.fig, made.focus || "all"); made.fig.dispose?.(); }
        } catch (e) { console.warn("Studio: thumbnail failed", job.key.slice(0, 60), e); }
        if (url) { cache.set(job.key, url); if (cache.size > 600) cache.delete(cache.keys().next().value); }
      }
      (pending.get(job.key) || []).forEach((cb) => cb(url)); pending.delete(job.key);
      await new Promise((r) => setTimeout(r, 12));
    }
    busy = false;
  }
  return {
    cache,
    /** cb(url) is called now (cached) or later. `alive()` lets stale tiles be skipped. */
    request(key, make, cb, alive) {
      const hit = cache.get(key); if (hit) { cb(hit); return; }
      if (pending.has(key)) { pending.get(key).push(cb); return; }
      pending.set(key, [cb]); queue.push({ key, make, alive }); queueMicrotask(pump);
    },
    get queued() { return queue.length + (busy ? 1 : 0); },
    idle() { return new Promise((r) => { const t = setInterval(() => { if (!busy && !queue.length) { clearInterval(t); r(); } }, 40); }); },
  };
}
