"use strict";

const Ui = globalThis.GruposUi;

if (!Ui) {
  throw new Error("A interface compartilhada não foi carregada.");
}

const title = document.querySelector("#title");
const message = document.querySelector("#message");
const retry = document.querySelector("#retry");
let preferences = Ui.normalize();

function t(key, replacements = {}) {
  return Ui.t(preferences.language, key, replacements);
}

function savedIdFromHash() {
  const raw = location.hash.slice(1);
  if (!raw) {
    return "";
  }
  try {
    return decodeURIComponent(raw);
  } catch (_error) {
    return raw;
  }
}

async function allowFaviconToLoad() {
  if (globalThis.groupFaviconReady?.then) {
    await Promise.race([
      globalThis.groupFaviconReady,
      new Promise((resolve) => setTimeout(resolve, 180))
    ]);
  }
  await new Promise((resolve) => setTimeout(resolve, 60));
}

async function openGroup() {
  retry.hidden = true;
  title.textContent = t("launcher.updatingTitle");
  message.textContent = t("launcher.updatingText");

  const savedId = savedIdFromHash();
  if (!savedId) {
    title.textContent = t("launcher.invalidTitle");
    message.textContent = t("launcher.invalidText");
    return;
  }

  try {
    await allowFaviconToLoad();
    const response = await browser.runtime.sendMessage({
      type: "toggleSavedGroup",
      savedId
    });
    if (!response?.ok) {
      throw new Error(
        response?.errorCode ? t(`error.${response.errorCode}`) : t("launcher.openError")
      );
    }

    if (response.data?.action === "closed") {
      title.textContent = t("launcher.closedTitle");
      message.textContent = t("launcher.closedText");
      setTimeout(() => window.close(), 350);
    } else if (response.data?.skippedTabs) {
      title.textContent = t("launcher.partialTitle");
      message.textContent = t("launcher.partialText", { count: response.data.skippedTabs });
      setTimeout(() => window.close(), 2200);
    }
  } catch (error) {
    title.textContent = t("launcher.failedTitle");
    message.textContent = error.message || String(error);
    retry.hidden = false;
  }
}

retry.addEventListener("click", openGroup);

async function initialize() {
  preferences = await Ui.load();
  Ui.applyToDocument(document, preferences);
  Ui.translateDocument(document, preferences.language);
  document.title = t("launcher.updatingTitle");
  await openGroup();
}

initialize();
