import { config } from '../util/config';
export function getProtocol(url) {
    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];
}
export function addProtocol(customProtocol, loadFn) {
    config.REGISTERED_PROTOCOLS[customProtocol] = loadFn;
}
export function removeProtocol(customProtocol) {
    delete config.REGISTERED_PROTOCOLS[customProtocol];
}
//# sourceMappingURL=protocol_crud.js.map