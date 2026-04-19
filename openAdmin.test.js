import { mock, test, expect, spyOn, beforeEach } from "bun:test";

let onValueCallback = null;
let onValueErrorCallback = null;

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    getDatabase: mock(() => ({})),
    ref: mock(() => ({})),
    get: mock(() => Promise.resolve()),
    set: mock(() => Promise.resolve()),
    update: mock(() => Promise.resolve()),
    push: mock(() => ({})),
    serverTimestamp: mock(() => ({})),
    goOnline: mock(() => {}),
    goOffline: mock(() => {}),
    query: mock(() => ({})),
    orderByChild: mock(() => ({})),
    equalTo: mock(() => ({})),
    onValue: mock((ref, cb, errCb) => {
        onValueCallback = cb;
        onValueErrorCallback = errCb;
        return mock(() => {}); // Unsubscribe
    })
}));

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js", () => ({
    getAuth: mock(() => ({})),
    // Use the hardcoded ADMIN_UID so isAdmin becomes true
    signInAnonymously: mock(() => Promise.resolve({ user: { uid: "aq1MtAQ5FdXPH9D0l8gTyKCEUWg1" } })),
}));

test("openAdmin handles Firebase permission denied gracefully (Operator Rejection)", async () => {
    // Setup globals
    const adminModalStyle = {};
    global.document = {
        getElementById: mock((id) => {
            return {
                className: "",
                style: id === 'adminModal' ? adminModalStyle : {},
                classList: { add: mock(), remove: mock() },
                remove: mock(),
                innerText: "",
                value: "",
                innerHTML: "",
                appendChild: mock()
            };
        }),
        createElement: mock(() => ({ className: "", style: {}, appendChild: mock(), textContent: "", addEventListener: mock() })),
        createTextNode: mock(() => ({})),
        addEventListener: mock()
    };
    
    global.window = {
        isOfflineMode: false,
        currentUserData: {},
        addEventListener: mock(),
        showAdminToast: mock(),
    };
    global.sessionStorage = { getItem: mock(() => null), setItem: mock() };
    
    const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Import app
    await import("./app.js?isolated=openAdminRejection");
    await new Promise(resolve => setTimeout(resolve, 50)); // wait for auth to finish

    // Ensure showAdminToast is mocked in the global scope
    window.showAdminToast = mock();

    // Trigger openAdmin
    window.openAdmin();
    
    // The onValue listener should have been set up. Let's trigger the error callback.
    expect(onValueErrorCallback).not.toBeNull();
    
    const mockError = new Error("Permission Denied");
    onValueErrorCallback(mockError);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith("Firebase permission denied:", mockError);
    expect(window.showAdminToast).toHaveBeenCalledWith("Access Denied: Supervisor clearance required.");
    expect(adminModalStyle.display).toBe("none");
    
    consoleErrorSpy.mockRestore();
});

test("openAdmin handles Firebase successful fetch (Supervisor Success)", async () => {
    // Reset callbacks
    onValueCallback = null;
    onValueErrorCallback = null;
    
    // Setup globals
    const adminModalStyle = {};
    const recentList = { innerHTML: '', appendChild: mock() };
    const approvedList = { innerHTML: '', appendChild: mock() };
    const unapprovedList = { innerHTML: '', appendChild: mock() };
    
    global.document.getElementById = mock((id) => {
        if (id === 'adminModal') return { style: adminModalStyle };
        if (id === 'adminTabRecent') return recentList;
        if (id === 'adminTabApproved') return approvedList;
        if (id === 'adminTabUnapproved') return unapprovedList;
        return {
            className: "",
            style: {},
            classList: { add: mock(), remove: mock() },
            remove: mock(),
            innerText: "",
            value: "",
            innerHTML: "",
            appendChild: mock()
        };
    });
    
    await import("./app.js?isolated=openAdminSuccess");
    await new Promise(resolve => setTimeout(resolve, 50));

    window.openAdmin();
    
    expect(onValueCallback).not.toBeNull();
    
    // Trigger success callback with dummy users
    const mockSnap = {
        val: () => ({
            "user1": { approved: true, displayName: "Alice" },
            "user2": { approved: false, requestTime: Date.now() - 1000 },
            "user3": { approved: false, requestTime: Date.now() - 400000000 }
        })
    };
    
    onValueCallback(mockSnap);
    
    // Check that lists were populated
    expect(approvedList.appendChild).toHaveBeenCalled();
    expect(recentList.appendChild).toHaveBeenCalled();
    expect(unapprovedList.appendChild).toHaveBeenCalled();
});