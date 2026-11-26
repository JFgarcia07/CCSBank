import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// Nota: se quitó vite-plugin-vue-devtools porque ralentiza mucho el modo desarrollo.
export default defineConfig({
  // El .env único está en la raíz del repositorio (solo se exponen las variables VITE_*).
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
