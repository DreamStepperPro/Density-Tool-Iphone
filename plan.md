1. **app.js (State)**: Remove `copilotEnabled: false` from the default `config` object.
2. **app.js (Math Engine)**: Inside `calculateDensity`, remove the `if (config.copilotEnabled && !lane.copilotSuspended)` wrapper, keeping only the inner logic for `!lane.copilotSuspended`.
3. **app.js (Surrender Protocol)**: Inside `window.applyResult`, replace the `if (config.copilotEnabled && !lane.copilotSuspended)` wrapper with `if (!lane.copilotSuspended)`.
4. **app.js (Settings UI)**: In `window.toggleSettings` and `window.saveLocalSettings`, remove any JS code handling `copilotSettingContainer` and `setCopilot`.
5. **index.html**: Completely delete the `copilotSettingContainer` div (which contains the Copilot Beta checkbox).
6. **Pre-commit**: Follow instructions in `pre_commit_instructions` tool to ensure tests and verifications are done.
