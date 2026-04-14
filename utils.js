// Global XSS sanitizer — all user-supplied strings must pass through this before innerHTML
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = String(str ?? '');
    return div.innerHTML;
}
