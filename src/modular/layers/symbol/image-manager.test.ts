import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ImageManager } from '@modular/layers/symbol/image-manager.ts'

const SPRITE_DATA = {
  'marker': { x: 0, y: 0, width: 4, height: 4, pixelRatio: 1 },
}

// Minimal 4x4 transparent PNG (base64)
const TRANSPARENT_4X4_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAADklEQVQImWNgYGD4TwABBAEBZMbVQAAAAABJRU5ErkJggg=='

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function makeMockFetch() {
  const pngBytes = base64ToUint8Array(TRANSPARENT_4X4_PNG_B64)
  return vi.fn((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve(new Response(JSON.stringify(SPRITE_DATA), { status: 200 }))
    }
    if (url.endsWith('.png')) {
      return Promise.resolve(new Response(pngBytes as any, { status: 200, headers: { 'Content-Type': 'image/png' } }))
    }
    return Promise.resolve(new Response(null, { status: 404 }))
  })
}

function setupBrowserMocks() {
  const mockBitmap = {
    width: 4,
    height: 4,
    close: vi.fn(),
  }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))

  const mockContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue(new ImageData(4, 4)),
  }
  class MockOffscreenCanvas {
    width = 4
    height = 4
    getContext() {
      return mockContext
    }
  }
  vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas as any)
}

beforeEach(() => setupBrowserMocks())
afterEach(() => vi.restoreAllMocks())

describe('ImageManager', () => {
  it('starts in unloaded state', () => {
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })
    expect(mgr.isLoaded).toBe(false)
    expect(mgr.spriteData).toBeNull()
    expect(mgr.atlas).toBeNull()
    mgr.destroy()
  })

  it('calls onReady callback when sprite loads successfully', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    const onReady = vi.fn()
    mgr.load(onReady)

    // Wait for promise chain to complete
    await new Promise(r => setTimeout(r, 100))

    expect(onReady).toHaveBeenCalledOnce()
    mgr.destroy()
  })

  it('is marked as loaded after sprite is fetched', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.isLoaded).toBe(true)
    mgr.destroy()
  })

  it('exposes spriteData and atlas after load', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.spriteData).toEqual(SPRITE_DATA)
    expect(mgr.atlas).not.toBeNull()
    expect(mgr.atlas!.entries).toHaveProperty('marker')
    mgr.destroy()
  })

  it('getEntry returns AtlasEntry for known sprite name after load', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    const entry = mgr.getEntry('marker')
    expect(entry).not.toBeNull()
    expect(entry!.width).toBe(4)
    expect(entry!.height).toBe(4)
    mgr.destroy()
  })

  it('getEntry returns null for unknown sprite name', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.getEntry('nonexistent')).toBeNull()
    mgr.destroy()
  })

  it('calls onReady immediately if already loaded', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    const onReady = vi.fn()
    mgr.load(onReady)
    expect(onReady).toHaveBeenCalledOnce()
    mgr.destroy()
  })

  it('does not start a second fetch if load() is called twice', async () => {
    const mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    // Only 2 fetches (json + png), not 4
    expect(mockFetch).toHaveBeenCalledTimes(2)
    mgr.destroy()
  })
})
