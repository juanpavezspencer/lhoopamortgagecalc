import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { dataDir } from './vite.config';

// Embeddable widget: one self-contained script (styles inlined into a shadow root).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@data': dataDir } },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist/widget',
    lib: {
      entry: 'src/widget.tsx',
      formats: ['iife'],
      name: 'SeiyaCalculator',
      fileName: () => 'seiya-calculator.js',
    },
  },
});
