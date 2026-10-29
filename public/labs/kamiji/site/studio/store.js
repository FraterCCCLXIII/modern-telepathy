// State: the current character, undo/redo (snapshot based), the saved roster (localStorage, always in try/catch), import/export.
import { SCHEMA, STYLE_BY_ID, MORPH_BY_ID, emptyCharacter, ROOMS } from "./data.js";

const KEY_CUR = "kamiji.studio.current.v1", KEY_ROSTER = "kamiji.studio.roster.v1";
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Make any input a valid character. Returns { ch, warnings }. */
export function normalize(input) {
  const warnings = [], base = emptyCharacter(STYLE_BY_ID[input?.style] ? input.style : "human");
  if (!input || typeof input !== "object") return { ch: base, warnings: ["Not a character object."] };
  if (!STYLE_BY_ID[input.style]) warnings.push(`Unknown style "${input.style}": using human.`);
  const ch = { ...base, name: String(input.name || "Untitled").slice(0, 60) };
  for (const [k, v] of Object.entries(input.parts || {})) if (typeof v === "string") ch.parts[k] = v;
  for (const [k, v] of Object.entries(input.morphs || {})) { const d = MORPH_BY_ID[k]; if (!d) { warnings.push(`Unknown morph "${k}" ignored.`); continue; } const n = Number(v); if (Number.isFinite(n)) ch.morphs[k] = Math.min(d.max, Math.max(d.min, n)); }
  for (const [k, v] of Object.entries(input.materials || {})) if (v && typeof v === "object") ch.materials[k] = { color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : undefined, color2: /^#[0-9a-f]{6}$/i.test(v.color2) ? v.color2 : undefined, grad: Math.min(1, Math.max(0, +v.grad || 0)), rough: Math.min(1, Math.max(0, v.rough == null ? 0.72 : +v.rough)) };
  for (const k of Object.keys(ch.materials)) for (const f of Object.keys(ch.materials[k])) if (ch.materials[k][f] === undefined) delete ch.materials[k][f];
  ch.accessories = (Array.isArray(input.accessories) ? input.accessories : []).filter((a) => a && typeof a.id === "string" && typeof a.socket === "string").map((a) => ({ id: a.id, socket: a.socket, ...(/^#[0-9a-f]{6}$/i.test(a.tint) ? { tint: a.tint } : {}) })).slice(0, 24);
  ch.face = { rig: ["classic", "rtk", "tube"].includes(input.face?.rig) ? input.face.rig : "classic", expression: typeof input.face?.expression === "string" ? input.face.expression : "neutral" };
  ch.pose = { clip: typeof input.pose?.clip === "string" ? input.pose.clip : "idle" };
  const lk = input.look || {};
  ch.look = { effects: Array.isArray(lk.effects) ? lk.effects.filter((x) => ["jitter", "pencil", "retro print", "toon"].includes(x)) : [], room: ROOMS[lk.room] ? lk.room : "studio", outline: lk.outline !== false, steps: [0, 2, 3, 4, 5].includes(+lk.steps) ? +lk.steps : 3 };
  if (input.locks && typeof input.locks === "object") ch.locks = Object.fromEntries(Object.entries(input.locks).filter(([, v]) => v === true));
  return { ch, warnings };
}

export function createStore() {
  const listeners = new Set();
  let { ch } = normalize(safeParse(ls.get(KEY_CUR)) || emptyCharacter("human"));
  const s = { ch, past: [], future: [], roster: loadRoster(), msg: "", ui: { category: "style", symmetry: true, locks: {} }, drag: null };
  s.ui.locks = { ...(ch.locks || {}) };
  const notify = (why) => { listeners.forEach((f) => f(why)); };
  function persist() { const out = clone(s.ch); out.locks = s.ui.locks; ls.set(KEY_CUR, JSON.stringify(out)); }
  const snap = () => JSON.stringify(s.ch);
  const api = {
    get ch() { return s.ch; }, get roster() { return s.roster; }, get ui() { return s.ui; },
    get canUndo() { return s.past.length > 0; }, get canRedo() { return s.future.length > 0; },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    /** Replace the character as one undo step. */
    commit(next, why = "edit") {
      api.endLive();
      if (JSON.stringify(next) === snap()) return false;
      s.past.push(snap()); if (s.past.length > 120) s.past.shift(); s.future = []; s.ch = next; persist(); notify(why); return true;
    },
    /** Live edits (slider drags): update without history; endLive() pushes one undo step for the whole drag. */
    live(next, why = "live") { if (!s.drag) s.drag = snap(); s.ch = next; notify(why); },
    endLive() { if (s.drag) { const before = s.drag; s.drag = null; if (before !== snap()) { s.past.push(before); if (s.past.length > 120) s.past.shift(); s.future = []; } persist(); } },
    undo() { api.endLive(); if (!s.past.length) return false; s.future.push(snap()); s.ch = JSON.parse(s.past.pop()); persist(); notify("undo"); return true; },
    redo() { api.endLive(); if (!s.future.length) return false; s.past.push(snap()); s.ch = JSON.parse(s.future.pop()); persist(); notify("redo"); return true; },
    setLocks(l) { s.ui.locks = l; persist(); },
    // roster
    saveToRoster(thumb) {
      const entry = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: s.ch.name, ch: clone(s.ch), thumb, ts: Date.now() };
      const existing = s.roster.findIndex((r) => r.name === s.ch.name && r.ch.style === s.ch.style);
      if (existing >= 0) { entry.id = s.roster[existing].id; s.roster[existing] = entry; } else s.roster.unshift(entry);
      s.roster = s.roster.slice(0, 30);
      const ok = ls.set(KEY_ROSTER, JSON.stringify(s.roster));
      if (!ok) { s.roster = s.roster.slice(0, 8); ls.set(KEY_ROSTER, JSON.stringify(s.roster)); }
      notify("roster"); return ok;
    },
    removeFromRoster(id) { s.roster = s.roster.filter((r) => r.id !== id); ls.set(KEY_ROSTER, JSON.stringify(s.roster)); notify("roster"); },
    loadFromRoster(id) { const r = s.roster.find((x) => x.id === id); if (!r) return false; const { ch: n } = normalize(r.ch); api.commit(n, "load"); return true; },
    storageOk() { try { localStorage.setItem("kamiji.studio.t", "1"); localStorage.removeItem("kamiji.studio.t"); return true; } catch { return false; } },
    toJSON() { const o = clone(s.ch); o.schema = SCHEMA; return o; },
    importJSON(text) {
      let data; try { data = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
      if (data?.characters && Array.isArray(data.characters)) { // a library file: import every character into the roster, open the first
        const list = data.characters.map((c) => normalize(c.ch || c)).map((r) => r.ch);
        list.slice().reverse().forEach((c) => { s.roster.unshift({ id: "c" + Math.random().toString(36).slice(2, 8), name: c.name, ch: c, thumb: null, ts: Date.now() }); });
        s.roster = s.roster.slice(0, 30); ls.set(KEY_ROSTER, JSON.stringify(s.roster));
        if (list[0]) api.commit(list[0], "import"); notify("roster"); return { ok: true, count: list.length, warnings: [] };
      }
      if (!data || typeof data !== "object" || typeof data.style !== "string") return { ok: false, error: "No character found: expected an object with a \"style\"." };
      if (data.schema && !String(data.schema).startsWith("kamiji.studio.character")) return { ok: false, error: `Unknown schema "${data.schema}".` };
      const { ch: n, warnings } = normalize(data); api.commit(n, "import"); return { ok: true, count: 1, warnings };
    },
    libraryJSON() { return { schema: "kamiji.studio.library/1", characters: s.roster.map((r) => ({ ...r.ch, schema: SCHEMA })) }; },
  };
  return api;
}
function safeParse(t) { try { return t ? JSON.parse(t) : null; } catch { return null; } }
function loadRoster() { const r = safeParse(ls.get(KEY_ROSTER)); return Array.isArray(r) ? r.filter((x) => x && x.ch).map((x) => ({ ...x, ch: normalize(x.ch).ch })) : []; }
