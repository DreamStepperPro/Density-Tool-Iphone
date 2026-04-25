import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, onValue, update, push, serverTimestamp, goOnline, goOffline, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { escapeHTML } from "./utils.js";
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
    } else {
        // SECURITY: Physically destroy admin buttons from the DOM — prevents iOS ghost-click tap bleed
        const btnA    = document.getElementById('btnAdmin');
        const btnASup = document.getElementById('btnAdminSup');
        if (btnA)    btnA.remove();
        if (btnASup) btnASup.remove();
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
    currentMachine: 1, lang: 'en', inputMode: 'button', displayName: '', copilotEnabled: false
};

let store   = {};
let history = [];
const FACTORS = { lunch: 0.01, bfast: 0.017 };
let pressTimer;

window.weightDebounceTimers = {};
window.localWriteLocks = {};
window.betaData = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_data') : null) || '[]');
window.sessionContext = JSON.parse(localStorage.getItem('dsi_session_context') || '{"M1":{}, "M2":{}}');
window.pendingBetaActions = JSON.parse((typeof localStorage !== 'undefined' ? localStorage.getItem('dsi_beta_pending') : null) || '{}');
window.FACTORS = FACTORS;

let autoSaveTimer      = null;
let lastAutoSaveCombo  = "";
let cloudPathKey       = "";
let prevAvg            = null;
let pendingTargetValue = null;
let localSessionStartTime = Date.now(); // Global End Shift: marks when this tablet session started
let unsubGlobalReset   = null;          // Global End Shift: holds the Firebase reset listener

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

window.routeUserByRole = function() {
    const role = window.currentUserData.role || 'operator';
    document.getElementById('globalStatsBar').style.display = 'flex';
    if (isAdmin || role === 'supervisor') {
        if (document.getElementById('btnYieldOp')) document.getElementById('btnYieldOp').classList.remove('btn-hidden');
        if (document.getElementById('btnYieldSup')) document.getElementById('btnYieldSup').classList.remove('btn-hidden');
        if (document.getElementById('btnMaintSup')) document.getElementById('btnMaintSup').classList.remove('btn-hidden');
        if (document.getElementById('btnMetricsSup')) document.getElementById('btnMetricsSup').classList.remove('btn-hidden');
    }
    if (isAdmin) {
        document.getElementById('supervisorDashboard').style.display = 'block';
        document.getElementById('supervisorDashboard').style.paddingBottom = '0px';
        document.getElementById('appContent').style.display = 'block';
        document.getElementById('appContent').style.filter = 'none';
        const opHeader = document.querySelector('#appContent .header');
        if (opHeader) opHeader.style.display = 'none';
        const sandboxBtn = document.getElementById('btnSandboxToggle');
        if (sandboxBtn) sandboxBtn.classList.remove('btn-hidden');
        if (!window.isOfflineMode) { window.startSupervisorSync(); window.startCloudSync(); window.listenForGlobalReset(`M${config.currentMachine}`); }
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
    cloudPathKey = `M${config.currentMachine}/${config.product}_${config.lanes}L`;
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
    unsubHistory = onValue(dbRef_History, (snapshot) => {
        const val = snapshot.val();
        history = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
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
    updates[`lanes/${idx-1}/d`]           = lane.d;
    updates[`lanes/${idx-1}/w`]           = lane.w;
    updates[`lanes/${idx-1}/locked`]      = lane.locked;
    updates[`lanes/${idx-1}/disabled`]    = lane.disabled || false;
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
            ? `<button class="btn-icon" id="lockDens-${i}" aria-label="Toggle lock for lane ${i}" onmousedown="event.preventDefault()" onclick="window.toggleLock(${i})">🔒</button>`
            : `<button class="btn-icon btn-hidden" id="lockDens-${i}" aria-label="Toggle lock for lane ${i}">🔒</button>`;
        let weightHtml = `<input type="number" id="avgWt-${i}" inputmode="decimal" oninput="window.handleWeightInput(${i})" onblur="clearTimeout(window.weightDebounceTimers[${i}]); window.pushLaneToCloud(${i}); window.checkAutoSave()">`;
        if (isAdmin) {
            weightHtml = `<input type="number" id="avgWt-${i}" class="density-input" inputmode="decimal" readonly oninput="window.handleWeightInput(${i})" onblur="window.checkAutoSave(); window.lockWeightOnBlur(${i})">`;
        }
        container.innerHTML += `
            <div class="lane-card" id="card-${i}">
                <div class="lane-header">
                    <div class="lane-header-left"><span>${window.t('lane')} ${i}</span><span class="smart-tag" id="tag-${i}">SMART</span><button class="btn-icon" id="btnDisable-${i}" aria-label="Toggle power for lane ${i}" onclick="window.toggleLaneDisable(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" title="Toggle Lane Power">⊘</button></div>
                    <span class="lane-trend" id="trend-${i}"></span>
                </div>
                <div>
                    <label for="currDens-${i}">${labelText}</label>
                    <div class="input-group">
                        <button class="btn-icon" aria-label="Toggle density sign for lane ${i}" tabindex="-1" onclick="window.toggleDensitySign(${i})" style="min-width:38px; padding:0; font-weight:bold; background:var(--input-bg);">±</button>
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
        if (dEl && document.activeElement !== dEl) {
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
        if (wEl && document.activeElement !== wEl) {
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
window.calculateLocal = function() {
    if (!store || !store.lanes) return;
    const target  = parseFloat(store.target);
    const baseK   = FACTORS[config.product];
    let weights = [], count = 0;

    function calculateDensity(lane, currD, currW, diff, baseK, isSnipeLane, isSmart) {
        let activeK = baseK;
        if (isSmart && lane.lastD !== null && lane.lastW !== null) {
            let dDelta = currD - lane.lastD, wDelta = currW - lane.lastW;
            // Rule 1: Outlier Veto — ignore ghost swings > 15g (double-stacked, woody breast, scale error)
            if (Math.abs(wDelta) > 0.5 && Math.abs(wDelta) <= 15.0 && Math.abs(dDelta) > 0.001) {
                let observedK = dDelta / wDelta;
                // Rule 2: Sensitivity bounds — 3.5x for bfast (wild math), 3.5x for lunch too
                observedK = Math.max(baseK * 0.5, Math.min(observedK, baseK * 3.5));
                activeK = (observedK * 0.6) + (baseK * 0.4);
            }
        }
        let rawNewD;
        // Tolerance Deadband: within ±0.5g of snipe target, lock density — stop hunting
        if (isSnipeLane && Math.abs(diff) <= 0.5) {
            rawNewD = currD;
        } else {
            rawNewD = currD + (diff * activeK);
        }
        // Rule 3: Product-specific safety brake — bfast allows wider swings
        const maxStep = config.product === 'bfast' ? 0.100 : 0.080;
        let stepDelta = rawNewD - currD;
        stepDelta = Math.max(-maxStep, Math.min(maxStep, stepDelta));
        let newD = currD + stepDelta;
        lane.currentK = activeK;
        return Math.max(-0.500, Math.min(0.500, newD)); // Hard machine limits
    }

    function calculateVelocity(i, currD, currW, target) {
        let driftHtml = "";
        let runwayPct = 100;
        let runwayColor = 'transparent';
        let rawVelocity = null;
        let rawRunwayMins = null;

        if (history && history.length > 0) {
            let recentWts = [], recentTimes = [];
            for (let h = 0; h < history.length; h++) {
                const lData = history[h].lanes && history[h].lanes[i-1] ? history[h].lanes[i-1] : null;
                if (lData && lData.w && lData.w !== '--') {
                    const parsedW = parseFloat(lData.w);
                    if (isNaN(parsedW)) continue;
                    // Density Barrier — if density changed since this check, history is stale, stop lookback
                    const histD = parseFloat(lData.d);
                    if (!isNaN(histD) && Math.abs(histD - currD) > 0.005) break;
                    recentWts.push(parsedW);
                    recentTimes.push(history[h].timestamp);
                    if (recentWts.length >= 3) break;
                }
            }
            if (recentWts.length > 0 && !isNaN(currW)) {
                // Green Zone Activation
                if (Math.abs(currW - target) <= 2.0) {
                    let velocity = 0;
                    // Stabilization Override — compare against oldest point, not most recent
                    // This preserves slow steady drift signals across the full time window
                    if (recentWts.length > 1 && Math.abs(currW - recentWts[recentWts.length - 1]) <= 0.4) {
                        velocity = 0;
                    } else {
                        const oldestW    = recentWts[recentWts.length - 1];
                        const oldestTime = recentTimes[recentTimes.length - 1];
                        // Intervention Gate — ignore massive jumps, assume manual intervention
                        if (Math.abs(currW - oldestW) > 1.5) {
                            velocity = 0;
                        } else if (oldestTime) {
                            // 0.25 min floor allows accurate velocity on quick rechecks
                            const timeDiffMin = Math.max(0.25, (Date.now() - oldestTime) / 60000);
                            velocity = (currW - oldestW) / timeDiffMin;
                        }
                    }
                    rawVelocity = velocity;
                    if (Math.abs(velocity) > 0.015) {
                        let runway = 0;
                        if (velocity > 0 && currW <= (target + 2)) runway = (target + 2) - currW;
                        else if (velocity < 0 && currW >= (target - 2)) runway = currW - (target - 2);
                        if (runway > 0) {
                            const minsToDrift = Math.round(runway / Math.abs(velocity));
                            rawRunwayMins = minsToDrift;
                            runwayPct = Math.max(0, Math.min(100, (minsToDrift / 60) * 100));
                            if (minsToDrift < 120) {
                                if (minsToDrift <= 15) {
                                    runwayColor = 'var(--danger)';
                                    driftHtml = `<span class="drift-alert-critical">${window.t('weighNow')}</span>`;
                                    // Operator autonomy toast — local cooldown per lane, never touches Firebase
                                    if (minsToDrift <= 5) {
                                        const now = Date.now();
                                        if (!window._driftToastTs) window._driftToastTs = {};
                                        const lastToast = window._driftToastTs[i] || 0;
                                        if (now - lastToast > 120000) {
                                            window._driftToastTs[i] = now;
                                            window.showAdminToast(`⚠️ ${window.t('lane')} ${i}: ${window.t('driftingFast')}`);
                                            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                                        }
                                    }
                                } else {
                                    runwayColor = minsToDrift <= 30 ? 'var(--warning)' : 'var(--perfect)';
                                    driftHtml = `<span style="font-size:0.7rem; margin-left:8px; font-weight:900; color:${runwayColor};">⏳ ${minsToDrift}m</span>`;
                                }
                            }
                        } else {
                            // Already out of bounds — card color already communicates state, silence the alarm
                            runwayPct = 0;
                            runwayColor = 'transparent';
                            driftHtml = "";
                        }
                    }
                } else {
                    runwayPct = 0;
                    runwayColor = 'transparent';
                    driftHtml = "";
                }
            }
        }
        return { driftHtml, runwayPct, runwayColor, rawVelocity, rawRunwayMins };
    }

    for (let i = 1; i <= config.lanes; i++) {
        if (!store.lanes[i-1]) continue;
        if (store.lanes[i-1].disabled) { document.getElementById(`resText-${i}`).innerText = 'OFF'; continue; }

        const lane    = store.lanes[i-1];
        const currD   = parseFloat(lane.d), currW = parseFloat(lane.w);
        const resText = document.getElementById(`resText-${i}`);
        const hiddenVal = document.getElementById(`calcVal-${i}`);
        const card    = document.getElementById(`card-${i}`);
        const resBox  = document.getElementById(`resBox-${i}`);
        const trendEl = document.getElementById(`trend-${i}`);

        if (!isNaN(target) && !isNaN(currD) && !isNaN(currW)) {
            // SMART-S: if this lane is the snipe target, redirect math to the grand mean
            const isSnipeLane = window.departmentSnipe && window.departmentSnipe.active
                && config.currentMachine === window.departmentSnipe.machine
                && i === window.departmentSnipe.lane;
            const effectiveTarget = isSnipeLane ? window.departmentSnipe.grandMean : target;
            const diff    = currW - effectiveTarget;
            // Smart Adapt fires normally OR when snipe mode forces it on
            const isSmart = config.smart === 'on' || (config.smart === 'auto' && lane.smartActive) || isSnipeLane;

            let newD = calculateDensity(lane, currD, currW, diff, baseK, isSnipeLane, isSmart);

            hiddenVal.value = newD.toFixed(3);
            resText.innerText = `${window.t('newDens')} ${newD.toFixed(3)}`;
            resBox.classList.add('has-value');

            // Predictive Velocity Engine (3-point smoothed with Density Barrier)
            const { driftHtml, runwayPct, runwayColor, rawVelocity, rawRunwayMins } = calculateVelocity(i, currD, currW, target);
            lane.pveVelocity = rawVelocity;
            lane.pveRunwayMins = rawRunwayMins;

            const runwayHtml = runwayColor !== 'transparent'
                ? `<div class="runway-track"><div class="runway-fill" style="width:${runwayPct}%; background:${runwayColor};"></div></div>`
                : '';

            const absDiff = Math.abs(diff);
            card.className = "lane-card";
            if (isSmart) card.classList.add('smart-active');

            if (absDiff <= 0.5) { card.classList.add('bg-perfect'); trendEl.innerHTML = `<span style="color:var(--perfect)">●</span>${driftHtml}${runwayHtml}`; }
            else if (absDiff <= 2) { card.classList.add('bg-success'); trendEl.innerHTML = `<span style="color:var(--success)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>${driftHtml}${runwayHtml}`; }
            else if (absDiff <= 3) { card.classList.add('bg-warning'); trendEl.innerHTML = `<span style="color:var(--warning)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>${driftHtml}${runwayHtml}`; }
            else { card.classList.add('bg-danger'); trendEl.innerHTML = `<span style="color:var(--danger)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>${driftHtml}${runwayHtml}`; }

            // SMART-S override — replaces trend text with fix target (runs after PVE so it wins)
            if (isSnipeLane) {
                if (Math.abs(diff) <= 0.5) {
                    trendEl.innerHTML = `<span style="color:var(--perfect); font-weight:900; font-size:0.75rem;">🎯 LOCKED ON TARGET</span>`;
                    card.style.boxShadow = '0 0 12px var(--perfect)';
                } else {
                    trendEl.innerHTML = `<span style="color:var(--danger); font-weight:900; font-size:0.75rem;">🎯 FIX TO ${effectiveTarget.toFixed(1)}g</span>`;
                    card.style.boxShadow = '0 0 12px var(--danger)';
                }
            }
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

    if (typeof window.generateCopilotActions === 'function') {
        window.generateCopilotActions();
    }
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
                    <button class="btn-icon" aria-label="Delete history entry ${idx}" style="color:var(--danger); font-size:1rem; padding:0 5px; margin-right:8px;" onclick="event.stopPropagation(); window.deleteHistoryEntry(${idx})" title="Delete Entry">🗑️</button>
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
    const avg       = document.getElementById('machAvg') ? document.getElementById('machAvg').innerText : '--';
    prevAvg         = parseFloat(avg) || null;
    const opName    = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    let row = { time, timestamp, avg, operator: opName, target: store.target, lanes: [] };
    if (isAdmin && config.copilotEnabled) {
        for (let i = 1; i <= config.lanes; i++) {
            if (window.pendingBetaActions[i]) {
                const wt = store.lanes[i-1] ? store.lanes[i-1].w : '';
                if (wt && wt !== '--') {
                    window.pendingBetaActions[i].resultingW = wt;
                    window.betaData.push(window.pendingBetaActions[i]);
                    window.pendingBetaActions[i] = null;
                    localStorage.setItem('dsi_beta_data', JSON.stringify(window.betaData));
                    localStorage.setItem('dsi_beta_pending', JSON.stringify(window.pendingBetaActions));
                }
            }
        }
    }

    for (let i = 1; i <= config.lanes; i++) {
        if (store.lanes[i-1] && store.lanes[i-1].disabled) {
            row.lanes.push({ w: 'OFF', d: '--' });
        } else {
            const wt   = store.lanes[i-1] ? store.lanes[i-1].w : '';
            const calc = document.getElementById(`calcVal-${i}`).value;
            const dens = store.lanes[i-1] ? store.lanes[i-1].d : '';
            row.lanes.push({ w: wt ? `${wt}g` : '--', d: calc || dens || '--' });
        }
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
    if (confirm("Clear shift history?")) {
        history = [];
        if (!window.isOfflineMode && dbRef_History) {
            set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: History not cleared."));
        }
        window.renderHistoryCards();
    }
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

window.triggerGlobalShiftReset = function() {
    if (confirm(window.t('endShiftConfirm'))) {
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

        if (isAdmin && config.copilotEnabled) {
            let downC = 0;
            const faults = typeof window.getCurrentActiveDowntimes === 'function' ? window.getCurrentActiveDowntimes() : {};
            for (const id in faults) { if (id.startsWith('c')) downC++; }
            const laneState = store.lanes[idx-1];
            const isSnipe = window.departmentSnipe && window.departmentSnipe.active && window.departmentSnipe.lane === idx;
            const isSmart = config.smart === 'on' || (config.smart === 'auto' && laneState.smartActive);
            const source = isSnipe ? 'Snipe' : (isSmart ? 'SmartAdapt' : 'Manual');
            window.pendingBetaActions[idx] = { timestamp: new Date().toLocaleString(), lane: idx, target: store.target, source: source, cuttersDown: downC, initialW: laneState.w, appliedD: val, resultingW: null, appliedK: (laneState.currentK || FACTORS[config.product]), pveVelocity: laneState.pveVelocity ?? null, pveRunwayMins: laneState.pveRunwayMins ?? null, ...(window.sessionContext['M' + config.currentMachine] || {}) };
            localStorage.setItem('dsi_beta_pending', JSON.stringify(window.pendingBetaActions));
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
            document.getElementById('copilotSettingContainer').style.display = 'flex';
            if (document.getElementById('btnExportBeta')) document.getElementById('btnExportBeta').style.display = 'block';
            if (document.getElementById('setCopilot')) document.getElementById('setCopilot').checked = config.copilotEnabled === true;
        } else {
            document.getElementById('copilotSettingContainer').style.display = 'none';
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
    if (document.getElementById('setCopilot') && isAdmin) config.copilotEnabled = document.getElementById('setCopilot').checked;
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
    config.currentMachine = m;
    window.saveLocalSettings();
    window.renderInterface();
    const bsInput = document.getElementById('mainBeltSpeed');
    if (bsInput) bsInput.value = window.sessionContext[`M${m}`]?.beltSpeed || '';
    if (!window.isOfflineMode) { window.startCloudSync(); window.listenForGlobalReset(`M${m}`); }
};
window.switchProfile  = function() { window.departmentSnipe = { active: false }; config.lanes = parseInt(document.getElementById('setLanes').value); config.product = document.getElementById('setProd').value; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };

// =====================================================================
// ADMIN
// =====================================================================
let usersDbRef;
window.switchAdminTab = function(tabId) {
    document.getElementById('tabBtnRecent').classList.remove('active');
    document.getElementById('tabBtnApproved').classList.remove('active');
    document.getElementById('tabBtnUnapproved').classList.remove('active');

    document.getElementById('adminTabRecent').style.display = 'none';
    document.getElementById('adminTabApproved').style.display = 'none';
    document.getElementById('adminTabUnapproved').style.display = 'none';

    if (tabId === 'recent') {
        document.getElementById('tabBtnRecent').classList.add('active');
        document.getElementById('adminTabRecent').style.display = 'block';
    } else if (tabId === 'approved') {
        document.getElementById('tabBtnApproved').classList.add('active');
        document.getElementById('adminTabApproved').style.display = 'block';
    } else if (tabId === 'unapproved') {
        document.getElementById('tabBtnUnapproved').classList.add('active');
        document.getElementById('adminTabUnapproved').style.display = 'block';
    }
};

window.openAdmin = function() {
    // CRITICAL SECURITY GATE: Hard-stop unauthorized execution at the function level
    if (!isAdmin) {
        window.showAdminToast("⛔ Unauthorized Access Blocked.");
        console.error("Blocked unauthorized attempt to open Admin panel.");
        return;
    }
    document.getElementById('adminModal').style.display = 'flex';
    if (!usersDbRef) {
        usersDbRef = ref(db, 'users');
        onValue(usersDbRef, (snap) => {
            const users = snap.val() || {};
            const recent = [], approved = [], unapproved = [];
            const now = Date.now();
            const THREE_DAYS_MS = 259200000;

            for (const [key, data] of Object.entries(users)) {
                if (now - (data.requestTime || 0) <= THREE_DAYS_MS) {
                    recent.push([key, data]);
                } else if (data.approved === true) {
                    approved.push([key, data]);
                } else {
                    unapproved.push([key, data]);
                }
            }

            const recentList = document.getElementById('adminTabRecent');
            const approvedList = document.getElementById('adminTabApproved');
            const unapprovedList = document.getElementById('adminTabUnapproved');

            recentList.innerHTML = '';
            recent.forEach(([k, d]) => {
                recentList.appendChild(window.buildAdminUserCard(k, d, d.requestPending === true && d.approved !== true));
            });

            approvedList.innerHTML = '';
            approved.forEach(([k, d]) => {
                approvedList.appendChild(window.buildAdminUserCard(k, d, false));
            });

            unapprovedList.innerHTML = '';
            unapproved.forEach(([k, d]) => {
                unapprovedList.appendChild(window.buildAdminUserCard(k, d, false));
            });
        }, (error) => {
            console.error("Firebase permission denied:", error);
            window.showAdminToast("Access Denied: Supervisor clearance required.");
            document.getElementById('adminModal').style.display = 'none';
        });
    }
};
window.buildAdminUserCard = function(key, data, highlight) {
    const card = document.createElement('div');
    card.className = 'admin-user-card';
    if (highlight) card.style.borderColor = 'var(--warning)';

    const idDiv = document.createElement('div');
    idDiv.className = 'admin-user-id';
    idDiv.textContent = `ID: ${key}`;
    card.appendChild(idDiv);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'admin-user-name';
    nameDiv.textContent = 'Device: ';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = data.displayName || 'No Name Set';
    nameDiv.appendChild(nameStrong);
    card.appendChild(nameDiv);

    const inputsRow = document.createElement('div');
    inputsRow.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';

    const adminNameInput = document.createElement('input');
    adminNameInput.type = 'text';
    adminNameInput.placeholder = 'Admin Name';
    adminNameInput.value = data.adminName || '';
    adminNameInput.style.cssText = 'flex:2; padding:8px; font-size:0.85rem; border:1px solid var(--border); border-radius:6px; background:var(--input-bg); color:var(--text);';
    adminNameInput.addEventListener('blur', function() {
        if (window.updateAdminName) window.updateAdminName(key, this.value);
    });
    inputsRow.appendChild(adminNameInput);

    const pinInput = document.createElement('input');
    pinInput.type = 'text';
    pinInput.placeholder = 'PIN';
    pinInput.value = data.pin || '';
    pinInput.maxLength = 4;
    pinInput.inputMode = 'numeric';
    pinInput.style.cssText = 'flex:1; padding:8px; font-size:0.85rem; text-align:center; border:1px solid var(--border); border-radius:6px; background:var(--input-bg); color:var(--text); font-weight:bold; letter-spacing:4px;';
    pinInput.addEventListener('blur', function() {
        if (window.updateUserPin) window.updateUserPin(key, this.value);
    });
    inputsRow.appendChild(pinInput);

    card.appendChild(inputsRow);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'admin-user-row';

    const roleSelect = document.createElement('select');
    roleSelect.style.cssText = 'padding:6px; font-size:0.8rem; width:40%; border-radius:6px; border:1px solid var(--border); background:var(--input-bg); color:var(--text);';
    const role = data.role || 'operator';

    const optOp = document.createElement('option');
    optOp.value = 'operator';
    optOp.textContent = 'Operator';
    if (role === 'operator') optOp.selected = true;
    roleSelect.appendChild(optOp);

    const optSup = document.createElement('option');
    optSup.value = 'supervisor';
    optSup.textContent = 'Supervisor';
    if (role === 'supervisor') optSup.selected = true;
    roleSelect.appendChild(optSup);

    roleSelect.addEventListener('change', function() {
        if (window.updateUserRole) window.updateUserRole(key, this.value);
    });
    controlsRow.appendChild(roleSelect);

    const apprvLabel = document.createElement('label');
    apprvLabel.style.cssText = 'display:flex; align-items:center; gap:5px; font-weight:bold; font-size:0.85rem; cursor:pointer;';

    const apprvCheck = document.createElement('input');
    apprvCheck.type = 'checkbox';
    apprvCheck.checked = !!data.approved;
    apprvCheck.style.cssText = 'width:16px; height:16px;';
    apprvCheck.addEventListener('change', function() {
        if (window.toggleUserApprove) window.toggleUserApprove(key, this.checked);
    });

    apprvLabel.appendChild(apprvCheck);
    apprvLabel.appendChild(document.createTextNode(' Apprv'));
    controlsRow.appendChild(apprvLabel);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑️ Remove';
    removeBtn.style.cssText = 'background:var(--danger); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:0.8rem;';
    removeBtn.addEventListener('click', function() {
        if (confirm('Remove this user? They will need to request access again.')) {
            if (window.deleteUser) window.deleteUser(key);
        }
    });
    controlsRow.appendChild(removeBtn);

    card.appendChild(controlsRow);

    const lastSeenDiv = document.createElement('div');
    lastSeenDiv.className = 'admin-user-last';
    lastSeenDiv.textContent = `Last seen: ${data.lastLogin || 'Unknown'}`;
    card.appendChild(lastSeenDiv);

    return card;
};
window.closeAdmin         = function() { document.getElementById('adminModal').style.display = 'none'; };
window.updateAdminName    = function(uid, name) { update(ref(db, `users/${uid}`), { adminName: name }).catch(e => window.showAdminToast("❌ Error: Could not update name.")); };
window.updateUserRole     = function(uid, role) { update(ref(db, `users/${uid}`), { role }).catch(e => window.showAdminToast("❌ Error: Could not update role.")); };
window.updateUserPin      = function(uid, pinStr) { update(ref(db, `users/${uid}`), { pin: pinStr.trim() }).catch(e => window.showAdminToast("❌ Error: Could not update PIN.")); };

window.loginWithPin = function() {
    const pinInput = document.getElementById('loginPin');
    const pin = pinInput ? pinInput.value.trim() : '';
    if (pin.length < 4) { alert("Please enter your 4-digit PIN."); return; }
    
    const pinQuery = query(ref(db, 'users'), orderByChild('pin'), equalTo(pin));
    get(pinQuery).then((snap) => {
        let matchedProfile = null;
        let oldUid = null;
        
        if (snap.exists()) {
            const users = snap.val();
            // Since multiple users could theoretically have the same PIN initially (though unlikely),
            // find the first one that is approved.
            for (const [uid, data] of Object.entries(users)) {
                if (data.approved === true) {
                    matchedProfile = data;
                    oldUid = uid;
                    break;
                }
            }
        }
        
        if (matchedProfile) {
            const updates = {
                approved: true, requestPending: false,
                role: matchedProfile.role || 'operator',
                displayName: matchedProfile.displayName || '',
                adminName: matchedProfile.adminName || '',
                pin, lastLogin: new Date().toLocaleString()
            };
            update(ref(db, `users/${window.myUid}`), updates).then(() => {
                // Delete old ghost UID — but never delete admin or self
                if (oldUid && oldUid !== window.myUid && oldUid !== window.ADMIN_UID) {
                    set(ref(db, `users/${oldUid}`), null).catch(e => console.warn("Cleanup:", e));
                }
                if (pinInput) pinInput.value = '';
                const name = matchedProfile.adminName || matchedProfile.displayName || 'Operator';
                window.showAdminToast(`✅ Welcome back, ${name}!`);
                // onValue listener in auth block detects approved:true and hides overlay automatically
            });
        } else {
            window.showAdminToast("❌ Invalid PIN or account not approved.");
            if (pinInput) pinInput.value = '';
        }
    }).catch(() => window.showAdminToast("❌ Network error verifying PIN."));
};
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


window.generateCopilotActions = function() {
    const queue = document.getElementById('copilotQueue');
    if (!queue) return;

    if (!config.copilotEnabled || !isAdmin) {
        queue.style.display = 'none';
        queue.innerHTML = '';
        return;
    }

    if (!store || !store.lanes || isNaN(store.target)) {
        queue.style.display = 'none';
        queue.innerHTML = '';
        return;
    }

    let hasActions = false;
    let html = '';
    const target = parseFloat(store.target);
    const baseK = FACTORS[config.product] || 0.01;

    // Check downtime for current machine
    let downComponents = 0;
    if (typeof window.getCurrentActiveDowntimes === 'function') {
        const activeDowntimes = window.getCurrentActiveDowntimes();
        for (const [id, fault] of Object.entries(activeDowntimes)) {
            if (id.startsWith('c') && parseInt(id.substring(1)) >= 1 && parseInt(id.substring(1)) <= 8) {
                downComponents++;
            }
        }
    }

    store.lanes.forEach((lane, idx) => {
        const i = idx + 1;
        if (lane.disabled) return;

        const currD = parseFloat(lane.d);
        const currW = parseFloat(lane.w);

        if (isNaN(currD) || isNaN(currW)) return;

        const drift = currW - target;
        if (Math.abs(drift) > 1.5) {
            let activeK = lane.currentK || baseK;

            // Buffer math if cutters are down (e.g. reduce change severity by 10% per down cutter)
            if (downComponents > 0) {
                const buffer = 1.0 - Math.min(downComponents * 0.1, 0.5);
                activeK = activeK * buffer;
            }

            const rawNewD = currD + (drift * activeK);
            let suggestedD = rawNewD.toFixed(3);
            if (suggestedD === currD.toFixed(3)) {
                suggestedD = (currD + (drift > 0 ? -0.001 : 0.001)).toFixed(3);
            }

            hasActions = true;
            html += `
                <div class="copilot-card" style="background:var(--card-bg); border:2px solid var(--accent); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; font-size:0.9rem; color:var(--accent);">AI COPILOT</div>
                        <div style="font-size:1.1rem;">LANE ${i}: ADJUST DENSITY TO <strong>${suggestedD}</strong></div>
                    </div>
                    <button class="modal-btn" style="width:auto; padding:8px 16px; margin:0;" onclick="window.applyCopilotAction(${i}, '${suggestedD}')">APPLY</button>
                </div>
            `;
        }
    });

    if (hasActions) {
        queue.innerHTML = html;
        queue.style.display = 'flex';
    } else {
        queue.innerHTML = '';
        queue.style.display = 'none';
    }
};

window.applyCopilotAction = function(idx, suggestedDensity) {
    if (!store.lanes || !store.lanes[idx-1]) return;

    // Save current to history before applying
    window.saveToHistory();

    if (isAdmin && config.copilotEnabled) {
        let downC = 0;
        const faults = typeof window.getCurrentActiveDowntimes === 'function' ? window.getCurrentActiveDowntimes() : {};
        for (const id in faults) { if (id.startsWith('c')) downC++; }
        const laneState = store.lanes[idx-1];
        window.pendingBetaActions[idx] = { timestamp: new Date().toLocaleString(), lane: idx, target: store.target, source: 'Copilot', cuttersDown: downC, initialW: laneState.w, appliedD: suggestedDensity, resultingW: null, appliedK: (laneState.currentK || FACTORS[config.product]), pveVelocity: laneState.pveVelocity ?? null, pveRunwayMins: laneState.pveRunwayMins ?? null, ...(window.sessionContext['M' + config.currentMachine] || {}) };
        localStorage.setItem('dsi_beta_pending', JSON.stringify(window.pendingBetaActions));
    }

    const lane = store.lanes[idx-1];
    lane.lastD = parseFloat(lane.d);
    lane.lastW = parseFloat(lane.w);

    lane.d = suggestedDensity;
    lane.w = ''; // Clear operator's weight
    lane.locked = true;

    document.getElementById(`avgWt-${idx}`).value = '';

    // UI Flash
    const card = document.getElementById(`card-${idx}`);
    if (card) {
        card.classList.add('apply-flash');
        setTimeout(() => card.classList.remove('apply-flash'), 300);
    }

    if (navigator.vibrate) navigator.vibrate([60]);

    window.calculateLocal();
    window.pushLaneToCloud(idx);
};
