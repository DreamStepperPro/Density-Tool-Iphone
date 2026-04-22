import { ref, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

window.openProcessMetrics = function() {
    const modal = document.getElementById('processMetricsModal');
    if (!modal) return;

    const config = window.getConfig ? window.getConfig() : (window.config || { lanes: 4, currentMachine: 1 });
    const lanes = config.lanes || 4;
    const ctx = window.sessionContext['M' + (config.currentMachine || 1)] || {};

    let html = `
        <div class="modal-content" style="max-width: 500px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h2 style="margin:0;">Process Control Metrics</h2>
                <button aria-label="Close Modal" onclick="document.getElementById('processMetricsModal').style.display = 'none';" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">×</button>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <label for="pm-gross-yield">Gross Yield %</label>
                    <input type="number" id="pm-gross-yield" class="lane-input" value="${ctx.grossYield ?? ''}">
                </div>
                <div>
                    <label for="pm-product-yield">Product Yield %</label>
                    <input type="number" id="pm-product-yield" class="lane-input" value="${ctx.productYield ?? ''}">
                </div>
    `;

    if (lanes === 4) {
        html += `
                <div>
                    <label for="pm-weight-s1s2">Weight S1/S2</label>
                    <input type="number" id="pm-weight-s1s2" class="lane-input" value="${ctx.weightS1S2 ?? ''}">
                </div>
                <div>
                    <label for="pm-weight-s3s4">Weight S3/S4</label>
                    <input type="number" id="pm-weight-s3s4" class="lane-input" value="${ctx.weightS3S4 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s1s2">Height S1/S2</label>
                    <input type="number" id="pm-height-s1s2" class="lane-input" value="${ctx.heightS1S2 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s3s4">Height S3/S4</label>
                    <input type="number" id="pm-height-s3s4" class="lane-input" value="${ctx.heightS3S4 ?? ''}">
                </div>
        `;
    } else if (lanes === 2) {
        html += `
                <div>
                    <label for="pm-weight-s1">Weight S1</label>
                    <input type="number" id="pm-weight-s1" class="lane-input" value="${ctx.weightS1 ?? ''}">
                </div>
                <div>
                    <label for="pm-weight-s2">Weight S2</label>
                    <input type="number" id="pm-weight-s2" class="lane-input" value="${ctx.weightS2 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s1">Height S1</label>
                    <input type="number" id="pm-height-s1" class="lane-input" value="${ctx.heightS1 ?? ''}">
                </div>
                <div>
                    <label for="pm-height-s2">Height S2</label>
                    <input type="number" id="pm-height-s2" class="lane-input" value="${ctx.heightS2 ?? ''}">
                </div>
        `;
    }

    html += `
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; gap: 10px;">
                <button class="modal-btn" style="width:50%; background:var(--border); color:var(--text);" onclick="document.getElementById('processMetricsModal').style.display = 'none';">CANCEL</button>
                <button class="modal-btn" style="width:50%; background:var(--perfect);" onclick="window.saveProcessMetrics()">SAVE METRICS</button>
            </div>
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
    const grossYield = document.getElementById('pm-gross-yield')?.value;
    const productYield = document.getElementById('pm-product-yield')?.value;

    const data = {
        grossYield: grossYield ? parseFloat(grossYield) : null,
        productYield: productYield ? parseFloat(productYield) : null,
    };

    const config = window.getConfig ? window.getConfig() : (window.config || { lanes: 4, currentMachine: 1 });
    const lanes = config.lanes || 4;

    if (lanes === 4) {
        const wS1S2 = document.getElementById('pm-weight-s1s2')?.value;
        const wS3S4 = document.getElementById('pm-weight-s3s4')?.value;
        data.weightS1S2 = wS1S2 ? parseFloat(wS1S2) : null;
        data.weightS3S4 = wS3S4 ? parseFloat(wS3S4) : null;

        const hS1S2 = document.getElementById('pm-height-s1s2')?.value;
        const hS3S4 = document.getElementById('pm-height-s3s4')?.value;
        data.heightS1S2 = hS1S2 ? parseFloat(hS1S2) : null;
        data.heightS3S4 = hS3S4 ? parseFloat(hS3S4) : null;
    } else if (lanes === 2) {
        const wS1 = document.getElementById('pm-weight-s1')?.value;
        const wS2 = document.getElementById('pm-weight-s2')?.value;
        data.weightS1 = wS1 ? parseFloat(wS1) : null;
        data.weightS2 = wS2 ? parseFloat(wS2) : null;

        const hS1 = document.getElementById('pm-height-s1')?.value;
        const hS2 = document.getElementById('pm-height-s2')?.value;
        data.heightS1 = hS1 ? parseFloat(hS1) : null;
        data.heightS2 = hS2 ? parseFloat(hS2) : null;
    }

    const machineId = 'M' + (config.currentMachine || 1);
    if (!window.sessionContext[machineId]) {
        window.sessionContext[machineId] = {};
    }
    window.sessionContext[machineId] = { ...window.sessionContext[machineId], ...data };
    localStorage.setItem('dsi_session_context', JSON.stringify(window.sessionContext));

    if (window.dbRef_Store && window.db) {
        const ctxRef = ref(window.db, `stores/${machineId}/processContext`);
        update(ctxRef, data).catch(e => console.warn('Failed to push process context:', e));
    }

    if (typeof window.showAdminToast === 'function') {
        window.showAdminToast('Process context saved.');
    }

    window.closeProcessMetrics();
};
