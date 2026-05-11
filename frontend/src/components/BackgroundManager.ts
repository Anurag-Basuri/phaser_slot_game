import Phaser from 'phaser';

export class BackgroundManager {
  private scene: Phaser.Scene;
  private bgBase!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Rectangle;
  private raysGraphics!: Phaser.GameObjects.Graphics;
  private raysContainer!: Phaser.GameObjects.Container;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private floaters: Phaser.GameObjects.Sprite[] = [];
  
  // Reactivity
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private baseRayAlpha = 0.15;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.init();
  }

  private init() {
    this.createBase();
    this.createGodRays();
    this.createSugarDust();
    this.createFloatingCandies();
  }

  private createBase() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    
    // Add the base image
    this.bgBase = this.scene.add.image(w / 2, h / 2, 'game_bg').setDepth(0);
    
    // Calculate scale to "cover" the screen
    const scaleX = w / this.bgBase.width;
    const scaleY = h / this.bgBase.height;
    const scale = Math.max(scaleX, scaleY);
    this.bgBase.setScale(scale);
    
    // Add a slight pink tint overlay to warm it up to match the grid
    this.overlay = this.scene.add.rectangle(w/2, h/2, w, h, 0xffbbdd, 0.1).setDepth(0);
    this.overlay.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createGodRays() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    
    this.raysContainer = this.scene.add.container(w / 2, -100).setDepth(0);
    this.raysGraphics = this.scene.add.graphics();
    this.raysContainer.add(this.raysGraphics);
    
    this.drawRays(w, h, this.baseRayAlpha);
    
    this.raysContainer.setBlendMode(Phaser.BlendModes.ADD);
    
    // Slow continuous rotation
    this.scene.tweens.add({
      targets: this.raysContainer,
      angle: 360,
      duration: 120000,
      repeat: -1,
      ease: 'Linear'
    });
  }

  /** Draw the god ray triangles at the specified alpha */
  private drawRays(w: number, h: number, alpha: number) {
    this.raysGraphics.clear();
    const rayCount = 12;
    const rayLength = Math.max(w, h) * 1.5;
    
    this.raysGraphics.fillStyle(0xffffff, alpha);
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const angleNext = ((i + 0.4) / rayCount) * Math.PI * 2;
      
      this.raysGraphics.beginPath();
      this.raysGraphics.moveTo(0, 0);
      this.raysGraphics.lineTo(Math.cos(angle) * rayLength, Math.sin(angle) * rayLength);
      this.raysGraphics.lineTo(Math.cos(angleNext) * rayLength, Math.sin(angleNext) * rayLength);
      this.raysGraphics.closePath();
      this.raysGraphics.fillPath();
    }
  }

  private createSugarDust() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    
    // Generate a tiny soft white particle texture
    const textureName = 'sugar_dust_particle';
    if (!this.scene.textures.exists(textureName)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      // Soften edge
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(4, 4, 6);
      g.generateTexture(textureName, 12, 12);
      g.destroy();
    }

    this.dustEmitter = this.scene.add.particles(0, 0, textureName, {
      x: { min: 0, max: w },
      y: { min: -100, max: h + 100 },
      quantity: 1,
      frequency: 200,
      lifespan: { min: 8000, max: 15000 },
      scale: { start: 0, end: 0.8, ease: 'Sine.easeInOut' },
      alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' },
      speedY: { min: -15, max: -30 }, // Drift slowly upwards
      speedX: { min: -10, max: 10 },
      blendMode: 'ADD',
      advance: 10000 // Pre-warm the emitter so screen is already full
    }).setDepth(0);
  }

  private createFloatingCandies() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const candyCount = 8;
    const candyKeys = ['candy_0', 'candy_1', 'candy_2', 'candy_3', 'candy_4', 'candy_5', 'candy_6'];

    for (let i = 0; i < candyCount; i++) {
      const key = Phaser.Math.RND.pick(candyKeys);
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      
      const candy = this.scene.add.sprite(x, y, key).setDepth(0);
      
      // Depth simulation: smaller scale = farther = slower + more transparent
      const scale = Phaser.Math.FloatBetween(0.3, 0.8);
      candy.setScale(scale);
      candy.setAlpha(scale * 0.5);
      candy.setTint(0xffccdd);

      this.floaters.push(candy);
      this.animateFloater(candy, w, h);
    }
  }

  private animateFloater(candy: Phaser.GameObjects.Sprite, w: number, h: number) {
    if (!candy.scene) return;

    const scale = candy.scaleX;
    const durationX = Phaser.Math.Between(20000, 35000) / scale;
    const durationY = Phaser.Math.Between(25000, 40000) / scale;
    
    const destX = Phaser.Math.Between(candy.x - 300, candy.x + 300);

    // X axis drift
    this.scene.tweens.add({
      targets: candy,
      x: destX,
      duration: durationX,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Y axis drift (generally drifts up slowly)
    this.scene.tweens.add({
      targets: candy,
      y: candy.y - Phaser.Math.Between(200, 500),
      duration: durationY,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Gentle tumbling rotation
    this.scene.tweens.add({
      targets: candy,
      angle: Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(15000, 30000),
      ease: 'Linear',
      yoyo: true,
      repeat: -1
    });
  }

  public resize(w: number, h: number) {
    // Base image
    if (this.bgBase) {
      this.bgBase.setPosition(w / 2, h / 2);
      const scaleX = w / this.bgBase.texture.getSourceImage().width;
      const scaleY = h / this.bgBase.texture.getSourceImage().height;
      this.bgBase.setScale(Math.max(scaleX, scaleY));
    }
    
    // Pink tint overlay
    if (this.overlay) {
      this.overlay.setPosition(w / 2, h / 2).setSize(w, h);
    }
    
    // God rays — reposition and redraw to cover new screen size
    if (this.raysContainer) {
      this.raysContainer.setPosition(w / 2, -100);
      this.drawRays(w, h, this.baseRayAlpha);
    }
    
    // Sugar dust emitter bounds
    if (this.dustEmitter) {
      this.dustEmitter.particleX = { min: 0, max: w } as any;
      this.dustEmitter.particleY = { min: -100, max: h + 100 } as any;
    }
    
    // Clamp floating candies to visible bounds
    for (const candy of this.floaters) {
      if (candy && candy.scene) {
        // If a floater drifted way out of the new bounds, nudge it back
        if (candy.x < -200 || candy.x > w + 200) {
          candy.x = Phaser.Math.Between(50, w - 50);
        }
        if (candy.y < -200 || candy.y > h + 200) {
          candy.y = Phaser.Math.Between(50, h - 50);
        }
      }
    }
  }

  /**
   * Triggers a reactive brightness pulse in the background, typically on a win.
   */
  public triggerWinPulse(intensity: number = 1) {
    if (this.pulseTween) this.pulseTween.stop();
    
    const pulseStrength = Math.min(intensity, 3);
    const targetAlpha = this.baseRayAlpha + (0.15 * pulseStrength);
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    
    // Flash the rays brighter
    this.drawRays(w, h, targetAlpha);
    this.raysContainer.setAlpha(1);
    
    // Fade back to normal over time
    this.pulseTween = this.scene.tweens.add({
      targets: this.raysContainer,
      alpha: 1,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Smoothly transition ray alpha back to base
        const counter = { val: targetAlpha };
        this.scene.tweens.add({
          targets: counter,
          val: this.baseRayAlpha,
          duration: 1000,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            this.drawRays(w, h, counter.val);
          }
        });
      }
    });
  }
}
