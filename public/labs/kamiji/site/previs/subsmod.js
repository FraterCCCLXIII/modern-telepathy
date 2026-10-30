// The shared subtitles module (../subtitles/, not edited from here). Loaded dynamically so Previs still works, with its own
// fallbacks, if the module is missing or fails to load.
export const SUBS = await import("../subtitles/subtitles.js").catch((e) => { console.warn("Previs: subtitles module unavailable, using built-in fallbacks", e); return null; });
