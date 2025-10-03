import { Evented } from '../util/evented';
import { type RTLPluginStatus, type PluginState } from './rtl_text_plugin_status';
import { type Dispatcher } from '../util/dispatcher';
declare class RTLMainThreadPlugin extends Evented {
    status: RTLPluginStatus;
    url: string;
    dispatcher: Dispatcher;
    _syncState(statusToSend: RTLPluginStatus): Promise<PluginState[]>;
    getRTLTextPluginStatus(): RTLPluginStatus;
    clearRTLTextPlugin(): void;
    setRTLTextPlugin(url: string, deferred?: boolean): Promise<void>;
    _requestImport(): Promise<void>;
    lazyLoad(): void;
}
export declare function rtlMainThreadPluginFactory(): RTLMainThreadPlugin;
export {};
//# sourceMappingURL=rtl_text_plugin_main_thread.d.ts.map