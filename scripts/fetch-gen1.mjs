// Descarga una sola vez los 151 Pokémon de la primera generación para jugar sin internet:
// - arte "Dream World" en SVG (ligero y escalable) → public/assets/pokemon/<id>.svg
// - nombre en español desde PokéAPI → src/config/gen1.ts (generado, no editar a mano)
//
// Uso: node scripts/fetch-gen1.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const COUNT = 151;
const ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/';
const SPECIES = 'https://pokeapi.co/api/v2/pokemon-species/';
const OUT_DIR = path.resolve('public/assets/pokemon');
const OUT_TS = path.resolve('src/config/gen1.ts');

await mkdir(OUT_DIR, { recursive: true });
const names = {};
const ids = Array.from({ length: COUNT }, (_, i) => i + 1);

for (let i = 0; i < ids.length; i += 10) {
  await Promise.all(
    ids.slice(i, i + 10).map(async (id) => {
      const art = await fetch(`${ART}${id}.svg`);
      if (!art.ok) throw new Error(`arte ${id}: HTTP ${art.status}`);
      await writeFile(path.join(OUT_DIR, `${id}.svg`), Buffer.from(await art.arrayBuffer()));

      const res = await fetch(`${SPECIES}${id}`);
      if (!res.ok) throw new Error(`especie ${id}: HTTP ${res.status}`);
      const species = await res.json();
      const es = species.names.find((n) => n.language.name === 'es')?.name;
      const en = species.names.find((n) => n.language.name === 'en')?.name;
      names[id] = es ?? en ?? species.name;
    }),
  );
  console.log(`${Math.min(i + 10, COUNT)} / ${COUNT}`);
}

const lines = ids.map((id) => `  ${id}: ${JSON.stringify(names[id])},`).join('\n');
const ts = `// Generado por scripts/fetch-gen1.mjs. No editar a mano.
// Nombres en español de la primera generación; su arte está en public/assets/pokemon/<id>.svg.
export const GEN1_COUNT = ${COUNT};

export const GEN1_NAMES: Record<number, string> = {
${lines}
};
`;
await writeFile(OUT_TS, ts, 'utf8');
console.log(`ok: ${COUNT} SVG en public/assets/pokemon y ${OUT_TS}`);
