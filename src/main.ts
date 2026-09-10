import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { NameScene } from './scenes/NameScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { H, W } from './ui/style';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1e1e2e',
  // Necesario para el campo de nombre: un <input> real recibe tildes y abre el teclado en tablet.
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, NameScene, LevelSelectScene, BattleScene, ResultScene],
});

// Solo en desarrollo: permite inspeccionar y automatizar el juego desde la consola o pruebas E2E.
if (import.meta.env.DEV) {
  (window as unknown as { __multiplicon: Phaser.Game }).__multiplicon = game;
}
