## 2024-05-18 - Missing loading states on critical actions
**Learning:** Found multiple submit and action buttons (like LOGIN, START APP, RUN DIAGNOSTICS) without loading states/spinners and disabled states during execution, which could lead to multiple submissions.
**Action:** Always add loading states (e.g. `disabled=true`) to long-running async buttons.
