// Descarga una sola vez los sprites de líderes de gimnasio desde Pokémon Showdown.
// Los PNG resultantes se versionan en public/assets/trainers/ porque ese servidor
// no envía cabeceras CORS y el navegador no puede cargarlos como textura WebGL.
//
// Uso: node scripts/fetch-trainers.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://play.pokemonshowdown.com/sprites/trainers/';
const OUT = path.resolve('public/assets/trainers');

// Debe coincidir con src/config/trainers.ts
const TRAINERS = ['brock', 'misty', 'ltsurge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni', 'falkner', 'bugsy', 'whitney', 'morty'];

await mkdir(OUT, { recursive: true });
for (const id of TRAINERS) {
  const res = await fetch(`${BASE}${id}.png`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT, `${id}.png`), buf);
  console.log(`${id}.png  ${buf.length} bytes`);
}
