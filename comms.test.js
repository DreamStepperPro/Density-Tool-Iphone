import { mock, test, expect, beforeEach, spyOn } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    getApp: mock(() => ({})),
    initializeApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    push: mock(() => Promise.resolve()),
    update: mock(() => Promise.resolve()),
    onValue: mock(() => () => {}), // Returns unsub function
}));

let chatBoxHtml = '';
global.document = {
    getElementById: mock((id) => {
        if (id === 'chatBox') {
            return {
                set innerHTML(val) { chatBoxHtml = val; },
                get innerHTML() { return chatBoxHtml; },
                scrollTop: 0,
                scrollHeight: 100
            };
        }
        if (id === 'sosModal') return { style: { display: 'none' } };
        if (id === 'sosBadge') return { style: { display: 'none' }, innerText: '' };
        if (id === 'chatInput') return { value: '' };
        return { style: {}, classList: { remove: mock(), add: mock() }, innerText: '', value: '' };
    }),
    querySelector: mock(() => null)
};

global.window = {
    t: mock((key) => {
        const translations = {
            liveYield: 'Live Yield',
            trim: 'Trim',
            fillets: 'Fillets',
            nuggets: 'Nuggets'
        };
        return translations[key] || key;
    }),
    myUid: 'my-uid',
    ADMIN_UID: 'admin-uid',
    currentUserData: { role: 'operator' },
    escapeHTML: (str) => String(str ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m])),
    fireNativeNotification: mock(),
    isOfflineMode: false,
    showAdminToast: mock(),
    getConfig: mock(() => ({ displayName: 'Test User', currentMachine: '1' })),
    confirm: mock(() => true),
    alert: mock(),
    sendCommsMsg: mock()
};

global.navigator = {
    vibrate: mock()
};

global.sessionStorage = {
    getItem: mock(() => null),
    setItem: mock()
};

// Import the module dynamically to avoid setup issues
await import("./comms.js");

beforeEach(() => {
    chatBoxHtml = '';
    document.getElementById.mockImplementation((id) => {
        if (id === 'chatBox') {
            return {
                set innerHTML(val) { chatBoxHtml = val; },
                get innerHTML() { return chatBoxHtml; },
                scrollTop: 0,
                scrollHeight: 100
            };
        }
        if (id === 'sosModal') return { style: { display: 'none' } };
        if (id === 'sosBadge') return { style: { display: 'none' }, innerText: '' };
        if (id === 'chatInput') return { value: '' };
        return { style: {}, classList: { remove: mock(), add: mock() }, innerText: '', value: '' };
    });
});

test("renderChat correctly handles YIELD_UPDATE with invalid JSON", () => {
    const invalidJsonMsg = {
        code: 'YIELD_UPDATE',
        text: '{ bad json',
        senderUid: 'other-uid',
        senderName: 'System',
        machine: 'M1',
        timestamp: Date.now()
    };

    window.renderChat([invalidJsonMsg]);

    // Check that the displayText falls back to escaped text
    expect(chatBoxHtml).toContain('{ bad json');
    expect(chatBoxHtml).not.toContain('Live Yield');
});

test("renderChat correctly handles YIELD_UPDATE with valid JSON", () => {
    const validJsonMsg = {
        code: 'YIELD_UPDATE',
        text: JSON.stringify({ trim: '10', fillet: '20', nugget: '30' }),
        senderUid: 'other-uid',
        senderName: 'System',
        machine: 'M1',
        timestamp: Date.now()
    };

    window.renderChat([validJsonMsg]);

    // Check that the displayText renders correctly
    expect(chatBoxHtml).toContain('Live Yield');
    expect(chatBoxHtml).toContain('Trim: 10');
    expect(chatBoxHtml).toContain('Fillets: 20');
    expect(chatBoxHtml).toContain('Nuggets: 30');
});

test("openSos shows admin toast and returns early if offline mode is enabled", () => {
    window.isOfflineMode = true;
    window.showAdminToast.mockClear();

    window.openSos();

    expect(window.showAdminToast).toHaveBeenCalledWith('📵 Line Dispatch unavailable offline');
    window.isOfflineMode = false;
});

test("openSos displays modal and hides badge", () => {
    window.isOfflineMode = false;
    let modalStyle = { display: 'none' };
    let badgeStyle = { display: 'flex' };

    document.getElementById.mockImplementation((id) => {
        if (id === 'sosModal') return { style: modalStyle };
        if (id === 'sosBadge') return { style: badgeStyle };
        if (id === 'chatBox') return { scrollTop: 0, scrollHeight: 200 };
        return {};
    });

    window.openSos();

    expect(modalStyle.display).toBe('flex');
    expect(badgeStyle.display).toBe('none');
});

test("closeSos hides the modal", () => {
    let modalStyle = { display: 'flex' };

    document.getElementById.mockImplementation((id) => {
        if (id === 'sosModal') return { style: modalStyle };
        return {};
    });

    window.closeSos();

    expect(modalStyle.display).toBe('none');
});

test("sendCustomComms does nothing if input is empty", () => {
    const spy = spyOn(window, "sendCommsMsg"); spy.mockClear();
    document.getElementById.mockImplementation((id) => {
        if (id === 'chatInput') return { value: '   ' };
        return {};
    });

    window.sendCustomComms();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
});

test("sendCustomComms sends message and clears input", () => {
    const spy = spyOn(window, "sendCommsMsg"); spy.mockClear();
    let inputObj = { value: 'Test Message' };
    document.getElementById.mockImplementation((id) => {
        if (id === 'chatInput') return inputObj;
        return {};
    });

    window.sendCustomComms();

    expect(spy).toHaveBeenCalledWith('TEXT', 'Test Message');
    expect(inputObj.value).toBe('');
    spy.mockRestore();
});

test("sendLaneWarning shows admin toast and returns early if offline mode is enabled", () => {
    window.isOfflineMode = true;
    window.showAdminToast.mockClear();

    window.sendLaneWarning('M1', 2);

    expect(window.showAdminToast).toHaveBeenCalledWith('📵 Line Dispatch unavailable offline');
    window.isOfflineMode = false;
});

test("sendLaneWarning calls sendCommsMsg and shows admin toast if confirmed", () => {
    const oldT = window.t;
    window.t = () => null; // Force fallback strings

    const confirmSpy = spyOn(global, "confirm").mockReturnValue(true);
    window.showAdminToast.mockClear();
    const spy = spyOn(window, "sendCommsMsg"); spy.mockClear();

    window.sendLaneWarning('M1', 2);

    expect(spy).toHaveBeenCalledWith('TEXT', expect.stringContaining('check weight on M1, Lane 2'));
    expect(window.showAdminToast).toHaveBeenCalledWith('📣 Dispatch sent to M1 L2');

    spy.mockRestore();
    confirmSpy.mockRestore();
    window.t = oldT;
});

test("sendLaneWarning does nothing if not confirmed", () => {
    const oldT = window.t;
    window.t = () => null; // Force fallback strings

    const confirmSpy = spyOn(global, "confirm").mockReturnValue(false);
    window.showAdminToast.mockClear();
    const spy = spyOn(window, "sendCommsMsg"); spy.mockClear();

    window.sendLaneWarning('M1', 2);

    expect(spy).not.toHaveBeenCalled();
    expect(window.showAdminToast).not.toHaveBeenCalled();

    spy.mockRestore();
    confirmSpy.mockRestore();
    window.t = oldT;
});

test("sendCommsMsg returns early if offline mode is enabled", () => {
    window.isOfflineMode = true;
    const { push } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
    push.mockClear();

    window.sendCommsMsg('TEXT', 'hello');

    expect(push).not.toHaveBeenCalled();
    window.isOfflineMode = false;
});

test("sendCommsMsg pushes correct payload for operator", async () => {
    window.currentUserData = { role: 'operator' };
    const { push } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
    push.mockClear();

    window.sendCommsMsg('TEXT', 'hello');

    expect(push).toHaveBeenCalled();
    const payload = push.mock.calls[0][1];
    expect(payload.role).toBe('operator');
    expect(payload.machine).toBe('DSI 1'); // from getConfig mock
    expect(payload.text).toBe('hello');
    expect(payload.code).toBe('TEXT');
});

test("sendCommsMsg pushes correct payload for admin", async () => {
    window.currentUserData = { role: 'supervisor' };
    const { push } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
    push.mockClear();

    window.sendCommsMsg('TEXT', 'admin msg');

    expect(push).toHaveBeenCalled();
    const payload = push.mock.calls[0][1];
    expect(payload.role).toBe('supervisor');
    expect(payload.machine).toBe('ADMIN');
});

test("sendCommsMsg handles network error", async () => {
    const { push } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
    push.mockImplementationOnce(() => Promise.reject("Simulated Network Error"));

    const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    window.showAdminToast.mockClear();

    await window.sendCommsMsg('TEXT', 'fail msg');

    // Due to the async nature of the catch block, we need to wait a tick
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith("Simulated Network Error");
    expect(window.showAdminToast).toHaveBeenCalledWith("❌ Network Error: Message not sent.");

    consoleErrorSpy.mockRestore();
});

test("renderChat formats ERR_WT and ERR_MECH correctly", () => {
    // Override window.t to return distinct strings for testing
    const oldT = window.t;
    window.t = (key) => {
        if (key === 'errWt') return 'Weight Error';
        if (key === 'errMech') return 'Mechanical Error';
        return key;
    };

    const msgs = [
        { code: 'ERR_WT', text: '', senderUid: 'u1', senderName: 'N1', machine: 'M1', timestamp: Date.now() },
        { code: 'ERR_MECH', text: '', senderUid: 'u2', senderName: 'N2', machine: 'M2', timestamp: Date.now() }
    ];

    window.renderChat(msgs);

    expect(chatBoxHtml).toContain('Weight Error');
    expect(chatBoxHtml).toContain('Mechanical Error');
    expect(chatBoxHtml).toContain('msg-err'); // both are errors

    window.t = oldT;
});

test("renderChat assigns msg-me to my messages and msg-them to others", () => {
    window.myUid = 'me';

    const msgs = [
        { code: 'TEXT', text: 'my text', senderUid: 'me', senderName: 'Me', machine: 'M1', timestamp: Date.now() },
        { code: 'TEXT', text: 'their text', senderUid: 'them', senderName: 'Them', machine: 'M2', timestamp: Date.now() }
    ];

    window.renderChat(msgs);

    expect(chatBoxHtml).toContain('msg-me');
    expect(chatBoxHtml).toContain('msg-them');
});

test("renderChat triggers notification for new messages", () => {
    // Reset state
    window.closeSos();
    const notifySpy = spyOn(window, 'fireNativeNotification'); notifySpy.mockClear();

    const msgs = [
        // Ensure timestamp is strictly greater than initial Date.now() in comms.js
        { code: 'TEXT', text: 'alert', senderUid: 'them', senderName: 'Them', machine: 'M1', timestamp: Date.now() + 10000 }
    ];

    window.renderChat(msgs);

    expect(notifySpy).toHaveBeenCalledWith('DSI Alert: M1', 'alert');
    notifySpy.mockRestore();
});

test("sendCommsMsg logs warning if message prune fails", async () => {
    const { push, onValue, update } = require("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");

    push.mockImplementationOnce(() => Promise.resolve());

    // Create 101 messages to trigger pruning
    const fakeMsgs = {};
    for (let i = 0; i < 101; i++) {
        fakeMsgs[`msg${i}`] = { timestamp: i };
    }
    const fakeSnap = { val: () => fakeMsgs };

    onValue.mockImplementationOnce((ref, cb) => {
        cb(fakeSnap);
    });

    const simError = new Error("Simulated Prune Error");
    update.mockImplementationOnce(() => Promise.reject(simError));

    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    await window.sendCommsMsg('TEXT', 'test prune');

    // Wait for the microtask queue to process the catch block
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(warnSpy).toHaveBeenCalledWith('Prune failed:', simError);

    warnSpy.mockRestore();
});
