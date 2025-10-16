import { assertedNotNullish } from "../util/util";

export class ZoomHistory {
    lastZoom: number | undefined;
    lastFloorZoom: number | undefined;
    lastIntegerZoom: number | undefined;
    lastIntegerZoomTime: number | undefined;
    first: boolean;

    constructor() {
        this.first = true;
    }

    update(z: number, now: number) {
        const floorZ = Math.floor(z);

        if (this.first) {
            this.first = false;
            this.lastIntegerZoom = floorZ;
            this.lastIntegerZoomTime = 0;
            this.lastZoom = z;
            this.lastFloorZoom = floorZ;
            return true;
        }

        if (assertedNotNullish(this.lastFloorZoom)> floorZ) {
            this.lastIntegerZoom = floorZ + 1;
            this.lastIntegerZoomTime = now;
        } else if (assertedNotNullish(this.lastFloorZoom)< floorZ) {
            this.lastIntegerZoom = floorZ;
            this.lastIntegerZoomTime = now;
        }

        if (z !== this.lastZoom) {
            this.lastZoom = z;
            this.lastFloorZoom = floorZ;
            return true;
        }

        return false;
    }
}
