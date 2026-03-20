// Compile-time only — just verify structural compatibility
import type { PlacementParticipant, SymbolBucketData } from './placement-participant.ts'
import { describe, it, expectTypeOf } from 'vitest'

describe('PlacementParticipant', () => {
  it('accepts a structurally compatible object', () => {
    const participant = {
      getSymbolBuckets: (): SymbolBucketData[] => [],
      setOpacity: (_key: string, _opacity: Float32Array) => {},
    }
    expectTypeOf(participant).toMatchTypeOf<PlacementParticipant>()
  })
})
