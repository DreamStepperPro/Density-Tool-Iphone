## 2026-04-15 - Adding ARIA labels to Icon-Only Buttons
**Learning:** This app heavily uses icon-only buttons in the main header (e.g., Settings, Admin, Yield, Maintenance) that are identified by tooltips or visual position but completely lack descriptive text for screen readers. Missing `aria-label` attributes on these elements is a common pattern here.
**Action:** Always check interactive elements (buttons, links) that contain only emojis or icons, and ensure they have a descriptive `aria-label` added.
