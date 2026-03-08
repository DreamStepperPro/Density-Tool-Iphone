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
// =====================================================================
// TRUE NETWORK HEARTBEAT
// =====================================================================
const connectedRef = ref(db, ".info/connected");
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        // We are physically connected to the server
        if(document.getElementById('statusDot')) document.getElementById('statusDot').className = "status-dot status-online";
        if(document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-online";
    } else {
        // We lost the websocket (Airplane mode, bad Wi-Fi)
        if(document.getElementById('statusDot')) document.getElementById('statusDot').className = "status-dot status-offline";
        if(document.getElementById('supStatusDot')) document.getElementById('supStatusDot').className = "status-dot status-offline";
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
    const supDash = document.getElementById('supervisorDashboard');
    if (supDash && supDash.style.display !== 'none' && !window.isOfflineMode) window.startSupervisorSync();
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
// SUPERVISOR ENGINE (v12.5 - Lane Stability Update)
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
        // INCREASED TO 5: We pull the last 5 checks to get a highly accurate Standard Deviation
        const recentChecks = window.getRecentChecks(machHistories, 5); 
        
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
    
    entr