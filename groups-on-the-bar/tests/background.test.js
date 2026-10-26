"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash, webcrypto } = require("node:crypto");
const { test } = require("node:test");

class MockEvent {
  constructor() {
    this.listeners = [];
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  emit(...args) {
    return Promise.all(this.listeners.map((listener) => listener(...args)));
  }
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function loadSyncStoreForTest() {
  const source = fs.readFileSync(path.join(__dirname, "..", "sync-store.js"), "utf8");
  const context = vm.createContext({ TextEncoder, Uint8Array, btoa, atob });
  vm.runInContext(source, context);
  return context.GruposSyncStore;
}

function createMockBrowser({
  syncStorage = {},
  withInitialGroup = true,
  deferBackgroundNavigation = false,
  failTabUrls = [],
  failCookieStoreIds = [],
  failGroupMove = false,
  clampTabsMove = false,
  failTabsRemove = false,
  failSyncSetAttempts = 0,
  manifestVersion = "3.0.10",
  recentlyClosedSessions = []
} = {}) {
  const storage = {};
  const extensionSessionStorage = {};
  const bookmarkNodes = new Map([
    ["root________", { id: "root________", title: "", children: [] }],
    ["toolbar_____", { id: "toolbar_____", parentId: "root________", title: "Barra de favoritos", children: [] }],
    ["other_____", { id: "other_____", parentId: "root________", title: "Outros favoritos", children: [] }]
  ]);
  let nextBookmarkId = 1;
  let nextTabId = 20;
  let nextGroupId = 100;
  const metrics = {
    goBackCalls: 0,
    menuRefreshCalls: 0,
    popupOpenCalls: 0,
    badgeText: "",
    badgeColor: null,
    syncSetCalls: 0,
    tabsMoveCalls: 0,
    remainingSyncSetFailures: Math.max(0, Number(failSyncSetAttempts) || 0),
    failGroupMove,
    clampTabsMove
  };
  const menuItems = new Map();
  const failedTabUrls = new Set(failTabUrls);
  const failedContainerIds = new Set(failCookieStoreIds);
  const sessionItems = deepClone(recentlyClosedSessions);

  const tabs = new Map([
    [
      1,
      {
        id: 1,
        windowId: 1,
        index: 0,
        groupId: 10,
        active: true,
        highlighted: true,
        pinned: false,
        url: "https://example.com/a",
        title: "Página A",
        favIconUrl: "data:image/png;base64,LOCAL_FAVICON"
      }
    ],
    [
      2,
      {
        id: 2,
        windowId: 1,
        index: 1,
        groupId: 10,
        active: false,
        highlighted: false,
        pinned: false,
        url: "about:config",
        title: "Configurações avançadas"
      }
    ],
    [
      3,
      {
        id: 3,
        windowId: 1,
        index: 2,
        groupId: -1,
        active: false,
        highlighted: false,
        pinned: false,
        url: "https://outside.example/",
        title: "Fora do grupo"
      }
    ]
  ]);

  const groups = new Map([
    [10, { id: 10, windowId: 1, title: "Pesquisa", color: "purple", collapsed: false }]
  ]);
  const windows = new Map([[1, { id: 1, type: "normal", focused: true }]]);

  if (!withInitialGroup) {
    tabs.delete(1);
    tabs.delete(2);
    tabs.get(3).active = true;
    tabs.get(3).highlighted = true;
    tabs.get(3).index = 0;
    groups.clear();
  }

  function reindex(windowId) {
    [...tabs.values()]
      .filter((tab) => tab.windowId === windowId)
      .sort((a, b) => a.index - b.index)
      .forEach((tab, index) => {
        tab.index = index;
      });
  }

  function removeEmptyGroups() {
    for (const group of [...groups.values()]) {
      if (![...tabs.values()].some((tab) => tab.groupId === group.id)) {
        groups.delete(group.id);
      }
    }
  }

  const storageChanged = new MockEvent();
  const browser = {
    i18n: {
      getUILanguage() {
        return "pt-BR";
      }
    },
    runtime: {
      id: "unit-test",
      onMessage: new MockEvent(),
      onInstalled: new MockEvent(),
      onStartup: new MockEvent(),
      getURL(relativePath) {
        return `moz-extension://unit-test/${relativePath}`;
      },
      getManifest() {
        return { version: manifestVersion };
      }
    },
    storage: {
      onChanged: storageChanged,
      local: {
        async get(key) {
          if (key === null) {
            return deepClone(storage);
          }
          return { [key]: deepClone(storage[key]) };
        },
        async set(items) {
          Object.assign(storage, deepClone(items));
        }
      },
      session: {
        async get(key) {
          if (key === null) {
            return deepClone(extensionSessionStorage);
          }
          return { [key]: deepClone(extensionSessionStorage[key]) };
        },
        async set(items) {
          Object.assign(extensionSessionStorage, deepClone(items));
        }
      },
      sync: {
        async get(key) {
          if (key === null) {
            return deepClone(syncStorage);
          }
          if (Array.isArray(key)) {
            return Object.fromEntries(
              key.filter((item) => Object.hasOwn(syncStorage, item)).map((item) => [item, deepClone(syncStorage[item])])
            );
          }
          return { [key]: deepClone(syncStorage[key]) };
        },
        async set(items) {
          metrics.syncSetCalls += 1;
          if (metrics.remainingSyncSetFailures > 0) {
            metrics.remainingSyncSetFailures -= 1;
            throw new Error("Simulated storage.sync.set failure");
          }
          Object.assign(syncStorage, deepClone(items));
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete syncStorage[key];
          }
        },
        async getBytesInUse() {
          return Buffer.byteLength(JSON.stringify(syncStorage));
        }
      }
    },
    bookmarks: {
      onCreated: new MockEvent(),
      onRemoved: new MockEvent(),
      onChanged: new MockEvent(),
      async get(id) {
        const node = bookmarkNodes.get(String(id));
        if (!node) {
          throw new Error("Bookmark not found");
        }
        return [deepClone(node)];
      },
      async getTree() {
        return [
          {
            id: "root________",
            title: "",
            children: [
              {
                ...deepClone(bookmarkNodes.get("toolbar_____")),
                children: [...bookmarkNodes.values()]
                  .filter((node) => node.parentId === "toolbar_____" && node.url)
                  .map(deepClone)
              },
              {
                ...deepClone(bookmarkNodes.get("other_____")),
                children: [...bookmarkNodes.values()]
                  .filter((node) => node.parentId === "other_____" && node.url)
                  .map(deepClone)
              }
            ]
          }
        ];
      },
      async create(details) {
        const id = `bookmark-${nextBookmarkId++}`;
        const node = { id, index: 0, ...deepClone(details) };
        bookmarkNodes.set(id, node);
        return deepClone(node);
      },
      async update(id, changes) {
        const node = bookmarkNodes.get(String(id));
        if (!node) {
          throw new Error("Bookmark not found");
        }
        Object.assign(node, deepClone(changes));
        return deepClone(node);
      },
      async move(id, destination) {
        const node = bookmarkNodes.get(String(id));
        Object.assign(node, deepClone(destination));
        return deepClone(node);
      },
      async remove(id) {
        if (!bookmarkNodes.delete(String(id))) {
          throw new Error("Bookmark not found");
        }
      }
    },
    tabs: {
      onCreated: new MockEvent(),
      onUpdated: new MockEvent(),
      onMoved: new MockEvent(),
      onRemoved: new MockEvent(),
      async query(queryInfo) {
        let result = [...tabs.values()];
        if (queryInfo.groupId !== undefined) {
          result = result.filter((tab) => tab.groupId === queryInfo.groupId);
        }
        if (queryInfo.windowId !== undefined) {
          result = result.filter((tab) => tab.windowId === queryInfo.windowId);
        }
        if (queryInfo.active !== undefined) {
          result = result.filter((tab) => tab.active === queryInfo.active);
        }
        if (queryInfo.highlighted !== undefined) {
          result = result.filter((tab) => tab.highlighted === queryInfo.highlighted);
        }
        return deepClone(result);
      },
      async get(tabId) {
        const tab = tabs.get(Number(tabId));
        if (!tab) {
          throw new Error("Tab not found");
        }
        return deepClone(tab);
      },
      async create(properties = {}) {
        if (failedTabUrls.has(properties.url)) {
          throw new Error("Simulated tabs.create failure");
        }
        if (failedContainerIds.has(properties.cookieStoreId)) {
          throw new Error("Unknown cookie store");
        }
        const windowId = properties.windowId || 1;
        const windowTabs = [...tabs.values()].filter((tab) => tab.windowId === windowId);
        if (properties.active !== false) {
          windowTabs.forEach((tab) => {
            tab.active = false;
            tab.highlighted = false;
          });
        }
        const requestedUrl = properties.url || "about:newtab";
        const navigationDeferred =
          deferBackgroundNavigation &&
          properties.active === false &&
          typeof properties.url === "string" &&
          /^https?:/.test(properties.url);
        const tab = {
          id: nextTabId++,
          windowId,
          index: windowTabs.length,
          groupId: -1,
          active: properties.active !== false,
          highlighted: properties.active !== false,
          pinned: Boolean(properties.pinned),
          cookieStoreId: properties.cookieStoreId || "firefox-default",
          url: navigationDeferred ? "about:blank" : requestedUrl,
          title: navigationDeferred ? "" : requestedUrl,
          status: navigationDeferred ? "loading" : "complete",
          ...(navigationDeferred ? { pendingUrl: requestedUrl } : {})
        };
        tabs.set(tab.id, tab);
        return deepClone(tab);
      },
      async update(tabId, changes) {
        const tab = tabs.get(Number(tabId));
        if (!tab) {
          throw new Error("Tab not found");
        }
        if (changes.active) {
          for (const candidate of tabs.values()) {
            if (candidate.windowId === tab.windowId) {
              candidate.active = false;
              candidate.highlighted = false;
            }
          }
          if (tab.pendingUrl) {
            tab.url = tab.pendingUrl;
            tab.title = tab.pendingUrl;
            tab.status = "complete";
            delete tab.pendingUrl;
          }
        }
        const previousGroupId = tab.groupId;
        Object.assign(tab, deepClone(changes));
        if (changes.pinned === true && previousGroupId !== -1) {
          tab.groupId = -1;
          removeEmptyGroups();
        }
        if (changes.active) {
          tab.highlighted = true;
        }
        return deepClone(tab);
      },
      async move(tabIds, moveProperties) {
        metrics.tabsMoveCalls += 1;
        const ids = Array.isArray(tabIds) ? tabIds.map(Number) : [Number(tabIds)];
        const moving = ids.map((id) => tabs.get(id)).filter(Boolean).sort((a, b) => a.index - b.index);
        if (!moving.length) {
          throw new Error("Tab not found");
        }
        const windowId = moving[0].windowId;
        const remaining = [...tabs.values()]
          .filter((tab) => tab.windowId === windowId && !ids.includes(tab.id))
          .sort((a, b) => a.index - b.index);
        const requestedIndex = Number(moveProperties.index);
        const effectiveIndex = metrics.clampTabsMove ? requestedIndex + 1 : requestedIndex;
        const index = Math.max(0, Math.min(effectiveIndex, remaining.length));
        remaining.splice(index, 0, ...moving);
        remaining.forEach((tab, tabIndex) => {
          tab.index = tabIndex;
        });
        return deepClone(moving);
      },
      async group(options) {
        const groupId = options.groupId ?? nextGroupId++;
        const selectedTabs = (Array.isArray(options.tabIds) ? options.tabIds : [options.tabIds]).map((id) => tabs.get(id));
        if (!selectedTabs.length || selectedTabs.some((tab) => !tab)) {
          throw new Error("Invalid tab ID");
        }
        if (options.groupId !== undefined) {
          const target = groups.get(groupId);
          if (!target || selectedTabs.some((tab) => tab.windowId !== target.windowId)) {
            throw new Error("Invalid target group");
          }
        }
        if (!groups.has(groupId)) {
          groups.set(groupId, {
            id: groupId,
            windowId: options.createProperties?.windowId ?? selectedTabs[0].windowId,
            title: "",
            color: "grey",
            collapsed: false
          });
        }
        selectedTabs.forEach((tab) => {
          tab.groupId = groupId;
          tab.pinned = false;
        });
        removeEmptyGroups();
        return groupId;
      },
      async remove(tabIds) {
        if (failTabsRemove) {
          throw new Error("Simulated tabs.remove failure");
        }
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        const affectedWindows = new Set();
        for (const id of ids) {
          const tab = tabs.get(Number(id));
          if (tab) {
            affectedWindows.add(tab.windowId);
          }
          tabs.delete(Number(id));
        }
        removeEmptyGroups();
        affectedWindows.forEach(reindex);
      },
      async goBack(tabId) {
        metrics.goBackCalls += 1;
        const tab = tabs.get(Number(tabId));
        if (!tab) {
          throw new Error("Tab not found");
        }
        tab.url = tab.previousUrl || "https://previous.example/";
        delete tab.previousUrl;
      }
    },
    tabGroups: {
      onCreated: new MockEvent(),
      onUpdated: new MockEvent(),
      onMoved: new MockEvent(),
      onRemoved: new MockEvent(),
      async get(groupId) {
        const group = groups.get(Number(groupId));
        if (!group) {
          throw new Error("Group not found");
        }
        return deepClone(group);
      },
      async query(queryInfo = {}) {
        let result = [...groups.values()];
        if (queryInfo.windowId !== undefined) {
          result = result.filter((group) => group.windowId === queryInfo.windowId);
        }
        return deepClone(result);
      },
      async update(groupId, changes) {
        const group = groups.get(Number(groupId));
        if (!group) {
          throw new Error("Group not found");
        }
        Object.assign(group, deepClone(changes));
        return deepClone(group);
      },
      async move(groupId, moveProperties) {
        if (metrics.failGroupMove) {
          throw new Error("Simulated tabGroups.move failure");
        }
        const group = groups.get(Number(groupId));
        if (!group) {
          throw new Error("Group not found");
        }
        const groupTabIds = [...tabs.values()]
          .filter((tab) => tab.groupId === group.id)
          .sort((a, b) => a.index - b.index)
          .map((tab) => tab.id);
        await browser.tabs.move(groupTabIds, { index: moveProperties.index });
        return deepClone(group);
      }
    },
    windows: {
      async get(windowId) {
        const window = windows.get(Number(windowId));
        if (!window) {
          throw new Error("Window not found");
        }
        return deepClone(window);
      },
      async getLastFocused() {
        return deepClone([...windows.values()].find((window) => window.focused) || [...windows.values()][0]);
      },
      async getAll() {
        return deepClone([...windows.values()]);
      },
      async create() {
        const id = windows.size + 1;
        const window = { id, type: "normal", focused: true };
        windows.set(id, window);
        return deepClone(window);
      },
      async update(windowId, changes) {
        const window = windows.get(Number(windowId));
        Object.assign(window, deepClone(changes));
        return deepClone(window);
      }
    },
    sessions: {
      onChanged: new MockEvent(),
      async getRecentlyClosed(filter = {}) {
        const limit = Number.isInteger(filter.maxResults) ? Math.max(0, filter.maxResults) : sessionItems.length;
        return deepClone(sessionItems.slice(0, limit));
      }
    },
    browserAction: {
      async openPopup() {
        metrics.popupOpenCalls += 1;
      },
      async setBadgeText({ text }) {
        metrics.badgeText = text;
      },
      async setBadgeBackgroundColor({ color }) {
        metrics.badgeColor = color;
      }
    },
    menus: {
      onShown: new MockEvent(),
      onHidden: new MockEvent(),
      onClicked: new MockEvent(),
      async removeAll() {
        menuItems.clear();
      },
      create(details) {
        if (menuItems.has(String(details.id))) {
          throw new Error("Duplicate menu ID");
        }
        menuItems.set(String(details.id), deepClone(details));
        return details.id;
      },
      async remove(id) {
        if (!menuItems.delete(String(id))) {
          throw new Error("Menu not found");
        }
      },
      async update(id, changes) {
        const item = menuItems.get(String(id));
        if (!item) {
          throw new Error("Menu not found");
        }
        Object.assign(item, deepClone(changes));
      },
      refresh() {
        metrics.menuRefreshCalls += 1;
      }
    },
    webRequest: {
      onBeforeRequest: new MockEvent()
    }
  };

  return {
    browser,
    storage,
    bookmarkNodes,
    tabs,
    groups,
    menuItems,
    metrics,
    extensionSessionStorage,
    failedTabUrls,
    sessionItems,
    addRecentlyClosedTab(tab, { lastModified = Date.now(), sessionId = null } = {}) {
      const source = deepClone(tab);
      sessionItems.unshift({
        lastModified,
        tab: {
          sessionId: sessionId || `session-${source.id}-${lastModified}`,
          windowId: source.windowId,
          groupId: null,
          url: source.url,
          title: source.title || source.url,
          ...(source.cookieStoreId ? { cookieStoreId: source.cookieStoreId } : {})
        }
      });
    }
  };
}

function startExtension(mock, { sourceRoot = path.join(__dirname, "..") } = {}) {
  const translationsSource = fs.readFileSync(path.join(sourceRoot, "translations-extra.js"), "utf8");
  const uiSource = fs.readFileSync(path.join(sourceRoot, "ui-preferences.js"), "utf8");
  const syncSource = fs.readFileSync(path.join(sourceRoot, "sync-store.js"), "utf8");
  const backgroundSource = fs.readFileSync(path.join(sourceRoot, "background.js"), "utf8");
  const context = vm.createContext({
    browser: mock.browser,
    console: {
      log: console.log,
      warn: console.warn,
      error() {}
    },
    URL,
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    btoa,
    atob,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(translationsSource, context);
  vm.runInContext(uiSource, context);
  vm.runInContext(syncSource, context);
  vm.runInContext(backgroundSource, context);

  assert.equal(mock.browser.runtime.onMessage.listeners.length, 1, "background must register a message router");
  assert.equal(
    mock.browser.webRequest.onBeforeRequest.listeners.length,
    1,
    "background must register the bookmark navigation interceptor"
  );
  const route = mock.browser.runtime.onMessage.listeners[0];
  const interceptBookmark = mock.browser.webRequest.onBeforeRequest.listeners[0];
  const send = async (message, sender = {}) => {
    const response = await route(message, sender);
    assert.equal(response.ok, true, response.error);
    return response.data;
  };
  return { route, interceptBookmark, send, context };
}

async function testPreviewShowsDomainAndTabTitle() {
  const mock = createMockBrowser();
  const { context } = startExtension(mock);

  context.testPreviewTab = {
    url: "https://chatgpt.com/c/abc",
    title: "Plugin - Plugin - Group Tabs Novo"
  };
  assert.equal(
    vm.runInContext("previewLabelForTab(testPreviewTab)", context),
    "chatgpt.com (Plugin - Plugin - Group Tabs Novo)",
    "the preview must show the domain followed by the tab title"
  );

  context.testPreviewTab = { url: "https://www.example.com/path", title: "https://www.example.com/path" };
  assert.equal(
    vm.runInContext("previewLabelForTab(testPreviewTab)", context),
    "example.com",
    "the preview must avoid duplicating a URL-like title"
  );

  context.testPreviewTab = { url: "about:blank", title: "Nova aba" };
  assert.equal(
    vm.runInContext("previewLabelForTab(testPreviewTab)", context),
    "about:blank (Nova aba)",
    "placeholder tabs should still have a readable preview"
  );
}

async function leaveOnlyOneRestorableGroupedTab(mock, extension) {
  const ungrouped = await mock.browser.tabs.update(2, { pinned: true });
  await mock.browser.tabs.onUpdated.emit(2, { pinned: true, groupId: NO_GROUP_FOR_TEST }, ungrouped);
  await extension.send({ type: "syncNativeGroup", groupId: 10 });
}

const NO_GROUP_FOR_TEST = -1;

async function testClosingLastTabKeepsGroupWithPlaceholder() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  assert.equal(
    [...mock.tabs.values()].filter((tab) => tab.groupId === 10).length,
    1,
    "the fixture must leave exactly one tab in the native group"
  );

  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  mock.addRecentlyClosedTab(removedTab);
  await mock.browser.sessions.onChanged.emit();

  state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.ok(saved, "closing the last tab must not delete the saved group");
  assert.equal(saved.open, false, "the saved group must become closed");
  assert.equal(saved.tabCount, 1, "the closed group must retain one neutral placeholder tab");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].tabs[0].url, "about:blank");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].recoveryTabs[0].url, "about:blank");
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty,
    true,
    "the persisted semantic marker must distinguish a deliberate empty group from a degraded restore"
  );

  const reopened = await extension.send({ type: "openSavedGroup", savedId, windowId: 1 });
  assert.equal(reopened.opened, true);
  const reopenedGroupId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  const reopenedTabs = [...mock.tabs.values()].filter((tab) => tab.groupId === reopenedGroupId);
  assert.equal(reopenedTabs.length, 1);
  assert.equal(reopenedTabs[0].url, "about:blank", "reopening the emptied group must open the neutral tab");

  const navigated = mock.tabs.get(reopenedTabs[0].id);
  navigated.url = "https://example.com/new";
  navigated.title = "Nova página real";
  await mock.browser.tabs.onUpdated.emit(
    navigated.id,
    { url: navigated.url, title: navigated.title },
    deepClone(navigated)
  );
  await extension.send({ type: "syncNativeGroup", groupId: reopenedGroupId });
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty,
    false,
    "a real URL must clear the deliberate-empty marker"
  );
}

async function testClosingLastTabHandlesReverseEventOrder() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);

  // tabGroups.onRemoved pode chegar antes de tabs.onRemoved. A classificação
  // não depende dessa ordem: o snapshot fica preservado até sessions.onChanged.
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  let state = await extension.send({ type: "getState", windowId: 1 });
  let saved = state.savedGroups.find((group) => group.id === savedId);
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].tabs[0].url, "https://example.com/a");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);

  await new Promise((resolve) => setTimeout(resolve, 250));
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedTab);
  await mock.browser.sessions.onChanged.emit();
  state = await extension.send({ type: "getState", windowId: 1 });
  saved = state.savedGroups.find((group) => group.id === savedId);
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].tabs[0].url, "about:blank");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
}

async function testDelayedGroupRemovalKeepsCorrelationAfterRuntimeSync() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);

  // Simule uma entrega lenta de tabGroups.onRemoved. Nesse intervalo, os
  // timers normais de tabs.* e até uma leitura da popup podem executar. Eles
  // não podem apagar o vínculo que correlaciona o grupo nativo ao salvo.
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onUpdated.emit({
    id: 10,
    windowId: 1,
    title: "Pesquisa",
    color: "purple"
  });
  await new Promise((resolve) => setTimeout(resolve, 320));

  await extension.send({ type: "getState", windowId: 1 });
  const beforeRemovalEvent = mock.storage.gruposNaBarraState.groups.find(
    (group) => group.id === savedId
  );
  assert.deepEqual(
    beforeRemovalEvent.live,
    { groupId: 10, windowId: 1 },
    "runtime sync/reconciliation must preserve the native identity until tabGroups.onRemoved"
  );
  assert.equal(beforeRemovalEvent.intentionallyEmpty, false);
  assert.equal(beforeRemovalEvent.tabs[0].url, "https://example.com/a");

  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  mock.addRecentlyClosedTab(removedTab);
  await mock.browser.sessions.onChanged.emit();

  const finalState = await extension.send({ type: "getState", windowId: 1 });
  const saved = finalState.savedGroups.find((group) => group.id === savedId);
  assert.equal(saved.open, false);
  const persisted = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.equal(persisted.intentionallyEmpty, true);
  assert.deepEqual(persisted.tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testMovingLastTabOutMakesSavedGroupIntentionallyEmpty() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  const moved = mock.tabs.get(1);
  moved.groupId = NO_GROUP_FOR_TEST;
  mock.groups.delete(10);
  // Ordem observada no Firefox 155 T3: o grupo some primeiro; depois a aba
  // viva anuncia groupId=-1. A pendência deve ser resolvida pelo sinal de
  // membership, sem depender de grace window.
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.tabs.onUpdated.emit(
    moved.id,
    { groupId: NO_GROUP_FOR_TEST },
    deepClone(moved)
  );

  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.ok(saved);
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups.find((g) => g.id === savedId).intentionallyEmpty, true);
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.find((g) => g.id === savedId).tabs.map((tab) => tab.url),
    ["about:blank"],
    "moving the last tab out must empty the persistent group rather than retaining a stale URL"
  );
  assert.equal(mock.tabs.get(1).url, "https://example.com/a", "the moved tab itself must remain open");
}

async function testMovingLastTabBetweenGroupsEmptiesSourceAndUpdatesTarget() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const sourceSavedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  const targetSeed = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://target.example/seed"
  });
  mock.groups.set(77, { id: 77, windowId: 1, title: "Destino", color: "blue", collapsed: false });
  mock.tabs.get(targetSeed.id).groupId = 77;
  await extension.send({ type: "syncNativeGroup", groupId: 77 });

  const sourceTab = mock.tabs.get(1);
  sourceTab.groupId = 77;
  mock.groups.delete(10);
  // Ordem observada no Firefox 155 T4: SOURCE onRemoved precede a mudança
  // da aba para o DESTINATION.
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.tabs.onUpdated.emit(sourceTab.id, { groupId: 77 }, deepClone(sourceTab));
  await extension.send({ type: "syncNativeGroup", groupId: 77 });

  const state = await extension.send({ type: "getState", windowId: 1 });
  const source = mock.storage.gruposNaBarraState.groups.find((group) => group.id === sourceSavedId);
  const target = mock.storage.gruposNaBarraState.groups.find((group) => group.title === "Destino");
  assert.ok(source && target);
  assert.equal(source.intentionallyEmpty, true);
  assert.deepEqual(source.tabs.map((tab) => tab.url), ["about:blank"]);
  assert.equal(
    target.tabs.some((tab) => tab.url === "https://example.com/a"),
    true,
    "the target group must receive the moved tab"
  );
}

async function testNativeUngroupEmptiesSavedGroupFromMembershipEvidence() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  const groupedTabs = [...mock.tabs.values()].filter((tab) => tab.groupId === 10).map(deepClone);
  for (const tab of groupedTabs) {
    mock.tabs.get(tab.id).groupId = NO_GROUP_FOR_TEST;
  }
  mock.groups.delete(10);

  // Ordem observada no Firefox 155 T5: group onRemoved antes dos groupId=-1.
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  for (const tab of groupedTabs) {
    const current = deepClone(mock.tabs.get(tab.id));
    await mock.browser.tabs.onUpdated.emit(tab.id, { groupId: NO_GROUP_FOR_TEST }, current);
  }

  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.ok(saved);
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
  assert.deepEqual(mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url), ["about:blank"]);
}


async function testMembershipBeforeGroupRemovalPreservesRatherThanGuessing() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  // Ordem não observada no probe: membership chega ANTES do onRemoved do
  // grupo. Sem proveniência positiva do tabGroups.onRemoved, a v3.0.6 não
  // tenta inferir empty; preserva o snapshot por segurança.
  mock.tabs.get(1).groupId = NO_GROUP_FOR_TEST;
  mock.groups.delete(10);
  await mock.browser.tabs.onUpdated.emit(
    1,
    { groupId: NO_GROUP_FOR_TEST },
    deepClone(mock.tabs.get(1))
  );
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.equal(persisted.tabs[0].url, "https://example.com/a");
}

async function testNativeSaveAndClosePreservesSnapshotViaSessions() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  // Entradas antigas ou de outra janela, mesmo com a mesma URL, não podem
  // transformar um Save and close em esvaziamento por falso positivo.
  mock.addRecentlyClosedTab(
    { windowId: 1, url: "https://example.com/a", title: "Página A" },
    { lastModified: Date.now() - 2_000, sessionId: "stale-same-url" }
  );
  mock.addRecentlyClosedTab(
    { windowId: 999, url: "https://example.com/a", title: "Página A" },
    { lastModified: Date.now(), sessionId: "other-window-same-url" }
  );

  // Firefox 155: Save and close dispara sessions.onChanged, mas a aba do
  // grupo salvo não entra em sessions.getRecentlyClosed().
  await mock.browser.sessions.onChanged.emit();

  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.ok(saved);
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].tabs[0].url, "https://example.com/a");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);
}

async function testNativeDeleteUsesRecentlyClosedAndKeepsPersistentGroupEmpty() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  mock.addRecentlyClosedTab(removedTab);
  await mock.browser.sessions.onChanged.emit();

  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.ok(saved, "native Delete must not delete the GOTB persistent entity");
  assert.equal(saved.open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
  assert.deepEqual(mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testEarlierRemovalFromSameGroupCannotEmptyLaterNativeSaveAndClose() {
  const mock = createMockBrowser();
  mock.tabs.get(2).url = "https://example.com/b";
  mock.tabs.get(2).title = "Página B";
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedA = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedA, { lastModified: Date.now(), sessionId: "earlier-A" });
  await mock.browser.sessions.onChanged.emit();

  // Prova explícita de que o grupo sobreviveu ao fechamento de A e agora o
  // snapshot persistente correto contém apenas B.
  await extension.send({ type: "syncNativeGroup", groupId: 10 });
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    ["https://example.com/b"]
  );

  await new Promise((resolve) => setTimeout(resolve, 1_000));

  // Logo depois, Save and close nativo remove B mas NÃO coloca B em Recently
  // Closed. A Session antiga de A não pode ser reutilizada como prova de que
  // esta remoção terminal atual foi close/Delete.
  await mock.browser.tabs.remove(2);
  await mock.browser.tabs.onRemoved.emit(2, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.deepEqual(
    persisted.tabs.map((tab) => tab.url),
    ["https://example.com/b"],
    "a non-terminal close from the same group must never erase a later Native Save and close snapshot"
  );
}

async function testEarlierRemovalWithSeveralRemainingTabsCannotEmptyLaterNativeSaveAndClose() {
  const mock = createMockBrowser();
  mock.tabs.get(2).url = "https://example.com/b";
  mock.tabs.get(2).title = "Página B";
  const extra = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/c"
  });
  mock.tabs.get(extra.id).groupId = 10;

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedA = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedA, { lastModified: Date.now(), sessionId: "earlier-A-multi" });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const remainingIds = [2, extra.id];
  await mock.browser.tabs.remove(remainingIds);
  for (const tabId of remainingIds) {
    await mock.browser.tabs.onRemoved.emit(tabId, { windowId: 1, isWindowClosing: false });
  }
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.deepEqual(
    persisted.tabs.map((tab) => tab.url),
    ["https://example.com/b", "https://example.com/c"]
  );
}

async function testEarlierRemovalThenNativeDeleteUsesTerminalRemovalNotOldSession() {
  const mock = createMockBrowser();
  mock.tabs.get(2).url = "https://example.com/b";
  mock.tabs.get(2).title = "Página B";
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedA = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedA, { lastModified: Date.now(), sessionId: "old-A-before-delete" });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedB = deepClone(mock.tabs.get(2));
  await mock.browser.tabs.remove(2);
  await mock.browser.tabs.onRemoved.emit(2, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedB, { lastModified: Date.now(), sessionId: "terminal-B-delete" });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, true);
  assert.deepEqual(persisted.tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testEarlierRemovalThenFinalCloseUsesTerminalRemovalNotOldSession() {
  const mock = createMockBrowser();
  mock.tabs.get(2).url = "https://example.com/b";
  mock.tabs.get(2).title = "Página B";
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedA = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedA, { lastModified: Date.now(), sessionId: "old-A-before-final" });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedB = deepClone(mock.tabs.get(2));
  await mock.browser.tabs.remove(2);
  await mock.browser.tabs.onRemoved.emit(2, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedB, { lastModified: Date.now(), sessionId: "terminal-B-final" });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
  assert.deepEqual(mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testRestoredSameGroupIdDoesNotReuseOldRemovalGeneration() {
  const mock = createMockBrowser();
  mock.tabs.get(2).url = "https://example.com/b";
  mock.tabs.get(2).title = "Página B";
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  // Geração #1: Save and close nativo. Nenhuma Session correspondente.
  await mock.browser.tabs.remove([1, 2]);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabs.onRemoved.emit(2, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  // Firefox pode restaurar reutilizando o mesmo groupId. Isso deve iniciar
  // geração #2 e invalidar marker/pending da geração #1.
  mock.groups.set(10, { id: 10, windowId: 1, title: "Pesquisa", color: "purple", collapsed: false });
  await mock.browser.tabGroups.onCreated.emit(deepClone(mock.groups.get(10)));

  const restoredA = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: "https://example.com/a"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(restoredA.id)));
  mock.tabs.get(restoredA.id).groupId = 10;
  await mock.browser.tabs.onUpdated.emit(
    restoredA.id,
    { groupId: 10 },
    deepClone(mock.tabs.get(restoredA.id))
  );

  const restoredB = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/b"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(restoredB.id)));
  mock.tabs.get(restoredB.id).groupId = 10;
  await mock.browser.tabs.onUpdated.emit(
    restoredB.id,
    { groupId: 10 },
    deepClone(mock.tabs.get(restoredB.id))
  );
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  state = await extension.send({ type: "getState", windowId: 1 });
  const original = state.savedGroups.find((group) => group.id === savedId);
  const restoredEntity = mock.storage.gruposNaBarraState.groups.find(
    (group) => group.live?.groupId === 10
  );
  assert.ok(restoredEntity, "the restored native generation must be persisted");
  assert.notEqual(
    restoredEntity.id,
    savedId,
    "reused native groupId is lifecycle evidence, not persistent identity evidence"
  );
  assert.equal(original.open, false, "the prior persistent entity must remain closed");

  // Move A para fora enquanto B mantém a geração #2 viva. O marker antigo da
  // geração #1 não pode qualificar esta mudança como remoção terminal.
  mock.tabs.get(restoredA.id).groupId = NO_GROUP_FOR_TEST;
  await mock.browser.tabs.onUpdated.emit(
    restoredA.id,
    { groupId: NO_GROUP_FOR_TEST },
    deepClone(mock.tabs.get(restoredA.id))
  );
  await extension.send({ type: "syncNativeGroup", groupId: 10 });
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.find((group) => group.id === restoredEntity.id).tabs.map((tab) => tab.url),
    ["https://example.com/b"]
  );
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId).tabs.map((tab) => tab.url),
    ["https://example.com/a", "https://example.com/b"],
    "the prior generation snapshot must stay intact"
  );

  // Save and close nativo de B na geração #2 deve preservar B na nova entidade.
  await mock.browser.tabs.remove(restoredB.id);
  await mock.browser.tabs.onRemoved.emit(restoredB.id, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups.find((group) => group.id === restoredEntity.id);
  assert.equal(persisted.intentionallyEmpty, false);
  assert.deepEqual(persisted.tabs.map((tab) => tab.url), ["https://example.com/b"]);
}


async function testStaleQueuedRemovalCannotCrossRestoredGeneration() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const localWrites = [];
  const syncWrites = [];
  const originalLocalSet = mock.browser.storage.local.set.bind(mock.browser.storage.local);
  const originalSyncSet = mock.browser.storage.sync.set.bind(mock.browser.storage.sync);
  mock.browser.storage.local.set = async (items) => {
    localWrites.push(deepClone(items));
    return originalLocalSet(items);
  };
  mock.browser.storage.sync.set = async (items) => {
    syncWrites.push(deepClone(items));
    return originalSyncSet(items);
  };

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  // Ignore writes from fixture/bootstrap. From this point onward no stale
  // generation is allowed to publish an intentional-empty state, even
  // transiently, before the restored generation resyncs itself.
  localWrites.length = 0;
  syncWrites.length = 0;

  const removedOld = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedOld, {
    lastModified: Date.now(),
    sessionId: "stale-generation-old-tab"
  });

  extension.context.testSerialDelayMs = 700;
  const blocker = vm.runInContext(
    "serial(() => new Promise((resolve) => setTimeout(resolve, testSerialDelayMs)), 'generation-race-blocker')",
    extension.context
  );

  // Observe generation #1 removal while its state mutation is stuck behind
  // the blocker. Do not await: the event has already marked generation #1 as
  // removed synchronously, while its serial task remains queued.
  const staleRemoval = mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  // Before the queued generation #1 task can run, Firefox restores the group
  // and reuses the exact same numeric groupId. onCreated must establish
  // generation #2 synchronously and invalidate the stale generation.
  mock.groups.set(10, {
    id: 10,
    windowId: 1,
    title: "Pesquisa",
    color: "purple",
    collapsed: false
  });
  await mock.browser.tabGroups.onCreated.emit(deepClone(mock.groups.get(10)));

  const restored = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: "https://restored.example/new"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(restored.id)));
  mock.tabs.get(restored.id).groupId = 10;
  await mock.browser.tabs.onUpdated.emit(
    restored.id,
    { groupId: 10 },
    deepClone(mock.tabs.get(restored.id))
  );

  await blocker;
  await staleRemoval;

  // Force all queued/scheduled work (including the generation #2 resync) to
  // settle before checking the final snapshot.
  await new Promise((resolve) => setTimeout(resolve, 320));
  await extension.send({ type: "getState", windowId: 1 });

  const localEmptyWrites = localWrites.filter((items) =>
    (items.gruposNaBarraState?.groups || []).some((group) => group.intentionallyEmpty === true)
  );
  assert.equal(
    localEmptyWrites.length,
    0,
    "a stale generation must never write intentionallyEmpty to local storage, even transiently"
  );

  const syncEmptyWrites = syncWrites.filter((items) =>
    Object.values(items).some(
      (value) => value?.kind === "group" && value?.intentionallyEmpty === true
    )
  );
  assert.equal(
    syncEmptyWrites.length,
    0,
    "a stale generation must never publish intentionallyEmpty to Firefox Sync, even transiently"
  );

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.deepEqual(persisted.tabs.map((tab) => tab.url), ["https://restored.example/new"]);
  assert.equal(persisted.live?.groupId, 10);
}

async function testStalePendingFinalizationCannotCrossRestoredGeneration() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const localWrites = [];
  const syncWrites = [];
  const originalLocalSet = mock.browser.storage.local.set.bind(mock.browser.storage.local);
  const originalSyncSet = mock.browser.storage.sync.set.bind(mock.browser.storage.sync);
  mock.browser.storage.local.set = async (items) => {
    localWrites.push(deepClone(items));
    return originalLocalSet(items);
  };
  mock.browser.storage.sync.set = async (items) => {
    syncWrites.push(deepClone(items));
    return originalSyncSet(items);
  };

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const removedOld = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  assert.equal(
    vm.runInContext("pendingNativeGroupRemovals.size", extension.context),
    1,
    "the fixture must have a generation #1 pending before the finalization race"
  );

  mock.addRecentlyClosedTab(removedOld, {
    lastModified: Date.now(),
    sessionId: "pending-finalize-old-generation"
  });

  // Ignore the legitimate write that merely closed generation #1 while
  // preserving its real snapshot. From here on no stale finalizer may publish
  // empty after generation #2 becomes alive.
  localWrites.length = 0;
  syncWrites.length = 0;

  extension.context.testSerialDelayMs = 700;
  const blocker = vm.runInContext(
    "serial(() => new Promise((resolve) => setTimeout(resolve, testSerialDelayMs)), 'generation-finalize-blocker')",
    extension.context
  );

  // sessions.onChanged resolves the Session and calls finalizePending..., which
  // removes the pending before queueing its destructive serial task. Keep that
  // finalizer blocked so onCreated cannot cancel it by key anymore.
  const staleFinalization = mock.browser.sessions.onChanged.emit();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    vm.runInContext("pendingNativeGroupRemovals.size", extension.context),
    0,
    "the old pending should already be detached while its finalizer waits in serial()"
  );

  mock.groups.set(10, {
    id: 10,
    windowId: 1,
    title: "Pesquisa",
    color: "purple",
    collapsed: false
  });
  await mock.browser.tabGroups.onCreated.emit(deepClone(mock.groups.get(10)));

  const restored = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: "https://restored.example/finalize"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(restored.id)));
  mock.tabs.get(restored.id).groupId = 10;
  await mock.browser.tabs.onUpdated.emit(
    restored.id,
    { groupId: 10 },
    deepClone(mock.tabs.get(restored.id))
  );

  await blocker;
  await staleFinalization;
  await new Promise((resolve) => setTimeout(resolve, 320));
  await extension.send({ type: "syncNativeGroup", groupId: 10 });
  await extension.send({ type: "getState", windowId: 1 });

  assert.equal(
    localWrites.filter((items) =>
      (items.gruposNaBarraState?.groups || []).some((group) => group.intentionallyEmpty === true)
    ).length,
    0,
    "a detached stale finalizer must never write intentionallyEmpty to local storage"
  );
  assert.equal(
    syncWrites.filter((items) =>
      Object.values(items).some(
        (value) => value?.kind === "group" && value?.intentionallyEmpty === true
      )
    ).length,
    0,
    "a detached stale finalizer must never publish intentionallyEmpty to Firefox Sync"
  );

  assert.ok(
    mock.storage.gruposNaBarraState.groups.every((group) => group.intentionallyEmpty === false),
    "neither the old closed generation nor the restored generation may become intentionally empty"
  );
  const restoredPersisted = mock.storage.gruposNaBarraState.groups.find(
    (group) => group.live?.groupId === 10 && group.live?.windowId === 1
  );
  assert.ok(restoredPersisted, "the restored generation must remain represented as a live saved group");
  assert.deepEqual(
    restoredPersisted.tabs.map((tab) => tab.url),
    ["https://restored.example/finalize"]
  );
}

async function testUnrelatedMembershipSameUrlCannotEmptyNativeSaveAndClose() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const unrelated = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(unrelated.id)));
  mock.groups.set(77, { id: 77, windowId: 1, title: "Outro", color: "blue", collapsed: false });
  mock.tabs.get(unrelated.id).groupId = 77;
  await mock.browser.tabs.onUpdated.emit(
    unrelated.id,
    { groupId: 77 },
    deepClone(mock.tabs.get(unrelated.id))
  );

  // A aba homônima sai de OUTRO grupo. Isso pode ser evidence apenas para 77,
  // nunca para o grupo 10 que será salvo/fechado em seguida.
  mock.tabs.get(unrelated.id).groupId = NO_GROUP_FOR_TEST;
  mock.groups.delete(77);
  await mock.browser.tabs.onUpdated.emit(
    unrelated.id,
    { groupId: NO_GROUP_FOR_TEST },
    deepClone(mock.tabs.get(unrelated.id))
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.equal(
    persisted.tabs[0].url,
    "https://example.com/a",
    "membership evidence from another group must never erase a Native Save and close snapshot"
  );
}

async function testUnrelatedRecentlyClosedSameUrlSameWindowCannotEmptyNativeSaveAndClose() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const unrelated = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(unrelated.id)));

  const groupTab = deepClone(mock.tabs.get(1));
  const unrelatedTab = deepClone(mock.tabs.get(unrelated.id));
  await mock.browser.tabs.remove([1, unrelated.id]);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabs.onRemoved.emit(unrelated.id, { windowId: 1, isWindowClosing: false });

  // Save and close do grupo não entra em Recently Closed. A única Session é
  // da OUTRA aba homônima na mesma janela. Como ambas as remoções são
  // candidatas possíveis para essa Session, a atribuição é ambígua e deve
  // preservar o snapshot.
  mock.addRecentlyClosedTab(unrelatedTab, { lastModified: Date.now(), sessionId: "unrelated-same-url" });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(groupTab.url, "https://example.com/a");
  assert.equal(persisted.intentionallyEmpty, false);
  assert.equal(
    persisted.tabs[0].url,
    "https://example.com/a",
    "an unrelated Recently Closed entry with the same URL/window must remain ambiguous"
  );
}


async function testUnobservedMissingDuplicateTabKeepsRecentlyClosedAmbiguous() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const unrelated = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(unrelated.id)));
  const unrelatedTab = deepClone(mock.tabs.get(unrelated.id));

  // Simula uma lacuna de observação: a outra aba desaparece do conjunto vivo
  // sem termos recebido seu tabs.onRemoved. O cache antigo + tabs.query() deve
  // tornar a Session homônima ambígua, nunca atribuí-la ao grupo salvo.
  mock.tabs.delete(unrelated.id);

  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(unrelatedTab, { lastModified: Date.now(), sessionId: "unobserved-duplicate" });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const persisted = mock.storage.gruposNaBarraState.groups[0];
  assert.equal(persisted.intentionallyEmpty, false);
  assert.equal(persisted.tabs[0].url, "https://example.com/a");
}

async function testOneRecentlyClosedSessionCannotProveTwoSameUrlPendingGroups() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const firstSavedId = state.savedGroups[0].id;
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const secondTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  await mock.browser.tabs.onCreated.emit(deepClone(mock.tabs.get(secondTab.id)));
  mock.groups.set(77, { id: 77, windowId: 1, title: "Segundo", color: "blue", collapsed: false });
  mock.tabs.get(secondTab.id).groupId = 77;
  await mock.browser.tabs.onUpdated.emit(
    secondTab.id,
    { groupId: 77 },
    deepClone(mock.tabs.get(secondTab.id))
  );
  await extension.send({ type: "syncNativeGroup", groupId: 77 });
  state = await extension.send({ type: "getState", windowId: 1 });
  const secondSavedId = state.savedGroups.find((group) => group.id !== firstSavedId).id;

  const firstRemoved = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove([1, secondTab.id]);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabs.onRemoved.emit(secondTab.id, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(firstRemoved, { lastModified: Date.now(), sessionId: "only-one-session" });

  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 77, windowId: 1, title: "Segundo", color: "blue" },
    { isWindowClosing: false }
  );
  await mock.browser.sessions.onChanged.emit();

  const first = mock.storage.gruposNaBarraState.groups.find((group) => group.id === firstSavedId);
  const second = mock.storage.gruposNaBarraState.groups.find((group) => group.id === secondSavedId);
  assert.equal(first.intentionallyEmpty, false);
  assert.equal(second.intentionallyEmpty, false);
  assert.equal(first.tabs[0].url, "https://example.com/a");
  assert.equal(second.tabs[0].url, "https://example.com/a");
}

async function testUnmatchedSessionsOnChangedDoesNotConsumePending() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  // Primeiro onChanged não prova nada para o grupo pendente.
  mock.addRecentlyClosedTab(
    { windowId: 1, url: "https://unrelated.example/", title: "Outra" },
    { lastModified: Date.now(), sessionId: "unrelated" }
  );
  await mock.browser.sessions.onChanged.emit();
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);

  // A prova correta chega depois. Se o primeiro onChanged tivesse consumido o
  // pending, esta segunda passagem não conseguiria aplicar o empty.
  mock.addRecentlyClosedTab(removedTab, { lastModified: Date.now(), sessionId: "correct" });
  await mock.browser.sessions.onChanged.emit();
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
  assert.deepEqual(mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testSessionsOnChangedBeforeGroupRemovalStillClassifiesClosedTab() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedTab, { lastModified: Date.now(), sessionId: "early-session" });

  // Race reproduzida pelo auditor: SessionStore muda antes de existir pending.
  await mock.browser.sessions.onChanged.emit();
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, true);
  assert.deepEqual(mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url), ["about:blank"]);
}

async function testSerialDelayDoesNotMoveRecentlyClosedReferenceTime() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  mock.addRecentlyClosedTab(removedTab, { lastModified: Date.now(), sessionId: "before-serial-delay" });

  extension.context.testSerialDelayMs = 650;
  const blocker = vm.runInContext(
    "serial(() => new Promise((resolve) => setTimeout(resolve, testSerialDelayMs)), 'audit-delay')",
    extension.context
  );
  await mock.browser.sessions.onChanged.emit();
  const groupRemoval = mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  await blocker;
  await groupRemoval;

  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty,
    true,
    "a >500ms serial delay must not invalidate evidence timestamped at tabs.onRemoved"
  );
}

async function testReopenedOrEditedGroupCannotBeEmptiedByStalePending() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;
  await leaveOnlyOneRestorableGroupedTab(mock, extension);

  const removedTab = deepClone(mock.tabs.get(1));
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  await extension.send({
    type: "updateSavedGroup",
    savedId,
    title: "Editado enquanto pendente",
    color: "purple",
    icon: "none"
  });
  await extension.send({ type: "openSavedGroup", savedId, windowId: 1 });

  mock.addRecentlyClosedTab(removedTab, { lastModified: Date.now(), sessionId: "stale-after-reopen" });
  await mock.browser.sessions.onChanged.emit();

  state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  const persisted = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.equal(saved.open, true);
  assert.equal(saved.title, "Editado enquanto pendente");
  assert.equal(persisted.intentionallyEmpty, false);
  assert.equal(persisted.tabs[0].url, "https://example.com/a");
}

async function testAmbiguousNativeRemovalFallsBackToPreservingSnapshot() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  await mock.browser.tabs.remove(1);
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );

  await new Promise((resolve) => setTimeout(resolve, 1_650));
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false);
  assert.equal(mock.storage.gruposNaBarraState.groups[0].tabs[0].url, "https://example.com/a");
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);
}

async function testWindowCloseDoesNotReplaceSavedTabsWithPlaceholder() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  await leaveOnlyOneRestorableGroupedTab(mock, extension);
  await mock.browser.tabs.remove(1);
  await mock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: true });
  await mock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: true }
  );

  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.equal(saved.open, false);
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].tabs[0].url,
    "https://example.com/a",
    "closing a whole window must preserve the last meaningful snapshot"
  );
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);
}

async function testExtensionCloseDoesNotBecomeEmptyPlaceholder() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  const originalRemove = mock.browser.tabs.remove.bind(mock.browser.tabs);
  const emittedRemovalEvents = [];
  mock.browser.tabs.remove = async (tabIds) => {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    const removed = ids.map((id) => mock.tabs.get(Number(id))).filter(Boolean).map(deepClone);
    const affectedGroups = new Map();
    for (const tab of removed) {
      if (tab.groupId !== NO_GROUP_FOR_TEST) {
        affectedGroups.set(`${tab.windowId}:${tab.groupId}`, {
          id: tab.groupId,
          windowId: tab.windowId,
          title: mock.groups.get(tab.groupId)?.title || "",
          color: mock.groups.get(tab.groupId)?.color || "grey"
        });
      }
    }
    await originalRemove(ids);
    for (const tab of removed) {
      emittedRemovalEvents.push(
        mock.browser.tabs.onRemoved.emit(tab.id, {
          windowId: tab.windowId,
          isWindowClosing: false
        })
      );
    }
    for (const group of affectedGroups.values()) {
      if (!mock.groups.has(group.id)) {
        emittedRemovalEvents.push(
          mock.browser.tabGroups.onRemoved.emit(group, { isWindowClosing: false })
        );
      }
    }
  };

  await extension.send({ type: "closeSavedGroup", savedId });
  await Promise.all(emittedRemovalEvents);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false);
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].tabs[0].url,
    "https://example.com/a",
    "Save and close must preserve the real saved content instead of substituting the empty placeholder"
  );
  assert.equal(mock.storage.gruposNaBarraState.groups[0].intentionallyEmpty, false);
}

async function testFailedCloseKeepsLiveLink() {
  const mock = createMockBrowser({ failTabsRemove: true });
  const { route, send } = startExtension(mock);
  const state = await send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  const response = await route({ type: "closeSavedGroup", savedId }, {});
  assert.equal(response.ok, false);
  assert.match(response.error, /tabs\.remove failure/i);
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].live,
    { groupId: 10, windowId: 1 },
    "a failed close must not lose the link to tabs that remain open"
  );
  assert.equal(mock.tabs.has(1), true);
  assert.equal(mock.tabs.has(2), true);
}

async function testFaviconSafety() {
  const mock = createMockBrowser();
  const { context, send } = startExtension(mock);

  const normalize = (value) => {
    context.testFaviconValue = value;
    return vm.runInContext("normalizeFaviconUrl(testFaviconValue)", context);
  };

  assert.equal(normalize("https://example.com/favicon.ico"), null);
  assert.equal(normalize("http://example.com/favicon.ico"), null);
  assert.equal(normalize("data:image/svg+xml,<svg></svg>"), null);
  assert.equal(normalize("javascript:alert(1)"), null);
  assert.equal(normalize("page-icon:https://example.com/"), "page-icon:https://example.com/");
  assert.equal(
    normalize("moz-anno:favicon:https://example.com/"),
    "moz-anno:favicon:https://example.com/"
  );

  const inline = `data:image/png;base64,${"A".repeat(12_000)}`;
  assert.equal(normalize(inline), inline, "valid local data favicons must not be truncated");
  const tooLarge = `data:image/png;base64,${"A".repeat(70_000)}`;
  assert.equal(normalize(tooLarge), null, "oversized inline favicons must be rejected");

  context.testLauncherUrl = "moz-extension://unit-test/launcher/open.html?v=1#group-1";
  assert.equal(vm.runInContext("isLauncherUrl(testLauncherUrl)", context), true);
  context.testLauncherUrl = "moz-extension://unit-test/launcher/open.html.evil#group-1";
  assert.equal(
    vm.runInContext("isLauncherUrl(testLauncherUrl)", context),
    false,
    "legacy launcher detection must compare the exact extension path"
  );
  context.testRecordId = "../escape";
  assert.equal(vm.runInContext("normalizeRecordId(testRecordId)", context), null);
  context.testRecordId = "group-safe_123";
  assert.equal(vm.runInContext("normalizeRecordId(testRecordId)", context), "group-safe_123");
  context.testTitle = "Safe\u202Egnp.exe";
  assert.equal(
    vm.runInContext("normalizeTitle(testTitle)", context),
    "Safegnp.exe",
    "bidirectional control characters must not survive in group labels"
  );
  context.testTitle = `${"😀".repeat(80)}X`;
  const truncatedTitle = vm.runInContext("normalizeTitle(testTitle)", context);
  assert.equal(Array.from(truncatedTitle).length, 80);
  assert.equal(truncatedTitle.endsWith("\ud83d"), false, "title truncation must not split emoji");

  const state = await send({ type: "getState", windowId: 1 });
  assert.equal(
    state.savedGroups[0].previewTabs[0].faviconUrl,
    "data:image/png;base64,LOCAL_FAVICON"
  );
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].tabs[0].faviconUrl,
    undefined,
    "favicons are transient UI metadata and must not bloat persistent group storage"
  );
}

async function testCrossDeviceSync() {
  const syncServer = {};
  const firstDevice = createMockBrowser({ syncStorage: syncServer });
  const first = startExtension(firstDevice);
  const firstState = await first.send({ type: "getState", windowId: 1 });
  assert.equal(firstState.savedGroups.length, 1);
  assert.equal(firstState.sync.pending, 0);
  assert.equal(firstState.sync.lastError, null);

  const savedId = firstState.savedGroups[0].id;
  const firstLocalGroup = firstDevice.storage.gruposNaBarraState.groups[0];
  const firstBookmark = firstDevice.bookmarkNodes.get(firstLocalGroup.bookmarkId);
  assert.equal(
    Object.keys(syncServer).some((key) => key.includes(encodeURIComponent(savedId))),
    true,
    "the first device must publish a per-group sync record"
  );

  const secondDevice = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const syncedBookmark = await secondDevice.browser.bookmarks.create({
    parentId: "toolbar_____",
    title: firstBookmark.title,
    url: firstBookmark.url
  });
  const second = startExtension(secondDevice);
  let secondState = await second.send({ type: "getState", windowId: 1 });
  assert.equal(secondState.savedGroups.length, 1, "a second device must import the saved group");
  assert.equal(secondState.savedGroups[0].id, savedId);
  assert.equal(secondState.savedGroups[0].open, false, "live tab IDs must remain device-local");
  assert.equal(secondState.savedGroups[0].pinned, true, "the synced bookmark must be adopted");
  assert.equal(
    secondDevice.storage.gruposNaBarraState.groups[0].bookmarkId,
    syncedBookmark.id,
    "bookmark IDs must be resolved locally instead of copied from another device"
  );

  const importedOpen = await second.send({ type: "openSavedGroup", savedId, windowId: 1 });
  assert.equal(importedOpen.opened, true);
  const importedLiveId = secondDevice.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.deepEqual(
    [...secondDevice.tabs.values()]
      .filter((tab) => tab.groupId === importedLiveId)
      .map((tab) => tab.pendingUrl || tab.url),
    ["https://example.com/a"],
    "a synchronized group must restore the original URL"
  );
  await second.send({ type: "closeSavedGroup", savedId });

  await second.send({
    type: "updateSavedGroup",
    savedId,
    title: "Sincronizado no Linux",
    color: "green",
    icon: "code"
  });
  await second.send({ type: "setGroupKeepAtTop", savedId, enabled: true });

  const thirdDevice = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const third = startExtension(thirdDevice);
  const thirdState = await third.send({ type: "getState", windowId: 1 });
  assert.equal(thirdState.savedGroups[0].title, "Sincronizado no Linux");
  assert.equal(thirdState.savedGroups[0].color, "green");
  assert.equal(thirdState.savedGroups[0].icon, "code");
  assert.equal(thirdState.savedGroups[0].keepAtTop, true);
  assert.equal(thirdState.savedGroups[0].tabCount, 1);

  await second.send({ type: "deleteSavedGroup", savedId });
  secondState = await second.send({ type: "getState", windowId: 1 });
  assert.equal(secondState.savedGroups.length, 0);

  const firstAfterRemoteDelete = await first.send({ type: "getState", windowId: 1 });
  assert.equal(firstAfterRemoteDelete.savedGroups.length, 0);
  assert.equal(
    firstAfterRemoteDelete.trashGroups.length,
    1,
    "a device that already had the group must keep a local 30-day recovery copy after a synced deletion"
  );
  assert.equal(
    firstAfterRemoteDelete.openGroups.some((group) => group.title === "Pesquisa" && !group.savedId),
    true,
    "a remote deletion must leave the native group open without auto-pinning it again"
  );

  const fourthDevice = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const staleBookmark = await fourthDevice.browser.bookmarks.create({
    parentId: "toolbar_____",
    title: firstBookmark.title,
    url: firstBookmark.url
  });
  const fourth = startExtension(fourthDevice);
  const fourthState = await fourth.send({ type: "getState", windowId: 1 });
  assert.equal(fourthState.savedGroups.length, 0, "a synced tombstone must prevent resurrection");
  assert.equal(
    fourthDevice.bookmarkNodes.has(staleBookmark.id),
    false,
    "only an explicit synced deletion may remove an otherwise unknown bookmark"
  );
}

async function testSyncQuotaFallback() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 4,
    groups: [
      {
        id: "large-local-group",
        title: "Grupo local muito grande",
        color: "blue",
        tabs: [
          {
            url: `https://example.com/?payload=${"x".repeat(110000)}`,
            title: "Conteúdo local"
          }
        ],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 1, "a quota failure must not delete the local group");
  assert.equal(state.sync.pending, 1);
  assert.match(state.sync.lastError, /espaço total|quantidade de itens/i);
  assert.equal(Object.keys(syncServer).length, 0);
}

async function testV17Migration() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const legacyBookmark = await mock.browser.bookmarks.create({
    parentId: "toolbar_____",
    title: "Legado\u2060\u{E0108}",
    url: "https://grupos-na-barra.invalid/toggle/legacy-group?v=1.6.0"
  });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 4,
    groups: [
      {
        id: "legacy-group",
        title: "Legado",
        color: "orange",
        tabs: [{ url: "https://legacy.example/", title: "Legado" }],
        skippedTabs: 0,
        bookmarkId: legacyBookmark.id,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 1);
  assert.equal(state.savedGroups[0].id, "legacy-group");
  assert.equal(state.savedGroups[0].pinned, true);
  assert.equal(state.savedGroups[0].icon, "none");
  assert.equal(state.savedGroups[0].keepAtTop, false);
  assert.equal(mock.storage.gruposNaBarraState.schemaVersion, 17);
  assert.equal(state.savedGroups[0].archived, false);
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].recoveryTabs.map((tab) => tab.url),
    ["https://legacy.example/"],
    "migration must create a local recovery copy without changing the group"
  );
  assert.ok(mock.storage.gruposNaBarraState.groups[0].syncRevision);
  assert.equal(
    [...mock.bookmarkNodes.values()].filter(
      (node) => typeof node.url === "string" && node.url.includes("/toggle/legacy-group")
    ).length,
    1,
    "migration must reuse the existing bookmark"
  );
  assert.equal(
    Object.keys(syncServer).some((key) => key.includes("legacy-group")),
    true,
    "migration must publish the existing group"
  );
}

async function testKeepAtTopOrderMigration() {
  const mock = createMockBrowser({ withInitialGroup: false });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 10,
    groups: [
      {
        id: "kept-later",
        title: "Depois",
        color: "blue",
        icon: "none",
        keepAtTop: true,
        archived: false,
        tabs: [{ url: "https://later.example/", title: "Depois" }],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 200,
        updatedAt: 200
      },
      {
        id: "kept-first",
        title: "Antes",
        color: "green",
        icon: "none",
        keepAtTop: true,
        archived: false,
        tabs: [{ url: "https://first.example/", title: "Antes" }],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 100
      }
    ],
    tombstones: [],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };
  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  const first = state.savedGroups.find((group) => group.id === "kept-first");
  const later = state.savedGroups.find((group) => group.id === "kept-later");
  assert.equal(first.keepAtTopOrder, 0);
  assert.equal(later.keepAtTopOrder, 1000);
}

async function testPendingNavigationPreservesUrls() {
  const urls = ["https://slow.example/one", "https://slow.example/two"];
  const mock = createMockBrowser({
    withInitialGroup: false,
    deferBackgroundNavigation: true
  });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 5,
    groups: [
      {
        id: "slow-group",
        title: "Sites lentos",
        color: "cyan",
        tabs: urls.map((url) => ({ url, title: url })),
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "openSavedGroup", savedId: "slow-group", windowId: 1 });

  let liveId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  let liveTabs = [...mock.tabs.values()]
    .filter((tab) => tab.groupId === liveId)
    .sort((left, right) => left.index - right.index);
  assert.equal(
    liveTabs.some((tab) => tab.url === "about:blank" && tab.pendingUrl),
    true,
    "the test must reproduce Firefox returning a tab before navigation commits"
  );

  await extension.send({ type: "syncNativeGroup", groupId: liveId });
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    urls,
    "a pending navigation must never overwrite the saved URLs with about:blank"
  );

  await extension.send({ type: "closeSavedGroup", savedId: "slow-group" });
  await extension.send({ type: "openSavedGroup", savedId: "slow-group", windowId: 1 });
  liveId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  liveTabs = [...mock.tabs.values()]
    .filter((tab) => tab.groupId === liveId)
    .sort((left, right) => left.index - right.index);
  assert.deepEqual(
    liveTabs.map((tab) => tab.pendingUrl || tab.url),
    urls,
    "closing and reopening repeatedly must still target the original URLs"
  );
}

async function testBlankLiveSnapshotCannotEraseRecovery() {
  const urls = ["https://safe.example/a", "https://safe.example/b"];
  const mock = createMockBrowser({ withInitialGroup: false });
  const blankTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "about:blank"
  });
  mock.groups.set(501, {
    id: 501,
    windowId: 1,
    title: "Protegido",
    color: "green",
    collapsed: false
  });
  Object.assign(mock.tabs.get(blankTab.id), {
    groupId: 501,
    status: "loading"
  });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 6,
    groups: [
      {
        id: "protected-group",
        title: "Protegido",
        color: "green",
        tabs: urls.map((url) => ({ url, title: url })),
        recoveryTabs: urls.map((url) => ({ url, title: url })),
        skippedTabs: 0,
        bookmarkId: null,
        live: { groupId: 501, windowId: 1 },
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    urls,
    "an all-blank live snapshot must not erase the last useful list"
  );

  await extension.send({ type: "closeSavedGroup", savedId: "protected-group" });
  await extension.send({ type: "openSavedGroup", savedId: "protected-group", windowId: 1 });
  const liveId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.deepEqual(
    [...mock.tabs.values()]
      .filter((tab) => tab.groupId === liveId)
      .sort((left, right) => left.index - right.index)
      .map((tab) => tab.url),
    urls,
    "the protected copy must restore real pages instead of empty tabs"
  );
}

async function testFailedTabCreationDoesNotDeleteUrl() {
  const urls = ["https://available.example/", "https://retry.example/"];
  const mock = createMockBrowser({
    withInitialGroup: false,
    failTabUrls: [urls[1]]
  });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 6,
    groups: [
      {
        id: "retry-group",
        title: "Tentar novamente",
        color: "orange",
        tabs: urls.map((url) => ({ url, title: url })),
        recoveryTabs: urls.map((url) => ({ url, title: url })),
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  const opened = await extension.send({
    type: "openSavedGroup",
    savedId: "retry-group",
    windowId: 1
  });
  assert.equal(opened.skippedTabs, 1);
  const liveId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  await extension.send({ type: "syncNativeGroup", groupId: liveId });
  await extension.send({ type: "closeSavedGroup", savedId: "retry-group" });
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    urls,
    "a temporary tabs.create failure must leave the URL available for another attempt"
  );

  mock.failedTabUrls.clear();
  await extension.send({ type: "openSavedGroup", savedId: "retry-group", windowId: 1 });
  const retriedLiveId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.deepEqual(
    [...mock.tabs.values()]
      .filter((tab) => tab.groupId === retriedLiveId)
      .sort((left, right) => left.index - right.index)
      .map((tab) => tab.url),
    urls,
    "a later successful attempt must restore every original URL"
  );
}

async function testIntentionalEmptySyncDoesNotResurrectRemovedUrl() {
  const syncServer = {};
  const firstDevice = createMockBrowser({ syncStorage: syncServer });
  const first = startExtension(firstDevice);
  const firstState = await first.send({ type: "getState", windowId: 1 });
  const savedId = firstState.savedGroups[0].id;

  const secondDevice = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const second = startExtension(secondDevice);
  await second.send({ type: "getState", windowId: 1 });
  assert.deepEqual(
    secondDevice.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    ["https://example.com/a"],
    "the second device must begin with the real URL"
  );

  await leaveOnlyOneRestorableGroupedTab(firstDevice, first);
  const removedTab = deepClone(firstDevice.tabs.get(1));
  await firstDevice.browser.tabs.remove(1);
  await firstDevice.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await firstDevice.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  firstDevice.addRecentlyClosedTab(removedTab);
  await firstDevice.browser.sessions.onChanged.emit();
  const firstLocal = firstDevice.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.equal(firstLocal.intentionallyEmpty, true);

  const changedKey = Object.keys(syncServer).find((key) => key.includes(encodeURIComponent(savedId)));
  assert.ok(changedKey);
  await secondDevice.browser.storage.onChanged.emit(
    { [changedKey]: { newValue: deepClone(syncServer[changedKey]) } },
    "sync"
  );
  await second.send({ type: "getState", windowId: 1 });

  const secondLocal = secondDevice.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.equal(secondLocal.intentionallyEmpty, true);
  assert.deepEqual(secondLocal.tabs.map((tab) => tab.url), ["about:blank"]);
  assert.deepEqual(secondLocal.recoveryTabs.map((tab) => tab.url), ["about:blank"]);

  const decoded = loadSyncStoreForTest().decode(syncServer);
  const remote = decoded.records.find((record) => record.type === "group" && record.id === savedId);
  assert.ok(remote);
  assert.equal(remote.intentionallyEmpty, true);
  assert.deepEqual(JSON.parse(JSON.stringify(remote.tabs)), [{ url: "about:blank" }]);
}

async function testRollingUpdateWithFrozenV300PeerDoesNotResurrectRemovedUrl() {
  const fixtureRoot = path.join(__dirname, "fixtures", "v3.0.0");
  const expectedFixtureHashes = {
    "background.js": "761d369307b97eaac09c44b298e55140934f165fa22c56737abd7f190130396f",
    "sync-store.js": "930555cf2ebd0c7e9feb988f42a1c4da3ed62391678c68fe781f8f1256f2f785",
    "ui-preferences.js": "f4d3e6b2cd9f1a7494afb1a03f31fc36d1f275d0b2c8bb2b56f51338c3665204",
    "translations-extra.js": "8c7caf0677602519b8d91478c10893d210db3810577afec0430d0f722a0bb08e",
    "manifest.json": "d1aa1f1e60541613d54d6426f613510bffd2f7ab1df98bdd8cc2ae59e10d0ea9"
  };
  for (const [name, expected] of Object.entries(expectedFixtureHashes)) {
    const actual = createHash("sha256").update(fs.readFileSync(path.join(fixtureRoot, name))).digest("hex");
    assert.equal(actual, expected, `frozen v3.0.0 fixture changed: ${name}`);
  }

  const syncServer = {};
  const currentMock = createMockBrowser({ syncStorage: syncServer, manifestVersion: "3.0.10" });
  const current = startExtension(currentMock);
  const currentState = await current.send({ type: "getState", windowId: 1 });
  const savedId = currentState.savedGroups[0].id;

  const oldMock = createMockBrowser({
    syncStorage: syncServer,
    withInitialGroup: false,
    manifestVersion: "3.0.0"
  });
  const old = startExtension(oldMock, { sourceRoot: fixtureRoot });
  await old.send({ type: "getState", windowId: 1 });
  assert.deepEqual(
    oldMock.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    ["https://example.com/a"],
    "the frozen v3.0.0 peer must begin with the real URL"
  );

  await leaveOnlyOneRestorableGroupedTab(currentMock, current);
  const removedTab = deepClone(currentMock.tabs.get(1));
  await currentMock.browser.tabs.remove(1);
  await currentMock.browser.tabs.onRemoved.emit(1, { windowId: 1, isWindowClosing: false });
  await currentMock.browser.tabGroups.onRemoved.emit(
    { id: 10, windowId: 1, title: "Pesquisa", color: "purple" },
    { isWindowClosing: false }
  );
  currentMock.addRecentlyClosedTab(removedTab);
  await currentMock.browser.sessions.onChanged.emit();

  const syncKey = Object.keys(syncServer).find((key) => key.includes(encodeURIComponent(savedId)));
  assert.ok(syncKey, "the current client must publish the intentional-empty record");
  assert.match(
    JSON.stringify(syncServer),
    /https:\/\/grupos-na-barra\.invalid\/empty\//,
    "the wire sentinel must be a v3.0.0-restorable HTTPS URL"
  );

  await oldMock.browser.storage.onChanged.emit(
    { [syncKey]: { newValue: deepClone(syncServer[syncKey]) } },
    "sync"
  );
  await old.send({ type: "getState", windowId: 1 });
  const oldLocal = oldMock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.ok(oldLocal);
  assert.equal(
    oldLocal.tabs.some((tab) => tab.url === "https://example.com/a"),
    false,
    "the real v3.0.0 normalization/recovery path must not resurrect the removed URL"
  );
  assert.match(oldLocal.tabs[0].url, /^https:\/\/grupos-na-barra\.invalid\/empty\//);

  // Force the frozen old client to make a legitimate local edit and republish
  // using its own real v3.0.0 encoder, which knows nothing about the boolean.
  await old.send({
    type: "updateSavedGroup",
    savedId,
    title: "Pesquisa no peer antigo",
    color: oldLocal.color,
    icon: oldLocal.icon
  });
  assert.equal(JSON.stringify(syncServer).includes("intentionallyEmpty"), false);

  const republishedKey = Object.keys(syncServer).find((key) => key.includes(encodeURIComponent(savedId)));
  await currentMock.browser.storage.onChanged.emit(
    { [republishedKey]: { newValue: deepClone(syncServer[republishedKey]) } },
    "sync"
  );
  await current.send({ type: "getState", windowId: 1 });
  const currentLocal = currentMock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.equal(currentLocal.intentionallyEmpty, true);
  assert.deepEqual(currentLocal.tabs.map((tab) => tab.url), ["about:blank"]);
  assert.equal(
    currentLocal.tabs.some((tab) => tab.url === "https://example.com/a"),
    false,
    "the removed URL must stay removed after a full v3.0.10 -> v3.0.0 -> v3.0.10 round trip"
  );
}

async function testDistinctIntentionalEmptyGroupsAreNotContentDeduplicated() {
  const mock = createMockBrowser({ withInitialGroup: false });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 15,
    groups: [
      {
        id: "empty-a",
        title: "Trabalho",
        color: "blue",
        icon: "none",
        tabs: [{ url: "about:blank", title: "about:blank" }],
        recoveryTabs: [{ url: "about:blank", title: "about:blank" }],
        intentionallyEmpty: true,
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      },
      {
        id: "empty-b",
        title: "Trabalho",
        color: "blue",
        icon: "none",
        tabs: [{ url: "about:blank", title: "about:blank" }],
        recoveryTabs: [{ url: "about:blank", title: "about:blank" }],
        intentionallyEmpty: true,
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 101,
        updatedAt: 201
      }
    ],
    tombstones: [],
    trash: [],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 2, "two independent empty groups must remain distinct");
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.map((group) => group.id).sort(),
    ["empty-a", "empty-b"]
  );
  assert.deepEqual(mock.storage.gruposNaBarraState.tombstones || [], []);
}

async function testDegradedRemoteCannotEraseGoodLocalGroup() {
  const syncServer = {};
  const remoteWriter = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  remoteWriter.storage.gruposNaBarraState = {
    schemaVersion: 6,
    groups: [
      {
        id: "sync-repair-group",
        title: "Reparo",
        color: "blue",
        tabs: [{ url: "about:blank", title: "Nova aba" }],
        recoveryTabs: [],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };
  const corruptExtension = startExtension(remoteWriter);
  await corruptExtension.send({ type: "getState", windowId: 1 });

  const urls = ["https://sync-safe.example/a", "https://sync-safe.example/b"];
  const goodDevice = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  goodDevice.storage.gruposNaBarraState = {
    schemaVersion: 6,
    groups: [
      {
        id: "sync-repair-group",
        title: "Reparo",
        color: "blue",
        tabs: urls.map((url) => ({ url, title: url })),
        recoveryTabs: urls.map((url) => ({ url, title: url })),
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 100
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };
  const repairingExtension = startExtension(goodDevice);
  await repairingExtension.send({ type: "getState", windowId: 1 });
  assert.deepEqual(
    goodDevice.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    urls,
    "a newer all-blank Sync record must not overwrite a useful local group"
  );

  const cleanReader = createMockBrowser({ syncStorage: syncServer, withInitialGroup: false });
  const cleanExtension = startExtension(cleanReader);
  await cleanExtension.send({ type: "getState", windowId: 1 });
  assert.deepEqual(
    cleanReader.storage.gruposNaBarraState.groups[0].tabs.map((tab) => tab.url),
    urls,
    "the good device must repair the degraded Firefox Sync record"
  );
}

async function testReopenedNativeGroupRepairsAlreadyBlankV18State() {
  const mock = createMockBrowser();
  mock.storage.gruposNaBarraState = {
    schemaVersion: 5,
    groups: [
      {
        id: "legacy-blank-group",
        title: "Pesquisa",
        color: "purple",
        tabs: [{ url: "about:blank", title: "Nova aba" }],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: 100,
        updatedAt: 200
      }
    ],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };

  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(
    state.savedGroups.length,
    2,
    "ambiguous legacy blank state must be preserved instead of adopting a native identity by content"
  );
  const legacy = state.savedGroups.find((group) => group.id === "legacy-blank-group");
  const native = state.savedGroups.find((group) => group.id !== "legacy-blank-group");
  assert.ok(legacy);
  assert.ok(native);
  assert.equal(legacy.open, false);
  assert.equal(native.open, true);
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.find((group) => group.id === "legacy-blank-group").tabs.map((tab) => tab.url),
    ["about:blank"],
    "the old ambiguous snapshot must not be overwritten by a different native entity"
  );
  assert.deepEqual(
    mock.storage.gruposNaBarraState.groups.find((group) => group.id === native.id).tabs.map((tab) => tab.url),
    ["https://example.com/a"]
  );
}

async function testContextMenuGroupsHighlightedTabs() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await new Promise((resolve) => setTimeout(resolve, 0));

  for (const candidate of mock.tabs.values()) {
    candidate.active = false;
    candidate.highlighted = false;
  }
  const clickedTab = mock.tabs.get(3);
  clickedTab.active = true;
  clickedTab.highlighted = true;

  const selectedTabIds = [clickedTab.id];
  for (let index = 0; index < 9; index += 1) {
    const created = await mock.browser.tabs.create({
      url: `https://selection.example/${index}`,
      active: false
    });
    mock.tabs.get(created.id).highlighted = true;
    selectedTabIds.push(created.id);
  }

  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-group-selected"] },
    deepClone(clickedTab)
  );
  assert.equal(
    mock.menuItems.get("grupos-na-barra-group-selected").title,
    "Adicionar 10 abas a um grupo"
  );
  assert.equal(
    mock.menuItems.get("grupos-na-barra-group-selected-existing:10").title,
    "Pesquisa",
    "open groups in the same window must be listed as destinations"
  );

  await mock.browser.menus.onClicked.emit(
    { menuItemId: "grupos-na-barra-group-selected-new" },
    deepClone(clickedTab)
  );
  const createdGroupId = mock.tabs.get(clickedTab.id).groupId;
  assert.notEqual(createdGroupId, -1);
  assert.deepEqual(
    selectedTabIds.map((tabId) => mock.tabs.get(tabId).groupId),
    Array(selectedTabIds.length).fill(createdGroupId),
    "all ten highlighted tabs must be placed in the same new native group"
  );
  assert.equal(mock.groups.get(createdGroupId).title, "Grupo 1");
  assert.equal(mock.groups.get(createdGroupId).color, "blue");
  const savedAfterCreation = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(
    savedAfterCreation.savedGroups.some(
      (group) => group.title === "Grupo 1" && group.tabCount === 10
    ),
    true,
    "a group created from the menu must enter the normal save flow"
  );

  for (const candidate of mock.tabs.values()) {
    candidate.highlighted = false;
  }
  const firstExtra = await mock.browser.tabs.create({
    url: "https://existing-target.example/a",
    active: false
  });
  const secondExtra = await mock.browser.tabs.create({
    url: "https://existing-target.example/b",
    active: false
  });
  mock.tabs.get(firstExtra.id).highlighted = true;
  mock.tabs.get(secondExtra.id).highlighted = true;

  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-group-selected"] },
    deepClone(mock.tabs.get(firstExtra.id))
  );
  await mock.browser.menus.onClicked.emit(
    { menuItemId: "grupos-na-barra-group-selected-existing:10" },
    deepClone(mock.tabs.get(firstExtra.id))
  );
  assert.equal(mock.tabs.get(firstExtra.id).groupId, 10);
  assert.equal(mock.tabs.get(secondExtra.id).groupId, 10);

  for (const candidate of mock.tabs.values()) {
    candidate.highlighted = false;
  }
  const regularTab = await mock.browser.tabs.create({
    url: "https://pinned-safety.example/regular",
    active: false
  });
  const pinnedTab = await mock.browser.tabs.create({
    url: "https://pinned-safety.example/pinned",
    active: false,
    pinned: true
  });
  mock.tabs.get(regularTab.id).highlighted = true;
  mock.tabs.get(pinnedTab.id).highlighted = true;

  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-group-selected"] },
    deepClone(mock.tabs.get(regularTab.id))
  );
  assert.match(
    mock.menuItems.get("grupos-na-barra-group-selected").title,
    /Adicionar 1 de 2 abas.*fixadas ficam fora/
  );
  await mock.browser.menus.onClicked.emit(
    { menuItemId: "grupos-na-barra-group-selected-new" },
    deepClone(mock.tabs.get(regularTab.id))
  );
  assert.notEqual(mock.tabs.get(regularTab.id).groupId, -1);
  assert.equal(mock.tabs.get(pinnedTab.id).groupId, -1);
  assert.equal(mock.tabs.get(pinnedTab.id).pinned, true, "pinned tabs must never be unpinned silently");

  for (const candidate of mock.tabs.values()) {
    candidate.highlighted = false;
  }
  const unrelatedSelected = await mock.browser.tabs.create({
    url: "https://selection.example/other",
    active: false
  });
  const unselectedClicked = await mock.browser.tabs.create({
    url: "https://selection.example/clicked",
    active: false
  });
  mock.tabs.get(unrelatedSelected.id).highlighted = true;

  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-group-selected"] },
    deepClone(mock.tabs.get(unselectedClicked.id))
  );
  assert.equal(
    mock.menuItems.get("grupos-na-barra-group-selected").title,
    "Adicionar esta aba a um grupo"
  );
  await mock.browser.menus.onClicked.emit(
    { menuItemId: "grupos-na-barra-group-selected-new" },
    deepClone(mock.tabs.get(unselectedClicked.id))
  );
  assert.notEqual(mock.tabs.get(unselectedClicked.id).groupId, -1);
  assert.equal(
    mock.tabs.get(unrelatedSelected.id).groupId,
    -1,
    "right-clicking an unselected tab must not act on a different highlighted selection"
  );
}

async function testModifyGroupMenuOpensEditor() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const groupedTab = deepClone(mock.tabs.get(1));
  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-modify-group"] },
    groupedTab
  );
  const menu = mock.menuItems.get("grupos-na-barra-modify-group");
  assert.equal(menu.visible, true);
  assert.equal(menu.title, "Modificar grupo…");

  await mock.browser.menus.onClicked.emit(
    { menuItemId: "grupos-na-barra-modify-group" },
    groupedTab
  );
  assert.equal(mock.metrics.popupOpenCalls, 1, "the native menu must open the extension popup");
  const pending = await extension.send({ type: "consumePendingGroupEditor" });
  assert.equal(pending.savedId, state.savedGroups[0].id);
  assert.equal(
    await extension.send({ type: "consumePendingGroupEditor" }),
    null,
    "the editor request must be consumed only once"
  );

  await mock.browser.menus.onShown.emit(
    { contexts: ["tab"], menuIds: ["grupos-na-barra-modify-group"] },
    deepClone(mock.tabs.get(3))
  );
  assert.equal(menu.visible, false, "the editor action must stay hidden on ungrouped tabs");
}

async function testAutomaticBackupAndJsonExport() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await extension.send({
    type: "updateSavedGroup",
    savedId,
    title: "Estado alterado",
    color: "green",
    icon: "star"
  });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.sync.backupAvailable, true);
  assert.equal(state.sync.backupGroupCount, 1);
  assert.ok(state.sync.usedBytes > 0);
  assert.ok(state.sync.usagePercent > 0 && state.sync.usagePercent <= 100);
  const backupBeforeRestore = loadSyncStoreForTest().decodeBackup(syncServer);
  assert.equal(backupBeforeRestore.groups[0].title, "Pesquisa");

  const exported = await extension.send({ type: "exportExtensionData" });
  assert.equal(exported.format, "grupos-na-barra-backup");
  assert.equal(exported.extensionVersion, "3.0.10");
  assert.equal(exported.groups.length, 1);
  assert.equal(exported.groups[0].title, "Estado alterado");
  assert.equal(exported.groups[0].icon, "star");
  assert.equal(exported.groups[0].shortcutPinned, true);
  assert.equal(Object.hasOwn(exported.groups[0], "bookmarkId"), false);
  assert.equal(Object.hasOwn(exported.groups[0], "live"), false);

  const restored = await extension.send({ type: "restoreAutomaticBackup" });
  assert.equal(restored.restoredGroups, 1);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].title, "Pesquisa");
  assert.equal(state.savedGroups[0].color, "purple");
  assert.equal(state.savedGroups[0].icon, "none");
}

async function testContainerTabsSurviveRestore() {
  const cookieStoreId = "firefox-container-7";
  const mock = createMockBrowser();
  mock.tabs.get(1).cookieStoreId = cookieStoreId;
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;
  await extension.send({ type: "closeSavedGroup", savedId });

  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].tabs[0].cookieStoreId,
    cookieStoreId,
    "the local snapshot must remember the Firefox container"
  );
  const restored = await extension.send({ type: "openSavedGroup", savedId, windowId: 1 });
  assert.equal(restored.containerFallbackTabs, 0);
  const restoredGroupId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.equal(
    [...mock.tabs.values()].find((tab) => tab.groupId === restoredGroupId).cookieStoreId,
    cookieStoreId,
    "the restored tab must reopen in the same container"
  );

  const fallbackMock = createMockBrowser({ failCookieStoreIds: [cookieStoreId] });
  fallbackMock.tabs.get(1).cookieStoreId = cookieStoreId;
  const fallbackExtension = startExtension(fallbackMock);
  const fallbackInitial = await fallbackExtension.send({ type: "getState", windowId: 1 });
  const fallbackSavedId = fallbackInitial.savedGroups[0].id;
  await fallbackExtension.send({ type: "closeSavedGroup", savedId: fallbackSavedId });
  const fallback = await fallbackExtension.send({
    type: "openSavedGroup",
    savedId: fallbackSavedId,
    windowId: 1
  });
  assert.equal(fallback.opened, true, "a missing container must not drop the page");
  assert.equal(fallback.containerFallbackTabs, 1);
  const fallbackGroupId = fallbackMock.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.equal(
    [...fallbackMock.tabs.values()].find((tab) => tab.groupId === fallbackGroupId).cookieStoreId,
    "firefox-default"
  );
}

async function testKeepAtTopAndLastPinnedTab() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  const pinnedTab = await mock.browser.tabs.create({
    url: "https://pinned.example/",
    active: false,
    pinned: true
  });
  await mock.browser.tabs.move(pinnedTab.id, { index: 0 });
  await mock.browser.tabGroups.move(10, { index: 3 });
  assert.ok(
    Math.min(...[...mock.tabs.values()].filter((tab) => tab.groupId === 10).map((tab) => tab.index)) > 1,
    "the setup must move the group away from the beginning"
  );

  mock.metrics.failGroupMove = true;
  await extension.send({ type: "setGroupKeepAtTop", savedId, enabled: true });
  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].keepAtTop, true);
  assert.equal(
    Math.min(...[...mock.tabs.values()].filter((tab) => tab.groupId === 10).map((tab) => tab.index)),
    1,
    "a kept group must start immediately after real pinned tabs"
  );
  assert.equal(mock.tabs.get(pinnedTab.id).pinned, true);

  const firstGroupTab = [...mock.tabs.values()].find((tab) => tab.groupId === 10);
  await mock.browser.tabs.update(firstGroupTab.id, { pinned: true });
  await extension.send({ type: "syncNativeGroup", groupId: 10 });

  const lastGroupTab = [...mock.tabs.values()].find((tab) => tab.groupId === 10);
  assert.ok(lastGroupTab, "one grouped tab must remain before the final pin");
  await mock.browser.tabs.update(lastGroupTab.id, { pinned: true });
  await mock.browser.tabGroups.onRemoved.emit({ id: 10, windowId: 1 });

  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false, "pinning the final tab must close the live group state");
  assert.equal(state.savedGroups[0].keepAtTop, true, "the preference must survive while closed");
  assert.equal(state.savedGroups[0].tabCount, 1, "the last valid group snapshot must be preserved");
  assert.equal(mock.groups.has(10), false, "the empty native group must not remain as a ghost");
  assert.equal(mock.tabs.get(lastGroupTab.id).pinned, true, "the extension must not undo the user's pin");
}

async function testArchiveWorkflow() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await extension.send({ type: "setGroupKeepAtTop", savedId, enabled: true });
  await extension.send({ type: "setGroupArchived", savedId, archived: true });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].archived, true);
  assert.equal(state.savedGroups[0].open, false, "archiving must save and close the live group");
  assert.equal(state.savedGroups[0].pinned, false, "archiving must remove its toolbar shortcut");
  assert.equal(state.savedGroups[0].keepAtTop, false, "archived groups cannot reserve tab-strip order");
  assert.equal(state.savedGroups[0].tabCount, 1, "archiving must preserve the last restorable snapshot");

  await extension.send({ type: "openSavedGroup", savedId, windowId: 1 });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].archived, false, "opening an archived group must restore it automatically");
  assert.equal(state.savedGroups[0].open, true);
}

async function testTrashWorkflow() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await extension.send({ type: "deleteSavedGroup", savedId });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 0);
  assert.equal(state.trashGroups.length, 1, "a deleted group must remain recoverable locally");
  assert.equal(state.trashGroups[0].id, savedId);
  assert.ok(state.trashGroups[0].expiresAt > state.trashGroups[0].deletedAt);
  assert.equal(
    state.openGroups.some((group) => group.title === "Pesquisa" && !group.savedId),
    true,
    "deleting an open group must not close Firefox tabs"
  );

  await extension.send({ type: "restoreTrashGroup", savedId });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.trashGroups.length, 0);
  assert.equal(state.savedGroups.length, 1);
  assert.equal(state.savedGroups[0].id, savedId);
  assert.equal(state.savedGroups[0].open, true, "restore must reconnect the still-open native group");
  assert.equal(state.savedGroups[0].pinned, true, "restore must recreate the shortcut when it existed");

  await extension.send({ type: "closeSavedGroup", savedId });
  await extension.send({ type: "deleteSavedGroup", savedId });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.trashGroups.length, 1);
  await extension.send({ type: "deleteTrashGroupPermanently", savedId });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.trashGroups.length, 0, "permanent deletion must remove the recoverable copy");

  const syncedTombstone = Object.values(mock.storage.gruposNaBarraState.tombstones || []).find(
    (item) => item.id === savedId
  );
  assert.ok(syncedTombstone, "the tiny sync tombstone must remain after permanent trash deletion");
}

async function testRestoreBeatsFutureTombstone() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await extension.send({ type: "deleteSavedGroup", savedId });
  const future = Date.now() + 24 * 60 * 60 * 1000;
  extension.context.testFutureDeletion = future;
  vm.runInContext(
    "stateCache.trash[0].deletedAt = testFutureDeletion; " +
      "stateCache.tombstones[0].syncUpdatedAt = testFutureDeletion;",
    extension.context
  );

  await extension.send({ type: "restoreTrashGroup", savedId });
  const local = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.ok(local.syncUpdatedAt > future, "a restore must be newer than the deletion it reverses");

  const decoded = loadSyncStoreForTest().decode(syncServer);
  const remote = decoded.records.find((record) => record.id === savedId);
  assert.equal(remote?.type, "group");
  assert.ok(remote.updatedAt > future);
}

async function testExpiredTrashIsPurged() {
  const mock = createMockBrowser({ withInitialGroup: false });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 12,
    groups: [],
    trash: [
      {
        id: "expired-group",
        title: "Expirado",
        color: "grey",
        icon: "none",
        tabs: [{ url: "https://expired.example/", title: "Expirado" }],
        skippedTabs: 0,
        bookmarkWasPinned: false,
        live: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: 1,
        expiresAt: Date.now() - 1
      }
    ],
    tombstones: [],
    diagnostics: [],
    suppressedNativeGroups: [],
    settings: { autoPinNewGroups: true }
  };
  const extension = startExtension(mock);
  const state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.trashGroups.length, 0, "trash entries must disappear after 30-day expiry");
  assert.equal(mock.storage.gruposNaBarraState.trash.length, 0);
}

async function testBulkArchiveAndTrashWorkflow() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const savedId = state.savedGroups[0].id;

  await extension.send({ type: "closeSavedGroup", savedId });
  let result = await extension.send({ type: "archiveAllClosedGroups" });
  assert.equal(result.changed, 1);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].archived, true);
  assert.equal(state.savedGroups[0].pinned, false);

  result = await extension.send({ type: "unarchiveAllGroups" });
  assert.equal(result.changed, 1);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].archived, false);

  await extension.send({ type: "setGroupArchived", savedId, archived: true });
  result = await extension.send({ type: "trashAllArchived" });
  assert.equal(result.deleted, 1);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 0);
  assert.equal(state.trashGroups.length, 1);

  result = await extension.send({ type: "emptyTrash" });
  assert.equal(result.deleted, 1);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.trashGroups.length, 0);
}

async function testKeepAtTopOrdering() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  const firstId = state.savedGroups[0].id;

  const secondTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://second.example/"
  });
  mock.groups.set(30, {
    id: 30,
    windowId: 1,
    title: "Segundo",
    color: "blue",
    collapsed: false
  });
  mock.tabs.get(secondTab.id).groupId = 30;
  await extension.send({ type: "syncNativeGroup", groupId: 30 });
  state = await extension.send({ type: "getState", windowId: 1 });
  const secondId = state.savedGroups.find((group) => group.title === "Segundo").id;

  await extension.send({ type: "setGroupKeepAtTop", savedId: firstId, enabled: true });
  await extension.send({ type: "setGroupKeepAtTop", savedId: secondId, enabled: true });
  state = await extension.send({ type: "getState", windowId: 1 });
  const first = state.savedGroups.find((group) => group.id === firstId);
  const second = state.savedGroups.find((group) => group.id === secondId);
  assert.ok(first.keepAtTopOrder < second.keepAtTopOrder, "the second pin must append after the first");

  await extension.send({ type: "moveKeptGroup", savedId: secondId, direction: -1 });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.ok(
    state.savedGroups.find((group) => group.id === secondId).keepAtTopOrder <
      state.savedGroups.find((group) => group.id === firstId).keepAtTopOrder,
    "keyboard ordering must be persisted"
  );
  assert.ok(
    Math.min(...[...mock.tabs.values()].filter((tab) => tab.groupId === 30).map((tab) => tab.index)) <
      Math.min(...[...mock.tabs.values()].filter((tab) => tab.groupId === 10).map((tab) => tab.index)),
    "the persisted order must also be reflected in the Firefox tab strip"
  );

  const store = loadSyncStoreForTest();
  const localFirst = mock.storage.gruposNaBarraState.groups.find((group) => group.id === firstId);
  const oldClientItems = store.encodeGroup(
    {
      id: localFirst.id,
      title: localFirst.title,
      color: localFirst.color,
      icon: "star",
      keepAtTop: true,
      archived: false,
      tabs: localFirst.tabs,
      skippedTabs: localFirst.skippedTabs,
      createdAt: localFirst.createdAt
    },
    {
      updatedAt: Date.now() + 60_000,
      revision: `${(Date.now() + 60_000).toString(36)}:old-client`
    }
  );
  for (const key of store.keysForId(syncServer, firstId)) delete syncServer[key];
  Object.assign(syncServer, oldClientItems);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.find((group) => group.id === firstId).icon, "star");
  assert.ok(
    state.savedGroups.find((group) => group.id === secondId).keepAtTopOrder <
      state.savedGroups.find((group) => group.id === firstId).keepAtTopOrder,
    "an old client without keepAtTopOrder must not undo the v2.7 ordering"
  );

  await extension.send({
    type: "reorderKeptGroup",
    savedId: secondId,
    targetId: firstId,
    position: "after"
  });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.ok(
    state.savedGroups.find((group) => group.id === firstId).keepAtTopOrder <
      state.savedGroups.find((group) => group.id === secondId).keepAtTopOrder,
    "drag ordering must support placing a group after another group"
  );
}

async function testDiagnosticsWorkflow() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });

  const invalid = await extension.route({ type: "notACommand" }, {});
  assert.equal(invalid.ok, false);

  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.diagnostics.count, 1);
  assert.equal(state.diagnostics.unreadCount, 1);
  assert.equal(mock.metrics.badgeText, "!", "an unread background error must mark the extension icon");

  const report = await extension.send({ type: "getDiagnosticReport" });
  assert.equal(report.extension.version, "3.0.10");
  assert.equal(report.errors.length, 1);
  assert.equal(report.privacy.includesUrls, false);
  assert.equal(report.privacy.includesTabTitles, false);
  assert.equal(report.privacy.includesGroupTitles, false);
  assert.equal(report.privacy.includesBookmarks, false);
  assert.equal(report.privacy.includesHistory, false);
  const reportText = JSON.stringify(report);
  assert.equal(reportText.includes("https://example.com/a"), false);
  assert.equal(reportText.includes("Página A"), false);
  assert.equal(reportText.includes("Pesquisa"), false);

  await extension.send({ type: "markDiagnosticsSeen" });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.diagnostics.unreadCount, 0);
  assert.equal(mock.metrics.badgeText, "");

  await extension.send({ type: "clearDiagnostics" });
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.diagnostics.count, 0);
}

async function testMissingRemoteRecordIsRepaired() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 1);
  assert.ok(Object.keys(syncServer).some((key) => key.includes(state.savedGroups[0].id)));

  for (const key of Object.keys(syncServer)) {
    delete syncServer[key];
  }
  vm.runInContext("stateCache.sync.lastAttemptAt = null", extension.context);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.sync.pending, 0);
  assert.ok(
    Object.keys(syncServer).some((key) => key.includes(state.savedGroups[0].id)),
    "a locally preserved group must repopulate a missing remote record"
  );
}

async function testPendingSyncRetryWithoutUnrelatedMutation() {
  const mock = createMockBrowser({ failSyncSetAttempts: 1 });
  const extension = startExtension(mock);

  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.ok(state.sync.pending > 0, "a failed sync write must stay pending locally");
  const callsAfterFailure = mock.metrics.syncSetCalls;

  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(
    mock.metrics.syncSetCalls,
    callsAfterFailure,
    "the popup must respect the retry backoff instead of hammering storage.sync"
  );

  vm.runInContext("stateCache.sync.lastAttemptAt = Date.now() - SYNC_RETRY_INTERVAL_MS - 1", extension.context);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.sync.pending, 0, "an expired backoff must retry without another user mutation");
  assert.ok(mock.metrics.syncSetCalls > callsAfterFailure);
}

async function testDiagnosticSanitization() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  extension.context.testDiagnosticError = {
    name: "Error",
    message: "sensitive",
    stack: [
      "Error: sensitive https://secret.example/private",
      "    at file:///Users/Tiago Coelho/Developer/private/project.js:4:2",
      "    at C:\\Users\\Tiago Coelho\\Documents\\private.js:8:1",
      "    at D:\\Private Projects\\confidential\\module.js:7:2",
      "    at /home/tiago coelho/private/module.js:9:3",
      "    at /opt/private projects/module.js:10:4",
      "    at moz-extension://unit-test/background.js:10:5"
    ].join("\n")
  };
  const sanitized = vm.runInContext("safeDiagnosticStack(testDiagnosticError)", extension.context);
  assert.equal(sanitized.includes("secret.example"), false);
  assert.equal(sanitized.includes("Tiago Coelho"), false);
  assert.equal(sanitized.includes("C:\\Users"), false);
  assert.equal(sanitized.includes("D:\\Private Projects"), false);
  assert.equal(sanitized.includes("/home/tiago coelho"), false);
  assert.equal(sanitized.includes("/opt/private projects"), false);
  assert.equal(sanitized.includes("unit-test"), false);
  assert.match(sanitized, /\[local-path\]/);
  assert.equal(vm.runInContext("safeIsoTimestamp(Number.POSITIVE_INFINITY)", extension.context), null);
  assert.equal(vm.runInContext("safeIsoTimestamp(1e300)", extension.context), null);
}

async function testOldRemoteTombstoneGetsFreshLocalTrashWindow() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;
  const now = Date.now();
  const localAge = 60 * 24 * 60 * 60 * 1000;
  const remoteAge = 45 * 24 * 60 * 60 * 1000;

  extension.context.testLocalVersion = now - localAge;
  vm.runInContext(
    "stateCache.groups[0].updatedAt = testLocalVersion;" +
      "stateCache.groups[0].syncUpdatedAt = testLocalVersion;" +
      "stateCache.groups[0].syncRevision = 'old-local';" +
      "stateCache.groups[0].syncFingerprint = SyncStore.groupFingerprint(stateCache.groups[0]);" +
      "stateCache.groups[0].syncPending = false;",
    extension.context
  );

  for (const key of Object.keys(syncServer)) delete syncServer[key];
  Object.assign(
    syncServer,
    loadSyncStoreForTest().encodeTombstone({
      id: savedId,
      revision: "old-remote-delete",
      updatedAt: now - remoteAge,
      deletedAt: now - remoteAge
    })
  );

  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.id === savedId), false);
  const trash = state.trashGroups.find((group) => group.id === savedId);
  assert.ok(trash, "an old remote deletion must still leave a local safety copy");
  assert.ok(trash.deletedAt < now - 44 * 24 * 60 * 60 * 1000, "original deletion date stays intact");
  assert.ok(
    trash.expiresAt > Date.now() + 29 * 24 * 60 * 60 * 1000,
    "the receiving device gets a fresh 30-day local recovery window"
  );

  const restored = await extension.send({ type: "restoreTrashGroup", savedId });
  assert.equal(restored.replacedDeletedIdentity, true);
  assert.notEqual(restored.savedId, savedId);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.id === restored.savedId), true);
  assert.equal(state.savedGroups.some((group) => group.id === savedId), false);
  assert.equal(
    mock.storage.gruposNaBarraState.tombstones.some((item) => item.id === savedId),
    true,
    "recovering a remote deletion must not erase the old deletion barrier"
  );
}

async function testDeferredRemoteVersionDoesNotLeaveInvalidPendingGroup() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  vm.runInContext(
    "stateCache.groups[0].syncRevision = null;" +
      "stateCache.groups[0].syncFingerprint = null;" +
      "stateCache.groups[0].syncUpdatedAt = Date.now() - 1000;" +
      "stateCache.groups[0].syncPending = true;" +
      "deferredSyncVersions.set(stateCache.groups[0].id, {updatedAt: Date.now(), revision: 'deferred'});" +
      "preparePendingSyncUnlocked(stateCache);",
    extension.context
  );
  const pending = vm.runInContext("stateCache.groups[0].syncPending", extension.context);
  const revision = vm.runInContext("stateCache.groups[0].syncRevision", extension.context);
  assert.equal(pending, false);
  assert.equal(revision, null, "deferred sync must not fabricate an invalid revision");
}

async function testRemoteArchiveCannotCloseLocallyOpenGroup() {
  const syncServer = {};
  const mock = createMockBrowser({ syncStorage: syncServer });
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;
  const local = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  const remoteVersion = Math.max(Date.now(), local.syncUpdatedAt + 1);
  const remoteArchived = { ...deepClone(local), archived: true, keepAtTop: false, keepAtTopOrder: null };

  for (const key of Object.keys(syncServer)) delete syncServer[key];
  Object.assign(
    syncServer,
    loadSyncStoreForTest().encodeGroup(remoteArchived, {
      updatedAt: remoteVersion,
      revision: "remote-archive"
    })
  );

  const beforeTabs = [...mock.tabs.values()].filter((tab) => tab.groupId === 10).length;
  const state = await extension.send({ type: "getState", windowId: 1 });
  const saved = state.savedGroups.find((group) => group.id === savedId);
  assert.equal(saved.archived, false, "local active use must veto a remote archive");
  assert.equal(saved.open, true);
  assert.equal([...mock.tabs.values()].filter((tab) => tab.groupId === 10).length, beforeTabs);

  const remote = loadSyncStoreForTest().decode(syncServer).records.find((record) => record.id === savedId);
  assert.equal(remote?.type, "group");
  assert.equal(remote?.archived, false, "the local active state must repair Sync with a newer revision");
}

async function testTransientMissingNativeGroupDoesNotDetachLiveLink() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;
  const native = deepClone(mock.groups.get(10));

  mock.groups.delete(10);
  await extension.send({ type: "getState", windowId: 1 });
  let stored = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.deepEqual(stored.live, { groupId: 10, windowId: 1 });
  assert.ok(Number.isFinite(stored.liveMissingSince), "first miss must start a grace period only");

  mock.groups.set(10, native);
  const recovered = await extension.send({ type: "getState", windowId: 1 });
  stored = mock.storage.gruposNaBarraState.groups.find((group) => group.id === savedId);
  assert.deepEqual(stored.live, { groupId: 10, windowId: 1 });
  assert.equal(stored.liveMissingSince, null);
  assert.equal(recovered.savedGroups.length, 1, "a transient event-page wake must not create a duplicate group");
}

async function testLifecycleObservationStartSurvivesEventPageWake() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const key = "gruposNaBarraLifecycleSessionStartedAt";
  const sessionStart = mock.extensionSessionStorage[key];
  assert.ok(Number.isFinite(sessionStart));

  vm.runInContext("tabLifecycleObservationStartedAt = Date.now() + 5000", extension.context);
  await vm.runInContext("restoreLifecycleObservationStartFromSession()", extension.context);
  assert.equal(
    vm.runInContext("tabLifecycleObservationStartedAt", extension.context),
    sessionStart,
    "storage.session must restore the browser-session observation boundary after a wake"
  );
}

async function testInternalEmptySentinelCannotBecomeRestoredTab() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  extension.context.testEmptySentinel = "https://grupos-na-barra.invalid/empty/group-123";
  assert.equal(
    vm.runInContext("normalizeRestorableUrl(testEmptySentinel)", extension.context),
    undefined
  );
  assert.equal(
    vm.runInContext("isManagedBookmarkUrl(testEmptySentinel)", extension.context),
    false,
    "the Sync sentinel must not be mistaken for a managed bookmark"
  );
}

async function testMessageRouterRejectsExplicitForeignSender() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const response = await extension.route(
    { type: "getState", windowId: 1 },
    { id: "foreign-extension", url: "moz-extension://foreign/popup.html" }
  );
  assert.equal(response.ok, false);
  assert.match(response.error, /não autorizado/i);
}

async function testKeepAtTopRefusalIsRateLimited() {
  const mock = createMockBrowser();
  const extension = startExtension(mock);
  const initial = await extension.send({ type: "getState", windowId: 1 });
  const savedId = initial.savedGroups[0].id;

  const pinned = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    pinned: true,
    url: "https://pinned.example/"
  });
  await mock.browser.tabs.move(pinned.id, { index: 0 });
  await mock.browser.tabGroups.move(10, { index: 3 });
  mock.metrics.failGroupMove = true;
  mock.metrics.clampTabsMove = true;

  await extension.send({ type: "setGroupKeepAtTop", savedId, enabled: true });
  const afterFailure = mock.metrics.tabsMoveCalls;
  assert.ok(afterFailure > 0);
  await extension.send({ type: "getState", windowId: 1 });
  await extension.send({ type: "getState", windowId: 1 });
  assert.equal(
    mock.metrics.tabsMoveCalls,
    afterFailure,
    "the same refused layout must not trigger move→onMoved→move repeatedly"
  );
}

async function testFuturePoisonedLocalVersionIsSanitizedOnLoad() {
  const mock = createMockBrowser({ withInitialGroup: false });
  const now = Date.now();
  mock.storage.gruposNaBarraState = {
    schemaVersion: 15,
    settings: { autoPinNewGroups: false },
    sync: {},
    groups: [
      {
        id: "future-local",
        title: "Future",
        color: "blue",
        icon: "none",
        tabs: [{ url: "https://example.com/" }],
        recoveryTabs: [{ url: "https://example.com/" }],
        createdAt: now,
        updatedAt: now + 365 * 24 * 60 * 60 * 1000,
        syncUpdatedAt: now + 365 * 24 * 60 * 60 * 1000,
        syncRevision: "2099:poison",
        syncFingerprint: "poison",
        syncPending: false
      }
    ],
    trash: [],
    tombstones: [],
    diagnostics: [],
    suppressedNativeGroups: []
  };
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });
  const stored = mock.storage.gruposNaBarraState.groups[0];
  assert.ok(stored.updatedAt <= Date.now() + 1000);
  assert.ok(stored.syncUpdatedAt <= Date.now() + 1000);
  assert.notEqual(stored.syncRevision, "2099:poison");
}

function archivedTestId(index) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function oldTombstoneSyncItems(count, deletedAt = Date.now() - 40 * 24 * 60 * 60 * 1000) {
  const store = loadSyncStoreForTest();
  const items = {};
  for (let index = 1; index <= count; index += 1) {
    const id = archivedTestId(index);
    Object.assign(
      items,
      store.encodeTombstone({
        id,
        deletedAt,
        updatedAt: deletedAt,
        revision: `${deletedAt.toString(36)}:old:${index}`
      })
    );
  }
  return items;
}

async function testOldTombstonesAreArchivedBeforeV1Removal() {
  const syncStorage = oldTombstoneSyncItems(270);
  const mock = createMockBrowser({ syncStorage, withInitialGroup: false });
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });

  const store = loadSyncStoreForTest();
  const archiveKeys = store.tombstoneArchiveKeys(syncStorage);
  assert.ok(archiveKeys.length > 0, "quota pressure should publish compact v2 deletion markers");
  assert.equal(
    store.individualTombstones(syncStorage).length,
    270,
    "v1 tombstones must remain during the propagation grace window"
  );
  const archive = store.decodeTombstoneArchive(syncStorage);
  assert.equal(archive.idCount, 270);
  assert.equal(
    mock.storage.gruposNaBarraState.tombstones.every((item) => item.syncArchived === true),
    true,
    "local state must remember that these deletions are protected by the compact archive"
  );
}

async function testMatureArchiveRemovesRedundantV1Tombstones() {
  const now = Date.now();
  const deletedAt = now - 50 * 24 * 60 * 60 * 1000;
  const syncStorage = oldTombstoneSyncItems(270, deletedAt);
  const store = loadSyncStoreForTest();
  Object.assign(
    syncStorage,
    store.encodeTombstoneArchive(
      Array.from({ length: 270 }, (_, index) => archivedTestId(index + 1)),
      now - 8 * 24 * 60 * 60 * 1000
    )
  );

  const mock = createMockBrowser({ syncStorage, withInitialGroup: false });
  const extension = startExtension(mock);
  await extension.send({ type: "getState", windowId: 1 });

  assert.equal(
    store.individualTombstones(syncStorage).length,
    0,
    "after a full propagation grace period, redundant v1 tombstones should be removed"
  );
  assert.ok(store.tombstoneArchiveKeys(syncStorage).length > 0);
  assert.equal(store.decodeTombstoneArchive(syncStorage).idCount, 270);
}

async function testArchivedDeletionBlocksOldPeerResurrectionAndRestoresAsNewIdentity() {
  const now = Date.now();
  const deletedId = archivedTestId(999);
  const store = loadSyncStoreForTest();
  const archivedItems = store.encodeTombstoneArchive([deletedId], now - 8 * 24 * 60 * 60 * 1000);
  const staleGroupItems = store.encodeGroup(
    {
      id: deletedId,
      title: "Peer antigo",
      color: "blue",
      icon: "none",
      tabs: [{ url: "https://stale.example/" }],
      createdAt: now - 1000
    },
    { updatedAt: now + 1000, revision: `${(now + 1000).toString(36)}:old-peer` }
  );
  const syncStorage = { ...staleGroupItems, ...archivedItems };

  const mock = createMockBrowser({ syncStorage, withInitialGroup: false });
  mock.storage.gruposNaBarraState = {
    schemaVersion: 16,
    settings: { autoPinNewGroups: false },
    sync: {},
    groups: [
      {
        id: deletedId,
        title: "Cópia local antiga",
        color: "blue",
        icon: "none",
        tabs: [{ url: "https://stale.example/" }],
        recoveryTabs: [{ url: "https://stale.example/" }],
        skippedTabs: 0,
        bookmarkId: null,
        live: null,
        createdAt: now - 5000,
        updatedAt: now - 4000,
        syncRevision: "local-old",
        syncUpdatedAt: now - 4000,
        syncFingerprint: null,
        syncPending: false
      }
    ],
    trash: [],
    tombstones: [],
    diagnostics: [],
    suppressedNativeGroups: []
  };

  const extension = startExtension(mock);
  let state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.id === deletedId), false);
  assert.equal(state.trashGroups.some((group) => group.id === deletedId), true);

  const result = await extension.send({ type: "restoreTrashGroup", savedId: deletedId });
  assert.equal(result.replacedDeletedIdentity, true);
  assert.notEqual(result.savedId, deletedId);
  state = await extension.send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.id === result.savedId), true);
  assert.equal(state.savedGroups.some((group) => group.id === deletedId), false);
  assert.equal(store.decodeTombstoneArchive(syncStorage).ids.includes(deletedId), true);
}


async function testClosedEntityIsNotAdoptedByMatchingNewNativeGroup() {
  async function exercise({ autoPin }) {
    const mock = createMockBrowser();
    const extension = startExtension(mock);
    let state = await extension.send({ type: "getState", windowId: 1 });
    const originalId = state.savedGroups[0].id;
    const originalTabs = deepClone(
      mock.storage.gruposNaBarraState.groups.find((group) => group.id === originalId).tabs
    );

    await extension.send({ type: "closeSavedGroup", savedId: originalId });
    if (!autoPin) {
      await extension.send({ type: "setAutoPin", enabled: false });
    }

    const replacementTab = await mock.browser.tabs.create({
      windowId: 1,
      active: false,
      url: "https://example.com/a"
    });
    const replacementGroupId = 901 + (autoPin ? 0 : 1);
    mock.groups.set(replacementGroupId, {
      id: replacementGroupId,
      windowId: 1,
      title: "Pesquisa",
      color: "purple",
      collapsed: false
    });
    mock.tabs.get(replacementTab.id).groupId = replacementGroupId;

    if (autoPin) {
      state = await extension.send({ type: "getState", windowId: 1 });
    } else {
      await extension.send({ type: "pinNativeGroup", groupId: replacementGroupId });
      state = await extension.send({ type: "getState", windowId: 1 });
    }

    assert.equal(
      state.savedGroups.length,
      2,
      `${autoPin ? "auto reconcile" : "manual pin"} must preserve the closed entity and create a new identity`
    );
    const original = state.savedGroups.find((group) => group.id === originalId);
    const replacement = state.savedGroups.find((group) => group.id !== originalId);
    assert.ok(original, "the original persistent identity must survive");
    assert.ok(replacement, "the matching native group must receive a different persistent identity");
    assert.equal(original.open, false, "the original entity must remain closed");
    assert.equal(replacement.open, true, "the new native entity must be the open one");

    const extraTab = await mock.browser.tabs.create({
      windowId: 1,
      active: false,
      url: "https://example.com/c"
    });
    mock.tabs.get(extraTab.id).groupId = replacementGroupId;
    await extension.send({ type: "syncNativeGroup", groupId: replacementGroupId });

    const storedOriginal = mock.storage.gruposNaBarraState.groups.find(
      (group) => group.id === originalId
    );
    const storedReplacement = mock.storage.gruposNaBarraState.groups.find(
      (group) => group.id === replacement.id
    );
    assert.deepEqual(
      storedOriginal.tabs,
      originalTabs,
      "changes to the new native group must never overwrite the closed entity snapshot"
    );
    assert.deepEqual(
      storedReplacement.tabs.map((tab) => tab.url),
      ["https://example.com/a", "https://example.com/c"]
    );
  }

  await exercise({ autoPin: true });
  await exercise({ autoPin: false });
}

async function run() {
  const mock = createMockBrowser();
  const { route, interceptBookmark, send } = startExtension(mock);

  const initial = await send({ type: "getState", windowId: 1 });
  assert.equal(initial.openGroups.length, 1);
  assert.equal(initial.savedGroups.length, 1, "open groups must be imported automatically");
  assert.equal(initial.autoPinNewGroups, true);
  assert.equal(initial.savedGroups[0].pinned, true);
  assert.equal(initial.openGroups[0].title, "Pesquisa");
  assert.equal(initial.savedGroups[0].previewTabs[0].label, "example.com (Página A)");
  assert.equal(
    initial.savedGroups[0].previewTabs[0].faviconUrl,
    "data:image/png;base64,LOCAL_FAVICON",
    "open groups should expose Firefox's live favicon locally"
  );

  await send({ type: "pinNativeGroup", groupId: 10 });
  let state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 1, "manual pin must not duplicate an automatic import");
  assert.equal(state.savedGroups[0].tabCount, 1, "privileged about: pages must not be persisted");
  assert.equal(state.savedGroups[0].skippedTabs, 1);
  assert.equal(state.savedGroups[0].pinned, true);
  assert.equal(state.savedGroups[0].open, true);

  const savedId = state.savedGroups[0].id;
  const storedState = mock.storage.gruposNaBarraState;
  const bookmark = mock.bookmarkNodes.get(storedState.groups[0].bookmarkId);
  assert.equal(bookmark.parentId, "toolbar_____");
  assert.equal(bookmark.title, "Pesquisa\u2060\u{E0106}");
  assert.equal(
    bookmark.url,
    `https://grupos-na-barra.invalid/toggle/${encodeURIComponent(savedId)}?v=1.6.0`
  );
  bookmark.url = `moz-extension://unit-test/launcher/open.html#${encodeURIComponent(savedId)}`;
  await send({ type: "getState", windowId: 1 });
  assert.equal(
    bookmark.url,
    `https://grupos-na-barra.invalid/toggle/${encodeURIComponent(savedId)}?v=1.6.0`,
    "bookmarks from older versions must migrate to the non-navigating command"
  );
  const duplicateBookmark = await mock.browser.bookmarks.create({
    parentId: "toolbar_____",
    title: bookmark.title,
    url: bookmark.url
  });
  await send({ type: "getState", windowId: 1 });
  assert.equal(
    mock.bookmarkNodes.has(duplicateBookmark.id),
    false,
    "duplicate bookmarks for the same saved group must be removed automatically"
  );
  const orphanBookmark = await mock.browser.bookmarks.create({
    parentId: "toolbar_____",
    title: "Pesquisa",
    url: "moz-extension://unit-test/launcher/open.html?v=1.2.0#orphan-group"
  });
  await send({ type: "getState", windowId: 1 });
  assert.equal(
    mock.bookmarkNodes.has(orphanBookmark.id),
    true,
    "a bookmark whose sync record has not arrived yet must be preserved"
  );
  await mock.browser.bookmarks.remove(orphanBookmark.id);

  await send({ type: "updateSavedGroup", savedId, title: "Vorpal", color: "red", icon: "star" });
  assert.equal(mock.groups.get(10).title, "Vorpal\u2060\u{E0202}\u2060\u{E0102}");
  assert.equal(mock.groups.get(10).color, "red");
  assert.equal(
    mock.bookmarkNodes.get(storedState.groups[0].bookmarkId).title,
    "Vorpal\u2060\u{E0202}\u2060\u{E0102}"
  );

  await send({ type: "updateSavedGroup", savedId, title: "Vorpal", color: "red", icon: "star", darkerColors: true });
  let darkerState = await send({ type: "getState", windowId: 1 });
  assert.equal(darkerState.savedGroups[0].darkerColors, true);
  assert.equal(mock.groups.get(10).title, "Vorpal\u2060\u{E0202}\u2060\u{E0102}\u2060\u{E0210}");
  assert.equal(
    mock.bookmarkNodes.get(storedState.groups[0].bookmarkId).title,
    "Vorpal\u2060\u{E0202}\u2060\u{E0102}",
    "the darker-colors marker belongs only to the native group, not the bookmark"
  );
  await send({ type: "updateSavedGroup", savedId, title: "Vorpal", color: "red", icon: "star", darkerColors: false });

  await send({ type: "updateSavedGroup", savedId, title: "", color: "red", icon: "star", darkerColors: false });
  const emptyTitleState = await send({ type: "getState", windowId: 1 });
  assert.equal(emptyTitleState.savedGroups[0].title, "", "an existing group name can be cleared completely");
  assert.equal(mock.groups.get(10).title, "\u2060\u{E0202}\u2060\u{E0102}");
  assert.equal(mock.bookmarkNodes.get(storedState.groups[0].bookmarkId).title, "\u2060\u{E0202}\u2060\u{E0102}");
  await send({ type: "updateSavedGroup", savedId, title: "Vorpal", color: "red", icon: "star", darkerColors: false });

  await send({ type: "closeSavedGroup", savedId });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false);
  assert.equal(mock.groups.has(10), false);
  assert.equal(mock.tabs.has(1), false);
  assert.equal(mock.tabs.has(2), false);

  const externallyReopenedTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  const externallyReopenedProtectedTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "about:config"
  });
  mock.groups.set(77, {
    id: 77,
    windowId: 1,
    title: "Vorpal",
    color: "red",
    collapsed: false
  });
  mock.tabs.get(externallyReopenedTab.id).groupId = 77;
  mock.tabs.get(externallyReopenedProtectedTab.id).groupId = 77;
  await send({ type: "syncNativeGroup", groupId: 77 });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(
    state.savedGroups.length,
    2,
    "an externally recreated native group with matching content must receive a new identity"
  );
  const externallyRecreated = mock.storage.gruposNaBarraState.groups.find(
    (group) => group.live?.groupId === 77
  );
  assert.ok(externallyRecreated);
  assert.notEqual(externallyRecreated.id, savedId);
  assert.equal(
    state.savedGroups.find((group) => group.id === savedId).open,
    false,
    "the closed persistent entity must remain closed"
  );
  assert.equal(
    [...mock.bookmarkNodes.values()].filter(
      (node) =>
        typeof node.url === "string" &&
        (node.url.includes("launcher/open.html") ||
          node.url.startsWith("https://grupos-na-barra.invalid/toggle/"))
    ).length,
    2,
    "distinct persistent identities must keep distinct bookmarks"
  );
  await send({ type: "closeSavedGroup", savedId: externallyRecreated.id });
  await send({ type: "deleteSavedGroup", savedId: externallyRecreated.id });
  await send({ type: "deleteTrashGroupPermanently", savedId: externallyRecreated.id });

  const currentPageTab = mock.tabs.get(3);
  const currentPageUrl = currentPageTab.url;
  const commandUrl = mock.bookmarkNodes.get(storedState.groups[0].bookmarkId).url;
  const openInterception = await interceptBookmark({
    requestId: "bookmark-open",
    tabId: currentPageTab.id,
    type: "main_frame",
    url: commandUrl
  });
  assert.equal(openInterception.cancel, true);
  assert.equal(
    mock.tabs.get(currentPageTab.id).url,
    currentPageUrl,
    "opening from the bookmark must leave the current page untouched"
  );
  assert.equal(mock.metrics.goBackCalls, 0, "the command path must never navigate back");
  const duplicateInterception = await interceptBookmark({
    requestId: "bookmark-open",
    tabId: currentPageTab.id,
    type: "main_frame",
    url: commandUrl
  });
  assert.equal(duplicateInterception.cancel, true);
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(
    state.savedGroups[0].open,
    true,
    "the intercepted bookmark must open the group exactly once"
  );

  const closeInterception = await interceptBookmark({
    requestId: "bookmark-close",
    tabId: currentPageTab.id,
    type: "main_frame",
    url: commandUrl
  });
  assert.equal(closeInterception.cancel, true);
  assert.equal(
    mock.tabs.get(currentPageTab.id).url,
    currentPageUrl,
    "closing from the bookmark must leave an unrelated current page untouched"
  );
  assert.equal(mock.metrics.goBackCalls, 0, "closing through the command must not use history");
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false, "the intercepted bookmark must close the group");

  const launcher = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: `moz-extension://unit-test/launcher/open.html#${encodeURIComponent(savedId)}`
  });
  const restored = await send(
    { type: "openSavedGroup", savedId },
    { tab: { id: launcher.id, windowId: 1 } }
  );
  assert.equal(restored.opened, true);
  assert.equal(restored.skippedTabs, 0);
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, true);
  assert.equal(mock.tabs.get(launcher.id).url, "https://previous.example/");

  const restoredGroupId = mock.storage.gruposNaBarraState.groups[0].live.groupId;
  assert.equal(mock.groups.get(restoredGroupId).title, "Vorpal\u2060\u{E0202}\u2060\u{E0102}");
  assert.equal(mock.groups.get(restoredGroupId).color, "red");
  assert.equal(
    [...mock.tabs.values()].filter((tab) => tab.groupId === restoredGroupId).length,
    1,
    "only restorable URLs should reopen"
  );

  const tabCountBeforeFocus = mock.tabs.size;
  const focused = await send({ type: "openSavedGroup", savedId, windowId: 1 });
  assert.equal(focused.focused, true);
  assert.equal(mock.tabs.size, tabCountBeforeFocus, "opening an already live group must not duplicate tabs");

  const closingLauncher = [...mock.tabs.values()].find(
    (tab) => tab.groupId === restoredGroupId
  );
  const savedUrlBeforeToggle = mock.storage.gruposNaBarraState.groups[0].tabs[0].url;
  closingLauncher.previousUrl = closingLauncher.url;
  closingLauncher.url =
    `moz-extension://unit-test/launcher/open.html?v=1.3.0&color=red#${encodeURIComponent(savedId)}`;
  await send({ type: "syncNativeGroup", groupId: restoredGroupId });
  assert.equal(
    mock.storage.gruposNaBarraState.groups[0].tabs[0].url,
    savedUrlBeforeToggle,
    "the temporary launcher must not replace a saved group URL"
  );
  const toggledClosed = await send(
    { type: "toggleSavedGroup", savedId },
    { tab: { id: closingLauncher.id, windowId: 1 } }
  );
  assert.equal(toggledClosed.action, "closed");
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, false, "bookmark click must save and close an open group");

  const openingLauncher = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: `moz-extension://unit-test/launcher/open.html?v=1.3.0&color=red#${encodeURIComponent(savedId)}`
  });
  const toggledOpened = await send(
    { type: "toggleSavedGroup", savedId },
    { tab: { id: openingLauncher.id, windowId: 1 } }
  );
  assert.equal(toggledOpened.action, "opened");
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].open, true, "bookmark click must reopen a closed group");

  const parallelTab = await mock.browser.tabs.create({
    windowId: 1,
    active: false,
    url: "https://example.com/a"
  });
  mock.groups.set(888, {
    id: 888,
    windowId: 1,
    title: "Vorpal",
    color: "red",
    collapsed: false
  });
  mock.tabs.get(parallelTab.id).groupId = 888;
  await send({ type: "syncNativeGroup", groupId: 888 });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 2, "two identical groups may coexist while both are open");

  const parallelSaved = state.savedGroups.find((group) => group.id !== savedId);
  await send({ type: "closeSavedGroup", savedId: parallelSaved.id });
  await send({ type: "closeSavedGroup", savedId });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(
    state.savedGroups.length,
    2,
    "distinct persistent IDs must survive even when closed groups have identical content"
  );
  assert.equal(
    [...mock.bookmarkNodes.values()].filter(
      (node) =>
        typeof node.url === "string" &&
        (node.url.includes("launcher/open.html") ||
          node.url.startsWith("https://grupos-na-barra.invalid/toggle/"))
    ).length,
    2,
    "each distinct persistent group must retain its own bookmark"
  );

  // Limpa apenas o grupo paralelo criado para esta regressão; a exclusão
  // explícita é diferente da antiga deduplicação automática destrutiva.
  await send({ type: "deleteSavedGroup", savedId: parallelSaved.id });
  await send({ type: "deleteTrashGroupPermanently", savedId: parallelSaved.id });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.length, 1);

  const mergedLauncher = await mock.browser.tabs.create({
    windowId: 1,
    active: true,
    url: `moz-extension://unit-test/launcher/open.html?v=1.3.0&color=red#${encodeURIComponent(savedId)}`
  });
  await send(
    { type: "toggleSavedGroup", savedId },
    { tab: { id: mergedLauncher.id, windowId: 1 } }
  );

  await send({ type: "unpinBookmark", savedId });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].pinned, false);
  await send({ type: "pinBookmark", savedId });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].pinned, true);

  const movedBookmarkId = mock.storage.gruposNaBarraState.groups[0].bookmarkId;
  mock.bookmarkNodes.get(movedBookmarkId).parentId = "other_____";
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups[0].pinned, false, "a bookmark moved out of the toolbar is not pinned");
  await send({ type: "pinBookmark", savedId });
  assert.equal(mock.bookmarkNodes.get(movedBookmarkId).parentId, "toolbar_____");

  const extraTab = await mock.browser.tabs.create({ url: "https://auto.example/", active: false });
  mock.groups.set(333, { id: 333, windowId: 1, title: "Automático", color: "blue", collapsed: false });
  mock.tabs.get(extraTab.id).groupId = 333;
  await send({ type: "setAutoPin", enabled: false });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.title === "Automático"), false);
  await send({ type: "setAutoPin", enabled: true });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.autoPinNewGroups, true);
  assert.equal(state.savedGroups.some((group) => group.title === "Automático" && group.pinned), true);

  await send({ type: "deleteSavedGroup", savedId });
  state = await send({ type: "getState", windowId: 1 });
  assert.equal(state.savedGroups.some((group) => group.id === savedId), false);
  assert.equal(
    state.savedGroups.some((group) => group.title === "Vorpal"),
    false,
    "deleting an open saved group must suppress immediate automatic re-pinning"
  );
  assert.equal(
    state.openGroups.some((group) => group.title === "Vorpal" && !group.savedId),
    true,
    "the native group should remain open and available for an explicit re-pin"
  );

  const invalid = await route({ type: "notACommand" }, {});
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errorCode, "operationFailed");
  assert.match(invalid.error, /desconhecido/i);

  await testPreviewShowsDomainAndTabTitle();
  await testClosingLastTabKeepsGroupWithPlaceholder();
  await testClosingLastTabHandlesReverseEventOrder();
  await testDelayedGroupRemovalKeepsCorrelationAfterRuntimeSync();
  await testMovingLastTabOutMakesSavedGroupIntentionallyEmpty();
  await testMovingLastTabBetweenGroupsEmptiesSourceAndUpdatesTarget();
  await testNativeUngroupEmptiesSavedGroupFromMembershipEvidence();
  await testMembershipBeforeGroupRemovalPreservesRatherThanGuessing();
  await testNativeSaveAndClosePreservesSnapshotViaSessions();
  await testNativeDeleteUsesRecentlyClosedAndKeepsPersistentGroupEmpty();
  await testEarlierRemovalFromSameGroupCannotEmptyLaterNativeSaveAndClose();
  await testEarlierRemovalWithSeveralRemainingTabsCannotEmptyLaterNativeSaveAndClose();
  await testEarlierRemovalThenNativeDeleteUsesTerminalRemovalNotOldSession();
  await testEarlierRemovalThenFinalCloseUsesTerminalRemovalNotOldSession();
  await testRestoredSameGroupIdDoesNotReuseOldRemovalGeneration();
  await testStaleQueuedRemovalCannotCrossRestoredGeneration();
  await testStalePendingFinalizationCannotCrossRestoredGeneration();
  await testUnrelatedMembershipSameUrlCannotEmptyNativeSaveAndClose();
  await testUnrelatedRecentlyClosedSameUrlSameWindowCannotEmptyNativeSaveAndClose();
  await testUnobservedMissingDuplicateTabKeepsRecentlyClosedAmbiguous();
  await testOneRecentlyClosedSessionCannotProveTwoSameUrlPendingGroups();
  await testUnmatchedSessionsOnChangedDoesNotConsumePending();
  await testSessionsOnChangedBeforeGroupRemovalStillClassifiesClosedTab();
  await testSerialDelayDoesNotMoveRecentlyClosedReferenceTime();
  await testReopenedOrEditedGroupCannotBeEmptiedByStalePending();
  await testAmbiguousNativeRemovalFallsBackToPreservingSnapshot();
  await testWindowCloseDoesNotReplaceSavedTabsWithPlaceholder();
  await testExtensionCloseDoesNotBecomeEmptyPlaceholder();
  await testFailedCloseKeepsLiveLink();
  await testFaviconSafety();
  await testCrossDeviceSync();
  await testSyncQuotaFallback();
  await testV17Migration();
  await testKeepAtTopOrderMigration();
  await testPendingNavigationPreservesUrls();
  await testBlankLiveSnapshotCannotEraseRecovery();
  await testFailedTabCreationDoesNotDeleteUrl();
  await testIntentionalEmptySyncDoesNotResurrectRemovedUrl();
  await testRollingUpdateWithFrozenV300PeerDoesNotResurrectRemovedUrl();
  await testDistinctIntentionalEmptyGroupsAreNotContentDeduplicated();
  await testDegradedRemoteCannotEraseGoodLocalGroup();
  await testReopenedNativeGroupRepairsAlreadyBlankV18State();
  await testContextMenuGroupsHighlightedTabs();
  await testModifyGroupMenuOpensEditor();
  await testAutomaticBackupAndJsonExport();
  await testContainerTabsSurviveRestore();
  await testKeepAtTopAndLastPinnedTab();
  await testArchiveWorkflow();
  await testTrashWorkflow();
  await testRestoreBeatsFutureTombstone();
  await testExpiredTrashIsPurged();
  await testBulkArchiveAndTrashWorkflow();
  await testKeepAtTopOrdering();
  await testMissingRemoteRecordIsRepaired();
  await testPendingSyncRetryWithoutUnrelatedMutation();
  await testOldRemoteTombstoneGetsFreshLocalTrashWindow();
  await testDeferredRemoteVersionDoesNotLeaveInvalidPendingGroup();
  await testRemoteArchiveCannotCloseLocallyOpenGroup();
  await testTransientMissingNativeGroupDoesNotDetachLiveLink();
  await testLifecycleObservationStartSurvivesEventPageWake();
  await testInternalEmptySentinelCannotBecomeRestoredTab();
  await testMessageRouterRejectsExplicitForeignSender();
  await testKeepAtTopRefusalIsRateLimited();
  await testFuturePoisonedLocalVersionIsSanitizedOnLoad();
  await testOldTombstonesAreArchivedBeforeV1Removal();
  await testMatureArchiveRemovesRedundantV1Tombstones();
  await testArchivedDeletionBlocksOldPeerResurrectionAndRestoresAsNewIdentity();
  await testClosedEntityIsNotAdoptedByMatchingNewNativeGroup();
  await testDiagnosticSanitization();
  await testDiagnosticsWorkflow();

  console.log("background.test.js: all assertions passed");
}

test("background integration and regressions", { timeout: 120_000 }, async () => {
  await run();
});
