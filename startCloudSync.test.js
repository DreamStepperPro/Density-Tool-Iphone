import { mock, test, expect, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

// Mock set to fail
const mockSet = mock(() => Promise.reject(new Error("Test set failed")));

// We need onValue to immediately invoke the callback with a null snapshot
// for dbRef_Store and something else for dbRef_History and snippets.
// startCloudSync sets up three onValue listeners: dbRef_Store, dbRef_History, departmentSnipe
let storeCallback = null;

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock((db, path) => ({ path })), // return path to differentiate
    get: mock(() => Promise.resolve()),
    set: mockSet,
    onValue: mock((refObj, callback) => {
        if (refObj && refObj.path && refObj.path.startsWith('stores/M1')) {
            storeCallback = callback;
        }
        return mock(() => {}); // unsub function
    }),
    update: mock(() => Promise.resolve()),
    push: mock(() => ({})),
    serverTimestamp: mock(() => ({})),
    goOnline: mock(() => {}),
    goOffline: mock(() => {}),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js", () => ({
    getAuth: mock(() => ({})),
    signInAnonymously: mock(() => Promise.resolve({ user: { uid: "test-uid" } })),
}));

test("startCloudSync handles error when initializing machine", async () => {
    // Mock global dependencies before importing app.js
    global.document = {
        getElementById: mock(() => ({
            className: "",
            style: {},
            classList: { remove: mock(), add: mock() },
            remove: mock(),
            innerText: "",
            value: ""
        })),
        addEventListener: mock(),
        querySelector: mock(() => null)
    };

    global.window = {
        isOfflineMode: false,
        currentUserData: {},
        addEventListener: mock(),
        showAdminToast: mock(),
        updateUIFromCloud: mock(),
        renderHistoryCards: mock(),
        calculateLocal: mock()
    };
    global.sessionStorage = {
        getItem: mock(() => null),
        setItem: mock()
    };

    // Need to reset mock before loading
    window.showAdminToast = mock();
    window.config = { currentMachine: 1, product: 'lunch', lanes: 4 };
    window.db = {};

    // We import with isolated=true cache-buster as requested by memory
    const appModule = await import("./app.js?isolated=" + Date.now());

    // We must wait a tick to ensure app.js is fully loaded and window.startCloudSync is populated
    await new Promise(resolve => setTimeout(resolve, 50));

    // The previous app.js may override window.showAdminToast, so let's set it again just in case
    window.showAdminToast = mock();

    // Call the function directly on window
    const origStart = window.startCloudSync;

    origStart();

    // Now trigger the store callback with a null snapshot to simulate missing store
    // which triggers the initialization block
    expect(storeCallback).not.toBeNull();

    storeCallback({ val: () => null });

    // Wait for the mockSet catch block to execute
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockSet).toHaveBeenCalled();
    expect(window.showAdminToast).toHaveBeenCalledWith("❌ Error initializing machine.");
});
