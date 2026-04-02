// =====================================================================
// DOWNTIME.JS — Downtime & RCA Engine + Stream Test Compliance + About
// Handles maintenance matrix, cloud stopwatch, stream test banners, photo.
// Break schedule: STREAM_WINDOWS constant — update here if times change.
// =====================================================================

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, update, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase(getApp());

// ---- Downtime State ----
let unsubDowntime        = null;
let currentActiveDowntimes = {};
// Sandbox local memory — keyed by machine number, never touches Firebase
window.sandboxDowntimes = {};

// =====================================================================
// TIME-GATED SHIFT BARRIER
// Active Window: Sunday 23:45 through Friday 08:02 AM
// =====================================================================
window.isShiftActive = function() {
    const now  = new Date();
    const day  = now.getDay(); // 0=Sun, 1=Mon ... 5=Fri, 6=Sat
    const currentTime = now.getHours() + (now.getMinutes() / 60);
    const shiftEnd = 8 + (2 / 60); // 08:02 AM exactly

    if (day === 0 && currentTime >= 23.75) return true;          // Sunday night start
    if (day >= 1 && day <= 4) {
        if (currentTime < shiftEnd)  return true;                // Mon–Thu morning tail
        if (currentTime >= 23.75)    return true;                // Mon–Thu night start
    }
    if (day === 5 && currentTime < shiftEnd) return true;        // Friday morning tail
    return false;                                                 // Weekend / daytime
};

// Hook into startCloudSync so downtime listener auto-starts with the operator engine
const _origStartCloudSync = window.startCloudSync;
window.startCloudSync = function() {
    _origStartCloudSync();
    window.startDowntimeListener();
};

// Hook into switchMachine to unsub old listener and reset state
const _origSwitchMachine = window.switchMachine;
window.switchMachine = function(m) {
    if (unsubDowntime) { unsubDowntime(); unsubDowntime = null; }
    currentActiveDowntimes = {};
    _origSwitchMachine(m);
    // When offline, app.js skips startCloudSync — force sandbox memory to load for new machine
    if (window.isOfflineMode) {
        window.startDowntimeListener();
    }
};

// Hook into sandbox toggle so the matrix wipes clean the moment you go offline
if (window.toggleSandboxMode) {
    const _origToggleSandbox = window.toggleSandboxMode;
    window.toggleSandboxMode = function() {
        _origToggleSandbox();
        if (window.isOfflineMode) {
            window.startDowntimeListener();
        }
    };
}

window.startDowntimeListener = function() {
    // Sandbox bypass: load local memory and wipe the screen clean for this machine
    if (window.isOfflineMode) {
        const m = window.getConfig().currentMachine;
        currentActiveDowntimes = window.sandboxDowntimes[m] || {};
        window.syncMatrixToCloud();
        return;
    }
    if (!db) return;
    if (unsubDowntime) { unsubDowntime(); unsubDowntime = null; }
    unsubDowntime = onValue(ref(db, `activeDowntimes/M${window.getConfig().currentMachine}`), (snapshot) => {
        currentActiveDowntimes = snapshot.val() || {};
        window.syncMatrixToCloud();
    });
};

window.syncMatrixToCloud = function() {
    const allIds = ['sys','c1','c2','c3','c4','c5','c6','c7','c8','bin','bout','bnug','bfil'];
    allIds.forEach(id => {
        const btn = document.getElementById(`comp-${id}`);
        if (!btn) return;
        if (currentActiveDowntimes[id]) { btn.classList.remove('running'); btn.classList.add('down'); }
        else { btn.classList.remove('down'); btn.classList.add('running'); }
    });
    window.updateBannerState();
};

window.openMaintenance = function() {
    document.getElementById('maintModalTitle').innerText = `🔧 M${window.getConfig().currentMachine} ${window.t('maintMatrix')}`;
    document.getElementById('maintenanceModal').style.display = 'flex';
    window.cancelFault();
    window.cancelReEnable();
};

window.closeMaintenance = function() {
    document.getElementById('maintenanceModal').style.display = 'none';
    window.cancelFault();
    window.cancelReEnable();
};

// Hardware-specific fault reasons — no waterjet faults on belts, no product jam on cutters
window.populateFaultReasons = function(compId) {
    const select = document.getElementById('faultReason');
    select.innerHTML = `<option value="">${window.t('selectReason')}</option>`;
    let allowedReasons = [];
    if (compId === 'sys') {
        // Main Machine — full stop, product jam possible here
        allowedReasons = ['f_jam', 'f_motor', 'f_other'];
    } else if (compId.startsWith('c')) {
        // Waterjet Cutters (c1–c8) — waterjet-specific faults only
        allowedReasons = ['f_orifice', 'f_blocker', 'f_water', 'f_other'];
    } else {
        // Transport Belts (bin, bout, bnug, bfil) — belt-specific faults only
        allowedReasons = ['f_tracking', 'f_broken', 'f_motor', 'f_other'];
    }
    allowedReasons.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = window.t(key) || key;
        select.appendChild(opt);
    });
};

window.toggleComponent = function(id, name) {
    // Shift barrier — block non-admins from logging downtime outside active shift hours
    if (!window.isShiftActive() && !(window.getIsAdmin && window.getIsAdmin())) {
        window.showAdminToast("⚠️ Shift Inactive: Downtime logging is disabled.");
        return;
    }
    window.cancelFault();
    window.cancelReEnable();
    if (currentActiveDowntimes[id]) {
        const faultData = currentActiveDowntimes[id];
        document.getElementById('reEnableTitle').innerText = `${window.t('repairComp')} ${window.t(name) || name}?`;
        document.getElementById('pendingCompId').value = id;
        // Configure severity swap button based on current state
        const swapBtn = document.getElementById('btnSwapSeverity');
        if (swapBtn) {
            if (faultData.severity === 'down') {
                swapBtn.innerHTML = '🔄 SWAP TO DEGRADED';
                swapBtn.style.cssText = 'display:block; margin-top:0; margin-bottom:10px; background:var(--warning); color:black;';
                swapBtn.onclick = () => window.swapSeverity('degraded');
            } else {
                swapBtn.innerHTML = '🔄 SWAP TO HARD DOWN';
                swapBtn.style.cssText = 'display:block; margin-top:0; margin-bottom:10px; background:var(--danger); color:white;';
                swapBtn.onclick = () => window.swapSeverity('down');
            }
        }
        // Smart Route button — only show for degraded cutters (c1–c8)
        let smartBtn = document.getElementById('btnSmartRoute');
        if (!smartBtn) {
            smartBtn = document.createElement('button');
            smartBtn.id = 'btnSmartRoute';
            if (swapBtn) {
                swapBtn.parentNode.insertBefore(smartBtn, swapBtn.nextSibling);
            }
        }
        if (smartBtn) {
            if (id.startsWith('c') && faultData.severity === 'degraded') {
                smartBtn.innerHTML = '🧠 SMART ROUTE OPTIMIZATION';
                smartBtn.style.cssText = 'display:block;width:100%;margin-top:0;margin-bottom:10px;padding:12px;background:var(--info,#3498db);color:white;border:none;border-radius:8px;font-weight:bold;font-size:0.9rem;cursor:pointer;letter-spacing:0.03em;';
                smartBtn.onclick = () => window.openSmartRoute();
            } else {
                smartBtn.style.display = 'none';
            }
        }

        document.getElementById('reEnableDrawer').classList.add('active');
        setTimeout(() => document.getElementById('reEnableDrawer').scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
    } else {
        document.getElementById('faultTitle').innerText = `${window.t('disableComp')} ${window.t(name) || name}`;
        document.getElementById('pendingCompId').value = id;
        document.getElementById('pendingCompName').value = name;
        window.populateFaultReasons(id);  // dynamic list based on hardware type
        document.getElementById('faultNotes').value = '';
        document.getElementById('faultDrawer').classList.add('active');
        setTimeout(() => document.getElementById('faultDrawer').scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
    }
};

window.cancelFault    = function() { document.getElementById('faultDrawer').classList.remove('active'); };
window.cancelReEnable = function() {
    document.getElementById('reEnableDrawer').classList.remove('active');
    // Hide swap button and smart route button when drawer closes
    const swapBtn = document.getElementById('btnSwapSeverity');
    if (swapBtn) swapBtn.style.display = 'none';
    const smartBtn = document.getElementById('btnSmartRoute');
    if (smartBtn) smartBtn.style.display = 'none';
};

window.swapSeverity = function(newSeverity) {
    const id        = document.getElementById('pendingCompId').value;
    const faultData = currentActiveDowntimes[id];
    if (!faultData) return;
    const now          = Date.now();
    const durationMins = Math.max(1, Math.round((now - faultData.startTime) / 60000));
    const timeStr      = new Date(faultData.startTime).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const opName       = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    const m            = window.getConfig().currentMachine;
    const label        = newSeverity === 'down' ? 'Hard Down' : 'Degraded';
    // Closed-out record for the old severity block
    const permanentRecord = {
        machine: `M${m}`, component: faultData.name, reason: faultData.reason,
        severity: faultData.severity || 'degraded',
        notes: faultData.notes ? `${faultData.notes} (Swapped to ${label})` : `Swapped to ${label}`,
        durationMins, startTime: faultData.startTime, endTime: now, timeStr,
        loggedBy: faultData.loggedBy, clearedBy: opName
    };
    // New fault payload continuing under the new severity
    const newFaultData = { ...faultData, severity: newSeverity, startTime: now, loggedBy: opName };

    // Sandbox bypass — update local memory only
    if (window.isOfflineMode) {
        if (!window.sandboxDowntimes[m]) window.sandboxDowntimes[m] = {};
        window.sandboxDowntimes[m][id] = newFaultData;
        currentActiveDowntimes = window.sandboxDowntimes[m];
        window.syncMatrixToCloud();
        window.cancelReEnable();
        if (navigator.vibrate) navigator.vibrate([50, 50]);
        window.showAdminToast(`🧪 SANDBOX: Swapped to ${label}.`);
        return;
    }
    // Live mode — close old record, open new one (uses static imports, no dynamic import crash)
    push(ref(db, 'downtimeLogs'), permanentRecord)
        .then(() => update(ref(db, `activeDowntimes/M${m}`), { [id]: newFaultData }))
        .then(() => {
            window.cancelReEnable();
            if (navigator.vibrate) navigator.vibrate([50, 50]);
            window.showAdminToast(`🔄 Swapped to ${label}.`);
        })
        .catch(() => window.showAdminToast("❌ Network Error: Could not swap severity."));
};

window.confirmFault = function() {
    const reason = document.getElementById('faultReason').value;
    if (!reason) { alert(window.t('selectReason') || "Please select a fault reason."); return; }
    const id       = document.getElementById('pendingCompId').value;
    const name     = document.getElementById('pendingCompName').value;
    const notes    = document.getElementById('faultNotes').value.trim();
    const severity = document.getElementById('faultSeverity').value;
    const payload  = {
        id, name, reason, notes, severity,
        startTime: Date.now(),
        loggedBy: window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator'
    };
    const m = window.getConfig().currentMachine;
    // Sandbox bypass: write to local memory only
    if (window.isOfflineMode) {
        if (!window.sandboxDowntimes[m]) window.sandboxDowntimes[m] = {};
        window.sandboxDowntimes[m][id] = payload;
        currentActiveDowntimes = window.sandboxDowntimes[m];
        window.syncMatrixToCloud();
        window.cancelFault();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        window.showAdminToast(`🧪 SANDBOX: ${name} disabled.`);
        return;
    }
    update(ref(db, `activeDowntimes/M${m}`), { [id]: payload })
        .then(() => { window.cancelFault(); if (navigator.vibrate) navigator.vibrate([100, 50, 100]); })
        .catch(() => window.showAdminToast("❌ Network Error: Could not disable component."));
};

window.confirmReEnable = function() {
    const id        = document.getElementById('pendingCompId').value;
    const faultData = currentActiveDowntimes[id];
    if (!faultData) { window.cancelReEnable(); return; }
    const endTime      = Date.now();
    const durationMins = Math.max(1, Math.round((endTime - faultData.startTime) / 60000));
    const timeStr      = new Date(faultData.startTime).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const m = window.getConfig().currentMachine;
    // Sandbox bypass: delete from local memory, wipe from screen
    if (window.isOfflineMode) {
        if (window.sandboxDowntimes[m]) delete window.sandboxDowntimes[m][id];
        currentActiveDowntimes = window.sandboxDowntimes[m] || {};
        window.syncMatrixToCloud();
        window.cancelReEnable();
        if (navigator.vibrate) navigator.vibrate([50, 50]);
        window.showAdminToast(`🧪 SANDBOX: Repaired. ${durationMins}m logged.`);
        return;
    }
    const permanentRecord = {
        machine:    `M${m}`,
        component:  faultData.name,
        reason:     faultData.reason,
        severity:   faultData.severity || 'degraded',
        notes:      faultData.notes || '',
        durationMins, startTime: faultData.startTime, endTime, timeStr,
        loggedBy:   faultData.loggedBy,
        clearedBy:  window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator'
    };
    push(ref(db, 'downtimeLogs'), permanentRecord)
        .then(() => {
            set(ref(db, `activeDowntimes/M${m}/${id}`), null);
            window.cancelReEnable();
            if (navigator.vibrate) navigator.vibrate([50, 50]);
            window.showAdminToast(`✅ Repaired. Downtime: ${durationMins}m logged.`);
        })
        .catch(() => window.showAdminToast("❌ Network Error: Could not save log."));
};

window.updateBannerState = function() {
    const m      = window.getConfig().currentMachine;
    const banner = document.getElementById('statusBanner');
    const title  = document.getElementById('bannerTitle');
    const sub    = document.getElementById('bannerSub');
    if (!banner) return;
    const activeFaults = Object.values(currentActiveDowntimes);
    const downCount    = activeFaults.length;
    if (downCount === 0) {
        banner.className = 'system-banner banner-running';
        title.innerText  = `🟢 M${m}: ${window.t('sysRunning')}`;
        sub.innerText    = window.t('allActive');
    } else {
        const isHardDown = activeFaults.some(f => f.severity === 'down' || f.id === 'sys');
        if (isHardDown) {
            banner.className = 'system-banner banner-down';
            title.innerText  = `🔴 M${m}: ${window.t('sysDown')}`;
            sub.innerText    = `${downCount} ${window.t('compsDown')}`;
        } else {
            banner.className = 'system-banner banner-degraded';
            title.innerText  = `⚠️ M${m}: ${window.t('sysDegraded')}`;
            sub.innerText    = `${downCount} ${window.t('compsDown')}`;
        }
    }
};

// =====================================================================
// SMART ROUTE OPTIMIZATION ENGINE
// Triggered when a waterjet cutter (c1–c8) is marked as "degraded".
// Produces an optimized DSI actuator grid with changed cells highlighted.
//
// Rules:
//   Rule 1 – Anchor  : Sub-lanes 2 & 3 keep 2 cutters when possible.
//   Rule 2 – Ergo    : Single-cutter sub-lanes go to outside lanes (1 or 4).
//   Rule 3 – Solo    : A lone cutter in any sub-lane must be Path 1.
//   Rule 4 – Sequence: In a 2-cutter sub-lane, Path 2 fires before Path 1.
// =====================================================================

const DSI_BASELINE = {
    1: { subLane: 1, path: 2 },
    2: { subLane: 1, path: 1 },
    3: { subLane: 2, path: 2 },
    4: { subLane: 2, path: 1 },
    5: { subLane: 3, path: 2 },
    6: { subLane: 3, path: 1 },
    7: { subLane: 4, path: 2 },
    8: { subLane: 4, path: 1 }
};

window.calculateSmartRoute = function(degradedCutterIds) {
    const allActuators     = [1, 2, 3, 4, 5, 6, 7, 8];
    const degradedNumbers  = degradedCutterIds.map(id => parseInt(id.replace('c', ''), 10));
    const healthyActuators = allActuators.filter(a => !degradedNumbers.includes(a));
    const totalHealthy     = healthyActuators.length;

    // Minimum viable: 1+1+2+1 = 5 healthy actuators
    if (totalHealthy < 5) return null;

    let subLaneAllocations = { 1: 2, 2: 2, 3: 2, 4: 2 };

    if (totalHealthy === 7) {
        // Directional Load Balancing:
        // Right-side breakdown (Actuators 5–8) → push unprocessed meat to Sub-lane 4 (outside right)
        // Left-side breakdown  (Actuators 1–4) → push unprocessed meat to Sub-lane 1 (outside left)
        const downCutter = degradedNumbers[0];
        if (downCutter >= 5) {
            subLaneAllocations = { 1: 2, 2: 2, 3: 2, 4: 1 };
        } else {
            subLaneAllocations = { 1: 1, 2: 2, 3: 2, 4: 2 };
        }
    } else if (totalHealthy === 6) {
        // Both outside lanes absorb the hit — protect inside lanes 2 & 3
        subLaneAllocations = { 1: 1, 2: 2, 3: 2, 4: 1 };
    } else if (totalHealthy === 5) {
        // Extreme degradation — Sub-lane 3 retains 2 cutters as last protected lane
        subLaneAllocations = { 1: 1, 2: 1, 3: 2, 4: 1 };
    }

    const assignments = [];
    let actuatorIndex = 0;

    for (let subLane = 1; subLane <= 4; subLane++) {
        const cuttersNeeded = subLaneAllocations[subLane];
        if (cuttersNeeded === 2) {
            // Default optimal pathing: Path 2 (vertical) fires first, then Path 1 (horizontal)
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 2, mode: 'Cutter' });
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 1, mode: 'Cutter' });
        } else {
            // Solo Rule: single cutter must be Path 1 to prevent machine faults
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 1, mode: 'Cutter' });
        }
    }

    // Mark degraded actuators as OFF
    degradedNumbers.forEach(actNum => {
        assignments.push({ actuator: actNum, subLane: '--', path: 'OFF', mode: 'Off' });
    });

    return assignments.sort((a, b) => a.actuator - b.actuator);
};

window.openSmartRoute = function() {
    const activeFaults    = Object.values(currentActiveDowntimes || {});
    const degradedCutters = activeFaults
        .filter(f => f.id && f.id.startsWith('c') && f.severity === 'degraded')
        .map(f => f.id);

    if (degradedCutters.length === 0) {
        window.showAdminToast('⚠️ No degraded cutters found to route.');
        return;
    }

    const newRoute = window.calculateSmartRoute(degradedCutters);
    if (!newRoute) {
        window.showAdminToast('⚠️ Too many cutters down. Hard down recommended.');
        return;
    }

    const HIGHLIGHT = 'background:#FFD700;color:#000;font-weight:bold;border-radius:4px;padding:4px 8px;';
    const NORMAL    = 'padding:4px 8px;';
    const OFF_STYLE = 'background:#e74c3c;color:#fff;font-weight:bold;border-radius:4px;padding:4px 8px;';

    let gridHtml = `
        <p style="font-size:0.78rem;color:#aaa;margin:0 0 10px;">
            🟡 Yellow = changed from baseline &nbsp;|&nbsp; 🔴 Red = cutter OFF
        </p>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:4px;text-align:center;font-size:0.85rem;">
            <div style="font-weight:bold;border-bottom:2px solid #444;padding-bottom:6px;">Actuator</div>
            <div style="font-weight:bold;border-bottom:2px solid #444;padding-bottom:6px;">Mode</div>
            <div style="font-weight:bold;border-bottom:2px solid #444;padding-bottom:6px;">Sub-Lane</div>
            <div style="font-weight:bold;border-bottom:2px solid #444;padding-bottom:6px;">Path</div>
    `;

    newRoute.forEach(row => {
        const base         = DSI_BASELINE[row.actuator];
        const isOff        = row.path === 'OFF';
        const subLaneStyle = isOff ? OFF_STYLE : (row.subLane !== base.subLane ? HIGHLIGHT : NORMAL);
        const pathStyle    = isOff ? OFF_STYLE : (row.path    !== base.path    ? HIGHLIGHT : NORMAL);
        const modeStyle    = isOff ? OFF_STYLE : NORMAL;

        gridHtml += `
            <div style="${NORMAL}border-bottom:1px solid #333;">Actuator ${row.actuator}</div>
            <div style="${modeStyle}border-bottom:1px solid #333;">${row.mode}</div>
            <div style="${subLaneStyle}border-bottom:1px solid #333;">${row.subLane}</div>
            <div style="${pathStyle}border-bottom:1px solid #333;">${row.path}</div>
        `;
    });

    gridHtml += `</div>
        <p style="margin-top:12px;font-size:0.75rem;color:#888;border-top:1px solid #333;padding-top:8px;">
            ⚙️ Go to DSI → Cutter Setup tab → update the highlighted cells.
        </p>`;

    // Remove any existing overlay
    const existing = document.getElementById('smartRouteOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'smartRouteOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <div style="background:var(--card-bg,#1e1e2e);border-radius:12px;width:100%;max-width:460px;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,0.6);color:var(--text,#eee);font-family:inherit;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <h2 style="margin:0;font-size:1rem;">🧠 Smart Route Optimization</h2>
                <button onclick="document.getElementById('smartRouteOverlay').remove()"
                    style="background:none;border:none;color:#aaa;font-size:1.4rem;cursor:pointer;line-height:1;">✕</button>
            </div>
            ${gridHtml}
        </div>
    `;

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
};

// =====================================================================
// STREAM TEST COMPLIANCE ENGINE
// Break times: update STREAM_WINDOWS if the schedule changes.
// =====================================================================

const STREAM_WINDOWS = [
    { id: 'b1', start: 1 * 60 + 10, end: 1 * 60 + 25 }, // 1:10 AM - 1:25 AM
    { id: 'b2', start: 3 * 60 + 45, end: 4 * 60 + 0  }, // 3:45 AM - 4:00 AM
    { id: 'b3', start: 5 * 60 + 45, end: 6 * 60 + 0  }  // 5:45 AM - 6:00 AM
];

function getStreamKey(windowId) {
    const isoDate = new Date().toISOString().split('T')[0];
    return `dsi_stream_${isoDate}_${windowId}`;
}

window.checkStreamTestCompliance = function() {
    if (window.getIsAdmin()) return;
    if (document.getElementById('appContent').style.display === 'none') return;
    const now        = new Date();
    const totalMins  = now.getHours() * 60 + now.getMinutes();
    const activeWindow = STREAM_WINDOWS.find(w => totalMins >= w.start && totalMins < w.end);
    const banner     = document.getElementById('streamTestBanner');
    if (!banner) return;
    if (activeWindow && !localStorage.getItem(getStreamKey(activeWindow.id))) {
        if (banner.style.display !== 'block') {
            banner.style.display = 'block';
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    } else {
        banner.style.display = 'none';
    }
};

window.markStreamTestComplete = function() {
    const now        = new Date();
    const totalMins  = now.getHours() * 60 + now.getMinutes();
    const activeWindow = STREAM_WINDOWS.find(w => totalMins >= w.start && totalMins < w.end);
    if (activeWindow) localStorage.setItem(getStreamKey(activeWindow.id), 'true');
    const banner = document.getElementById('streamTestBanner');
    if (banner) banner.style.display = 'none';
};

window.openStreamTestModal  = function() { document.getElementById('streamTestModal').style.display = 'flex'; };

window.closeStreamTestModal = function() {
    document.getElementById('streamTestModal').style.display = 'none';
    currentStreamPhoto = null;
    const preview = document.getElementById('streamPhotoPreview');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    const btn = document.getElementById('btnTakePhoto');
    if (btn) { btn.setAttribute('data-i18n', 'takePhoto'); btn.innerText = window.t('takePhoto'); btn.style.borderStyle = 'dashed'; btn.style.background = 'transparent'; }
    const input = document.getElementById('streamCameraInput');
    if (input) input.value = '';
};

let currentStreamPhoto = null;

window.handleStreamPhoto = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas    = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scale     = MAX_WIDTH / img.width;
            canvas.width    = MAX_WIDTH;
            canvas.height   = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.6);
            currentStreamPhoto = base64;
            const preview = document.getElementById('streamPhotoPreview');
            preview.src = base64; preview.style.display = 'block';
            const btn = document.getElementById('btnTakePhoto');
            btn.innerText = window.t('retakePhoto');
            btn.style.borderStyle = 'solid';
            btn.style.background = 'rgba(0,123,255,0.1)';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.openFullSizePhoto = function(src) {
    document.getElementById('photoViewerImg').src = src;
    document.getElementById('photoViewerModal').style.display = 'flex';
};

window.passStreamTest = function() {
    if (!currentStreamPhoto && !confirm(window.t('photoBypass'))) return;
    const opName    = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    const time      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const photoNote = currentStreamPhoto ? '' : ' (NO PHOTO)';
    const marker    = { isMarker: true, text: `💧 STREAM TEST VERIFIED${photoNote} BY ${opName.toUpperCase()}`, timestamp: Date.now(), time };
    const photoRef  = currentStreamPhoto ? `streamPhotos/${Date.now()}` : null;
    if (!window.isOfflineMode && db) {
        if (photoRef && currentStreamPhoto) set(ref(db, photoRef), currentStreamPhoto).catch(e => console.warn(e));
        marker.photoRef = photoRef;
        push(ref(db, `shiftLedger/M${window.getConfig().currentMachine}`), marker).catch(e => console.warn(e));
    }
    window.markStreamTestComplete();
    window.closeStreamTestModal();
    window.showAdminToast(window.t('stPass'));
};

window.failStreamTest = function() {
    if (!currentStreamPhoto && !confirm(window.t('photoBypass'))) return;
    const opName    = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    const time      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const photoNote = currentStreamPhoto ? '' : ' (NO PHOTO)';
    const marker    = { isMarker: true, isFail: true, text: `⚠️ STREAM TEST FAILED${photoNote} BY ${opName.toUpperCase()}`, timestamp: Date.now(), time };
    const photoRef  = currentStreamPhoto ? `streamPhotos/${Date.now()}` : null;
    if (!window.isOfflineMode && db) {
        if (photoRef && currentStreamPhoto) set(ref(db, photoRef), currentStreamPhoto).catch(e => console.warn(e));
        marker.photoRef = photoRef;
        push(ref(db, `shiftLedger/M${window.getConfig().currentMachine}`), marker).catch(e => console.warn(e));
    }
    window.markStreamTestComplete();
    window.closeStreamTestModal();
    window.openMaintenance();
    window.showAdminToast("⚠️ Select the failing component.");
};

window.loadAndViewPhoto = function(imgEl) {
    const photoRef = imgEl.getAttribute('data-photoref');
    if (!photoRef || !db) return;
    if (imgEl.src && imgEl.src.startsWith('data:')) { window.openFullSizePhoto(imgEl.src); return; }
    imgEl.style.opacity = '0.5';
    get(ref(db, photoRef)).then(snap => {
        const b64 = snap.val();
        if (b64) { imgEl.src = b64; imgEl.style.opacity = '1'; window.openFullSizePhoto(b64); }
        else { imgEl.style.opacity = '1'; window.showAdminToast('📷 Photo not available.'); }
    }).catch(() => { imgEl.style.opacity = '1'; window.showAdminToast('❌ Could not load photo.'); });
};

// Compliance clock
// =====================================================================
// AUTO-CLOSE DAEMON
// Forces active downtimes closed at 08:02 AM — runs on 30s interval
// =====================================================================
window.enforceShiftBoundaries = function() {
    if (window.isShiftActive()) return; // Shift still active, nothing to close
    const keys = Object.keys(currentActiveDowntimes);
    if (keys.length === 0) return;
    const m       = window.getConfig().currentMachine;
    const now     = Date.now();
    const timeStr = new Date().toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    keys.forEach(id => {
        const faultData    = currentActiveDowntimes[id];
        const durationMins = Math.max(1, Math.round((now - faultData.startTime) / 60000));
        const permanentRecord = {
            machine:    `M${m}`,
            component:  faultData.name,
            reason:     faultData.reason,
            severity:   faultData.severity || 'degraded',
            notes:      faultData.notes ? `${faultData.notes} (Auto-closed at shift end)` : '(Auto-closed at shift end)',
            durationMins, startTime: faultData.startTime, endTime: now, timeStr,
            loggedBy:   faultData.loggedBy,
            clearedBy:  'SYSTEM (Auto-Close)'
        };
        if (window.isOfflineMode) {
            if (window.sandboxDowntimes[m]) delete window.sandboxDowntimes[m][id];
        } else if (db) {
            push(ref(db, 'downtimeLogs'), permanentRecord)
                .then(() => set(ref(db, `activeDowntimes/M${m}/${id}`), null));
        }
    });
    if (window.isOfflineMode) {
        currentActiveDowntimes = window.sandboxDowntimes[m] || {};
        window.syncMatrixToCloud();
    }
};

// Compliance clock + Auto-Close Daemon (every 30s, initial check after 2s)
setInterval(() => { window.checkStreamTestCompliance(); window.enforceShiftBoundaries(); }, 30000);
setTimeout(() => { window.checkStreamTestCompliance(); window.enforceShiftBoundaries(); }, 2000);

// =====================================================================
// ABOUT / OUR STORY
// =====================================================================
window.openAbout = function() {
    document.getElementById('fullMissionText').innerText = window.t('missionText');
    document.getElementById('aboutModal').style.display = 'flex';
};
