export function resolveTokens(properties, text) {
    return text.replace(/{([^{}]+)}/g, (match, key) => {
        return properties && key in properties ? String(properties[key]) : '';
    });
}
//# sourceMappingURL=resolve_tokens.js.map