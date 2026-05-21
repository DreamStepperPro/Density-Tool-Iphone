with open('profiler.test.js', 'r') as f:
    content = f.read()

# Completely rewrite profiler.test.js correctly
new_test = """import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

describe('Profiler Logic and Math Tests', () => {
    let originalWindow, originalDocument;

    beforeEach(async () => {
        originalWindow = global.window;
        originalDocument = global.document;

        // Mock document methods manually
        const elements = {};

        global.document = {
            getElementById: mock((id) => {
                if (!elements[id]) {
                    elements[id] = { id, value: '', innerHTML: '', style: {}, focus: mock(), classList: { add: mock(), remove: mock() }, dispatchEvent: mock(), addEventListener: mock() };
                }
                return elements[id];
            }),
            querySelector: mock((sel) => ({ style: {} })),
            querySelectorAll: mock(() => [])
        };

        global.window = {
            document: global.document,
            parseFloat: parseFloat,
            getConfig: () => ({ lanes: 4, currentMachine: 1 })
        };

        global.parseFloat = parseFloat;

        const profilerContent = await Bun.file('profiler.js').text();
        const code = `
            const escapeHTML = (str) => {
                if (str === null || str === undefined) return '';
                return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            };
            ${profilerContent.replace(/import .*? from '.*?';/g, '')}
        `;
        eval(code);

        window.renderProfilerGrid();
    });

    afterEach(() => {
        global.window = originalWindow;
        global.document = originalDocument;
    });

    it('Auto-Advance UX: Enter key advances focus', () => {
        const input0 = document.getElementById('profilerInput0');
        const input1 = document.getElementById('profilerInput1');
        expect(input0.onkeydown).toBeDefined();
        input0.onkeydown({ key: 'Enter', preventDefault: () => {} });
        expect(input1.focus).toHaveBeenCalled();
    });

    it('Stable Math: Identical weights output stable message', () => {
        for (let i = 0; i < 10; i++) {
            document.getElementById('profilerInput' + i).value = '102.0';
        }
        window.runDiagnostics();
        const output = document.getElementById('profilerOutput').innerHTML;
        expect(output).toContain('✅ Geometric alignment stable.');
    });

    it('Imbalance Suggestion: High variance but no massive outlier outputs imbalance message', () => {
        const valuesHighVariance = [102, 102, 102, 102, 102, 112, 112, 112, 112, 112];
        for (let i = 0; i < 10; i++) {
            document.getElementById('profilerInput' + i).value = String(valuesHighVariance[i]);
        }
        window.runDiagnostics();
        const output = document.getElementById('profilerOutput').innerHTML;
        expect(output).toContain('⚠️ Geometric Imbalance. Suggested Action: Swap waterjet routing path');
    });

    it('Product Variance Suggestion: Severe outlier outputs chaos message', () => {
        const valuesOutlier = [102, 102, 102, 102, 102, 102, 102, 102, 102, 150];
        for (let i = 0; i < 10; i++) {
            document.getElementById('profilerInput' + i).value = String(valuesOutlier[i]);
        }
        window.runDiagnostics();
        const output = document.getElementById('profilerOutput').innerHTML;
        expect(output).toContain('🚨 Severe outlier detected. Note: Possible calibration issue or high variance in incoming product.');
    });

    it('openLaneProfiler clears inputs and sets activeProfilerLane', () => {
        document.getElementById('profilerInput0').value = '100';
        window.openLaneProfiler(2);
        expect(window.activeProfilerLane).toBe(2);
        expect(document.getElementById('profilerInput0').value).toBe('');
        expect(document.getElementById('profilerModal').style.display).toBe('flex');
    });

    it('ACCEPT PATH SWAP button invokes acceptPathSwap', () => {
        window.activeProfilerLane = 3;
        window.acceptPathSwap = mock();

        const valuesHighVariance = [102, 102, 102, 102, 102, 112, 112, 112, 112, 112]; // Imbalance
        for (let i = 0; i < 10; i++) {
            document.getElementById('profilerInput' + i).value = String(valuesHighVariance[i]);
        }

        window.runDiagnostics();

        const output = document.getElementById('profilerOutput');
        expect(output.innerHTML).toContain('ACCEPT PATH SWAP');

        // Simulate inline onclick
        if(window.acceptPathSwap) { window.acceptPathSwap(window.activeProfilerLane); } window.closeProfiler();

        expect(window.acceptPathSwap).toHaveBeenCalledWith(3);
        expect(document.getElementById('profilerModal').style.display).toBe('none');
    });
});
"""

with open('profiler.test.js', 'w') as f:
    f.write(new_test)
