import { defineConfig, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true
  },
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: {
        '.js': 'jsx'
      }
    }
  },
  plugins: [
    {
      name: 'load-js-files-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.match(/src[\\/].*\.js$/)) {
          return null;
        }
        return transformWithOxc(code, id, {
          lang: 'jsx',
          jsx: {
            runtime: 'automatic',
            importSource: 'react'
          }
        });
      }
    },
    react({
      include: /\.(js|jsx)$/
    }),
    legacy({
      targets: ['defaults', 'iOS >= 12', 'Safari >= 12'],
      modernPolyfills: true,
      polyfills: true,
      renderLegacyChunks: true
    })
  ]
});
