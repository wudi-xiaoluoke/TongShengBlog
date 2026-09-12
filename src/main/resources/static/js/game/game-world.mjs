import {
  DEFAULT_SHELF_PRODUCT_IDS,
  GROUPS_PER_CABINET,
  MAX_CABINETS,
  PRODUCTS,
  planogramAssignment,
  shopPlanogram
} from './game-config.mjs';

export { DEFAULT_SHELF_PRODUCT_IDS, MAX_CABINETS };

const PRODUCT_IDS = Object.freeze(Object.keys(PRODUCTS));

function rect(x, y, width, height) {
  return Object.freeze({ x, y, width, height });
}

// === 零食柜布局：两排柜位，沿墙/店中各 5 个，紧密排列（赵一鸣式连续货柜） ===
export const SHELF_WIDTH = 106;
export const SHELF_HEIGHT = 97;   // 4 列 × 3 行商品格
export const SHELF_ROW_Y = Object.freeze([88, 238]);
export const SHELF_SLOT_PITCH = 112;
export const SHELF_FIRST_X = 16;
export const SLOTS_PER_ROW = 5;

function shelfSlot(index) {
  const row = Math.floor(index / SLOTS_PER_ROW);
  return {
    x: SHELF_FIRST_X + (index % SLOTS_PER_ROW) * SHELF_SLOT_PITCH,
    y: SHELF_ROW_Y[Math.min(row, SHELF_ROW_Y.length - 1)]
  };
}

function makeShelf(index) {
  const { x, y } = shelfSlot(index);
  const width = SHELF_WIDTH;
  const height = SHELF_HEIGHT;
  const centerX = x + Math.round(width / 2);
  return Object.freeze({
    id: `shelf-${index}`,
    type: 'shelf',
    slot: index,
    x,
    y,
    width,
    height,
    hitbox: rect(x, y, width, height),
    collisionBox: rect(x + 4, y + 5, width - 8, height - 5),
    zBase: y + height,
    approachPoint: Object.freeze({ x: centerX, y: y + height + 6 }),
    waitingPoint: Object.freeze({ x: centerX + 31, y: y + height + 26 }),
    routeId: `shelf-${index}`
  });
}

function shelfRoute(shelf) {
  const topRow = shelf.y < 200;
  return Object.freeze(topRow
    ? [
      SHOP_HUB,
      Object.freeze({ x: 595, y: 330 }),
      Object.freeze({ x: 595, y: 205 }),
      Object.freeze({ x: shelf.approachPoint.x, y: 205 }),
      shelf.approachPoint
    ]
    : [
      SHOP_HUB,
      Object.freeze({ x: 595, y: shelf.y + shelf.height + 6 }),
      shelf.approachPoint
    ]);
}

/**
 * 依据存档构建动态世界：柜数决定柜位数量，已上架零食决定柜内排面
 * （一格一行轮转分配，一种零食 3 格，主货柜承接顾客路线）。
 * source 可以是 { cabinetCount, shelves } 存档，也可以直接给 productId 数组（兼容旧调用）。
 * 加柜/上架后重建即可：位置、碰撞、顾客路线全部自动重排。
 */
export function buildWorld(source = DEFAULT_SHELF_PRODUCT_IDS) {
  const isLegacyList = Array.isArray(source);
  const rawStocked = isLegacyList ? source : (source?.shelves ?? DEFAULT_SHELF_PRODUCT_IDS);
  const stocked = rawStocked
    .filter((productId, index, list) => PRODUCTS[productId] && list.indexOf(productId) === index)
    .slice(0, MAX_CABINETS);
  const stockedIds = stocked.length ? stocked : [...DEFAULT_SHELF_PRODUCT_IDS];
  // cabinetCount 缺失时回退为已上架零食数（旧版一柜一品）
  const declared = isLegacyList ? source.length : Math.floor(Number(source?.cabinetCount) || 0);
  const cabinetCount = Math.max(1, Math.min(MAX_CABINETS, declared || stockedIds.length));

  // 排面：玩家自定义（shelfPlan）优先，否则自动轮转；legacy 数组走旧逻辑
  const plan = isLegacyList
    ? planogramAssignment(cabinetCount, stockedIds)
    : shopPlanogram({ cabinetCount, shelves: rawStocked, shelfPlan: source?.shelfPlan });
  const planProducts = [...new Set(plan.rows.flat().filter(Boolean))];
  const productIds = planProducts.length ? planProducts : stockedIds;
  const shelves = Array.from({ length: cabinetCount }, (_, index) => makeShelf(index));
  const furniture = Object.freeze([...shelves, CHECKOUT_COUNTER]);
  const byId = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  const routes = new Map(shelves.map((shelf) => [shelf.id, shelfRoute(shelf)]));
  const cabinetByProduct = new Map(
    productIds.map((productId) => [productId, plan.primaryCabinet.get(productId) ?? 0])
  );
  const shelfByCabinet = (index) => shelves[Math.min(index, shelves.length - 1)] ?? null;
  return {
    cabinetCount,
    productIds: Object.freeze(productIds),
    rows: plan.rows,
    primaryCabinet: plan.primaryCabinet,
    shelves,
    furniture,
    shelfById: (id) => byId.get(id) ?? null,
    shelfByProduct: (productId) => shelfByCabinet(cabinetByProduct.get(productId) ?? 0),
    routeForProduct: (productId) => routes.get(shelfByCabinet(cabinetByProduct.get(productId) ?? 0)?.id) ?? [],
    shelfAtPoint: (x, y) => [...shelves].reverse().find((shelf) => pointInRect(x, y, shelf.hitbox)) ?? null
  };
}

// 店主站在收银台后
export const SHOPKEEPER_POINT = Object.freeze({ x: 690, y: 180 });

// Q 版收银台位于画面右上
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

// 店内中央枢纽(收银台左侧)
export const SHOP_HUB = Object.freeze({ x: 650, y: 330 });

// 入口路线:从画面右下门进入店内
export const ENTRANCE_ROUTE = Object.freeze([
  Object.freeze({ x: 730, y: 470 }),
  Object.freeze({ x: 650, y: 470 }),
  Object.freeze({ x: 650, y: 420 }),
  Object.freeze({ x: 650, y: 370 }),
  SHOP_HUB
]);

// 离店路线:从店内走出门
export const EXIT_ROUTE = Object.freeze([
  SHOP_HUB,
  Object.freeze({ x: 650, y: 370 }),
  Object.freeze({ x: 650, y: 420 }),
  Object.freeze({ x: 650, y: 470 }),
  Object.freeze({ x: 760, y: 470 })
]);

// 收银台前排队点(3 个)
export const QUEUE_POINTS = Object.freeze([
  Object.freeze({ x: 690, y: 266 }),
  Object.freeze({ x: 690, y: 304 }),
  Object.freeze({ x: 690, y: 342 })
]);

// 排队溢出区(收银台后方)
export const QUEUE_HOLD_POINTS = Object.freeze([
  Object.freeze({ x: 620, y: 340 }),
  Object.freeze({ x: 620, y: 310 })
]);

// 货架等待点(店内货架后方候区)
export const SHELF_HOLD_POINTS = Object.freeze([
  Object.freeze({ x: 590, y: 390 }),
  Object.freeze({ x: 560, y: 410 }),
  Object.freeze({ x: 530, y: 410 }),
  Object.freeze({ x: 500, y: 410 })
]);

export function pointInRect(x, y, target) {
  return x >= target.x && x <= target.x + target.width
    && y >= target.y && y <= target.y + target.height;
}

export function pointInsideAnyCollision(point, furniture = buildWorld(DEFAULT_SHELF_PRODUCT_IDS).furniture) {
  return furniture.some((item) => pointInRect(point.x, point.y, item.collisionBox));
}

export function validateWorldLayout(world = buildWorld(DEFAULT_SHELF_PRODUCT_IDS)) {
  const errors = [];
  if (world.shelves.length > MAX_CABINETS) errors.push('零食柜数量超过柜位上限');
  const routes = [
    ENTRANCE_ROUTE,
    EXIT_ROUTE,
    QUEUE_POINTS,
    QUEUE_HOLD_POINTS,
    SHELF_HOLD_POINTS,
    ...world.productIds.map((productId) => world.routeForProduct(productId))
  ];
  for (const route of routes) {
    for (const point of route) {
      if (pointInsideAnyCollision(point, world.furniture)) errors.push(`路线节点 ${point.x},${point.y} 与家具碰撞`);
    }
  }
  return errors;
}
