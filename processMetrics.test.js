import { expect, test, describe, beforeEach, afterEach, mock, spyOn } from 'bun:test';

// Global mocks
global.window = {
    sessionContext: {},
    currentMachine: 'M1',
    showAdminToast: mock(),
    db: {},
    dbRef_Store: {}
};

global.document = {
    getElementById: mock(),
    createElement: (tag) => ({ tagName: tag.toUpperCase(), style: {}, classList: { add: mock() } })
};

global.localStorage = {
    setItem: mock(),
    getItem: mock()
};

global.console.warn = mock();

mock.module("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js", () => ({
    ref: mock((db, path) => path),
    serverTimestamp: mock(() => ({})),
    goOnline: mock(() => ({})),
    goOffline: mock(() => ({})),
    push: mock(() => ({})),
    limitToLast: mock(() => ({})),
    query: mock(() => ({})),
    orderByChild: mock(() => ({})),
    update: mock(() => Promise.resolve())
}));



describe('Process Metrics Tests', () => {
    beforeEach(async () => {
        await import('./processMetrics.js?isolated=' + Math.random());
    });
    let mockModal;

    beforeEach(() => {
        mockModal = { style: {}, innerHTML: '' };
        global.document.getElementById.mockReset();
        global.document.getElementById.mockImplementation((id) => {
            if (id === 'processMetricsModal') return mockModal;
            return null;
        });
        window.sessionContext = {};
        window.config = { lanes: 4 };
        window.getConfig = () => window.config;
    });

    test('openProcessMetrics renders 4 lanes inputs', () => {
        window.openProcessMetrics();
        expect(mockModal.style.display).toBe('flex');
        expect(mockModal.innerHTML).not.toContain('pm-belt-speed');
        expect(mockModal.innerHTML).toContain('pm-process-yield');
        expect(mockModal.innerHTML).not.toContain('pm-bird-weight');
        expect(mockModal.innerHTML).toContain('pm-weight-s1s2');
        expect(mockModal.innerHTML).toContain('pm-weight-s3s4');
        expect(mockModal.innerHTML).toContain('pm-height-s1s2');
        expect(mockModal.innerHTML).toContain('pm-height-s3s4');
        expect(mockModal.innerHTML).not.toContain('pm-height-s1"'); // S1 alone shouldn't be there
    });

    test('openProcessMetrics renders 2 lanes inputs', () => {
        window.config.lanes = 2;
        window.openProcessMetrics();
        expect(mockModal.style.display).toBe('flex');
        expect(mockModal.innerHTML).not.toContain('pm-belt-speed');
        expect(mockModal.innerHTML).toContain('pm-process-yield');
        expect(mockModal.innerHTML).not.toContain('pm-bird-weight');
        expect(mockModal.innerHTML).toContain('pm-weight-s1"');
        expect(mockModal.innerHTML).toContain('pm-weight-s2"');
        expect(mockModal.innerHTML).toContain('pm-height-s1"');
        expect(mockModal.innerHTML).toContain('pm-height-s2"');
        expect(mockModal.innerHTML).not.toContain('pm-height-s1s2');
    });

    test('closeProcessMetrics hides modal', () => {
        mockModal.style.display = 'flex';
        window.closeProcessMetrics();
        expect(mockModal.style.display).toBe('none');
    });

    test('saveProcessMetrics updates state, localStorage, and firebase (4 lanes)', async () => {
        global.document.getElementById.mockImplementation((id) => {
            if (id === 'processMetricsModal') return mockModal;
            const values = {
                'pm-process-yield': '85.2',
                'pm-weight-s1s2': '4.1',
                'pm-weight-s3s4': '4.2',
                'pm-height-s1s2': '10',
                'pm-height-s3s4': '11'
            };
            return values[id] ? { value: values[id] } : null;
        });

        window.config.lanes = 4;

        const { update, ref } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        update.mockClear();

        window.saveProcessMetrics();

        expect(window.sessionContext.processYield).toBe(85.2);
        expect(window.sessionContext.weightS1S2).toBe(4.1);
        expect(window.sessionContext.weightS3S4).toBe(4.2);
        expect(window.sessionContext.heightS1S2).toBe(10);
        expect(window.sessionContext.heightS3S4).toBe(11);

        expect(localStorage.setItem).toHaveBeenCalledWith('dsi_session_context', JSON.stringify(window.sessionContext));

        expect(update).toHaveBeenCalled();
        expect(window.showAdminToast).toHaveBeenCalledWith('Process context saved.');
        expect(mockModal.style.display).toBe('none');
    });

    test('saveProcessMetrics updates state, localStorage, and firebase (2 lanes)', async () => {
        global.document.getElementById.mockImplementation((id) => {
            if (id === 'processMetricsModal') return mockModal;
            const values = {
                'pm-weight-s1': '4.3',
                'pm-weight-s2': '4.4',
                'pm-height-s1': '15',
                'pm-height-s2': '16'
            };
            return values[id] ? { value: values[id] } : null;
        });

        window.config.lanes = 2;

        const { update } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
        update.mockClear();

        window.saveProcessMetrics();

        expect(window.sessionContext.weightS1).toBe(4.3);
        expect(window.sessionContext.weightS2).toBe(4.4);
        expect(window.sessionContext.heightS1).toBe(15);
        expect(window.sessionContext.heightS2).toBe(16);
        expect(window.sessionContext.processYield).toBeNull(); // Was not set

        expect(localStorage.setItem).toHaveBeenCalledWith('dsi_session_context', JSON.stringify(window.sessionContext));
        expect(update).toHaveBeenCalled();
    });
});
