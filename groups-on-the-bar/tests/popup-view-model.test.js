"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadViewModel() {
  const context = { globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../popup/view-model.js"), "utf8"),
    context
  );
  return context.GruposPopupViewModel;
}

const ViewModel = loadViewModel();
const groups = [
  { id: "closed-a", open: false, liveWindowId: null },
  { id: "other-a", open: true, liveWindowId: 9 },
  { id: "current-a", open: true, liveWindowId: 4 },
  { id: "closed-b", open: false, liveWindowId: null },
  { id: "current-b", open: true, liveWindowId: 4 },
  { id: "other-b", open: true, liveWindowId: 8 },
  { id: "archived-a", open: false, liveWindowId: null, archived: true }
];

test("classifica grupos pela janela atual", () => {
  assert.equal(ViewModel.location(groups[0], 4), "closed");
  assert.equal(ViewModel.location(groups[1], 4), "otherWindow");
  assert.equal(ViewModel.location(groups[2], 4), "currentWindow");
});

test("Todos prioriza janela atual, outras janelas e fechados", () => {
  assert.deepEqual(
    ViewModel.filterAndSort(groups, 4, "all").map((group) => group.id),
    ["current-a", "current-b", "other-a", "other-b", "closed-a", "closed-b"]
  );
});

test("filtros Abertos e Fechados mostram somente o estado escolhido", () => {
  assert.deepEqual(
    ViewModel.filterAndSort(groups, 4, "open").map((group) => group.id),
    ["current-a", "current-b", "other-a", "other-b"]
  );
  assert.deepEqual(
    ViewModel.filterAndSort(groups, 4, "closed").map((group) => group.id),
    ["closed-a", "closed-b"]
  );
  assert.deepEqual(
    ViewModel.filterAndSort(groups, 4, "archived").map((group) => group.id),
    ["archived-a"]
  );
});

test("Todos exclui arquivados por padrão e pode incluí-los no fim", () => {
  assert.equal(ViewModel.filterAndSort(groups, 4, "all").some((group) => group.archived), false);
  assert.deepEqual(
    ViewModel.filterAndSort(groups, 4, "all", true).map((group) => group.id),
    ["current-a", "current-b", "other-a", "other-b", "closed-a", "closed-b", "archived-a"]
  );
});

test("grupos mantidos no topo têm prioridade global e respeitam a ordem persistente", () => {
  const candidates = [
    { id: "normal", open: true, liveWindowId: 4, keepAtTop: false },
    { id: "kept-second", open: true, liveWindowId: 4, keepAtTop: true, keepAtTopOrder: 1000 },
    { id: "kept-first", open: false, liveWindowId: null, keepAtTop: true, keepAtTopOrder: 0 }
  ];
  assert.deepEqual(
    ViewModel.filterAndSort(candidates, 4, "all").map((group) => group.id),
    ["kept-first", "kept-second", "normal"]
  );
});
