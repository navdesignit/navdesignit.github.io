# Builds brief.html: the whole brief with every screen and diagram inline as vector SVG.
import re, markdown

OUT = 'out'
def svg(path, cls=''):
    s = open(path).read()
    s = s[s.index('<svg'):]
    if cls:
        s = s.replace('<svg ', f'<svg class="{cls}" ', 1)
    return s

def crop(s, y, h, w=1760):
    s = re.sub(r'viewBox="[^"]*"', f'viewBox="0 {y} {w} {h}"', s, count=1)
    s = re.sub(r' width="\d+" height="\d+"', f' width="{w}" height="{h}"', s, count=1)
    return s

md = open('brief.md').read().split('\n')
md = '\n'.join(md[3:])  # title and byline go on the cover
md = md.replace('&#91;embedded content: Lyra and Agvika OS · what flows each way\\]', '%%DIAG_agvika%%')
md = md.replace('&#91;embedded content: Proposed plan · 3 phases, 2 gates\\]', '%%DIAG_plan%%')
md = re.sub(r'```latex\n.*?\n```', '%%FORMULA%%', md, flags=re.S)
html = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists'])

html = html.replace('<p>%%DIAG_agvika%%</p>', f'<figure class="diag">{svg(OUT + "/Lyra-Diagram-agvika.svg")}</figure>')
html = html.replace('<p>%%DIAG_plan%%</p>', f'<figure class="diag">{svg(OUT + "/Lyra-Diagram-plan.svg")}</figure>')
html = html.replace('<p>%%FORMULA%%</p>', '<div class="formula">threshold = max( 0.05 g ,&nbsp; 4 × √( 2 · (σ ⁄ √10)² + 2 · p² ) )</div>')

names = ['01-ambient', '02-ambient-dust', '03-near-next', '04-due', '05-partial', '06-complete', '07-not-now', '08-leaving',
         '09-put-back', '10-missed', '11-all-done', '12-ai-supply', '13-ai-outing', '14-ai-week', '15-button-today', '16-button-refill']
html = re.sub(r'<p>&#91;image: [^<]*</p>\s*', '', html)
def shot(m):
    n = int(m.group(1))
    return f'<div class="shot">{svg(f"{OUT}/svg/lyra-{names[n-1]}.svg", "screen")}<p><strong>{n} · {m.group(2)}</p></div>'
html = re.sub(r'<p><strong>(\d+) · (.*?)</p>', shot, html, flags=re.S)
for key, a, b in [('B · Ring.', 'B1-ring-due', 'B2-ring-ambient'), ('C · One thing.', 'C1-one-due', 'C2-one-ambient')]:
    pair = f'<div class="pair">{svg(f"{OUT}/svg/lyra-{a}.svg", "screen")}{svg(f"{OUT}/svg/lyra-{b}.svg", "screen")}</div>'
    html = html.replace(f'<p><strong>{key}', pair + f'<p class="cap"><strong>{key}', 1)
# the map, right after the lead of "Every screen"
html = re.sub(r'(<h2>Every screen</h2>\s*<p>.*?</p>)', lambda m: m.group(1) + f'<figure class="map">{svg(OUT + "/Lyra-Map.svg")}</figure>', html, count=1, flags=re.S)
# status badges in the failure table
for i, st in enumerate(['Tested in simulation', 'In code, not yet tested', 'Designed, not built', 'Cannot detect']):
    html = html.replace(f'<td>{st}</td>', f'<td><span class="st st{i}">{st}</span></td>')

html = html.replace('The statuses are dropdowns. They will move', 'The statuses will move')
kit = svg(OUT + '/Lyra-UI-Kit.svg')
appendix = f'''
<h2>Appendix: the UI system</h2>
<p>The same parts as the UI kit file: the map, the form icons, the tile states and the rules for what shows when.</p>
<figure class="kit">{crop(kit, 180, 610)}</figure>
<figure class="kit">{crop(kit, 790, 280)}</figure>
<figure class="kit">{crop(kit, 1060, 330)}</figure>
<p class="note">Files: every screen as SVG (vector, opens in Adobe Illustrator) and PNG, the UI kit as one SVG artboard, and the two diagrams as SVG. Fonts: Noto Sans KR and Schibsted Grotesk (both free from Google Fonts). Outlined copies need no fonts.</p>
'''
html = html.replace('<h2>Sources</h2>', appendix + '<h2>Sources</h2>')

cover = f'''
<section class="cover">
  <div class="brand">Lyra</div>
  <p class="tag">A medication station that shows what to open,<br>and knows when it was opened.</p>
  <figure class="map">{svg(OUT + "/Lyra-Map.svg")}</figure>
  <p class="meta"><strong>Brief for Incheon Techno Park</strong><br>26 September 2026 · navdesignit</p>
  <p class="meta small">Logic, calculations, failure scenarios, every screen, AI, the link to Agvika OS, and the plan. Estimates are marked as estimates.</p>
</section>'''

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Lyra Brief</title>
<style>{open('fonts/local.css').read()}</style>
<style>
@page {{ size: A4; margin: 16mm 15mm 18mm; }}
:root {{ --ink: #1b1b1b; --paper: #e8e7e1; --quiet: #55544f; --rule: #cfcdc5; }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Noto Sans KR', sans-serif; color: var(--ink); font-size: 9.6pt; line-height: 1.55; margin: 0; }}
h2 {{ font-family: 'Schibsted Grotesk', 'Noto Sans KR', sans-serif; font-weight: 800; font-size: 20pt; line-height: 1.15; margin: 0 0 10pt; break-before: page; letter-spacing: -0.01em; }}
h3 {{ font-family: 'Schibsted Grotesk', 'Noto Sans KR', sans-serif; font-weight: 700; font-size: 12pt; margin: 16pt 0 5pt; break-after: avoid; }}
p {{ margin: 0 0 7pt; }}
ul, ol {{ margin: 0 0 8pt; padding-left: 16pt; }}
li {{ margin: 0 0 3pt; }}
a {{ color: var(--ink); }}
code {{ font-family: 'Schibsted Grotesk', monospace; font-size: 8.4pt; background: #efeee9; padding: 0 2pt; border-radius: 2pt; word-break: break-all; }}
table {{ width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 8.4pt; line-height: 1.4; }}
th {{ text-align: left; font-weight: 700; border-bottom: 1.2pt solid var(--ink); padding: 4pt 5pt; vertical-align: bottom; }}
td {{ border-bottom: 0.6pt solid var(--rule); padding: 4pt 5pt; vertical-align: top; }}
tr {{ break-inside: avoid; }}
.formula {{ font-family: 'Schibsted Grotesk', 'Noto Sans KR', sans-serif; font-size: 12pt; font-weight: 700; padding: 8pt 10pt; margin: 4pt 0 10pt; border-left: 3pt solid var(--ink); background: #f3f2ee; }}
figure {{ margin: 6pt 0 10pt; }}
figure svg {{ width: 100%; height: auto; display: block; }}
.map svg {{ width: 100%; }}
.diag svg {{ width: 100%; }}
.kit svg {{ width: 100%; }}
.shot {{ display: grid; grid-template-columns: 78mm 1fr; gap: 6mm; align-items: start; margin: 0 0 7mm; break-inside: avoid; }}
.shot p {{ margin: 0; }}
svg.screen {{ width: 100%; height: auto; display: block; border: 0.6pt solid #9a9890; }}
.pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin: 4pt 0 6pt; break-inside: avoid; }}
.st {{ display: inline-block; font-size: 7.4pt; font-weight: 700; padding: 1pt 5pt; border-radius: 8pt; white-space: nowrap; }}
.st0 {{ background: var(--ink); color: #fff; }}
.st1 {{ border: 0.8pt solid var(--ink); }}
.st2 {{ border: 0.8pt dashed var(--ink); color: var(--quiet); }}
.st3 {{ background: #e3e1da; color: var(--quiet); }}
.note {{ color: var(--quiet); font-size: 8.6pt; }}
.cover {{ height: 255mm; display: flex; flex-direction: column; justify-content: flex-start; }}
.cover .brand {{ font-family: 'Schibsted Grotesk', sans-serif; font-weight: 800; font-size: 76pt; letter-spacing: -0.03em; line-height: 1; margin-top: 18mm; }}
.cover .tag {{ font-size: 17pt; line-height: 1.35; font-weight: 500; margin: 8mm 0 12mm; }}
.cover .map {{ margin: 0 0 14mm; }}
.cover .meta {{ font-size: 11pt; }}
.cover .meta.small {{ font-size: 9.5pt; color: var(--quiet); max-width: 120mm; }}
</style></head><body>{cover}{html}</body></html>'''
open('brief.html', 'w').write(page)
print('ok', len(page))
