// Descarga una sola vez Atkinson Hyperlegible (licencia OFL) desde Google Fonts y genera
// public/assets/fonts/atkinson.css con rutas locales, para no depender de la red al jugar.
//
// Uso: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
const OUT = path.resolve('public/assets/fonts');
// Un UA moderno hace que Google devuelva woff2 con subconjuntos por unicode-range.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

await mkdir(OUT, { recursive: true });
const css = await (await fetch(CSS_URL, { headers: { 'user-agent': UA } })).text();

// Solo los bloques latin y latin-ext: el juego está en español.
const blocks = css.split('@font-face').slice(1).map((b) => '@font-face' + b);
let localCss = '';
let n = 0;
for (const block of blocks) {
  if (!/\/\* latin(-ext)? \*\//.test(block)) continue;
  const weight = /font-weight:\s*(\d+)/.exec(block)?.[1] ?? '400';
  const subset = /\/\* (latin(?:-ext)?) \*\//.exec(block)?.[1] ?? 'latin';
  const url = /url\((https:[^)]+)\)/.exec(block)?.[1];
  if (!url) continue;
  const file = `atkinson-${weight}-${subset}.woff2`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path.join(OUT, file), buf);
  localCss += block.replace(url, `./${file}`) + '\n';
  n += 1;
  console.log(`${file}  ${buf.length} bytes`);
}
await writeFile(path.join(OUT, 'atkinson.css'), localCss, 'utf8');
console.log(`atkinson.css con ${n} caras`);
