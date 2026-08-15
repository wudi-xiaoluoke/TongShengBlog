import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commitReservedSale,
  createInitialState,
  releaseReservedItems,
  reserveShelfOrder
} from '../src/main/resources/static/js/game/game-state.mjs';
import {
  createCustomerSimulation,
  customerHitTest
} from '../src/main/resources/static/js/game/game-customer.mjs';
import { pointInsideAnyCollision } from '../src/main/resources/static/js/game/game-world.mjs';

test('reserves a multi-product order atomically', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 2;
  state.shelfInventory.chips = 0;

  const failed = reserveShelfOrder(state, [
    { productId: 'candy', quantity: 1 },
    { productId: 'chips', quantity: 1 }
  ]);

  assert.equal(failed.ok, false);
  assert.equal(failed.missingProductId, 'chips');
  assert.equal(state.shelfInventory.candy, 2);
  assert.equal(state.shelfInventory.chips, 0);

  state.shelfInventory.chips = 1;
  const reserved = reserveShelfOrder(state, [
    { productId: 'candy', quantity: 1 },
    { productId: 'chips', quantity: 1 }
  ]);
  assert.equal(reserved.ok, true);
  assert.deepEqual(reserved.reservedItems, [
    { productId: 'candy', quantity: 1 },
    { productId: 'chips', quantity: 1 }
  ]);
  assert.equal(state.shelfInventory.candy, 1);
  assert.equal(state.shelfInventory.chips, 0);
});

test('releases reservations or commits them without a second stock deduction', () => {
  const state = createInitialState(1);
  const reservation = reserveShelfOrder(state, [{ productId: 'candy', quantity: 2 }]);
  assert.equal(state.shelfInventory.candy, 3);

  releaseReservedItems(state, reservation.reservedItems);
  assert.equal(state.shelfInventory.candy, 5);

  const second = reserveShelfOrder(state, [{ productId: 'candy', quantity: 2 }]);
  const sale = commitReservedSale(state, second.reservedItems, 2);
  assert.equal(sale.ok, true);
  assert.equal(state.shelfInventory.candy, 3);
  assert.equal(state.stats.customersServed, 1);
  assert.equal(state.stats.totalRevenue, 72);
});

test('customer completes the fixed shelf, queue, checkout and exit lifecycle', () => {
  const state = createInitialState(1);
  const events = [];
  const simulation = createCustomerSimulation({
    state,
    onCheckout: (event) => events.push(event)
  });
  const customer = simulation.spawn({
    id: 'customer-1',
    variant: 0,
    request: [{ productId: 'candy', quantity: 1 }]
  });
  const phases = new Set([customer.phase]);

  for (let index = 0; index < 4_000 && customer.phase !== 'done'; index += 1) {
    simulation.update(50, index * 50);
    phases.add(customer.phase);
  }

  assert.equal(customer.phase, 'done');
  assert.deepEqual([...phases], [
    'street', 'entering', 'browsing', 'picking', 'queueing', 'checkout', 'leaving', 'done'
  ]);
  assert.equal(events.length, 1);
  assert.equal(state.stats.customersServed, 1);
  assert.equal(state.shelfInventory.candy, 4);
});

test('out-of-stock customer visits the missing shelf and leaves without charging', () => {
  const state = createInitialState(1);
  state.shelfInventory.chips = 0;
  const missingEvents = [];
  const simulation = createCustomerSimulation({
    state,
    onOutOfStock: (event) => missingEvents.push(event)
  });
  const customer = simulation.spawn({
    id: 'customer-2',
    request: [{ productId: 'chips', quantity: 1 }]
  });
  const initialCoins = state.coins;
  const phases = new Set();

  for (let index = 0; index < 4_000 && customer.phase !== 'done'; index += 1) {
    simulation.update(50, index * 50);
    phases.add(customer.phase);
  }

  assert.equal(customer.phase, 'done');
  assert.equal(missingEvents.length, 1);
  assert.equal(missingEvents[0].productId, 'chips');
  assert.equal(state.coins, initialCoins);
  assert.equal(state.stats.customersServed, 0);
  assert.equal(phases.has('outOfStock'), true);
});

test('serializes same-shelf waiting with unique safe targets', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 20;
  const simulation = createCustomerSimulation({ state });
  for (let index = 0; index < 5; index += 1) {
    simulation.spawn({ id: `crowd-${index}`, request: [{ productId: 'candy', quantity: 1 }] });
  }

  for (let tick = 0; tick < 5_000 && state.stats.customersServed < 5; tick += 1) {
    simulation.update(25, tick * 25);
    assert.ok(simulation.queue.length <= 3);
    const claimedTargets = [...simulation.queue, ...simulation.customers.filter((item) => item.phase === 'waitingShelf')]
      .map((item) => item.route.at(-1))
      .filter(Boolean)
      .map((point) => `${Math.round(point.x)},${Math.round(point.y)}`);
    assert.equal(new Set(claimedTargets).size, claimedTargets.length);
    for (const customer of simulation.customers.filter((item) => item.phase !== 'done')) {
      assert.equal(pointInsideAnyCollision(customer), false, `${customer.id} crossed furniture in ${customer.phase}`);
    }
  }

  assert.equal(state.stats.customersServed, 5);
});

test('limits checkout to three slots while overflow customers wait safely', () => {
  const state = createInitialState(1);
  state.upgrades.checkout = 5;
  const productIds = ['candy', 'chips', 'seaweed', 'soda', 'cookies'];
  const simulation = createCustomerSimulation({ state });
  productIds.forEach((productId, index) => {
    state.shelfInventory[productId] = 5;
    simulation.spawn({ id: `queue-${index}`, request: [{ productId, quantity: 1 }] });
  });
  let sawPendingQueue = false;

  for (let tick = 0; tick < 5_000 && state.stats.customersServed < 5; tick += 1) {
    simulation.update(25, tick * 25);
    assert.ok(simulation.queue.length <= 3);
    const queueTargets = simulation.queue
      .map((customer) => customer.queuePromotionTarget ?? customer.route.at(-1))
      .filter(Boolean)
      .map((point) => `${point.x},${point.y}`);
    assert.equal(new Set(queueTargets).size, queueTargets.length);
    if (simulation.pendingQueue.length) sawPendingQueue = true;
    for (const customer of simulation.customers.filter((item) => item.phase !== 'done')) {
      assert.equal(pointInsideAnyCollision(customer), false, `${customer.id} crossed furniture in ${customer.phase}`);
    }
  }

  assert.equal(sawPendingQueue, true);
  assert.equal(state.stats.customersServed, 5);
});

test('multi-product customers return to the safe hub between shelves', () => {
  const state = createInitialState(1);
  state.shelfInventory.candy = 5;
  state.shelfInventory.jelly = 5;
  const simulation = createCustomerSimulation({ state });
  const customer = simulation.spawn({
    id: 'multi-route',
    request: [{ productId: 'candy', quantity: 1 }, { productId: 'jelly', quantity: 1 }]
  });

  for (let tick = 0; tick < 5_000 && customer.phase !== 'done'; tick += 1) {
    simulation.update(25, tick * 25);
    assert.equal(pointInsideAnyCollision(customer), false, `multi-product route crossed furniture in ${customer.phase}`);
  }
  assert.equal(customer.phase, 'done');
});

test('every customer movement sample stays outside furniture collision boxes', () => {
  for (const productId of ['candy', 'chips', 'seaweed', 'soda', 'cookies', 'jelly']) {
    const state = createInitialState(1);
    state.shelfInventory[productId] = 5;
    const simulation = createCustomerSimulation({ state });
    const customer = simulation.spawn({ id: `route-${productId}`, request: [{ productId, quantity: 1 }] });
    for (let tick = 0; tick < 4_000 && customer.phase !== 'done'; tick += 1) {
      simulation.update(25, tick * 25);
      assert.equal(pointInsideAnyCollision(customer), false, `${productId} crossed furniture in ${customer.phase}`);
    }
    assert.equal(customer.phase, 'done');
  }
});

test('customer hit testing follows logical scene coordinates', () => {
  const customer = { x: 320, y: 220 };
  assert.equal(customerHitTest(customer, 320, 220), true);
  assert.equal(customerHitTest(customer, 500, 400), false);
});
