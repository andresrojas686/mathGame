import { isRoomCode } from './protocol';

/** Qué quiere hacer el jugador cuando llegue al lobby. */
export type OnlineIntent = { mode: 'create' } | { mode: 'join'; code: string };

/**
 * Las escenas intermedias (nombre y entrenador) son las mismas para una partida en
 * solitario y para una sala. En vez de arrastrar parámetros por todas ellas, la
 * intención se guarda aquí y la lee quien tenga que desviar el camino.
 */
let intent: OnlineIntent | null = null;

export function setOnlineIntent(value: OnlineIntent | null): void {
  intent = value;
}

export function getOnlineIntent(): OnlineIntent | null {
  return intent;
}

export function clearOnlineIntent(): void {
  intent = null;
}

/** Código de sala del enlace compartido (?sala=AB2CD), si lo hay. */
export function roomCodeFromUrl(search: string = window.location.search): string | null {
  const raw = new URLSearchParams(search).get('sala');
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return isRoomCode(code) ? code : null;
}

/** Enlace que se comparte con los demás jugadores. */
export function roomLink(code: string, origin: string = window.location.origin, pathname: string = window.location.pathname): string {
  const base = `${origin}${pathname}`.replace(/\/index\.html$/, '/');
  return `${base}?sala=${code}`;
}

/** Quita ?sala= de la barra de direcciones para que recargar no reintente entrar. */
export function forgetRoomInUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('sala')) return;
    url.searchParams.delete('sala');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
  } catch {
    /* sin History API se queda el parámetro: molesto, no grave */
  }
}

/** Copia al portapapeles con respaldo para navegadores sin permiso. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
