import { type PluginState, type RTLPluginStatus } from './rtl_text_plugin_status';
export interface RTLTextPlugin {
    applyArabicShaping: (a: string) => string;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
}
declare class RTLWorkerPlugin implements RTLTextPlugin {
    readonly TIMEOUT = 5000;
    applyArabicShaping: (a: string) => string;
    processBidirectionalText: ((b: string, a: Array<number>) => Array<string>);
    processStyledBidirectionalText: ((c: string, b: Array<number>, a: Array<number>) => Array<[string, Array<number>]>);
    pluginStatus: RTLPluginStatus;
    pluginURL: string;
    loadScriptResolve: () => void;
    private setState;
    private getState;
    setMethods(rtlTextPlugin: RTLTextPlugin): void;
    isParsed(): boolean;
    getRTLTextPluginStatus(): RTLPluginStatus;
    syncState(incomingState: PluginState, importScripts: (url: string) => void): Promise<PluginState>;
}
export declare const rtlWorkerPlugin: RTLWorkerPlugin;
export {};
//# sourceMappingURL=rtl_text_plugin_worker.d.ts.map