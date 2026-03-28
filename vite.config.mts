import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  esbuild: {
    jsxImportSource: 'phaser-jsx',
  },
  server: {
    host: true, // Allow external access for mobile testing
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
