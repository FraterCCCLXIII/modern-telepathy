// Script data layer. ONE list of lines (project.script.lines) feeds: the Script drawer, Script sub-nodes in artboards,
// the timeline Dialogue track and the storyboard caption / dialogue fields. Nothing is copied anywhere else.
import { uid, timecode } from "./store.js";
import { effectiveRef, subById, outputsOf, makeSub, outputNode, ensureScriptSub } from "./art.js";
import { CHAR_BY_ID } from "./catalog.js";

export const NARRATOR = "narrator";
export const KINDS = { dialogue: "Dialogue", action: "Action", paren: "Parenthetical" };
export const STATUSES = { draft: "Draft", approved: "Approved", cut: "Cut" };
export const WPS = 2.7; // spoken words per second, for the duration estimate

export function charName(p, id) {
  if (id === NARRATOR) return "Action / Narrator";
  const custom = p.script?.names?.[id] || p.script?.cast?.find((c) => c.id === id)?.name; if (custom) return custom;
  const d = CHAR_BY_ID.get(id); if (!d) return String(id).split("/").pop().replace(/^./, (c) => c.toUpperCase());
  return id === "kamiji" ? "Kamiji hand" : d.label.replace(/^(Kamikin|Rubbernose) /, "").replace(/^./, (c) => c.toUpperCase());
}
// monochrome marker: a shape per character (cycling) plus an initial, never a hue
const SHAPES = ["circle", "square", "diamond", "triangle", "hex", "pill"];
export const markerOf = (chars, id) => { if (id === NARRATOR) return { shape: "bar", initial: "A" }; const i = Math.max(0, chars.findIndex((c) => c.id === id)); return { shape: SHAPES[i % SHAPES.length], initial: (chars.find((c) => c.id === id)?.name || "?")[0].toUpperCase() }; };

export const words = (t) => (String(t).trim().match(/\S+/g) || []).length;

// Every line in story order, with where it sits (scene, shot, timecode).
export function orderedLines(store) {
  const p = store.p, d = store.d, fps = p.fps;
  const nodeIdx = new Map(d.order.map((n, i) => [n.id, i])), shotSeq = new Map(d.seq.map((s) => [s.shot.id, s]));
  const rows = p.script.lines.map((line, i) => {
    const node = p.nodes.find((n) => n.id === line.node) || null, se = line.shot ? shotSeq.get(line.shot) : null;
    const ni = node ? (nodeIdx.has(node.id) ? nodeIdx.get(node.id) : 1000 + p.nodes.indexOf(node)) : 5000;
    const si = se && node ? node.shots.indexOf(se.shot) : -1;
    const start = se ? se.start : node && d.nodeStart.has(node.id) ? d.nodeStart.get(node.id) : null;
    return { line, node, shot: se?.shot || null, seq: se || null, n: se?.n || 0, start, tc: start == null ? "" : timecode(start, fps), key: [ni, si, i] };
  });
  rows.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  return rows;
}

// Characters: everyone cast in any scene (from the artboards) plus anyone who has a line, plus the narrator.
export function characters(store) {
  const p = store.p, map = new Map();
  const get = (id) => { if (!map.has(id)) map.set(id, { id, name: charName(p, id), lines: 0, words: 0, dwords: 0, nodes: new Set(), cast: new Set() }); return map.get(id); };
  get(NARRATOR);
  for (const c of p.script.cast || []) get(c.id);
  for (const n of p.nodes) if (n.type === "scene") for (const c of n.art.nodes) if (c.type === "content" && c.kind === "character") { const ch = get(effectiveRef(n.art, c)); ch.cast.add(n.id); ch.nodes.add(n.id); }
  for (const l of p.script.lines) { const ch = get(l.char); ch.lines++; ch.words += words(l.text); if (l.kind === "dialogue" && l.status !== "cut") ch.dwords += words(l.text); if (l.node) ch.nodes.add(l.node); }
  return [...map.values()].map((c) => ({ ...c, secs: c.dwords / WPS, scenes: [...c.nodes].map((id) => p.nodes.find((n) => n.id === id)?.name).filter(Boolean) }))
    .sort((a, b) => (a.id === NARRATOR ? -1 : b.id === NARRATOR ? 1 : b.lines - a.lines || a.name.localeCompare(b.name)));
}

// ---- edits (callers commit() after a finished edit; typing calls these silently) ----------------------------
export function addLine(store, { char = NARRATOR, kind = "dialogue", text = "", node = null, shot = null, before = null, status = "draft" } = {}) {
  const line = { id: uid("l"), char, kind, text, node, shot, status };
  store.update((p) => { const i = before ? p.script.lines.findIndex((l) => l.id === before) : -1; if (i >= 0) p.script.lines.splice(i, 0, line); else p.script.lines.push(line); }, "script");
  return line;
}
export const findLine = (p, id) => p.script.lines.find((l) => l.id === id);
export function patchLine(store, id, patch) { store.update((p) => { const l = findLine(p, id); if (l) Object.assign(l, patch); }, "script"); }
export function deleteLine(store, id) { store.update((p) => { p.script.lines = p.script.lines.filter((l) => l.id !== id); }, "script"); }
// Move a line to sit just before `targetId` (null = after `afterId`), adopting that line's scene and shot.
export function moveLine(store, id, targetId, afterId = null, scope = null) {
  const p = store.p, l = findLine(p, id); if (!l) return false;
  const anchor = findLine(p, targetId || afterId); if (!anchor || anchor === l) return false;
  store.update(() => {
    p.script.lines = p.script.lines.filter((x) => x !== l);
    const i = p.script.lines.indexOf(anchor);
    p.script.lines.splice(targetId ? i : i + 1, 0, l);
    l.node = scope?.node !== undefined ? scope.node : anchor.node; l.shot = scope?.shot !== undefined ? scope.shot : anchor.shot;
  }, "script");
  return true;
}
// The first line of a kind on a shot (what the storyboard caption / dialogue fields edit).
export function shotLines(p, shotId, kinds) { return p.script.lines.filter((l) => l.shot === shotId && kinds.includes(l.kind) && l.status !== "cut"); }
export function shotText(p, shotId, kind) {
  const kinds = kind === "dialogue" ? ["dialogue"] : ["action"];
  const ls = shotLines(p, shotId, kinds);
  return { first: ls[0] || null, count: ls.length, lines: ls };
}
export function setShotText(store, node, shot, kind, text) {
  const cur = shotText(store.p, shot.id, kind);
  if (cur.first) { patchLine(store, cur.first.id, { text }); return cur.first; }
  if (!text) return null;
  const cast = node.art.nodes.filter((c) => c.type === "content" && c.kind === "character").map((c) => effectiveRef(node.art, c));
  return addLine(store, { char: kind === "dialogue" ? cast[0] || NARRATOR : NARRATOR, kind: kind === "dialogue" ? "dialogue" : "action", text, node: node.id, shot: shot.id });
}
export const dialogueLabel = (p, l) => (l.kind === "dialogue" ? `${charName(p, l.char).toUpperCase()}: ${l.text}` : l.text);

// Script sub-node helpers: the lines of this scene for the character a Script node is bound to.
export const scriptNodeChar = (art, s) => { const c = outputsOf(art, s.id).find((n) => n.type === "content" && n.kind === "character"); return c ? effectiveRef(art, c) : s.char || NARRATOR; };
export function linesOfScriptNode(p, node, s) { const ch = scriptNodeChar(node.art, s); return p.script.lines.filter((l) => l.node === node.id && l.char === ch); }

// ---- export ------------------------------------------------------------------------------------------------
function grouped(store) {
  const rows = orderedLines(store).filter((r) => r.line.status !== "cut"), out = [];
  for (const r of rows) {
    const key = (r.node?.id || "-") + "|" + (r.shot?.id || "-");
    let g = out[out.length - 1]; if (!g || g.key !== key) { g = { key, node: r.node, shot: r.shot, n: r.n, tc: r.tc, rows: [] }; out.push(g); }
    g.rows.push(r);
  }
  return out;
}
export function toMarkdown(store) {
  const p = store.p; let s = `# ${p.name}\n\n_Script export, story order. ${p.fps} fps._\n`, scene = null;
  for (const g of grouped(store)) {
    if ((g.node?.id || null) !== scene) { scene = g.node?.id || null; s += `\n## ${g.node?.name || "Unassigned"}\n`; }
    if (g.shot) s += `\n### Shot ${g.n} (${g.shot.type}, ${g.tc})\n\n`; else s += "\n";
    for (const { line: l } of g.rows) s += l.kind === "dialogue" ? `**${charName(p, l.char).toUpperCase()}**: ${l.text}  \n` : l.kind === "paren" ? `*${l.text}*  \n` : `_${l.text}_  \n`;
  }
  return s;
}
export function toFountain(store) {
  const p = store.p; let s = `Title: ${p.name}\nCredit: Script export from Previs\nSource: story order, ${p.fps} fps\n\n`, scene = null;
  for (const g of grouped(store)) {
    if ((g.node?.id || null) !== scene) { scene = g.node?.id || null; s += `.${(g.node?.name || "UNASSIGNED").toUpperCase()}\n\n`; }
    if (g.shot) s += `[[Shot ${g.n}, ${g.shot.type}, ${g.tc}]]\n\n`;
    let prevChar = null;
    for (const { line: l } of g.rows) {
      if (l.kind === "action") { s += `${l.text}\n\n`; prevChar = null; }
      else if (l.kind === "paren") s += `${prevChar === l.char ? "" : charName(p, l.char).toUpperCase() + "\n"}${/^\(.*\)$/.test(l.text.trim()) ? l.text.trim() : "(" + l.text.trim() + ")"}\n`, (prevChar = l.char);
      else { s += `${prevChar === l.char ? "" : charName(p, l.char).toUpperCase() + "\n"}${l.text}\n\n`; prevChar = null; }
    }
  }
  return s;
}
export function toText(store) {
  const p = store.p; let s = `${p.name}\n${"=".repeat(Math.min(60, p.name.length))}\n`, scene = null;
  for (const g of grouped(store)) {
    if ((g.node?.id || null) !== scene) { scene = g.node?.id || null; s += `\n[${g.node?.name || "Unassigned"}]\n`; }
    if (g.shot) s += `  Shot ${g.n} (${g.shot.type}) ${g.tc}\n`;
    for (const { line: l } of g.rows) s += l.kind === "dialogue" ? `    ${charName(p, l.char).toUpperCase()}: ${l.text}\n` : l.kind === "paren" ? `    ${l.text}\n` : `    * ${l.text}\n`;
  }
  return s;
}
export { subById };

// Find (or create and wire up) the Script sub-node of a scene that is bound to a character.
export function ensureScriptNode(store, node, char) {
  let s = node.art.nodes.find((n) => n.type === "script" && scriptNodeChar(node.art, n) === char); if (s) return s;
  store.update(() => { s = ensureScriptSub(node, char); });
  store.commit();
  return s;
}
