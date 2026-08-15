import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSceneRenderer,
  shelfProductSlots
} from '../src/main/resources/static/js/game/game-scene.mjs';
import {
  CHECKOUT_COUNTER,
  SHELVES,
  SHOPKEEPER_POINT
} from '../src/main/resources/static/js/game/game-world.mjs';

test('maps shelf display states to visibly different product counts', () => {
  assert.equal(shelfProductSlots('empty'), 0);
  assert.equal(shelfProductSlots('low'), 2);
  assert.equal(shelfProductSlots('half'), 5);
  assert.equal(shelfProductSlots('full'), 8);
});

test('renderer draws the empty scene, each shelf once, and an independent counter', () => {
  const drawCalls = [];
  const context = {
    clearRect() {},
    drawImage(...args) { drawCalls.push(args); },
    fillRect() {},
    strokeRect() {},
    fillText() {},
    save() {},
    restore() {},
    imageSmoothingEnabled: true
  };
  const canvas = { getContext: () => context };
  const assets = {
    scene: { width: 768, height: 512 },
    shelf: { width: 1586, height: 992 },
    counter: { width: 1402, height: 1122 },
    characters: { width: 1774, height: 887 },
    fixtures: null
  };

  createSceneRenderer(canvas, assets)({
    customers: [],
    selectedCustomerId: null,
    selectedShelfId: null,
    state: { shelfInventory: {}, upgrades: { shelf: 0 } },
    elapsedMs: 0
  });

  assert.equal(drawCalls[0][0], assets.scene);
  const shelfCalls = drawCalls.filter((call) => call[0] === assets.shelf);
  assert.equal(SHELVES.length, 6);
  assert.equal(shelfCalls.length, 6);
  assert.ok(shelfCalls.every((call) => call.length === 5));
  const counterCalls = drawCalls.filter((call) => call[0] === assets.counter);
  assert.equal(counterCalls.length, 2);
  assert.ok(counterCalls.every((call) => call.length === 9));

  const characterCall = drawCalls.find((call) => call[0] === assets.characters);
  assert.equal(characterCall[1], 956.5);
  assert.equal(characterCall[3], 128);
});

test('renders the shopkeeper between non-overlapping counter back and front slices', () => {
  const events = [];
  const context = {
    clearRect() {},
    drawImage(...args) { events.push(args); },
    fillRect() {}, strokeRect() {}, fillText() {}, save() {}, restore() {},
    imageSmoothingEnabled: true
  };
  const assets = {
    scene: { width: 768, height: 512 },
    shelf: { width: 1586, height: 992 },
    counter: { width: 1402, height: 1122 },
    characters: { width: 1774, height: 887 },
    fixtures: null
  };
  const checkoutCustomer = {
    id: 'checkout-customer', variant: 0, phase: 'checkout', direction: 'south', frame: 0,
    x: 690, y: 238, request: []
  };

  createSceneRenderer({ getContext: () => context }, assets)({
    customers: [checkoutCustomer],
    state: { shelfInventory: {}, upgrades: { shelf: 0 } },
    elapsedMs: 0
  });

  assert.deepEqual(SHOPKEEPER_POINT, { x: 690, y: 180 });

  const counterBackIndex = events.findIndex((args) =>
    args[0] === assets.counter && args.length === 9
      && args[1] === 0 && args[2] === 0
      && args[4] === assets.counter.height * 0.46
  );
  const ownerIndex = events.findIndex((args) =>
    args[0] === assets.characters && args.length === 9 && args[2] === 0
      && args[5] === 663
      && args[6] === 112
      && args[7] === 54 && args[8] === 68
  );
  const counterFrontIndex = events.findIndex((args) =>
    args[0] === assets.counter && args.length === 9
      && args[1] === 0
      && args[2] === assets.counter.height * 0.46
  );
  const checkoutCustomerIndex = events.findIndex((args) =>
    args[0] === assets.characters && args.length === 9 && args[2] > 0
  );

  assert.ok(counterBackIndex >= 0);
  assert.ok(ownerIndex >= 0);
  assert.ok(counterFrontIndex >= 0);
  assert.ok(checkoutCustomerIndex >= 0);
  assert.deepEqual(events[counterBackIndex], [
    assets.counter,
    0,
    0,
    assets.counter.width,
    assets.counter.height * 0.46,
    618,
    105,
    148,
    110 * 0.46
  ]);
  assert.deepEqual(events[counterFrontIndex], [
    assets.counter,
    0,
    assets.counter.height * 0.46,
    assets.counter.width,
    assets.counter.height * (1 - 0.46),
    618,
    105 + 110 * 0.46,
    148,
    110 * (1 - 0.46)
  ]);
  assert.equal(
    events[counterBackIndex][2] + events[counterBackIndex][4],
    events[counterFrontIndex][2]
  );
  assert.equal(
    events[counterBackIndex][6] + events[counterBackIndex][8],
    events[counterFrontIndex][6]
  );
  assert.ok(counterBackIndex < ownerIndex);
  assert.ok(ownerIndex < counterFrontIndex);
  assert.ok(counterFrontIndex < checkoutCustomerIndex);
});

test('sorts customers behind or in front of a shelf by their foot point', () => {
  const events = [];
  const context = {
    clearRect() {},
    drawImage(...args) { events.push(args); },
    fillRect() {}, strokeRect() {}, fillText() {}, save() {}, restore() {},
    imageSmoothingEnabled: true
  };
  const assets = {
    scene: { width: 768, height: 512 },
    shelf: { width: 1586, height: 992 },
    counter: { width: 1402, height: 1122 },
    characters: { width: 1774, height: 887 },
    fixtures: null
  };
  const shelf = SHELVES[0];
  const shelfCenterX = shelf.x + shelf.width / 2;
  const customers = [
    {
      id: 'behind-shelf', variant: 0, phase: 'queueing', direction: 'south', frame: 0,
      x: shelfCenterX, y: shelf.zBase - 1, request: []
    },
    {
      id: 'front-of-shelf', variant: 1, phase: 'queueing', direction: 'south', frame: 0,
      x: shelfCenterX, y: shelf.zBase + 1, request: []
    }
  ];

  createSceneRenderer({ getContext: () => context }, assets)({
    customers,
    state: { shelfInventory: {}, upgrades: { shelf: 0 } },
    elapsedMs: 0
  });

  const behindCustomerIndex = events.findIndex((args) =>
    args[0] === assets.characters && args.length === 9 && args[6] === shelf.zBase - 1 - 68
  );
  const shelfIndex = events.findIndex((args) =>
    args[0] === assets.shelf && args.length === 5 && args[1] === shelf.x && args[2] === shelf.y
  );
  const frontCustomerIndex = events.findIndex((args) =>
    args[0] === assets.characters && args.length === 9 && args[6] === shelf.zBase + 1 - 68
  );

  assert.ok(behindCustomerIndex >= 0);
  assert.ok(shelfIndex >= 0);
  assert.ok(frontCustomerIndex >= 0);
  assert.ok(behindCustomerIndex < shelfIndex);
  assert.ok(shelfIndex < frontCustomerIndex);
});

test('draws shelf selection and request bubbles in the final overlay pass', () => {
  const events = [];
  const context = {
    clearRect() {},
    drawImage(...args) { events.push({ type: 'image', args }); },
    fillRect(...args) { events.push({ type: 'fill', args }); },
    strokeRect(...args) { events.push({ type: 'stroke', args }); },
    fillText() {}, save() {}, restore() {}, imageSmoothingEnabled: true
  };
  const assets = {
    scene: {}, shelf: {}, counter: {}, characters: { width: 1774, height: 887 }, fixtures: null
  };
  const customer = {
    id: 'selected-customer', variant: 0, phase: 'picking', direction: 'south', frame: 0,
    x: 193, y: 222, request: [{ productId: 'candy', quantity: 1 }]
  };

  createSceneRenderer({ getContext: () => context }, assets)({
    customers: [customer],
    selectedCustomerId: customer.id,
    selectedShelfId: 'shelf-candy',
    state: { shelfInventory: { candy: 1 }, upgrades: { shelf: 0 } }
  });

  const lastCharacter = events.map((event) => event.type === 'image' && event.args[0] === assets.characters).lastIndexOf(true);
  const shelfOutline = events.findIndex((event) =>
    event.type === 'stroke' && event.args[0] === SHELVES[0].x - 3
  );
  const customerOutline = events.findIndex((event) => event.type === 'stroke' && event.args[0] === 171);
  const requestBubble = events.findIndex((event) =>
    event.type === 'fill' && event.args[0] === 164 && event.args[1] === 117
  );
  const lowStockMarker = events.findIndex((event) =>
    event.type === 'fill'
      && event.args[0] === SHELVES[0].x + SHELVES[0].width - 33
      && event.args[1] === SHELVES[0].y + 5
      && event.args[2] === 28
      && event.args[3] === 18
  );
  assert.ok(shelfOutline > lastCharacter);
  assert.ok(customerOutline > lastCharacter);
  assert.ok(requestBubble > lastCharacter);
  assert.ok(lowStockMarker > lastCharacter);
});
