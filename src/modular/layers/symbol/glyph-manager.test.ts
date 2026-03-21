// src/modular/layers/symbol/glyph-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GlyphManager } from './glyph-manager.ts'

// We mock the glyph-loader module so we can control what ranges return
vi.mock('./glyph-loader.ts', () => ({
  glyphRange: (id: number) => Math.floor(id / 256) * 256,
  loadGlyphRange: vi.fn().mockResolvedValue({}),
}))

import { loadGlyphRange } from './glyph-loader.ts'

describe('GlyphManager', () => {
  beforeEach(() => {
    vi.mocked(loadGlyphRange).mockClear()
    // By default, return an empty range
    vi.mocked(loadGlyphRange).mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls loadGlyphRange for each needed range', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65, 66, 67] })
    // All codepoints are in range 0, so only one fetch
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledWith('Open Sans Regular', 0, expect.any(String))
  })

  it('does not re-fetch an already-loaded range', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    await mgr.getGlyphs({ 'Open Sans Regular': [66] })
    // Same range (0), should only fetch once
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(1)
  })

  it('fetches separate ranges for different codepoints', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    await mgr.getGlyphs({ 'Open Sans Regular': [65, 300] })  // ranges 0 and 256
    expect(vi.mocked(loadGlyphRange)).toHaveBeenCalledTimes(2)
  })

  it('invokes addGlyphsLoadedListener callback after each range loads with both GlyphMap and GlyphPositions', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    const cb = vi.fn()
    mgr.addGlyphsLoadedListener(cb)
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(cb).toHaveBeenCalledTimes(1)
    // First arg: partial GlyphMap
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ 'Open Sans Regular': expect.any(Object) }),
      // Second arg: GlyphPositions (may be empty if no non-zero bitmaps, but must be an object)
      expect.any(Object),
    )
  })

  it('notifies multiple listeners when glyphs load', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    mgr.addGlyphsLoadedListener(cb1)
    mgr.addGlyphsLoadedListener(cb2)
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(cb1).toHaveBeenCalledTimes(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })

  it('removeGlyphsLoadedListener stops the callback from being called', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    const cb = vi.fn()
    mgr.addGlyphsLoadedListener(cb)
    mgr.removeGlyphsLoadedListener(cb)
    await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(cb).not.toHaveBeenCalled()
  })

  it('destroy() clears all listeners', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    const cb = vi.fn()
    mgr.addGlyphsLoadedListener(cb)
    mgr.destroy()
    // After destroy, manually trigger another load — listeners should not fire.
    // Re-create state so getGlyphs can run without throwing.
    vi.mocked(loadGlyphRange).mockResolvedValueOnce({})
    const mgr2 = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    mgr2.addGlyphsLoadedListener(cb)
    mgr2.destroy()
    // cb was added to mgr2 but destroy() cleared it, so a subsequent getGlyphs on mgr2 won't fire
    await mgr2.getGlyphs({ 'Open Sans Regular': [65] })
    expect(cb).not.toHaveBeenCalled()
  })

  it('returns null for glyphs not in loaded data', async () => {
    const mgr = new GlyphManager({ url: 'https://example.com/{fontstack}/{range}.pbf' })
    // loadGlyphRange returns empty map → glyph 65 is null
    const result = await mgr.getGlyphs({ 'Open Sans Regular': [65] })
    expect(result['Open Sans Regular'][65]).toBeNull()
  })
})
