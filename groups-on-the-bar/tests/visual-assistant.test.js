"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("o assistente visual é opt-in e inclui pacotes para macOS, Windows e Linux", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const popupHtml = read("popup/popup.html");
  const popupJs = read("popup/popup.js");
  const popupCss = read("popup/popup.css");
  const setupHtml = read("visual/setup.html");
  const setupJs = read("visual/setup.js");
  const background = read("background.js");

  assert.equal(manifest.version, "3.0.10");
  assert.deepEqual(manifest.background.scripts, [
    "translations-extra.js",
    "ui-preferences.js",
    "sync-store.js",
    "background.js"
  ]);
  assert.equal(manifest.permissions.includes("cookies"), true);
  assert.doesNotMatch(background, /browser\.cookies\b/);
  assert.deepEqual(manifest.options_ui, {
    page: "visual/setup.html",
    open_in_tab: true
  });
  assert.match(
    popupHtml,
    /id="visual-setup"[^>]+href="\.\.\/visual\/setup\.html"[^>]+target="_blank"/,
    "o acesso principal deve funcionar como link nativo"
  );
  assert.match(popupHtml, /id="dismiss-visual-promo"/);
  assert.match(popupJs, /visualPromoDismissed/);
  assert.match(setupJs, /Ui\.save\(\{ visualPromoDismissed: true \}\)/);
  assert.match(popupCss, /html,\s*\nbody,\s*\nhtml\[data-font-size="default"\][^}]*width:\s*460px;[^}]*min-width:\s*460px;/s);
  assert.doesNotMatch(popupCss, /max-width:\s*100vw/);
  assert.match(background, /contexts:\s*\["browser_action"\]/);
  assert.match(background, /Ui\.t\(language, "menu\.openVisual"\)/);
  assert.match(setupHtml, /src="\.\.\/ui-preferences\.js"/);
  assert.match(setupHtml, /src="\.\.\/translations-extra\.js"/);
  assert.match(setupJs, /Ui\.applyToDocument\(document, preferences\)/);
  assert.doesNotMatch(setupHtml, /visualAssistant\.temporaryTitle|about:debugging/);
  assert.doesNotMatch(setupHtml, /Recarregue a extensão 3\.0\.0/);

  const packages = ["macos", "windows", "linux"];
  for (const platform of packages) {
    const embeddedName = `groups-on-the-bar-visual-${platform}-v3.0.10.zipdata`;
    const downloadName = `groups-on-the-bar-visual-${platform}-v3.0.10.zip`;
    assert.match(setupHtml, new RegExp(`href="${embeddedName.replaceAll(".", "\\.")}"`));
    assert.match(setupHtml, new RegExp(`download="${downloadName.replaceAll(".", "\\.")}"`));

    const packagePath = path.join(root, "visual", embeddedName);
    assert.equal(fs.existsSync(packagePath), true, `${platform}: o pacote precisa existir no XPI`);
    const signature = fs.readFileSync(packagePath).subarray(0, 2).toString("ascii");
    assert.equal(signature, "PK", `${platform}: o pacote precisa ser um ZIP válido`);
    if (platform === "windows") {
      const { execFileSync } = require("node:child_process");
      const commonPs1 = execFileSync("unzip", ["-p", packagePath, "grupos-na-barra-visual-windows/Visual-Common.ps1"], { encoding: "utf8" });
      assert.match(commonPs1, /\[AllowEmptyCollection\(\)\]\[Parameter\(Mandatory = \$true\)\]\[System\.Collections\.Generic\.List\[string\]\]\$List/);
    }
    if (platform === "macos") {
      const { execFileSync } = require("node:child_process");
      const css = execFileSync("unzip", ["-p", packagePath, "grupos-na-barra-visual-macos/grupos-na-barra.css"], { encoding: "utf8" });
      assert.match(css, /--tab-group-yellow:\s*#eab308/);
      assert.match(css, /--tab-group-color-yellow:\s*#eab308/);
      assert.match(css, /#tab-group-editor-swatch-yellow \+ label\.tab-group-editor-swatch/);
      assert.match(css, /color-mix\(in srgb, #eab308 80%, black\)/);
      assert.match(css, /\\E0210/);
      assert.match(css, /prefers-color-scheme:\s*light/);
    }
  }

  assert.match(setupJs, /getPlatformInfo\(\)/);
  assert.match(setupJs, /mac:\s*\{/);
  assert.match(setupJs, /win:\s*\{/);
  assert.match(setupJs, /linux:\s*\{/);
});

test("o painel usa lista única, interface compacta e preferências persistentes", () => {
  const popupHtml = read("popup/popup.html");
  const popupJs = read("popup/popup.js");
  const popupCss = read("popup/popup.css");
  const viewModel = read("popup/view-model.js");
  const sharedUi = read("ui-preferences.js");

  assert.doesNotMatch(popupHtml, /Grupos nesta janela|id="open-groups"|open-group-template/);
  assert.match(popupHtml, /data-filter="all"/);
  assert.match(popupHtml, /data-filter="open"/);
  assert.match(popupHtml, /data-filter="closed"/);
  assert.match(popupHtml, /data-filter="archived"/);
  assert.match(popupHtml, /data-filter="trash"/);
  assert.match(popupHtml, /id="include-archived-all"/);
  assert.match(popupHtml, /id="edit-darker-colors"/);
  assert.doesNotMatch(popupHtml, /id="edit-dialog-description"/);
  assert.doesNotMatch(popupHtml, /<span[^>]+data-i18n="edit\.name"/);
  assert.doesNotMatch(popupHtml, /id="edit-title"[^>]+required/);
  assert.match(popupHtml, /class="status-pill"/);
  assert.doesNotMatch(popupHtml, /id="saved-count"/);
  assert.doesNotMatch(popupHtml, /id="saved-info"/);
  assert.match(popupHtml, /id="saved-action-bar"/);
  assert.match(popupHtml, /id="unarchive-all"/);
  assert.match(popupHtml, /id="trash-all-archived"/);
  assert.match(popupHtml, /id="empty-trash"/);
  assert.match(popupHtml, /class="accessibility-glyph"[^>]*>Aa</);
  assert.match(popupHtml, /id="settings"/);
  assert.match(popupHtml, /id="settings-dialog"/);
  assert.match(popupHtml, /data-language="zh-CN"/);
  assert.match(popupHtml, /data-language="ja"/);
  assert.match(popupHtml, /data-language="ko"/);
  assert.match(popupHtml, /data-language="de"/);
  assert.match(popupHtml, /data-language="fr"/);
  assert.match(popupHtml, /data-language="ru"/);
  assert.match(popupJs, /clickedOnBackdrop/);
  assert.match(popupJs, /dialog\.addEventListener\("click"/);
  assert.doesNotMatch(popupHtml, /id="sync-status"[^>]+aria-live/);

  const settingsIndex = popupHtml.indexOf('id="settings"');
  const accessibilityIndex = popupHtml.indexOf('id="accessibility"');
  const languageIndex = popupHtml.indexOf('id="language"');
  assert.ok(
    settingsIndex < accessibilityIndex &&
      accessibilityIndex < languageIndex
  );
  assert.doesNotMatch(popupHtml, /id="refresh"/);
  assert.doesNotMatch(popupJs, /refreshButton/);
  assert.match(popupJs, /scheduleAutomaticRefresh/);
  assert.match(popupHtml, /id="icon-options"/);
  assert.ok(
    popupHtml.indexOf('id="color-options"') < popupHtml.indexOf('id="icon-options"'),
    "colors must appear before icons in the editor"
  );
  assert.match(popupHtml, /class="icon-button keep-top-button"/);
  assert.match(popupHtml, /class="icon-button edit-button"/);
  assert.match(popupHtml, /class="icon-button preview-button"/);
  assert.match(popupHtml, /class="icon-button order-handle"[^>]*draggable="true"/);
  assert.match(popupHtml, /class="icon-button archive-button"/);
  assert.match(popupHtml, /id="trash-group-template"/);
  assert.match(popupHtml, /class="text-button restore-button"/);
  assert.match(popupHtml, /class="icon-button permanent-delete-button"/);
  assert.match(popupHtml, /id="sync-info"/);
  assert.match(popupHtml, /id="sync-storage"[^>]+role="progressbar"/);
  assert.match(popupHtml, /id="sync-storage-fill"/);
  assert.match(popupHtml, /id="export-json"/);
  assert.match(popupHtml, /id="restore-sync-backup"/);
  assert.ok(
    popupHtml.indexOf('id="saved-action-bar"') < popupHtml.indexOf('id="group-filters"'),
    "the contextual action bar must appear before the filters"
  );
  assert.match(popupHtml, /id="toggle-sync"/);
  assert.match(popupHtml, /id="diagnostics-dialog"/);
  assert.match(popupHtml, /id="open-diagnostics"/);
  assert.match(popupCss, /left:\s*calc\(100% \+ 8px\)/);
  assert.match(popupCss, /top:\s*50%[^}]*transform:\s*translateY\(-50%\)/s);
  assert.match(popupCss, /footer\s*\{[^}]*padding:\s*5px 12px 6px/s);
  assert.match(popupCss, /\.icon-options\s*\{[^}]*repeat\(8, 34px\)/s);
  assert.match(popupJs, /"home"[^]*"camera"[^]*"plane"[^]*"game"/);
  assert.match(popupJs, /send\("exportExtensionData"\)/);
  assert.match(popupJs, /send\("restoreAutomaticBackup"\)/);
  assert.match(popupJs, /send\("consumePendingGroupEditor"\)/);
  assert.match(popupJs, /send\("restoreTrashGroup"/);
  assert.match(popupJs, /send\("deleteTrashGroupPermanently"/);
  assert.match(popupJs, /send\("reorderKeptGroup"/);
  assert.match(popupJs, /send\("moveKeptGroup"/);
  assert.match(popupJs, /send\("getDiagnosticReport"\)/);
  assert.doesNotMatch(popupJs, /bookmark\.none/);
  assert.match(popupJs, /bookmarkButtonSetup[^]*classList\.toggle\("is-active"/);
  assert.match(popupJs, /function accessibleGroupTitle\(/);
  assert.match(popupJs, /function faviconFallback\([^)]*\)/);
  assert.match(popupJs, /grey:\s*"#8b8b94"/);
  assert.match(popupJs, /yellow:\s*"#eab308"/);
  assert.match(read("icons/icon.svg"), /scale\(1\.18\)/);
  assert.match(popupCss, /\.bookmark-button\.is-active/);
  assert.match(popupCss, /html\[data-font-size="large"\][^]*width:\s*474px/s);
  assert.match(popupCss, /\.empty-icon-ring/);
  assert.match(popupCss, /\.sync-shell\.is-collapsed/);
  assert.match(popupCss, /\.saved-action-bar\s*\{[^}]*height:\s*40px/s);
  assert.match(popupHtml, /id="panel-view-slider"[^>]+type="range"[^>]+min="0"[^>]+max="3"[^>]+step="1"/);
  assert.match(popupJs, /PANEL_VIEW_LIMITS = \[3, 5, 10, "unlimited"\]/);
  assert.match(sharedUi, /panelViewLimit/);
  assert.doesNotMatch(popupHtml, /id="preview-five-tabs"|id="all-unlimited"/);
  assert.match(popupCss, /--panel-slider-edge:\s*calc\(var\(--panel-slider-thumb\) \/ 2\)/);
  assert.match(popupCss, /\.filter-bar\s*\{[^}]*54px/s);
  assert.match(popupCss, /\.filter-trash-button svg\s*\{[^}]*width:\s*17px[^}]*height:\s*17px/s);
  assert.match(popupCss, /sync-collapse-button[^}]*width:\s*40px[^}]*height:\s*21px/s);

  assert.match(viewModel, /currentWindow[^]*otherWindow[^]*closed/);
  assert.match(popupJs, /function buildColorOptions\(\) \{[^]*Object\.entries\(COLORS\)[^]*colorOptions\.append\(label\)/s);
  assert.doesNotMatch(popupJs, /color-row|data-tone|syncEditorColorTone/);
  assert.match(popupJs, /confirm\(t\("access\.confirmReset"\)\)/);
  assert.match(sharedUi, /"access\.confirmReset"/);
  assert.match(popupCss, /sync-collapse-button,[^]*transform:\s*translate\(-50%, 32%\)/s);
  assert.doesNotMatch(popupCss, /translate\(-50%, 50%\)/);
  assert.match(popupJs, /Ui\.save\(changes\)/);
  assert.match(sharedUi, /"pt-BR"/);
  assert.match(sharedUi, /\ben:\s*\{/);
  assert.match(sharedUi, /\bes:\s*\{/);
  assert.match(sharedUi, /fontSize/);
  assert.match(sharedUi, /highContrast/);
  assert.match(sharedUi, /reduceMotion/);
  assert.match(sharedUi, /groupFilter/);
  assert.match(sharedUi, /includeArchivedInAll/);
  assert.match(sharedUi, /syncCollapsed/);
  assert.match(sharedUi, /visualPromoDismissed/);
});
