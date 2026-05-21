import re

with open('downtime.js', 'r') as f:
    content = f.read()

calc_old = """    for (let subLane = 1; subLane <= 4; subLane++) {
        const cuttersNeeded = subLaneAllocations[subLane];
        if (cuttersNeeded === 2) {
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 2, mode: 'Cutter' });
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 1, mode: 'Cutter' });
        } else {
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 1, mode: 'Cutter' });
        }
    }"""

calc_new = """    for (let subLane = 1; subLane <= 4; subLane++) {
        const cuttersNeeded = subLaneAllocations[subLane];
        const hasSwap = currentActiveDowntimes && currentActiveDowntimes['pathSwap_' + subLane];
        let p1 = hasSwap ? 1 : 2;
        let p2 = hasSwap ? 2 : 1;

        if (cuttersNeeded === 2) {
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: p1, mode: 'Cutter' });
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: p2, mode: 'Cutter' });
        } else {
            assignments.push({ actuator: healthyActuators[actuatorIndex++], subLane, path: 1, mode: 'Cutter' });
        }
    }"""

content = content.replace(calc_old, calc_new)

# Now we expose window.acceptPathSwap
swap_logic = """
window.acceptPathSwap = function(subLane) {
    if (!subLane) return;
    const swapKey = 'pathSwap_' + subLane;
    const m = window.getConfig().currentMachine;

    // Toggle the swap state
    const currentSwapState = currentActiveDowntimes[swapKey] ? true : false;
    const newSwapData = currentSwapState ? null : { type: 'pathSwap', subLane, timestamp: Date.now() };

    // Offline bypass
    if (window.isOfflineMode) {
        if (!window.sandboxDowntimes[m]) window.sandboxDowntimes[m] = {};
        if (newSwapData) {
            window.sandboxDowntimes[m][swapKey] = newSwapData;
        } else {
            delete window.sandboxDowntimes[m][swapKey];
        }
        currentActiveDowntimes = window.sandboxDowntimes[m];
        window.syncMatrixToCloud();
        return;
    }

    if (!window.db) return;

    // Push the state to the live firebase tree
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(({ ref, set }) => {
        set(ref(window.db, `activeDowntimes/M${m}/${swapKey}`), newSwapData)
            .then(() => {
                // local UI trigger if the matrix is open
                window.syncMatrixToCloud();
            })
            .catch(e => console.error("Path swap error:", e));
    });
};
"""

content = content + swap_logic

with open('downtime.js', 'w') as f:
    f.write(content)
