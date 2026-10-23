# Receipt PDF and Branch Sequence

Use pdfmake's embedded virtual fonts for Vietnamese PDF output and derive receipt ordinals from append-only branch/year payment records when schema changes are out of scope.

## What Happened
For DreamHigh D3, pdfmake 0.2.20's `build/vfs_fonts` bundle and `Roboto` font map rendered Vietnamese text in Node without adding external font files. Payment has no collector column, but D2 transactionally stores the actor in the matching `PAYMENT/CREATE` audit record. A stable receipt ordinal can be derived by counting committed payment IDs through the target ID within its branch and UTC paid year.

## Takeaway
Authorize branch scope before loading receipt relations or rendering. Reuse transactional audit for collector identity and fail closed when it is absent. An ID-bounded count does not change for later payments, including backdated payments, but relies on the approved append-only/no-hard-delete payment lifecycle; cancellation must use separate ledger records. Validate actual PDF output with a render check as well as document-definition assertions.

## History
- 2026-10-23 (DreamHigh/D3): initial.