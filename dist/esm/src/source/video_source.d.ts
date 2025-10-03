import { ImageSource } from './image_source';
import type { Map } from '../ui/map';
import type { Dispatcher } from '../util/dispatcher';
import type { Evented } from '../util/evented';
import type { VideoSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
export declare class VideoSource extends ImageSource {
    options: VideoSourceSpecification;
    urls: Array<string>;
    video: HTMLVideoElement;
    roundZoom: boolean;
    constructor(id: string, options: VideoSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented);
    load(): Promise<void>;
    pause(): void;
    play(): void;
    seek(seconds: number): void;
    getVideo(): HTMLVideoElement;
    onAdd(map: Map): void;
    prepare(): this;
    serialize(): VideoSourceSpecification;
    hasTransition(): boolean;
}
//# sourceMappingURL=video_source.d.ts.map