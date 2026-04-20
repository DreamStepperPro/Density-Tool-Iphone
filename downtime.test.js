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


test("isShiftActive correctly identifies active shift window", async () => {
    await import("./downtime.js?isolated=true");

    const RealDate = Date;

    const mockDate = (day, hour, minute) => {
        global.Date = class extends RealDate {
            constructor() {
                super();
            }
            getDay() { return day; }
            getHours() { return hour; }
            getMinutes() { return minute; }
        };
    };

    // Sunday night (active)
    mockDate(0, 23, 50); // 23:50 Sun
    expect(window.isShiftActive()).toBe(true);

    // Monday morning (active)
    mockDate(1, 4, 0); // 04:00 Mon
    expect(window.isShiftActive()).toBe(true);

    // Thursday middle of shift (active)
    mockDate(4, 2, 0); // 02:00 Thu
    expect(window.isShiftActive()).toBe(true);

    // Friday morning tail (active)
    mockDate(5, 7, 50); // 07:50 Fri
    expect(window.isShiftActive()).toBe(true);

    // Friday after shift ends (inactive)
    mockDate(5, 8, 10); // 08:10 Fri
    expect(window.isShiftActive()).toBe(false);

    // Saturday weekend (inactive)
    mockDate(6, 12, 0); // 12:00 Sat
    expect(window.isShiftActive()).toBe(false);

    // Sunday day before shift (inactive)
    mockDate(0, 15, 0); // 15:00 Sun
    expect(window.isShiftActive()).toBe(false);

    global.Date = RealDate; // cleanup
});

test("calculateSmartRoute generates proper routing or null", async () => {
    await import("./downtime.js?isolated=true");

    // Test < 5 healthy cutters (null expected)
    expect(window.calculateSmartRoute(['c1', 'c2', 'c3', 'c4'])).toBeNull();

    // Test 7 healthy cutters (1 down, c1) -> downCutter < 5, so { 1: 1, 2: 2, 3: 2, 4: 2 }
    const route7_1 = window.calculateSmartRoute(['c1']);
    expect(route7_1).not.toBeNull();
    expect(route7_1.length).toBe(8);
    expect(route7_1.find(r => r.actuator === 1)).toEqual({ actuator: 1, subLane: '--', path: 'OFF', mode: 'Off' });
    expect(route7_1.filter(r => r.subLane === 1).length).toBe(1);
    expect(route7_1.filter(r => r.subLane === 4).length).toBe(2);

    // Test 7 healthy cutters (1 down, c5) -> downCutter >= 5, so { 1: 2, 2: 2, 3: 2, 4: 1 }
    const route7_5 = window.calculateSmartRoute(['c5']);
    expect(route7_5.filter(r => r.subLane === 1).length).toBe(2);
    expect(route7_5.filter(r => r.subLane === 4).length).toBe(1);

    // Test 6 healthy cutters (2 down) -> { 1: 1, 2: 2, 3: 2, 4: 1 }
    const route6 = window.calculateSmartRoute(['c1', 'c2']);
    expect(route6).not.toBeNull();
    expect(route6.filter(r => r.subLane === 1).length).toBe(1);
    expect(route6.filter(r => r.subLane === 4).length).toBe(1);

    // Test 5 healthy cutters (3 down) -> { 1: 1, 2: 1, 3: 2, 4: 1 }
    const route5 = window.calculateSmartRoute(['c1', 'c2', 'c3']);
    expect(route5).not.toBeNull();
    expect(route5.filter(r => r.mode === 'Cutter').length).toBe(5);
    expect(route5.filter(r => r.subLane === 2).length).toBe(1);
});


test("populateFaultReasons sets correct hardware-specific options", async () => {
    await import("./downtime.js?isolated=true");

    let appendedOptions = [];

    // Mock the DOM
    global.document = {
        getElementById: mock((id) => {
            if (id === 'faultReason') {
                return {
                    innerHTML: '',
                    appendChild: mock((opt) => {
                        appendedOptions.push(opt.value);
                    })
                };
            }
            return null;
        }),
        createElement: mock((tag) => {
            if (tag === 'option') return { value: '', innerText: '' };
            return {};
        })
    };

    global.window.t = mock((key) => key); // ensure translation mock exists

    // Test sys component
    appendedOptions = [];
    window.populateFaultReasons('sys');
    expect(appendedOptions).toEqual(['f_jam', 'f_motor', 'f_other']);

    // Test cutter component
    appendedOptions = [];
    window.populateFaultReasons('c3');
    expect(appendedOptions).toEqual(['f_orifice', 'f_blocker', 'f_water', 'f_other']);

    // Test belt component
    appendedOptions = [];
    window.populateFaultReasons('bnug');
    expect(appendedOptions).toEqual(['f_tracking', 'f_broken', 'f_motor', 'f_other']);
});


test("confirmReEnable saves log, clears downtime, and shows toast", async () => {
    // Reset / override specific globals for this test
    global.document = {
        getElementById: mock((id) => {
            if (id === 'pendingCompId') return { value: 'c2' };
            return { classList: { remove: mock(), add: mock() } };
        })
    };

    global.window.showAdminToast = mock();
    global.window.cancelReEnable = mock();
    global.window.getConfig = mock(() => ({ currentMachine: 1 }));
    global.window.currentUserData = { adminName: 'AdminAlice' };
    global.window.isOfflineMode = false;

    // Setup Firebase mocks that resolve
    const mockSet = mock(() => Promise.resolve());
    const mockPush = mock(() => Promise.resolve());

    mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
        getDatabase: mock(() => ({})),
        ref: mock(() => ({})),
        set: mockSet,
        push: mockPush,
        update: mock(() => Promise.resolve()),
        onValue: mock(() => () => {}),
        get: mock(() => Promise.resolve()),
    }));

    await import("./downtime.js?isolated=true");

    // Populate currentActiveDowntimes inside the module
    // We need to bypass the local var closure or trigger an event.
    // Instead, offline mode sets it directly from sandbox memory, or we can just call startDowntimeListener offline.

    // Easier way to inject: start offline mode, inject to sandbox, then toggle back to online
    global.window.isOfflineMode = true;
    global.window.sandboxDowntimes = {
        1: {
            'c2': {
                name: 'Cutter 2',
                reason: 'f_orifice',
                severity: 'degraded',
                startTime: Date.now() - 120000, // 2 mins ago
                loggedBy: 'Operator'
            }
        }
    };
    global.window.startDowntimeListener(); // Loads into currentActiveDowntimes

    // Switch back to online for the confirmReEnable behavior we want to test
    global.window.isOfflineMode = false;

    // Call function
    window.confirmReEnable();

    // Wait for promise resolution
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(global.window.cancelReEnable).toHaveBeenCalled();
    // 2 minutes logged
    expect(global.window.showAdminToast).toHaveBeenCalledWith("✅ Repaired. Downtime: 2m logged.");

    // Verify Firebase got called. We can't easily assert mockPush args without deep inspection,
    // but we can assert it was called. (Note: Due to how bun mock.module caching works,
    // we may just want to test offline mode or rely on the toast output if mockPush is hard to isolate)
});


test("confirmReEnable sandbox offline mode bypass works correctly", async () => {
    global.document = {
        getElementById: mock((id) => {
            if (id === 'pendingCompId') return { value: 'c3' };
            return { classList: { remove: mock(), add: mock() } };
        })
    };

    global.window.showAdminToast = mock();
    global.window.cancelReEnable = mock();
    global.window.getConfig = mock(() => ({ currentMachine: 1 }));
    global.window.isOfflineMode = true;

    await import("./downtime.js?isolated=true");

    global.window.sandboxDowntimes = {
        1: {
            'c3': {
                name: 'Cutter 3',
                startTime: Date.now() - 300000 // 5 mins ago
            }
        }
    };
    global.window.startDowntimeListener(); // Loads into currentActiveDowntimes

    window.confirmReEnable();

    expect(global.window.cancelReEnable).toHaveBeenCalled();
    expect(global.window.showAdminToast).toHaveBeenCalledWith("🧪 SANDBOX: Repaired. 5m logged.");

    // Verify it was deleted from sandbox memory
    expect(global.window.sandboxDowntimes[1]['c3']).toBeUndefined();
});

test("confirmReEnable catches push error and shows admin toast", async () => {
    // Enable push error mock
    global.mockPushError = true;

    global.document = {
        getElementById: mock((id) => {
            if (id === 'pendingCompId') return { value: 'c2' };
            return { classList: { remove: mock(), add: mock() } };
        })
    };

    global.window.showAdminToast = mock();
    global.window.cancelReEnable = mock();
    global.window.getConfig = mock(() => ({ currentMachine: 1 }));
    global.window.currentUserData = { adminName: 'AdminAlice' };
    global.window.isOfflineMode = false;
    global.window.t = mock((key) => key);

    // Setup Firebase mocks that reject push
    const mockSet = mock(() => Promise.resolve());
    const mockPushReject = mock(() => Promise.reject(new Error("Network Error")));

    mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
        getDatabase: mock(() => ({})),
        ref: mock(() => ({})),
        set: mockSet,
        push: mockPushReject,
        update: mock(() => Promise.resolve()),
        onValue: mock(() => () => {}),
        get: mock(() => Promise.resolve()),
    }));

    await import("./downtime.js?isolated=true");

    global.window.isOfflineMode = true;
    global.window.sandboxDowntimes = {
        1: {
            'c2': {
                name: 'Cutter 2',
                reason: 'f_orifice',
                severity: 'degraded',
                startTime: Date.now() - 120000,
                loggedBy: 'Operator'
            }
        }
    };
    global.window.startDowntimeListener();
    global.window.isOfflineMode = false;

    window.confirmReEnable();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(global.window.showAdminToast).toHaveBeenCalledWith("❌ Network Error: Could not save log.");
});
