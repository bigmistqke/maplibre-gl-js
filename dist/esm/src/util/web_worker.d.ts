import { type AddProtocolAction } from './config';
import type { default as MaplibreWorker } from '../source/worker';
import type { WorkerSourceConstructor } from '../source/worker_source';
export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;
    registerWorkerSource: (sourceName: string, sourceConstructor: WorkerSourceConstructor) => void;
    registerRTLTextPlugin: (_: any) => void;
    addProtocol: (customProtocol: string, loadFn: AddProtocolAction) => void;
    removeProtocol: (customProtocol: string) => void;
    worker: MaplibreWorker;
}
export declare function workerFactory(): Worker;
//# sourceMappingURL=web_worker.d.ts.map