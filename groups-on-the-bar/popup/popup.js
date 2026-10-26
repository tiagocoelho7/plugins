"use strict";

const Ui = globalThis.GruposUi;
const ViewModel = globalThis.GruposPopupViewModel;

if (!Ui || !ViewModel) {
  throw new Error("A interface compartilhada não foi carregada.");
}

const LIGHT_COLORS = Object.freeze({
  grey: "#8b8b94",
  blue: "#4b84f4",
  red: "#f24646",
  yellow: "#eab308",
  green: "#2aac54",
  pink: "#e5489b",
  purple: "#8457e7",
  cyan: "#16a7b8",
  orange: "#f27b22"
});

const DARK_COLORS = Object.freeze({
  grey: "#6f717d",
  blue: "#2f63cf",
  red: "#d83a3a",
  yellow: "#c18f00",
  green: "#238847",
  pink: "#c33b86",
  purple: "#6a47cb",
  cyan: "#118394",
  orange: "#d5671d"
});

const COLORS = LIGHT_COLORS;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ICON_PATHS = {
  bookmark: ["M6 4.7A1.7 1.7 0 0 1 7.7 3h8.6A1.7 1.7 0 0 1 18 4.7V21l-6-3.8L6 21Z"],
  bookmarkRemove: ["M6 4.7A1.7 1.7 0 0 1 7.7 3h8.6A1.7 1.7 0 0 1 18 4.7V21l-6-3.8L6 21Z", "m4 4 16 16"],
  keepTop: ["M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5Z", "M12 13v8"],
  editPalette: ["M12 3a9 9 0 1 0 0 18h1.4a1.7 1.7 0 0 0 1.3-2.8 1.7 1.7 0 0 1 1.3-2.8h2a3 3 0 0 0 3-3A9.6 9.6 0 0 0 12 3Z", "m15.2 14.4 4.6-4.6", "m14 16 1.2-1.6 1.4 1.4-1.6 1.2Z", "M7.4 11h.01M9.7 7.5h.01M14.2 7.4h.01"],
  eye: ["M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z", "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"],
  grip: ["M8 7h8M8 12h8M8 17h8"],
  restore: ["M5 8V4m0 4h4", "M5.7 7.2A8 8 0 1 1 5 16"],
  archive: ["M4 5h16v4H4ZM6 9v11h12V9M9 13h6"],
  unarchive: ["M4 5h16v4H4ZM6 9v11h12V9M12 17v-5m-3 3 3-3 3 3"],
  folder: ["M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"],
  star: ["m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9Z"],
  chat: ["M21 14a4 4 0 0 1-4 4H8l-5 3 1.6-4.7A7 7 0 0 1 3 12V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"],
  briefcase: ["M9 6V4h6v2M4 6h16a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Zm-1 6h8"],
  book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Zm0 0V6.5M8 8h8M8 12h6"],
  code: ["m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"],
  globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-20c2.5 2.7 3.8 6 3.8 10S14.5 19.3 12 22M12 2C9.5 4.7 8.2 8 8.2 12S9.5 19.3 12 22M2 12h20"],
  shopping: ["M3 4h2l2.2 10h9.9l2-7H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  music: ["M9 18V5l10-2v13M9 8l10-2M6.5 21A2.5 2.5 0 1 0 9 18.5 2.5 2.5 0 0 0 6.5 21Zm10-2A2.5 2.5 0 1 0 19 16.5 2.5 2.5 0 0 0 16.5 19Z"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"],
  idea: ["M9 18h6M10 22h4M8.4 14.8A7 7 0 1 1 15.6 14.8c-.9.7-1.6 1.6-1.6 3.2h-4c0-1.6-.7-2.5-1.6-3.2Z"],
  home: ["M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6"],
  camera: ["M4 7h3l2-3h6l2 3h3v13H4ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  plane: ["m3 11 18-7-7 17-3-6-6-1-2-3 8 1 5-6Z"],
  game: ["M8 8h8a6 6 0 0 1 5.5 8.4l-1.1 2.5a2 2 0 0 1-3.1.8L15 18H9l-2.3 1.7a2 2 0 0 1-3.1-.8l-1.1-2.5A6 6 0 0 1 8 8ZM7 12v4M5 14h4M16 12h.01M19 15h.01"]
};

const GROUP_ICONS = [
  "none",
  "folder",
  "star",
  "chat",
  "briefcase",
  "book",
  "code",
  "globe",
  "shopping",
  "music",
  "heart",
  "idea",
  "home",
  "camera",
  "plane",
  "game"
];

const savedList = document.querySelector("#saved-groups");
const autoPin = document.querySelector("#auto-pin");
const notice = document.querySelector("#notice");
const settingsButton = document.querySelector("#settings");
const languageButton = document.querySelector("#language");
const accessibilityButton = document.querySelector("#accessibility");
const settingsDialog = document.querySelector("#settings-dialog");
const languageDialog = document.querySelector("#language-dialog");
const accessibilityDialog = document.querySelector("#accessibility-dialog");
const closeSettings = document.querySelector("#close-settings");
const closeLanguage = document.querySelector("#close-language");
const closeAccessibility = document.querySelector("#close-accessibility");
const syncInfoWrap = document.querySelector("#sync-info-wrap");
const syncInfoButton = document.querySelector("#sync-info");
const archiveInfoWrap = document.querySelector("#archive-info-wrap");
const archiveInfoButton = document.querySelector("#archive-info");
const savedActionBar = document.querySelector("#saved-action-bar");
const allScope = document.querySelector("#all-scope");
const closedScope = document.querySelector("#closed-scope");
const archivedScope = document.querySelector("#archived-scope");
const trashScope = document.querySelector("#trash-scope");
const archiveAllClosed = document.querySelector("#archive-all-closed");
const unarchiveAll = document.querySelector("#unarchive-all");
const trashAllArchived = document.querySelector("#trash-all-archived");
const emptyTrash = document.querySelector("#empty-trash");
const includeArchivedAll = document.querySelector("#include-archived-all");
const visualPromo = document.querySelector("#visual-promo");
const dismissVisualPromo = document.querySelector("#dismiss-visual-promo");
const highContrast = document.querySelector("#high-contrast");
const reduceMotion = document.querySelector("#reduce-motion");
const resetAccessibility = document.querySelector("#reset-accessibility");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editTitle = document.querySelector("#edit-title");
const editDarkerColors = document.querySelector("#edit-darker-colors");
const editDarkerInfoWrap = document.querySelector("#edit-darker-info-wrap");
const editDarkerInfoButton = document.querySelector("#edit-darker-info");
const colorOptions = document.querySelector("#color-options");
const iconOptions = document.querySelector("#icon-options");
const cancelEdit = document.querySelector("#cancel-edit");
const cancelEditX = document.querySelector("#cancel-edit-x");
const syncShell = document.querySelector("#sync-shell");
const toggleSync = document.querySelector("#toggle-sync");
const syncStatus = document.querySelector("#sync-status");
const syncStatusTitle = document.querySelector("#sync-status-title");
const syncStatusDetail = document.querySelector("#sync-status-detail");
const syncStorage = document.querySelector("#sync-storage");
const syncStorageFill = document.querySelector("#sync-storage-fill");
const syncStoragePercent = document.querySelector("#sync-storage-percent");
const backupSummary = document.querySelector("#backup-summary");
const exportJson = document.querySelector("#export-json");
const restoreSyncBackup = document.querySelector("#restore-sync-backup");
const panelViewSlider = document.querySelector("#panel-view-slider");
const previewCountSlider = document.querySelector("#preview-count-slider");
const panelViewInfoWrap = document.querySelector("#panel-view-info-wrap");
const panelViewInfoButton = document.querySelector("#panel-view-info");
const previewCountInfoWrap = document.querySelector("#preview-count-info-wrap");
const previewCountInfoButton = document.querySelector("#preview-count-info");
const diagnosticsDialog = document.querySelector("#diagnostics-dialog");
const diagnosticsSummary = document.querySelector("#diagnostics-summary");
const openDiagnostics = document.querySelector("#open-diagnostics");
const closeDiagnostics = document.querySelector("#close-diagnostics");
const diagnosticList = document.querySelector("#diagnostic-list");
const copyDiagnostics = document.querySelector("#copy-diagnostics");
const downloadDiagnostics = document.querySelector("#download-diagnostics");
const clearDiagnostics = document.querySelector("#clear-diagnostics");
const savedTemplate = document.querySelector("#saved-group-template");
const trashTemplate = document.querySelector("#trash-group-template");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const languageChoices = [...document.querySelectorAll("[data-language]")];
const fontSizeChoices = [...document.querySelectorAll("[data-font-size]")];
const filterCountAll = document.querySelector("#filter-count-all");
const filterCountOpen = document.querySelector("#filter-count-open");
const filterCountClosed = document.querySelector("#filter-count-closed");
const filterCountArchived = document.querySelector("#filter-count-archived");
const filterCountTrash = document.querySelector("#filter-count-trash");
const appVersion = document.querySelector("#app-version");
const modalDialogs = [...document.querySelectorAll("dialog")];
const infoPopovers = [
  { wrap: syncInfoWrap, button: syncInfoButton },
  { wrap: archiveInfoWrap, button: archiveInfoButton },
  { wrap: editDarkerInfoWrap, button: editDarkerInfoButton },
  { wrap: panelViewInfoWrap, button: panelViewInfoButton },
  { wrap: previewCountInfoWrap, button: previewCountInfoButton }
];
const dialogReturnFocus = new WeakMap();

let currentState = null;
let preferences = Ui.normalize();
let editingId = null;
let busy = false;
let refreshTimer = null;
let refreshInFlight = false;
let draggedKeptId = null;
let currentDiagnosticReport = null;
let allGroupsExpanded = false;

function t(key, replacements = {}) {
  return Ui.t(preferences.language, key, replacements);
}

if (appVersion) {
  const runtimeVersion = browser?.runtime?.getManifest?.().version || "unknown";
  appVersion.textContent = `v${runtimeVersion}`;
  appVersion.title = `Version ${runtimeVersion}`;
}

function pluralTabs(count) {
  return t(count === 1 ? "tabs.one" : "tabs.many", { count });
}

function accessibleGroupTitle(group) {
  const title = typeof group?.title === "string" ? group.title.trim() : "";
  return title || t("group.untitled");
}

function paletteForState(useDarker = false) {
  return useDarker ? DARK_COLORS : LIGHT_COLORS;
}

function colorValue(name, useDarker = false) {
  const palette = paletteForState(useDarker);
  return palette[name] || palette.grey;
}

function setGroupColor(element, color, useDarker = false) {
  element.style.setProperty("--group-color", colorValue(color, useDarker));
}

function updateEditorColorPalette() {
  const useDarker = editDarkerColors?.checked === true;
  colorOptions.querySelectorAll('.color-choice').forEach((label) => {
    const color = label.dataset.color;
    label.style.setProperty('--group-color', colorValue(color, useDarker));
  });
  const selectedColor = colorOptions.querySelector('input:checked')?.value || 'grey';
  iconOptions.style.setProperty('--group-color', colorValue(selectedColor, useDarker));
}

function refreshFilterLabelFit() {
  filterButtons.forEach((button) => {
    button.classList.remove('is-compact-label', 'is-super-compact-label');
    const label = button.querySelector('span[data-i18n]');
    if (!label) return;
    if (button.scrollWidth > button.clientWidth + 1 || label.scrollWidth > label.clientWidth + 1) {
      button.classList.add('is-compact-label');
    }
    if (button.scrollWidth > button.clientWidth + 1 || label.scrollWidth > label.clientWidth + 1) {
      button.classList.add('is-super-compact-label');
    }
  });
}

function createIcon(name) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const pathData of ICON_PATHS[name] || []) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
  return svg;
}

function renderGroupMarker(marker, group) {
  marker.replaceChildren();
  if (!group.icon || group.icon === "none" || !ICON_PATHS[group.icon]) {
    const ring = document.createElement("span");
    ring.className = "empty-icon-ring";
    marker.append(ring);
    return;
  }
  const icon = createIcon(group.icon);
  icon.classList.add("group-symbol");
  marker.append(icon);
}

function showNotice(message, error = false, action = null) {
  notice.replaceChildren();
  const copy = document.createElement("span");
  copy.textContent = message;
  notice.append(copy);
  if (action?.label && typeof action.onClick === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notice-action";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    notice.append(button);
  }
  notice.classList.toggle("error", error);
  notice.hidden = false;
}

function clearNotice() {
  notice.hidden = true;
  notice.replaceChildren();
  notice.classList.remove("error");
}

function emptyState(title, text) {
  const element = document.createElement("div");
  element.className = "empty-state";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const description = document.createElement("span");
  description.textContent = text;
  element.append(strong, description);
  return element;
}

async function send(type, payload = {}) {
  const response = await browser.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    const localized = response?.errorCode
      ? t(`error.${response.errorCode}`)
      : t("error.operationFailed");
    throw new Error(localized || t("notice.noResponse"));
  }
  return response.data;
}

function openModal(dialog, trigger, initialFocus = null) {
  dialogReturnFocus.set(dialog, trigger || document.activeElement);
  dialog.showModal();
  if (initialFocus) {
    requestAnimationFrame(() => initialFocus.focus());
  }
}

function closeModal(dialog) {
  if (dialog.open) dialog.close();
}

function clickedOnBackdrop(dialog, event) {
  if (event.target !== dialog) return false;
  const bounds = dialog.getBoundingClientRect();
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  );
}

for (const dialog of modalDialogs) {
  dialog.addEventListener("click", (event) => {
    if (clickedOnBackdrop(dialog, event)) closeModal(dialog);
  });
  dialog.addEventListener("close", () => {
    const trigger = dialogReturnFocus.get(dialog);
    dialogReturnFocus.delete(dialog);
    if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
  });
}

async function withBusy(action, successMessage) {
  if (busy) return;
  busy = true;
  clearNotice();
  const controlStates = [...document.querySelectorAll("button, input")].map((control) => [
    control,
    control.disabled
  ]);
  for (const [control] of controlStates) {
    control.disabled = true;
  }

  try {
    await action();
    await loadAndRender();
    if (successMessage) showNotice(successMessage);
  } catch (error) {
    showNotice(error.message || String(error), true);
  } finally {
    busy = false;
    for (const [control, wasDisabled] of controlStates) {
      if (control.isConnected) {
        control.disabled = wasDisabled;
      }
    }
    if (currentState?.sync) renderBackupSummary(currentState.sync);
  }
}

function updateChoiceStates() {
  for (const button of filterButtons) {
    const active = button.dataset.filter === preferences.groupFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of languageChoices) {
    const active = button.dataset.language === preferences.language;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of fontSizeChoices) {
    const active = button.dataset.fontSize === preferences.fontSize;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  }
  highContrast.checked = preferences.highContrast;
  reduceMotion.checked = preferences.reduceMotion;
  includeArchivedAll.checked = preferences.includeArchivedInAll;
  panelViewSlider.value = String(panelLimitToSliderIndex(preferences.panelViewLimit));
  updatePanelViewSlider();
  if (previewCountSlider) {
    previewCountSlider.value = String(previewCountToSliderIndex(preferences.previewTabCount));
    updatePreviewCountSlider();
  }
  renderContextActions();
  renderSyncCollapseState();
}

function translateColorOptions() {
  colorOptions.querySelectorAll(".color-choice").forEach((label) => {
    const color = label.dataset.color;
    const translated = t(`color.${color}`);
    label.title = translated;
    label.querySelector("input")?.setAttribute("aria-label", translated);
  });
}

function translateIconOptions() {
  iconOptions.querySelectorAll(".icon-choice").forEach((label) => {
    const icon = label.dataset.icon;
    const translated = t(`icon.${icon}`);
    label.title = translated;
    label.querySelector("input")?.setAttribute("aria-label", translated);
  });
}

function applyPreferences() {
  Ui.applyToDocument(document, preferences);
  Ui.translateDocument(document, preferences.language);
  document.title = t("app.name");
  updateChoiceStates();
  translateColorOptions();
  translateIconOptions();
  requestAnimationFrame(refreshFilterLabelFit);
  if (currentState) render();
}

function bookmarkButtonSetup(button, group) {
  button.replaceChildren(createIcon("bookmark"));
  button.classList.toggle("is-active", group.pinned);
  button.title = t(group.pinned ? "action.unpin" : "action.pin");
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(group.pinned));
  button.addEventListener("click", () =>
    withBusy(
      () => send(group.pinned ? "unpinBookmark" : "pinBookmark", { savedId: group.id }),
      null
    )
  );
}

function keepTopButtonSetup(button, group) {
  const pinIcon = createIcon("keepTop");
  pinIcon.classList.add("pin-icon");
  button.replaceChildren(pinIcon);
  button.classList.toggle("is-active", group.keepAtTop);
  button.title = t(group.keepAtTop ? "action.stopKeepingAtTop" : "action.keepAtTop");
  button.setAttribute("aria-label", `${button.title}: ${accessibleGroupTitle(group)}`);
  button.setAttribute("aria-pressed", String(group.keepAtTop));
  button.addEventListener("click", () =>
    withBusy(
      () =>
        send("setGroupKeepAtTop", {
          savedId: group.id,
          enabled: !group.keepAtTop
        }),
      null
    )
  );
}

function archiveButtonSetup(button, group) {
  button.replaceChildren(createIcon(group.archived ? "unarchive" : "archive"));
  button.classList.toggle("is-active", group.archived);
  button.title = t(group.archived ? "action.unarchive" : "action.archive");
  button.setAttribute("aria-label", `${button.title}: ${accessibleGroupTitle(group)}`);
  button.setAttribute("aria-pressed", String(group.archived));
  button.addEventListener("click", () =>
    withBusy(
      () =>
        send("setGroupArchived", {
          savedId: group.id,
          archived: !group.archived
        }),
      null
    )
  );
}

function statusForGroup(group) {
  if (group.archived) {
    return { location: "archived", label: t("status.archived") };
  }
  const location = ViewModel.location(group, currentState.currentWindowId);
  if (location === "currentWindow") {
    return { location, label: t("status.currentWindow") };
  }
  if (location === "otherWindow") {
    return { location, label: t("status.otherWindow") };
  }
  return { location, label: t("status.closed") };
}

function renderFilterCounts() {
  const groups = currentState.savedGroups;
  const activeGroups = groups.filter((group) => !group.archived);
  const archivedCount = groups.length - activeGroups.length;
  const openCount = activeGroups.filter((group) => group.open).length;
  filterCountAll.textContent = String(
    activeGroups.length + (preferences.includeArchivedInAll ? archivedCount : 0)
  );
  filterCountOpen.textContent = String(openCount);
  filterCountClosed.textContent = String(activeGroups.length - openCount);
  filterCountArchived.textContent = String(archivedCount);
  filterCountTrash.textContent = String(currentState.trashGroups?.length || 0);
}

function renderContextActions() {
  const filter = preferences.groupFilter;
  allScope.hidden = filter !== "all";
  closedScope.hidden = filter !== "closed";
  archivedScope.hidden = filter !== "archived";
  trashScope.hidden = filter !== "trash";
  savedActionBar.hidden = false;
  savedActionBar.dataset.filter = filter;
}

function faviconFallback(tab = null) {
  const fallback = document.createElement("span");
  fallback.className = "preview-favicon preview-favicon-fallback";
  const title = typeof tab?.title === 'string' ? tab.title.trim() : '';
  let letter = title.charAt(0);
  if (!letter) {
    try {
      letter = new URL(typeof tab?.url === 'string' ? tab.url : '').hostname.charAt(0);
    } catch (_error) {
      letter = '';
    }
  }
  if (letter) {
    fallback.textContent = letter.slice(0, 1).toUpperCase();
  } else {
    const icon = createIcon("globe");
    icon.classList.add("preview-fallback-icon");
    fallback.append(icon);
  }
  return fallback;
}

const SAFE_FAVICON_SOURCE_PATTERN = /^(?:data:image\/(?:png|jpe?g|gif|webp|x-icon|vnd\.microsoft\.icon);base64,|page-icon:|moz-anno:favicon:|moz-extension:|chrome:|resource:)/i;

function faviconCandidatesForTab(tab) {
  const candidates = [];
  const pushCandidate = (value) => {
    if (typeof value !== "string") return;
    const normalized = value.trim();
    if (
      !normalized ||
      !SAFE_FAVICON_SOURCE_PATTERN.test(normalized) ||
      candidates.includes(normalized)
    ) {
      return;
    }
    candidates.push(normalized);
  };
  pushCandidate(tab?.faviconUrl);
  pushCandidate(tab?.favIconUrl);
  const pageUrl = typeof tab?.url === "string" ? tab.url.trim() : "";
  if (pageUrl && pageUrl.length <= 4096) {
    try {
      const parsed = new URL(pageUrl);
      pushCandidate(`page-icon:${parsed.href}`);
      pushCandidate(`moz-anno:favicon:${parsed.href}`);
    } catch (_error) {
      // URLs inválidas ficam somente com o fallback visual local.
    }
  }
  return candidates;
}

function appendPreviewFavicon(item, tab) {
  const candidates = faviconCandidatesForTab(tab);
  if (!candidates.length) {
    item.append(faviconFallback(tab));
    return;
  }
  const icon = document.createElement("img");
  icon.className = "preview-favicon";
  icon.alt = "";
  icon.width = 14;
  icon.height = 14;
  icon.loading = "lazy";
  icon.referrerPolicy = "no-referrer";
  let index = 0;
  const loadNext = () => {
    if (index >= candidates.length) {
      icon.replaceWith(faviconFallback(tab));
      return;
    }
    icon.src = candidates[index++];
  };
  icon.addEventListener("error", loadNext);
  loadNext();
  item.append(icon);
}

function fillPreview(container, group) {
  const list = container.querySelector(".group-preview-list");
  const more = container.querySelector(".group-preview-more");
  list.replaceChildren();
  const previewLimit = Number(preferences.previewTabCount) || 3;
  const tabs = Array.isArray(group.previewTabs) ? group.previewTabs.slice(0, previewLimit) : [];
  for (const tab of tabs) {
    const label = typeof tab === "string" ? tab : String(tab?.label || "");
    const item = document.createElement("li");
    if (typeof tab === "object" && tab) {
      appendPreviewFavicon(item, tab);
    } else {
      item.append(faviconFallback());
    }
    const text = document.createElement("span");
    text.className = "preview-label";
    text.textContent = label;
    text.title = label;
    item.append(text);
    list.append(item);
  }
  const remaining = Math.max(0, Number(group.tabCount || 0) - tabs.length);
  more.textContent = remaining ? `+${pluralTabs(remaining)}` : "";
  more.hidden = remaining === 0;
}

function setupPreviewButton(button, preview, group) {
  button.replaceChildren(createIcon("eye"));
  const updateLabel = () => {
    const expanded = !preview.hidden;
    const key = preview.hidden ? "action.previewTabs" : "action.hidePreview";
    button.title = t(key);
    button.setAttribute("aria-label", `${button.title}: ${accessibleGroupTitle(group)}`);
    button.setAttribute("aria-expanded", String(expanded));
    button.classList.toggle("is-active", expanded);
  };
  updateLabel();
  button.addEventListener("click", () => {
    preview.hidden = !preview.hidden;
    updateLabel();
  });
}

function clearDragTargets() {
  document.querySelectorAll(".saved-card.is-drag-before, .saved-card.is-drag-after").forEach((card) => {
    card.classList.remove("is-drag-before", "is-drag-after");
  });
}

function setupOrderHandle(card, button, group) {
  const enabled = group.keepAtTop && !group.archived;
  button.hidden = false;
  button.classList.toggle("is-reserved", !enabled);
  button.disabled = !enabled;
  button.draggable = enabled;
  button.replaceChildren();
  if (!enabled) return;
  button.replaceChildren(createIcon("grip"));
  button.title = t("action.moveGroup");
  button.setAttribute("aria-label", `${button.title}: ${accessibleGroupTitle(group)}`);
  button.addEventListener("dragstart", (event) => {
    draggedKeptId = group.id;
    card.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", group.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  button.addEventListener("dragend", () => {
    draggedKeptId = null;
    card.classList.remove("is-dragging");
    clearDragTargets();
  });
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    button.title = t(direction < 0 ? "action.moveUp" : "action.moveDown");
    withBusy(() => send("moveKeptGroup", { savedId: group.id, direction }), null);
  });

  card.addEventListener("dragover", (event) => {
    if (!draggedKeptId || draggedKeptId === group.id || !group.keepAtTop) return;
    event.preventDefault();
    clearDragTargets();
    const bounds = card.getBoundingClientRect();
    const after = event.clientY > bounds.top + bounds.height / 2;
    card.classList.add(after ? "is-drag-after" : "is-drag-before");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  card.addEventListener("dragleave", (event) => {
    if (!card.contains(event.relatedTarget)) {
      card.classList.remove("is-drag-before", "is-drag-after");
    }
  });
  card.addEventListener("drop", (event) => {
    if (!draggedKeptId || draggedKeptId === group.id || !group.keepAtTop) return;
    event.preventDefault();
    const bounds = card.getBoundingClientRect();
    const position = event.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    const savedId = draggedKeptId;
    draggedKeptId = null;
    clearDragTargets();
    withBusy(() => send("reorderKeptGroup", { savedId, targetId: group.id, position }), null);
  });
}

function renderTrashGroups() {
  const groups = Array.isArray(currentState.trashGroups) ? currentState.trashGroups : [];
  if (!groups.length) {
    savedList.append(emptyState(t("filter.emptyTrashTitle"), t("filter.emptyTrashText")));
    return;
  }
  for (const group of groups) {
    const card = trashTemplate.content.firstElementChild.cloneNode(true);
    setGroupColor(card, group.color, group.darkerColors === true);
    renderGroupMarker(card.querySelector(".group-marker"), group);
    card.querySelector(".group-title").textContent = group.title;
    card.querySelector(".group-meta").textContent = pluralTabs(group.tabCount);
    const days = Math.max(0, Math.ceil((Number(group.expiresAt) - Date.now()) / 86400000));
    card.querySelector(".trash-expiry").textContent = days > 0 ? t("trash.expiresDays", { count: days }) : t("trash.expiresToday");
    fillPreview(card.querySelector(".group-preview"), group);

    const restore = card.querySelector(".restore-button");
    restore.setAttribute("aria-label", `${t("action.restore")}: ${accessibleGroupTitle(group)}`);
    restore.addEventListener("click", () =>
      withBusy(() => send("restoreTrashGroup", { savedId: group.id }), null)
    );
    const remove = card.querySelector(".permanent-delete-button");
    remove.title = t("action.deletePermanently");
    remove.setAttribute("aria-label", `${remove.title}: ${accessibleGroupTitle(group)}`);
    remove.addEventListener("click", () => {
      if (!confirm(t("confirm.deletePermanently"))) return;
      withBusy(() => send("deleteTrashGroupPermanently", { savedId: group.id }), null);
    });
    savedList.append(card);
  }
}

function renderSavedGroups() {
  savedList.replaceChildren();
  renderFilterCounts();
  if (preferences.groupFilter === "trash") {
    renderTrashGroups();
    return;
  }

  const allGroups = currentState.savedGroups;
  const filteredGroups = ViewModel.filterAndSort(
    allGroups,
    currentState.currentWindowId,
    preferences.groupFilter,
    preferences.includeArchivedInAll
  );
  let groups = filteredGroups;
  let hiddenGroupCount = 0;
  if (preferences.groupFilter !== "all") {
    allGroupsExpanded = false;
  }
  if (preferences.groupFilter === "all" && preferences.panelViewLimit !== "unlimited") {
    const limit = Number(preferences.panelViewLimit) || 3;
    hiddenGroupCount = Math.max(0, filteredGroups.length - limit);
    groups = allGroupsExpanded ? filteredGroups : filteredGroups.slice(0, limit);
  }

  if (!allGroups.length) {
    savedList.append(emptyState(t("saved.emptyTitle"), t("saved.emptyText")));
    return;
  }
  if (!filteredGroups.length) {
    const emptyKeys = {
      all: ["filter.emptyAllTitle", "filter.emptyAllText"],
      open: ["filter.emptyOpenTitle", "filter.emptyOpenText"],
      closed: ["filter.emptyClosedTitle", "filter.emptyClosedText"],
      archived: ["filter.emptyArchivedTitle", "filter.emptyArchivedText"]
    };
    const [titleKey, textKey] =
      emptyKeys[preferences.groupFilter] || ["saved.emptyTitle", "saved.emptyText"];
    savedList.append(emptyState(t(titleKey), t(textKey)));
    return;
  }

  for (const group of groups) {
    const card = savedTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.savedId = group.id;
    card.classList.toggle("is-archived", group.archived);
    card.classList.toggle("is-kept-at-top", group.keepAtTop);
    setGroupColor(card, group.color, group.darkerColors === true);
    renderGroupMarker(card.querySelector(".group-marker"), group);
    card.querySelector(".group-title").textContent = group.title;

    const details = [pluralTabs(group.tabCount)];
    if (group.skippedTabs) {
      details.push(
        t(group.skippedTabs === 1 ? "tabs.skippedOne" : "tabs.skippedMany", {
          count: group.skippedTabs
        })
      );
    }
    card.querySelector(".group-meta").textContent = details.join(" · " );

    const statusData = statusForGroup(group);
    const status = card.querySelector(".status-pill");
    status.textContent = statusData.label;
    status.classList.add(statusData.location);

    const runMainAction = () =>
      withBusy(
        () =>
          send(group.open ? "closeSavedGroup" : "openSavedGroup", {
            savedId: group.id,
            windowId: currentState.currentWindowId
          }),
        null
      );

    const groupOpenButton = card.querySelector(".group-open");
    const groupOpenLabel = `${t("action.open")}: ${accessibleGroupTitle(group)} — ${statusData.label}`;
    groupOpenButton.setAttribute("aria-label", groupOpenLabel);
    groupOpenButton.title = groupOpenLabel;
    groupOpenButton.addEventListener("click", () => {
      if (group.open) {
        withBusy(
          () => send("openSavedGroup", { savedId: group.id, windowId: currentState.currentWindowId }),
          null
        );
      } else {
        runMainAction();
      }
    });

    const action = card.querySelector(".open-button");
    action.textContent = t(group.open ? "action.close" : "action.open");
    action.setAttribute("aria-label", `${action.textContent}: ${accessibleGroupTitle(group)}`);
    action.addEventListener("click", runMainAction);

    const editButton = card.querySelector(".edit-button");
    editButton.replaceChildren(createIcon("editPalette"));
    editButton.title = t("action.edit");
    editButton.setAttribute("aria-label", `${editButton.title}: ${accessibleGroupTitle(group)}`);
    editButton.addEventListener("click", () => openEditor(group, editButton));

    const preview = card.querySelector(".group-preview");
    fillPreview(preview, group);
    setupPreviewButton(card.querySelector(".preview-button"), preview, group);

    const keepTopButton = card.querySelector(".keep-top-button");
    const bookmarkButton = card.querySelector(".bookmark-button");
    keepTopButton.hidden = group.archived;
    bookmarkButton.hidden = group.archived;
    if (!group.archived) {
      keepTopButtonSetup(keepTopButton, group);
      bookmarkButtonSetup(bookmarkButton, group);
    }
    setupOrderHandle(card, card.querySelector(".order-handle"), group);
    archiveButtonSetup(card.querySelector(".archive-button"), group);

    const deleteButton = card.querySelector(".delete-button");
    deleteButton.title = t("action.delete");
    deleteButton.setAttribute("aria-label", `${deleteButton.title}: ${accessibleGroupTitle(group)}`);
    deleteButton.addEventListener("click", () => {
      if (group.open && !confirm(t("confirm.deleteOpen"))) return;
      withBusy(() => send("deleteSavedGroup", { savedId: group.id }), null);
    });

    savedList.append(card);
  }

  if (preferences.groupFilter === "all" && preferences.panelViewLimit !== "unlimited" && hiddenGroupCount > 0 && !allGroupsExpanded) {
    const moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.className = "show-more-groups-button";
    moreButton.textContent = `+ ${t("action.showMoreGroups", { count: hiddenGroupCount })}`;
    moreButton.setAttribute("aria-label", t("action.showMoreGroups", { count: hiddenGroupCount }));
    moreButton.addEventListener("click", () => {
      allGroupsExpanded = true;
      renderSavedGroups();
    });
    savedList.append(moreButton);
  }
}

function formatKiB(bytes) {
  const value = Math.max(0, Number(bytes) || 0) / 1024;
  return new Intl.NumberFormat(preferences.language, {
    maximumFractionDigits: value < 10 ? 1 : 0
  }).format(value);
}

function renderSyncStorage(status) {
  const percent = Math.min(100, Math.max(0, Number(status.usagePercent) || 0));
  const used = formatKiB(status.usedBytes);
  const total = formatKiB(status.totalBytes || 102400);
  syncStorageFill.style.width = `${percent}%`;
  syncStoragePercent.textContent = `${percent}%`;
  syncStorage.setAttribute("aria-valuenow", String(percent));
  syncStorage.setAttribute(
    "aria-label",
    t("sync.storageUsage", { percent, used, total })
  );
  syncStorage.title = t("sync.storageUsage", { percent, used, total });
  syncStorage.classList.toggle("warning", percent >= 70 && percent < 90);
  syncStorage.classList.toggle("critical", percent >= 90);
}

function renderBackupSummary(status) {
  if (!status.supported) {
    backupSummary.textContent = t("backup.unavailable");
    restoreSyncBackup.disabled = true;
    return;
  }
  if (status.backupAvailable) {
    const date = new Intl.DateTimeFormat(preferences.language, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(status.backupCreatedAt));
    backupSummary.textContent = t("backup.available", {
      count: status.backupGroupCount,
      date
    });
    restoreSyncBackup.disabled = false;
    return;
  }
  backupSummary.textContent = t("backup.waiting");
  restoreSyncBackup.disabled = true;
}

function renderSyncStatus() {
  const status = currentState.sync || {};
  syncStatus.classList.remove("pending", "error");
  renderSyncStorage(status);
  renderBackupSummary(status);

  if (!status.supported) {
    syncStatus.classList.add("error");
    syncStatusTitle.textContent = t("sync.unavailableTitle");
    syncStatusDetail.textContent = t("sync.unavailableText");
    return;
  }
  if (status.lastError) {
    syncStatus.classList.add("error");
    syncStatusTitle.textContent = t("sync.localOnlyTitle");
    syncStatusDetail.textContent = t("sync.errorText");
    return;
  }
  if (status.pending) {
    syncStatus.classList.add("pending");
    syncStatusTitle.textContent = t("sync.pendingTitle");
    syncStatusDetail.textContent = t(
      status.pending === 1 ? "sync.pendingOne" : "sync.pendingMany",
      { count: status.pending }
    );
    return;
  }

  syncStatusTitle.textContent = t("sync.readyTitle");
  syncStatusDetail.textContent = t("sync.readyText", {
    used: formatKiB(status.usedBytes),
    total: formatKiB(status.totalBytes || 102400)
  });
}

function renderSyncCollapseState() {
  const collapsed = preferences.syncCollapsed === true;
  syncShell.classList.toggle("is-collapsed", collapsed);
  const alert = Boolean(
    currentState &&
      ((!currentState.sync?.supported || currentState.sync?.lastError) ||
        Number(currentState.diagnostics?.unreadCount || 0) > 0)
  );
  syncShell.classList.toggle("has-alert", alert);
  toggleSync.setAttribute("aria-expanded", String(!collapsed));
  toggleSync.title = t(collapsed ? "sync.expand" : "sync.collapse");
  toggleSync.setAttribute("aria-label", toggleSync.title);
}

function renderDiagnosticsSummary() {
  const count = Number(currentState.diagnostics?.count || 0);
  diagnosticsSummary.textContent = count ? t("diagnostics.count", { count }) : t("diagnostics.none");
  openDiagnostics.classList.toggle("has-alert", Number(currentState.diagnostics?.unreadCount || 0) > 0);
}

function renderDiagnosticReport(report) {
  diagnosticList.replaceChildren();
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  if (!errors.length) {
    diagnosticList.append(emptyState(t("diagnostics.none"), t("diagnostics.privacy")));
    return;
  }
  for (const error of errors.slice().reverse()) {
    const item = document.createElement("details");
    item.className = "diagnostic-item";
    const summary = document.createElement("summary");
    const date = new Intl.DateTimeFormat(preferences.language, { dateStyle: "short", timeStyle: "medium" }).format(new Date(error.at));
    summary.textContent = `${date} · ${error.context} · ${error.code}`;
    const pre = document.createElement("pre");
    pre.textContent = error.stack || `${error.name}: ${error.code}`;
    item.append(summary, pre);
    diagnosticList.append(item);
  }
}

async function openDiagnosticsDialog(trigger = openDiagnostics) {
  try {
    currentDiagnosticReport = await send("getDiagnosticReport");
    renderDiagnosticReport(currentDiagnosticReport);
    openModal(diagnosticsDialog, trigger);
    await send("markDiagnosticsSeen");
    if (currentState?.diagnostics) currentState.diagnostics.unreadCount = 0;
    renderDiagnosticsSummary();
    renderSyncCollapseState();
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
}

function render() {
  renderSavedGroups();
  renderSyncStatus();
  renderDiagnosticsSummary();
  visualPromo.hidden = true;
  autoPin.checked = currentState.autoPinNewGroups;
  updateChoiceStates();
  requestAnimationFrame(refreshFilterLabelFit);
  if (Number(currentState.diagnostics?.unreadCount || 0) > 0 && notice.hidden) {
    showNotice(t("diagnostics.errorNotice"), true, {
      label: t("diagnostics.open"),
      onClick: () => openDiagnosticsDialog(notice)
    });
  }
}

async function loadAndRender() {
  const [currentTab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentState = await send("getState", { windowId: currentTab?.windowId });
  if (preferences.groupFilter !== "all" || preferences.panelViewLimit === "unlimited") {
    allGroupsExpanded = false;
  }
  render();
}

function buildColorOptions() {
  for (const [name, value] of Object.entries(COLORS)) {
    const label = document.createElement("label");
    label.className = "color-choice";
    label.dataset.color = name;
    label.style.setProperty("--group-color", value);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "group-color";
    input.value = name;

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.setAttribute("aria-hidden", "true");
    label.append(input, swatch);
    colorOptions.append(label);
  }
  translateColorOptions();
  updateEditorColorPalette();
}

function buildIconOptions() {
  for (const name of GROUP_ICONS) {
    const label = document.createElement("label");
    label.className = "icon-choice";
    label.dataset.icon = name;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "group-icon";
    input.value = name;

    const swatch = document.createElement("span");
    swatch.className = "icon-swatch";
    swatch.setAttribute("aria-hidden", "true");
    if (name === "none") {
      swatch.classList.add("icon-none");
      const ring = document.createElement("span");
      ring.className = "empty-icon-ring editor-empty-icon-ring";
      swatch.append(ring);
    } else {
      swatch.append(createIcon(name));
    }

    label.append(input, swatch);
    iconOptions.append(label);
  }
  translateIconOptions();
}

function openEditor(group, trigger) {
  editingId = group.id;
  editTitle.value = group.title;
  editDarkerColors.checked = group.darkerColors === true;
  const selected = colorOptions.querySelector(`input[value="${group.color}"]`) || colorOptions.querySelector("input");
  if (selected) selected.checked = true;
  const selectedIcon = iconOptions.querySelector(`input[value="${group.icon || "none"}"]`) || iconOptions.querySelector("input");
  if (selectedIcon) selectedIcon.checked = true;
  setGroupColor(editDialog, group.color, group.darkerColors === true);
  updateEditorColorPalette();
  openModal(editDialog, trigger, editTitle);
  requestAnimationFrame(() => editTitle.select());
}

function closeEditor() {
  closeModal(editDialog);
  editingId = null;
}

async function saveUiPreferences(changes) {
  try {
    preferences = await Ui.save(changes);
    applyPreferences();
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = editTitle.value.trim();
  const color = colorOptions.querySelector('input[name="group-color"]:checked')?.value;
  const icon = iconOptions.querySelector('input[name="group-icon"]:checked')?.value;
  const darkerColors = editDarkerColors.checked;
  if (!color || !icon || !editingId) return;

  const savedId = editingId;
  closeModal(editDialog);
  editingId = null;
  await withBusy(
    () => send("updateSavedGroup", { savedId, title, color, icon, darkerColors }),
    null
  );
});

cancelEdit.addEventListener("click", closeEditor);
cancelEditX.addEventListener("click", closeEditor);
colorOptions.addEventListener("change", () => {
  const color = colorOptions.querySelector('input[name="group-color"]:checked')?.value || "grey";
  setGroupColor(editDialog, color, editDarkerColors.checked);
  updateEditorColorPalette();
});
iconOptions.addEventListener("change", () => {
  const color = colorOptions.querySelector('input[name="group-color"]:checked')?.value || "grey";
  setGroupColor(editDialog, color, editDarkerColors.checked);
  updateEditorColorPalette();
});
editDarkerColors.addEventListener("change", () => {
  const color = colorOptions.querySelector('input[name="group-color"]:checked')?.value || "grey";
  setGroupColor(editDialog, color, editDarkerColors.checked);
  updateEditorColorPalette();
});
editDialog.addEventListener("close", () => {
  editingId = null;
});

autoPin.addEventListener("change", () => {
  const enabled = autoPin.checked;
  withBusy(
    () => send("setAutoPin", { enabled }),
    null
  );
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    allGroupsExpanded = false;
    saveUiPreferences({ groupFilter: button.dataset.filter });
  });
}

includeArchivedAll.addEventListener("change", () =>
  saveUiPreferences({ includeArchivedInAll: includeArchivedAll.checked })
);

const PANEL_VIEW_LIMITS = [3, 5, 10, "unlimited"];
const PREVIEW_TAB_COUNTS = [3, 5, 7, 9];

function sliderIndex(value, options) {
  return Math.max(0, Math.min(options.length - 1, Number(value) || 0));
}

function panelLimitToSliderIndex(limit) {
  const normalized = limit === "unlimited" ? "unlimited" : Number(limit);
  const index = PANEL_VIEW_LIMITS.findIndex((item) => item === normalized);
  return index >= 0 ? index : 0;
}

function previewCountToSliderIndex(count) {
  const normalized = Number(count);
  const index = PREVIEW_TAB_COUNTS.findIndex((item) => item === normalized);
  return index >= 0 ? index : 0;
}

function updatePanelViewSlider() {
  if (!panelViewSlider) return;
  const index = sliderIndex(panelViewSlider.value, PANEL_VIEW_LIMITS);
  const limit = PANEL_VIEW_LIMITS[index];
  panelViewSlider.style.setProperty("--panel-slider-progress", `${(index / (PANEL_VIEW_LIMITS.length - 1)) * 100}%`);
  panelViewSlider.setAttribute(
    "aria-valuetext",
    limit === "unlimited" ? t("panel.unlimited") : String(limit)
  );
}

function updatePreviewCountSlider() {
  if (!previewCountSlider) return;
  const index = sliderIndex(previewCountSlider.value, PREVIEW_TAB_COUNTS);
  const count = PREVIEW_TAB_COUNTS[index];
  previewCountSlider.style.setProperty("--panel-slider-progress", `${(index / (PREVIEW_TAB_COUNTS.length - 1)) * 100}%`);
  previewCountSlider.setAttribute("aria-valuetext", String(count));
}

panelViewSlider.addEventListener("input", updatePanelViewSlider);
panelViewSlider.addEventListener("change", () => {
  const index = sliderIndex(panelViewSlider.value, PANEL_VIEW_LIMITS);
  allGroupsExpanded = false;
  saveUiPreferences({ panelViewLimit: PANEL_VIEW_LIMITS[index] });
});

if (previewCountSlider) {
  previewCountSlider.addEventListener("input", updatePreviewCountSlider);
  previewCountSlider.addEventListener("change", () => {
    const index = sliderIndex(previewCountSlider.value, PREVIEW_TAB_COUNTS);
    saveUiPreferences({ previewTabCount: PREVIEW_TAB_COUNTS[index] });
  });
}

toggleSync.addEventListener("click", () =>
  saveUiPreferences({ syncCollapsed: !preferences.syncCollapsed })
);

archiveAllClosed.addEventListener("click", () => {
  if (!confirm(t("confirm.archiveAllClosed"))) return;
  withBusy(() => send("archiveAllClosedGroups"), null);
});

unarchiveAll.addEventListener("click", () => {
  if (!confirm(t("confirm.unarchiveAll"))) return;
  withBusy(() => send("unarchiveAllGroups"), null);
});

trashAllArchived.addEventListener("click", () => {
  if (!confirm(t("confirm.trashAllArchived"))) return;
  withBusy(() => send("trashAllArchived"), null);
});

emptyTrash.addEventListener("click", () => {
  if (!confirm(t("confirm.emptyTrash"))) return;
  withBusy(() => send("emptyTrash"), null);
});

settingsButton.addEventListener("click", () => openModal(settingsDialog, settingsButton));
closeSettings.addEventListener("click", () => closeModal(settingsDialog));

openDiagnostics.addEventListener("click", () => openDiagnosticsDialog(openDiagnostics));
closeDiagnostics.addEventListener("click", () => closeModal(diagnosticsDialog));

function diagnosticFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `grupos-na-barra-diagnostico-${stamp}.json`;
}

function diagnosticJson() {
  if (!currentDiagnosticReport) throw new Error(t("diagnostics.none"));
  return `${JSON.stringify(currentDiagnosticReport, null, 2)}\n`;
}

copyDiagnostics.addEventListener("click", async () => {
  try {
    const text = diagnosticJson();
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error(t("error.operationFailed"));
    showNotice(t("diagnostics.copied"));
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
});

downloadDiagnostics.addEventListener("click", () => {
  try {
    const url = URL.createObjectURL(new Blob([diagnosticJson()], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = diagnosticFilename();
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
});

clearDiagnostics.addEventListener("click", async () => {
  if (!confirm(t("diagnostics.confirmClear"))) return;
  try {
    await send("clearDiagnostics");
    currentDiagnosticReport = await send("getDiagnosticReport");
    renderDiagnosticReport(currentDiagnosticReport);
    if (currentState?.diagnostics) {
      currentState.diagnostics.count = 0;
      currentState.diagnostics.unreadCount = 0;
    }
    renderDiagnosticsSummary();
    renderSyncCollapseState();
    showNotice(t("diagnostics.cleared"));
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
});

function backupFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `grupos-na-barra-backup-${date}.json`;
}

exportJson.addEventListener("click", async () => {
  try {
    const data = await send("exportExtensionData");
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(data, null, 2)}\n`], {
        type: "application/json;charset=utf-8"
      })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showNotice(t("backup.exported", { count: data.groups.length }));
  } catch (error) {
    showNotice(error.message || String(error), true);
  }
});

restoreSyncBackup.addEventListener("click", async () => {
  if (!confirm(t("backup.confirmRestore"))) return;
  closeModal(settingsDialog);
  let restoredGroups = 0;
  await withBusy(
    async () => {
      const result = await send("restoreAutomaticBackup");
      restoredGroups = result.restoredGroups;
    },
    null
  );
  if (!notice.classList.contains("error")) {
    showNotice(t("backup.restored", { count: restoredGroups }));
  }
});

function closeInfoPopover(popover, restoreFocus = false) {
  if (!popover.wrap.classList.contains("is-open")) return;
  popover.wrap.classList.remove("is-open");
  popover.button.setAttribute("aria-expanded", "false");
  if (restoreFocus) popover.button.focus();
}

for (const popover of infoPopovers) {
  popover.button.addEventListener("click", () => {
    const open = !popover.wrap.classList.contains("is-open");
    for (const candidate of infoPopovers) {
      if (candidate !== popover) closeInfoPopover(candidate);
    }
    popover.wrap.classList.toggle("is-open", open);
    popover.button.setAttribute("aria-expanded", String(open));
  });
}

document.addEventListener("click", (event) => {
  for (const popover of infoPopovers) {
    if (!popover.wrap.contains(event.target)) closeInfoPopover(popover);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openPopover = infoPopovers.find((popover) => popover.wrap.classList.contains("is-open"));
  if (openPopover) closeInfoPopover(openPopover, true);
});

dismissVisualPromo.addEventListener("click", () =>
  saveUiPreferences({ visualPromoDismissed: true })
);

languageButton.addEventListener("click", () => openModal(languageDialog, languageButton));
closeLanguage.addEventListener("click", () => closeModal(languageDialog));
for (const button of languageChoices) {
  button.addEventListener("click", async () => {
    await saveUiPreferences({ language: button.dataset.language });
    closeModal(languageDialog);
  });
}

accessibilityButton.addEventListener("click", () =>
  openModal(accessibilityDialog, accessibilityButton)
);
closeAccessibility.addEventListener("click", () => closeModal(accessibilityDialog));
for (const button of fontSizeChoices) {
  button.addEventListener("click", () => saveUiPreferences({ fontSize: button.dataset.fontSize }));
}
highContrast.addEventListener("change", () =>
  saveUiPreferences({ highContrast: highContrast.checked })
);
reduceMotion.addEventListener("change", () =>
  saveUiPreferences({ reduceMotion: reduceMotion.checked })
);
resetAccessibility.addEventListener("click", () => {
  if (!confirm(t("access.confirmReset"))) return;
  saveUiPreferences({
    fontSize: Ui.DEFAULTS.fontSize,
    highContrast: Ui.DEFAULTS.highContrast,
    reduceMotion: Ui.DEFAULTS.reduceMotion
  });
});

function scheduleAutomaticRefresh(delay = 120) {
  if (busy) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (busy || refreshInFlight) return;
    refreshInFlight = true;
    try {
      await loadAndRender();
    } catch (error) {
      showNotice(error.message || String(error), true);
    } finally {
      refreshInFlight = false;
    }
  }, delay);
}

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.gruposNaBarraState || changes[Ui.STORAGE_KEY])) {
    scheduleAutomaticRefresh();
  }
  if (areaName === "sync") scheduleAutomaticRefresh(180);
});

if (browser.tabs?.onUpdated) {
  browser.tabs.onUpdated.addListener(() => scheduleAutomaticRefresh(180));
  browser.tabs.onCreated.addListener(() => scheduleAutomaticRefresh(180));
  browser.tabs.onRemoved.addListener(() => scheduleAutomaticRefresh(180));
}
if (browser.tabGroups?.onCreated) {
  browser.tabGroups.onCreated.addListener(() => scheduleAutomaticRefresh(180));
  browser.tabGroups.onUpdated.addListener(() => scheduleAutomaticRefresh(180));
  browser.tabGroups.onMoved.addListener(() => scheduleAutomaticRefresh(180));
  browser.tabGroups.onRemoved.addListener(() => scheduleAutomaticRefresh(180));
}

async function initialize() {
  preferences = await Ui.load();
  buildIconOptions();
  buildColorOptions();
  applyPreferences();
  await loadAndRender();
  const pendingEditor = await send("consumePendingGroupEditor");
  if (pendingEditor?.savedId) {
    const group = currentState.savedGroups.find(
      (candidate) => candidate.id === pendingEditor.savedId
    );
    if (group) openEditor(group, settingsButton);
  }
}

initialize().catch((error) => showNotice(error.message || String(error), true));
