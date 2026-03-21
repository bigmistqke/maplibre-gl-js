import { describe, it, expect } from 'vitest'
import { extractCodepoints } from './ensure-glyphs.ts'

describe('extractCodepoints', () => {
  it('extracts unique codepoints from text strings', () => {
    const texts = ['Hello', 'Hi']
    const result = extractCodepoints(texts)
    expect(result).toContain('H'.codePointAt(0))
    expect(result).toContain('e'.codePointAt(0))
    expect(result).toContain('l'.codePointAt(0))
    expect(result).toContain('o'.codePointAt(0))
    expect(result).toContain('i'.codePointAt(0))
    // 'l' appears twice but only once in result
    expect(result.filter(cp => cp === 'l'.codePointAt(0))).toHaveLength(1)
  })

  it('handles empty text array', () => {
    expect(extractCodepoints([])).toEqual([])
  })

  it('handles surrogate pairs', () => {
    const texts = ['A😀B']
    const result = extractCodepoints(texts)
    expect(result).toContain('A'.codePointAt(0))
    expect(result).toContain('B'.codePointAt(0))
    expect(result).toContain('😀'.codePointAt(0))
    expect(result).toHaveLength(3)
  })
})
