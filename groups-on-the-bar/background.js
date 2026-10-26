"use strict";

const STORAGE_KEY = "gruposNaBarraState";
const PENDING_EDITOR_KEY = "gruposNaBarraPendingEditor";
const SCHEMA_VERSION = 17;
const BOOKMARK_URL_VERSION = "1.6.0";
const COMMAND_URL_ORIGIN = "https://grupos-na-barra.invalid";
const COMMAND_URL_PREFIX = `${COMMAND_URL_ORIGIN}/toggle/`;
const COMMAND_URL_PATTERN = `${COMMAND_URL_PREFIX}*`;
const INTENTIONAL_EMPTY_URL_PREFIX = `${COMMAND_URL_ORIGIN}/empty/`;
const LIFECYCLE_SESSION_STARTED_AT_KEY = "gruposNaBarraLifecycleSessionStartedAt";
const TOOLBAR_ROOT_ID = "toolbar_____";
const MENU_PIN_GROUP = "grupos-na-barra-pin-group";
const MENU_MODIFY_GROUP = "grupos-na-barra-modify-group";
const MENU_GROUP_SELECTED = "grupos-na-barra-group-selected";
const MENU_GROUP_SELECTED_NEW = "grupos-na-barra-group-selected-new";
const MENU_GROUP_SELECTED_SEPARATOR = "grupos-na-barra-group-selected-separator";
const MENU_GROUP_SELECTED_EXISTING_PREFIX = "grupos-na-barra-group-selected-existing:";
const MENU_OPEN_VISUAL = "grupos-na-barra-open-visual";
const NO_GROUP = -1;
const SyncStore = globalThis.GruposSyncStore;
const Ui = globalThis.GruposUi;

if (!SyncStore || !Ui) {
  throw new Error("As camadas compartilhadas da extensão não foram carregadas.");
}

const VALID_COLORS = new Set([
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange"
]);

const VALID_ICONS = new Set([
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
]);
const SYNC_BACKUP_TARGET_BYTES = SyncStore.TOTAL_LIMIT_BYTES - 4 * 1024;
const AUTOMATIC_BACKUP_MIN_AGE_MS = 15 * 60 * 1000;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TOMBSTONE_ARCHIVE_MIN_AGE_MS = TRASH_RETENTION_MS;
const TOMBSTONE_ARCHIVE_PROPAGATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const TOMBSTONE_ARCHIVE_START_BYTES = 56 * 1024;
const TOMBSTONE_ARCHIVE_START_ITEMS = 260;
const DIAGNOSTIC_LIMIT = 20;
const KEEP_AT_TOP_ORDER_STEP = 1000;
const SYNC_RETRY_INTERVAL_MS = 30 * 1000;
const LIVE_LINK_MISSING_GRACE_MS = 30 * 1000;
const KEEP_AT_TOP_MOVE_RETRY_MS = 30 * 1000;
const RECORD_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_COOKIE_STORE_ID_LENGTH = 128;

const PLACEHOLDER_URLS = new Set(["about:newtab", "about:home", "about:blank"]);
const EXPECTED_URL_TTL_MS = 60_000;
const CONTEXT_SELECTION_TTL_MS = 10_000;
const NATIVE_GROUP_REMOVAL_TTL_MS = 5_000;
const NATIVE_GROUP_RESOLUTION_TIMEOUT_MS = 1_500;
const RECENTLY_CLOSED_MATCH_WINDOW_MS = 500;
const MEMBERSHIP_EVIDENCE_TTL_MS = 3_000;
const TAB_REMOVAL_EVIDENCE_TTL_MS = 3_000;
const NEW_GROUP_COLOR_ORDER = [
  "blue",
  "purple",
  "green",
  "orange",
  "red",
  "yellow",
  "pink",
  "cyan",
  "grey"
];

// O Firefox não expõe uma propriedade visual personalizada para favoritos.
// Estes sufixos Unicode são invisíveis para o usuário, mas permitem que o
// complemento visual opcional identifique a cor e desenhe o atalho como chip.
const COLOR_TOKENS = {
  grey: "\u2060\u{E0100}",
  blue: "\u2060\u{E0101}",
  red: "\u2060\u{E0102}",
  yellow: "\u2060\u{E0103}",
  green: "\u2060\u{E0104}",
  pink: "\u2060\u{E0105}",
  purple: "\u2060\u{E0106}",
  cyan: "\u2060\u{E0107}",
  orange: "\u2060\u{E0108}"
};

const ICON_TOKENS = {
  folder: "\u2060\u{E0201}",
  star: "\u2060\u{E0202}",
  chat: "\u2060\u{E0203}",
  briefcase: "\u2060\u{E0204}",
  book: "\u2060\u{E0205}",
  code: "\u2060\u{E0206}",
  globe: "\u2060\u{E0207}",
  shopping: "\u2060\u{E0208}",
  music: "\u2060\u{E0209}",
  heart: "\u2060\u{E020A}",
  idea: "\u2060\u{E020B}",
  home: "\u2060\u{E020C}",
  camera: "\u2060\u{E020D}",
  plane: "\u2060\u{E020E}",
  game: "\u2060\u{E020F}"
};

const DARKER_COLORS_TOKEN = "\u2060\u{E0210}";
const GROUP_METADATA_TOKEN_PATTERN = /\u2060[\u{E0100}-\u{E0210}]/gu;

let stateCache = null;
let stateLoadPromise = null;
let toolbarRootCache = null;
let operationQueue = Promise.resolve();
let initializationQueue = Promise.resolve();
const syncTimers = new Map();
const deferredSyncVersions = new Map();
const ignoredBookmarkRemovals = new Set();
const handledCommandRequests = new Map();
const expectedRestoredUrls = new Map();
const intentionalNativeGroupClosures = new Map();
const pendingNativeGroupRemovals = new Map();
const recentMembershipChanges = [];
const observedNativeGroupRemovals = new Map();
const nativeGroupLifecycles = new Map();
let nextNativeGroupGeneration = 1;
let tabLifecycleObservationStartedAt = Date.now();
const liveTabLifecycle = new Map();
const recentTabRemovals = [];
const dynamicGroupMenuIds = new Set();
let activeMenuInstanceId = 0;
let nextMenuInstanceId = 1;
let contextTabSelection = null;
const keptMoveFailures = new Map();

function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    groups: [],
    trash: [],
    tombstones: [],
    diagnostics: [],
    suppressedNativeGroups: [],
    settings: {
      autoPinNewGroups: true
    },
    sync: {
      lastSyncedAt: null,
      lastAttemptAt: null,
      lastError: null
    }
  };
}

function normalizeRecordId(id) {
  const value = typeof id === "string" ? id : "";
  return RECORD_ID_PATTERN.test(value) ? value : null;
}

function normalizeColor(color) {
  return VALID_COLORS.has(color) ? color : "grey";
}

function normalizeIcon(icon) {
  return VALID_ICONS.has(icon) ? icon : "none";
}

function normalizeTitle(title, fallback = "") {
  const clean = String(title || "")
    .replace(GROUP_METADATA_TOKEN_PATTERN, "")
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const truncated = Array.from(clean).slice(0, 80).join("");
  return truncated || fallback;
}

function nativeGroupTitle(group) {
  const color = normalizeColor(group?.color);
  const icon = normalizeIcon(group?.icon);
  const iconToken = icon === "none" ? "" : ICON_TOKENS[icon] || "";
  const darkerToken = group?.darkerColors === true ? DARKER_COLORS_TOKEN : "";
  return `${normalizeTitle(group?.title)}${iconToken}${COLOR_TOKENS[color]}${darkerToken}`;
}

function darkerColorsFromNativeTitle(title) {
  return String(title || "").includes(DARKER_COLORS_TOKEN);
}

function normalizeState(candidate) {
  const clean = defaultState();
  if (!candidate || typeof candidate !== "object") {
    return clean;
  }

  const previousSchemaVersion = Number.isInteger(candidate.schemaVersion)
    ? candidate.schemaVersion
    : 0;

  // A versão 1.0 começou silenciosa, com a automação desligada. A migração
  // ativa o comportamento principal uma única vez para que grupos abertos
  // realmente apareçam na barra assim que a extensão for recarregada.
  clean.settings.autoPinNewGroups =
    previousSchemaVersion < 2 ? true : candidate.settings?.autoPinNewGroups !== false;
  const normalizeNow = Date.now();
  const maxSaneTimestamp = normalizeNow + SyncStore.MAX_FUTURE_CLOCK_SKEW_MS;
  clean.sync.lastSyncedAt =
    Number.isFinite(candidate.sync?.lastSyncedAt) &&
    candidate.sync.lastSyncedAt <= maxSaneTimestamp
    ? candidate.sync.lastSyncedAt
    : null;
  clean.sync.lastAttemptAt =
    Number.isFinite(candidate.sync?.lastAttemptAt) &&
    candidate.sync.lastAttemptAt <= maxSaneTimestamp
    ? candidate.sync.lastAttemptAt
    : null;
  clean.sync.lastError =
    typeof candidate.sync?.lastError === "string" && candidate.sync.lastError
      ? candidate.sync.lastError.slice(0, 500)
      : null;
  if (Array.isArray(candidate.suppressedNativeGroups)) {
    clean.suppressedNativeGroups = candidate.suppressedNativeGroups
      .filter(
        (item) =>
          item &&
          Number.isInteger(item.groupId) &&
          Number.isInteger(item.windowId) &&
          typeof item.signature === "string"
      )
      .map((item) => ({
        groupId: item.groupId,
        windowId: item.windowId,
        title: normalizeTitle(item.title),
        color: normalizeColor(item.color),
        signature: item.signature
      }));
  }

  if (Array.isArray(candidate.groups)) {
    clean.groups = candidate.groups
      .filter((group) => group && normalizeRecordId(group.id))
      .map((group) => {
        const rawCreatedAt = Number.isFinite(group.createdAt) ? group.createdAt : normalizeNow;
        const rawUpdatedAt = Number.isFinite(group.updatedAt) ? group.updatedAt : normalizeNow;
        const rawSyncUpdatedAt = Number.isFinite(group.syncUpdatedAt) ? group.syncUpdatedAt : null;
        const futurePoisoned =
          rawCreatedAt > maxSaneTimestamp ||
          rawUpdatedAt > maxSaneTimestamp ||
          (rawSyncUpdatedAt !== null && rawSyncUpdatedAt > maxSaneTimestamp);
        let tabs = normalizeTabList(group.tabs);
        const intentionallyEmpty =
          group.intentionallyEmpty === true && !tabsHaveMeaningfulUrls(tabs);
        if (intentionallyEmpty && !tabs.length) {
          tabs = emptyGroupPlaceholderTabs();
        }
        const storedRecoveryTabs = normalizeTabList(group.recoveryTabs);
        const recoveryTabs = intentionallyEmpty
          ? cloneTabList(tabs)
          : tabsHaveMeaningfulUrls(storedRecoveryTabs)
            ? storedRecoveryTabs
            : tabsHaveMeaningfulUrls(tabs)
              ? cloneTabList(tabs)
              : [];

        return {
          id: group.id,
          title: normalizeTitle(group.title),
          color: normalizeColor(group.color),
          icon: normalizeIcon(group.icon),
          darkerColors: group.darkerColors === true,
          keepAtTop: group.keepAtTop === true,
          keepAtTopOrder: Number.isFinite(group.keepAtTopOrder) ? group.keepAtTopOrder : null,
          archived: group.archived === true,
          tabs,
          intentionallyEmpty,
          // Esta cópia é apenas local e nunca entra no Firefox Sync. Ela
          // permite recuperar um grupo se o navegador expuser about:blank
          // durante uma restauração ainda em andamento.
          recoveryTabs,
          restoreIncomplete: group.restoreIncomplete === true,
          skippedTabs: Number.isInteger(group.skippedTabs) ? Math.max(0, group.skippedTabs) : 0,
          bookmarkId: typeof group.bookmarkId === "string" ? group.bookmarkId : null,
          live:
            group.live &&
            Number.isInteger(group.live.groupId) &&
            Number.isInteger(group.live.windowId)
              ? { groupId: group.live.groupId, windowId: group.live.windowId }
              : null,
          createdAt: rawCreatedAt > maxSaneTimestamp ? normalizeNow : rawCreatedAt,
          updatedAt: rawUpdatedAt > maxSaneTimestamp ? normalizeNow : rawUpdatedAt,
          syncRevision:
            !futurePoisoned && typeof group.syncRevision === "string" && group.syncRevision
              ? group.syncRevision
              : null,
          syncUpdatedAt:
            rawSyncUpdatedAt !== null && rawSyncUpdatedAt <= maxSaneTimestamp
              ? rawSyncUpdatedAt
              : null,
          syncFingerprint:
            !futurePoisoned && typeof group.syncFingerprint === "string" && group.syncFingerprint
              ? group.syncFingerprint
              : null,
          syncPending: futurePoisoned || group.syncPending === true,
          syncError:
            !futurePoisoned && typeof group.syncError === "string" && group.syncError
              ? group.syncError.slice(0, 500)
              : null,
          liveMissingSince:
            group.live &&
            Number.isFinite(group.liveMissingSince) &&
            group.liveMissingSince <= maxSaneTimestamp
              ? group.liveMissingSince
              : null
        };
      });
  }

  if (Array.isArray(candidate.trash)) {
    const now = Date.now();
    clean.trash = candidate.trash
      .filter((item) => item && normalizeRecordId(item.id))
      .map((item) => {
        const deletedAt = Number.isFinite(item.deletedAt) ? item.deletedAt : now;
        const expiresAt = Number.isFinite(item.expiresAt)
          ? item.expiresAt
          : deletedAt + TRASH_RETENTION_MS;
        let tabs = normalizeTabList(item.tabs);
        const intentionallyEmpty =
          item.intentionallyEmpty === true && !tabsHaveMeaningfulUrls(tabs);
        if (intentionallyEmpty && !tabs.length) {
          tabs = emptyGroupPlaceholderTabs();
        }
        return {
          id: item.id,
          title: normalizeTitle(item.title),
          color: normalizeColor(item.color),
          icon: normalizeIcon(item.icon),
          darkerColors: item.darkerColors === true,
          keepAtTop: item.keepAtTop === true,
          keepAtTopOrder: Number.isFinite(item.keepAtTopOrder) ? item.keepAtTopOrder : null,
          archived: item.archived === true,
          tabs,
          intentionallyEmpty,
          skippedTabs: Number.isInteger(item.skippedTabs) ? Math.max(0, item.skippedTabs) : 0,
          bookmarkWasPinned: item.bookmarkWasPinned === true,
          restoreAsNewIdentity: item.restoreAsNewIdentity === true,
          live:
            item.live && Number.isInteger(item.live.groupId) && Number.isInteger(item.live.windowId)
              ? { groupId: item.live.groupId, windowId: item.live.windowId }
              : null,
          createdAt: Number.isFinite(item.createdAt) ? item.createdAt : deletedAt,
          updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : deletedAt,
          deletedAt,
          expiresAt
        };
      })
      .filter((item) => item.expiresAt > now)
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  if (Array.isArray(candidate.diagnostics)) {
    clean.diagnostics = candidate.diagnostics
      .filter((item) => item && Number.isFinite(item.at) && typeof item.context === "string")
      .slice(-DIAGNOSTIC_LIMIT)
      .map((item) => ({
        id: typeof item.id === "string" && item.id ? item.id : createId(),
        at: item.at,
        context: item.context.slice(0, 120),
        code: typeof item.code === "string" ? item.code.slice(0, 60) : "operationFailed",
        name: typeof item.name === "string" ? item.name.slice(0, 80) : "Error",
        stack: sanitizeDiagnosticStackText(
          typeof item.stack === "string" ? item.stack : ""
        ),
        seen: item.seen === true
      }));
  }

  // A v2.7 passa a manter uma ordem explícita para os grupos fixados no topo.
  // Na migração, preservamos exatamente a ordem histórica baseada em criação.
  const keptGroups = clean.groups
    .filter((group) => group.keepAtTop)
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left.keepAtTopOrder) ? left.keepAtTopOrder : Infinity;
      const rightOrder = Number.isFinite(right.keepAtTopOrder) ? right.keepAtTopOrder : Infinity;
      return leftOrder - rightOrder || left.createdAt - right.createdAt || left.id.localeCompare(right.id);
    });
  let nextKeepOrder = 0;
  for (const group of keptGroups) {
    if (Number.isFinite(group.keepAtTopOrder)) {
      nextKeepOrder = Math.max(nextKeepOrder, group.keepAtTopOrder + KEEP_AT_TOP_ORDER_STEP);
      continue;
    }
    group.keepAtTopOrder = nextKeepOrder;
    nextKeepOrder += KEEP_AT_TOP_ORDER_STEP;
  }
  for (const group of clean.groups) {
    // Um grupo arquivado nunca participa da faixa fixa do topo. Reforçar
    // essa invariável na normalização também protege contra estados antigos
    // ou registros remotos inconsistentes.
    if (group.archived) group.keepAtTop = false;
    if (!group.keepAtTop) group.keepAtTopOrder = null;
  }

  if (Array.isArray(candidate.tombstones)) {
    clean.tombstones = candidate.tombstones
      .filter(
        (item) =>
          item &&
          normalizeRecordId(item.id) &&
          typeof item.syncRevision === "string" &&
          item.syncRevision &&
          Number.isFinite(item.syncUpdatedAt)
      )
      .map((item) => {
        const futurePoisoned = item.syncUpdatedAt > maxSaneTimestamp;
        const syncUpdatedAt = futurePoisoned ? normalizeNow : item.syncUpdatedAt;
        return {
          id: item.id,
          deletedAt:
            Number.isFinite(item.deletedAt) && item.deletedAt <= maxSaneTimestamp
              ? item.deletedAt
              : syncUpdatedAt,
          syncRevision: futurePoisoned
            ? createSyncRevision(clean, syncUpdatedAt)
            : item.syncRevision,
          syncUpdatedAt,
          syncPending: futurePoisoned || item.syncPending === true,
          syncArchived: !futurePoisoned && item.syncArchived === true,
          syncError:
            !futurePoisoned && typeof item.syncError === "string" && item.syncError
              ? item.syncError.slice(0, 500)
              : null
        };
      });
  }

  // Um salvamento interrompido não pode deixar simultaneamente o grupo e sua
  // lápide. Conservamos a versão mais recente; em empate, a exclusão vence para
  // evitar que um grupo removido seja ressuscitado.
  clean.tombstones = clean.tombstones.filter((tombstone) => {
    const groupIndex = clean.groups.findIndex((group) => group.id === tombstone.id);
    if (groupIndex === -1) {
      return true;
    }
    if (tombstone.syncArchived) {
      clean.groups.splice(groupIndex, 1);
      return true;
    }
    const comparison = SyncStore.compareVersions(
      { updatedAt: tombstone.syncUpdatedAt, revision: tombstone.syncRevision },
      groupSyncVersion(clean.groups[groupIndex])
    );
    if (comparison >= 0) {
      clean.groups.splice(groupIndex, 1);
      return true;
    }
    return false;
  });

  return clean;
}

async function loadState() {
  if (stateCache) {
    return stateCache;
  }
  if (stateLoadPromise) {
    return stateLoadPromise;
  }

  stateLoadPromise = (async () => {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const state = normalizeState(stored[STORAGE_KEY]);
    stateCache = state;
    await pullRemoteSyncUnlocked(state);
    await persistState(state);
    return state;
  })();

  try {
    return await stateLoadPromise;
  } catch (error) {
    stateLoadPromise = null;
    stateCache = null;
    throw error;
  }
}

async function persistLocalState(state) {
  state.schemaVersion = SCHEMA_VERSION;
  await browser.storage.local.set({ [STORAGE_KEY]: state });
  await updateBrowserActionBadgeUnlocked(state);
}

async function persistState(state) {
  preparePendingSyncUnlocked(state);
  await persistLocalState(state);
  if (shouldRetryPendingSyncUnlocked(state)) {
    await flushPendingSyncUnlocked(state);
  }
  await persistLocalState(state);
}

function hasPendingSyncUnlocked(state) {
  return Boolean(
    state.groups.some((group) => group.syncPending) ||
      state.tombstones.some((item) => item.syncPending && item.syncArchived !== true)
  );
}

function shouldRetryPendingSyncUnlocked(state, now = Date.now()) {
  if (!hasPendingSyncUnlocked(state)) {
    return false;
  }
  const hasFailure = Boolean(
    state.sync.lastError ||
      state.groups.some((group) => group.syncPending && group.syncError) ||
      state.tombstones.some(
        (item) => item.syncPending && item.syncArchived !== true && item.syncError
      )
  );
  // Edições normais não esperam 30 s: a limitação serve apenas como backoff
  // depois de uma falha efetiva. Assim, navegações repetidas não martelam o
  // storage.sync quando a cota/serviço está indisponível.
  if (!hasFailure) {
    return true;
  }
  return (
    !Number.isFinite(state.sync.lastAttemptAt) ||
    now - state.sync.lastAttemptAt >= SYNC_RETRY_INTERVAL_MS
  );
}

function serial(task, errorContext = "background-task") {
  let operationState = null;
  const operation = operationQueue.then(async () => {
    operationState = await loadState();
    return task(operationState);
  });
  operationQueue = operation.catch(async (error) => {
    console.error("Groups 'On the Bar':", error);
    if (!errorContext || !operationState) return;
    try {
      appendDiagnosticUnlocked(operationState, errorContext, error);
      await persistLocalState(operationState);
    } catch (diagnosticError) {
      console.error("Groups 'On the Bar': falha ao registrar diagnóstico", diagnosticError);
    }
  });
  return operation;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSyncRevision(_state, updatedAt) {
  const nonce = createId().replace(/[^a-zA-Z0-9]/g, "").slice(-16);
  return `${Math.trunc(updatedAt).toString(36)}:${nonce}`;
}

function groupSyncVersion(group) {
  return {
    updatedAt: Number.isFinite(group.syncUpdatedAt)
      ? group.syncUpdatedAt
      : Number.isFinite(group.updatedAt)
        ? group.updatedAt
        : Number.isFinite(group.createdAt)
          ? group.createdAt
          : 0,
    revision: group.syncRevision || ""
  };
}

function tombstoneSyncVersion(tombstone) {
  return {
    updatedAt: Number.isFinite(tombstone.syncUpdatedAt) ? tombstone.syncUpdatedAt : 0,
    revision: tombstone.syncRevision || ""
  };
}

function recordSyncVersion(record) {
  return { updatedAt: record.updatedAt, revision: record.revision };
}

function preparePendingSyncUnlocked(state) {
  for (const group of state.groups) {
    const fingerprint = SyncStore.groupFingerprint(group);
    if (group.syncRevision && group.syncFingerprint === fingerprint) {
      continue;
    }

    const deferred = deferredSyncVersions.get(group.id);
    const legacyVersion = groupSyncVersion(group);
    if (
      !group.syncRevision &&
      deferred &&
      SyncStore.compareVersions(deferred, legacyVersion) >= 0
    ) {
      // Um registro remoto mais novo ainda está chegando por fragmentos. Não
      // publique uma revisão vazia e não deixe o flush tentar encodeGroup()
      // sem revision; a chegada de storage.onChanged reavalia o grupo.
      group.syncPending = false;
      group.syncError = null;
      continue;
    }

    const updatedAt = Math.max(
      Date.now(),
      Number.isFinite(group.syncUpdatedAt) ? group.syncUpdatedAt + 1 : 0,
      Number.isFinite(group.updatedAt) ? group.updatedAt : 0
    );
    group.syncUpdatedAt = updatedAt;
    group.syncRevision = createSyncRevision(state, updatedAt);
    group.syncFingerprint = fingerprint;
    group.syncPending = true;
    group.syncError = null;
    deferredSyncVersions.delete(group.id);
  }
}

function createTombstoneUnlocked(state, group) {
  const existing = state.tombstones.find((item) => item.id === group.id) || null;
  const updatedAt = Math.max(
    Date.now(),
    Number.isFinite(group.syncUpdatedAt) ? group.syncUpdatedAt + 1 : 0,
    Number.isFinite(group.updatedAt) ? group.updatedAt + 1 : 0,
    Number.isFinite(existing?.syncUpdatedAt) ? existing.syncUpdatedAt + 1 : 0
  );
  const tombstone = {
    id: group.id,
    deletedAt: updatedAt,
    syncUpdatedAt: updatedAt,
    syncRevision: createSyncRevision(state, updatedAt),
    syncPending: true,
    syncError: null
  };

  state.tombstones = state.tombstones.filter((item) => item.id !== group.id);
  state.tombstones.push(tombstone);
  return tombstone;
}

function keptOrderComparator(left, right) {
  const leftOrder = Number.isFinite(left?.keepAtTopOrder) ? left.keepAtTopOrder : Infinity;
  const rightOrder = Number.isFinite(right?.keepAtTopOrder) ? right.keepAtTopOrder : Infinity;
  return leftOrder - rightOrder || left.createdAt - right.createdAt || left.id.localeCompare(right.id);
}

function keptGroupsInOrder(state) {
  return state.groups.filter((group) => group.keepAtTop).slice().sort(keptOrderComparator);
}

function nextKeepAtTopOrder(state) {
  const kept = keptGroupsInOrder(state);
  if (!kept.length) return 0;
  const last = kept.at(-1);
  return (Number.isFinite(last.keepAtTopOrder) ? last.keepAtTopOrder : 0) + KEEP_AT_TOP_ORDER_STEP;
}

function renumberKeptGroupsUnlocked(state, orderedIds = null) {
  const byId = new Map(state.groups.map((group) => [group.id, group]));
  const current = keptGroupsInOrder(state);
  let ordered = current;
  if (Array.isArray(orderedIds)) {
    const seen = new Set();
    ordered = [];
    for (const id of orderedIds) {
      const group = byId.get(String(id));
      if (group?.keepAtTop && !seen.has(group.id)) {
        ordered.push(group);
        seen.add(group.id);
      }
    }
    for (const group of current) {
      if (!seen.has(group.id)) ordered.push(group);
    }
  }

  const now = Date.now();
  let changed = false;
  ordered.forEach((group, index) => {
    const desired = index * KEEP_AT_TOP_ORDER_STEP;
    if (group.keepAtTopOrder !== desired) {
      group.keepAtTopOrder = desired;
      group.updatedAt = Math.max(Number(group.updatedAt) || 0, now);
      changed = true;
    }
  });
  for (const group of state.groups) {
    if (!group.keepAtTop && group.keepAtTopOrder !== null) {
      group.keepAtTopOrder = null;
      changed = true;
    }
  }
  return changed;
}

function purgeExpiredTrashUnlocked(state, now = Date.now()) {
  const before = state.trash.length;
  state.trash = state.trash.filter((item) => Number(item.expiresAt) > now);
  return state.trash.length !== before;
}

async function bookmarkWasPinnedUnlocked(group) {
  if (!group?.bookmarkId) return false;
  const bookmark = await getBookmark(group.bookmarkId);
  if (!bookmark) return false;
  return bookmark.parentId === (await getToolbarRootId());
}

async function stashTrashCopyUnlocked(
  state,
  group,
  {
    deletedAt = Date.now(),
    expiresAt = deletedAt + TRASH_RETENTION_MS,
    restoreAsNewIdentity = false
  } = {}
) {
  const tabs = cloneTabList(recoveryBaseline(group));
  const entry = {
    id: group.id,
    title: group.title,
    color: group.color,
    icon: group.icon,
    darkerColors: group.darkerColors === true,
    keepAtTop: group.keepAtTop === true,
    keepAtTopOrder: Number.isFinite(group.keepAtTopOrder) ? group.keepAtTopOrder : null,
    archived: group.archived === true,
    tabs,
    intentionallyEmpty: group.intentionallyEmpty === true,
    skippedTabs: group.skippedTabs,
    bookmarkWasPinned: await bookmarkWasPinnedUnlocked(group),
    restoreAsNewIdentity: restoreAsNewIdentity === true,
    live: group.live ? { ...group.live } : null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    deletedAt,
    expiresAt
  };
  state.trash = state.trash.filter((item) => item.id !== group.id);
  state.trash.unshift(entry);
  return entry;
}

async function softDeleteSavedGroupUnlocked(state, group) {
  if (group.live) {
    await updateSavedFromLiveUnlocked(group);
  }
  const deletedAt = Date.now();
  await stashTrashCopyUnlocked(state, group, { deletedAt });
  if (group.live) {
    const snapshot = await snapshotNativeGroup(group.live.groupId);
    if (snapshot && snapshot.windowId === group.live.windowId) {
      clearMatchingSuppressions(state, snapshot);
      state.suppressedNativeGroups.push(suppressionFromSnapshot(snapshot));
    }
  }
  await removeBookmark(group);
  createTombstoneUnlocked(state, group);
  state.groups = state.groups.filter((item) => item.id !== group.id);
  renumberKeptGroupsUnlocked(state);
  await reconcileBookmarkDuplicatesUnlocked(state);
  return { deleted: true, recoverableUntil: deletedAt + TRASH_RETENTION_MS };
}

async function restoreTrashGroupUnlocked(state, savedId) {
  purgeExpiredTrashUnlocked(state);
  const index = state.trash.findIndex((item) => item.id === savedId);
  if (index === -1) {
    throw new Error("Esse grupo não está mais na lixeira.");
  }
  const entry = state.trash[index];
  const now = Date.now();
  const archivedTombstone = state.tombstones.find(
    (item) => item.id === entry.id && item.syncArchived === true
  );
  const restoreAsNewIdentity = entry.restoreAsNewIdentity === true || Boolean(archivedTombstone);
  const restoredId = restoreAsNewIdentity ? createId() : entry.id;
  const restoreUpdatedAt = Math.max(
    now,
    Number.isFinite(entry.deletedAt) ? entry.deletedAt + 1 : 0
  );
  const restored = {
    id: restoredId,
    title: entry.title,
    color: entry.color,
    icon: entry.icon,
    darkerColors: entry.darkerColors === true,
    keepAtTop: entry.keepAtTop === true,
    keepAtTopOrder: Number.isFinite(entry.keepAtTopOrder) ? entry.keepAtTopOrder : null,
    archived: entry.archived === true,
    tabs: cloneTabList(entry.tabs),
    intentionallyEmpty: entry.intentionallyEmpty === true,
    recoveryTabs: cloneTabList(entry.tabs),
    restoreIncomplete: false,
    skippedTabs: entry.skippedTabs,
    bookmarkId: null,
    live: null,
    createdAt: restoreAsNewIdentity ? now : entry.createdAt,
    updatedAt: restoreUpdatedAt,
    syncRevision: null,
    syncUpdatedAt: null,
    syncFingerprint: null,
    syncPending: true,
    syncError: null
  };

  if (entry.live) {
    const snapshot = await snapshotNativeGroup(entry.live.groupId);
    if (snapshot && snapshot.windowId === entry.live.windowId && snapshotMatchesSavedGroup(restored, snapshot)) {
      restored.live = { ...entry.live };
      state.suppressedNativeGroups = state.suppressedNativeGroups.filter(
        (item) => item.groupId !== entry.live.groupId || item.windowId !== entry.live.windowId
      );
    }
  }

  state.groups = state.groups.filter((group) => group.id !== restored.id);
  state.groups.push(restored);
  state.trash.splice(index, 1);
  if (!restoreAsNewIdentity) {
    state.tombstones = state.tombstones.filter((item) => item.id !== restored.id);
  }
  renumberKeptGroupsUnlocked(state);

  if (entry.bookmarkWasPinned && !restored.archived) {
    await ensureBookmark(restored, { createIfMissing: true, moveToToolbar: true });
  }
  if (restored.keepAtTop && restored.live) {
    await moveKeptGroupsToTopUnlocked(state, restored.live.windowId);
  }
  return { restored: true, savedId: restored.id, replacedDeletedIdentity: restoreAsNewIdentity };
}

function permanentlyDeleteTrashGroupUnlocked(state, savedId) {
  purgeExpiredTrashUnlocked(state);
  const before = state.trash.length;
  state.trash = state.trash.filter((item) => item.id !== savedId);
  if (state.trash.length === before) {
    throw new Error("Esse grupo não está mais na lixeira.");
  }
  return { deleted: true };
}

function sanitizeDiagnosticStackText(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\r\n)]+/gi, "[url]")
    .replace(/moz-extension:\/\/[^\r\n)]+/gi, "moz-extension://[extension]")
    .replace(/file:\/\/\/[^\r\n)]+/gi, "file:///[local-path]")
    .replace(/\b[A-Za-z]:\\[^\r\n)]+/g, "[local-path]")
    .replace(/(^|[\s(])\/(?!\/)[^\r\n)]*/gm, "$1[local-path]")
    .slice(0, 4000);
}

function safeDiagnosticStack(error) {
  const raw = typeof error?.stack === "string" ? error.stack : "";
  const lines = raw.split(/\r?\n/);
  // Error.stack normalmente começa repetindo a mensagem da exceção. Essa
  // mensagem pode ter texto vindo do Firefox (e, em casos extremos, conteúdo
  // relacionado a uma aba/grupo). O relatório já possui código, contexto e
  // nome do erro, então removemos essa primeira linha e conservamos somente
  // os frames técnicos.
  if (lines.length) {
    const first = lines[0];
    const message = String(error?.message || "");
    if ((message && first.includes(message)) || /^[A-Za-z]*Error(?::|$)/.test(first.trim())) {
      lines.shift();
    }
  }
  return sanitizeDiagnosticStackText(lines.join("\n"));
}

function safeIsoTimestamp(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function appendDiagnosticUnlocked(state, context, error) {
  const entry = {
    id: createId(),
    at: Date.now(),
    context: String(context || "background").slice(0, 120),
    code: publicErrorCode(error),
    name: String(error?.name || "Error").slice(0, 80),
    stack: safeDiagnosticStack(error),
    seen: false
  };
  state.diagnostics.push(entry);
  state.diagnostics = state.diagnostics.slice(-DIAGNOSTIC_LIMIT);
  return entry;
}

function hasDiagnosticAlert(state) {
  return Boolean(
    state.diagnostics.some((item) => !item.seen) ||
      state.sync.lastError ||
      state.groups.some((group) => group.syncError) ||
      state.tombstones.some((item) => item.syncError)
  );
}

async function updateBrowserActionBadgeUnlocked(state) {
  if (!browser.browserAction?.setBadgeText) return;
  try {
    const show = hasDiagnosticAlert(state);
    await browser.browserAction.setBadgeText({ text: show ? "!" : "" });
    if (show && browser.browserAction.setBadgeBackgroundColor) {
      await browser.browserAction.setBadgeBackgroundColor({ color: "#d70022" });
    }
  } catch (_error) {
    // Um badge indisponível não pode impedir a persistência dos grupos.
  }
}

async function diagnosticReportUnlocked(state) {
  let browserInfo = {};
  let platformInfo = {};
  try {
    browserInfo = (await browser.runtime.getBrowserInfo?.()) || {};
  } catch (_error) {}
  try {
    platformInfo = (await browser.runtime.getPlatformInfo?.()) || {};
  } catch (_error) {}
  const syncStorage = await readSyncStorageStatusUnlocked();
  return {
    format: "grupos-na-barra-diagnostic",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    extension: {
      version: browser.runtime.getManifest?.().version || "unknown"
    },
    browser: {
      name: String(browserInfo.name || "Firefox"),
      version: String(browserInfo.version || "unknown"),
      buildId: String(browserInfo.buildID || "")
    },
    platform: {
      os: String(platformInfo.os || "unknown"),
      arch: String(platformInfo.arch || "unknown")
    },
    state: {
      savedGroups: state.groups.length,
      archivedGroups: state.groups.filter((group) => group.archived).length,
      trashGroups: state.trash.length,
      syncPending:
        state.groups.filter((group) => group.syncPending).length +
        state.tombstones.filter((item) => item.syncPending).length,
      syncUsedBytes: syncStorage.usedBytes,
      syncTotalBytes: syncStorage.totalBytes,
      activeSyncError: Boolean(
        state.sync.lastError ||
          state.groups.some((group) => group.syncError) ||
          state.tombstones.some((item) => item.syncError)
      )
    },
    errors: state.diagnostics.map((item) => ({
      at: safeIsoTimestamp(item.at),
      context: item.context,
      code: item.code,
      name: item.name,
      stack: item.stack
    })),
    privacy: {
      includesUrls: false,
      includesTabTitles: false,
      includesGroupTitles: false,
      includesBookmarks: false,
      includesHistory: false
    }
  };
}

function normalizedRemoteGroup(record) {
  const normalized = normalizeState({
    schemaVersion: SCHEMA_VERSION,
    groups: [
      {
        id: record.id,
        title: record.title,
        color: record.color,
        icon: record.icon,
        darkerColors: record.darkerColors,
        keepAtTop: record.keepAtTop,
        keepAtTopOrder: record.keepAtTopOrder,
        archived: record.archived,
        tabs: record.tabs,
        intentionallyEmpty: record.intentionallyEmpty,
        skippedTabs: record.skippedTabs,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }
    ]
  }).groups[0];
  // normalizeState() também cuida da migração local e, por isso, atribui uma
  // ordem a grupos antigos que ainda não tinham keepAtTopOrder. Um registro
  // remoto precisa preservar a distinção entre "ordem realmente sincronizada"
  // e "campo ausente em uma versão antiga", para que um Firefox ainda na
  // v2.6.x não desfaça uma ordenação feita pela v2.7 ao apenas renomear o grupo.
  if (normalized?.keepAtTop && !Number.isFinite(record.keepAtTopOrder)) {
    normalized.keepAtTopOrder = null;
  }
  return normalized || null;
}

async function suppressLiveGroupUnlocked(state, group) {
  if (!group?.live) {
    return;
  }
  const snapshot = await snapshotNativeGroup(group.live.groupId);
  if (snapshot && snapshot.windowId === group.live.windowId) {
    clearMatchingSuppressions(state, snapshot);
    state.suppressedNativeGroups.push(suppressionFromSnapshot(snapshot));
  }
}

async function applyRemoteGroupUnlocked(state, record) {
  const incoming = normalizedRemoteGroup(record);
  if (!incoming) {
    return false;
  }

  const remoteVersion = recordSyncVersion(record);
  const remoteFingerprint = SyncStore.groupFingerprint(incoming);
  const tombstoneIndex = state.tombstones.findIndex((item) => item.id === record.id);
  if (tombstoneIndex !== -1) {
    const tombstone = state.tombstones[tombstoneIndex];
    if (tombstone.syncArchived) {
      return false;
    }
    const comparison = SyncStore.compareVersions(tombstoneSyncVersion(tombstone), remoteVersion);
    if (comparison >= 0) {
      if (comparison > 0) {
        tombstone.syncPending = true;
      }
      return comparison > 0;
    }
    state.tombstones.splice(tombstoneIndex, 1);
  }

  const local = state.groups.find((group) => group.id === record.id);
  if (!local) {
    state.groups.push({
      ...incoming,
      bookmarkId: null,
      live: null,
      syncRevision: record.revision,
      syncUpdatedAt: record.updatedAt,
      syncFingerprint: remoteFingerprint,
      syncPending: false,
      syncError: null
    });
    return true;
  }

  const comparison = SyncStore.compareVersions(remoteVersion, groupSyncVersion(local));
  const localFingerprint = SyncStore.groupFingerprint(local);
  const remoteWinsTie = comparison === 0 && remoteFingerprint > localFingerprint;
  if (comparison > 0 || remoteWinsTie) {
    if (incoming.archived && local.live) {
      // "Arquivar grupos fechados" em outro computador não pode fechar um
      // grupo que está ativamente aberto aqui. O uso local é evidência mais
      // forte que a intenção remota de arquivar; preservamos o snapshot vivo e
      // publicamos uma revisão posterior, mantendo o grupo desarquivado.
      await updateSavedFromLiveUnlocked(local);
      local.archived = false;
      local.updatedAt = Math.max(Number(local.updatedAt) || 0, Date.now());
      local.syncUpdatedAt = Math.max(
        Number.isFinite(local.syncUpdatedAt) ? local.syncUpdatedAt : 0,
        record.updatedAt
      );
      local.syncRevision = null;
      local.syncFingerprint = null;
      local.syncPending = true;
      local.syncError = null;
      return true;
    }

    const baseline = recoveryBaseline(local);
    if (!incoming.intentionallyEmpty && wouldLoseRestorableUrls(baseline, incoming.tabs)) {
      // Um dispositivo pode publicar placeholders se o Firefox Sync rodar no
      // intervalo entre tabs.create() e o commit das navegações. Conservamos
      // a última cópia útil e publicamos uma revisão nova para reparar o Sync.
      local.tabs = cloneTabList(baseline);
      local.recoveryTabs = cloneTabList(baseline);
      local.updatedAt = Math.max(local.updatedAt, Date.now());
      local.syncUpdatedAt = Math.max(
        Number.isFinite(local.syncUpdatedAt) ? local.syncUpdatedAt : 0,
        record.updatedAt
      );
      local.syncFingerprint = null;
      local.syncPending = true;
      local.syncError = null;
      return true;
    }

    if (incoming.archived) {
      await removeBookmark(local);
    }

    const incomingKeepOrder = incoming.keepAtTop
      ? Number.isFinite(incoming.keepAtTopOrder)
        ? incoming.keepAtTopOrder
        : local.keepAtTop && Number.isFinite(local.keepAtTopOrder)
          ? local.keepAtTopOrder
          : null
      : null;
    const incomingDarkerColors =
      typeof record.darkerColors === "boolean" ? incoming.darkerColors : local.darkerColors === true;

    const mergedIncomingTabs = mergeLocalTabDisplayMetadata(local.tabs, incoming.tabs);
    Object.assign(local, {
      title: incoming.title,
      color: incoming.color,
      icon: incoming.icon,
      darkerColors: incomingDarkerColors,
      keepAtTop: incoming.keepAtTop,
      keepAtTopOrder: incomingKeepOrder,
      archived: incoming.archived,
      tabs: cloneTabList(mergedIncomingTabs),
      intentionallyEmpty: incoming.intentionallyEmpty === true,
      recoveryTabs: incoming.intentionallyEmpty
        ? cloneTabList(mergedIncomingTabs)
        : tabsHaveMeaningfulUrls(incoming.tabs)
          ? cloneTabList(mergeLocalTabDisplayMetadata(local.recoveryTabs, incoming.tabs))
          : local.recoveryTabs,
      restoreIncomplete: false,
      skippedTabs: incoming.skippedTabs,
      createdAt: incoming.createdAt,
      updatedAt: Math.max(local.updatedAt, record.updatedAt),
      syncRevision: record.revision,
      syncUpdatedAt: record.updatedAt,
      syncFingerprint: remoteFingerprint,
      syncPending: false,
      syncError: null
    });
    return true;
  }

  if (comparison < 0 || (comparison === 0 && remoteFingerprint !== localFingerprint)) {
    local.syncPending = true;
    return true;
  }

  const metadataChanged =
    local.syncRevision !== record.revision ||
    local.syncUpdatedAt !== record.updatedAt ||
    local.syncFingerprint !== remoteFingerprint ||
    local.syncPending ||
    local.syncError;
  local.syncRevision = record.revision;
  local.syncUpdatedAt = record.updatedAt;
  local.syncFingerprint = remoteFingerprint;
  local.syncPending = false;
  local.syncError = null;
  return Boolean(metadataChanged);
}

async function applyRemoteArchivedTombstoneUnlocked(state, id) {
  const normalizedId = normalizeRecordId(id);
  if (!normalizedId) {
    return false;
  }

  let changed = false;
  const groupIndex = state.groups.findIndex((group) => group.id === normalizedId);
  if (groupIndex !== -1) {
    const group = state.groups[groupIndex];
    const arrivedAt = Date.now();
    await stashTrashCopyUnlocked(state, group, {
      deletedAt: arrivedAt,
      expiresAt: arrivedAt + TRASH_RETENTION_MS,
      restoreAsNewIdentity: true
    });
    await suppressLiveGroupUnlocked(state, group);
    await removeBookmark(group);
    state.groups.splice(groupIndex, 1);
    renumberKeptGroupsUnlocked(state);
    changed = true;
  }

  let tombstone = state.tombstones.find((item) => item.id === normalizedId) || null;
  if (!tombstone) {
    tombstone = {
      id: normalizedId,
      deletedAt: Date.now(),
      syncRevision: `archive:${SyncStore.hashString64(normalizedId)}`,
      syncUpdatedAt: 0,
      syncPending: false,
      syncArchived: true,
      syncError: null
    };
    state.tombstones.push(tombstone);
    return true;
  }

  if (tombstone.syncArchived !== true || tombstone.syncPending || tombstone.syncError) {
    tombstone.syncArchived = true;
    tombstone.syncPending = false;
    tombstone.syncError = null;
    changed = true;
  }
  return changed;
}

async function applyRemoteTombstoneUnlocked(state, record) {
  const remoteVersion = recordSyncVersion(record);
  const localGroupIndex = state.groups.findIndex((group) => group.id === record.id);
  if (localGroupIndex !== -1) {
    const localGroup = state.groups[localGroupIndex];
    const comparison = SyncStore.compareVersions(remoteVersion, groupSyncVersion(localGroup));
    if (comparison < 0) {
      localGroup.syncPending = true;
      return true;
    }

    const deletedAt = Number.isFinite(record.deletedAt) ? record.deletedAt : record.updatedAt;
    // A exclusão remota continua exibindo a data original, mas o computador
    // que acabou de recebê-la ganha sua própria janela local de recuperação.
    // Isso é deliberadamente conservador: Sync pode apagar o grupo local, mas
    // não remove no mesmo instante a última cópia que este dispositivo possuía.
    await stashTrashCopyUnlocked(state, localGroup, {
      deletedAt,
      expiresAt: Date.now() + TRASH_RETENTION_MS,
      restoreAsNewIdentity: true
    });
    await suppressLiveGroupUnlocked(state, localGroup);
    await removeBookmark(localGroup);
    state.groups.splice(localGroupIndex, 1);
    renumberKeptGroupsUnlocked(state);
  }

  const localIndex = state.tombstones.findIndex((item) => item.id === record.id);
  if (localIndex === -1) {
    state.tombstones.push({
      id: record.id,
      deletedAt: record.deletedAt,
      syncRevision: record.revision,
      syncUpdatedAt: record.updatedAt,
      syncPending: false,
      syncError: null
    });
    return true;
  }

  const local = state.tombstones[localIndex];
  const comparison = SyncStore.compareVersions(remoteVersion, tombstoneSyncVersion(local));
  if (comparison > 0) {
    Object.assign(local, {
      deletedAt: record.deletedAt,
      syncRevision: record.revision,
      syncUpdatedAt: record.updatedAt,
      syncPending: false,
      syncError: null
    });
    return true;
  }
  if (comparison < 0) {
    local.syncPending = true;
    return true;
  }

  const changed = local.syncPending || local.syncError;
  local.syncPending = false;
  local.syncError = null;
  return Boolean(changed);
}

function syncCoreItemsWithoutBackup(items) {
  const backupKeys = new Set(SyncStore.backupKeys(items));
  return Object.fromEntries(
    Object.entries(items || {}).filter(([key]) => !backupKeys.has(key))
  );
}

function syncArchiveWouldFit(currentItems, archiveItems) {
  const projected = { ...currentItems, ...archiveItems };
  return (
    Object.keys(projected).length <= SyncStore.ITEM_COUNT_LIMIT &&
    SyncStore.storageBytes(projected) <= SyncStore.TOTAL_LIMIT_BYTES
  );
}

async function compactOldRemoteTombstonesUnlocked(state, currentItems, now = Date.now()) {
  const archiveKeys = SyncStore.tombstoneArchiveKeys(currentItems);
  const archive = archiveKeys.length ? SyncStore.decodeTombstoneArchive(currentItems) : null;
  if (archiveKeys.length && !archive) {
    state.sync.lastError =
      "O arquivo compacto de exclusões do Firefox Sync está incompleto ou corrompido; nenhuma convergência destrutiva foi aplicada.";
    return false;
  }

  let changed = false;
  const archivedAtById = new Map(
    (archive?.entries || []).map((entry) => [entry.id, entry.archivedAt])
  );
  let individual = SyncStore.individualTombstones(currentItems, now);

  // Fase 2: uma lápide v1 só é removida depois que o seu segmento compacto
  // ficou publicado por uma semana. Assim o marcador novo tem tempo de se
  // propagar antes de o marcador compatível com clientes antigos desaparecer.
  const matureArchivedIds = individual
    .filter((record) => {
      const archivedAt = archivedAtById.get(record.id);
      return (
        Number.isFinite(archivedAt) &&
        now - archivedAt >= TOMBSTONE_ARCHIVE_PROPAGATION_GRACE_MS
      );
    })
    .map((record) => record.id);

  if (matureArchivedIds.length) {
    const keys = matureArchivedIds.flatMap((id) => SyncStore.keysForId(currentItems, id));
    await removeSyncKeysUnlocked(currentItems, keys);
    for (const id of matureArchivedIds) {
      const local = state.tombstones.find((item) => item.id === id);
      if (local) {
        local.syncArchived = true;
        local.syncPending = false;
        local.syncError = null;
      }
    }
    changed = true;
    individual = SyncStore.individualTombstones(currentItems, now);
  }

  const coreItems = syncCoreItemsWithoutBackup(currentItems);
  if (
    Object.keys(coreItems).length < TOMBSTONE_ARCHIVE_START_ITEMS &&
    SyncStore.storageBytes(coreItems) < TOMBSTONE_ARCHIVE_START_BYTES
  ) {
    return changed;
  }

  const alreadyArchived = new Set(archive?.ids || []);
  const candidates = individual
    .filter((record) => {
      if (alreadyArchived.has(record.id)) return false;
      if (now - record.deletedAt < TOMBSTONE_ARCHIVE_MIN_AGE_MS) return false;
      const local = state.tombstones.find((item) => item.id === record.id);
      return !local?.syncPending;
    })
    .sort((left, right) => left.deletedAt - right.deletedAt || left.id.localeCompare(right.id));

  if (!candidates.length) {
    return changed;
  }

  // O arquivo é escrito antes de qualquer remoção v1. Se não houver espaço
  // temporário para essa duplicação segura, o backup automático opcional é a
  // primeira coisa sacrificada; nunca apagamos uma lápide para "abrir espaço".
  let workingCandidates = candidates;
  let archiveItems = SyncStore.encodeTombstoneArchive(
    workingCandidates.map((record) => record.id),
    now
  );
  if (!syncArchiveWouldFit(currentItems, archiveItems) && SyncStore.backupKeys(currentItems).length) {
    await removeAutomaticBackupUnlocked(currentItems);
  }

  if (!syncArchiveWouldFit(currentItems, archiveItems)) {
    let low = 1;
    let high = candidates.length;
    let best = 0;
    let bestItems = null;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidateItems = SyncStore.encodeTombstoneArchive(
        candidates.slice(0, middle).map((record) => record.id),
        now
      );
      if (syncArchiveWouldFit(currentItems, candidateItems)) {
        best = middle;
        bestItems = candidateItems;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (!best || !bestItems) {
      return changed;
    }
    workingCandidates = candidates.slice(0, best);
    archiveItems = bestItems;
  }

  await browser.storage.sync.set(archiveItems);
  Object.assign(currentItems, archiveItems);
  for (const record of workingCandidates) {
    const local = state.tombstones.find((item) => item.id === record.id);
    if (local) {
      local.syncArchived = true;
      local.syncPending = false;
      local.syncError = null;
    }
  }
  return true;
}

async function pullRemoteSyncUnlocked(state) {
  if (!browser.storage?.sync?.get) {
    state.sync.lastError = "Esta versão do Firefox não oferece storage.sync para a extensão.";
    return false;
  }

  try {
    const items = await browser.storage.sync.get(null);
    const decoded = SyncStore.decode(items);
    if (decoded.archiveCorrupt) {
      state.sync.lastError =
        "O arquivo compacto de exclusões do Firefox Sync está incompleto ou corrompido; o estado local foi preservado.";
      return false;
    }
    deferredSyncVersions.clear();
    for (const incomplete of decoded.incomplete) {
      deferredSyncVersions.set(incomplete.id, recordSyncVersion(incomplete));
    }

    let changed = false;
    for (const id of decoded.archivedIds || []) {
      changed = (await applyRemoteArchivedTombstoneUnlocked(state, id)) || changed;
    }
    for (const record of decoded.records) {
      changed =
        (record.type === "tombstone"
          ? await applyRemoteTombstoneUnlocked(state, record)
          : await applyRemoteGroupUnlocked(state, record)) || changed;
    }

    // Exclusões legítimas usam lápides explícitas. Se um registro completo
    // desaparecer do storage.sync sem uma lápide (limpeza manual, corrupção ou
    // perda parcial do serviço), a cópia local continua sendo a fonte segura e
    // deve repovoar o remoto. Registros incompletos ficam em espera para não
    // sobrescrever uma sincronização que ainda está chegando por fragmentos.
    const remoteIds = new Set([
      ...decoded.records.map((record) => record.id),
      ...(decoded.archivedIds || [])
    ]);
    const incompleteIds = new Set(decoded.incomplete.map((record) => record.id));
    for (const group of state.groups) {
      if (!remoteIds.has(group.id) && !incompleteIds.has(group.id) && !group.syncPending) {
        group.syncPending = true;
        changed = true;
      }
    }
    for (const tombstone of state.tombstones) {
      if (!remoteIds.has(tombstone.id) && !incompleteIds.has(tombstone.id) && !tombstone.syncPending) {
        if (tombstone.syncArchived) {
          tombstone.syncArchived = false;
        }
        tombstone.syncPending = true;
        changed = true;
      }
    }

    if (!decoded.incomplete.length) {
      changed = (await compactOldRemoteTombstonesUnlocked(state, items)) || changed;
    }

    if (/^Não foi possível (ler|acessar) o Firefox Sync/.test(state.sync.lastError || "")) {
      state.sync.lastError = null;
    }
    return changed;
  } catch (error) {
    state.sync.lastError = `Não foi possível ler o Firefox Sync: ${String(
      error?.message || error
    ).slice(0, 300)}`;
    return false;
  }
}

function projectedSyncItems(currentItems, id, replacementItems) {
  const projected = { ...currentItems };
  for (const key of SyncStore.keysForId(projected, id)) {
    delete projected[key];
  }
  Object.assign(projected, replacementItems);
  return projected;
}

async function removeSyncKeysUnlocked(currentItems, keys) {
  if (!keys.length) {
    return;
  }
  await browser.storage.sync.remove(keys);
  for (const key of keys) {
    delete currentItems[key];
  }
}

async function removeAutomaticBackupUnlocked(currentItems) {
  await removeSyncKeysUnlocked(currentItems, SyncStore.backupKeys(currentItems));
}

async function refreshAutomaticBackupUnlocked(currentItems) {
  const existingBackup = SyncStore.decodeBackup(currentItems);
  if (
    existingBackup &&
    Date.now() - existingBackup.createdAt < AUTOMATIC_BACKUP_MIN_AGE_MS
  ) {
    return false;
  }
  const decoded = SyncStore.decode(currentItems);
  if (decoded.incomplete.length) {
    return false;
  }
  const groups = decoded.records.filter((record) => record.type === "group");
  if (!groups.length) {
    return false;
  }

  let backupItems;
  try {
    backupItems = SyncStore.encodeBackup(groups, Date.now());
  } catch (_error) {
    return false;
  }

  const previousKeys = SyncStore.backupKeys(currentItems);
  const projected = { ...currentItems };
  for (const key of previousKeys) {
    delete projected[key];
  }
  Object.assign(projected, backupItems);

  if (
    Object.keys(projected).length > SyncStore.ITEM_COUNT_LIMIT ||
    SyncStore.storageBytes(projected) > SYNC_BACKUP_TARGET_BYTES
  ) {
    return false;
  }

  try {
    await browser.storage.sync.set(backupItems);
    const staleKeys = previousKeys.filter((key) => !Object.hasOwn(backupItems, key));
    await removeSyncKeysUnlocked(currentItems, staleKeys);
    for (const key of previousKeys) {
      delete currentItems[key];
    }
    Object.assign(currentItems, backupItems);
    return true;
  } catch (_error) {
    // O backup é opcional: uma falha aqui nunca deve bloquear os grupos atuais.
    return false;
  }
}

async function replaceRemoteRecordUnlocked(currentItems, id, replacementItems) {
  let projected = projectedSyncItems(currentItems, id, replacementItems);
  if (
    SyncStore.backupKeys(currentItems).length &&
    (Object.keys(projected).length > SyncStore.ITEM_COUNT_LIMIT ||
      SyncStore.storageBytes(projected) > SYNC_BACKUP_TARGET_BYTES)
  ) {
    await removeAutomaticBackupUnlocked(currentItems);
    projected = projectedSyncItems(currentItems, id, replacementItems);
  }
  if (Object.keys(projected).length > SyncStore.ITEM_COUNT_LIMIT) {
    throw new Error("O limite de 512 itens do Firefox Sync foi atingido.");
  }
  if (SyncStore.storageBytes(projected) > SyncStore.TOTAL_LIMIT_BYTES) {
    throw new Error("O limite de 100 KiB do Firefox Sync foi atingido.");
  }

  const previousKeys = SyncStore.keysForId(currentItems, id);
  await browser.storage.sync.set(replacementItems);
  const staleKeys = previousKeys.filter((key) => !Object.hasOwn(replacementItems, key));
  if (staleKeys.length) {
    await browser.storage.sync.remove(staleKeys);
  }

  for (const key of previousKeys) {
    delete currentItems[key];
  }
  Object.assign(currentItems, replacementItems);
}

async function flushPendingSyncUnlocked(state) {
  if (!browser.storage?.sync?.get || !browser.storage.sync?.set) {
    return;
  }

  const pendingGroups = state.groups.filter((group) => group.syncPending);
  const pendingTombstones = state.tombstones.filter(
    (item) => item.syncPending && item.syncArchived !== true
  );
  if (!pendingGroups.length && !pendingTombstones.length) {
    return;
  }

  state.sync.lastAttemptAt = Date.now();

  let currentItems;
  try {
    currentItems = await browser.storage.sync.get(null);
  } catch (error) {
    state.sync.lastError = `Não foi possível acessar o Firefox Sync: ${String(
      error?.message || error
    ).slice(0, 300)}`;
    return;
  }

  await refreshAutomaticBackupUnlocked(currentItems);

  const errors = [];
  for (const group of pendingGroups) {
    try {
      const items = SyncStore.encodeGroup(group, groupSyncVersion(group));
      await replaceRemoteRecordUnlocked(currentItems, group.id, items);
      group.syncPending = false;
      group.syncError = null;
      state.sync.lastSyncedAt = Date.now();
    } catch (error) {
      group.syncError = String(error?.message || error).slice(0, 500);
      errors.push(`“${group.title}”: ${group.syncError}`);
    }
  }

  for (const tombstone of pendingTombstones) {
    try {
      const items = SyncStore.encodeTombstone({
        id: tombstone.id,
        deletedAt: tombstone.deletedAt,
        revision: tombstone.syncRevision,
        updatedAt: tombstone.syncUpdatedAt
      });
      await replaceRemoteRecordUnlocked(currentItems, tombstone.id, items);
      tombstone.syncPending = false;
      tombstone.syncError = null;
      state.sync.lastSyncedAt = Date.now();
    } catch (error) {
      tombstone.syncError = String(error?.message || error).slice(0, 500);
      errors.push(`exclusão ${tombstone.id}: ${tombstone.syncError}`);
    }
  }

  state.sync.lastError = errors.length ? errors.join(" ").slice(0, 500) : null;
}

async function readSyncStorageStatusUnlocked() {
  if (!browser.storage?.sync?.get) {
    return {
      usedBytes: 0,
      totalBytes: SyncStore.TOTAL_LIMIT_BYTES,
      usagePercent: 0,
      backupAvailable: false,
      backupCreatedAt: null,
      backupGroupCount: 0
    };
  }

  try {
    const items = await browser.storage.sync.get(null);
    let usedBytes = SyncStore.storageBytes(items);
    if (browser.storage.sync.getBytesInUse) {
      try {
        const measured = await browser.storage.sync.getBytesInUse(null);
        if (Number.isFinite(measured) && measured >= 0) {
          usedBytes = measured;
        }
      } catch (_error) {
        // O cálculo local segue a mesma regra de chaves + JSON usada pela cota.
      }
    }
    const backup = SyncStore.decodeBackup(items);
    return {
      usedBytes,
      totalBytes: SyncStore.TOTAL_LIMIT_BYTES,
      usagePercent: Math.min(
        100,
        Math.max(0, Math.round((usedBytes / SyncStore.TOTAL_LIMIT_BYTES) * 100))
      ),
      backupAvailable: Boolean(backup),
      backupCreatedAt: backup?.createdAt || null,
      backupGroupCount: backup?.groupCount || 0
    };
  } catch (_error) {
    return {
      usedBytes: 0,
      totalBytes: SyncStore.TOTAL_LIMIT_BYTES,
      usagePercent: 0,
      backupAvailable: false,
      backupCreatedAt: null,
      backupGroupCount: 0
    };
  }
}

function portableGroup(group) {
  return {
    id: group.id,
    title: group.title,
    color: group.color,
    icon: group.icon,
    darkerColors: group.darkerColors === true,
    keepAtTop: group.keepAtTop === true,
    keepAtTopOrder: Number.isFinite(group.keepAtTopOrder) ? group.keepAtTopOrder : null,
    archived: group.archived === true,
    intentionallyEmpty: group.intentionallyEmpty === true,
    tabs: normalizeTabList(group.tabs).map((tab) => ({
      url: tab.url,
      title: tab.title,
      ...(tab.cookieStoreId ? { cookieStoreId: tab.cookieStoreId } : {})
    })),
    skippedTabs: group.skippedTabs,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  };
}

async function exportExtensionDataUnlocked(state) {
  const uiPreferences = await Ui.load();
  const toolbarId = await getToolbarRootId();
  const groups = [];
  for (const group of state.groups) {
    const bookmark = await getBookmark(group.bookmarkId);
    groups.push({
      ...portableGroup(group),
      shortcutPinned: Boolean(bookmark && bookmark.parentId === toolbarId)
    });
  }
  return {
    format: "grupos-na-barra-backup",
    formatVersion: 1,
    extensionVersion: browser.runtime.getManifest?.().version || "unknown",
    exportedAt: new Date().toISOString(),
    groups,
    settings: {
      autoPinNewGroups: state.settings.autoPinNewGroups,
      ui: uiPreferences
    }
  };
}

async function restoreAutomaticBackupUnlocked(state) {
  if (!browser.storage?.sync?.get) {
    throw new Error("O Firefox Sync não está disponível.");
  }
  const items = await browser.storage.sync.get(null);
  const archiveKeys = SyncStore.tombstoneArchiveKeys(items);
  const archive = archiveKeys.length ? SyncStore.decodeTombstoneArchive(items) : null;
  if (archiveKeys.length && !archive) {
    throw new Error(
      "O arquivo compacto de exclusões do Firefox Sync está incompleto ou corrompido."
    );
  }
  const archivedIds = new Set(archive?.ids || []);
  const backup = SyncStore.decodeBackup(items);
  if (!backup?.groups?.length) {
    throw new Error("Nenhum backup automático válido foi encontrado.");
  }

  const restoredIds = new Set();
  const tombstoneIdsToClear = new Set();
  const now = Date.now();
  for (const backupGroup of backup.groups) {
    const normalized = normalizeState({
      schemaVersion: SCHEMA_VERSION,
      groups: [{ ...backupGroup, updatedAt: now }]
    }).groups[0];
    if (!normalized) {
      continue;
    }
    const originalId = normalized.id;
    const restoreAsNewIdentity = archivedIds.has(originalId);
    if (restoreAsNewIdentity) {
      normalized.id = createId();
      normalized.createdAt = now;
    } else {
      tombstoneIdsToClear.add(originalId);
    }
    restoredIds.add(normalized.id);
    const local = state.groups.find((group) => group.id === normalized.id);
    const tombstone = state.tombstones.find((item) => item.id === normalized.id) || null;
    const restoreUpdatedAt = Math.max(
      now,
      Number.isFinite(local?.syncUpdatedAt) ? local.syncUpdatedAt + 1 : 0,
      Number.isFinite(local?.updatedAt) ? local.updatedAt + 1 : 0,
      Number.isFinite(tombstone?.syncUpdatedAt) ? tombstone.syncUpdatedAt + 1 : 0
    );
    normalized.updatedAt = restoreUpdatedAt;
    if (local) {
      // A cópia contém um snapshot de URLs. Fechar uma instância aberta evita
      // que as abas atuais sobrescrevam imediatamente o conteúdo restaurado.
      if (local.live) {
        await closeSavedGroupUnlocked(local);
      }
      if (normalized.archived) {
        await removeBookmark(local);
      }
      Object.assign(local, {
        title: normalized.title,
        color: normalized.color,
        icon: normalized.icon,
        darkerColors: normalized.darkerColors,
        keepAtTop: normalized.keepAtTop,
        keepAtTopOrder: normalized.keepAtTopOrder,
        archived: normalized.archived,
        tabs: cloneTabList(normalized.tabs),
        intentionallyEmpty: normalized.intentionallyEmpty === true,
        recoveryTabs: cloneTabList(normalized.tabs),
        restoreIncomplete: false,
        skippedTabs: normalized.skippedTabs,
        createdAt: normalized.createdAt,
        updatedAt: restoreUpdatedAt,
        syncFingerprint: null,
        syncPending: true,
        syncError: null
      });
      if (!normalized.archived && local.bookmarkId) {
        await ensureBookmark(local, { createIfMissing: false });
      }
    } else {
      state.groups.push({
        ...normalized,
        recoveryTabs: cloneTabList(normalized.tabs),
        restoreIncomplete: false,
        bookmarkId: null,
        live: null,
        updatedAt: restoreUpdatedAt,
        syncRevision: null,
        syncUpdatedAt: null,
        syncFingerprint: null,
        syncPending: true,
        syncError: null
      });
    }
  }

  state.tombstones = state.tombstones.filter((item) => !tombstoneIdsToClear.has(item.id));
  renumberKeptGroupsUnlocked(state);
  await persistState(state);
  return {
    restoredGroups: restoredIds.size,
    backupCreatedAt: backup.createdAt
  };
}

function isLauncherUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  try {
    const candidate = new URL(url);
    const expected = new URL(browser.runtime.getURL("launcher/open.html"));
    return (
      candidate.protocol === expected.protocol &&
      candidate.host === expected.host &&
      candidate.pathname === expected.pathname
    );
  } catch (_error) {
    return false;
  }
}

function isCommandUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === COMMAND_URL_ORIGIN && parsed.pathname.startsWith("/toggle/");
  } catch (_error) {
    return false;
  }
}

function isIntentionalEmptyWireUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== COMMAND_URL_ORIGIN || !parsed.pathname.startsWith("/empty/")) {
      return false;
    }
    const raw = parsed.pathname.slice("/empty/".length);
    return Boolean(raw && normalizeRecordId(decodeURIComponent(raw)));
  } catch (_error) {
    return false;
  }
}

function isManagedBookmarkUrl(url) {
  return isLauncherUrl(url) || isCommandUrl(url);
}

function savedIdFromManagedBookmarkUrl(url) {
  try {
    if (isLauncherUrl(url)) {
      const raw = new URL(url).hash.slice(1);
      return raw ? normalizeRecordId(decodeURIComponent(raw)) : null;
    }

    if (isCommandUrl(url)) {
      const raw = new URL(url).pathname.slice("/toggle/".length);
      return raw ? normalizeRecordId(decodeURIComponent(raw)) : null;
    }
  } catch (_error) {
    // O atalho inválido será descartado durante a reconciliação.
  }
  return null;
}

function normalizeRestorableUrl(url) {
  if (typeof url !== "string" || !url) {
    return undefined;
  }

  if (isManagedBookmarkUrl(url) || isIntentionalEmptyWireUrl(url)) {
    return undefined;
  }

  if (url === "about:newtab" || url === "about:home" || url === "about:blank") {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch (_error) {
    return undefined;
  }

  return undefined;
}

function normalizeCookieStoreId(cookieStoreId) {
  if (typeof cookieStoreId !== "string") {
    return null;
  }
  const clean = cookieStoreId.trim();
  return clean.length <= MAX_COOKIE_STORE_ID_LENGTH && /^firefox-container-[a-z0-9_-]+$/i.test(clean)
    ? clean
    : null;
}

const MAX_INLINE_FAVICON_LENGTH = 64 * 1024;
const MAX_LOCAL_FAVICON_REFERENCE_LENGTH = 4096;
const SAFE_INLINE_FAVICON_PATTERN = /^data:image\/(?:png|jpe?g|gif|webp|x-icon|vnd\.microsoft\.icon);base64,/i;
const SAFE_LOCAL_FAVICON_PATTERN = /^(?:page-icon:|moz-anno:favicon:|moz-extension:|chrome:|resource:)/i;

function normalizeFaviconUrl(faviconUrl) {
  if (faviconUrl == null || typeof faviconUrl !== "string") {
    return null;
  }
  const clean = faviconUrl.trim();
  if (!clean) {
    return null;
  }
  if (SAFE_INLINE_FAVICON_PATTERN.test(clean)) {
    return clean.length <= MAX_INLINE_FAVICON_LENGTH ? clean : null;
  }
  if (SAFE_LOCAL_FAVICON_PATTERN.test(clean)) {
    return clean.length <= MAX_LOCAL_FAVICON_REFERENCE_LENGTH ? clean : null;
  }
  return null;
}

function isPlaceholderUrl(url) {
  return PLACEHOLDER_URLS.has(url);
}

function normalizeTabList(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const tabs = [];
  for (const tab of candidate) {
    const url = normalizeRestorableUrl(tab?.url);
    if (url === undefined) {
      continue;
    }
    const normalized = {
      url,
      title: String(tab?.title || url || "Nova aba").slice(0, 300)
    };
    const cookieStoreId = normalizeCookieStoreId(tab?.cookieStoreId);
    if (cookieStoreId) {
      normalized.cookieStoreId = cookieStoreId;
    }
    tabs.push(normalized);
  }
  return tabs;
}

function cloneTabList(tabs) {
  return normalizeTabList(tabs).map((tab) => ({ ...tab }));
}

function localTabMetadataKey(tab) {
  return `${tab?.url || "about:newtab"}\u0001${normalizeCookieStoreId(tab?.cookieStoreId) || ""}`;
}

function mergeLocalTabDisplayMetadata(localTabs, incomingTabs) {
  const localBuckets = new Map();
  for (const tab of normalizeTabList(localTabs)) {
    const key = localTabMetadataKey(tab);
    const bucket = localBuckets.get(key) || [];
    bucket.push(tab);
    localBuckets.set(key, bucket);
  }

  return normalizeTabList(incomingTabs).map((tab) => {
    const bucket = localBuckets.get(localTabMetadataKey(tab));
    const local = bucket?.shift() || null;
    if (!local) return { ...tab };
    const merged = { ...tab };
    if (local.title && local.title !== local.url) {
      merged.title = local.title;
    }
    return merged;
  });
}

function meaningfulUrlCount(tabs) {
  return normalizeTabList(tabs).filter((tab) => !isPlaceholderUrl(tab.url)).length;
}

function tabsHaveMeaningfulUrls(tabs) {
  return meaningfulUrlCount(tabs) > 0;
}

function placeholderUrlCount(tabs) {
  return normalizeTabList(tabs).filter((tab) => isPlaceholderUrl(tab.url)).length;
}

// Uma navegação real nunca deve ser substituída por placeholders observados
// durante a criação assíncrona das abas. Reduções legítimas no número total de
// abas continuam permitidas; o bloqueio mira a troca de URLs por abas vazias.
function wouldLoseRestorableUrls(currentTabs, candidateTabs, navigationUnsettled = false) {
  const current = normalizeTabList(currentTabs);
  const candidate = normalizeTabList(candidateTabs);
  const currentMeaningful = meaningfulUrlCount(current);
  const candidateMeaningful = meaningfulUrlCount(candidate);

  if (!currentMeaningful || candidateMeaningful >= currentMeaningful) {
    return false;
  }
  if (!candidateMeaningful) {
    return true;
  }
  if (navigationUnsettled) {
    return true;
  }
  return (
    candidate.length >= current.length &&
    placeholderUrlCount(candidate) > placeholderUrlCount(current)
  );
}

function recoveryBaseline(group) {
  const currentTabs = normalizeTabList(group?.tabs);
  if (group?.intentionallyEmpty === true) {
    return currentTabs.length ? currentTabs : emptyGroupPlaceholderTabs();
  }
  const recoveryTabs = normalizeTabList(group?.recoveryTabs);
  return tabsHaveMeaningfulUrls(recoveryTabs) ? recoveryTabs : currentTabs;
}

function tabsForRestore(group) {
  const currentTabs = normalizeTabList(group?.tabs);
  if (group?.intentionallyEmpty === true) {
    return currentTabs.length ? currentTabs : emptyGroupPlaceholderTabs();
  }
  const recoveryTabs = normalizeTabList(group?.recoveryTabs);
  return wouldLoseRestorableUrls(recoveryTabs, currentTabs) ? recoveryTabs : currentTabs;
}

function expectedUrlForTab(tab) {
  if (!Number.isInteger(tab?.id)) {
    return undefined;
  }
  const expected = expectedRestoredUrls.get(tab.id);
  if (!expected) {
    return undefined;
  }
  if (expected.expiresAt <= Date.now()) {
    expectedRestoredUrls.delete(tab.id);
    return undefined;
  }
  return expected.url;
}

function liveGroupKey(windowId, groupId) {
  return `${windowId}:${groupId}`;
}

function removalTabUrl(tab) {
  return normalizeRestorableUrl(tab?.url) ?? normalizeRestorableUrl(tab?.pendingUrl);
}

function lifecycleGroupId(tab) {
  return Number.isInteger(tab?.groupId) ? tab.groupId : NO_GROUP;
}

function disqualifyOlderTabRemovalsAfterGroupSurvived(
  windowId,
  groupId,
  generation,
  observedAt = Date.now()
) {
  if (!Number.isInteger(generation)) {
    return;
  }
  for (const removal of recentTabRemovals) {
    if (
      removal.windowId === windowId &&
      removal.oldGroupId === groupId &&
      removal.groupGeneration === generation &&
      removal.observedAt < observedAt
    ) {
      // Há prova posterior de que a mesma geração do grupo continuou viva.
      // Logo essa remoção de tab pertence a uma operação anterior e nunca
      // pode provar um tabGroups.onRemoved terminal posterior.
      removal.groupSurvivedAfterRemoval = true;
    }
  }
}

function observeNativeGroupAlive(windowId, groupId, observedAt = Date.now()) {
  if (!Number.isInteger(windowId) || !Number.isInteger(groupId) || groupId === NO_GROUP) {
    return null;
  }

  const key = liveGroupKey(windowId, groupId);
  let lifecycle = nativeGroupLifecycles.get(key) || null;

  if (!lifecycle || lifecycle.removed === true) {
    // Firefox pode reutilizar um groupId quando um grupo fechado é restaurado.
    // Uma instância viva posterior recebe uma nova geração mesmo que o número
    // do groupId seja igual. Pendências/markers da geração anterior não podem
    // atravessar essa fronteira.
    clearPendingNativeGroupRemoval(key);
    observedNativeGroupRemovals.delete(key);
    lifecycle = {
      generation: nextNativeGroupGeneration++,
      windowId,
      groupId,
      removed: false,
      membershipAuthoritative: false
    };
    nativeGroupLifecycles.set(key, lifecycle);
    return lifecycle.generation;
  }

  disqualifyOlderTabRemovalsAfterGroupSurvived(
    windowId,
    groupId,
    lifecycle.generation,
    observedAt
  );
  return lifecycle.generation;
}

function markNativeGroupMembershipAuthoritative(windowId, groupId, generation = null) {
  const lifecycle = nativeGroupLifecycles.get(liveGroupKey(windowId, groupId));
  if (!lifecycle || lifecycle.removed === true) {
    return false;
  }
  if (Number.isInteger(generation) && lifecycle.generation !== generation) {
    return false;
  }
  lifecycle.membershipAuthoritative = true;
  return true;
}

function markNativeGroupCreated(group, observedAt = Date.now()) {
  if (!Number.isInteger(group?.id) || !Number.isInteger(group?.windowId)) {
    return null;
  }
  const key = liveGroupKey(group.windowId, group.id);
  const previous = nativeGroupLifecycles.get(key) || null;
  const generation = observeNativeGroupAlive(group.windowId, group.id, observedAt);
  const lifecycle = nativeGroupLifecycles.get(key);
  if (lifecycle) {
    // onCreated abre uma nova fase de observação. Até uma query/snapshot
    // completo confirmar todos os membros, não trate contagem parcial de tabs
    // como prova terminal para Sessions.
    lifecycle.membershipAuthoritative = false;
  }
  // onCreated é uma prova forte de uma instância viva. Mesmo se um evento de
  // tab tiver observado a nova instância alguns ms antes, qualquer marker ou
  // pending da instância removida anterior deve estar morto agora.
  observedNativeGroupRemovals.delete(key);
  if (previous?.removed === true) {
    clearPendingNativeGroupRemoval(key);
  }
  return generation;
}

function rememberLiveTab(tab, observedAt = Date.now()) {
  if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId)) {
    return null;
  }
  const groupId = lifecycleGroupId(tab);
  const groupGeneration =
    groupId === NO_GROUP
      ? null
      : observeNativeGroupAlive(tab.windowId, groupId, observedAt);
  const entry = {
    tabId: tab.id,
    windowId: tab.windowId,
    groupId,
    groupGeneration,
    url: removalTabUrl(tab),
    cookieStoreId: normalizeCookieStoreId(tab.cookieStoreId),
    observedAt
  };
  liveTabLifecycle.set(tab.id, entry);
  return entry;
}

async function seedLiveTabLifecycleCache() {
  const seedStartedAt = Date.now();
  let tabs;
  try {
    tabs = await browser.tabs.query({});
  } catch (_error) {
    return false;
  }

  const queriedTabIds = new Set(
    tabs.filter((tab) => Number.isInteger(tab?.id)).map((tab) => tab.id)
  );

  // Não faça clear() cego: eventos tabs.* podem ocorrer enquanto tabs.query()
  // está em voo. Preserve observações posteriores ao início do seed e remova
  // apenas entradas antigas que a consulta confirmou não estarem mais vivas.
  for (const [tabId, entry] of liveTabLifecycle) {
    if (entry.observedAt < seedStartedAt && !queriedTabIds.has(tabId)) {
      liveTabLifecycle.delete(tabId);
    }
  }

  for (const tab of tabs) {
    const existing = liveTabLifecycle.get(tab.id);
    if (existing && existing.observedAt >= seedStartedAt) {
      continue;
    }
    const removedDuringSeed = recentTabRemovals.some(
      (removal) => removal.tabId === tab.id && removal.observedAt >= seedStartedAt
    );
    if (removedDuringSeed) {
      continue;
    }
    rememberLiveTab(tab, seedStartedAt);
  }

  const authoritativeGroups = new Map();
  for (const tab of tabs) {
    const groupId = lifecycleGroupId(tab);
    if (groupId === NO_GROUP || !Number.isInteger(tab?.windowId)) {
      continue;
    }
    const lifecycle = nativeGroupLifecycles.get(liveGroupKey(tab.windowId, groupId));
    if (lifecycle && lifecycle.removed !== true) {
      authoritativeGroups.set(liveGroupKey(tab.windowId, groupId), lifecycle.generation);
    }
  }
  for (const [key, generation] of authoritativeGroups) {
    const [windowIdText, groupIdText] = key.split(":");
    markNativeGroupMembershipAuthoritative(
      Number(windowIdText),
      Number(groupIdText),
      generation
    );
  }
  return true;
}

async function restoreLifecycleObservationStartFromSession() {
  const session = browser.storage?.session;
  if (!session?.get || !session?.set) {
    return false;
  }
  try {
    const stored = await session.get(LIFECYCLE_SESSION_STARTED_AT_KEY);
    const existing = stored?.[LIFECYCLE_SESSION_STARTED_AT_KEY];
    if (Number.isFinite(existing) && existing <= Date.now()) {
      tabLifecycleObservationStartedAt = existing;
      return true;
    }
    await session.set({
      [LIFECYCLE_SESSION_STARTED_AT_KEY]: tabLifecycleObservationStartedAt
    });
    return true;
  } catch (_error) {
    // storage.session é um hardening; ausência/falha mantém a política antiga
    // e conservadora (janela começa no wake atual, portanto preserva mais).
    return false;
  }
}

function pruneRecentMembershipChanges(now = Date.now()) {
  while (
    recentMembershipChanges.length &&
    now - recentMembershipChanges[0].observedAt > MEMBERSHIP_EVIDENCE_TTL_MS
  ) {
    recentMembershipChanges.shift();
  }
}

function recordMembershipChangeCandidate(tab, changeInfo, observedAt = Date.now()) {
  const previous = Number.isInteger(tab?.id) ? liveTabLifecycle.get(tab.id) : null;
  const current = rememberLiveTab(tab, observedAt);
  if (
    changeInfo?.groupId === undefined ||
    !previous ||
    !current ||
    previous.windowId !== current.windowId ||
    previous.groupId === current.groupId
  ) {
    return null;
  }
  return {
    tabId: current.tabId,
    windowId: current.windowId,
    oldGroupId: previous.groupId,
    oldGroupGeneration: Number.isInteger(previous.groupGeneration)
      ? previous.groupGeneration
      : null,
    newGroupId: current.groupId,
    observedAt
  };
}

function pruneObservedNativeGroupRemovals(now = Date.now()) {
  for (const [key, marker] of observedNativeGroupRemovals) {
    if (!marker || now - marker.observedAt > MEMBERSHIP_EVIDENCE_TTL_MS) {
      observedNativeGroupRemovals.delete(key);
    }
  }
}

function markObservedNativeGroupRemoval(group, observedAt = Date.now()) {
  if (!Number.isInteger(group?.id) || !Number.isInteger(group?.windowId)) {
    return null;
  }
  pruneObservedNativeGroupRemovals(observedAt);
  const key = liveGroupKey(group.windowId, group.id);
  let lifecycle = nativeGroupLifecycles.get(key) || null;
  if (!lifecycle) {
    lifecycle = {
      generation: nextNativeGroupGeneration++,
      windowId: group.windowId,
      groupId: group.id,
      removed: true,
      membershipAuthoritative: false
    };
    nativeGroupLifecycles.set(key, lifecycle);
  } else {
    lifecycle.removed = true;
  }
  const marker = {
    observedAt,
    generation: lifecycle.generation
  };
  observedNativeGroupRemovals.set(key, marker);
  return marker.generation;
}

function nativeGroupRemovalGenerationIsCurrent(windowId, groupId, groupGeneration) {
  if (
    !Number.isInteger(windowId) ||
    !Number.isInteger(groupId) ||
    !Number.isInteger(groupGeneration)
  ) {
    return false;
  }
  const lifecycle = nativeGroupLifecycles.get(liveGroupKey(windowId, groupId));
  return Boolean(
    lifecycle &&
    lifecycle.generation === groupGeneration &&
    lifecycle.removed === true
  );
}

function wasNativeGroupRemovalObserved(
  windowId,
  groupId,
  groupGeneration,
  observedAt = Date.now()
) {
  pruneObservedNativeGroupRemovals(observedAt);
  const marker = observedNativeGroupRemovals.get(liveGroupKey(windowId, groupId));
  return (
    marker &&
    Number.isInteger(groupGeneration) &&
    marker.generation === groupGeneration &&
    Number.isFinite(marker.observedAt) &&
    Math.abs(observedAt - marker.observedAt) <= MEMBERSHIP_EVIDENCE_TTL_MS
  );
}

function qualifyMembershipChangeEvidence(candidate) {
  if (!candidate || candidate.oldGroupId === NO_GROUP) {
    return null;
  }
  // Proveniência positiva: a mudança só pode esvaziar um grupo quando o
  // próprio tabGroups.onRemoved daquele windowId/groupId já foi observado.
  // Se a ordem inversa ocorrer, a classificação falha conservadoramente.
  if (
    !wasNativeGroupRemovalObserved(
      candidate.windowId,
      candidate.oldGroupId,
      candidate.oldGroupGeneration,
      candidate.observedAt
    )
  ) {
    return null;
  }
  pruneRecentMembershipChanges(candidate.observedAt);
  recentMembershipChanges.push(candidate);
  return candidate;
}

function membershipEvidenceMatchesPending(evidence, pending) {
  return Boolean(
    evidence &&
    pending &&
    evidence.windowId === pending.windowId &&
    evidence.oldGroupId === pending.groupId &&
    Number.isInteger(evidence.oldGroupGeneration) &&
    evidence.oldGroupGeneration === pending.groupGeneration &&
    evidence.newGroupId !== pending.groupId &&
    Math.abs(evidence.observedAt - pending.observedAt) <= MEMBERSHIP_EVIDENCE_TTL_MS
  );
}

function recentMembershipEvidenceForRemoval(group, groupGeneration, observedAt = Date.now()) {
  pruneRecentMembershipChanges(observedAt);
  const pendingShape = {
    windowId: group.windowId,
    groupId: group.id,
    groupGeneration,
    observedAt
  };
  return recentMembershipChanges.some((evidence) =>
    membershipEvidenceMatchesPending(evidence, pendingShape)
  );
}

function pruneRecentTabRemovals(now = Date.now()) {
  while (
    recentTabRemovals.length &&
    now - recentTabRemovals[0].observedAt > TAB_REMOVAL_EVIDENCE_TTL_MS
  ) {
    recentTabRemovals.shift();
  }
}

function recordTabRemovalEvidence(tabId, removeInfo = {}, observedAt = Date.now()) {
  const previous = Number.isInteger(tabId) ? liveTabLifecycle.get(tabId) : null;
  const windowId = Number.isInteger(removeInfo.windowId)
    ? removeInfo.windowId
    : Number.isInteger(previous?.windowId)
      ? previous.windowId
      : null;
  let knownGroupTabCountBeforeRemoval = null;
  let membershipAuthoritative = false;
  if (
    Number.isInteger(previous?.windowId) &&
    Number.isInteger(previous?.groupId) &&
    previous.groupId !== NO_GROUP &&
    Number.isInteger(previous?.groupGeneration)
  ) {
    const lifecycle = nativeGroupLifecycles.get(
      liveGroupKey(previous.windowId, previous.groupId)
    );
    membershipAuthoritative = Boolean(
      lifecycle &&
      lifecycle.generation === previous.groupGeneration &&
      lifecycle.membershipAuthoritative === true
    );
    knownGroupTabCountBeforeRemoval = [...liveTabLifecycle.values()].filter(
      (entry) =>
        entry.windowId === previous.windowId &&
        entry.groupId === previous.groupId &&
        entry.groupGeneration === previous.groupGeneration
    ).length;
  }
  const evidence = {
    tabId: Number.isInteger(tabId) ? tabId : null,
    windowId,
    oldGroupId: Number.isInteger(previous?.groupId) ? previous.groupId : null,
    groupGeneration: Number.isInteger(previous?.groupGeneration)
      ? previous.groupGeneration
      : null,
    knownGroupTabCountBeforeRemoval,
    membershipAuthoritative,
    groupSurvivedAfterRemoval: false,
    url: previous?.url,
    cookieStoreId: previous?.cookieStoreId || null,
    observedAt
  };
  if (Number.isInteger(tabId)) {
    liveTabLifecycle.delete(tabId);
  }
  pruneRecentTabRemovals(observedAt);
  recentTabRemovals.push(evidence);
  return evidence;
}

function setSavedGroupIntentionallyEmpty(saved) {
  const placeholderTabs = emptyGroupPlaceholderTabs();
  saved.tabs = cloneTabList(placeholderTabs);
  saved.recoveryTabs = cloneTabList(placeholderTabs);
  saved.intentionallyEmpty = true;
  saved.restoreIncomplete = false;
  saved.skippedTabs = 0;
  saved.updatedAt = Date.now();
}

function clearPendingNativeGroupRemoval(key) {
  const pending = pendingNativeGroupRemovals.get(key);
  if (!pending) {
    return null;
  }
  pendingNativeGroupRemovals.delete(key);
  if (pending.timerId) {
    clearTimeout(pending.timerId);
  }
  return pending;
}

function pendingRemovalStillCurrent(saved, pending) {
  return Boolean(
    saved &&
    pending &&
    !saved.live &&
    saved.updatedAt === pending.savedUpdatedAt
  );
}

async function finalizePendingNativeGroupRemoval(key, { intentionallyEmpty = false } = {}) {
  const pending = clearPendingNativeGroupRemoval(key);
  if (!pending) {
    return false;
  }
  return serial(async (state) => {
    const saved = state.groups.find((item) => item.id === pending.savedId);
    if (!pendingRemovalStillCurrent(saved, pending)) {
      return false;
    }
    // O pending pode ter sido criado legitimamente e ficar aguardando na fila
    // enquanto Firefox restaura o mesmo groupId como uma nova geração. Revalide
    // imediatamente antes de qualquer escrita destrutiva: geração N nunca pode
    // esvaziar geração N+1.
    if (
      !nativeGroupRemovalGenerationIsCurrent(
        pending.windowId,
        pending.groupId,
        pending.groupGeneration
      )
    ) {
      return false;
    }
    if (!intentionallyEmpty) {
      return false;
    }
    setSavedGroupIntentionallyEmpty(saved);
    await persistState(state);
    return true;
  }, "native-group-removal-resolution");
}

function queuePendingNativeGroupRemoval(
  saved,
  group,
  groupGeneration,
  observedAt = Date.now()
) {
  const key = liveGroupKey(group.windowId, group.id);
  // Um tabGroups.onRemoved pode ter sido observado na geração N e só chegar
  // aqui depois de a fila serial liberar, quando o mesmo groupId já representa
  // uma geração N+1 viva. Nesse caso o evento é stale e não pode sequer criar
  // uma pendência (nem apagar uma pendência da geração atual).
  if (
    !nativeGroupRemovalGenerationIsCurrent(
      group.windowId,
      group.id,
      groupGeneration
    )
  ) {
    return null;
  }
  clearPendingNativeGroupRemoval(key);
  const pending = {
    key,
    savedId: saved.id,
    savedUpdatedAt: saved.updatedAt,
    groupId: group.id,
    windowId: group.windowId,
    groupGeneration: Number.isInteger(groupGeneration) ? groupGeneration : null,
    observedAt,
    timerId: null
  };
  pending.timerId = setTimeout(() => {
    // Ausência de um sinal público conclusivo preserva o último snapshot.
    // O timeout só encerra a pendência; nunca converte ambiguidade em perda.
    finalizePendingNativeGroupRemoval(key, { intentionallyEmpty: false }).catch((error) => {
      console.error("Groups 'On the Bar': falha ao resolver remoção nativa ambígua", error);
    });
  }, NATIVE_GROUP_RESOLUTION_TIMEOUT_MS);
  pendingNativeGroupRemovals.set(key, pending);
  return pending;
}

function recentlyClosedTabEntries(sessions) {
  const entries = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (session?.tab) {
      entries.push({ lastModified: session.lastModified, tab: session.tab });
    }
    for (const tab of Array.isArray(session?.window?.tabs) ? session.window.tabs : []) {
      entries.push({ lastModified: session.lastModified, tab });
    }
  }
  return entries;
}

function sessionEntryPossiblyMatchesRemoval(entry, removal) {
  if (!entry || !removal || !Number.isFinite(entry.lastModified)) {
    return false;
  }
  if (entry.lastModified < tabLifecycleObservationStartedAt) {
    // Uma Session anterior ao ciclo de vida observado por esta Event Page não
    // pode ser atribuída destrutivamente: talvez a aba correspondente tenha
    // fechado antes de termos qualquer chance de registrar tabs.onRemoved.
    return false;
  }
  if (Math.abs(entry.lastModified - removal.observedAt) > RECENTLY_CLOSED_MATCH_WINDOW_MS) {
    return false;
  }
  const sessionWindowId = Number.isInteger(entry.tab?.windowId) ? entry.tab.windowId : null;
  if (
    Number.isInteger(sessionWindowId) &&
    Number.isInteger(removal.windowId) &&
    sessionWindowId !== removal.windowId
  ) {
    return false;
  }

  const sessionUrl = removalTabUrl(entry.tab);
  if (sessionUrl !== undefined && removal.url !== undefined && sessionUrl !== removal.url) {
    return false;
  }

  const sessionCookieStoreId = normalizeCookieStoreId(entry.tab?.cookieStoreId);
  if (
    sessionCookieStoreId &&
    removal.cookieStoreId &&
    sessionCookieStoreId !== removal.cookieStoreId
  ) {
    return false;
  }

  // Informação ausente mantém a relação como POSSÍVEL, não como impossível.
  // Isso amplia ambiguidade e portanto falha para o lado conservador.
  return true;
}

function unobservedMissingTabCouldMatchSession(entry, currentLiveTabIds) {
  if (!entry || !Number.isFinite(entry.lastModified)) {
    return false;
  }
  if (entry.lastModified < tabLifecycleObservationStartedAt) {
    return true;
  }
  const sessionWindowId = Number.isInteger(entry.tab?.windowId) ? entry.tab.windowId : null;
  const sessionUrl = removalTabUrl(entry.tab);
  const sessionCookieStoreId = normalizeCookieStoreId(entry.tab?.cookieStoreId);

  for (const cached of liveTabLifecycle.values()) {
    if (currentLiveTabIds.has(cached.tabId)) {
      continue;
    }
    if (
      Number.isInteger(sessionWindowId) &&
      Number.isInteger(cached.windowId) &&
      sessionWindowId !== cached.windowId
    ) {
      continue;
    }
    if (sessionUrl !== undefined && cached.url !== undefined && sessionUrl !== cached.url) {
      continue;
    }
    if (
      sessionCookieStoreId &&
      cached.cookieStoreId &&
      sessionCookieStoreId !== cached.cookieStoreId
    ) {
      continue;
    }
    // O cache acreditava que esta aba estava viva, mas tabs.query() já não a
    // encontra e nenhum tabs.onRemoved a retirou do cache. Logo uma Session
    // homônima pode pertencer a ela; isso é ambiguidade, nunca prova positiva.
    return true;
  }
  return false;
}

function recentRemovalBelongsToPending(removal, pending) {
  return Boolean(
    removal &&
    pending &&
    removal.oldGroupId === pending.groupId &&
    removal.windowId === pending.windowId &&
    Number.isInteger(removal.groupGeneration) &&
    removal.groupGeneration === pending.groupGeneration &&
    removal.membershipAuthoritative === true &&
    removal.knownGroupTabCountBeforeRemoval === 1 &&
    removal.groupSurvivedAfterRemoval !== true &&
    Math.abs(removal.observedAt - pending.observedAt) <= TAB_REMOVAL_EVIDENCE_TTL_MS
  );
}

function uniquelyAttributedClosedRemovals(sessions, currentLiveTabIds, now = Date.now()) {
  pruneRecentTabRemovals(now);
  const entries = recentlyClosedTabEntries(sessions).filter(({ lastModified }) =>
    Number.isFinite(lastModified)
  );
  const candidatesByEntry = new Map();
  const entriesByRemoval = new Map();

  for (const entry of entries) {
    if (unobservedMissingTabCouldMatchSession(entry, currentLiveTabIds)) {
      candidatesByEntry.set(entry, []);
      continue;
    }
    const candidates = recentTabRemovals.filter((removal) =>
      sessionEntryPossiblyMatchesRemoval(entry, removal)
    );
    candidatesByEntry.set(entry, candidates);
    for (const removal of candidates) {
      const matchingEntries = entriesByRemoval.get(removal) || [];
      matchingEntries.push(entry);
      entriesByRemoval.set(removal, matchingEntries);
    }
  }

  const uniqueRemovals = new Set();
  for (const [entry, candidates] of candidatesByEntry) {
    if (candidates.length !== 1) {
      continue;
    }
    const removal = candidates[0];
    if ((entriesByRemoval.get(removal) || []).length !== 1) {
      continue;
    }
    uniqueRemovals.add(removal);
  }
  return uniqueRemovals;
}

function recentlyClosedMatchesPending(sessions, pending, currentLiveTabIds) {
  for (const removal of uniquelyAttributedClosedRemovals(sessions, currentLiveTabIds)) {
    if (recentRemovalBelongsToPending(removal, pending)) {
      return true;
    }
  }
  return false;
}

async function resolvePendingNativeGroupRemovalsFromSessions() {
  if (!pendingNativeGroupRemovals.size || !browser.sessions?.getRecentlyClosed) {
    return;
  }

  let recentlyClosed;
  let currentTabs;
  try {
    [recentlyClosed, currentTabs] = await Promise.all([
      browser.sessions.getRecentlyClosed({ maxResults: 25 }),
      browser.tabs.query({})
    ]);
  } catch (_error) {
    // Falha de leitura não deve destruir dados. O fallback por timeout preserva.
    return;
  }
  const currentLiveTabIds = new Set(
    currentTabs.filter((tab) => Number.isInteger(tab?.id)).map((tab) => tab.id)
  );

  const pendingEntries = [...pendingNativeGroupRemovals.values()];
  for (const pending of pendingEntries) {
    if (!recentlyClosedMatchesPending(recentlyClosed, pending, currentLiveTabIds)) {
      // Um onChanged sem prova para ESTE grupo não consome a pendência. Outro
      // sinal pode chegar depois; o timeout continua sendo o fallback seguro.
      continue;
    }
    await finalizePendingNativeGroupRemoval(pending.key, { intentionallyEmpty: true });
  }
}

function pruneExpiredGroupRemovalMarkers(now = Date.now()) {
  for (const [key, expiresAt] of intentionalNativeGroupClosures) {
    if (expiresAt <= now) intentionalNativeGroupClosures.delete(key);
  }
}

function markIntentionalNativeGroupClosure(windowId, groupId) {
  pruneExpiredGroupRemovalMarkers();
  const key = liveGroupKey(windowId, groupId);
  intentionalNativeGroupClosures.set(key, Date.now() + NATIVE_GROUP_REMOVAL_TTL_MS);
}

function clearIntentionalNativeGroupClosure(windowId, groupId) {
  intentionalNativeGroupClosures.delete(liveGroupKey(windowId, groupId));
}

function consumeIntentionalNativeGroupClosure(windowId, groupId) {
  pruneExpiredGroupRemovalMarkers();
  const key = liveGroupKey(windowId, groupId);
  const expiresAt = intentionalNativeGroupClosures.get(key) || 0;
  intentionalNativeGroupClosures.delete(key);
  return expiresAt > Date.now();
}

function emptyGroupPlaceholderTabs() {
  return [{ url: "about:blank", title: "about:blank" }];
}

function tabEntry(tab) {
  const currentUrl = normalizeRestorableUrl(tab.url);
  const pendingUrl = normalizeRestorableUrl(tab.pendingUrl);
  const expectedUrl = expectedUrlForTab(tab);
  const normalizedUrl =
    pendingUrl !== undefined && !isPlaceholderUrl(pendingUrl)
      ? pendingUrl
      : currentUrl !== undefined && !isPlaceholderUrl(currentUrl)
        ? currentUrl
        : expectedUrl !== undefined && !isPlaceholderUrl(expectedUrl)
          ? expectedUrl
          : pendingUrl ?? currentUrl;

  if (normalizedUrl === undefined) {
    return null;
  }
  if (expectedUrl && currentUrl && !isPlaceholderUrl(currentUrl)) {
    expectedRestoredUrls.delete(tab.id);
  }
  const entry = {
    url: normalizedUrl,
    title: String(tab.title || normalizedUrl || "Nova aba").slice(0, 300)
  };
  const cookieStoreId = normalizeCookieStoreId(tab.cookieStoreId);
  if (cookieStoreId) {
    entry.cookieStoreId = cookieStoreId;
  }
  return entry;
}

async function snapshotNativeGroup(groupId) {
  let nativeGroup;
  try {
    nativeGroup = await browser.tabGroups.get(groupId);
  } catch (_error) {
    return null;
  }

  observeNativeGroupAlive(nativeGroup.windowId, nativeGroup.id);

  const nativeTabs = (await browser.tabs.query({ groupId })).sort((a, b) => a.index - b.index);
  const tabs = [];
  let skippedTabs = 0;

  for (const tab of nativeTabs) {
    rememberLiveTab(tab);
    const entry = tabEntry(tab);
    if (entry) {
      tabs.push(entry);
    } else {
      skippedTabs += 1;
    }
  }

  const lifecycle = nativeGroupLifecycles.get(
    liveGroupKey(nativeGroup.windowId, nativeGroup.id)
  );
  if (lifecycle) {
    markNativeGroupMembershipAuthoritative(
      nativeGroup.windowId,
      nativeGroup.id,
      lifecycle.generation
    );
  }

  return {
    groupId: nativeGroup.id,
    windowId: nativeGroup.windowId,
    title: String(nativeGroup.title || "").trim(),
    color: normalizeColor(nativeGroup.color),
    darkerColors: darkerColorsFromNativeTitle(nativeGroup.title),
    collapsed: Boolean(nativeGroup.collapsed),
    tabs,
    skippedTabs,
    nativeTabCount: nativeTabs.length,
    containsLauncher: nativeTabs.some(
      (tab) => isManagedBookmarkUrl(tab.url) || isManagedBookmarkUrl(tab.pendingUrl)
    ),
    navigationUnsettled: nativeTabs.some(
      (tab) =>
        tab.status === "loading" ||
        normalizeRestorableUrl(tab.pendingUrl) !== undefined ||
        expectedUrlForTab(tab) !== undefined
    )
  };
}

function bookmarkTitle(group) {
  const color = normalizeColor(group.color);
  const icon = normalizeIcon(group.icon);
  const iconToken = icon === "none" ? "" : ICON_TOKENS[icon] || "";
  return `${normalizeTitle(group.title)}${iconToken}${COLOR_TOKENS[color]}`;
}

function bookmarkUrl(group) {
  return `${COMMAND_URL_PREFIX}${encodeURIComponent(group.id)}?v=${BOOKMARK_URL_VERSION}`;
}

async function getToolbarRootId() {
  if (toolbarRootCache) {
    return toolbarRootCache;
  }

  try {
    const [toolbar] = await browser.bookmarks.get(TOOLBAR_ROOT_ID);
    if (toolbar) {
      toolbarRootCache = toolbar.id;
      return toolbarRootCache;
    }
  } catch (_error) {
    // A busca pela árvore abaixo cobre perfis com identificadores diferentes.
  }

  const tree = await browser.bookmarks.getTree();
  const queue = [...tree];
  while (queue.length) {
    const node = queue.shift();
    if (node.id === TOOLBAR_ROOT_ID || String(node.id).toLowerCase().includes("toolbar")) {
      toolbarRootCache = node.id;
      return toolbarRootCache;
    }
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }

  throw new Error("Não foi possível localizar a barra de favoritos deste perfil.");
}

async function getBookmark(bookmarkId) {
  if (!bookmarkId) {
    return null;
  }
  try {
    const [bookmark] = await browser.bookmarks.get(bookmarkId);
    return bookmark || null;
  } catch (_error) {
    return null;
  }
}

function flattenBookmarkTree(tree) {
  const nodes = [];
  const queue = [...tree];
  while (queue.length) {
    const node = queue.shift();
    nodes.push(node);
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return nodes;
}

async function managedBookmarks(savedId = null) {
  const nodes = flattenBookmarkTree(await browser.bookmarks.getTree());
  return nodes.filter(
    (node) =>
      typeof node.url === "string" &&
      isManagedBookmarkUrl(node.url) &&
      (savedId === null || savedIdFromManagedBookmarkUrl(node.url) === savedId)
  );
}

async function removeBookmarkById(bookmarkId) {
  ignoredBookmarkRemovals.add(bookmarkId);
  try {
    await browser.bookmarks.remove(bookmarkId);
  } catch (_error) {
    // O usuário pode ter apagado o atalho alguns instantes antes.
  } finally {
    setTimeout(() => ignoredBookmarkRemovals.delete(bookmarkId), 1000);
  }
}

async function ensureBookmark(group, { createIfMissing = true, moveToToolbar = false } = {}) {
  const title = bookmarkTitle(group);
  const url = bookmarkUrl(group);
  let bookmark = await getBookmark(group.bookmarkId);

  const matches = await managedBookmarks(group.id);
  if (!bookmark && matches.length) {
    bookmark = matches[0];
  }

  for (const duplicate of matches) {
    if (!bookmark || duplicate.id !== bookmark.id) {
      await removeBookmarkById(duplicate.id);
    }
  }

  if (bookmark) {
    if (bookmark.title !== title || bookmark.url !== url) {
      bookmark = await browser.bookmarks.update(bookmark.id, { title, url });
    }
    if (moveToToolbar) {
      const toolbarId = await getToolbarRootId();
      if (bookmark.parentId !== toolbarId) {
        bookmark = await browser.bookmarks.move(bookmark.id, { parentId: toolbarId });
      }
    }
    group.bookmarkId = bookmark.id;
    return bookmark;
  }

  group.bookmarkId = null;
  if (!createIfMissing) {
    return null;
  }

  const parentId = await getToolbarRootId();
  bookmark = await browser.bookmarks.create({ parentId, title, url });
  group.bookmarkId = bookmark.id;
  return bookmark;
}

async function removeBookmark(group) {
  if (!group.bookmarkId) {
    return;
  }

  const bookmarkId = group.bookmarkId;
  group.bookmarkId = null;
  await removeBookmarkById(bookmarkId);
}

function applySnapshot(group, snapshot) {
  group.title = normalizeTitle(snapshot.title, "");
  group.color = normalizeColor(snapshot.color);
  // Ao clicar no atalho, a página intermediária ocupa a aba atual por um
  // instante. Não deixamos essa navegação temporária substituir o snapshot.
  const baseline = recoveryBaseline(group);
  const safeToReplaceTabs =
    !snapshot.containsLauncher &&
    snapshot.tabs.length > 0 &&
    !wouldLoseRestorableUrls(
      baseline,
      snapshot.tabs,
      snapshot.navigationUnsettled || group.restoreIncomplete
    );
  if (safeToReplaceTabs) {
    group.tabs = cloneTabList(snapshot.tabs);
    if (tabsHaveMeaningfulUrls(snapshot.tabs)) {
      group.recoveryTabs = cloneTabList(snapshot.tabs);
      group.intentionallyEmpty = false;
    }
    group.skippedTabs = snapshot.skippedTabs;
  }
  group.live = { groupId: snapshot.groupId, windowId: snapshot.windowId };
  group.updatedAt = Date.now();
}

function nativeGroupKey(group) {
  return `${group.windowId}:${group.id ?? group.groupId}`;
}

function suppressionFromSnapshot(snapshot) {
  return {
    groupId: snapshot.groupId,
    windowId: snapshot.windowId,
    title: normalizeTitle(snapshot.title),
    color: normalizeColor(snapshot.color),
    signature: urlsSignature(snapshot.tabs)
  };
}

function suppressionMatchesSnapshot(suppression, snapshot) {
  return (
    (suppression.groupId === snapshot.groupId && suppression.windowId === snapshot.windowId) ||
    (suppression.title === normalizeTitle(snapshot.title) &&
      suppression.color === normalizeColor(snapshot.color) &&
      suppression.signature === urlsSignature(snapshot.tabs))
  );
}

function clearMatchingSuppressions(state, snapshot) {
  const before = state.suppressedNativeGroups.length;
  state.suppressedNativeGroups = state.suppressedNativeGroups.filter(
    (suppression) => !suppressionMatchesSnapshot(suppression, snapshot)
  );
  return before !== state.suppressedNativeGroups.length;
}

async function saveNativeGroupUnlocked(
  state,
  groupId,
  { pin = true, clearSuppression = true } = {}
) {
  const snapshot = await snapshotNativeGroup(groupId);
  if (!snapshot) {
    throw new Error("Esse grupo não está mais aberto.");
  }

  if (clearSuppression) {
    clearMatchingSuppressions(state, snapshot);
  }

  // Persistent identity is never inferred from title/color/URLs. A native
  // instance may reuse a saved entity only while the exact runtime binding is
  // still present. If that evidence is gone, ambiguity fails toward
  // preservation: keep every closed entity intact and create a new ID for the
  // unclaimed native group.
  let saved = state.groups.find(
    (group) => group.live?.groupId === snapshot.groupId && group.live?.windowId === snapshot.windowId
  );

  if (!saved && !snapshot.tabs.length) {
    throw new Error("O grupo não contém páginas que o Firefox permita restaurar por uma extensão.");
  }

  if (!saved) {
    saved = {
      id: createId(),
      title: normalizeTitle(snapshot.title, `Grupo ${state.groups.length + 1}`),
      color: snapshot.color,
      icon: "none",
      darkerColors: snapshot.darkerColors === true,
      keepAtTop: false,
      keepAtTopOrder: null,
      archived: false,
      tabs: cloneTabList(snapshot.tabs),
      intentionallyEmpty: false,
      recoveryTabs: tabsHaveMeaningfulUrls(snapshot.tabs) ? cloneTabList(snapshot.tabs) : [],
      restoreIncomplete: false,
      skippedTabs: snapshot.skippedTabs,
      bookmarkId: null,
      live: { groupId: snapshot.groupId, windowId: snapshot.windowId },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.groups.push(saved);
  } else {
    applySnapshot(saved, snapshot);
    saved.archived = false;
  }

  if (pin) {
    await ensureBookmark(saved, { createIfMissing: true, moveToToolbar: true });
  }

  return saved;
}

async function updateSavedFromLiveUnlocked(group) {
  if (!group.live) {
    return false;
  }

  const snapshot = await snapshotNativeGroup(group.live.groupId);
  if (!snapshot || snapshot.windowId !== group.live.windowId) {
    // Não descarte o vínculo aqui. Quando um grupo nativo desaparece em
    // runtime, tabGroups.onRemoved é a fonte semântica que distingue
    // fechamento intencional, fechamento da janela e esvaziamento pelo
    // usuário. Preservar o vínculo até esse evento evita perder a identidade
    // do grupo se timers de tabs.* executarem primeiro. A reconciliação de
    // startup ainda pode remover vínculos comprovadamente obsoletos.
    return false;
  }

  const before = JSON.stringify({
    title: group.title,
    color: group.color,
    tabs: group.tabs,
    intentionallyEmpty: group.intentionallyEmpty === true,
    recoveryTabs: group.recoveryTabs,
    skippedTabs: group.skippedTabs,
    live: group.live
  });

  applySnapshot(group, snapshot);
  const expectedNativeTitle = nativeGroupTitle(group);
  if (snapshot.title !== expectedNativeTitle) {
    try {
      await browser.tabGroups.update(group.live.groupId, { title: expectedNativeTitle });
    } catch (_error) {
      // O grupo pode ter sido fechado durante a sincronização. A próxima
      // reconciliação atualiza o vínculo sem perder os dados salvos.
    }
  }
  if (group.bookmarkId) {
    await ensureBookmark(group, { createIfMissing: false });
  }

  const after = JSON.stringify({
    title: group.title,
    color: group.color,
    tabs: group.tabs,
    intentionallyEmpty: group.intentionallyEmpty === true,
    recoveryTabs: group.recoveryTabs,
    skippedTabs: group.skippedTabs,
    live: group.live
  });
  return before !== after;
}

function tabIdentity(tab) {
  return `${tab?.url || "about:newtab"}\u0001${normalizeCookieStoreId(tab?.cookieStoreId) || ""}`;
}

function urlsSignature(tabs) {
  return tabs.map(tabIdentity).join("\n");
}

function savedContentKey(group) {
  if (!Array.isArray(group.tabs) || !group.tabs.length) {
    return null;
  }
  return [
    normalizeTitle(group.title).toLocaleLowerCase("pt-BR"),
    normalizeColor(group.color),
    urlsSignature(group.tabs)
  ].join("\u0000");
}

function snapshotMatchesSavedGroup(group, snapshot) {
  if (
    normalizeTitle(group.title) !== normalizeTitle(snapshot.title) ||
    normalizeColor(group.color) !== normalizeColor(snapshot.color)
  ) {
    return false;
  }

  if (urlsSignature(group.tabs) === urlsSignature(snapshot.tabs)) {
    return true;
  }

  if (!snapshot.containsLauncher || snapshot.tabs.length > group.tabs.length) {
    return false;
  }

  const availableUrls = new Map();
  for (const tab of group.tabs) {
    const identity = tabIdentity(tab);
    availableUrls.set(identity, (availableUrls.get(identity) || 0) + 1);
  }

  for (const tab of snapshot.tabs) {
    const identity = tabIdentity(tab);
    const available = availableUrls.get(identity) || 0;
    if (!available) {
      return false;
    }
    availableUrls.set(identity, available - 1);
  }

  return true;
}

async function mergeDuplicateSavedGroupsUnlocked(state) {
  const claimedLiveGroups = new Map();
  let changed = false;

  // Desde a v3.0.9, IDs persistentes definem entidades. Nome/cor/URLs iguais
  // nunca são prova suficiente para apagar um registro. Se um estado antigo ou
  // corrompido associar dois IDs ao MESMO grupo nativo, preservamos ambos e
  // apenas destacamos o vínculo duplicado do registro secundário.
  const orderedGroups = state.groups.slice().sort(
    (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
  );

  for (const group of orderedGroups) {
    if (!group.live) {
      continue;
    }
    const liveKey = `${group.live.windowId}:${group.live.groupId}`;
    const primary = claimedLiveGroups.get(liveKey);
    if (!primary) {
      claimedLiveGroups.set(liveKey, group);
      continue;
    }

    group.live = null;
    group.liveMissingSince = null;
    changed = true;
  }

  return changed;
}

async function reconcileBookmarkDuplicatesUnlocked(state) {
  const allNodes = flattenBookmarkTree(await browser.bookmarks.getTree());
  const nodesById = new Map(allNodes.map((node) => [node.id, node]));
  const extensionBookmarks = allNodes.filter(
    (node) => typeof node.url === "string" && isManagedBookmarkUrl(node.url)
  );
  const validSavedIds = new Set(state.groups.map((group) => group.id));
  const explicitlyDeletedIds = new Set(state.tombstones.map((item) => item.id));
  const usedBookmarkIds = new Set();
  const removalIds = new Set();
  let changed = false;

  for (const group of state.groups) {
    const tracked = group.bookmarkId ? nodesById.get(group.bookmarkId) || null : null;
    const exactMatches = extensionBookmarks.filter(
      (bookmark) => savedIdFromManagedBookmarkUrl(bookmark.url) === group.id
    );

    if (group.archived) {
      if (group.bookmarkId) {
        group.bookmarkId = null;
        changed = true;
      }
      for (const bookmark of exactMatches) {
        removalIds.add(bookmark.id);
      }
      continue;
    }
    const keeper = tracked || exactMatches[0] || null;

    if (!keeper) {
      if (group.bookmarkId) {
        group.bookmarkId = null;
        changed = true;
      }
      continue;
    }

    if (group.bookmarkId !== keeper.id) {
      group.bookmarkId = keeper.id;
      changed = true;
    }
    usedBookmarkIds.add(keeper.id);

    for (const duplicate of exactMatches) {
      if (duplicate.id !== keeper.id) {
        removalIds.add(duplicate.id);
      }
    }

    const title = bookmarkTitle(group);
    const url = bookmarkUrl(group);
    if (keeper.title !== title || keeper.url !== url) {
      await browser.bookmarks.update(keeper.id, { title, url });
    }
  }

  for (const bookmark of extensionBookmarks) {
    const savedId = savedIdFromManagedBookmarkUrl(bookmark.url);
    // Um bookmark pode chegar pelo Firefox Sync antes do registro da extensão.
    // Sem uma lápide de exclusão explícita ele é preservado, nunca tratado como
    // órfão apenas porque este computador ainda não recebeu os dados do grupo.
    if (
      !usedBookmarkIds.has(bookmark.id) &&
      !validSavedIds.has(savedId) &&
      explicitlyDeletedIds.has(savedId)
    ) {
      removalIds.add(bookmark.id);
    }
  }

  for (const bookmarkId of removalIds) {
    await removeBookmarkById(bookmarkId);
    changed = true;
  }

  return changed;
}

async function reconcileLiveLinksUnlocked(state) {
  const nativeGroups = await browser.tabGroups.query({});
  const nativeByKey = new Map(nativeGroups.map((group) => [`${group.windowId}:${group.id}`, group]));
  const claimed = new Set();
  let changed = await mergeDuplicateSavedGroupsUnlocked(state);

  const snapshotCache = new Map();
  const getSnapshot = async (native) => {
    const key = nativeGroupKey(native);
    if (!snapshotCache.has(key)) {
      snapshotCache.set(key, await snapshotNativeGroup(native.id));
    }
    return snapshotCache.get(key);
  };

  const suppressedKeys = new Set();
  const retainedSuppressions = [];
  for (const suppression of state.suppressedNativeGroups) {
    let matched = nativeByKey.get(`${suppression.windowId}:${suppression.groupId}`) || null;
    if (!matched) {
      for (const native of nativeGroups) {
        if (
          normalizeTitle(native.title) !== suppression.title ||
          normalizeColor(native.color) !== suppression.color
        ) {
          continue;
        }
        const snapshot = await getSnapshot(native);
        if (snapshot && suppressionMatchesSnapshot(suppression, snapshot)) {
          matched = native;
          break;
        }
      }
    }

    if (matched) {
      retainedSuppressions.push({
        ...suppression,
        groupId: matched.id,
        windowId: matched.windowId
      });
      suppressedKeys.add(nativeGroupKey(matched));
      if (matched.id !== suppression.groupId || matched.windowId !== suppression.windowId) {
        changed = true;
      }
    } else {
      changed = true;
    }
  }

  if (retainedSuppressions.length !== state.suppressedNativeGroups.length) {
    changed = true;
  }
  state.suppressedNativeGroups = retainedSuppressions;

  for (const saved of state.groups) {
    if (!saved.live) {
      continue;
    }
    const key = `${saved.live.windowId}:${saved.live.groupId}`;
    if (nativeByKey.has(key)) {
      claimed.add(key);
      if (saved.liveMissingSince !== null) {
        saved.liveMissingSince = null;
        changed = true;
      }
      changed = (await updateSavedFromLiveUnlocked(saved)) || changed;
    } else if (!Number.isFinite(saved.liveMissingSince)) {
      // Uma única query vazia nunca é suficiente para concluir que o grupo
      // morreu: a event page pode acordar no meio do restore do Firefox.
      saved.liveMissingSince = Date.now();
      changed = true;
    } else if (Date.now() - saved.liveMissingSince >= LIVE_LINK_MISSING_GRACE_MS) {
      // Ausência persistente por múltiplas reconciliações encerra apenas o
      // vínculo runtime. O snapshot persistente continua intacto.
      saved.live = null;
      saved.liveMissingSince = null;
      changed = true;
    }
  }

  // Do not relink a closed persistent entity to an unclaimed native group by
  // content. Equal title/color/URLs are legitimate for different groups and
  // therefore are not identity evidence. Unclaimed native groups flow through
  // auto-pin below and receive their own persistent ID.

  if (state.settings.autoPinNewGroups) {
    for (const native of nativeGroups) {
      const key = `${native.windowId}:${native.id}`;
      if (claimed.has(key) || suppressedKeys.has(key)) {
        continue;
      }
      try {
        await saveNativeGroupUnlocked(state, native.id, {
          pin: true,
          clearSuppression: false
        });
        claimed.add(key);
        changed = true;
      } catch (error) {
        const message = String(error?.message || error || "").toLowerCase();
        const expectedRace =
          /não está mais aberto|não contém páginas que o firefox permita restaurar|group not found/.test(
            message
          );
        if (!expectedRace) {
          appendDiagnosticUnlocked(state, "auto-pin-group", error);
          changed = true;
        }
        console.warn("Groups 'On the Bar': grupo não fixado automaticamente", error);
      }
    }
  }

  changed = (await mergeDuplicateSavedGroupsUnlocked(state)) || changed;
  changed = (await reconcileBookmarkDuplicatesUnlocked(state)) || changed;

  return changed;
}

async function syncNativeGroupUnlocked(state, groupId) {
  const snapshot = await snapshotNativeGroup(groupId);
  if (!snapshot) {
    // Igual a updateSavedFromLiveUnlocked: um timer de sincronização não pode
    // apagar a identidade necessária ao tabGroups.onRemoved.
    return false;
  }

  const saved = state.groups.find(
    (group) => group.live?.groupId === snapshot.groupId && group.live?.windowId === snapshot.windowId
  );
  if (saved) {
    return updateSavedFromLiveUnlocked(saved);
  }

  if (state.settings.autoPinNewGroups) {
    if (
      state.suppressedNativeGroups.some((suppression) =>
        suppressionMatchesSnapshot(suppression, snapshot)
      )
    ) {
      return false;
    }
    await saveNativeGroupUnlocked(state, groupId, {
      pin: true,
      clearSuppression: false
    });
    return true;
  }

  return false;
}

async function moveKeptGroupsToTopUnlocked(state, windowId) {
  if (!Number.isInteger(windowId)) {
    return false;
  }

  const keptGroups = state.groups
    .filter((group) => group.keepAtTop && group.live?.windowId === windowId)
    .sort(keptOrderComparator);
  if (!keptGroups.length) {
    return false;
  }

  let windowTabs = (await browser.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
  const layoutSignature = (tabs) =>
    keptGroups
      .map((group) => {
        const indices = tabs
          .filter((tab) => tab.groupId === group.live.groupId)
          .map((tab) => tab.index)
          .sort((a, b) => a - b);
        return `${group.id}:${group.live.groupId}:${indices.join(",")}`;
      })
      .join("|");
  const initialSignature = layoutSignature(windowTabs);
  const previousFailure = keptMoveFailures.get(windowId);
  if (
    previousFailure?.signature === initialSignature &&
    Date.now() - previousFailure.at < KEEP_AT_TOP_MOVE_RETRY_MS
  ) {
    return false;
  }
  if (previousFailure) {
    keptMoveFailures.delete(windowId);
  }
  let targetIndex = windowTabs.filter((tab) => tab.pinned).length;
  let moved = false;

  for (const group of keptGroups) {
    let groupTabs = windowTabs
      .filter((tab) => tab.groupId === group.live.groupId)
      .sort((a, b) => a.index - b.index);
    if (!groupTabs.length) {
      continue;
    }

    if (groupTabs[0].index !== targetIndex) {
      try {
        let groupMoveSucceeded = false;
        if (browser.tabGroups?.move) {
          try {
            await browser.tabGroups.move(group.live.groupId, {
              index: targetIndex,
              windowId
            });
            const verifiedTabs = (await browser.tabs.query({ windowId })).filter(
              (tab) => tab.groupId === group.live.groupId
            );
            groupMoveSucceeded =
              verifiedTabs.length > 0 &&
              Math.min(...verifiedTabs.map((tab) => tab.index)) === targetIndex;
          } catch (_groupMoveError) {
            // Algumas versões do Firefox expõem tabGroups.move, mas recusam
            // certos movimentos na interface vertical. O fallback abaixo
            // move todas as abas juntas sem desfazer o grupo.
          }
        }
        if (!groupMoveSucceeded && browser.tabs?.move) {
          await browser.tabs.move(
            groupTabs.map((tab) => tab.id),
            { index: targetIndex, windowId }
          );
        }
        windowTabs = (await browser.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
        groupTabs = windowTabs
          .filter((tab) => tab.groupId === group.live.groupId)
          .sort((a, b) => a.index - b.index);
        if (!groupTabs.length || groupTabs[0].index !== targetIndex) {
          keptMoveFailures.set(windowId, {
            signature: layoutSignature(windowTabs),
            at: Date.now()
          });
          return moved;
        }
        moved = true;
      } catch (_error) {
        // Uma API que recusa repetidamente o mesmo layout não pode criar um
        // loop move→onMoved→move. Repetimos depois de 30 s ou assim que o
        // layout realmente mudar.
        keptMoveFailures.set(windowId, {
          signature: layoutSignature(windowTabs),
          at: Date.now()
        });
        return moved;
      }
    }

    targetIndex += groupTabs.length;
  }

  keptMoveFailures.delete(windowId);
  return moved;
}

async function moveAllKeptGroupsToTopUnlocked(state) {
  const windowIds = new Set(
    state.groups
      .filter((group) => group.keepAtTop && Number.isInteger(group.live?.windowId))
      .map((group) => group.live.windowId)
  );
  for (const windowId of windowIds) {
    await moveKeptGroupsToTopUnlocked(state, windowId);
  }
}

async function findTargetWindow(preferredWindowId) {
  if (Number.isInteger(preferredWindowId)) {
    try {
      const preferred = await browser.windows.get(preferredWindowId);
      if (preferred.type === "normal") {
        return preferred;
      }
    } catch (_error) {
      // A janela pode ter sido fechada entre o clique e a restauração.
    }
  }

  const focused = await browser.windows.getLastFocused();
  if (focused?.type === "normal") {
    return focused;
  }

  const normalWindows = await browser.windows.getAll({ windowTypes: ["normal"] });
  if (normalWindows.length) {
    return normalWindows[0];
  }

  return browser.windows.create({});
}

async function restoreLauncherTab(launcherTabId) {
  if (!Number.isInteger(launcherTabId)) {
    return;
  }

  let launcher;
  try {
    launcher = await browser.tabs.get(launcherTabId);
  } catch (_error) {
    return;
  }

  if (!isLauncherUrl(launcher.url)) {
    return;
  }

  try {
    await browser.tabs.goBack(launcherTabId);
  } catch (_error) {
    try {
      await browser.tabs.remove(launcherTabId);
    } catch (_removeError) {
      // A aba já pode ter sido fechada pelo usuário.
    }
  }
}

async function focusLiveGroup(group, launcherTabId) {
  if (!group.live) {
    return false;
  }

  const snapshot = await snapshotNativeGroup(group.live.groupId);
  if (!snapshot || snapshot.windowId !== group.live.windowId) {
    return false;
  }

  const tabs = (await browser.tabs.query({ groupId: group.live.groupId })).sort((a, b) => a.index - b.index);
  if (!tabs.length) {
    return false;
  }

  try {
    await browser.tabGroups.update(group.live.groupId, { collapsed: false });
  } catch (_error) {
    // O foco na aba ainda funciona se o grupo já estiver expandido.
  }
  await restoreLauncherTab(launcherTabId);
  await browser.windows.update(group.live.windowId, { focused: true });
  await browser.tabs.update(tabs[0].id, { active: true });
  return true;
}

async function openSavedGroupUnlocked(state, savedId, preferredWindowId, launcherTabId) {
  const group = state.groups.find((item) => item.id === savedId);
  if (!group) {
    throw new Error("Esse grupo salvo não existe mais.");
  }

  if (await focusLiveGroup(group, launcherTabId)) {
    group.updatedAt = Date.now();
    return { opened: false, focused: true, skippedTabs: group.skippedTabs };
  }

  if (group.live) {
    // O grupo estava marcado como aberto, mas a instância nativa acabou de
    // desaparecer. Não reabra conteúdo potencialmente obsoleto antes de
    // tabGroups.onRemoved concluir a transição semântica.
    await restoreLauncherTab(launcherTabId);
    return {
      opened: false,
      focused: false,
      pendingRemoval: true,
      skippedTabs: group.skippedTabs
    };
  }

  const primaryTabs = normalizeTabList(group.tabs);
  const restoreTabs = tabsForRestore(group);
  const restoredFromRecovery =
    group.intentionallyEmpty !== true && wouldLoseRestorableUrls(group.recoveryTabs, primaryTabs);
  if (!restoreTabs.length) {
    throw new Error("Esse grupo não possui abas restauráveis.");
  }

  if (restoredFromRecovery) {
    group.tabs = cloneTabList(restoreTabs);
    group.recoveryTabs = cloneTabList(restoreTabs);
    group.syncFingerprint = null;
    group.updatedAt = Date.now();
  }

  const targetWindow = await findTargetWindow(preferredWindowId);
  const createdTabs = [];
  let failedTabs = Math.max(0, Array.isArray(group.tabs) ? group.tabs.length - restoreTabs.length : 0);
  let containerFallbackTabs = 0;

  for (const entry of restoreTabs) {
    const url = normalizeRestorableUrl(entry.url);
    if (url === undefined) {
      failedTabs += 1;
      continue;
    }
    const properties = {
      windowId: targetWindow.id,
      active: false
    };
    if (url !== "about:newtab" && url !== "about:home") {
      properties.url = url;
    }
    const cookieStoreId = normalizeCookieStoreId(entry.cookieStoreId);
    if (cookieStoreId) {
      properties.cookieStoreId = cookieStoreId;
    }

    try {
      let created;
      try {
        created = await browser.tabs.create(properties);
      } catch (error) {
        if (!cookieStoreId) {
          throw error;
        }
        // O identificador de um container pode não existir no outro computador.
        // Nesse caso a página continua sendo restaurada no container padrão.
        const fallbackProperties = { ...properties };
        delete fallbackProperties.cookieStoreId;
        created = await browser.tabs.create(fallbackProperties);
        containerFallbackTabs += 1;
      }
      createdTabs.push(created);
      if (!isPlaceholderUrl(url)) {
        expectedRestoredUrls.set(created.id, {
          url,
          expiresAt: Date.now() + EXPECTED_URL_TTL_MS
        });
      }
    } catch (_error) {
      failedTabs += 1;
    }
  }

  if (!createdTabs.length) {
    throw new Error("O Firefox não permitiu restaurar nenhuma aba desse grupo.");
  }

  let nativeGroupId;
  try {
    nativeGroupId = await browser.tabs.group({ tabIds: createdTabs.map((tab) => tab.id) });
    observeNativeGroupAlive(targetWindow.id, nativeGroupId);
    await browser.tabGroups.update(nativeGroupId, {
      title: nativeGroupTitle(group),
      color: group.color,
      collapsed: false
    });
  } catch (error) {
    for (const tab of createdTabs) {
      expectedRestoredUrls.delete(tab.id);
    }
    await browser.tabs.remove(createdTabs.map((tab) => tab.id));
    throw error;
  }

  group.live = { groupId: nativeGroupId, windowId: targetWindow.id };
  group.archived = false;
  group.restoreIncomplete = failedTabs > 0;
  group.updatedAt = Date.now();
  if (group.keepAtTop) {
    await moveKeptGroupsToTopUnlocked(state, targetWindow.id);
  }
  await restoreLauncherTab(launcherTabId);
  await browser.windows.update(targetWindow.id, { focused: true });
  await browser.tabs.update(createdTabs[0].id, { active: true });

  return {
    opened: true,
    focused: false,
    skippedTabs: group.skippedTabs + failedTabs,
    containerFallbackTabs
  };
}

async function closeSavedGroupUnlocked(group) {
  if (!group.live) {
    return { closed: false };
  }

  await updateSavedFromLiveUnlocked(group);
  if (!group.live) {
    return { closed: false };
  }

  const nativeTabs = await browser.tabs.query({ groupId: group.live.groupId });
  if (!nativeTabs.length) {
    // A instância nativa pode ter acabado de desaparecer por uma ação do
    // usuário. Não apague o vínculo antes de tabGroups.onRemoved decidir se
    // isso significa vazio intencional ou apenas fechamento da janela.
    return { closed: false, pendingRemoval: true };
  }

  const closingLive = { ...group.live };
  const allWindowTabs = await browser.tabs.query({ windowId: group.live.windowId });
  if (allWindowTabs.length === nativeTabs.length) {
    await browser.tabs.create({ windowId: group.live.windowId, active: true });
  }

  markIntentionalNativeGroupClosure(closingLive.windowId, closingLive.groupId);
  try {
    await browser.tabs.remove(nativeTabs.map((tab) => tab.id));
  } catch (error) {
    clearIntentionalNativeGroupClosure(closingLive.windowId, closingLive.groupId);
    throw error;
  }
  group.live = null;
  group.updatedAt = Date.now();
  return { closed: true };
}

async function toggleSavedGroupUnlocked(
  state,
  savedId,
  preferredWindowId,
  launcherTabId = null
) {
  const group = state.groups.find((item) => item.id === savedId);
  if (!group) {
    throw new Error("Esse grupo salvo não existe mais.");
  }

  if (group.live) {
    // Compatibilidade com atalhos criados antes da versão 1.4. O novo
    // mecanismo bloqueia a navegação antes que ela substitua a página atual.
    await restoreLauncherTab(launcherTabId);
    const closeResult = await closeSavedGroupUnlocked(group);
    if (closeResult.closed) {
      return { ...closeResult, action: "closed" };
    }
    if (closeResult.pendingRemoval) {
      return { ...closeResult, action: "pending" };
    }
  }

  return {
    ...(await openSavedGroupUnlocked(state, savedId, preferredWindowId, launcherTabId)),
    action: "opened"
  };
}

function previewLabelForTab(tab) {
  const title = String(tab?.title || "").trim();
  const url = String(tab?.url || "").trim();
  let primary = "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "");
    if (host) {
      primary = host;
    } else if (parsed.protocol === "about:") {
      primary = `about:${parsed.pathname}`;
    } else {
      primary = parsed.protocol.replace(":", "");
    }
  } catch (_error) {
    primary = url;
  }

  const cleanPrimary = (primary || title || "New tab").slice(0, 120);
  const meaningfulTitle =
    title &&
    title !== url &&
    title.toLocaleLowerCase() !== cleanPrimary.toLocaleLowerCase() &&
    !PLACEHOLDER_URLS.has(title);

  if (!meaningfulTitle) {
    return cleanPrimary;
  }

  const suffix = ` (${title})`;
  const maxLength = 220;
  if (cleanPrimary.length + suffix.length <= maxLength) {
    return `${cleanPrimary}${suffix}`;
  }
  const availableTitleLength = Math.max(1, maxLength - cleanPrimary.length - 4);
  return `${cleanPrimary} (${title.slice(0, availableTitleLength)}…)`;
}

function previewTabsForGroup(group, liveTabs = null) {
  const source = Array.isArray(liveTabs) ? liveTabs : normalizeTabList(group?.tabs);
  return source.slice(0, 9).map((tab) => ({
    label: previewLabelForTab(tab),
    faviconUrl: normalizeFaviconUrl(tab?.favIconUrl || tab?.faviconUrl),
    url: typeof tab?.url === "string" ? tab.url.slice(0, 2000) : null
  }));
}

async function publicStateUnlocked(state, requestedWindowId) {
  const remoteChanged = await pullRemoteSyncUnlocked(state);
  const reconciled = await reconcileLiveLinksUnlocked(state);
  const trashChanged = purgeExpiredTrashUnlocked(state);
  const orderChanged = renumberKeptGroupsUnlocked(state);
  let stateChanged = remoteChanged || reconciled || trashChanged || orderChanged;
  await moveAllKeptGroupsToTopUnlocked(state);

  const toolbarId = await getToolbarRootId();
  const pinnedState = new Map();
  for (const saved of state.groups) {
    const bookmark = await getBookmark(saved.bookmarkId);
    if (!bookmark && saved.bookmarkId) {
      saved.bookmarkId = null;
      stateChanged = true;
    }
    pinnedState.set(saved.id, Boolean(bookmark && bookmark.parentId === toolbarId));
  }

  if (stateChanged || shouldRetryPendingSyncUnlocked(state)) {
    await persistState(state);
  }

  const targetWindow = await findTargetWindow(requestedWindowId);
  const nativeGroups = (await browser.tabGroups.query({})).filter(
    (group) => group.windowId === targetWindow.id
  );

  const openGroups = [];
  const livePreviewBySavedId = new Map();
  for (const native of nativeGroups) {
    const tabs = await browser.tabs.query({ groupId: native.id });
    const saved = state.groups.find(
      (group) => group.live?.groupId === native.id && group.live?.windowId === native.windowId
    );
    if (saved) {
      livePreviewBySavedId.set(saved.id, previewTabsForGroup(saved, tabs));
    }
    openGroups.push({
      groupId: native.id,
      windowId: native.windowId,
      title: normalizeTitle(native.title),
      color: normalizeColor(native.color),
      collapsed: Boolean(native.collapsed),
      tabCount: tabs.length,
      savedId: saved?.id || null
    });
  }

  const recordSyncError =
    state.groups.find((group) => group.syncError)?.syncError ||
    state.tombstones.find((item) => item.syncError)?.syncError ||
    null;
  const syncStorage = await readSyncStorageStatusUnlocked();

  return {
    compatible: Boolean(browser.tabs.group && browser.tabGroups?.query),
    minimumFirefox: 142,
    currentWindowId: targetWindow.id,
    autoPinNewGroups: state.settings.autoPinNewGroups,
    sync: {
      supported: Boolean(browser.storage?.sync),
      pending:
        state.groups.filter((group) => group.syncPending).length +
        state.tombstones.filter((item) => item.syncPending).length,
      lastSyncedAt: state.sync.lastSyncedAt,
      lastError: state.sync.lastError || recordSyncError,
      ...syncStorage
    },
    openGroups,
    savedGroups: state.groups
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((group) => ({
        id: group.id,
        title: group.title,
        color: group.color,
        icon: group.icon,
        darkerColors: group.darkerColors === true,
        keepAtTop: group.keepAtTop,
        keepAtTopOrder: group.keepAtTopOrder,
        archived: group.archived,
        tabCount: group.tabs.length,
        skippedTabs: group.skippedTabs,
        pinned: pinnedState.get(group.id) || false,
        open: Boolean(group.live),
        liveWindowId: group.live?.windowId || null,
        previewTabs: livePreviewBySavedId.get(group.id) || previewTabsForGroup(group)
      })),
    trashGroups: state.trash.map((group) => ({
      id: group.id,
      title: group.title,
      color: group.color,
      icon: group.icon,
      darkerColors: group.darkerColors === true,
      tabCount: group.tabs.length,
      skippedTabs: group.skippedTabs,
      deletedAt: group.deletedAt,
      expiresAt: group.expiresAt,
      previewTabs: previewTabsForGroup(group)
    })),
    diagnostics: {
      count: state.diagnostics.length,
      unreadCount: state.diagnostics.filter((item) => !item.seen).length,
      latestAt: state.diagnostics.at(-1)?.at || null
    }
  };
}

async function routeMessage(message, sender) {
  if (!message || typeof message.type !== "string") {
    throw new Error("Comando inválido.");
  }
  const runtimeId = browser.runtime?.id;
  if (runtimeId && sender?.id && sender.id !== runtimeId) {
    throw new Error("Remetente de comando não autorizado.");
  }
  if (sender?.url && browser.runtime?.getURL) {
    const extensionRoot = browser.runtime.getURL("");
    if (!String(sender.url).startsWith(extensionRoot)) {
      throw new Error("Remetente de comando não autorizado.");
    }
  }

  return serial(async (state) => {
    let result;

    switch (message.type) {
      case "getState":
        return publicStateUnlocked(state, message.windowId);

      case "exportExtensionData":
        return exportExtensionDataUnlocked(state);

      case "restoreAutomaticBackup":
        return restoreAutomaticBackupUnlocked(state);

      case "consumePendingGroupEditor": {
        const stored = await browser.storage.local.get(PENDING_EDITOR_KEY);
        const pending = stored?.[PENDING_EDITOR_KEY];
        await browser.storage.local.set({ [PENDING_EDITOR_KEY]: null });
        if (
          !pending ||
          typeof pending.savedId !== "string" ||
          !Number.isFinite(pending.expiresAt) ||
          pending.expiresAt < Date.now() ||
          !state.groups.some((group) => group.id === pending.savedId)
        ) {
          return null;
        }
        return { savedId: pending.savedId };
      }

      case "pinNativeGroup":
        await saveNativeGroupUnlocked(state, Number(message.groupId), { pin: true });
        await persistState(state);
        result = { saved: true };
        break;

      case "syncNativeGroup": {
        const changed = await syncNativeGroupUnlocked(state, Number(message.groupId));
        if (changed) {
          await persistState(state);
        }
        result = { synced: changed };
        break;
      }

      case "openSavedGroup": {
        const launcherTabId = sender.tab?.id;
        const preferredWindowId = sender.tab?.windowId ?? message.windowId;
        result = await openSavedGroupUnlocked(
          state,
          String(message.savedId || ""),
          preferredWindowId,
          launcherTabId
        );
        await persistState(state);
        break;
      }

      case "toggleSavedGroup": {
        const launcherTabId = sender.tab?.id;
        const preferredWindowId = sender.tab?.windowId ?? message.windowId;
        result = await toggleSavedGroupUnlocked(
          state,
          String(message.savedId || ""),
          preferredWindowId,
          launcherTabId
        );
        await persistState(state);
        break;
      }

      case "closeSavedGroup": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        result = await closeSavedGroupUnlocked(group);
        await persistState(state);
        break;
      }

      case "pinBookmark": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        await ensureBookmark(group, { createIfMissing: true, moveToToolbar: true });
        await persistState(state);
        result = { pinned: true };
        break;
      }

      case "unpinBookmark": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        await removeBookmark(group);
        await persistState(state);
        result = { pinned: false };
        break;
      }

      case "updateSavedGroup": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        group.title = normalizeTitle(message.title, "");
        group.color = normalizeColor(message.color);
        group.icon = message.icon === undefined ? group.icon : normalizeIcon(message.icon);
        group.darkerColors = message.darkerColors === true;
        group.updatedAt = Date.now();
        if (group.live) {
          try {
            await browser.tabGroups.update(group.live.groupId, {
              title: nativeGroupTitle(group),
              color: group.color
            });
          } catch (_error) {
            // Se a instância nativa acabou de desaparecer, preserve o vínculo
            // para tabGroups.onRemoved. Uma reconciliação de startup limpa
            // vínculos realmente obsoletos.
          }
        }
        if (group.bookmarkId) {
          await ensureBookmark(group, { createIfMissing: false });
        }
        await persistState(state);
        result = { updated: true };
        break;
      }

      case "setGroupKeepAtTop": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        const enabled = Boolean(message.enabled);
        if (enabled && !group.keepAtTop) {
          group.keepAtTopOrder = nextKeepAtTopOrder(state);
        } else if (!enabled) {
          group.keepAtTopOrder = null;
        }
        group.keepAtTop = enabled;
        group.updatedAt = Date.now();
        if (group.keepAtTop && group.live) {
          await moveKeptGroupsToTopUnlocked(state, group.live.windowId);
        }
        await persistState(state);
        result = { enabled: group.keepAtTop };
        break;
      }

      case "setGroupArchived": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        const archived = Boolean(message.archived);
        if (archived) {
          await closeSavedGroupUnlocked(group);
          await removeBookmark(group);
          group.keepAtTop = false;
          group.keepAtTopOrder = null;
          renumberKeptGroupsUnlocked(state);
        }
        group.archived = archived;
        group.updatedAt = Date.now();
        await persistState(state);
        result = { archived };
        break;
      }

      case "deleteSavedGroup": {
        const group = state.groups.find((item) => item.id === message.savedId);
        if (!group) {
          throw new Error("Esse grupo salvo não existe mais.");
        }
        result = await softDeleteSavedGroupUnlocked(state, group);
        await persistState(state);
        break;
      }

      case "restoreTrashGroup": {
        result = await restoreTrashGroupUnlocked(state, String(message.savedId || ""));
        await persistState(state);
        break;
      }

      case "deleteTrashGroupPermanently":
        result = permanentlyDeleteTrashGroupUnlocked(state, String(message.savedId || ""));
        await persistLocalState(state);
        break;

      case "emptyTrash":
        purgeExpiredTrashUnlocked(state);
        result = { deleted: state.trash.length };
        state.trash = [];
        await persistLocalState(state);
        break;

      case "archiveAllClosedGroups": {
        const now = Date.now();
        let changed = 0;
        for (const group of state.groups) {
          if (group.live || group.archived) continue;
          await removeBookmark(group);
          group.keepAtTop = false;
          group.keepAtTopOrder = null;
          group.archived = true;
          group.updatedAt = now;
          changed += 1;
        }
        if (changed) {
          renumberKeptGroupsUnlocked(state);
          await persistState(state);
        }
        result = { changed };
        break;
      }

      case "unarchiveAllGroups": {
        const now = Date.now();
        let changed = 0;
        for (const group of state.groups) {
          if (!group.archived) continue;
          group.archived = false;
          group.updatedAt = now;
          changed += 1;
        }
        if (changed) await persistState(state);
        result = { changed };
        break;
      }

      case "trashAllArchived": {
        const archived = state.groups.filter((group) => group.archived);
        for (const group of archived) {
          await softDeleteSavedGroupUnlocked(state, group);
        }
        if (archived.length) await persistState(state);
        result = { deleted: archived.length };
        break;
      }

      case "reorderKeptGroup": {
        const moved = state.groups.find((group) => group.id === String(message.savedId || ""));
        const target = state.groups.find((group) => group.id === String(message.targetId || ""));
        if (!moved?.keepAtTop || !target?.keepAtTop) {
          throw new Error("Os grupos fixados não estão mais disponíveis.");
        }
        const ordered = keptGroupsInOrder(state).filter((group) => group.id !== moved.id);
        const targetIndex = ordered.findIndex((group) => group.id === target.id);
        const offset = message.position === "after" ? 1 : 0;
        ordered.splice(Math.max(0, targetIndex + offset), 0, moved);
        renumberKeptGroupsUnlocked(state, ordered.map((group) => group.id));
        await moveAllKeptGroupsToTopUnlocked(state);
        await persistState(state);
        result = { reordered: true };
        break;
      }

      case "moveKeptGroup": {
        const savedId = String(message.savedId || "");
        const direction = Number(message.direction) < 0 ? -1 : 1;
        const ordered = keptGroupsInOrder(state);
        const index = ordered.findIndex((group) => group.id === savedId);
        if (index === -1) throw new Error("Esse grupo fixado não existe mais.");
        const nextIndex = index + direction;
        if (nextIndex >= 0 && nextIndex < ordered.length) {
          [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
          renumberKeptGroupsUnlocked(state, ordered.map((group) => group.id));
          await moveAllKeptGroupsToTopUnlocked(state);
          await persistState(state);
        }
        result = { moved: nextIndex >= 0 && nextIndex < ordered.length };
        break;
      }

      case "getDiagnosticReport":
        return diagnosticReportUnlocked(state);

      case "markDiagnosticsSeen":
        for (const item of state.diagnostics) item.seen = true;
        await persistLocalState(state);
        result = { seen: state.diagnostics.length };
        break;

      case "clearDiagnostics":
        state.diagnostics = [];
        await persistLocalState(state);
        result = { cleared: true };
        break;

      case "setAutoPin":
        state.settings.autoPinNewGroups = Boolean(message.enabled);
        if (state.settings.autoPinNewGroups) {
          await reconcileLiveLinksUnlocked(state);
        }
        await persistState(state);
        result = { enabled: state.settings.autoPinNewGroups };
        break;

      default:
        throw new Error("Comando desconhecido.");
    }

    return result;
  }, `message:${message.type}`);
}

function publicErrorCode(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (/não existe mais|não está mais aberto|não pertence mais/.test(message)) {
    return "groupMissing";
  }
  if (/abas restauráveis|páginas que o firefox permita restaurar|restaurar nenhuma aba/.test(message)) {
    return "noRestorableTabs";
  }
  if (/firefox sync|storage\.sync|8 kib|100 kib|512 itens/.test(message)) {
    return "syncFailed";
  }
  return "operationFailed";
}

browser.runtime.onMessage.addListener((message, sender) =>
  routeMessage(message, sender).then(
    (data) => ({ ok: true, data }),
    (error) => ({
      ok: false,
      errorCode: publicErrorCode(error),
      error: String(error?.message || error || "Ocorreu um erro inesperado.")
    })
  )
);

function commandRequestWasHandled(requestId) {
  if (typeof requestId !== "string" || !requestId) {
    return false;
  }

  const now = Date.now();
  for (const [knownRequestId, handledAt] of handledCommandRequests) {
    if (now - handledAt > 10_000) {
      handledCommandRequests.delete(knownRequestId);
    }
  }

  if (handledCommandRequests.has(requestId)) {
    return true;
  }
  handledCommandRequests.set(requestId, now);
  return false;
}

async function handleBookmarkCommandNavigation(details) {
  const savedId = savedIdFromManagedBookmarkUrl(details.url);
  if (!savedId || commandRequestWasHandled(details.requestId)) {
    return;
  }

  return serial(async (state) => {
    let preferredWindowId;
    if (Number.isInteger(details.tabId) && details.tabId >= 0) {
      try {
        preferredWindowId = (await browser.tabs.get(details.tabId)).windowId;
      } catch (_error) {
        // Se a aba desaparecer, a janela em foco será usada como destino.
      }
    }

    await toggleSavedGroupUnlocked(state, savedId, preferredWindowId);
    await persistState(state);
  }, "bookmark-command");
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    handleBookmarkCommandNavigation(details).catch((error) => {
      console.error("Groups 'On the Bar': não foi possível executar o atalho", error);
    });

    // Cancela imediatamente, antes que o Firefox substitua o documento da
    // aba atual. O URL .invalid existe apenas como comando do favorito.
    return { cancel: true };
  },
  { urls: [COMMAND_URL_PATTERN], types: ["main_frame"] },
  ["blocking"]
);

function scheduleGroupSync(groupId, delay = 180) {
  if (!Number.isInteger(groupId) || groupId === NO_GROUP) {
    return;
  }
  const key = `group:${groupId}`;
  clearTimeout(syncTimers.get(key));
  syncTimers.set(
    key,
    setTimeout(() => {
      syncTimers.delete(key);
      serial(async (state) => {
        const changed = await syncNativeGroupUnlocked(state, groupId);
        const saved = state.groups.find((group) => group.live?.groupId === groupId);
        if (saved?.keepAtTop) {
          await moveKeptGroupsToTopUnlocked(state, saved.live.windowId);
        }
        if (changed) {
          await persistState(state);
        }
      });
    }, delay)
  );
}

function scheduleWindowSync(windowId, delay = 220) {
  if (!Number.isInteger(windowId)) {
    return;
  }
  const key = `window:${windowId}`;
  clearTimeout(syncTimers.get(key));
  syncTimers.set(
    key,
    setTimeout(() => {
      syncTimers.delete(key);
      serial(async (state) => {
        let changed = false;
        for (const group of state.groups.filter((item) => item.live?.windowId === windowId)) {
          changed = (await updateSavedFromLiveUnlocked(group)) || changed;
        }
        await moveKeptGroupsToTopUnlocked(state, windowId);
        if (changed) {
          await persistState(state);
        }
      });
    }, delay)
  );
}

browser.tabs.onCreated.addListener((tab) => {
  rememberLiveTab(tab);
  if (Number.isInteger(tab.groupId) && tab.groupId !== NO_GROUP) {
    scheduleGroupSync(tab.groupId);
  }
});

browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const observedAt = Date.now();
  const membershipCandidate = recordMembershipChangeCandidate(tab, changeInfo, observedAt);
  if (membershipCandidate) {
    const membershipEvidence = qualifyMembershipChangeEvidence(membershipCandidate);
    if (membershipEvidence) {
      for (const pending of [...pendingNativeGroupRemovals.values()]) {
        if (membershipEvidenceMatchesPending(membershipEvidence, pending)) {
          finalizePendingNativeGroupRemoval(pending.key, { intentionallyEmpty: true }).catch((error) => {
            console.error("Groups 'On the Bar': falha ao registrar saída de aba do grupo", error);
          });
        }
      }
    }
  }

  if (
    Number.isInteger(tab.groupId) &&
    tab.groupId !== NO_GROUP &&
    (changeInfo.url !== undefined || changeInfo.title !== undefined || changeInfo.groupId !== undefined)
  ) {
    scheduleGroupSync(tab.groupId);
  } else if (changeInfo.groupId !== undefined) {
    scheduleWindowSync(tab.windowId);
  }
  if (changeInfo.pinned !== undefined) {
    scheduleWindowSync(tab.windowId, 80);
  }
});

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  browser.tabs.get(tabId).then(
    (tab) => {
      if (tab.groupId !== NO_GROUP) {
        scheduleGroupSync(tab.groupId);
        scheduleWindowSync(moveInfo.windowId, 260);
      } else {
        scheduleWindowSync(moveInfo.windowId);
      }
    },
    () => scheduleWindowSync(moveInfo.windowId)
  );
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const observedAt = Date.now();
  recordTabRemovalEvidence(tabId, removeInfo, observedAt);
  expectedRestoredUrls.delete(tabId);
  scheduleWindowSync(removeInfo.windowId);
  // sessions.onChanged pode ter chegado antes deste evento. Uma nova leitura
  // após registrar a identidade da aba fecha essa race sem consumir pendings
  // que ainda não tenham prova positiva.
  resolvePendingNativeGroupRemovalsFromSessions().catch((error) => {
    console.error("Groups 'On the Bar': não foi possível correlacionar aba removida", error);
  });
});

if (browser.tabGroups?.onCreated) {
  browser.tabGroups.onCreated.addListener((group) => {
    markNativeGroupCreated(group);
    scheduleGroupSync(group.id, 250);
  });
  browser.tabGroups.onUpdated.addListener((group) => scheduleGroupSync(group.id));
  browser.tabGroups.onMoved.addListener((group) => {
    scheduleGroupSync(group.id);
    scheduleWindowSync(group.windowId, 260);
  });
  browser.tabGroups.onRemoved.addListener((group, removeInfo = {}) => {
    const observedAt = Date.now();
    const groupGeneration = markObservedNativeGroupRemoval(group, observedAt);
    return serial(async (state) => {
      // A validade da geração precisa ser conferida no momento da mutação, não
      // só quando o evento foi observado. Se a fila atrasou e Firefox já
      // restaurou/recriou o mesmo windowId/groupId como uma geração nova, este
      // onRemoved antigo não pode tocar saved.live, criar pending nem publicar
      // intentionallyEmpty no Sync.
      if (
        !nativeGroupRemovalGenerationIsCurrent(
          group.windowId,
          group.id,
          groupGeneration
        )
      ) {
        return;
      }

      let changed = false;
      const intentionalClosure = consumeIntentionalNativeGroupClosure(group.windowId, group.id);

      for (const saved of state.groups) {
        if (saved.live?.groupId !== group.id || saved.live?.windowId !== group.windowId) {
          continue;
        }

        if (intentionalClosure || removeInfo.isWindowClosing === true) {
          // Fechamento comandado pela extensão ou da janela inteira: o último
          // snapshot real já salvo continua sendo a fonte persistente.
          saved.live = null;
          changed = true;
          continue;
        }

        const movedOrUngrouped = recentMembershipEvidenceForRemoval(
          group,
          groupGeneration,
          observedAt
        );
        saved.live = null;
        changed = true;

        if (movedOrUngrouped) {
          // Evidência positiva: as abas continuam vivas, mas deixaram o grupo
          // (move-out, A→B ou Ungroup). Nesse caso o grupo persistente fica
          // deliberadamente vazio.
          setSavedGroupIntentionallyEmpty(saved);
          clearPendingNativeGroupRemoval(liveGroupKey(group.windowId, group.id));
        } else {
          // Fechar última aba, Delete group e Save and close emitem a mesma
          // sequência de tabs/tabGroups no Firefox 155. A distinção segura é
          // concluída por sessions.getRecentlyClosed(): close/Delete aparecem;
          // Save and close não. Até a resposta, preserve o snapshot.
          queuePendingNativeGroupRemoval(saved, group, groupGeneration, observedAt);
        }
      }
      const before = state.suppressedNativeGroups.length;
      state.suppressedNativeGroups = state.suppressedNativeGroups.filter(
        (suppression) =>
          suppression.groupId !== group.id || suppression.windowId !== group.windowId
      );
      changed = changed || before !== state.suppressedNativeGroups.length;
      if (changed) {
        await persistState(state);
      }
    }).then(() =>
      // Se sessions.onChanged ocorreu antes de tabGroups.onRemoved, a entrada
      // já pode estar no SessionStore. Consulte imediatamente ao criar o
      // pending; ausência de match mantém a pendência até outro sinal/timeout.
      resolvePendingNativeGroupRemovalsFromSessions()
    ).catch((error) => {
      console.error("Groups 'On the Bar': falha ao processar remoção de grupo", error);
    });
  });
}

if (browser.sessions?.onChanged) {
  browser.sessions.onChanged.addListener(() =>
    resolvePendingNativeGroupRemovalsFromSessions().catch((error) => {
      console.error("Groups 'On the Bar': não foi possível classificar remoção nativa", error);
    })
  );
}

browser.bookmarks.onRemoved.addListener((bookmarkId) => {
  if (ignoredBookmarkRemovals.has(bookmarkId)) {
    return;
  }
  serial(async (state) => {
    const group = state.groups.find((item) => item.bookmarkId === bookmarkId);
    if (group) {
      group.bookmarkId = null;
      await persistState(state);
    }
  });
});

if (browser.bookmarks.onCreated) {
  browser.bookmarks.onCreated.addListener((_bookmarkId, bookmark) => {
    if (!isManagedBookmarkUrl(bookmark?.url)) {
      return;
    }
    serial(async (state) => {
      const remoteChanged = await pullRemoteSyncUnlocked(state);
      const bookmarksChanged = await reconcileBookmarkDuplicatesUnlocked(state);
      if (remoteChanged || bookmarksChanged) {
        await persistState(state);
      }
    });
  });
}

browser.bookmarks.onChanged.addListener((bookmarkId) => {
  serial(async (state) => {
    const group = state.groups.find((item) => item.bookmarkId === bookmarkId);
    if (group) {
      await ensureBookmark(group, { createIfMissing: false });
      await persistState(state);
    }
  });
});

if (browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName !== "sync" ||
      !Object.keys(changes || {}).some((key) => SyncStore.isSyncKey(key))
    ) {
      return;
    }

    serial(async (state) => {
      const remoteChanged = await pullRemoteSyncUnlocked(state);
      if (!remoteChanged) {
        return;
      }
      await reconcileLiveLinksUnlocked(state);
      await persistState(state);
    });
  });
}

function groupSelectionMenuTitle(selection, language) {
  if (!selection || !selection.totalCount) {
    return Ui.t(language, "menu.addGeneric");
  }
  if (!selection.eligibleTabIds.length) {
    return selection.totalCount === 1
      ? Ui.t(language, "menu.pinnedOne")
      : Ui.t(language, "menu.pinnedMany");
  }
  if (selection.pinnedCount) {
    return Ui.t(language, "menu.addPartial", {
      eligible: selection.eligibleTabIds.length,
      total: selection.totalCount
    });
  }
  return selection.totalCount === 1
    ? Ui.t(language, "menu.addOne")
    : Ui.t(language, "menu.addMany", { count: selection.totalCount });
}

async function readContextTabSelection(tab) {
  if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId)) {
    return null;
  }

  let clickedTab;
  try {
    clickedTab = await browser.tabs.get(tab.id);
  } catch (_error) {
    return null;
  }

  const highlighted = (await browser.tabs.query({
    windowId: clickedTab.windowId,
    highlighted: true
  })).sort((a, b) => a.index - b.index);
  const selected = highlighted.some((candidate) => candidate.id === clickedTab.id)
    ? highlighted
    : [clickedTab];
  const uniqueTabs = [...new Map(selected.map((candidate) => [candidate.id, candidate])).values()]
    .filter((candidate) => candidate.windowId === clickedTab.windowId)
    .sort((a, b) => a.index - b.index);
  const eligibleTabs = uniqueTabs.filter((candidate) => !candidate.pinned);

  return {
    clickedTabId: clickedTab.id,
    windowId: clickedTab.windowId,
    tabIds: uniqueTabs.map((candidate) => candidate.id),
    eligibleTabIds: eligibleTabs.map((candidate) => candidate.id),
    groupIdsByTabId: Object.fromEntries(
      eligibleTabs.map((candidate) => [String(candidate.id), candidate.groupId])
    ),
    totalCount: uniqueTabs.length,
    pinnedCount: uniqueTabs.length - eligibleTabs.length,
    createdAt: Date.now()
  };
}

async function currentContextTabSelection(tab) {
  let selection = contextTabSelection;
  if (
    !selection ||
    selection.clickedTabId !== tab?.id ||
    selection.windowId !== tab?.windowId ||
    Date.now() - selection.createdAt > CONTEXT_SELECTION_TTL_MS
  ) {
    selection = await readContextTabSelection(tab);
  }
  if (!selection) {
    return null;
  }

  const liveTabs = [];
  for (const tabId of selection.tabIds) {
    try {
      const liveTab = await browser.tabs.get(tabId);
      if (liveTab.windowId === selection.windowId) {
        liveTabs.push(liveTab);
      }
    } catch (_error) {
      // Uma aba pode ser fechada enquanto o menu ainda está aberto.
    }
  }
  const eligibleTabs = liveTabs.filter((candidate) => !candidate.pinned);
  return {
    ...selection,
    tabIds: liveTabs.map((candidate) => candidate.id),
    eligibleTabIds: eligibleTabs.map((candidate) => candidate.id),
    groupIdsByTabId: Object.fromEntries(
      eligibleTabs.map((candidate) => [String(candidate.id), candidate.groupId])
    ),
    totalCount: liveTabs.length,
    pinnedCount: liveTabs.length - eligibleTabs.length
  };
}

function nextNativeGroupTitle(nativeGroups, language) {
  const usedTitles = new Set(
    nativeGroups.map((group) => String(group.title || "").trim().toLocaleLowerCase())
  );
  let number = 1;
  while (
    usedTitles.has(
      Ui.t(language, "group.defaultName", { number }).toLocaleLowerCase()
    )
  ) {
    number += 1;
  }
  return Ui.t(language, "group.defaultName", { number });
}

function nextNativeGroupColor(nativeGroups) {
  const usedColors = new Set(nativeGroups.map((group) => normalizeColor(group.color)));
  return (
    NEW_GROUP_COLOR_ORDER.find((color) => !usedColors.has(color)) ||
    NEW_GROUP_COLOR_ORDER[nativeGroups.length % NEW_GROUP_COLOR_ORDER.length]
  );
}

async function updateSavedGroupAfterContextAction(groupId) {
  try {
    await serial(async (state) => {
      if (await syncNativeGroupUnlocked(state, groupId)) {
        await persistState(state);
      }
    });
  } catch (error) {
    // O agrupamento nativo já foi concluído. Uma página interna protegida pode
    // apenas impedir que esse grupo seja salvo pela extensão.
    console.warn("Groups 'On the Bar': grupo criado, mas não salvo", error);
  }
}

async function groupContextSelectionInNewGroup(selection, language) {
  if (!selection?.eligibleTabIds.length) {
    return;
  }
  const nativeGroups = await browser.tabGroups.query({ windowId: selection.windowId });
  const groupId = await browser.tabs.group({
    tabIds: selection.eligibleTabIds,
    createProperties: { windowId: selection.windowId }
  });
  observeNativeGroupAlive(selection.windowId, groupId);
  try {
    await browser.tabGroups.update(groupId, {
      title: nextNativeGroupTitle(nativeGroups, language),
      color: nextNativeGroupColor(nativeGroups),
      collapsed: false
    });
  } catch (error) {
    // O agrupamento já aconteceu de forma atômica. Se o grupo mudar entre as
    // duas chamadas, ainda o salvamos em vez de perder a ação do usuário.
    console.warn("Groups 'On the Bar': grupo criado sem nome ou cor automáticos", error);
  }
  await updateSavedGroupAfterContextAction(groupId);
}

async function addContextSelectionToGroup(selection, groupId) {
  if (!selection?.eligibleTabIds.length || !Number.isInteger(groupId)) {
    return;
  }
  const targetGroup = await browser.tabGroups.get(groupId);
  if (targetGroup.windowId !== selection.windowId) {
    throw new Error("O grupo escolhido não pertence mais a esta janela.");
  }
  await browser.tabs.group({
    tabIds: selection.eligibleTabIds,
    groupId
  });
  observeNativeGroupAlive(targetGroup.windowId, groupId);
  if (targetGroup.collapsed) {
    await browser.tabGroups.update(groupId, { collapsed: false });
  }
  await updateSavedGroupAfterContextAction(groupId);
}

async function removeDynamicGroupMenuItems() {
  const menuIds = [...dynamicGroupMenuIds];
  dynamicGroupMenuIds.clear();
  await Promise.all(
    menuIds.map((menuId) => browser.menus.remove(menuId).catch(() => undefined))
  );
}

async function rebuildGroupSelectionMenu(info, tab) {
  const menuInstanceId = nextMenuInstanceId++;
  activeMenuInstanceId = menuInstanceId;
  const isTabMenu = Boolean(info?.contexts?.includes("tab") && tab);
  const preferences = await Ui.load();
  const language = preferences.language;
  const isGroupTab = Boolean(
    isTabMenu && Number.isInteger(tab.groupId) && tab.groupId !== NO_GROUP
  );

  await Promise.all([
    browser.menus.update(MENU_PIN_GROUP, {
      title: Ui.t(language, "menu.pinGroup"),
      visible: Boolean(
        isTabMenu && Number.isInteger(tab.groupId) && tab.groupId !== NO_GROUP
      )
    }),
    browser.menus.update(MENU_MODIFY_GROUP, {
      title: Ui.t(language, "menu.modifyGroup"),
      visible: isGroupTab
    }),
    browser.menus.update(MENU_GROUP_SELECTED_NEW, {
      title: Ui.t(language, "menu.newGroup")
    }),
    browser.menus.update(MENU_OPEN_VISUAL, {
      title: Ui.t(language, "menu.openVisual")
    })
  ]);

  if (!isTabMenu) {
    browser.menus.refresh();
    return;
  }

  const [selection, nativeGroups] = await Promise.all([
    readContextTabSelection(tab),
    browser.tabGroups.query({ windowId: tab.windowId })
  ]);
  if (activeMenuInstanceId !== menuInstanceId) {
    return;
  }

  contextTabSelection = selection;
  await removeDynamicGroupMenuItems();
  if (activeMenuInstanceId !== menuInstanceId) {
    return;
  }

  const canGroup = Boolean(selection?.eligibleTabIds.length);
  await Promise.all([
    browser.menus.update(MENU_GROUP_SELECTED, {
      title: groupSelectionMenuTitle(selection, language),
      enabled: canGroup
    }),
    browser.menus.update(MENU_GROUP_SELECTED_NEW, { enabled: canGroup }),
    browser.menus.update(MENU_GROUP_SELECTED_SEPARATOR, {
      visible: canGroup && nativeGroups.length > 0
    })
  ]);
  if (activeMenuInstanceId !== menuInstanceId) {
    return;
  }

  if (canGroup) {
    for (const nativeGroup of nativeGroups) {
      const menuId = `${MENU_GROUP_SELECTED_EXISTING_PREFIX}${nativeGroup.id}`;
      dynamicGroupMenuIds.add(menuId);
      const allAlreadyInTarget = selection.eligibleTabIds.every(
        (tabId) => selection.groupIdsByTabId[String(tabId)] === nativeGroup.id
      );
      browser.menus.create({
        id: menuId,
        parentId: MENU_GROUP_SELECTED,
        title: normalizeTitle(nativeGroup.title, Ui.t(language, "group.untitled")),
        contexts: ["tab"],
        enabled: !allAlreadyInTarget
      });
    }
  }
  browser.menus.refresh();
}

async function installContextMenu() {
  activeMenuInstanceId = 0;
  contextTabSelection = null;
  dynamicGroupMenuIds.clear();
  await browser.menus.removeAll();
  const preferences = await Ui.load();
  const language = preferences.language;
  browser.menus.create({
    id: MENU_GROUP_SELECTED,
    title: Ui.t(language, "menu.addGeneric"),
    contexts: ["tab"]
  });
  browser.menus.create({
    id: MENU_GROUP_SELECTED_NEW,
    parentId: MENU_GROUP_SELECTED,
    title: Ui.t(language, "menu.newGroup"),
    contexts: ["tab"]
  });
  browser.menus.create({
    id: MENU_GROUP_SELECTED_SEPARATOR,
    parentId: MENU_GROUP_SELECTED,
    type: "separator",
    contexts: ["tab"],
    visible: false
  });
  browser.menus.create({
    id: MENU_PIN_GROUP,
    title: Ui.t(language, "menu.pinGroup"),
    contexts: ["tab"],
    visible: false
  });
  browser.menus.create({
    id: MENU_MODIFY_GROUP,
    title: Ui.t(language, "menu.modifyGroup"),
    contexts: ["tab"],
    visible: false
  });
  browser.menus.create({
    id: MENU_OPEN_VISUAL,
    title: Ui.t(language, "menu.openVisual"),
    contexts: ["browser_action"]
  });
}

browser.menus.onShown.addListener((info, tab) =>
  rebuildGroupSelectionMenu(info, tab).catch((error) => {
    console.error("Groups 'On the Bar': não foi possível montar o menu de grupos", error);
  })
);

if (browser.menus.onHidden) {
  browser.menus.onHidden.addListener(() => {
    activeMenuInstanceId = 0;
  });
}

async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === MENU_OPEN_VISUAL) {
    await browser.tabs.create({ url: browser.runtime.getURL("visual/setup.html") });
    return;
  }

  if (info.menuItemId === MENU_PIN_GROUP && tab?.groupId !== NO_GROUP) {
    await serial(async (state) => {
      await saveNativeGroupUnlocked(state, tab.groupId, { pin: true });
      await persistState(state);
    });
    return;
  }

  if (
    info.menuItemId === MENU_MODIFY_GROUP &&
    Number.isInteger(tab?.groupId) &&
    tab.groupId !== NO_GROUP
  ) {
    const savedId = await serial(async (state) => {
      const saved = await saveNativeGroupUnlocked(state, tab.groupId, {
        pin: state.settings.autoPinNewGroups
      });
      await persistState(state);
      return saved.id;
    });
    await browser.storage.local.set({
      [PENDING_EDITOR_KEY]: {
        savedId,
        expiresAt: Date.now() + 30_000
      }
    });
    try {
      if (!browser.browserAction?.openPopup) {
        throw new Error("openPopup indisponível");
      }
      await browser.browserAction.openPopup();
    } catch (_error) {
      await browser.windows.create({
        url: browser.runtime.getURL("popup/popup.html"),
        type: "popup",
        width: 500,
        height: 720
      });
    }
    return;
  }

  const menuItemId = String(info.menuItemId || "");

  if (
    menuItemId !== MENU_GROUP_SELECTED_NEW &&
    !menuItemId.startsWith(MENU_GROUP_SELECTED_EXISTING_PREFIX)
  ) {
    return;
  }

  const selection = await currentContextTabSelection(tab);
  if (menuItemId === MENU_GROUP_SELECTED_NEW) {
    const preferences = await Ui.load();
    await groupContextSelectionInNewGroup(selection, preferences.language);
  } else {
    const groupId = Number(menuItemId.slice(MENU_GROUP_SELECTED_EXISTING_PREFIX.length));
    await addContextSelectionToGroup(selection, groupId);
  }
  contextTabSelection = null;
}

browser.menus.onClicked.addListener((info, tab) =>
  handleContextMenuClick(info, tab).catch((error) => {
    console.error("Groups 'On the Bar': não foi possível concluir a ação do menu", error);
  })
);

function initializeExtension() {
  const run = initializationQueue.then(async () => {
    await installContextMenu();
    await restoreLifecycleObservationStartFromSession();
    await seedLiveTabLifecycleCache();
    await serial(async (state) => {
      const changed = await reconcileLiveLinksUnlocked(state);
      if (changed || shouldRetryPendingSyncUnlocked(state)) {
        await persistState(state);
      }
    });
  });

  initializationQueue = run.catch((error) => console.error("Groups 'On the Bar':", error));
  return run;
}

browser.runtime.onInstalled.addListener(() => initializeExtension());
browser.runtime.onStartup.addListener(() => initializeExtension());

// Também executa ao usar “Reload” em about:debugging, que nem sempre dispara
// onInstalled para uma extensão temporária já carregada.
initializeExtension().catch((error) => console.error("Groups 'On the Bar':", error));
