import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { claudeBridge } from './vite/claude-bridge';
import { checkSupabaseEnv } from './vite/checkEnv';

export default defineConfig({
  plugins: [
    react(),
    // Fails the build on a malformed Supabase address or key, instead of deploying a blank site.
    checkSupabaseEnv(),
    tailwindcss(),
    // Dev-only, opt-in (VESPERA_CLAUDE_BRIDGE=1): lets the Oracle ask the Mac's `claude` CLI.
    claudeBridge(),
    VitePWA({
      // New versions install and take over by themselves; src/lib/pwa.ts reloads open tabs at a safe moment.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'Vespera — a storybook planner',
        short_name: 'Vespera',
        description: 'Vespera — a storybook planner',
        theme_color: '#1A1110',
        background_color: '#1A1110',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell so it opens offline. Supabase requests are never cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The Anthropic SDK only loads for people who add their own key (online anyway): don't make every install download it.
        globIgnores: ['**/sdk-*.js', '**/node.browser-*.js'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Lets the realm-palette test read the theme tokens via 'src/index.css?raw'.
    css: { include: [/src\/index\.css/] },
    // Red-team repro tests stay quarantined until fixed: run them with `npm run test:redteam`.
    exclude: [...configDefaults.exclude, 'e2e/**', ...(process.env.VESPERA_REDTEAM === '1' ? [] : ['src/redteam/**'])],
    // Unit tests never talk to a real Supabase project, even when .env.local holds the keys.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
});
