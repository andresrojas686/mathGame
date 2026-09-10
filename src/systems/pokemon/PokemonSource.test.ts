import { describe, expect, it } from 'vitest';
import { GEN1_COUNT, GEN1_NAMES } from '../../config/gen1';
import { seededRng } from '../testRng';
import { artworkUrl, fallbackInfo, hasLocalArt, localPokemonInfo, type PokemonInfo } from './PokeApi';
import { PokemonSource } from './PokemonSource';

describe('paquete local de la primera generación', () => {
  it('tiene los 151 nombres en español', () => {
    expect(GEN1_COUNT).toBe(151);
    expect(Object.keys(GEN1_NAMES)).toHaveLength(151);
    expect(GEN1_NAMES[1]).toBe('Bulbasaur');
    expect(GEN1_NAMES[25]).toBe('Pikachu');
    expect(GEN1_NAMES[151]).toBe('Mew');
  });
  it('localPokemonInfo apunta al SVG versionado', () => {
    expect(localPokemonInfo(6)).toEqual({ id: 6, name: 'Charizard', artworkUrl: 'assets/pokemon/6.svg', kind: 'local' });
    expect(hasLocalArt(151)).toBe(true);
    expect(hasLocalArt(152)).toBe(false);
  });
});

describe('PokemonSource', () => {
  const remote = (id: number): PokemonInfo => ({ id, name: `Remoto ${id}`, artworkUrl: artworkUrl(id), kind: 'remote' });

  it('sin conexión elige solo de la primera generación con arte local', async () => {
    const src = new PokemonSource({ online: () => false, rng: seededRng(1) });
    for (let i = 0; i < 50; i++) {
      const p = await src.next();
      expect(p.kind).toBe('local');
      expect(p.id).toBeGreaterThanOrEqual(1);
      expect(p.id).toBeLessThanOrEqual(151);
      expect(p.artworkUrl).toBe(`assets/pokemon/${p.id}.svg`);
      expect(p.name).toBe(GEN1_NAMES[p.id]);
    }
  });

  it('con conexión usa la ilustración remota de cualquiera de las 1025 especies', async () => {
    const src = new PokemonSource({ online: () => true, rng: seededRng(2), fetchInfo: async (id) => remote(id) });
    const ids = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const p = await src.next();
      expect(p.kind).toBe('remote');
      ids.add(p.id);
    }
    expect(ids.size).toBe(40); // sin repetidos dentro de la partida
    expect([...ids].some((id) => id > 151)).toBe(true);
  });

  it('si PokéAPI falla estando en línea, cae al paquete local en vez de al rectángulo', async () => {
    const src = new PokemonSource({ online: () => true, rng: seededRng(3), fetchInfo: async (id) => fallbackInfo(id) });
    const p = await src.next();
    expect(p.kind).toBe('local');
    expect(p.name).toBe(GEN1_NAMES[p.id]);
  });

  it('localFor devuelve la versión local solo hasta el 151', () => {
    const src = new PokemonSource();
    expect(src.localFor(25)?.artworkUrl).toBe('assets/pokemon/25.svg');
    expect(src.localFor(500)).toBeNull();
  });
});
