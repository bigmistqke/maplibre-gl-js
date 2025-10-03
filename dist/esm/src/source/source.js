var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getSource } from './source_registry';
const registeredSources = {};
export const create = (id, specification, dispatcher, eventedParent) => {
    const Class = getSourceType(specification.type);
    const source = new Class(id, specification, dispatcher, eventedParent);
    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }
    return source;
};
const getSourceType = (name) => {
    var _a;
    return (_a = getSource(name)) !== null && _a !== void 0 ? _a : registeredSources[name];
};
const setSourceType = (name, type) => {
    registeredSources[name] = type;
};
export const addSourceType = (name, SourceType) => __awaiter(void 0, void 0, void 0, function* () {
    if (getSourceType(name)) {
        throw new Error(`A source type called "${name}" already exists.`);
    }
    setSourceType(name, SourceType);
});
//# sourceMappingURL=source.js.map