var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class RTLWorkerPlugin {
    constructor() {
        this.TIMEOUT = 5000;
        this.applyArabicShaping = null;
        this.processBidirectionalText = null;
        this.processStyledBidirectionalText = null;
        this.pluginStatus = 'unavailable';
        this.pluginURL = null;
        this.loadScriptResolve = () => { };
    }
    setState(state) {
        this.pluginStatus = state.pluginStatus;
        this.pluginURL = state.pluginURL;
    }
    getState() {
        return {
            pluginStatus: this.pluginStatus,
            pluginURL: this.pluginURL
        };
    }
    setMethods(rtlTextPlugin) {
        if (rtlWorkerPlugin.isParsed()) {
            throw new Error('RTL text plugin already registered.');
        }
        this.applyArabicShaping = rtlTextPlugin.applyArabicShaping;
        this.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
        this.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
        this.loadScriptResolve();
    }
    isParsed() {
        return this.applyArabicShaping != null &&
            this.processBidirectionalText != null &&
            this.processStyledBidirectionalText != null;
    }
    getRTLTextPluginStatus() {
        return this.pluginStatus;
    }
    syncState(incomingState, importScripts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isParsed()) {
                return this.getState();
            }
            if (incomingState.pluginStatus !== 'loading') {
                this.setState(incomingState);
                return incomingState;
            }
            const urlToLoad = incomingState.pluginURL;
            const loadScriptPromise = new Promise((resolve) => {
                this.loadScriptResolve = resolve;
            });
            importScripts(urlToLoad);
            const dontWaitForeverTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve(), this.TIMEOUT));
            yield Promise.race([loadScriptPromise, dontWaitForeverTimeoutPromise]);
            const complete = this.isParsed();
            if (complete) {
                const loadedState = {
                    pluginStatus: 'loaded',
                    pluginURL: urlToLoad
                };
                this.setState(loadedState);
                return loadedState;
            }
            this.setState({
                pluginStatus: 'error',
                pluginURL: ''
            });
            throw new Error(`RTL Text Plugin failed to import scripts from ${urlToLoad}`);
        });
    }
}
export const rtlWorkerPlugin = new RTLWorkerPlugin();
//# sourceMappingURL=rtl_text_plugin_worker.js.map