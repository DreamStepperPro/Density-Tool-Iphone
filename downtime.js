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
};

window.startDowntimeListener = function() {
    if (!db || window.isOfflineMode) return;
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
    window.cancelFault();
    window.cancelReEnable();
    if (currentActiveDowntimes[id]) {
        document.getElementById('reEnableTitle').innerText = `${window.t('repairComp')} ${window.t(name) || name}?`;
        document.getElementById('pendingCompId').value = id;
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
window.cancelReEnable = function() { document.getElementById('reEnableDrawer').classList.remove('active'); };

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
    update(ref(db, `activeDowntimes/M${window.getConfig().currentMachine}`), { [id]: payload })
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
    const permanentRecord = {
        machine:    `M${window.getConfig().currentMachine}`,
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
            set(ref(db, `activeDowntimes/M${window.getConfig().currentMachine}/${id}`), null);
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
setInterval(window.checkStreamTestCompliance, 30000);
setTimeout(window.checkStreamTestCompliance, 2000);

// =====================================================================
// ABOUT / OUR STORY
// =====================================================================
window.openAbout = function() {
    document.getElementById('fullMissionText').innerText = window.t('missionText');
    document.getElementById('aboutModal').style.display = 'flex';
};
