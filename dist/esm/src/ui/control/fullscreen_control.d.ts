import { Evented } from '../../util/evented';
import type { Map } from '../map';
import type { IControl } from './control';
export type FullscreenControlOptions = {
    container?: HTMLElement;
};
export declare class FullscreenControl extends Evented implements IControl {
    _map: Map;
    _controlContainer: HTMLElement;
    _fullscreen: boolean;
    _fullscreenchange: string;
    _fullscreenButton: HTMLButtonElement;
    _container: HTMLElement;
    _prevCooperativeGesturesEnabled: boolean;
    constructor(options?: FullscreenControlOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    _setupUI(): void;
    _updateTitle(): void;
    _getTitle(): string;
    _isFullscreen(): boolean;
    _onFullscreenChange: () => void;
    _handleFullscreenChange(): void;
    _onClickFullscreen: () => void;
    _exitFullscreen(): void;
    _requestFullscreen(): void;
    _togglePseudoFullScreen(): void;
}
//# sourceMappingURL=fullscreen_control.d.ts.map