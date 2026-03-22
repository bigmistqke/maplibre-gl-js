// src/modular/core/tile-service.ts
import type {TileID} from '@modular/core/types.ts';

export interface TileService {
    /** Fetch and decode a tile. Resolves with [ImageBitmap] on success, [] on cancel or error. */
    request(tileID: TileID, url: string): Promise<Transferable[]>;
    /** Cancel an in-flight request. No-op if key is unknown. */
    cancel(key: string): void;
    /** Terminate the service (terminates worker if applicable). */
    destroy(): void;
}
