import type { SpriteData } from '@modular/layers/symbol/icon-types.ts'

export type SpriteResult = {
  data: SpriteData
  image: ImageData
}

/**
 * Fetch sprite.json and sprite.png from a sprite URL base (no extension).
 * E.g. url = 'https://example.com/sprite' will fetch:
 *   https://example.com/sprite.json
 *   https://example.com/sprite.png
 */
export async function loadSprite(url: string, signal?: AbortSignal): Promise<SpriteResult> {
  const [jsonRes, pngRes] = await Promise.all([
    fetch(`${url}.json`, { signal }),
    fetch(`${url}.png`, { signal }),
  ])

  if (!jsonRes.ok) throw new Error(`Sprite JSON fetch failed: HTTP ${jsonRes.status}`)
  if (!pngRes.ok) throw new Error(`Sprite PNG fetch failed: HTTP ${pngRes.status}`)

  const data = (await jsonRes.json()) as SpriteData
  const blob = await pngRes.blob()
  const bitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)

  return { data, image }
}
