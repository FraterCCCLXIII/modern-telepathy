// Builds site/yakopop/assets/yakopop-demo.{js,css} from the copied yakopop sources.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const out = process.argv[2] || "dist";
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ["src/entry.tsx"], bundle: true, format: "esm", minify: true, target: "es2020",
  outfile: `${out}/yakopop-demo.js`, jsx: "automatic", legalComments: "none",
  alias: { "@yakopop/shared": resolve("src/shared/index.ts") },
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "info",
});

// CSS: overlay.css + player.css scoped under .ykd so they cannot touch (or be touched by) the site's own classes.
function scope(css, prefix) {
  let i = 0, res = "";
  const n = css.length;
  const skipWs = () => { while (i < n && /\s/.test(css[i])) i++; };
  while (i < n) {
    skipWs();
    if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i); res += css.slice(i, e + 2) + "\n"; i = e + 2; continue; }
    if (i >= n) break;
    const brace = css.indexOf("{", i);
    const head = css.slice(i, brace).trim();
    let depth = 1, j = brace + 1;
    while (j < n && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(brace + 1, j - 1);
    if (head.startsWith("@keyframes")) res += `${head}{${body}}\n`;
    else if (head.startsWith("@media") || head.startsWith("@supports")) res += `${head}{${scope(body, prefix)}}\n`;
    else {
      const sels = []; let d = 0, cur = "";
      for (const ch of head) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && d === 0) { sels.push(cur); cur = ""; } else cur += ch; }
      sels.push(cur);
      res += sels.map(s => `${prefix} ${s.trim()}`).join(",\n") + `{${body}}\n`;
    }
    i = j;
  }
  return res;
}
const raw = readFileSync("src/overlay/overlay.css", "utf8") + "\n" + readFileSync("src/overlay/player/player.css", "utf8");
writeFileSync(`${out}/yakopop-demo.css`, scope(raw, ".ykd"));
