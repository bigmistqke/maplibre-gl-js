import type { Context } from '../gl/context';
type DashEntry = {
    y: number;
    height: number;
    width: number;
};
export declare class LineAtlas {
    width: number;
    height: number;
    nextRow: number;
    bytes: number;
    data: Uint8Array;
    dashEntry: {
        [_: string]: DashEntry;
    };
    dirty: boolean;
    texture: WebGLTexture;
    constructor(width: number, height: number);
    getDash(dasharray: Array<number>, round: boolean): DashEntry;
    getDashRanges(dasharray: Array<number>, lineAtlasWidth: number, stretch: number): any[];
    addRoundDash(ranges: any, stretch: number, n: number): void;
    addRegularDash(ranges: any): void;
    addDash(dasharray: Array<number>, round: boolean): DashEntry;
    bind(context: Context): void;
}
export {};
//# sourceMappingURL=line_atlas.d.ts.map