export function updatePatternPositionsInProgram(programConfiguration, propertyName, constantPattern, tile, layer) {
    if (!constantPattern || !tile || !tile.imageAtlas) {
        return;
    }
    const patternPositions = tile.imageAtlas.patternPositions;
    let posTo = patternPositions[constantPattern.to.toString()];
    let posFrom = patternPositions[constantPattern.from.toString()];
    if (!posTo && posFrom)
        posTo = posFrom;
    if (!posFrom && posTo)
        posFrom = posTo;
    if (!posTo || !posFrom) {
        const transitioned = layer.getPaintProperty(propertyName);
        posTo = patternPositions[transitioned];
        posFrom = patternPositions[transitioned];
    }
    if (posTo && posFrom) {
        programConfiguration.setConstantPatternPositions(posTo, posFrom);
    }
}
//# sourceMappingURL=update_pattern_positions_in_program.js.map