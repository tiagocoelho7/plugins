"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function runtimeJavaScript() {
  return [
    "background.js",
    "sync-store.js",
    "ui-preferences.js",
    "translations-extra.js",
    "popup/popup.js",
    "popup/view-model.js",
    "launcher/favicon.js",
    "launcher/open.js",
    "visual/setup.js"
  ].map((relativePath) => `${relativePath}\n${read(relativePath)}`).join("\n");
}

test("runtime does not contain remote execution or undisclosed third-party favicon traffic", () => {
  const source = runtimeJavaScript();
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Function\b/);
  assert.doesNotMatch(source, /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
  assert.doesNotMatch(source, /icons\.duckduckgo\.com|google\.com\/s2\/favicons/i);
  assert.doesNotMatch(source, /https?:\/\/(?!(?:grupos-na-barra\.invalid|www\.w3\.org\/2000\/svg))/i);
});

test("manifest permissions stay narrow and intentional", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.version, "3.0.10");
  assert.equal(manifest.incognito, "not_allowed");
  assert.deepEqual(manifest.permissions, [
    "bookmarks",
    "tabs",
    "cookies",
    "tabGroups",
    "storage",
    "sessions",
    "menus",
    "webRequest",
    "webRequestBlocking",
    "https://grupos-na-barra.invalid/*"
  ]);
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions.required,
    ["browsingActivity", "bookmarksInfo"]
  );
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "142.0");
  assert.equal(manifest.content_security_policy, "script-src 'self'; object-src 'none'");

  const background = read("background.js");
  assert.match(background, /browser\.sessions\.getRecentlyClosed/);
  assert.match(background, /browser\.sessions\.onChanged/);
  assert.doesNotMatch(background, /browser\.history\b/);
  assert.doesNotMatch(background, /browser\.sessions\.(?:restore|setTabValue|getTabValue)/);
});

test("release source is reviewable and visual installers protect live Firefox profiles", () => {
  assert.equal(fs.existsSync(path.join(root, "build.py")), true);
  assert.match(read("build.py"), /suffix\.lower\(\) in \{\"\.sh\", \"\.command\"\}/);
  for (const platform of ["macos", "windows", "linux"]) {
    assert.equal(fs.existsSync(path.join(root, "visual-src", platform)), true, platform);
  }

  const linuxInstall = read("visual-src/linux/instalar-visual.sh");
  const linuxRemove = read("visual-src/linux/remover-visual.sh");
  const linuxCommon = read("visual-src/linux/visual-common.sh");
  assert.match(linuxCommon, /gnb_assert_firefox_closed\(\)/);
  assert.match(linuxInstall, /gnb_assert_firefox_closed/);
  assert.match(linuxRemove, /gnb_assert_firefox_closed/);
  assert.match(linuxCommon, /while \[\[ -e "\$backup" \]\]/);
  const macCommon = read("visual-src/macos/visual-common.sh");
  assert.match(macCommon, /\[\[ -t 0 \]\] \|\| return 0/);
  assert.match(macCommon, /while \[\[ -e "\$backup" \]\]/);
  const windowsCommon = read("visual-src/windows/Visual-Common.ps1");
  assert.match(windowsCommon, /while \(Test-Path -LiteralPath \$destination\)/);

  const background = read("background.js");
  assert.match(background, /width:\s*500/);
  assert.match(background, /height:\s*720/);
  assert.match(background, /SAFE_INLINE_FAVICON_PATTERN/);
  assert.doesNotMatch(background, /clean\.slice\(0,\s*2000\)/);
  assert.match(background, /shouldRetryPendingSyncUnlocked/);
  assert.match(background, /SYNC_RETRY_INTERVAL_MS/);
  assert.match(background, /sanitizeDiagnosticStackText/);

  const popup = read("popup/popup.js");
  assert.match(popup, /const controlStates = \[\.\.\.document\.querySelectorAll\("button, input"\)\]/);
  assert.match(popup, /control\.disabled = wasDisabled/);
  assert.doesNotMatch(popup, /document\.querySelectorAll\("button, input"\)[^]*control\.disabled = false/);
});
