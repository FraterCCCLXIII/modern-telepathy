#!/usr/bin/env python3
"""Build the Glyphlings: nine Greek letters, capitals and lowercase, from Courier New Regular, each with eyes in its empty spaces.

Steps per letter: read the outline, make every letter a similar width, round the sharp corners, then place the eyes.
Letters with closed counters (Alpha, Beta, Delta, Omicron, Phi, lowercase sigma and so on) get their eyes by search: the largest eyes that fit inside the
counter with a margin, set low in it (in the stomach of the letter). Letters whose empty space is open (Lambda, Sigma, Upsilon, Omega, lowercase
lambda, upsilon, omega) use hand-placed positions.

Writes public/glyphlings/*.svg (static files for each eye set), src/lib/glyphlings.ts (outlines and eye positions the page draws live) and
public/labs/kamiji/assets/glyphlings/index.json (polygon rings for the 3D Glyphlings library on the Kamiji pages).

    python3 scripts/make-glyphlings.py          (needs fontTools and shapely)
"""
import json
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

FONT = "/System/Library/Fonts/Supplemental/Courier New.ttf"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/glyphlings"
LIB = ROOT / "public/labs/kamiji/assets/glyphlings"
LIB.mkdir(parents=True, exist_ok=True)

TARGET_W = 1000        # every letter is scaled sideways towards this width
K_MIN, K_MAX = 0.80, 1.30
ROUND = 18             # corner radius in font units (stroke weight is about 75)
GAP = 20               # clear space between an eye and the stroke
LOW = 0.14             # eyes sit this fraction of the counter's height below its middle
PAD = 90

# name, letter, tile colour, how eyes are placed: "auto", "each" (one per counter) or hand-placed [(x, y, r)] in the ORIGINAL font coordinates
UPPER = [
    ("Alpha",   "Α", "#ffd9c7", "auto"),
    ("Beta",    "Β", "#d6ecff", "each"),
    ("Delta",   "Δ", "#e4f5c9", "auto"),
    ("Lambda",  "Λ", "#ffe9a8", [(485, 540, 74), (735, 540, 74)]),
    ("Omicron", "Ο", "#ffd1e8", "auto"),
    ("Sigma",   "Σ", "#e1d6ff", [(780, 590, 60), (910, 590, 60)]),
    ("Upsilon", "Υ", "#c9f2ea", [(525, 895, 60), (695, 895, 60)]),
    ("Phi",     "Φ", "#ffd0c4", "each"),
    ("Omega",   "Ω", "#cfe2ff", [(480, 500, 98), (745, 500, 98)]),
]
LOWER = [
    ("Alpha",   "α", "auto"),
    ("Beta",    "β", "each"),
    ("Delta",   "δ", "auto"),
    ("Lambda",  "λ", [(525, 270, 48), (695, 270, 48)]),
    ("Omicron", "ο", "auto"),
    ("Sigma",   "σ", "auto"),
    ("Upsilon", "υ", [(440, 420, 85), (760, 420, 85)]),
    ("Phi",     "φ", "each"),
    ("Omega",   "ω", [(340, 290, 80), (870, 290, 80)]),
]
# Pills are tall, so open-space letters get their own pill positions (original coordinates, r is the pill's base size)
PILL_MANUAL = {
    "lambda": [(520, 500, 80), (700, 500, 80)],
    "sigma": [(800, 590, 90), (940, 590, 90)],
    "upsilon": [(545, 900, 75), (675, 900, 75)],
    "omega": [(480, 500, 90), (745, 500, 90)],
    "omega-lower": [(340, 290, 66), (870, 290, 66)],
}
colour_of = {n: c for n, _, c, _ in UPPER}
CHARS = [(n, ch, c, how, n.lower()) for n, ch, c, how in UPPER] + [(n, ch, colour_of[n], how, n.lower() + "-lower") for n, ch, how in LOWER]


class FlatPen(BasePen):
    """Collects an outline as polygons, sampling the curves."""
    def __init__(self, gs):
        super().__init__(gs); self.contours = []; self.cur = []
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _curveToOne(self, a, b, c):
        p0 = self.cur[-1]
        for i in range(1, 13):
            t = i / 12; u = 1 - t
            self.cur.append((u**3*p0[0] + 3*u*u*t*a[0] + 3*u*t*t*b[0] + t**3*c[0], u**3*p0[1] + 3*u*u*t*a[1] + 3*u*t*t*b[1] + t**3*c[1]))
    def _qCurveToOne(self, a, c):
        p0 = self.cur[-1]
        for i in range(1, 11):
            t = i / 10; u = 1 - t
            self.cur.append((u*u*p0[0] + 2*u*t*a[0] + t*t*c[0], u*u*p0[1] + 2*u*t*a[1] + t*t*c[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.contours.append(self.cur)
        self.cur = []
    _endPath = _closePath


def signed_area(pts):
    return sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts))) / 2


def glyph_geometry(gs, gn):
    pen = FlatPen(gs); gs[gn].draw(pen)
    cs = sorted(pen.contours, key=lambda c: -abs(signed_area(c)))
    outer_sign = 1 if signed_area(cs[0]) > 0 else -1
    add = [Polygon(c).buffer(0) for c in cs if (signed_area(c) > 0) == (outer_sign > 0)]
    sub = [Polygon(c).buffer(0) for c in cs if (signed_area(c) > 0) != (outer_sign > 0)]
    g = unary_union(add)
    if sub: g = g.difference(unary_union(sub))
    return g


def round_corners(g):
    g = g.buffer(ROUND, join_style=1, quad_segs=8).buffer(-ROUND, join_style=1, quad_segs=8)   # round the inside corners
    g = g.buffer(-ROUND, join_style=1, quad_segs=8).buffer(ROUND, join_style=1, quad_segs=8)   # round the outside corners
    return g.simplify(1.0, preserve_topology=True)


def polys_of(g): return list(g.geoms) if g.geom_type == "MultiPolygon" else [g]


def to_path(g):
    parts = []
    for p in polys_of(g):
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            parts.append("M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in pts) + "Z")
    return "".join(parts)


def holes_of(g): return [Polygon(r) for p in polys_of(g) for r in p.interiors]


def dot_shape(x, y, r): return Point(x, y).buffer(r, 16)
def pill_shape(x, y, r):
    w, h = r * 1.2, r * 2.7
    return LineString([(x, y - (h - w) / 2), (x, y + (h - w) / 2)]).buffer(w / 2, 12)


def fit_pair(hole, shape, spread, rmax):
    """Two eyes side by side in one counter: the largest that fit, set low in it."""
    inner = hole.buffer(-GAP)
    minx, miny, maxx, maxy = inner.bounds
    cx = hole.centroid.x
    ty = hole.centroid.y - (maxy - miny) * LOW
    best = None
    ys = [miny + (maxy - miny) * i / 30 for i in range(1, 30)]
    for r in range(rmax, 20, -3):
        for y in ys:
            for s in spread(r):
                a, b = shape(cx - s, y, r), shape(cx + s, y, r)
                if inner.contains(a) and inner.contains(b):
                    score = r * 10 - abs(y - ty) * 0.3
                    if best is None or score > best[0]: best = (score, r, y, s)
        if best: break
    if not best: return None
    _, r, y, s = best
    return [(cx - s, y, r), (cx + s, y, r)]


def fit_each(holes, shape, rmax):
    """One eye per counter, all the same size, set low in each."""
    cands = []
    for hole in holes:
        inner = hole.buffer(-GAP)
        minx, miny, maxx, maxy = inner.bounds
        cands.append((hole, inner, minx, miny, maxx, maxy))
    for r in range(rmax, 20, -3):
        picks = []
        for hole, inner, minx, miny, maxx, maxy in cands:
            c = hole.centroid; ty = c.y - (maxy - miny) * LOW; best = None
            for i in range(0, 21):
                for j in range(0, 21):
                    x = minx + (maxx - minx) * i / 20; y = miny + (maxy - miny) * j / 20
                    if inner.contains(shape(x, y, r)):
                        d = (x - c.x) ** 2 + (y - ty) ** 2
                        if best is None or d < best[0]: best = (d, x, y)
            if not best: break
            picks.append((best[1], best[2], r))
        else:
            return picks
    return None


dots_spread = lambda r: [r * f for f in (1.15, 1.3, 1.45)]
pill_spread = lambda r: [r * f for f in (0.95, 1.1, 1.25)]

f = TTFont(FONT)
cmap, gs = f.getBestCmap(), f.getGlyphSet()

STYLE = """<style>.eye{transform-box:fill-box;transform-origin:center;animation:blink 5.5s infinite}
.eye:nth-of-type(2){animation-delay:.07s}@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@media (prefers-reduced-motion:reduce){.eye{animation:none}}</style>"""


def eye(x, y, r, i):
    return (f'<g class="eye"><circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="#111"/>'
            f'<circle cx="{x + r*0.32:.0f}" cy="{y + r*0.34:.0f}" r="{r*0.3:.0f}" fill="#fff"/></g>')


def eye_wide(x, y, r, i):
    pr = r * 0.58
    return (f'<g class="eye"><circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="#fff" stroke="#111" stroke-width="{r*0.16:.0f}"/>'
            f'<circle cx="{x + r*0.2:.0f}" cy="{y + r*0.12:.0f}" r="{pr:.0f}" fill="#111"/>'
            f'<circle cx="{x + r*0.2 + pr*0.34:.0f}" cy="{y + r*0.12 + pr*0.36:.0f}" r="{pr*0.28:.0f}" fill="#fff"/></g>')


def eye_pill(x, y, r, i):
    w, h = r * 1.2, r * 2.7
    return f'<g class="eye"><rect x="{x - w/2:.0f}" y="{y - h/2:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{w/2:.0f}" fill="#111"/></g>'


EYE_SETS = [("", eye), ("-wide", eye_wide), ("-pill", eye_pill)]

meta, lib = [], []
for name, ch, colour, how, slug in CHARS:
    g0 = glyph_geometry(gs, cmap[ord(ch)])
    x0, y0, x1, y1 = g0.bounds
    cx = (x0 + x1) / 2
    k = max(K_MIN, min(K_MAX, TARGET_W / (x1 - x0)))
    g = round_corners(affinity.scale(g0, xfact=k, yfact=1, origin=(cx, 0)))
    tx = lambda x: cx + (x - cx) * k      # hand-placed eyes follow the sideways scaling
    gx0, gy0, gx1, gy1 = g.bounds

    if how == "auto":
        hole = max(holes_of(g), key=lambda h: h.area)
        dots = fit_pair(hole, dot_shape, dots_spread, 120)
        pills = fit_pair(hole, pill_shape, pill_spread, 120)
    elif how == "each":
        hs = sorted(holes_of(g), key=lambda h: -h.centroid.y)
        if len(hs) == 1:      # this letter has only one closed counter (lowercase beta, phi): use a pair there
            dots = fit_pair(hs[0], dot_shape, dots_spread, 120)
            pills = fit_pair(hs[0], pill_shape, pill_spread, 120)
        else:
            dots = fit_each(hs, dot_shape, 120)
            pills = fit_each(hs, pill_shape, 120)
    else:
        dots = [(tx(x), y, r) for x, y, r in how]
        pills = [(tx(x), y, r) for x, y, r in PILL_MANUAL.get(slug, how)]
    assert dots and pills, slug

    d = to_path(g)
    w, h = gx1 - gx0 + 2 * PAD, gy1 - gy0 + 2 * PAD
    vb = f"{gx0 - PAD:.0f} {-(gy1 + PAD):.0f} {w:.0f} {h:.0f}"
    plain = f'<g transform="scale(1,-1)"><path d="{d}" fill="#111"/></g>'
    (OUT / f"{slug}-plain.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{name}, letter only">{plain}</svg>\n')
    for suffix, fn in EYE_SETS:
        use = pills if suffix == "-pill" else dots
        body = f'<g transform="scale(1,-1)"><path d="{d}" fill="#111"/>{"".join(fn(*e, i) for i, e in enumerate(use))}</g>'
        (OUT / f"{slug}{suffix}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{name}">{STYLE}{body}</svg>\n')
        S = 512; kk = (S * 0.62) / (gy1 - gy0)
        kk = min(kk, (S * 0.62) / (gx1 - gx0) * 1.15)
        tx_ = S / 2 - (gx0 + gx1) / 2 * kk; ty_ = S / 2 + (gy0 + gy1) / 2 * kk
        (OUT / f"{slug}{suffix}-tile.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="{name}">{STYLE}'
            f'<rect width="{S}" height="{S}" fill="{colour}"/><g transform="translate({tx_:.1f} {ty_:.1f}) scale({kk:.5f})">{body}</g></svg>\n')
    rnd = lambda es: [[round(x), round(y), round(r)] for x, y, r in es]
    meta.append(dict(name=name, letter=ch, colour=colour, slug=slug, lower=slug.endswith("-lower"), w=int(w), h=int(h), vb=vb, d=d, eyes=rnd(dots), pillEyes=rnd(pills)))
    # polygon rings for the 3D library: [outer, hole, hole...] per polygon, y up, centred on the letter
    mx, my = (gx0 + gx1) / 2, (gy0 + gy1) / 2
    polys = [[[[round(x - mx), round(y - my)] for x, y in list(r.coords)[:-1]] for r in [p.exterior, *p.interiors]] for p in polys_of(g)]
    lib.append(dict(id=slug, name=name, letter=ch, lower=slug.endswith("-lower"), colour=colour, w=round(gx1 - gx0), h=round(gy1 - gy0),
                    polys=polys, dots=[[round(x - mx), round(y - my), round(r)] for x, y, r in dots], pills=[[round(x - mx), round(y - my), round(r)] for x, y, r in pills]))
    print(f"{slug:14} k={k:.2f} width={gx1-gx0:.0f}")

ts = ("/** Generated by scripts/make-glyphlings.py. Greek letters from Courier New Regular, similar widths, rounded corners, with eyes. */\n"
      "export type Glyphling = { name: string; letter: string; colour: string; slug: string; lower: boolean; w: number; h: number; vb: string; d: string; eyes: [number, number, number][]; pillEyes: [number, number, number][] | null };\n"
      "export const glyphlings: Glyphling[] = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
(ROOT / "src/lib/glyphlings.ts").write_text(ts)
(LIB / "index.json").write_text(json.dumps(lib, ensure_ascii=False, separators=(",", ":")))
print("wrote", len(meta), "characters;", len(ts) // 1024, "KB;", (LIB / "index.json").stat().st_size // 1024, "KB library json")
