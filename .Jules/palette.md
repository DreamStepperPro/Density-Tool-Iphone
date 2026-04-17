## 2026-04-15 - Adding ARIA labels to Icon-Only Buttons
**Learning:** This app heavily uses icon-only buttons in the main header (e.g., Settings, Admin, Yield, Maintenance) that are identified by tooltips or visual position but completely lack descriptive text for screen readers. Missing `aria-label` attributes on these elements is a common pattern here.
**Action:** Always check interactive elements (buttons, links) that contain only emojis or icons, and ensure they have a descriptive `aria-label` added.
## 2024-04-16 - Accessible Close Buttons
**Learning:** Found a common pattern of icon-only close buttons (using "✕" or "×") in `index.html` modals without any accessible names, making them invisible to screen readers.
**Action:** Always add `aria-label="Close"` to icon-only buttons. Can be easily searched using `grep -n "✕\|×"` in HTML files to find unlabelled close buttons.

## 2026-04-17 - Missing Keyboard Support on Interactive Divs
**Learning:** Found a pattern of using `<div>` tags with `onclick` handlers for interactive elements (like toast notifications, floating action buttons, and status banners) without providing keyboard navigation or screen reader support.
**Action:** Always ensure that any `<div>` acting as a button includes `role="button"`, `tabindex="0"`, a descriptive `aria-label`, and an `onkeydown` event handler for 'Enter' and 'Space' keys. Or, prefer using actual `<button>` tags when possible.
