const PRODUCT_IDS = Object.freeze(['candy', 'chips', 'seaweed', 'soda', 'cookies', 'jelly']);

function rect(x, y, width, height) {
  return Object.freeze({ x, y, width, height });
}

function makeShelf(id, productId, x, y, approachPoint, waitingPoint) {
  const width = 122;
  const height = 76;
  return Object.freeze({
    id,
    type: 'shelf',
    productId,
    x,
    y,
    width,
    height,
    hitbox: rect(x, y, width, height),
    collisionBox: rect(x + 4, y + 5, width - 8, height - 5),
    zBase: y + height,
    approachPoint: Object.freeze({ ...approachPoint }),
    waitingPoint: Object.freeze({ ...waitingPoint }),
    routeId: id
  });
}

export const SHELVES = Object.freeze([
  makeShelf('shelf-candy', 'candy', 105, 88, { x: 166, y: 184 }, { x: 197, y: 205 }),
  makeShelf('shelf-chips', 'chips', 275, 88, { x: 336, y: 184 }, { x: 367, y: 205 }),
  makeShelf('shelf-seaweed', 'seaweed', 445, 88, { x: 506, y: 184 }, { x: 537, y: 205 }),
  makeShelf('shelf-soda', 'soda', 105, 238, { x: 166, y: 334 }, { x: 197, y: 354 }),
  makeShelf('shelf-cookies', 'cookies', 275, 238, { x: 336, y: 334 }, { x: 367, y: 354 }),
  makeShelf('shelf-jelly', 'jelly', 445, 238, { x: 506, y: 334 }, { x: 537, y: 354 })
]);

export const SHOPKEEPER_POINT = Object.freeze({ x: 690, y: 180 });

export const CHECKOUT_COUNTER = Object.freeze({
  id: 'checkout-counter',
  type: 'counter',
  x: 618,
  y: 105,
  width: 148,
  height: 110,
  hitbox: rect(618, 105, 148, 110),
  collisionBox: rect(618, 105, 148, 110),
  zBase: 215,
  checkoutPoint: Object.freeze({ x: 690, y: 238 })
});

export const FURNITURE = Object.freeze([...SHELVES, CHECKOUT_COUNTER]);

export const SHOP_HUB = Object.freeze({ x: 650, y: 330 });

export const ENTRANCE_ROUTE = Object.freeze([
  Object.freeze({ x: 730, y: 470 }),
  Object.freeze({ x: 650, y: 470 }),
  Object.freeze({ x: 650, y: 420 }),
  Object.freeze({ x: 650, y: 370 }),
  SHOP_HUB
]);

export const EXIT_ROUTE = Object.freeze([
  SHOP_HUB,
  Object.freeze({ x: 650, y: 370 }),
  Object.freeze({ x: 650, y: 420 }),
  Object.freeze({ x: 650, y: 470 }),
  Object.freeze({ x: 760, y: 470 })
]);

export const QUEUE_POINTS = Object.freeze([
  Object.freeze({ x: 690, y: 266 }),
  Object.freeze({ x: 690, y: 304 }),
  Object.freeze({ x: 690, y: 342 })
]);

export const QUEUE_HOLD_POINTS = Object.freeze([
  Object.freeze({ x: 620, y: 340 }),
  Object.freeze({ x: 620, y: 310 })
]);

export const SHELF_HOLD_POINTS = Object.freeze([
  Object.freeze({ x: 590, y: 390 }),
  Object.freeze({ x: 560, y: 410 }),
  Object.freeze({ x: 530, y: 410 }),
  Object.freeze({ x: 500, y: 410 })
]);

export const SHELF_ROUTES = Object.freeze(Object.fromEntries(SHELVES.map((shelf, index) => {
  const topRow = index < 3;
  const route = topRow
    ? [
      SHOP_HUB,
      { x: 595, y: 330 },
      { x: 595, y: 205 },
      { x: shelf.approachPoint.x, y: 205 },
      shelf.approachPoint
    ]
    : [
      SHOP_HUB,
      { x: 595, y: 330 },
      { x: shelf.approachPoint.x, y: 330 },
      shelf.approachPoint
    ];
  return [shelf.id, Object.freeze(route.map((point) => Object.freeze({ ...point })))];
})));

export function pointInRect(x, y, target) {
  return x >= target.x && x <= target.x + target.width
    && y >= target.y && y <= target.y + target.height;
}

export function pointInsideAnyCollision(point, furniture = FURNITURE) {
  return furniture.some((item) => pointInRect(point.x, point.y, item.collisionBox));
}

export function shelfAtPoint(x, y) {
  return [...SHELVES].reverse().find((shelf) => pointInRect(x, y, shelf.hitbox)) ?? null;
}

export function shelfById(shelfId) {
  return SHELVES.find((shelf) => shelf.id === shelfId) ?? null;
}

export function shelfByProduct(productId) {
  return SHELVES.find((shelf) => shelf.productId === productId) ?? null;
}

export function routeForProduct(productId) {
  const shelf = shelfByProduct(productId);
  return shelf ? SHELF_ROUTES[shelf.id] : [];
}

export function validateWorldLayout() {
  const errors = [];
  if (SHELVES.length !== PRODUCT_IDS.length) errors.push('货架数量必须与商品数量一致');
  if (new Set(SHELVES.map((shelf) => shelf.productId)).size !== PRODUCT_IDS.length) {
    errors.push('每种商品必须拥有独立货架');
  }
  const routes = [
    ENTRANCE_ROUTE,
    EXIT_ROUTE,
    QUEUE_POINTS,
    QUEUE_HOLD_POINTS,
    SHELF_HOLD_POINTS,
    ...Object.values(SHELF_ROUTES)
  ];
  for (const route of routes) {
    for (const point of route) {
      if (pointInsideAnyCollision(point)) errors.push(`路线节点 ${point.x},${point.y} 与家具碰撞`);
    }
  }
  return errors;
}
