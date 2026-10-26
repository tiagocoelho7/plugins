"use strict";

const Ui = globalThis.GruposUi;

if (!Ui) {
  throw new Error("A interface compartilhada não foi carregada.");
}

const downloadLink = document.querySelector("#download-visual");
const downloadLabel = document.querySelector("#download-label");
const downloadStatus = document.querySelector("#download-status");
const platformIcon = document.querySelector("#platform-icon");
const platformTitle = document.querySelector("#platform-title");
const platformDescription = document.querySelector("#platform-description");
const quitTitle = document.querySelector("#quit-title");
const quitDescription = document.querySelector("#quit-description");
const installerTitle = document.querySelector("#installer-title");
const installerDescription = document.querySelector("#installer-description");
const removeDescription = document.querySelector("#remove-description");
const restartHelp = document.querySelector("#restart-help");
const installerHelp = document.querySelector("#installer-help");
const closeAssistant = document.querySelector("#close-assistant");

const PACKAGES = {
  mac: {
    name: "macOS",
    href: "groups-on-the-bar-visual-macos-v3.0.10.zipdata",
    download: "groups-on-the-bar-visual-macos-v3.0.10.zip"
  },
  win: {
    name: "Windows",
    href: "groups-on-the-bar-visual-windows-v3.0.10.zipdata",
    download: "groups-on-the-bar-visual-windows-v3.0.10.zip"
  },
  linux: {
    name: "Linux",
    href: "groups-on-the-bar-visual-linux-v3.0.10.zipdata",
    download: "groups-on-the-bar-visual-linux-v3.0.10.zip"
  }
};

let selectedPlatform = null;
let preferences = Ui.normalize();

function t(key, replacements = {}) {
  return Ui.t(preferences.language, key, replacements);
}

function showPlatformIcon(warning = false) {
  platformIcon.classList.toggle("warning", warning);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const paths = warning
    ? ["M12 4 3 20h18L12 4Z", "M12 9v5m0 3v.1"]
    : ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "m8 12 2.5 2.5L16 9"];
  for (const pathData of paths) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
  platformIcon.replaceChildren(svg);
}

function setSupportedPlatform(os) {
  const config = PACKAGES[os];
  selectedPlatform = os;
  showPlatformIcon(false);
  platformTitle.textContent = t("visualAssistant.detected", { name: config.name });
  platformDescription.textContent = t(`platform.${os}.description`);
  downloadLink.href = config.href;
  downloadLink.download = config.download;
  downloadLabel.textContent = t("visualAssistant.downloadFor", { name: config.name });
  downloadLink.setAttribute("aria-label", downloadLabel.textContent);
  downloadLink.classList.remove("is-disabled");
  downloadLink.removeAttribute("aria-disabled");
  quitTitle.textContent = t(`platform.${os}.quitTitle`);
  quitDescription.textContent = t(`platform.${os}.quitDescription`);
  installerTitle.textContent = t(`platform.${os}.installerTitle`);
  installerDescription.textContent = t(`platform.${os}.installerDescription`);
  removeDescription.textContent = t(`platform.${os}.removeDescription`);
  restartHelp.textContent = t(`platform.${os}.restartHelp`);
  installerHelp.textContent = t(`platform.${os}.installerHelp`);
}

function setUnsupportedPlatform(name) {
  selectedPlatform = null;
  showPlatformIcon(true);
  platformTitle.textContent = t("visualAssistant.detectedUnsupported", { name });
  platformDescription.textContent = t("visualAssistant.unsupportedText");
  downloadLabel.textContent = t("visualAssistant.chooseBelow");
}

async function detectPlatform() {
  try {
    const platform = await browser.runtime.getPlatformInfo();
    if (PACKAGES[platform.os]) {
      setSupportedPlatform(platform.os);
      return;
    }

    const names = {
      win: "Windows",
      linux: "Linux",
      android: "Android",
      cros: "ChromeOS",
      openbsd: "OpenBSD"
    };
    setUnsupportedPlatform(names[platform.os] || t("visualAssistant.unsupportedSystem"));
  } catch (_error) {
    setUnsupportedPlatform(t("visualAssistant.unknownSystem"));
  }
}

downloadLink.addEventListener("click", (event) => {
  if (!selectedPlatform) {
    event.preventDefault();
    return;
  }
  downloadStatus.hidden = false;
});

closeAssistant.addEventListener("click", async () => {
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id) {
      await browser.tabs.remove(tab.id);
      return;
    }
  } catch (_error) {
    // A página pode ter sido aberta em um contexto sem uma aba consultável.
  }
  window.close();
});

async function initialize() {
  preferences = await Ui.load();
  try {
    preferences = await Ui.save({ visualPromoDismissed: true });
  } catch (_error) {
    // O assistente continua funcional mesmo se a preferência não puder ser salva.
  }
  Ui.applyToDocument(document, preferences);
  Ui.translateDocument(document, preferences.language);
  document.title = `${t("visualAssistant.subtitle")} — ${t("app.name")}`;
  await detectPlatform();
}

initialize();
