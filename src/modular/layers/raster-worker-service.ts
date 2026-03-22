// src/modular/layers/raster-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '@modular/core/types.ts'
import type { TileService } from '@modular/core/tile-service.ts'

// Type-only import of the worker class — loaded via URL at runtime, not bundled inline
type RasterWorkerType = import('../workers/raster-worker.ts').RasterWorker

export class WorkerRasterTileService implements TileService {
  private _worker: Worker
  private _proxy: Remote<RasterWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('../workers/raster-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<RasterWorkerType>(this._worker)
  }

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const bitmap = await this._proxy.request(tileID.key, url)
    return bitmap ? [bitmap] : []
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)  // fire and forget
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
