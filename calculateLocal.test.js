import { mock, test, expect, spyOn, beforeEach, afterEach } from "bun:test";

// Since app.js execution caches across tests, we should append a query parameter or just use isolated contexts.
// Actually, Bun has a way to bust the module cache: `await import("./app.js?run=" + Date.now())`
// But firebase modules might also be cached. Wait, `mock.module` applies to the whole environment.

global.document = {
    body: { classList: { add: mock(), remove: mock() } },
    createElement: mock(() => ({ classList: { add: mock(), remove: mock() }, appendChild: mock(), addEventListener: mock() })),
    getElementById: mock((id) => ({ innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), appendChild: mock(), innerHTML: '' })),
    addEventListener: mock()
};

global.window = {
    t: (str) => str, FACTORS: { lunch: 0.01, bfast: 0.017 }, addEventListener: mock(), isOfflineMode: false, currentUserData: {},
    localStorage: { getItem: mock(() => null), setItem: mock() },
    applyTranslations: mock(), renderLanes: mock(), updateUIFromCloud: mock(), renderMachineTabs: mock(), showAdminToast: mock()
};

global.localStorage = window.localStorage;
global.sessionStorage = { getItem: mock(() => null), setItem: mock() };

let onValueCallbacks = {};

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})), getApp: mock(() => ({}))
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock((db, path) => path),
    get: mock(() => Promise.resolve()), set: mock(() => Promise.resolve()),
    onValue: mock((ref, callback) => {
        if (!global.onValueCallbacks) global.onValueCallbacks = {};
        if (ref && typeof ref === 'string' && (ref.startsWith('stores/') || ref.startsWith('histories/'))) {
            global.onValueCallbacks[ref] = callback;
        }
    }),
    update: mock(() => Promise.resolve()), push: mock(() => ({})), serverTimestamp: mock(() => ({})), goOnline: mock(() => {}), goOffline: mock(() => {}),
    query: mock(() => ({})), orderByChild: mock(() => ({})), equalTo: mock(() => ({}))
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js", () => ({
    getAuth: mock(() => ({})), signInAnonymously: mock(() => Promise.resolve({ user: { uid: "test-uid" } }))
}));

// Use a timestamp query to force a fresh execution of app.js just for this file!
await import("./app.js?isolated=true");

function setupCalculateLocal() {
    window.db = {};
    if (!window.initApp) {
        window.initApp = mock();
    }

    // We mock missing DOM elements and functions
    if (!global.escapeHTML) {
        global.escapeHTML = (str) => str;
        window.escapeHTML = global.escapeHTML;
    }

    // reset global configs
    window.config = { currentMachine: 1, product: "lunch", lanes: 4, smart: "auto" };
    window.getConfig = () => window.config;

    window.departmentSnipe = { active: false };

    // To override store and config locally we can call startCloudSync
    // and trigger the mocked onValue callbacks.
    if (window.startCloudSync) {
        window.startCloudSync();
    }

    const storeRef = Object.keys(global.onValueCallbacks || {}).find(k => k.startsWith('stores/') && !k.includes('departmentSnipe'));
    const historyRef = Object.keys(global.onValueCallbacks || {}).find(k => k.startsWith('histories/') && !k.includes('departmentSnipe'));

    return { storeRef, historyRef };
}

test("calculateLocal correctly calculates target with basic smart logic", () => {
    const { storeRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.000", w: "105.0", disabled: false },
                { d: "0.000", w: "105.0", disabled: true },
                { d: "0.000", w: "105.0", disabled: false },
                { d: "0.000", w: "105.0", disabled: false }
            ]
        })
    });

    const hiddenValMock = { value: '' };
    const resTextMock = { innerText: '' };
    const resBoxMock = { classList: { add: mock(), remove: mock() } };

    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'resText-1') return resTextMock;
        if (id === 'resBox-1') return resBoxMock;
        if (id === 'trend-1') return { innerText: '', style: {} };
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.calculateLocal();

    expect(hiddenValMock.value).toBe("0.050");
    expect(resTextMock.innerText).toBe("newDens 0.050");
});

test("calculateLocal sets active K properly based on limits", () => {
    const { storeRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.000", w: "105.0", disabled: false, smartActive: true, lastD: "0.005", lastW: "100.0" }
            ]
        })
    });

    const hiddenValMock = { value: '' };
    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'trend-1') return { innerText: '', style: {} };
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resBox-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resText-1') return { innerText: '' };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.getConfig().smart = 'auto'; // needed to trigger rule 1 outlier veto
    window.calculateLocal();

    expect(hiddenValMock.value).toBe("0.035");
});

test("calculateLocal bounds new density by machine limits", () => {
    const { storeRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.450", w: "200.0", disabled: false }
            ]
        })
    });

    const hiddenValMock = { value: '' };
    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'trend-1') return { innerText: '', style: {} };
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resBox-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resText-1') return { innerText: '' };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.calculateLocal();

    expect(hiddenValMock.value).toBe("0.500");
});

test("calculateLocal redirects math to grand mean when snipe lane is active", () => {
    const { storeRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.000", w: "105.0", disabled: false }
            ]
        })
    });

    window.getConfig().currentMachine = 1;
    window.departmentSnipe = {
        active: true,
        machine: 1,
        lane: 1,
        grandMean: 102
    };

    const hiddenValMock = { value: '' };
    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'trend-1') return { innerText: '', style: {} };
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resBox-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resText-1') return { innerText: '' };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.calculateLocal();

    expect(hiddenValMock.value).toBe("0.030");
});

test("calculateLocal tolerance deadband locks density within ±0.5g of snipe target", () => {
    const { storeRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.010", w: "102.4", disabled: false }
            ]
        })
    });

    window.getConfig().currentMachine = 1;
    window.departmentSnipe = {
        active: true,
        machine: 1,
        lane: 1,
        grandMean: 102
    };

    const hiddenValMock = { value: '' };
    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'trend-1') return { innerText: '', style: {} };
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resBox-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resText-1') return { innerText: '' };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.calculateLocal();

    expect(hiddenValMock.value).toBe("0.010");
});

test("calculateLocal calculates predictive velocity and updates trend UI", () => {
    const { storeRef, historyRef } = setupCalculateLocal();
    global.onValueCallbacks[storeRef]({
        val: () => ({
            target: "100",
            lanes: [
                { d: "0.000", w: "101.5", disabled: false }
            ]
        })
    });

    global.onValueCallbacks[historyRef]({
        val: () => ({
            "-N1": { timestamp: Date.now() - 60000, lanes: [{ d: "0.000", w: "101.0" }] },
            "-N2": { timestamp: Date.now() - 120000, lanes: [{ d: "0.000", w: "100.5" }] },
            "-N3": { timestamp: Date.now() - 180000, lanes: [{ d: "0.000", w: "100.0" }] }
        })
    });

    const hiddenValMock = { value: '' };
    const trendMock = { innerHTML: '', style: {} };

    global.document.getElementById.mockImplementation((id) => {
        if (id === 'calcVal-1') return hiddenValMock;
        if (id === 'trend-1') return trendMock;
        if (id === 'card-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resBox-1') return { classList: { add: mock(), remove: mock() }, style: {} };
        if (id === 'resText-1') return { innerText: '' };
        return { innerText: '', value: '', classList: { add: mock(), remove: mock() }, style: {}, remove: mock(), innerHTML: '', appendChild: mock() };
    });

    window.calculateLocal();

    expect(trendMock.innerHTML).not.toBe('');
});
