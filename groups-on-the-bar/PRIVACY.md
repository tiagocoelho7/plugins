# Privacy — Groups 'On the Bar' 3.0.10

Last updated: 2026-09-14

Groups 'On the Bar' does not use advertising, analytics, behavioral profiling, telemetry, or a developer-operated server. The extension does not sell or share user data.

Version 3.0.10 narrows persistent-identity reconciliation so a closed saved group is never adopted by a new native group merely because title, color, URLs, and Containers match. This changes no permission, data category, host permission, external network endpoint, telemetry, remote code, or Firefox Sync wire field. The lifecycle protections introduced in 3.0.9 continue to use Firefox `storage.session`, when available, for one ephemeral timestamp that remains inside the local Firefox session and is not written to Firefox Sync.

## Data kept on this Firefox profile

The extension stores the information needed to manage saved tab groups, including group names, colors, optional icons, tab URLs, local tab titles, Firefox container identifiers, local Firefox window/tab/bookmark identifiers, archived state, ordering preferences, trash copies, and local error diagnostics.

Local tab titles, transient favicon references supplied by Firefox, Firefox window/tab/bookmark identifiers, the 30-day trash contents, and diagnostic details are not placed in Firefox Sync. Favicons are not written to persistent extension storage.

## Data transmitted through Firefox Sync

When Firefox Sync for add-ons is enabled, Firefox may transmit the following through `storage.sync` in the user's Mozilla account:

- group names, colors, optional icons, archive state, and group ordering;
- tab URLs and Firefox container identifiers;
- compact deletion markers used to prevent deleted groups from reappearing;
- a compact previous-state backup when it fits within the Firefox Sync quota.

The extension also creates ordinary Firefox bookmarks for the toolbar shortcuts. Firefox may synchronize those bookmarks when bookmark synchronization is enabled.

The developer does not receive this data. Transmission, encryption, account access, and delivery between devices are controlled by Firefox and Mozilla.

The manifest declares the required Firefox data categories `browsingActivity` and `bookmarksInfo` so this behavior appears in Firefox's installation consent interface.

## Cookies and containers

The extension requests the `cookies` permission only because Firefox requires it to pass `cookieStoreId` to `tabs.create()` when restoring a tab into the same container. The extension does not call the `browser.cookies` API and does not read, modify, or export cookies.

## Recently closed sessions

Version 3.0.6 and later use the Firefox `sessions` permission only while a native Firefox tab-group removal is being classified. It calls `sessions.getRecentlyClosed()` and compares the returned entries in memory with short-lived `tabs.onRemoved` lifecycle evidence. A Recently Closed entry is allowed to change persistent state only when it can be attributed uniquely to an observed tab removal that is terminal for the current in-memory generation of the affected native group. Older removals from the same group, duplicate URLs, missing provenance, reused `groupId` values from a restored generation, multiple compatible removals, or other ambiguity preserve the last real snapshot. A queued removal or pending finalizer also revalidates that its captured generation is still the current removed generation immediately before changing persistent state; if Firefox has already restored the same numeric `groupId` as a newer live generation, the stale task is ignored. The recently-closed list, generation tokens, and lifecycle evidence are not copied into extension storage, are not included in diagnostics or exports, and are not written to Firefox `storage.sync`. The extension does not request the `history` permission.

## Favicons

Favicons are obtained only from Firefox-provided local favicon references or Firefox's local page-icon cache. The extension does not send page hostnames to third-party favicon services.

## Diagnostics and exports

The extension keeps at most 20 local diagnostic entries. Generated diagnostic reports intentionally omit URLs, tab titles, group names, bookmarks, and browsing history. Reports are never sent automatically; copying or downloading one requires an explicit user action.

Manual JSON backup exports are created locally after an explicit user action and may contain group names, URLs, tab titles, container identifiers, and preferences. The extension does not upload the exported file.

## Optional desktop appearance package

The optional macOS, Windows, and Linux appearance packages run only when the user downloads and manually launches them. They modify the selected Firefox profile's `userChrome.css` and `user.js`, create backups before changing existing files, and do not contact a server.

## Retention and deletion

- Trash copies created by a local deletion are kept locally for up to 30 days unless restored or permanently deleted earlier. When a deletion first arrives from Firefox Sync, the receiving profile also gives its pre-existing local copy a fresh 30-day recovery window while preserving the original deletion timestamp as metadata.
- Normal deletion markers contain a generated group identifier plus deletion/version metadata. Under Sync quota pressure, markers older than 30 days can be copied into an exact compact v2 archive that contains only deleted group identifiers. The compatible v1 marker remains for a further 7-day propagation window before it is removed. The compact archive is retained so a device that was offline cannot recreate the old identity later. If a remote/archived deletion is recovered, the recovered contents receive a new persistent identifier; the old deletion marker remains authoritative for the old ID.
- Local diagnostics are limited to the 20 most recent entries and can be cleared from settings.
- In a normal Firefox configuration, uninstalling the extension removes its extension storage. Ordinary Firefox bookmarks and a manually installed `userChrome.css` customization are separate from extension storage and may remain; remove them through Firefox or the included appearance uninstaller.

Questions can be sent through the support contact shown on the add-on's Mozilla Add-ons listing.
