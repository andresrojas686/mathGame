import Phaser from 'phaser';
import { audio, AUDIO_CHANGED_EVENT } from '../systems/AudioManager';
import { UI_FONT, W } from './style';

/** Botón de silencio siempre visible en la esquina de todas las pantallas (plan.md §9). */
export function addMuteButton(scene: Phaser.Scene, color = '#f2e9d8'): Phaser.GameObjects.Text {
  const render = (t: Phaser.GameObjects.Text) => t.setText(audio.settings.muted ? '🔇' : '🔊');
  const btn = scene.add
    .text(W - 24, 700, '', { fontFamily: UI_FONT, fontSize: '26px', color })
    .setOrigin(1, 1)
    .setDepth(200)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => audio.toggleMute());
  render(btn);
  // Refleja cambios hechos desde otra pantalla (ajustes o tecla M).
  const onChange = () => render(btn);
  window.addEventListener(AUDIO_CHANGED_EVENT, onChange);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener(AUDIO_CHANGED_EVENT, onChange));
  return btn;
}
