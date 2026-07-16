import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-core';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor';
          }
          if (id.includes('src/pages/patient/Dashboard') || id.includes('src/pages/doctor/Dashboard')) {
            return 'chunk-dashboard';
          }
          if (id.includes('src/pages/admin/Reception')) {
            return 'chunk-reception';
          }
          if (id.includes('src/pages/Landing')) {
            return 'chunk-landing';
          }
        }
      }
    }
  }
})
