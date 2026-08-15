import {
  GAME_VERSION,
  PRODUCTS,
  UPGRADES,
  productCapacity,
  unlockedProducts,
  upgradeCost
} from './game-config.mjs';

function shelfInventoryDefaults() {
  return { candy: 5, chips: 3, seaweed: 0, soda: 0, cookies: 0, jelly: 0 };
}

function warehouseInventoryDefaults() {
  return { candy: 0, chips: 0, seaweed: 0, soda: 0, cookies: 0, jelly: 0 };
}

function upgradeDefaults() {
  return { shelf: 0, delivery: 0, traffic: 0, catalog: 0, checkout: 0 };
}

export function createInitialState(now = Date.now()) {
  const shelfInventory = shelfInventoryDefaults();
  return {
    version: GAME_VERSION,
    saveVersion: GAME_VERSION,
    coins: 200,
    reputation: 0,
    level: 1,
    warehouseInventory: warehouseInventoryDefaults(),
    shelfInventory,
    reservedInventory: warehouseInventoryDefaults(),
    inventory: shelfInventory,
    supplyOrders: [],
    upgrades: upgradeDefaults(),
    unlockedProductIds: ['candy', 'chips'],
    stats: { totalRevenue: 0, customersServed: 0, customersLeft: 0, ordersPlaced: 0 },
    ledger: [],
    createdAt: now,
    lastSavedAt: now,
    recoveredFromCorruptSave: false
  };
}

function refreshUnlocks(state) {
  state.unlockedProductIds = unlockedProducts(state).map((product) => product.id);
}

function recordLedger(state, type, amount, label, now = Date.now()) {
  state.ledger.unshift({ id: `${now}-${Math.random().toString(16).slice(2)}`, type, amount, label, at: now });
  state.ledger = state.ledger.slice(0, 30);
}

export function placeSupplyOrder(state, productId, now = Date.now()) {
  const product = PRODUCTS[productId];
  if (!product) throw new Error('未知零食');
  refreshUnlocks(state);
  if (!state.unlockedProductIds.includes(productId)) throw new Error('商品尚未解锁');
  if (state.coins < product.orderCost) throw new Error('金币不足');

  const deliveryFactor = Math.max(0.45, 1 - state.upgrades.delivery * 0.12);
  const readyAt = now + Math.round(product.deliveryMs * deliveryFactor);
  const order = {
    id: `${productId}-${now}-${state.stats.ordersPlaced}`,
    productId,
    quantity: product.orderQuantity,
    orderedAt: now,
    readyAt
  };

  state.coins -= product.orderCost;
  state.supplyOrders.push(order);
  state.stats.ordersPlaced += 1;
  recordLedger(state, 'expense', -product.orderCost, `进货：${product.name}`, now);
  return order;
}

export function settleSupplyOrders(state, now = Date.now()) {
  const pending = [];
  const completed = [];
  for (const order of state.supplyOrders) {
    if (order.readyAt <= now) {
      state.warehouseInventory[order.productId] =
        (state.warehouseInventory[order.productId] ?? 0) + order.quantity;
      completed.push(order);
    } else {
      pending.push(order);
    }
  }
  state.supplyOrders = pending;
  return completed;
}

export function serveRequest(state, request, now = Date.now()) {
  const reservation = reserveShelfOrder(state, request);
  if (!reservation.ok) return reservation;
  return commitReservedSale(state, reservation.reservedItems, now);
}

function normalizeOrder(request = []) {
  const quantities = new Map();
  for (const item of request) {
    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    const productId = item?.productId;
    if (!PRODUCTS[productId]) return { ok: false, missingProductId: productId };
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  return {
    ok: true,
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
  };
}

export function reserveShelfOrder(state, request) {
  const normalized = normalizeOrder(request);
  if (!normalized.ok || normalized.items.length === 0) {
    return { ok: false, reason: '未知零食', missingProductId: normalized.missingProductId, reservedItems: [] };
  }
  const missing = normalized.items.find(
    (item) => (state.shelfInventory[item.productId] ?? 0) < item.quantity
  );
  if (missing) {
    return { ok: false, reason: '货架库存不足', missingProductId: missing.productId, reservedItems: [] };
  }
  for (const item of normalized.items) state.shelfInventory[item.productId] -= item.quantity;
  for (const item of normalized.items) {
    state.reservedInventory[item.productId] = (state.reservedInventory[item.productId] ?? 0) + item.quantity;
  }
  return { ok: true, reservedItems: normalized.items.map((item) => ({ ...item })) };
}

export function releaseReservedItems(state, reservedItems = []) {
  for (const item of reservedItems) {
    if (!PRODUCTS[item.productId]) continue;
    const current = state.shelfInventory[item.productId] ?? 0;
    const reserved = state.reservedInventory[item.productId] ?? 0;
    const returned = Math.min(reserved, item.quantity);
    state.reservedInventory[item.productId] = reserved - returned;
    state.shelfInventory[item.productId] = current + returned;
  }
}

export function commitReservedSale(state, reservedItems = [], now = Date.now()) {
  const normalized = normalizeOrder(reservedItems);
  if (!normalized.ok || normalized.items.length === 0) {
    return { ok: false, reason: '未知零食', missingProductId: normalized.missingProductId };
  }
  const revenue = normalized.items.reduce(
    (sum, item) => sum + PRODUCTS[item.productId].salePrice * item.quantity,
    0
  );
  for (const item of normalized.items) {
    const reserved = state.reservedInventory[item.productId] ?? 0;
    state.reservedInventory[item.productId] = Math.max(0, reserved - item.quantity);
  }
  state.coins += revenue;
  state.reputation += normalized.items.length;
  state.stats.totalRevenue += revenue;
  state.stats.customersServed += 1;
  state.level = 1 + Math.floor(state.stats.customersServed / 8);
  refreshUnlocks(state);
  recordLedger(state, 'income', revenue, '顾客结账', now);
  return { ok: true, revenue };
}

export function purchaseUpgrade(state, upgradeId, now = Date.now()) {
  if (!UPGRADES[upgradeId]) return { ok: false, reason: '未知升级' };
  const currentLevel = state.upgrades[upgradeId] ?? 0;
  const cost = upgradeCost(upgradeId, currentLevel);
  if (state.coins < cost) return { ok: false, reason: '金币不足', cost };
  state.coins -= cost;
  state.upgrades[upgradeId] = currentLevel + 1;
  refreshUnlocks(state);
  recordLedger(state, 'expense', -cost, `升级：${UPGRADES[upgradeId].name}`, now);
  return { ok: true, cost, level: state.upgrades[upgradeId] };
}

export function serializeState(state, now = Date.now()) {
  return JSON.stringify({ ...state, version: GAME_VERSION, saveVersion: GAME_VERSION, lastSavedAt: now });
}

export function restockShelf(state, productId, requestedQuantity) {
  if (!PRODUCTS[productId]) return 0;
  const requested = Math.max(0, Math.floor(Number(requestedQuantity) || 0));
  const available = state.warehouseInventory[productId] ?? 0;
  const capacity = productCapacity(state);
  const current = state.shelfInventory[productId] ?? 0;
  const reserved = state.reservedInventory[productId] ?? 0;
  const moved = Math.max(0, Math.min(requested, available, capacity - current - reserved));
  state.warehouseInventory[productId] = available - moved;
  state.shelfInventory[productId] = current + moved;
  return moved;
}

export function shelfDisplayState(quantity, capacity) {
  if (quantity <= 0) return 'empty';
  const ratio = quantity / Math.max(1, capacity);
  if (ratio < 0.4) return 'low';
  if (ratio < 0.8) return 'half';
  return 'full';
}

function restoreVersionTwo(parsed, now) {
  const base = createInitialState(parsed.createdAt ?? now);
  const shelfInventory = { ...shelfInventoryDefaults(), ...(parsed.shelfInventory ?? parsed.inventory ?? {}) };
  const warehouseInventory = { ...warehouseInventoryDefaults(), ...(parsed.warehouseInventory ?? {}) };
  const reservedInventory = { ...warehouseInventoryDefaults(), ...(parsed.reservedInventory ?? {}) };
  const capacity = productCapacity({ upgrades: { ...upgradeDefaults(), ...(parsed.upgrades ?? {}) } });
  for (const productId of Object.keys(PRODUCTS)) {
    const restoredReservation = Math.max(0, Number(reservedInventory[productId]) || 0);
    const shelfSpace = Math.max(0, capacity - (shelfInventory[productId] ?? 0));
    const returnedToShelf = Math.min(shelfSpace, restoredReservation);
    shelfInventory[productId] = (shelfInventory[productId] ?? 0) + returnedToShelf;
    warehouseInventory[productId] += restoredReservation - returnedToShelf;
    reservedInventory[productId] = 0;
  }
  return {
    ...base,
    ...parsed,
    version: GAME_VERSION,
    saveVersion: GAME_VERSION,
    warehouseInventory,
    shelfInventory,
    reservedInventory,
    inventory: shelfInventory,
    upgrades: { ...upgradeDefaults(), ...(parsed.upgrades ?? {}) },
    stats: { ...base.stats, ...(parsed.stats ?? {}) },
    recoveredFromCorruptSave: false
  };
}

function migrateLegacyState(parsed, now) {
  const base = createInitialState(parsed.createdAt ?? now);
  const upgrades = { ...upgradeDefaults(), ...(parsed.upgrades ?? {}) };
  const capacity = productCapacity({ upgrades });
  const legacyInventory = { ...warehouseInventoryDefaults(), ...(parsed.inventory ?? {}) };
  const shelfInventory = warehouseInventoryDefaults();
  const warehouseInventory = warehouseInventoryDefaults();
  for (const productId of Object.keys(PRODUCTS)) {
    const quantity = Math.max(0, Number(legacyInventory[productId]) || 0);
    shelfInventory[productId] = Math.min(capacity, quantity);
    warehouseInventory[productId] = Math.max(0, quantity - capacity);
  }
  return {
    ...base,
    ...parsed,
    version: GAME_VERSION,
    saveVersion: GAME_VERSION,
    upgrades,
    warehouseInventory,
    shelfInventory,
    reservedInventory: warehouseInventoryDefaults(),
    inventory: shelfInventory,
    stats: { ...base.stats, ...(parsed.stats ?? {}) },
    recoveredFromCorruptSave: false
  };
}

export function restoreState(raw, now = Date.now()) {
  if (!raw) return createInitialState(now);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed) throw new Error('存档格式错误');
    const storedVersion = parsed.saveVersion ?? parsed.version ?? 1;
    if (![1, GAME_VERSION].includes(storedVersion)) throw new Error('存档版本不兼容');
    const state = storedVersion === 1
      ? migrateLegacyState(parsed, now)
      : restoreVersionTwo(parsed, now);
    settleSupplyOrders(state, now);
    refreshUnlocks(state);
    return state;
  } catch {
    return { ...createInitialState(now), recoveredFromCorruptSave: true };
  }
}
