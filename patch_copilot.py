import re

with open('app.js', 'r') as f:
    content = f.read()

copilot_fn = """
window.generateCopilotActions = function() {
    const queue = document.getElementById('copilotQueue');
    if (!queue) return;

    if (!config.copilotEnabled || !isAdmin) {
        queue.style.display = 'none';
        queue.innerHTML = '';
        return;
    }

    if (!store || !store.lanes || isNaN(store.target)) {
        queue.style.display = 'none';
        queue.innerHTML = '';
        return;
    }

    let hasActions = false;
    let html = '';
    const target = parseFloat(store.target);
    const baseK = FACTORS[config.product] || 0.01;

    // Check downtime for current machine
    let downComponents = 0;
    if (typeof window.getCurrentActiveDowntimes === 'function') {
        const activeDowntimes = window.getCurrentActiveDowntimes();
        for (const [id, fault] of Object.entries(activeDowntimes)) {
            if (id.startsWith('c') && parseInt(id.substring(1)) >= 1 && parseInt(id.substring(1)) <= 8) {
                downComponents++;
            }
        }
    }

    store.lanes.forEach((lane, idx) => {
        const i = idx + 1;
        if (lane.disabled) return;

        const currD = parseFloat(lane.d);
        const currW = parseFloat(lane.w);

        if (isNaN(currD) || isNaN(currW)) return;

        const drift = currW - target;
        if (Math.abs(drift) > 1.5) {
            let activeK = baseK;

            // Check history for dynamic K factor
            if (history && history.length > 0) {
                for (let h = 0; h < history.length; h++) {
                    const lData = history[h].lanes && history[h].lanes[i-1] ? history[h].lanes[i-1] : null;
                    if (lData && lData.w && lData.w !== '--' && lData.d && lData.d !== '--') {
                        const histW = parseFloat(lData.w);
                        const histD = parseFloat(lData.d);
                        if (!isNaN(histW) && !isNaN(histD)) {
                            let wDelta = currW - histW;
                            let dDelta = currD - histD;
                            if (Math.abs(wDelta) > 0.5 && Math.abs(dDelta) > 0.001) {
                                let observedK = dDelta / wDelta;
                                observedK = Math.max(baseK * 0.5, Math.min(observedK, baseK * 3.5));
                                activeK = (observedK * 0.6) + (baseK * 0.4);
                                break;
                            }
                        }
                    }
                }
            }

            // Buffer math if cutters are down (e.g. reduce change severity by 10% per down cutter)
            if (downComponents > 0) {
                const buffer = 1.0 - Math.min(downComponents * 0.1, 0.5);
                activeK = activeK * buffer;
            }

            const rawNewD = currD - (drift * activeK);
            let suggestedD = rawNewD.toFixed(3);
            if (suggestedD === currD.toFixed(3)) {
                suggestedD = (currD + (drift > 0 ? -0.001 : 0.001)).toFixed(3);
            }

            hasActions = true;
            html += `
                <div class="copilot-card" style="background:var(--card-bg); border:2px solid var(--accent); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; font-size:0.9rem; color:var(--accent);">AI COPILOT</div>
                        <div style="font-size:1.1rem;">LANE ${i}: ADJUST DENSITY TO <strong>${suggestedD}</strong></div>
                    </div>
                    <button class="modal-btn" style="width:auto; padding:8px 16px; margin:0;" onclick="window.applyCopilotAction(${i}, '${suggestedD}')">APPLY</button>
                </div>
            `;
        }
    });

    if (hasActions) {
        queue.innerHTML = html;
        queue.style.display = 'flex';
    } else {
        queue.innerHTML = '';
        queue.style.display = 'none';
    }
};

window.applyCopilotAction = function(idx, suggestedDensity) {
    if (!store.lanes || !store.lanes[idx-1]) return;

    // Save current to history before applying
    window.saveToHistory();

    const lane = store.lanes[idx-1];
    lane.lastD = parseFloat(lane.d);
    lane.lastW = parseFloat(lane.w);

    lane.d = suggestedDensity;
    lane.w = ''; // Clear operator's weight
    lane.locked = true;

    document.getElementById(`avgWt-${idx}`).value = '';

    // UI Flash
    const card = document.getElementById(`card-${idx}`);
    if (card) {
        card.classList.add('apply-flash');
        setTimeout(() => card.classList.remove('apply-flash'), 300);
    }

    if (navigator.vibrate) navigator.vibrate([60]);

    window.calculateLocal();
    window.pushLaneToCloud(idx);
};
"""

content += "\n" + copilot_fn

with open('app.js', 'w') as f:
    f.write(content)
