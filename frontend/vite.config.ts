import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Caminhos da API (backend/src/app.ts). Em produção a API e o app estão no
 * mesmo host (ADR-007), então o service worker precisa saber o que é API.
 * `/agenda` sozinho é tela do app (a API só tem `/agenda/...`).
 */
const CAMINHO_API = /^\/(auth|clients|dashboard|insights|visits|stock-messages|contacts|users|health)(\/|$)|^\/agenda\//

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA instalável, sem modo offline de escrita (ADR-012): o service worker
    // guarda só a casca do app (HTML, JS, CSS, fontes, ícones); a API passa
    // sempre pela rede. Service worker só no build/preview, não no `npm run dev`.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ChokoCRM',
        short_name: 'ChokoCRM',
        description: 'Gestão de visitas para representantes comerciais',
        lang: 'pt-BR',
        theme_color: '#3e2723',
        background_color: '#faf3e9',
        display: 'standalone',
        start_url: '/clientes',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Casca: o padrão (js, css, html) e só o subconjunto latino das
        // fontes do @fontsource (os outros alfabetos não são usados). Os
        // ícones entram por `includeAssets` e pelo manifest.
        globPatterns: ['**/*.{js,css,html}', 'assets/*-latin-[0-9]*.woff2'],
        navigateFallback: '/index.html',
        // Navegação direta para um endereço da API (ex.: /health) vai ao servidor
        navigateFallbackDenylist: [CAMINHO_API],
        runtimeCaching: [
          {
            // Esta função é copiada como texto para o sw.js: não pode usar
            // CAMINHO_API daqui (não existe lá), por isso a expressão repetida.
            urlPattern: ({ url }) =>
              /^\/(auth|clients|dashboard|insights|visits|stock-messages|contacts|users|health)(\/|$)|^\/agenda\//.test(
                url.pathname,
              ),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
