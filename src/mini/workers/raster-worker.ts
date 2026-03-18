// src/mini/workers/raster-worker.ts
import * as Comlink from 'comlink'

export class RasterWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ImageBitmap | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      const buf = await fetch(url, { signal: controller.signal }).then(r => r.arrayBuffer())
      const bitmap = await createImageBitmap(new Blob([buf]))
      if (!this._pending.has(key)) {
        bitmap.close()
        return null
      }
      this._pending.delete(key)
      return Comlink.transfer(bitmap, [bitmap])
    } catch {
      this._pending.delete(key)
      return null
    }
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }
}

Comlink.expose(new RasterWorker())
