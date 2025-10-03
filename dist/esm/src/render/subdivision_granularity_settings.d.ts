export type CircleGranularity = 1 | 3 | 5 | 7;
export declare class SubdivisionGranularityExpression {
    private readonly _baseZoomGranularity;
    private readonly _minGranularity;
    constructor(baseZoomGranularity: number, minGranularity: number);
    getGranularityForZoomLevel(zoomLevel: number): number;
}
export declare class SubdivisionGranularitySetting {
    readonly fill: SubdivisionGranularityExpression;
    readonly line: SubdivisionGranularityExpression;
    readonly tile: SubdivisionGranularityExpression;
    readonly stencil: SubdivisionGranularityExpression;
    readonly circle: CircleGranularity;
    constructor(options: {
        fill: SubdivisionGranularityExpression;
        line: SubdivisionGranularityExpression;
        tile: SubdivisionGranularityExpression;
        stencil: SubdivisionGranularityExpression;
        circle: CircleGranularity;
    });
    static readonly noSubdivision: SubdivisionGranularitySetting;
}
//# sourceMappingURL=subdivision_granularity_settings.d.ts.map