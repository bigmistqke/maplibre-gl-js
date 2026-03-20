import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadSprite } from './sprite-loader.ts'

const SPRITE_DATA = {
  'marker': { x: 0, y: 0, width: 16, height: 16, pixelRatio: 1 },
  'pin': { x: 16, y: 0, width: 24, height: 32, pixelRatio: 1 },
}

// Minimal 1x1 transparent PNG (base64)
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function makeMockFetch(jsonData: object, pngBytes: Uint8Array) {
  return vi.fn((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve(new Response(JSON.stringify(jsonData), { status: 200 }))
    }
    if (url.endsWith('.png')) {
      return Promise.resolve(new Response(pngBytes.buffer, { status: 200, headers: { 'Content-Type': 'image/png' } }))
    }
    return Promise.resolve(new Response(null, { status: 404 }))
  })
}

afterEach(() => vi.restoreAllMocks())

function setupBrowserMocks() {
  const mockBitmap = {
    width: 1,
    height: 1,
    close: vi.fn(),
  }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))

  const mockContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(new ImageData(1, 1)),
  }
  class MockOffscreenCanvas {
    width = 1
    height = 1
    getContext() {
      return mockContext
    }
  }
  vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as any)
}

describe('loadSprite', () => {
  it('fetches sprite.json and sprite.png from the base URL', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)
    setupBrowserMocks()

    await loadSprite('https://example.com/sprite')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/sprite.json', expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/sprite.png', expect.any(Object))
  })

  it('returns parsed SpriteData from the JSON', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)
    setupBrowserMocks()

    const result = await loadSprite('https://example.com/sprite')

    expect(result.data).toEqual(SPRITE_DATA)
    expect(result.data['marker'].width).toBe(16)
    expect(result.data['pin'].height).toBe(32)
  })

  it('returns an ImageData object from the PNG', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)
    setupBrowserMocks()

    const result = await loadSprite('https://example.com/sprite')

    expect(result.image).toBeInstanceOf(ImageData)
    expect(result.image.width).toBeGreaterThan(0)
    expect(result.image.height).toBeGreaterThan(0)
  })

  it('throws on a non-ok JSON response', async () => {
    const mockFetch = vi.fn((url: string) =>
      Promise.resolve(new Response(null, { status: url.endsWith('.json') ? 404 : 200 }))
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(loadSprite('https://example.com/sprite')).rejects.toThrow('HTTP 404')
  })

  it('throws on a non-ok PNG response', async () => {
    const mockFetch = vi.fn((url: string) =>
      Promise.resolve(new Response(
        url.endsWith('.json') ? JSON.stringify(SPRITE_DATA) : null,
        { status: url.endsWith('.png') ? 500 : 200 }
      ))
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(loadSprite('https://example.com/sprite')).rejects.toThrow('HTTP 500')
  })
})
