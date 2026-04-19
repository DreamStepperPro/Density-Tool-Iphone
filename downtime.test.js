import { mock, test, expect, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    getApp: mock(() => ({})),
}));

const mockUpdate = mock(() => Promise.reject(new Error("Test update failed")));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    set: mock(() => Promise.resolve()),
    push: mock(() => Promise.resolve()),
    update: mockUpdate,
    onValue: mock(() => () => {}),
    get: mock(() => Promise.resolve()),
}));

test("confirmFault catches update error and shows admin toast", async () => {
    // Setup globals
    global.document = {
        getElementById: mock((id) => {
            if (id === 'faultReason') return { value: 'Jam' };
            if (id === 'pendingCompId') return { value: 'comp123' };
            if (id === 'pendingCompName') return { value: 'Conveyor' };
            if (id === 'faultNotes') return { value: 'Belt stuck' };
            if (id === 'faultSeverity') return { value: 'high' };
            return { value: '' };
        }),
    };

    global.window = {
        isOfflineMode: false,
        getConfig: mock(() => ({ currentMachine: 1 })),
        currentUserData: { adminName: 'AdminBob' },
        showAdminToast: mock(),
        cancelFault: mock(),
        t: mock((key) => key),
    };

    global.navigator = {
        vibrate: mock()
    };

    // Import the module
    await import("./downtime.js?isolated=true");

    // Call the function
    window.confirmFault();

    // Wait for promise microtasks
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockUpdate).toHaveBeenCalled();
    expect(window.showAdminToast).toHaveBeenCalledWith("❌ Network Error: Could not disable component.");
});
