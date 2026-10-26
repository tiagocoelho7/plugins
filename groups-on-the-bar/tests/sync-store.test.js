"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadSyncStore() {
  const source = fs.readFileSync(path.join(__dirname, "..", "sync-store.js"), "utf8");
  const context = vm.createContext({ TextEncoder, Uint8Array, btoa, atob });
  vm.runInContext(source, context);
  return context.GruposSyncStore;
}

function group(overrides = {}) {
  return {
    id: "group-123",
    title: "Pesquisa",
    color: "purple",
    icon: "star",
    darkerColors: true,
    keepAtTop: true,
    keepAtTopOrder: 2000,
    archived: true,
    tabs: [
      {
        url: "https://example.com/a",
        title: "Página A",
        faviconUrl: "data:image/png;base64,LOCAL_FAVICON",
        cookieStoreId: "firefox-container-7"
      },
      { url: "https://example.com/b", title: "Página B" }
    ],
    skippedTabs: 1,
    createdAt: 100,
    ...overrides
  };
}

test("codifica e recupera um grupo sem incluir IDs nem recuperação locais", () => {
  const store = loadSyncStore();
  const input = group({
    bookmarkId: "bookmark-local",
    live: { groupId: 8, windowId: 3 },
    recoveryTabs: [{ url: "https://local-recovery.example/", title: "Recuperação local" }],
    restoreIncomplete: true
  });
  const items = store.encodeGroup(input, { updatedAt: 200, revision: "200:device-a:1" });
  const decoded = store.decode(items);

  assert.equal(decoded.incomplete.length, 0);
  assert.equal(decoded.records.length, 1);
  assert.equal(decoded.records[0].type, "group");
  assert.equal(decoded.records[0].id, input.id);
  assert.equal(decoded.records[0].icon, "star");
  assert.equal(decoded.records[0].darkerColors, true);
  assert.equal(decoded.records[0].keepAtTop, true);
  assert.equal(decoded.records[0].keepAtTopOrder, 2000);
  assert.equal(decoded.records[0].archived, true);
  assert.deepEqual(JSON.parse(JSON.stringify(decoded.records[0].tabs)), [
    { url: "https://example.com/a", cookieStoreId: "firefox-container-7" },
    { url: "https://example.com/b" }
  ]);
  assert.equal(JSON.stringify(items).includes("Página A"), false, "page titles stay local");
  assert.equal(JSON.stringify(items).includes("LOCAL_FAVICON"), false, "favicons stay local");
  assert.equal(JSON.stringify(items).includes("bookmark-local"), false);
  assert.equal(JSON.stringify(items).includes("local-recovery"), false);
  assert.equal(JSON.stringify(items).includes("restoreIncomplete"), false);
  assert.equal(JSON.stringify(items).includes("windowId"), false);
  assert.equal(JSON.stringify(items).includes("groupId"), false);
});

test("sincroniza explicitamente o estado de grupo vazio intencional", () => {
  const store = loadSyncStore();
  const input = group({
    tabs: [{ url: "about:blank", title: "Título local não sincronizado" }],
    intentionallyEmpty: true
  });
  const items = store.encodeGroup(input, { updatedAt: 250, revision: "250:device-a:1" });
  const rawItems = JSON.stringify(items);
  assert.equal(
    rawItems.includes("https://grupos-na-barra.invalid/empty/group-123"),
    true,
    "the Sync wire must carry a group-specific neutral sentinel so older v3 clients do not resurrect or content-dedupe an intentional empty state"
  );
  const decoded = store.decode(items);

  assert.equal(decoded.incomplete.length, 0);
  assert.equal(decoded.records.length, 1);
  assert.equal(decoded.records[0].intentionallyEmpty, true);
  assert.deepEqual(JSON.parse(JSON.stringify(decoded.records[0].tabs)), [{ url: "about:blank" }]);
  assert.equal(JSON.stringify(items).includes("Título local não sincronizado"), false);

  const legacyRepublished = JSON.parse(JSON.stringify(items));
  const metaKey = store.metaKey(input.id);
  delete legacyRepublished[metaKey].intentionallyEmpty;
  const legacyDecoded = store.decode(legacyRepublished);
  assert.equal(
    legacyDecoded.records[0].intentionallyEmpty,
    true,
    "the HTTPS sentinel itself must recover the empty semantic after a v3.0.0 peer republishes it without the new boolean"
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(legacyDecoded.records[0].tabs)),
    [{ url: "about:blank" }]
  );

  const backupItems = store.encodeBackup([input], 251);
  assert.equal(
    JSON.stringify(backupItems).includes("https://grupos-na-barra.invalid/empty/group-123"),
    true,
    "the compact Sync backup must use the same rollout-safe sentinel"
  );
  const backup = store.decodeBackup(backupItems);
  assert.equal(backup.groups[0].intentionallyEmpty, true);
  assert.deepEqual(JSON.parse(JSON.stringify(backup.groups[0].tabs)), [{ url: "about:blank" }]);

  const otherItems = store.encodeGroup(
    group({
      id: "group-456",
      tabs: [{ url: "about:blank" }],
      intentionallyEmpty: true
    }),
    { updatedAt: 252, revision: "252:device-a:2" }
  );
  assert.equal(
    JSON.stringify(otherItems).includes("https://grupos-na-barra.invalid/empty/group-456"),
    true
  );
  assert.notEqual(
    store.groupFingerprint(input),
    store.groupFingerprint(group({ id: "group-456", tabs: [{ url: "about:blank" }], intentionallyEmpty: true })),
    "two intentional empty groups must remain distinguishable even to older content-based Sync logic during a rolling update"
  );
});

test("fragmenta grupos grandes mantendo cada item abaixo de 8 KiB", () => {
  const store = loadSyncStore();
  const tabs = Array.from({ length: 55 }, (_, index) => ({
    url: `https://example.com/${index}?q=${"á\\\"".repeat(55)}`,
    title: `Página ${index} ${"漢字".repeat(30)}`
  }));
  const input = group({ tabs });
  const items = store.encodeGroup(input, { updatedAt: 300, revision: "300:device-a:1" });

  assert.ok(Object.keys(items).length > 2, "the payload should span multiple sync items");
  for (const [key, value] of Object.entries(items)) {
    assert.ok(store.itemBytes(key, value) <= store.ITEM_LIMIT_BYTES);
  }

  const decoded = store.decode(items);
  assert.equal(decoded.incomplete.length, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(decoded.records[0].tabs)),
    tabs.map((tab) => ({ url: tab.url }))
  );
});

test("não aplica um registro que chegou parcialmente", () => {
  const store = loadSyncStore();
  const input = group({
    tabs: Array.from({ length: 80 }, (_, index) => ({
      url: `https://example.com/${index}/${"x".repeat(150)}`,
      title: `Página ${index}`
    }))
  });
  const items = store.encodeGroup(input, { updatedAt: 400, revision: "400:device-b:1" });
  const chunk = Object.keys(items).find((key) => key.includes(":tabs:"));
  delete items[chunk];

  const decoded = store.decode(items);
  assert.equal(decoded.records.length, 0);
  assert.equal(decoded.incomplete.length, 1);
  assert.equal(decoded.incomplete[0].id, input.id);
});

test("resolve edições concorrentes com uma ordem determinística", () => {
  const store = loadSyncStore();
  const older = { updatedAt: 500, revision: "500:device-a:1" };
  const newer = { updatedAt: 501, revision: "501:device-b:1" };
  const sameTimeA = { updatedAt: 600, revision: "600:device-a:1" };
  const sameTimeB = { updatedAt: 600, revision: "600:device-b:1" };

  assert.equal(store.compareVersions(older, newer), -1);
  assert.equal(store.compareVersions(newer, older), 1);
  assert.equal(store.compareVersions(sameTimeA, sameTimeB), -1);
  assert.equal(store.compareVersions(sameTimeB, sameTimeA), 1);
});

test("mantém o grupo local quando ele excede a cota total do Sync", () => {
  const store = loadSyncStore();
  const huge = group({
    tabs: [
      {
        url: `https://example.com/?payload=${"x".repeat(110000)}`,
        title: "Muito grande"
      }
    ]
  });

  assert.throws(
    () => store.encodeGroup(huge, { updatedAt: 700, revision: "700:device-a:1" }),
    /espaço total|quantidade de itens/i
  );
});

test("compacta lápides antigas em um arquivo v2 exato e ignora grupos v1 ressuscitados", () => {
  const store = loadSyncStore();
  const ids = [
    "13bb09cd-53e0-41b7-80e6-53c1c0093dc3",
    "0ff90516-6f83-4ed7-a2fd-9abcde012345",
    "legacy-group-id"
  ];
  const archiveItems = store.encodeTombstoneArchive(ids, 900);
  const archive = store.decodeTombstoneArchive(archiveItems);

  assert.deepEqual(JSON.parse(JSON.stringify(archive.ids)), ids.slice().sort());
  assert.equal(archive.idCount, 3);
  for (const [key, value] of Object.entries(archiveItems)) {
    assert.ok(store.itemBytes(key, value) <= store.ITEM_LIMIT_BYTES);
  }

  const staleGroup = store.encodeGroup(
    group({ id: ids[0], title: "Ressuscitado por peer antigo" }),
    { updatedAt: 999999, revision: "999999:old-peer:1" }
  );
  const decoded = store.decode({ ...staleGroup, ...archiveItems }, 1000000);
  assert.equal(decoded.archiveCorrupt, false);
  assert.deepEqual(JSON.parse(JSON.stringify(decoded.archivedIds)), ids.slice().sort());
  assert.equal(decoded.records.some((record) => record.id === ids[0]), false);
});

test("arquivo v2 reduz drasticamente o caso de 433 lápides UUID sem perder IDs", () => {
  const store = loadSyncStore();
  const ids = Array.from({ length: 433 }, (_, index) =>
    `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`
  );
  const archived = store.encodeTombstoneArchive(ids, 902);
  assert.ok(Object.keys(archived).length <= 3);
  assert.ok(store.storageBytes(archived) < 12 * 1024);
  assert.deepEqual(JSON.parse(JSON.stringify(store.decodeTombstoneArchive(archived).ids)), ids);
});

test("arquivo compacto de lápides falha fechado se um segmento estiver corrompido", () => {
  const store = loadSyncStore();
  const ids = Array.from({ length: 380 }, (_, index) =>
    `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
  const items = store.encodeTombstoneArchive(ids, 901);
  const segmentKey = Object.keys(items)[0];
  assert.ok(segmentKey);
  items[segmentKey].data += "corruption";

  const decoded = store.decode(items);
  assert.equal(decoded.archiveCorrupt, true);
  assert.equal(decoded.records.length, 0);
  assert.equal(decoded.incomplete.length, 0);
});

test("mantém uma cópia compacta anterior sem IDs nem títulos locais", () => {
  const store = loadSyncStore();
  const groups = Array.from({ length: 18 }, (_, index) =>
    group({
      id: `group-${index}`,
      title: `Grupo ${index}`,
      tabs: Array.from({ length: 8 }, (__, tabIndex) => ({
        url: `https://example.com/${index}/${tabIndex}?q=${"x".repeat(80)}`,
        title: `Título local ${index}-${tabIndex}`,
        cookieStoreId: tabIndex === 0 ? "firefox-container-7" : undefined
      }))
    })
  );
  const items = store.encodeBackup(groups, 123456);

  assert.ok(store.backupKeys(items).length > 1);
  assert.equal(JSON.stringify(items).includes("Título local"), false);
  for (const [key, value] of Object.entries(items)) {
    assert.ok(store.itemBytes(key, value) <= store.ITEM_LIMIT_BYTES);
  }

  const decoded = store.decodeBackup(items);
  assert.equal(decoded.createdAt, 123456);
  assert.equal(decoded.groupCount, groups.length);
  assert.equal(decoded.groups[0].icon, "star");
  assert.equal(decoded.groups[0].keepAtTop, true);
  assert.equal(decoded.groups[0].keepAtTopOrder, 2000);
  assert.equal(decoded.groups[0].archived, true);
  assert.equal(decoded.groups[0].tabs[0].cookieStoreId, "firefox-container-7");
  assert.equal(decoded.groups[0].tabs[1].url, groups[0].tabs[1].url);
});

test("rejeita identificadores e containers anormalmente grandes ou inseguros", () => {
  const store = loadSyncStore();
  const version = { updatedAt: 800, revision: "800:device-a:1" };

  assert.throws(
    () => store.encodeGroup(group({ id: "../escape" }), version),
    /identificador|inválido/i
  );
  assert.throws(
    () => store.encodeGroup(group({ id: "x".repeat(129) }), version),
    /identificador|inválido/i
  );

  const items = store.encodeGroup(
    group({
      tabs: [
        {
          url: "https://example.com/",
          cookieStoreId: `firefox-container-${"x".repeat(200)}`
        }
      ]
    }),
    version
  );
  const decoded = store.decode(items);
  assert.deepEqual(JSON.parse(JSON.stringify(decoded.records[0].tabs)), [
    { url: "https://example.com/" }
  ]);
});

test("ignora registros remotos com relógio muito à frente sem envenenar a versão", () => {
  const store = loadSyncStore();
  const now = 1_800_000_000_000;
  const future = now + store.MAX_FUTURE_CLOCK_SKEW_MS + 1;

  const groupItems = store.encodeGroup(group(), {
    updatedAt: future,
    revision: "future:peer:1"
  });
  const groupDecoded = store.decode(groupItems, now);
  assert.equal(groupDecoded.records.length, 0);
  assert.equal(
    groupDecoded.incomplete.length,
    0,
    "a clock-poisoned record must be ignored, not deferred with its bad version"
  );

  const tombstoneItems = store.encodeTombstone({
    id: "group-123",
    updatedAt: future,
    deletedAt: future,
    revision: "future:peer:2"
  });
  const tombstoneDecoded = store.decode(tombstoneItems, now);
  assert.equal(tombstoneDecoded.records.length, 0);
  assert.equal(tombstoneDecoded.incomplete.length, 0);
});

test("usa hash de 64 bits adicional sem quebrar registros v3 legados", () => {
  const store = loadSyncStore();
  const items = store.encodeGroup(group(), { updatedAt: 900, revision: "900:device-a:1" });
  const metaKey = store.metaKey("group-123");
  assert.match(items[metaKey].tabsHash64, /^[0-9a-f]{16}$/);

  const corruptedStrongHash = JSON.parse(JSON.stringify(items));
  corruptedStrongHash[metaKey].tabsHash64 = "0000000000000000";
  const rejected = store.decode(corruptedStrongHash);
  assert.equal(rejected.records.length, 0);
  assert.equal(rejected.incomplete.length, 1);

  const legacy = JSON.parse(JSON.stringify(items));
  delete legacy[metaKey].tabsHash64;
  const acceptedLegacy = store.decode(legacy);
  assert.equal(acceptedLegacy.records.length, 1, "old v3 wire records remain readable");

  const backup = store.encodeBackup([group()], 901);
  const backupMeta = backup[`${store.BACKUP_KEY_PREFIX}meta`];
  assert.match(backupMeta.dataHash64, /^[0-9a-f]{16}$/);
});

test("omite deletedAt redundante em tombstones novos para reduzir a cota sem quebrar o fallback", () => {
  const store = loadSyncStore();
  const items = store.encodeTombstone({
    id: "group-123",
    updatedAt: 1000,
    deletedAt: 1000,
    revision: "1000:device-a:1"
  });
  const meta = items[store.metaKey("group-123")];
  assert.equal(Object.hasOwn(meta, "deletedAt"), false);
  const decoded = store.decode(items, 1000);
  assert.equal(decoded.records[0].deletedAt, 1000);
});
