import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Nogaria Travel',
        short_name: 'Nogaria',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        // slate-950, o fundo do tema escuro (ver --color-ink-950 em src/index.css)
        background_color: '#020617',
        // roxo da marca (favicon.svg / gradientes do app)
        theme_color: '#863bff',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache do app shell (JS/CSS/HTML gerados pelo build) fica no
        // padrão do plugin. Runtime caching abaixo cobre só o que é seguro
        // reler offline — nunca a API do Supabase nem as edge functions,
        // que carregam dados dinâmicos por tenant/sessão (auth, DRE, bot).
        navigateFallbackDenylist: [/^\/functions\//, /^\/auth\//],
        runtimeCaching: [
          {
            // Supabase REST (PostgREST) — leitura offline da viagem ativa.
            // NetworkFirst: tenta a rede (timeout curto) e só cai pro cache
            // se a rede falhar/demorar; nunca serve dado desatualizado por
            // padrão. Só GET (mutations não são cacheáveis) e só respostas
            // 200 (erros/4xx/5xx nunca entram no cache).
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/v1/') &&
              request.method === 'GET',
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 3600,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // Supabase Auth (GoTrue) — nunca cachear: tokens/sessão não
            // podem ser servidos do cache.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth/'),
            handler: 'NetworkOnly',
          },
          {
            // Edge functions (whatsapp-webhook, daily-digest, copilot-chat,
            // etc.) — sempre rede. São efeitos colaterais/streaming, não
            // recursos estáticos, e nunca devem ser respondidos do cache.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/functions/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
