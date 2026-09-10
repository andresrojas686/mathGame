# Créditos y licencias

Multiplicón es un juego educativo sin fines comerciales.

## Datos e imágenes de Pokémon

- **PokéAPI** (https://pokeapi.co) — nombres de las especies. Datos bajo licencia BSD-3. El juego cachea las respuestas en el navegador, como pide su política de uso.
- **Ilustraciones oficiales** — servidas desde el repositorio público de sprites de PokéAPI (https://github.com/PokeAPI/sprites) cuando hay conexión.
- **Arte "Dream World" de la primera generación (151 SVG)** — descargado una vez del mismo repositorio con `scripts/fetch-gen1.mjs` y versionado en `public/assets/pokemon/` para jugar sin internet. Los nombres en español están en `src/config/gen1.ts`.
- **Sprites de líderes de gimnasio** — descargados una vez desde Pokémon Showdown (https://play.pokemonshowdown.com/sprites/trainers/) con `scripts/fetch-trainers.mjs` y guardados en `public/assets/trainers/`.

Pokémon y los nombres, personajes e ilustraciones relacionados son marcas y obras de Nintendo, Creatures Inc. y GAME FREAK Inc. Este proyecto no está afiliado ni respaldado por ellos. El material se usa con fines educativos y sin ánimo de lucro; si se quisiera distribuir comercialmente habría que sustituirlo por arte propio (la estructura de `HeroView` y `MonsterView` lo permite sin tocar la lógica del juego).

## Tipografía

- **Atkinson Hyperlegible** (Braille Institute of America), licencia SIL Open Font License 1.1. Descargada con `scripts/fetch-fonts.mjs` y servida desde `public/assets/fonts/`.

## Software

- Phaser 3 (MIT), Vite (MIT), Hono (MIT), TypeScript (Apache-2.0), Vitest (MIT).

## Audio

Toda la música y los efectos se sintetizan en tiempo real con Web Audio (`src/systems/AudioManager.ts`). No hay archivos de audio de terceros ni licencias que atribuir.
