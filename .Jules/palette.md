## 2026-04-15 - Adding ARIA labels to Icon-Only Buttons
**Learning:** This app heavily uses icon-only buttons in the main header (e.g., Settings, Admin, Yield, Maintenance) that are identified by tooltips or visual position but completely lack descriptive text for screen readers. Missing `aria-label` attributes on these elements is a common pattern here.
**Action:** Always check interactive elements (buttons, links) that contain only emojis or icons, and ensure they have a descriptive `aria-label` added.
## 2024-04-16 - Accessible Close Buttons
**Learning:** Found a common pattern of icon-only close buttons (using "✕" or "×") in `index.html` modals without any accessible names, making them invisible to screen readers.
**Action:** Always add `aria-label="Close"` to icon-only buttons. Can be easily searched using `grep -n "✕\|×"` in HTML files to find unlabelled close buttons.

## 2026-04-17 - Missing Keyboard Support on Interactive Divs
**Learning:** Found a pattern of using `<div>` tags with `onclick` handlers for interactive elements (like toast notifications, floating action buttons, and status banners) without providing keyboard navigation or screen reader support.
**Action:** Always ensure that any `<div>` acting as a button includes `role="button"`, `tabindex="0"`, a descriptive `aria-label`, and an `onkeydown` event handler for 'Enter' and 'Space' keys. Or, prefer using actual `<button>` tags when possible.

## 2024-05-18 - Matrix Button Accessibility
**Learning:** Discovered that the complex grid of `<div>` elements serving as toggle buttons in the "Maintenance Matrix" completely lacked screen reader and keyboard accessibility, isolating users relying on those technologies from a core piece of functionality.
**Action:** Always apply `role="button"`, `tabindex="0"`, descriptive `aria-label`s, and `onkeydown` handlers to `<div>` elements acting as buttons. Crucially, also include a `:focus-visible` CSS rule so keyboard users have a visual indicator of their current tab focus.

## 2024-05-19 - Accessible Modals and Previews
**Learning:** Found a pattern of interactive images and modales with `onclick` handlers (e.g. `streamPhotoPreview`, `photoViewerModal`) without providing keyboard navigation or screen reader support.
**Action:** Always apply `role="button"`, `tabindex="0"`, descriptive `aria-label`s, and `onkeydown` handlers to `<img>` and `<div>` elements acting as buttons or interactive previews.

## 2024-05-20 - Missing Global Keyboard Focus Indicators
**Learning:** Found that while custom UI components like the matrix grid had isolated `:focus-visible` styles, the vast majority of interactive elements (buttons, `[role="button"]` divs, `select`, checkboxes) across the app lacked visual focus states. This rendered keyboard navigation nearly impossible for users relying on Tab navigation.
**Action:** Always apply a global CSS `:focus-visible` rule that broadly targets `button`, `[role="button"]`, and form inputs like `select` and `input[type="checkbox"]` to provide a consistent, app-wide outline (e.g., using `--info`) that adheres to the design system.
## 2024-05-21 - Accessible Dynamic Buttons
**Learning:** Found a pattern of missing ARIA labels on dynamically generated icon-only buttons via template literals.
**Action:** Always verify dynamically generated HTML and `document.createElement("button")` patterns to ensure they receive accessible names just like static HTML elements.
