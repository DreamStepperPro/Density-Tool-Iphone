## 2025-04-26 - Add aria-labels to mainBeltSpeed and streamCameraInput
**Learning:** Found inputs (like belt speed) with adjacent visual text labels (`<span>`) but no programmatic `<label for="...">` or `aria-label`, leaving them inaccessible to screen readers. Also found an input type file visually hidden (`display:none`) that relies on a button to trigger it. The hidden input still conceptually needs an `aria-label` even if skipped by some screen readers.
**Action:** Always verify that input fields, especially those relying on surrounding visual context or hidden proxies, have explicit accessible names via `aria-label` or `aria-labelledby`.
## 2026-05-01 - Add aria-label to icon-only button
**Learning:** Icon-only buttons lacking `aria-label` pose accessibility barriers to screen readers, especially within dynamic or injected HTML patterns. In this app's UI elements, specifically in dynamically generated supervisor cards (`supervisor.js`), ensuring all `btn-icon` elements possess appropriate ARIA labels is a standard a11y requirement.
**Action:** Consistently inspect dynamically constructed HTML components in  files for `<button>` tags containing emojis or icons without text or `aria-label` attributes.
## 2026-05-01 - Add aria-label to icon-only button
**Learning:** Icon-only buttons lacking aria-label pose accessibility barriers to screen readers, especially within dynamic or injected HTML patterns. In this app's UI elements, specifically in dynamically generated supervisor cards (supervisor.js), ensuring all btn-icon elements possess appropriate ARIA labels is a standard a11y requirement.
**Action:** Consistently inspect dynamically constructed HTML components in Javascript files for button tags containing emojis or icons without text or aria-label attributes.
## 2026-05-01 - Add aria-label to icon-only button
**Learning:** Icon-only buttons lacking aria-label pose accessibility barriers to screen readers, especially within dynamic or injected HTML patterns. In this app's UI elements, specifically in dynamically generated supervisor cards (supervisor.js), ensuring all btn-icon elements possess appropriate ARIA labels is a standard a11y requirement.
**Action:** Consistently inspect dynamically constructed HTML components in Javascript files for button tags containing emojis or icons without text or aria-label attributes.
