// Team card for the chat demo: the example subagent hierarchy from docs/agent-hierarchy/hierarchy.json as an expandable tree
// (role=tree), a 29-event timeline player (play, pause, step, speed, scrubber) and an event log.
// Everything shown is data from that file; "stated" and "inferred" are the file's own marks. Nothing here runs agents.
const DATA_URL = "../docs/agent-hierarchy/hierarchy.json";
let dataP = null;
export const loadHierarchy = () => (dataP ||= fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }));

const VERB = { Planning: "working", Reading: "working", Writing: "working", Building: "working", Reviewing: "working", Checking: "verifying", Rejected: "rejected", Done: "done", Landed: "done" };
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const mono = (n) => n.name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || n.name[0];

/** state of every node after events[0..upto) */
export function stateAt(data, upto) {
  const st = Object.fromEntries(data.nodes.map((n) => [n.id, "queued"]));
  const kids = (id) => data.nodes.filter((n) => n.parent === id);
  data.example_run.events.slice(0, upto).forEach((e) => {
    st[e.node] = e.event === "retry" ? "retry" : VERB[e.status] || "working";
    if (e.event === "retry") st[e.node] = "retry";
    if (kids(e.node).length) kids(e.node).forEach((c) => { if (st[c.id] === "queued" && e.text.includes(c.name)) st[c.id] = VERB[e.status] || "working"; });
  });
  data.nodes.filter((n) => kids(n.id).length && n.parent).forEach((n) => { if (st[n.id] === "working" && kids(n.id).every((c) => st[c.id] === "done")) st[n.id] = "done"; });
  return st;
}

export function buildTeam({ onEvent, reduced, onSpawn } = {}) {
  const root = el("div", "kteam");
  root.innerHTML = '<p class="kteam-load">Loading the example hierarchy…</p>';
  loadHierarchy().then((data) => mount(data), () => { root.innerHTML = '<p class="kteam-load">The hierarchy file (docs/agent-hierarchy/hierarchy.json) could not be loaded here.</p>'; });

  function mount(data) {
    const events = data.example_run.events, nodes = data.nodes, byId = new Map(nodes.map((n) => [n.id, n]));
    const kids = (id) => nodes.filter((n) => n.parent === id);
    let at = reduced ? events.length : 0, timer = 0, playing = false, speed = 2, openId = null, sel = null;
    const expanded = new Set(reduced ? nodes.map((n) => n.id) : ["orch"]);
    root.textContent = "";
    root.innerHTML = `
      <p class="kteam-note"><b>Scripted demo, no real agents are running.</b> Illustrative run "${data.example_run.name}": timings and outcomes are invented. Solid ring = stated in the project docs, dashed ring = inferred (the Lead level is inferred for Kamiji).</p>
      <div class="kteam-bar" role="group" aria-label="Timeline controls">
        <button type="button" class="kteam-b" data-a="play">Play</button><button type="button" class="kteam-b" data-a="step">Step</button><button type="button" class="kteam-b" data-a="reset">Reset</button>
        <label class="kteam-sp">Speed <select data-a="speed"><option value="1">1x</option><option value="2" selected>2x</option><option value="4">4x</option></select></label>
      </div>
      <div class="kteam-scrub"><input type="range" min="0" max="${events.length}" value="${at}" aria-label="Timeline position"><output></output></div>
      <ul class="kteam-tree" role="tree" aria-label="Agent hierarchy"></ul>
      <p class="kteam-hint" role="status"></p>
      <ol class="kteam-log" aria-label="Event log"></ol>
      <details class="kteam-why"><summary>Why this shape</summary><ul><li>Gate first: a fresh verifier re-runs the checks; the author never certifies its own work.</li><li>Handoffs are files, not transcripts: no conversation history crosses to a worker.</li><li>One card per worker, one owner per file.</li><li>After a rejection: retry once at the same tier, escalate one tier after two failures.</li></ul><p class="kteam-src">Sources: docs/agent-hierarchy/ (README, ROLE-NAMES, SOURCES, hierarchy.json).</p></details>
      <div class="kteam-pop" role="dialog" aria-label="Role details" hidden></div>`;
    const $ = (s) => root.querySelector(s), tree = $(".kteam-tree"), log = $(".kteam-log"), range = $(".kteam-scrub input"), out = $(".kteam-scrub output"), hint = $(".kteam-hint"), pop = $(".kteam-pop"), playBtn = $('[data-a="play"]');

    function chip(s) { const c = el("span", "kteam-chip s-" + s, s); return c; }
    function render() {
      const st = stateAt(data, at); tree.textContent = "";
      const visible = [];
      const add = (n, level, ul) => {
        const li = el("li"); li.setAttribute("role", "treeitem"); li.dataset.id = n.id; li.setAttribute("aria-level", String(level));
        const hasKids = kids(n.id).length > 0, open = expanded.has(n.id);
        if (hasKids) li.setAttribute("aria-expanded", String(open));
        li.setAttribute("aria-selected", String(sel === n.id)); li.tabIndex = (sel || "orch") === n.id ? 0 : -1;
        li.setAttribute("aria-label", `${n.name}, ${n.status === "stated" ? "stated" : "inferred"}, ${st[n.id]}`);
        const row = el("div", "kteam-row s-" + st[n.id]);
        const g = el("span", "kteam-glyph " + n.status, mono(n)); g.setAttribute("aria-hidden", "true");
        const nm = el("span", "kteam-name", n.name);
        row.append(g, nm, chip(st[n.id]));
        if (hasKids) { const t = el("button", "kteam-tw", open ? "−" : "+"); t.type = "button"; t.tabIndex = -1; t.setAttribute("aria-hidden", "true"); t.addEventListener("click", (e) => { e.stopPropagation(); toggle(n.id); }); row.prepend(t); }
        li.append(row);
        row.addEventListener("click", () => { sel = n.id; openPop(n); render(); });
        visible.push(li);
        if (hasKids && open) { const g2 = el("ul"); g2.setAttribute("role", "group"); kids(n.id).forEach((c) => add(c, level + 1, g2)); li.append(g2); }
        ul.append(li);
      };
      add(byId.get("orch"), 1, tree);
      range.value = at; const ev = events[at - 1]; out.textContent = at ? `${at}/${events.length} · t+${ev.t_min} min` : `0/${events.length}`;
      playBtn.textContent = playing ? "Pause" : at >= events.length ? "Replay" : "Play";
      if (reduced) playBtn.hidden = true;
    }
    function toggle(id) { expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); }
    function openPop(n) {
      const list = (a) => (a || []).map((x) => `<li>${x.replace(/</g, "&lt;")}</li>`).join("");
      pop.innerHTML = `<button type="button" class="kteam-x" aria-label="Close details">×</button><h4>${n.name}</h4><p class="kteam-sub">${n.role} · level ${n.level} · <b>${n.status}</b>${n.model_hint ? " · " + n.model_hint : ""}${n.card ? " · card " + n.card : ""}</p><h5>Responsibilities</h5><ul>${list(n.responsibilities)}</ul><h5>Inputs</h5><ul>${list(n.inputs)}</ul><h5>Outputs</h5><ul>${list(n.outputs)}</ul><h5>Source</h5><ul class="kteam-src">${list(n.source)}</ul>`;
      pop.hidden = false; pop.querySelector(".kteam-x").focus(); pop.querySelector(".kteam-x").addEventListener("click", closePop);
    }
    function closePop() { pop.hidden = true; tree.querySelector(`[data-id="${sel || "orch"}"]`)?.focus(); }
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closePop(); } });

    function applyEvent(i, announce) {
      const e = events[i], n = byId.get(e.node);
      // a worker spawning opens its lead
      if (n.parent) expanded.add(n.parent);
      at = i + 1; render();
      const li = document.createElement("li"); li.className = "ev-" + e.event + (/reject/i.test(e.text) ? " is-reject" : "");
      li.textContent = `t+${e.t_min}m ${n.name}: ${e.text}`; log.append(li); log.scrollTop = log.scrollHeight;
      if (announce) hint.textContent = li.textContent;
      onEvent?.(e, n);
    }
    function tick() {
      if (at >= events.length) { stop(); return; }
      applyEvent(at, true);
      const next = events[at]; if (!next) { stop(); return; }
      const gap = Math.min(1400, 350 + (next.t_min - events[at - 1].t_min) * 6) / speed;
      timer = setTimeout(tick, gap);
    }
    function play() { if (at >= events.length) { reset(); } playing = true; render(); timer = setTimeout(tick, 400); }
    function stop() { playing = false; clearTimeout(timer); render(); }
    function reset() { stop(); at = 0; log.textContent = ""; hint.textContent = ""; expanded.clear(); expanded.add("orch"); render(); onSpawn?.reset(); }
    function seek(n) { stop(); log.textContent = ""; expanded.clear(); expanded.add("orch"); at = 0; for (let i = 0; i < n; i++) { const e = events[i]; if (byId.get(e.node).parent) expanded.add(byId.get(e.node).parent); at = i + 1; const li = document.createElement("li"); li.textContent = `t+${e.t_min}m ${byId.get(e.node).name}: ${e.text}`; if (/reject/i.test(e.text)) li.className = "is-reject"; log.append(li); } render(); hint.textContent = at ? log.lastChild.textContent : ""; }

    root.querySelector(".kteam-bar").addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "play") (playing ? stop() : play());
      else if (a === "step") { stop(); if (at < events.length) applyEvent(at, true); }
      else if (a === "reset") reset();
    });
    $('[data-a="speed"]').addEventListener("change", (e) => { speed = +e.target.value; });
    range.addEventListener("input", () => seek(+range.value));
    tree.addEventListener("keydown", (e) => {
      const li = e.target.closest("[role=treeitem]"); if (!li) return;
      const items = [...tree.querySelectorAll("[role=treeitem]")], i = items.indexOf(li), n = byId.get(li.dataset.id);
      const go = (t) => { if (t) { items.forEach((x) => (x.tabIndex = -1)); t.tabIndex = 0; t.focus(); sel = t.dataset.id; } };
      if (e.key === "ArrowDown") { e.preventDefault(); go(items[i + 1]); }
      else if (e.key === "ArrowUp") { e.preventDefault(); go(items[i - 1]); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (kids(n.id).length && !expanded.has(n.id)) { expanded.add(n.id); render(); tree.querySelector(`[data-id="${n.id}"]`).focus(); } else go(items[i + 1]); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (kids(n.id).length && expanded.has(n.id)) { expanded.delete(n.id); render(); tree.querySelector(`[data-id="${n.id}"]`).focus(); } else if (n.parent) go(tree.querySelector(`[data-id="${n.parent}"]`)); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel = n.id; openPop(n); }
    });
    if (reduced) { events.forEach((ev, i) => { const li = document.createElement("li"); li.textContent = `t+${ev.t_min}m ${byId.get(ev.node).name}: ${ev.text}`; if (/reject/i.test(ev.text)) li.className = "is-reject"; log.append(li); }); }
    render();
    root.api = { play, stop, reset, get at() { return at; }, get playing() { return playing; } };
    if (!reduced) {
      // Only the copy that is actually shown plays: the log copy normally, the plane-scene copy in the plane style (where it is a chip).
      let vis = true, io = null, started = false;
      const live = () => { const sec = root.closest(".kcd"); if (!sec) return false; return (sec.dataset.style === "plane") === !!root.closest(".kcd-pcard"); };
      const poll = setInterval(() => {
        if (!root.isConnected) { clearInterval(poll); io?.disconnect(); return; }
        const sec = root.closest(".kcd");
        if (sec && !io) { io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0.1 }); io.observe(sec); }
        if (live() && vis && !started) { started = true; play(); }
        else if ((!live() || !vis) && playing) { stop(); started = false; }
      }, 400);
    }
  }
  return root;
}
