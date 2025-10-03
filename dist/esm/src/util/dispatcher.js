import { Actor } from './actor';
import { getGlobalWorkerPool } from './global_worker_pool';
import { GLOBAL_DISPATCHER_ID, makeRequest } from './ajax';
export class Dispatcher {
    constructor(workerPool, mapId) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = mapId;
        const workers = this.workerPool.acquire(mapId);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Actor(worker, mapId);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
        if (!this.actors.length)
            throw new Error('No actors found');
    }
    broadcast(type, data) {
        const promises = [];
        for (const actor of this.actors) {
            promises.push(actor.sendAsync({ type, data }));
        }
        return Promise.all(promises);
    }
    getActor() {
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }
    remove(mapRemoved = true) {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
        if (mapRemoved)
            this.workerPool.release(this.id);
    }
    registerMessageHandler(type, handler) {
        for (const actor of this.actors) {
            actor.registerMessageHandler(type, handler);
        }
    }
}
let globalDispatcher;
export function getGlobalDispatcher() {
    if (!globalDispatcher) {
        globalDispatcher = new Dispatcher(getGlobalWorkerPool(), GLOBAL_DISPATCHER_ID);
        globalDispatcher.registerMessageHandler("GR", (_mapId, params, abortController) => {
            return makeRequest(params, abortController);
        });
    }
    return globalDispatcher;
}
//# sourceMappingURL=dispatcher.js.map