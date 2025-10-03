var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { browser } from '../util/browser';
import { Event, Evented } from '../util/evented';
import { RTLPluginLoadedEventName } from './rtl_text_plugin_status';
import { getGlobalDispatcher } from '../util/dispatcher';
class RTLMainThreadPlugin extends Evented {
    constructor() {
        super(...arguments);
        this.status = 'unavailable';
        this.url = null;
        this.dispatcher = getGlobalDispatcher();
    }
    _syncState(statusToSend) {
        this.status = statusToSend;
        return this.dispatcher.broadcast("SRPS", { pluginStatus: statusToSend, pluginURL: this.url })
            .catch((e) => {
            this.status = 'error';
            throw e;
        });
    }
    getRTLTextPluginStatus() {
        return this.status;
    }
    clearRTLTextPlugin() {
        this.status = 'unavailable';
        this.url = null;
    }
    setRTLTextPlugin(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, deferred = false) {
            if (this.url) {
                throw new Error('setRTLTextPlugin cannot be called multiple times.');
            }
            this.url = browser.resolveURL(url);
            if (!this.url) {
                throw new Error(`requested url ${url} is invalid`);
            }
            if (this.status === 'unavailable') {
                if (deferred) {
                    this.status = 'deferred';
                    this._syncState(this.status);
                }
                else {
                    return this._requestImport();
                }
            }
            else if (this.status === 'requested') {
                return this._requestImport();
            }
        });
    }
    _requestImport() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._syncState('loading');
            this.status = 'loaded';
            this.fire(new Event(RTLPluginLoadedEventName));
        });
    }
    lazyLoad() {
        if (this.status === 'unavailable') {
            this.status = 'requested';
        }
        else if (this.status === 'deferred') {
            this._requestImport();
        }
    }
}
let rtlMainThreadPlugin = null;
export function rtlMainThreadPluginFactory() {
    if (!rtlMainThreadPlugin) {
        rtlMainThreadPlugin = new RTLMainThreadPlugin();
    }
    return rtlMainThreadPlugin;
}
//# sourceMappingURL=rtl_text_plugin_main_thread.js.map