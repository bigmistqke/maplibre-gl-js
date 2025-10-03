import { ImageSource } from './image_source';
import type { Map } from '../ui/map';
import type { Dispatcher } from '../util/dispatcher';
import type { Evented } from '../util/evented';
export type CanvasSourceSpecification = {
    type: 'canvas';
    coordinates: [[number, number], [number, number], [number, number], [number, number]];
    animate?: boolean;
    canvas?: string | HTMLCanvasElement;
};
export declare class CanvasSource extends ImageSource {
    options: CanvasSourceSpecification;
    animate: boolean;
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    play: () => void;
    pause: () => void;
    _playing: boolean;
    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented);
    load(): Promise<void>;
    getCanvas(): HTMLCanvasElement;
    onAdd(map: Map): void;
    onRemove(): void;
    prepare(): void;
    serialize(): CanvasSourceSpecification;
    hasTransition(): boolean;
    _hasInvalidDimensions(): boolean;
}
//# sourceMappingURL=canvas_source.d.ts.map