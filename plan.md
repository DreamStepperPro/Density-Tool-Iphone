1. **Add `id="btnLogin"` to the login button in `index.html`**
   - The login button currently lacks an ID which makes it hard to target from JavaScript.
2. **Update `window.loginWithPin` in `app.js` to manage button loading state**
   - Grab the login button by its ID.
   - Set it to a disabled state and update its text (e.g. `VERIFYING...`) when the login process starts.
   - Reset the button state and text back to `LOGIN` when the login fails or is completed. This prevents multiple rapid submissions and improves UX.
   - Use standard DOM properties to indicate loading as per memory restrictions (`do not add custom CSS rules, animations, or classes`).
3. **Run the test suite**
   - Run `bun test` to ensure changes didn't cause any regressions.
4. **Complete Pre-commit Verification**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
5. **Submit**
   - Use the `submit` tool to finalize the task.
