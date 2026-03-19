// src/mini/layers/vector-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '../core/types.ts'
import type { TileService } from '../core/tile-service.ts'

// Type-only import of the worker class — loaded via URL at runtime, not bundled inline
type VectorWorkerType = import('../workers/vector-worker.ts').VectorWorker

export class WorkerVectorTileService implements TileService {
  private _worker: Worker
  private _proxy: Remote<VectorWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('../workers/vector-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<VectorWorkerType>(this._worker)
  }

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const buf = await this._proxy.request(tileID.key, url)
    return buf ? [buf] : []
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)  // fire and forget
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
