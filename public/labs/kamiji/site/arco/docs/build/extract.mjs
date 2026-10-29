// Extracts registry metadata, TS prop tables, Zod snippets and examples from the owner's sources.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const clean = (s) => s.replace(/import\("[^"]+"\)\./g, "").replace(/\s+/g, " ").trim();
const docOf = (n) => (ts.getJSDocCommentsAndTags(n).map((d) => (d.comment ? String(typeof d.comment === "string" ? d.comment : d.comment.map((c) => c.text).join("")) : "")).join(" ")).trim();

export function parseFile(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
}

/** { type -> { description, family, strict } } from registry.ts */
export function registryMeta(file) {
  const sf = parseFile(file);
  const out = {};
  const visit = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText() === "defineBlock" && ts.isObjectLiteralExpression(n.arguments[0])) {
      const o = {};
      for (const p of n.arguments[0].properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const k = p.name.getText();
        if (["type", "description", "family"].includes(k)) o[k] = p.initializer.text ?? p.initializer.getText().replace(/^"|"$/g, "");
        if (k === "strict") o.strict = p.initializer.kind === ts.SyntaxKind.TrueKeyword;
      }
      out[o.type] = o;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** interface/type tables from types.ts and a primitive file */
export function collectDecls(file) {
  const sf = parseFile(file);
  const ifaces = {};
  const unionMembers = {};
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st)) {
      ifaces[st.name.text] = {
        extends: (st.heritageClauses || []).map((h) => clean(h.getText())).join(", "),
        doc: docOf(st),
        fields: st.members.filter(ts.isPropertySignature).map((m) => ({ name: m.name.getText(), optional: !!m.questionToken, type: clean(m.type.getText()), doc: docOf(m) })),
      };
    }
    if (ts.isTypeAliasDeclaration(st) && st.name.text === "GeneratedBlock" && ts.isUnionTypeNode(st.type)) {
      for (const m of st.type.types) {
        if (!ts.isTypeLiteralNode(m)) continue;
        const fields = m.members.filter(ts.isPropertySignature).map((x) => ({ name: x.name.getText(), optional: !!x.questionToken, type: clean(x.type.getText()), doc: docOf(x) }));
        const t = fields.find((f) => f.name === "type");
        if (t) unionMembers[t.type.replace(/"/g, "")] = fields;
      }
    }
    if (ts.isTypeAliasDeclaration(st) && st.name.text !== "GeneratedBlock") {
      ifaces[st.name.text] = { alias: true, extends: "", doc: docOf(st), type: clean(st.type.getText()), fields: ts.isTypeLiteralNode(st.type) ? st.type.members.filter(ts.isPropertySignature).map((x) => ({ name: x.name.getText(), optional: !!x.questionToken, type: clean(x.type.getText()), doc: docOf(x) })) : [] };
    }
  }
  return { ifaces, unionMembers };
}

/** exported const source text by name (Zod schemas) */
export function constSource(file, name) {
  const sf = parseFile(file);
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => d.name.getText() === name)) return st.getText();
  }
  return null;
}

/** a11y facts literally present in the source files */
export function a11yFacts(files) {
  const roles = new Set(), aria = new Set();
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/role=\{?"([a-z]+)"/g)) roles.add(m[1]);
    for (const m of s.matchAll(/(aria-[a-z]+)=/g)) aria.add(m[1]);
  }
  return { roles: [...roles], aria: [...aria] };
}

export function primitiveImports(blockFile, uiRoot) {
  const s = fs.readFileSync(blockFile, "utf8");
  return [...s.matchAll(/primitives\/(\w+)"/g)].map((m) => path.join(uiRoot, "components/primitives", m[1], m[1] + ".tsx"));
}
