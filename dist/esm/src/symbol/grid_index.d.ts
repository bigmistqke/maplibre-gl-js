import type { OverlapMode } from '../style/style_layer/overlap_mode';
type QueryResult<T> = {
    key: T;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
export type GridKey = {
    overlapMode?: OverlapMode;
};
export declare class GridIndex<T extends GridKey> {
    circleKeys: Array<T>;
    boxKeys: Array<T>;
    boxCells: Array<Array<number>>;
    circleCells: Array<Array<number>>;
    bboxes: Array<number>;
    circles: Array<number>;
    xCellCount: number;
    yCellCount: number;
    width: number;
    height: number;
    xScale: number;
    yScale: number;
    boxUid: number;
    circleUid: number;
    constructor(width: number, height: number, cellSize: number);
    keysLength(): number;
    insert(key: T, x1: number, y1: number, x2: number, y2: number): void;
    insertCircle(key: T, x: number, y: number, radius: number): void;
    private _insertBoxCell;
    private _insertCircleCell;
    private _query;
    query(x1: number, y1: number, x2: number, y2: number): Array<QueryResult<T>>;
    hitTest(x1: number, y1: number, x2: number, y2: number, overlapMode: OverlapMode, predicate?: (key: T) => boolean): boolean;
    hitTestCircle(x: number, y: number, radius: number, overlapMode: OverlapMode, predicate?: (key: T) => boolean): boolean;
    private _queryCell;
    private _queryCellCircle;
    private _forEachCell;
    private _convertToXCellCoord;
    private _convertToYCellCoord;
    private _circlesCollide;
    private _circleAndRectCollide;
}
export {};
//# sourceMappingURL=grid_index.d.ts.map