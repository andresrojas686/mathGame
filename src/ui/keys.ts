import Phaser from 'phaser';

/**
 * Escucha `keydown` nativo en la ventana mientras la escena esté viva.
 * Se usa en vez del KeyboardPlugin de Phaser porque este reemite su cola cuando
 * varias teclas llegan dentro del mismo frame y duplica las pulsaciones.
 */
export function bindWindowKeys(scene: Phaser.Scene, handler: (event: KeyboardEvent) => void): void {
  window.addEventListener('keydown', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', handler));
}

export function isDigitKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && event.key >= '0' && event.key <= '9';
}

/** Letras (incluidas tildes y ñ), dígitos y espacio: lo que se permite en un nombre. */
export function isNameChar(event: KeyboardEvent): boolean {
  return event.key.length === 1 && /[\p{L}\p{N} ]/u.test(event.key);
}
