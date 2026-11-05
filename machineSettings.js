import { ref, update, push, goOnline, goOffline } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// =====================================================================
// INTERNAL STATE HELPERS
// =====================================================================
function _getDb() {
    return typeof window !== 'undefined' ? window.db : null;
}

function _getAuth() {
    return typeof window !== 'undefined' ? window.auth : null;
}

function _getConfig() {
    if (typeof window !== 'undefined') {
        if (typeof window.getConfig === 'function') return window.getConfig();
        if (window.config) return window.config;
    }
    return {
        machines: 2, lanes: 4, product: 'lunch', smart: 'auto', theme: 'light',
        currentMachine: 1, lang: 'en', inputMode: 'button', displayName: ''
    };
}

function _getStore() {
    if (typeof window !== 'undefined') {
        if (typeof window.getStore === 'function') return window.getStore();
        if (window.store) return window.store;
    }
    return {};
}

function _getHistory() {
    if (typeof window !== 'undefined') {
        if (typeof window.getHistory === 'function') return window.getHistory();
        if (window.history) return window.history;
    }
    return [];
}

function _setHistory(h) {
    if (typeof window !== 'undefined') {
        if (typeof window.setHistory === 'function') window.setHistory(h);
        else window.history = h;
    }
}

function _getIsAdmin() {
    if (typeof window !== 'undefined') {
        if (typeof window.getIsAdmin === 'function') return Boolean(window.getIsAdmin());
        if (window.isAdmin !== undefined) return Boolean(window.isAdmin);
    }
    return false;
}

// =====================================================================
// MACHINE & MODE MAPPING HELPERS (SPEC.md Section 1.0)
// =====================================================================
export function getCloudMachine(machine) {
    const config = _getConfig();
    const mStr = String(machine ?? config.currentMachine ?? 1).trim();
    if (mStr === '4635' || mStr === '1' || mStr === 'M1') return 'M1';
    if (mStr === '4636' || mStr === '2' || mStr === 'M2') return 'M2';
    return mStr.startsWith('M') ? mStr : `M${mStr}`;
}

export function getModeKey(prod, lanes) {
    const config = _getConfig();
    const p = String(prod ?? config.product ?? 'lunch').trim().toLowerCase();
    const l = lanes ?? config.lanes ?? 4;
    if (p === 'lunch') return 'lunch_4L';
    if (p === 'breakfast' || p === 'bfast') return 'bfast_4L';
    if (p === 'nuggets_standard') return 'nuggets_4L';
    if (p === 'nuggets_rework_all') return 'nuggets_all';
    return `${p}_${l}L`;
}

// =====================================================================
// SETTINGS & CONFIGURATION
// =====================================================================
export function toggleSettings() {
    const config = _getConfig();
    const store = _getStore();
    const isAdmin = _getIsAdmin();
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
}

export function exportBetaData() {
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
}

export function saveLocalSettings() {
    const config = _getConfig();
    if (document.getElementById('setMachines'))  config.machines  = parseInt(document.getElementById('setMachines').value);
    if (document.getElementById('setLanes'))     config.lanes     = parseInt(document.getElementById('setLanes').value);
    if (document.getElementById('setProd'))      config.product   = document.getElementById('setProd').value;
    if (document.getElementById('setSmart'))     config.smart     = document.getElementById('setSmart').value;
    if (document.getElementById('setInputMode')) config.inputMode = document.getElementById('setInputMode').value;
    if (document.getElementById('setTheme'))     config.theme     = document.getElementById('setTheme').value;
    localStorage.setItem('dsi_config_v11', JSON.stringify(config));
}

export function toggleTheme() {
    const config = _getConfig();
    config.theme = document.getElementById('setTheme').value;
    window.applyTheme();
    window.saveLocalSettings();
}

export function saveDisplayName() {
    const config = _getConfig();
    const db = _getDb();
    const name = document.getElementById('setDispName').value;
    config.displayName = name;
    window.saveLocalSettings();
    if (window.myUid && !window.isOfflineMode && db) {
        update(ref(db, `users/${window.myUid}`), { displayName: name }).catch(e => window.showAdminToast("❌ Network Error: Name not saved."));
    }
}

export function applyTheme() {
    const config = _getConfig();
    const isDark = config.theme === 'dark';
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    const logo   = isDark ? 'logo_dark.png' : 'logo.png';
    const splash = document.getElementById('splashLogo');
    const about  = document.getElementById('aboutLogo');
    if (splash) { splash.src = logo; splash.style.display = 'block'; }
    if (about)  { about.src  = logo; about.style.display  = 'block'; }
}

export function completeSetup() {
    const config = _getConfig();
    config.machines = parseInt(document.getElementById('setupMachines').value);
    config.lanes    = parseInt(document.getElementById('setupLanes').value);
    config.product  = document.getElementById('setupProd').value;
    localStorage.setItem('dsi_setup_done', 'true');
    window.saveLocalSettings();
    document.getElementById('setupWizard').style.display = 'none';
    window.routeUserByRole();
}

export function factoryReset() {
    if (confirm("Erase LOCAL settings? Cloud data remains.")) {
        localStorage.clear();
        location.reload();
    }
}

export function openHelp() {
    window.toggleSettings();
    document.getElementById('helpModal').style.display = 'flex';
}

export function closeHelp() {
    document.getElementById('helpModal').style.display = 'none';
}

// =====================================================================
// MACHINE & PROFILE SWITCHING
// =====================================================================
export function switchMachine(m) {
    const config = _getConfig();
    const db = _getDb();
    const mNum = (m === '4635' || m === 4635 || m === 'M1') ? 1 : (m === '4636' || m === 4636 || m === 'M2') ? 2 : m;
    if (config.currentMachine === mNum) return;

    const cloudMach = window.getCloudMachine ? window.getCloudMachine(mNum) : getCloudMachine(mNum);

    let switchLog = null;
    if (window.currentUserData && window.currentUserData.role === 'operator' && window.currentUserData.defaultMachine) {
        const requiredPin = mNum === 1 ? '4635' : '4636';
        const rawPin = prompt(`Enter PIN for DSI ${mNum} to switch:`);
        const enteredPin = String(rawPin || '').trim();
        if (enteredPin !== requiredPin) {
            window.showAdminToast("❌ Incorrect PIN. Switch cancelled.");
            return;
        }

        const targetMachine = `DSI ${mNum}`;
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
            push(ref(db, `shiftLedger/${cloudMach}`), switchLog).catch(e => console.warn('Switch log write:', e));
        }
    }

    config.currentMachine = mNum;
    window.saveLocalSettings();
    window.renderInterface();
    const bsInput = document.getElementById('mainBeltSpeed');
    if (bsInput) bsInput.value = window.sessionContext?.[cloudMach]?.beltSpeed || '';
    if (!window.isOfflineMode) {
        window.startCloudSync();
        window.listenForGlobalReset(cloudMach);
    }

    if (switchLog) {
        let history = _getHistory();
        if (!Array.isArray(history)) history = [];
        history.unshift(switchLog);
        if (history.length > 50) history.pop();
        _setHistory(history);
        window.renderHistoryCards();
    }
}

export function switchProfile() {
    const config = _getConfig();
    window.departmentSnipe = { active: false };
    config.lanes   = parseInt(document.getElementById('setLanes').value);
    config.product = document.getElementById('setProd').value;
    window.saveLocalSettings();
    window.renderInterface();
    if (!window.isOfflineMode) window.startCloudSync();
}

// =====================================================================
// NETWORK JUMPSTART ENGINE
// =====================================================================
export function jumpstartNetwork() {
    const db = _getDb();
    const isAdmin = _getIsAdmin();
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
}

// =====================================================================
// OFFLINE SANDBOX ENGINE (Admin only)
// Severs Firebase connection so you can test math/UI without touching
// production data. Reconnecting pulls fresh live data from the floor.
// =====================================================================
export function toggleSandboxMode() {
    const db = _getDb();
    const config = _getConfig();
    const isAdmin = _getIsAdmin();
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
}

let logoTapCount = 0;
let logoTapTimer;

export function initMachineSettings() {
    if (typeof window !== 'undefined') {
        window.getCloudMachine   = getCloudMachine;
        window.getModeKey        = getModeKey;
        window.toggleSettings    = toggleSettings;
        window.exportBetaData    = exportBetaData;
        window.saveLocalSettings = saveLocalSettings;
        window.toggleTheme       = toggleTheme;
        window.saveDisplayName   = saveDisplayName;
        window.applyTheme        = applyTheme;
        window.completeSetup     = completeSetup;
        window.factoryReset      = factoryReset;
        window.openHelp          = openHelp;
        window.closeHelp         = closeHelp;
        window.switchMachine     = switchMachine;
        window.switchProfile     = switchProfile;
        window.jumpstartNetwork  = jumpstartNetwork;
        window.toggleSandboxMode = toggleSandboxMode;
    }

    if (typeof document !== 'undefined') {
        if (typeof document.addEventListener === 'function') {
            document.addEventListener("visibilitychange", () => {
                const db = _getDb();
                const isAdmin = _getIsAdmin();
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
        }

        if (typeof document.getElementById === 'function') {
            const attachTripleTap = (elId) => {
                const el = document.getElementById(elId);
                if (el && typeof el.addEventListener === 'function') {
                    el.addEventListener('click', () => {
                        logoTapCount++;
                        clearTimeout(logoTapTimer);

                        if (logoTapCount === 3) {
                            logoTapCount = 0;
                            const auth = _getAuth();
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
    }
}

initMachineSettings();
