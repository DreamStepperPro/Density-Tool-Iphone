import { resetAutoSaveState } from "./shiftHistory.js";

// =====================================================================
// OPERATOR UI & LANE ACTION ENGINE (operatorUI.js)
// =====================================================================

let pressTimer = null;
let pendingTargetValue = null;

function getConfig() {
    return (typeof window !== 'undefined' && typeof window.getConfig === 'function' ? window.getConfig() : window?.config) || {};
}

function getStore() {
    return (typeof window !== 'undefined' && typeof window.getStore === 'function' ? window.getStore() : window?.store) || {};
}

function checkIsAdmin() {
    if (typeof window === 'undefined') return false;
    if (typeof window.getIsAdmin === 'function') return Boolean(window.getIsAdmin());
    return Boolean(window.isAdmin);
}

// =====================================================================
// RENDER INTERFACE
// =====================================================================
function renderInterface() {
    const config  = getConfig();
    const isAdmin = checkIsAdmin();
    const nav = document.getElementById('machineNav');
    if (config.machines === 1) {
        nav.className = 'machine-nav nav-hidden';
        config.currentMachine = 1;
    } else {
        nav.className = 'machine-nav';
        nav.innerHTML = '';
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
}

function updateUIFromCloud() {
    const config  = getConfig();
    const store   = getStore();
    const isAdmin = checkIsAdmin();
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
        if (window.localWriteLocks && window.localWriteLocks[i] && (Date.now() - window.localWriteLocks[i] < 1500)) {
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
}

// =====================================================================
// LANE ACTIONS
// =====================================================================
function toggleDensitySign(i) {
    const store = getStore();
    const el = document.getElementById(`currDens-${i}`);
    if (el.readOnly) { window.showAdminToast("⚠️ Unlock density to change sign."); return; }
    let val = parseFloat(el.value);
    if (isNaN(val) || val === 0) return;
    val = val * -1;
    el.value = val.toFixed(3);
    store.lanes[i-1].d = String(val.toFixed(3));
    window.calculateLocal();
    window.pushLaneToCloud(i);
}

function applyResult(idx) {
    const config = getConfig();
    const store  = getStore();
    const val    = document.getElementById(`calcVal-${idx}`).value;
    const lane   = store.lanes[idx-1];
    const currD  = parseFloat(lane.d), currW = parseFloat(lane.w);
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
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
            }
        } else {
            lane.attempts = 0;
            if (Math.abs(currW - target) <= 1.0) {
                lane.copilotInterventions = 0;
                lane.stableCount = (lane.stableCount || 0) + 1;
                if (config.smart === 'auto' && lane.smartActive && lane.stableCount >= 2) {
                    lane.smartActive = false; lane.lastD = null; lane.lastW = null;
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]);
                }
            } else { lane.stableCount = 0; }
        }
        lane.d = val; lane.w = ''; lane.locked = true;
        if (typeof window.resetAutoSaveState === 'function') {
            window.resetAutoSaveState();
        } else {
            resetAutoSaveState();
        }
        const card = document.getElementById(`card-${idx}`);
        card.classList.add('apply-flash');
        setTimeout(() => card.classList.remove('apply-flash'), 300);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([60]);
        window.calculateLocal();
        window.pushLaneToCloud(idx);
    }
}

function toggleLaneDisable(idx) {
    const store = getStore();
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
}

function unlockAndFocus(i) {
    const config = getConfig();
    const store  = getStore();
    const el = document.getElementById(`currDens-${i}`);
    el.readOnly = false; el.focus(); el.style.borderColor = 'var(--info)';
    store.lanes[i-1].locked = false;
    window.pushLaneToCloud(i);
    if (config.inputMode === 'button') {
        document.getElementById(`lockDens-${i}`).className = 'btn-icon';
        document.getElementById(`lockDens-${i}`).innerText = '🔓';
    }
}

function toggleLock(i) {
    const store = getStore();
    store.lanes[i-1].locked = !store.lanes[i-1].locked;
    const el = document.getElementById(`currDens-${i}`);
    if (!store.lanes[i-1].locked) {
        el.readOnly = false;
        setTimeout(() => { el.focus(); el.style.borderColor = 'var(--info)'; }, 50);
    } else {
        el.readOnly = true;
        el.style.borderColor = 'var(--border)';
    }
    window.pushLaneToCloud(i);
}

function updateBeltSpeed(val) {
    const config = getConfig();
    const m = `M${config.currentMachine}`;
    if (!window.sessionContext[m]) window.sessionContext[m] = {};
    window.sessionContext[m].beltSpeed = val ? parseFloat(val) : null;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dsi_session_context', JSON.stringify(window.sessionContext));
    }
}

function handleInput(i) {
    const store = getStore();
    window.localWriteLocks[i] = Date.now();
    store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value;
    store.lanes[i-1].copilotInterventions = 0;
    store.lanes[i-1].copilotSuspended = false;
    window.calculateLocal();
}

function handleWeightInput(i) {
    const store = getStore();
    window.localWriteLocks[i] = Date.now();
    store.lanes[i-1].w = document.getElementById(`avgWt-${i}`).value;
    window.calculateLocal();
    clearTimeout(window.weightDebounceTimers[i]);
    window.weightDebounceTimers[i] = setTimeout(() => window.pushLaneToCloud(i), 600);
}

function lockOnBlur(i) {
    setTimeout(() => {
        if (document.activeElement === document.getElementById(`currDens-${i}`)) return;
        const store = getStore();
        store.lanes[i-1].locked = true;
        store.lanes[i-1].d = document.getElementById(`currDens-${i}`).value;
        window.pushLaneToCloud(i);
    }, 150);
}

function recheckLane(idx) {
    const store   = getStore();
    const isAdmin = checkIsAdmin();
    if (isAdmin) {
        if (!confirm(`⚠️ WIPE WEIGHT DATA?\nAre you sure you want to delete the operator's weight for Lane ${idx}?`)) return;
    }
    store.lanes[idx-1].w = '';
    document.getElementById(`avgWt-${idx}`).value = '';
    if (typeof window.resetAutoSaveState === 'function') {
        window.resetAutoSaveState();
    } else {
        resetAutoSaveState();
    }
    if (!isAdmin) document.getElementById(`avgWt-${idx}`).focus();
    window.calculateLocal();
    window.pushLaneToCloud(idx);
}

function unlockWeightAndFocus(i) {
    if (!checkIsAdmin()) return;
    const el = document.getElementById(`avgWt-${i}`);
    el.readOnly = false; el.focus(); el.style.borderColor = 'var(--info)';
}

function lockWeightOnBlur(i) {
    if (!checkIsAdmin()) return;
    clearTimeout(window.weightDebounceTimers[i]);
    setTimeout(() => {
        const el = document.getElementById(`avgWt-${i}`);
        if (document.activeElement === el) return;
        el.readOnly = true; el.style.borderColor = 'var(--border)';
    }, 150);
}

// =====================================================================
// TARGET CONFIRMATION
// =====================================================================
function onTargetInput() {
    const store  = getStore();
    const newVal = document.getElementById('setTarget').value;
    if (store.target && store.target !== newVal && store.lanes && store.lanes.some(l => l.w)) {
        pendingTargetValue = newVal;
        document.getElementById('targetConfirm').classList.add('show');
    } else {
        window.applyTargetNow(newVal);
    }
}

function confirmTargetChange() {
    if (pendingTargetValue !== null) {
        window.applyTargetNow(pendingTargetValue);
        pendingTargetValue = null;
    }
    document.getElementById('targetConfirm').classList.remove('show');
}

function cancelTargetChange() {
    const store = getStore();
    document.getElementById('setTarget').value = store.target || '';
    pendingTargetValue = null;
    document.getElementById('targetConfirm').classList.remove('show');
}

function applyTargetNow(val) {
    const store = getStore();
    store.target = val;
    document.getElementById('displayTarget').innerText = `${window.t('target')}: ${val}g`;
    document.getElementById('targetDisplay').innerText = `${val}g`;
    window.calculateLocal();
    window.pushTargetToCloud();
}

function initOperatorUI() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    pendingTargetValue = null;
    if (typeof window !== 'undefined') {
        window.renderInterface      = renderInterface;
        window.updateUIFromCloud    = updateUIFromCloud;
        window.toggleDensitySign    = toggleDensitySign;
        window.applyResult          = applyResult;
        window.toggleLaneDisable    = toggleLaneDisable;
        window.unlockAndFocus       = unlockAndFocus;
        window.toggleLock           = toggleLock;
        window.updateBeltSpeed      = updateBeltSpeed;
        window.handleInput          = handleInput;
        window.handleWeightInput    = handleWeightInput;
        window.lockOnBlur           = lockOnBlur;
        window.recheckLane          = recheckLane;
        window.unlockWeightAndFocus = unlockWeightAndFocus;
        window.lockWeightOnBlur     = lockWeightOnBlur;
        window.onTargetInput        = onTargetInput;
        window.confirmTargetChange  = confirmTargetChange;
        window.cancelTargetChange   = cancelTargetChange;
        window.applyTargetNow       = applyTargetNow;
    }
}

if (typeof window !== 'undefined') {
    initOperatorUI();
}

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
    applyTargetNow,
    initOperatorUI
};
