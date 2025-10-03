export function mergeLines(features) {
    const leftIndex = {};
    const rightIndex = {};
    const mergedFeatures = [];
    let mergedIndex = 0;
    function add(k) {
        mergedFeatures.push(features[k]);
        mergedIndex++;
    }
    function mergeFromRight(leftKey, rightKey, geom) {
        const i = rightIndex[leftKey];
        delete rightIndex[leftKey];
        rightIndex[rightKey] = i;
        mergedFeatures[i].geometry[0].pop();
        mergedFeatures[i].geometry[0] = mergedFeatures[i].geometry[0].concat(geom[0]);
        return i;
    }
    function mergeFromLeft(leftKey, rightKey, geom) {
        const i = leftIndex[rightKey];
        delete leftIndex[rightKey];
        leftIndex[leftKey] = i;
        mergedFeatures[i].geometry[0].shift();
        mergedFeatures[i].geometry[0] = geom[0].concat(mergedFeatures[i].geometry[0]);
        return i;
    }
    function getKey(text, geom, onRight) {
        const point = onRight ? geom[0][geom[0].length - 1] : geom[0][0];
        return `${text}:${point.x}:${point.y}`;
    }
    for (let k = 0; k < features.length; k++) {
        const feature = features[k];
        const geom = feature.geometry;
        const text = feature.text ? feature.text.toString() : null;
        if (!text) {
            add(k);
            continue;
        }
        const leftKey = getKey(text, geom), rightKey = getKey(text, geom, true);
        if ((leftKey in rightIndex) && (rightKey in leftIndex) && (rightIndex[leftKey] !== leftIndex[rightKey])) {
            const j = mergeFromLeft(leftKey, rightKey, geom);
            const i = mergeFromRight(leftKey, rightKey, mergedFeatures[j].geometry);
            delete leftIndex[leftKey];
            delete rightIndex[rightKey];
            rightIndex[getKey(text, mergedFeatures[i].geometry, true)] = i;
            mergedFeatures[j].geometry = null;
        }
        else if (leftKey in rightIndex) {
            mergeFromRight(leftKey, rightKey, geom);
        }
        else if (rightKey in leftIndex) {
            mergeFromLeft(leftKey, rightKey, geom);
        }
        else {
            add(k);
            leftIndex[leftKey] = mergedIndex - 1;
            rightIndex[rightKey] = mergedIndex - 1;
        }
    }
    return mergedFeatures.filter((f) => f.geometry);
}
//# sourceMappingURL=merge_lines.js.map