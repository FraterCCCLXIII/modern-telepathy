// Import (source) and export / publish (sink) node families. Status is always honest:
// works = does what it says in the browser; file = produces a download only; stub = placeholder that explains itself; planned = not built.
export const STATUS_LABEL = { works: "Works", file: "File download", stub: "Stub", planned: "Planned", mockup: "Mockup" };
export const LIMIT_BYTES = 25 * 1024 * 1024;

export const SOURCES = {
  script: { label: "Script", status: "works", accept: ".txt,.md,.markdown,.fountain,text/plain,text/markdown", note: "A .txt, Markdown or Fountain-style screenplay becomes script lines by character and action." },
  subtitles: { label: "Subtitles", status: "works", accept: ".srt,.vtt,text/vtt", note: "SRT or WebVTT cues become timed dialogue lines, placed on the shot playing at that time." },
  images: { label: "Storyboard images", status: "works", accept: "image/png,image/jpeg", multiple: true, note: "PNG or JPEG images become reference sub-nodes in the connected scene." },
  audio: { label: "Audio", status: "works", accept: ".wav,.mp3,audio/wav,audio/mpeg", note: "Decoded in your browser for duration and waveform; becomes an audio note. It is not played." },
  model: { label: "3D model", status: "works", accept: ".glb,model/gltf-binary", note: "A .glb becomes a Model sub-node in the connected scene. The file stays in this tab; re-import after a reload." },
  project: { label: "Previous project", status: "works", accept: ".json,application/json", note: "Merges the scenes and script of a Previs project file into this one." },
  cast: { label: "Cast list", status: "works", accept: ".csv,.json,application/json,text/csv", note: "CSV (name, model) or JSON list of characters, available in the Script drawer." },
  shots: { label: "Shot list", status: "works", accept: ".csv,text/csv", note: "CSV rows (type, move, frames, caption) become shots in the connected scene." },
  link: { label: "Link", status: "stub", disabled: true, note: "Not connected. A URL placeholder; nothing is fetched from the network." },
};
export const SINKS = {
  json: { label: "Project JSON", status: "file", note: "Downloads the whole project as JSON." },
  pdf: { label: "Storyboard PDF", status: "works", note: "Opens the 6-up print view. Choose \"Save as PDF\" in the print dialog." },
  frames: { label: "Image sequence", status: "file", note: "PNG frames of the cut in a .zip made in your browser (at most 240 frames, evenly spaced)." },
  video: { label: "Animatic video", status: "file", note: "Records the cut to .webm in REAL TIME with MediaRecorder, so it takes as long as the cut. No sound." },
  subs: { label: "Subtitles / script", status: "file", formats: { srt: "SRT", vtt: "WebVTT", fountain: "Fountain", md: "Markdown", txt: "Plain text" }, note: "Dialogue as subtitles (timed to the shots) or the whole script as text." },
  shotscsv: { label: "Shot list CSV", status: "file", note: "One row per shot: scene, type, move, timecode, duration, action, dialogue." },
  glb: { label: "glTF / GLB scene", status: "file", note: "Each scene in its first-frame pose with one camera per shot. No animation yet." },
  edl: { label: "Edit decision list", status: "file", note: "CMX3600 EDL: one cut event per shot." },
  kosmos: { label: "Kosmos engine scene JSON", status: "file", note: "Previs' own scene JSON, as a file. Not validated against the engine." },
  blender: { label: "Blender", status: "file", note: "A Python script that rebuilds the cameras and markers. Not tested in Blender yet." },
  godot: { label: "Godot", status: "planned", disabled: true, note: "Planned. Nothing is exported." },
  unreal: { label: "Unreal", status: "planned", disabled: true, note: "Planned. Nothing is exported." },
  yakopop: { label: "Yakopop", status: "planned", disabled: true, note: "Planned. This repository documents no hand-off format." },
  castbook: { label: "Castbook", status: "planned", disabled: true, note: "Planned. This repository documents no hand-off format." },
  longformer: { label: "Longformer", status: "planned", disabled: true, note: "Planned. This repository documents no hand-off format." },
  share: { label: "Share link", status: "planned", disabled: true, note: "Planned. Nothing leaves your browser." },
};
// ---- Pipeline MOCKUP (generation providers, prompt chat, social / publish presets) ----------------------------
// Nothing here talks to a network. Provider names are plain text. API details (resolutions, durations, limits) are ASSUMED and marked unverified.
export const PROVIDERS = {
  seedance: { label: "Seedance", key: true, note: "Video generation provider (Seedance). API details are assumed, unverified." },
  veo: { label: "Veo-style", key: true, note: "Generic placeholder for a Veo-like text/image-to-video API. Unverified." },
  runway: { label: "Runway-style", key: true, note: "Generic placeholder for a Runway-like video-to-video API. Unverified." },
  kling: { label: "Kling-style", key: true, note: "Generic placeholder for a Kling-like video API. Unverified." },
  local: { label: "Local stand-in", key: false, note: "No provider at all: a local filter pretends to be the result. Needs no key." },
};
export const PROVIDER_OPTS = { res: ["480p", "720p", "1080p"], dur: [4, 5, 8, 10], aspect: ["16:9", "9:16", "1:1", "4:3"],
  style: { faithful: "Faithful to the previs", repaint: "Repaint (restyle the previs frames)", reprocess: "Reprocess (re-run on the same frames)", stylize: "Stylise (loose reinterpretation)" } };
export const RUN_STATES = { idle: "Idle", queued: "Queued", rendering: "Rendering", done: "Done", failed: "Failed" };
// Social / publish presets. Every number is an ASSUMPTION written from memory and NOT verified (see DESIGN.md); max 0 = no limit modelled.
const SOC = { status: "mockup", social: true, unverified: true };
const sinkSocial = (label, aspect, max, res, note, extra = {}) => ({ ...SOC, label, aspect, max, res, note, ...extra });
export const SOCIAL = {
  youtube: sinkSocial("YouTube", "16:9", 900, "1920x1080", "Landscape upload. Limits assumed, unverified."),
  shorts: sinkSocial("Shorts (vertical)", "9:16", 60, "1080x1920", "Vertical short. Limits assumed, unverified."),
  tiktok: sinkSocial("TikTok-style", "9:16", 180, "1080x1920", "Generic vertical short-video preset. Unverified."),
  reels: sinkSocial("Instagram Reels-style", "9:16", 90, "1080x1920", "Generic vertical reel preset. Unverified."),
  x: sinkSocial("X", "16:9", 140, "1280x720", "Landscape post video. Limits assumed, unverified."),
  vimeo: sinkSocial("Vimeo-style", "16:9", 0, "1920x1080", "Generic landscape host preset. Unverified."),
  podcast: sinkSocial("Podcast / RSS", "audio", 0, "audio only", "Audio feed. Previs renders no audio, so this can only warn.", { audio: true }),
  download: { label: "Download (take poster)", status: "file", social: true, aspect: "any", max: 0, res: "any", note: "Real local download: the accepted take's poster frame as a PNG. Nothing is uploaded." },
};
Object.assign(SINKS, SOCIAL);
export const NODE_SIZE = { source: [252, 168], sink: [252, 176], social: [330, 600], provider: [388, 690], chat: [330, 420] };
export const NODE_PORT_Y = 64;
