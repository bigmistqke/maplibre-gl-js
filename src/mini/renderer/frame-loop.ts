export class FrameLoop {
  private _render: () => void
  private _dirty = false
  private _timerId: ReturnType<typeof setTimeout> | null = null
  private _running = false

  constructor(render: () => void) {
    this._render = render
  }

  start(): void {
    this._running = true
  }

  stop(): void {
    this._running = false
    if (this._timerId !== null) {
      clearTimeout(this._timerId)
      this._timerId = null
    }
    this._dirty = false
  }

  markDirty(): void {
    if (this._dirty || !this._running) return
    this._dirty = true
    this._timerId = setTimeout(() => {
      this._timerId = null
      if (!this._running) return
      this._dirty = false
      this._render()
    }, 0)
  }
}
