import Phaser from 'phaser';

/**
 * Procedural Mascot (Jelly King) for AAA Slot feedback.
 * Acts as a reactive element beside the grid to celebrate wins and react to dead spins.
 */
export class Mascot {
  private scene: Phaser.Scene;
  public container!: Phaser.GameObjects.Container;
  
  private body!: Phaser.GameObjects.Graphics;
  private leftArm!: Phaser.GameObjects.Graphics;
  private rightArm!: Phaser.GameObjects.Graphics;
  private face!: Phaser.GameObjects.Graphics;
  private crown!: Phaser.GameObjects.Graphics;
  
  private idleTween!: Phaser.Tweens.Tween;
  
  // Base positions for animation resets
  private lArmBase = { x: -45, y: 15, angle: 15 };
  private rArmBase = { x: 45, y: 15, angle: -15 };
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public init(x: number, y: number) {
    this.container = this.scene.add.container(x, y).setDepth(20);

    // Render body parts
    this.drawBodyParts();
    
    // Set up idle animation (breathing/floating)
    this.startIdle();
  }

  public setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  public setScale(scale: number) {
    this.container.setScale(scale);
  }

  private drawBodyParts() {
    // Left Arm
    this.leftArm = this.scene.add.graphics();
    this.leftArm.fillStyle(0xff4488, 1);
    this.leftArm.fillRoundedRect(-15, -10, 30, 50, 15);
    this.leftArm.setPosition(this.lArmBase.x, this.lArmBase.y);
    this.leftArm.setAngle(this.lArmBase.angle);

    // Right Arm
    this.rightArm = this.scene.add.graphics();
    this.rightArm.fillStyle(0xff4488, 1);
    this.rightArm.fillRoundedRect(-15, -10, 30, 50, 15);
    this.rightArm.setPosition(this.rArmBase.x, this.rArmBase.y);
    this.rightArm.setAngle(this.rArmBase.angle);

    // Main Body (Jelly blob)
    this.body = this.scene.add.graphics();
    this.body.fillStyle(0xff2266, 1);
    this.body.fillEllipse(0, 30, 110, 120);
    
    // Jelly highlight/sheen
    this.body.fillStyle(0xffffff, 0.25);
    this.body.fillEllipse(-20, 0, 40, 30);

    // Face (Eyes and Mouth)
    this.face = this.scene.add.graphics();
    this.drawNormalFace();

    // Crown
    this.crown = this.scene.add.graphics();
    this.crown.fillStyle(0xffcc00, 1);
    this.crown.beginPath();
    this.crown.moveTo(-25, -20);
    this.crown.lineTo(-35, -50);
    this.crown.lineTo(-10, -40);
    this.crown.lineTo(0, -60);
    this.crown.lineTo(10, -40);
    this.crown.lineTo(35, -50);
    this.crown.lineTo(25, -20);
    this.crown.closePath();
    this.crown.fillPath();
    this.crown.fillStyle(0xffffff, 0.4);
    this.crown.fillCircle(0, -50, 4);

    this.container.add([this.leftArm, this.rightArm, this.body, this.face, this.crown]);
  }

  private drawNormalFace() {
    this.face.clear();
    // Eyes
    this.face.fillStyle(0xffffff, 1);
    this.face.fillCircle(-18, 15, 12);
    this.face.fillCircle(18, 15, 12);
    // Pupils
    this.face.fillStyle(0x000000, 1);
    this.face.fillCircle(-18, 15, 6);
    this.face.fillCircle(18, 15, 6);
    // Cute smile
    this.face.lineStyle(4, 0x000000, 1);
    this.face.beginPath();
    this.face.arc(0, 25, 8, 0, Math.PI, false);
    this.face.strokePath();
  }

  private drawCheerFace() {
    this.face.clear();
    // Happy squint eyes (upward arcs)
    this.face.lineStyle(5, 0x000000, 1);
    this.face.beginPath();
    this.face.arc(-18, 18, 8, Math.PI, 0, false);
    this.face.strokePath();
    this.face.beginPath();
    this.face.arc(18, 18, 8, Math.PI, 0, false);
    this.face.strokePath();
    // Wide open mouth
    this.face.fillStyle(0x000000, 1);
    this.face.fillEllipse(0, 32, 20, 24);
    this.face.fillStyle(0xff0044, 1);
    this.face.fillEllipse(0, 38, 12, 10); // Tongue
  }

  private drawSadFace() {
    this.face.clear();
    // Droopy eyes
    this.face.fillStyle(0xffffff, 1);
    this.face.fillCircle(-18, 20, 10);
    this.face.fillCircle(18, 20, 10);
    this.face.fillStyle(0x000000, 1);
    this.face.fillCircle(-18, 22, 5);
    this.face.fillCircle(18, 22, 5);
    // Sad frown
    this.face.lineStyle(4, 0x000000, 1);
    this.face.beginPath();
    this.face.arc(0, 35, 8, Math.PI, 0, false);
    this.face.strokePath();
  }

  private drawActionFace() {
    this.face.clear();
    // Angry/determined eyes (slanted lines)
    this.face.lineStyle(6, 0x000000, 1);
    this.face.beginPath();
    this.face.moveTo(-25, 10);
    this.face.lineTo(-12, 18);
    this.face.strokePath();
    this.face.beginPath();
    this.face.moveTo(25, 10);
    this.face.lineTo(12, 18);
    this.face.strokePath();
    // Gritting teeth
    this.face.fillStyle(0xffffff, 1);
    this.face.fillRoundedRect(-10, 28, 20, 8, 2);
    this.face.lineStyle(2, 0x000000, 1);
    this.face.strokeRoundedRect(-10, 28, 20, 8, 2);
  }

  private startIdle() {
    this.idleTween = this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 12,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.scene.tweens.add({
      targets: [this.leftArm, this.rightArm],
      angle: (target: Phaser.GameObjects.Graphics) => target === this.leftArm ? this.lArmBase.angle - 10 : this.rArmBase.angle + 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  public playCheer() {
    this.drawCheerFace();
    
    // Jump up
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 40,
      duration: 250,
      yoyo: true,
      repeat: 3,
      ease: 'Quad.easeOut'
    });

    // Throw arms up
    this.scene.tweens.add({
      targets: this.leftArm,
      angle: -150,
      y: -20,
      duration: 200,
      yoyo: true,
      repeat: 3
    });
    this.scene.tweens.add({
      targets: this.rightArm,
      angle: 150,
      y: -20,
      duration: 200,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.resetToNormal();
      }
    });
  }

  public playDisappointment() {
    this.drawSadFace();
    
    // Slump down
    this.scene.tweens.add({
      targets: this.container,
      scaleY: 0.8,
      scaleX: 1.1,
      y: this.container.y + 20,
      duration: 400,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1200, () => {
          this.scene.tweens.add({
            targets: this.container,
            scaleY: 1,
            scaleX: 1,
            y: this.container.y - 20,
            duration: 300,
            ease: 'Quad.easeInOut',
            onComplete: () => this.resetToNormal()
          });
        });
      }
    });

    // Arms drop
    this.scene.tweens.add({
      targets: this.leftArm,
      angle: -10,
      y: 30,
      duration: 400
    });
    this.scene.tweens.add({
      targets: this.rightArm,
      angle: 10,
      y: 30,
      duration: 400
    });
  }

  public playZap(targetX: number, targetY: number) {
    this.drawActionFace();

    // Wind up
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.9,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    // Throw arm forward
    this.scene.tweens.add({
      targets: this.rightArm,
      angle: 90,
      x: 60,
      duration: 150,
      onComplete: () => {
        // Create zap particle effect from hand to target
        this.createLightning(
          this.container.x + this.rightArm.x + 10, 
          this.container.y + this.rightArm.y - 10, 
          targetX, 
          targetY
        );

        this.scene.time.delayedCall(400, () => {
          this.scene.tweens.add({
            targets: this.rightArm,
            angle: this.rArmBase.angle,
            x: this.rArmBase.x,
            duration: 200,
            onComplete: () => this.resetToNormal()
          });
        });
      }
    });
  }

  private createLightning(startX: number, startY: number, endX: number, endY: number) {
    // Generate a quick jagged line for a lightning bolt
    const bolt = this.scene.add.graphics().setDepth(30);
    bolt.lineStyle(6, 0xffee00, 1);
    
    // Draw jagged path
    bolt.beginPath();
    bolt.moveTo(startX, startY);
    
    const dist = Phaser.Math.Distance.Between(startX, startY, endX, endY);
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    
    let currentDist = 0;
    while(currentDist < dist - 20) {
      currentDist += 20 + Math.random() * 30;
      const tX = startX + Math.cos(angle) * currentDist + (Math.random() * 40 - 20);
      const tY = startY + Math.sin(angle) * currentDist + (Math.random() * 40 - 20);
      bolt.lineTo(tX, tY);
    }
    bolt.lineTo(endX, endY);
    bolt.strokePath();

    // Add a flash
    const flash = this.scene.add.circle(endX, endY, 40, 0xffee00, 0.6).setDepth(29);
    
    // Tween out and destroy
    this.scene.tweens.add({
      targets: [bolt, flash],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        bolt.destroy();
        flash.destroy();
      }
    });
  }

  private resetToNormal() {
    this.drawNormalFace();
    this.scene.tweens.add({
      targets: this.leftArm,
      angle: this.lArmBase.angle,
      y: this.lArmBase.y,
      x: this.lArmBase.x,
      duration: 200
    });
    this.scene.tweens.add({
      targets: this.rightArm,
      angle: this.rArmBase.angle,
      y: this.rArmBase.y,
      x: this.rArmBase.x,
      duration: 200
    });
  }
}
