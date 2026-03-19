// src/mini/workers/dem-worker.ts
// Port of MapLibre's raster_dem_tile_worker_source.ts.
// Fetches a terrain-RGB PNG, decodes it into an RGBA pixel array with 1px
// border padding (matching MapLibre's DEMData constructor), and returns the
// raw ArrayBuffer so the terrain plugin can upload it to the GPU and sample
// it for CPU-side elevation queries.
//
// Buffer layout (all Uint32):
//   [0] dim    — core tile dimension (e.g. 256)
//   [1] stride — dim + 2 (includes 1px padding border on each side)
//   [2..2+stride*stride-1] — RGBA pixels as Uint32 (R|G<<8|B<<16|A<<24 LE)
import * as Comlink from 'comlink'

// _idx(col, row, stride) — matches MapLibre DEMData._idx(x, y)
function _idx(col: number, row: number, stride: number): number {
  return (row + 1) * stride + (col + 1)
}

export class DEMWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ArrayBuffer | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      const bitmap = await createImageBitmap(new Blob([buf], { type: 'image/png' }))

      if (!this._pending.has(key)) {
        bitmap.close()
        return null
      }
      this._pending.delete(key)

      const dim = bitmap.width  // square DEM tiles
      const stride = dim + 2   // +1px padding on each side

      // Draw bitmap to OffscreenCanvas to extract raw RGBA pixel data
      const canvas = new OffscreenCanvas(dim, dim)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const { data } = ctx.getImageData(0, 0, dim, dim)

      // Allocate output: 2 Uint32 header + stride×stride pixels
      const HEADER = 2
      const out = new Uint32Array(HEADER + stride * stride)
      out[0] = dim
      out[1] = stride

      // Copy source pixels into padded core area (offset +1 in each direction)
      const src = new Uint32Array(data.buffer)
      for (let row = 0; row < dim; row++) {
        for (let col = 0; col < dim; col++) {
          out[HEADER + _idx(col, row, stride)] = src[row * dim + col]
        }
      }

      // Fill 1px border by replicating edge pixels — matches MapLibre dem_data.ts
      for (let x = 0; x < dim; x++) {
        out[HEADER + _idx(-1,    x, stride)] = out[HEADER + _idx(0,       x, stride)] // left
        out[HEADER + _idx(dim,   x, stride)] = out[HEADER + _idx(dim - 1, x, stride)] // right
        out[HEADER + _idx(x,    -1, stride)] = out[HEADER + _idx(x,       0, stride)] // top
        out[HEADER + _idx(x,   dim, stride)] = out[HEADER + _idx(x, dim - 1, stride)] // bottom
      }

      return Comlink.transfer(out.buffer, [out.buffer])
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

Comlink.expose(new DEMWorker())
