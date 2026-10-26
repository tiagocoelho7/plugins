"use strict";

(() => {
  function location(group, currentWindowId) {
    if (!group?.open) return "closed";
    return group.liveWindowId === currentWindowId ? "currentWindow" : "otherWindow";
  }

  function rank(group, currentWindowId) {
    if (group?.archived) return 3;
    const groupLocation = location(group, currentWindowId);
    if (groupLocation === "currentWindow") return 0;
    if (groupLocation === "otherWindow") return 1;
    return 2;
  }

  function filterAndSort(
    groups,
    currentWindowId,
    filter = "all",
    includeArchivedInAll = false
  ) {
    return (Array.isArray(groups) ? groups : [])
      .map((group, originalIndex) => ({ group, originalIndex }))
      .filter(({ group }) => {
        if (filter === "archived") return Boolean(group.archived);
        if (filter === "open") return !group.archived && Boolean(group.open);
        if (filter === "closed") return !group.archived && !group.open;
        return includeArchivedInAll || !group.archived;
      })
      .sort((left, right) => {
        const leftArchived = Boolean(left.group.archived);
        const rightArchived = Boolean(right.group.archived);
        if (leftArchived !== rightArchived) return Number(leftArchived) - Number(rightArchived);
        if (!leftArchived) {
          const keptDifference =
            Number(Boolean(right.group.keepAtTop)) - Number(Boolean(left.group.keepAtTop));
          if (keptDifference) return keptDifference;
          if (left.group.keepAtTop && right.group.keepAtTop) {
            const leftOrder = Number.isFinite(left.group.keepAtTopOrder)
              ? left.group.keepAtTopOrder
              : Infinity;
            const rightOrder = Number.isFinite(right.group.keepAtTopOrder)
              ? right.group.keepAtTopOrder
              : Infinity;
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          }
        }
        return (
          rank(left.group, currentWindowId) - rank(right.group, currentWindowId) ||
          left.originalIndex - right.originalIndex
        );
      })
      .map(({ group }) => group);
  }

  globalThis.GruposPopupViewModel = Object.freeze({ location, rank, filterAndSort });
})();
