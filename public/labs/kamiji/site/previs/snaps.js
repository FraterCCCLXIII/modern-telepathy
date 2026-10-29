// Cached thumbnails from the shared renderer (not live): Library tiles and Script drawer avatars.
export function createSnaps(stage) {
  const cache = new Map(), waiting = new Map(), queue = [];
  let busy = false;
  const cam = stage?.camera();
  async function pump() {
    if (busy) return; busy = true;
    while (queue.length) {
      const job = queue.shift();
      try {
        const node = { id: "av:" + job.key, type: "scene", props: { cast: job.spec.cast || [], bg: job.spec.bg || "#e7e6e1", light: job.spec.light || "soft" }, shots: [] };
        const inst = stage.instance(node); await inst.ready;
        if (inst.state === "ready") { inst.setTime(job.spec.t ?? 0.5); stage.applyKey(cam, stage.presetKey(inst, job.spec.cam || "Front")); cache.set(job.key, stage.snapshot(inst, cam, 144, 144)); }
      } catch (e) { /* no thumbnail */ }
      waiting.get(job.key)?.forEach((f) => f()); waiting.delete(job.key);
      await new Promise((r) => setTimeout(r, 40));
    }
    busy = false;
  }
  return {
    // returns a cached data URL or null, and calls `cb` when a render lands
    get(key, spec, cb) {
      if (!stage) return null; const hit = cache.get(key); if (hit) return hit;
      if (!waiting.has(key)) { waiting.set(key, new Set()); queue.push({ key, spec }); }
      if (cb) waiting.get(key).add(cb); queueMicrotask(pump); return null;
    },
    cache,
  };
}
