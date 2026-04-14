// Shared utility functions

export function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

if (typeof window !== 'undefined') {
    window.escapeHTML = escapeHTML;
}
