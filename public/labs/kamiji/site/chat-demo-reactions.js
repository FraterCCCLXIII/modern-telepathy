// Content -> reaction rules for the chat demo. Tune the table below; nothing else needs to change.
//
// A rule matches a line of text (role "user" or "agent") by regex and/or by the type of card in a reply, and says how Kamiji reacts:
//   clip       one of the avatar's real clips: Idle, Wave, Think, Celebrate
//   expression one of the eight moods (neutral happy excited thinking sad angry surprised sleepy)
//   emote      a real 3D prop from assets/props shown by the avatar (heart sparkle star check question lightbulb sweat tear exclamation fire warning ...)
//   emoji      Unicode emoji floated up as text, used where no matching 3D prop exists (rain, sun, charts, party ...)
//   motion     a small CSS movement on the tile (bounce jump nod shake droop lean tilt sway bow shrug); the clips above are the only baked ones
//   intensity  0..1 multiplier on the movement
// The first matching rule wins, in table order. Scripted messages can also name a rule directly with `react: "<id>"`.

export const RULES = [
  { id: "thanks",    role: "user",  re: /\b(thanks?|thank you|cheers|ta)\b/i,                   do: { expression: "happy",    emote: "heart",      emoji: "❤️", motion: "bow",    intensity: 0.7, clip: "Idle" } },
  { id: "greeting",  role: "user",  re: /^\s*(hi|hello|hey|yo|good (morning|evening))\b/i,       do: { expression: "happy",    clip: "Wave",       emoji: "👋",      motion: "bounce", intensity: 0.8 } },
  { id: "question",  role: "user",  re: /\?\s*$|^\s*(what|how|why|when|who|where|which|can|could|will|is|are|do|does)\b/i, do: { expression: "thinking", clip: "Think", emote: "question", motion: "tilt", intensity: 0.7 } },
  { id: "unknown",   role: "agent", re: /scripted demo, so i only know/i,                       do: { expression: "surprised", emote: "question",  emoji: "❓",      motion: "shake",  intensity: 0.6 } },
  { id: "rain",      role: "agent", re: /\brain|shower|storm|drizzle\b/i, card: "weatherCard", when: (c) => /rain|storm|drizzle/.test(c.current?.condition || "") || undefined, do: { expression: "sad", emoji: "🌧️", motion: "droop", intensity: 0.8 } },
  { id: "sun",       role: "agent", re: /\bsunny|clear skies|dry\b/i, card: "weatherCard",   do: { expression: "happy",    clip: "Celebrate",  emoji: "☀️",      motion: "bounce", intensity: 1 } },
  { id: "up",        card: "statCard", when: (c) => c.change?.direction === "up",                do: { expression: "excited",  clip: "Celebrate",  emoji: "📈",      motion: "jump",   intensity: 1 } },
  { id: "down",      card: "statCard", when: (c) => c.change?.direction === "down",              do: { expression: "sad",      emoji: "📉",      motion: "droop",  intensity: 0.7 } },
  { id: "chart",     card: "statCard",                                                           do: { expression: "thinking", emote: "lightbulb",  emoji: "📊",      motion: "nod",    intensity: 0.7 } },
  { id: "task-list", card: "taskCard",                                                           do: { expression: "happy",    clip: "Wave",       emoji: "📝",      motion: "nod",    intensity: 0.8 } },
  { id: "code",      card: "codeBlock",                                                          do: { expression: "happy",    emote: "lightbulb",  emoji: "💡",      motion: "nod",    intensity: 0.6 } },
  { id: "weather",   card: "weatherCard",                                                        do: { expression: "happy",    clip: "Wave",       emoji: "⛅",      motion: "bounce", intensity: 0.8 } },
  { id: "done",      role: "event", event: "tick",                                               do: { expression: "excited",  clip: "Celebrate",  emote: "check",   emoji: "✅", motion: "jump",   intensity: 1 } },
  { id: "typing",    role: "event", event: "typing",                                             do: { expression: "neutral",  motion: "lean",    intensity: 0.6 } },
  { id: "team-spawn",  role: "event", event: "team-spawn",  do: { expression: "happy",    clip: "Wave",       emoji: "👋",      motion: "nod",    intensity: 0.7 } },
  { id: "team-reject", role: "event", event: "team-reject", do: { expression: "sad",      emote: "warning",    emoji: "⚠️", motion: "shrug",  intensity: 0.8 } },
  { id: "team-accept", role: "event", event: "team-accept", do: { expression: "happy",    emote: "check",      motion: "nod",    intensity: 0.8 } },
  { id: "team-done",   role: "event", event: "team-done",   do: { expression: "excited",  clip: "Celebrate",  emoji: "🎉",      motion: "jump",   intensity: 1 } },
  // one-tap reaction chips under agent messages: Kamiji reacts back
  { id: "chip-👍",   role: "event", event: "👍",                                                 do: { expression: "happy",    clip: "Celebrate",  emote: "star",    emoji: "👍", motion: "nod",    intensity: 0.9 } },
  { id: "chip-❤️",   role: "event", event: "❤️",                                                do: { expression: "happy",    emote: "heart",      emoji: "❤️", motion: "bow",    intensity: 0.9 } },
  { id: "chip-😂",   role: "event", event: "😂",                                                 do: { expression: "excited",  emoji: "😂",           motion: "jump",   intensity: 1 } },
  { id: "chip-🤔",   role: "event", event: "🤔",                                                 do: { expression: "thinking", clip: "Think",       emote: "question", emoji: "🤔", motion: "tilt",   intensity: 0.8 } },
];
export const CHIPS = ["👍", "❤️", "😂", "🤔"];
// emoji accents appended to some agent replies (not every message): by rule id
export const ACCENT = { sun: " ☀️", up: " 🎉", done: " ✅", greeting: " 👋" };
const byId = new Map(RULES.map((r) => [r.id, r]));

/** Find the rule for a message. `m` = { role, text, cards (specs), event, id (pinned rule id) }. */
export function match(m) {
  if (m.id && byId.has(m.id)) return byId.get(m.id);
  for (const r of RULES) {
    if (r.role && r.role !== m.role) continue;
    if (r.role === "event" || r.event) { if (r.event === m.event) return r; continue; }
    if (r.card) {
      const c = (m.cards || []).find((x) => x.type === r.card);
      if (!c) continue;
      if (r.when && !r.when(c)) continue;
      if (r.re && !r.re.test(m.text || "")) { if (!r.when) continue; }
      return r;
    }
    if (r.re && r.re.test(m.text || "")) return r;
  }
  return null;
}

/** The effects runner. `host` = { avatar, head (element holding the fx layer), setMood(name), enabled(), intensity(), why(text), reduced() }. */
export function createReactor(host) {
  const fx = document.createElement("div");
  fx.className = "kcd-fx"; fx.setAttribute("aria-hidden", "true");
  host.head.append(fx);
  let motionTimer = 0, emoteTimer = 0, clipTimer = 0, lastAt = 0;
  const MOTIONS = ["bounce", "jump", "nod", "shake", "droop", "lean", "tilt", "sway", "bow", "shrug"];

  function clearMotion() { MOTIONS.forEach((m) => host.motionEl.classList.remove("kcd-m-" + m)); }
  function react(m, opts = {}) {
    if (!host.enabled()) return null;
    const rule = match(m);
    if (!rule) { host.why(""); return null; }
    const now = performance.now();
    if (m.event === "typing" && now - lastAt < 1800) return rule; // typing: at most once in a while
    lastAt = now;
    const d = rule.do, k = Math.max(0, Math.min(1.5, host.intensity())) * (d.intensity ?? 1), reduced = host.reduced();
    if (d.expression) host.setMood(d.expression);
    if (d.clip && !reduced) { host.avatar.setAttribute("clip", d.clip); clearTimeout(clipTimer); clipTimer = setTimeout(() => host.avatar.setAttribute("clip", host.baseClip?.() || "Idle"), 1400); }
    else if (d.clip && reduced) { host.avatar.setAttribute("clip", "Idle"); }
    if (d.emote) { host.avatar.setAttribute("emote", d.emote); clearTimeout(emoteTimer); emoteTimer = setTimeout(() => host.avatar.removeAttribute("emote"), 1600); }
    else if (d.emoji) burst(d.emoji, reduced);
    if (d.motion && !reduced && k > 0.05) {
      clearMotion(); void host.motionEl.offsetWidth;
      host.motionEl.style.setProperty("--kcd-k", String(k));
      host.motionEl.classList.add("kcd-m-" + d.motion);
      clearTimeout(motionTimer); motionTimer = setTimeout(clearMotion, 1700);
    }
    host.why(`${rule.id}: ${[d.clip && "clip " + d.clip, d.expression && d.expression, d.emote ? "emote " + d.emote : d.emoji, d.motion && d.motion].filter(Boolean).join(", ")} (x${k.toFixed(2)})`);
    return rule;
  }
  // One emoji at a time: pops, floats up, fades (fade only when reduced). Decorative, never announced.
  function burst(emoji, reduced) {
    fx.textContent = "";
    const s = document.createElement("span");
    s.className = "kcd-emoji" + (reduced ? " is-still" : "");
    s.textContent = emoji;
    fx.append(s);
    setTimeout(() => s.remove(), 1700);
  }
  return { react, burst, match, clear() { clearMotion(); fx.textContent = ""; } };
}
