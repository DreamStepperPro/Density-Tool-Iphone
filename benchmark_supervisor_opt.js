global.window = {};
window.t = function(key) { return key; };
window.escapeHTML = function(str) { return str; };
window.extractWeights = function(entry) {
    let wts = [];
    entry.lanes.forEach(l => { let val = parseFloat(l.w); if (!isNaN(val)) wts.push(val); });
    return wts;
};
window.buildSupCard = function(title, dataObj, recentChecks, m) {
    const entry   = dataObj.entry;
    const target  = parseFloat(entry.target || 0);
    const opName  = entry.operator || 'Unknown';
    const isStale = (Date.now() - (entry.timestamp || 0)) > 180000;
    let lanesHtml = '';

    const precomputedLaneWeights = [];
    if (entry.lanes) {
        entry.lanes.forEach((_, idx) => precomputedLaneWeights[idx] = []);
        recentChecks.forEach(check => {
            if (check.lanes) {
                // To safely handle cases where check.lanes length might differ
                for (let idx = 0; idx < entry.lanes.length; idx++) {
                    if (check.lanes[idx]) {
                        let cw = parseFloat(check.lanes[idx].w);
                        if (!isNaN(cw)) precomputedLaneWeights[idx].push(cw);
                    }
                }
            }
        });
    }

    entry.lanes.forEach((l, idx) => {
        let weightVal = parseFloat(l.w), colorClass = '';
        let laneWeights = precomputedLaneWeights[idx] || [];

        let stabilityHtml = '';
        if (laneWeights.length > 1) {
            const lMean = laneWeights.reduce((a, b) => a + b, 0) / laneWeights.length;
            const lVar  = laneWeights.reduce((a, b) => a + Math.pow(b - lMean, 2), 0) / laneWeights.length;
            const lSd   = Math.sqrt(lVar);
            let score = Math.round(Math.max(0, 100 - (lSd * 15)));
            let sColor = 'var(--success)'; let sIcon = '🟢';
            if (score < 80 && score >= 60) { sColor = 'var(--warning)'; sIcon = '🟡'; }
            else if (score < 60) { sColor = 'var(--danger)'; sIcon = '🔴'; }
            stabilityHtml = `<div class="lane-stability" style="color:${sColor}">${sIcon} ${score}%</div>`;
        } else { stabilityHtml = `<div class="lane-stability" style="color:gray;">--%</div>`; }
        const absDiff = (!isNaN(weightVal) && target > 0 && !isStale) ? Math.abs(weightVal - target) : 0;
        if (absDiff > 0) {
            if (absDiff <= 0.5) colorClass = 'bg-perfect';
            else if (absDiff <= 2) colorClass = 'bg-success';
            else if (absDiff <= 3) colorClass = 'bg-warning';
            else colorClass = 'bg-danger';
        }
        const laneClickAttr = absDiff > 2.0
            ? `onclick="window.sendLaneWarning('M${m}', ${idx+1})" style="cursor:pointer;"`
            : '';
        lanesHtml += `<div class="sup-lane ${colorClass}" ${laneClickAttr}><span class="sup-lane-lbl">${window.t('lane')} ${idx+1}</span><span class="sup-lane-wt">${window.escapeHTML(l.w.toString())}</span><span class="sup-lane-dens">${window.escapeHTML(l.d.toString())}</span>${stabilityHtml}</div>`;
    });
    let trendHtml = `<div class="sup-trend"><span class="sup-trend-lbl">Trend:</span>`;
    for (let i = 0; i < Math.min(3, recentChecks.length); i++) {
        const check = recentChecks[i];
        const wts = window.extractWeights(check);
        if (wts.length === 0) { trendHtml += `<span class="trend-chip trend-empty">·</span>`; continue; }
        const mean = wts.reduce((a, b) => a + b, 0) / wts.length;
        const diff = Math.abs(mean - target);
        let cls, symbol;
        if (diff <= 0.5) { cls = 'trend-perfect'; symbol = '✓'; }
        else if (diff <= 2) { cls = 'trend-success'; symbol = '↑'; }
        else if (diff <= 3) { cls = 'trend-warning'; symbol = '~'; }
        else { cls = 'trend-danger'; symbol = '✗'; }
        trendHtml += `<span class="trend-chip ${cls}" title="Avg: ${mean.toFixed(1)}g">${symbol}</span>`;
    }
    for (let i = recentChecks.length; i < 3; i++) { trendHtml += `<span class="trend-chip trend-empty">·</span>`; }
    trendHtml += `<span style="font-size:0.62rem; opacity:0.5; margin-left:4px;">(newest → oldest)</span></div>`;
    return `
    <div class="sup-card ${isStale ? 'stale' : ''}">
        <div class="sup-header" style="align-items:center;">
            <div>
                <h2 class="sup-title">${title} <span style="font-size:0.8rem; color:gray; font-weight:normal;">• ${window.t(dataObj.product)}</span></h2>
                <div class="sup-meta" style="text-align:left;">${window.t('target')}: ${target}g<strong style="display:inline-block; margin-left:6px;">${entry.time}${isStale ? ' ⚠️' : ''}</strong></div>
            </div>
            <button class="btn-icon" style="border:none; font-size:1.3rem; height:40px; width:40px; background:rgba(128,128,128,0.1); flex-shrink:0;" onclick="window.openSupHistory(${m})" title="View Detailed Logs">📋</button>
        </div>
        <div class="sup-lanes-grid">${lanesHtml}</div>
        ${trendHtml}
    </div>`;
};

const entry = {
    target: 10,
    operator: 'TestOp',
    timestamp: Date.now(),
    time: '12:00',
    lanes: Array.from({length: 8}).map((_, i) => ({w: Math.random() * 20, d: 5}))
};

const recentChecks = Array.from({length: 1000}).map((_, i) => ({
    lanes: Array.from({length: 8}).map((_, j) => ({w: Math.random() * 20, d: 5}))
}));

const dataObj = {
    entry: entry,
    product: 'TestProd'
};

const start = performance.now();
for (let i = 0; i < 1000; i++) {
    window.buildSupCard('Test Title', dataObj, recentChecks, 1);
}
const end = performance.now();

console.log(`Optimized Time taken: ${(end - start).toFixed(2)} ms`);
