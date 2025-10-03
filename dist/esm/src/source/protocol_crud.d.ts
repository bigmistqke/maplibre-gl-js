import { type AddProtocolAction } from '../util/config';
export declare function getProtocol(url: string): AddProtocolAction;
export declare function addProtocol(customProtocol: string, loadFn: AddProtocolAction): void;
export declare function removeProtocol(customProtocol: string): void;
//# sourceMappingURL=protocol_crud.d.ts.map