import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export const dataDir = fileURLToPath(new URL('../../data', import.meta.url));

// Full-page app (index.html) plus a dev page for the embeddable widget (widget.html).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@data': dataDir } },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        widget: fileURLToPath(new URL('widget.html', import.meta.url)),
      },
    },
  },
});
