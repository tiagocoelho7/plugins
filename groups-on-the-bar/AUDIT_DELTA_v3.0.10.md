# AUDIT DELTA — Groups 'On the Bar' v3.0.10 candidate

## Frozen baseline

This candidate is built from the frozen v3.0.9 HOLD candidate:

- SOURCE SHA-256: `a98039a3ec95ec39768520a816d86b37d837937b8cf090b6e11da8443382cc83`
- XPI SHA-256: `c7709077852caecd43c2d52526113ce6017103b4d9504580c59af13763b7fbf3`
- Audit bundle SHA-256: `7a974e5e31e0c56028558f59008a614983eb54c3750d3ccf8f8ef02ddc1e8169`

The independent re-audit returned HOLD with one MEDIUM blocker: F-02 remained partially open because a newly observed native group could adopt the persistent identity of a different closed group when title/color/ordered URLs matched.

## Runtime delta

The runtime fix is deliberately narrow and remains in the v3 architecture.

### `background.js`

1. `saveNativeGroupUnlocked()` no longer searches closed persistent entities using `snapshotMatchesSavedGroup()`.
2. The legacy fallback that matched a closed entity with no meaningful recovery URLs by title/color was also removed.
3. `reconcileLiveLinksUnlocked()` no longer relinks closed entities to unclaimed native groups by title/color/content.
4. Exact existing live binding (`windowId + groupId`) remains valid positive identity evidence.
5. `snapshotMatchesSavedGroup()` remains only in explicit Trash restore, after the Trash entry itself already supplies the exact stored `windowId + groupId`; the matcher is therefore validation, not discovery.

Resulting rule:

> If a native group is not already positively linked to a persistent entity, it receives a new persistent ID. Equal content is never sufficient identity evidence.

## Regression coverage

New regression exercises both:

- auto-reconcile / auto-pin;
- explicit `pinNativeGroup`.

For each path it:

1. creates persistent entity X;
2. closes X;
3. creates a new native entity Y with the same title, color, URL and Container signature;
4. verifies X remains closed and unchanged;
5. verifies Y receives a different persistent ID;
6. adds another URL to Y;
7. verifies X's stored snapshot is still byte-for-byte unchanged while Y receives the edit.

The prior test that expected an externally recreated matching native group to reconnect to a closed ID was inverted to the new identity rule. The old legacy blank-snapshot repair expectation was also inverted: ambiguous legacy data is preserved rather than overwritten.

## Test-harness correction

`tests/background.test.js` previously started `run()` as an unregistered top-level Promise. Under `node --test`, Node could terminate the file while that Promise was still pending and report the file as passed. One mock path also awaited a `tabGroups.onRemoved` listener while the same serial state lock was still held, creating a mock-only deadlock.

The candidate registers the background integration suite with `node:test`, so the test runner now awaits the complete async run and fails on any assertion/timeout. The mock removal events are queued and awaited only after the extension operation releases the serial lock. The complete background integration run now reaches the final `all assertions passed` marker.

## Intentionally unchanged LOW findings from the v3.0.9 re-audit

This delta does not attempt to mix non-blocking behavior changes into the F-02 release fix. The following remain documented for later work:

- F-05: exact compact tombstone history is still ultimately bounded by Firefox Sync quota;
- F-08: tombstone archive writes/pulls are not universally covered by the main write backoff;
- F-09: `/toggle/<uuid>` remains triggerable by a site that already knows the UUID;
- F-11: malformed variants under the reserved `/empty/` namespace are not all rejected;
- F-17: archive UI does not explicitly describe every cross-device effect;
- N-01: concurrent equivalent compact archives can retain redundant segments.

No v4/P000 work is included.
