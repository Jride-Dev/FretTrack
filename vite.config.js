import { defineConfig, loadEnv, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export function assertSafeDevelopmentSupabase(mode, env) {
  const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim();
  const allowRemoteDevelopment = String(env.VITE_ALLOW_REMOTE_DEV || '').trim().toLowerCase() === 'true';
  const usesLocalSupabase = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(supabaseUrl);

  if (mode === 'development' && supabaseUrl && !usesLocalSupabase && !allowRemoteDevelopment) {
    throw new Error(
      'Development startup refused a remote Supabase URL. Start local Supabase and configure .env.local, ' +
      'or set VITE_ALLOW_REMOTE_DEV=true only when remote development access is intentional.'
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  assertSafeDevelopmentSupabase(mode, env);

  return {
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
  };
});
