export type RTLPluginStatus = 'unavailable' | 'deferred' | 'requested' | 'loading' | 'loaded' | 'error';
export type PluginState = {
    pluginStatus: RTLPluginStatus;
    pluginURL: string;
};
export declare const RTLPluginLoadedEventName = "RTLPluginLoaded";
//# sourceMappingURL=rtl_text_plugin_status.d.ts.map