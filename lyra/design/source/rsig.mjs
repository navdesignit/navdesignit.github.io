// Renders the Signature screens in Korean and English: SVG, PNG (2x), and a board.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'fs';
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 2 });
await p.goto('file://' + process.cwd() + '/screens2.html');
await p.evaluate(() => document.fonts.ready);
const shoot = async (svg, path) => { await p.evaluate((s) => { document.body.innerHTML = `<div id="w" style="display:inline-block">${s}</div>`; }, svg); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(80); await (await p.$('#w svg')).screenshot({ path }); };
for (const lang of ['ko', 'en']) {
  const d = `sig/${lang}`; fs.mkdirSync(`${d}/svg`, { recursive: true }); fs.mkdirSync(`${d}/png`, { recursive: true });
  await p.evaluate((l) => { window.LANG = l; }, lang);
  const names = await p.evaluate(() => window.names.filter((n) => n.startsWith('S')));
  for (const n of names) { const svg = await p.evaluate((n) => window.render(n), n); fs.writeFileSync(`${d}/svg/lyra-${n}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg); await shoot(svg, `${d}/png/lyra-${n}.png`); }
  const board = await p.evaluate(() => window.sigBoard());
  fs.writeFileSync(`sig/Lyra-Signature-${lang}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n' + board);
  await shoot(board, `sig/Lyra-Signature-${lang}.png`);
  console.log(lang, names.length);
}
await b.close();
