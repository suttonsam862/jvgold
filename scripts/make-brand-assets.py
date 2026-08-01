#!/usr/bin/env python3
"""
JV Gold — brand asset generator.

Regenerates every favicon / app icon / Open Graph image in /public from the
source art committed to the repo. Deterministic: run it again and you get
byte-comparable output.

    python3 scripts/make-brand-assets.py

Requires only Pillow (`python3 -c "import PIL"`). No network, no CDN, no new
npm packages — everything is built from files already in the repo plus macOS
system fonts (Futura), which are only used at *raster* time, so the shipped
PNGs carry no font dependency.

Outputs
  public/favicon.svg              vector JV monogram, traced from the logotype
  public/favicon.ico              16/32/48 multi-resolution
  public/icon-32.png              browser tab / bookmark
  public/icon-180.png             apple-touch-icon
  public/icon-192.png             android / PWA manifest
  public/icon-512.png             android / PWA manifest, maskable-safe padding
  public/og/default.png           1200x630 site share card
  public/og/future-champions.png  1200x630 Future Champions share card

Design notes
  - The favicon is cropped tight to the JV monogram only. Shrinking the full
    "JV GOLD" logotype to 32px turns the wordmark to mush; the monogram alone
    stays legible.
  - Brand colours are read from app/styles/jvgold.css by eye and hard-coded
    below; if the palette changes there, change it here too.
"""

from __future__ import annotations

import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")

# --- palette (mirrors app/styles/jvgold.css) --------------------------------
ONYX = (26, 26, 26)
ONYX_DEEP = (17, 17, 17)
GOLD = (200, 162, 91)
GOLD_DEEP = (168, 133, 63)
STONE = (230, 227, 221)
FC_GREEN = (0, 220, 127)
FC_VOID = (17, 17, 17)
FC_INK = (0, 0, 0)
FC_CHALK = (244, 244, 244)

FUTURA = "/System/Library/Fonts/Supplemental/Futura.ttc"
F_BOLD = 2          # Futura Bold
F_COND_XBOLD = 4    # Futura Condensed ExtraBold
F_MEDIUM = 0        # Futura Medium


def font(index: int, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FUTURA, size, index=index)


def hexs(rgb) -> str:
    return "#%02X%02X%02X" % rgb


# ---------------------------------------------------------------------------
# 1. Source monogram
# ---------------------------------------------------------------------------

def _largest_shapes(alpha: Image.Image, keep: int) -> Image.Image:
    """Keep only the `keep` largest connected blobs of an alpha mask.

    The source logotype carries a few stray specks and a tiny registration
    glyph beside the V; at 32px they read as dirt, so they are dropped.
    """
    w, h = alpha.size
    px = list(alpha.getdata())
    on = [v > 20 for v in px]
    lab = [0] * (w * h)
    blobs = []
    cur = 0
    for i in range(w * h):
        if not on[i] or lab[i]:
            continue
        cur += 1
        stack = [i]
        lab[i] = cur
        members = []
        while stack:
            j = stack.pop()
            members.append(j)
            y, x = divmod(j, w)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        k = ny * w + nx
                        if on[k] and not lab[k]:
                            lab[k] = cur
                            stack.append(k)
        blobs.append((len(members), cur))
    blobs.sort(reverse=True)
    survivors = {c for _, c in blobs[:keep]}
    out = [px[i] if lab[i] in survivors else 0 for i in range(w * h)]
    img = Image.new("L", (w, h))
    img.putdata(out)
    return img


def jv_monogram(size: int, color=GOLD) -> Image.Image:
    """Tightly-cropped JV monogram (no 'GOLD' wordmark), recoloured, RGBA."""
    src = Image.open(os.path.join(PUB, "brand", "jv-gold-logo-gold.png")).convert("RGBA")
    # The logotype is 760x348; the JV mark ends at x=550, the letterspaced
    # "G O L D" runs from x=573 to the right edge.
    mark = src.crop((0, 0, 550, 348))
    mark.putalpha(_largest_shapes(mark.split()[3], keep=2))
    mark = mark.crop(mark.getbbox())
    alpha = mark.split()[3]
    w, h = mark.size
    scale = size / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    alpha = alpha.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (nw, nh), color + (0,))
    out.putalpha(alpha)
    return out


# ---------------------------------------------------------------------------
# 2. favicon.svg — marching-squares trace of the monogram alpha channel
# ---------------------------------------------------------------------------

def _marching_squares(mask, w: int, h: int, level=0.5):
    """Return closed contours (lists of (x, y)) around mask>=level."""

    def v(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return 0.0
        return mask[y * w + x]

    def interp(p, q, vp, vq):
        if vq == vp:
            t = 0.5
        else:
            t = (level - vp) / (vq - vp)
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

    segs = []
    for y in range(-1, h):
        for x in range(-1, w):
            tl, tr = v(x, y), v(x + 1, y)
            bl, br = v(x, y + 1), v(x + 1, y + 1)
            idx = (tl >= level) * 8 + (tr >= level) * 4 + (br >= level) * 2 + (bl >= level) * 1
            if idx in (0, 15):
                continue
            P = (x + 0.5, y + 0.5)
            Q = (x + 1.5, y + 0.5)
            R = (x + 1.5, y + 1.5)
            S = (x + 0.5, y + 1.5)
            top = interp(P, Q, tl, tr)
            right = interp(Q, R, tr, br)
            bottom = interp(S, R, bl, br)
            left = interp(P, S, tl, bl)
            table = {
                1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)],
                4: [(right, top)], 5: [(left, top), (bottom, right)],
                6: [(bottom, top)], 7: [(left, top)], 8: [(top, left)],
                9: [(top, bottom)], 10: [(top, right), (bottom, left)],
                11: [(top, right)], 12: [(right, left)], 13: [(right, bottom)],
                14: [(bottom, left)],
            }
            segs.extend(table[idx])

    # chain segments into closed loops
    def key(p):
        return (round(p[0], 3), round(p[1], 3))

    adj = {}
    for a, b in segs:
        ka, kb = key(a), key(b)
        adj.setdefault(ka, []).append((kb, b))

    contours = []
    while adj:
        start = next(iter(adj))
        loop = [start]
        cur = start
        guard = 0
        while guard < 1000000:
            guard += 1
            nxt = adj.get(cur)
            if not nxt:
                break
            kb, _b = nxt.pop()
            if not nxt:
                del adj[cur]
            loop.append(kb)
            cur = kb
            if cur == start:
                break
        if len(loop) > 8:
            contours.append(loop)
    return contours


def _rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = math.hypot(dx, dy) or 1e-9
    imax, dmax = 0, 0.0
    for i in range(1, len(points) - 1):
        p = points[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / norm
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        return _rdp(points[: imax + 1], eps)[:-1] + _rdp(points[imax:], eps)
    return [a, b]


def _rdp_closed(loop, eps):
    """RDP for a closed ring: split at the point farthest from the seed first,
    otherwise the start==end chord is degenerate and everything collapses."""
    if loop[0] == loop[-1]:
        loop = loop[:-1]
    if len(loop) < 4:
        return loop
    a = loop[0]
    far = max(range(len(loop)), key=lambda i: (loop[i][0] - a[0]) ** 2 + (loop[i][1] - a[1]) ** 2)
    first = _rdp(loop[: far + 1], eps)
    second = _rdp(loop[far:] + [a], eps)
    return first[:-1] + second[:-1]


def build_favicon_svg(path: str) -> None:
    mark = jv_monogram(256)
    a = mark.split()[3]
    w, h = a.size
    mask = [p / 255.0 for p in a.getdata()]
    contours = _marching_squares(mask, w, h)

    # normalise into a 100x100 viewBox with the mark inset on a rounded square
    inset, box = 22.0, 100.0
    avail = box - inset * 2
    s = avail / max(w, h)
    ox = (box - w * s) / 2
    oy = (box - h * s) / 2

    paths = []
    for c in contours:
        c = _rdp_closed(c, 0.9)
        if len(c) < 3:
            continue
        pts = [(ox + x * s, oy + y * s) for (x, y) in c]
        d = "M" + " L".join("%.2f %.2f" % p for p in pts) + " Z"
        paths.append(d)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="JV Gold">
  <title>JV Gold</title>
  <rect width="100" height="100" rx="20" fill="{hexs(ONYX_DEEP)}"/>
  <rect x="0.5" y="0.5" width="99" height="99" rx="19.5" fill="none" stroke="{hexs(GOLD_DEEP)}" stroke-opacity="0.45"/>
  <g fill="{hexs(GOLD)}" fill-rule="evenodd">
    <path d="{' '.join(paths)}"/>
  </g>
</svg>
"""
    with open(path, "w") as f:
        f.write(svg)
    print("wrote", path, f"({len(paths)} contours)")


# ---------------------------------------------------------------------------
# 3. Raster icons
# ---------------------------------------------------------------------------

def icon(size: int, pad_ratio=0.20, radius_ratio=0.20, square=False) -> Image.Image:
    """Onyx rounded-square tile with the gold JV monogram centred."""
    ss = 8  # supersample
    S = size * ss
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    r = 0 if square else int(S * radius_ratio)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=ONYX_DEEP + (255,))
    # hairline gold rule, echoing the site's rule-light borders
    line = max(1, int(S * 0.008))
    d.rounded_rectangle(
        [line, line, S - 1 - line, S - 1 - line],
        radius=max(0, r - line),
        outline=GOLD_DEEP + (120,),
        width=line,
    )
    mark = jv_monogram(int(S * (1 - pad_ratio * 2)))
    tile.alpha_composite(mark, ((S - mark.width) // 2, (S - mark.height) // 2))
    return tile.resize((size, size), Image.LANCZOS)


def build_icons() -> None:
    for size, pad in ((32, 0.14), (180, 0.20), (192, 0.20)):
        p = os.path.join(PUB, f"icon-{size}.png")
        icon(size, pad_ratio=pad).save(p, optimize=True)
        print("wrote", p)
    # 512 keeps extra breathing room so Android maskable cropping is safe
    p = os.path.join(PUB, "icon-512.png")
    icon(512, pad_ratio=0.26).save(p, optimize=True)
    print("wrote", p)

    ico = os.path.join(PUB, "favicon.ico")
    base = icon(64, pad_ratio=0.12)
    base.save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote", ico)


# ---------------------------------------------------------------------------
# 4. Open Graph cards
# ---------------------------------------------------------------------------

W, H = 1200, 630


def tracked_text(draw, xy, text, fnt, fill, tracking=0):
    """Draw letterspaced text. Returns total advance width."""
    x, y = xy
    total = 0
    for ch in text:
        draw.text((x + total, y), ch, font=fnt, fill=fill)
        total += draw.textlength(ch, font=fnt) + tracking
    return total - tracking if text else 0



def new_overlay():
    """ImageDraw replaces pixels rather than blending, so anything drawn with
    a partial alpha has to go on its own layer and be composited."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer)


def cover(im: Image.Image, w: int, h: int, focus=(0.5, 0.42)) -> Image.Image:
    ratio = max(w / im.width, h / im.height)
    nw, nh = math.ceil(im.width * ratio), math.ceil(im.height * ratio)
    im = im.resize((nw, nh), Image.LANCZOS)
    cx = min(max(int(nw * focus[0] - w / 2), 0), nw - w)
    cy = min(max(int(nh * focus[1] - h / 2), 0), nh - h)
    return im.crop((cx, cy, cx + w, cy + h))


def linear_scrim(w, h, stops):
    """Horizontal alpha gradient. stops = [(pos 0..1, alpha 0..255), ...]"""
    grad = Image.new("L", (w, 1))
    px = grad.load()
    for x in range(w):
        t = x / (w - 1)
        for i in range(len(stops) - 1):
            p0, a0 = stops[i]
            p1, a1 = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                k = k * k * (3 - 2 * k)  # smoothstep
                px[x, 0] = int(a0 + (a1 - a0) * k)
                break
        else:
            px[x, 0] = stops[-1][1]
    return grad.resize((w, h))


def build_og_default() -> None:
    photo = Image.open(os.path.join(PUB, "img", "hero", "20CIFFNL3798.jpg")).convert("RGB")
    base = cover(photo, W, H, focus=(0.46, 0.40))
    # monochrome, warmed slightly toward stone — matches .img-mono on the site
    g = ImageOps.grayscale(base)
    g = ImageOps.autocontrast(g, cutoff=1)
    base = ImageOps.colorize(g, black=(14, 13, 12), white=(236, 233, 227)).convert("RGB")
    base = Image.blend(base, Image.new("RGB", (W, H), ONYX_DEEP), 0.18)

    canvas = base.convert("RGBA")
    # editorial scrim: solid onyx at the left, clearing across the subject
    scrim = Image.new("RGBA", (W, H), ONYX_DEEP + (255,))
    scrim.putalpha(linear_scrim(W, H, [(0.0, 252), (0.36, 236), (0.62, 120), (1.0, 40)]))
    canvas.alpha_composite(scrim)
    # bottom weight so the type never floats on a bright patch
    bottom = Image.new("RGBA", (W, H), ONYX_DEEP + (255,))
    bg = Image.new("L", (1, H))
    for y in range(H):
        t = y / (H - 1)
        bg.putpixel((0, y), int(200 * max(0.0, (t - 0.55) / 0.45) ** 1.6))
    bottom.putalpha(bg.resize((W, H)))
    canvas.alpha_composite(bottom)

    d = ImageDraw.Draw(canvas)
    M = 84  # margin

    # gold JV mark, top left
    mark = jv_monogram(74)
    canvas.alpha_composite(mark, (M, M - 6))

    # hairline rule under the mark
    ry = M - 6 + mark.height + 46
    d.line([(M, ry), (M + 132, ry)], fill=GOLD + (255,), width=2)

    # micro-label
    lab = font(F_MEDIUM, 21)
    tracked_text(d, (M, ry + 30), "RIVERSIDE, CALIFORNIA", lab, GOLD + (255,), tracking=5.2)

    # name — big, confident, condensed
    name = font(F_COND_XBOLD, 118)
    d.text((M - 4, ry + 74), "JESSE", font=name, fill=STONE + (255,))
    d.text((M - 4, ry + 74 + 108), "VASQUEZ", font=name, fill=STONE + (255,))

    # kicker
    sub = font(F_BOLD, 26)
    y2 = ry + 74 + 108 + 128
    tracked_text(d, (M, y2), "4X CALIFORNIA STATE CHAMPION", sub, GOLD + (255,), tracking=1.6)
    body = font(F_MEDIUM, 25)
    d.text((M, y2 + 38), "Pac-12 Champion  ·  Coach  ·  Founder", font=body, fill=(196, 193, 187, 255))

    # thin gold frame — a print-poster edge, not a card shadow
    ov, od = new_overlay()
    od.rectangle([28, 28, W - 29, H - 29], outline=GOLD_DEEP + (120,), width=1)
    canvas.alpha_composite(ov)

    out = os.path.join(PUB, "og", "default.png")
    canvas.convert("RGB").save(out, optimize=True)
    print("wrote", out)


def build_og_fc() -> None:
    canvas = Image.new("RGBA", (W, H), FC_VOID + (255,))
    d = ImageDraw.Draw(canvas)

    crest_cx, crest_cy = W - 300, H // 2

    # faint mat grid + a thin ring concentric with the crest
    ov, od = new_overlay()
    for x in range(0, W, 72):
        od.line([(x, 0), (x, H)], fill=(255, 255, 255, 12), width=1)
    for y in range(0, H, 72):
        od.line([(0, y), (W, y)], fill=(255, 255, 255, 12), width=1)
    od.ellipse(
        [crest_cx - 252, crest_cy - 252, crest_cx + 252, crest_cy + 252],
        outline=FC_GREEN + (60,), width=1,
    )
    canvas.alpha_composite(ov)

    # one soft green bloom behind the crest — depth, not gloss
    bloom = Image.new("L", (W, H), 0)
    bd = ImageDraw.Draw(bloom)
    bd.ellipse([crest_cx - 190, crest_cy - 190, crest_cx + 190, crest_cy + 190], fill=52)
    bloom = bloom.filter(ImageFilter.GaussianBlur(110))
    tint = Image.new("RGBA", (W, H), FC_GREEN + (255,))
    tint.putalpha(bloom)
    canvas.alpha_composite(tint)

    # crest — the source art is black line work for light grounds, so it is
    # recoloured to chalk and sits on the void.
    crest_src = Image.open(os.path.join(PUB, "fc", "fc-crest-mono.png")).convert("RGBA")
    ch = 420
    cw = round(crest_src.width * ch / crest_src.height)
    ca = crest_src.split()[3].resize((cw, ch), Image.LANCZOS)
    crest = Image.new("RGBA", (cw, ch), FC_CHALK + (0,))
    crest.putalpha(ca)
    canvas.alpha_composite(crest, (crest_cx - cw // 2, crest_cy - ch // 2))

    M = 84
    lab = font(F_MEDIUM, 21)
    tracked_text(d, (M, M + 6), "FUTURE CHAMPIONS", lab, FC_GREEN + (255,), tracking=6.0)
    d.line([(M, M + 48), (M + 118, M + 48)], fill=FC_GREEN + (255,), width=2)

    big = font(F_COND_XBOLD, 132)
    d.text((M - 5, M + 88), "GREATER", font=big, fill=FC_CHALK + (255,))
    d.text((M - 5, M + 88 + 122), "LATER", font=big, fill=FC_GREEN + (255,))

    body = font(F_MEDIUM, 26)
    d.text((M, M + 88 + 122 + 158), "Youth wrestling club  ·  Riverside, CA", font=body, fill=(200, 205, 202, 255))

    ov2, od2 = new_overlay()
    od2.rectangle([28, 28, W - 29, H - 29], outline=FC_GREEN + (90,), width=1)
    canvas.alpha_composite(ov2)

    out = os.path.join(PUB, "og", "future-champions.png")
    canvas.convert("RGB").save(out, optimize=True)
    print("wrote", out)


if __name__ == "__main__":
    os.makedirs(os.path.join(PUB, "og"), exist_ok=True)
    build_favicon_svg(os.path.join(PUB, "favicon.svg"))
    build_icons()
    build_og_default()
    build_og_fc()
