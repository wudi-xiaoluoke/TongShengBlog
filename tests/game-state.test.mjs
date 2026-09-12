import test from 'node:test';
import assert from 'node:assert/strict';

import * as gameState from '../src/main/resources/static/js/game/game-state.mjs';

const {
  createInitialState,
  placeSupplyOrder,
  purchaseUpgrade,
  restoreState,
  serializeState,
  serveRequest,
  settleSupplyOrders
} = gameState;

test('creates version 2 warehouse and shelf inventories', () => {
  const state = createInitialState(1_000);

  assert.equal(state.saveVersion, 2);
  assert.equal(state.warehouseInventory.candy, 0);
  assert.equal(state.shelfInventory.candy, 5);
  assert.equal(state.shelfInventory.chips, 3);
  assert.equal(state.reservedInventory.candy, 0);
});

test('places and settles a supply order', () => {
  const state = createInitialState(1_000);
  const order = placeSupplyOrder(state, 'chips', 1_000);

  assert.equal(state.coins, 170);
  assert.equal(state.supplyOrders.length, 1);

  settleSupplyOrders(state, order.readyAt);

  assert.equal(state.warehouseInventory.chips, 10);
  assert.equal(state.supplyOrders.length, 0);
});

test('serves available snacks and records income', () => {
  const state = createInitialState(1_000);
  state.shelfInventory.candy = 2;

  const result = serveRequest(state, [{ productId: 'candy', quantity: 1 }]);

  assert.equal(result.ok, true);
  assert.equal(state.shelfInventory.candy, 1);
  assert.equal(state.coins, 236);
  assert.equal(state.stats.totalRevenue, 36);
  assert.equal(state.stats.customersServed, 1);
});

test('does not partially serve an order with missing stock', () => {
  const state = createInitialState(1_000);
  state.shelfInventory.candy = 1;
  state.shelfInventory.chips = 0;

  const result = serveRequest(state, [
    { productId: 'candy', quantity: 1 },
    { productId: 'chips', quantity: 1 }
  ]);

  assert.equal(result.ok, false);
  assert.equal(state.shelfInventory.candy, 1);
  assert.equal(state.coins, 200);
});

test('purchases an upgrade and applies its level', () => {
  const state = createInitialState(1_000);
  state.coins = 1_000;

  const result = purchaseUpgrade(state, 'checkout');

  assert.equal(result.ok, true);
  assert.equal(state.upgrades.checkout, 1);
  assert.equal(state.coins, 650);
});

test('restores completed offline deliveries', () => {
  const state = createInitialState(1_000);
  placeSupplyOrder(state, 'candy', 1_000);

  const restored = restoreState(serializeState(state), 40_000);

  assert.equal(restored.warehouseInventory.candy, 10);
  assert.equal(restored.supplyOrders.length, 0);
});

test('migrates legacy inventory into shelves then warehouse', () => {
  const legacy = JSON.stringify({
    version: 1,
    coins: 200,
    inventory: { candy: 25, chips: 3 },
    upgrades: { shelf: 0 }
  });

  const state = restoreState(legacy, 2_000);

  assert.equal(state.saveVersion, 2);
  // 默认 6 柜 6 种：每种 4 行 × 3 格 × 每格 1 件 = 12
  assert.equal(state.shelfInventory.candy, 12);
  assert.equal(state.warehouseInventory.candy, 13);
  assert.equal(state.shelfInventory.chips, 3);
});

test('restocks a shelf without losing inventory', () => {
  assert.equal(typeof gameState.restockShelf, 'function');
  const state = createInitialState(1_000);
  state.warehouseInventory.candy = 10;
  const before = state.warehouseInventory.candy + state.shelfInventory.candy;

  const moved = gameState.restockShelf(state, 'candy', 5);

  assert.equal(moved, 5);
  assert.equal(state.warehouseInventory.candy + state.shelfInventory.candy, before);
});

test('reserved stock still occupies shelf capacity and can be released without loss', () => {
  const state = createInitialState(1_000);
  state.shelfInventory.candy = 20;
  state.warehouseInventory.candy = 5;
  const reservation = gameState.reserveShelfOrder(state, [{ productId: 'candy', quantity: 5 }]);

  assert.equal(state.reservedInventory.candy, 5);
  assert.equal(gameState.restockShelf(state, 'candy', 5), 0);
  gameState.releaseReservedItems(state, reservation.reservedItems);

  assert.equal(state.shelfInventory.candy, 20);
  assert.equal(state.warehouseInventory.candy, 5);
  assert.equal(state.reservedInventory.candy, 0);
});

test('restoring a save returns in-flight reservations to their shelves', () => {
  const state = createInitialState(1_000);
  gameState.reserveShelfOrder(state, [{ productId: 'candy', quantity: 2 }]);

  const restored = restoreState(serializeState(state, 2_000), 3_000);

  assert.equal(restored.shelfInventory.candy, 5);
  assert.equal(restored.reservedInventory.candy, 0);
});

test('classifies shelf fill levels', () => {
  assert.equal(typeof gameState.shelfDisplayState, 'function');
  assert.equal(gameState.shelfDisplayState(0, 20), 'empty');
  assert.equal(gameState.shelfDisplayState(1, 20), 'low');
  assert.equal(gameState.shelfDisplayState(8, 20), 'half');
  assert.equal(gameState.shelfDisplayState(16, 20), 'full');
});

test('recovers safely from a corrupt save', () => {
  const restored = restoreState('{broken json', 50_000);

  assert.equal(restored.coins, 200);
  assert.equal(restored.recoveredFromCorruptSave, true);
});
