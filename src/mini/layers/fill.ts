import type { TileID } from '../core/types'
import type { TileService } from '../core/tile-service'

export class VectorTileService implements TileService {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    const controller = new AbortController()
    this._pending.set(tileID.key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!this._pending.has(tileID.key)) return []
      this._pending.delete(tileID.key)
      return [buf]
    } catch {
      this._pending.delete(tileID.key)
      return []
    }
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }

  destroy(): void {
    for (const c of this._pending.values()) c.abort()
    this._pending.clear()
  }
}
