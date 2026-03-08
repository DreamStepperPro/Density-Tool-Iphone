import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const ADMIN_UID = 'm510406lBidDf7qCzqXEHmIKxBu2';
let currentUserUid = null;
let isAdmin = false;
let appInitialized = false;

window.isOfflineMode = false;
window.currentUserData = {};

window.forceOfflineMode = function() {
    window.isOfflineMode = true;
    document.getElementById('accessDeniedOverlay').style.display = 'none';
    if (!appInitialized) { appInitialized = true; window.initApp(); }
};

signInAnonymously(auth).then((result) => {
    currentUserUid = result.user.uid;
    window.myUid = currentUserUid;
    isAdmin = (currentUserUid === ADMIN_UID);

    if (isAdmin) {
        document.getElementById('btnAdmin').classList.remove('btn-hidden');
        document.getElementById('btnAdminSup').classList.remove('btn-hidden');
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
            document.getElementById('accessDeniedOverlay').style.display = 'flex';
            document.getElementById('userIdDisplay').innerText = currentUserUid;
            document.getElementById('btnSos').style.display = 'none';
        }
    });
}).catch((error) => {
    console.error("Firebase auth failed:", error.message);
    document.getElementById('userIdDisplay').innerText = "CONNECTION ERROR";
});

// =====================================================================
// i18n TRANSLATION ENGINE
// =====================================================================
const i18n = {
    en: {
        title: "The Advantage", target: "Target", lane: "LANE", density: "DENSITY", avgWt: "AVG WEIGHT",
        newDens: "New Density:", tapApply: "TAP TO APPLY", history: "Shift History", saveCheck: "SAVE CHECK",
        clearTable: "CLEAR TABLE", lineAvg: "LINE AVG", lineSd: "LINE SD", options: "⚙️ Options",
        dispName: "Your Display Name", targetWt: "Target Weight (g)", unlockMethod: "Unlock Method",
        machines: "Machines", config: "Configuration", prodMode: "Product Mode", smartMode: "Smart Mode",
        theme: "Theme", enableAlerts: "🔔 ENABLE SYSTEM ALERTS", reset: "FACTORY RESET (LOCAL)",
        lunch: "Lunch", bfast: "Breakfast", dispatch: "📻 Line Dispatch", weightOff: "⚖️ WEIGHT OFF",
        maintReq: "🔧 MAINTENANCE REQ", send: "SEND", radioOpen: "Radio channel open...",
        accessPending: "🔒 Access Pending", accessWait: "Your device is waiting for Admin approval.",
        identify: "Identify Yourself to Admin", pingAdmin: "PING ADMIN FOR ACCESS", workOffline: "WORK OFFLINE",
        cmdCenter: "👑 Command Center", pendingAppr: "⏳ Pending Approvals", allUsers: "All Users",
        lockBtn: "Lock Button (Default)", longPress: "Long Press (1s)", doubleTap: "Double Tap",
        dualLane: "Dual Lane", quadLane: "Quad Lane", changeTarget: "⚠️ Change target weight mid-shift?",
        enterName: "Enter your name / role...", typeMsg: "Type message...",
        errWt: "⚖️ WEIGHT OFF: Need calibration.", errMech: "🔧 MAINTENANCE: Mechanical failure."
    },
    es: {
        title: "La Ventaja", target: "Objetivo", lane: "CARRIL", density: "DENSIDAD", avgWt: "PESO PROM",
        newDens: "Nueva Densidad:", tapApply: "TOCA PARA APLICAR", history: "Historial de Turno", saveCheck: "GUARDAR",
        clearTable: "BORRAR TABLA", lineAvg: "PROM LÍNEA", lineSd: "SD LÍNEA", options: "⚙️ Opciones",
        dispName: "Tu Nombre", targetWt: "Peso Objetivo (g)", unlockMethod: "Método Desbloqueo",
        machines: "Máquinas", config: "Configuración", prodMode: "Modo Producto", smartMode: "Modo Inteligente",
        theme: "Tema", enableAlerts: "🔔 ACTIVAR ALERTAS", reset: "RESETEO DE FÁBRICA",
        lunch: "Almuerzo", bfast: "Desayuno", dispatch: "📻 Radio de Línea", weightOff: "⚖️ PESO INCORRECTO",
        maintReq: "🔧 REQ. MANTENIMIENTO", send: "ENVIAR", radioOpen: "Canal de radio abierto...",
        accessPending: "🔒 Acceso Pendiente", accessWait: "Tu dispositivo espera aprobación del Admin.",
        identify: "Identifícate al Admin", pingAdmin: "CONTACTAR ADMIN", workOffline: "TRABAJAR OFFLINE",
        cmdCenter: "👑 Centro de Mando", pendingAppr: "⏳ Aprobaciones Pendientes", allUsers: "Todos los Usuarios",
        lockBtn: "Botón Bloqueo", longPress: "Pulsar 1s", doubleTap: "Doble Toque",
        dualLane: "Dos Carriles", quadLane: "Cuatro Carriles", changeTarget: "⚠️ ¿Cambiar objetivo en medio turno?",
        enterName: "Ingresa tu nombre...", typeMsg: "Escribe un mensaje...",
        errWt: "⚖️ PESO INCORRECTO: Requiere calibración.", errMech: "🔧 MANTENIMIENTO: Falla mecánica."
    }
};

window.t = function(key) { return i18n[config.lang][key] || key; };

window.toggleLanguage = function() {
    config.lang = config.lang === 'en' ? 'es' : 'en';
    window.saveLocalSettings();
    window.applyTranslations();
};

window.applyTranslations = function() {
    document.getElementById('langToggleBtnOp').innerText = config.lang.toUpperCase();
    document.getElementById('langToggleBtnSup').innerText = config.lang.toUpperCase();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[config.lang][key]) el.innerText = i18n[config.lang][key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        const key = el.getAttribute('data-i18n-ph');
        if (i18n[config.lang][key]) el.placeholder = i18n[config.lang][key];
    });
    if (document.getElementById('lanesContainer') && document.getElementById('lanesContainer').children.length > 0) {
        window.renderInterface();
    }
    if (store && store.lanes) window.updateUIFromCloud();
    if (history && history.length > 0) window.renderHistoryCards();
    if (db && !window.isOfflineMode) window.startCommsListener();
};

let config = {
    machines: 2, lanes: 4, product: 'lunch', smart: 'auto', theme: 'light',
    currentMachine: 1, lang: 'en', inputMode: 'button', displayName: ''
};

let store = {};
let history = [];
const FACTORS = { lunch: 0.01, bfast: 0.017 };
let pressTimer;
let lastAutoSaveCombo = "";
let cloudPathKey = "";
let prevAvg = null;
let pendingTargetValue = null;

// =====================================================================
// SOS / COMMS ENGINE
// =====================================================================
let isSosOpen = false;
let unreadSos = 0;
let lastNotifiedTs = Date.now();

window.openSos = function() {
    if (window.isOfflineMode) {
        window.showAdminToast('📵 Line Dispatch unavailable offline');
        return;
    }
    document.getElementById('sosModal').style.display = 'flex';
    document.getElementById('sosBadge').style.display = 'none';
    isSosOpen = true; unreadSos = 0;
    const box = document.getElementById('chatBox');
    box.scrollTop = box.scrollHeight;
};

window.closeSos = function() {
    document.getElementById('sosModal').style.display = 'none';
    isSosOpen = false;
};

window.sendCustomComms = function() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    window.sendCommsMsg('TEXT', text);
    input.value = '';
};

window.sendCommsMsg = function(code, customText = "") {
    if (window.isOfflineMode || !db) return;
    const role = window.currentUserData.role || 'operator';
    const name = config.displayName || window.currentUserData.adminName || 'Unknown';
    const isAdminUser = (window.currentUserData && window.currentUserData.role === 'supervisor') || role === 'supervisor' || window.myUid === 'm510406lBidDf7qCzqXEHmIKxBu2';
    const machineStr = isAdminUser ? 'ADMIN' : `DSI ${config.currentMachine}`;
    
    push(ref(db, 'messages'), {
        senderUid: window.myUid, senderName: name, role, machine: machineStr,
        code, text: customText, timestamp: Date.now()
    }).then(() => {
        onValue(ref(db, 'messages'), (snap) => {
            const msgs = snap.val();
            if (!msgs) return;
            const keys = Object.keys(msgs).sort((a, b) => (msgs[a].timestamp || 0) - (msgs[b].timestamp || 0));
            if (keys.length > 100) {
                const toDelete = keys.slice(0, keys.length - 100);
                const updates = {};
                toDelete.forEach(k => { updates[`messages/${k}`] = null; });
                update(ref(db, '/'), updates).catch(e => console.warn('Prune failed:', e));
            }
        }, { onlyOnce: true });
    }).catch((error) => {
        console.error(error);
        window.showAdminToast("❌ Network Error: Message not sent.");
    });
};

let unsubComms = null;
window.startCommsListener = function() {
    if (window.isOfflineMode || !db) return;
    if (unsubComms) { unsubComms(); unsubComms = null; }
    unsubComms = onValue(ref(db, 'messages'), (snap) => {
        const msgs = snap.val() || {};
        const sorted = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp).slice(-30);
        window.renderChat(sorted);
    });
};

window.renderChat = function(messages) {
    const box = document.getElementById('chatBox');
    let html = '';
    let newMsgsCount = 0;
    messages.forEach(msg => {
        const isMe = msg.senderUid === window.myUid;
        const isErr = msg.code !== 'TEXT';
        const bubbleClass = isMe ? 'msg-me' : 'msg-them';
        const errClass = isErr ? 'msg-err' : '';
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        let displayText = msg.text;
        if (msg.code === 'ERR_WT') displayText = window.t('errWt');
        if (msg.code === 'ERR_MECH') displayText = window.t('errMech');
        html += `
        <div class="msg-bubble ${bubbleClass} ${errClass}">
            <div class="msg-meta"><span>${msg.senderName} (${msg.machine})</span><span>${timeStr}</span></div>
            ${displayText}
        </div>`;
        if (msg.timestamp > lastNotifiedTs) {
            lastNotifiedTs = msg.timestamp;
            if (!isMe) {
                newMsgsCount++;
                const role = window.currentUserData ? window.currentUserData.role : '';
                if (role === 'supervisor' || window.myUid === 'm510406lBidDf7qCzqXEHmIKxBu2') {
                    window.fireNativeNotification(`DSI Alert: ${msg.machine}`, displayText);
                } else if (!isSosOpen) {
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                }
            }
        }
    });
    box.innerHTML = html || `<div style="text-align:center; opacity:0.5; font-size:0.8rem; margin-top:auto;">${window.t('radioOpen')}</div>`;
    if (!isSosOpen && newMsgsCount > 0) {
        unreadSos += newMsgsCount;
        const badge = document.getElementById('sosBadge');
        badge.innerText = unreadSos;
        badge.style.display = 'flex';
    }
    box.scrollTop = box.scrollHeight;
};

window.enableSystemNotifications = function() {
    if (!("Notification" in window)) { alert("Your browser does not support native notifications."); return; }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("✅ System alerts enabled!");
            try { new Notification("System Ready", { body: "The Night Shift Advantage is connected." }); } catch(e) {}
        } else { alert("❌ Notifications denied. Check browser permissions."); }
    });
};

window.fireNativeNotification = function(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body }); } catch(e) {}
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
    window.showAdminToast(`📻 ${title} - ${body}`);
};

// =====================================================================
// INIT
// =====================================================================
window.initApp = function() {
    const saved = localStorage.getItem('dsi_config_v11');
    if (saved) config = { ...config, ...JSON.parse(saved) };
    if (!config.smart) config.smart = 'auto';
    if (!config.theme) config.theme = 'light';
    if (!config.inputMode) config.inputMode = 'button';
    if (!config.lang) config.lang = 'en';
    window.applyTheme();
    window.applyTranslations();
    const fieldMap = { setMachines:'machines', setLanes:'lanes', setProd:'product', setSmart:'smart', setInputMode:'inputMode', setTheme:'theme' };
    for (const [id, key] of Object.entries(fieldMap)) { const el = document.getElementById(id); if (el) el.value = config[key]; }
    if (document.getElementById('setDispName')) document.getElementById('setDispName').value = config.displayName || '';
    const hasSetup = localStorage.getItem('dsi_setup_done');
    if (!hasSetup) document.getElementById('setupWizard').style.display = 'flex';
    else window.routeUserByRole();
};

window.routeUserByRole = function() {
    const role = window.currentUserData.role || 'operator';
    document.getElementById('globalStatsBar').style.display = 'flex';
    if (role === 'supervisor') {
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
// SUPERVISOR ENGINE
// =====================================================================
let unsubSupHistories = null;
window.startSupervisorSync = function() {
    if (!db) { setTimeout(window.startSupervisorSync, 500); return; }
    if (unsubSupHistories) unsubSupHistories();
    unsubSupHistories = onValue(ref(db, 'histories'), (snap) => {
        window.renderSupervisorDashboard(snap.val() || {});
    });
};

window.renderSupervisorDashboard = function(allHistories) {
    const container = document.getElementById('supCardsContainer');
    container.innerHTML = '';
    let allWeightsGlobal = [];
    for (let m = 1; m <= config.machines; m++) {
        const machHistories = allHistories[`M${m}`];
        const latest = window.getAbsoluteLatest(machHistories);
        const recentChecks = window.getRecentChecks(machHistories, 3);
        if (latest) {
            container.innerHTML += window.buildSupCard(`DSI ${m}`, latest, recentChecks);
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

window.buildSupCard = function(title, dataObj, recentChecks) {
    const entry = dataObj.entry;
    const target = parseFloat(entry.target || 0);
    const opName = entry.operator || 'Unknown';
    const isStale = (Date.now() - (entry.timestamp || 0)) > 180000;
    let lanesHtml = '';
    entry.lanes.forEach((l, idx) => {
        let weightVal = parseFloat(l.w), colorClass = '';
        if (!isNaN(weightVal) && target > 0 && !isStale) {
            let diff = Math.abs(weightVal - target);
            if (diff <= 0.5) colorClass = 'bg-perfect';
            else if (diff <= 2) colorClass = 'bg-success';
            else if (diff <= 3) colorClass = 'bg-warning';
            else colorClass = 'bg-danger';
        }
        lanesHtml += `<div class="sup-lane ${colorClass}"><span class="sup-lane-lbl">${window.t('lane')} ${idx+1}</span><span class="sup-lane-wt">${l.w}</span><span class="sup-lane-dens">${l.d}</span></div>`;
    });
    let trendHtml = `<div class="sup-trend"><span class="sup-trend-lbl">Trend:</span>`;
    for (let i = 0; i < 3; i++) {
        const check = recentChecks[i];
        if (!check) { trendHtml += `<span class="trend-chip trend-empty">·</span>`; continue; }
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
    trendHtml += `<span style="font-size:0.62rem; opacity:0.5; margin-left:4px;">(newest → oldest)</span></div>`;
    return `
    <div class="sup-card ${isStale ? 'stale' : ''}">
        <div class="sup-header">
            <h2 class="sup-title">${title} <span style="font-size:0.8rem; color:gray; font-weight:normal;">• ${window.t(dataObj.product)}</span></h2>
            <div class="sup-meta">${window.t('target')}: ${target}g<strong>${entry.time}${isStale ? ' ⚠️' : ''}</strong></div>
        </div>
        <div class="sup-operator">👤 ${opName}</div>
        <div class="sup-grid">${lanesHtml}</div>
        ${trendHtml}
    </div>`;
};

// =====================================================================
// OPERATOR ENGINE
// =====================================================================
let unsubStore = null, unsubHistory = null;
let dbRef_Store = null, dbRef_History = null;

window.startCloudSync = function() {
    if (!db) { setTimeout(window.startCloudSync, 500); return; }
    cloudPathKey = `M${config.currentMachine}/${config.product}_${config.lanes}L`;
    const dot = document.getElementById('statusDot');
    if (unsubStore) unsubStore();
    if (unsubHistory) unsubHistory();
    dbRef_Store = ref(db, `stores/${cloudPathKey}`);
    dbRef_History = ref(db, `histories/${cloudPathKey}`);
    
    unsubStore = onValue(dbRef_Store, (snapshot) => {
        dot.className = "status-dot status-online";
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

// --- THE FIX: PURE ATOMIC SCALPEL WITH SERVER TIMESTAMP ---
window.pushLaneToCloud = function(idx) {
    if (!dbRef_Store || window.isOfflineMode) return;
    document.getElementById('statusDot').className = "status-dot status-syncing";
    
    const updates = {};
    // We strictly update the individual fields of this single lane, avoiding object overwrites
    updates[`lanes/${idx-1}/d`] = store.lanes[idx-1].d;
    updates[`lanes/${idx-1}/w`] = store.lanes[idx-1].w;
    updates[`lanes/${idx-1}/locked`] = store.lanes[idx-1].locked;
    
    // Apply Firebase Server Timestamp so it registers the exact moment it reconnects to the cloud
    updates[`lanes/${idx-1}/lastUpdated`] = serverTimestamp();
    updates[`lastUpdated`] = serverTimestamp();
    
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
        if (config.inputMode === 'longpress') labelText += " (HOLD)";
        if (config.inputMode === 'doubletap') labelText += " (×2)";
        const btnHtml = config.inputMode === 'button'
            ? `<button class="btn-icon" id="lockDens-${i}" onmousedown="event.preventDefault()" onclick="window.toggleLock(${i})">🔒</button>`
            : `<button class="btn-icon btn-hidden" id="lockDens-${i}">🔒</button>`;
        container.innerHTML += `
            <div class="lane-card" id="card-${i}">
                <div class="lane-header">
                    <div class="lane-header-left"><span>${window.t('lane')} ${i}</span><span class="smart-tag" id="tag-${i}">SMART</span></div>
                    <span class="lane-trend" id="trend-${i}"></span>
                </div>
                <div>
                    <label>${labelText}</label>
                    <div class="input-group">
                        <input type="number" id="currDens-${i}" class="density-input" step="0.001" readonly inputmode="decimal" oninput="window.handleInput(${i})" onblur="window.lockOnBlur(${i})">
                        ${btnHtml}
                    </div>
                </div>
                <div>
                    <label>${window.t('avgWt')}</label>
                    <div class="input-group">
                        <input type="number" id="avgWt-${i}" inputmode="decimal" oninput="window.handleWeightInput(${i})" onblur="window.checkAutoSave()">
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
        const el = document.getElementById(`currDens-${i}`);
        if (config.inputMode === 'longpress') {
            el.addEventListener('touchstart', () => { pressTimer = setTimeout(() => window.unlockAndFocus(i), 800); });
            el.addEventListener('touchend', () => clearTimeout(pressTimer));
            el.addEventListener('mousedown', () => { pressTimer = setTimeout(() => window.unlockAndFocus(i), 800); });
            el.addEventListener('mouseup', () => clearTimeout(pressTimer));
        } else if (config.inputMode === 'doubletap') { el.ondblclick = () => window.unlockAndFocus(i); }
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
        if (document.activeElement !== wEl) wEl.value = lane.w || '';
        const card = document.getElementById(`card-${i}`);
        if (config.smart === 'on' || (config.smart === 'auto' && lane.smartActive)) card.classList.add('smart-active');
        else card.classList.remove('smart-active');
    }
    window.calculateLocal();
};

window.calculateLocal = function() {
    if (!store || !store.lanes) return;
    const target = parseFloat(store.target);
    const baseK = FACTORS[config.product];
    let weights = [], count = 0;
    for (let i = 1; i <= config.lanes; i++) {
        if (!store.lanes[i-1]) continue;
        const lane = store.lanes[i-1];
        const currD = parseFloat(lane.d), currW = parseFloat(lane.w);
        const resText = document.getElementById(`resText-${i}`);
        const hiddenVal = document.getElementById(`calcVal-${i}`);
        const card = document.getElementById(`card-${i}`);
        const resBox = document.getElementById(`resBox-${i}`);
        const trendEl = document.getElementById(`trend-${i}`);
        if (!isNaN(target) && !isNaN(currD) && !isNaN(currW)) {
            const diff = currW - target;
            let activeK = baseK;
            const isSmart = config.smart === 'on' || (config.smart === 'auto' && lane.smartActive);
            if (isSmart && lane.lastD !== null && lane.lastW !== null) {
                let dDelta = currD - lane.lastD, wDelta = currW - lane.lastW;
                if (Math.abs(wDelta) > 0.5 && Math.abs(dDelta) > 0.001) {
                    let observedK = dDelta / wDelta;
                    observedK = Math.max(baseK * 0.5, Math.min(observedK, baseK * 5));
                    activeK = (observedK * 0.6) + (baseK * 0.4);
                }
            }
            const newD = currD + (diff * activeK);
            hiddenVal.value = newD.toFixed(3);
            resText.innerText = `${window.t('newDens')} ${newD.toFixed(3)}`;
            resBox.classList.add('has-value');
            const absDiff = Math.abs(diff);
            card.className = "lane-card";
            if (isSmart) card.classList.add('smart-active');
            if (absDiff <= 0.5) { card.classList.add('bg-perfect'); trendEl.innerHTML = '<span style="color:var(--perfect)">●</span>'; }
            else if (absDiff <= 2) { card.classList.add('bg-success'); trendEl.innerHTML = `<span style="color:var(--success)">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}g</span>`; }
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
    if (allFilled && currentCombo !== lastAutoSaveCombo) { lastAutoSaveCombo = currentCombo; window.saveToHistory(); }
};

window.saveToHistory = function() {
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const timestamp = Date.now();
    const avg = document.getElementById('machAvg') ? document.getElementById('machAvg').innerText : '--';
    prevAvg = parseFloat(avg) || null;
    const opName = window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Operator') : 'Operator';
    let row = { time, timestamp, avg, operator: opName, target: store.target, lanes: [] };
    for (let i = 1; i <= config.lanes; i++) {
        const wt = store.lanes[i-1] ? store.lanes[i-1].w : '';
        const calc = document.getElementById(`calcVal-${i}`).value;
        const dens = store.lanes[i-1] ? store.lanes[i-1].d : '';
        row.lanes.push({ w: wt ? `${wt}g` : '--', d: calc || dens || '--' });
    }
    if (!Array.isArray(history)) history = [];
    history.unshift(row);
    if (history.length > 50) history.pop();
    
    if (!window.isOfflineMode && dbRef_History) {
        set(dbRef_History, history).catch(e => window.showAdminToast("❌ Network Error: History not saved."));
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

// =====================================================================
// LANE ACTIONS
// =====================================================================
window.applyResult = function(idx) {
    const val = document.getElementById(`calcVal-${idx}`).value;
    const lane = store.lanes[idx-1];
    const currD = parseFloat(lane.d), currW = parseFloat(lane.w);
    if (val && !isNaN(currD)) {
        window.saveToHistory();
        lane.lastD = currD; lane.lastW = currW;
        const target = parseFloat(store.target);
        if (Math.abs(currW - target) > 2) { lane.attempts++; if (config.smart === 'auto' && lane.attempts >= 2) lane.smartActive = true; }
        else { lane.attempts = 0; }
        lane.d = val; lane.w = ''; lane.locked = true;
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
window.handleWeightInput = function(i) { store.lanes[i-1].w = document.getElementById(`avgWt-${i}`).value; window.calculateLocal(); window.pushLaneToCloud(i); };
window.lockOnBlur = function(i) { setTimeout(() => { if (document.activeElement === document.getElementById(`currDens-${i}`)) return; store.lanes[i-1].locked = true; store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value; window.pushLaneToCloud(i); }, 150); };
window.recheckLane = function(idx) { store.lanes[idx-1].w = ''; document.getElementById(`avgWt-${idx}`).value = ''; lastAutoSaveCombo = ""; document.getElementById(`avgWt-${idx}`).focus(); window.calculateLocal(); window.pushLaneToCloud(idx); };

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
window.cancelTargetChange = function() { document.getElementById('setTarget').value = store.target || ''; pendingTargetValue = null; document.getElementById('targetConfirm').classList.remove('show'); };
window.applyTargetNow = function(val) { store.target = val; document.getElementById('displayTarget').innerText = `${window.t('target')}: ${val}g`; document.getElementById('targetDisplay').innerText = `${val}g`; window.calculateLocal(); window.pushTargetToCloud(); };

// =====================================================================
// SETTINGS
// =====================================================================
window.toggleSettings = function() {
    const m = document.getElementById('settingsMenu');
    m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
    if (m.style.display === 'flex') {
        if (document.getElementById('setDispName')) document.getElementById('setDispName').value = config.displayName || '';
        if (document.getElementById('setSmart')) document.getElementById('setSmart').value = config.smart || 'auto';
        if (document.getElementById('setTheme')) document.getElementById('setTheme').value = config.theme || 'light';
        if (document.getElementById('setTarget') && store.target) document.getElementById('setTarget').value = store.target;
        document.getElementById('targetConfirm').classList.remove('show');
    }
};
window.saveLocalSettings = function() {
    if (document.getElementById('setMachines')) config.machines = parseInt(document.getElementById('setMachines').value);
    if (document.getElementById('setLanes')) config.lanes = parseInt(document.getElementById('setLanes').value);
    if (document.getElementById('setProd')) config.product = document.getElementById('setProd').value;
    if (document.getElementById('setSmart')) config.smart = document.getElementById('setSmart').value;
    if (document.getElementById('setInputMode')) config.inputMode = document.getElementById('setInputMode').value;
    if (document.getElementById('setTheme')) config.theme = document.getElementById('setTheme').value;
    localStorage.setItem('dsi_config_v11', JSON.stringify(config));
};
window.toggleTheme = function() { config.theme = document.getElementById('setTheme').value; window.applyTheme(); window.saveLocalSettings(); };
window.saveDisplayName = function() { 
    const name = document.getElementById('setDispName').value; 
    config.displayName = name; 
    window.saveLocalSettings(); 
    if (window.myUid && !window.isOfflineMode && db) {
        update(ref(db, `users/${window.myUid}`), { displayName: name }).catch(e => window.showAdminToast("❌ Network Error: Name not saved."));
    }
};
window.applyTheme = function() { if (config.theme === 'dark') document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode'); };
window.completeSetup = function() { config.machines = parseInt(document.getElementById('setupMachines').value); config.lanes = parseInt(document.getElementById('setupLanes').value); config.product = document.getElementById('setupProd').value; localStorage.setItem('dsi_setup_done', 'true'); window.saveLocalSettings(); document.getElementById('setupWizard').style.display = 'none'; window.routeUserByRole(); };
window.factoryReset = function() { if (confirm("Erase LOCAL settings? Cloud data remains.")) { localStorage.clear(); location.reload(); } };
window.switchMachine = function(m) { config.currentMachine = m; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };
window.switchProfile = function() { config.lanes = parseInt(document.getElementById('setLanes').value); config.product = document.getElementById('setProd').value; window.saveLocalSettings(); window.renderInterface(); if (!window.isOfflineMode) window.startCloudSync(); };

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
    const isAppr = data.approved ? 'checked' : '';
    const adminName = data.adminName || '';
    const dispName = data.displayName || 'No Name Set';
    const role = data.role || 'operator';
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

window.closeAdmin = function() { document.getElementById('adminModal').style.display = 'none'; };
window.updateAdminName = function(uid, name) { update(ref(db, `users/${uid}`), { adminName: name }).catch(e => window.showAdminToast("❌ Error: Could not update name.")); };
window.updateUserRole = function(uid, role) { update(ref(db, `users/${uid}`), { role }).catch(e => window.showAdminToast("❌ Error: Could not update role.")); };
window.toggleUserApprove = function(uid, isAppr) {
    update(ref(db, `users/${uid}`), { approved: isAppr, requestPending: false })
    .then(() => { if (isAppr) { notifiedSet.delete(uid); persistNotifiedSet(); } })
    .catch(e => window.showAdminToast("❌ Error: Could not update approval."));
};
window.deleteUser = function(uid) { set(ref(db, `users/${uid}`), null).catch(e => window.showAdminToast("❌ Error: Could not delete user.")); };

window.pingAdmin = function() {
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
                notifiedSet.add(uid);
                persistNotifiedSet();
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
