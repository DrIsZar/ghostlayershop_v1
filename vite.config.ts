import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: false,
  },
  define: {
    __REACT_DEVTOOLS_GLOBAL_HOOK__: '{"isDisabled": true}',
  },
});
