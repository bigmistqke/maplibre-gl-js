export declare function allowsIdeographicBreaking(chars: string): boolean;
export declare function allowsVerticalWritingMode(chars: string): boolean;
export declare function allowsLetterSpacing(chars: string): boolean;
export declare function charAllowsLetterSpacing(char: number): boolean;
export declare function charAllowsIdeographicBreaking(char: number): boolean;
export declare function charHasUprightVerticalOrientation(char: number): boolean;
export declare function charHasNeutralVerticalOrientation(char: number): boolean;
export declare function charHasRotatedVerticalOrientation(char: number): boolean;
export declare function charInComplexShapingScript(char: number): boolean;
export declare function charInRTLScript(char: number): boolean;
export declare function charInSupportedScript(char: number, canRenderRTL: boolean): boolean;
export declare function stringContainsRTLText(chars: string): boolean;
export declare function isStringInSupportedScript(chars: string, canRenderRTL: boolean): boolean;
//# sourceMappingURL=script_detection.d.ts.map