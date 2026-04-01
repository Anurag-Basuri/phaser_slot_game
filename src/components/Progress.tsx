import type Phaser from 'phaser';
import { Graphics, Text, useScene } from 'phaser-jsx';

export function Progress() {
  const scene = useScene();
  let loadingText!: Phaser.GameObjects.Text;
  let progressBar!: Phaser.GameObjects.Graphics;
  let progressBox!: Phaser.GameObjects.Graphics;

  scene.load.on('progress', (value: number) => {
    if (!progressBar?.scene) return; // Guard: already destroyed
    progressBar.clear();
    progressBar.fillStyle(0xff00cc, 1);

    const barW = Math.min(880, scene.scale.width * 0.8);
    const barX = (scene.scale.width - barW) / 2;
    const barY = scene.scale.height / 2 - 15;
    progressBar.fillRect(barX, barY, barW * value, 30);

    loadingText?.setText(`${Math.floor(value * 100)}%`);
  });

  scene.load.on('complete', () => {
    progressBar?.destroy();
    progressBox?.destroy();
    loadingText?.destroy();
  });

  return (
    <>
      <Graphics ref={(gameObject) => (progressBar = gameObject)} />

      <Graphics
        ref={(gameObject) => {
          progressBox = gameObject;
          progressBox.fillStyle(0x222222, 0.8);
          const barW = Math.min(900, scene.scale.width * 0.82);
          const barX = (scene.scale.width - barW) / 2;
          const barY = scene.scale.height / 2 - 25;
          progressBox.fillRect(barX, barY, barW, 50);
        }}
      />

      <Text
        x={scene.scale.width / 2}
        y={scene.scale.height / 2 + 30}
        text="0%"
        originX={0.5}
        originY={0.5}
        style={{
          color: '#fff',
          font: '30px monospace',
        }}
        ref={(gameObject) => (loadingText = gameObject)}
      />
    </>
  );
}
