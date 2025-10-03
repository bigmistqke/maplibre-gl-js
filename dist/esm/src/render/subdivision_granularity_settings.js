export class SubdivisionGranularityExpression {
    constructor(baseZoomGranularity, minGranularity) {
        if (minGranularity > baseZoomGranularity) {
            throw new Error('Min granularity must not be greater than base granularity.');
        }
        this._baseZoomGranularity = baseZoomGranularity;
        this._minGranularity = minGranularity;
    }
    getGranularityForZoomLevel(zoomLevel) {
        const divisor = 1 << zoomLevel;
        return Math.max(Math.floor(this._baseZoomGranularity / divisor), this._minGranularity, 1);
    }
}
export class SubdivisionGranularitySetting {
    constructor(options) {
        this.fill = options.fill;
        this.line = options.line;
        this.tile = options.tile;
        this.stencil = options.stencil;
        this.circle = options.circle;
    }
}
SubdivisionGranularitySetting.noSubdivision = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(0, 0),
    line: new SubdivisionGranularityExpression(0, 0),
    tile: new SubdivisionGranularityExpression(0, 0),
    stencil: new SubdivisionGranularityExpression(0, 0),
    circle: 1
});
//# sourceMappingURL=subdivision_granularity_settings.js.map