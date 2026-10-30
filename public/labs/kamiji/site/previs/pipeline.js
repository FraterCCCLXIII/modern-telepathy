// PIPELINE MOCKUP: prompt chat -> generation provider -> review -> social / publish presets.
// Nothing here uses the network, a key or an upload. Provider results are the previs frames with a local CSS/canvas filter, labelled SIMULATED.
// Run state (queued / rendering / done / failed) is driven by timers in this tab. Takes, reviews, chat messages and settings are saved in the project JSON.
import { el } from "./ui.js";
import { uid } from "./store.js";
import { applyMove } from "./ops.js";
import { MOVES } from "./catalog.js";
import { PROVIDERS, PROVIDER_OPTS, RUN_STATES, SOCIAL } from "./nodekinds.js";

const iso = () => new Date().toISOString();
const r1 = (x) => Math.round(x * 10) / 10;
const ctl = (e) => { e.classList.add("pv-card-ctl"); return e; };
const MOOD = /mood\w*|dark\w*|night|dusk|gloom\w*|noir|dim\b/i;
const MOVE_RX = [[/push[- ]?in|dolly in|move in/i, "Push in"], [/pull[- ]?out|dolly out/i, "Pull out"], [/orbit/i, "Orbit"], [/crane/i, "Crane up"], [/\bpan\b/i, "Pan"], [/\btrack/i, "Track"]];
const fmtSecs = (s) => (Number.isInteger(s) ? s : r1(s)) + " s";

export function createPipeline({ store, thumbs, io, getGraph, announce }) {
  const byId = (id, p = store.p) => p.nodes.find((n) => n.id === id);
  const sims = new Map(); // providerId -> { phase: queued|rendering|done, pct, flash, timers }
  const gsync = () => getGraph()?.sync();
  const fps = () => store.p.fps;
  const uniq = (a) => [...new Set(a)];
  const sceneList = (ids, p = store.p) => uniq(ids).map((i) => byId(i, p)).filter((n) => n && n.type === "scene");
  const inScenes = (prov, p = store.p) => { const g = p.edges.filter((e) => e.to === prov.id && e.kind === "gen").map((e) => e.from); return sceneList(g.length ? g : p.edges.filter((e) => e.from === prov.id && e.kind === "result").map((e) => e.to), p); };
  const resultScenes = (prov, p = store.p) => sceneList(p.edges.filter((e) => e.from === prov.id && e.kind === "result").map((e) => e.to), p);
  const providersOf = (chat, p = store.p) => uniq(p.edges.filter((e) => e.from === chat.id && e.kind === "prompt").map((e) => e.to)).map((i) => byId(i, p)).filter((n) => n?.type === "provider");
  const chatsOf = (prov, p = store.p) => uniq(p.edges.filter((e) => e.to === prov.id && e.kind === "prompt").map((e) => e.from)).map((i) => byId(i, p)).filter((n) => n?.type === "chat");
  const secsOf = (scenes) => scenes.reduce((a, s) => a + s.shots.reduce((b, x) => b + x.len, 0), 0) / fps();
  const shown = (n) => n.takes.find((t) => t.id === n.view) || n.takes[n.takes.length - 1] || null;
  const accepted = (n) => n.takes.find((t) => t.review === "accepted") || null;
  const phaseOf = (n) => sims.get(n.id)?.phase === "queued" || sims.get(n.id)?.phase === "rendering" ? sims.get(n.id).phase : n.run.state;
  const busy = (n) => { const ph = sims.get(n.id)?.phase; return ph === "queued" || ph === "rendering"; };
  const setSrc = (img, url) => { if (url) { if (img.getAttribute("src") !== url) img.src = url; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; } };
  const frames = (scenes, max = 6) => { const out = []; for (const sc of scenes) for (const sh of sc.shots) { if (out.length >= max) return out; out.push({ url: thumbs?.get(sc, sh, () => gsync()) || null, sc, sh }); } return out; };
  function filterOf(t) {
    if (!t) return "none";
    const base = { faithful: "contrast(1.18) saturate(1.45) sepia(.15)", repaint: `saturate(1.7) hue-rotate(${(t.seed % 50) - 25}deg) contrast(1.1)`, reprocess: "contrast(1.2) brightness(.96) blur(.5px)", stylize: "sepia(.55) contrast(1.25) saturate(1.3)" }[t.style] || "none";
    return base + (MOOD.test(t.prompt || "") ? " brightness(.8) contrast(1.15)" : "");
  }

  // ---- the mock agent --------------------------------------------------------------------------------
  function plan(text, prov) {
    const res = prov ? resultScenes(prov) : [], m = /scene\s*(\d+)/i.exec(text), num = m ? m[1] : null; let scenes = res, why = "";
    if (num) {
      const rx = new RegExp("^\\s*" + num + "\\b"); scenes = res.filter((s) => rx.test(s.name));
      if (!scenes.length) { const any = store.p.nodes.find((s) => s.type === "scene" && rx.test(s.name)); why = any ? `"${any.name}" is not linked to ${prov.name} by a result edge, so nothing is written back to it.` : `I can not find a scene ${num}.`; }
    }
    return { scenes, num, why, move: MOVE_RX.find(([rx]) => rx.test(text))?.[1] || "", mood: (text.match(MOOD) || [""])[0], newShot: /\b(add|new|extra|insert)\b.*\b(shot|cutaway|insert)\b/i.test(text) };
  }
  const planText = (pl, prov) => {
    const bits = [pl.move && `camera move = ${pl.move}`, pl.mood && `mood note "${pl.mood}"`, pl.newShot && "one extra shot"].filter(Boolean);
    return `Plan (mock): ${pl.scenes.length ? "target " + pl.scenes.map((s) => `"${s.name}"`).join(", ") : "no storyboard target"}${bits.length ? "; apply " + bits.join(", ") : "; no change I can apply"}. ${pl.why ? pl.why + " " : ""}Queuing a SIMULATED job on ${prov.name}.`;
  };

  // ---- run simulation --------------------------------------------------------------------------------
  function start(provId, { prompt = "", by = "manual", chatId = "" } = {}) {
    const n0 = byId(provId); if (!n0 || busy(n0)) return false;
    const s = { phase: "queued", pct: 0, prompt, by, chatId, timers: [] }; sims.set(provId, s);
    store.update(() => { byId(provId).run = { state: "idle", at: "" }; }, "move"); gsync(); announce(`${n0.name}: queued (simulated)`);
    s.timers.push(setTimeout(() => {
      if (!byId(provId)) return stop(provId); s.phase = "rendering"; gsync(); announce(`${byId(provId).name}: rendering (simulated)`);
      const iv = setInterval(() => { if (!byId(provId)) return stop(provId); s.pct = Math.min(1, s.pct + 0.05); paintProgress(provId); if (s.pct >= 1) { clearInterval(iv); finish(provId); } }, 120); s.timers.push(iv);
    }, 800));
    return true;
  }
  function stop(id) { const s = sims.get(id); if (s) { s.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); sims.delete(id); } }
  function finish(provId) {
    const s = sims.get(provId), n0 = byId(provId); if (!s || !n0) return stop(provId);
    const fail = n0.opts.outcome === "fail", at = iso(); let take = null;
    store.update((p) => {
      const n = byId(provId, p), v = Math.max(0, ...n.takes.map((t) => t.v)) + 1, chat = s.chatId && byId(s.chatId, p), pl = plan(s.prompt, n);
      const src = pl.scenes.length ? pl.scenes : inScenes(n, p), secs = r1(Math.min(n.opts.dur, secsOf(src) || n.opts.dur));
      take = { id: uid("t"), v, state: fail ? "failed" : "done", prompt: s.prompt, prompts: chat ? chat.msgs.filter((m) => m.role === "user").slice(-5).map((m) => m.text) : [], by: s.by, at, secs, res: n.opts.res, aspect: n.opts.aspect, seed: n.opts.seed, style: n.opts.style, scenes: src.map((x) => x.id), review: "pending", msg: fail ? "Simulated failure: provider error placeholder (no provider was called)." : "" };
      n.takes.push(take); if (n.takes.length > 60) n.takes.shift(); n.view = take.id; n.run = { state: fail ? "failed" : "done", at };
      let applied = "";
      if (!fail) applied = writeBack(p, n, take, pl);
      if (fail) n.opts.outcome = "ok";
      if (chat) chat.msgs.push({ id: uid("m"), role: "agent", at, take: take.id, text: fail ? `The simulated render failed (v${v}). Nothing was applied. Regenerate to try again.` : `Done (SIMULATED): ${n.name} v${v} is ready for review on the node. ${applied}` });
    }, "all");
    store.commit(); s.phase = "done"; s.flash = true; s.pct = 1; gsync(); announce(`${n0.name}: ${fail ? "failed" : "done"} (simulated)`);
    s.timers.push(setTimeout(() => { stop(provId); gsync(); }, 1800));
  }
  // The mock agent's only edits to the project: a camera-move label (via the normal applyMove), a mood note, an inserted copy of the last shot, and the provenance badge.
  function writeBack(p, n, take, pl) {
    const out = [];
    for (const sc0 of resultScenes(n, p)) {
      if (pl.scenes.length && !pl.scenes.some((x) => x.id === sc0.id)) continue;
      const sc = byId(sc0.id, p), shot = sc.shots[0]; if (!shot) continue;
      const note = [];
      if (pl.move && MOVES.includes(pl.move)) { applyMove(shot, pl.move); note.push(`move ${pl.move}`); }
      if (pl.mood) { shot.notes = (shot.notes ? shot.notes + " " : "") + `[gen v${take.v} mood: ${pl.mood}]`.slice(0, 80); note.push("mood note"); }
      shot.gen = { v: take.v, prompt: take.prompt || "(manual run)", by: n.name, take: take.id, at: take.at, note: note.join(", "), accepted: false };
      if (pl.newShot) { const c = JSON.parse(JSON.stringify(sc.shots[sc.shots.length - 1])); c.id = uid("s"); c.off = c.off + c.len; c.len = Math.min(c.len, 36); c.label = "Generated insert"; c.notes = ""; c.gen = { ...shot.gen, note: "new shot" }; sc.shots.push(c); note.push("new shot"); }
      out.push(`${sc.name}: ${note.join(", ") || "version badge only"}`);
    }
    return out.length ? "Applied (mock) to " + out.join("; ") + "." : "No storyboard node is linked by a result edge, so the take stays on the provider.";
  }
  function setReview(provId, review) {
    const n0 = byId(provId), t0 = n0 && shown(n0); if (!t0 || t0.state !== "done") return;
    store.update((p) => {
      const n = byId(provId, p);
      for (const t of n.takes) { if (t.id === t0.id) t.review = review; else if (review === "accepted" && t.review === "accepted") t.review = "pending"; }
      for (const sc of p.nodes) if (sc.type === "scene") for (const sh of sc.shots) if (sh.gen && n.takes.some((t) => t.id === sh.gen.take)) sh.gen.accepted = sh.gen.take === t0.id && review === "accepted";
    }, "all");
    store.commit(); announce(`${n0.name} v${t0.v} ${review} (local mock state only)`);
  }
  function sendPrompt(chatId, text) {
    text = String(text || "").trim().slice(0, 300); const chat = byId(chatId); if (!chat || !text) return false;
    const targets = providersOf(chat), at = iso();
    store.update(() => { byId(chatId).msgs.push({ id: uid("m"), role: "user", text, at }); }, "move"); store.commit();
    if (!targets.length) { setTimeout(() => { if (!byId(chatId)) return; store.update(() => { byId(chatId).msgs.push({ id: uid("m"), role: "agent", at: iso(), text: "No generation node is connected. Drag from my output port to a provider's prompt port, then send again." }); }, "move"); store.commit(); }, 350); return true; }
    for (const t of targets) { if (busy(t)) continue; start(t.id, { prompt: text, by: "chat", chatId }); setTimeout(() => { const tn = byId(t.id); if (!tn || !byId(chatId)) return; store.update(() => { byId(chatId).msgs.push({ id: uid("m"), role: "agent", at: iso(), text: planText(plan(text, tn), tn) }); }, "move"); }, 450); }
    if (targets.every(busy) && !targets.some((t) => sims.get(t.id)?.prompt === text)) announce("The generation node is busy; wait for it to finish.");
    return true;
  }

  // ---- small widgets ---------------------------------------------------------------------------------
  const tag = (text, cls = "") => el("span", { class: "pv-tag " + cls, text });
  const sel = (n, key, items, onSet) => {
    const s = ctl(el("select", { class: "pv-select pv-sm", "aria-label": key.label }, ...items.map(([v, t]) => el("option", { value: v, text: t }))));
    s.addEventListener("change", () => { onSet(s.value); store.commit(); }); s._get = key.get; return s;
  };
  function bar(c, glyph, badge) { c.append(el("div", { class: "pv-card-bar" }, el("span", { class: "pv-gate-glyph", "aria-hidden": "true", text: glyph }), el("span", { class: "pv-card-title" }), el("span", { class: "pv-badge pv-status", "data-s": "mockup", text: badge || "Mockup" }))); }
  const syncTitle = (c, n) => { const t = c.querySelector(".pv-card-title"); if (t.textContent !== n.name && !c.querySelector(".pv-inline")) t.textContent = n.name; };
  function compare(getNode) {
    const box = ctl(el("div", { class: "pv-cmp", role: "slider", tabindex: "0", "aria-label": "Compare the original previs frame (left) with the simulated provider result (right)", "aria-valuemin": "0", "aria-valuemax": "100" }));
    const after = el("img", { class: "pv-cmp-img", alt: "", draggable: "false" }), top = el("div", { class: "pv-cmp-top" }), before = el("img", { class: "pv-cmp-img", alt: "", draggable: "false" });
    const grip = el("div", { class: "pv-cmp-grip", "aria-hidden": "true" }, el("i")), over = el("div", { class: "pv-cmp-over" });
    top.append(before); box.append(after, top, grip, el("span", { class: "pv-cmp-l pv-cmp-l-a", text: "Original previs" }), el("span", { class: "pv-cmp-l pv-cmp-l-b", text: "SIMULATED result" }), over);
    const set = (v, live) => { v = Math.max(0, Math.min(100, Math.round(v))); const n = getNode(); if (!n) return; store.update(() => { n.cmp = v; }, "move"); paintCmp(box, v); if (!live) store.commit(); };
    box.addEventListener("pointerdown", (e) => { if (box.dataset.on !== "1") return; box.setPointerCapture(e.pointerId); const mv = (ev) => { const r = box.getBoundingClientRect(); set(((ev.clientX - r.left) / r.width) * 100, true); }; mv(e); const up = () => { box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up); store.commit(); }; box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up); });
    box.addEventListener("keydown", (e) => { if (box.dataset.on !== "1") return; const n = getNode(); const d = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : e.key === "Home" ? -100 : e.key === "End" ? 100 : 0; if (d) { e.preventDefault(); set(n.cmp + d, false); } });
    box._p = { after, before, over, grip, top };
    return box;
  }
  function paintCmp(box, v) { const { top, grip } = box._p; top.style.clipPath = `inset(0 ${100 - v}% 0 0)`; grip.style.left = v + "%"; box.setAttribute("aria-valuenow", String(v)); box.setAttribute("aria-valuetext", `${v} percent original previs`); }

  // ---- provider card ---------------------------------------------------------------------------------
  const STYLE_ITEMS = Object.entries(PROVIDER_OPTS.style);
  function providerCard(n, rec, c) {
    const d = PROVIDERS[n.kind], N = () => byId(n.id), u = (rec.ui = {});
    bar(c, "▶");
    const body = el("div", { class: "pv-rich-body" }); c.append(body);
    body.append(el("div", { class: "pv-tags" }, tag("Not connected"), d.key ? tag("Needs your own key") : tag("No key needed"), n.kind === "local" ? tag("Local filter only") : tag("API details unverified")));
    u.inputs = el("div", { class: "pv-tags pv-inputs", "aria-label": "Inputs from connected nodes" }); body.append(u.inputs);
    const set = (k) => (v) => store.update(() => { N().opts[k] = k === "dur" ? +v : v; }, "move");
    u.res = sel(n, { label: "Resolution (assumed values)" }, PROVIDER_OPTS.res.map((v) => [v, v]), set("res"));
    u.dur = sel(n, { label: "Duration in seconds (assumed values)" }, PROVIDER_OPTS.dur.map((v) => [String(v), v + " s"]), set("dur"));
    u.aspect = sel(n, { label: "Aspect ratio" }, PROVIDER_OPTS.aspect.map((v) => [v, v]), set("aspect"));
    u.style = sel(n, { label: "Style / repaint mode" }, STYLE_ITEMS, set("style"));
    u.seed = ctl(el("input", { type: "number", class: "pv-num pv-sm", min: 0, max: 999999999, "aria-label": "Seed" }));
    u.seed.addEventListener("input", () => { if (u.seed.value !== "") store.update(() => { N().opts.seed = Math.max(0, Math.min(999999999, Math.round(+u.seed.value))); }, "move"); }); u.seed.addEventListener("change", () => store.commit());
    u.key = ctl(el("input", { type: "text", class: "pv-text pv-sm", disabled: true, placeholder: d.key ? "API key field disabled: this mockup never accepts a key" : "No key needed for the local stand-in", "aria-label": "API key (disabled in this mockup)", autocomplete: "off" }));
    body.append(el("div", { class: "pv-set3" }, u.res, u.dur, u.aspect), el("div", { class: "pv-set2" }, u.seed, u.style), u.key);
    u.state = el("div", { class: "pv-runrow" }, u.stTag = tag("Idle", "pv-st"), el("div", { class: "pv-prog" }, u.pg = el("i")), u.stTxt = el("span", { class: "pv-runtxt" }));
    body.append(u.state);
    u.cmp = compare(N); u.cmp._p.over.append(u.overTxt = el("span")); body.append(u.cmp);
    u.strip = el("div", { class: "pv-fstrip", "aria-label": "Thumbnail strip of this take (simulated)" }); u.vers = el("div", { class: "pv-vers", role: "group", "aria-label": "Version history" }); body.append(u.strip, u.vers);
    u.meta = el("p", { class: "pv-rmeta" }); u.prov = el("details", { class: "pv-prov" }, el("summary", { class: "pv-card-ctl", text: "Prompt that made this take" }), u.provBody = el("div", { class: "pv-provb" }));
    body.append(u.meta, u.prov);
    const b = (t, fn, cls = "") => ctl(el("button", { class: "pv-btn pv-btn-sm " + cls, type: "button", text: t, onclick: (e) => { e.stopPropagation(); fn(); } }));
    u.run = b("Run (simulated)", () => start(n.id, { prompt: "", by: "manual" }), "pv-btn-primary"); u.acc = b("Accept", () => setReview(n.id, "accepted")); u.rej = b("Reject", () => setReview(n.id, "rejected"));
    u.regen = b("Regenerate", () => { const t = shown(N()); start(n.id, { prompt: t?.prompt || "", by: t?.by || "manual", chatId: t?.by === "chat" ? chatsOf(N())[0]?.id || "" : "" }); });
    u.fail = ctl(el("input", { type: "checkbox", id: "pvf-" + n.id })); u.fail.addEventListener("change", () => { store.update(() => { N().opts.outcome = u.fail.checked ? "fail" : "ok"; }, "move"); store.commit(); });
    body.append(el("div", { class: "pv-btnrow2" }, u.run, u.acc, u.rej, u.regen), el("label", { class: "pv-chk", for: "pvf-" + n.id }, u.fail, el("span", { text: "Simulate a failure on the next run" })));
    body.append(el("p", { class: "pv-local", text: "Mockup: no network, no key, no upload. Results are local filters of the previs frames." }));
  }
  function paintProgress(id) { const rec = getGraph()?.cards.get(id), s = sims.get(id); if (!rec?.ui || !s) return; rec.ui.pg.style.width = Math.round(s.pct * 100) + "%"; if (s.phase === "rendering") { rec.ui.stTxt.textContent = `Rendering ${Math.round(s.pct * 100)}%`; rec.ui.overTxt.textContent = `Rendering ${Math.round(s.pct * 100)}% (simulated)`; } }
  function syncProvider(n, rec) {
    const c = rec.el, u = rec.ui; syncTitle(c, n);
    const ph = phaseOf(n), sim = sims.get(n.id), t = shown(n), ins = inScenes(n), act = busy(n);
    const val = (e, v) => { if (document.activeElement !== e && e.value !== String(v)) e.value = String(v); };
    val(u.res, n.opts.res); val(u.dur, n.opts.dur); val(u.aspect, n.opts.aspect); val(u.style, n.opts.style); val(u.seed, n.opts.seed); u.fail.checked = n.opts.outcome === "fail";
    [u.res, u.dur, u.aspect, u.style, u.seed].forEach((e) => { e.disabled = act; });
    const lines = store.p.script.lines.filter((l) => ins.some((s) => s.id === l.node) && l.status !== "cut").length, refs = ins.reduce((a, s) => a + s.art.nodes.filter((x) => x.type === "other" && x.kind === "reference" && x.img).length, 0);
    const chips = [["Shots", ins.reduce((a, s) => a + s.shots.length, 0)], ["Script", lines], ["Camera", ins.reduce((a, s) => a + s.shots.length, 0)], ["Characters", uniq(ins.flatMap((s) => s.props.cast.map((x) => x.ref))).length], ["Reference image", refs], ["Prompt chat", chatsOf(n).length]];
    const ik = JSON.stringify(chips); if (u.inputs._k !== ik) { u.inputs._k = ik; u.inputs.replaceChildren(el("span", { class: "pv-tag-l", text: "Inputs" }), ...chips.map(([k, v]) => tag(`${k} ${v}`, v ? "" : "is-off"))); }
    u.stTag.textContent = RUN_STATES[ph] + (ph === "done" || ph === "failed" ? "" : ""); u.stTag.dataset.st = ph; c.dataset.run = ph;
    const pct = ph === "failed" ? 0 : sim ? sim.pct : ph === "done" ? 1 : 0; u.pg.style.width = Math.round(pct * 100) + "%";
    u.stTxt.textContent = ph === "queued" ? "Waiting in the (simulated) queue" : ph === "rendering" ? `Rendering ${Math.round(pct * 100)}%` : ph === "failed" ? (t?.msg || "Failed (simulated)") : ph === "done" ? `v${t?.v ?? ""} ready, review it` : "Nothing run yet";
    // media: original frame always; the filtered "result" only for a finished take
    const fr = frames(t && t.scenes.length ? sceneList(t.scenes) : ins, 6), first = fr[0]?.url || null, doneT = t && t.state === "done" && !act;
    const cp = u.cmp._p; setSrc(cp.before, first); setSrc(cp.after, first); cp.after.style.filter = doneT ? filterOf(t) : "none";
    u.cmp.dataset.on = doneT && first ? "1" : "0"; u.cmp.tabIndex = doneT ? 0 : -1; paintCmp(u.cmp, n.cmp); cp.grip.hidden = !doneT; cp.top.hidden = !doneT;
    u.cmp.querySelector(".pv-cmp-l-a").hidden = !doneT; u.cmp.querySelector(".pv-cmp-l-b").hidden = !doneT;
    cp.over.hidden = doneT; if (!doneT) { cp.over.firstChild.textContent = ph === "queued" ? "Queued (simulated)" : ph === "rendering" ? `Rendering ${Math.round(pct * 100)}% (simulated)` : ph === "failed" ? "Failed (simulated)" : first ? "No take yet. Press Run (simulated), or send a prompt from a Prompt chat node." : "Connect a scene to this node's shots input to see its previs frame."; }
    const sk = JSON.stringify([fr.map((f) => f.url ? f.url.length : 0), t?.id, n.takes.map((x) => [x.id, x.review, x.state]), t?.review, act]);
    if (u.strip._k !== sk) {
      u.strip._k = sk;
      u.strip.replaceChildren(...fr.map((f, i) => { const im = el("img", { alt: `Frame ${i + 1} of the take, simulated`, draggable: "false" }); if (f.url) im.src = f.url; if (doneT) im.style.filter = filterOf(t); return im; }));
      u.vers.replaceChildren(el("span", { class: "pv-tag-l", text: "Versions" }), ...(n.takes.length ? n.takes.map((x) => ctl(el("button", { class: "pv-ver", type: "button", "aria-pressed": x.id === (t && t.id) ? "true" : "false", "data-review": x.state === "failed" ? "failed" : x.review, title: `v${x.v}: ${x.state === "failed" ? "failed" : x.review}. ${x.prompt || "manual run"}`, text: `v${x.v}${x.state === "failed" ? " failed" : x.review === "pending" ? "" : " " + x.review}`, onclick: (e) => { e.stopPropagation(); store.update(() => { N_(n.id).view = x.id; }, "move"); store.commit(); } }))) : [el("span", { class: "pv-hint-s", text: "none yet" })]));
      u.provBody.replaceChildren(...(t ? [el("p", { text: t.prompt ? `v${t.v}: "${t.prompt}"` : `v${t.v}: manual run, no prompt` }), ...(t.prompts.length > 1 ? [el("p", { class: "pv-hint-s", text: "Chat history that led here:" }), el("ol", {}, ...t.prompts.map((x) => el("li", { text: x })))] : [])] : [el("p", { class: "pv-hint-s", text: "No take selected." })]));
    }
    u.meta.textContent = t ? `${fmtSecs(t.secs)} · ${t.res} · ${t.aspect} · seed ${t.seed} · ${t.state === "failed" ? "failed" : "take " + t.review}.  Estimate (placeholder): render about ${Math.round(t.secs * 3)} s, cost not known (no price list loaded).` : `Estimate (placeholder): ${n.opts.dur} s clip, about ${n.opts.dur * 3} s render, cost not known.`;
    u.acc.disabled = !doneT || t.review === "accepted"; u.rej.disabled = !doneT || t.review === "rejected"; u.regen.disabled = act || !t; u.run.disabled = act;
    u.acc.textContent = t?.review === "accepted" ? "Accepted" : "Accept"; u.rej.textContent = t?.review === "rejected" ? "Rejected" : "Reject";
  }
  const N_ = (id) => byId(id);

  // ---- chat view (card body and artboard dock share it) ----------------------------------------------
  function chatView(getChat) {
    const root = el("div", { class: "pv-chat" });
    const top = el("div", { class: "pv-chat-top" }), agentCb = ctl(el("input", { type: "checkbox", "aria-label": "Show the Kamiji agent avatar" })), cid = "pvc-" + uid("c");
    agentCb.id = cid; agentCb.addEventListener("change", () => { const c = getChat(); if (c) { store.update(() => { c.agent = agentCb.checked; }, "move"); store.commit(); } });
    const route = el("span", { class: "pv-chat-route" });
    top.append(el("label", { class: "pv-chk", for: cid }, agentCb, el("span", { text: "Kamiji avatar" })), route);
    const list = ctl(el("div", { class: "pv-chat-msgs", role: "log", "aria-live": "polite", "aria-label": "Prompt chat messages (mockup)", tabindex: "0" })); list.addEventListener("wheel", (e) => { if (list.scrollHeight > list.clientHeight) e.stopPropagation(); }, { passive: true });
    const ta = ctl(el("textarea", { class: "pv-text pv-sm", rows: 2, maxlength: 300, placeholder: "make scene 3 moodier, slow push-in", "aria-label": "Prompt for the generation node" }));
    const go = () => { const c = getChat(); if (c && ta.value.trim()) { sendPrompt(c.id, ta.value); ta.value = ""; } };
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
    const send = ctl(el("button", { class: "pv-btn pv-btn-sm pv-btn-primary", type: "button", text: "Send", onclick: (e) => { e.stopPropagation(); go(); } }));
    const ex = ctl(el("button", { class: "pv-chip-s", type: "button", text: "Try: make scene 3 moodier, slow push-in", onclick: (e) => { e.stopPropagation(); ta.value = "make scene 3 moodier, slow push-in"; ta.focus(); } }));
    root.append(top, list, el("div", { class: "pv-chat-in" }, ta, send), ex, el("p", { class: "pv-local", text: "Mockup: the agent is scripted. Nothing is sent anywhere." }));
    root.sync = () => {
      const c = getChat(); if (!c) return;
      if (document.activeElement !== agentCb) agentCb.checked = !!c.agent;
      const pv = providersOf(c), k = JSON.stringify([c.msgs.map((m) => m.id), c.agent]);
      route.textContent = pv.length ? "Prompts go to " + pv.map((p) => `${p.name} (${RUN_STATES[phaseOf(p)].toLowerCase()}${busy(p) ? " " + Math.round(sims.get(p.id).pct * 100) + "%" : ""})`).join(", ") : "Not connected to a generation node";
      if (list._k !== k) {
        list._k = k; const verOf = (id) => { for (const pv of providersOf(c)) { const t = pv.takes.find((x) => x.id === id); if (t) return "v" + t.v; } return ""; };
        list.replaceChildren(...c.msgs.map((m) => el("div", { class: "pv-msg is-" + m.role }, m.role === "agent" && c.agent ? el("span", { class: "pv-av-k", "aria-hidden": "true", text: "K" }) : null,
          el("div", { class: "pv-msg-t" }, el("b", { text: m.role === "user" ? "You" : c.agent ? "Kamiji (mock)" : "Agent (mock)" }), el("span", { text: m.text }), m.take ? el("em", { class: "pv-msg-v", text: "take " + verOf(m.take) }) : null))));
        if (!c.msgs.length) list.append(el("p", { class: "pv-hint-s", text: "No messages yet." })); list.scrollTop = list.scrollHeight;
      }
    };
    return root;
  }
  function chatCard(n, rec, c) { bar(c, "“"); const body = el("div", { class: "pv-rich-body" }), v = chatView(() => byId(n.id)); body.append(v); c.append(body); rec.ui = { v }; }
  function syncChat(n, rec) { syncTitle(rec.el, n); rec.ui.v.sync(); rec.el.dataset.run = getProviderBusy(n) ? "rendering" : "idle"; }
  const getProviderBusy = (chat) => providersOf(chat).some(busy);

  // ---- social / publish card -------------------------------------------------------------------------
  function sourceInfo(n) {
    const e = store.p.edges.find((x) => x.to === n.id), from = e && byId(e.from), cutSecs = r1(store.d.total / fps());
    if (!from) return { ok: false, label: "Not connected", secs: cutSecs, aspect: "16:9", short: 360, scenes: store.d.order.filter((x) => x.type === "scene"), res: "animatic 640x360" };
    if (from.type === "provider") {
      const t = accepted(from), ins = inScenes(from);
      return t ? { ok: true, take: t, prov: from, label: `${from.name} v${t.v}, accepted (SIMULATED)`, secs: t.secs, aspect: t.aspect, short: parseInt(t.res, 10), scenes: sceneList(t.scenes.length ? t.scenes : ins.map((x) => x.id)), res: t.res }
        : { ok: false, prov: from, label: `${from.name}: no accepted take yet`, secs: r1(secsOf(ins) || store.d.total / fps()), aspect: from.opts.aspect, short: parseInt(from.opts.res, 10), scenes: ins, res: from.opts.res };
    }
    const sc = io.scopeOf(n); const nodes = sc ? sc.nodes : []; return { ok: !!sc, label: sc ? sc.label : "Not connected to a scene", secs: r1(secsOf(nodes)), aspect: "16:9", short: 360, scenes: nodes, res: "animatic 640x360", cut: true };
  }
  function checklist(n, si) {
    const d = SOCIAL[n.kind], o = n.social, rows = [], dia = store.p.script.lines.filter((l) => l.kind === "dialogue" && l.status !== "cut").length;
    const add = (ok, text) => rows.push({ ok, text });
    if (d.audio) add(false, "Audio feed: Previs renders no audio track, so there is nothing to publish.");
    else {
      if (d.max) add(si.secs <= d.max, si.secs <= d.max ? `Length ${fmtSecs(si.secs)} within ${d.max} s (limit unverified)` : `Length ${fmtSecs(si.secs)} is over ${d.max} s by ${fmtSecs(r1(si.secs - d.max))} (limit unverified)`);
      else add(true, `Length ${fmtSecs(si.secs)}; no limit modelled`);
      add(d.aspect === "any" || si.aspect === d.aspect, d.aspect === "any" || si.aspect === d.aspect ? `Aspect ${si.aspect} matches` : `Source is ${si.aspect}, preset wants ${d.aspect}: it would be cropped or letterboxed`);
      const want = d.res === "any" ? 0 : Math.min(...d.res.split("x").map(Number)); add(!want || si.short >= want, !want || si.short >= want ? `Resolution ${si.res} is enough` : `Source ${si.res} is below ${d.res}`);
    }
    add(dia > 0, dia > 0 ? `Caption track: ${dia} dialogue lines as ${o.captions.toUpperCase()}` : "No dialogue lines, so no caption track");
    if (n.kind !== "download") { add(o.title.trim().length > 0 && o.title.length <= 100, o.title.trim() ? (o.title.length <= 100 ? `Title set (${o.title.length}/100, limit unverified)` : "Title is longer than 100 characters (limit unverified)") : "Title is empty"); add(si.scenes.length > 0, si.scenes.length ? `Thumbnail: frame ${o.thumb + 1} selected` : "No frame to use as a thumbnail"); add(o.privacy !== "public", o.privacy === "public" ? "Public is selected, but nothing can be published from this mockup" : `Privacy: ${o.privacy}`); add(false, "Account: Not connected (mockup)"); }
    else add(si.ok, si.ok ? `Poster from ${si.label}` : "No accepted take: the download would use the original previs frame");
    return rows;
  }
  function socialCard(n, rec, c) {
    const d = SOCIAL[n.kind], N = () => byId(n.id), u = (rec.ui = {}), dl = n.kind === "download";
    bar(c, "↗", dl ? "File download" : "Mockup"); const b = c.querySelector(".pv-badge"); if (dl) b.dataset.s = "file";
    const body = el("div", { class: "pv-rich-body" }); c.append(body);
    body.append(el("div", { class: "pv-tags" }, tag(dl ? "Local file" : "Not connected (mockup)"), ...(dl ? [] : [tag("Limits unverified")])));
    u.preset = el("div", { class: "pv-preset" }, ...(dl ? [el("span", { text: "PNG poster of the accepted take, made in your browser" })] : [el("span", {}, el("b", { text: "Aspect " }), d.aspect), el("span", {}, el("b", { text: "Max " }), d.max ? d.max + " s" : "none modelled"), el("span", {}, el("b", { text: "Res " }), d.res)]));
    u.src = el("p", { class: "pv-src" }); body.append(u.preset, u.src);
    const fld = (key, tagName, attrs, label) => { const f = ctl(el(tagName, { class: "pv-text pv-sm", "aria-label": label, ...attrs })); f.addEventListener("input", () => store.update(() => { N().social[key] = f.value; }, "move")); f.addEventListener("change", () => store.commit()); f._k = key; return f; };
    if (!dl) {
      u.title = fld("title", "input", { type: "text", maxlength: 150, placeholder: "Title" }, "Title"); u.desc = fld("desc", "textarea", { rows: 2, maxlength: 1000, placeholder: "Description" }, "Description"); u.tags = fld("tags", "input", { type: "text", maxlength: 200, placeholder: "Tags, comma separated" }, "Tags");
      u.priv = ctl(el("select", { class: "pv-select pv-sm", "aria-label": "Privacy" }, ...[["private", "Private"], ["unlisted", "Unlisted"], ["public", "Public"]].map(([v, t]) => el("option", { value: v, text: t })))); u.priv.addEventListener("change", () => { store.update(() => { N().social.privacy = u.priv.value; }, "move"); store.commit(); });
      body.append(u.title, u.desc, u.tags);
    }
    u.thumbs = el("div", { class: "pv-thumbpick", role: "group", "aria-label": "Pick the thumbnail frame" }); body.append(el("div", { class: "pv-tp-row" }, el("span", { class: "pv-tag-l", text: "Thumbnail" }), u.thumbs));
    if (!dl) {
      u.cap = ctl(el("select", { class: "pv-select pv-sm", "aria-label": "Caption track format" }, el("option", { value: "srt", text: "SRT" }), el("option", { value: "vtt", text: "WebVTT" }))); u.cap.addEventListener("change", () => { store.update(() => { N().social.captions = u.cap.value; }, "move"); store.commit(); });
      u.capBtn = ctl(el("button", { class: "pv-btn pv-btn-sm", type: "button", text: "Download captions", title: "Real download from the Subtitles layer", onclick: (e) => { e.stopPropagation(); io.captions(N().social.captions); } }));
      body.append(el("div", { class: "pv-set2b" }, el("label", { class: "pv-lbl-s" }, "Captions ", u.cap), u.capBtn), el("label", { class: "pv-lbl-s" }, "Privacy ", u.priv));
    }
    u.list = el("ul", { class: "pv-checks", "aria-label": "Platform constraints" }); body.append(u.list);
    if (dl) { u.go = ctl(el("button", { class: "pv-btn pv-btn-sm pv-btn-primary", type: "button", text: "Download poster PNG", onclick: (e) => { e.stopPropagation(); downloadPoster(N()); } })); body.append(u.go); }
    else { u.conn = ctl(el("button", { class: "pv-btn pv-btn-sm", type: "button", disabled: true, text: "Connect account" })); body.append(el("div", { class: "pv-conn" }, u.conn, el("span", { class: "pv-hint-s", text: "Not connected (mockup). Publishing is disabled; nothing is uploaded." }))); }
    body.append(el("p", { class: "pv-local", text: dl ? "Runs in your browser." : "Mockup: the checklist is computed from your cut; the limits are assumptions." }));
  }
  function syncSocial(n, rec) {
    const c = rec.el, u = rec.ui, d = SOCIAL[n.kind], o = n.social, si = sourceInfo(n), dl = n.kind === "download"; syncTitle(c, n);
    u.src.textContent = "Source: " + si.label + ` · ${fmtSecs(si.secs)}`;
    const v = (e, x) => { if (e && document.activeElement !== e && e.value !== x) e.value = x; }; if (!dl) { v(u.title, o.title); v(u.desc, o.desc); v(u.tags, o.tags); v(u.priv, o.privacy); v(u.cap, o.captions); }
    const fr = frames(si.scenes, 4), tk = si.take, tkey = JSON.stringify([fr.map((f) => f.url ? f.url.length : 0), o.thumb, tk?.id]);
    if (u.thumbs._k !== tkey) {
      u.thumbs._k = tkey;
      const pick = (f, i) => { const im = el("img", { alt: "", draggable: "false" }); if (f.url) im.src = f.url; if (tk) im.style.filter = filterOf(tk);
        return ctl(el("button", { class: "pv-tp", type: "button", "aria-pressed": i === o.thumb ? "true" : "false", "aria-label": `Thumbnail frame ${i + 1}`, onclick: (e) => { e.stopPropagation(); store.update(() => { byId(n.id).social.thumb = i; }, "move"); store.commit(); } }, im)); };
      u.thumbs.replaceChildren(...(fr.length ? fr.map(pick) : [el("span", { class: "pv-hint-s", text: "No frames" })]));
    }
    const rows = checklist(n, si), pass = rows.filter((r) => r.ok).length, key = JSON.stringify(rows);
    if (u.list._k !== key) { u.list._k = key; u.list.replaceChildren(el("li", { class: "pv-checks-h", text: `Checklist: ${pass} pass · ${rows.length - pass} warn (computed from the ${si.cut ? "cut" : "source"})` }), ...rows.map((r) => el("li", { "data-ok": r.ok ? "1" : "0" }, el("b", { text: r.ok ? "pass" : "warn" }), " " + r.text))); }
    c.dataset.warn = String(rows.length - pass);
  }
  async function downloadPoster(n) {
    const si = sourceInfo(n), f = frames(si.scenes, 1)[0], url = f?.url; if (!url) { announce("No frame available to download yet."); return; }
    const img = new Image(); img.src = url; await img.decode().catch(() => {});
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d"); if (si.take) g.filter = filterOf(si.take);
    g.drawImage(img, 0, 0, 640, 360); g.filter = "none"; g.fillStyle = "rgba(29,29,27,.85)"; g.fillRect(0, 336, 640, 24); g.fillStyle = "#fff"; g.font = "12px monospace"; g.fillText(si.take ? `SIMULATED ${si.prov.name} v${si.take.v} (local filter, no provider was called)` : "Original previs frame", 8, 352);
    cv.toBlob((b) => { const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: "previs-poster.png" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); announce("Poster PNG downloaded."); });
  }
  io.social = async (node) => { if (node.kind === "download") { await downloadPoster(node); return true; } announce(`${node.name}: mockup, nothing was published.`); return false; };

  // ---- rules and edges --------------------------------------------------------------------------------
  const isRich = (n) => n.type === "provider" || n.type === "chat" || (n.type === "sink" && !!SOCIAL[n.kind]);
  function canConnect(a, b) {
    if (a.type === "chat") return b.type === "provider" ? { ok: true } : { ok: false, reason: "A prompt chat feeds a generation provider's prompt input." };
    if (b.type === "chat") return { ok: false, reason: "Prompt chat nodes have no input; they start a prompt flow." };
    if (a.type === "provider") return b.type === "scene" || b.type === "sink" ? { ok: true } : { ok: false, reason: "A provider feeds a storyboard scene (result) or an export node." };
    if (b.type === "provider") return a.type === "scene" ? { ok: true } : { ok: false, reason: a.type === "source" ? "Import nodes feed scenes, not providers. Route them through a scene." : "Only scenes (their shots, script and camera) feed a provider's shots input." };
    return null;
  }
  const edgeKind = (a, b) => (a.type === "chat" ? "prompt" : a.type === "provider" ? (b.type === "scene" ? "result" : "export") : b.type === "provider" ? "gen" : null);
  function edgeClass(e) {
    const prov = e.kind === "prompt" || e.kind === "gen" ? e.to : e.kind === "result" || e.kind === "export" ? e.from : null, s = prov && sims.get(prov); if (!s) return "";
    return (e.kind === "prompt" || e.kind === "gen") ? (s.phase === "queued" || s.phase === "rendering" ? "is-pulse" : "") : (s.flash ? "is-pulse" : "");
  }
  const portsOf = (n) => (n.type === "provider" ? { in: [{ id: "in", type: "flow", label: "shots in (script, camera, characters)" }, { id: "prompt", type: "prompt", label: "prompt in" }], out: [{ id: "out", type: "flow", label: "take out" }] } : n.type === "chat" ? { in: [], out: [{ id: "out", type: "prompt", label: "prompt out" }] } : null);
  const portY = (n, side, id) => (n.type === "provider" && id === "prompt" ? 124 : 64);
  function aria(n) {
    if (n.type === "chat") return `Prompt chat node (mockup): ${n.name}, ${n.msgs.length} messages. Prompts flow to ${providersOf(n).map((p) => p.name).join(", ") || "no generation node"}.`;
    if (n.type === "provider") return `Generation provider node (mockup): ${n.name}. ${RUN_STATES[phaseOf(n)]}. ${n.takes.length} takes. Not connected, simulated results only.`;
    return `Publish preset (mockup): ${n.name}. ${SOCIAL[n.kind].note}`;
  }

  // ---- lanes view: Cut -> Provider -> Review -> Export ------------------------------------------------
  function lanes(host) {
    const p = store.p, d = store.d, chip = (id, t, extra = "") => el("button", { class: "pv-lane-chip " + extra, type: "button", onclick: () => { store.select([id]); getGraph().centreOn(byId(id)); }, text: t });
    const provs = p.nodes.filter((n) => n.type === "provider"), sinks = p.nodes.filter((n) => n.type === "sink");
    const col = (title, sub, kids) => el("section", { class: "pv-lane" }, el("h3", { text: title }), el("p", { class: "pv-hint-s", text: sub }), el("div", { class: "pv-lane-b" }, ...(kids.length ? kids : [el("p", { class: "pv-hint-s", text: "Nothing here yet." })])));
    const maxGen = (s) => Math.max(0, ...s.shots.map((x) => x.gen?.v || 0)), accGen = (s) => s.shots.some((x) => x.gen?.accepted);
    host.replaceChildren(el("p", { class: "pv-lanes-note", text: "Pipeline view (MOCKUP): the same nodes as the map, read left to right. Click a chip to select that node on the map." }), el("div", { class: "pv-lanes" },
      col("Cut", `${d.seq.length} shots · ${r1(d.total / fps())} s`, d.order.filter((n) => n.type === "scene").map((s) => chip(s.id, `${s.name}${maxGen(s) ? ` · gen v${maxGen(s)}${accGen(s) ? " ✓" : ""}` : ""}`))),
      col("Provider", "Simulated generation", provs.map((n) => chip(n.id, `${n.name} · ${RUN_STATES[phaseOf(n)]}${busy(n) ? " " + Math.round(sims.get(n.id).pct * 100) + "%" : ""} · ${chatsOf(n).length} chat`, "is-" + phaseOf(n))).concat(p.nodes.filter((n) => n.type === "chat").map((n) => chip(n.id, `${n.name} (${n.msgs.length} msgs)`, "is-chat")))),
      col("Review", "Accept / reject (local state)", provs.flatMap((n) => n.takes.map((t) => chip(n.id, `${n.name} v${t.v} · ${t.state === "failed" ? "failed" : t.review}`, "is-" + (t.state === "failed" ? "failed" : t.review))))),
      col("Export", "Presets and files", sinks.map((n) => { let w = ""; if (SOCIAL[n.kind]) { const rows = checklist(n, sourceInfo(n)); w = ` · ${rows.filter((r) => r.ok).length} pass / ${rows.filter((r) => !r.ok).length} warn`; } return chip(n.id, n.name + w); }))));
  }

  // ---- artboard dock: the same chat, bound to the open scene ------------------------------------------
  function dock(host, getOpen) {
    const root = el("div", { class: "pv-dock", hidden: true }), btn = el("button", { class: "pv-btn pv-btn-sm", type: "button", "aria-expanded": "false", text: "Prompt chat (mockup)" }), panel = el("div", { class: "pv-dock-p", hidden: true });
    const chatFor = () => { const sc = getOpen(); if (!sc) return null; for (const pv of store.p.nodes.filter((x) => x.type === "provider")) if (resultScenes(pv).some((s) => s.id === sc.id)) { const c = chatsOf(pv)[0]; if (c) return c; } return null; };
    const v = chatView(chatFor), note = el("div", { class: "pv-dock-n" }), mk = el("button", { class: "pv-btn pv-btn-sm pv-btn-primary", type: "button", text: "Create chat + Seedance for this scene" }), gens = el("ul", { class: "pv-dock-g" });
    mk.addEventListener("click", () => {
      const sc = getOpen(); if (!sc) return; const ch = { id: uid("n"), type: "chat", kind: "prompt", name: "Prompt chat", x: sc.x - 360, y: sc.y + 280, status: "draft", notes: "", shots: [], agent: true, msgs: [] }, pv = { id: uid("n"), type: "provider", kind: "seedance", name: "Seedance", x: sc.x + 300, y: sc.y + 280, status: "draft", notes: "", shots: [], opts: { res: "720p", dur: 5, aspect: "16:9", seed: 1234, style: "faithful", outcome: "ok" }, run: { state: "idle", at: "" }, takes: [], view: "", cmp: 50 };
      store.update((p) => { p.nodes.push(ch, pv); p.edges.push({ id: uid("e"), from: ch.id, to: pv.id, kind: "prompt" }, { id: uid("e"), from: sc.id, to: pv.id, kind: "gen" }, { id: uid("e"), from: pv.id, to: sc.id, kind: "result" }); }); store.commit(); announce("Created a prompt chat and a Seedance (simulated) node linked to this scene. Undo removes them.");
    });
    btn.addEventListener("click", () => { panel.hidden = !panel.hidden; btn.setAttribute("aria-expanded", String(!panel.hidden)); api.sync(); });
    panel.append(el("p", { class: "pv-dock-h", text: "MOCKUP: prompts go to the generation node linked to this scene." }), note, v, mk, gens); root.append(btn, panel); host.append(root);
    const api = {
      sync() {
        const sc = getOpen(); root.hidden = !sc; if (!sc || panel.hidden) return;
        const c = chatFor(); v.hidden = !c; mk.hidden = !!c; note.textContent = c ? "" : "No prompt chat is linked to this scene yet.";
        if (c) v.sync();
        gens.replaceChildren(...sc.shots.filter((s) => s.gen).map((s) => el("li", {}, el("b", { text: `Shot ${sc.shots.indexOf(s) + 1}: gen v${s.gen.v}${s.gen.accepted ? " accepted" : ""}` }), " " + (s.gen.prompt ? `"${s.gen.prompt}"` : "manual run"))));
      },
    };
    return api;
  }

  return { isRich, makeCard(n, rec, c) { (n.type === "provider" ? providerCard : n.type === "chat" ? chatCard : socialCard)(n, rec, c); }, syncCard(n, rec) { (n.type === "provider" ? syncProvider : n.type === "chat" ? syncChat : syncSocial)(n, rec); },
    aria, canConnect, edgeKind, edgeClass, portsOf, portY, lanes, dock, sendPrompt, start, setReview, sims, checklist, sourceInfo, plan, stopAll() { [...sims.keys()].forEach(stop); } };
}
