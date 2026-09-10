import { GEN1_COUNT, GEN1_NAMES } from '../../config/gen1';
import type { Rng } from '../../types';
import { safeStorage, type KeyValueStorage } from '../scores/ScoreRepository';

/** Especies publicadas en PokéAPI (verificado 2026-09-10). */
export const POKEMON_COUNT = 1025;

const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species/';
const ARTWORK_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
const CACHE_PREFIX = 'multiplicon.pokemon.';

export interface PokemonInfo {
  id: number;
  /** Nombre en español si existe; si no, inglés; si no, "Pokémon #id". */
  name: string;
  /** URL de la imagen: ilustración oficial remota o SVG local de la primera generación. */
  artworkUrl: string;
  /** 'local' = arte versionado en public/assets/pokemon, disponible sin internet. */
  kind: 'remote' | 'local';
  /** Si es verdad, PokéAPI no respondió y el nombre es el genérico. */
  fallback?: boolean;
}

export interface PokeApiOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  storage?: KeyValueStorage | null;
}

export function randomPokemonId(rng: Rng = Math.random): number {
  return 1 + Math.floor(rng() * POKEMON_COUNT);
}

export function randomGen1Id(rng: Rng = Math.random): number {
  return 1 + Math.floor(rng() * GEN1_COUNT);
}

/** La ilustración oficial no depende de la API: la URL se deriva del id. */
export function artworkUrl(id: number): string {
  return `${ARTWORK_URL}${id}.png`;
}

export function hasLocalArt(id: number): boolean {
  return id >= 1 && id <= GEN1_COUNT;
}

/** Pokémon de la primera generación con arte y nombre versionados: funciona sin red. */
export function localPokemonInfo(id: number): PokemonInfo {
  return { id, name: GEN1_NAMES[id] ?? `Pokémon #${id}`, artworkUrl: `assets/pokemon/${id}.svg`, kind: 'local' };
}

export function fallbackInfo(id: number): PokemonInfo {
  return { id, name: `Pokémon #${id}`, artworkUrl: artworkUrl(id), kind: 'remote', fallback: true };
}

const memory = new Map<number, PokemonInfo>();

interface SpeciesResponse {
  names?: { name: string; language: { name: string } }[];
  name?: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pickName(id: number, species: SpeciesResponse): string {
  const names = species.names ?? [];
  const es = names.find((n) => n.language?.name === 'es')?.name;
  if (es) return es;
  const en = names.find((n) => n.language?.name === 'en')?.name;
  if (en) return en;
  if (species.name) return capitalize(species.name);
  return fallbackInfo(id).name;
}

/**
 * Nombre e ilustración oficial de un Pokémon. Nunca lanza: ante cualquier fallo devuelve el
 * fallback marcado como tal. Cachea en memoria y en localStorage, como pide la política de
 * uso de PokéAPI. Para la primera generación el nombre sale de la tabla local sin consultar.
 */
export async function fetchPokemonInfo(id: number, opts: PokeApiOptions = {}): Promise<PokemonInfo> {
  if (hasLocalArt(id)) return { id, name: GEN1_NAMES[id]!, artworkUrl: artworkUrl(id), kind: 'remote' };

  const cached = memory.get(id);
  if (cached) return cached;

  const storage = opts.storage === undefined ? safeStorage() : opts.storage;
  const fromStorage = readCache(storage, id);
  if (fromStorage) {
    memory.set(id, fromStorage);
    return fromStorage;
  }

  const fetchFn = opts.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await fetchFn(`${SPECIES_URL}${id}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const species = (await res.json()) as SpeciesResponse;
    const info: PokemonInfo = { id, name: pickName(id, species), artworkUrl: artworkUrl(id), kind: 'remote' };
    memory.set(id, info);
    writeCache(storage, info);
    return info;
  } catch (err) {
    console.warn(`PokéAPI: no se pudo leer la especie ${id}`, err);
    return fallbackInfo(id);
  } finally {
    clearTimeout(timer);
  }
}

/** Solo para pruebas. */
export function clearPokemonMemoryCache(): void {
  memory.clear();
}

function readCache(storage: KeyValueStorage | null, id: number): PokemonInfo | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${CACHE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PokemonInfo>;
    if (typeof parsed.name !== 'string') return null;
    return { id, name: parsed.name, artworkUrl: artworkUrl(id), kind: 'remote' };
  } catch {
    return null;
  }
}

function writeCache(storage: KeyValueStorage | null, info: PokemonInfo): void {
  try {
    storage?.setItem(`${CACHE_PREFIX}${info.id}`, JSON.stringify({ name: info.name }));
  } catch {
    /* sin persistencia */
  }
}
