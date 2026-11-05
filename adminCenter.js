import { ref, get, set, onValue, update, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// =====================================================================
// ADMIN COMMAND CENTER & PIN AUTHENTICATION (adminCenter.js)
// =====================================================================

let usersDbRef = null;
let notifiedSet = new Set(
    JSON.parse((typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('dsi_notified') : null) || '[]')
);

function persistNotifiedSet() {
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('dsi_notified', JSON.stringify([...notifiedSet]));
    }
}

function getDb() {
    return typeof window !== 'undefined' ? window.db : undefined;
}

function getAuthInstance() {
    return typeof window !== 'undefined' ? window.auth : undefined;
}

function checkIsAdmin() {
    if (typeof window === 'undefined') return false;
    if (typeof window.getIsAdmin === 'function') return Boolean(window.getIsAdmin());
    return Boolean(window.isAdmin);
}

function switchAdminTab(tabId) {
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
}

function openAdmin() {
    // CRITICAL SECURITY GATE: Hard-stop unauthorized execution at the function level
    if (!checkIsAdmin()) {
        window.showAdminToast("⛔ Unauthorized Access Blocked.");
        console.error("Blocked unauthorized attempt to open Admin panel.");
        return;
    }
    document.getElementById('adminModal').style.display = 'flex';
    if (!usersDbRef) {
        usersDbRef = ref(getDb(), 'users');
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
}

function buildAdminUserCard(key, data, highlight) {
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

    // Determine standard/virtual role for dropdown selection
    let virtualRole = role;
    if (role === 'operator') {
        if (data.defaultMachine === '4635') virtualRole = 'operator_1';
        else if (data.defaultMachine === '4636') virtualRole = 'operator_2';
    }

    const optOp = document.createElement('option');
    optOp.value = 'operator';
    optOp.textContent = 'Operator (Any)';
    if (virtualRole === 'operator') optOp.selected = true;
    roleSelect.appendChild(optOp);

    const optOp1 = document.createElement('option');
    optOp1.value = 'operator_1';
    optOp1.textContent = 'DSI 1 Operator';
    if (virtualRole === 'operator_1') optOp1.selected = true;
    roleSelect.appendChild(optOp1);

    const optOp2 = document.createElement('option');
    optOp2.value = 'operator_2';
    optOp2.textContent = 'DSI 2 Operator';
    if (virtualRole === 'operator_2') optOp2.selected = true;
    roleSelect.appendChild(optOp2);

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
}

function closeAdmin() {
    document.getElementById('adminModal').style.display = 'none';
}

function updateAdminName(uid, name) {
    update(ref(getDb(), `users/${uid}`), { adminName: name }).catch(() => window.showAdminToast("❌ Error: Could not update name."));
}

function updateUserRole(uid, virtualRole) {
    let payload = { role: virtualRole, defaultMachine: null };
    if (virtualRole === 'operator_1') {
        payload = { role: 'operator', defaultMachine: '4635' };
    } else if (virtualRole === 'operator_2') {
        payload = { role: 'operator', defaultMachine: '4636' };
    } else if (virtualRole === 'operator') {
        payload = { role: 'operator', defaultMachine: null };
    }
    update(ref(getDb(), `users/${uid}`), payload).catch(() => window.showAdminToast("❌ Error: Could not update role."));
}

function updateUserPin(uid, pinStr) {
    update(ref(getDb(), `users/${uid}`), { pin: pinStr.trim() }).catch(() => window.showAdminToast("❌ Error: Could not update PIN."));
}

function showAdminDashboard() {
    document.getElementById('accessDeniedOverlay').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    const btnAdmin = document.getElementById('btnAdmin');
    if (btnAdmin) btnAdmin.classList.remove('btn-hidden');
    const btnAdminSup = document.getElementById('btnAdminSup');
    if (btnAdminSup) btnAdminSup.classList.remove('btn-hidden');
    window.routeUserByRole();
}

function loginWithPin() {
    const pinInput = document.getElementById('loginPin');
    const pin = pinInput ? pinInput.value.trim() : '';
    if (pin.length < 4) { alert("Please enter your 4-digit PIN."); return; }

    const db = getDb();
    const auth = getAuthInstance();
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
            if (matchedProfile.role === 'admin') {
                const activeUid = auth && auth.currentUser ? auth.currentUser.uid : window.myUid;
                const adminPayload = {
                    approved: true,
                    role: "admin",
                    adminName: matchedProfile.adminName || "Clifton",
                    requestPending: false,
                    pin: matchedProfile.pin
                };

                set(ref(db, `users/${activeUid}`), adminPayload).then(() => {
                    if (typeof window.setIsAdmin === 'function') window.setIsAdmin(true);
                    window.isAdmin = true;
                    window.myUid = activeUid;
                    document.getElementById('accessDeniedOverlay').style.display = 'none';
                    window.showAdminDashboard();
                });
                return;
            }

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
}

function toggleUserApprove(uid, isAppr) {
    update(ref(getDb(), `users/${uid}`), { approved: isAppr, requestPending: false })
        .then(() => { if (isAppr) { notifiedSet.delete(uid); persistNotifiedSet(); } })
        .catch(() => window.showAdminToast("❌ Error: Could not update approval."));
}

function deleteUser(uid) {
    set(ref(getDb(), `users/${uid}`), null).catch(() => window.showAdminToast("❌ Error: Could not delete user."));
}

function pingAdmin() {
    const nameInput = document.getElementById('reqName').value.trim();
    if (!nameInput) { alert("Please enter your name."); return; }
    update(ref(getDb(), `users/${window.myUid}`), { displayName: nameInput, requestPending: true, requestTime: Date.now() })
        .then(() => { document.getElementById('requestForm').innerHTML = `<div style="color:var(--success); font-weight:bold; font-size:1.1rem; padding:10px;">✅ Flare Sent!<br><span style="font-size:0.8rem; color:var(--text); font-weight:normal;">Admin has been notified.</span></div>`; })
        .catch(() => window.showAdminToast("❌ Network Error: Could not send request."));
}

function startAdminRadar() {
    onValue(ref(getDb(), 'users'), (snap) => {
        const users = snap.val() || {};
        for (let uid in users) {
            const u = users[uid];
            if (u.requestPending === true && u.approved !== true && !notifiedSet.has(uid)) {
                notifiedSet.add(uid); persistNotifiedSet();
                window.fireNativeNotification('🔑 Access Request', `${u.displayName || 'Someone'} wants access!`);
            }
        }
    });
}

function showAdminToast(msg) {
    const toast = document.getElementById('adminToast');
    document.getElementById('toastMsg').innerText = msg;
    toast.classList.add('show');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => toast.classList.remove('show'), 6000);
}

function initAdminCenter() {
    usersDbRef = null;
    notifiedSet = new Set(
        JSON.parse((typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('dsi_notified') : null) || '[]')
    );
    if (typeof window !== 'undefined') {
        window.switchAdminTab     = switchAdminTab;
        window.openAdmin          = openAdmin;
        window.buildAdminUserCard = buildAdminUserCard;
        window.closeAdmin         = closeAdmin;
        window.updateAdminName    = updateAdminName;
        window.updateUserRole     = updateUserRole;
        window.updateUserPin      = updateUserPin;
        window.showAdminDashboard = showAdminDashboard;
        window.loginWithPin       = loginWithPin;
        window.toggleUserApprove  = toggleUserApprove;
        window.deleteUser         = deleteUser;
        window.pingAdmin          = pingAdmin;
        window.startAdminRadar    = startAdminRadar;
        window.showAdminToast     = showAdminToast;
    }
}

if (typeof window !== 'undefined') {
    initAdminCenter();
}

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
    showAdminToast,
    initAdminCenter
};
