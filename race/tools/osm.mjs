// Tiny OpenStreetMap XML reader (nodes, ways and their tags) for the track builder.
// Map data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
import fs from 'node:fs';

export function readOsm(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const nodes = new Map(), ways = [];
  const nodeRe = /<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const tags = {};
    if (m[5]) for (const t of m[5].matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)) tags[t[1]] = t[2];
    nodes.set(m[1], { id: m[1], lat: +m[2], lon: +m[3], tags });
  }
  const wayRe = /<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml))) {
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map(r => r[1]);
    const tags = {};
    for (const t of m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)) tags[t[1]] = decode(t[2]);
    ways.push({ id: m[1], refs, tags });
  }
  return { nodes, ways };
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
