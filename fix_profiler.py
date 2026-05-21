import re

with open('profiler.js', 'r') as f:
    content = f.read()

open_replacement = """window.activeProfilerLane = 1;

window.openLaneProfiler = function(laneIndex) {
    window.activeProfilerLane = laneIndex;
    const modal = document.getElementById('profilerModal');
    if (!modal) return;

    // Wipe 10 inputs clean
    for (let i = 0; i < 10; i++) {
        const el = document.getElementById('profilerInput' + i);
        if (el) el.value = '';
    }

    const outputDiv = document.getElementById('profilerOutput');
    if (outputDiv) outputDiv.innerHTML = '';

    // Configure dropdown based on lane count
    const toggleContainer = document.getElementById('profilerToggleContainer');
    const configSelect = document.getElementById('profilerConfig');

    if (window.getConfig && window.getConfig().lanes === 4) {
        if (toggleContainer) toggleContainer.style.display = 'flex';
        if (configSelect) configSelect.value = 'single';
    } else {
        if (toggleContainer) toggleContainer.style.display = 'none';
        if (configSelect) configSelect.value = 'single';
    }

    modal.style.display = 'flex';
    window.renderProfilerGrid();
};

window.closeProfiler = function() {
    const modal = document.getElementById('profilerModal');
    if (modal) modal.style.display = 'none';

    for (let i = 0; i < 10; i++) {
        const el = document.getElementById('profilerInput' + i);
        if (el) el.value = '';
    }
};"""

content = re.sub(r'window\.openProfiler = function\(\) \{[\s\S]*?window\.closeProfiler = function\(\) \{[\s\S]*?\};', open_replacement, content)

with open('profiler.js', 'w') as f:
    f.write(content)
