// Arco docs: renders nav + one doc section per component from assets/docs-data.js,
// then lazy-loads the React preview bundle (assets/arco-ui.js) after first paint.
import DATA from "./assets/docs-data.js";

const { meta, components } = DATA;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const code = (t) => el("code", { text: t });

$("#kit-ver").textContent = meta.kitVersion;
$("#plan-status").textContent = meta.planStatus;
$("#count-all").textContent = `(${components.length})`;

const statusBadge = (c) => el("span", { class: "badge " + (c.status === "available" ? "ok" : "proto"), title: c.statusNote, text: c.status });

// ---------- sections ----------
const content = $("#content");
content.textContent = "";
const sectionsById = new Map();
const previews = [];

function propsTable(t) {
  if (!t.fields.length && t.alias) return el("p", { class: "check" }, code(t.name), " = ", code(t.alias));
  const rows = t.fields.map((f) => el("tr", {}, el("td", {}, code(f.name), f.optional ? "" : el("span", { class: "req", text: " req" })), el("td", {}, code(f.type)), el("td", { text: f.doc || "" })));
  const cap = el("caption", {}, code(t.name), t.extends ? ` extends ${t.extends}` : "", t.alias ? [" = ", code(t.alias)] : "", t.doc ? ` — ${t.doc}` : "");
  const table = el("table", {}, cap, el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Prop" }), el("th", { scope: "col", text: "Type" }), el("th", { scope: "col", text: "Note (from source comments)" }))), el("tbody", {}, rows));
  return el("div", { class: "tbl", tabindex: "0", role: "region", "aria-label": `${t.name} props` }, table);
}

function codeBox(text, label) {
  const pre = el("pre", { tabindex: "0", "aria-label": label }, el("code", { text }));
  const btn = el("button", { type: "button", class: "copy", "aria-label": `Copy ${label}` }, "Copy");
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand?.("copy"); s.removeAllRanges(); }
    btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 1400);
  });
  return el("div", { class: "codebox" }, btn, pre);
}

function blockSnippet(c, json) {
  return `import { GeneratedSurface } from "longformer-ui";\n\nconst schema = {\n  id: "surface-1",\n  blocks: [\n${JSON.stringify(json, null, 2).replace(/^/gm, "    ")}\n  ],\n};\n\nexport const Demo = () => <GeneratedSurface schema={schema} />;`;
}

function build(c) {
  const sec = el("section", { class: "comp", id: c.id, "aria-labelledby": c.id + "-h", "data-status": c.status, "data-search": [c.name, c.type, c.description, c.category, c.status, c.kind].join(" ").toLowerCase() });
  const h2 = el("h2", { id: c.id + "-h", tabindex: "-1" }, c.name, statusBadge(c), el("span", { class: "badge", text: c.version }), el("a", { class: "anchor", href: "#" + c.id, "aria-label": `Link to ${c.name}`, text: "#" }));
  sec.append(h2, el("p", { class: "tagline" }, c.kind === "block" ? ["Block ", code(c.type), " · family ", code(c.family)] : ["Primitive ", code(c.type)], ` · ${meta.categories.find((x) => x.id === c.category).label}`), el("p", { class: "desc", text: c.description }));

  // preview
  sec.append(el("h3", { text: "Preview" }));
  const items = c.kind === "block" ? c.examples.map((e, i) => ({ label: c.examples.length > 1 ? `Example ${i + 1}` : "Example", ex: e })) : c.variants.map(([id, label]) => ({ label, variant: id }));
  const frame = el("div", { class: "frame", "aria-label": `${c.name} preview` }, el("div", { class: "skel", "aria-hidden": "true" }));
  const state = { i: 0 };
  const jsonHost = el("div");
  const check = el("p", { class: "check" });
  function show(i) {
    state.i = i;
    tabs?.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    const it = items[i];
    if (c.kind === "block") {
      jsonHost.textContent = "";
      jsonHost.append(codeBox(JSON.stringify(it.ex.json, null, 2), `${c.name} example ${i + 1} JSON`));
      const v = it.ex.validation;
      check.textContent = "";
      check.append(v.ok ? el("span", { class: "ok", text: "Valid" }) : el("span", { class: "err", text: "Invalid" }), v.strict ? " against the strict Zod schema (checked at build time)." : " against the envelope check only ({ id, type }); this block has no strict schema yet.", " ", el("span", { text: `Example from ${it.ex.source}.` }));
      usage.textContent = ""; usage.append(codeBox(blockSnippet(c, it.ex.json), `${c.name} usage snippet`));
    }
    if (window.__arco) render();
  }
  function render() {
    const it = items[state.i];
    frame.textContent = "";
    const host = el("div"); frame.append(host);
    try { c.kind === "block" ? window.__arco.renderBlock(host, it.ex.json) : window.__arco.renderPrimitive(host, c.type, it.variant); }
    catch (e) { frame.append(el("p", { class: "err", text: "Preview failed: " + e.message })); }
  }
  let tabs = null;
  if (items.length > 1) {
    tabs = el("div", { class: "vtabs", role: "group", "aria-label": `${c.name} ${c.kind === "block" ? "examples" : "variants"}` });
    items.forEach((it, i) => { const b = el("button", { type: "button", "aria-pressed": String(i === 0), text: it.label }); b.addEventListener("click", () => show(i)); tabs.append(b); });
    sec.append(tabs);
  }
  sec.append(frame, el("p", { class: "frame-note", text: c.kind === "block" ? "Rendered by the real React block, themed with Arco colours." : c.notes }));
  const usage = el("div");

  // props
  sec.append(el("h3", { text: c.kind === "block" ? "Props and schema" : "Props" }));
  if (c.kind === "block") sec.append(el("p", { class: "check", text: c.statusNote + " Types below are the TypeScript definitions in types.ts." }));
  for (const t of c.props) sec.append(propsTable({ name: t.name, extends: t.extends, alias: t.alias, doc: t.doc, fields: t.fields }));
  if (c.zod) sec.append(el("details", {}, el("summary", { text: "Zod schema (registry/schemas.ts)" }), codeBox(c.zod, `${c.name} Zod schema`)));

  if (c.kind === "block") {
    sec.append(el("h3", { text: "Example spec an agent emits" }), check, jsonHost, el("h3", { text: "Usage" }), usage);
  } else {
    sec.append(el("h3", { text: "Usage" }), codeBox(c.snippet, `${c.name} usage snippet`));
  }

  // a11y: only what the source literally contains
  const a = c.a11y; const bits = [];
  if (a) {
    const aria = a.aria.filter((x) => x !== "aria-hidden");
    if (a.roles.length) bits.push("roles: " + a.roles.join(", "));
    if (aria.length) bits.push("attributes: " + aria.join(", "));
    if (a.aria.includes("aria-hidden")) bits.push("decorative parts are marked aria-hidden");
  }
  if (c.a11yDoc) bits.unshift(`source comment: “${c.a11yDoc}”`);
  if (bits.length) sec.append(el("h3", { text: "Accessibility (as found in the source)" }), el("p", { class: "a11y", text: "The component source sets " + bits.join("; ") + "." }));

  sec.append(el("h3", { text: "Source" }), el("ul", { class: "src-list" }, [...c.sources, ...(c.kind === "block" ? ["packages/longformer-demo/src/mock-data/generated.ts (examples)"] : [])].map((s) => el("li", {}, code(s)))), el("p", { class: "frame-note", text: "Owner's UI Experiments workspace, author FraterCCCLXIII. Not a released Arco package." }));

  show(0);
  previews.push({ c, frame, render, state });
  return sec;
}

for (const c of components) { const s = build(c); sectionsById.set(c.id, s); content.append(s); }

// ---------- sidebar ----------
const nav = $("#side-nav");
const links = new Map();
for (const cat of meta.categories) {
  const list = components.filter((c) => c.category === cat.id);
  if (!list.length) continue;
  const g = el("div", { class: "grp", "data-cat": cat.id }, el("h2", { id: "g-" + cat.id, text: cat.label }), el("ul", { "aria-labelledby": "g-" + cat.id }, list.map((c) => {
    const a = el("a", { href: "#" + c.id }, el("span", { text: c.name }), el("span", { class: "dot-s" + (c.status === "available" ? " ok" : ""), text: c.status === "available" ? "avail" : "proto", title: c.status }));
    links.set(c.id, a);
    return el("li", { "data-id": c.id }, a);
  })));
  nav.append(g);
}

// ---------- filter ----------
let status = "all";
const q = $("#q");
function applyFilter() {
  const terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const c of components) {
    const sec = sectionsById.get(c.id);
    const ok = (status === "all" || c.status === status) && terms.every((t) => sec.dataset.search.includes(t));
    sec.hidden = !ok;
    links.get(c.id).parentElement.hidden = !ok;
    if (ok) shown++;
  }
  nav.querySelectorAll(".grp").forEach((g) => (g.hidden = ![...g.querySelectorAll("li")].some((li) => !li.hidden)));
  $("#none").hidden = shown > 0;
  $("#count-all").textContent = shown === components.length ? `(${components.length})` : `(${shown} of ${components.length})`;
}
q.addEventListener("input", applyFilter);
document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
  status = b.dataset.status;
  document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  applyFilter();
}));
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); const s = $("#side"); if (!s.open) s.open = true; q.focus(); }
  if (e.key === "Escape" && document.activeElement === q) { q.value = ""; applyFilter(); }
});

// ---------- disclosure: always open on desktop, collapsible on narrow ----------
const side = $("#side");
const mq = matchMedia("(min-width: 901px)");
const sync = () => { if (mq.matches) side.open = true; else if (!side.dataset.touched) side.open = false; };
side.querySelector("summary").addEventListener("click", () => (side.dataset.touched = "1"));
mq.addEventListener("change", sync); sync();
nav.addEventListener("click", (e) => { if (e.target.closest("a") && !mq.matches) side.open = false; });

// ---------- deep links + scrollspy ----------
function goHash(smooth) {
  const id = decodeURIComponent(location.hash.slice(1));
  const sec = id && sectionsById.get(id);
  if (!sec) return;
  if (sec.hidden) { q.value = ""; status = "all"; applyFilter(); }
  sec.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "instant" });
  sec.querySelector("h2").focus({ preventScroll: true });
  setCurrent(id);
}
function setCurrent(id) { links.forEach((a, k) => (k === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"))); }
addEventListener("hashchange", () => goHash(!matchMedia("(prefers-reduced-motion: reduce)").matches));
const spy = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && !document.activeElement?.closest?.("#side-nav")) setCurrent(e.target.id); }, { rootMargin: "-20% 0px -70% 0px" });
sectionsById.forEach((s) => spy.observe(s));
goHash(false);

// ---------- lazy preview bundle ----------
function loadBundle() {
  const css = el("link", { rel: "stylesheet", href: "assets/arco-ui.css" });
  document.head.append(css);
  import("./assets/arco-ui.js").then((m) => {
    window.__arco = m;
    for (const p of previews) p.render();
    document.documentElement.dataset.previews = "ready";
    // content above the hash target changed height: re-align
    if (location.hash) requestAnimationFrame(() => goHash(false));
  }).catch((e) => { for (const p of previews) p.frame.replaceChildren(el("p", { class: "err", text: "Preview bundle failed to load: " + e.message })); });
}
requestAnimationFrame(() => setTimeout(loadBundle, 0));
