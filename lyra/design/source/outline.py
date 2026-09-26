# Converts <text> in SVG files to outlined <path>s, so the files open in Illustrator
# with no fonts installed. Usage: python3 outline.py in.svg out.svg [...]
import re, sys, html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FILES = {('noto', w): f'fonts/NotoSansKR-{w}.ttf' for w in (400, 500, 700, 900)}
FILES.update({('sch', w): f'fonts/SchibstedGrotesk-{w}.ttf' for w in (500, 700, 800)})
_cache = {}
def font(fam, w):
    ws = (400, 500, 700, 900) if fam == 'noto' else (500, 700, 800)
    w = min(ws, key=lambda x: (abs(x - w), -x))
    k = (fam, w)
    if k not in _cache:
        f = TTFont(FILES[k], lazy=True)
        _cache[k] = (f, f.getGlyphSet(), f.getBestCmap(), f['hmtx'], f['head'].unitsPerEm)
    return _cache[k]

def attr(tag, name, default=None):
    m = re.search(rf'\s{name}="([^"]*)"', tag)
    return m.group(1) if m else default

def outline_text(tag, content, root):
    x, y = float(attr(tag, 'x', 0)), float(attr(tag, 'y', 0))
    size = float(attr(tag, 'font-size', root['size']))
    weight = int(attr(tag, 'font-weight', root['weight']))
    fam = 'sch' if 'Schibsted' in attr(tag, 'font-family', root['family']) else 'noto'
    anchor = attr(tag, 'text-anchor', 'start')
    fill = attr(tag, 'fill', '#1b1b1b')
    tf = attr(tag, 'transform')
    ls = float(attr(tag, 'letter-spacing', 0))
    text = html.unescape(content)
    glyphs, width = [], 0.0
    for ch in text:
        for fa in ([fam, 'noto'] if fam == 'sch' else ['noto']):
            f, gs, cmap, hmtx, upm = font(fa, weight)
            g = cmap.get(ord(ch))
            if g:
                s = size / upm
                glyphs.append((gs, g, width, s))
                width += hmtx[g][0] * s + ls
                break
        else:
            print('  missing glyph', repr(ch), file=sys.stderr)
    if glyphs: width -= ls
    dx = {'start': 0, 'middle': -width / 2, 'end': -width}[anchor]
    parts = []
    for gs, g, off, s in glyphs:
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x + dx + off, y)))
        parts.append(pen.getCommands())
    d = ''.join(parts)
    if not d:
        return ''
    t = f' transform="{tf}"' if tf else ''
    label = html.escape(text, quote=True)
    return f'<path d="{d}" fill="{fill}"{t} data-text="{label}"/>'

def run(src, dst):
    s = open(src).read()
    m = re.search(r'<svg[^>]*>', s)
    rt = m.group(0)
    root = {'size': attr(rt, 'font-size', '16'), 'weight': attr(rt, 'font-weight', '400'), 'family': attr(rt, 'font-family', 'Noto Sans KR')}
    out = re.sub(r'<text([^>]*)>(.*?)</text>', lambda mm: outline_text(mm.group(1), mm.group(2), root), s, flags=re.S)
    open(dst, 'w').write(out)

if __name__ == '__main__':
    args = sys.argv[1:]
    for i in range(0, len(args), 2):
        run(args[i], args[i + 1])
        print('outlined', args[i + 1])
