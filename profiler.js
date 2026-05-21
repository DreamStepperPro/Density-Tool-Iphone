
window.updateProfilerLanes = function() {
    const mode = document.getElementById('profilerConfig')?.value;
    const laneSelect = document.getElementById('profilerLaneSelect');
    if (!laneSelect) return;

    let html = '';
    if (mode === 'quad') {
        html += '<option value="1">Lane 1</option>';
        html += '<option value="2">Lane 2</option>';
        html += '<option value="3">Lane 3</option>';
        html += '<option value="4">Lane 4</option>';
    } else if (mode === 'dual') {
        html += '<option value="1_2">Lanes 1+2</option>';
        html += '<option value="3_4">Lanes 3+4</option>';
    }
    laneSelect.innerHTML = html;
};
import { escapeHTML } from './utils.js';

window.openProfiler = function() {
    const modal = document.getElementById('profilerModal');
    if (modal) modal.style.display = 'block';

    const lContainer = document.getElementById('lanesContainer');
    if (lContainer) lContainer.style.display = 'none';

    const hSection = document.querySelector('.history-section');
    if (hSection) hSection.style.display = 'none';

    const btn = document.getElementById('btnProfilerTab');
    if (btn) btn.classList.add('m-active');

    // Also deselect DSI buttons visually
    const mBtns = document.querySelectorAll('#machineNav .m-btn');
    mBtns.forEach(b => b.classList.remove('m-active'));

    window.updateProfilerLanes();
    window.renderProfilerGrid();
};

window.closeProfiler = function() {
    const modal = document.getElementById('profilerModal');
    if (modal) modal.style.display = 'none';

    // We can just rely on switchMachine to restore things, but if called directly:
    const lContainer = document.getElementById('lanesContainer');
    if (lContainer) lContainer.style.display = 'block';

    const hSection = document.querySelector('.history-section');
    if (hSection) hSection.style.display = 'block';

    const btn = document.getElementById('btnProfilerTab');
    if (btn) btn.classList.remove('m-active');

    // Restore active machine button
    window.renderInterface();
};

window.renderProfilerGrid = function() {
    const gridContainer = document.getElementById('profilerGrid');
    if (!gridContainer) return;

    let html = '';
    for (let i = 0; i < 10; i++) {
        html += `
            <div style="margin-bottom: 8px;">
                <label for="profilerInput${i}" style="display:block; font-size:0.8rem; color:var(--text);">Scan ${i + 1}</label>
                <input type="number" id="profilerInput${i}" placeholder="Scan..." style="width:100%; padding:8px; box-sizing:border-box; border-radius:4px; border:1px solid var(--border); background:var(--input-bg); color:var(--text);">
            </div>
        `;
    }
    gridContainer.innerHTML = html;
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    gridContainer.style.gap = '10px';

    for (let i = 0; i < 10; i++) {
        const input = document.getElementById(`profilerInput${i}`);
        if (input) {
            input.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const next = document.getElementById(`profilerInput${i + 1}`);
                    if (next) {
                        next.focus();
                    } else {
                        window.runDiagnostics();
                    }
                }
            };
        }
    }
};

function calculateStandardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(Math.max(0, variance));
}

window.runDiagnostics = function() {
    const values = [];
    for (let i = 0; i < 10; i++) {
        const el = document.getElementById('profilerInput' + i);
        if (el && el.value !== '') {
            values.push(parseFloat(el.value));
        }
    }

    const outputDiv = document.getElementById('profilerOutput');
    if (!outputDiv) return;

    if (values.length < 10) {
        outputDiv.innerHTML = "Please enter all 10 scans.";
        return;
    }

    const configSelect = document.getElementById('profilerConfig');
    const config = configSelect ? configSelect.value : '';

    const overallStd = calculateStandardDeviation(values);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    let isChaos = false;
    let isImbalance = false;

    const maxDiff = Math.max(...values.map(v => Math.abs(v - mean)));
    if (maxDiff > 10 && maxDiff > overallStd * 1.5) {
        isChaos = true;
    }

    // Do NOT split the array into two chunks of 5 using .slice(). Calculate the Standard Deviation across all 10 inputs uniformly.
    if (!isChaos && overallStd >= 5) {
        isImbalance = true;
    }

    let message = '';
    if (isChaos) {
        message = "🚨 Severe outlier detected. Note: Possible calibration issue or high variance in incoming product.";
    } else if (isImbalance) {
        message = "⚠️ Geometric Imbalance. Suggested Action: Swap waterjet routing path (e.g., 2,1 to 1,2) to re-center the spread.";
    } else {
        message = "✅ Geometric alignment stable. Continue adjusting density.";
    }

    let html = `<div>Overall STD: ${escapeHTML(overallStd.toFixed(2))}</div>`;
    html += `<hr style="margin: 10px 0; border: 1px solid var(--border);" />`;
    html += `<div>${escapeHTML(message)}</div>`;

    outputDiv.innerHTML = html;
};
