import type { RenderExtension, RenderContext } from '../core/render-extension.ts'

export class RenderExtensions {
  private _extensions: RenderExtension[] = []

  add(extension: RenderExtension): void {
    this._extensions.push(extension)
  }

  remove(id: string): void {
    this._extensions = this._extensions.filter(e => e.id !== id)
  }

  getAll(): RenderExtension[] {
    return [...this._extensions]
  }

  runBeforeTiles(ctx: RenderContext): void {
    for (const ext of this._extensions) ext.beforeTiles?.(ctx)
  }

  runAfterTiles(ctx: RenderContext): void {
    for (const ext of this._extensions) ext.afterTiles?.(ctx)
  }
}
