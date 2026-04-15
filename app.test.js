import { mock, test, expect, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

const mockUpdate = mock(() => Promise.reject(new Error("Test update failed")));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    get: mock(() => Promise.resolve()),
    set: mock(() => Promise.resolve()),
    onValue: mock(() => {}),
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

test("lastLogin update error is caught and warned", async () => {
    const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

    // We need to mock document methods since app.js uses document.getElementById
    global.document = {
        getElementById: mock(() => ({
            className: "",
            style: {},
            classList: { remove: mock() },
            remove: mock()
        })),
        addEventListener: mock()
    };
    global.window = {
        isOfflineMode: false,
        currentUserData: {},
        addEventListener: mock()
    };
    global.sessionStorage = {
        getItem: mock(() => null),
        setItem: mock()
    };

    // Import app.js to run its top-level code
    await import("./app.js");

    // Wait for promises to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith(new Error("Test update failed"));

    consoleWarnSpy.mockRestore();
});
