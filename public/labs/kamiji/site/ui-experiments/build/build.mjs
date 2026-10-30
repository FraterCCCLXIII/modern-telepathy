// Reproducible build for the UI Experiments gallery. Run:  node build.mjs   (see ../README.md)
// Env: UIX = path to the owner's "UI Experiments" workspace (read-only), WORK = temp dir with node_modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UIX = process.env.UIX || "/Users/paulbloch/Documents/github/UI Experiments";
const WORK = process.env.WORK || "/private/tmp/claude-501/ui-exp-build";
const OUT = path.resolve(HERE, "../assets");
const req = createRequire(WORK + "/");
const esbuild = req("esbuild");
const T = await import("./tiles.mjs");
const { CATEGORIES, STATIC_TILES, CARD_TYPES, ARCO_TYPES } = T;
const X = await import("./extract.mjs");
const { MINI_APPS } = await import("./mini/meta.mjs");

// ---------- 1. copy sources into WORK (never build inside the owner's workspace) ----------
const SRC = path.join(WORK, "src");
fs.rmSync(SRC, { recursive: true, force: true });
const skip = (s) => !/node_modules|\/dist\b/.test(s);
fs.cpSync(path.join(UIX, "packages/longformer-ui/src"), path.join(SRC, "ui"), { recursive: true, filter: skip });
fs.cpSync(path.join(UIX, "packages/longformer-demo/src"), path.join(SRC, "demo-src"), { recursive: true, filter: skip });
fs.cpSync(path.join(UIX, "packages/longformer-www/src"), path.join(SRC, "www"), { recursive: true, filter: skip });
const themePath = path.join(SRC, "ui/tokens/theme.css");
let theme = fs.readFileSync(themePath, "utf8");
theme = theme.replace(/:root,\n\[data-lf-theme="dark"\]/, '[data-lf-theme="dark"]').replace(/:root,\n\[data-lf-theme\]/, "[data-lf-theme]");
fs.writeFileSync(themePath, theme);
const gcss = fs.readFileSync(path.join(SRC, "www/styles/global.css"), "utf8");
const tokens = gcss.match(/:root\s*{[^}]*}/)[0].replace(":root", ".uix-www");
fs.writeFileSync(path.join(SRC, "www/styles/www-scope.css"), `${tokens}\n.uix-www { background: var(--lf-bg); color: var(--lf-text); font-family: var(--lf-font-sans); -webkit-font-smoothing: antialiased; border-radius: 12px; overflow: hidden; }\n.uix-www, .uix-www * { box-sizing: border-box; }\n.uix-www a { color: inherit; text-decoration: none; }\n.uix-www button { font: inherit; }\n`);

// ---------- 2. patch the page's own COPIES (the workspace is never modified) ----------
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
// 2a. no network from the demo's agent code
for (const f of walk(path.join(SRC, "demo-src/agent")).filter((f) => /\.tsx?$/.test(f))) {
  fs.writeFileSync(f, 'const fetch = (..._a: any[]): Promise<Response> => Promise.reject(new Error("network is disabled in the gallery"));\n' + fs.readFileSync(f, "utf8"));
}
// 2b. neutral placeholders for real company / product names in sample data (capitalised whole words)
const BRANDS = [
  [/McDonald'?s?/g, "Burger Place"], [/Play ?Station/g, "Game Console"], [/\bUber\b/g, "RideCo"], [/\bNetflix\b/g, "StreamCo"], [/\bApple\b/g, "FruitCo"], [/\bAAPL\b/g, "FRCO"],
  [/\bTesla\b/g, "VoltCar"], [/\bTSLA\b/g, "VOLT"], [/\bSpotify\b/g, "TuneCo"], [/\bClaude\b/g, "Assistant"], [/\bSlack\b/g, "Teamchat"], [/\bStripe\b/g, "PayCo"],
  [/\bGitHub\b/g, "CodeHub"], [/\bGoogle\b/g, "SearchCo"], [/\bMicrosoft\b/g, "SoftCo"], [/\bMSFT\b/g, "SOFT"], [/\bAmazon\b/g, "ShopCo"], [/\bFacebook\b/g, "SocialNet"],
  [/\bTwitter\b/g, "MicroPost"], [/\bFigma\b/g, "DesignTool"], [/\bLaravel\b/g, "PHP Framework"], [/\bVueJS\b/g, "JS Framework"], [/\bBootstrap\b/g, "CSS Kit"],
  [/\bDribbble\b/g, "Portfolio Site"], [/\bBitcoin\b/g, "Coin A"], [/\bEthereum\b/g, "Coin B"], [/\bBinance\b/g, "Exchange X"], [/\bGmail\b/g, "Mailbox"],
  [/\bNotion\b/g, "Notebook App"], [/\bOpenAI\b/g, "Model Provider A"], [/\bAnthropic\b/g, "Model Provider B"], [/\bChatGPT\b/g, "Chat Assistant"], [/\bZoom\b/g, "Video Call"],
  [/\bVisa\b/g, "Card"], [/\bDropbox\b/g, "Cloud Drive"], [/\bTwitch\b/g, "Live Stream"], [/\bNVIDIA\b/g, "ChipCo"], [/\bVUEXY\b/g, "SAMPLE"], [/\bVuexy\b/g, "Sample"],
  [/\bKiriOne\b/g, "AutoBot"], [/\bkirridesk\b/gi, "samplehelp"], [/\bkirrid\w*/gi, "samplehelp"],
];
const brandFiles = [
  ...walk(path.join(SRC, "demo-src/mock-data")),
  ...walk(path.join(SRC, "ui/components/workspaces")).filter((f) => /(sample|samples|sample-data|gallery-items|token-data|ontology)\.tsx?$/.test(f)),
].filter((f) => /\.tsx?$/.test(f));
let brandHits = 0;
for (const f of brandFiles) {
  let s = fs.readFileSync(f, "utf8"); const o = s;
  for (const [re, to] of BRANDS) s = s.replace(re, () => { brandHits++; return to; });
  if (s !== o) fs.writeFileSync(f, s);
}
const replaceBrands = (s) => { for (const [re, to] of BRANDS) s = s.replace(re, to); return s; };
// 2c. the site sections: links go nowhere, other sites are not named
for (const f of walk(path.join(SRC, "www")).filter((f) => /\.tsx?$/.test(f))) {
  let s = fs.readFileSync(f, "utf8"); const o = s;
  s = s.replace(/https?:\/\/(?:matrix-os\.com|localhost:5173|github\.com\/HamedMP\/matrix-os)\/?/g, "#").replace(/View matrix-os\.com reference/g, "View the reference").replace(/matrix-os\.com/g, "a reference site");
  if (s !== o) fs.writeFileSync(f, s);
}

// 2d. no third-party image hosts or fictional doc hosts in the sample data: neutral inline placeholder instead
const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#d9d8d0"/><path d="M0 90l30-30 25 25 20-20 45 45v10H0z" fill="#bdbcb2"/></svg>');
for (const f of [...walk(path.join(SRC, "demo-src")), ...walk(UI0())].filter((f) => /\.tsx?$/.test(f))) {
  let s = fs.readFileSync(f, "utf8"); const o = s;
  s = s.replace(/https:\/\/images\.pexels\.com\/[^"'`\s)]+/g, PLACEHOLDER).replace(/https:\/\/docs\.meridian\.dev[^"'`\s)]*/g, "#");
  if (s !== o) fs.writeFileSync(f, s);
}
function UI0() { return path.join(SRC, "ui"); }

const UI = path.join(SRC, "ui");
const NM = path.join(WORK, "node_modules");
const GEN = path.join(SRC, "gen");
fs.mkdirSync(GEN, { recursive: true });
const alias = {
  "@ui": UI, "@demo": path.join(SRC, "demo-src/mock-data"), "@dsrc": path.join(SRC, "demo-src"), "@www": path.join(SRC, "www"), "@gen": GEN,
  "longformer-ui": path.join(UI, "index.ts"),
  react: path.join(NM, "react"), "react-dom": path.join(NM, "react-dom"), zod: path.join(NM, "zod"), "lucide-react": path.join(NM, "lucide-react"),
};

// ---------- 3. examples + registry ----------
await esbuild.build({ entryPoints: [path.join(HERE, "examples-entry.ts")], bundle: true, platform: "node", format: "esm", outfile: path.join(WORK, "out/examples.mjs"), alias, nodePaths: [NM], logLevel: "warning", loader: { ".css": "empty" }, define: { "import.meta.env": "{}" } });
const allExamples = (await import(pathToFileURL(path.join(WORK, "out/examples.mjs")).href + "?" + Date.now())).default;
const registry = X.registryMeta(path.join(UI, "components/workspaces/generated-ui/registry/registry.ts"));
const typesFile = path.join(UI, "components/workspaces/generated-ui/types.ts");
const TD = X.collectDecls(typesFile);

// ---------- props tables (derived from the TypeScript sources with the Arco extractor) ----------
const IGNORE = new Set(["string", "number", "boolean", "Array", "Record", "Omit", "Pick", "React", "ReactNode", "Extract", "Partial", "Set", "Map", "Date", "Promise", "Function", "Element", "HTMLElement"]);
const declCache = new Map();
const declsOf = (f) => { if (!declCache.has(f)) declCache.set(f, fs.existsSync(f) ? X.collectDecls(f).ifaces : {}); return declCache.get(f); };
function pool(files) {
  const all = [...files];
  for (const d of new Set(files.map((f) => path.dirname(f)))) for (const n of ["types.ts", "index.ts"]) { const c = path.join(d, n); if (fs.existsSync(c)) all.push(c); }
  all.push(typesFile);
  return all;
}
function nested(fields, files, seen, depth = 0, out = []) {
  for (const f of fields) {
    for (const n of f.type.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []) {
      if (seen.has(n) || IGNORE.has(n) || out.length >= 8) continue;
      let d = null;
      for (const file of files) { const x = declsOf(file)[n]; if (x) { d = x; break; } }
      if (!d) continue;
      seen.add(n);
      if (d.alias && d.type.length > 300) { out.push({ name: n, alias: d.type.slice(0, 120) + " ... (see source)", fields: [] }); continue; }
      out.push({ name: n, extends: d.extends, alias: d.alias && !d.fields.length ? d.type : null, doc: d.doc, fields: d.fields.slice(0, 60) });
      if (depth < 1) nested(d.fields, files, seen, depth + 1, out);
    }
  }
  return out;
}
const shrink = (tables) => tables.map((t) => ({ name: t.name, extends: t.extends || "", alias: t.alias || null, doc: t.doc || "", fields: (t.fields || []).slice(0, 60).map((f) => ({ n: f.name, t: f.type.length > 140 ? f.type.slice(0, 137) + "..." : f.type, o: f.optional ? 1 : 0, d: (f.doc || "").slice(0, 160) })) }));
const toSrc = (p) => p.replace(UIX + "/packages/longformer-ui/src", UI).replace(UIX + "/packages/longformer-www/src", path.join(SRC, "www")).replace(UIX + "/packages/longformer-demo/src", path.join(SRC, "demo-src"));
function propsFor(t) {
  const abs = [t.source, ...(t.extraSources || [])].map((p) => toSrc(path.join(UIX, p))).filter((f) => /\.tsx?$/.test(f) && fs.existsSync(f));
  const files = pool(abs);
  const base = path.basename(t.source).replace(/\.tsx?$/, "");
  const names = t.comps && t.comps.length ? t.comps : [base];
  const tables = []; let found = false;
  if (t.kind === "block") {
    const fields = TD.unionMembers[t.blockType];
    if (fields) { tables.push({ name: `GeneratedBlock "${t.blockType}"`, fields }); tables.push(...nested(fields, files, new Set())); found = true; }
    return { tables: shrink(tables), found };
  }
  for (const n of names) {
    let d = null;
    for (const f of files) { const x = declsOf(f)[n + "Props"]; if (x) { d = x; break; } }
    if (d) { tables.push({ name: n + "Props", extends: d.extends, doc: d.doc, fields: d.fields }); tables.push(...nested(d.fields, files, new Set([n + "Props"]))); found = true; continue; }
    for (const f of files.slice(0, abs.length)) { const fields = X.inlineProps(f, n); if (fields) { tables.push({ name: n + " (inline parameter type)", fields }); tables.push(...nested(fields, files, new Set())); found = true; break; } }
  }
  if (!found) {
    for (const f of files.slice(0, abs.length)) for (const [k, v] of Object.entries(declsOf(f))) if (/Props$/.test(k) && !v.alias) { tables.push({ name: k, extends: v.extends, doc: v.doc, fields: v.fields }); found = true; }
  }
  return { tables: shrink(tables), found };
}

// ---------- 4. tiles ----------
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const title = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const BSRC = "packages/longformer-ui/src/components/workspaces/generated-ui/blocks/";
const examples = {};
const cardTiles = [];
const dropped = [];
for (const type of CARD_TYPES) {
  if (ARCO_TYPES.includes(type)) throw new Error("overlaps the Arco docs page: " + type);
  const reg = registry[type];
  const ex = allExamples.find((e) => e.block.type === type);
  const file = `${type[0].toUpperCase()}${type.slice(1)}Block.tsx`;
  const srcFile = fs.readdirSync(path.join(UI, "components/workspaces/generated-ui/blocks")).find((f) => f.toLowerCase() === file.toLowerCase());
  if (!reg || !ex || !srcFile) { dropped.push(type); continue; }
  examples[type] = ex.block;
  const json = JSON.stringify(ex.block, null, 2);
  cardTiles.push({
    id: kebab(type), name: title(type), cat: "cards", kind: "block", blockType: type,
    source: BSRC + srcFile, extraSources: ["packages/longformer-ui/src/components/workspaces/generated-ui/registry/registry.ts", "packages/longformer-ui/src/components/workspaces/generated-ui/types.ts"],
    status: reg.strict ? "available" : "prototype",
    statusNote: reg.strict ? "Registry entry has strict: true (a full Zod schema)." : "Registry entry has strict: false: only the { id, type } envelope is validated.",
    desc: reg.description, family: reg.family,
    snippet: (json.length > 900 ? json.slice(0, 900).replace(/\n[^\n]*$/, "") + "\n  ..." : json),
    snippetLabel: "Example block JSON (from " + ex.source + ")", exampleSource: ex.source,
  });
}
fs.writeFileSync(path.join(GEN, "examples.ts"), "export const EXAMPLES: Record<string, any> = " + JSON.stringify(examples) + ";\n");
if (dropped.length) console.log("DROPPED cards (no example/source):", dropped.join(", "));

// app views
const wsCfg = fs.readFileSync(path.join(UIX, "packages/longformer-demo/src/workspace-config.ts"), "utf8");
const labels = Object.fromEntries([...wsCfg.matchAll(/\{ id: "([\w-]+)", label: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const wsTiles = [];
for (const id of T.WORKSPACE_IDS) {
  const dir = T.WS_DIR_MAP[id] || id;
  const dpath = path.join(UIX, "packages/longformer-ui/src/components/workspaces", dir);
  const f = fs.existsSync(dpath) && fs.readdirSync(dpath).find((x) => /Workspace\.tsx$/.test(x));
  if (!f) { console.log("NO workspace file for", id); continue; }
  wsTiles.push(T.wsTile(id, labels[id] || id, `packages/longformer-ui/src/components/workspaces/${dir}/${f}`, f.replace(".tsx", "")));
}
const extra = [...T.OVERLAY_TILES, ...T.CHAT_STATE_TILES, ...T.SITE_TILES, ...T.PLANNED_TILES];
const BUNDLE = { component: "core", block: "core", app: "apps", overlay: "apps", site: "site", mini: "miniapps" };
const baseTiles = [...STATIC_TILES, ...cardTiles, ...wsTiles, ...extra];

// ---- mini apps: derive "components used" from each file's imports, mapped onto tiles (or Arco docs entries) ----
const cap = (x) => x[0].toUpperCase() + x.slice(1);
const idIndex = new Map();
for (const t of baseTiles) {
  const names = new Set([...(t.comps || []), t.name, path.basename(t.source).replace(/\.tsx?$/, ""), ...(t.extraSources || []).map((e) => path.basename(e).replace(/\.tsx?$/, ""))]);
  if (t.blockType) names.add(cap(t.blockType) + "Block");
  for (const n of names) if (!idIndex.has(n)) idIndex.set(n, t.id);
}
const ARCO_PRIMS = new Set(["Button", "Badge", "Chip", "Switch", "Input", "Tabs"]);
const arcoBlocks = new Map(ARCO_TYPES.map((t) => [cap(t) + "Block", t]));
const miniTiles = MINI_APPS.map((m) => {
  const file = path.join(HERE, "mini", m.file + ".tsx");
  const src = fs.readFileSync(file, "utf8");
  const uses = []; const seen = new Set();
  for (const mm of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(@ui\/[^"]+)"/g)) {
    for (const raw of mm[1].split(",")) {
      let n = raw.trim().split(/\s+as\s+/)[0]; if (!n || /^type\s/.test(n)) continue;
      if (n === "TabPanel") n = "Tabs";
      if (seen.has(n)) continue; seen.add(n);
      if (ARCO_PRIMS.has(n)) uses.push({ name: n, arco: "../arco/docs/index.html#" + kebab(n) });
      else if (arcoBlocks.has(n)) uses.push({ name: n, arco: "../arco/docs/index.html#" + kebab(arcoBlocks.get(n)) });
      else if (idIndex.has(n)) uses.push({ name: n, tile: idIndex.get(n) });
      else console.log("mini import with no tile:", m.id, n);
    }
  }
  return {
    id: "mini-" + m.id, name: m.name, cat: "mini", kind: "mini", bundle: "miniapps", miniId: m.id, device: m.device, featured: !!m.featured,
    source: "site/ui-experiments/build/mini/" + m.file + ".tsx", status: "prototype",
    statusNote: "Written for this page from the kit's components and local state. It is a sample app, not part of the workspace.",
    desc: m.desc, demonstrates: m.demonstrates, uses, stage: { w: m.w, h: m.h }, wide: m.device !== "phone", props: null, snippet: null,
  };
});
const tiles = [...miniTiles, ...baseTiles];
for (const t of baseTiles) { t.usedIn = miniTiles.filter((m) => m.uses.some((u) => u.tile === t.id)).map((m) => m.id); }
const ids = new Set();
const noProps = [];
for (const t of tiles) {
  if (ids.has(t.id)) throw new Error("dup id " + t.id);
  ids.add(t.id);
  if (t.kind === "mini") { if (!fs.existsSync(path.join(HERE, "..", "..", "..", t.source))) throw new Error("missing mini " + t.source); }
  else if (t.kind !== "planned") for (const p of [t.source, ...(t.extraSources || [])]) if (!fs.existsSync(path.join(UIX, p))) throw new Error(`missing source for ${t.id}: ${p}`);
  if (BUNDLE[t.kind]) t.bundle = BUNDLE[t.kind];
  if (t.kind === "planned" || t.kind === "iframe" || t.kind === "mini") { t.props = null; continue; }
  const pr = propsFor(t);
  t.props = pr.tables;
  if (!pr.found) { if (t.kind === "site" || t.id === "phone-home") t.noProps = true; else noProps.push(t.id); }
}
console.log("tiles without a props table:", noProps.join(", ") || "(none)");

// ---------- 5. static files for the frame tiles ----------
fs.mkdirSync(path.join(OUT, "static"), { recursive: true });
for (const t of tiles.filter((x) => x.kind === "iframe")) {
  let html = fs.readFileSync(path.join(UIX, t.source), "utf8");
  html = replaceBrands(html);
  html = html.replace(/<head>/i, '<head>\n<base target="_blank">');
  fs.writeFileSync(path.join(OUT, "static", t.src.split("/").pop()), html);
}

// ---------- 6. bundles (code-split: core / apps / site share chunks) ----------
for (const f of fs.readdirSync(OUT)) if (/^uix/.test(f) || f === "chunks") fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
await esbuild.build({
  entryPoints: { "uix-core": path.join(HERE, "entry-core.tsx"), "uix-apps": path.join(HERE, "entry-apps.tsx"), "uix-site": path.join(HERE, "entry-site.tsx"), "uix-miniapps": path.join(HERE, "entry-mini.tsx") },
  outdir: OUT, chunkNames: "chunks/[name]-[hash]", bundle: true, splitting: true, format: "esm", minify: true,
  jsx: "automatic", target: "es2020", alias, nodePaths: [NM], legalComments: "none",
  loader: { ".css": "css", ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, logLevel: "info",
});

const pkg = JSON.parse(fs.readFileSync(path.join(UIX, "packages/longformer-ui/package.json"), "utf8"));
const meta = { generated: new Date().toISOString().slice(0, 10), kit: pkg.name, kitVersion: pkg.version, react: "18.3.1", categories: CATEGORIES, planStatus: "DRAFT v0.1, Jul 2026", brandReplacements: brandHits };
fs.writeFileSync(path.join(OUT, "tiles-data.js"), "// Generated by build/build.mjs from the owner's UI Experiments workspace. Do not edit.\nexport default " + JSON.stringify({ meta, tiles }) + ";\n");
const sizes = {};
for (const f of walk(OUT)) sizes[path.relative(OUT, f)] = fs.statSync(f).size;
console.log(sizes);
console.log("tiles:", tiles.length, "brand replacements:", brandHits);
