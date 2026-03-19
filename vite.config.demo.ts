import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'demo',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'demo/index.html'),
        phase1: resolve(__dirname, 'demo/phase1/index.html'),
        phase2: resolve(__dirname, 'demo/phase2/index.html'),
        phase3: resolve(__dirname, 'demo/phase3/index.html'),
        phase4: resolve(__dirname, 'demo/phase4/index.html'),
        phase5: resolve(__dirname, 'demo/phase5/index.html'),
        'phase5-compare': resolve(__dirname, 'demo/phase5/compare.html'),
        phase6: resolve(__dirname, 'demo/phase6/index.html'),
      },
    },
  },
})
