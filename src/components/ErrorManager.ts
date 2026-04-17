import Phaser from 'phaser';

/**
 * ErrorManager — Centralized error handling for the game UI.
 *
 * Two error types:
 *   1. Transient toast: Non-blocking, auto-dismisses (e.g., "Insufficient Funds").
 *   2. Blocking modal: Locks all input, shows a "Retry" button that triggers
 *      a reconnection attempt instead of forcing a hard page reload.
 *
 * The blocking modal calls an `onRetry` callback provided by Game.tsx,
 * which performs a server re-authentication to resync the wallet balance.
 */
export class ErrorManager {
  private scene: Phaser.Scene;
  private _isBlocking = false;
  private blockingContainer: Phaser.GameObjects.Container | null = null;

  // Prevent toast spam — track active toasts and throttle
  private _activeToasts = 0;
  private static readonly MAX_TOASTS = 3;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public get isBlocking(): boolean {
    return this._isBlocking;
  }

  /**
   * Show a non-blocking toast that floats up and fades out.
   * Throttled to MAX_TOASTS to prevent visual spam from rapid failures.
   */
  public showToast(message: string, color: string = '#ff4466'): void {
    if (this._activeToasts >= ErrorManager.MAX_TOASTS) return;
    this._activeToasts++;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    // Dark pill background for readability
    const pillW = Math.min(400, w * 0.7);
    const pillH = 52;
    const pillX = w / 2 - pillW / 2;
    const pillY = h / 2 - pillH / 2;

    const container = this.scene.add.container(0, 0).setDepth(100).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(pillX, pillY, pillW, pillH, 12);
    bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(color).color, 0.6);
    bg.strokeRoundedRect(pillX, pillY, pillW, pillH, 12);
    container.add(bg);

    const text = this.scene.add.text(w / 2, h / 2, message, {
      fontSize: '22px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(text);

    // Animate in, hold, drift up, fade out
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
    });
    this.scene.tweens.add({
      targets: container,
      y: -80,
      alpha: 0,
      delay: 1600,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        container.destroy();
        this._activeToasts = Math.max(0, this._activeToasts - 1);
      },
    });
  }

  /**
   * Show a blocking error modal that locks all game input.
   * Provides a "RETRY CONNECTION" button that calls the onRetry callback.
   * If retry succeeds, the modal is dismissed.
   * If retry fails, the modal stays visible and shows an updated message.
   *
   * @param message     - The error headline
   * @param onRetry     - Async callback that attempts reconnection. Should throw on failure.
   * @param onGiveUp    - Optional callback if user clicks "RELOAD" (fallback to hard reload).
   */
  public showBlockingError(
    message: string,
    onRetry: () => Promise<void>,
    onGiveUp?: () => void,
  ): void {
    // Prevent stacking multiple blocking modals
    if (this._isBlocking) return;
    this._isBlocking = true;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.blockingContainer = this.scene.add.container(0, 0).setDepth(200).setAlpha(0);

    // Full-screen dark overlay (blocks all pointer events behind it)
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.92);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    this.blockingContainer.add(overlay);

    // Panel
    const panelW = Math.min(520, w * 0.9);
    const panelH = 300;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0d1225, 0.98);
    panel.fillRoundedRect(px, py, panelW, panelH, 20);
    panel.lineStyle(2, 0xff4466, 0.6);
    panel.strokeRoundedRect(px, py, panelW, panelH, 20);
    // Red accent top bar
    panel.fillStyle(0xff4466, 0.15);
    panel.fillRoundedRect(px, py, panelW, 60, { tl: 20, tr: 20, bl: 0, br: 0 });
    this.blockingContainer.add(panel);

    // Error icon
    const icon = this.scene.add.text(w / 2 - 20, py + 32, '⚠', {
      fontSize: '28px', color: '#ff4466',
    }).setOrigin(0.5);
    this.blockingContainer.add(icon);

    // Title
    const titleText = this.scene.add.text(w / 2 + 10, py + 32, message, {
      fontSize: '24px', color: '#ff4466', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.blockingContainer.add(titleText);

    // Subtitle
    const subtitle = this.scene.add.text(w / 2, py + 100, 
      'The connection to the server was interrupted.\nYour balance will be synced automatically.',
      {
        fontSize: '15px', color: '#8899bb', align: 'center',
        lineSpacing: 6,
      },
    ).setOrigin(0.5);
    this.blockingContainer.add(subtitle);

    // Status text (updates during retry)
    const statusText = this.scene.add.text(w / 2, py + 155, '', {
      fontSize: '14px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.blockingContainer.add(statusText);

    // Retry button
    const retryBtnW = Math.min(220, panelW * 0.4);
    const retryBtnH = 48;
    const retryX = w / 2 - retryBtnW - 10;
    const retryY = py + panelH - 75;

    const retryBg = this.scene.add.graphics();
    this.drawRetryButton(retryBg, retryX, retryY, retryBtnW, retryBtnH, false);
    this.blockingContainer.add(retryBg);

    const retryHit = this.scene.add.rectangle(
      retryX + retryBtnW / 2, retryY + retryBtnH / 2, retryBtnW, retryBtnH,
    ).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.blockingContainer.add(retryHit);

    const retryLabel = this.scene.add.text(
      retryX + retryBtnW / 2, retryY + retryBtnH / 2, 'RETRY CONNECTION',
      { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' },
    ).setOrigin(0.5);
    this.blockingContainer.add(retryLabel);

    // Reload button (fallback)
    const reloadBtnW = Math.min(160, panelW * 0.3);
    const reloadX = w / 2 + 10;

    const reloadBg = this.scene.add.graphics();
    reloadBg.fillStyle(0x2a2240, 1);
    reloadBg.fillRoundedRect(reloadX, retryY, reloadBtnW, retryBtnH, 12);
    reloadBg.lineStyle(1, 0x6655aa, 0.5);
    reloadBg.strokeRoundedRect(reloadX, retryY, reloadBtnW, retryBtnH, 12);
    this.blockingContainer.add(reloadBg);

    const reloadHit = this.scene.add.rectangle(
      reloadX + reloadBtnW / 2, retryY + retryBtnH / 2, reloadBtnW, retryBtnH,
    ).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    this.blockingContainer.add(reloadHit);

    const reloadLabel = this.scene.add.text(
      reloadX + reloadBtnW / 2, retryY + retryBtnH / 2, 'RELOAD',
      { fontSize: '16px', color: '#8888aa', fontStyle: 'bold' },
    ).setOrigin(0.5);
    this.blockingContainer.add(reloadLabel);

    // Wire retry button
    let retrying = false;
    retryHit.on('pointerdown', async () => {
      if (retrying) return;
      retrying = true;
      statusText.setText('Connecting…').setColor('#44ff88');
      retryLabel.setText('⋯');

      // Disable hover during retry
      this.drawRetryButton(retryBg, retryX, retryY, retryBtnW, retryBtnH, true);

      try {
        await onRetry();
        // Success — dismiss the modal
        statusText.setText('Connected!').setColor('#44ff88');
        this.scene.time.delayedCall(400, () => this.dismiss());
      } catch (retryErr) {
        console.warn('[ErrorManager] Retry failed:', retryErr);
        statusText.setText('Retry failed. Please try again.').setColor('#ff6644');
        retryLabel.setText('RETRY CONNECTION');
        this.drawRetryButton(retryBg, retryX, retryY, retryBtnW, retryBtnH, false);
        retrying = false;
      }
    });

    // Wire reload (fallback)
    reloadHit.on('pointerdown', () => {
      if (onGiveUp) onGiveUp();
      else window.location.reload();
    });

    // Hover effects
    retryHit.on('pointerover', () => {
      if (!retrying) this.drawRetryButton(retryBg, retryX, retryY, retryBtnW, retryBtnH, true);
    });
    retryHit.on('pointerout', () => {
      if (!retrying) this.drawRetryButton(retryBg, retryX, retryY, retryBtnW, retryBtnH, false);
    });

    // Fade in
    this.scene.tweens.add({
      targets: this.blockingContainer, alpha: 1, duration: 300,
    });
  }

  /** Dismiss the blocking modal. Called after a successful retry. */
  public dismiss(): void {
    if (!this._isBlocking || !this.blockingContainer) return;
    this._isBlocking = false;

    this.scene.tweens.add({
      targets: this.blockingContainer,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        if (this.blockingContainer && this.blockingContainer.scene) {
          this.blockingContainer.destroy();
        }
        this.blockingContainer = null;
      },
    });
  }

  private drawRetryButton(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    hovered: boolean,
  ) {
    gfx.clear();
    const fill = hovered ? 0x33dd77 : 0x22cc66;
    gfx.fillStyle(fill, 1);
    gfx.fillRoundedRect(x, y, w, h, 12);
    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRoundedRect(x, y, w, h, 12);
  }
}
