import type { Rng } from '../../types';
import { fetchPokemonInfo, localPokemonInfo, randomGen1Id, randomPokemonId, type PokemonInfo } from './PokeApi';

export interface PokemonSourceOptions {
  /** Sin conexión se usa siempre el paquete local de la primera generación. */
  online?: () => boolean;
  rng?: Rng;
  fetchInfo?: (id: number) => Promise<PokemonInfo>;
}

/**
 * Elige el siguiente Pokémon de la partida:
 * - Con internet: uno cualquiera de las 1025 especies, con ilustración oficial remota.
 * - Sin internet, o si PokéAPI no responde: uno de los 151 de la primera generación,
 *   cuyo arte y nombre están versionados en el proyecto.
 * No repite ids dentro de la misma partida mientras haya de sobra.
 */
export class PokemonSource {
  private readonly used = new Set<number>();
  private readonly online: () => boolean;
  private readonly rng: Rng;
  private readonly fetchInfo: (id: number) => Promise<PokemonInfo>;

  constructor(opts: PokemonSourceOptions = {}) {
    this.online = opts.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
    this.rng = opts.rng ?? Math.random;
    this.fetchInfo = opts.fetchInfo ?? ((id) => fetchPokemonInfo(id));
  }

  async next(): Promise<PokemonInfo> {
    if (!this.online()) return this.local();
    const id = this.fresh(() => randomPokemonId(this.rng));
    const info = await this.fetchInfo(id);
    if (!info.fallback) return info;
    // La API no respondió: se juega con el paquete local en lugar de un rectángulo.
    this.used.delete(id);
    return this.local();
  }

  /** Versión local del mismo Pokémon, si existe (para cuando la imagen remota falla). */
  localFor(id: number): PokemonInfo | null {
    return id >= 1 && id <= 151 ? localPokemonInfo(id) : null;
  }

  private local(): PokemonInfo {
    return localPokemonInfo(this.fresh(() => randomGen1Id(this.rng)));
  }

  private fresh(pick: () => number): number {
    let id = pick();
    for (let i = 0; i < 10 && this.used.has(id); i++) id = pick();
    this.used.add(id);
    return id;
  }
}
