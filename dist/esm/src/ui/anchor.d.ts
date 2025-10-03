export type PositionAnchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export declare const anchorTranslate: {
    [_ in PositionAnchor]: string;
};
export declare function applyAnchorClass(element: HTMLElement, anchor: PositionAnchor, prefix: string): void;
//# sourceMappingURL=anchor.d.ts.map