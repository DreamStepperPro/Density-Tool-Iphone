1. **Inject God-Mode Trigger Buttons in app.js**
   - Read `app.js` and modify `window.renderInterface()` to append `<button class="btn-icon" onclick="window.openLaneProfiler(${i})" style="margin-left:8px; font-size:0.9rem; padding:0 5px;" aria-label="Lane ${i} Diagnostics" title="Lane Diagnostics">🔍</button>` right next to the `btnDisable-${i}` button, checking `if (isAdmin)`.
   - Remove `#btnProfilerTab` from `#machineNav` in `index.html` and the tab-hide logic in `app.js`'s `switchMachine`.
   - Modify `index.html` to convert `#profilerModal` back into a popup overlay (`class="modal-overlay" style="display:none; align-items:center; justify-content:center; z-index:250;"`).

2. **Configure the 10-Piece Overlay & Dual Toggle**
   - Modify `profiler.js` to create `window.openLaneProfiler(laneIndex)` which clears the 10 inputs, saves `laneIndex`, configures the `profilerConfig` dropdown (Single vs Dual mode for Quad lanes), and displays the modal.
   - Retain the Enter key logic. Add wiping logic inside `window.closeProfiler()` and `window.openLaneProfiler()`.

3. **Close the Loop with Smart Route Matrix Engine**
   - In `downtime.js`, the routing math is run via `window.calculateSmartRoute`. But it uses hardcoded sequences for `path: 2` and `path: 1` per subLane.
   - We will implement a feature in `downtime.js` where `currentActiveDowntimes['pathSwap_' + subLane] = { type: 'pathSwap', subLane, timestamp: Date.now() }` dictates if the paths for a subLane should be flipped (1 instead of 2, 2 instead of 1).
   - In `downtime.js`, expose `window.acceptPathSwap = function(subLane) { ... }` which pushes this virtual "pathSwap" record to `activeDowntimes/M${m}` and triggers `window.syncMatrixToCloud()`.
   - Update `calculateSmartRoute` to check for `currentActiveDowntimes['pathSwap_' + subLane]` and swap the assigned `path` accordingly if it exists. Wait, `calculateSmartRoute` doesn't currently accept `currentActiveDowntimes`. It only accepts `degradedCutterIds`. We'll change it to accept `degradedCutterIds` AND read `currentActiveDowntimes`. Or just access `currentActiveDowntimes` directly inside `calculateSmartRoute`.
   - In `profiler.js` `runDiagnostics()`, if high variance, provide `[ ACCEPT PATH SWAP ]` button. When clicked, call `window.acceptPathSwap(activeProfilerLane)`.

4. **Verify Code Changes**
   - Use `read_file` to verify the modifications in `app.js`, `index.html`, `profiler.js`, and `downtime.js`.
   - Check that focus-gate safeguards in `window.updateUIFromCloud` within `app.js` are completely untouched.

5. **Update test suites**
   - Add test cases in `profiler.test.js` to assert that `window.openLaneProfiler` opens the modal for the correct lane, the Single/Dual toggle updates the UI, and the `[ ACCEPT PATH SWAP ]` button triggers `window.acceptPathSwap`.

6. **Run tests**
   - Execute `bun test` to confirm all test modules complete with 100% success.

7. **Complete pre-commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

8. **Submit the change.**
   - Use `submit` to commit the code once completed.
