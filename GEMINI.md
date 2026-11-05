# Night Shift Advantage Web — AI Operating Instructions & Guardrails (GEMINI.md)

## 1. Mandatory Pre-Read
Before proposing, analyzing, or modifying any code in this repository:
1. Read SPEC.md in full to inspect data contracts, Firebase Realtime Database schemas, and calculation rules.
2. Read CONTEXT.md to check current system health, file maps, and locked behaviors.
3. Never guess paths or refactor working code outside the explicit scope of the directive.

## 2. Two-Phase Execution Protocol
1. Phase 1: Read-Only Implementation Plan:
   - Present a concise plan detailing targeted file edits, test impact, and safety boundaries.
   - Wait for explicit user approval before modifying files, unless the prompt starts with "SYSTEM DIRECTIVE:".
2. Phase 2: Execution & Verification:
   - Make complete, compile-ready edits without placeholders or truncated code.
   - Run the local test suite (npm test or bun test) and resolve all test regressions before finishing.

## 3. Anti-Bloat & Refactoring Safeguards
- Dependency Lock: Do NOT install new npm/bun packages without explicit user permission.
- Incremental Refactoring: When cleaning up large legacy files (such as app.js), extract one isolated module at a time while ensuring existing test suites continue to pass.
- Truth-in-Telemetry: Never stub or fake Firebase connections or check logging in production code.
- Contract Adherence: Never alter the 0-indexed 4-lane payload schema or Firebase path structures defined in SPEC.md.

## 4. Mandatory Verification & Context Sync
Every completed coding task must execute:
1. Automated Test Gate: Run npm test (or bun test) and achieve a 100% pass rate.
2. Context Synchronization: Update CONTEXT.md with any new or modified files in the Project File Map and append a dated summary entry in the Session Handoff Log.