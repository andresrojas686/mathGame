import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1e1e2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BattleScene],
});

// Solo en desarrollo: permite inspeccionar y automatizar el juego desde la consola o pruebas E2E.
if (import.meta.env.DEV) {
  (window as unknown as { __multiplicon: Phaser.Game }).__multiplicon = game;
}
