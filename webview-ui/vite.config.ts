import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/index.js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/index.[ext]`,
          manualChunks(id) {
            if (id.includes('node_modules/mermaid')) return 'vendor-mermaid';
            if (id.includes('node_modules/d3')) return 'vendor-d3';
            if (id.includes('node_modules/cytoscape')) return 'vendor-cytoscape';
            if (id.includes('node_modules/katex')) return 'vendor-katex';
          }
        }
      }
    }
  };
});
