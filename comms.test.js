import { mock, test, expect, beforeEach } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    getApp: mock(() => ({})),
    initializeApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    push: mock(() => ({})),
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
        return { style: {}, classList: { remove: mock(), add: mock() } };
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
    showAdminToast: mock()
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
