import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const outputFiles = [];

async function findSvgFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await findSvgFiles(path);
    } else if (/^github-contribution-grid-snake.*\.svg$/.test(entry.name)) {
      outputFiles.push(path);
    }
  }
}

await findSvgFiles(root);
if (outputFiles.length === 0) {
  throw new Error(`No generated contribution SVGs found under ${root}`);
}

for (const path of outputFiles) {
  let svg = await readFile(path, 'utf8');
  const cells = [...svg.matchAll(/<rect class="c(?: c\d+)?" x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)"/g)];
  if (cells.length === 0) {
    throw new Error(`No contribution cells found in ${path}`);
  }

  const positions = new Set(cells.map(([, x, y]) => `${x},${y}`));
  const maxX = Math.max(...cells.map(([, x]) => Number(x)));
  const lastColumnX = cells.find(([, x]) => Number(x) === maxX)[1];
  const rows = [...new Set(cells.map(([, , y]) => y))].sort((a, b) => Number(a) - Number(b));
  const columns = new Set(cells.map(([, x]) => x));
  const missingRows = rows.filter((y) => !positions.has(`${lastColumnX},${y}`));

  if (missingRows.length > 0) {
    const padding = missingRows
      .map((y) => `<rect class="c" x="${lastColumnX}" y="${y}" rx="2" ry="2"/>`)
      .join('');
    const insertionPoint = svg.search(/<rect class="u(?:\s|")|<rect class="s(?:\s|")/);
    if (insertionPoint < 0) {
      throw new Error(`Could not find insertion point in ${path}`);
    }

    svg = `${svg.slice(0, insertionPoint)}${padding}${svg.slice(insertionPoint)}`;
    await writeFile(path, svg, 'utf8');
  }

  const expectedCells = rows.length * columns.size;
  const finalCells = [...svg.matchAll(/<rect class="c(?: c\d+)?" x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)"/g)];
  const finalPositions = new Set(finalCells.map(([, x, y]) => `${x},${y}`));
  if (finalPositions.size !== expectedCells) {
    throw new Error(`${path}: expected ${expectedCells} grid cells but found ${finalPositions.size}`);
  }

  console.log(`${path}: complete ${columns.size}x${rows.length} grid (${finalPositions.size} cells); added ${missingRows.length} neutral future-date cells`);
}
