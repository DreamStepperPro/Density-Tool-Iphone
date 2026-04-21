import { test, expect, spyOn, describe, beforeAll } from "bun:test";

describe("benchmark_supervisor.js", () => {
    let consoleSpy;

    beforeAll(async () => {
        // Suppress benchmark output
        consoleSpy = spyOn(console, "log").mockImplementation(() => {});
        // benchmark_supervisor.js sets global.window = {} and adds functions to it
        await import("./benchmark_supervisor.js?isolated=true");
    });

    test("window.extractWeights extracts numeric weights from lane data", () => {
        const entry = {
            lanes: [
                { w: "10.5" },
                { w: "12.0" },
                { w: "invalid" },
                { w: "--" },
                { w: "20" }
            ]
        };
        const weights = window.extractWeights(entry);
        expect(weights).toEqual([10.5, 12.0, 20]);
    });

    test("window.extractWeights handles empty lanes array", () => {
        const entry = { lanes: [] };
        const weights = window.extractWeights(entry);
        expect(weights).toEqual([]);
    });

    test("window.buildSupCard returns an HTML string with correct basic info", () => {
        const dataObj = {
            entry: {
                target: "10.0",
                operator: "TestOperator",
                timestamp: Date.now(),
                time: "12:34",
                lanes: [{ w: "10.1", d: "5.2" }]
            },
            product: "TestProduct"
        };
        const html = window.buildSupCard("DSI 1", dataObj, [], 1);

        expect(typeof html).toBe("string");
        expect(html).toContain("sup-card");
        expect(html).toContain("DSI 1");
        expect(html).toContain("TestProduct");
        expect(html).toContain("10.1");
        expect(html).toContain("5.2");
        expect(html).not.toContain("stale");
    });

    test("window.buildSupCard handles stale data (> 3 mins)", () => {
        const staleTime = Date.now() - 180001;
        const dataObj = {
            entry: {
                target: "10.0",
                timestamp: staleTime,
                time: "12:00",
                lanes: [{ w: "10.0", d: "5.0" }]
            },
            product: "TestProduct"
        };
        const html = window.buildSupCard("DSI 1", dataObj, [], 1);
        expect(html).toContain("sup-card stale");
        expect(html).toContain("⚠️");
    });

    test("window.buildSupCard applies correct color classes based on deviation", () => {
        const dataObj = {
            entry: {
                target: "10.0",
                timestamp: Date.now(),
                time: "12:00",
                lanes: [
                    { w: "10.2", d: "5.0" }, // diff 0.2 <= 0.5 -> bg-perfect
                    { w: "11.5", d: "5.0" }, // diff 1.5 <= 2.0 -> bg-success
                    { w: "12.5", d: "5.0" }, // diff 2.5 <= 3.0 -> bg-warning
                    { w: "15.0", d: "5.0" }  // diff 5.0 > 3.0 -> bg-danger
                ]
            },
            product: "TestProduct"
        };
        const html = window.buildSupCard("DSI 1", dataObj, [], 1);
        expect(html).toContain("bg-perfect");
        expect(html).toContain("bg-success");
        expect(html).toContain("bg-warning");
        expect(html).toContain("bg-danger");
    });

    test("window.buildSupCard renders stability indicators for multiple checks", () => {
        const dataObj = {
            entry: {
                target: "10.0",
                timestamp: Date.now(),
                time: "12:00",
                lanes: [{ w: "10.0", d: "5.0" }]
            },
            product: "TestProduct"
        };

        // Stable lane (weights: 10.0, 10.0, 10.0)
        const recentStable = [
            { lanes: [{ w: "10.0" }] },
            { lanes: [{ w: "10.0" }] }
        ];
        const htmlStable = window.buildSupCard("M1", dataObj, recentStable, 1);
        expect(htmlStable).toContain("🟢");
        expect(htmlStable).toContain("100%");

        // Unstable lane (weights: 10.0, 15.0, 5.0)
        const recentUnstable = [
            { lanes: [{ w: "15.0" }] },
            { lanes: [{ w: "5.0" }] }
        ];
        const htmlUnstable = window.buildSupCard("M1", dataObj, recentUnstable, 1);
        expect(htmlUnstable).toContain("🔴");
    });

    test("window.buildSupCard renders trend chips with correct symbols", () => {
        const dataObj = {
            entry: {
                target: "10.0",
                timestamp: Date.now(),
                time: "12:00",
                lanes: [{ w: "10.0", d: "5.0" }]
            },
            product: "TestProduct"
        };

        const recentChecks = [
            { lanes: [{ w: "10.1" }] }, // mean 10.1, diff 0.1 <= 0.5 -> ✓
            { lanes: [{ w: "11.5" }] }, // mean 11.5, diff 1.5 <= 2.0 -> ↑
            { lanes: [{ w: "12.5" }] }  // mean 12.5, diff 2.5 <= 3.0 -> ~
        ];

        const html = window.buildSupCard("M1", dataObj, recentChecks, 1);
        expect(html).toContain("trend-perfect");
        expect(html).toContain("✓");
        expect(html).toContain("trend-success");
        expect(html).toContain("↑");
        expect(html).toContain("trend-warning");
        expect(html).toContain("~");
    });

    test("window.buildSupCard renders danger trend for large deviation", () => {
        const dataObj = {
            entry: {
                target: "10.0",
                timestamp: Date.now(),
                time: "12:00",
                lanes: [{ w: "10.0", d: "5.0" }]
            },
            product: "TestProduct"
        };

        const recentChecks = [
            { lanes: [{ w: "15.0" }] } // mean 15.0, diff 5.0 > 3.0 -> ✗
        ];

        const html = window.buildSupCard("M1", dataObj, recentChecks, 1);
        expect(html).toContain("trend-danger");
        expect(html).toContain("✗");
    });
});
