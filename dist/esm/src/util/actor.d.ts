import { type Subscription } from './util';
import { type Serialized } from './web_worker_transfer';
import { ThrottledInvoker } from './throttled_invoker';
import { type MessageType, type ActorMessage, type RequestResponseMessageMap } from './actor_messages';
export interface ActorTarget {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
    postMessage: typeof window.postMessage;
    terminate?: () => void;
}
type MessageData = {
    id: string;
    type: MessageType | '<cancel>' | '<response>';
    origin: string;
    data?: Serialized;
    targetMapId?: string | number | null;
    mustQueue?: boolean;
    error?: Serialized | null;
    sourceMapId: string | number | null;
};
type ResolveReject = {
    resolve: (value?: RequestResponseMessageMap[MessageType][1]) => void;
    reject: (reason?: Error) => void;
};
export interface IActor {
    sendAsync<T extends MessageType>(message: ActorMessage<T>, abortController?: AbortController): Promise<RequestResponseMessageMap[T][1]>;
}
export type MessageHandler<T extends MessageType> = (mapId: string | number, params: RequestResponseMessageMap[T][0], abortController?: AbortController) => Promise<RequestResponseMessageMap[T][1]>;
export declare class Actor implements IActor {
    target: ActorTarget;
    mapId: string | number | null;
    resolveRejects: {
        [x: string]: ResolveReject;
    };
    name: string;
    tasks: {
        [x: string]: MessageData;
    };
    taskQueue: Array<string>;
    abortControllers: {
        [x: number | string]: AbortController;
    };
    invoker: ThrottledInvoker;
    globalScope: ActorTarget;
    messageHandlers: {
        [x in MessageType]?: MessageHandler<MessageType>;
    };
    subscription: Subscription;
    constructor(target: ActorTarget, mapId?: string | number);
    registerMessageHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void;
    sendAsync<T extends MessageType>(message: ActorMessage<T>, abortController?: AbortController): Promise<RequestResponseMessageMap[T][1]>;
    receive(message: {
        data: MessageData;
    }): void;
    process(): void;
    processTask(id: string, task: MessageData): Promise<void>;
    completeTask(id: string, err: Error, data?: RequestResponseMessageMap[MessageType][1]): void;
    remove(): void;
}
export {};
//# sourceMappingURL=actor.d.ts.map