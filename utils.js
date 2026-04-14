/**
 * Global XSS sanitizer — all user-supplied strings must pass through this before innerHTML
 * @param {any} str
 * @returns {string}
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = String(str ?? '');
    return div.innerHTML;
}
