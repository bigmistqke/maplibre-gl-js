import { rtlWorkerPlugin } from '../source/rtl_text_plugin_worker';
function transformTextInternal(text, layer, feature) {
    const transform = layer.layout.get('text-transform').evaluate(feature, {});
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    }
    else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }
    if (rtlWorkerPlugin.applyArabicShaping) {
        text = rtlWorkerPlugin.applyArabicShaping(text);
    }
    return text;
}
export function transformText(text, layer, feature) {
    text.sections.forEach(section => {
        section.text = transformTextInternal(section.text, layer, feature);
    });
    return text;
}
//# sourceMappingURL=transform_text.js.map