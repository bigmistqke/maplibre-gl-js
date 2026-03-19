import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../demo-dist-phase7',
    rollupOptions: {
      input: {
        phase7: resolve(__dirname, 'demo/phase7/index.html'),
      },
    },
  },
})
