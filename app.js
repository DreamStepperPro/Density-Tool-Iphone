import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, onValue, update, push, serverTimestamp, goOnline, goOffline, query, orderByChild, equalTo, startAt } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { escapeHTML } from "./utils.js";
import { calculateLocal, calculateDensity, calculateVelocity, FACTORS } from "./portionBrain.js";
export { calculateLocal, calculateDensity, calculateVelocity, FACTORS };
import {
    openAdmin,
    buildAdminUserCard,
    loginWithPin,
    startAdminRadar,
    switchAdminTab,
    closeAdmin,
    updateAdminName,
    updateUserRole,
    updateUserPin,
    showAdminDashboard,
    toggleUserApprove,
    deleteUser,
    pingAdmin,
    showAdminToast,
    initAdminCenter
} from "./adminCenter.js";
export {
    openAdmin,
    buildAdminUserCard,
    loginWithPin,
    startAdminRadar,
    switchAdminTab,
    closeAdmin,
    updateAdminName,
    updateUserRole,
    updateUserPin,
    showAdminDashboard,
    toggleUserApprove,
    deleteUser,
    pingAdmin,
    showAdminToast
};
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

const ADMIN_UID    = 'VxWEghELhyOJ1D9Thgaj5vhDKxt1';
let currentUserUid = null;
let isAdmin        = false;
let appInitialized = false;

window.isOfflineMode = false;

window.applyUIScale = function(scaleValue) {
    document.documentElement.style.setProperty('--app-scale', scaleValue);
    document.documentElement.style.fontSize = (scaleValue * 16) + 'px';
    const scalePercent = Math.round(scaleValue * 100) + '%';
    const scaleValueEl = document.getElementById('uiScaleValue');
    if (scaleValueEl) scaleValueEl.textContent = scalePercent;
    const scaleSlider = document.getElementById('uiScaleSlider');
    if (scaleSlider && scaleSlider.value !== scaleValue) scaleSlider.value = scaleValue;

    localStorage.setItem('densityAppScale', scaleValue);
};

window.appLogs = [];
const maxLogs = 50;

const originalError = console.error;
console.error = function(...args) {
    window.appLogs.push(`[${new Date().toISOString()}] ERROR: ${args.join(' ')}`);
    if (window.appLogs.length > maxLogs) window.appLogs.shift();
    originalError.apply(console, args);
};

const originalWarn = console.warn;
console.warn = function(...args) {
    window.appLogs.push(`[${new Date().toISOString()}] WARN: ${args.join(' ')}`);
    if (window.appLogs.length > maxLogs) window.appLogs.shift();
    originalWarn.apply(console, args);
};

window.onerror = function(message, source, lineno, colno, error) {
    window.appLogs.push(`[${new Date().toISOString()}] UNCAUGHT: ${message} at ${source}:${lineno}:${colno}`);
    if (window.appLogs.length > maxLogs) window.appLogs.shift();
};

window.showDebugLogs = function() {
    document.getElementById('debugLogOutput').value = window.appLogs.join('\n');
    document.getElementById('debugModal').style.display = 'block';
};

// =====================================================================
// SHARED STATE GETTERS — used by split modules (comms, supervisor, etc.)
// These closures always return the CURRENT value of each variable.
// =====================================================================
window.db          = db;
window.auth        = auth;
window.ADMIN_UID   = ADMIN_UID;
window.getConfig   = () => config;
window.getStore    = () => store;
window.setStore    = (s) => { store = s; };
window.getHistory  = () => history;
window.getIsAdmin  = () => isAdmin;
window.setIsAdmin  = (v) => { isAdmin = Boolean(v); };
window.getPrevAvg  = () => prevAvg;
window.setPrevAvg  = (v) => { prevAvg = v; };

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

    const userRef = ref(db, `users/${currentUserUid}`);
    update(userRef, { lastLogin: new Date().toLocaleString() }).catch(e => console.warn(e));

    onValue(userRef, (snap) => {
        const userData = snap.val() || {};
        window.currentUserData = userData;
        const userRole = (userData.role || 'operator').toString().replace(/['"]+/g, '').trim().toLowerCase();

        isAdmin = (userRole === 'admin');
        window.myUid = currentUserUid;

        if (isAdmin) {
            document.getElementById('btnAdmin')?.classList.remove('btn-hidden');
            document.getElementById('btnAdminSup')?.classList.remove('btn-hidden');
            if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.remove('btn-hidden');
            if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.remove('btn-hidden');
            window.startAdminRadar();
        } else {
            document.getElementById('btnAdmin')?.classList.add('btn-hidden');
            document.getElementById('btnAdminSup')?.classList.add('btn-hidden');
            if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.add('btn-hidden');
            if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.add('btn-hidden');
        }

        const isApproved = window.currentUserData.approved === true;
        if (isAdmin || isApproved) {
            document.getElementById('accessDeniedOverlay').style.display = 'none';
            document.getElementById('statusDot').className = "status-dot status-online";
            if (document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-online";
            document.getElementById('btnSos').style.display = 'flex';
            if (!appInitialized) {
                appInitialized = true;
                window.initApp();
                typeof window.startCommsListener === "function" && window.startCommsListener();
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
let pressTimer;

window.weightDebounceTimers = {};
window.localWriteLocks = {};
window.betaData = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_data') : null) || '[]');
window.sessionContext = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_session_context') : null) || '{"M1":{}, "M2":{}}');
window.pendingBetaActions = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_pending') : null) || '{}');
window.FACTORS = FACTORS;

let autoSaveTimer      = null;
let lastAutoSaveCombo  = "";
let cloudPathKey       = "";
let prevAvg            = null;
let pendingTargetValue = null;
let localSessionStartTime = Date.now(); // Global End Shift: marks when this tablet session started
let unsubGlobalReset   = null;          // Global End Shift: holds the Firebase reset listener

window.getCloudMachine = function(machine) {
    const mStr = String(machine ?? config.currentMachine ?? 1).trim();
    if (mStr === '4635' || mStr === '1' || mStr === 'M1') return 'M1';
    if (mStr === '4636' || mStr === '2' || mStr === 'M2') return 'M2';
    return mStr.startsWith('M') ? mStr : `M${mStr}`;
};

window.getModeKey = function(prod, lanes) {
    const p = String(prod ?? config.product ?? 'lunch').trim().toLowerCase();
    const l = lanes ?? config.lanes ?? 4;
    if (p === 'lunch') return 'lunch_4L';
    if (p === 'breakfast' || p === 'bfast') return 'bfast_4L';
    if (p === 'nuggets_standard') return 'nuggets_4L';
    if (p === 'nuggets_rework_all') return 'nuggets_all';
    return `${p}_${l}L`;
};

window.getCurrentShiftStartTime = function() {
    const now = new Date();
    const shift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0);
    if (now.getHours() < 22) {
        shift.setDate(shift.getDate() - 1);
    }
    return shift.getTime();
};

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
    typeof window.applyTranslations === 'function' && window.applyTranslations();

    const savedScale = localStorage.getItem('densityAppScale');
    if (savedScale) {
        window.applyUIScale(parseFloat(savedScale));
    } else {
        window.applyUIScale(1.0);
    }

    let el;
    if ((el = document.getElementById('setMachines'))) el.value = config.machines;
    if ((el = document.getElementById('setLanes'))) el.value = config.lanes;
    if ((el = document.getElementById('setProd'))) el.value = config.product;
    if ((el = document.getElementById('setSmart'))) el.value = config.smart;
    if ((el = document.getElementById('setInputMode'))) el.value = config.inputMode;
    if ((el = document.getElementById('setTheme'))) el.value = config.theme;
    if ((el = document.getElementById('setDispName'))) el.value = config.displayName || '';
    window.departmentSnipe = { active: false };

    const bsInput = document.getElementById('mainBeltSpeed');
    if (bsInput) bsInput.value = window.sessionContext[`M${config.currentMachine || 1}`]?.beltSpeed || '';

    const hasSetup = localStorage.getItem('dsi_setup_done');
    if (!hasSetup) document.getElementById('setupWizard').style.display = 'flex';
    else window.routeUserByRole();
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; }, 600); }
    }, 2500);
};

let hasAutoLanded = false;

window.routeUserByRole = function() {
    const role = window.currentUserData.role || 'operator';

    // Auto-landing on Default Machine
    if (!hasAutoLanded) {
        const defaultMach = window.currentUserData.defaultMachine;
        if (defaultMach === '4635') {
            config.currentMachine = 1;
        } else if (defaultMach === '4636') {
            config.currentMachine = 2;
        }
        hasAutoLanded = true;
    }

    document.getElementById('globalStatsBar').style.display = 'flex';
    if (isAdmin || role === 'supervisor') {
        if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.remove('btn-hidden');
        if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.remove('btn-hidden');
        if (document.getElementById('btnMaintSup')) document.getElementById('btnMaintSup').classList.remove('btn-hidden');
        if (document.getElementById('btnMetricsSup')) document.getElementById('btnMetricsSup').classList.remove('btn-hidden');
    }
    if (isAdmin) {
        document.getElementById('supervisorDashboard').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        document.getElementById('appContent').style.filter = 'none';
        const sandboxBtn = document.getElementById('btnSandboxToggle');
        if (sandboxBtn) sandboxBtn.classList.remove('btn-hidden');
        if (!window.isOfflineMode) {
            window.startSupervisorSync();
            window.startCloudSync();
            window.listenForGlobalReset(`M${config.currentMachine}`);
        }
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
let unsubStore = null, unsubHistory = null, unsubSnipe = null;
let dbRef_Store = null, dbRef_History = null;
window.departmentSnipe = { active: false }; // Initialize before listener fires

window.startCloudSync = function() {
    if (!db) { setTimeout(window.startCloudSync, 500); return; }
    const cloudMach = window.getCloudMachine ? window.getCloudMachine(config.currentMachine) : `M${config.currentMachine}`;
    const modeKey   = window.getModeKey ? window.getModeKey(config.product, config.lanes) : `${config.product}_${config.lanes}L`;
    cloudPathKey = `${cloudMach}/${modeKey}`;
    if (unsubStore) unsubStore();
    if (unsubHistory) unsubHistory();
    dbRef_Store   = ref(db, `stores/${cloudPathKey}`);
    dbRef_History = ref(db, `histories/${cloudPathKey}`);
    unsubStore = onValue(dbRef_Store, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            // State Preservation: Inject locked local data into the incoming payload before memory overwrite
            if (store && store.lanes && val.lanes) {
                for (let i = 1; i <= config.lanes; i++) {
                    if (window.localWriteLocks[i] && (Date.now() - window.localWriteLocks[i] < 1500)) {
                        if (val.lanes[i-1] && store.lanes[i-1]) {
                            val.lanes[i-1].w = store.lanes[i-1].w;
                            val.lanes[i-1].d = store.lanes[i-1].d;
                            val.lanes[i-1].locked = store.lanes[i-1].locked;
                        }
                    }
                }
            }
            store = val;
            window.updateUIFromCloud();
        }
        else {
            if (!store.target) {
                const defaultTarget = config.product === 'bfast' ? '63' : '102';
                store = { target: defaultTarget, lastUpdated: Date.now(), lanes: Array(config.lanes).fill().map(() => ({ d:'', w:'', attempts:0, smartActive:false, lastD:null, lastW:null, locked:true })) };
                set(dbRef_Store, store).catch(e => window.showAdminToast("❌ Error initializing machine."));
            }
        }
    });

    const shiftStart = typeof window.getCurrentShiftStartTime === 'function' ? window.getCurrentShiftStartTime() : 0;
    const historyQuery = query(dbRef_History, orderByChild('timestamp'), startAt(shiftStart));
    unsubHistory = onValue(historyQuery, (snapshot) => {
        const val = snapshot.val();
        history = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
        if (Array.isArray(history)) {
            history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
        window.renderHistoryCards();
    });
    // Snipe receiver — listen for supervisor broadcast, update UI when state changes
    if (unsubSnipe) { unsubSnipe(); unsubSnipe = null; }
    unsubSnipe = onValue(ref(db, 'stores/departmentSnipe'), (snapshot) => {
        let newSnipe = snapshot.val() || { active: false };
        if (newSnipe.active && newSnipe.product && newSnipe.product !== config.product) {
            newSnipe = { active: false };
        }
        const oldSnipe = window.departmentSnipe || { active: false };
        window.departmentSnipe = newSnipe;
        // Vibrate & toast only if THIS machine just became a new snipe target
        if (newSnipe.active && config.currentMachine === newSnipe.machine) {
            const isNewTarget = !oldSnipe.active
                || oldSnipe.machine !== newSnipe.machine
                || oldSnipe.lane !== newSnipe.lane;
            if (isNewTarget) {
                window.showAdminToast(`🚨 SMART-S OVERRIDE: Lane ${newSnipe.lane} Targeted.`);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
            }
        }
        // Gate re-renders — only update UI if this machine is involved in the snipe change
        if ((newSnipe.active && newSnipe.machine === config.currentMachine) ||
            (oldSnipe.active && oldSnipe.machine === config.currentMachine)) {
            window.updateUIFromCloud();
        }
    });
};

window.pushLaneToCloud = function(idx) {
    if (!dbRef_Store || window.isOfflineMode) return;
    document.getElementById('statusDot').className = "status-dot status-syncing";
    const updates = {};
    const lane = store.lanes[idx-1];
    const now = Date.now();
    updates[`lanes/${idx-1}/d`]           = lane.d;
    updates[`lanes/${idx-1}/w`]           = lane.w;
    updates[`lanes/${idx-1}/locked`]      = lane.locked;
    updates[`lanes/${idx-1}/disabled`]    = lane.disabled || false;
    updates[`lanes/${idx-1}/attempts`]    = lane.attempts ?? 0;
    updates[`lanes/${idx-1}/smartActive`] = lane.smartActive ?? false;
    updates[`lanes/${idx-1}/lastD`]       = lane.lastD !== null && lane.lastD !== undefined ? Number(lane.lastD) : null;
    updates[`lanes/${idx-1}/lastW`]       = lane.lastW !== null && lane.lastW !== undefined ? Number(lane.lastW) : null;
    updates[`lanes/${idx-1}/stableCount`] = lane.stableCount ?? 0;
    updates[`lanes/${idx-1}/lastUpdated`] = now;
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
    let el;
    if ((el = document.getElementById('setMachines'))) el.value = config.machines;
    if ((el = document.getElementById('setLanes'))) el.value = config.lanes;
    if ((el = document.getElementById('setProd'))) el.value = config.product;
    if ((el = document.getElementById('setSmart'))) el.value = config.smart;
    if ((el = document.getElementById('setInputMode'))) el.value = config.inputMode;
    if ((el = document.getElementById('setTheme'))) el.value = config.theme;
    if ((el = document.getElementById('setDispName'))) el.value = config.displayName || '';
    const container = document.getElementById('lanesContainer');
    container.innerHTML = '';
    for (let i = 1; i <= config.lanes; i++) {
        let labelText = window.t('density');
        if (config.inputMode === 'longpress' && !isAdmin) labelText += " (HOLD)";
        if ((config.inputMode === 'doubletap' && !isAdmin) || isAdmin) labelText += " (×2)";
        let btnHtml = config.inputMode === 'button' && !isAdmin
            ? `<button class="btn-icon" id="lockDens-${i}" aria-label="Toggle density lock for lane ${i}" onmousedown="event.preventDefault()" onclick="window.toggleLock(${i})">🔒</button>`
            : `<button class="btn-icon btn-hidden" id="lockDens-${i}" aria-label="Toggle density lock for lane ${i}">🔒</button>`;
        let weightHtml = `<input type="number" id="avgWt-${i}" inputmode="decimal" oninput="window.handleWeightInput(${i})" onblur="clearTimeout(window.weightDebounceTimers[${i}]); window.pushLaneToCloud(${i}); window.checkAutoSave()">`;
        if (isAdmin) {
            weightHtml = `<input type="number" id="avgWt-${i}" class="density-input" inputmode="decimal" readonly oninput="window.handleWeightInput(${i})" onblur="window.checkAutoSave(); window.lockWeightOnBlur(${i})">`;
        }
        container.innerHTML += `
            <div class="lane-card" id="card-${i}">
                <div class="lane-header">
                    <div class="lane-header-left"><span>${window.t('lane')} ${i}</span><span class="smart-tag" id="tag-${i}">SMART</span><button class="btn-icon" id="btnDisable-${i}" onclick="window.toggleLaneDisable(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" aria-label="Toggle Lane Power" title="Toggle Lane Power">⊘</button>${isAdmin ? `<button class="btn-icon" onclick="window.openLaneProfiler(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" aria-label="Lane ${i} Diagnostics" title="Lane Diagnostics">🔍</button>` : ""}</div>
                    <span class="lane-trend" id="trend-${i}"></span>
                </div>
                <div>
                    <label for="currDens-${i}">${labelText}</label>
                    <div class="input-group">
                        <button class="btn-icon" tabindex="-1" aria-label="Toggle density sign for lane ${i}" onclick="window.toggleDensitySign(${i})" style="min-width:38px; padding:0; font-weight:bold; background:var(--input-bg);">±</button>
                        <input type="number" id="currDens-${i}" class="density-input" step="0.001" readonly inputmode="decimal" oninput="window.handleInput(${i})" onblur="window.lockOnBlur(${i})">
                        ${btnHtml}
                    </div>
                </div>
                <div>
                    <label for="avgWt-${i}">${window.t('avgWt')} ${isAdmin ? '(×2)' : ''}</label>
                    <div class="input-group">
                        ${weightHtml}
                        <button class="btn-icon btn-recheck" aria-label="Recheck lane ${i}" onclick="window.recheckLane(${i})">↻</button>
                    </div>
                </div>
                <div class="result-box" id="resBox-${i}" role="button" tabindex="0" aria-label="Apply new density for lane ${i}" onclick="window.applyResult(${i})" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); window.applyResult(${i}); }">
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
    if (tEl && document.activeElement !== tEl) {
        tEl.value = store.target;
        const dispT = document.getElementById('displayTarget');
        if (dispT) dispT.innerText = `${window.t('target')}: ${store.target}g`;
        const targetD = document.getElementById('targetDisplay');
        if (targetD) targetD.innerText = `${store.target}g`;
    }
    for (let i = 1; i <= config.lanes; i++) {
        const lane = store.lanes[i-1];
        if (!lane) continue;

        // Write Lock Check: Ignore cloud updates for this lane if edited locally within 1.5s
        if (window.localWriteLocks[i] && (Date.now() - window.localWriteLocks[i] < 1500)) {
            continue;
        }

        const dEl = document.getElementById(`currDens-${i}`);
        if (dEl && document.activeElement === dEl) {
            continue;
        }
        if (dEl) {
            dEl.value = lane.d;
            if (lane.locked) {
                dEl.readOnly = true; dEl.style.borderColor = 'var(--border)';
                const lockD = document.getElementById(`lockDens-${i}`);
                if (lockD && config.inputMode === 'button') { lockD.className = 'btn-icon locked'; lockD.innerText = '🔒'; }
            } else {
                dEl.readOnly = false; dEl.style.borderColor = 'var(--info)';
                const lockD = document.getElementById(`lockDens-${i}`);
                if (lockD && config.inputMode === 'button') { lockD.className = 'btn-icon'; lockD.innerText = '🔓'; }
            }
        }
        const wEl = document.getElementById(`avgWt-${i}`);
        if (wEl && document.activeElement === wEl) {
            continue;
        }
        if (wEl) {
            wEl.value = lane.w || '';
            if (isAdmin) { wEl.readOnly = true; wEl.style.borderColor = 'var(--border)'; }
        }
        const card   = document.getElementById(`card-${i}`);
        const btnDis = document.getElementById(`btnDisable-${i}`);
        if (card && lane.disabled) {
            card.classList.add('lane-disabled');
            if (btnDis) { btnDis.innerText = '⊘ OFF'; btnDis.style.color = 'var(--danger)'; }
            if (dEl) dEl.disabled = true; if (wEl) wEl.disabled = true;
        } else if (card) {
            card.classList.remove('lane-disabled');
            if (btnDis) { btnDis.innerText = '⊘'; btnDis.style.color = ''; }
            if (dEl) dEl.disabled = false; if (wEl) wEl.disabled = false;
        }
        const isSnipeLane = window.departmentSnipe && window.departmentSnipe.active
            && config.currentMachine === window.departmentSnipe.machine
            && i === window.departmentSnipe.lane;
        const tagEl = document.getElementById(`tag-${i}`);
        if (isSnipeLane) {
            card.classList.add('smart-active');
            card.style.boxShadow = '0 0 12px var(--danger)';
            if (tagEl) { tagEl.innerText = 'SMART-S'; tagEl.style.background = 'var(--danger)'; }
        } else {
            card.style.boxShadow = '';
            if (config.smart === 'on' || (config.smart === 'auto' && lane.smartActive)) {
                card.classList.add('smart-active');
            } else {
                card.classList.remove('smart-active');
            }
            if (tagEl) { tagEl.innerText = 'SMART'; tagEl.style.background = ''; }
        }
    }
    window.calculateLocal();
};

// =====================================================================
// PORTIONING BRAIN — Density Math + Smart Adapt + Velocity Engine
// =====================================================================
window.calculateLocal    = calculateLocal;
window.calculateDensity  = calculateDensity;
window.calculateVelocity = calculateVelocity;

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
        return `
        <div class="hist-card" id="hcard-${idx}">
            <div class="hist-card-header" role="button" tabindex="0" aria-label="Toggle history details for entry ${idx}" onclick="window.toggleHistCard(${idx})" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); window.toggleHistCard(${idx}); }">
                <div>
                    <span class="hist-card-time">${escapeHTML(r.time)}</span>
                    ${r.operator ? `<span style="font-size:0.72rem; opacity:0.6; margin-left:8px;">by ${escapeHTML(r.operator)}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn-icon" style="color:var(--danger); font-size:1rem; padding:0 5px; margin-right:8px;" onclick="event.stopPropagation(); window.deleteHistoryEntry(${idx})" aria-label="Delete history entry ${idx}" title="Delete Entry">🗑️</button>
                    <span class="hist-card-avg">Avg: <strong>${escapeHTML(r.avg)}g</strong></span>
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
        if (store.lanes[i-1] && store.lanes[i-1].disabled) continue;
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
    const machAvgEl = document.getElementById('machAvg');
    const rawAvg    = machAvgEl ? parseFloat(machAvgEl.innerText) : NaN;
    const avgStr    = !isNaN(rawAvg) ? `${rawAvg.toFixed(1)}g` : '--';
    prevAvg         = !isNaN(rawAvg) ? rawAvg : null;

    const rawTgt    = parseFloat(store && store.target !== undefined ? store.target : 102);
    const targetStr = !isNaN(rawTgt) ? `${rawTgt.toFixed(1)}g` : '--';

    const opName    = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';

    const p = String(config.product || 'lunch').toLowerCase();
    const isNugget = p.includes('nugget');

    const lanesData = [];
    for (let li = 0; li < 4; li++) {
        const laneIdx = li + 1;
        const laneObj = store && store.lanes ? store.lanes[li] : null;

        if (li >= config.lanes) {
            lanesData.push({ d: '--', w: 'OFF' });
        } else if (laneObj && laneObj.disabled) {
            lanesData.push({ d: '--', w: 'OFF' });
        } else {
            const wVal = laneObj && laneObj.w !== undefined && laneObj.w !== '' && laneObj.w !== null ? parseFloat(laneObj.w) : NaN;
            if (isNaN(wVal)) {
                // Enabled but unweighed in this check
                const currentDens = laneObj && laneObj.d !== undefined && laneObj.d !== '' && laneObj.d !== null ? laneObj.d : store.target;
                lanesData.push({ d: currentDens !== undefined && currentDens !== '' ? String(currentDens) : '--', w: '--' });
            } else {
                // Weighed lane
                const calcEl = document.getElementById(`calcVal-${laneIdx}`);
                const calc = calcEl ? calcEl.value : '';
                const dens = laneObj && laneObj.d !== undefined && laneObj.d !== '' && laneObj.d !== null ? laneObj.d : '';
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

    if (!Array.isArray(history)) history = [];
    history.unshift(row);
    if (history.length > 50) history.pop();

    if (!window.isOfflineMode && db) {
        const cloudMach = window.getCloudMachine ? window.getCloudMachine(config.currentMachine) : `M${config.currentMachine}`;
        const modeKey   = window.getModeKey ? window.getModeKey(config.product, config.lanes) : `${config.product}_${config.lanes}L`;
        const pushKey   = push(ref(db, `histories/${cloudMach}/${modeKey}`)).key;

        const updates = {};
        updates[`histories/${cloudMach}/${modeKey}/${pushKey}`] = row;
        updates[`shiftLedger/${cloudMach}/${pushKey}`] = row;

        update(ref(db), updates).catch(e => {
            console.warn('Sync check write:', e);
            window.showAdminToast("❌ Network Error: History not saved.");
        });
    }
    window.renderHistoryCards();
};

window.deleteHistoryEntry = function(idx) {
    if (!confirm(window.t('deleteEntryConfirm') || "Delete this history entry?")) return;
    history.splice(idx, 1);
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: Could not delete entry."));
    }
    window.renderHistoryCards();
    window.calculateLocal(); // Re-trigger velocity math without the bad data point
};

window.clearHistory = function() {
    if (!confirm(window.t('clearTableConfirm') || "Clear shift history?")) return;

    history = [];
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: History not cleared."));
    }
    window.renderHistoryCards();
};

// =====================================================================
// GLOBAL END SHIFT ENGINE
// =====================================================================
window.performLocalWipe = function(isRemote = false) {
    // Only write ledger marker if this tablet triggered the wipe (prevents all tablets from spamming the ledger)
    if (!isRemote) {
        const opName = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
        const time   = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const marker = { isMarker: true, text: `🏁 SHIFT ENDED BY ${opName.toUpperCase()}`, timestamp: Date.now(), time };
        if (!window.isOfflineMode && db) push(ref(db, `shiftLedger/M${config.currentMachine}`), marker).catch(e => console.warn('Marker write:', e));
    }
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
    if (!isRemote) window.showAdminToast("🏁 Shift Ended & Board Cleared.");
};

window.listenForGlobalReset = function(machineKey) {
    if (!machineKey || window.isOfflineMode) return;
    if (unsubGlobalReset) { unsubGlobalReset(); unsubGlobalReset = null; }
    const resetRef = ref(db, `stores/${machineKey}/lastShiftReset`);
    unsubGlobalReset = onValue(resetRef, (snap) => {
        const resetTimestamp = snap.val();
        // Only act if the signal was sent AFTER this tablet's session started (prevents old signals firing on boot)
        if (resetTimestamp && resetTimestamp > localSessionStartTime) {
            window.performLocalWipe(true);
            localSessionStartTime = Date.now(); // Reset so we don't trigger again
            window.showAdminToast("🏁 Shift Reset by Supervisor.");
        }
    });
};

window.flushSmartLogic = function() {
    history = [];
    window.renderHistoryCards();
    window.departmentSnipe = { active: false };

    for (let i = 1; i <= config.lanes; i++) {
        if (!store.lanes[i-1]) continue;
        store.lanes[i-1].pveVelocity = null;
        store.lanes[i-1].pveRunwayMins = null;

        const trendEl = document.getElementById(`trend-${i}`);
        if (trendEl) trendEl.innerHTML = '';
    }

    window.showAdminToast("🧹 Smart Logic Flushed: Ready for Fresh Shift.");
};

window.triggerGlobalShiftReset = function() {
    if (confirm(window.t('endShiftConfirm') || "🏁 END SHIFT?")) {
        if (window.isOfflineMode) {
            window.performLocalWipe(false);
        } else {
            window.performLocalWipe(false); // Local wipe + ledger marker
            const killTime = Date.now();
            set(ref(db, `stores/M${config.currentMachine}/lastShiftReset`), killTime)
                .catch(err => console.error("Firebase reset error:", err));
            localSessionStartTime = Date.now(); // Prevent self-trigger from the signal bouncing back
        }
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

        if (!lane.copilotSuspended) {
            lane.copilotInterventions = (lane.copilotInterventions || 0) + 1;
            if (lane.copilotInterventions >= 5) {
                lane.copilotSuspended = true;
                window.showAdminToast(`${window.t('copilotSurrender')} ${window.t('machinePrefix')}${config.currentMachine} ${window.t('lanePrefix')} ${idx}. ${window.t('copilotSurrenderDesc')}`);
            }
        }

        lane.lastD = currD; lane.lastW = currW;
        const target = parseFloat(store.target);
        if (Math.abs(currW - target) > 2) {
            lane.attempts++; lane.stableCount = 0;
            if (config.smart === 'auto' && lane.attempts >= 2) lane.smartActive = true;
            // Rule 4: Auto-Bailout — if stuck after 5 attempts, hardware is the problem
            if (config.smart === 'auto' && lane.smartActive && lane.attempts >= 5) {
                lane.smartActive = false; lane.attempts = 0; lane.lastD = null; lane.lastW = null;
                window.showAdminToast(`⚠️ ${window.t('lane')} ${idx}: Smart Adapt off. Check hardware.`);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            }
        } else {
            lane.attempts = 0;
            if (Math.abs(currW - target) <= 1.0) {
                lane.copilotInterventions = 0;
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

window.toggleLaneDisable = function(idx) {
    if (!store.lanes) return;
    const lane = store.lanes[idx-1];
    lane.disabled = !lane.disabled;
    lane.copilotInterventions = 0; lane.copilotSuspended = false;
    if (lane.disabled) {
        lane.w = ''; lane.d = ''; lane.locked = true; lane.smartActive = false;
        document.getElementById(`avgWt-${idx}`).value = '';
    }
    window.pushLaneToCloud(idx);
    window.updateUIFromCloud();
    window.checkAutoSave();
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

window.updateBeltSpeed = function(val) {
    const m = `M${config.currentMachine}`;
    if (!window.sessionContext[m]) window.sessionContext[m] = {};
    window.sessionContext[m].beltSpeed = val ? parseFloat(val) : null;
    localStorage.setItem('dsi_session_context', JSON.stringify(window.sessionContext));
};

window.handleInput = function(i) {
    window.localWriteLocks[i] = Date.now();
    store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value;
    store.lanes[i-1].copilotInterventions = 0; store.lanes[i-1].copilotSuspended = false;
    window.calculateLocal();
};

window.handleWeightInput = function(i) {
    window.localWriteLocks[i] = Date.now();
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
        if (isAdmin) {
            if (document.getElementById('btnExportBeta')) document.getElementById('btnExportBeta').style.display = 'block';
        } else {
            if (document.getElementById('btnExportBeta')) document.getElementById('btnExportBeta').style.display = 'none';
        }
        document.getElementById('targetConfirm').classList.remove('show');
    }
};
window.exportBetaData = function() {
    if (window.betaData.length === 0) { window.showAdminToast("⚠️ No beta data to export."); return; }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.betaData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dsi_beta_analytics_${Date.now()}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    if (confirm("Clear local beta data after export?")) {
        window.betaData = [];
        localStorage.removeItem('dsi_beta_data');
        window.showAdminToast("🗑️ Beta data cleared.");
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
    const about  = document.getElementById('aboutLogo');
    if (splash) { splash.src = logo; splash.style.display = 'block'; }
    if (about)  { about.src  = logo; about.style.display  = 'block'; }
};
window.completeSetup  = function() { config.machines = parseInt(document.getElementById('setupMachines').value); config.lanes = parseInt(document.getElementById('setupLanes').value); config.product = document.getElementById('setupProd').value; localStorage.setItem('dsi_setup_done', 'true'); window.saveLocalSettings(); document.getElementById('setupWizard').style.display = 'none'; window.routeUserByRole(); };
window.factoryReset   = function() { if (confirm("Erase LOCAL settings? Cloud data remains.")) { localStorage.clear(); location.reload(); } };
window.openHelp  = function() { window.toggleSettings(); document.getElementById('helpModal').style.display = 'flex'; };
window.closeHelp = function() { document.getElementById('helpModal').style.display = 'none'; };
window.switchMachine = function(m) {
    if (config.currentMachine === m) return;

    let switchLog = null;
    if (window.currentUserData && window.currentUserData.role === 'operator' && window.currentUserData.defaultMachine) {
        const requiredPin = m === 1 ? '4635' : '4636';
        const rawPin = prompt(`Enter PIN for DSI ${m} to switch:`);
        const enteredPin = String(rawPin || '').trim();
        if (enteredPin !== requiredPin) {
            window.showAdminToast("❌ Incorrect PIN. Switch cancelled.");
            return;
        }

        const targetMachine = `DSI ${m}`;
        const sourceMachine = `DSI ${config.currentMachine}`;
        const opName = window.currentUserData.adminName || window.currentUserData.displayName || "Operator";
        const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

        switchLog = {
            timestamp: Date.now(),
            operatorName: opName,
            operatorUid: window.myUid || '',
            action: `Machine Switch: ${sourceMachine} -> ${targetMachine}`,
            machine: targetMachine,
            isMarker: true,
            text: `Machine Switch: ${sourceMachine} -> ${targetMachine}`,
            time: time,
            lanes: []
        };

        if (!window.isOfflineMode && db) {
            push(ref(db, `shiftLedger/M${m}`), switchLog).catch(e => console.warn('Switch log write:', e));
        }
    }

    config.currentMachine = m;
    window.saveLocalSettings();
    window.renderInterface();
    const bsInput = document.getElementById('mainBeltSpeed');
    if (bsInput) bsInput.value = window.sessionContext[`M${m}`]?.beltSpeed || '';
    if (!window.isOfflineMode) { window.startCloudSync(); window.listenForGlobalReset(`M${m}`); }

    if (switchLog) {
        if (!Array.isArray(history)) history = [];
        history.unshift(switchLog);
        if (history.length > 50) history.pop();
        window.renderHistoryCards();
    }
};
window.switchProfile  = function() { window.departmentSnipe = { active: false }; config.lanes = parseInt(document.getElementById('setLanes').value); config.product = document.getElementById('setProd').value; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };

// =====================================================================
// ADMIN (Extracted to adminCenter.js)
// =====================================================================
initAdminCenter();
window.openAdmin          = openAdmin;
window.buildAdminUserCard = buildAdminUserCard;
window.loginWithPin       = loginWithPin;
window.startAdminRadar    = startAdminRadar;

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
        typeof window.startCommsListener === "function" && window.startCommsListener();
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
        typeof window.startCommsListener === "function" && window.startCommsListener();
    }, 1000);
};

// =====================================================================
// OFFLINE SANDBOX ENGINE (Admin only)
// Severs Firebase connection so you can test math/UI without touching
// production data. Reconnecting pulls fresh live data from the floor.
// =====================================================================
window.toggleSandboxMode = function() {
    window.isOfflineMode = !window.isOfflineMode;

    if (window.isOfflineMode) {
        goOffline(db);
        const configText = document.getElementById('displayConfig');
        if (configText) configText.innerHTML = `<span style="color:var(--warning); font-weight:900; letter-spacing:0.5px;">🧪 SANDBOX MODE (OFFLINE)</span>`;
        const dot = document.getElementById('statusDot');
        if (dot) dot.className = "status-dot status-offline";
        window.showAdminToast("🧪 Sandbox Mode ON: Database disconnected.");
    } else {
        goOnline(db);
        const prodName = config.product === 'lunch' ? window.t('lunch') : window.t('bfast');
        const configText = document.getElementById('displayConfig');
        if (configText) configText.innerText = `${config.lanes} ${window.t('lane')} • ${prodName}`;
        window.showAdminToast("🌐 Live Mode ON: Reconnected to floor.");
        // Pull fresh live data — cloud always overwrites sandbox state
        if (isAdmin) {
            window.startSupervisorSync();
            window.startCloudSync();
        } else {
            const role = window.currentUserData ? window.currentUserData.role : 'operator';
            if (role === 'supervisor') { window.startSupervisorSync(); } else { window.startCloudSync(); }
        }
        typeof window.startCommsListener === "function" && window.startCommsListener();
    }

    window.toggleSettings();
};

let logoTapCount = 0;
let logoTapTimer;

// Ensure we don't crash when running in a test environment without a full DOM.
if (typeof document !== 'undefined') {
  const attachTripleTap = (elId) => {
    const el = document.getElementById(elId);
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener('click', () => {
        logoTapCount++;
        clearTimeout(logoTapTimer);

        if (logoTapCount === 3) {
          logoTapCount = 0;
          const activeUid = auth && auth.currentUser ? auth.currentUser.uid : "No active session";
          alert(`📱 Mobile Debug Info\n\nCurrent User UID:\n${activeUid}`);
        }

        logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 1000);
      });
    }
  };

  attachTripleTap('loginHeader');
  attachTripleTap('dsiLineTitle');
  attachTripleTap('dsiLineTitleOp');
}
