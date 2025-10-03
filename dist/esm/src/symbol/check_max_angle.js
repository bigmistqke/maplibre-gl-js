export function checkMaxAngle(line, anchor, labelLength, windowSize, maxAngle) {
    if (anchor.segment === undefined || labelLength === 0)
        return true;
    let p = anchor;
    let index = anchor.segment + 1;
    let anchorDistance = 0;
    while (anchorDistance > -labelLength / 2) {
        index--;
        if (index < 0)
            return false;
        anchorDistance -= line[index].dist(p);
        p = line[index];
    }
    anchorDistance += line[index].dist(line[index + 1]);
    index++;
    const recentCorners = [];
    let recentAngleDelta = 0;
    while (anchorDistance < labelLength / 2) {
        const prev = line[index - 1];
        const current = line[index];
        const next = line[index + 1];
        if (!next)
            return false;
        let angleDelta = prev.angleTo(current) - current.angleTo(next);
        angleDelta = Math.abs(((angleDelta + 3 * Math.PI) % (Math.PI * 2)) - Math.PI);
        recentCorners.push({
            distance: anchorDistance,
            angleDelta
        });
        recentAngleDelta += angleDelta;
        while (anchorDistance - recentCorners[0].distance > windowSize) {
            recentAngleDelta -= recentCorners.shift().angleDelta;
        }
        if (recentAngleDelta > maxAngle)
            return false;
        index++;
        anchorDistance += current.dist(next);
    }
    return true;
}
//# sourceMappingURL=check_max_angle.js.map