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
import {
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
} from "./shiftHistory.js";
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
    resetAutoSaveState
};
import {
    renderInterface,
    updateUIFromCloud,
    applyResult,
    toggleDensitySign,
    toggleLaneDisable,
    unlockAndFocus,
    toggleLock,
    updateBeltSpeed,
    handleInput,
    handleWeightInput,
    lockOnBlur,
    recheckLane,
    unlockWeightAndFocus,
    lockWeightOnBlur,
    onTargetInput,
    confirmTargetChange,
    cancelTargetChange,
    applyTargetNow,
    initOperatorUI
} from "./operatorUI.js";
export {
    renderInterface,
    updateUIFromCloud,
    applyResult,
    toggleDensitySign,
    toggleLaneDisable,
    unlockAndFocus,
    toggleLock,
    updateBeltSpeed,
    handleInput,
    handleWeightInput,
    lockOnBlur,
    recheckLane,
    unlockWeightAndFocus,
    lockWeightOnBlur,
    onTargetInput,
    confirmTargetChange,
    cancelTargetChange,
    applyTargetNow
};
import {
    switchMachine,
    toggleSandboxMode,
    jumpstartNetwork,
    getCloudMachine,
    getModeKey,
    toggleSettings,
    exportBetaData,
    saveLocalSettings,
    toggleTheme,
    saveDisplayName,
    applyTheme,
    completeSetup,
    factoryReset,
    openHelp,
    closeHelp,
    switchProfile,
    initMachineSettings
} from "./machineSettings.js";
export {
    switchMachine,
    toggleSandboxMode,
    jumpstartNetwork,
    getCloudMachine,
    getModeKey,
    toggleSettings,
    exportBetaData,
    saveLocalSettings,
    toggleTheme,
    saveDisplayName,
    applyTheme,
    completeSetup,
    factoryReset,
    openHelp,
    closeHelp,
    switchProfile
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
window.db              = db;
window.auth            = auth;
window.ADMIN_UID       = ADMIN_UID;
window.getConfig       = () => config;
window.getStore        = () => store;
window.setStore        = (s) => { store = s; };
window.getHistory      = () => history;
window.setHistory      = (h) => { history = h; };
window.getIsAdmin      = () => isAdmin;
window.setIsAdmin      = (v) => { isAdmin = Boolean(v); };
window.getPrevAvg      = () => prevAvg;
window.setPrevAvg      = (v) => { prevAvg = v; };
window.getDbRefStore   = () => dbRef_Store;
window.getDbRefHistory = () => dbRef_History;

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

window.weightDebounceTimers = {};
window.localWriteLocks = {};
window.betaData = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_data') : null) || '[]');
window.sessionContext = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_session_context') : null) || '{"M1":{}, "M2":{}}');
window.pendingBetaActions = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_pending') : null) || '{}');
window.FACTORS = FACTORS;

let cloudPathKey       = "";
let prevAvg            = null;

window.getCloudMachine          = getCloudMachine;
window.getModeKey               = getModeKey;
window.getCurrentShiftStartTime = getCurrentShiftStartTime;

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
// OPERATOR UI & LANE ACTIONS (Extracted to operatorUI.js)
// =====================================================================
initOperatorUI();
window.renderInterface   = renderInterface;
window.updateUIFromCloud = updateUIFromCloud;
window.applyResult       = applyResult;

// =====================================================================
// PORTIONING BRAIN — Density Math + Smart Adapt + Velocity Engine
// =====================================================================
window.calculateLocal    = calculateLocal;
window.calculateDensity  = calculateDensity;
window.calculateVelocity = calculateVelocity;

// =====================================================================
// HISTORY CARDS & GLOBAL END SHIFT ENGINE (Extracted to shiftHistory.js)
// =====================================================================
initShiftHistory();
window.saveToHistory           = saveToHistory;
window.renderHistoryCards      = renderHistoryCards;
window.performLocalWipe        = performLocalWipe;
window.triggerGlobalShiftReset = triggerGlobalShiftReset;

// =====================================================================
// MACHINE SWITCHING, SETTINGS & SANDBOX (Extracted to machineSettings.js)
// =====================================================================
initMachineSettings();
window.switchMachine     = switchMachine;
window.toggleSandboxMode = toggleSandboxMode;
window.jumpstartNetwork  = jumpstartNetwork;

// =====================================================================
// ADMIN (Extracted to adminCenter.js)
// =====================================================================
initAdminCenter();
window.openAdmin          = openAdmin;
window.buildAdminUserCard = buildAdminUserCard;
window.loginWithPin       = loginWithPin;
window.startAdminRadar    = startAdminRadar;
