import { Actor, type MessageHandler } from './actor';
import type { WorkerPool } from './worker_pool';
import type { RequestResponseMessageMap } from './actor_messages';
import { MessageType } from './actor_messages';
export declare class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: string | number;
    constructor(workerPool: WorkerPool, mapId: string | number);
    broadcast<T extends MessageType>(type: T, data: RequestResponseMessageMap[T][0]): Promise<RequestResponseMessageMap[T][1][]>;
    getActor(): Actor;
    remove(mapRemoved?: boolean): void;
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void;
}
export declare function getGlobalDispatcher(): Dispatcher;
//# sourceMappingURL=dispatcher.d.ts.map