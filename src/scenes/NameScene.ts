import Phaser from 'phaser';
import { loadLastName, sanitizeName, saveLastName } from '../systems/Preferences';
import { MAX_NAME_LENGTH } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W } from '../ui/style';

/**
 * El nombre se escribe en un <input> HTML real montado sobre el canvas, no en un texto de Phaser:
 * así llegan tildes y ñ con cualquier distribución de teclado y en tablet se abre el teclado en pantalla.
 */
export class NameScene extends Phaser.Scene {
  private field!: HTMLInputElement;

  constructor() {
    super('Name');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(W / 2, H / 2 - 150, '¿Cómo te llamas?', { fontFamily: UI_FONT, fontSize: '56px', color: COLORS.text })
      .setOrigin(0.5);

    const dom = this.add.dom(W / 2, H / 2 - 30, 'input', {
      width: '520px',
      height: '84px',
      boxSizing: 'border-box',
      padding: '0 20px',
      fontFamily: UI_FONT,
      fontSize: '44px',
      textAlign: 'center',
      color: COLORS.text,
      background: '#2c2c3c',
      border: '3px solid #e8c87a',
      borderRadius: '6px',
      outline: 'none',
    });
    this.field = dom.node as HTMLInputElement;
    this.field.type = 'text';
    this.field.maxLength = MAX_NAME_LENGTH;
    this.field.autocomplete = 'off';
    this.field.spellcheck = false;
    this.field.setAttribute('aria-label', 'Tu nombre');
    this.field.value = loadLastName();
    this.field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.repeat) this.confirm();
    });
    // Sin retraso el foco se pierde al montar el contenedor DOM.
    this.time.delayedCall(50, () => this.field.focus());

    this.add
      .text(W / 2 + 260, H / 2 + 30, `máx. ${MAX_NAME_LENGTH} caracteres`, { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(1, 0.5);

    new Button(this, W / 2, H / 2 + 100, 'Continuar', () => this.confirm());
    this.add
      .text(W / 2, H / 2 + 170, 'Escribe tu nombre y pulsa Enter', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);

    // Enter también sirve si el foco se fue del campo (por ejemplo tras tocar el botón).
    bindWindowKeys(this, (e) => {
      if (e.key === 'Enter' && !e.repeat && document.activeElement !== this.field) this.confirm();
    });
  }

  private confirm(): void {
    const name = sanitizeName(this.field.value);
    if (!name) {
      this.cameras.main.shake(120, 0.004);
      this.field.focus();
      return;
    }
    saveLastName(name);
    this.scene.start('LevelSelect', { name });
  }
}
