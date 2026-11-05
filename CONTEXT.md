# Night Shift Advantage Web — Project Context & System Health (CONTEXT.md)

## 1.0 Current Build & Health Status
- Status: Migrated to local Antigravity repository workflow; schema synchronized with Native Android App v1.0.0+5.
- Test Suite: Passing (100% pass rate required on npm test / bun test).
- Architecture Standard: Compliant with SPEC.md Sections 1.0 through 3.0.

## 2.0 Project File Map (Source of Truth)

### 2.1 Governance & Specification Docs
- `GEMINI.md` — AI operating instructions, two-phase execution protocol, anti-bloat safeguards, and verification gates.
- `SPEC.md` — Master specification & contract for Firebase paths (`M1`/`M2`, mode keys), 0-indexed 4-lane check payload schema, surgical store updates, and 10:00 PM shift cutoff rules.
- `CONTEXT.md` — System health status, project file inventory, locked capabilities, modularization roadmap, and session handoff log.
- `plan.md` — Historical implementation plan for Lane Profiler & Smart Route path-swap integration.
- `README.md` — Repository readme stub.
- `.Jules/palette.md` — Legacy accessibility/UX learning notes.

### 2.2 Application Source Files
- `index.html` (615 lines) — Single-page application shell (v12.6), modals, operator/supervisor views, and ES module script imports (including `portionBrain.js`, `adminCenter.js`, `shiftHistory.js`, `operatorUI.js`, and `machineSettings.js` before `app.js`).
- `styles.css` (272 lines) — Application stylesheet with light/dark theme variables (`--app-scale`), responsive layout, lane card states, and visual runway engine.
- `app.js` (570 lines) — Primary application orchestrator: Firebase init & auth, UI scaling, debug logging, shared state getters, role-based routing (`initApp`, `routeUserByRole`), cloud sync (`startCloudSync`, `pushLaneToCloud`, `pushTargetToCloud`), and re-exports/bindings for `operatorUI.js`, `portionBrain.js`, `shiftHistory.js`, `machineSettings.js`, and `adminCenter.js`.
- `operatorUI.js` (467 lines) — Standalone Operator UI & Lane Action Engine module exporting `renderInterface`, `updateUIFromCloud`, `applyResult`, `toggleDensitySign`, `toggleLaneDisable`, `unlockAndFocus`, `toggleLock`, `updateBeltSpeed`, `handleInput`, `handleWeightInput`, `lockOnBlur`, `recheckLane`, `unlockWeightAndFocus`, `lockWeightOnBlur`, `onTargetInput`, `confirmTargetChange`, `cancelTargetChange`, `applyTargetNow`, and `initOperatorUI`.
- `adminCenter.js` (414 lines) — Standalone Admin Command Center & PIN Authentication module exporting `openAdmin`, `buildAdminUserCard`, `loginWithPin`, `startAdminRadar`, `switchAdminTab`, `closeAdmin`, `updateAdminName`, `updateUserRole`, `updateUserPin`, `showAdminDashboard`, `toggleUserApprove`, `deleteUser`, `pingAdmin`, `showAdminToast`, and `initAdminCenter`.
- `machineSettings.js` (386 lines) — Standalone Machine Switching, Settings & Sandbox Utilities module exporting `switchMachine` (SPEC.md `4635`/`1` -> `'M1'`, `4636`/`2` -> `'M2'` mapping), `toggleSandboxMode`, `jumpstartNetwork`, `getCloudMachine`, `getModeKey`, `toggleSettings`, `exportBetaData`, `saveLocalSettings`, `toggleTheme`, `saveDisplayName`, `applyTheme`, `completeSetup`, `factoryReset`, `openHelp`, `closeHelp`, `switchProfile`, and `initMachineSettings` (including `visibilitychange` wake listener and triple-tap debug UID listeners).
- `shiftHistory.js` (361 lines) — Standalone Shift History & Global End-Shift Engine module exporting `saveToHistory` (SPEC.md 0-indexed 4-lane dual-write to `/histories` and `/shiftLedger`), `renderHistoryCards`, `performLocalWipe`, `triggerGlobalShiftReset`, `toggleHistCard`, `checkAutoSave`, `deleteHistoryEntry`, `clearHistory`, `listenForGlobalReset`, `flushSmartLogic`, `getCurrentShiftStartTime`, `resetAutoSaveState`, and `initShiftHistory`.
- `portionBrain.js` (263 lines) — Standalone Portioning Brain module exporting `calculateLocal`, `calculateDensity` (Smart Adapt, Outlier Veto, Copilot Downtime Buffer, SMART-S Deadband, Safety Brake), `calculateVelocity` (3-point PVE lookback, Density Barrier, Bullseye Silencer, Deceleration/Intervention Gates, visual runway), and `FACTORS`.
- `downtime.js` (678 lines) — Maintenance Matrix & RCA Engine, Smart Route Optimization (`calculateSmartRoute`, `openSmartRoute`, `acceptPathSwap`), Stream Test Compliance & photo capture, time-gated shift barrier (`isShiftActive`, `enforceShiftBoundaries`), and About modal.
- `supervisor.js` (530 lines) — Supervisor Dashboard, department statistical engine (`calculateDepartmentStats` with CLT $\sqrt{10}$ STD estimation and SMART-S snipe broadcast), OEE machine cards (`buildSupCard`), shift history ledger (`openSupHistory`), and 24h maintenance RCA ledger (`renderMaintHistory`).
- `translations.js` (203 lines) — Bilingual i18n dictionary (`en`, `es`) and translation engine (`window.t`, `toggleLanguage`, `applyTranslations`).
- `comms.js` (161 lines) — SOS / Line Dispatch real-time messaging (`openSos`, `sendCommsMsg`, `sendLaneWarning`, `startCommsListener`, `renderChat`) and native browser notifications.
- `yield.js` (152 lines) — Yield Calculator Module (`calcYield` with 1.03 waterjet kerf multiplier, `saveEosYield`, `loadYieldHistory`, `wipeYieldHistory`, `broadcastMidShiftYield`).
- `profiler.js` (142 lines) — 10-Piece Deep Scan Lane Profiler (`openLaneProfiler`, `renderProfilerGrid`, `runDiagnostics`) for geometric imbalance vs. outlier detection.
- `processMetrics.js` (137 lines) — Process Control Metrics modal (`openProcessMetrics`, `closeProcessMetrics`, `saveProcessMetrics`) persisting yield and lane weight/height context.
- `benchmark_supervisor.js` (100 lines) — Performance benchmark harness for `buildSupCard` and `extractWeights`.
- `sw.js` (45 lines) — Network-first Service Worker (`dsi-advantage-v2`) caching core PWA assets.
- `utils.js` (11 lines) — Shared utility functions (`escapeHTML` exported and bound to `window.escapeHTML`).
- `test_app.js` (2 lines) — Legacy CommonJS require smoke script.

### 2.3 Configuration, Security & Static Assets
- `database.rules.json` — Firebase Realtime Database security rules and `.indexOn` definitions.
- `manifest.json` — PWA Web App Manifest.
- `package.json`, `package-lock.json`, `bun.lock`, `.gitignore` — Package manifest, dependency lockfiles (`happy-dom`, `jsdom`), and Git ignore config.
- `favicon.ico`, `icon.png`, `icon-192.png`, `icon-512.png`, `logo.png`, `logo_dark.png` — Application icons and light/dark brand logos.

### 2.4 Automated Test Suite Files (`bun test`)
- `app.test.js` (164 lines) — Tests `lastLogin` update warning, `pushTargetToCloud` error handling, and `buildAdminUserCard` highlight states.
- `benchmark_supervisor.test.js` (167 lines) — Tests `extractWeights` and `buildSupCard` output, stale flags, deviation classes, stability scores, and trend chips.
- `calculateLocal.test.js` (268 lines) — Tests `calculateLocal` portioning math, Smart Adapt K bounds, machine limits (`±0.500`), SMART-S grand mean redirection, `±0.5g` deadband, and PVE trend rendering.
- `comms.test.js` (390 lines) — Tests `comms.js` chat rendering (`YIELD_UPDATE`, `ERR_WT`, `ERR_MECH`), modal controls, `sendLaneWarning`, `sendCommsMsg`, and >100 message pruning.
- `downtime.test.js` (364 lines) — Tests `confirmFault`, `isShiftActive` schedule boundaries, `calculateSmartRoute` actuator routing, `populateFaultReasons`, and `confirmReEnable` (live and sandbox).
- `machineSwitch.test.js` (196 lines) — Tests default machine auto-landing (`4635`/`4636`), operator PIN prompt on `switchMachine`, and shift ledger switch markers.
- `openAdmin.test.js` (173 lines) — Tests `openAdmin` Firebase permission-denied handling and user list categorization (Recent, Approved, Unapproved).
- `processMetrics.test.js` (157 lines) — Tests 4-lane and 2-lane Process Metrics modal rendering and `saveProcessMetrics` persistence.
- `profiler.test.js` (115 lines) — Tests `profiler.js` Enter-key auto-advance, stable/imbalance/chaos diagnostics, and `acceptPathSwap` trigger.
- `pushLaneToCloud.test.js` (144 lines) — Tests `pushLaneToCloud` status dot state transitions and network error handling.
- `scaleSync.test.js` (272 lines) — Tests `SPEC.md` compliance: `getCloudMachine`, `getModeKey`, `saveToHistory` dual-write to `/histories` and `/shiftLedger` with 0-indexed 4-lane schema, fillet/nugget decimal formatting, surgical `pushLaneToCloud`, and `startCloudSync` shift cutoff query.
- `startCloudSync.test.js` (102 lines) — Tests `startCloudSync` store initialization failure toast.
- `supervisor.test.js` (259 lines) — Tests `supervisor.js` department stats, `updateTargetStdLimit`, `getAbsoluteLatest`, `getRecentChecks`, `buildSupCard`, `openSupHistory`, and `renderMaintHistory`.
- `sw.test.js` (129 lines) — Tests Service Worker `install`, `activate` cache pruning, and network-first `fetch` fallback.
- `swapSeverity.test.js` (88 lines) — Tests `swapSeverity` error handling in `downtime.js`.
- `test_xss.test.js` (24 lines) — Tests `escapeHTML` against XSS injection strings and non-string primitives.
- `translations.test.js` (191 lines) — Tests `window.t`, `toggleLanguage`, and `applyTranslations` DOM updates and module callbacks.
- `utils.test.js` (64 lines) — Unit tests for `escapeHTML` in `utils.js`.
- `yield.test.js` (371 lines) — Tests `calcYield` math and input bounds, `saveEosYield`, `broadcastMidShiftYield`, `wipeYieldHistory`, and yield modal lifecycle.

## 3.0 Locked Capabilities (Do Not Regress)
1. Machine & Mode Cloud Mapping: 4635 -> M1, 4636 -> M2; lunch_4L, bfast_4L, nuggets_4L, nuggets_all.
2. Dual-Write Check Logging: Shared pushId written simultaneously to /histories and /shiftLedger with 0-indexed 4-lane array.
3. Surgical Lane Updates: Granular .update() calls to /stores/{M1|M2}/{modeKey}/lanes/{laneIndex} preserving negative density signs.
4. 10:00 PM Shift Cutoff & Headless Guards: Inbound history listener filtered via startAt(getCurrentShiftStartTime()) and localStorage guarded for test runners.

## 4.0 Architectural Breakdown: `app.js` Modularization Roadmap (570 Lines Remaining — All 5 Steps Complete)

> **Test Import Safeguard:** Existing test suites (`app.test.js`, `calculateLocal.test.js`, `openAdmin.test.js`, `pushLaneToCloud.test.js`, `scaleSync.test.js`, `startCloudSync.test.js`) dynamically import `./app.js?isolated=...` after reassigning `global.window` in `beforeEach`. To prevent Bun's ESM module cache from skipping `window.*` bindings when `app.js` is re-imported with a query string, every extracted module exports its functions and a registration factory (`init*`) so `app.js` explicitly re-attaches `window.*` methods on each evaluation.

### [COMPLETED] Step 1: Portioning Brain — Density Math, Smart Adapt & PVE (Extracted to `portionBrain.js`, 263 lines)
- **Scope:** Extracted `calculateLocal`, `calculateDensity`, `calculateVelocity`, and `FACTORS` from `app.js` into `portionBrain.js` and re-exported/bound them in `app.js` (Lines 542–544).
- **Status:** Complete. Verified 100% pass rate across all 19 test files (125 tests).

### [COMPLETED] Step 2 (Priority 1): Admin Command Center & PIN Authentication (Extracted to `adminCenter.js`, 414 lines)
- **Scope:** Extracted `switchAdminTab`, `openAdmin`, `buildAdminUserCard`, `closeAdmin`, `updateAdminName`, `updateUserRole`, `updateUserPin`, `showAdminDashboard`, `loginWithPin`, `toggleUserApprove`, `deleteUser`, `pingAdmin`, `startAdminRadar`, `showAdminToast`, and `initAdminCenter` into `adminCenter.js` and re-exported/bound them in `app.js` (Lines 566–570).
- **Status:** Complete. Verified 100% pass rate across all 19 test files (125 tests).

### [COMPLETED] Step 3 (Priority 3): Shift History & Global End-Shift Engine (Extracted to `shiftHistory.js`, 361 lines)
- **Scope:** Extracted `saveToHistory` (SPEC.md 0-indexed 4-lane dual-write to `/histories` and `/shiftLedger`), `renderHistoryCards`, `performLocalWipe`, `triggerGlobalShiftReset`, `toggleHistCard`, `checkAutoSave`, `deleteHistoryEntry`, `clearHistory`, `listenForGlobalReset`, `flushSmartLogic`, `getCurrentShiftStartTime`, `resetAutoSaveState`, and `initShiftHistory` into `shiftHistory.js` and re-exported/bound them in `app.js` (Lines 549–553).
- **Status:** Complete. Verified 100% pass rate across all 19 test files (125 tests).

### [COMPLETED] Step 4 (Priority 2): Operator UI Rendering & Lane Input/Lock Actions (Extracted to `operatorUI.js`, 467 lines)
- **Scope:** Extracted `renderInterface`, `updateUIFromCloud` (including 1.5s `localWriteLocks` and `activeElement` focus gates), `applyResult`, `toggleDensitySign`, `toggleLaneDisable`, `unlockAndFocus`, `toggleLock`, `updateBeltSpeed`, `handleInput`, `handleWeightInput`, `lockOnBlur`, `recheckLane`, `unlockWeightAndFocus`, `lockWeightOnBlur`, `onTargetInput`, `confirmTargetChange`, `cancelTargetChange`, `applyTargetNow`, and `initOperatorUI` into `operatorUI.js` and re-exported/bound them in `app.js` (Lines 534–537).
- **Status:** Complete. Verified 100% pass rate across all 19 test files (125 tests).

### [COMPLETED] Step 5 (Priority 4): Machine Switching, Settings & Sandbox Utilities (Extracted to `machineSettings.js`, 386 lines)
- **Scope:** Extracted `getCloudMachine` and `getModeKey` (SPEC.md Section 1.0 mapping), `toggleSettings`, `exportBetaData`, `saveLocalSettings`, `toggleTheme`, `saveDisplayName`, `applyTheme`, `completeSetup`, `factoryReset`, `openHelp`, `closeHelp`, `switchMachine`, `switchProfile`, `jumpstartNetwork`, `toggleSandboxMode`, `visibilitychange` wake listener, `attachTripleTap`, and `initMachineSettings` into `machineSettings.js` and re-exported/bound them in `app.js` (Lines 325–326 and 558–561).
- **Status:** Complete. Verified 100% pass rate across all 19 test files (125 tests). `app.js` is now a clean 570-line orchestrator (reduced by 67.3% from its original 1,741 lines).

## 5.0 Session Handoff Log
- 2026-11-05: Initialized local Antigravity governance triad (GEMINI.md, SPEC.md, CONTEXT.md) to replace Jules workflow and prepare for modular cleanup of app.js.
- 2026-11-05: Completed Step 1 baseline repository audit without modifying JS/HTML/CSS source files. Verified 100% pass rate across all 19 test files (125 tests, 359 assertions via `bun test`). Populated Section 2.0 Project File Map and added Section 4.0 Architectural Breakdown for incremental `app.js` modularization in `CONTEXT.md`.
- 2026-11-05: Completed Refactoring Step 1 on `app.js` by extracting the Portioning Brain (`calculateLocal`, `calculateDensity`, `calculateVelocity`, `FACTORS`) into `portionBrain.js` (263 lines), reducing `app.js` from 1,741 to 1,517 lines. Added `<script type="module" src="portionBrain.js"></script>` before `app.js` in `index.html`, re-exported and bound globals in `app.js`, and verified 100% test pass rate (125 tests across 19 files via `bun test`).
- 2026-11-05: Completed Refactoring Step 2 on `app.js` by extracting the Admin Command Center and PIN Authentication (`openAdmin`, `buildAdminUserCard`, `loginWithPin`, `startAdminRadar`, and associated admin DOM/state helpers) into `adminCenter.js` (414 lines), reducing `app.js` from 1,517 to 1,237 lines. Added `<script type="module" src="adminCenter.js"></script>` before `app.js` in `index.html`, re-exported and bound globals in `app.js`, and verified 100% test pass rate (125 tests across 19 files via `bun test`).
- 2026-11-05: Completed Refactoring Step 3 on `app.js` by extracting the Shift History & Global End-Shift Engine (`saveToHistory`, `renderHistoryCards`, `performLocalWipe`, `triggerGlobalShiftReset`, `getCurrentShiftStartTime`, and associated history/reset helpers) into `shiftHistory.js` (361 lines), reducing `app.js` from 1,237 to 1,030 lines. Added `<script type="module" src="shiftHistory.js"></script>` before `app.js` in `index.html`, re-exported and bound globals in `app.js`, and verified 100% test pass rate (125 tests across 19 files via `bun test`).
- 2026-11-05: Completed Refactoring Step 4 on `app.js` by extracting the Operator UI & Lane Action Engine (`renderInterface`, `updateUIFromCloud`, `applyResult`, lane input/lock handlers, and target confirmation helpers) into `operatorUI.js` (467 lines), reducing `app.js` from 1,030 to 757 lines. Added `<script type="module" src="operatorUI.js"></script>` before `app.js` in `index.html`, re-exported and bound globals in `app.js`, and verified 100% test pass rate (125 tests across 19 files via `bun test`).
- 2026-11-05: Completed Refactoring Step 5 on `app.js` by extracting Machine Switching, Settings, and Sandbox Utilities (`switchMachine`, `toggleSandboxMode`, `jumpstartNetwork`, `getCloudMachine`, `getModeKey`, and associated settings/network helpers) into `machineSettings.js` (386 lines), reducing `app.js` from 757 to 570 lines (a total reduction of 1,171 lines from the initial 1,741-line file). Added `<script type="module" src="machineSettings.js"></script>` before `app.js` in `index.html`, re-exported and bound globals in `app.js`, and verified 100% test pass rate (125 tests across 19 files via `bun test`).
