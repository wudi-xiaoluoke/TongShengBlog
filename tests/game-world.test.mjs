import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKOUT_COUNTER,
  ENTRANCE_ROUTE,
  EXIT_ROUTE,
  FURNITURE,
  QUEUE_POINTS,
  SHELF_ROUTES,
  SHELVES,
  SHOP_HUB,
  SHOPKEEPER_POINT,
  pointInsideAnyCollision,
  shelfAtPoint,
  shelfByProduct,
  validateWorldLayout
} from '../src/main/resources/static/js/game/game-world.mjs';

test('defines six interactive product shelves', () => {
  assert.equal(SHELVES.length, 6);
  assert.equal(new Set(SHELVES.map((shelf) => shelf.productId)).size, 6);
  for (const shelf of SHELVES) {
    assert.equal(shelfByProduct(shelf.productId).id, shelf.id);
    assert.equal(shelfAtPoint(shelf.x + shelf.width / 2, shelf.y + shelf.height / 2).id, shelf.id);
  }
  assert.equal(shelfAtPoint(760, 500), null);
});

test('places one shelf row on the back wall and one island row in the store center', () => {
  const wallRow = SHELVES.slice(0, 3);
  const islandRow = SHELVES.slice(3);

  assert.deepEqual(
    SHELVES.map(({ x, y, approachPoint, waitingPoint }) => ({ x, y, approachPoint, waitingPoint })),
    [
      { x: 105, y: 88, approachPoint: { x: 166, y: 184 }, waitingPoint: { x: 197, y: 205 } },
      { x: 275, y: 88, approachPoint: { x: 336, y: 184 }, waitingPoint: { x: 367, y: 205 } },
      { x: 445, y: 88, approachPoint: { x: 506, y: 184 }, waitingPoint: { x: 537, y: 205 } },
      { x: 105, y: 238, approachPoint: { x: 166, y: 334 }, waitingPoint: { x: 197, y: 354 } },
      { x: 275, y: 238, approachPoint: { x: 336, y: 334 }, waitingPoint: { x: 367, y: 354 } },
      { x: 445, y: 238, approachPoint: { x: 506, y: 334 }, waitingPoint: { x: 537, y: 354 } }
    ]
  );

  for (const shelf of wallRow) assert.ok(shelf.y <= 100);
  for (const shelf of islandRow) {
    assert.ok(shelf.y >= 230);
    assert.ok(shelf.y + shelf.height <= 330);
  }
  assert.ok(Math.max(...islandRow.map((shelf) => shelf.y + shelf.height)) < 350);
  assert.ok(Math.max(...SHELVES.map((shelf) => shelf.x + shelf.width)) <= CHECKOUT_COUNTER.x - 45);
});

test('keeps the shopkeeper and checkout customer on opposite sides of the counter front', () => {
  assert.deepEqual(SHOPKEEPER_POINT, { x: 690, y: 180 });
  assert.deepEqual(
    {
      x: CHECKOUT_COUNTER.x,
      y: CHECKOUT_COUNTER.y,
      width: CHECKOUT_COUNTER.width,
      height: CHECKOUT_COUNTER.height,
      zBase: CHECKOUT_COUNTER.zBase,
      checkoutPoint: CHECKOUT_COUNTER.checkoutPoint
    },
    {
      x: 618,
      y: 105,
      width: 148,
      height: 110,
      zBase: 215,
      checkoutPoint: { x: 690, y: 238 }
    }
  );
  assert.ok(SHOPKEEPER_POINT.y < CHECKOUT_COUNTER.zBase);
  assert.ok(CHECKOUT_COUNTER.checkoutPoint.y > CHECKOUT_COUNTER.zBase);
});

test('uses the exact safe routes from the entrance hub to each shelf', () => {
  assert.deepEqual(SHOP_HUB, { x: 650, y: 330 });
  assert.deepEqual(ENTRANCE_ROUTE, [
    { x: 730, y: 470 },
    { x: 650, y: 470 },
    { x: 650, y: 420 },
    { x: 650, y: 370 },
    { x: 650, y: 330 }
  ]);
  assert.deepEqual(EXIT_ROUTE, [
    { x: 650, y: 330 },
    { x: 650, y: 370 },
    { x: 650, y: 420 },
    { x: 650, y: 470 },
    { x: 760, y: 470 }
  ]);

  for (const shelf of SHELVES.slice(0, 3)) {
    assert.deepEqual(SHELF_ROUTES[shelf.id], [
      SHOP_HUB,
      { x: 595, y: 330 },
      { x: 595, y: 205 },
      { x: shelf.approachPoint.x, y: 205 },
      shelf.approachPoint
    ]);
  }
  for (const shelf of SHELVES.slice(3)) {
    assert.deepEqual(SHELF_ROUTES[shelf.id], [
      SHOP_HUB,
      { x: 595, y: 330 },
      { x: shelf.approachPoint.x, y: 330 },
      shelf.approachPoint
    ]);
  }
});

test('crosses the storefront boundary only through the doorway', () => {
  const storefrontY = 350;
  const doorway = { minX: 620, maxX: 690 };

  for (const [name, route] of [['entrance', ENTRANCE_ROUTE], ['exit', EXIT_ROUTE]]) {
    let crossings = 0;
    for (let index = 1; index < route.length; index += 1) {
      const from = route[index - 1];
      const to = route[index];
      if ((from.y < storefrontY && to.y >= storefrontY)
        || (from.y > storefrontY && to.y <= storefrontY)) {
        const progress = (storefrontY - from.y) / (to.y - from.y);
        const crossingX = from.x + (to.x - from.x) * progress;
        crossings += 1;
        assert.ok(
          crossingX >= doorway.minX && crossingX <= doorway.maxX,
          `${name} route crosses storefront at x=${crossingX}`
        );
      }
    }
    assert.ok(crossings > 0, `${name} route never crosses the storefront boundary`);
  }
});

test('keeps every fixed route waypoint outside furniture collisions', () => {
  const routes = [ENTRANCE_ROUTE, EXIT_ROUTE, ...Object.values(SHELF_ROUTES)];
  for (const route of routes) {
    for (const point of route) {
      assert.equal(
        pointInsideAnyCollision(point, FURNITURE),
        false,
        `waypoint ${point.x},${point.y} intersects furniture`
      );
    }
  }
  assert.deepEqual(validateWorldLayout(), []);
});

test('defines three unique collision-free checkout queue points', () => {
  assert.deepEqual(QUEUE_POINTS, [
    { x: 690, y: 266 },
    { x: 690, y: 304 },
    { x: 690, y: 342 }
  ]);
  assert.equal(QUEUE_POINTS.length, 3);
  assert.equal(new Set(QUEUE_POINTS.map((point) => `${point.x},${point.y}`)).size, 3);
  for (const point of QUEUE_POINTS) {
    assert.equal(pointInsideAnyCollision(point, FURNITURE), false);
  }
});
