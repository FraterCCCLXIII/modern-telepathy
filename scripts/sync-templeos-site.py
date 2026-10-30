#!/usr/bin/env python3
"""Copy the built TempleOS marketing site into public/labs/templeos/site/ so it is served under a sub-path.

Source: the templeos repo, projects/templeos-site/dist (run `npm run build` there first).
The site links to root-absolute paths (/download/, /img/...), so every one is prefixed with PREFIX.
Each page also gets the shared Modern Telepathy header (public/labs/kamiji/site/shared-header.js).

    python3 scripts/sync-templeos-site.py [path/to/templeos-site/dist]
"""
import re, shutil, sys
from pathlib import Path

PREFIX = "/labs/templeos/site"
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "Documents/github/templeos/projects/templeos-site/dist")
DST = Path(__file__).resolve().parent.parent / "public/labs/templeos/site"
HEADER = '<script type="module" src="/labs/kamiji/site/shared-header.js"></script>'

if DST.exists():
    shutil.rmtree(DST)
shutil.copytree(SRC, DST, ignore=shutil.ignore_patterns("sitemap.xml", "robots.txt"))

attr = re.compile(r'(\b(?:href|src|action|poster|data-[\w-]+)=")/(?!/)')
cssurl = re.compile(r'url\((["\']?)/(?!/)')
jsstr = re.compile(r"""(['"`])/((?:try|download|docs|apps|history|creation-studio|ai|security|developers|holyc|browser|community|compare|faq|get-started|hc-plus|philosophy|privacy|requirements|roadmap|versions|whats-new|about|accessibility|notices|desktop|img)[\w\-/.]*)\1""")
for f in DST.rglob("*"):
    if f.suffix not in {".html", ".css", ".js"}:
        continue
    s = f.read_text(encoding="utf-8")
    if f.suffix == ".html":
        s = attr.sub(lambda m: m.group(1) + PREFIX + "/", s)
        s = cssurl.sub(lambda m: "url(" + m.group(1) + PREFIX + "/", s)
        s = s.replace("</body>", HEADER + "</body>", 1)
    elif f.suffix == ".css":
        s = cssurl.sub(lambda m: "url(" + m.group(1) + PREFIX + "/", s)
    else:
        s = jsstr.sub(lambda m: m.group(1) + PREFIX + "/" + m.group(2) + m.group(1), s)
    f.write_text(s, encoding="utf-8")
print("copied", sum(1 for _ in DST.rglob("*.html")), "pages to", DST)
