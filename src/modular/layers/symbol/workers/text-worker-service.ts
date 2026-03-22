// src/modular/layers/symbol/workers/text-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { GlyphMap, GlyphPositions, SymbolTileData } from '@modular/layers/symbol/types.ts'

type SymbolWorkerType = import('./symbol-worker-point.ts').SymbolWorkerPoint

/**
 * Main-thread wrapper around the Comlink-exposed SymbolWorkerPoint.
 * Not a TileService — symbol tiles follow a side-channel protocol.
 */
export class TextWorkerService {
  private _worker: Worker
  private _proxy: Remote<SymbolWorkerType>

  constructor() {
    this._worker = new Worker(
      new URL('./symbol-worker-point.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<SymbolWorkerType>(this._worker)
  }

  /**
   * Trigger layout for a tile in the worker using an already-fetched PBF buffer.
   * Fire and forget — result is retrieved via getBucket().
   */
  requestFromPbf(
    key: string,
    pbfBuffer: ArrayBuffer,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): void {
    void this._proxy.requestFromPbf(key, pbfBuffer, textField, sourceLayer, fontstack, fontSize)
  }

  /**
   * Trigger layout for a tile in the worker.
   * The worker fetches the PBF, finds needed glyph ranges, and either
   * resolves immediately or queues until updateGlyphs() supplies them.
   */
  async request(
    key: string,
    url: string,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): Promise<void> {
    // Fire and forget — result is retrieved via getBucket()
    void this._proxy.request(key, url, textField, sourceLayer, fontstack, fontSize)
  }

  /**
   * Retrieve the pre-built SymbolTileData for a tile (if layout has completed).
   * Returns null if the tile is still waiting for glyphs or hasn't been requested.
   */
  async getBucket(key: string): Promise<SymbolTileData | null> {
    return this._proxy.getBucket(key)
  }

  /**
   * Push newly loaded glyphs and atlas positions to the worker.
   * Called by GlyphManager._onGlyphsLoaded via TextLayer.onAdd().
   */
  updateGlyphs(glyphMap: GlyphMap, positions: GlyphPositions): void {
    void this._proxy.updateGlyphs(glyphMap, positions)
  }

  clearAllBuckets(): void {
    void this._proxy.clearAllBuckets()
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)
  }

  destroy(): void {
    void this._proxy.destroy()
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
