import { mock, test, expect, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

const mockUpdate = mock(() => Promise.reject(new Error("Test STD update failed")));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    update: mockUpdate,
    onValue: mock(() => {}),
}));

test("updateTargetStdLimit catches update error and logs warning", async () => {
    const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

    global.window = {
        currentUserData: { role: 'supervisor' },
        getIsAdmin: mock(() => false),
        t: mock((str) => str),
        getConfig: mock(() => ({ machines: 2 })),
    };

    global.document = {
        getElementById: mock(() => ({
            style: { display: 'none' }
        })),
    };

    await import("./supervisor.js");

    window.updateTargetStdLimit("2.5");

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith("Failed to update STD ceiling:", new Error("Test STD update failed"));

    consoleWarnSpy.mockRestore();
});
