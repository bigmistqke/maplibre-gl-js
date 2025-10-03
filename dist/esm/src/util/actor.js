var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isWorker, subscribe } from './util';
import { serialize, deserialize } from './web_worker_transfer';
import { ThrottledInvoker } from './throttled_invoker';
const addEventDefaultOptions = { once: true };
export class Actor {
    constructor(target, mapId) {
        this.target = target;
        this.mapId = mapId;
        this.resolveRejects = {};
        this.tasks = {};
        this.taskQueue = [];
        this.abortControllers = {};
        this.messageHandlers = {};
        this.invoker = new ThrottledInvoker(() => this.process());
        this.subscription = subscribe(this.target, 'message', (message) => this.receive(message), false);
        this.globalScope = isWorker(self) ? target : window;
    }
    registerMessageHandler(type, handler) {
        this.messageHandlers[type] = handler;
    }
    sendAsync(message, abortController) {
        return new Promise((resolve, reject) => {
            const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
            const subscription = abortController ? subscribe(abortController.signal, 'abort', () => {
                subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
                delete this.resolveRejects[id];
                const cancelMessage = {
                    id,
                    type: '<cancel>',
                    origin: location.origin,
                    targetMapId: message.targetMapId,
                    sourceMapId: this.mapId
                };
                this.target.postMessage(cancelMessage);
            }, addEventDefaultOptions) : null;
            this.resolveRejects[id] = {
                resolve: (value) => {
                    subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
                    resolve(value);
                },
                reject: (reason) => {
                    subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe();
                    reject(reason);
                }
            };
            const buffers = [];
            const messageToPost = Object.assign(Object.assign({}, message), { id, sourceMapId: this.mapId, origin: location.origin, data: serialize(message.data, buffers) });
            this.target.postMessage(messageToPost, { transfer: buffers });
        });
    }
    receive(message) {
        const data = message.data;
        const id = data.id;
        if (data.origin !== 'file://' && location.origin !== 'file://' && data.origin !== 'resource://android' && location.origin !== 'resource://android' && data.origin !== location.origin) {
            return;
        }
        if (data.targetMapId && this.mapId !== data.targetMapId) {
            return;
        }
        if (data.type === '<cancel>') {
            delete this.tasks[id];
            const abortController = this.abortControllers[id];
            delete this.abortControllers[id];
            if (abortController) {
                abortController.abort();
            }
            return;
        }
        if (isWorker(self) || data.mustQueue) {
            this.tasks[id] = data;
            this.taskQueue.push(id);
            this.invoker.trigger();
            return;
        }
        this.processTask(id, data);
    }
    process() {
        if (this.taskQueue.length === 0) {
            return;
        }
        const id = this.taskQueue.shift();
        const task = this.tasks[id];
        delete this.tasks[id];
        if (this.taskQueue.length > 0) {
            this.invoker.trigger();
        }
        if (!task) {
            return;
        }
        this.processTask(id, task);
    }
    processTask(id, task) {
        return __awaiter(this, void 0, void 0, function* () {
            if (task.type === '<response>') {
                const resolveReject = this.resolveRejects[id];
                delete this.resolveRejects[id];
                if (!resolveReject) {
                    return;
                }
                if (task.error) {
                    resolveReject.reject(deserialize(task.error));
                }
                else {
                    resolveReject.resolve(deserialize(task.data));
                }
                return;
            }
            if (!this.messageHandlers[task.type]) {
                this.completeTask(id, new Error(`Could not find a registered handler for ${task.type}, map ID: ${this.mapId}, available handlers: ${Object.keys(this.messageHandlers).join(', ')}`));
                return;
            }
            const params = deserialize(task.data);
            const abortController = new AbortController();
            this.abortControllers[id] = abortController;
            try {
                const data = yield this.messageHandlers[task.type](task.sourceMapId, params, abortController);
                this.completeTask(id, null, data);
            }
            catch (err) {
                this.completeTask(id, err);
            }
        });
    }
    completeTask(id, err, data) {
        const buffers = [];
        delete this.abortControllers[id];
        const responseMessage = {
            id,
            type: '<response>',
            sourceMapId: this.mapId,
            origin: location.origin,
            error: err ? serialize(err) : null,
            data: serialize(data, buffers)
        };
        this.target.postMessage(responseMessage, { transfer: buffers });
    }
    remove() {
        this.invoker.remove();
        this.subscription.unsubscribe();
    }
}
//# sourceMappingURL=actor.js.map