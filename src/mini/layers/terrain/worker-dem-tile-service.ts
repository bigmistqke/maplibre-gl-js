// src/mini/layers/terrain/worker-dem-tile-service.ts
// Port of MapLibre's WorkerDEMTileSource pattern.
// Returns the decoded DEM ArrayBuffer (with header) as a Transferable so
// TileManager stores it zero-copy and the terrain plugin can read it.
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { TileID } from '../../core/types.ts'
import type { TileService } from '../../core/tile-service.ts'

type DEMWorkerType = import('../../workers/dem-worker.ts').DEMWorker

export class WorkerDEMTileService implements TileService {
  private _worker: Worker
  private _proxy: Remote<DEMWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('../../workers/dem-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<DEMWorkerType>(this._worker)
  }

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const buffer = await this._proxy.request(tileID.key, url)
    return buffer ? [buffer] : []
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
