var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let supportsGeolocation;
export function checkGeolocationSupport() {
    return __awaiter(this, arguments, void 0, function* (forceRecalculation = false) {
        if (supportsGeolocation !== undefined && !forceRecalculation) {
            return supportsGeolocation;
        }
        if (window.navigator.permissions === undefined) {
            supportsGeolocation = !!window.navigator.geolocation;
            return supportsGeolocation;
        }
        try {
            const permissions = yield window.navigator.permissions.query({ name: 'geolocation' });
            supportsGeolocation = permissions.state !== 'denied';
        }
        catch (_a) {
            supportsGeolocation = !!window.navigator.geolocation;
        }
        return supportsGeolocation;
    });
}
//# sourceMappingURL=geolocation_support.js.map