// UI Experiments gallery: left nav (search, category tree with scroll-spy, status and source filters, sort, clear),
// URL-shareable state, a tile grid built from assets/tiles-data.js, and lazy-loaded React preview bundles.
import DATA from "./assets/tiles-data.js";

const { meta, tiles } = DATA;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const code = (t) => el("code", { text: t });
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const STATUSES = ["available", "prototype", "unverified", "planned"];
const SORTS = [["category", "Category (grouped)"], ["name", "Name, A to Z"], ["status", "Status"], ["source", "Source path"]];
const CAT_BLURB = {
  mini: "Small working apps composed only from the kit's components and local state. Each runs in a device frame; open it full size or reset it.",
  shell: "Frames and navigation: the rail, sidebar, top bar and their parts.",
  chat: "The composer, messages, agent blocks and the assistant panels.",
  primitives: "Small controls: buttons, inputs, menus, dialogs, avatars and tokens.",
  cards: "Data-driven card blocks from the generated-UI registry, shown with their example JSON.",
  apps: "Whole app views, wired the way the workspace's own demo wires them.",
  site: "Sections of the Longformer marketing and spec site (parchment palette).",
  output: "Static HTML written by the workspace's Python renderer, in sandboxed frames.",
  overlays: "Hover and floating layers, shown inside a fixed frame.",
  planned: "Named in the workspace's plans but with no source: placeholders, not components.",
};

// ---------- source package / folder facet ----------
function srcGroup(t) {
  const s = t.source;
  if (t.kind === "mini") return "mini apps (this page)";
  if (t.kind === "planned") return "Plan documents (no source)";
  let m;
  if ((m = s.match(/^packages\/longformer-ui\/src\/components\/(primitives|shell|interactions)\//))) return "longformer-ui / " + m[1];
  if (/components\/workspaces\/chat\//.test(s)) return "longformer-ui / chat";
  if (/components\/workspaces\/generated-ui\//.test(s)) return "longformer-ui / generated-ui blocks";
  if (/components\/workspaces\//.test(s)) return "longformer-ui / workspaces";
  if (/^packages\/longformer-ui\//.test(s)) return "longformer-ui / icons, tokens, tones";
  if (/^packages\/longformer-www\//.test(s)) return "longformer-www";
  if (/^packages\/longformer-demo\//.test(s)) return "longformer-demo";
  if (/^proto\//.test(s)) return "proto";
  return "workspace root (Forge page)";
}
for (const t of tiles) t.group = srcGroup(t);
const CAT_IDX = Object.fromEntries(meta.categories.map((c, i) => [c.id, i]));

// ---------- header facts derived from the tile array ----------
const real = tiles.filter((t) => t.kind !== "planned");
$("#kit-ver").textContent = meta.kitVersion;
document.querySelectorAll(".ux-kv").forEach((n) => (n.textContent = meta.kitVersion));
$("#hero-count").textContent = `${tiles.length} entries: ${real.length} real previews (${tiles.filter((t) => t.kind === "mini").length} of them mini apps) and ${tiles.length - real.length} planned placeholders.`;

// ---------- state + URL ----------
const state = { q: "", status: new Set(), src: new Set(), cat: "all", sort: "category" };
(function readURL() {
  const p = new URLSearchParams(location.search);
  state.q = p.get("q") || "";
  (p.get("status") || "").split(",").filter((x) => STATUSES.includes(x)).forEach((x) => state.status.add(x));
  (p.get("src") || "").split("|").filter(Boolean).forEach((x) => state.src.add(x));
  const c = p.get("cat"); if (c && (c === "all" || CAT_IDX[c] != null)) state.cat = c;
  const s = p.get("sort"); if (SORTS.some((x) => x[0] === s)) state.sort = s;
})();
function writeURL() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.status.size) p.set("status", [...state.status].join(","));
  if (state.src.size) p.set("src", [...state.src].join("|"));
  if (state.cat !== "all") p.set("cat", state.cat);
  if (state.sort !== "category") p.set("sort", state.sort);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
}
const filtersActive = () => !!(state.q || state.status.size || state.src.size || state.cat !== "all" || state.sort !== "category");

// ---------- tiles ----------
const statusBadge = (s) => el("span", { class: "badge" + (s === "available" ? "ok" : s === "prototype" ? "proto" : s === "planned" ? "plan" : "unv"), text: s });
function propsBlock(t) {
  if (t.kind === "planned" || t.kind === "iframe" || t.kind === "mini") return null;
  const box = el("div", {});
  if (!t.props || !t.props.length) { box.append(el("p", { class: "ux-why", text: t.noProps ? "This component takes no props." : "No props table could be derived from the source." })); return box; }
  for (const tb of t.props) {
    if (!tb.fields.length && tb.alias) { box.append(el("p", { class: "ux-why" }, code(tb.name), " = ", code(tb.alias))); continue; }
    const cap = el("caption", {}, tb.name, tb.extends ? ` ${tb.extends}` : "", tb.doc ? ` - ${tb.doc}` : "");
    const rows = tb.fields.map((f) => el("tr", {}, el("td", {}, code(f.n), f.o ? "" : el("span", { class: "ux-req", text: "req" })), el("td", {}, code(f.t)), el("td", { text: f.d || "" })));
    const table = el("table", {}, cap, el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Prop" }), el("th", { scope: "col", text: "Type" }), el("th", { scope: "col", text: "Note from source" }))), el("tbody", {}, rows));
    box.append(el("div", { class: "ux-ptbl", tabindex: "0", role: "region", "aria-label": `${tb.name} props` }, table));
  }
  return box;
}
const nodes = new Map();
const nameOf = (id) => (tiles.find((x) => x.id === id) || {}).name || id;
function usedLine(t) {
  const links = t.usedIn.map((id, i) => { const a = el("a", { href: "#t-" + id, text: nameOf(id) }); a.addEventListener("click", (e) => { e.preventDefault(); gotoTile(id); }); return [i ? ", " : "", a]; });
  return el("p", { class: "ux-used" }, el("strong", { text: `Used in ${t.usedIn.length} mini app${t.usedIn.length === 1 ? "" : "s"}: ` }), links);
}
function usesChips(t) {
  const ul = el("ul", { class: "ux-uses", "aria-label": `Kit components used by ${t.name}` });
  for (const u of t.uses) {
    const a = el("a", { class: "ux-chip", href: u.arco || "#t-" + u.tile, text: u.name, ...(u.arco ? { title: "Shown on the Arco components and docs page" } : {}) });
    if (u.tile) a.addEventListener("click", (e) => { e.preventDefault(); gotoTile(u.tile); });
    ul.append(el("li", {}, a));
  }
  return ul;
}
function miniExtras(t) {
  const box = el("div", { class: "ux-mini-x" });
  box.append(el("p", { class: "ux-demo" }, el("strong", { text: "What it demonstrates. " }), t.demonstrates), el("p", { class: "ux-why2", text: `Uses ${t.uses.length} kit components (derived from the file's imports):` }), usesChips(t));
  const reset = el("button", { type: "button", class: "ux-btn", text: "Reset", "aria-label": `Reset ${t.name}` });
  reset.addEventListener("click", () => resetMini(nodes.get(t.id)));
  const open = el("button", { type: "button", class: "ux-btn ux-btn-pri", text: "Open full size", "aria-label": `Open ${t.name} full size` });
  open.addEventListener("click", () => openModal(t, open));
  box.append(el("div", { class: "ux-btnrow" }, open, reset));
  return box;
}
function buildTile(t) {
  const stage = t.stage;
  const planned = t.kind === "planned";
  const pv = el("div", { class: planned ? "ux-pv ux-planned" : "ux-pv" + (stage ? " ux-stage" : "") + (t.kind === "mini" ? ` ux-dev ux-dev-${t.device}` : ""), "data-id": t.id });
  const live = { mounted: false, target: null };
  if (planned) {
    pv.append(el("span", { text: "Planned: no source" }));
  } else if (t.kind === "iframe") {
    const box = el("div", { class: "ux-stage-box" });
    const inner = el("div", { class: "ux-stage-in" });
    const fr = el("iframe", { title: `${t.name} (static preview)`, sandbox: t.id === "out-forge" ? "allow-scripts" : "", width: stage.w, height: stage.h, "data-src": t.src, referrerpolicy: "no-referrer" });
    inner.append(fr); box.append(inner); pv.append(box);
    live.stage = { box, inner, w: stage.w, h: stage.h }; live.frame = fr;
  } else if (stage) {
    const box = el("div", { class: "ux-stage-box" });
    const inner = el("div", { class: "ux-stage-in" + (stage.scroll ? " ux-scrolls" : ""), ...(stage.scroll ? { tabindex: "0", role: "region", "aria-label": `${t.name} scrollable preview` } : {}) });
    box.append(inner); pv.append(box);
    live.stage = { box, inner, w: stage.w, h: stage.h, lastH: 0 }; live.target = inner;
  } else {
    const inner = el("div", { class: "ux-pv-in" });
    pv.append(inner); live.target = inner;
  }
  if (live.target) live.target.append(el("div", { class: "ux-ph", text: "Loading preview" }));
  const extra = t.extraSources && t.extraSources.length ? [" + ", t.extraSources.length, " more"] : "";
  const metaEl = el("div", { class: "ux-meta" },
    el("h3", {}, t.name, statusBadge(t.status)),
    el("p", { class: "ux-src" }, planned ? "Named in " : "Source ", code(t.source), extra),
    el("p", { class: "ux-desc", text: t.desc }),
    t.note ? el("p", { class: "ux-tag-note", text: t.note }) : null,
    t.kind === "mini" ? miniExtras(t) : null,
    t.usedIn && t.usedIn.length ? usedLine(t) : null,
  );
  const use = el("details", { class: "ux-use" }, el("summary", { text: planned || t.kind === "mini" ? "Details" : "Props, usage and details" }));
  use.append(el("p", { class: "ux-why" }, el("strong", { text: t.status + ". " }), t.statusNote || ""));
  if (t.extraSources && t.extraSources.length) use.append(el("p", { class: "ux-why" }, "Also: ", t.extraSources.map((s, i) => [i ? ", " : "", code(s)])));
  const pb = propsBlock(t);
  if (pb) use.append(el("p", { class: "ux-why" }, el("strong", { text: "Props" })), pb);
  if (t.snippet) use.append(el("p", { class: "ux-why" }, el("strong", { text: t.snippetLabel ? "Example" : "Usage" })), el("pre", { tabindex: "0", "aria-label": `${t.name} ${t.snippetLabel ? "example JSON" : "usage snippet"}` }, el("code", { text: t.snippet })));
  if (t.snippetLabel) use.append(el("p", { class: "ux-why", text: t.snippetLabel }));
  const art = el("article", { class: "ux-tile" + (t.wide ? " ux-wide" : "") + (planned ? " ux-is-planned" : ""), id: "t-" + t.id, "data-cat": t.cat, "aria-label": t.name }, pv, metaEl, use);
  nodes.set(t.id, { art, pv, t, live, text: (t.name + " " + t.desc + " " + t.source + " " + t.cat + " " + t.status).toLowerCase() });
  return art;
}
tiles.forEach(buildTile);

// ---------- staging (scale a fixed-size design down to the tile) ----------
function fitStage(n) {
  const s = n.live.stage;
  if (!s || n.art.hidden) return;
  const pcs = getComputedStyle(n.pv);
  const cw = n.pv.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
  if (!cw) return;
  const scale = Math.min(n.maxScale || 1, Math.max(0.5, cw / s.w));
  s.inner.style.width = s.w + "px";
  if (s.h) s.inner.style.height = s.h + "px";
  s.inner.style.transform = scale === 1 ? "none" : `scale(${scale})`;
  let h = s.h;
  if (!h) { const m = s.inner.scrollHeight; if (m > 60) s.lastH = m; h = s.lastH || 300; }
  s.box.style.width = Math.round(s.w * scale) + "px";
  s.box.style.height = Math.round(h * scale) + "px";
  const scrolls = s.w * scale > cw + 1;
  if (scrolls) { n.pv.tabIndex = 0; n.pv.setAttribute("role", "region"); n.pv.setAttribute("aria-label", `${n.t.name} preview, scrolls sideways`); }
  else { n.pv.removeAttribute("tabindex"); n.pv.removeAttribute("role"); n.pv.removeAttribute("aria-label"); }
}
const ro = new ResizeObserver((entries) => { for (const e of entries) { const pv = e.target.classList.contains("ux-pv") ? e.target : e.target.closest(".ux-pv"); const n = pv && nodes.get(pv.dataset.id); if (n) fitStage(n); } });
for (const n of nodes.values()) if (n.live.stage) { ro.observe(n.pv); if (!n.t.stage.h) ro.observe(n.live.stage.inner); fitStage(n); }

// ---------- lazy mounting (per bundle) ----------
const bundles = {};
const strip = new Map();
function loadBundle(name) {
  if (!bundles[name]) {
    document.head.append(el("link", { rel: "stylesheet", href: `assets/uix-${name}.css` }));
    bundles[name] = import(`./assets/uix-${name}.js`);
  }
  return bundles[name];
}
async function mount(n) {
  if (n.live.mounted || n.t.kind === "planned") return;
  n.live.mounted = true;
  if (n.t.kind === "iframe") { if (!n.live.frame.src) n.live.frame.src = n.live.frame.dataset.src; return; }
  try {
    const m = await loadBundle(n.t.bundle);
    if (!n.live.mounted) return;
    n.live.target.textContent = "";
    if (n.t.bundle === "core") m.renderTile(n.live.target, n.t.id, n.t.kind, n.t.blockType);
    else if (n.t.bundle === "miniapps") m.renderMini(n.live.target, n.t.miniId);
    else if (n.t.bundle === "apps") m.renderApp(n.live.target, n.t.kind === "app" ? n.t.wsId : n.t.id, n.t.kind);
    else m.renderSite(n.live.target, n.t.id);
    requestAnimationFrame(() => fitStage(n));
  } catch (err) {
    console.warn("[ui-experiments] preview failed:", n.t.id, err);
    n.live.target.textContent = "";
    n.live.target.append(el("p", { class: "ux-err", role: "alert", text: "This preview could not load." }));
  }
}
async function release(n) {
  // heavy previews are torn down when far off screen so hundreds of tiles do not accumulate
  if (!n.live.mounted || !(n.t.bundle === "apps" || n.t.bundle === "site" || n.t.bundle === "miniapps")) return;
  n.live.mounted = false;
  try { (await bundles[n.t.bundle]).unmountTile(n.live.target); } catch { /* ignore */ }
  n.live.target.textContent = "";
  n.live.target.append(el("div", { class: "ux-ph", text: "Preview paused off screen" }));
}
const ioNear = new IntersectionObserver((es) => { for (const e of es) { const n = nodes.get(e.target.dataset.id) || strip.get(e.target.dataset.id); if (n && e.isIntersecting) mount(n); } }, { rootMargin: "500px 0px" });
const ioFar = new IntersectionObserver((es) => { for (const e of es) { const n = nodes.get(e.target.dataset.id) || strip.get(e.target.dataset.id); if (n && !e.isIntersecting) release(n); } }, { rootMargin: "2500px 0px" });
for (const n of nodes.values()) { ioNear.observe(n.pv); ioFar.observe(n.pv); }

// ---------- filtering, sorting, grouping ----------
const grid = $("#grid");
const passes = (t, skip) => {
  const n = nodes.get(t.id);
  if (skip !== "q" && state.q && !n.text.includes(state.q.toLowerCase())) return false;
  if (skip !== "status" && state.status.size && !state.status.has(t.status)) return false;
  if (skip !== "src" && state.src.size && !state.src.has(t.group)) return false;
  if (skip !== "cat" && state.cat !== "all" && t.cat !== state.cat) return false;
  return true;
};
const cmp = {
  name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || cmp.name(a, b),
  source: (a, b) => a.source.localeCompare(b.source) || cmp.name(a, b),
  category: (a, b) => CAT_IDX[a.cat] - CAT_IDX[b.cat],
};
let layoutKey = "";
function layout() {
  const grouped = state.sort === "category" && state.cat === "all";
  const key = grouped ? "g" : "f:" + state.sort;
  if (key === layoutKey) return;
  layoutKey = key;
  grid.textContent = "";
  if (grouped) {
    for (const c of meta.categories) {
      const list = tiles.filter((t) => t.cat === c.id);
      if (!list.length) continue;
      const g = el("div", { class: "ux-grid" });
      g.append(...list.map((t) => nodes.get(t.id).art));
      grid.append(el("section", { class: "ux-sec", id: "cat-" + c.id, "data-cat": c.id, "aria-labelledby": "h-" + c.id }, el("h2", { id: "h-" + c.id }, c.label, el("span", { class: "nx-n", "data-n": c.id })), el("p", { text: CAT_BLURB[c.id] || "" }), g));
    }
  } else {
    const list = [...tiles].sort(state.sort === "category" ? (a, b) => cmp.category(a, b) || cmp.name(a, b) : cmp[state.sort]);
    const g = el("div", { class: "ux-grid" });
    g.append(...list.map((t) => nodes.get(t.id).art));
    grid.append(g);
  }
  setupSpy();
}

// ---------- the nav ----------
const navBody = $("#ux-nav-body");
const refs = { catRows: {}, statusRows: {}, srcRows: {} };
const qIn = el("input", { class: "nx-search", id: "nx-q", type: "search", placeholder: "Search components", autocomplete: "off", spellcheck: "false" });
qIn.value = state.q;
qIn.addEventListener("input", () => { state.q = qIn.value.trim(); update(); });
const sortSel = el("select", { class: "nx-sort", id: "nx-sort" }, SORTS.map(([v, l]) => el("option", { value: v, text: l })));
sortSel.value = state.sort;
sortSel.addEventListener("change", () => { state.sort = sortSel.value; update(); });
const clearBtn = el("button", { type: "button", class: "nx-clear", text: "Clear filters" });
clearBtn.addEventListener("click", () => { state.q = ""; qIn.value = ""; state.status.clear(); state.src.clear(); state.cat = "all"; state.sort = "category"; sortSel.value = "category"; update(); });

// Previews above the target mount while we travel and change heights, so land, then correct twice.
function jumpTo(sec) {
  const go = () => sec.scrollIntoView({ behavior: "auto", block: "start" });
  go();
  let n = 0;
  const t = setInterval(() => { n++; if (Math.abs(sec.getBoundingClientRect().top - 64) > 6) go(); if (n > 14) clearInterval(t); }, 250);
}
const catList = el("ul", { class: "nx-list" });
function catRow(id, label) {
  const main = el("button", { type: "button", class: "nx-main", "data-cat": id }, el("span", { text: label }), el("span", { class: "nx-n" }));
  main.addEventListener("click", () => {
    if (id === "all") { state.cat = "all"; update(); return; }
    if (state.sort === "category" && state.cat === "all") {
      const sec = document.getElementById("cat-" + id);
      if (sec) { jumpTo(sec); history.replaceState(null, "", location.pathname + location.search + "#cat-" + id); closeDrawer(); }
    } else { state.cat = id; update(); }
  });
  const li = el("li", { class: "nx-row" }, main);
  if (id !== "all") {
    const only = el("button", { type: "button", class: "nx-only", "aria-pressed": "false", "aria-label": `Show only ${label}`, text: "Only" });
    only.addEventListener("click", () => { state.cat = state.cat === id ? "all" : id; update(); });
    li.append(only);
    refs.catRows[id] = { main, only };
  } else refs.catRows.all = { main };
  catList.append(li);
}
catRow("all", "All components");
for (const c of meta.categories) catRow(c.id, c.label);

function checkList(values, set, refKey) {
  const ul = el("ul", { class: "nx-list" });
  for (const v of values) {
    const cb = el("input", { type: "checkbox" });
    cb.checked = set.has(v);
    cb.addEventListener("change", () => { cb.checked ? set.add(v) : set.delete(v); update(); });
    const n = el("span", { class: "nx-n" });
    ul.append(el("li", {}, el("label", { class: "nx-check" }, cb, el("span", { class: "nx-t", text: v }), n)));
    refs[refKey][v] = { cb, n };
  }
  return ul;
}
const groups = [...new Set(tiles.map((t) => t.group))].sort((a, b) => a.localeCompare(b));
navBody.append(
  el("div", {}, el("label", { class: "nx-h", for: "nx-q", text: "Search" }), qIn),
  el("nav", { "aria-label": "Categories" }, el("h3", { class: "nx-h", text: "Categories" }), catList),
  el("div", { role: "group", "aria-labelledby": "nx-hs" }, el("h3", { class: "nx-h", id: "nx-hs", text: "Status" }), checkList(STATUSES, state.status, "statusRows")),
  el("div", { role: "group", "aria-labelledby": "nx-hp" }, el("h3", { class: "nx-h", id: "nx-hp", text: "Source package / folder" }), checkList(groups, state.src, "srcRows")),
  el("div", {}, el("label", { class: "nx-h", for: "nx-sort", text: "Sort" }), sortSel),
  clearBtn,
);

// ---------- apply ----------
function update() {
  layout();
  const shown = tiles.filter((t) => passes(t));
  const shownIds = new Set(shown.map((t) => t.id));
  for (const n of nodes.values()) { const was = n.art.hidden; n.art.hidden = !shownIds.has(n.t.id); if (was && !n.art.hidden) requestAnimationFrame(() => fitStage(n)); }
  for (const sec of grid.querySelectorAll(".ux-sec")) {
    const k = shown.filter((t) => t.cat === sec.dataset.cat).length;
    sec.hidden = k === 0;
    const nn = sec.querySelector("[data-n]"); if (nn) nn.textContent = k;
  }
  // faceted counts: each facet counts tiles that pass every OTHER filter
  const base = (skip) => tiles.filter((t) => passes(t, skip));
  const cats = base("cat"), sts = base("status"), srcs = base("src");
  refs.catRows.all.main.querySelector(".nx-n").textContent = cats.length;
  for (const c of meta.categories) {
    const r = refs.catRows[c.id]; if (!r) continue;
    r.main.querySelector(".nx-n").textContent = cats.filter((t) => t.cat === c.id).length;
    r.only.setAttribute("aria-pressed", String(state.cat === c.id));
    if (state.cat === c.id) r.main.setAttribute("aria-pressed", "true"); else r.main.removeAttribute("aria-pressed");
  }
  if (state.cat === "all") refs.catRows.all.main.setAttribute("aria-pressed", "true"); else refs.catRows.all.main.removeAttribute("aria-pressed");
  for (const s of STATUSES) refs.statusRows[s].n.textContent = sts.filter((t) => t.status === s).length;
  for (const g of groups) refs.srcRows[g].n.textContent = srcs.filter((t) => t.group === g).length;
  for (const [k, r] of Object.entries(refs.statusRows)) r.cb.checked = state.status.has(k);
  for (const [k, r] of Object.entries(refs.srcRows)) r.cb.checked = state.src.has(k);
  qIn.value = state.q;
  const msg = `${shown.length} of ${tiles.length} components`;
  $("#count").textContent = msg; $("#count-bar").textContent = msg;
  const nf = state.status.size + state.src.size + (state.q ? 1 : 0) + (state.cat !== "all" ? 1 : 0);
  $("#nav-badge").textContent = nf ? `(${nf})` : "";
  clearBtn.disabled = !filtersActive();
  $("#none").hidden = shown.length > 0;
  writeURL();
}

// ---------- scroll-spy ----------
let spy = null;
function setupSpy() {
  if (spy) spy.disconnect();
  for (const r of Object.values(refs.catRows)) r.main.removeAttribute("aria-current");
  const secs = [...grid.querySelectorAll(".ux-sec")];
  if (!secs.length) return;
  const visible = new Map();
  spy = new IntersectionObserver((es) => {
    for (const e of es) visible.set(e.target.dataset.cat, e.isIntersecting ? e.boundingClientRect.top : null);
    let best = null;
    for (const [c, top] of visible) if (top != null && (best == null || top > best[1])) best = [c, top];
    for (const [c, r] of Object.entries(refs.catRows)) { if (c === "all") continue; if (best && best[0] === c) r.main.setAttribute("aria-current", "true"); else r.main.removeAttribute("aria-current"); }
  }, { rootMargin: "-10% 0px -60% 0px", threshold: [0, 0.01] });
  secs.forEach((s) => spy.observe(s));
}

// ---------- drawer (below 900px): toggle, focus trap, Esc ----------
const nav = $("#ux-nav"), toggle = $("#nav-toggle"), scrim = $("#ux-scrim");
const mq = matchMedia("(max-width: 899px)");
const outside = () => [$("#ux-main"), $(".uix-head"), $("#sources"), ...document.querySelectorAll("footer, #contact, .site-header, .sx")].filter(Boolean);
let lastFocus = null;
function focusables() { return [...nav.querySelectorAll('button:not([disabled]), input, select, a[href]')].filter((e) => e.offsetParent !== null); }
function openDrawer() {
  if (!mq.matches) return;
  lastFocus = document.activeElement;
  nav.classList.add("ux-open"); scrim.hidden = false; toggle.setAttribute("aria-expanded", "true");
  nav.setAttribute("role", "dialog"); nav.setAttribute("aria-modal", "true"); nav.setAttribute("aria-label", "Browse and filter components");
  outside().forEach((n) => n.setAttribute("inert", ""));
  setTimeout(() => (focusables()[0] || nav).focus(), 30);
}
function closeDrawer() {
  if (!nav.classList.contains("ux-open")) return;
  nav.classList.remove("ux-open"); scrim.hidden = true; toggle.setAttribute("aria-expanded", "false");
  nav.removeAttribute("role"); nav.removeAttribute("aria-modal");
  outside().forEach((n) => n.removeAttribute("inert"));
  (lastFocus && lastFocus.focus ? lastFocus : toggle).focus();
}
toggle.addEventListener("click", () => (nav.classList.contains("ux-open") ? closeDrawer() : openDrawer()));
$("#nav-close").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);
nav.addEventListener("keydown", (e) => {
  if (!nav.classList.contains("ux-open")) return;
  if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
  if (e.key !== "Tab") return;
  const f = focusables(); if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
mq.addEventListener("change", () => { if (!mq.matches) closeDrawer(); });

// ---------- sources / skipped / unverified (counts derived from the tile array) ----------
const cnt = (f) => tiles.filter(f).length;
const SHOWN = [
  ["Mini apps", `${cnt((t) => t.kind === "mini")} small working apps written for this page, in `, "site/ui-experiments/build/mini", ", using only the kit's components plus local state (no network, nothing saved). The components each one uses are derived from its imports."],
  ["Primitives, shell, chat and card blocks", `${cnt((t) => t.group.startsWith("longformer-ui") && t.kind !== "app" && t.kind !== "overlay" && t.kind !== "planned" && t.kind !== "mini")} tiles from `, "packages/longformer-ui/src", `, the kit (v${meta.kitVersion}). Card blocks use example data from the workspace's own mock data.`],
  ["App views and overlays", `${cnt((t) => t.kind === "app" || t.kind === "overlay")} tiles: every layout in the demo's workspace registry plus hover overlays and chat panels, built from the demo's own state slices (`, "packages/longformer-demo/src", "), inside fixed frames. Network calls in the demo's agent code are stubbed out in this page's copy."],
  ["Site sections", `${cnt((t) => t.kind === "site")} tiles from `, "packages/longformer-www", ", the Longformer site, in its own parchment palette; links go nowhere."],
  ["Generated pages", `${cnt((t) => t.kind === "iframe")} static frames: HTML written by the Python renderer in `, "proto/", " and the root index.html template catalog."],
  ["Planned placeholders", `${cnt((t) => t.kind === "planned")} non-interactive tiles for things the plan documents name but that have no source.`],
  ["Status labels", "come from the workspace's ", "APP-INDEX-AND-LIBRARY-PLAN.md", " (DRAFT v0.1) and the block registry. They describe the workspace, not a shipped release."],
];
$("#shown").append(...SHOWN.map(([a, b, c, d]) => el("li", {}, el("strong", { text: a + ": " }), b, c ? code(c) : "", d || "")));

const SKIPPED = [
  ["reference/ (19 folders)", "Shallow clones of other people's open-source projects, kept by the owner for study. Not the owner's work, so none of it is used."],
  ["node_modules, dist folders, env files, keys", "Installed packages and compiled build output are not sources. No env file, key or token was read or copied (none were needed)."],
  ["longformer-ui-tailwind and longformer-demo-tailwind", "A second, identical-file-set copy of the same kit in Tailwind; the plan says to merge it. Showing both would repeat every tile."],
  ["The blocks and primitives on the Arco docs page", "Already covered there (Button, Badge, Chip, Switch, Input, Tabs and 25 generated-UI blocks). See Arco components and docs."],
  ["Sub-parts inside a workspace (for example calendar grids, sheet cells, bento tiles)", "They render inside their workspace tile and are not separate tiles."],
  ["Demo host glue: App, ConnectApiModal, ElectronTitleBar, router and entry files", "Wiring for the demo app, not components. The desktop shell package (Electron) has no UI components."],
  ["Non-visual code: surface-manager hooks, utils, agent loop, Python renderer, templates", "Nothing to preview; the agent code's network calls are disabled here."],
  ["proto/capabilities.db, download prototype.zip, __pycache__, proto index page", "A database, an archive, bytecode and a links page of unclear provenance or no preview value. Not opened or copied."],
  ["Planning and spec documents, Vercel and CI config", "Read only to set status labels and the planned tiles."],
];
const CLAIMS = [
  "The mini apps are samples written for this page, not part of the workspace. Their timers, players and bots are simulated: no audio plays, no model runs, nothing is sent or stored. They were checked with scripted clicks and an automated accessibility scan, not with a screen reader.",
  "Status labels follow the workspace's own draft plan and registry. The plan is DRAFT v0.1, and nothing here is a shipped Arco or Longformer release.",
  "emoji-data.ts is bundled with the composer's emoji picker and was used as is. Its provenance is unclear and its contents were not reviewed.",
  "Accessibility: this page was checked for keyboard use, focus order and phone width. The individual components were not audited with a screen reader, so treat their accessibility as unverified.",
  `Sample data: names, numbers and messages come from the workspace's mock data or were written for this page. ${meta.brandReplacements} real company and product names in the page's own copy of that data were replaced with neutral placeholders; some names may remain inside component source text (for example labels in the group-chat and social views) and in the site sections' copy. No logos are used.`,
  "Interactions inside app tiles use the demo's in-memory state: nothing is sent, played or called, and chat replies use the demo's offline path, so they may show its error text.",
  "The generated-page frames are saved output of a Python renderer. We did not re-run it or check which model, if any, picked the templates.",
  "The Forge template catalog's template names and links are its own sample content; links are disabled here and brand names were replaced where they appeared.",
  "The Longformer site sections use system fonts here instead of their intended web fonts, so spacing can differ slightly from the original.",
  "Previews wider than the tile are scaled down (and scroll sideways inside the tile on phones); the originals are laid out for larger screens.",
  "Planned tiles are placeholders taken from the workspace's own documents; none of those items was checked beyond the absence of a source file.",
];
$("#skipped").append(...SKIPPED.map(([a, b]) => el("li", {}, el("strong", { text: a + ". " }), b)));
$("#claims").append(...CLAIMS.map((c) => el("li", { text: c })));


// ---------- mini apps: featured strip, full-size modal, reset, go-to-tile ----------
const minis = tiles.filter((t) => t.kind === "mini");
$("#mini-count").textContent = `${minis.length} mini apps:`;
function gotoTile(id) {
  if (filtersActive()) { state.q = ""; qIn.value = ""; state.status.clear(); state.src.clear(); state.cat = "all"; state.sort = "category"; sortSel.value = "category"; update(); }
  const a = document.getElementById("t-" + id); const n = nodes.get(id);
  if (!a) return;
  if (n) mount(n);
  history.replaceState(null, "", location.pathname + location.search + "#t-" + id);
  closeModal(); closeDrawer(); jumpTo(a);
}
async function resetMini(n) {
  if (!n) return;
  const m = await loadBundle("miniapps");
  m.unmountTile(n.live.target); n.live.target.textContent = ""; n.live.mounted = false;
  await mount(n);
}
const DEV = { phone: [10, 10, 10], tablet: [12, 12, 12], desktop: [0, 26, 0] }; // side, top, bottom padding of the frame
const stripEl = $("#strip");
for (const t of minis.filter((m) => m.featured)) {
  const key = "strip-" + t.id;
  const [px, pt, pb] = DEV[t.device];
  const fw = t.stage.w + px * 2, fh = t.stage.h + pt + pb;
  const area = el("div", { class: "ux-sp", "data-id": key, "aria-hidden": "true" });
  area.setAttribute("inert", "");
  const frame = el("div", { class: `ux-dev ux-dev-${t.device} ux-sp-frame`, style: `width:${fw}px;height:${fh}px` });
  const screen = el("div", { class: "ux-sp-screen", style: `width:${t.stage.w}px;height:${t.stage.h}px` });
  screen.append(el("div", { class: "ux-ph", text: "Loading preview" }));
  frame.append(screen); area.append(frame);
  const open = el("button", { type: "button", class: "ux-btn ux-btn-pri", text: "Open full size", "aria-label": `Open ${t.name} full size` });
  open.addEventListener("click", () => openModal(t, open));
  const det = el("a", { class: "ux-btn", href: "#t-" + t.id, text: "Details", "aria-label": `Details of ${t.name}` });
  det.addEventListener("click", (e) => { e.preventDefault(); gotoTile(t.id); });
  stripEl.append(el("article", { class: "ux-card", "aria-label": t.name }, area, el("h3", { text: t.name }), el("p", { text: t.desc }), el("div", { class: "ux-btnrow" }, open, det)));
  const node = { t, pv: area, live: { mounted: false, target: screen }, frameEl: frame, fw, fh };
  strip.set(key, node);
  ioNear.observe(area); ioFar.observe(area);
  new ResizeObserver(() => {
    const aw = area.clientWidth, ah = area.clientHeight; if (!aw) return;
    const sc = Math.min(aw / fw, ah / fh);
    frame.style.transform = `scale(${sc})`; frame.style.left = (aw - fw * sc) / 2 + "px"; frame.style.top = (ah - fh * sc) / 2 + "px";
  }).observe(area);
}

const modal = $("#mini-modal"), mBody = $("#mini-modal-body"), mClose = $("#mini-modal-close");
let mNode = null, mFocus = null;
const mBackground = () => [...document.body.children].filter((c) => c !== modal && c.id !== "lf-portal-root" && c.tagName !== "SCRIPT");
async function openModal(t, opener) {
  closeModal(true);
  mFocus = opener || document.activeElement;
  $("#mini-modal-title").textContent = `${t.name} (full size)`;
  mBody.textContent = "";
  const pv = el("div", { class: `ux-pv ux-stage ux-dev ux-dev-${t.device}`, "data-id": "modal" });
  const box = el("div", { class: "ux-stage-box" }), inner = el("div", { class: "ux-stage-in" });
  box.append(inner); pv.append(box); mBody.append(pv);
  mNode = { t, pv, art: { hidden: false }, live: { stage: { box, inner, w: t.stage.w, h: t.stage.h }, target: inner, mounted: false }, maxScale: 1.25 };
  modal.hidden = false; document.body.style.overflow = "hidden";
  mBackground().forEach((c) => c.setAttribute("inert", ""));
  fitStage(mNode);
  await mount(mNode);
  requestAnimationFrame(() => fitStage(mNode));
  mClose.focus();
}
function closeModal(keep) {
  if (!mNode) return;
  const m = bundles.miniapps; if (m) m.then((x) => x.unmountTile(mNode.live.target)).catch(() => {});
  mNode = null; mBody.textContent = ""; modal.hidden = true; document.body.style.overflow = "";
  mBackground().forEach((c) => c.removeAttribute("inert"));
  if (!keep && mFocus && mFocus.focus) mFocus.focus();
}
mClose.addEventListener("click", () => closeModal());
$("#mini-modal-reset").addEventListener("click", () => resetMini(mNode));
modal.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
  if (e.key !== "Tab") return;
  const f = [...modal.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null && !x.disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
addEventListener("resize", () => { if (mNode) fitStage(mNode); });

// ---------- boot ----------
update();
const h = location.hash;
if (h.startsWith("#t-")) { const a = document.getElementById(h.slice(1)); if (a) { a.hidden = false; const n = nodes.get(h.slice(3)); if (n) mount(n); setTimeout(() => jumpTo(a), 50); } }
else if (h.startsWith("#cat-")) { const a = document.getElementById(h.slice(1)); if (a) setTimeout(() => jumpTo(a), 50); }
