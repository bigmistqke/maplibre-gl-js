export function getOverlapMode(layout, overlapProp, allowOverlapProp) {
    let result = 'never';
    const overlap = layout.get(overlapProp);
    if (overlap) {
        result = overlap;
    }
    else if (layout.get(allowOverlapProp)) {
        result = 'always';
    }
    return result;
}
//# sourceMappingURL=overlap_mode.js.map