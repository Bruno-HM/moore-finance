import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") 
          ? process.env.GEMINI_API_KEY 
          : (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") 
            ? env.GEMINI_API_KEY 
            : ""
      ),
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY || ""),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in some AI environments via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        // Use polling to ensure file changes are detected on all Windows setups
        usePolling: true,
        interval: 100,
      }
    },
  };
});
