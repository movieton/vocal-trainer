import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // в разработке запросы /api идут на локальный сервер аккаунтов (server/index.mjs)
  server: { proxy: { '/api': 'http://localhost:8787' } },
  plugins: [
    react(),
    // PWA: устанавливается на экран «Домой», работает без сети; новая версия — по кнопке «Обновить»
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon.png', 'brand/*.woff2'],
      manifest: {
        name: 'fasol.app — тренажёр голоса',
        short_name: 'fasol',
        description: 'Распевки, слух, дыхание и сочинение мелодий',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7F8FC',
        theme_color: '#3454F4',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,woff2}'],
        navigateFallback: 'index.html',
        // вход через Google/Яндекс — это переходы на /api, их не подменяем приложением из кэша
        navigateFallbackDenylist: [/^\/api\//],
        // сэмплы рояля с CDN — в кэш при первом проигрывании, дальше работают без сети
        runtimeCaching: [{
          urlPattern: /^https:\/\/(?!lalo-app\.com).*\.(ogg|mp3|m4a|json)(\?.*)?$/,
          handler: 'CacheFirst',
          options: { cacheName: 'piano-samples', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 180 }, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
  // относительные пути: сайт работает и локально, и в подпапке на сервере
  base: './',
})
