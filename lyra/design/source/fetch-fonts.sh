#!/bin/sh
# Downloads the two free Google Fonts the screens use into ./fonts and writes fonts/local.css.
set -e
mkdir -p fonts
curl -sS -A 'Wget/1.21' 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Schibsted+Grotesk:wght@500;700;800' -o fonts/fonts.css
python3 - <<'PY'
import re, subprocess
css = open('fonts/fonts.css').read()
out = []
for fam, w, url in re.findall(r"font-family: '([^']+)';.*?font-weight: (\d+);.*?url\(([^)]+)\)", css, flags=re.S):
    name = fam.replace(' ', '') + '-' + w + '.ttf'
    subprocess.run(['curl', '-sS', '-o', 'fonts/' + name, url], check=True)
    out.append(f"@font-face {{ font-family: '{fam}'; font-weight: {w}; src: url('fonts/{name}') format('truetype'); }}")
open('fonts/local.css', 'w').write('\n'.join(out) + '\n')
PY
