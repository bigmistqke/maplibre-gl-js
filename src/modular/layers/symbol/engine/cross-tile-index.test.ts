import { describe, it, expect } from 'vitest'
import { CrossTileIndex, type LabelData } from './cross-tile-index.ts'
import type { TileID } from '../../../core/types.ts'

function makeTileID(z: number, x: number, y: number): TileID {
  return { z, x, y, key: `${z}/${x}/${y}` }
}

function makeLabel(key: number, anchorX: number, anchorY: number): LabelData {
  return { key, anchorX, anchorY, crossTileID: 0 }
}

describe('CrossTileIndex', () => {
  it('assigns unique crossTileIDs to unmatched labels', () => {
    const index = new CrossTileIndex()
    const tile = makeTileID(5, 3, 4)
    const labels = [makeLabel(1, 100, 200), makeLabel(2, 300, 400)]

    index.addTile('layer1', tile, labels)

    expect(labels[0].crossTileID).toBeGreaterThan(0)
    expect(labels[1].crossTileID).toBeGreaterThan(0)
    expect(labels[0].crossTileID).not.toBe(labels[1].crossTileID)
  })

  it('assigns different IDs to labels with same key but different positions', () => {
    const index = new CrossTileIndex()
    const tile = makeTileID(5, 3, 4)
    const labels = [
      makeLabel(1, 100, 200),
      makeLabel(1, 3000, 3500),
    ]

    index.addTile('layer1', tile, labels)

    expect(labels[0].crossTileID).toBeGreaterThan(0)
    expect(labels[1].crossTileID).toBeGreaterThan(0)
    expect(labels[0].crossTileID).not.toBe(labels[1].crossTileID)
  })

  it('parent→child matching: child inherits parent crossTileID', () => {
    const index = new CrossTileIndex()

    // Add parent tile at z=5
    const parentTile = makeTileID(5, 3, 4)
    const parentLabels = [makeLabel(1, 2048, 2048)]
    index.addTile('layer1', parentTile, parentLabels)
    const parentID = parentLabels[0].crossTileID
    expect(parentID).toBeGreaterThan(0)

    // Add child tile at z=6 (child of 5/3/4 is 6/6/8 or 6/7/9 etc)
    // 5/3/4 → children at z=6: 6/6/8, 6/7/8, 6/6/9, 6/7/9
    // Label at (2048,2048) in parent maps to (0,0) in child 6/7/9
    // but for cross-tile matching, scaled coordinates should match
    const childTile = makeTileID(6, 6, 8)
    // In child tile, position (4096,4096) would map to same world position as
    // parent (2048,2048). But actually: parent (2048,2048) at z5 =
    // world (3*4096+2048, 4*4096+2048). At z6 that's tile (6,8) with
    // local (4096, 4096) — but 4096 is out of range. Actually:
    // world x = 3*4096+2048 = 14336. At z6 tile x = floor(14336/4096) = 3... no.
    // z5 tile 3 covers world x [3*4096, 4*4096) = [12288, 16384).
    // At z6 that's tiles 6 and 7. tile 6 covers [6*4096, 7*4096) = [24576, 28672).
    // Wait, the world at z6 is 2x larger. So z5/3 world range is the same as
    // z6/6 and z6/7 combined.
    // Label at z5 tile 3 anchorX=2048 → world x = 3*4096+2048 = 14336
    // At z6: tile = floor(14336*2/4096) = floor(7.0) = 7, localX = 14336*2 - 7*4096 = 0
    // Actually scaling: at z6, the extent is still 4096 per tile, but there are 2x tiles.
    // So world x at z5 = (3 + 2048/4096) * (2^5) = ... let's just use the algorithm.
    //
    // The matching uses getScaledCoordinates to project into the index tile's space.
    // Let's just put the child label at a position that maps to the same world point.
    // Parent z5/3/4 label at (2048, 2048).
    // Child z6/6/8: this is a child of z5/3/4 since floor(6/2)=3, floor(8/2)=4.
    // The same world point in child coords: anchorX = 2048*2 - (6-3*2)*4096 = 4096 - 0 = 4096
    // Hmm, 4096 is EXTENT itself. Let's use child 6/7/9 instead.
    // floor(7/2)=3, floor(9/2)=4. Yes, child of 5/3/4.
    // anchorX = 2048*2 - (7-3*2)*4096 = 4096 - 4096 = 0
    // anchorY = 2048*2 - (9-4*2)*4096 = 4096 - 4096 = 0
    const childTile2 = makeTileID(6, 7, 9)
    const childLabels = [makeLabel(1, 0, 0)]
    index.addTile('layer1', childTile2, childLabels)

    // Child should inherit parent's crossTileID
    expect(childLabels[0].crossTileID).toBe(parentID)
  })

  it('child→parent matching: parent inherits child crossTileID', () => {
    const index = new CrossTileIndex()

    // Add child tile first at z=6
    const childTile = makeTileID(6, 7, 9)
    const childLabels = [makeLabel(1, 0, 0)]
    index.addTile('layer1', childTile, childLabels)
    const childID = childLabels[0].crossTileID
    expect(childID).toBeGreaterThan(0)

    // Add parent tile at z=5
    // 6/7/9 is child of 5/3/4 (floor(7/2)=3, floor(9/2)=4)
    // World point: child (0,0) at z6/7/9 → world = (7*4096+0, 9*4096+0)
    // At z5: tile (3,4), anchorX = (7*4096)/(2^1) - 3*4096 = 7*2048 - 12288 = 14336-12288 = 2048
    // anchorY = 9*2048 - 4*4096 = 18432-16384 = 2048
    const parentTile = makeTileID(5, 3, 4)
    const parentLabels = [makeLabel(1, 2048, 2048)]
    index.addTile('layer1', parentTile, parentLabels)

    // Parent should inherit child's crossTileID
    expect(parentLabels[0].crossTileID).toBe(childID)
  })

  it('removeStaleTiles cleans up old indexes', () => {
    const index = new CrossTileIndex()

    const tile1 = makeTileID(5, 3, 4)
    const tile2 = makeTileID(5, 4, 4)
    const labels1 = [makeLabel(1, 100, 200)]
    const labels2 = [makeLabel(2, 300, 400)]

    index.addTile('layer1', tile1, labels1)
    index.addTile('layer1', tile2, labels2)

    const id1 = labels1[0].crossTileID
    const id2 = labels2[0].crossTileID

    // Remove tile1, keep tile2
    index.removeStaleTiles('layer1', new Set([tile2.key]))

    // Add a new tile — the old ID from tile1 should NOT be reused via matching
    // (since tile1 was removed), but new unique IDs should be assigned
    const tile3 = makeTileID(5, 3, 4)
    const labels3 = [makeLabel(1, 100, 200)]
    index.addTile('layer1', tile3, labels3)

    // Should get a new ID (not the old one from removed tile)
    expect(labels3[0].crossTileID).toBeGreaterThan(0)
    // The old tile was removed so no match is possible — new ID should be different
    expect(labels3[0].crossTileID).not.toBe(id1)
  })

  it('multiple layers are independent', () => {
    const index = new CrossTileIndex()

    const tile = makeTileID(5, 3, 4)
    const labelsA = [makeLabel(1, 100, 200)]
    const labelsB = [makeLabel(1, 100, 200)]

    index.addTile('layerA', tile, labelsA)
    index.addTile('layerB', tile, labelsB)

    // Both should have IDs but they should be independent (different IDs)
    expect(labelsA[0].crossTileID).toBeGreaterThan(0)
    expect(labelsB[0].crossTileID).toBeGreaterThan(0)
    expect(labelsA[0].crossTileID).not.toBe(labelsB[0].crossTileID)
  })

  it('re-adding a tile with updated labels resets and re-matches', () => {
    const index = new CrossTileIndex()

    // Add parent tile
    const parentTile = makeTileID(5, 3, 4)
    const parentLabels = [makeLabel(1, 2048, 2048)]
    index.addTile('layer1', parentTile, parentLabels)
    const originalID = parentLabels[0].crossTileID

    // Re-add the same tile with a new label set (simulating tile update)
    const updatedLabels = [makeLabel(1, 2048, 2048), makeLabel(2, 500, 500)]
    index.addTile('layer1', parentTile, updatedLabels)

    // The first label should get a re-assigned ID (could be same or different
    // depending on matching, but should be valid)
    expect(updatedLabels[0].crossTileID).toBeGreaterThan(0)
    expect(updatedLabels[1].crossTileID).toBeGreaterThan(0)
    expect(updatedLabels[0].crossTileID).not.toBe(updatedLabels[1].crossTileID)
  })
})
