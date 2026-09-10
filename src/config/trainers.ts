/** Líderes de gimnasio disponibles. Los sprites se descargan con scripts/fetch-trainers.mjs. */
export interface Trainer {
  id: string;
  name: string;
  /** Gimnasio y tipo, solo informativo. */
  gym: string;
}

export const TRAINERS: Trainer[] = [
  { id: 'brock', name: 'Brock', gym: 'Ciudad Plateada · Roca' },
  { id: 'misty', name: 'Misty', gym: 'Ciudad Celeste · Agua' },
  { id: 'ltsurge', name: 'Lt. Surge', gym: 'Ciudad Carmín · Eléctrico' },
  { id: 'erika', name: 'Erika', gym: 'Ciudad Azulona · Planta' },
  { id: 'koga', name: 'Koga', gym: 'Ciudad Fucsia · Veneno' },
  { id: 'sabrina', name: 'Sabrina', gym: 'Ciudad Azafrán · Psíquico' },
  { id: 'blaine', name: 'Blaine', gym: 'Isla Canela · Fuego' },
  { id: 'giovanni', name: 'Giovanni', gym: 'Ciudad Verde · Tierra' },
  { id: 'falkner', name: 'Pegaso', gym: 'Ciudad Malva · Volador' },
  { id: 'bugsy', name: 'Antón', gym: 'Ciudad Azalea · Bicho' },
  { id: 'whitney', name: 'Blanca', gym: 'Ciudad Trigal · Normal' },
  { id: 'morty', name: 'Morti', gym: 'Ciudad Iris · Fantasma' },
];

export const DEFAULT_TRAINER_ID = 'brock';

export function trainerById(id: string | null | undefined): Trainer {
  return TRAINERS.find((t) => t.id === id) ?? TRAINERS[0]!;
}

export function trainerTextureKey(id: string): string {
  return `trainer-${id}`;
}

export function trainerAssetPath(id: string): string {
  return `assets/trainers/${id}.png`;
}
