import { mock, test, expect, spyOn, beforeEach, describe } from "bun:test";

let capturedUpdates = [];
let capturedPushPaths = [];
let capturedQueries = [];
let capturedOnValues = {};

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock((db, path) => ({ path: path || '' })),
    get: mock(() => Promise.resolve()),
    set: mock(() => Promise.resolve()),
    onValue: mock((refOrQuery, callback) => {
        const path = refOrQuery?.path || (typeof refOrQuery === 'string' ? refOrQuery : 'unknown');
        capturedOnValues[path] = callback;
        return mock(() => {});
    }),
    update: mock((refObj, updates) => {
        capturedUpdates.push({ ref: refObj?.path, updates });
        return Promise.resolve();
    }),
    push: mock((refObj) => {
        const path = refObj?.path || '';
        capturedPushPaths.push(path);
        return { key: "-MockPushKey123" };
    }),
    serverTimestamp: mock(() => "MOCK_SERVER_TIMESTAMP"),
    goOnline: mock(() => {}),
    goOffline: mock(() => {}),
    query: mock((qRef, ...constraints) => {
        capturedQueries.push({ ref: qRef?.path, constraints });
        return { path: qRef?.path, isQuery: true };
    }),
    orderByChild: mock((field) => ({ type: 'orderByChild', field })),
    equalTo: mock((val) => ({ type: 'equalTo', val })),
    limitToLast: mock((n) => ({ type: 'limitToLast', n })),
    startAt: mock((val) => ({ type: 'startAt', val }))
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js", () => ({
    getAuth: mock(() => ({ currentUser: { uid: 'test-uid' } })),
    signInAnonymously: mock(() => Promise.resolve({ user: { uid: "test-uid" } })),
}));

// Setup DOM globals before importing app.js
global.localStorage = {
    getItem: mock(() => null),
    setItem: mock(() => {})
};
global.sessionStorage = {
    getItem: mock(() => null),
    setItem: mock(() => {})
};

const domMock = {
    machAvg: { innerText: "102.1" },
    historyCards: { innerHTML: "" },
    statusDot: { className: "" },
    displayConfig: { innerText: "" },
    displayTarget: { innerText: "" },
    targetDisplay: { innerText: "" },
    lanesContainer: { innerHTML: "" },
    "calcVal-1": { value: "" },
    "calcVal-2": { value: "" },
    "calcVal-3": { value: "" },
    "calcVal-4": { value: "" },
    "currDens-1": { value: "0.050" },
    "currDens-2": { value: "0.048" },
    "currDens-3": { value: "" },
    "currDens-4": { value: "0.052" }
};

global.document = {
    getElementById: mock((id) => {
        if (domMock[id]) return domMock[id];
        return {
            className: "",
            style: {},
            classList: { remove: mock(), add: mock() },
            remove: mock(),
            innerText: "",
            value: ""
        };
    }),
    documentElement: {
        style: {
            setProperty: mock()
        },
        fontSize: ""
    },
    addEventListener: mock(),
    querySelector: mock(() => null),
    createElement: mock(() => ({ className: '', appendChild: mock(), style: {} }))
};

global.window = {
    isOfflineMode: false,
    currentUserData: { displayName: "Sarah Connor" },
    addEventListener: mock(),
    showAdminToast: mock(),
    updateUIFromCloud: mock(),
    renderHistoryCards: mock(),
    calculateLocal: mock(),
    t: mock((key) => key)
};

// Import app.js
await import("./app.js?isolated=scaleSyncTest");

describe("Scale Check Logging Synchronization & Mode Mapping", () => {
    beforeEach(() => {
        capturedUpdates = [];
        capturedPushPaths = [];
        capturedQueries = [];
        window.isOfflineMode = false;
        window.currentUserData = { displayName: "Sarah Connor" };
    });

    test("machine mapping maps 4635, 1, '4635' to M1 and 4636, 2, '4636' to M2", () => {
        expect(window.getCloudMachine('4635')).toBe('M1');
        expect(window.getCloudMachine(4635)).toBe('M1');
        expect(window.getCloudMachine(1)).toBe('M1');
        expect(window.getCloudMachine('1')).toBe('M1');
        expect(window.getCloudMachine('M1')).toBe('M1');

        expect(window.getCloudMachine('4636')).toBe('M2');
        expect(window.getCloudMachine(4636)).toBe('M2');
        expect(window.getCloudMachine(2)).toBe('M2');
        expect(window.getCloudMachine('2')).toBe('M2');
        expect(window.getCloudMachine('M2')).toBe('M2');
    });

    test("mode mapping maps modes correctly", () => {
        expect(window.getModeKey('lunch', 4)).toBe('lunch_4L');
        expect(window.getModeKey('breakfast', 4)).toBe('bfast_4L');
        expect(window.getModeKey('bfast', 4)).toBe('bfast_4L');
        expect(window.getModeKey('nuggets_standard', 4)).toBe('nuggets_4L');
        expect(window.getModeKey('nuggets_rework_all', 4)).toBe('nuggets_all');
    });

    test("saveToHistory generates single push key and dual writes exact schema to shiftLedger and histories", () => {
        const cfg = window.getConfig();
        cfg.currentMachine = 1;
        cfg.product = 'lunch';
        cfg.lanes = 4;

        window.setStore({
            target: '102.0',
            lanes: [
                { d: '0.050', w: '102.1', locked: true, disabled: false },
                { d: '0.048', w: '', locked: true, disabled: false },       // unweighed: w -> '--', d -> '0.048'
                { d: '', w: '', locked: true, disabled: true },              // disabled: w -> 'OFF', d -> '--'
                { d: '-0.020', w: '101.9', locked: true, disabled: false }   // negative fillet density
            ]
        });
        domMock.machAvg.innerText = '102.1';

        window.saveToHistory();

        expect(capturedPushPaths).toContain("histories/M1/lunch_4L");
        expect(capturedUpdates.length).toBe(1);

        const updateCall = capturedUpdates[0];
        const pushKey = "-MockPushKey123";
        expect(updateCall.updates[`histories/M1/lunch_4L/${pushKey}`]).toBeDefined();
        expect(updateCall.updates[`shiftLedger/M1/${pushKey}`]).toBeDefined();

        const payload = updateCall.updates[`histories/M1/lunch_4L/${pushKey}`];
        expect(payload.avg).toBe("102.1g");
        expect(payload.target).toBe("102.0g");
        expect(payload.operator).toBe("Sarah Connor");
        expect(typeof payload.timestamp).toBe("number");
        expect(typeof payload.time).toBe("string");

        // Verify lanes structure: 0-indexed array of 4 items
        expect(payload.lanes.length).toBe(4);
        expect(payload.lanes[0]).toEqual({ d: "0.050", w: "102.1g" });
        expect(payload.lanes[1]).toEqual({ d: "0.048", w: "--" });
        expect(payload.lanes[2]).toEqual({ d: "--", w: "OFF" });
        expect(payload.lanes[3]).toEqual({ d: "-0.020", w: "101.9g" });

        // Ensure shiftLedger payload is identical
        expect(updateCall.updates[`shiftLedger/M1/${pushKey}`]).toEqual(payload);
    });

    test("nuggets mode formats density to 1 decimal place", () => {
        const cfg = window.getConfig();
        cfg.currentMachine = 2;
        cfg.product = 'nuggets_standard';
        cfg.lanes = 4;

        window.setStore({
            target: '15.0',
            lanes: [
                { d: '14.825', w: '15.1', locked: true, disabled: false },
                { d: '14.54', w: '14.9', locked: true, disabled: false },
                { d: '15.0', w: '', locked: true, disabled: false },
                { d: '--', w: '', locked: true, disabled: true }
            ]
        });
        domMock.machAvg.innerText = '15.0';

        window.saveToHistory();

        const pushKey = "-MockPushKey123";
        const updateCall = capturedUpdates[0];
        const payload = updateCall.updates[`histories/M2/nuggets_4L/${pushKey}`];

        expect(payload.lanes[0]).toEqual({ d: "14.8", w: "15.1g" });
        expect(payload.lanes[1]).toEqual({ d: "14.5", w: "14.9g" });
        expect(payload.lanes[2]).toEqual({ d: "15.0", w: "--" }); // unweighed gets current d (or target fallback)
        expect(payload.lanes[3]).toEqual({ d: "--", w: "OFF" });
    });

    test("pushLaneToCloud performs surgical update with numeric lastD, lastW, and lastUpdated timestamp", () => {
        const cfg = window.getConfig();
        cfg.currentMachine = 1;
        cfg.product = 'lunch';
        cfg.lanes = 4;

        window.setStore({
            target: '102.0',
            lanes: [
                { d: "0.050", w: "102.1", lastD: 0.045, lastW: 101.8, locked: true, disabled: false, attempts: 1, smartActive: true, stableCount: 0 },
                { d: "0.048", w: "102.0", lastD: null, lastW: null, locked: true, disabled: false }
            ]
        });

        window.startCloudSync();
        capturedUpdates = [];

        window.pushLaneToCloud(1);

        expect(capturedUpdates.length).toBe(1);
        const updateCall = capturedUpdates[0];
        expect(updateCall.ref).toBe("stores/M1/lunch_4L");
        expect(updateCall.updates["lanes/0/d"]).toBe("0.050");
        expect(updateCall.updates["lanes/0/w"]).toBe("102.1");
        expect(updateCall.updates["lanes/0/lastD"]).toBe(0.045);
        expect(updateCall.updates["lanes/0/lastW"]).toBe(101.8);
        expect(typeof updateCall.updates["lanes/0/lastUpdated"]).toBe("number");
        expect(updateCall.updates["lanes/0/locked"]).toBe(true);
        expect(updateCall.updates["lastUpdated"]).toBe("MOCK_SERVER_TIMESTAMP");
    });

    test("startCloudSync registers query on histories ordered by timestamp and filtered to current shift", () => {
        const cfg = window.getConfig();
        cfg.currentMachine = 1;
        cfg.product = 'lunch';
        cfg.lanes = 4;

        capturedQueries = [];
        window.startCloudSync();

        expect(capturedQueries.length).toBeGreaterThan(0);
        const histQuery = capturedQueries.find(q => q.ref === "histories/M1/lunch_4L");
        expect(histQuery).toBeDefined();

        const orderConstraint = histQuery.constraints.find(c => c.type === 'orderByChild');
        expect(orderConstraint).toBeDefined();
        expect(orderConstraint.field).toBe('timestamp');

        const startAtConstraint = histQuery.constraints.find(c => c.type === 'startAt');
        expect(startAtConstraint).toBeDefined();
        expect(typeof startAtConstraint.val).toBe('number');
    });
});
