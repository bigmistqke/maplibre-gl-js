// vitest.config.mini.browser.ts
import { defineConfig, type Plugin } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// Minimal 1×1 transparent PNG served by the Vite dev server.
// The Web Worker fetches from the same origin, so no MSW needed.
const FAKE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC'

function testTileServerPlugin(): Plugin {
  return {
    name: 'test-tile-server',
    configureServer(server) {
      server.middlewares.use('/__test-tiles__', (req, res, next) => {
        if (!req.url) return next()
        if (req.url.startsWith('/error')) {
          res.statusCode = 500
          res.end()
        } else {
          const png = Buffer.from(FAKE_PNG_B64, 'base64')
          res.setHeader('Content-Type', 'image/png')
          res.setHeader('Content-Length', String(png.length))
          res.end(png)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [testTileServerPlugin()],
  test: {
    name: 'mini-browser',
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    include: ['src/mini/**/*.browser.test.ts'],
  },
})
