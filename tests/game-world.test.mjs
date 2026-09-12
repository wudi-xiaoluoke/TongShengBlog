import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKOUT_COUNTER,
  DEFAULT_SHELF_PRODUCT_IDS,
  ENTRANCE_ROUTE,
  EXIT_ROUTE,
  MAX_CABINETS,
  QUEUE_POINTS,
  SLOTS_PER_ROW,
  SHOP_HUB,
  SHOPKEEPER_POINT,
  buildWorld,
  pointInsideAnyCollision,
  validateWorldLayout
} from '../src/main/resources/static/js/game/game-world.mjs';
import {
  GROUPS_PER_CABINET,
  SLOTS_PER_CABINET,
  productCapacity,
  planogramAssignment,
  planogramRows,
  unitsPerSlot
} from '../src/main/resources/static/js/game/game-config.mjs';

test('cabinet planogram: one row of 3 slots per product, up to 4 kinds per cabinet', () => {
  // 不足 4 种：轮转复用空行，同种零食多占格子（容量变大）
  const sparse = planogramRows(1, ['candy', 'chips']);
  assert.deepEqual(sparse[0], ['candy', 'chips', 'candy', 'chips']);

  // 10 种零食 10 柜：每种恰占 4 行 = 12 格，一柜最多 4 种
  const full = planogramAssignment(10, [
    'candy', 'chips', 'seaweed', 'soda', 'cookies',
    'jelly', 'peanut', 'marshmallow', 'latiao', 'chocolate'
  ]);
  assert.equal(full.groupCounts.get('candy'), 4);
  assert.equal(full.groupCounts.get('chocolate'), 4);
  for (const row of full.rows) {
    assert.equal(row.length, GROUPS_PER_CABINET);
    assert.ok(new Set(row).size >= 1 && new Set(row).size <= 4);
  }
  // 每种零食都有主货柜，且该柜确实摆了它
  for (const [productId, cabinet] of full.primaryCabinet) {
    assert.ok(full.rows[cabinet].includes(productId));
  }
});

test('product capacity derives from occupied slot rows and units per slot', () => {
  const state = { shelves: ['candy', 'chips'], cabinetCount: 6, upgrades: { shelf: 0 } };
  assert.equal(unitsPerSlot(state), 1);
  // 6 柜 × 4 行 = 24 行 ÷ 2 种 = 12 行/种 → 12 × 3 = 36
  assert.equal(productCapacity(state, 'candy'), 36);
  assert.equal(productCapacity(state, 'chips'), 36);
  // 扩容货架：每级每格多放 1 件
  const upgraded = { ...state, upgrades: { shelf: 2 } };
  assert.equal(productCapacity(upgraded, 'candy'), 108);
  // 未上架零食没有格子
  assert.equal(productCapacity(state, 'jelly'), 0);
  // 全部格子数 = 柜数 × 12
  assert.equal(6 * SLOTS_PER_CABINET, 72);
});

test('default world defines six interactive cabinets over the stocked products', () => {
  const world = buildWorld(DEFAULT_SHELF_PRODUCT_IDS);
  assert.equal(world.shelves.length, 6);
  assert.equal(new Set(world.productIds).size, 6);
  for (const productId of world.productIds) {
    const shelf = world.shelfByProduct(productId);
    assert.ok(shelf, `${productId} has a primary cabinet`);
    assert.equal(world.shelfAtPoint(shelf.x + shelf.width / 2, shelf.y + shelf.height / 2).id, shelf.id);
  }
  assert.equal(world.shelfAtPoint(760, 500), null);
});

test('arranges cabinets as two continuous rows of five slots (zhao-yiming style)', () => {
  const world = buildWorld([
    'candy', 'chips', 'seaweed', 'soda', 'cookies',
    'jelly', 'peanut', 'marshmallow', 'latiao', 'chocolate'
  ]);
  assert.equal(world.shelves.length, MAX_CABINETS);

  const wallRow = world.shelves.filter((shelf) => shelf.y < 200);
  const islandRow = world.shelves.filter((shelf) => shelf.y >= 200);
  assert.equal(wallRow.length, SLOTS_PER_ROW);
  assert.equal(islandRow.length, SLOTS_PER_ROW);

  // 同排柜子紧密连续：间距恒定且很小（柜宽 106，间距 6px）
  const rowXs = (shelves) => shelves.map((shelf) => shelf.x);
  assert.deepEqual(rowXs(wallRow), [16, 128, 240, 352, 464]);
  assert.deepEqual(rowXs(islandRow), [16, 128, 240, 352, 464]);
  for (const row of [wallRow, islandRow]) {
    for (let index = 1; index < row.length; index += 1) {
      const gap = row[index].x - (row[index - 1].x + row[index - 1].width);
      assert.equal(gap, 6);
    }
  }
  // 靠墙排贴着后墙，中岛排不越过右通道
  for (const shelf of wallRow) assert.ok(shelf.y <= 100);
  for (const shelf of islandRow) {
    assert.ok(shelf.y >= 230);
    assert.ok(shelf.x + shelf.width <= 595);
  }
  assert.ok(Math.max(...world.shelves.map((shelf) => shelf.x + shelf.width)) <= CHECKOUT_COUNTER.x - 45);
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

  const world = buildWorld([
    'candy', 'chips', 'seaweed', 'soda', 'cookies',
    'jelly', 'peanut', 'marshmallow', 'latiao', 'chocolate'
  ]);
  for (const productId of world.productIds.filter((id) => world.shelfByProduct(id).y < 200)) {
    const shelf = world.shelfByProduct(productId);
    assert.deepEqual(world.routeForProduct(productId), [
      SHOP_HUB,
      { x: 595, y: 330 },
      { x: 595, y: 205 },
      { x: shelf.approachPoint.x, y: 205 },
      shelf.approachPoint
    ]);
  }
  for (const productId of world.productIds.filter((id) => world.shelfByProduct(id).y >= 200)) {
    const shelf = world.shelfByProduct(productId);
    assert.deepEqual(world.routeForProduct(productId), [
      SHOP_HUB,
      { x: 595, y: shelf.y + shelf.height + 6 },
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

test('keeps every fixed route waypoint outside furniture collisions for any cabinet count', () => {
  for (const productIds of [DEFAULT_SHELF_PRODUCT_IDS, [
    'candy', 'chips', 'seaweed', 'soda', 'cookies',
    'jelly', 'peanut', 'marshmallow', 'latiao', 'chocolate'
  ]]) {
    const world = buildWorld(productIds);
    const routes = [
      ENTRANCE_ROUTE,
      EXIT_ROUTE,
      QUEUE_POINTS,
      ...world.productIds.map((productId) => world.routeForProduct(productId))
    ];
    for (const route of routes) {
      for (const point of route) {
        assert.equal(
          pointInsideAnyCollision(point, world.furniture),
          false,
          `waypoint ${point.x},${point.y} intersects furniture`
        );
      }
    }
    assert.deepEqual(validateWorldLayout(world), []);
  }
});

test('defines three unique collision-free checkout queue points', () => {
  assert.deepEqual(QUEUE_POINTS, [
    { x: 690, y: 266 },
    { x: 690, y: 304 },
    { x: 690, y: 342 }
  ]);
  const world = buildWorld(DEFAULT_SHELF_PRODUCT_IDS);
  for (const point of QUEUE_POINTS) {
    assert.equal(pointInsideAnyCollision(point, world.furniture), false);
  }
});
