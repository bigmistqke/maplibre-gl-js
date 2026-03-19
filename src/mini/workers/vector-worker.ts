// src/mini/workers/vector-worker.ts
import * as Comlink from 'comlink'

export class VectorWorker {
  private _pending = new globalThis.Map<string, AbortController>()

  async request(key: string, url: string): Promise<ArrayBuffer | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      if (!this._pending.has(key)) return null
      this._pending.delete(key)
      return buf
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

Comlink.expose(new VectorWorker())
