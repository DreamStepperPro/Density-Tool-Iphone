import { expect, test } from "bun:test";
import { escapeHTML } from "./utils.js";

test("escapeHTML should escape all required characters", () => {
    const input = '&<>"\'';
    const escaped = escapeHTML(input);
    expect(escaped).toBe('&amp;&lt;&gt;&quot;&#39;');
});

test("escapeHTML should handle XSS payload", () => {
    const input = '"><img src=x onerror=alert(1)>';
    const escaped = escapeHTML(input);
    expect(escaped).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});

test("escapeHTML should handle null and undefined", () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
});

test("escapeHTML should handle non-string inputs", () => {
    expect(escapeHTML(123)).toBe('123');
    expect(escapeHTML(true)).toBe('true');
});
