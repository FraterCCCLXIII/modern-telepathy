// Import (source) and export / publish (sink) behaviour. Everything runs in the browser; there are no network calls.
import { uid, timecode, normalise, makeShot } from "./store.js";
import { SOURCES, SINKS, LIMIT_BYTES } from "./nodekinds.js";
import { CHAR_BY_ID, registerUserModel, PRESET_BY_ID } from "./catalog.js";
import { makeSub, outputNode, portsOf, effectiveRef } from "./art.js";
import { SUBS } from "./subsmod.js";
import { NARRATOR, charName, words, toMarkdown, toFountain, toText, orderedLines, WPS } from "./script.js";

// ---- parsers (pure) --------------------------------------------------------------------------------------
// SRT / WebVTT: a tiny local parser (the planned site/subtitles module was not available to import).
export function parseSubtitles(text) {
  const cues = [], blocks = text.replace(/\r/g, "").replace(/^﻿/, "").split(/\n\n+/);
  const tc = (s) => { const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(s); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +(m[4] + "00").slice(0, 3) / 1000 : null; };
  for (const b of blocks) {
    const ls = b.split("\n"), i = ls.findIndex((l) => l.includes("-->")); if (i < 0) continue;
    const [a, c] = ls[i].split("-->"), t0 = tc(a), t1 = tc(c.trim().split(/\s/)[0]); if (t0 == null || t1 == null) continue;
    const txt = ls.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    if (txt) cues.push({ t0, t1, text: txt });
  }
  return cues;
}
// Plain text, Markdown or Fountain-style screenplay -> [{ char: name|null, kind, text }]
export function parseScreenplay(text) {
  const out = [], rows = text.replace(/\r/g, "").replace(/^﻿/, "").split("\n");
  const upper = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();
  const clean = (s) => s.replace(/\[\[[^\]]*\]\]/g, "").replace(/\*\*/g, "").replace(/^_+|_+$/g, "").trim();
  let i = 0, para = [];
  const flush = () => { if (para.length) { out.push({ char: null, kind: "action", text: clean(para.join(" ")) }); para = []; } };
  // fountain title page
  while (i < rows.length && /^(Title|Credit|Author|Authors|Source|Draft date|Contact|Copyright)\s*:/i.test(rows[i].trim())) { i++; while (i < rows.length && /^\s+\S/.test(rows[i])) i++; }
  for (; i < rows.length; i++) {
    const raw = rows[i], t = raw.trim();
    if (!t) { flush(); continue; }
    if (/^(#{1,6}\s|[-=*_]{3,}$|\.[A-Za-z0-9]|(INT|EXT|EST|INT\.?\/EXT|I\/E)[. ])/i.test(t) && !/^\.\.\./.test(t)) { flush(); continue; } // headings / scene headings / rules
    if (/^(>|=|~|@@)\s?/.test(t) && !/^@/.test(t)) { flush(); continue; }
    const m = /^\**\s*([A-Z][A-Za-z0-9 .'-]{0,23}?)\s*\**\s*:\s*(.+)$/.exec(t);
    if (m && (upper(m[1]) || /^\*\*/.test(t))) { flush(); out.push({ char: m[1].trim(), kind: "dialogue", text: clean(m[2]) }); continue; }
    const prev = rows[i - 1]?.trim(), next = rows[i + 1]?.trim();
    const cue = t.replace(/^@/, "").replace(/\s*\^$/, "").replace(/\s*\(.*\)$/, "");
    if (!prev && next && (/^@/.test(t) || (upper(cue) && cue.length <= 30 && !/[.!?]$/.test(cue))) ) { // Fountain character cue
      flush(); const name = cue.trim(); i++;
      while (i < rows.length && rows[i].trim()) {
        const d = rows[i].trim();
        if (/^\(.*\)$/.test(d)) out.push({ char: name, kind: "paren", text: d }); else out.push({ char: name, kind: "dialogue", text: clean(d) });
        i++;
      }
      continue;
    }
    if (/^\(.*\)$/.test(t) && out.length && out[out.length - 1].char) { out.push({ char: out[out.length - 1].char, kind: "paren", text: t }); continue; }
    para.push(t);
  }
  flush();
  return out.filter((l) => l.text);
}
export function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const csvCell = (v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "x";

// ---- tiny zip writer (stored, no compression) ------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + f.data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
}
export function download(name, data, type = "text/plain") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type + ";charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---- the module ------------------------------------------------------------------------------------------
export function createIO({ store, stage, board, transport, announce, fileInput }) {
  const states = new Map(), listeners = new Set();
  let psubs = null; // Previs <-> subtitles adapter (subs.js), set after it is created
  const io = { onChange: (f) => listeners.add(f), state: (id) => states.get(id) || { state: "idle" }, setSubs: (s) => { psubs = s; } };
  const set = (id, patch) => { states.set(id, { ...(states.get(id) || {}), ...patch }); listeners.forEach((f) => f()); };
  const byId = (id) => store.p.nodes.find((n) => n.id === id);
  const fail = (node, msg) => { set(node.id, { state: "error", msg, pct: 0 }); announce(`${node.name}: ${msg}`); if (node.type === "sink") { store.update((p) => { byId(node.id).last = { ok: false, msg, at: new Date().toISOString() }; }, "move"); } return false; };
  const ok = (node, msg) => { set(node.id, { state: "done", msg, pct: 1 }); announce(`${node.name}: ${msg}`); return true; };
  const sceneOf = (node) => { const e = store.p.edges.find((x) => x.from === node.id && byId(x.to)?.type === "scene"); return e ? byId(e.to) : null; };
  const need = "Connect this import node to a scene first: drag from its port to a scene card.";

  // ---- sources ---------------------------------------------------------------------------------------
  io.pickFile = (node) => {
    const d = SOURCES[node.kind]; if (d.disabled) return;
    fileInput.accept = d.accept || ""; fileInput.multiple = !!d.multiple; fileInput.dataset.node = node.id; fileInput.value = ""; fileInput.click();
  };
  fileInput.addEventListener("change", () => { const n = byId(fileInput.dataset.node); const files = [...fileInput.files]; fileInput.value = ""; if (n && files.length) io.importFiles(n, files); });
  io.importFiles = async (node, files) => {
    const d = SOURCES[node.kind]; if (!d || d.disabled) return fail(node, "This import is not connected.");
    const big = files.find((f) => f.size > LIMIT_BYTES);
    if (big) return fail(node, `${big.name} is larger than 25 MB. Nothing was read.`);
    set(node.id, { state: "running", pct: 0.1, msg: "Reading…" });
    try {
      const res = await IMPORTERS[node.kind](node, files);
      if (res === false) return false;
      store.update((p) => { const n = byId(node.id); n.info = { file: files.map((f) => f.name).join(", ").slice(0, 120), summary: res, at: new Date().toISOString() }; });
      store.emit("all"); store.commit(); return ok(node, res);
    } catch (err) { return fail(node, "Import failed: " + (err.message || err)); }
  };
  const resolveChar = (name) => {
    const p = store.p, low = name.trim().toLowerCase(); if (!low) return NARRATOR;
    if (/^(narrator|action|n\.?a\.?|v\.?o\.?)$/.test(low)) return NARRATOR;
    for (const c of CHAR_BY_ID.values()) if (c.rigged && (charName(p, c.id).toLowerCase() === low || c.id.split("/").pop() === low)) return c.id;
    const hit = p.script.cast.find((c) => c.name.toLowerCase() === low) || Object.entries(p.script.names).find(([, v]) => v.toLowerCase() === low);
    if (hit) return hit.id || hit[0];
    const id = "cast:" + slug(name); p.script.cast.push({ id, name: name.trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40), ref: "" }); return id;
  };
  const nameOnce = (name) => { const sid = resolveChar(name); return sid; };
  const IMPORTERS = {
    async script(node, [f]) {
      const text = await f.text(), items = parseScreenplay(text); if (!items.length) throw new Error("No script lines found in " + f.name);
      const sc = sceneOf(node); let n = 0; const chars = new Set();
      store.update((p) => {
        for (const it of items) { const ch = it.char ? nameOnce(it.char) : NARRATOR; chars.add(ch); p.script.lines.push({ id: uid("l"), char: ch, kind: it.kind, text: it.text, node: sc?.id || null, shot: null, status: "draft" }); n++; }
      });
      return `${n} lines, ${chars.size} characters${sc ? ` placed in "${sc.name}"` : " (not placed in a scene; connect this node to one to place them)"}. See the Script drawer.`;
    },
    async subtitles(node, [f]) {
      const text = await f.text(), fps = store.p.fps, seq = store.d.seq; let cues = null, note = "";
      if (SUBS) { // the shared module reads SRT, WebVTT (speakers, italics, cue settings) and its own JSON
        try {
          const known = psubs?.charMap() || {}, r = SUBS.parseAuto(text, { characters: known });
          if (r.lines.length) { cues = r.lines.map((l) => ({ t0: l.startMs / 1000, t1: (l.startMs + l.durationMs) / 1000, text: l.text, who: l.characterId && l.characterId !== "narrator" ? { id: l.characterId, name: r.characters[l.characterId]?.name || known[l.characterId]?.name || l.characterId } : null, paren: l.parenthetical })); note = r.errors.length || r.warnings.length ? ` ${r.errors.length} unreadable cues skipped, ${r.warnings.length} warnings.` : ""; }
          else if (r.errors.length) throw new Error(r.errors[0].message);
        } catch (e) { console.warn("Previs: subtitles module could not read this file, using the built-in parser", e); cues = null; }
      }
      if (!cues) { cues = parseSubtitles(text).map((c) => { const m = /^([A-Z][A-Za-z0-9 .'-]{0,23}):\s+(.+)$/.exec(c.text); return { t0: c.t0, t1: c.t1, text: m && m[1] === m[1].toUpperCase() ? m[2] : c.text, who: m && m[1] === m[1].toUpperCase() ? { id: null, name: m[1] } : null }; }); note = " (built-in parser)"; }
      if (!cues.length) throw new Error("No cues found. Expected SRT or WebVTT.");
      let n = 0, placed = 0;
      store.update((p) => {
        for (const c of cues) {
          const ch = c.who ? (c.who.id && (CHAR_BY_ID.has(c.who.id) || p.script.cast.some((x) => x.id === c.who.id)) ? c.who.id : nameOnce(c.who.name)) : NARRATOR;
          const fr = c.t0 * fps, se = seq.find((s) => fr >= s.start && fr < s.end); if (se) placed++;
          if (c.paren) p.script.lines.push({ id: uid("l"), char: ch, kind: "paren", text: `(${String(c.paren).replace(/^\(|\)$/g, "")})`, node: se?.node.id || null, shot: se?.shot.id || null, status: "draft" });
          p.script.lines.push({ id: uid("l"), char: ch, kind: "dialogue", text: c.text, node: se?.node.id || null, shot: se?.shot.id || null, status: "draft", t0: c.t0, t1: c.t1 }); n++;
        }
      });
      return `${n} timed lines; ${placed} placed on the shot playing at that time, ${n - placed} outside the cut.${note}`;
    },
    async images(node, files) {
      const sc = sceneOf(node); if (!sc) return fail(node, need);
      const list = files.filter((f) => /^image\/(png|jpe?g)$/.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)).slice(0, 12); if (!list.length) throw new Error("Drop PNG or JPEG images.");
      const made = [];
      for (const f of list) {
        const bm = await createImageBitmap(f), k = Math.min(1, 640 / Math.max(bm.width, bm.height)), cv = document.createElement("canvas"); cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k);
        cv.getContext("2d").drawImage(bm, 0, 0, cv.width, cv.height); made.push({ name: f.name.replace(/\.[^.]+$/, "").slice(0, 40), img: cv.toDataURL("image/jpeg", 0.72) });
      }
      store.update(() => { const n0 = sc.art.nodes.length; made.forEach((m, i) => sc.art.nodes.push(makeSub("other", { kind: "reference", label: m.name, img: m.img }, [-340, i * 160]))); });
      return `${made.length} reference image${made.length > 1 ? "s" : ""} added to the artboard of "${sc.name}" (scaled to 640 px).`;
    },
    async audio(node, [f]) {
      const buf = await f.arrayBuffer(), AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error("Audio decoding is not available in this browser.");
      const ctx = new AC(); let audio; try { audio = await ctx.decodeAudioData(buf); } finally { ctx.close?.(); }
      const ch = audio.getChannelData(0), N = 96, step = Math.max(1, Math.floor(ch.length / N)), wave = [];
      for (let i = 0; i < N; i++) { let m = 0; for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 8) m = Math.max(m, Math.abs(ch[j])); wave.push(Math.round(m * 100) / 100); }
      const fps = store.p.fps, len = Math.max(1, Math.round(audio.duration * fps)), sc = sceneOf(node), label = f.name.replace(/\.[^.]+$/, "").slice(0, 60);
      store.update((p) => {
        p.notes.push({ id: uid("a"), frame: Math.floor(transport.frame), len, label, wave });
        if (sc) { const a = makeSub("audio", { text: label, frame: Math.floor(transport.frame), len }, [330, 520 + sc.art.nodes.length * 4]); sc.art.nodes.push(a); const o = outputNode(sc.art); if (o) sc.art.edges.push({ id: uid("x"), from: a.id, fp: "out", to: o.id, tp: "audio" }); }
      });
      return `${audio.duration.toFixed(1)} s, ${Math.round(audio.sampleRate / 1000)} kHz, ${audio.numberOfChannels} ch. Audio note with waveform added to the timeline${sc ? " and an Audio sub-node to the scene" : ""}. Not played.`;
    },
    async model(node, [f]) {
      if (!/\.glb$/i.test(f.name)) throw new Error("Drop a .glb file.");
      const url = URL.createObjectURL(f), id = "user/" + slug(f.name.replace(/\.glb$/i, "")) + "-" + Math.random().toString(36).slice(2, 5);
      let info = { clips: [], skinned: false }; if (stage) info = await stage.probe(url).catch((e) => { URL.revokeObjectURL(url); throw new Error("That file is not a readable GLB: " + e.message); });
      const name = f.name.replace(/\.glb$/i, "").slice(0, 40); registerUserModel({ id, name, url, rigged: info.skinned || info.clips.length > 0, clips: info.clips });
      const sc = sceneOf(node);
      store.update((p) => { p.assets.models.push({ id, name, size: f.size, rigged: info.skinned, clips: info.clips }); if (sc) sc.art.nodes.push(makeSub("model", { ref: id }, [-340, sc.art.nodes.filter((n) => n.type === "model").length * 170 + 700])); });
      return `${name}: ${info.clips.length} clips${info.skinned ? ", skinned" : ""}. ${sc ? `Model sub-node added to "${sc.name}".` : "Available in every artboard's Model and Content lists."} Kept in this tab only.`;
    },
    async project(node, [f]) {
      const raw = JSON.parse(await f.text()), q = normalise(raw), idm = new Map(), shm = new Map();
      const scenes = q.nodes.filter((n) => n.type === "scene" || n.type === "branch"); if (!scenes.length) throw new Error("That project has no scenes.");
      const maxY = Math.max(0, ...store.p.nodes.map((n) => n.y + 260)), minY = Math.min(...scenes.map((n) => n.y));
      store.update((p) => {
        for (const n of scenes) { const nid = uid("n"); idm.set(n.id, nid); n.id = nid; n.y = n.y - minY + maxY + 60; for (const s of n.shots) { const o = s.id; s.id = uid("s"); shm.set(o, s.id); } if (n.art) for (const a of n.art.nodes) if (a.type === "camera") a.shot = shm.get(a.shot) || a.shot; p.nodes.push(n); }
        for (const e of q.edges) if (idm.has(e.from) && idm.has(e.to)) p.edges.push({ id: uid("e"), from: idm.get(e.from), to: idm.get(e.to), kind: e.kind });
        let ln = 0; for (const l of q.script.lines) if (idm.has(l.node)) { p.script.lines.push({ ...l, id: uid("l"), node: idm.get(l.node), shot: shm.get(l.shot) || null }); ln++; }
        for (const c of q.script.cast) if (!p.script.cast.some((x) => x.id === c.id)) p.script.cast.push(c);
        Object.assign(p.script.names, Object.fromEntries(Object.entries(q.script.names).filter(([k]) => !(k in p.script.names))));
        p.script.voices = { ...(q.script.voices || {}), ...(p.script.voices || {}) };
      });
      return `${scenes.length} nodes merged from "${q.name}" (placed below the current graph).`;
    },
    async cast(node, [f]) {
      const text = await f.text(); let rows;
      if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) { const j = JSON.parse(text); rows = (Array.isArray(j) ? j : j.characters || j.cast || []).map((x) => (typeof x === "string" ? { name: x } : { name: x.name || x.character, model: x.model || x.ref || "" })); }
      else { const r = parseCsv(text), h = r[0].map((c) => c.trim().toLowerCase()), hasH = h.includes("name") || h.includes("character"); const ni = hasH ? Math.max(h.indexOf("name"), h.indexOf("character")) : 0, mi = hasH ? h.indexOf("model") : 1; rows = r.slice(hasH ? 1 : 0).map((c) => ({ name: c[ni], model: c[mi] || "" })); }
      rows = rows.filter((r) => r.name && String(r.name).trim()); if (!rows.length) throw new Error("No character names found.");
      const c0 = store.p.script.cast.length;
      store.update((p) => { for (const r of rows) { const id = resolveChar(String(r.name)); const c = p.script.cast.find((x) => x.id === id); if (c && r.model && CHAR_BY_ID.has(r.model)) c.ref = r.model; } });
      return `${rows.length} characters read; ${store.p.script.cast.length - c0} new in the cast list, the rest matched characters already in the project. See the Script drawer.`;
    },
    async shots(node, [f]) {
      const sc = sceneOf(node); if (!sc) return fail(node, need);
      const r = parseCsv(await f.text()), h = r[0].map((c) => c.trim().toLowerCase()), col = (...n) => h.findIndex((x) => n.includes(x));
      const iT = col("type", "shot type"), iM = col("move", "camera move"), iF = col("frames", "length"), iS = col("seconds", "duration", "dur", "sec"), iC = col("caption", "action", "description"), iD = col("dialogue", "dialog");
      if ([iT, iM, iF, iS, iC, iD].every((i) => i < 0)) throw new Error("Expected a header row with columns such as type, move, frames, caption.");
      const pr = PRESET_BY_ID.get(sc.preset) || PRESET_BY_ID.get("hand-wave"), fps = store.p.fps, rows = r.slice(1).filter((c) => c.some((x) => x.trim())); let n = 0;
      store.update((p) => {
        const cast = sc.art.nodes.filter((c) => c.type === "content" && c.kind === "character").map((c) => effectiveRef(sc.art, c));
        for (const c of rows.slice(0, 60)) {
          const base = sc.shots[sc.shots.length - 1], sh = base ? { ...JSON.parse(JSON.stringify(base)), id: uid("s"), off: 0 } : makeShot(pr);
          sh.len = Math.max(6, Math.round(iF >= 0 && +c[iF] ? +c[iF] : iS >= 0 && +c[iS] ? +c[iS] * fps : 48)); if (iT >= 0 && c[iT]) sh.type = c[iT].trim().toUpperCase().slice(0, 4); if (iM >= 0 && c[iM]) sh.move = c[iM].trim().slice(0, 20);
          sc.shots.push(sh);
          if (iC >= 0 && c[iC]?.trim()) p.script.lines.push({ id: uid("l"), char: NARRATOR, kind: "action", text: c[iC].trim(), node: sc.id, shot: sh.id, status: "draft" });
          if (iD >= 0 && c[iD]?.trim()) p.script.lines.push({ id: uid("l"), char: cast[0] || NARRATOR, kind: "dialogue", text: c[iD].trim(), node: sc.id, shot: sh.id, status: "draft" });
          n++;
        }
      });
      return `${n} shots appended to "${sc.name}" (camera copied from its last shot).`;
    },
  };

  // ---- sinks -----------------------------------------------------------------------------------------
  io.scopeOf = (node) => {
    const e = store.p.edges.find((x) => x.to === node.id), from = e && byId(e.from); if (!from || (from.type !== "scene" && from.type !== "branch")) return null;
    const d = store.d, last = d.order[d.order.length - 1];
    if (from.type === "branch" || from === last || !d.inCut.has(from.id)) { const nodes = d.order.filter((n) => n.type === "scene"); return { whole: true, nodes, label: `the whole cut (${d.seq.length} shots)` }; }
    return { whole: false, nodes: [from], label: `scene "${from.name}" only` };
  };
  function rowsOf(scope) { // shots in scope with their own timeline (a single scene starts at 0)
    const rows = []; let t = 0, n = 0;
    for (const nd of scope.nodes) for (const s of nd.shots) { rows.push({ node: nd, shot: s, start: t, len: s.len, end: t + s.len, n: ++n }); t += s.len; }
    return rows;
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const fname = (ext) => slug(store.p.name) + "." + ext;
  const frameCam = (row, f) => { const cam = stage.camera(); stage.camAt(cam, row.shot.cam, row.len > 1 ? (f - row.start) / (row.len - 1) : 0); return cam; };

  io.run = async (node) => {
    const d = SINKS[node.kind]; if (!d || d.disabled) return fail(node, `${d?.label || "This"} is planned; nothing was exported.`);
    if (d.social) return io.social ? io.social(node) : false; // publish presets are a mockup (pipeline.js); only "Download" makes a real file
    if (states.get(node.id)?.state === "running") return false;
    const scope = io.scopeOf(node);
    if (!scope && node.kind !== "json") return fail(node, "Not connected. Attach this node to the last scene (whole cut) or to one scene.");
    const rows = scope ? rowsOf(scope) : [];
    if (!rows.length && !["json", "subs", "pdf"].includes(node.kind) && node.kind !== "kosmos") return fail(node, "Nothing to export: the connected scene has no shots.");
    set(node.id, { state: "running", pct: 0, msg: "Starting…" });
    try {
      const msg = await EXPORTERS[node.kind](node, scope, rows);
      store.update((p) => { byId(node.id).last = { ok: true, msg, at: new Date().toISOString() }; }, "move");
      return ok(node, msg);
    } catch (err) { return fail(node, "Export failed: " + (err.message || err)); }
  };
  io.captions = async (fmt) => { // real download of the caption track for the whole cut (used by the publish presets)
    const scope = { whole: true, nodes: store.d.order.filter((n) => n.type === "scene") }, rows = rowsOf(scope);
    try { const msg = await EXPORTERS.subs({ opts: { format: fmt } }, scope, rows); announce(msg); } catch (err) { announce("Captions: " + (err.message || err)); }
  };
  const p_ = (node, pct, msg) => set(node.id, { state: "running", pct, msg });
  const EXPORTERS = {
    async json() { download(fname("previs.json"), JSON.stringify(store.p, null, 2), "application/json"); return "Project JSON downloaded."; },
    async pdf(node, scope, rows) { await board.buildPrint(rows.map((r) => r.shot.id)); window.print(); return `Print view opened with ${rows.length} shots. Choose "Save as PDF".`; },
    async shotscsv(node, scope, rows) {
      const p = store.p, head = ["shot", "scene", "type", "move", "start", "frames", "seconds", "action", "dialogue"];
      const lines = rows.map((r) => { const ls = p.script.lines.filter((l) => l.shot === r.shot.id && l.status !== "cut"); return [r.n, r.node.name, r.shot.type, r.shot.move, timecode(r.start, p.fps), r.len, (r.len / p.fps).toFixed(2), ls.filter((l) => l.kind === "action").map((l) => l.text).join(" / "), ls.filter((l) => l.kind !== "action").map((l) => (l.kind === "dialogue" ? charName(p, l.char) + ": " : "") + l.text).join(" / ")].map(csvCell).join(","); });
      download(fname("shots.csv"), [head.join(","), ...lines].join("\n") + "\n", "text/csv"); return `${rows.length} shots written to CSV.`;
    },
    async edl(node, scope, rows) {
      const p = store.p, tc = (f) => timecode(f, p.fps), out = [`TITLE: ${p.name}`, "FCM: NON-DROP FRAME", ""];
      rows.forEach((r, i) => out.push(`${String(i + 1).padStart(3, "0")}  ${("SC" + String(scope.nodes.indexOf(r.node) + 1).padStart(2, "0")).padEnd(8)} V     C        ${tc(r.shot.off)} ${tc(r.shot.off + r.len)} ${tc(r.start)} ${tc(r.end)}`, `* FROM CLIP NAME: ${r.node.name}`, `* COMMENT: shot ${r.n} ${r.shot.type} ${r.shot.move}`, ""));
      download(fname("edl"), out.join("\n"), "text/plain"); return `${rows.length} events written (CMX3600, ${p.fps} fps, non-drop).`;
    },
    async subs(node, scope, rows) {
      const fmt = node.opts.format, p = store.p;
      if (["fountain", "md", "txt"].includes(fmt)) { download(fname(fmt === "md" ? "md" : fmt === "txt" ? "txt" : "fountain"), (fmt === "md" ? toMarkdown : fmt === "txt" ? toText : toFountain)(store), "text/plain"); return `Script written as ${SINKS.subs.formats[fmt]}.`; }
      let skipped = p.script.lines.filter((l) => l.kind === "dialogue" && l.status !== "cut" && !l.shot).length;
      if (SUBS && psubs) { // the shared module writes the file (speaker names, italics, paragraph splitting, cue settings)
        try {
          const lines = psubs.linesForScope(rows); if (!lines.length) throw new Error("No dialogue lines are assigned to shots in this scope. Assign lines to shots in the Script drawer.");
          const o = { characters: psubs.charMap(), fps: p.fps, title: p.name }, body = fmt === "vtt" ? SUBS.toVTT(lines, o) : SUBS.toSRT(lines, o);
          download(fname(fmt), body, fmt === "vtt" ? "text/vtt" : "application/x-subrip");
          return `${lines.length} lines written as ${fmt.toUpperCase()} by the subtitles module${skipped ? `; ${skipped} dialogue lines without a shot were skipped` : ""}.`;
        } catch (e) { if (/No dialogue/.test(e.message)) throw e; console.warn("Previs: subtitles module could not write the file, using the built-in writer", e); }
      }
      const cues = [];
      for (const r of rows) {
        const ls = p.script.lines.filter((l) => l.shot === r.shot.id && l.kind === "dialogue" && l.status !== "cut"); if (!ls.length) continue;
        const total = ls.reduce((a, l) => a + Math.max(1, words(l.text)), 0); let t = r.start / p.fps; const span = r.len / p.fps;
        for (const l of ls) { const w = Math.max(1, words(l.text)), dur = span * w / total; cues.push({ t0: t, t1: t + dur * 0.96, text: l.char === NARRATOR ? l.text : `${charName(p, l.char)}: ${l.text}` }); t += dur; }
      }
      if (!cues.length) throw new Error("No dialogue lines are assigned to shots in this scope. Assign lines to shots in the Script drawer.");
      const ts = (s, sep) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sc = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
      const body = cues.map((c, i) => `${fmt === "srt" ? i + 1 + "\n" : ""}${ts(c.t0, fmt === "srt" ? "," : ".")} --> ${ts(c.t1, fmt === "srt" ? "," : ".")}\n${c.text}\n`).join("\n");
      download(fname(fmt), fmt === "vtt" ? "WEBVTT\n\n" + body : body, fmt === "vtt" ? "text/vtt" : "application/x-subrip");
      return `${cues.length} cues written as ${fmt.toUpperCase()}${skipped ? `; ${skipped} dialogue lines without a shot were skipped` : ""}.`;
    },
    async kosmos(node, scope, rows) {
      const p = store.p, scenes = scope.nodes.map((n) => ({ id: n.id, name: n.name, cast: n.props.cast, background: n.props.bg, light: n.props.light, shots: n.shots.map((s) => ({ id: s.id, type: s.type, move: s.move, frames: s.len, sceneOffset: s.off, camera: s.cam })), lines: p.script.lines.filter((l) => l.node === n.id).map((l) => ({ character: charName(p, l.char), kind: l.kind, text: l.text, shot: l.shot })) }));
      download(fname("kosmos-scene.json"), JSON.stringify({ format: "previs-scene/1", note: "Previs' own scene JSON. Not validated against the Kosmos engine.", fps: p.fps, scenes }, null, 2), "application/json");
      return `${scenes.length} scenes written. Previs' own format; not validated against the engine.`;
    },
    async blender(node, scope, rows) {
      const p = store.p, v = (a) => `(${(+a[0]).toFixed(4)}, ${(-a[2]).toFixed(4)}, ${(+a[1]).toFixed(4)})`; // three.js Y-up -> Blender Z-up
      const L = ["# Generated by Previs. Rebuilds one camera per shot (A to B keyframes) and a camera-bound marker per shot.", "# Not tested in Blender yet: run it in the Scripting workspace of a new file.", "import bpy", "from mathutils import Vector", "", "sc = bpy.context.scene", `sc.render.fps = ${p.fps}`, "sc.render.resolution_x, sc.render.resolution_y = 1920, 1080", "",
        "def look(cam, loc, tgt):", "    cam.location = loc", "    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()", ""];
      rows.forEach((r) => {
        const c = r.shot.cam, f0 = r.start + 1, f1 = r.end;
        L.push(`# shot ${r.n}: ${r.node.name} (${r.shot.type}, ${r.shot.move})`, `cd = bpy.data.cameras.new("Shot${r.n}")`, "cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24", `co = bpy.data.objects.new("Shot${r.n}", cd)`, "sc.collection.objects.link(co)",
          `cd.lens = 12 / __import__('math').tan(__import__('math').radians(${c.a.fov}) / 2)`, `look(co, ${v(c.a.p)}, ${v(c.a.t)}); co.keyframe_insert('location', frame=${f0}); co.keyframe_insert('rotation_euler', frame=${f0})`,
          `look(co, ${v(c.b.p)}, ${v(c.b.t)}); co.keyframe_insert('location', frame=${f1}); co.keyframe_insert('rotation_euler', frame=${f1})`,
          `m = sc.timeline_markers.new(${JSON.stringify(`${r.n}. ${r.node.name}`)}, frame=${f0}); m.camera = co`, "");
      });
      L.push(`sc.frame_start, sc.frame_end = 1, ${Math.max(1, rows[rows.length - 1].end)}`);
      download(fname("blender.py"), L.join("\n") + "\n", "text/x-python"); return `Python script for ${rows.length} cameras and markers downloaded. Not tested in Blender yet.`;
    },
    async frames(node, scope, rows) {
      if (!stage) throw new Error("3D is unavailable in this browser.");
      const total = rows[rows.length - 1].end, step = Math.max(1, Math.ceil(total / 240)), fps = store.p.fps, cv = document.createElement("canvas"), files = [];
      for (const n of scope.nodes) await stage.instance(n).ready;
      const burn = node.opts.subtitles !== false && !!psubs?.available, gstart = new Map(store.d.seq.map((x) => [x.shot.id, x.start])); let k = 0, burned = 0;
      for (let f = 0; f < total; f += step) {
        const r = rows.find((x) => f >= x.start && f < x.end) || rows[rows.length - 1], inst = stage.instance(r.node);
        if (inst.state !== "ready") throw new Error(`Scene "${r.node.name}" could not be rendered.`);
        inst.setTime((r.shot.off + (f - r.start)) / fps); const fcam = frameCam(r, f); stage.draw(inst, fcam, cv, 640, 360);
        if (burn && psubs.burn(cv, (gstart.get(r.shot.id) ?? r.start) + (f - r.start), inst, fcam)) burned++;
        const blob = await new Promise((res) => cv.toBlob(res, "image/png")); files.push({ name: `frame_${String(++k).padStart(4, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
        if (k % 4 === 0) { p_(node, f / total, `Rendering frame ${k} of ${Math.ceil(total / step)}`); await tick(); }
      }
      download(fname("frames.zip"), zip(files), "application/zip");
      return `${files.length} PNG frames (640x360) zipped${step > 1 ? `, every ${step}th frame of ${total}` : ""}${burn ? `; subtitles burned into ${burned} frames` : ""}.`;
    },
    async video(node, scope, rows) {
      if (!stage) throw new Error("3D is unavailable in this browser.");
      if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not available in this browser.");
      const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)); if (!mime) throw new Error("This browser cannot record WebM.");
      const total = rows[rows.length - 1].end, fps = store.p.fps, cv = document.createElement("canvas"); cv.width = 640; cv.height = 360;
      for (const n of scope.nodes) await stage.instance(n).ready;
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 2_500_000 }), chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise((res) => { rec.onstop = res; });
      const burn = node.opts.subtitles !== false && !!psubs?.available, gstart = new Map(store.d.seq.map((x) => [x.shot.id, x.start])); let burned = 0;
      rec.start(250); const t0 = performance.now();
      await new Promise((res) => {
        const loop = (now) => {
          const f = ((performance.now() - t0) / 1000) * fps;
          if (f >= total) return res();
          const r = rows.find((x) => f >= x.start && f < x.end) || rows[rows.length - 1], inst = stage.instance(r.node);
          if (inst.state === "ready") { inst.setTime((r.shot.off + (f - r.start)) / fps); const fcam = frameCam(r, Math.floor(f)); stage.draw(inst, fcam, cv, 640, 360); if (burn && psubs.burn(cv, (gstart.get(r.shot.id) ?? r.start) + (f - r.start), inst, fcam)) burned++; }
          p_(node, f / total, `Recording in real time: ${(f / fps).toFixed(1)} of ${(total / fps).toFixed(1)} s`); requestAnimationFrame(loop);
        }; requestAnimationFrame(loop);
      });
      rec.stop(); await done;
      download(fname("animatic.webm"), new Blob(chunks, { type: "video/webm" }), "video/webm");
      return `${(total / fps).toFixed(1)} s recorded in real time as WebM (640x360, no sound)${burn ? `; subtitles burned into ${burned} frames` : ""}.`;
    },
    async glb(node, scope, rows) {
      if (!stage) throw new Error("3D is unavailable in this browser.");
      let GLTFExporter; try { ({ GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js")); } catch (e) { throw new Error("The glTF exporter could not be loaded (it comes from the three.js add-ons on the CDN)."); }
      const THREE = stage.THREE, root = new THREE.Scene(); let i = 0;
      for (const n of scope.nodes) {
        const inst = stage.instance(n); await inst.ready; if (inst.state !== "ready") throw new Error(`Scene "${n.name}" could not be loaded.`);
        inst.setTime((n.shots[0]?.off || 0) / store.p.fps);
        const g = new THREE.Group(); g.name = n.name; const body = stage.cloneObject(inst.root); g.add(body); g.position.x = i * 6; root.add(g);
        n.shots.forEach((s, si) => { const cam = new THREE.PerspectiveCamera(s.cam.a.fov, 16 / 9, 0.05, 80); cam.name = `${n.name} shot ${si + 1}`; cam.position.fromArray(s.cam.a.p); cam.lookAt(new THREE.Vector3().fromArray(s.cam.a.t)); cam.position.x += i * 6; cam.lookAt(new THREE.Vector3().fromArray(s.cam.a.t).add(new THREE.Vector3(i * 6, 0, 0))); root.add(cam); });
        i++; p_(node, i / scope.nodes.length, `Assembled ${i} of ${scope.nodes.length} scenes`); await tick();
      }
      const glb = await new Promise((res, rej) => new GLTFExporter().parse(root, res, rej, { binary: true, onlyVisible: true }));
      download(fname("scenes.glb"), new Blob([glb], { type: "model/gltf-binary" }), "model/gltf-binary");
      return `${scope.nodes.length} scenes assembled side by side with ${rows.length} cameras (static pose, no animation).`;
    },
  };
  // imported models are not in the project file: after a reload register placeholders so the UI can say "re-import"
  io.ensureUserModels = (p) => { for (const m of p.assets.models) if (!CHAR_BY_ID.get(m.id)?.url) registerUserModel({ id: m.id, name: m.name + " (re-import)", url: "", rigged: m.rigged, clips: m.clips }); };
  return io;
}
