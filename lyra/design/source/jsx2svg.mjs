import ts from '/opt/node22/lib/node_modules/typescript/lib/typescript.js';
import fs from 'fs';
const TOK = { '--cds-text-primary': '#1b1b1b', '--cds-text-secondary': '#55544f', '--cds-chart-axis': '#6b6a64', '--cds-chart-grid': '#b9b7ae', '--cds-chart-categorical-1': '#1b1b1b', '--cds-chart-reference-tint': '#e8e7e1' };
const KEEP = new Set(['viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = (v) => String(v).replace(/var\((--[a-z0-9-]+)\)/g, (_, k) => TOK[k]);
function h(tag, props, ...kids) {
  const a = Object.entries(props || {}).filter(([k]) => !k.startsWith('data-claude') && k !== 'role' && k !== 'aria-label')
    .map(([k, v]) => `${KEEP.has(k) ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${esc(col(v))}"`).join(' ');
  const body = kids.flat(9).map((c) => (typeof c === 'string' && !c.startsWith('<') ? esc(c) : c)).join('');
  if (tag === 'svg') return `<svg xmlns="http://www.w3.org/2000/svg" ${a} font-family="'Noto Sans KR', sans-serif">${body}</svg>`;
  return `<${tag}${a ? ' ' + a : ''}>${body}</${tag}>`;
}
for (const n of ['agvika', 'plan']) {
  const js = ts.transpileModule(fs.readFileSync(n + '.jsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: '__h', module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} }; new Function('module', 'exports', '__h', js)(m, m.exports, h);
  let svg = m.exports.default();
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  svg = svg.replace('<svg ', `<svg width="${vb[1]}" height="${vb[2]}" `);
  fs.writeFileSync(`../out/Lyra-Diagram-${n}.svg`, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
  console.log(n, svg.length);
}
