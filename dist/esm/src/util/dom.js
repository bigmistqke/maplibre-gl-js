import Point from '@mapbox/point-geometry';
export class DOM {
    static testProp(props) {
        if (!DOM.docStyle)
            return props[0];
        for (let i = 0; i < props.length; i++) {
            if (props[i] in DOM.docStyle) {
                return props[i];
            }
        }
        return props[0];
    }
    static create(tagName, className, container) {
        const el = window.document.createElement(tagName);
        if (className !== undefined)
            el.className = className;
        if (container)
            container.appendChild(el);
        return el;
    }
    static createNS(namespaceURI, tagName) {
        const el = window.document.createElementNS(namespaceURI, tagName);
        return el;
    }
    static disableDrag() {
        if (DOM.docStyle && DOM.selectProp) {
            DOM.userSelect = DOM.docStyle[DOM.selectProp];
            DOM.docStyle[DOM.selectProp] = 'none';
        }
    }
    static enableDrag() {
        if (DOM.docStyle && DOM.selectProp) {
            DOM.docStyle[DOM.selectProp] = DOM.userSelect;
        }
    }
    static setTransform(el, value) {
        el.style[DOM.transformProp] = value;
    }
    static addEventListener(target, type, callback, options = {}) {
        if ('passive' in options) {
            target.addEventListener(type, callback, options);
        }
        else {
            target.addEventListener(type, callback, options.capture);
        }
    }
    static removeEventListener(target, type, callback, options = {}) {
        if ('passive' in options) {
            target.removeEventListener(type, callback, options);
        }
        else {
            target.removeEventListener(type, callback, options.capture);
        }
    }
    static suppressClickInternal(e) {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('click', DOM.suppressClickInternal, true);
    }
    static suppressClick() {
        window.addEventListener('click', DOM.suppressClickInternal, true);
        window.setTimeout(() => {
            window.removeEventListener('click', DOM.suppressClickInternal, true);
        }, 0);
    }
    static getScale(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: (rect.width / element.offsetWidth) || 1,
            y: (rect.height / element.offsetHeight) || 1,
            boundingClientRect: rect,
        };
    }
    static getPoint(el, scale, e) {
        const rect = scale.boundingClientRect;
        return new Point(((e.clientX - rect.left) / scale.x) - el.clientLeft, ((e.clientY - rect.top) / scale.y) - el.clientTop);
    }
    static mousePos(el, e) {
        const scale = DOM.getScale(el);
        return DOM.getPoint(el, scale, e);
    }
    static touchPos(el, touches) {
        const points = [];
        const scale = DOM.getScale(el);
        for (let i = 0; i < touches.length; i++) {
            points.push(DOM.getPoint(el, scale, touches[i]));
        }
        return points;
    }
    static mouseButton(e) {
        return e.button;
    }
    static remove(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    static sanitize(str) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, 'text/html');
        const html = doc.body || document.createElement('body');
        const scripts = html.querySelectorAll('script');
        for (const script of scripts) {
            script.remove();
        }
        DOM.clean(html);
        return html.innerHTML;
    }
    static isPossiblyDangerous(name, value) {
        const val = value.replace(/\s+/g, '').toLowerCase();
        if (['src', 'href', 'xlink:href'].includes(name)) {
            if (val.includes('javascript:') || val.includes('data:'))
                return true;
        }
        if (name.startsWith('on'))
            return true;
    }
    static clean(html) {
        const nodes = html.children;
        for (const node of nodes) {
            DOM.removeAttributes(node);
            DOM.clean(node);
        }
    }
    static removeAttributes(elem) {
        for (const { name, value } of elem.attributes) {
            if (!DOM.isPossiblyDangerous(name, value))
                continue;
            elem.removeAttribute(name);
        }
    }
}
DOM.docStyle = typeof window !== 'undefined' && window.document && window.document.documentElement.style;
DOM.selectProp = DOM.testProp(['userSelect', 'MozUserSelect', 'WebkitUserSelect', 'msUserSelect']);
DOM.transformProp = DOM.testProp(['transform', 'WebkitTransform']);
//# sourceMappingURL=dom.js.map