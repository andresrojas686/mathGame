import Phaser from 'phaser';
import type { PokemonInfo } from '../systems/pokemon/PokeApi';
import { COLORS, UI_FONT } from './style';

const TARGET_HEIGHT = 230;
const HP_WIDTH = 220;

export function pokemonTextureKey(id: number): string {
  return `pokemon-${id}`;
}

/**
 * El enemigo: ilustración del Pokémon (o un rectángulo mientras carga o si la red falla),
 * nombre, barra de vida. La textura se pide al Loader de Phaser en tiempo de ejecución.
 */
export class MonsterView extends Phaser.GameObjects.Container {
  private readonly placeholder: Phaser.GameObjects.Rectangle;
  private image: Phaser.GameObjects.Image | null = null;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpText: Phaser.GameObjects.Text;
  private current: PokemonInfo | null = null;
  private readonly homeX: number;
  private readonly reducedMotion: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, reducedMotion: boolean) {
    super(scene, x, y);
    this.homeX = x;
    this.reducedMotion = reducedMotion;

    this.placeholder = scene.add.rectangle(0, 0, 160, 200, COLORS.monster);
    this.nameText = scene.add.text(0, -160, '', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.text }).setOrigin(0.5);
    const track = scene.add.rectangle(0, -130, HP_WIDTH, 16, COLORS.hpTrack);
    this.hpFill = scene.add.rectangle(-HP_WIDTH / 2, -130, HP_WIDTH, 16, COLORS.hpFill).setOrigin(0, 0.5);
    this.hpText = scene.add.text(0, -110, '', { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted }).setOrigin(0.5);
    this.add([this.placeholder, this.nameText, track, this.hpFill, this.hpText]);
    scene.add.existing(this);
  }

  get pokemonName(): string {
    return this.current?.name ?? '';
  }

  /** Claves ya pedidas al Loader en esta escena, para no encolar la misma imagen dos veces. */
  private readonly requested = new Set<string>();

  /** Empieza a descargar la ilustración sin mostrarla. Se usa para tener listo el siguiente. */
  preload(info: PokemonInfo): void {
    const key = pokemonTextureKey(info.id);
    if (this.scene.textures.exists(key) || this.requested.has(key)) return;
    this.requested.add(key);
    const loader = this.scene.load;
    loader.image(key, info.artworkUrl);
    // Si la descarga falla (sin red, 404), queda el rectángulo; el juego sigue igual.
    loader.once(`loaderror`, (file: { key?: string }) => {
      if (file?.key === key) console.warn(`Pokémon: no se pudo cargar la ilustración ${info.artworkUrl}`);
    });
    loader.start();
  }

  /** Muestra este Pokémon: nombre inmediato, imagen cuando su textura esté disponible. */
  show(info: PokemonInfo): void {
    this.current = info;
    this.nameText.setText(info.name);
    this.setImage(null);

    const key = pokemonTextureKey(info.id);
    if (this.scene.textures.exists(key)) {
      this.setImage(key);
      return;
    }
    const loader = this.scene.load;
    const onDone = () => {
      // Puede haber cambiado de Pokémon mientras cargaba.
      if (this.current?.id === info.id && this.scene.textures.exists(key)) this.setImage(key);
    };
    loader.once(`filecomplete-image-${key}`, onDone);
    this.preload(info);
  }

  setHp(hp: number, max: number): void {
    this.hpFill.width = HP_WIDTH * Math.max(0, hp / max);
    this.hpText.setText(`${hp} / ${max}`);
  }

  hit(): void {
    if (this.image) {
      this.image.setTintFill(0xffffff);
      this.scene.time.delayedCall(90, () => this.image?.clearTint());
    } else {
      this.placeholder.setFillStyle(0xffffff);
      this.scene.time.delayedCall(90, () => this.placeholder.setFillStyle(COLORS.monster));
    }
    if (!this.reducedMotion) {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({ targets: this, x: this.homeX + 30, duration: 120, yoyo: true, ease: 'Quad.out', onComplete: () => (this.x = this.homeX) });
    }
  }

  /** Embestida hacia el héroe cuando ataca. */
  lunge(): void {
    if (this.reducedMotion) return;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, x: this.homeX - 180, duration: 140, yoyo: true, ease: 'Quad.out', onComplete: () => (this.x = this.homeX) });
  }

  /** Sale por la derecha y, al terminar, muestra el siguiente entrando. */
  swapTo(next: PokemonInfo, onShown?: () => void): void {
    if (this.reducedMotion) {
      this.show(next);
      onShown?.();
      return;
    }
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      x: this.homeX + 400,
      alpha: 0,
      duration: 250,
      ease: 'Quad.in',
      onComplete: () => {
        this.show(next);
        this.setAlpha(1);
        this.scene.tweens.add({ targets: this, x: this.homeX, duration: 320, ease: 'Back.out', onComplete: () => onShown?.() });
      },
    });
  }

  private setImage(key: string | null): void {
    if (this.image) {
      this.image.destroy();
      this.image = null;
    }
    if (!key) {
      this.placeholder.setVisible(true);
      return;
    }
    const img = this.scene.add.image(0, 0, key);
    const scale = TARGET_HEIGHT / img.height;
    img.setScale(scale);
    this.image = img;
    this.addAt(img, 1);
    this.placeholder.setVisible(false);
  }
}
