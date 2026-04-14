// =====================================================================
// COMMS.JS — SOS / Line Dispatch Engine
// Handles all real-time messaging between operators and supervisors.
// To add a new message type: add a code to renderChat's displayText logic.
// =====================================================================

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { escapeHTML } from "./utils.js";
import { getDatabase, ref, push, update, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db  = getDatabase(getApp());

// Module-level state — private to this file
let isSosOpen      = false;
let unreadSos      = 0;
let lastNotifiedTs = Date.now();
let unsubComms     = null;

window.openSos = function() {
    if (window.isOfflineMode) { window.showAdminToast('📵 Line Dispatch unavailable offline'); return; }
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

window.sendLaneWarning = function(machineStr, laneNum) {
    if (window.isOfflineMode) {
        window.showAdminToast('📵 Line Dispatch unavailable offline');
        return;
    }
    let confirmText = window.t('dispatchWarningConfirm') || `Dispatch weight warning to ${machineStr} Lane ${laneNum}?`;
    confirmText = confirmText.replace('{machine}', machineStr).replace('{lane}', laneNum);
    if (confirm(confirmText)) {
        let msgText = window.t('offTargetMsg') || `⚠️ OFF TARGET: Please check weight on ${machineStr}, Lane ${laneNum}.`;
        msgText = msgText.replace('{machine}', machineStr).replace('{lane}', laneNum);
        window.sendCommsMsg('TEXT', msgText);
        window.showAdminToast(`📣 Dispatch sent to ${machineStr} L${laneNum}`);
    }
};

window.sendCommsMsg = function(code, customText = "") {
    if (window.isOfflineMode || !db) return;
    const cfg    = window.getConfig();
    const role   = window.currentUserData.role || 'operator';
    const name   = cfg.displayName || window.currentUserData.adminName || 'Unknown';
    const isAdminUser = (window.currentUserData && window.currentUserData.role === 'supervisor')
                     || role === 'supervisor'
                     || window.myUid === window.ADMIN_UID;
    const machineStr = isAdminUser ? 'ADMIN' : `DSI ${cfg.currentMachine}`;

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
        const isMe       = msg.senderUid === window.myUid;
        const isErr      = msg.code !== 'TEXT';
        const bubbleClass = isMe ? 'msg-me' : 'msg-them';
        const errClass   = isErr ? 'msg-err' : '';
        const timeStr    = new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        let displayText  = escapeHTML(msg.text);
        if (msg.code === 'ERR_WT')     displayText = window.t('errWt');
        if (msg.code === 'ERR_MECH')   displayText = window.t('errMech');
        if (msg.code === 'YIELD_UPDATE') {
            try {
                const data = JSON.parse(msg.text);
                displayText = `📊 ${window.t('liveYield')}\n🔪 ${window.t('trim')}: ${escapeHTML(data.trim)}\n🥩 ${window.t('fillets')}: ${escapeHTML(data.fillet)}\n🍗 ${window.t('nuggets')}: ${escapeHTML(data.nugget)}`;
            } catch(e) { displayText = escapeHTML(msg.text); }
        }
        html += `
        <div class="msg-bubble ${bubbleClass} ${errClass}">
            <div class="msg-meta"><span>${escapeHTML(msg.senderName)} (${escapeHTML(msg.machine)})</span><span>${escapeHTML(timeStr)}</span></div>
            ${displayText}
        </div>`;
        if (msg.timestamp > lastNotifiedTs) {
            lastNotifiedTs = msg.timestamp;
            if (!isMe) {
                newMsgsCount++;
                const role = window.currentUserData ? window.currentUserData.role : '';
                if (role === 'supervisor' || window.myUid === window.ADMIN_UID) {
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
