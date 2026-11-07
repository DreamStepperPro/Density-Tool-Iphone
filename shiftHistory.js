import { ref, set, onValue, update, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { escapeHTML } from "./utils.js";
import { getCloudMachine, getModeKey } from "./machineSettings.js";

// =====================================================================
// SHIFT HISTORY & GLOBAL END-SHIFT ENGINE (shiftHistory.js)
// =====================================================================

let autoSaveTimer = null;
let lastAutoSaveCombo = "";
let localSessionStartTime = Date.now();
let unsubGlobalReset = null;

function getDb() {
    return typeof window !== 'undefined' ? window.db : undefined;
}

function getConfig() {
    return (typeof window !== 'undefined' && typeof window.getConfig === 'function' ? window.getConfig() : window?.config) || {};
}

function getStore() {
    return (typeof window !== 'undefined' && typeof window.getStore === 'function' ? window.getStore() : window?.store) || {};
}

function getHistoryList() {
    return (typeof window !== 'undefined' && typeof window.getHistory === 'function' ? window.getHistory() : window?.history) || [];
}

function setHistoryList(nextHistory) {
    if (typeof window !== 'undefined') {
        if (typeof window.setHistory === 'function') {
            window.setHistory(nextHistory);
        } else {
            window.history = nextHistory;
        }
    }
}

function getDbRefStore() {
    return typeof window !== 'undefined' && typeof window.getDbRefStore === 'function' ? window.getDbRefStore() : null;
}

function getDbRefHistory() {
    return typeof window !== 'undefined' && typeof window.getDbRefHistory === 'function' ? window.getDbRefHistory() : null;
}

function getCurrentShiftStartTime() {
    const now = new Date();
    const shift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0);
    if (now.getHours() < 22) {
        shift.setDate(shift.getDate() - 1);
    }
    return shift.getTime();
}

function resetAutoSaveState() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
    lastAutoSaveCombo = "";
}

function renderHistoryCards() {
    const container = document.getElementById('historyCards');
    const history = getHistoryList();
    if (!history || history.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px; font-size:0.85rem;">--</div>';
        return;
    }
    const arr = Array.isArray(history) ? history : Object.values(history);
    container.innerHTML = arr.map((r, idx) => {
        if (r.isMarker || !Array.isArray(r.lanes)) {
            return `
            <div class="hist-card marker-card" id="hcard-${idx}" style="padding:10px 13px; font-weight:bold; font-size:0.85rem; background:var(--input-bg); border-left:4px solid var(--accent); display:flex; justify-space-between; align-items:center;">
                <span>${escapeHTML(r.text || r.action || 'Event Log')}</span>
                <span style="font-size:0.75rem; opacity:0.6;">${escapeHTML(r.time || '')}</span>
            </div>`;
        }
        const laneGrid = r.lanes.map((l, li) => `
            <div class="hist-lane-cell">
                <span class="hist-lane-lbl">L${li+1}</span>
                <span class="hist-lane-wt">${escapeHTML(l.w)}</span>
                <span class="hist-lane-dens">${escapeHTML(l.d)}</span>
            </div>`).join('');
        const avgDisp = String(r.avg || '--').endsWith('g') || r.avg === '--' ? String(r.avg || '--') : `${r.avg}g`;
        const tgtDisp = String(r.target || '--').endsWith('g') || r.target === '--' ? String(r.target || '--') : `${r.target}g`;
        return `
        <div class="hist-card" id="hcard-${idx}">
            <div class="hist-card-header" role="button" tabindex="0" aria-label="Toggle history details for entry ${idx}" onclick="window.toggleHistCard(${idx})" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); window.toggleHistCard(${idx}); }">
                <div>
                    <span class="hist-card-time">${escapeHTML(r.time)}</span>
                    ${r.operator ? `<span style="font-size:0.72rem; opacity:0.6; margin-left:8px;">by ${escapeHTML(r.operator)}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn-icon" style="color:var(--danger); font-size:1rem; padding:0 5px; margin-right:8px;" onclick="event.stopPropagation(); window.deleteHistoryEntry(${idx})" aria-label="Delete history entry ${idx}" title="Delete Entry">🗑️</button>
                    <span class="hist-card-avg">Avg: <strong>${escapeHTML(avgDisp)}</strong></span>
                    <span class="hist-card-chevron">▼</span>
                </div>
            </div>
            <div class="hist-card-body">
                <div style="font-size:0.72rem; opacity:0.55; margin-bottom:4px;">${window.t('target')}: ${escapeHTML(tgtDisp)}</div>
                <div class="hist-lane-grid">${laneGrid}</div>
            </div>
        </div>`;
    }).join('');
}

function toggleHistCard(idx) {
    document.getElementById(`hcard-${idx}`).classList.toggle('expanded');
}

function checkAutoSave() {
    const config = getConfig();
    const store = getStore();
    let currentCombo = "", allFilled = true;
    for (let i = 1; i <= config.lanes; i++) {
        if (store.lanes && store.lanes[i-1] && store.lanes[i-1].disabled) continue;
        const w = document.getElementById(`avgWt-${i}`).value;
        if (!w) { allFilled = false; break; }
        currentCombo += w + ",";
    }
    if (allFilled && currentCombo !== lastAutoSaveCombo) {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            lastAutoSaveCombo = currentCombo;
            window.saveToHistory();
            autoSaveTimer = null;
        }, 2500);
    }
}

function saveToHistory() {
    const config    = getConfig();
    const store     = getStore();
    const db        = getDb();
    const time      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const timestamp = Math.trunc(Date.now());

    const p = String(config.product || 'lunch').toLowerCase();
    const isNugget = p.includes('nugget');
    const configuredLanes = Number(config.lanes) || 4;

    const defaultTgt = p.includes('bfast') || p.includes('breakfast') ? 63.0 : (isNugget ? 15.0 : 102.0);
    const rawTgt     = parseFloat(store && store.target !== undefined && store.target !== '' && store.target !== null ? store.target : defaultTgt);
    const targetStr  = !isNaN(rawTgt) ? `${rawTgt.toFixed(1)}g` : `${defaultTgt.toFixed(1)}g`;

    const machAvgEl = document.getElementById('machAvg');
    let rawAvg      = machAvgEl ? parseFloat(machAvgEl.innerText) : NaN;
    if (isNaN(rawAvg) && store && Array.isArray(store.lanes)) {
        let sum = 0, count = 0;
        for (let i = 0; i < Math.min(configuredLanes, 4); i++) {
            const l = store.lanes[i];
            if (l && !l.disabled && l.w !== undefined && l.w !== '' && l.w !== null) {
                const wNum = parseFloat(l.w);
                if (!isNaN(wNum)) {
                    sum += wNum;
                    count++;
                }
            }
        }
        if (count > 0) rawAvg = sum / count;
    }
    const avgStr      = !isNaN(rawAvg) ? `${rawAvg.toFixed(1)}g` : targetStr;
    const nextPrevAvg = !isNaN(rawAvg) ? rawAvg : null;
    if (typeof window !== 'undefined' && typeof window.setPrevAvg === 'function') {
        window.setPrevAvg(nextPrevAvg);
    }

    const opName = window.currentUserData
        ? (window.currentUserData.adminName || window.currentUserData.displayName || config.displayName || 'Operator')
        : (config.displayName || 'Operator');

    const lanesData = [];
    for (let li = 0; li < 4; li++) {
        const laneIdx = li + 1;
        const laneObj = store && Array.isArray(store.lanes) ? store.lanes[li] : null;

        if (li >= configuredLanes || !laneObj || laneObj.disabled) {
            lanesData.push({ d: '--', w: 'OFF' });
        } else {
            const wVal = laneObj.w !== undefined && laneObj.w !== '' && laneObj.w !== null ? parseFloat(laneObj.w) : NaN;
            if (isNaN(wVal)) {
                // Enabled but unweighed in this check
                const currentDens = laneObj.d !== undefined && laneObj.d !== '' && laneObj.d !== null ? laneObj.d : store.target;
                lanesData.push({
                    d: currentDens !== undefined && currentDens !== null && currentDens !== '' ? String(currentDens) : '--',
                    w: '--'
                });
            } else {
                // Weighed lane
                const calcEl = document.getElementById(`calcVal-${laneIdx}`);
                const calc = calcEl ? calcEl.value : '';
                const dens = laneObj.d !== undefined && laneObj.d !== '' && laneObj.d !== null ? laneObj.d : '';
                const activeDens = calc || dens;
                const parsedDens = parseFloat(activeDens);
                let dStr = '--';
                if (!isNaN(parsedDens)) {
                    dStr = isNugget ? parsedDens.toFixed(1) : parsedDens.toFixed(3);
                } else if (activeDens) {
                    dStr = String(activeDens);
                }
                lanesData.push({ d: dStr, w: `${wVal.toFixed(1)}g` });
            }
        }
    }

    const row = {
        avg: avgStr,
        lanes: lanesData,
        operator: opName,
        target: targetStr,
        time: time,
        timestamp: timestamp
    };

    let history = getHistoryList();
    if (!Array.isArray(history)) history = [];
    history.unshift(row);
    if (history.length > 50) history.pop();
    setHistoryList(history);

    if (!window.isOfflineMode && db) {
        const cloudMach = typeof window.getCloudMachine === 'function'
            ? window.getCloudMachine(config.currentMachine)
            : getCloudMachine(config.currentMachine);
        const modeKey = typeof window.getModeKey === 'function'
            ? window.getModeKey(config.product, config.lanes)
            : getModeKey(config.product, config.lanes);
        const pushKey = push(ref(db, `histories/${cloudMach}/${modeKey}`)).key;

        const updates = {};
        updates[`histories/${cloudMach}/${modeKey}/${pushKey}`] = row;
        updates[`shiftLedger/${cloudMach}/${pushKey}`] = row;

        update(ref(db), updates).catch(e => {
            console.warn('Sync check write:', e);
            window.showAdminToast("❌ Network Error: History not saved.");
        });
    }
    window.renderHistoryCards();
}

function deleteHistoryEntry(idx) {
    if (!confirm(window.t('deleteEntryConfirm') || "Delete this history entry?")) return;
    const history = getHistoryList();
    history.splice(idx, 1);
    setHistoryList(history);
    const dbRef_History = getDbRefHistory();
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(() => window.showAdminToast("❌ Network Error: Could not delete entry."));
    }
    window.renderHistoryCards();
    window.calculateLocal(); // Re-trigger velocity math without the bad data point
}

function clearHistory() {
    if (!confirm(window.t('clearTableConfirm') || "Clear shift history?")) return;

    const history = [];
    setHistoryList(history);
    const dbRef_History = getDbRefHistory();
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(() => window.showAdminToast("❌ Network Error: History not cleared."));
    }
    window.renderHistoryCards();
}

function performLocalWipe(isRemote = false) {
    const config = getConfig();
    const store  = getStore();
    const db     = getDb();
    // Only write ledger marker if this tablet triggered the wipe (prevents all tablets from spamming the ledger)
    if (!isRemote) {
        const opName = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
        const time   = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const marker = { isMarker: true, text: `🏁 SHIFT ENDED BY ${opName.toUpperCase()}`, timestamp: Date.now(), time };
        const cloudMach = typeof window.getCloudMachine === 'function'
            ? window.getCloudMachine(config.currentMachine)
            : getCloudMachine(config.currentMachine);
        if (!window.isOfflineMode && db) push(ref(db, `shiftLedger/${cloudMach}`), marker).catch(e => console.warn('Marker write:', e));
    }
    const history = [];
    setHistoryList(history);
    resetAutoSaveState();
    const dbRef_History = getDbRefHistory();
    if (!window.isOfflineMode && dbRef_History) set(dbRef_History, history).catch(e => console.warn(e));
    window.renderHistoryCards();
    if (store && store.lanes) {
        store.lanes.forEach(l => { l.w = ''; l.locked = true; l.smartActive = false; l.stableCount = 0; });
        const dbRef_Store = getDbRefStore();
        if (!window.isOfflineMode && dbRef_Store) update(dbRef_Store, { lanes: store.lanes }).catch(e => console.warn(e));
        window.updateUIFromCloud();
    }
    if (typeof window.clearYieldInputs === 'function') window.clearYieldInputs();
    if (!isRemote) window.showAdminToast("🏁 Shift Ended & Board Cleared.");
}

function listenForGlobalReset(machineKey) {
    if (!machineKey || window.isOfflineMode) return;
    if (unsubGlobalReset) { unsubGlobalReset(); unsubGlobalReset = null; }
    const resetRef = ref(getDb(), `stores/${machineKey}/lastShiftReset`);
    unsubGlobalReset = onValue(resetRef, (snap) => {
        const resetTimestamp = snap.val();
        // Only act if the signal was sent AFTER this tablet's session started (prevents old signals firing on boot)
        if (resetTimestamp && resetTimestamp > localSessionStartTime) {
            window.performLocalWipe(true);
            localSessionStartTime = Date.now(); // Reset so we don't trigger again
            window.showAdminToast("🏁 Shift Reset by Supervisor.");
        }
    });
}

function flushSmartLogic() {
    const config = getConfig();
    const store  = getStore();
    setHistoryList([]);
    window.renderHistoryCards();
    window.departmentSnipe = { active: false };

    for (let i = 1; i <= config.lanes; i++) {
        if (!store.lanes || !store.lanes[i-1]) continue;
        store.lanes[i-1].pveVelocity = null;
        store.lanes[i-1].pveRunwayMins = null;

        const trendEl = document.getElementById(`trend-${i}`);
        if (trendEl) trendEl.innerHTML = '';
    }

    window.showAdminToast("🧹 Smart Logic Flushed: Ready for Fresh Shift.");
}

function triggerGlobalShiftReset() {
    const config = getConfig();
    const db     = getDb();
    if (confirm(window.t('endShiftConfirm') || "🏁 END SHIFT?")) {
        if (window.isOfflineMode) {
            window.performLocalWipe(false);
        } else {
            window.performLocalWipe(false); // Local wipe + ledger marker
            const killTime = Date.now();
            const cloudMach = typeof window.getCloudMachine === 'function'
                ? window.getCloudMachine(config.currentMachine)
                : getCloudMachine(config.currentMachine);
            set(ref(db, `stores/${cloudMach}/lastShiftReset`), killTime)
                .catch(err => console.error("Firebase reset error:", err));
            localSessionStartTime = Date.now(); // Prevent self-trigger from the signal bouncing back
        }
    }
}

function initShiftHistory() {
    resetAutoSaveState();
    localSessionStartTime = Date.now();
    if (unsubGlobalReset) {
        unsubGlobalReset();
        unsubGlobalReset = null;
    }
    if (typeof window !== 'undefined') {
        window.getCurrentShiftStartTime = getCurrentShiftStartTime;
        window.resetAutoSaveState       = resetAutoSaveState;
        window.renderHistoryCards       = renderHistoryCards;
        window.toggleHistCard           = toggleHistCard;
        window.checkAutoSave            = checkAutoSave;
        window.saveToHistory            = saveToHistory;
        window.deleteHistoryEntry       = deleteHistoryEntry;
        window.clearHistory             = clearHistory;
        window.performLocalWipe         = performLocalWipe;
        window.listenForGlobalReset     = listenForGlobalReset;
        window.flushSmartLogic          = flushSmartLogic;
        window.triggerGlobalShiftReset  = triggerGlobalShiftReset;
    }
}

if (typeof window !== 'undefined') {
    initShiftHistory();
}

export {
    saveToHistory,
    renderHistoryCards,
    performLocalWipe,
    triggerGlobalShiftReset,
    toggleHistCard,
    checkAutoSave,
    deleteHistoryEntry,
    clearHistory,
    listenForGlobalReset,
    flushSmartLogic,
    getCurrentShiftStartTime,
    resetAutoSaveState,
    initShiftHistory
};
