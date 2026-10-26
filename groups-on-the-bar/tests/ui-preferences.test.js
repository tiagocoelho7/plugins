"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadUi(browserLanguage = "pt-BR") {
  const storage = {};
  const context = {
    globalThis: null,
    browser: {
      i18n: { getUILanguage: () => browserLanguage },
      storage: {
        local: {
          async get(key) {
            return { [key]: storage[key] };
          },
          async set(values) {
            Object.assign(storage, values);
          }
        }
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../translations-extra.js"), "utf8"),
    context
  );
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../ui-preferences.js"), "utf8"),
    context
  );
  return { Ui: context.GruposUi, storage };
}

test("segue o idioma do Firefox na primeira execução", async () => {
  assert.equal((await loadUi("es-MX").Ui.load()).language, "es");
  assert.equal((await loadUi("en-US").Ui.load()).language, "en");
  assert.equal((await loadUi("pt-BR").Ui.load()).language, "pt-BR");
  assert.equal((await loadUi("pt-PT").Ui.load()).language, "en");
  assert.equal((await loadUi("zh-CN").Ui.load()).language, "zh-CN");
  assert.equal((await loadUi("ja-JP").Ui.load()).language, "ja");
  assert.equal((await loadUi("ko-KR").Ui.load()).language, "ko");
  assert.equal((await loadUi("de-DE").Ui.load()).language, "de");
  assert.equal((await loadUi("fr-FR").Ui.load()).language, "fr");
  assert.equal((await loadUi("ru-RU").Ui.load()).language, "ru");
  assert.equal((await loadUi("it-IT").Ui.load()).language, "en");
});

test("salva idioma, filtro, acessibilidade, Sync recolhido e dispensa visual no armazenamento local", async () => {
  const { Ui, storage } = loadUi();
  const saved = await Ui.save({
    language: "es",
    fontSize: "extra-large",
    highContrast: true,
    reduceMotion: true,
    groupFilter: "archived",
    includeArchivedInAll: true,
    panelViewLimit: 10,
    syncCollapsed: true,
    visualPromoDismissed: true
  });

  assert.equal(saved.language, "es");
  assert.equal(saved.fontSize, "extra-large");
  assert.equal(saved.highContrast, true);
  assert.equal(saved.reduceMotion, true);
  assert.equal(saved.groupFilter, "archived");
  assert.equal(saved.includeArchivedInAll, true);
  assert.equal(saved.panelViewLimit, 10);
  assert.equal(saved.syncCollapsed, true);
  assert.equal(saved.visualPromoDismissed, true);
  assert.deepEqual(storage[Ui.STORAGE_KEY], saved);
  assert.deepEqual(await Ui.load(), saved);

  const migrated = Ui.normalize({ allGroupsUnlimited: true });
  assert.equal(migrated.panelViewLimit, "unlimited");
  assert.equal(Ui.normalize({}).panelViewLimit, 3);
});

test("os nove idiomas possuem exatamente as mesmas mensagens", () => {
  const { Ui } = loadUi();
  const base = Object.keys(Ui.MESSAGES["pt-BR"]).sort();
  assert.deepEqual(Array.from(Ui.LANGUAGES), ["en", "es", "pt-BR", "zh-CN", "ja", "ko", "de", "fr", "ru"]);
  for (const language of Ui.LANGUAGES) {
    assert.deepEqual(Object.keys(Ui.MESSAGES[language]).sort(), base, language);
  }
  assert.equal(Ui.t("en", "tabs.many", { count: 10 }), "10 tabs");
  assert.equal(Ui.t("es", "status.currentWindow"), "En esta ventana");
  assert.equal(Ui.t("de", "button.settings"), "Einstellungen");
  assert.equal(Ui.t("zh-CN", "button.close"), "关闭");
  assert.equal(Ui.t("pt-BR", "icon.none"), "Sem ícone");
  assert.equal(Ui.t("en", "action.keepAtTop"), "Keep group at the top");
  assert.equal(Ui.t("en", "filter.archived"), "Archived");
  assert.equal(Ui.t("en", "filter.trash"), "Trash");
  assert.equal(Ui.t("en", "app.name"), "Groups 'On the Bar'");
  assert.equal(Ui.t("pt-BR", "app.name"), "Grupos 'On the Bar'");
  assert.equal(Ui.t("de", "app.name"), "Gruppen 'On the Bar'");
  assert.equal(Ui.t("pt-BR", "action.restore"), "Restaurar");
  assert.equal(Ui.t("pt-BR", "icon.game"), "Jogo");
});

test("o restore de backup avisa o fechamento de grupos abertos em todos os idiomas", () => {
  const { Ui } = loadUi();
  const requiredFragments = {
    "pt-BR": "salvos e fechados",
    en: "saved and closed",
    "zh-CN": "保存并关闭",
    ja: "保存して閉じます",
    ko: "저장한 뒤 닫습니다",
    de: "gespeichert und geschlossen",
    fr: "enregistrés puis fermés",
    es: "guardarán y cerrarán",
    ru: "сохранены и закрыты"
  };
  for (const [language, fragment] of Object.entries(requiredFragments)) {
    assert.match(Ui.t(language, "backup.confirmRestore"), new RegExp(fragment), language);
  }
});

test("aplica preferências de acessibilidade e idioma ao documento", () => {
  const { Ui } = loadUi();
  const documentRef = {
    documentElement: { lang: "", dataset: {} }
  };
  Ui.applyToDocument(documentRef, {
    language: "en",
    fontSize: "large",
    highContrast: true,
    reduceMotion: true,
    groupFilter: "all",
    visualPromoDismissed: false
  });
  assert.equal(documentRef.documentElement.lang, "en");
  assert.equal(documentRef.documentElement.dataset.fontSize, "large");
  assert.equal(documentRef.documentElement.dataset.highContrast, "true");
  assert.equal(documentRef.documentElement.dataset.reduceMotion, "true");
});
