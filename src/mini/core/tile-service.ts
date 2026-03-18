import type { TileID } from './types.ts'

export interface TileService {
  process(
    tileID: TileID,
    data: ArrayBuffer,
    layerTypes: string[],
    signal: AbortSignal,
  ): Promise<Transferable[]>
}
