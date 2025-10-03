import { createLayout } from '../../util/struct_array';
export const patternAttributes = createLayout([
    { name: 'a_pattern_from', components: 4, type: 'Uint16' },
    { name: 'a_pattern_to', components: 4, type: 'Uint16' },
    { name: 'a_pixel_ratio_from', components: 1, type: 'Uint16' },
    { name: 'a_pixel_ratio_to', components: 1, type: 'Uint16' },
]);
//# sourceMappingURL=pattern_attributes.js.map