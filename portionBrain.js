// =====================================================================
// PORTIONBRAIN.JS — Density Math + Smart Adapt + Predictive Velocity Engine
// Standalone mathematical and trajectory engine for lane portioning.
// =====================================================================

const FACTORS = { lunch: 0.01, bfast: 0.017 };

function calculateDensity(lane, currD, currW, diff, baseK, isSnipeLane, isSmart) {
    const config = (typeof window !== 'undefined' && typeof window.getConfig === 'function' ? window.getConfig() : null)
        || (typeof window !== 'undefined' && window.config)
        || { product: 'lunch' };

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

    if (!lane.copilotSuspended) {
        let downC = 0;
        if (typeof window !== 'undefined' && typeof window.getCurrentActiveDowntimes === 'function') {
            const activeDowntimes = window.getCurrentActiveDowntimes();
            for (const [id, fault] of Object.entries(activeDowntimes)) {
                if (id.startsWith('c') && parseInt(id.substring(1)) >= 1 && parseInt(id.substring(1)) <= 8) {
                    downC++;
                }
            }
        }
        if (downC > 0) {
            const buffer = 1.0 - Math.min(downC * 0.1, 0.5);
            activeK = activeK * buffer;
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

    const history = (typeof window !== 'undefined' && typeof window.getHistory === 'function' ? window.getHistory() : null)
        || (typeof window !== 'undefined' && Array.isArray(window.history) ? window.history : null);

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

                if (Math.abs(currW - target) <= 0.5) {
                    velocity = 0; // The Bullseye Silencer
                } else {
                    // Stabilization Override — compare against oldest point, not most recent
                    // This preserves slow steady drift signals across the full time window
                    if (recentWts.length > 1 && Math.abs(currW - recentWts[recentWts.length - 1]) <= 0.4) {
                        velocity = 0;
                    } else {
                        const oldestW    = recentWts[recentWts.length - 1];
                        const oldestTime = recentTimes[recentTimes.length - 1];

                        // The Deceleration Gate
                        if (Math.abs(currW - target) < Math.abs(oldestW - target)) {
                            velocity = 0;
                        } else if (Math.abs(currW - oldestW) > 1.5) {
                            // Intervention Gate — ignore massive jumps, assume manual intervention
                            velocity = 0;
                        } else if (oldestTime) {
                            // 0.25 min floor allows accurate velocity on quick rechecks
                            const timeDiffMin = Math.max(0.25, (Date.now() - oldestTime) / 60000);
                            velocity = (currW - oldestW) / timeDiffMin;
                        }
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
                                        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
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

function calculateLocal() {
    const store = (typeof window !== 'undefined' && typeof window.getStore === 'function' ? window.getStore() : null)
        || (typeof window !== 'undefined' && window.store)
        || null;
    if (!store || !store.lanes) return;

    const config = (typeof window !== 'undefined' && typeof window.getConfig === 'function' ? window.getConfig() : null)
        || (typeof window !== 'undefined' && window.config)
        || { machines: 2, lanes: 4, product: 'lunch', smart: 'auto', currentMachine: 1 };

    const activeFactors = (typeof window !== 'undefined' && window.FACTORS) || FACTORS;
    const target  = parseFloat(store.target);
    const baseK   = activeFactors[config.product];
    let weights = [], count = 0;

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
                    trendEl.innerHTML = `<span style="color:var(--perfect); font-weight:900; font-size:0.75rem;">${window.t('lockedOnTarget')}</span>`;
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
        const prevAvg = typeof window !== 'undefined' && typeof window.getPrevAvg === 'function' ? window.getPrevAvg() : null;
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
}

if (typeof window !== 'undefined') {
    window.FACTORS = FACTORS;
    window.calculateDensity = calculateDensity;
    window.calculateVelocity = calculateVelocity;
    window.calculateLocal = calculateLocal;
}

export { calculateLocal, calculateDensity, calculateVelocity, FACTORS };
