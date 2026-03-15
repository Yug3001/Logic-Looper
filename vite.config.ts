import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],

    build: {
        // Raise warning limit – Recharts + Framer Motion are large but chunked below
        chunkSizeWarningLimit: 600,

        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks for better caching
                    'vendor-react': ['react', 'react-dom', 'react-redux'],
                    'vendor-redux': ['@reduxjs/toolkit', 'redux'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-charts': ['recharts'],
                    'vendor-dayjs': ['dayjs'],
                    'vendor-idb': ['idb'],
                    'vendor-router': ['react-router-dom'],
                    'vendor-socket': ['socket.io-client'],
                },
            },
        },
    },

    // Proxy API + WebSocket to Express backend in dev
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            },
            '/socket.io': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
                ws: true,  // proxy WebSocket upgrades
            },
        },
    },
});
