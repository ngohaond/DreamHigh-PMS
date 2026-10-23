# Placement Barem and Branch Scope

Keep placement score thresholds configurable on active Level master data and compare the total score inclusively; do not invent business score ranges.

## What Happened
For DreamHigh D1, Level had no score bounds and Student had no branch field. Nullable Level bounds and a branch-owned PlacementTest record supported configurable recommendations without widening ownership into the Student model. The API checks caller branch scope and current enrollments on creation; history is filtered by the branch recorded on each placement. No threshold values were supplied by business documents.

## Takeaway
When a student entity has no branch owner, derive creation authorization from a trusted caller branch plus current enrollment consistency, and persist that branch on the child record. Keep historical reads scoped by the child record’s stored branch. Require operations to configure complete, non-overlapping bounds before relying on recommendations.

For finance invoices, do not infer branch from an arbitrary enrollment: require an active enrollment matching the selected fee plan's course and branch, use an explicit class when more than one match exists, and fail closed when there is no match. Snapshot the selected branch on the invoice so later reads do not depend on current enrollment state.

## History
- 2026-10-23 (DreamHigh/D1): initial
- 2026-10-23 (DreamHigh/D2): added invoice ownership guidance for the no-Student-branch schema.