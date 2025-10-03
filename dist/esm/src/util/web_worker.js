import { config } from './config';
export function workerFactory() {
    const useModuleWorker = config.WORKER_URL && config.WORKER_URL.endsWith('.mjs');
    if (useModuleWorker) {
        try {
            return new Worker(config.WORKER_URL, { type: 'module' });
        }
        catch (e) {
            console.warn('Module worker not supported, falling back to classic worker', e);
        }
    }
    return new Worker(config.WORKER_URL);
}
//# sourceMappingURL=web_worker.js.map