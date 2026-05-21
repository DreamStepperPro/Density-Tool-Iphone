with open('profiler.js', 'r') as f:
    content = f.read()

import re

# In profiler.js, runDiagnostics needs to output the [ ACCEPT PATH SWAP ] button when `isImbalance` is true.

old_msg_block = """    let message = '';
    if (isChaos) {
        message = "🚨 Severe outlier detected. Note: Possible calibration issue or high variance in incoming product.";
    } else if (isImbalance) {
        message = "⚠️ Geometric Imbalance. Suggested Action: Swap waterjet routing path (e.g., 2,1 to 1,2) to re-center the spread.";
    } else {
        message = "✅ Geometric alignment stable. Continue adjusting density.";
    }

    let html = `<div>Overall STD: ${escapeHTML(overallStd.toFixed(2))}</div>`;
    if (config === 'paired') {
        html += `<div>Lane 1 STD: ${escapeHTML(std1.toFixed(2))} | Lane 2 STD: ${escapeHTML(std2.toFixed(2))}</div>`;
    }
    html += `<hr style="margin: 10px 0; border: 1px solid var(--border);" />`;
    html += `<div>${escapeHTML(message)}</div>`;"""

new_msg_block = """    let message = '';
    let btnHtml = '';
    if (isChaos) {
        message = "🚨 Severe outlier detected. Note: Possible calibration issue or high variance in incoming product.";
    } else if (isImbalance) {
        message = "⚠️ Geometric Imbalance. Suggested Action: Swap waterjet routing path (e.g., 2,1 to 1,2) to re-center the spread.";
        btnHtml = `<button class="modal-btn secondary" style="margin-top:10px;" onclick="if(window.acceptPathSwap) { window.acceptPathSwap(window.activeProfilerLane); } window.closeProfiler();">ACCEPT PATH SWAP</button>`;
    } else {
        message = "✅ Geometric alignment stable. Continue adjusting density.";
    }

    let html = `<div>Overall STD: ${escapeHTML(overallStd.toFixed(2))}</div>`;
    if (config === 'paired') {
        html += `<div>Lane 1 STD: ${escapeHTML(std1.toFixed(2))} | Lane 2 STD: ${escapeHTML(std2.toFixed(2))}</div>`;
    }
    html += `<hr style="margin: 10px 0; border: 1px solid var(--border);" />`;
    html += `<div>${escapeHTML(message)}</div>`;
    html += btnHtml;"""

content = content.replace(old_msg_block, new_msg_block)

with open('profiler.js', 'w') as f:
    f.write(content)
