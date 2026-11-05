# Night Shift Advantage Web — Master Specification & Contract (SPEC.md)

## 1.0 Firebase Realtime Database Paths & Mapping
- Machine Mapping:
  - Physical Machine 4635 (or config ID 1) -> 'M1'
  - Physical Machine 4636 (or config ID 2) -> 'M2'
- Mode Mapping:
  - Lunch -> 'lunch_4L'
  - Breakfast -> 'bfast_4L'
  - Nuggets Standard -> 'nuggets_4L'
  - Nuggets ALL (Rework) -> 'nuggets_all'
- Target Firebase Paths:
  - Stores: /stores/{M1|M2}/{lunch_4L|bfast_4L|nuggets_4L|nuggets_all}
  - History Check Log: /histories/{M1|M2}/{lunch_4L|bfast_4L|nuggets_4L|nuggets_all}/{pushId}
  - Shift Ledger: /shiftLedger/{M1|M2}/{pushId}
  - Active Shift Lanes: /activeShift/{M1|M2}/lanes

## 2.0 Check Payload Schema (Strict 4-Lane 0-Indexed Contract)
Whenever a scale check is logged, generate a single Firebase push key and write this exact JSON structure to BOTH /shiftLedger/{M1|M2}/{pushId} and /histories/{M1|M2}/{modeKey}/{pushId}:

    {
      "avg": "102.1g",
      "lanes": [
        { "d": "0.050", "w": "102.1g" },
        { "d": "0.048", "w": "--" },
        { "d": "--", "w": "OFF" },
        { "d": "0.052", "w": "101.9g" }
      ],
      "operator": "Operator",
      "target": "102.0g",
      "time": "10:15 PM",
      "timestamp": 1762316100000
    }

- lanes MUST be a 0-indexed array of 4 objects (indices 0..3 corresponding to Lanes 1..4).
- Disabled lanes must be formatted as: { "d": "--", "w": "OFF" }
- Enabled but unweighed lanes must be formatted as: { "d": "{currentDensityOrTarget}", "w": "--" }
- Weighed lanes must format 'd' to 3 decimals for Fillets (preserving negative signs such as '-0.020') or 1 decimal for Nuggets ('14.8'), and format 'w' to 1 decimal with a trailing 'g' ('102.1g').
- timestamp MUST be a numeric UTC epoch millisecond integer (Date.now()).

## 3.0 Store Updates & Shift Cutoff Rules
- Surgical Store Updates: Updating /stores/{M1|M2}/{modeKey}/lanes/{laneIndex} must use surgical Firebase .update() calls so other lanes are never overwritten. Include numeric lastD, lastW, lastUpdated (Date.now()), and locked: true alongside 'd' and 'w'.
- 10:00 PM Local Shift Cutoff: Live history queries and trajectory charts must filter records to the current shift (>= most recent 10:00 PM / 22:00:00 local time).
- Environment Safety: Always guard browser globals (such as typeof localStorage !== 'undefined') so headless Node/Bun test suites execute without ReferenceErrors.