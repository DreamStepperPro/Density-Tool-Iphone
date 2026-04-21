import { mock, test, expect, spyOn, beforeEach } from "bun:test";

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js", () => ({
    initializeApp: mock(() => ({})),
    getApp: mock(() => ({})),
}));

const mockUpdate = mock(() => Promise.reject(new Error("Test STD update failed")));

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
    update: mockUpdate,
    onValue: mock(() => {}),
}));

let importCount = 0;

beforeEach(async () => {
    global.window = {
        currentUserData: { role: 'supervisor' },
        getIsAdmin: mock(() => false),
        t: mock((str) => str),
        getConfig: mock(() => ({ machines: 2 })),
        escapeHTML: mock((str) => str), // Mock escapeHTML attached to window as per memory
    };

    global.document = {
        getElementById: mock(() => ({
            style: { display: 'none' }
        })),
        createElement: mock((tag) => ({ tag, style: {}, textContent: '', className: '', setAttribute: mock(() => {}), appendChild: mock(() => {}), classList: { add: mock(() => {}) } })),
    };

    // We add escapeHTML to global because the script depends on it
    global.escapeHTML = mock((str) => str);

    importCount++;
    await import(`./supervisor.js?isolated=${importCount}`);
});

test("updateTargetStdLimit catches update error and logs warning", async () => {
    const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

    window.updateTargetStdLimit("2.5");

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith("Failed to update STD ceiling:", new Error("Test STD update failed"));

    consoleWarnSpy.mockRestore();
});

test("getAbsoluteLatest returns correct latest entry", async () => {
    const machineHistories = {
        lunch: [{ timestamp: 100, val: 1 }, { timestamp: 50, val: 2 }],
        bfast: [{ timestamp: 200, val: 3 }]
    };

    const latest = window.getAbsoluteLatest(machineHistories);
    expect(latest.entry.timestamp).toBe(200);
    expect(latest.product).toBe('bfast');

    const emptyLatest = window.getAbsoluteLatest({});
    expect(emptyLatest).toBe(null);

    const nullLatest = window.getAbsoluteLatest(null);
    expect(nullLatest).toBe(null);
});

test("getRecentChecks returns correct sorted array", async () => {
    const machineHistories = {
        lunch: [{ timestamp: 100, val: 1 }, { timestamp: 50, val: 2 }],
        bfast: [{ timestamp: 200, val: 3 }]
    };

    const recent = window.getRecentChecks(machineHistories, 2);
    expect(recent.length).toBe(2);
    expect(recent[0].timestamp).toBe(200);
    expect(recent[1].timestamp).toBe(100);

    const recentBfast = window.getRecentChecks(machineHistories, 5, 'bfast');
    expect(recentBfast.length).toBe(1);
    expect(recentBfast[0].timestamp).toBe(200);
});

test("extractWeights returns array of valid numbers", async () => {
    const entry = {
        lanes: [{ w: '10.5' }, { w: '--' }, { w: 'invalid' }, { w: '20' }]
    };

    const weights = window.extractWeights(entry);
    expect(weights).toEqual([10.5, 20]);
});

test("calculateDepartmentStats handles empty histories", async () => {
    const allHistories = { M1: null, M2: null };
    const stats = window.calculateDepartmentStats(allHistories);
    expect(stats).toBe(null);
});

test("calculateDepartmentStats calculates stats correctly", async () => {
    // We need 10 items for batch size
    const allHistories = {
        M1: {
            bfast: [
                { timestamp: 1000, lanes: [{ w: '10' }, { w: '12' }] },
                { timestamp: 900, lanes: [{ w: '10' }, { w: '12' }] }
            ]
        },
        M2: {
            bfast: [
                { timestamp: 1100, lanes: [{ w: '8' }, { w: '10' }] }
            ]
        }
    };

    // grand mean = (10+12+10+12+8+10) / 6 = 62 / 6 = 10.33
    // variance = ((-0.33)^2 * 3 + (1.67)^2 * 2 + (-2.33)^2 * 1) / 6
    // variance = (0.1089 * 3 + 2.7889 * 2 + 5.4289) / 6
    // variance = (0.3267 + 5.5778 + 5.4289) / 6 = 11.3334 / 6 = 1.8889
    // rawStd = sqrt(1.8889) = 1.37
    // trueEstimatedStd = 1.37 * sqrt(10) = 4.33
    // Snipe target: worst lane is M2_L1 with weight 8 (dev 2.33 from mean)

    const stats = window.calculateDepartmentStats(allHistories);
    expect(stats).not.toBe(null);
    expect(stats.grandMean).toBe("10.3");
    expect(stats.snipeTarget.machine).toBe(2);
    expect(stats.snipeTarget.lane).toBe(1);
    expect(stats.product).toBe("bfast");
});

test("buildSupCard creates correct HTML structure", async () => {
    const title = "DSI 1";
    const dataObj = {
        product: "bfast",
        entry: { timestamp: Date.now(), target: "10.0", operator: "Op1", time: "12:00", lanes: [{ w: '10', d: '1.0' }] }
    };
    const recentChecks = [];
    const m = 1;

    const html = window.buildSupCard(title, dataObj, recentChecks, m);
    expect(html).toContain('class="sup-card');
    expect(html).toContain('DSI 1');
    expect(html).toContain('Op1');
});

test("buildSupCard assigns appropriate colors to lanes based on weight", async () => {
    // Exact target is 10.0
    const title = "DSI 1";
    const dataObj = {
        product: "bfast",
        entry: {
            timestamp: Date.now(),
            target: "10.0",
            operator: "Op1",
            time: "12:00",
            lanes: [
                { w: '10.2', d: '1.0' }, // diff 0.2 (perfect)
                { w: '11.5', d: '1.0' }, // diff 1.5 (success)
                { w: '12.5', d: '1.0' }, // diff 2.5 (warning)
                { w: '15.0', d: '1.0' }, // diff 5.0 (danger)
            ]
        }
    };

    const html = window.buildSupCard(title, dataObj, [], 1);

    expect(html).toContain('bg-perfect');
    expect(html).toContain('bg-success');
    expect(html).toContain('bg-warning');
    expect(html).toContain('bg-danger');
});

test("openSupHistory displays empty state when no history found", async () => {
    let titleEl = { innerText: '' };
    let listEl = { innerHTML: '' };
    let modalEl = { style: { display: 'none' } };

    global.document.getElementById = mock((id) => {
        if (id === 'supHistoryTitle') return titleEl;
        if (id === 'supHistoryList') return listEl;
        if (id === 'supHistoryModal') return modalEl;
        return { style: { display: 'none' } };
    });

    window.openSupHistory(1);

    expect(titleEl.innerText).toBe("📋 DSI 1 Ledger");
    expect(listEl.innerHTML).toContain("No shift history found");
    expect(modalEl.style.display).toBe("flex");
});

test("closeSupHistory hides the modal", async () => {
    let modalEl = { style: { display: 'flex' } };
    global.document.getElementById = mock((id) => {
        if (id === 'supHistoryModal') return modalEl;
        return { style: {} };
    });

    window.closeSupHistory();
    expect(modalEl.style.display).toBe('none');
});

test("openMaintHistory shows and hides correct modals", async () => {
    let maintenanceModalEl = { style: { display: 'flex' } };
    let maintHistoryModalEl = { style: { display: 'none' } };

    global.document.getElementById = mock((id) => {
        if (id === 'maintenanceModal') return maintenanceModalEl;
        if (id === 'maintHistoryModal') return maintHistoryModalEl;
        if (id === 'maintHistoryList') return { innerHTML: '' };
        return { style: {} };
    });

    window.openMaintHistory();
    expect(maintenanceModalEl.style.display).toBe('none');
    expect(maintHistoryModalEl.style.display).toBe('flex');
});

test("closeMaintHistory shows and hides correct modals", async () => {
    let maintenanceModalEl = { style: { display: 'none' } };
    let maintHistoryModalEl = { style: { display: 'flex' } };

    global.document.getElementById = mock((id) => {
        if (id === 'maintenanceModal') return maintenanceModalEl;
        if (id === 'maintHistoryModal') return maintHistoryModalEl;
        return { style: {} };
    });

    window.closeMaintHistory();
    expect(maintenanceModalEl.style.display).toBe('flex');
    expect(maintHistoryModalEl.style.display).toBe('none');
});

test("renderMaintHistory displays empty state when no logs", async () => {
    let containerEl = { innerHTML: '' };
    let summaryBoxEl = { style: { display: 'flex' } };

    global.document.getElementById = mock((id) => {
        if (id === 'maintHistoryList') return containerEl;
        if (id === 'maintSummaryBox') return summaryBoxEl;
        return null;
    });

    window.renderMaintHistory();

    expect(containerEl.innerHTML).toContain(global.window.t('noLogs'));
    expect(summaryBoxEl.style.display).toBe('none');
});
