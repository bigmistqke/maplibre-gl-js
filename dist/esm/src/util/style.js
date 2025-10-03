export function coerceSpriteToArray(sprite) {
    const resultArray = [];
    if (typeof sprite === 'string') {
        resultArray.push({ id: 'default', url: sprite });
    }
    else if (sprite && sprite.length > 0) {
        const dedupArray = [];
        for (const { id, url } of sprite) {
            const key = `${id}${url}`;
            if (dedupArray.indexOf(key) === -1) {
                dedupArray.push(key);
                resultArray.push({ id, url });
            }
        }
    }
    return resultArray;
}
//# sourceMappingURL=style.js.map