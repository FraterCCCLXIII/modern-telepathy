// Reproducible build for the Arco docs. Run:  node build.mjs   (see ../README.md)
// Env: UIX = path to the owner's "UI Experiments" workspace (read-only), WORK = temp dir with node_modules.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UIX = process.env.UIX || "/Users/paulbloch/Documents/github/UI Experiments";
const WORK = process.env.WORK || "/private/tmp/claude-501/arco-docs-build";
const OUT = path.resolve(HERE, "../assets");
const req = createRequire(WORK + "/");
const esbuild = req("esbuild");
const { COMPONENTS, CATEGORIES } = await import("./components.mjs");
const X = await import("./extract.mjs");

// 1. copy sources into WORK (never build inside the owner's workspace)
const SRC = path.join(WORK, "src");
fs.rmSync(SRC, { recursive: true, force: true });
const skip = (s) => !/node_modules|\/dist\b/.test(s);
fs.cpSync(path.join(UIX, "packages/longformer-ui/src"), path.join(SRC, "ui"), { recursive: true, filter: skip });
fs.mkdirSync(path.join(SRC, "demo"), { recursive: true });
for (const f of ["generated.ts", "chat-ui-surfaces.ts", "card-collections.ts"])
  fs.copyFileSync(path.join(UIX, "packages/longformer-demo/src/mock-data", f), path.join(SRC, "demo", f));
// scope the dark default off :root so it cannot restyle the docs page
const themePath = path.join(SRC, "ui/tokens/theme.css");
let theme = fs.readFileSync(themePath, "utf8");
theme = theme.replace(/:root,\n\[data-lf-theme="dark"\]/, '[data-lf-theme="dark"]').replace(/:root,\n\[data-lf-theme\]/, "[data-lf-theme]");
fs.writeFileSync(themePath, theme);
const UI = path.join(SRC, "ui");
const NM = path.join(WORK, "node_modules");
// pin React/Zod/lucide to the copies in WORK (a parent node_modules, e.g. the repo's, must not win)
const alias = { "@ui": UI, "@demo": path.join(SRC, "demo"), react: path.join(NM, "react"), "react-dom": path.join(NM, "react-dom"), zod: path.join(NM, "zod"), "lucide-react": path.join(NM, "lucide-react") };

// 2. examples (bundled for node, then imported)
await esbuild.build({ entryPoints: [path.join(HERE, "examples-entry.ts")], bundle: true, platform: "node", format: "esm", outfile: path.join(WORK, "out/examples.mjs"), alias, nodePaths: [WORK + "/node_modules"], logLevel: "warning" });
const allExamples = (await import(pathToFileURL(path.join(WORK, "out/examples.mjs")).href + "?" + Date.now())).default;

// 3. metadata
const registry = X.registryMeta(path.join(UI, "components/workspaces/generated-ui/registry/registry.ts"));
const typesFile = path.join(UI, "components/workspaces/generated-ui/types.ts");
const typesRaw = fs.readFileSync(typesFile, "utf8");
const T = X.collectDecls(typesFile);
const importMap = {}; // Name -> primitive dir
for (const m of typesRaw.matchAll(/import\("([^"]+)"\)\.(\w+)/g)) importMap[m[2]] = m[1];
const schemasFile = path.join(UI, "components/workspaces/generated-ui/registry/schemas.ts");
const pkg = JSON.parse(fs.readFileSync(path.join(UIX, "packages/longformer-ui/package.json"), "utf8"));
const SRCDIR = "packages/longformer-ui/src/";

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const title = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const IGNORE = new Set(["string", "number", "boolean", "Array", "Record", "Omit", "Pick", "React", "ReactNode", "Extract"]);

function refDecl(name) {
  if (T.ifaces[name]) return T.ifaces[name];
  const mod = importMap[name];
  if (!mod) return null;
  const dir = path.resolve(path.dirname(typesFile), mod);
  const cands = [dir + ".tsx", path.join(dir, path.basename(dir) + ".tsx"), path.join(dir, "index.ts"), path.join(path.dirname(dir), "index.ts")];
  for (const c of cands) if (fs.existsSync(c)) { const d = X.collectDecls(c).ifaces[name]; if (d) return d; }
  return null;
}
function nestedTables(fields, seen, depth = 0) {
  const out = [];
  for (const f of fields) {
    for (const n of f.type.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []) {
      if (seen.has(n) || IGNORE.has(n)) continue;
      const d = refDecl(n);
      if (!d) continue;
      seen.add(n);
      if (d.alias && d.type.length > 400) { out.push({ name: n, alias: `${d.type.split("|").length} string literals (see source)`, fields: [] }); continue; }
      out.push({ name: n, extends: d.extends, alias: d.alias ? d.type : null, doc: d.doc, fields: d.fields });
      if (depth < 2) out.push(...nestedTables(d.fields, seen, depth + 1));
    }
  }
  return out;
}

const PRIM_VARIANTS = {
  Button: [["variants", "Variants"], ["sizes", "Sizes"], ["disabled", "Disabled"]],
  Tabs: [["pill", "Pill (default)"], ["underline", "Underline"]],
};
const PRIM_SNIPPET = {
  Button: '<Button variant="primary" size="md">Save</Button>\n<Button variant="danger">Delete</Button>',
  Badge: '<Badge tone="success" dot>Active</Badge>',
  Chip: '<Chip icon="star" active onClick={toggle}>Saved</Chip>',
  Switch: '<Switch id="remember" label="Remember me" checked={on} onChange={(e) => setOn(e.target.checked)} />',
  Input: '<Input placeholder="Search" aria-label="Search" invalid={!valid} />',
  Tabs: '<Tabs items={[{ id: "a", label: "Overview" }, { id: "b", label: "Activity" }]} value={tab} onChange={setTab} variant="underline" aria-label="Sections" />',
};

const data = [];
for (const c of COMPONENTS) {
  const srcFile = path.join(UI, "components", c.file);
  if (!fs.existsSync(srcFile)) throw new Error("missing " + srcFile);
  const e = { id: kebab(c.type), name: title(c.type), type: c.type, kind: c.kind, category: c.category, version: "workspace " + pkg.version };
  const sources = [SRCDIR + "components/" + c.file];
  let a11yFiles = [srcFile];
  if (c.kind === "block") {
    const reg = registry[c.type];
    if (!reg) throw new Error("not in registry " + c.type);
    e.description = reg.description;
    e.family = reg.family;
    e.strict = reg.strict;
    e.status = reg.strict ? "available" : "prototype";
    e.statusNote = reg.strict ? "Strict Zod schema: every field is validated." : "Envelope-only validation ({ id, type }); the TypeScript type is trusted at render time.";
    const fields = T.unionMembers[c.type];
    e.props = [{ name: `GeneratedBlock "${c.type}"`, fields }, ...nestedTables(fields, new Set())];
    if (reg.strict) {
      const sname = c.type + "BlockSchema";
      e.zod = X.constSource(schemasFile, sname);
      sources.push(SRCDIR + "components/workspaces/generated-ui/registry/schemas.ts");
    }
    sources.push(SRCDIR + "components/workspaces/generated-ui/registry/registry.ts", SRCDIR + "components/workspaces/generated-ui/types.ts");
    a11yFiles.push(...X.primitiveImports(srcFile, UI));
    const seen = new Set();
    e.examples = [];
    for (const ex of allExamples) {
      if (ex.block.type !== c.type) continue;
      const j = JSON.stringify(ex.block);
      if (seen.has(j) || e.examples.length >= 4) continue;
      seen.add(j);
      e.examples.push({ source: ex.source, json: ex.block, validation: ex.validation });
    }
    if (!e.examples.length) throw new Error("no example for " + c.type);
  } else {
    const decls = X.collectDecls(srcFile).ifaces;
    const doc = fs.readFileSync(srcFile, "utf8");
    e.status = "available";
    e.statusNote = "A primitive in the workspace library (part of the plan's Tier 1).";
    const jd = [...doc.matchAll(/\/\*\*\s*([^*]+?)\s*\*\/\s*export (?:const|function) (\w+)/g)].find((m) => m[2] === c.type);
    const descs = { Button: "Action button with four variants and three sizes, or icon-only.", Badge: "Small tone-coloured label, with an optional status dot.", Chip: "A clickable pill for suggestions, applied filters or save toggles.", Switch: "Toggle switch for boolean settings.", Input: "Text input with optional leading/trailing slots and an invalid state.", Tabs: "Tab list with pill or underline styling." };
    e.description = jd ? jd[1].replace(/\s+/g, " ") : descs[c.type];
    if (c.type === "Button") e.description = descs.Button;
    e.props = c.props.map((n) => ({ name: n, extends: decls[n].extends, fields: decls[n].fields }));
    const seen = new Set(c.props);
    for (const n of c.props) e.props.push(...nestedTables(decls[n].fields, seen).filter((t) => !c.props.includes(t.name)));
    e.variants = PRIM_VARIANTS[c.type] || [["default", "Default"]];
    e.snippet = `import { ${c.type} } from "longformer-ui";\n\n` + PRIM_SNIPPET[c.type];
    e.notes = "Primitives are composed in JSX, not emitted by agents. The preview is composed for this page from the real component.";
    const m = doc.match(/\/\*\* ([^*]*(?:accessible|Accessible)[^*]*)\*\//);
    if (m) e.a11yDoc = m[1].trim();
  }
  const f = X.a11yFacts(a11yFiles);
  if (f.roles.length || f.aria.length) e.a11y = f;
  e.sources = sources;
  data.push(e);
}

// 4. bundle the browser entry
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(HERE, "arco-light.css"), path.join(WORK, "arco-light.css"));
await esbuild.build({
  entryPoints: [path.join(HERE, "entry.tsx")], outfile: path.join(OUT, "arco-ui.js"), bundle: true, format: "esm", minify: true,
  jsx: "automatic", target: "es2020", alias, nodePaths: [WORK + "/node_modules"], legalComments: "none",
  loader: { ".css": "css", ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "info",
  plugins: [{ name: "light-css", setup(b) { b.onResolve({ filter: /^\.\/arco-light\.css$/ }, () => ({ path: path.join(HERE, "arco-light.css") })); } }],
});

const meta = { generated: new Date().toISOString().slice(0, 10), kit: pkg.name, kitVersion: pkg.version, react: "18.3.1", categories: CATEGORIES, planStatus: "DRAFT v0.1, Jul 2026" };
fs.writeFileSync(path.join(OUT, "docs-data.js"), "// Generated by build/build.mjs from the owner's UI Experiments workspace. Do not edit.\nexport default " + JSON.stringify({ meta, components: data }) + ";\n");
for (const f of fs.readdirSync(OUT)) console.log(f, fs.statSync(path.join(OUT, f)).size);
