var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { registry } from '../registry';
export const create = (id, specification, dispatcher, eventedParent) => {
    const Class = getSourceType(specification.type);
    if (!Class) {
        console.warn(`Source type '${specification.type}' is not registered. Import the corresponding source module to enable it.`);
        return null;
    }
    const source = new Class(id, specification, dispatcher, eventedParent);
    if (source.id !== id) {
        throw new Error(`Expected Source id to be ${id} instead of ${source.id}`);
    }
    return source;
};
const getSourceType = (name) => {
    return registry.source[name];
};
const setSourceType = (name, type) => {
    registry.source[name] = type;
};
export const addSourceType = (name, SourceType) => __awaiter(void 0, void 0, void 0, function* () {
    if (getSourceType(name)) {
        throw new Error(`A source type called "${name}" already exists.`);
    }
    setSourceType(name, SourceType);
});
//# sourceMappingURL=source.js.map