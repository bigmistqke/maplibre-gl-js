import { GlyphManager } from '@modular/layers/symbol/glyph-manager.ts'
import { ImageManager } from '@modular/layers/symbol/image-manager.ts'

export class ResourceManager {
  private _glyphManagers = new Map<string, GlyphManager>()
  private _imageManagers = new Map<string, ImageManager>()

  getGlyphManager(glyphUrl: string, fontstack: string): GlyphManager {
    const key = `${glyphUrl}|${fontstack}`
    let gm = this._glyphManagers.get(key)
    if (!gm) {
      gm = new GlyphManager({ url: glyphUrl })
      this._glyphManagers.set(key, gm)
    }
    return gm
  }

  getImageManager(spriteUrl: string): ImageManager {
    let im = this._imageManagers.get(spriteUrl)
    if (!im) {
      im = new ImageManager({ url: spriteUrl })
      this._imageManagers.set(spriteUrl, im)
    }
    return im
  }

  destroy(): void {
    for (const gm of this._glyphManagers.values()) gm.destroy()
    for (const im of this._imageManagers.values()) (im as any).destroy?.()
    this._glyphManagers.clear()
    this._imageManagers.clear()
  }
}
