import { mock, test, expect, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

const mockPush = mock(() => Promise.reject(new Error("Test error saving yield")));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    push: mockPush,
    set: mock(() => Promise.resolve()),
    onValue: mock(() => {}),
}));

test("saveEosYield catches push error and shows error toast", async () => {
    global.window = {
        currentUserData: { adminName: 'Test Supervisor' },
        showAdminToast: mock(() => {}),
        clearYieldInputs: mock(() => {}),
    };

    global.document = {
        getElementById: mock((id) => {
            if (id === 'y10130') return { value: '100' };
            if (id === 'yInput') return { innerText: '103' };
            if (id === 'yPctFillet') return { innerText: '50%' };
            if (id === 'yPctNugget') return { innerText: '20%' };
            if (id === 'yPctTrim') return { innerText: '30%' };
            return { value: '0' };
        }),
    };

    global.alert = mock(() => {});
    global.confirm = mock(() => true);

    await import("./yield.js?isolated=true");

    const clearYieldInputsSpy = spyOn(window, "clearYieldInputs");
    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.saveEosYield();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(showAdminToastSpy).toHaveBeenCalledWith("❌ Error saving yield.");
    expect(clearYieldInputsSpy).not.toHaveBeenCalled();
});
