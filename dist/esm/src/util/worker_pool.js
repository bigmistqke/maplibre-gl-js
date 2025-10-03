import { workerFactory } from './web_worker';
import { browser } from './browser';
import { isSafari } from './util';
export const PRELOAD_POOL_ID = 'maplibre_preloaded_worker_pool';
export class WorkerPool {
    constructor() {
        this.active = {};
    }
    acquire(mapId) {
        if (!this.workers) {
            this.workers = [];
            while (this.workers.length < WorkerPool.workerCount) {
                this.workers.push(workerFactory());
            }
        }
        this.active[mapId] = true;
        return this.workers.slice();
    }
    release(mapId) {
        delete this.active[mapId];
        if (this.numActive() === 0) {
            this.workers.forEach((w) => {
                w.terminate();
            });
            this.workers = null;
        }
    }
    isPreloaded() {
        return !!this.active[PRELOAD_POOL_ID];
    }
    numActive() {
        return Object.keys(this.active).length;
    }
}
const availableLogicalProcessors = Math.floor(browser.hardwareConcurrency / 2);
WorkerPool.workerCount = isSafari(globalThis) ? Math.max(Math.min(availableLogicalProcessors, 3), 1) : 1;
//# sourceMappingURL=worker_pool.js.map