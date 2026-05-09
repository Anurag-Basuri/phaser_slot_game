/**
 * PREMIUM UI BUILDER — Reusable functions for creating polished UI components
 *
 * Provides factory functions for:
 * - Premium buttons with proper styling
 * - Professional panels with depth
 * - Polished text with proper typography
 * - Visual effects (glows, shadows, depth)
 */

import Phaser from 'phaser';
import { Theme, ButtonStyle, PanelStyle } from '../constants/theme';

export class PremiumUI {
  /**
   * Create a premium button with proper styling, depth, and interactivity
   */
  static createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    options?: {
      width?: number;
      height?: number;
      style?: 'primary' | 'secondary' | 'success';
      depth?: number;
      fontSize?: number;
      icon?: string; // Optional emoji or icon
    },
  ): Phaser.GameObjects.Container {
    const opts = {
      width: 140,
      height: 50,
      style: 'primary' as const,
      depth: 20,
      fontSize: 14,
      ...options,
    };

    const container = scene.add.container(x, y).setDepth(opts.depth);
    const styleConfig = ButtonStyle[opts.style];

    // Shadow background
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(
      -opts.width / 2 + 2,
      -opts.height / 2 + 3,
      opts.width,
      opts.height,
      8,
    );
    container.add(shadow);

    // Main button background
    const bg = scene.add.graphics();
    bg.fillStyle(parseInt(styleConfig.fill.replace('#', '0x')), 1);
    bg.fillRoundedRect(
      -opts.width / 2,
      -opts.height / 2,
      opts.width,
      opts.height,
      8,
    );

    // Border
    bg.lineStyle(2, parseInt(styleConfig.border.replace('#', '0x')), 0.8);
    bg.strokeRoundedRect(
      -opts.width / 2,
      -opts.height / 2,
      opts.width,
      opts.height,
      8,
    );

    // Top highlight for depth
    bg.lineStyle(1, 0xffffff, 0.15);
    bg.lineBetween(
      -opts.width / 2 + 4,
      -opts.height / 2 + 2,
      opts.width / 2 - 4,
      -opts.height / 2 + 2,
    );

    container.add(bg);

    // Text label
    const text = scene.add
      .text(0, 0, label, {
        fontSize: `${opts.fontSize}px`,
        fontFamily: Theme.fonts.sans,
        fontStyle: 'bold',
        color: styleConfig.text,
      })
      .setOrigin(0.5)
      .setDepth(opts.depth + 1);

    container.add(text);

    // Optional icon
    if (opts.icon) {
      const icon = scene.add
        .text(-opts.width / 4, 0, opts.icon, {
          fontSize: `${opts.fontSize + 4}px`,
          fontFamily: 'Arial, sans-serif',
        })
        .setOrigin(0.5)
        .setDepth(opts.depth + 1);
      container.add(icon);
    }

    // Interactive hit area
    const hitArea = scene.add
      .rectangle(0, 0, opts.width, opts.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(opts.depth + 2);
    container.add(hitArea);

    // Hover effects
    hitArea.on('pointerover', () => {
      scene.tweens.add({
        targets: bg,
        scale: 1.05,
        duration: 150,
        ease: Theme.animation.easeOut,
      });
      scene.tweens.add({
        targets: text,
        scale: 1.08,
        duration: 150,
        ease: Theme.animation.easeOut,
      });
    });

    hitArea.on('pointerout', () => {
      scene.tweens.add({
        targets: bg,
        scale: 1,
        duration: 150,
        ease: Theme.animation.easeOut,
      });
      scene.tweens.add({
        targets: text,
        scale: 1,
        duration: 150,
        ease: Theme.animation.easeOut,
      });
    });

    hitArea.on('pointerdown', () => {
      scene.tweens.add({
        targets: container,
        y: y + 3,
        duration: 80,
        ease: Theme.animation.easeIn,
      });
      onClick();
    });

    hitArea.on('pointerup', () => {
      scene.tweens.add({
        targets: container,
        y: y,
        duration: 80,
        ease: Theme.animation.easeOut,
      });
    });

    return container;
  }

  /**
   * Create a premium panel with proper depth and styling
   */
  static createPanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: {
      style?: 'default' | 'dark' | 'accent';
      depth?: number;
      interactive?: boolean;
      onDismiss?: () => void;
    },
  ): Phaser.GameObjects.Container {
    const opts = {
      style: 'default' as const,
      depth: 20,
      interactive: false,
      ...options,
    };

    const container = scene.add.container(x, y).setDepth(opts.depth);
    const styleConfig = PanelStyle[opts.style];

    // Drop shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 16);
    container.add(shadow);

    // Main panel background
    const bg = scene.add.graphics();
    bg.fillStyle(parseInt(styleConfig.bg.replace('#', '0x')), 0.95);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);

    // Border
    bg.lineStyle(1.5, parseInt(styleConfig.border.replace('#', '0x')), 0.6);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);

    // Top highlight
    bg.lineStyle(1, 0xffffff, 0.1);
    bg.lineBetween(
      -width / 2 + 8,
      -height / 2 + 2,
      width / 2 - 8,
      -height / 2 + 2,
    );

    container.add(bg);

    if (opts.interactive) {
      const hitArea = scene.add
        .rectangle(-width / 2, -height / 2, width, height, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(opts.depth + 1);

      if (opts.onDismiss) {
        hitArea.on('pointerdown', opts.onDismiss);
      }

      container.add(hitArea);
    }

    return container;
  }

  /**
   * Create premium text with proper styling
   */
  static createText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    options?: {
      size?: number;
      weight?: 'light' | 'normal' | 'bold' | 'black';
      color?: string;
      align?: 'left' | 'center' | 'right';
      maxWidth?: number;
      depth?: number;
      stroke?: boolean;
      strokeColor?: string;
      shadow?: boolean;
    },
  ): Phaser.GameObjects.Text {
    const opts = {
      size: 16,
      weight: 'normal',
      color: Theme.colors.textPrimary,
      align: 'center',
      depth: 10,
      stroke: false,
      strokeColor: '#000000',
      shadow: false,
      ...options,
    };

    const fontWeights: Record<string, number> = {
      light: 300,
      normal: 400,
      bold: 600,
      black: 800,
    };

    const txtObj = scene.add
      .text(x, y, text, {
        fontSize: `${opts.size}px`,
        fontFamily: Theme.fonts.sans,
        fontStyle:
          opts.weight === 'black'
            ? 'bold'
            : opts.weight === 'bold'
              ? 'bold'
              : 'normal',
        color: opts.color,
        align: opts.align,
        wordWrap: opts.maxWidth ? { width: opts.maxWidth } : undefined,
      })
      .setOrigin(0.5)
      .setDepth(opts.depth);

    if (opts.stroke) {
      txtObj.setStroke(opts.strokeColor, 3);
    }

    if (opts.shadow) {
      txtObj.setShadow(2, 3, '#000000', 2, true, true);
    }

    return txtObj;
  }

  /**
   * Create a glowing effect around an object
   */
  static addGlow(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    color: string = Theme.colors.primary,
    strength: number = 0.4,
  ): Phaser.GameObjects.Graphics {
    const glow = scene.add.graphics();
    const colorInt = parseInt(color.replace('#', '0x'));
    glow.fillStyle(colorInt, strength);
    glow.fillCircle(0, 0, 100);
    glow.setDepth(((target as any).depth ?? 0) - 1);

    // Add pulse animation
    scene.tweens.add({
      targets: glow,
      alpha: { from: strength, to: strength * 0.5 },
      yoyo: true,
      repeat: -1,
      duration: 1500,
      ease: 'Sine.easeInOut',
    });

    return glow;
  }

  /**
   * Create a shimmer/idle animation effect
   */
  static addShimmer(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    intensity: number = 0.15,
  ): void {
    scene.tweens.add({
      targets: target,
      scale: { from: 1, to: 1 + intensity },
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Create a bounce animation effect
   */
  static addBounce(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    intensity: number = 8,
    duration: number = 500,
  ): Phaser.Tweens.Tween {
    return scene.tweens.add({
      targets: target,
      y: `-=${intensity}`,
      yoyo: true,
      duration: duration,
      ease: Theme.animation.easeBounce,
    });
  }
}
