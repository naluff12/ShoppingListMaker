import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const envRoot = path.resolve(__dirname, '..');
    const env = loadEnv(mode, envRoot, '');
    const apiBaseUrl = env.VITE_API_BASE_URL?.replace(/\/$/, '');
    const apiTarget = apiBaseUrl ? apiBaseUrl.replace(/\/api$/, '') : 'http://localhost:8000';

    return {
        plugins: [react()],
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
