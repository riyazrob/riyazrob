import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = process.argv[2];
if (!outputDir) throw new Error('Pass the generated SVG output directory');

const files = readdirSync(outputDir).filter((name) => /^github-contribution-grid-snake.*\.svg$/.test(name));
if (files.length === 0) throw new Error(`No contribution SVGs found in ${outputDir}`);

for (const name of files) {
  const path = join(outputDir, name);
  let svg = readFileSync(path, 'utf8');
  const pattern = /<rect class="c(?: c\d+)?" x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)"/g;
  const cells = [...svg.matchAll(pattern)];
  if (cells.length === 0) throw new Error(`No contribution cells found in ${name}`);

  const positions = new Set(cells.map(([, x, y]) => `${Number(x)},${Number(y)}`));
  const xs = [...new Set(cells.map(([, x]) => Number(x)))].sort((a, b) => a - b);
  const ys = [...new Set(cells.map(([, , y]) => Number(y)))].sort((a, b) => a - b);
  const lastX = xs.at(-1);
  const missing = ys.filter((y) => !positions.has(`${lastX},${y}`));

  if (missing.length) {
    const insertion = svg.search(/<rect class="u(?:\s|")|<rect class="s(?:\s|")/);
    if (insertion < 0) throw new Error(`Could not find grid insertion point in ${name}`);
    const padding = missing
      .map((y) => `<rect class="c" x="${lastX}" y="${y}" rx="2" ry="2"/>`)
      .join('');
    svg = `${svg.slice(0, insertion)}${padding}${svg.slice(insertion)}`;
    writeFileSync(path, svg);
  }

  const finalCells = [...svg.matchAll(pattern)];
  const finalPositions = new Set(finalCells.map(([, x, y]) => `${Number(x)},${Number(y)}`));
  const expected = xs.length * ys.length;
  if (finalPositions.size !== expected) {
    throw new Error(`${name}: expected ${expected} unique cells, got ${finalPositions.size}`);
  }
  console.log(`${name}: complete ${xs.length}x${ys.length} grid; added ${missing.length} neutral cells`);
}
