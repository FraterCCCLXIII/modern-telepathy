#!/usr/bin/env python3
"""Build the Glyphlings: nine Greek capitals from Courier New Regular, each with eyes set into its empty spaces.

Reads the glyph outlines from the system font, writes public/glyphlings/<name>.svg (animated blink, transparent),
public/glyphlings/<name>-plain.svg (letter only), <name>-tile.svg (on its colour) and src/lib/glyphlings.ts.
Eye positions are in font units (y up), placed by hand into each letter's counter or open space.

    python3 scripts/make-glyphlings.py
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "/System/Library/Fonts/Supplemental/Courier New.ttf"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/glyphlings"

# name, letter, tile colour, eyes [(x, y, r)]
CHARS = [
    ("Alpha",   "Α", "#ffd9c7", [(515, 640, 72), (705, 640, 72)]),
    ("Beta",    "Β", "#d6ecff", [(610, 855, 88), (640, 300, 98)]),
    ("Delta",   "Δ", "#e4f5c9", [(450, 385, 96), (750, 385, 96)]),
    ("Lambda",  "Λ", "#ffe9a8", [(485, 570, 74), (735, 570, 74)]),
    ("Omicron", "Ο", "#ffd1e8", [(440, 640, 104), (780, 640, 104)]),
    ("Sigma",   "Σ", "#e1d6ff", [(780, 590, 60), (910, 590, 60)]),
    ("Upsilon", "Υ", "#c9f2ea", [(525, 895, 60), (695, 895, 60)]),
    ("Phi",     "Φ", "#ffd0c4", [(385, 580, 108), (850, 580, 108)]),
    ("Omega",   "Ω", "#cfe2ff", [(480, 640, 98), (745, 640, 98)]),
]
LOWER = [
    ("Alpha",   "α", [(330, 420, 75), (550, 420, 75)]),
    ("Beta",    "β", [(610, 880, 80), (650, 330, 115)]),
    ("Delta",   "δ", [(450, 400, 95), (780, 400, 95)]),
    ("Lambda",  "λ", [(525, 290, 48), (695, 290, 48)]),
    ("Omicron", "ο", [(480, 435, 100), (750, 435, 100)]),
    ("Sigma",   "σ", [(480, 430, 95), (770, 430, 95)]),
    ("Upsilon", "υ", [(440, 520, 85), (760, 520, 85)]),
    ("Phi",     "φ", [(370, 440, 90), (790, 440, 100)]),
    ("Omega",   "ω", [(470, 700, 70), (750, 700, 70)]),
]
colour_of = {n: c for n, _, c, _ in CHARS}
CHARS = [(n, ch, c, e, n.lower()) for n, ch, c, e in CHARS] + [(n, ch, colour_of[n], e, n.lower() + "-lower") for n, ch, e in LOWER]
PAD = 90

f = TTFont(FONT)
cmap, gs = f.getBestCmap(), f.getGlyphSet()
from fontTools.pens.boundsPen import BoundsPen

STYLE = """<style>.eye{transform-box:fill-box;transform-origin:center;animation:blink 5.5s infinite}
.eye:nth-of-type(2){animation-delay:.07s}@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@media (prefers-reduced-motion:reduce){.eye{animation:none}}</style>"""

def eye(x, y, r, i):
    # y is up in font units; the glyph group is flipped, so use the same flipped space
    return (f'<g class="eye"><circle cx="{x}" cy="{y}" r="{r}" fill="#111"/>'
            f'<circle cx="{x + r*0.32:.0f}" cy="{y + r*0.34:.0f}" r="{r*0.3:.0f}" fill="#fff"/></g>')

def eye_wide(x, y, r, i):
    # white eye with a dark rim, a large pupil set a little up and to the right, and a highlight
    pr = r * 0.58
    return (f'<g class="eye"><circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="#111" stroke-width="{r*0.16:.0f}"/>'
            f'<circle cx="{x + r*0.2:.0f}" cy="{y + r*0.12:.0f}" r="{pr:.0f}" fill="#111"/>'
            f'<circle cx="{x + r*0.2 + pr*0.34:.0f}" cy="{y + r*0.12 + pr*0.36:.0f}" r="{pr*0.28:.0f}" fill="#fff"/></g>')

def eye_pill(x, y, r, i):
    # a tall solid bar with fully rounded ends (the Temple logo's eyes): width about 1.2 r, height about 2.7 r
    w, h = r * 1.2, r * 2.7
    return f'<g class="eye"><rect x="{x - w/2:.0f}" y="{y - h/2:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{w/2:.0f}" fill="#111"/></g>'

EYE_SETS = [("", eye), ("-wide", eye_wide), ("-pill", eye_pill)]

meta = []
for name, ch, colour, eyes, slug in CHARS:
    gn = cmap[ord(ch)]
    pen = SVGPathPen(gs); gs[gn].draw(pen)
    bp = BoundsPen(gs); gs[gn].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    w, h = x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD
    vb = f"{x0 - PAD} {-(y1 + PAD)} {w} {h}"
    plain = f'<g transform="scale(1,-1)"><path d="{pen.getCommands()}" fill="#111"/></g>'
    (OUT / f"{slug}-plain.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{name}, letter only">{plain}</svg>\n')
    for suffix, fn in EYE_SETS:
        body = f'<g transform="scale(1,-1)"><path d="{pen.getCommands()}" fill="#111"/>{"".join(fn(*e, i) for i, e in enumerate(eyes))}</g>'
        (OUT / f"{slug}{suffix}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{name}">{STYLE}{body}</svg>\n')
        S = 512; k = (S * 0.62) / (y1 - y0)
        tx = S / 2 - (x0 + x1) / 2 * k; ty = S / 2 + (y0 + y1) / 2 * k
        tile = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="{name}">{STYLE}'
                f'<rect width="{S}" height="{S}" fill="{colour}"/><g transform="translate({tx:.1f} {ty:.1f}) scale({k:.5f})">{body}</g></svg>\n')
        (OUT / f"{slug}{suffix}-tile.svg").write_text(tile)
    meta.append(dict(name=name, letter=ch, colour=colour, slug=slug, lower=slug.endswith("-lower"), w=int(w), h=int(h), vb=vb, d=pen.getCommands(), eyes=[list(e) for e in eyes]))

ts = ("/** Generated by scripts/make-glyphlings.py. Nine Greek capitals from Courier New Regular, with eyes. */\n"
      "export type Glyphling = { name: string; letter: string; colour: string; slug: string; lower: boolean; w: number; h: number; vb: string; d: string; eyes: [number, number, number][] };\n"
      "export const glyphlings: Glyphling[] = " + json.dumps(meta, ensure_ascii=False, indent=1) + ";\n")
(ROOT / "src/lib/glyphlings.ts").write_text(ts)
print("wrote", len(meta), "characters")
