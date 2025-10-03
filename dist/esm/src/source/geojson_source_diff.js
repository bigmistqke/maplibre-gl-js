function getFeatureId(feature, promoteId) {
    return promoteId ? feature.properties[promoteId] : feature.id;
}
export function isUpdateableGeoJSON(data, promoteId) {
    if (data == null) {
        return true;
    }
    if (data.type === 'Feature') {
        return getFeatureId(data, promoteId) != null;
    }
    if (data.type === 'FeatureCollection') {
        const seenIds = new Set();
        for (const feature of data.features) {
            const id = getFeatureId(feature, promoteId);
            if (id == null) {
                return false;
            }
            if (seenIds.has(id)) {
                return false;
            }
            seenIds.add(id);
        }
        return true;
    }
    return false;
}
export function toUpdateable(data, promoteId) {
    const result = new Map();
    if (data == null) {
    }
    else if (data.type === 'Feature') {
        result.set(getFeatureId(data, promoteId), data);
    }
    else {
        for (const feature of data.features) {
            result.set(getFeatureId(feature, promoteId), feature);
        }
    }
    return result;
}
export function applySourceDiff(updateable, diff, promoteId) {
    var _a, _b, _c, _d;
    if (diff.removeAll) {
        updateable.clear();
    }
    if (diff.remove) {
        for (const id of diff.remove) {
            updateable.delete(id);
        }
    }
    if (diff.add) {
        for (const feature of diff.add) {
            const id = getFeatureId(feature, promoteId);
            if (id != null) {
                updateable.set(id, feature);
            }
        }
    }
    if (diff.update) {
        for (const update of diff.update) {
            let feature = updateable.get(update.id);
            if (feature == null) {
                continue;
            }
            const cloneFeature = update.newGeometry || update.removeAllProperties;
            const cloneProperties = !update.removeAllProperties && (((_a = update.removeProperties) === null || _a === void 0 ? void 0 : _a.length) > 0 || ((_b = update.addOrUpdateProperties) === null || _b === void 0 ? void 0 : _b.length) > 0);
            if (cloneFeature || cloneProperties) {
                feature = Object.assign({}, feature);
                updateable.set(update.id, feature);
                if (cloneProperties) {
                    feature.properties = Object.assign({}, feature.properties);
                }
            }
            if (update.newGeometry) {
                feature.geometry = update.newGeometry;
            }
            if (update.removeAllProperties) {
                feature.properties = {};
            }
            else if (((_c = update.removeProperties) === null || _c === void 0 ? void 0 : _c.length) > 0) {
                for (const prop of update.removeProperties) {
                    if (Object.prototype.hasOwnProperty.call(feature.properties, prop)) {
                        delete feature.properties[prop];
                    }
                }
            }
            if (((_d = update.addOrUpdateProperties) === null || _d === void 0 ? void 0 : _d.length) > 0) {
                for (const { key, value } of update.addOrUpdateProperties) {
                    feature.properties[key] = value;
                }
            }
        }
    }
}
export function mergeSourceDiffs(existingDiff, newDiff) {
    var _a, _b, _c, _d, _e;
    if (!existingDiff) {
        return newDiff !== null && newDiff !== void 0 ? newDiff : {};
    }
    if (!newDiff) {
        return existingDiff;
    }
    let merged = Object.assign({}, existingDiff);
    if (newDiff.removeAll) {
        merged = { removeAll: true };
    }
    if (newDiff.remove) {
        const newRemovedSet = new Set(newDiff.remove);
        if (merged.add) {
            merged.add = merged.add.filter(f => !newRemovedSet.has(f.id));
        }
        if (merged.update) {
            merged.update = merged.update.filter(f => !newRemovedSet.has(f.id));
        }
        const existingAddSet = new Set(((_a = existingDiff.add) !== null && _a !== void 0 ? _a : []).map((f) => f.id));
        newDiff.remove = newDiff.remove.filter(id => !existingAddSet.has(id));
    }
    if (newDiff.remove) {
        const removedSet = new Set(merged.remove ? merged.remove.concat(newDiff.remove) : newDiff.remove);
        merged.remove = Array.from(removedSet.values());
    }
    if (newDiff.add) {
        const combinedAdd = merged.add ? merged.add.concat(newDiff.add) : newDiff.add;
        const addMap = new Map(combinedAdd.map((feature) => [feature.id, feature]));
        merged.add = Array.from(addMap.values());
    }
    if (newDiff.update) {
        const updateMap = new Map((_b = merged.update) === null || _b === void 0 ? void 0 : _b.map((feature) => [feature.id, feature]));
        for (const feature of newDiff.update) {
            const featureUpdate = (_c = updateMap.get(feature.id)) !== null && _c !== void 0 ? _c : { id: feature.id };
            if (feature.newGeometry) {
                featureUpdate.newGeometry = feature.newGeometry;
            }
            if (feature.addOrUpdateProperties) {
                featureUpdate.addOrUpdateProperties = ((_d = featureUpdate.addOrUpdateProperties) !== null && _d !== void 0 ? _d : []).concat(feature.addOrUpdateProperties);
            }
            if (feature.removeProperties) {
                featureUpdate.removeProperties = ((_e = featureUpdate.removeProperties) !== null && _e !== void 0 ? _e : []).concat(feature.removeProperties);
            }
            if (feature.removeAllProperties) {
                featureUpdate.removeAllProperties = true;
            }
            updateMap.set(feature.id, featureUpdate);
        }
        merged.update = Array.from(updateMap.values());
    }
    if (merged.remove && merged.add) {
        merged.remove = merged.remove.filter(id => merged.add.findIndex((f) => f.id === id) === -1);
    }
    return merged;
}
//# sourceMappingURL=geojson_source_diff.js.map