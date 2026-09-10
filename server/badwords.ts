/**
 * Lista corta de palabras vetadas para nombres del ranking. Es un juego para niños:
 * se sustituye la palabra por asteriscos en vez de rechazar el nombre.
 * Se compara sin tildes ni mayúsculas.
 */
const BANNED = [
  'puto', 'puta', 'mierda', 'cabron', 'cabrona', 'pendejo', 'pendeja', 'gilipollas',
  'joder', 'coño', 'cono', 'verga', 'culo', 'marica', 'maricon', 'zorra', 'perra',
  'idiota', 'imbecil', 'estupido', 'estupida', 'hijueputa', 'malparido', 'gonorrea',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'sex', 'sexo', 'porno', 'nazi', 'hitler',
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Reemplaza cada palabra vetada (como palabra completa o pegada a otras) por asteriscos. */
export function censor(name: string): string {
  let out = name;
  const lower = normalize(name);
  for (const word of BANNED) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(word, from);
      if (i === -1) break;
      out = out.slice(0, i) + '*'.repeat(word.length) + out.slice(i + word.length);
      from = i + word.length;
    }
  }
  return out;
}
