import { mock, test, expect } from "bun:test";

const mockPush = mock(() => Promise.reject(new Error("Test push failed")));
const mockUpdate = mock(() => Promise.resolve());

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    serverTimestamp: mock(() => ({})),
    goOnline: mock(() => ({})),
    goOffline: mock(() => ({})),
    push: mock(() => ({})),
    limitToLast: mock(() => ({})),
    query: mock(() => ({})),
    orderByChild: mock(() => ({})),
    equalTo: mock(() => ({})),
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    push: mockPush,
    update: mockUpdate,
    onValue: mock((ref, cb) => {
        // immediately call callback with dummy data so currentActiveDowntimes gets populated
        cb({
            val: () => ({
                'comp123': {
                    name: 'Test Component',
                    startTime: Date.now() - 60000,
                    severity: 'degraded'
                }
            })
        });
        return () => {};
    }),
    get: mock(() => Promise.resolve()),
    set: mock(() => Promise.resolve()),
}));

test("swapSeverity catches push error and shows admin toast", async () => {
    // Setup globals
    global.document = {
        getElementById: mock((id) => {
            if (id === 'pendingCompId') return { value: 'comp123' };
            if (id.startsWith('comp-')) return {
                classList: {
                    remove: mock(),
                    add: mock()
                }
            };
            if (id === 'systemStatusBanner') return { className: '' };
            if (id === 'systemStatusTitle') return { innerText: '' };
            if (id === 'systemStatusSub') return { innerText: '' };
            if (id === 'downtimeLogBody') return { innerHTML: '' };
            return { value: '' };
        }),
    };

    global.window = {
        isOfflineMode: false,
        getConfig: mock(() => ({ currentMachine: 1 })),
        currentUserData: { adminName: 'AdminBob' },
        showAdminToast: mock(),
        cancelReEnable: mock(),
        sandboxDowntimes: {},
        t: mock((key) => key),
    };

    global.navigator = {
        vibrate: mock()
    };

    // Import the module
    await import("./downtime.js?isolated=" + Date.now());

    // Load state
    window.startDowntimeListener();

    // Call the function
    window.swapSeverity('down');

    // Wait for promise microtasks
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockPush).toHaveBeenCalled();
    expect(window.showAdminToast).toHaveBeenCalledWith("❌ Network Error: Could not swap severity.");
});
