// src/mini/workers/raster-worker.ts
import * as Comlink from 'comlink'
import { createDebug } from '../core/debug.ts'

const debug = createDebug('RasterWorker', false)

export class RasterWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ImageBitmap | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      debug('fetching', url)
      const res = await fetch(url, { signal: controller.signal })
      debug('response', res.status, res.ok, res.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      debug('arrayBuffer bytes', buf.byteLength)
      const bitmap = await createImageBitmap(new Blob([buf], { type: 'image/png' }))
      debug('bitmap created', bitmap.width, bitmap.height)
      if (!this._pending.has(key)) {
        bitmap.close()
        return null
      }
      this._pending.delete(key)
      return bitmap
    } catch (err) {
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
