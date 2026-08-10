import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
    const envRoot = path.resolve(__dirname, '..');
    const env = loadEnv(mode, envRoot, '');
    const apiBaseUrl = env.VITE_API_BASE_URL?.replace(/\/$/, '');
    const apiTarget = apiBaseUrl ? apiBaseUrl.replace(/\/api$/, '') : 'http://localhost:8000';

    return {
        plugins: [
            react(),
            VitePWA({
                strategies: 'injectManifest',
                srcDir: 'src',
                filename: 'sw.js',
                registerType: 'autoUpdate',
                injectRegister: 'auto',
                includeAssets: ['img_placeholder.png'],
                manifest: {
                    name: 'Lista del Súper — compras compartidas',
                    short_name: 'Mi Lista',
                    description: 'Listas de compra compartidas para la familia: productos, precios, tiendas y modo comprando.',
                    lang: 'es',
                    start_url: '/',
                    scope: '/',
                    display: 'standalone',
                    orientation: 'portrait',
                    theme_color: '#0f172a',
                    background_color: '#0f172a',
                    icons: [
                        { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                        { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    ],
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                    navigateFallback: '/index.html',
                    runtimeCaching: [
                        {
                            // API: red-first con timeout; si la red falla, sirve caché
                            urlPattern: /\/api\//,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-cache',
                                networkTimeoutSeconds: 6,
                                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
                        {
                            // Imágenes de productos: stale-while-revalidate
                            urlPattern: /\/uploads\//,
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'uploads-cache',
                                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            },
                        },
                    ],
                },
            }),
        ],
        envDir: envRoot,
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true,
                    ws: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
                '/static': {
                    target: apiTarget,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
        build: {
            outDir: 'build',
        },
    };
});
