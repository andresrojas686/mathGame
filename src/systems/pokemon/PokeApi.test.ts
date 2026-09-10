import { beforeEach, describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../scores/ScoreRepository';
import { artworkUrl, clearPokemonMemoryCache, fetchPokemonInfo, pickName, POKEMON_COUNT, randomPokemonId } from './PokeApi';

class MemoryStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

const species = (names: [string, string][]) => ({ names: names.map(([lang, name]) => ({ name, language: { name: lang } })) });

describe('randomPokemonId / artworkUrl', () => {
  it('cubre 1..POKEMON_COUNT', () => {
    expect(randomPokemonId(() => 0)).toBe(1);
    expect(randomPokemonId(() => 0.999999)).toBe(POKEMON_COUNT);
  });
  it('la ilustración se deriva del id', () => {
    expect(artworkUrl(25)).toMatch(/official-artwork\/25\.png$/);
  });
});

describe('pickName', () => {
  it('prefiere español, luego inglés, luego el nombre interno, luego el fallback', () => {
    expect(pickName(1, species([['en', 'Bulbasaur'], ['es', 'Bulbasaur ES']]))).toBe('Bulbasaur ES');
    expect(pickName(1, species([['en', 'Bulbasaur'], ['ja', 'フシギダネ']]))).toBe('Bulbasaur');
    expect(pickName(1, { name: 'bulbasaur' })).toBe('Bulbasaur');
    expect(pickName(7, {})).toBe('Pokémon #7');
  });
});

describe('fetchPokemonInfo', () => {
  beforeEach(() => clearPokemonMemoryCache());

  it('consulta la especie, devuelve el nombre en español y cachea en storage', async () => {
    const storage = new MemoryStorage();
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return jsonResponse(species([['es', 'Pikachu']]));
    }) as unknown as typeof fetch;

    const a = await fetchPokemonInfo(250, { fetchFn, storage });
    expect(a).toEqual({ id: 250, name: 'Pikachu', artworkUrl: artworkUrl(250), kind: 'remote' });
    expect(storage.map.get('multiplicon.pokemon.250')).toBe('{"name":"Pikachu"}');

    clearPokemonMemoryCache();
    const b = await fetchPokemonInfo(250, { fetchFn, storage });
    expect(b.name).toBe('Pikachu');
    expect(calls).toBe(1);
  });

  it('para la primera generación usa la tabla local sin consultar la API', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const info = await fetchPokemonInfo(25, { fetchFn, storage: null });
    expect(info).toEqual({ id: 25, name: 'Pikachu', artworkUrl: artworkUrl(25), kind: 'remote' });
    expect(calls).toBe(0);
  });

  it('ante error HTTP o de red devuelve el fallback marcado, sin lanzar', async () => {
    const bad = (async () => jsonResponse({}, false, 500)) as unknown as typeof fetch;
    expect(await fetchPokemonInfo(300, { fetchFn: bad, storage: null })).toEqual({ id: 300, name: 'Pokémon #300', artworkUrl: artworkUrl(300), kind: 'remote', fallback: true });
    const boom = (async () => {
      throw new Error('sin red');
    }) as unknown as typeof fetch;
    expect((await fetchPokemonInfo(400, { fetchFn: boom, storage: null })).fallback).toBe(true);
  });

  it('aborta por timeout y devuelve el fallback', async () => {
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abortado')));
      })) as unknown as typeof fetch;
    const info = await fetchPokemonInfo(900, { fetchFn: slow, storage: null, timeoutMs: 10 });
    expect(info.fallback).toBe(true);
  });
});
