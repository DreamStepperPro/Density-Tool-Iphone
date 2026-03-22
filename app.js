import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, onValue, update, push, serverTimestamp, goOnline, goOffline } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA84WGuDvVMTci0KTZHVxDCle8dbiE1XB4",
    authDomain: "dsi-pro-bcb5c.firebaseapp.com",
    databaseURL: "https://dsi-pro-bcb5c-default-rtdb.firebaseio.com",
    projectId: "dsi-pro-bcb5c",
    storageBucket: "dsi-pro-bcb5c.firebasestorage.app",
    messagingSenderId: "545898401770",
    appId: "1:545898401770:web:01928966d9415a9cc82c93"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

const ADMIN_UID    = 'aq1MtAQ5FdXPH9D0l8gTyKCEUWg1';
let currentUserUid = null;
let isAdmin        = false;
let appInitialized = false;

window.isOfflineMode = false;

// =====================================================================
// SHARED STATE GETTERS — used by split modules (comms, supervisor, etc.)
// These closures always return the CURRENT value of each variable.
// =====================================================================
window.db          = db;
window.ADMIN_UID   = ADMIN_UID;
window.getConfig   = () => config;
window.getStore    = () => store;
window.getHistory  = () => history;
window.getIsAdmin  = () => isAdmin;

// =====================================================================
// TRUE NETWORK HEARTBEAT
// =====================================================================
const connectedRef = ref(db, ".info/connected");
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        if (document.getElementById('statusDot')) document.getElementById('statusDot').className = "status-dot status-online";
        if (document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-online";
    } else {
        if (document.getElementById('statusDot')) document.getElementById('statusDot').className = "status-dot status-offline";
        if (document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-offline";
    }
});
window.currentUserData = {};

window.forceOfflineMode = function() {
    window.isOfflineMode = true;
    document.getElementById('accessDeniedOverlay').style.display = 'none';
    if (!appInitialized) { appInitialized = true; window.initApp(); }
};

signInAnonymously(auth).then((result) => {
    currentUserUid = result.user.uid;
    window.myUid   = currentUserUid;
    isAdmin        = (currentUserUid === ADMIN_UID);

    if (isAdmin) {
        document.getElementById('btnAdmin').classList.remove('btn-hidden');
        document.getElementById('btnAdminSup').classList.remove('btn-hidden');
        if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.remove('btn-hidden');
        if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.remove('btn-hidden');
        window.startAdminRadar();
    }

    const userRef = ref(db, `users/${currentUserUid}`);
    update(userRef, { lastLogin: new Date().toLocaleString() }).catch(e => console.warn(e));

    onValue(userRef, (snap) => {
        window.currentUserData = snap.val() || {};
        const isApproved = window.currentUserData.approved === true;
        if (isAdmin || isApproved) {
            document.getElementById('accessDeniedOverlay').style.display = 'none';
            document.getElementById('statusDot').className = "status-dot status-online";
            if (document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-online";
            document.getElementById('btnSos').style.display = 'flex';
            if (!appInitialized) {
                appInitialized = true;
                window.initApp();
                window.startCommsListener();
            } else {
                window.routeUserByRole();
            }
        } else {
            // Hide splash immediately so unapproved user can see their Device ID
            const splash = document.getElementById('splashScreen');
            if (splash) splash.style.display = 'none';
            document.getElementById('accessDeniedOverlay').style.display = 'flex';
            document.getElementById('userIdDisplay').innerText = currentUserUid;
            document.getElementById('btnSos').style.display = 'none';
        }
    });
}).catch((error) => {
    console.error("Firebase auth failed:", error.message);
    document.getElementById('userIdDisplay').innerText = "CONNECTION ERROR";
    const splash = document.getElementById('splashScreen');
    if (splash) splash.style.display = 'none';
});

// =====================================================================
// SHARED APP STATE
// =====================================================================
let config = {
    machines: 2, lanes: 4, product: 'lunch', smart: 'auto', theme: 'light',
    currentMachine: 1, lang: 'en', inputMode: 'button', displayName: ''
};

let store   = {};
let history = [];
const FACTORS = { lunch: 0.01, bfast: 0.017 };
let pressTimer;

window.weightDebounceTimers = {};
window.FACTORS = FACTORS;

let autoSaveTimer      = null;
let lastAutoSaveCombo  = "";
let cloudPathKey       = "";
let prevAvg            = null;
let pendingTargetValue = null;

// =====================================================================
// INIT
// =====================================================================
window.initApp = function() {
    const saved = localStorage.getItem('dsi_config_v11');
    if (saved) Object.assign(config, JSON.parse(saved));
    if (!config.smart)     config.smart     = 'auto';
    if (!config.theme)     config.theme     = 'light';
    if (!config.inputMode) config.inputMode = 'button';
    if (!config.lang)      config.lang      = 'en';
    window.applyTheme();
    window.applyTranslations();
    const fieldMap = { setMachines:'machines', setLanes:'lanes', setProd:'product', setSmart:'smart', setInputMode:'inputMode', setTheme:'theme' };
    for (const [id, key] of Object.entries(fieldMap)) { const el = document.getElementById(id); if (el) el.value = config[key]; }
    if (document.getElementById('setDispName')) document.getElementById('setDispName').value = config.displayName || '';
    const hasSetup = localStorage.getItem('dsi_setup_done');
    if (!hasSetup) document.getElementById('setupWizard').style.display = 'flex';
    else window.routeUserByRole();
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; }, 600); }
    }, 2500);
};

window.routeUserByRole = function() {
    const role = window.currentUserData.role || 'operator';
    document.getElementById('globalStatsBar').style.display = 'flex';
    if (isAdmin || role === 'supervisor') {
        if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.remove('btn-hidden');
        if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.remove('btn-hidden');
        if (document.getElementById('btnMaintSup')) document.getElementById('btnMaintSup').classList.remove('btn-hidden');
    }
    if (isAdmin) {
        document.getElementById('supervisorDashboard').style.display = 'block';
        document.getElementById('supervisorDashboard').style.paddingBottom = '0px';
        document.getElementById('appContent').style.display = 'block';
        document.getElementById('appContent').style.filter = 'none';
        const opHeader = document.querySelector('#appContent .header');
        if (opHeader) opHeader.style.display = 'none';
        if (!window.isOfflineMode) { window.startSupervisorSync(); window.startCloudSync(); }
        window.renderInterface();
    } else if (role === 'supervisor') {
        document.getElementById('appContent').style.display = 'none';
        document.getElementById('supervisorDashboard').style.display = 'block';
        if (!window.isOfflineMode) window.startSupervisorSync();
    } else {
        document.getElementById('supervisorDashboard').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        document.getElementById('appContent').style.filter = 'none';
        window.renderInterface();
        if (!window.isOfflineMode) window.startCloudSync();
    }
};

// =====================================================================
// OPERATOR ENGINE — Cloud Sync
// =====================================================================
let unsubStore = null, unsubHistory = null;
let dbRef_Store = null, dbRef_History = null;

window.startCloudSync = function() {
    if (!db) { setTimeout(window.startCloudSync, 500); return; }
    cloudPathKey = `M${config.currentMachine}/${config.product}_${config.lanes}L`;
    if (unsubStore) unsubStore();
    if (unsubHistory) unsubHistory();
    dbRef_Store   = ref(db, `stores/${cloudPathKey}`);
    dbRef_History = ref(db, `histories/${cloudPathKey}`);
    unsubStore = onValue(dbRef_Store, (snapshot) => {
        const val = snapshot.val();
        if (val) { store = val; window.updateUIFromCloud(); }
        else {
            if (!store.target) {
                const defaultTarget = config.product === 'bfast' ? '63' : '102';
                store = { target: defaultTarget, lastUpdated: Date.now(), lanes: Array(config.lanes).fill().map(() => ({ d:'', w:'', attempts:0, smartActive:false, lastD:null, lastW:null, locked:true })) };
                set(dbRef_Store, store).catch(e => window.showAdminToast("❌ Error initializing machine."));
            }
        }
    });
    unsubHistory = onValue(dbRef_History, (snapshot) => {
        const val = snapshot.val();
        history = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        window.renderHistoryCards();
    });
};

window.pushLaneToCloud = function(idx) {
    if (!dbRef_Store || window.isOfflineMode) return;
    document.getElementById('statusDot').className = "status-dot status-syncing";
    const updates = {};
    const lane = store.lanes[idx-1];
    updates[`lanes/${idx-1}/d`]           = lane.d;
    updates[`lanes/${idx-1}/w`]           = lane.w;
    updates[`lanes/${idx-1}/locked`]      = lane.locked;
    updates[`lanes/${idx-1}/attempts`]    = lane.attempts ?? 0;
    updates[`lanes/${idx-1}/smartActive`] = lane.smartActive ?? false;
    updates[`lanes/${idx-1}/lastD`]       = lane.lastD ?? null;
    updates[`lanes/${idx-1}/lastW`]       = lane.lastW ?? null;
    updates[`lanes/${idx-1}/stableCount`] = lane.stableCount ?? 0;
    updates[`lanes/${idx-1}/lastUpdated`] = serverTimestamp();
    updates['lastUpdated']                = serverTimestamp();
    update(dbRef_Store, updates).then(() => {
        document.getElementById('statusDot').className = "status-dot status-online";
    }).catch((e) => {
        console.error(e);
        document.getElementById('statusDot').className = "status-dot status-offline";
        window.showAdminToast("❌ Network Error: Sync failed.");
    });
};

window.pushTargetToCloud = function() {
    if (!dbRef_Store || window.isOfflineMode) return;
    update(dbRef_Store, { target: store.target, lastUpdated: serverTimestamp() })
        .catch(e => window.showAdminToast("❌ Network Error: Target not saved."));
};

// =====================================================================
// RENDER INTERFACE
// =====================================================================
window.renderInterface = function() {
    const nav = document.getElementById('machineNav');
    if (config.machines === 1) { nav.className = 'machine-nav nav-hidden'; config.currentMachine = 1; }
    else {
        nav.className = 'machine-nav'; nav.innerHTML = '';
        for (let i = 1; i <= config.machines; i++) {
            const btn = document.createElement('button');
            btn.className = `m-btn ${config.currentMachine === i ? 'm-active' : ''}`;
            btn.innerText = `DSI ${i}`;
            btn.onclick = () => window.switchMachine(i);
            nav.appendChild(btn);
        }
    }
    const prodName = config.product === 'lunch' ? window.t('lunch') : window.t('bfast');
    document.getElementById('displayConfig').innerText = `${config.lanes} ${window.t('lane')} • ${prodName}`;
    const fieldMap = { setMachines:'machines', setLanes:'lanes', setProd:'product', setSmart:'smart', setInputMode:'inputMode', setTheme:'theme' };
    for (const [id, key] of Object.entries(fieldMap)) { const el = document.getElementById(id); if (el) el.value = config[key]; }
    if (document.getElementById('setDispName')) document.getElementById('setDispName').value = config.displayName || '';
    const container = document.getElementById('lanesContainer');
    container.innerHTML = '';
    for (let i = 1; i <= config.lanes; i++) {
        let labelText = window.t('density');
        if (config.inputMode === 'longpress' && !isAdmin) labelText += " (HOLD)";
        if ((config.inputMode === 'doubletap' && !isAdmin) || isAdmin) labelText += " (×2)";
        let btnHtml = config.inputMode === 'button' && !isAdmin
            ? `<button class="btn-icon" id="lockDens-${i}" onmousedown="event.preventDefault()" onclick="window.toggleLock(${i})">🔒</button>`
            : `<button class="btn-icon btn-hidden" id="lockDens-${i}">🔒</button>`;
        let weightHtml = `<input type="number" id="avgWt-${i}" inputmode="decimal" oninput="window.handleWeightInput(${i})" onblur="clearTimeout(window.weightDebounceTimers[${i}]); window.pushLaneToCloud(${i}); window.checkAutoSave()">`;
        if (isAdmin) {
            weightHtml = `<input type="number" id="avgWt-${i}" class="density-input" inputmode="decimal" readonly oninput="window.handleWeightInput(${i})" onblur="window.checkAutoSave(); window.lockWeightOnBlur(${i})">`;
        }
        container.innerHTML += `
            <div class="lane-card" id="card-${i}">
                <div class="lane-header">
                    <div class="lane-header-left"><span>${window.t('lane')} ${i}</span><span class="smart-tag" id="tag-${i}">SMART</span></div>
                    <span class="lane-trend" id="trend-${i}"></span>
                </div>
                <div>
                    <label>${labelText}</label>
                    <div class="input-group">
                        <button class="btn-icon" tabindex="-1" onclick="window.toggleDensitySign(${i})" style="min-width:38px; padding:0; font-weight:bold; background:var(--input-bg);">±</button>
                        <input type="number" id="currDens-${i}" class="density-input" step="0.001" readonly inputmode="decimal" oninput="window.handleInput(${i})" onblur="window.lockOnBlur(${i})">
                        ${btnHtml}
                    </div>
                </div>
                <div>
                    <label>${window.t('avgWt')} ${isAdmin ? '(×2)' : ''}</label>
                    <div class="input-group">
                        ${weightHtml}
                        <button class="btn-icon btn-recheck" onclick="window.recheckLane(${i})">↻</button>
                    </div>
                </div>
                <div class="result-box" id="resBox-${i}" onclick="window.applyResult(${i})">
                    <span id="resText-${i}">${window.t('newDens')} --</span>
                    <span class="tap-hint">${window.t('tapApply')}</span>
                </div>
                <input type="hidden" id="calcVal-${i}">
            </div>`;
    }
    for (let i = 1; i <= config.lanes; i++) {
        const dEl = document.getElementById(`currDens-${i}`);
        const wEl = document.getElementById(`avgWt-${i}`);
        if (isAdmin) {
            dEl.ondblclick = () => window.unlockAndFocus(i);
            if (wEl) wEl.ondblclick = () => window.unlockWeightAndFocus(i);
        } else {
            if (config.inputMode === 'longpress') {
                dEl.addEventListener('touchstart', () => { pressTimer = setTimeout(() => window.unlockAndFocus(i), 800); });
                dEl.addEventListener('touchend',   () => clearTimeout(pressTimer));
                dEl.addEventListener('mousedown',  () => { pressTimer = setTimeout(() => window.unlockAndFocus(i), 800); });
                dEl.addEventListener('mouseup',    () => clearTimeout(pressTimer));
            } else if (config.inputMode === 'doubletap') {
                dEl.ondblclick = () => window.unlockAndFocus(i);
            }
        }
    }
};

window.updateUIFromCloud = function() {
    if (!store || !store.lanes) return;
    const tEl = document.getElementById('setTarget');
    if (document.activeElement !== tEl) {
        tEl.value = store.target;
        document.getElementById('displayTarget').innerText = `${window.t('target')}: ${store.target}g`;
        document.getElementById('targetDisplay').innerText = `${store.target}g`;
    }
    for (let i = 1; i <= config.lanes; i++) {
        const lane = store.lanes[i-1];
        if (!lane) continue;
        const dEl = document.getElementById(`currDens-${i}`);
        if (document.activeElement !== dEl) {
            dEl.value = lane.d;
            if (lane.locked) {
                dEl.readOnly = true; dEl.style.borderColor = 'var(--border)';
                if (config.inputMode === 'button') { document.getElementById(`lockDens-${i}`).className = 'btn-icon locked'; document.getElementById(`lockDens-${i}`).innerText = '🔒'; }
            } else {
                dEl.readOnly = false; dEl.style.borderColor = 'var(--info)';
                if (config.inputMode === 'button') { document.getElementById(`lockDens-${i}`).className = 'btn-icon'; document.getElementById(`lockDens-${i}`).innerText = '🔓'; }
            }
        }
        const wEl = document.getElementById(`avgWt-${i}`);
        if (document.activeElement !== wEl) {
            wEl.value = lane.w || '';
            if (isAdmin) { wEl.readOnly = true; wEl.style.borderColor = 'var(--border)'; }
        }
        const card = document.getElementById(`card-${i}`);
        if (config.smart === 'on' || (config.smart === 'auto' && lane.smartActive)) card.classList.add('smart-active');
        else card.classList.remove('smart-active');
    }
    window.calculateLocal();
};

// =====================================================================
// PORTIONING BRAIN — Density Math + Smart Adapt + Velocity Engine
// =====================================================================
window.calculateLocal = function() {
    if (!store || !store.lanes) return;
    const target  = parseFloat(store.target);
    const baseK   = FACTORS[config.product];
    let weights = [], count = 0;
    for (let i = 1; i <= config.lanes; i++) {
        if (!store.lanes[i-1]) continue;
        const lane    = store.lanes[i-1];
        const currD   = parseFloat(lane.d), currW = parseFloat(lane.w);
        const resText = document.getElementById(`resText-${i}`);
        const hiddenVal = document.getElementById(`calcVal-${i}`);
        const card    = document.getElementById(`card-${i}`);
        const resBox  = document.getElementById(`resBox-${i}`);
        const trendEl = document.getElementById(`trend-${i}`);
        if (!isNaN(target) && !isNaN(currD) && !isNaN(currW)) {
            const diff    = currW - target;
            let activeK   = baseK;
            const isSmart = config.smart === 'on' || (config.smart === 'auto' && lane.smartActive);
            if (isSmart && lane.lastD !== null && lane.lastW !== null) {
                let dDelta = currD - lane.lastD, wDelta = currW - lane.lastW;
                if (Math.abs(wDelta) > 0.5 && Math.abs(dDelta) > 0.001) {
                    let observedK = dDelta / wDelta;
                    observedK = Math.max(baseK * 0.5, Math.min(observedK, baseK * 5));
                    activeK = (observedK * 0.6) + (baseK * 0.4);
                }
            }
            let newD = currD + (diff * activeK);
            newD = Math.max(-0.500, Math.min(0.500, newD));
            hiddenVal.value = newD.toFixed(3);
            resText.innerText = `${window.t('newDens')} ${newD.toFixed(3)}`;
            resBox.classList.add('has-value');
            // Predictive Velocity Engine
            let driftHtml = "";
            if (history && history.length > 0) {
                const lastCheck = history[0];
                const lastWStr  = lastCheck.lanes && lastCheck.lanes[i-1] ? lastCheck.lanes[i-1].w : null;
                if (lastWStr && lastWStr !== '--') {
                    const lastW = parseFloat(lastWStr);
                    if (!isNaN(lastW) && lastCheck.timestamp) {
                        const timeDiffMin = Math.max(1, (Date.now() - lastCheck.timestamp) / 60000);
                        const velocity    = (currW - lastW) / timeDiffMin;
                        if (Math.abs(velocity) > 0.015) {
                            let runway = 0;
                            if (velocity > 0 && currW < (target + 2)) runway = (target + 2) - currW;
                            else if (velocity < 0 && currW > (target - 2)) runway = currW - (target - 2);
                            if (runway > 0) {
                                const minsToDrift = Math.round(runway / Math.abs(velocity));
                                if (minsToDrift < 120) {
                                    if (minsToDrift <= 15) {
                                        driftHtml = `<span style="font-size:0.7rem; margin-left:8px; font-weight:900; color:var(--danger); animation: pulseWarning 1.5s infinite;">${window.t('weighNow')}</span>`;
                                    } else {
                                        const driftColor = minsToDrift <= 30 ? 'var(--warning)' : 'var(--perfect)';
                                        driftHtml = `<span style="font-size:0.7rem; margin-left:8px; font-weight:900; color:${driftColor};">⏳ ${minsToDrift}m</span>`;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            const absDiff = Math.abs(diff);
            card.className = "lane-card";
            if (isSmart) card.classList.add('smart-active');
            if (absDiff <= 0.5) { card.classList.add('bg-perfect'); trendEl.innerHTML = `<span style="color:var(--perfect)">●</span>${driftHtml}`; }
            else if (absDiff <= 2) { card.classList.add('bg-success'); trendEl.innerHTML = `<span style="color:var(--success)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>${driftHtml}`; }
            else if (absDiff <= 3) { card.classList.add('bg-warning'); trendEl.innerHTML = `<span style="color:var(--warning)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>`; }
            else { card.classList.add('bg-danger'); trendEl.innerHTML = `<span style="color:var(--danger)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>`; }
            weights.push(currW); count++;
        } else {
            resText.innerText = `${window.t('newDens')} --`; hiddenVal.value = "";
            resBox.classList.remove('has-value'); trendEl.innerHTML = '';
            card.className = "lane-card";
            if (config.smart === 'on' || (config.smart === 'auto' && lane.smartActive)) card.classList.add('smart-active');
        }
    }
    if (count > 0) {
        const mean = weights.reduce((a, b) => a + b, 0) / count;
        document.getElementById('machAvg').innerText = mean.toFixed(1);
        document.getElementById('targetDisplay').innerText = `${store.target || '--'}g`;
        const deltaEl = document.getElementById('avgDelta');
        if (prevAvg !== null) {
            const delta = mean - prevAvg;
            if (Math.abs(delta) < 0.1) { deltaEl.textContent = ''; }
            else if (delta > 0) { deltaEl.textContent = '▲'; deltaEl.className = 'stat-delta delta-up'; }
            else { deltaEl.textContent = '▼'; deltaEl.className = 'stat-delta delta-down'; }
        }
        if (count > 1) {
            const v = weights.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
            document.getElementById('stdDev').innerText = Math.sqrt(v).toFixed(2);
        } else { document.getElementById('stdDev').innerText = "--"; }
    } else { document.getElementById('machAvg').innerText = "--"; document.getElementById('stdDev').innerText = "--"; }
};

// =====================================================================
// HISTORY CARDS
// =====================================================================
window.renderHistoryCards = function() {
    const container = document.getElementById('historyCards');
    if (!history || history.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.5; padding:20px; font-size:0.85rem;">--</div>';
        return;
    }
    const arr = Array.isArray(history) ? history : Object.values(history);
    container.innerHTML = arr.map((r, idx) => {
        const laneGrid = r.lanes.map((l, li) => `
            <div class="hist-lane-cell">
                <span class="hist-lane-lbl">L${li+1}</span>
                <span class="hist-lane-wt">${l.w}</span>
                <span class="hist-lane-dens">${l.d}</span>
            </div>`).join('');
        return `
        <div class="hist-card" id="hcard-${idx}">
            <div class="hist-card-header" onclick="window.toggleHistCard(${idx})">
                <div>
                    <span class="hist-card-time">${r.time}</span>
                    ${r.operator ? `<span style="font-size:0.72rem; opacity:0.6; margin-left:8px;">by ${r.operator}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="hist-card-avg">Avg: <strong>${r.avg}g</strong></span>
                    <span class="hist-card-chevron">▼</span>
                </div>
            </div>
            <div class="hist-card-body">
                <div style="font-size:0.72rem; opacity:0.55; margin-bottom:4px;">${window.t('target')}: ${r.target || '--'}g</div>
                <div class="hist-lane-grid">${laneGrid}</div>
            </div>
        </div>`;
    }).join('');
};

window.toggleHistCard = function(idx) { document.getElementById(`hcard-${idx}`).classList.toggle('expanded'); };

window.checkAutoSave = function() {
    let currentCombo = "", allFilled = true;
    for (let i = 1; i <= config.lanes; i++) {
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
};

window.saveToHistory = function() {
    const time      = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const timestamp = Date.now();
    const avg       = document.getElementById('machAvg') ? document.getElementById('machAvg').innerText : '--';
    prevAvg         = parseFloat(avg) || null;
    const opName    = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    let row = { time, timestamp, avg, operator: opName, target: store.target, lanes: [] };
    for (let i = 1; i <= config.lanes; i++) {
        const wt   = store.lanes[i-1] ? store.lanes[i-1].w : '';
        const calc = document.getElementById(`calcVal-${i}`).value;
        const dens = store.lanes[i-1] ? store.lanes[i-1].d : '';
        row.lanes.push({ w: wt ? `${wt}g` : '--', d: calc || dens || '--' });
    }
    if (!Array.isArray(history)) history = [];
    history.unshift(row);
    if (history.length > 50) history.pop();
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: History not saved."));
        push(ref(db, `shiftLedger/M${config.currentMachine}`), row).catch(e => console.warn('Ledger write:', e));
    }
    window.renderHistoryCards();
};

window.clearHistory = function() {
    if (confirm("Clear shift history?")) {
        history = [];
        if (!window.isOfflineMode && dbRef_History) {
            set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: History not cleared."));
        }
        window.renderHistoryCards();
    }
};

window.endShift = function() {
    if (confirm(window.t('endShiftConfirm'))) {
        const opName = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
        const time   = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const marker = { isMarker: true, text: `🏁 SHIFT ENDED BY ${opName.toUpperCase()}`, timestamp: Date.now(), time };
        if (!window.isOfflineMode && db) push(ref(db, `shiftLedger/M${config.currentMachine}`), marker).catch(e => console.warn('Marker write:', e));
        history = [];
        lastAutoSaveCombo = "";
        if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
        if (!window.isOfflineMode && dbRef_History) set(dbRef_History, history).catch(e => console.warn(e));
        window.renderHistoryCards();
        if (store && store.lanes) {
            store.lanes.forEach(l => { l.w = ''; l.locked = true; l.smartActive = false; l.stableCount = 0; });
            if (!window.isOfflineMode && dbRef_Store) update(dbRef_Store, { lanes: store.lanes }).catch(e => console.warn(e));
            window.updateUIFromCloud();
        }
        if (typeof window.clearYieldInputs === 'function') window.clearYieldInputs();
        window.showAdminToast("🏁 Shift Ended & Board Cleared.");
    }
};

// =====================================================================
// LANE ACTIONS
// =====================================================================
window.toggleDensitySign = function(i) {
    const el = document.getElementById(`currDens-${i}`);
    if (el.readOnly) { window.showAdminToast("⚠️ Unlock density to change sign."); return; }
    let val = parseFloat(el.value);
    if (isNaN(val) || val === 0) return;
    val = val * -1;
    el.value = val.toFixed(3);
    store.lanes[i-1].d = String(val.toFixed(3));
    window.calculateLocal();
    window.pushLaneToCloud(i);
};

window.applyResult = function(idx) {
    const val   = document.getElementById(`calcVal-${idx}`).value;
    const lane  = store.lanes[idx-1];
    const currD = parseFloat(lane.d), currW = parseFloat(lane.w);
    if (val && !isNaN(currD)) {
        window.saveToHistory();
        lane.lastD = currD; lane.lastW = currW;
        const target = parseFloat(store.target);
        if (Math.abs(currW - target) > 2) {
            lane.attempts++; lane.stableCount = 0;
            if (config.smart === 'auto' && lane.attempts >= 2) lane.smartActive = true;
        } else {
            lane.attempts = 0;
            if (Math.abs(currW - target) <= 1.0) {
                lane.stableCount = (lane.stableCount || 0) + 1;
                if (config.smart === 'auto' && lane.smartActive && lane.stableCount >= 2) {
                    lane.smartActive = false; lane.lastD = null; lane.lastW = null;
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                }
            } else { lane.stableCount = 0; }
        }
        lane.d = val; lane.w = ''; lane.locked = true;
        if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
        lastAutoSaveCombo = "";
        const card = document.getElementById(`card-${idx}`);
        card.classList.add('apply-flash');
        setTimeout(() => card.classList.remove('apply-flash'), 300);
        if (navigator.vibrate) navigator.vibrate([60]);
        window.calculateLocal();
        window.pushLaneToCloud(idx);
    }
};

window.unlockAndFocus = function(i) {
    const el = document.getElementById(`currDens-${i}`);
    el.readOnly = false; el.focus(); el.style.borderColor = 'var(--info)';
    store.lanes[i-1].locked = false;
    window.pushLaneToCloud(i);
    if (config.inputMode === 'button') { document.getElementById(`lockDens-${i}`).className = 'btn-icon'; document.getElementById(`lockDens-${i}`).innerText = '🔓'; }
};

window.toggleLock = function(i) {
    store.lanes[i-1].locked = !store.lanes[i-1].locked;
    const el = document.getElementById(`currDens-${i}`);
    if (!store.lanes[i-1].locked) { el.readOnly = false; setTimeout(() => { el.focus(); el.style.borderColor = 'var(--info)'; }, 50); }
    else { el.readOnly = true; el.style.borderColor = 'var(--border)'; }
    window.pushLaneToCloud(i);
};

window.handleInput = function(i) { store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value; window.calculateLocal(); };

window.handleWeightInput = function(i) {
    store.lanes[i-1].w = document.getElementById(`avgWt-${i}`).value;
    window.calculateLocal();
    clearTimeout(window.weightDebounceTimers[i]);
    window.weightDebounceTimers[i] = setTimeout(() => window.pushLaneToCloud(i), 600);
};

window.lockOnBlur = function(i) { setTimeout(() => { if (document.activeElement === document.getElementById(`currDens-${i}`)) return; store.lanes[i-1].locked = true; store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value; window.pushLaneToCloud(i); }, 150); };

window.recheckLane = function(idx) {
    if (isAdmin) {
        if (!confirm(`⚠️ WIPE WEIGHT DATA?\nAre you sure you want to delete the operator's weight for Lane ${idx}?`)) return;
    }
    store.lanes[idx-1].w = '';
    document.getElementById(`avgWt-${idx}`).value = '';
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    lastAutoSaveCombo = "";
    if (!isAdmin) document.getElementById(`avgWt-${idx}`).focus();
    window.calculateLocal();
    window.pushLaneToCloud(idx);
};

window.unlockWeightAndFocus = function(i) {
    if (!isAdmin) return;
    const el = document.getElementById(`avgWt-${i}`);
    el.readOnly = false; el.focus(); el.style.borderColor = 'var(--info)';
};

window.lockWeightOnBlur = function(i) {
    if (!isAdmin) return;
    clearTimeout(window.weightDebounceTimers[i]);
    setTimeout(() => {
        const el = document.getElementById(`avgWt-${i}`);
        if (document.activeElement === el) return;
        el.readOnly = true; el.style.borderColor = 'var(--border)';
    }, 150);
};

// =====================================================================
// TARGET CONFIRMATION
// =====================================================================
window.onTargetInput = function() {
    const newVal = document.getElementById('setTarget').value;
    if (store.target && store.target !== newVal && store.lanes && store.lanes.some(l => l.w)) {
        pendingTargetValue = newVal;
        document.getElementById('targetConfirm').classList.add('show');
    } else { window.applyTargetNow(newVal); }
};
window.confirmTargetChange = function() { if (pendingTargetValue !== null) { window.applyTargetNow(pendingTargetValue); pendingTargetValue = null; } document.getElementById('targetConfirm').classList.remove('show'); };
window.cancelTargetChange  = function() { document.getElementById('setTarget').value = store.target || ''; pendingTargetValue = null; document.getElementById('targetConfirm').classList.remove('show'); };
window.applyTargetNow      = function(val) { store.target = val; document.getElementById('displayTarget').innerText = `${window.t('target')}: ${val}g`; document.getElementById('targetDisplay').innerText = `${val}g`; window.calculateLocal(); window.pushTargetToCloud(); };

// =====================================================================
// SETTINGS
// =====================================================================
window.toggleSettings = function() {
    const m = document.getElementById('settingsMenu');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
    if (m.style.display === 'flex') {
        if (document.getElementById('setDispName')) document.getElementById('setDispName').value = config.displayName || '';
        if (document.getElementById('setSmart'))    document.getElementById('setSmart').value = config.smart || 'auto';
        if (document.getElementById('setTheme'))    document.getElementById('setTheme').value = config.theme || 'light';
        if (document.getElementById('setTarget') && store.target) document.getElementById('setTarget').value = store.target;
        document.getElementById('targetConfirm').classList.remove('show');
    }
};
window.saveLocalSettings = function() {
    if (document.getElementById('setMachines')) config.machines   = parseInt(document.getElementById('setMachines').value);
    if (document.getElementById('setLanes'))    config.lanes      = parseInt(document.getElementById('setLanes').value);
    if (document.getElementById('setProd'))     config.product    = document.getElementById('setProd').value;
    if (document.getElementById('setSmart'))    config.smart      = document.getElementById('setSmart').value;
    if (document.getElementById('setInputMode'))config.inputMode  = document.getElementById('setInputMode').value;
    if (document.getElementById('setTheme'))    config.theme      = document.getElementById('setTheme').value;
    localStorage.setItem('dsi_config_v11', JSON.stringify(config));
};
window.toggleTheme    = function() { config.theme = document.getElementById('setTheme').value; window.applyTheme(); window.saveLocalSettings(); };
window.saveDisplayName = function() {
    const name = document.getElementById('setDispName').value;
    config.displayName = name;
    window.saveLocalSettings();
    if (window.myUid && !window.isOfflineMode && db) {
        update(ref(db, `users/${window.myUid}`), { displayName: name }).catch(e => window.showAdminToast("❌ Network Error: Name not saved."));
    }
};
window.applyTheme = function() {
    const isDark = config.theme === 'dark';
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    const logo   = isDark ? 'logo_dark.png' : 'logo.png';
    const splash = document.getElementById('splashLogo');
    const header = document.getElementById('headerLogo');
    const about  = document.getElementById('aboutLogo');
    if (splash) { splash.src = logo; splash.style.display = 'block'; }
    if (header) {
        header.src = logo; header.style.display = 'block';
        const textTitle = document.querySelector('.brand-title');
        const moonIcon  = document.querySelector('.moon-icon');
        if (textTitle) textTitle.style.display = 'none';
        if (moonIcon)  moonIcon.style.display  = 'none';
    }
    if (about) { about.src = logo; about.style.display = 'block'; }
};
window.completeSetup  = function() { config.machines = parseInt(document.getElementById('setupMachines').value); config.lanes = parseInt(document.getElementById('setupLanes').value); config.product = document.getElementById('setupProd').value; localStorage.setItem('dsi_setup_done', 'true'); window.saveLocalSettings(); document.getElementById('setupWizard').style.display = 'none'; window.routeUserByRole(); };
window.factoryReset   = function() { if (confirm("Erase LOCAL settings? Cloud data remains.")) { localStorage.clear(); location.reload(); } };
window.switchMachine  = function(m) { config.currentMachine = m; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };
window.switchProfile  = function() { config.lanes = parseInt(document.getElementById('setLanes').value); config.product = document.getElementById('setProd').value; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };

// =====================================================================
// ADMIN
// =====================================================================
let usersDbRef;
window.openAdmin = function() {
    document.getElementById('adminModal').style.display = 'flex';
    if (!usersDbRef) {
        usersDbRef = ref(db, 'users');
        onValue(usersDbRef, (snap) => {
            const users = snap.val() || {};
            const pending = [], approved = [];
            for (const [key, data] of Object.entries(users)) {
                if (data.requestPending === true && data.approved !== true) pending.push([key, data]);
                else approved.push([key, data]);
            }
            const pendingSection = document.getElementById('adminPendingSection');
            if (pending.length > 0) {
                pendingSection.style.display = 'block';
                document.getElementById('adminPendingList').innerHTML = pending.map(([k, d]) => window.buildAdminUserCard(k, d, true)).join('');
            } else { pendingSection.style.display = 'none'; }
            document.getElementById('adminUserList').innerHTML = approved.map(([k, d]) => window.buildAdminUserCard(k, d, false)).join('');
        });
    }
};
window.buildAdminUserCard = function(key, data, highlight) {
    const isAppr    = data.approved ? 'checked' : '';
    const adminName = data.adminName || '';
    const dispName  = data.displayName || 'No Name Set';
    const role      = data.role || 'operator';
    return `
    <div class="admin-user-card" style="${highlight ? 'border-color:var(--warning);' : ''}">
        <div class="admin-user-id">ID: ${key}</div>
        <div class="admin-user-name">Device: <strong>${dispName}</strong></div>
        <input type="text" placeholder="Admin Name" value="${adminName}" onblur="window.updateAdminName('${key}', this.value)" style="margin-bottom:8px; padding:8px; font-size:0.85rem; width:100%; border:1px solid var(--border); border-radius:6px; background:var(--input-bg); color:var(--text);">
        <div class="admin-user-row">
            <select onchange="window.updateUserRole('${key}', this.value)" style="padding:6px; font-size:0.8rem; width:40%; border-radius:6px; border:1px solid var(--border); background:var(--input-bg); color:var(--text);">
                <option value="operator" ${role === 'operator' ? 'selected' : ''}>Operator</option>
                <option value="supervisor" ${role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            </select>
            <label style="display:flex; align-items:center; gap:5px; font-weight:bold; font-size:0.85rem; cursor:pointer;">
                <input type="checkbox" ${isAppr} onchange="window.toggleUserApprove('${key}', this.checked)" style="width:16px; height:16px;">
                Apprv
            </label>
            <button onclick="if(confirm('Remove this user? They will need to request access again.')) window.deleteUser('${key}')" style="background:var(--danger); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.8rem;">🗑️ Remove</button>
        </div>
        <div class="admin-user-last">Last seen: ${data.lastLogin || 'Unknown'}</div>
    </div>`;
};
window.closeAdmin         = function() { document.getElementById('adminModal').style.display = 'none'; };
window.updateAdminName    = function(uid, name) { update(ref(db, `users/${uid}`), { adminName: name }).catch(e => window.showAdminToast("❌ Error: Could not update name.")); };
window.updateUserRole     = function(uid, role) { update(ref(db, `users/${uid}`), { role }).catch(e => window.showAdminToast("❌ Error: Could not update role.")); };
window.toggleUserApprove  = function(uid, isAppr) {
    update(ref(db, `users/${uid}`), { approved: isAppr, requestPending: false })
    .then(() => { if (isAppr) { notifiedSet.delete(uid); persistNotifiedSet(); } })
    .catch(e => window.showAdminToast("❌ Error: Could not update approval."));
};
window.deleteUser = function(uid) { set(ref(db, `users/${uid}`), null).catch(e => window.showAdminToast("❌ Error: Could not delete user.")); };
window.pingAdmin  = function() {
    const nameInput = document.getElementById('reqName').value.trim();
    if (!nameInput) { alert("Please enter your name."); return; }
    update(ref(db, `users/${window.myUid}`), { displayName: nameInput, requestPending: true, requestTime: Date.now() })
        .then(() => { document.getElementById('requestForm').innerHTML = `<div style="color:var(--success); font-weight:bold; font-size:1.1rem; padding:10px;">✅ Flare Sent!<br><span style="font-size:0.8rem; color:var(--text); font-weight:normal;">Admin has been notified.</span></div>`; })
        .catch(e => window.showAdminToast("❌ Network Error: Could not send request."));
};
let notifiedSet = new Set(JSON.parse(sessionStorage.getItem('dsi_notified') || '[]'));
function persistNotifiedSet() { sessionStorage.setItem('dsi_notified', JSON.stringify([...notifiedSet])); }
window.startAdminRadar = function() {
    onValue(ref(db, 'users'), (snap) => {
        const users = snap.val() || {};
        for (let uid in users) {
            const u = users[uid];
            if (u.requestPending === true && u.approved !== true && !notifiedSet.has(uid)) {
                notifiedSet.add(uid); persistNotifiedSet();
                window.fireNativeNotification('🔑 Access Request', `${u.displayName || 'Someone'} wants access!`);
            }
        }
    });
};
window.showAdminToast = function(msg) {
    const toast = document.getElementById('adminToast');
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => toast.classList.remove('show'), 6000);
};

// =====================================================================
// INSTANT WAKE / BACKGROUND RECONNECT ENGINE
// =====================================================================
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !window.isOfflineMode && db) {
        goOnline(db);
        if (isAdmin) { window.startSupervisorSync(); window.startCloudSync(); }
        else {
            const role = window.currentUserData ? window.currentUserData.role : 'operator';
            if (role === 'supervisor') { window.startSupervisorSync(); } else { window.startCloudSync(); }
        }
        window.startCommsListener();
    }
});

// =====================================================================
// NETWORK JUMPSTART ENGINE
// =====================================================================
window.jumpstartNetwork = function() {
    if (!db) return;
    const dot = document.getElementById('statusDot');
    if (dot) dot.style.transform = 'scale(1.5)';
    window.showAdminToast('🔄 Reconnecting Radio...');
    goOffline(db);
    setTimeout(() => {
        goOnline(db);
        if (dot) dot.style.transform = 'scale(1)';
        if (isAdmin) { window.startSupervisorSync(); window.startCloudSync(); }
        else {
            const role = window.currentUserData ? window.currentUserData.role : 'operator';
            if (role === 'supervisor') { window.startSupervisorSync(); } else { window.startCloudSync(); }
        }
        window.startCommsListener();
    }, 1000);
};
