import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../demo-dist-phase6',
    rollupOptions: {
      input: {
        phase6: resolve(__dirname, 'demo/phase6/index.html'),
      },
    },
  },
})
