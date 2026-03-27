// =====================================================================
// SUPERVISOR.JS — Supervisor Dashboard + Deep Dive Ledger
// Handles OEE cards, shift ledger, maintenance history.
// All data flows in via Firebase listeners started in startSupervisorSync.
// =====================================================================

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase(getApp());

// Module-level state — private to this file
let unsubSupHistories = null;
let unsubSupLedger    = null;
let unsubMaintLogs    = null;
let cachedHistories   = null;
let cachedShiftLedger = null;
let cachedMaintLogs   = [];

// Expose read-only getters for other modules (e.g. applyTranslations needs cachedHistories)
window.getCachedHistories  = () => cachedHistories;
window.getCachedShiftLedger = () => cachedShiftLedger;

window.startSupervisorSync = function() {
    if (!db) { setTimeout(window.startSupervisorSync, 500); return; }
    if (unsubSupHistories) unsubSupHistories();
    unsubSupHistories = onValue(ref(db, 'histories'), (snap) => {
        window.renderSupervisorDashboard(snap.val() || {});
    });
    if (unsubSupLedger) { unsubSupLedger(); unsubSupLedger = null; }
    unsubSupLedger = onValue(ref(db, 'shiftLedger'), (snap) => {
        cachedShiftLedger = snap.val() || {};
    });
    if (unsubMaintLogs) { unsubMaintLogs(); unsubMaintLogs = null; }
    unsubMaintLogs = onValue(ref(db, 'downtimeLogs'), (snap) => {
        const data = snap.val();
        cachedMaintLogs = data ? Object.values(data).sort((a, b) => b.endTime - a.endTime) : [];
        if (document.getElementById('maintHistoryModal').style.display === 'flex') {
            window.renderMaintHistory();
        }
    });
};

window.renderSupervisorDashboard = function(allHistories) {
    cachedHistories = allHistories;
    const container = document.getElementById('supCardsContainer');
    container.innerHTML = '';
    let allWeightsGlobal = [];
    const cfg = window.getConfig();
    for (let m = 1; m <= cfg.machines; m++) {
        const machHistories = allHistories[`M${m}`];
        const latest        = window.getAbsoluteLatest(machHistories);
        const recentChecks  = window.getRecentChecks(machHistories, 5);
        if (latest) {
            container.innerHTML += window.buildSupCard(`DSI ${m}`, latest, recentChecks, m);
            allWeightsGlobal = allWeightsGlobal.concat(window.extractWeights(latest.entry));
        } else {
            container.innerHTML += `<div class="sup-card"><h3 style="color:gray;">DSI ${m}: No Data</h3></div>`;
        }
    }
    if (allWeightsGlobal.length > 0) {
        const mean = allWeightsGlobal.reduce((a, b) => a + b, 0) / allWeightsGlobal.length;
        document.getElementById('machAvg').innerText = mean.toFixed(1);
        if (allWeightsGlobal.length > 1) {
            const v = allWeightsGlobal.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allWeightsGlobal.length;
            document.getElementById('stdDev').innerText = Math.sqrt(v).toFixed(2);
        } else { document.getElementById('stdDev').innerText = "--"; }
    } else { document.getElementById('machAvg').innerText = "--"; document.getElementById('stdDev').innerText = "--"; }
};

window.getAbsoluteLatest = function(machineHistories) {
    if (!machineHistories) return null;
    let latestEntry = null, activeProduct = '';
    for (let prodKey in machineHistories) {
        let entries = Array.isArray(machineHistories[prodKey]) ? machineHistories[prodKey] : Object.values(machineHistories[prodKey]);
        if (entries && entries.length > 0) {
            let entry = entries[0];
            if (!latestEntry || (entry.timestamp || 0) > (latestEntry.timestamp || 0)) { latestEntry = entry; activeProduct = prodKey.includes('lunch') ? 'lunch' : 'bfast'; }
        }
    }
    return latestEntry ? { entry: latestEntry, product: activeProduct } : null;
};

window.getRecentChecks = function(machineHistories, n) {
    if (!machineHistories) return [];
    let all = [];
    for (let prodKey in machineHistories) {
        let entries = Array.isArray(machineHistories[prodKey]) ? machineHistories[prodKey] : Object.values(machineHistories[prodKey]);
        entries.forEach(e => all.push(e));
    }
    return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, n);
};

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
    entry.lanes.forEach((l, idx) => {
        let weightVal = parseFloat(l.w), colorClass = '';
        let laneWeights = [];
        recentChecks.forEach(check => {
            if (check.lanes && check.lanes[idx]) {
                let cw = parseFloat(check.lanes[idx].w);
                if (!isNaN(cw)) laneWeights.push(cw);
            }
        });
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
        lanesHtml += `<div class="sup-lane ${colorClass}" ${laneClickAttr}><span class="sup-lane-lbl">${window.t('lane')} ${idx+1}</span><span class="sup-lane-wt">${l.w}</span><span class="sup-lane-dens">${l.d}</span>${stabilityHtml}</div>`;
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
        <div class="sup-operator">👤 ${opName}</div>
        <div class="sup-grid">${lanesHtml}</div>
        ${trendHtml}
    </div>`;
};

// ---- Deep Dive Ledger ----

window.openSupHistory = function(machineNum) {
    document.getElementById('supHistoryTitle').innerText = `📋 DSI ${machineNum} Ledger`;
    const container = document.getElementById('supHistoryList');
    const machKey   = `M${machineNum}`;
    let allChecks   = [];
    if (cachedShiftLedger && cachedShiftLedger[machKey]) {
        allChecks = allChecks.concat(Object.values(cachedShiftLedger[machKey]).filter(e => e));
    }
    if (cachedHistories && cachedHistories[machKey]) {
        for (let prodKey in cachedHistories[machKey]) {
            let entries = Array.isArray(cachedHistories[machKey][prodKey])
                ? cachedHistories[machKey][prodKey]
                : Object.values(cachedHistories[machKey][prodKey]);
            allChecks = allChecks.concat(entries.filter(e => e));
        }
    }
    if (allChecks.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px;">No shift history found.</div>';
        document.getElementById('supHistoryModal').style.display = 'flex';
        return;
    }
    const seen = new Set();
    allChecks = allChecks.filter(c => {
        if (!c || !c.timestamp) return false;
        const key = `${c.timestamp}_${c.operator || ''}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });
    allChecks.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const groupedByDate = {};
    allChecks.forEach(r => {
        const d = new Date(r.timestamp || 0);
        const prodDate = new Date(d.getTime());
        if (d.getHours() >= 23) prodDate.setDate(prodDate.getDate() + 1);
        const dateStr = prodDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (!groupedByDate[dateStr]) groupedByDate[dateStr] = { checks: [], sortKey: prodDate.getTime() };
        groupedByDate[dateStr].checks.push(r);
    });
    const sortedDates = Object.entries(groupedByDate).sort((a, b) => b[1].sortKey - a[1].sortKey);
    let html = '';
    sortedDates.forEach(([dateStr, group], folderIdx) => {
        const cardsHtml = group.checks.map(r => {
            if (r.isMarker) {
                let color = 'var(--perfect)', bg = 'rgba(0,198,240,0.1)';
                if (r.isFail) { color = 'var(--danger)'; bg = 'rgba(255,77,77,0.1)'; }
                if (r.text.includes('SHIFT ENDED')) { color = 'var(--text)'; bg = 'rgba(128,128,128,0.1)'; }
                const photoHtml = r.photoRef
                    ? `<img data-photoref="${r.photoRef}" style="width:100%; max-height:200px; object-fit:cover; border-radius:6px; margin-top:10px; border:1px solid rgba(0,0,0,0.2); cursor:pointer;" onclick="window.loadAndViewPhoto(this)">`
                    : '';
                return `<div style="background:${bg}; border:1px solid ${color}; border-radius:8px; padding:12px; text-align:center; font-weight:bold; font-size:0.85rem; margin-bottom:8px; color:${color}; flex-shrink:0; box-shadow:var(--shadow);">${r.text} • ${r.time}${photoHtml}</div>`;
            }
            const laneGrid = r.lanes.map((l, li) => `
                <div class="hist-lane-cell">
                    <span class="hist-lane-lbl">L${li+1}</span>
                    <span class="hist-lane-wt">${l.w}</span>
                    <span class="hist-lane-dens">${l.d}</span>
                </div>`).join('');
            return `
            <div class="hist-card expanded" style="margin-bottom:8px; flex-shrink:0;">
                <div class="hist-card-header" style="cursor:default;">
                    <div>
                        <span class="hist-card-time">${r.time}</span>
                        ${r.operator ? `<span style="font-size:0.72rem; opacity:0.6; margin-left:8px;">by ${r.operator}</span>` : ''}
                    </div>
                    <span class="hist-card-avg">Avg: <strong>${r.avg}g</strong></span>
                </div>
                <div class="hist-card-body" style="display:block;">
                    <div style="font-size:0.72rem; opacity:0.55; margin-bottom:4px;">${window.t('target')}: ${r.target || '--'}g</div>
                    <div class="hist-lane-grid">${laneGrid}</div>
                </div>
            </div>`;
        }).join('');
        html += `
        <details class="shift-folder" ${folderIdx === 0 ? 'open' : ''}>
            <summary class="shift-folder-header">
                <span>📅 ${dateStr}</span>
                <span style="font-weight:normal; font-size:0.8rem; opacity:0.6;">${group.checks.length} logs ▾</span>
            </summary>
            <div class="shift-folder-content">${cardsHtml}</div>
        </details>`;
    });
    container.innerHTML = html;
    document.getElementById('supHistoryModal').style.display = 'flex';
};

window.closeSupHistory = function() { document.getElementById('supHistoryModal').style.display = 'none'; };

// ---- Maintenance History (RCA Ledger) ----

window.openMaintHistory = function() {
    document.getElementById('maintenanceModal').style.display = 'none';
    document.getElementById('maintHistoryModal').style.display = 'flex';
    window.renderMaintHistory();
};

window.closeMaintHistory = function() {
    document.getElementById('maintHistoryModal').style.display = 'none';
    document.getElementById('maintenanceModal').style.display = 'flex';
};

window.renderMaintHistory = function() {
    const container  = document.getElementById('maintHistoryList');
    const summaryBox = document.getElementById('maintSummaryBox');
    if (!container) return;
    if (!cachedMaintLogs || cachedMaintLogs.length === 0) {
        container.innerHTML = `<div style="text-align:center; opacity:0.5; padding:20px; font-size:0.85rem;">${window.t('noLogs')}</div>`;
        if (summaryBox) summaryBox.style.display = 'none';
        return;
    }
    // OEE 24-hour summary — totals by severity and hardware category
    const now = Date.now();
    let totalDown = 0, totalDegraded = 0;
    const sums = { cutters: { d:0, w:0 }, belts: { d:0, w:0 }, sys: { d:0, w:0 } };
    const recentLogs = cachedMaintLogs.filter(log => (now - log.endTime) < 86400000);
    recentLogs.forEach(log => {
        const dur    = log.durationMins || 0;
        const isDown = log.severity === 'down';
        if (isDown) totalDown += dur; else totalDegraded += dur;
        // Category detection uses the stored component ID/key, not the translated name
        const comp = (log.component || '').toLowerCase();
        let cat = 'sys';
        if (comp.startsWith('c') && comp !== 'comp_sys') cat = 'cutters'; // c1–c8
        else if (comp.startsWith('b') || comp.includes('bin') || comp.includes('bout') || comp.includes('bnug') || comp.includes('bfil')) cat = 'belts';
        if (isDown) sums[cat].d += dur; else sums[cat].w += dur;
    });
    if (summaryBox) {
        summaryBox.style.display = 'block';
        summaryBox.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; gap:8px;">
                <div style="background:rgba(255,77,77,0.1); border:1px solid var(--danger); padding:10px; border-radius:8px; flex:1; text-align:center; box-shadow:var(--shadow);">
                    <div style="font-size:0.65rem; color:var(--danger); font-weight:bold; text-transform:uppercase;">Total Hard Down (24h)</div>
                    <div style="font-size:1.5rem; font-weight:900; color:var(--text); margin-top:2px;">${totalDown} <span style="font-size:0.75rem; font-weight:normal; opacity:0.7;">min</span></div>
                </div>
                <div style="background:rgba(255,193,7,0.15); border:1px solid var(--warning); padding:10px; border-radius:8px; flex:1; text-align:center; box-shadow:var(--shadow);">
                    <div style="font-size:0.65rem; color:#c98f00; font-weight:bold; text-transform:uppercase;">Total Degraded (24h)</div>
                    <div style="font-size:1.5rem; font-weight:900; color:var(--text); margin-top:2px;">${totalDegraded} <span style="font-size:0.75rem; font-weight:normal; opacity:0.7;">min</span></div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; padding:10px 5px; border:1px solid var(--border); background:rgba(128,128,128,0.03); border-radius:8px;">
                <div style="flex:1; text-align:center;"><strong>Cutters</strong><br><span style="color:var(--danger)">${sums.cutters.d}m down</span><br><span style="color:#c98f00">${sums.cutters.w}m deg</span></div>
                <div style="flex:1; text-align:center; border-left:1px solid var(--border); border-right:1px solid var(--border);"><strong>Belts</strong><br><span style="color:var(--danger)">${sums.belts.d}m down</span><br><span style="color:#c98f00">${sums.belts.w}m deg</span></div>
                <div style="flex:1; text-align:center;"><strong>System</strong><br><span style="color:var(--danger)">${sums.sys.d}m down</span><br><span style="color:#c98f00">${sums.sys.w}m deg</span></div>
            </div>`;
    }
    container.innerHTML = cachedMaintLogs.map(log => `
        <div class="maint-log-card">
            <div class="maint-log-header">
                <span>${log.timeStr} • ${log.machine}</span>
                <span>Logged by ${log.loggedBy}</span>
            </div>
            <div class="maint-log-body">
                <div class="maint-log-fault">
                    <span class="maint-log-comp">${window.t(log.component) || log.component}</span>
                    <span class="maint-log-reason">⚠️ ${window.t(log.reason) || log.reason}</span>
                </div>
                <div class="maint-log-duration">
                    ${log.durationMins}<span style="font-size:0.8rem; font-weight:normal; opacity:0.7;">m</span>
                </div>
            </div>
            ${log.notes ? `<div class="maint-log-notes">"${log.notes}"</div>` : ''}
            <div style="font-size:0.7rem; opacity:0.5; margin-top:8px; text-align:right;">
                Repaired by ${log.clearedBy}
            </div>
        </div>`).join('');
};
