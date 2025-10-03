export function deserialize(input, style) {
    const output = {};
    if (!style)
        return output;
    for (const bucket of input) {
        const layers = bucket.layerIds
            .map((id) => style.getLayer(id))
            .filter(Boolean);
        if (layers.length === 0) {
            continue;
        }
        bucket.layers = layers;
        if (bucket.stateDependentLayerIds) {
            bucket.stateDependentLayers = bucket.stateDependentLayerIds.map((lId) => layers.filter((l) => l.id === lId)[0]);
        }
        for (const layer of layers) {
            output[layer.id] = bucket;
        }
    }
    return output;
}
//# sourceMappingURL=bucket.js.map