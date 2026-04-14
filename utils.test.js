import { expect, test, describe, beforeAll } from "bun:test";
import { escapeHTML } from "./utils.js";

// Mocking the DOM environment for Bun
describe("escapeHTML utility", () => {
    beforeAll(() => {
        global.document = {
            createElement: (tag) => {
                if (tag === 'div') {
                    const element = {
                        _innerText: "",
                        set innerText(val) {
                            this._innerText = String(val);
                        },
                        get innerText() {
                            return this._innerText;
                        },
                        get innerHTML() {
                            return this._innerText
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/"/g, "&quot;")
                                .replace(/'/g, "&#039;");
                        }
                    };
                    return element;
                }
            }
        };
    });

    test("escapes basic HTML entities", () => {
        const input = '<script>alert("xss")</script>';
        const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
        expect(escapeHTML(input)).toBe(expected);
    });

    test("escapes ampersands", () => {
        const input = 'Fish & Chips';
        const expected = 'Fish &amp; Chips';
        expect(escapeHTML(input)).toBe(expected);
    });

    test("handles null and undefined", () => {
        expect(escapeHTML(null)).toBe("");
        expect(escapeHTML(undefined)).toBe("");
    });

    test("handles empty string", () => {
        expect(escapeHTML("")).toBe("");
    });

    test("handles non-string inputs", () => {
        expect(escapeHTML(123)).toBe("123");
        expect(escapeHTML(true)).toBe("true");
    });

    test("escapes single quotes", () => {
        const input = "It's a test";
        const expected = "It&#039;s a test";
        expect(escapeHTML(input)).toBe(expected);
    });
});
