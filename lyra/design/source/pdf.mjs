// Prints brief.html to a vector PDF (text and SVG stay vector; fonts embedded).
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const b = await pw.chromium.launch();
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/brief.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.pdf({
  path: process.argv[2] || 'Lyra-Brief.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font:7pt sans-serif;color:#77756e;padding:0 15mm;display:flex;justify-content:space-between"><span>Lyra · Brief for Incheon Techno Park</span><span class="pageNumber"></span></div>',
});
// preview pages as PNG for a visual check
await p.setViewportSize({ width: 794, height: 1123 });
await p.emulateMedia({ media: 'print' });
await p.screenshot({ path: 'brief-preview.png', fullPage: false });
await b.close();
console.log('pdf ok');
