1. Add new tests to `app.test.js` to cover the `calculateLocal` function logic:
    - Sets active K properly based on limits (Outlier Veto)
    - Bounds new density by machine limits
    - Redirects math to grand mean when snipe lane is active
    - Tolerance deadband locks density within ±0.5g of snipe target
    - Calculates predictive velocity and updates trend UI
2. Use bun to run tests and make sure tests pass.
3. Complete pre commit instructions for testing, verifications, reviews and reflections.
4. Submit the change.
