import { WorkerPool, PRELOAD_POOL_ID } from './worker_pool';
let globalWorkerPool;
export function getGlobalWorkerPool() {
    if (!globalWorkerPool) {
        globalWorkerPool = new WorkerPool();
    }
    return globalWorkerPool;
}
export function prewarm() {
    const workerPool = getGlobalWorkerPool();
    workerPool.acquire(PRELOAD_POOL_ID);
}
export function clearPrewarmedResources() {
    const pool = globalWorkerPool;
    if (pool) {
        if (pool.isPreloaded() && pool.numActive() === 1) {
            pool.release(PRELOAD_POOL_ID);
            globalWorkerPool = null;
        }
        else {
            console.warn('Could not clear WebWorkers since there are active Map instances that still reference it. The pre-warmed WebWorker pool can only be cleared when all map instances have been removed with map.remove()');
        }
    }
}
//# sourceMappingURL=global_worker_pool.js.map