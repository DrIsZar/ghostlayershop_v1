import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Let Vite optimize lucide-react for better tree-shaking
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: false,
    // Enable minification
    minify: 'esbuild',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React and React DOM
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // React Router
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // Chart libraries
            if (id.includes('chart.js') || id.includes('react-chartjs')) {
              return 'vendor-charts';
            }
            // Lucide icons (large library, split separately)
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Other vendor libraries
            return 'vendor';
          }
        },
      },
    },
    // Enable compression
    reportCompressedSize: true,
  },
  define: {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: '{"isDisabled": true}',
  },
});
