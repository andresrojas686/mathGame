import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { NameScene } from './scenes/NameScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultScene } from './scenes/ResultScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TitleScene } from './scenes/TitleScene';
import { TrainerSelectScene } from './scenes/TrainerSelectScene';
import { audio } from './systems/AudioManager';
import { H, W } from './ui/style';

/**
 * Las tipografías web deben estar cargadas antes de que Phaser dibuje texto, o el primer
 * frame sale con la fuente del sistema (plan.md §13). Se espera como máximo 3 s.
 */
async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const loads = ['400 32px "Atkinson Hyperlegible"', '700 32px "Atkinson Hyperlegible"'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 3000))]).catch(() => undefined);
}

async function boot(): Promise<void> {
  await waitForFonts();
  audio.install();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#1e1e2e',
    // Necesario para los campos de texto: un <input> real recibe tildes y abre el teclado en tablet.
    dom: { createContainer: true },
    // Las ilustraciones de Pokémon vienen de otro origen: sin esto WebGL rechaza la textura.
    loader: { crossOrigin: 'anonymous' },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, TitleScene, NameScene, TrainerSelectScene, LevelSelectScene, BattleScene, ResultScene, LeaderboardScene, SettingsScene],
  });

  // Solo en desarrollo: permite inspeccionar y automatizar el juego desde la consola o pruebas E2E.
  if (import.meta.env.DEV) {
    (window as unknown as { __multiplicon: Phaser.Game; __audio: typeof audio }).__multiplicon = game;
    (window as unknown as { __audio: typeof audio }).__audio = audio;
  }
}

void boot();
