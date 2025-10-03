import type { Map } from './map';
export declare class Hash {
    _map: Map;
    _hashName: string;
    constructor(hashName?: string | null);
    addTo(map: Map): this;
    remove(): this;
    getHashString(mapFeedback?: boolean): string;
    _getCurrentHash: () => any;
    _onHashChange: () => boolean;
    _updateHashUnthrottled: () => void;
    _removeHash: () => void;
    _updateHash: () => ReturnType<typeof setTimeout>;
    _isValidHash(hash: number[]): boolean;
}
//# sourceMappingURL=hash.d.ts.map