import { mock, test, expect, spyOn, beforeEach } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

const mockUpdate = mock(() => Promise.reject(new Error("Test update failed")));

let storeCallback = null;

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock((db, path) => ({ path })),
    get: mock(() => Promise.resolve()),
    set: mock(() => Promise.resolve()),
    onValue: mock((refObj, callback) => {
        if (refObj && refObj.path && refObj.path.startsWith('stores/M1')) {
            storeCallback = callback;
        }
        return mock(() => {});
    }),
    update: mockUpdate,
    push: mock(() => ({})),
    serverTimestamp: mock(() => ({})),
    goOnline: mock(() => {}),
    goOffline: mock(() => {}),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js", () => ({
    getAuth: mock(() => ({})),
    signInAnonymously: mock(() => Promise.resolve({ user: { uid: "test-uid" } })),
}));

test("pushLaneToCloud handles error correctly", async () => {
    const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Mock DOM elements
    const statusDotMock = {
        className: ""
    };

    global.document = {
        getElementById: mock((id) => {
            if (id === 'statusDot') return statusDotMock;
            return {
                className: "",
                style: {},
                classList: { remove: mock(), add: mock() },
                remove: mock(),
                innerText: "",
                value: ""
            };
        }),
        addEventListener: mock(),
        querySelector: mock(() => null),
        createElement: mock(() => ({ className: '', appendChild: mock(), style: {} }))
    };

    global.window = {
        isOfflineMode: false,
        currentUserData: {},
        addEventListener: mock(),
        showAdminToast: mock(),
        updateUIFromCloud: mock(),
        renderHistoryCards: mock(),
        calculateLocal: mock(),
        t: mock((key) => key) // Mock translation function
    };
    global.sessionStorage = {
        getItem: mock(() => null),
        setItem: mock()
    };

    // Need to reset mock before loading
    window.showAdminToast = mock();
    window.config = { currentMachine: 1, product: 'lunch', lanes: 4 };
    window.store = {
        lanes: [
            { d: 10, w: 20, locked: false, disabled: false }
        ]
    };
    window.db = {};
    // We import with isolated=true cache-buster as requested by memory
    const appModule = await import("./app.js?isolated=" + Date.now());

    // We must wait a tick to ensure app.js is fully loaded and window.pushLaneToCloud is populated
    await new Promise(resolve => setTimeout(resolve, 50));

    // Wait out any initial execution
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear mockUpdate count from top-level execution
    mockUpdate.mockClear();

    // The previous app.js may override window.showAdminToast, so let's set it again just in case
    window.showAdminToast = mock();

    // Set configuration for test to avoid undefined errors
    window.config = { currentMachine: 1, product: "test", lanes: 1 };

    // We need startCloudSync to NOT loop indefinitely
    // and initialize dbRef_Store and 'store'.
    const origStart = window.startCloudSync;
    window.db = {}; // Fake db so it passes check
    window.startCloudSync = mock(); // Break infinite loops inside it if any

    origStart(); // Call original, this initializes dbRef_Store

    // Call the store snapshot handler manually to populate store so we bypass undefined errors
    // Since startCloudSync does onValue on dbRef_Store, we emulate the callback
    const storeSnapshot = {
        val: () => ({
            target: 100,
            lanes: [{ d: 1, w: 2, locked: false, disabled: false, attempts: 0 }]
        })
    };

    // We capture the callback through the mock. Since we mocked onValue in this file:
    // the store callback was the first one attached when origStart was called.
    // However, we just need to set the internal `store` variable of app.js.
    // We can do this because startCloudSync's onValue callback sets `store = snapshot.val();`
    storeCallback(storeSnapshot);

    // Call the function directly on window
    window.pushLaneToCloud(1);

    // Initial state before promise rejection
    expect(statusDotMock.className).toBe("status-dot status-syncing");

    // Wait for the mockUpdate catch block to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockUpdate).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error("Test update failed"));
    expect(statusDotMock.className).toBe("status-dot status-offline");
    expect(window.showAdminToast).toHaveBeenCalledWith("❌ Network Error: Sync failed.");

    consoleErrorSpy.mockRestore();
});
