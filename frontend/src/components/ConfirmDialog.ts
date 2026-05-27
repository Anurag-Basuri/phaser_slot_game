import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

/**
 * Reusable confirmation dialog for buy features and other confirmations.
 */
export class ConfirmDialog {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  /**
   * Show a confirmation dialog.
   * @param title Dialog title
   * @param subtitle Subtitle/cost text
   * @param onConfirm Callback when confirmed
   * @param onCancel Callback when cancelled
   */
  public show(title: string, subtitle: string, onConfirm: () => void, onCancel: () => void) {
    if (this.visible) return;
    this.visible = true;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(5000).setAlpha(0);

    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.container.add(overlay);

    // Panel
    const panelW = Math.min(450, w * 0.85);
    const panelH = 280;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x130f24, 1); // Dark navy
    panel.fillRoundedRect(px, py, panelW, panelH, 20);
    panel.lineStyle(4, 0xff006a, 1);
    panel.strokeRoundedRect(px, py, panelW, panelH, 20);
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(w / 2, py + 45, title, {
       fontSize: '32px', color: '#ffffff', fontStyle: 'normal',
      fontFamily: '"Montserrat", "Poppins", sans-serif',
    }).setOrigin(0.5));

    // Subtitle
    this.container.add(this.scene.add.text(w / 2, py + 110, subtitle, {
       fontSize: '20px', color: '#ffe600', fontStyle: 'bold',
      fontFamily: '"Poppins", sans-serif',
    }).setOrigin(0.5));

    // Warning text
    this.container.add(this.scene.add.text(w / 2, py + 150, 'This amount will be deducted from your balance.', {
       fontSize: '12px', color: '#8888aa', fontFamily: '"Poppins", sans-serif',
    }).setOrigin(0.5));

    // Buttons
    const btnW = Math.min(160, panelW * 0.35);
    const btnH = 50;
    const btnY = py + panelH - 65;
    const btnGap = 20;

    // Confirm button
    const confirmBg = this.scene.add.graphics();
    confirmBg.fillStyle(0xff006a, 1);
    confirmBg.fillRoundedRect(w / 2 - btnW - btnGap / 2, btnY, btnW, btnH, 12);
    this.container.add(confirmBg);

    const confirmHit = this.scene.add.rectangle(
      w / 2 - btnW / 2 - btnGap / 2, btnY + btnH / 2, btnW, btnH
    ).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.container.add(confirmHit);

    this.container.add(this.scene.add.text(
      w / 2 - btnW / 2 - btnGap / 2, btnY + btnH / 2, 'CONFIRM', {
         fontSize: '20px', color: '#ffffff', fontStyle: 'bold', fontFamily: '"Poppins", sans-serif',
      }).setOrigin(0.5));

    // Cancel button
    const cancelBg = this.scene.add.graphics();
    cancelBg.fillStyle(0x443355, 1);
    cancelBg.fillRoundedRect(w / 2 + btnGap / 2, btnY, btnW, btnH, 12);
    this.container.add(cancelBg);

    const cancelHit = this.scene.add.rectangle(
      w / 2 + btnW / 2 + btnGap / 2, btnY + btnH / 2, btnW, btnH
    ).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.container.add(cancelHit);

    this.container.add(this.scene.add.text(
      w / 2 + btnW / 2 + btnGap / 2, btnY + btnH / 2, 'CANCEL', {
         fontSize: '20px', color: '#aaaacc', fontStyle: 'bold', fontFamily: '"Poppins", sans-serif',
      }).setOrigin(0.5));

    // Wire events
    confirmHit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.dismiss();
      onConfirm();
    });
    confirmHit.on('pointerover', () => {
      confirmBg.clear();
      confirmBg.fillStyle(0xff3388, 1);
      confirmBg.fillRoundedRect(w / 2 - btnW - btnGap / 2, btnY, btnW, btnH, 12);
    });
    confirmHit.on('pointerout', () => {
      confirmBg.clear();
      confirmBg.fillStyle(0xff006a, 1);
      confirmBg.fillRoundedRect(w / 2 - btnW - btnGap / 2, btnY, btnW, btnH, 12);
    });

    cancelHit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.dismiss();
      onCancel();
    });

    // Animate in
    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 200,
    });
  }

  public dismiss() {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => {
        if (this.container && this.container.scene) {
          this.container.destroy();
        }
      },
    });
  }

  public isVisible(): boolean {
    return this.visible;
  }
}
