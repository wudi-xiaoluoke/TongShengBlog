import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceDay,
  commitReservedSale,
  createInitialState,
  purchaseShelfCabinet,
  reserveShelfOrder,
  restoreState,
  serializeState
} from '../src/main/resources/static/js/game/game-state.mjs';
import { createCustomerSimulation } from '../src/main/resources/static/js/game/game-customer.mjs';
import {
  GAME_VERSION,
  MAX_CABINETS,
  PATIENCE_BASE_MS,
  VIP_PATIENCE_FACTOR
} from '../src/main/resources/static/js/game/game-config.mjs';
import { buildWorld } from '../src/main/resources/static/js/game/game-world.mjs';

function runUntil(simulation, customer, predicate, { maxTicks = 4_000, stepMs = 50 } = {}) {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    simulation.update(stepMs, tick * stepMs);
    if (predicate(customer)) return tick;
  }
  return maxTicks;
}

test('impatient customer abandons the queue, releases stock and hurts reputation', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 5;
  state.reputation = 5;
  const angryEvents = [];
  const simulation = createCustomerSimulation({ state, onAngryLeave: (event) => angryEvents.push(event) });

  const first = simulation.spawn({ id: 'first', request: [{ productId: 'candy', quantity: 1 }] });
  const second = simulation.spawn({ id: 'second', request: [{ productId: 'candy', quantity: 1 }] });
  // 第二位顾客注定要在货架旁等待
  second.maxPatienceMs = 600;
  second.patienceMs = 560;

  const ticks = runUntil(simulation, second, (customer) => customer.phase === 'leaving');
  assert.ok(ticks < 4_000, 'angry customer should head for the exit quickly');

  assert.equal(second.angry, true);
  assert.equal(second.reservedItems.length, 0, 'reserved stock must be returned when leaving angrily');
  // 初始 5 件：两位顾客各预留 1（剩 3），生气离店退回 1 → 4（第一位顾客的预留仍持有）
  assert.equal(state.shelfInventory.candy, 4, 'angry customer reservation released back to the shelf');
  assert.equal(state.reputation, 3, 'angry leave costs 2 reputation');
  assert.equal(state.stats.customersLeft, 1);
  assert.equal(angryEvents.length, 1);

  // 第一位顾客不受影响，正常走完流程
  runUntil(simulation, first, (customer) => customer.phase === 'done');
  assert.equal(first.paid, true);
  assert.equal(state.stats.customersServed, 1);
});

test('fast service earns a tip on top of the sale', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 5;
  const checkoutEvents = [];
  const simulation = createCustomerSimulation({
    state,
    onCheckout: (event) => checkoutEvents.push(event)
  });
  const customer = simulation.spawn({ id: 'happy', request: [{ productId: 'candy', quantity: 1 }] });

  runUntil(simulation, customer, (item) => item.phase === 'done');

  assert.equal(checkoutEvents.length, 1);
  assert.equal(checkoutEvents[0].revenue, 36);
  assert.ok(checkoutEvents[0].tip >= 1, 'patient customer should leave a tip');
  // 小费计入总营收（36 收入 + 至少 1 小费）
  assert.ok(state.stats.totalRevenue >= 37);
});

test('vip customers pay a 1.5x premium but run out of patience sooner', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 5;
  const checkoutEvents = [];
  const simulation = createCustomerSimulation({
    state,
    onCheckout: (event) => checkoutEvents.push(event)
  });
  const customer = simulation.spawn({
    id: 'vip-1',
    vip: true,
    request: [{ productId: 'candy', quantity: 1 }]
  });

  assert.equal(customer.vip, true);
  assert.equal(customer.maxPatienceMs, Math.round(PATIENCE_BASE_MS * VIP_PATIENCE_FACTOR));

  runUntil(simulation, customer, (item) => item.phase === 'done');

  assert.equal(checkoutEvents.length, 1);
  assert.equal(checkoutEvents[0].revenue, Math.round(36 * 1.5), 'vip pays 1.5x');
  assert.equal(state.coins, 200 + Math.round(36 * 1.5) + checkoutEvents[0].tip);
});

test('commitReservedSale supports pay multipliers and tracks the daily revenue', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 3;
  const reservation = reserveShelfOrder(state, [{ productId: 'candy', quantity: 2 }]);
  assert.equal(reservation.ok, true);
  const result = commitReservedSale(state, reservation.reservedItems, 1, { multiplier: 1.5 });

  assert.equal(result.revenue, Math.round(72 * 1.5));
  assert.equal(state.day.revenue, Math.round(72 * 1.5));
});

test('advanceDay charges rent, rewards the daily goal and opens the next day', () => {
  const state = createInitialState(1);
  state.coins = 1_000;
  state.reputation = 10;
  // 第 1 级房租 = 50 + 35 = 85，目标 = 170
  state.day.revenue = 500;

  const settlement = advanceDay(state, 1);
  assert.equal(settlement.rent, 85);
  assert.equal(settlement.paid, true);
  assert.equal(settlement.reachedGoal, true);
  assert.equal(state.coins, 1_000 - 85);
  assert.equal(state.reputation, 15, 'goal reached grants +5 reputation');
  assert.equal(state.day.number, 2);
  assert.equal(state.day.elapsedMs, 0);
  assert.equal(state.day.revenue, 0);

  // 交不起房租：金币清零且口碑重挫，但不会负资产
  state.coins = 10;
  state.reputation = 20;
  const poor = advanceDay(state, 2);
  assert.equal(poor.paid, false);
  assert.equal(poor.shortfall, 75);
  assert.equal(state.coins, 0);
  assert.equal(state.reputation, 12, 'shortfall costs 8 reputation');
  assert.equal(state.day.number, 3);
});

test('older saves without a day record migrate to day one safely', () => {
  const legacy = createInitialState(1);
  delete legacy.day;
  const restored = restoreState(serializeState({ ...legacy, day: undefined }), 2);

  assert.equal(restored.recoveredFromCorruptSave, false);
  assert.equal(restored.day.number, 1);
  assert.equal(restored.day.revenue, 0);
  assert.equal(restored.saveVersion, GAME_VERSION);
});

test('buying a cabinet adds capacity and grows more expensive each time', () => {
  const state = createInitialState(1);
  state.coins = 5_000;
  state.level = 5; // 解锁花生/棉花糖/辣条等新品

  const first = purchaseShelfCabinet(state, 'peanut', 1);
  assert.equal(first.ok, true);
  assert.equal(first.cost, 180);
  assert.equal(state.cabinetCount, 7);
  assert.equal(state.shelves.at(-1), 'peanut');
  assert.equal(state.coins, 5_000 - 180);

  const second = purchaseShelfCabinet(state, 'marshmallow', 2);
  assert.equal(second.ok, true);
  assert.equal(second.cost, Math.round(180 * 1.6));
  assert.equal(state.cabinetCount, 8);
  assert.equal(state.shelves.length, 8);

  // 世界重建后：8 个柜位，peanut 的主货柜在中岛排
  const world = buildWorld(state);
  assert.equal(world.shelves.length, 8);
  assert.equal(world.shelfByProduct('peanut').y >= 200, true);
  assert.ok(world.routeForProduct('peanut').length >= 3);

  // 账本记录支出
  assert.equal(state.ledger[0].label, '新增零食柜：云朵棉花糖');

  // 空柜扩容：不加新品，纯加柜数
  const third = purchaseShelfCabinet(state, null, 3);
  assert.equal(third.ok, true);
  assert.equal(state.cabinetCount, 9);
  assert.equal(state.shelves.length, 8);
  assert.equal(state.ledger[0].label, '扩建空零食柜');
});

test('cabinet purchase rejects duplicates, locked and unknown products', () => {
  const state = createInitialState(1); // level 1，只解锁 candy/chips
  state.coins = 1_000;

  assert.equal(purchaseShelfCabinet(state, 'candy', 1).ok, false, 'duplicate product rejected');
  assert.equal(purchaseShelfCabinet(state, 'mystery', 1).ok, false, 'unknown product rejected');
  assert.equal(purchaseShelfCabinet(state, 'chocolate', 1).ok, false, 'locked product rejected');
  assert.equal(state.coins, 1_000);
  assert.equal(state.shelves.length, 6);
});

test('cabinet purchase stops at the maximum number of slots', () => {
  const state = createInitialState(1);
  state.coins = 1_000_000;
  state.level = 20;
  state.cabinetCount = 10;
  state.shelves = ['candy', 'chips', 'seaweed', 'soda', 'cookies', 'jelly', 'peanut', 'marshmallow', 'latiao', 'chocolate'];

  const result = purchaseShelfCabinet(state, 'candy', 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason.includes('摆满'), true);
  assert.equal(state.cabinetCount ?? state.shelves.length, MAX_CABINETS);
});

test('older saves without a shelves record migrate to the default six cabinets', () => {
  const legacy = createInitialState(1);
  delete legacy.shelves;
  const restored = restoreState(serializeState(legacy), 2);

  assert.deepEqual(restored.shelves, ['candy', 'chips', 'seaweed', 'soda', 'cookies', 'jelly']);
  assert.equal(restored.cabinetCount, 6);
  assert.equal(buildWorld(restored).shelves.length, 6);

  // 带自定义柜列表的存档原样保留（非法 id 被剔除），柜数回落为零食数
  const custom = createInitialState(1);
  custom.shelves = ['candy', 'chips', 'peanut', 'ghost-snack', 'chips'];
  custom.cabinetCount = 3;
  const restoredCustom = restoreState(serializeState(custom), 2);
  assert.deepEqual(restoredCustom.shelves, ['candy', 'chips', 'peanut']);
  assert.equal(restoredCustom.cabinetCount, 3);
});
