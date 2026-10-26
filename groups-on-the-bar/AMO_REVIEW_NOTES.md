# AMO reviewer notes — Groups 'On the Bar' 3.0.10

## Purpose

The extension saves native Firefox tab groups, creates toolbar bookmark shortcuts, restores closed groups, and synchronizes group metadata and URLs through Firefox `storage.sync`.

## 3.0.10 persistent-identity hardening

Version 3.0.10 is a narrow follow-up to the frozen 3.0.9 HOLD candidate. It removes the remaining content-based identity adoption found by independent re-audit.

- A native Firefox group can reuse a saved persistent entity only when that entity already carries the exact live `windowId + groupId` binding.
- Closed saved entities are never automatically relinked from title, color, tab URL order, or container equality. An unclaimed native group receives a new persistent UUID even when its visible content is byte-for-byte equivalent to a closed saved group.
- This rule applies both to automatic reconciliation/auto-pin and to explicit `pinNativeGroup`. Subsequent edits to the new native group therefore cannot overwrite the older closed entity.
- The previous legacy blank-snapshot repair heuristic was removed because it lacked positive identity evidence. Ambiguous old data is preserved and the observed native group becomes a separate entity.
- `snapshotMatchesSavedGroup()` remains only in the explicit trash-restore path, where the trash entry already contains the exact runtime `windowId + groupId`; there it is a safety validation, not an identity-discovery mechanism.
- No permission, Sync wire field, remote endpoint, telemetry behavior, or host permission changed in 3.0.10.

## 3.0.9 data-integrity and Sync maintenance

Version 3.0.9 starts from the frozen 3.0.7 release and does not incorporate the separate experimental 3.0.8 `/toggle/` diagnostic/workaround line. The changes are deliberately concentrated in data-integrity boundaries identified during an independent adversarial review.

- Persistent `group.id` is authoritative. Records with different IDs are never deleted merely because title/color/tab URLs match. If two IDs are linked to the same native Firefox group, the secondary runtime link is detached while both persistent records are preserved.
- A remote deletion keeps its original `deletedAt`, but the receiving profile receives a fresh local 30-day trash window before its pre-existing local copy becomes unrecoverable.
- Sync metadata more than 24 hours in the future is rejected. Local state already carrying a far-future Sync timestamp is normalized and republished with a sane revision.
- A remote archive never closes a group that is currently open on this profile. Active local use wins conservatively and is republished as a newer unarchived revision.
- Event-page wakeups no longer detach a saved/live link after one missing `tabGroups.query()` result. A missing link is observed for 30 seconds before detachment, and `storage.session` is used, when available, to keep the lifecycle observation boundary stable across event-page wakes.
- Deferred fragmented Sync records no longer leave `syncPending` without a revision. Failed writes use a 30-second backoff, while healthy writes still flush immediately.
- `keepAtTop` verifies the post-fallback position and rate-limits retries for a layout Firefox refuses to place, preventing an `onMoved` feedback loop.
- New group and backup records include an additional 64-bit integrity fingerprint while retaining the existing 32-bit field for rolling compatibility with previous v3 clients. New deletion records omit redundant `deletedAt` when it equals `updatedAt`; readers already fall back to `updatedAt`.
- Old tombstones are compacted without using an unsafe age-only garbage collector. When non-backup Sync data reaches 260 items or about 56 KiB, deletion records at least 30 days old are copied into exact v2 compact deletion segments. The compatible v1 tombstone is kept for an additional 7-day propagation grace period and only then removed. New clients treat the archived ID as deleted even if an older v3 client later republishes a v1 group record with a newer timestamp. A recovery of a remotely deleted/archived ID creates a new persistent ID, so recovery does not remove the durable deletion barrier for the old identity. This substantially reduces item/byte growth while remaining fail-closed.
- Compact archive segments are append-only and self-validating. If a segment is malformed, clients stop destructive Sync reconciliation and preserve local state. The archive uses exact UUID bytes (Base64 encoded) plus exact fallback strings for non-UUID legacy IDs; it does not use a probabilistic Bloom filter or a lossy hash set.
- The reserved Sync sentinel `/empty/<groupId>` is rejected by the general restore-URL normalizer, internal messaging rejects an explicitly foreign sender, and all nine locales disclose that automatic-backup restore may save and close affected open groups.
- No permission, host permission, data-collection category, external network access, telemetry, remote code, or content script was added.

## 3.0.7 maintenance change

- Version 3.0.7 is a narrow packaging/appearance maintenance release. The Firefox group runtime (`background.js`, `sync-store.js`, popup logic, Containers, Sync/Sessions classifier, bookmarks, and tab-group lifecycle code) is unchanged from the approved 3.0.6 candidate.
- The only functional bug fix is in the optional Windows appearance installer. `visual-src/windows/Visual-Common.ps1` now marks the mandatory `List` parameter of `Add-GruposUniquePath` with PowerShell `[AllowEmptyCollection()]`. Windows PowerShell otherwise rejects the installer's initial empty `List[string]` before the function body can discover any Firefox profile.
- The failure was reproduced on a real Windows installation with the 3.0.6 visual package and the corrected installer was then manually validated successfully on Windows.
- The XPI version and the embedded appearance-package filenames are updated to 3.0.7 so the local appearance assistant serves the corrected Windows archive. macOS and Linux installer logic is unchanged.
- No new permission, data category, host permission, network access, telemetry, or remote code is introduced.

## 3.0.6 maintenance baseline retained unchanged

- Tab previews render the page host together with the local tab title. Titles remain local display metadata and are not added to Firefox `storage.sync`.
- Saved groups are not deleted when their final native tab is closed, ungrouped, or moved away. The persistent group becomes closed with a neutral local `about:blank` placeholder.
- Firefox 155 exposes the same `tabs.onRemoved` + `tabGroups.onRemoved(isWindowClosing=false)` shape for closing the final tab, native **Save and close group**, and native **Delete group**. The extension therefore uses the `sessions` permission and checks `sessions.getRecentlyClosed()` only while resolving that removal. In measured Firefox 155 behavior, final-tab close/Delete appear in Recently Closed while native Save and close does not.
- Version 3.0.6 hardens this classifier so Recently Closed is never matched by URL/window alone and an older tab close from the same group cannot be reused for a later group-removal episode. It keeps short-lived in-memory lifecycle evidence for observed tabs, requires a mutually unique attribution between a Session entry and one observed `tabs.onRemoved` event, and only treats that removal as destructive evidence when the lifecycle cache proves it was terminal for the current group generation. If the group is later observed alive, that older removal is explicitly disqualified.
- Each live `windowId/groupId` also carries an in-memory generation token. When Firefox restores a closed group and reuses the same numeric `groupId`, the new live instance receives a new generation and old removal markers/pending classifiers are invalidated. Membership evidence therefore records both `oldGroupId` and its generation.
- Version 3.0.6 additionally revalidates that generation at **state-mutation time**, not only when `tabGroups.onRemoved` was first observed. A stale generation-N removal that waited behind the serial state queue is ignored if the same `windowId/groupId` is already alive as generation N+1. Pending creation performs the same guard, and a pending finalizer rechecks the current removed generation immediately before any `intentionallyEmpty` write, preventing an old task from transiently publishing `about:blank` to local storage or Firefox Sync after restore.
- If the lifecycle cache believed that a matching tab was live but `tabs.query()` can no longer find it and no `tabs.onRemoved` removed it from the cache, that Session is considered ambiguous rather than being used as destructive evidence. Sessions predating the current Event Page observation lifecycle are also not used destructively.
- Move-out, A→B, and native Ungroup use positive membership provenance. The transient evidence records `oldGroupId`, its generation, and `newGroupId`, and it is accepted only when the tab is known to have left the specific generation of the removed group and the matching `tabGroups.onRemoved` for that exact window/group/generation has already been observed. A same-URL tab from another group or a stale marker from an earlier restored generation cannot prove emptiness.
- `sessions.onChanged` ordering is handled conservatively: creating a pending removal performs an immediate `getRecentlyClosed()` read, an unmatched `sessions.onChanged` does not consume unrelated pendings, `tabs.onRemoved` retries resolution in case the Session event arrived first, and the public event observation time is captured before the serial state queue runs.
- Native Save and close therefore preserves the extension's last real snapshot. Final-tab close and native Delete keep the GOTB persistent entity as intentionally empty only when the Recently Closed evidence is attributable without ambiguity. Explicit permanent deletion of the saved entity remains the extension's own **Delete group** command.
- `intentionallyEmpty` remains part of the synced semantic record. For rolling compatibility with the actual frozen v3.0.0 client, the wire representation remains `https://grupos-na-barra.invalid/empty/<groupId>`. v3.0.0 treats this reserved `.invalid` HTTPS URL as restorable rather than as a degraded placeholder, so it does not republish the removed real URL. v3.0.6 recognizes the sentinel even if a v3.0.0 peer republishes it without the newer boolean field, and converts it back to plain local `about:blank`.
- Intentionally empty groups remain excluded from content-based deduplication, so independent empty groups with the same name/color stay distinct.
- Tests include the frozen v3.0.0 runtime as a source-only fixture and exercise a full v3.0.6 → v3.0.0 → v3.0.6 Sync round trip. The fixture is not packaged into the XPI.
- New regressions cover an earlier tab close from the same group followed by Native Save and close, the same sequence with multiple remaining tabs, terminal close/Delete after an earlier non-terminal close, Firefox reusing the same `groupId` after restore, same-URL/same-window unrelated membership evidence, same-URL/same-window Recently Closed entries, an unobserved missing duplicate tab, two pending same-URL groups, unmatched Session events, `sessions.onChanged` before pending creation, serial queue delay over 500 ms, a generation-N `tabGroups.onRemoved` blocked in the serial queue while generation N+1 is restored with the same `groupId`, a stale pending finalizer blocked while generation N+1 becomes live, reverse membership ordering falling back to preserve, and reopening/editing while a removal is pending.


## Build

The submitted XPI is built entirely from the attached source package using Python's standard library. No minification, transpilation, bundling, generated JavaScript, npm package, or downloaded dependency is used.

Reviewer environment:

- Ubuntu 24.04 or equivalent
- Python 3.10 or later
- Node.js 20 or later only for the optional test suite; Node.js is not used by the build
- the standard `zip`, `unzip`, and POSIX shell tools only for optional manual inspection

Commands:

```bash
python3 build.py --check-reproducible
node --test tests/*.test.js
```

Outputs are written to `dist/`. The builder uses fixed ZIP timestamps, stable file ordering, fixed permissions, and compares a second byte-for-byte build when `--check-reproducible` is supplied.

## Permissions

- `bookmarks`: creates and maintains the toolbar shortcuts.
- `tabs`: reads group tab URLs/titles and creates, groups, closes, and reorders tabs.
- `cookies`: Firefox requires this permission to use `tabs.create({cookieStoreId})`. The extension never calls `browser.cookies`.
- `tabGroups`: reads and updates native Firefox tab groups.
- `storage`: local state, UI preferences, and Firefox `storage.sync`.
- `sessions`: used only after a native group disappears to inspect `sessions.getRecentlyClosed()` and distinguish native Save and close from real tab close/delete. The result is not persisted or synchronized.
  This permission was introduced in the 3.0.x maintenance line and may require explicit user approval when updating from a version that did not have it. The extension does not request `history`.
- `menus`: tab and toolbar-button context menu commands.
- `webRequest` + `webRequestBlocking` + `https://grupos-na-barra.invalid/*`: cancels the top-level navigation generated when a managed bookmark shortcut is clicked. The same reserved `.invalid` origin is also used only as the Sync wire sentinel for intentional empty groups during rolling updates. It has no server.

The extension has no content scripts, no broad web host permission, no remote code, and no developer-operated network endpoint.

## Data disclosure

`browser_specific_settings.gecko.data_collection_permissions.required` declares:

- `browsingActivity`: group tab URLs are placed in Firefox `storage.sync`.
- `bookmarksInfo`: bookmark shortcut data is managed and can be synchronized by Firefox.

Local tab titles do not enter `storage.sync`. Favicons are used only as transient Firefox-provided local references and are not persisted by the extension. The runtime does not contact external favicon services. Diagnostics exclude URLs, titles, and group names. There is no telemetry or automatic diagnostic upload. See `PRIVACY.md`.

## Optional appearance packages

The XPI contains exactly three current-version `.zipdata` files—one each for macOS, Windows, and Linux. They are ordinary ZIP archives offered by the extension's local appearance assistant. The WebExtension cannot execute them. A user must download, extract, and manually launch the installer.

Their complete readable sources are under:

- `visual-src/macos/`
- `visual-src/windows/`
- `visual-src/linux/`

They only install or remove a dedicated `grupos-na-barra.css` import in a selected Firefox profile. Existing `userChrome.css` and `user.js` files are backed up before modification. The installers perform no download and no network request. macOS, Windows, and Linux installers refuse to modify a profile while Firefox is running.
