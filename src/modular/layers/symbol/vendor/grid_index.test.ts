import { describe, it, expect } from 'vitest'
import { GridIndex } from '@modular/layers/symbol/vendor/grid_index.ts'

describe('GridIndex', () => {
  it('inserts a box and finds it with hitTest', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    expect(grid.hitTest(15, 15, 25, 25, 'never')).toBe(true)
  })

  it('returns false for non-overlapping query', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    expect(grid.hitTest(50, 50, 70, 70, 'never')).toBe(false)
  })

  it('allows overlap when overlapMode is always', () => {
    const grid = new GridIndex<{ overlapMode: 'always' | 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 10, 10, 30, 30)
    // 'always' overlap mode ignores existing 'never' entries
    expect(grid.hitTest(15, 15, 25, 25, 'always')).toBe(false)
  })

  it('reports keysLength after insert', () => {
    const grid = new GridIndex<{ overlapMode: 'never' }>(100, 100, 10)
    grid.insert({ overlapMode: 'never' }, 0, 0, 10, 10)
    grid.insertCircle({ overlapMode: 'never' }, 50, 50, 5)
    expect(grid.keysLength()).toBe(2)
  })
})
