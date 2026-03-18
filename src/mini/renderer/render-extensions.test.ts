import { describe, it, expect, vi } from 'vitest'
import { RenderExtensions } from './render-extensions.ts'
import type { RenderContext } from '../core/render-extension.ts'

const mockCtx = {} as RenderContext

describe('RenderExtensions', () => {
  it('starts empty', () => {
    const exts = new RenderExtensions()
    expect(exts.getAll()).toHaveLength(0)
  })

  it('add and getAll returns extensions in registration order', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'a' })
    exts.add({ id: 'b' })
    expect(exts.getAll().map(e => e.id)).toEqual(['a', 'b'])
  })

  it('remove by id', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'a' })
    exts.add({ id: 'b' })
    exts.remove('a')
    expect(exts.getAll().map(e => e.id)).toEqual(['b'])
  })

  it('calls beforeTiles on all extensions in order', () => {
    const order: string[] = []
    const exts = new RenderExtensions()
    exts.add({ id: 'a', beforeTiles: () => order.push('a') })
    exts.add({ id: 'b', beforeTiles: () => order.push('b') })
    exts.runBeforeTiles(mockCtx)
    expect(order).toEqual(['a', 'b'])
  })

  it('calls afterTiles on all extensions in order', () => {
    const order: string[] = []
    const exts = new RenderExtensions()
    exts.add({ id: 'a', afterTiles: () => order.push('a') })
    exts.add({ id: 'b', afterTiles: () => order.push('b') })
    exts.runAfterTiles(mockCtx)
    expect(order).toEqual(['a', 'b'])
  })

  it('silently skips extensions without beforeTiles/afterTiles', () => {
    const exts = new RenderExtensions()
    exts.add({ id: 'no-hooks' })
    expect(() => exts.runBeforeTiles(mockCtx)).not.toThrow()
    expect(() => exts.runAfterTiles(mockCtx)).not.toThrow()
  })
})
