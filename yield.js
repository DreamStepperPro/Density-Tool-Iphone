// =====================================================================
// YIELD.JS — Yield Calculator Module
// Handles fillet/nugget/trim calculations, history, EOS save, broadcast.
// To modify the input factor (currently 1.03): search "* 1.03" below.
// =====================================================================

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = getDatabase(getApp());

let unsubYieldHistory = null;

window.openYield = function() {
    document.getElementById('yieldModal').style.display = 'flex';
    window.loadYieldHistory();
};

window.closeYield = function() {
    document.getElementById('yieldModal').style.display = 'none';
    if (unsubYieldHistory) { unsubYieldHistory(); unsubYieldHistory = null; }
};

window.calcYield = function() {
    const v = (id) => parseFloat(document.getElementById(id).value) || 0;
    const fillet      = v('y10130') + v('y10070');
    const nugget      = v('y10114');
    const trim        = v('y30212') + v('y30211') + v('y15530') + v('y15531') + (v('y40030boxes') * 40);
    const totalOutput = fillet + nugget + trim;
    const totalInput  = totalOutput * 1.03;
    document.getElementById('yOutput').innerText = totalOutput.toFixed(1);
    document.getElementById('yInput').innerText  = totalInput.toFixed(1);
    if (totalInput > 0) {
        document.getElementById('yPctFillet').innerText = ((fillet  / totalInput) * 100).toFixed(2) + '%';
        document.getElementById('yPctNugget').innerText = ((nugget  / totalInput) * 100).toFixed(2) + '%';
        document.getElementById('yPctTrim').innerText   = ((trim    / totalInput) * 100).toFixed(2) + '%';
    } else {
        document.getElementById('yPctFillet').innerText = '0.0%';
        document.getElementById('yPctNugget').innerText = '0.0%';
        document.getElementById('yPctTrim').innerText   = '0.0%';
    }
};

window.clearYieldInputs = function() {
    ['y10130','y10070','y10114','y30212','y30211','y15530','y15531','y40030boxes']
        .forEach(id => document.getElementById(id).value = '');
    window.calcYield();
};

window.saveEosYield = function() {
    const v = (id) => parseFloat(document.getElementById(id).value) || 0;
    const totalOutput = v('y10130')+v('y10070')+v('y10114')+v('y30212')+v('y30211')+v('y15530')+v('y15531')+(v('y40030boxes')*40);
    if (totalOutput <= 0) { alert("Please enter product weights first."); return; }
    const timeStr = new Date().toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const yieldData = {
        timestamp: Date.now(), timeStr,
        input:    document.getElementById('yInput').innerText,
        output:   totalOutput.toFixed(1),
        fillet:   document.getElementById('yPctFillet').innerText,
        nugget:   document.getElementById('yPctNugget').innerText,
        trim:     document.getElementById('yPctTrim').innerText,
        operator: window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Supervisor') : 'Supervisor'
    };
    push(ref(db, 'yieldHistory'), yieldData)
        .then(() => { window.showAdminToast("✅ EOS Yield Saved!"); window.clearYieldInputs(); })
        .catch(() => window.showAdminToast("❌ Error saving yield."));
};

window.loadYieldHistory = function() {
    if (unsubYieldHistory) { unsubYieldHistory(); unsubYieldHistory = null; }
    unsubYieldHistory = onValue(ref(db, 'yieldHistory'), (snap) => {
        const list = document.getElementById('yieldHistoryList');
        const data = snap.val();
        if (!data) { list.innerHTML = '<div style="opacity:0.5; text-align:center;">No history saved yet.</div>'; return; }
        const arr = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
        list.innerHTML = arr.map(y => `
            <div class="yield-hist-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong>${y.timeStr}</strong>
                    <span style="font-size:0.7rem; opacity:0.6;">by ${y.operator}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                    <span>In: ${y.input}lb</span>
                    <span>Out: ${y.output}lb</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:6px; font-weight:bold;">
                    <span style="color:var(--perfect);">F: ${y.fillet}</span>
                    <span style="color:var(--warning);">N: ${y.nugget}</span>
                    <span style="color:var(--danger);">T: ${y.trim}</span>
                </div>
            </div>`).join('');
    });
};

window.wipeYieldHistory = function() {
    if (confirm("Permanently delete all saved yield history?")) {
        set(ref(db, 'yieldHistory'), null)
            .then(() => window.showAdminToast("🗑️ Yield history wiped."));
    }
};

window.broadcastMidShiftYield = function() {
    const v = (id) => parseFloat(document.getElementById(id).value) || 0;
    const totalOutput = v('y10130')+v('y10070')+v('y10114')+v('y30212')+v('y30211')+v('y15530')+v('y15531')+(v('y40030boxes')*40);
    if (totalOutput <= 0) { alert("Please enter product weights first."); return; }
    const trim   = document.getElementById('yPctTrim').innerText;
    const fillet = document.getElementById('yPctFillet').innerText;
    const nugget = document.getElementById('yPctNugget').innerText;
    window.sendCommsMsg('YIELD_UPDATE', JSON.stringify({ trim, fillet, nugget }));
    const timeStr = new Date().toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const yieldData = {
        timestamp: Date.now(),
        timeStr: timeStr + ' (Mid-Shift)',
        input:    document.getElementById('yInput').innerText,
        output:   totalOutput.toFixed(1),
        fillet, nugget, trim,
        operator: window.currentUserData ? (window.currentUserData.adminName || window.currentUserData.displayName || 'Supervisor') : 'Supervisor'
    };
    push(ref(db, 'yieldHistory'), yieldData)
        .then(() => { window.showAdminToast("📣 Yield Broadcasted to Team!"); window.clearYieldInputs(); })
        .catch(() => window.showAdminToast("❌ Error saving mid-shift yield."));
};
