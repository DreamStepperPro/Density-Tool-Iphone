1. **Goal**: Add a global `:focus-visible` outline for keyboard accessibility.
2. **Action**:
   - Edit `styles.css`.
   - Replace `.matrix-btn:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }` with `button:focus-visible, [role="button"]:focus-visible, select:focus-visible, input[type="checkbox"]:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }`. This applies the outline to all focusable interactive controls rather than just the matrix buttons.
3. **Journal Entry**: Add an entry in `.Jules/palette.md` noting that interactive elements in this custom Vanilla JS app were lacking global focus states, making keyboard navigation nearly impossible, and that applying a global `:focus-visible` using the design system's `--info` color token resolves this pattern app-wide.
4. **Pre-commit**: I will run `bun test` as per the `package.json`. There are no lint or format commands, so I will just run tests. (And I'll run `pre_commit_instructions` tool to make sure).
5. **Submit**: Create PR with a title matching "🎨 Palette: Add focus visible styles for keyboard navigation" and detail the impact.
