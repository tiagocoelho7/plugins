"use strict";

// Formato independente do estado local. Cada grupo usa um item de metadados e
// quantos fragmentos forem necessários para as abas. Isso evita o limite de
// 8 KiB por item do storage.sync sem misturar IDs locais de janelas, abas ou
// favoritos entre computadores.
(function exposeSyncStore(root) {
  const FORMAT_VERSION = 1;
  const KEY_PREFIX = "gnb.sync.v1.group:";
  const BACKUP_KEY_PREFIX = "gnb.sync.v1.backup:";
  const ITEM_LIMIT_BYTES = 8192;
  const ITEM_TARGET_BYTES = 7800;
  const TOTAL_LIMIT_BYTES = 102400;
  const ITEM_COUNT_LIMIT = 512;
  const RECORD_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
  const MAX_COOKIE_STORE_ID_LENGTH = 128;

  function utf8ByteLength(value) {
    const text = String(value);
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function itemBytes(key, value) {
    return utf8ByteLength(key) + utf8ByteLength(JSON.stringify(value));
  }

  function storageBytes(items) {
    return Object.entries(items || {}).reduce(
      (total, [key, value]) => total + itemBytes(key, value),
      0
    );
  }

  function hashString(value) {
    const bytes =
      typeof TextEncoder === "function"
        ? new TextEncoder().encode(String(value))
        : Array.from(unescape(encodeURIComponent(String(value))), (char) => char.charCodeAt(0));
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function validRecordId(id) {
    return typeof id === "string" && RECORD_ID_PATTERN.test(id);
  }

  function safeId(id) {
    const value = String(id);
    if (!validRecordId(value)) {
      throw new Error("Identificador de grupo inválido para o Firefox Sync.");
    }
    return encodeURIComponent(value);
  }

  function groupPrefix(id) {
    return `${KEY_PREFIX}${safeId(id)}:`;
  }

  function metaKey(id) {
    return `${groupPrefix(id)}meta`;
  }

  function chunkKey(id, index) {
    return `${groupPrefix(id)}tabs:${index}`;
  }

  function isSyncKey(key) {
    return (
      typeof key === "string" &&
      (key.startsWith(KEY_PREFIX) || key.startsWith(BACKUP_KEY_PREFIX))
    );
  }

  function backupMetaKey() {
    return `${BACKUP_KEY_PREFIX}meta`;
  }

  function backupChunkKey(index) {
    return `${BACKUP_KEY_PREFIX}data:${index}`;
  }

  function backupKeys(items) {
    return Object.keys(items || {}).filter((key) => key.startsWith(BACKUP_KEY_PREFIX));
  }

  function keysForId(items, id) {
    const prefix = groupPrefix(id);
    return Object.keys(items || {}).filter((key) => key.startsWith(prefix));
  }

  function sharedGroupData(group) {
    return {
      id: String(group.id),
      title: String(group.title || ""),
      color: String(group.color || "grey"),
      icon: String(group.icon || "none"),
      darkerColors: group.darkerColors === true,
      keepAtTop: group.keepAtTop === true,
      keepAtTopOrder: Number.isFinite(group.keepAtTopOrder) ? group.keepAtTopOrder : null,
      archived: group.archived === true,
      tabs: Array.isArray(group.tabs)
        ? group.tabs.map((tab) => {
            const sharedTab = {
              url: typeof tab?.url === "string" || tab?.url === null ? tab.url : null
            };
            if (
              typeof tab?.cookieStoreId === "string" &&
              tab.cookieStoreId.length <= MAX_COOKIE_STORE_ID_LENGTH &&
              /^firefox-container-[a-z0-9_-]+$/i.test(tab.cookieStoreId)
            ) {
              sharedTab.cookieStoreId = tab.cookieStoreId;
            }
            return sharedTab;
          })
        : [],
      skippedTabs: Number.isInteger(group.skippedTabs) ? Math.max(0, group.skippedTabs) : 0,
      createdAt: Number.isFinite(group.createdAt) ? group.createdAt : 0
    };
  }

  function groupFingerprint(group) {
    return hashString(JSON.stringify(sharedGroupData(group)));
  }

  function compareVersions(left, right) {
    const leftTime = Number.isFinite(left?.updatedAt) ? left.updatedAt : 0;
    const rightTime = Number.isFinite(right?.updatedAt) ? right.updatedAt : 0;
    if (leftTime !== rightTime) {
      return leftTime < rightTime ? -1 : 1;
    }

    const leftRevision = String(left?.revision || "");
    const rightRevision = String(right?.revision || "");
    if (leftRevision === rightRevision) {
      return 0;
    }
    return leftRevision < rightRevision ? -1 : 1;
  }

  function chunkValue(id, revision, index, total, data) {
    return {
      format: FORMAT_VERSION,
      kind: "tabs",
      id,
      revision,
      index,
      total,
      data
    };
  }

  function splitPayload(id, revision, payload) {
    const fragments = [];
    let offset = 0;

    while (offset < payload.length || (!payload.length && !fragments.length)) {
      let low = offset + (offset < payload.length ? 1 : 0);
      let high = payload.length;
      let best = offset;
      const index = fragments.length;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = payload.slice(offset, middle);
        const size = itemBytes(
          chunkKey(id, index),
          chunkValue(id, revision, index, ITEM_COUNT_LIMIT, candidate)
        );
        if (size <= ITEM_TARGET_BYTES) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (best === offset && offset < payload.length) {
        throw new Error("Uma aba contém dados grandes demais para o Firefox Sync.");
      }

      fragments.push(payload.slice(offset, best));
      offset = best;
      if (fragments.length >= ITEM_COUNT_LIMIT) {
        throw new Error("Este grupo ultrapassa a quantidade de itens permitida pelo Firefox Sync.");
      }
    }

    return fragments;
  }

  function backupChunkValue(snapshotId, index, total, data) {
    return {
      format: FORMAT_VERSION,
      kind: "backup-data",
      snapshotId,
      index,
      total,
      data
    };
  }

  function splitBackupPayload(snapshotId, payload) {
    const fragments = [];
    let offset = 0;

    while (offset < payload.length || (!payload.length && !fragments.length)) {
      let low = offset + (offset < payload.length ? 1 : 0);
      let high = payload.length;
      let best = offset;
      const index = fragments.length;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = payload.slice(offset, middle);
        const size = itemBytes(
          backupChunkKey(index),
          backupChunkValue(snapshotId, index, ITEM_COUNT_LIMIT, candidate)
        );
        if (size <= ITEM_TARGET_BYTES) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (best === offset && offset < payload.length) {
        throw new Error("O backup contém dados grandes demais para o Firefox Sync.");
      }

      fragments.push(payload.slice(offset, best));
      offset = best;
      if (fragments.length >= ITEM_COUNT_LIMIT) {
        throw new Error("O backup ultrapassa a quantidade de itens permitida pelo Firefox Sync.");
      }
    }

    return fragments;
  }

  function validateItems(items) {
    const entries = Object.entries(items);
    if (entries.length > ITEM_COUNT_LIMIT) {
      throw new Error("O grupo ultrapassa a quantidade de itens permitida pelo Firefox Sync.");
    }

    for (const [key, value] of entries) {
      if (itemBytes(key, value) > ITEM_LIMIT_BYTES) {
        throw new Error("Um fragmento do grupo ultrapassa 8 KiB no Firefox Sync.");
      }
    }

    if (storageBytes(items) > TOTAL_LIMIT_BYTES) {
      throw new Error("O grupo sozinho ultrapassa o espaço total do Firefox Sync.");
    }
    return items;
  }

  function encodeGroup(group, version) {
    const shared = sharedGroupData(group);
    const revision = String(version?.revision || "");
    const updatedAt = Number(version?.updatedAt);
    if (!validRecordId(shared.id) || !revision || !Number.isFinite(updatedAt)) {
      throw new Error("Registro de sincronização inválido.");
    }

    const payload = JSON.stringify(shared.tabs);
    const fragments = splitPayload(shared.id, revision, payload);
    const items = {};

    fragments.forEach((fragment, index) => {
      items[chunkKey(shared.id, index)] = chunkValue(
        shared.id,
        revision,
        index,
        fragments.length,
        fragment
      );
    });

    items[metaKey(shared.id)] = {
      format: FORMAT_VERSION,
      kind: "group",
      id: shared.id,
      revision,
      updatedAt,
      deleted: false,
      title: shared.title,
      color: shared.color,
      icon: shared.icon,
      darkerColors: shared.darkerColors,
      keepAtTop: shared.keepAtTop,
      keepAtTopOrder: shared.keepAtTopOrder,
      archived: shared.archived,
      skippedTabs: shared.skippedTabs,
      createdAt: shared.createdAt,
      chunkCount: fragments.length,
      tabsHash: hashString(payload)
    };

    return validateItems(items);
  }

  function encodeTombstone(tombstone) {
    const id = String(tombstone?.id || "");
    const revision = String(tombstone?.revision || "");
    const updatedAt = Number(tombstone?.updatedAt);
    if (!validRecordId(id) || !revision || !Number.isFinite(updatedAt)) {
      throw new Error("Exclusão sincronizada inválida.");
    }

    return validateItems({
      [metaKey(id)]: {
        format: FORMAT_VERSION,
        kind: "group",
        id,
        revision,
        updatedAt,
        deleted: true,
        deletedAt: Number.isFinite(tombstone.deletedAt) ? tombstone.deletedAt : updatedAt
      }
    });
  }

  function compactBackupGroup(group) {
    const shared = sharedGroupData(group);
    return [
      shared.id,
      shared.title,
      shared.color,
      shared.icon,
      shared.keepAtTop ? 1 : 0,
      shared.archived ? 1 : 0,
      shared.createdAt,
      shared.skippedTabs,
      shared.tabs.map((tab) =>
        tab.cookieStoreId ? [tab.url, tab.cookieStoreId] : [tab.url]
      ),
      shared.keepAtTopOrder,
      shared.darkerColors ? 1 : 0
    ];
  }

  function encodeBackup(groups, createdAt = Date.now()) {
    const cleanCreatedAt = Number.isFinite(createdAt) ? Math.trunc(createdAt) : Date.now();
    const compactGroups = Array.isArray(groups) ? groups.map(compactBackupGroup) : [];
    if (!compactGroups.length) {
      throw new Error("Não há grupos válidos para incluir no backup.");
    }

    const payload = JSON.stringify({ v: FORMAT_VERSION, g: compactGroups });
    const snapshotId = `${cleanCreatedAt.toString(36)}-${hashString(payload)}`;
    const fragments = splitBackupPayload(snapshotId, payload);
    const items = {};

    fragments.forEach((fragment, index) => {
      items[backupChunkKey(index)] = backupChunkValue(
        snapshotId,
        index,
        fragments.length,
        fragment
      );
    });
    items[backupMetaKey()] = {
      format: FORMAT_VERSION,
      kind: "backup",
      snapshotId,
      createdAt: cleanCreatedAt,
      groupCount: compactGroups.length,
      chunkCount: fragments.length,
      dataHash: hashString(payload)
    };
    return validateItems(items);
  }

  function decodeBackup(items) {
    const source = items && typeof items === "object" ? items : {};
    const meta = source[backupMetaKey()];
    if (
      !meta ||
      meta.format !== FORMAT_VERSION ||
      meta.kind !== "backup" ||
      typeof meta.snapshotId !== "string" ||
      !meta.snapshotId ||
      !Number.isFinite(meta.createdAt) ||
      !Number.isInteger(meta.chunkCount) ||
      meta.chunkCount < 1 ||
      meta.chunkCount > ITEM_COUNT_LIMIT ||
      typeof meta.dataHash !== "string"
    ) {
      return null;
    }

    const fragments = [];
    for (let index = 0; index < meta.chunkCount; index += 1) {
      const chunk = source[backupChunkKey(index)];
      if (
        !chunk ||
        chunk.format !== FORMAT_VERSION ||
        chunk.kind !== "backup-data" ||
        chunk.snapshotId !== meta.snapshotId ||
        chunk.index !== index ||
        chunk.total !== meta.chunkCount ||
        typeof chunk.data !== "string"
      ) {
        return null;
      }
      fragments.push(chunk.data);
    }

    const payload = fragments.join("");
    if (hashString(payload) !== meta.dataHash) {
      return null;
    }

    let decoded;
    try {
      decoded = JSON.parse(payload);
    } catch (_error) {
      return null;
    }
    if (!decoded || decoded.v !== FORMAT_VERSION || !Array.isArray(decoded.g)) {
      return null;
    }

    const groups = [];
    for (const compact of decoded.g) {
      if (
        !Array.isArray(compact) ||
        compact.length < 9 ||
        !validRecordId(compact[0]) ||
        !Array.isArray(compact[8])
      ) {
        return null;
      }
      const tabs = [];
      for (const compactTab of compact[8]) {
        if (!Array.isArray(compactTab) || compactTab.length < 1) {
          return null;
        }
        const tab = {
          url: typeof compactTab[0] === "string" || compactTab[0] === null
            ? compactTab[0]
            : null
        };
        if (
          typeof compactTab[1] === "string" &&
          compactTab[1].length <= MAX_COOKIE_STORE_ID_LENGTH &&
          /^firefox-container-[a-z0-9_-]+$/i.test(compactTab[1])
        ) {
          tab.cookieStoreId = compactTab[1];
        }
        tabs.push(tab);
      }
      groups.push({
        id: compact[0],
        title: String(compact[1] || ""),
        color: String(compact[2] || "grey"),
        icon: String(compact[3] || "none"),
        keepAtTop: compact[4] === 1,
        archived: compact[5] === 1,
        createdAt: Number.isFinite(compact[6]) ? compact[6] : meta.createdAt,
        keepAtTopOrder: Number.isFinite(compact[9]) ? compact[9] : null,
        darkerColors: compact[10] === 1,
        skippedTabs: Number.isInteger(compact[7]) ? Math.max(0, compact[7]) : 0,
        tabs
      });
    }
    if (groups.length !== meta.groupCount) {
      return null;
    }
    return {
      snapshotId: meta.snapshotId,
      createdAt: meta.createdAt,
      groupCount: groups.length,
      groups
    };
  }

  function validMeta(key, value) {
    return (
      value &&
      typeof value === "object" &&
      value.format === FORMAT_VERSION &&
      value.kind === "group" &&
      validRecordId(value.id) &&
      key === metaKey(value.id) &&
      typeof value.revision === "string" &&
      value.revision &&
      Number.isFinite(value.updatedAt)
    );
  }

  function decode(items) {
    const source = items && typeof items === "object" ? items : {};
    const records = [];
    const incomplete = [];

    for (const [key, meta] of Object.entries(source)) {
      if (!validMeta(key, meta)) {
        continue;
      }

      const version = { revision: meta.revision, updatedAt: meta.updatedAt };
      if (meta.deleted === true) {
        records.push({
          type: "tombstone",
          id: meta.id,
          revision: meta.revision,
          updatedAt: meta.updatedAt,
          deletedAt: Number.isFinite(meta.deletedAt) ? meta.deletedAt : meta.updatedAt
        });
        continue;
      }

      if (!Number.isInteger(meta.chunkCount) || meta.chunkCount < 1 || meta.chunkCount > ITEM_COUNT_LIMIT) {
        incomplete.push({ id: meta.id, ...version, reason: "metadados inválidos" });
        continue;
      }

      const fragments = [];
      let complete = true;
      for (let index = 0; index < meta.chunkCount; index += 1) {
        const chunk = source[chunkKey(meta.id, index)];
        if (
          !chunk ||
          chunk.format !== FORMAT_VERSION ||
          chunk.kind !== "tabs" ||
          chunk.id !== meta.id ||
          chunk.revision !== meta.revision ||
          chunk.index !== index ||
          chunk.total !== meta.chunkCount ||
          typeof chunk.data !== "string"
        ) {
          complete = false;
          break;
        }
        fragments.push(chunk.data);
      }

      const payload = fragments.join("");
      if (!complete || hashString(payload) !== meta.tabsHash) {
        incomplete.push({ id: meta.id, ...version, reason: "fragmentos incompletos" });
        continue;
      }

      let tabs;
      try {
        tabs = JSON.parse(payload);
      } catch (_error) {
        incomplete.push({ id: meta.id, ...version, reason: "abas inválidas" });
        continue;
      }

      if (!Array.isArray(tabs)) {
        incomplete.push({ id: meta.id, ...version, reason: "abas inválidas" });
        continue;
      }

      records.push({
        type: "group",
        id: meta.id,
        revision: meta.revision,
        updatedAt: meta.updatedAt,
        title: String(meta.title || ""),
        color: String(meta.color || "grey"),
        icon: String(meta.icon || "none"),
        darkerColors: typeof meta.darkerColors === "boolean" ? meta.darkerColors : undefined,
        keepAtTop: meta.keepAtTop === true,
        keepAtTopOrder: Number.isFinite(meta.keepAtTopOrder) ? meta.keepAtTopOrder : null,
        archived: meta.archived === true,
        tabs,
        skippedTabs: Number.isInteger(meta.skippedTabs) ? Math.max(0, meta.skippedTabs) : 0,
        createdAt: Number.isFinite(meta.createdAt) ? meta.createdAt : meta.updatedAt
      });
    }

    return { records, incomplete };
  }

  root.GruposSyncStore = Object.freeze({
    FORMAT_VERSION,
    KEY_PREFIX,
    BACKUP_KEY_PREFIX,
    ITEM_LIMIT_BYTES,
    TOTAL_LIMIT_BYTES,
    ITEM_COUNT_LIMIT,
    backupKeys,
    decodeBackup,
    chunkKey,
    compareVersions,
    decode,
    encodeBackup,
    encodeGroup,
    encodeTombstone,
    groupFingerprint,
    groupPrefix,
    isSyncKey,
    itemBytes,
    keysForId,
    metaKey,
    sharedGroupData,
    storageBytes
  });
})(globalThis);
