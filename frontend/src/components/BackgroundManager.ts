import Phaser from 'phaser';

export class BackgroundManager {
  private scene: Phaser.Scene;
  private bgBase!: Phaser.GameObjects.Image;
  private raysGraphics!: Phaser.GameObjects.Graphics;
  private raysContainer!: Phaser.GameObjects.Container;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  
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
    const overlay = this.scene.add.rectangle(w/2, h/2, w, h, 0xffbbdd, 0.1).setDepth(0);
    overlay.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createGodRays() {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    
    this.raysContainer = this.scene.add.container(w / 2, -100).setDepth(0);
    this.raysGraphics = this.scene.add.graphics();
    this.raysContainer.add(this.raysGraphics);
    
    const rayCount = 12;
    const rayLength = Math.max(w, h) * 1.5;
    
    this.raysGraphics.fillStyle(0xffffff, this.baseRayAlpha);
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const angleNext = ((i + 0.4) / rayCount) * Math.PI * 2; // 0.4 for ray width
      
      this.raysGraphics.beginPath();
      this.raysGraphics.moveTo(0, 0);
      this.raysGraphics.lineTo(Math.cos(angle) * rayLength, Math.sin(angle) * rayLength);
      this.raysGraphics.lineTo(Math.cos(angleNext) * rayLength, Math.sin(angleNext) * rayLength);
      this.raysGraphics.closePath();
      this.raysGraphics.fillPath();
    }
    
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
      // Spawn at random positions across the screen
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      
      const candy = this.scene.add.sprite(x, y, key).setDepth(0);
      
      // Depth simulation: 
      // Smaller scale = farther away = slower, more transparent
      // Larger scale = closer = faster, less transparent
      const scale = Phaser.Math.FloatBetween(0.3, 0.8);
      candy.setScale(scale);
      candy.setAlpha(scale * 0.5); // Max alpha around 0.4
      
      // Optional: Add a slight tint or blur if using WebGL shaders, 
      // but for basic performance we'll just use alpha and scale to imply depth.
      candy.setTint(0xffccdd); // Soft pinkish tint

      this.animateFloater(candy, w, h);
    }
  }

  private animateFloater(candy: Phaser.GameObjects.Sprite, w: number, h: number) {
    if (!candy.scene) return; // Prevent errors if scene is destroyed

    const scale = candy.scaleX; // Use scale to determine speed
    const durationX = Phaser.Math.Between(20000, 35000) / scale;
    const durationY = Phaser.Math.Between(25000, 40000) / scale;
    
    // Determine random destination within reasonable bounds
    const destX = Phaser.Math.Between(candy.x - 300, candy.x + 300);
    const destY = Phaser.Math.Between(-100, h + 100);

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
    if (this.bgBase) {
      this.bgBase.setPosition(w / 2, h / 2);
      const scaleX = w / this.bgBase.texture.getSourceImage().width;
      const scaleY = h / this.bgBase.texture.getSourceImage().height;
      this.bgBase.setScale(Math.max(scaleX, scaleY));
    }
    
    if (this.raysContainer) {
      this.raysContainer.setPosition(w / 2, -100);
    }
    
    if (this.dustEmitter) {
      this.dustEmitter.particleX = { min: 0, max: w } as any;
      this.dustEmitter.particleY = { min: -100, max: h + 100 } as any;
    }
  }

  /**
   * Triggers a reactive brightness pulse in the background, typically on a win.
   */
  public triggerWinPulse(intensity: number = 1) {
    if (this.pulseTween) this.pulseTween.stop();
    
    // Cap intensity
    const pulseStrength = Math.min(intensity, 3);
    const targetAlpha = this.baseRayAlpha + (0.15 * pulseStrength);
    
    this.raysContainer.setAlpha(targetAlpha);
    
    this.pulseTween = this.scene.tweens.add({
      targets: this.raysContainer,
      alpha: 1, // Full opacity container
      duration: 600,
      ease: 'Sine.easeOut',
      onStart: () => {
        this.raysGraphics.clear();
        this.raysGraphics.fillStyle(0xffffff, targetAlpha);
        // Redraw rays with higher alpha
        const w = this.scene.cameras.main.width;
        const h = this.scene.cameras.main.height;
        const rayCount = 12;
        const rayLength = Math.max(w, h) * 1.5;
        
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
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.raysContainer,
          alpha: 1,
          duration: 1000,
          onUpdate: (t) => {
            // Fade back to normal
            const currentAlpha = Phaser.Math.Linear(targetAlpha, this.baseRayAlpha, t.progress);
            this.raysGraphics.clear();
            this.raysGraphics.fillStyle(0xffffff, currentAlpha);
            const w = this.scene.cameras.main.width;
            const h = this.scene.cameras.main.height;
            const rayCount = 12;
            const rayLength = Math.max(w, h) * 1.5;
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
        });
      }
    });
  }
}
