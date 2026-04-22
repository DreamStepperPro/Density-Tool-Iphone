import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

window.openProcessMetrics = function() {
    const modal = document.getElementById('processMetricsModal');
    if (!modal) return;

    const config = window.getConfig ? window.getConfig() : (window.config || { lanes: 4 });
    const lanes = config.lanes || 4;

    let html = `
        <div class="modal-content" style="max-width: 500px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h2 style="margin:0;">Process Control Metrics</h2>
                <button aria-label="Close Modal" onclick="window.closeProcessMetrics()" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">×</button>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <label for="pm-belt-speed">Belt Speed</label>
                    <input type="number" id="pm-belt-speed" class="lane-input" value="${window.sessionContext.beltSpeed ?? ''}">
                </div>
                <div>
                    <label for="pm-process-yield">Process Yield %</label>
                    <input type="number" id="pm-process-yield" class="lane-input" value="${window.sessionContext.processYield ?? ''}">
                </div>
                <div>
                    <label for="pm-bird-weight">Bird Avg Weight</label>
                    <input type="number" id="pm-bird-weight" class="lane-input" value="${window.sessionContext.birdWeight ?? ''}">
                </div>
    `;

    if (lanes === 4) {
        html += `
                <div>
                    <label for="pm-height-s1s2">Height S1/S2</label>
                    <input type="number" id="pm-height-s1s2" class="lane-input" value="${window.sessionContext.heightS1S2 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s3s4">Height S3/S4</label>
                    <input type="number" id="pm-height-s3s4" class="lane-input" value="${window.sessionContext.heightS3S4 ?? ''}">
                </div>
        `;
    } else if (lanes === 2) {
        html += `
                <div>
                    <label for="pm-height-s1">Height S1</label>
                    <input type="number" id="pm-height-s1" class="lane-input" value="${window.sessionContext.heightS1 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s2">Height S2</label>
                    <input type="number" id="pm-height-s2" class="lane-input" value="${window.sessionContext.heightS2 ?? ''}">
                </div>
        `;
    }

    html += `
            </div>
            <button class="modal-btn" style="margin-top:20px; width:100%;" onclick="window.saveProcessMetrics()">SAVE</button>
        </div>
    `;

    modal.innerHTML = html;
    modal.style.display = 'flex';
};

window.closeProcessMetrics = function() {
    const modal = document.getElementById('processMetricsModal');
    if (modal) modal.style.display = 'none';
};

window.saveProcessMetrics = function() {
    const beltSpeed = document.getElementById('pm-belt-speed')?.value;
    const processYield = document.getElementById('pm-process-yield')?.value;
    const birdWeight = document.getElementById('pm-bird-weight')?.value;

    const data = {
        beltSpeed: beltSpeed ? parseFloat(beltSpeed) : null,
        processYield: processYield ? parseFloat(processYield) : null,
        birdWeight: birdWeight ? parseFloat(birdWeight) : null
    };

    const config = window.getConfig ? window.getConfig() : (window.config || { lanes: 4 });
    const lanes = config.lanes || 4;

    if (lanes === 4) {
        const hS1S2 = document.getElementById('pm-height-s1s2')?.value;
        const hS3S4 = document.getElementById('pm-height-s3s4')?.value;
        data.heightS1S2 = hS1S2 ? parseFloat(hS1S2) : null;
        data.heightS3S4 = hS3S4 ? parseFloat(hS3S4) : null;
    } else if (lanes === 2) {
        const hS1 = document.getElementById('pm-height-s1')?.value;
        const hS2 = document.getElementById('pm-height-s2')?.value;
        data.heightS1 = hS1 ? parseFloat(hS1) : null;
        data.heightS2 = hS2 ? parseFloat(hS2) : null;
    }

    // Clean nulls
        window.sessionContext = { ...window.sessionContext, ...data };
    localStorage.setItem('dsi_session_context', JSON.stringify(window.sessionContext));

    const machineId = window.currentMachine || 'M1'; // Fallback if undefined

    if (window.dbRef_Store && window.db) {
        const ctxRef = ref(window.db, `stores/${machineId}/processContext`);
        update(ctxRef, data).catch(e => console.warn('Failed to push process context:', e));
    }

    if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Process context saved.');
    }

    window.closeProcessMetrics();
};
