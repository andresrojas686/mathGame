import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { NameScene } from './scenes/NameScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { TrainerSelectScene } from './scenes/TrainerSelectScene';
import { H, W } from './ui/style';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1e1e2e',
  // Necesario para el campo de nombre: un <input> real recibe tildes y abre el teclado en tablet.
  dom: { createContainer: true },
  // Las ilustraciones de Pokémon vienen de otro origen: sin esto WebGL rechaza la textura.
  loader: { crossOrigin: 'anonymous' },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [PreloadScene, TitleScene, NameScene, TrainerSelectScene, LevelSelectScene, BattleScene, ResultScene, LeaderboardScene],
});

// Solo en desarrollo: permite inspeccionar y automatizar el juego desde la consola o pruebas E2E.
if (import.meta.env.DEV) {
  (window as unknown as { __multiplicon: Phaser.Game }).__multiplicon = game;
}
