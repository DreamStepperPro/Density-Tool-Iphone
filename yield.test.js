import { mock, test, expect, spyOn, beforeEach } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock((db, path) => path),
    push: mock((ref, data) => {
        if (global.mockPushError) {
            const err = global.mockPushError;
            global.mockPushError = undefined; // reset
            return Promise.reject(err);
        }
        return Promise.resolve({});
    }),
    set: mock((ref, data) => {
        return Promise.resolve({});
    }),
    onValue: mock(() => {}),
}));

beforeEach(() => {
    global.mockPushError = undefined;

    // Set up basic mock environment
    global.window = {
        currentUserData: { adminName: 'Test Supervisor', role: 'supervisor' },
        showAdminToast: mock(() => {}),
        clearYieldInputs: mock(() => {}),
        sendCommsMsg: mock(() => {}),
        getIsAdmin: mock(() => false),
        loadYieldHistory: mock(() => {})
    };

    global.navigator = {
        vibrate: mock(() => {})
    };

    global.alert = mock(() => {});
    global.confirm = mock(() => true);
});

// Helper to set up document.getElementById for specific values
function setupDocumentMock(values = {}) {
    const defaultElements = {
        y10130: { value: '' },
        y10070: { value: '' },
        y10114: { value: '' },
        y30212: { value: '' },
        y30211: { value: '' },
        y15530: { value: '' },
        y15531: { value: '' },
        y40030boxes: { value: '' },
        yOutput: { innerText: '' },
        yInput: { innerText: '' },
        yPctFillet: { innerText: '' },
        yPctNugget: { innerText: '' },
        yPctTrim: { innerText: '', style: {} },
        yieldModal: { style: {} },
        yieldHistoryList: { innerHTML: '' }
    };

    // Merge overrides
    const elements = { ...defaultElements };
    for (const [id, val] of Object.entries(values)) {
        elements[id] = { ...elements[id], ...val };
    }

    global.document = {
        getElementById: mock((id) => elements[id] || null)
    };

    return elements;
}

test("saveEosYield catches push error and shows error toast", async () => {
    setupDocumentMock({
        y10130: { value: '100' },
        yInput: { innerText: '103' },
        yPctFillet: { innerText: '50%' },
        yPctNugget: { innerText: '20%' },
        yPctTrim: { innerText: '30%', style: {} }
    });

    global.mockPushError = new Error("Test error saving yield");

    await import("./yield.js?isolated=1");

    const clearYieldInputsSpy = spyOn(window, "clearYieldInputs");
    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.saveEosYield();

    // Catch the error since we are not handling it locally in test logic but letting app.js do it
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(showAdminToastSpy).toHaveBeenCalledWith("❌ Error saving yield.");
    expect(clearYieldInputsSpy).not.toHaveBeenCalled();
});

test("calcYield computes correctly and sets properties", async () => {
    const elements = setupDocumentMock({
        y10130: { value: '100' }, // fillet
        y10114: { value: '50' },  // nugget
        y30212: { value: '50' },  // trim
    });

    await import("./yield.js?isolated=2");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.calcYield();

    // output = 100 + 50 + 50 = 200
    // input = 200 * 1.03 = 206
    expect(elements.yOutput.innerText).toBe("200.0");
    expect(elements.yInput.innerText).toBe("206.0");

    // fillet pct = 100 / 206 = 48.54%
    expect(elements.yPctFillet.innerText).toBe("48.54%");
    expect(elements.yPctNugget.innerText).toBe("24.27%");
    expect(elements.yPctTrim.innerText).toBe("24.27%");

    // trim pct > 22%, should be danger
    expect(elements.yPctTrim.style.color).toBe("var(--danger)");
    expect(elements.yPctTrim.style.fontWeight).toBe("bold");

    expect(showAdminToastSpy).not.toHaveBeenCalled();
});

test("calcYield sets trim color to perfect if <= 22%", async () => {
    const elements = setupDocumentMock({
        y10130: { value: '100' }, // fillet
        y10114: { value: '50' },  // nugget
        y30212: { value: '10' },  // trim (10/164.8 = 6%)
    });

    await import("./yield.js?isolated=3");

    window.calcYield();

    expect(elements.yPctTrim.style.color).toBe("var(--perfect)");
});

test("calcYield blocks negative numbers", async () => {
    const elements = setupDocumentMock({
        y10130: { value: '-10' }
    });

    await import("./yield.js?isolated=4");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.calcYield();

    expect(elements.y10130.value).toBe("");
    expect(showAdminToastSpy).toHaveBeenCalledWith("⚠️ Negative numbers blocked.");
    expect(elements.yOutput.innerText).toBe("0.0");
});

test("calcYield blocks maximum values", async () => {
    const elements = setupDocumentMock({
        y10130: { value: '100000' } // > 90000
    });

    await import("./yield.js?isolated=5");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.calcYield();

    expect(elements.y10130.value).toBe(90000);
    expect(showAdminToastSpy).toHaveBeenCalledWith("⚠️ Max weight is 90,000 lbs");
    expect(global.navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
});

test("calcYield blocks maximum box count", async () => {
    const elements = setupDocumentMock({
        y40030boxes: { value: '1000' } // > 999
    });

    await import("./yield.js?isolated=6");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.calcYield();

    expect(elements.y40030boxes.value).toBe(999);
    expect(showAdminToastSpy).toHaveBeenCalledWith("⚠️ Max box count is 999");
});

test("calcYield handles zero input correctly", async () => {
    const elements = setupDocumentMock(); // All values default to '0' or empty

    await import("./yield.js?isolated=7");

    window.calcYield();

    expect(elements.yOutput.innerText).toBe("0.0");
    expect(elements.yInput.innerText).toBe("0.0");
    expect(elements.yPctFillet.innerText).toBe("0.0%");
    expect(elements.yPctNugget.innerText).toBe("0.0%");
    expect(elements.yPctTrim.innerText).toBe("0.0%");
});

test("saveEosYield alerts if totalOutput <= 0", async () => {
    setupDocumentMock(); // All 0

    const alertSpy = spyOn(global, "alert");

    await import("./yield.js?isolated=8");

    window.saveEosYield();

    expect(alertSpy).toHaveBeenCalledWith("Please enter product weights first.");
});

test("saveEosYield warns if high yield", async () => {
    setupDocumentMock({
        y10130: { value: '80000' } // > 70000
    });

    const confirmSpy = spyOn(global, "confirm").mockReturnValue(false); // don't proceed

    await import("./yield.js?isolated=9");

    const clearYieldInputsSpy = spyOn(window, "clearYieldInputs");

    window.saveEosYield();

    expect(confirmSpy).toHaveBeenCalled();
    expect(clearYieldInputsSpy).not.toHaveBeenCalled();
});

test("saveEosYield success flow", async () => {
    setupDocumentMock({
        y10130: { value: '1000' },
        yInput: { innerText: '1030' },
        yPctFillet: { innerText: '100%' },
        yPctNugget: { innerText: '0%' },
        yPctTrim: { innerText: '0%', style: {} }
    });

    await import("./yield.js?isolated=10");

    const showAdminToastSpy = spyOn(window, "showAdminToast");
    const clearYieldInputsSpy = spyOn(window, "clearYieldInputs");

    window.saveEosYield();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(showAdminToastSpy).toHaveBeenCalledWith("✅ EOS Yield Saved!");
    expect(clearYieldInputsSpy).toHaveBeenCalled();
});

test("broadcastMidShiftYield alerts if totalOutput <= 0", async () => {
    setupDocumentMock(); // All 0

    const alertSpy = spyOn(global, "alert");

    await import("./yield.js?isolated=11");

    window.broadcastMidShiftYield();

    expect(alertSpy).toHaveBeenCalledWith("Please enter product weights first.");
});

test("broadcastMidShiftYield success flow", async () => {
    setupDocumentMock({
        y10130: { value: '1000' },
        yInput: { innerText: '1030' },
        yPctFillet: { innerText: '100%' },
        yPctNugget: { innerText: '0%' },
        yPctTrim: { innerText: '0%', style: {} }
    });

    await import("./yield.js?isolated=12");

    const sendCommsMsgSpy = spyOn(window, "sendCommsMsg");
    const showAdminToastSpy = spyOn(window, "showAdminToast");
    const clearYieldInputsSpy = spyOn(window, "clearYieldInputs");

    window.broadcastMidShiftYield();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(sendCommsMsgSpy).toHaveBeenCalledWith("YIELD_UPDATE", JSON.stringify({
        trim: "0%", fillet: "100%", nugget: "0%"
    }));
    expect(showAdminToastSpy).toHaveBeenCalledWith("📣 Yield Broadcasted to Team!");
    expect(clearYieldInputsSpy).toHaveBeenCalled();
});

test("broadcastMidShiftYield handles push error", async () => {
    setupDocumentMock({
        y10130: { value: '1000' },
        yInput: { innerText: '1030' },
        yPctFillet: { innerText: '100%' },
        yPctNugget: { innerText: '0%' },
        yPctTrim: { innerText: '0%', style: {} }
    });

    global.mockPushError = new Error("Network Error");

    await import("./yield.js?isolated=13");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    // Wrap in try catch as uncaught promise rejections can crash bun test runner
    try {
        window.broadcastMidShiftYield();
        await new Promise(resolve => setTimeout(resolve, 50));
    } catch(e) {}

    expect(showAdminToastSpy).toHaveBeenCalledWith("❌ Error saving mid-shift yield.");
});

test("wipeYieldHistory prevents non-admin/supervisor", async () => {
    global.window.currentUserData = { role: 'operator' };
    global.window.getIsAdmin = mock(() => false);

    const confirmSpy = spyOn(global, "confirm");

    await import("./yield.js?isolated=14");

    window.wipeYieldHistory();

    expect(confirmSpy).not.toHaveBeenCalled();
});

test("wipeYieldHistory works for authorized user", async () => {
    global.window.currentUserData = { role: 'operator' };
    global.window.getIsAdmin = mock(() => true);

    const confirmSpy = spyOn(global, "confirm").mockReturnValue(true);

    await import("./yield.js?isolated=15");

    const showAdminToastSpy = spyOn(window, "showAdminToast");

    window.wipeYieldHistory();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(confirmSpy).toHaveBeenCalled();
    expect(showAdminToastSpy).toHaveBeenCalledWith("🗑️ Yield history wiped.");
});

test("openYield and closeYield handle UI and unsub", async () => {
    const elements = setupDocumentMock();

    await import("./yield.js?isolated=16");

    window.openYield();
    expect(elements.yieldModal.style.display).toBe("flex");

    window.closeYield();
    expect(elements.yieldModal.style.display).toBe("none");
});
