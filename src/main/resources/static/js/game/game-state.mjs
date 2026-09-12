import {
  DAY_LENGTH_MS,
  GAME_VERSION,
  GROUPS_PER_CABINET,
  PRODUCTS,
  UPGRADES,
  DAILY_GOAL_REPUTATION,
  INITIAL_CABINET_COUNT,
  MAX_CABINETS,
  DEFAULT_SHELF_PRODUCT_IDS,
  RENT_SHORTFALL_REPUTATION,
  dailyGoalFor,
  gameClock,
  nextCabinetCost,
  productCapacity,
  rentForLevel,
  seasonById,
  seasonForDate,
  shopPlanogram,
  unlockedProducts,
  upgradeCost
} from './game-config.mjs';

function warehouseInventoryDefaults() {
  return Object.fromEntries(Object.keys(PRODUCTS).map((productId) => [productId, 0]));
}

function shelfInventoryDefaults() {
  return { ...warehouseInventoryDefaults(), candy: 5, chips: 3 };
}

function upgradeDefaults() {
  return { shelf: 0, delivery: 0, traffic: 0, catalog: 0, checkout: 0 };
}

function normalizeShelves(parsed) {
  const source = Array.isArray(parsed?.shelves) ? parsed.shelves : [...DEFAULT_SHELF_PRODUCT_IDS];
  const carried = source.filter((id, index) => PRODUCTS[id] && source.indexOf(id) === index);
  return carried.length ? carried.slice(0, MAX_CABINETS) : [...DEFAULT_SHELF_PRODUCT_IDS];
}

/** 柜数：新字段 cabinetCount；老存档回退为"已上架零食数"（旧版一柜一品） */
function normalizeCabinetCount(parsed, shelves) {
  const declared = Math.max(0, Math.floor(Number(parsed?.cabinetCount) || 0));
  return Math.max(1, Math.min(MAX_CABINETS, Math.max(declared, shelves.length)));
}

/** 玩家自定义排面：柜数 × 每柜 4 行的 productId（或 null=空行），非法内容静默丢弃 */
function normalizeShelfPlan(parsed, cabinetCount) {
  const source = parsed?.shelfPlan;
  if (!Array.isArray(source) || !source.length) return null;
  const plan = [];
  for (let cabinet = 0; cabinet < Math.min(MAX_CABINETS, cabinetCount); cabinet += 1) {
    const row = Array.isArray(source[cabinet]) ? source[cabinet] : [];
    plan.push(Array.from({ length: GROUPS_PER_CABINET }, (_, index) => {
      const productId = row[index];
      return productId && PRODUCTS[productId] ? productId : null;
    }));
  }
  return plan;
}

export function createInitialState(now = Date.now()) {
  const shelfInventory = shelfInventoryDefaults();
  const season = seasonForDate(new Date(now));
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
    shelves: [...DEFAULT_SHELF_PRODUCT_IDS],
    cabinetCount: INITIAL_CABINET_COUNT,
    shelfPlan: null,
    stats: { totalRevenue: 0, customersServed: 0, customersLeft: 0, ordersPlaced: 0, productSales: {} },
    day: { number: 1, elapsedMs: 0, revenue: 0 },
    dayBreak: false,
    season: { id: season.id, name: season.name },
    ledger: [],
    createdAt: now,
    lastSavedAt: now,
    recoveredFromCorruptSave: false
  };
}

/**
 * 季节跟真实日期走：开新档/换天时按当前系统月份刷新一次（3-5春/6-8夏/9-11秋/12-2冬）。
 * 返回是否发生换季，供 UI 播报"秋天来了"。
 */
export function refreshSeason(state, date = new Date()) {
  const season = seasonForDate(date);
  if (state.season?.id === season.id) return false;
  state.season = { id: season.id, name: season.name };
  return true;
}

/** 存档里的季节字段兜底：缺省/非法时按当天日期重建 */
function normalizeSeason(parsed, now) {
  const stored = seasonById(parsed?.season?.id);
  if (stored) return { id: stored.id, name: stored.name };
  const season = seasonForDate(new Date(now));
  return { id: season.id, name: season.name };
}

function refreshUnlocks(state) {
  state.unlockedProductIds = unlockedProducts(state).map((product) => product.id);
}

/** 记账时间统一用游戏内部时间（第 N 天 HH:MM），不读用户系统时钟 */
function recordLedger(state, type, amount, label, now = Date.now()) {
  const clock = gameClock(state);
  state.ledger.unshift({
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    type,
    amount,
    label,
    at: now,
    timeLabel: `第 ${clock.dayNumber} 天 ${clock.clock}`
  });
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

export function commitReservedSale(state, reservedItems = [], now = Date.now(), options = {}) {
  const normalized = normalizeOrder(reservedItems);
  if (!normalized.ok || normalized.items.length === 0) {
    return { ok: false, reason: '未知零食', missingProductId: normalized.missingProductId };
  }
  const multiplier = Math.max(0, Number(options.multiplier) || 1);
  const baseRevenue = normalized.items.reduce(
    (sum, item) => sum + PRODUCTS[item.productId].salePrice * item.quantity,
    0
  );
  const revenue = Math.round(baseRevenue * multiplier);
  for (const item of normalized.items) {
    const reserved = state.reservedInventory[item.productId] ?? 0;
    state.reservedInventory[item.productId] = Math.max(0, reserved - item.quantity);
  }
  // 当日分商品销量（凌晨订货页的"上期销量"，翻日时清零）
  if (!state.stats.productSales) state.stats.productSales = {};
  for (const item of normalized.items) {
    state.stats.productSales[item.productId] = (state.stats.productSales[item.productId] ?? 0) + item.quantity;
  }
  state.coins += revenue;
  state.reputation += normalized.items.length;
  state.stats.totalRevenue += revenue;
  state.stats.customersServed += 1;
  if (state.day) state.day.revenue += revenue;
  state.level = 1 + Math.floor(state.stats.customersServed / 8);
  refreshUnlocks(state);
  recordLedger(state, 'income', revenue, multiplier > 1 ? '贵客结账' : '顾客结账', now);
  return { ok: true, revenue };
}

/**
 * 日末结算：收取房租（随店铺等级上涨），评估当日营业目标。
 * - 交得起：正常扣除；交不起：金币清零且口碑重挫（不会负资产，但压力真实存在）
 * - 当日营业额 ≥ 目标（房租×2）：口碑奖励
 * 返回结算摘要供 UI 提示，同时开启新的一天。
 */
export function advanceDay(state, now = Date.now(), options = {}) {
  const rent = rentForLevel(state.level);
  const goal = dailyGoalFor(state.level);
  const previousDay = state.day?.number ?? 1;
  const dayRevenue = state.day?.revenue ?? 0;
  const reachedGoal = dayRevenue >= goal;
  const shortfall = Math.max(0, rent - state.coins);
  state.coins = Math.max(0, state.coins - rent);
  if (reachedGoal) state.reputation += DAILY_GOAL_REPUTATION;
  if (shortfall > 0) state.reputation = Math.max(0, state.reputation + RENT_SHORTFALL_REPUTATION);
  state.day = { number: previousDay + 1, elapsedMs: 0, revenue: 0 };
  state.dayBreak = false;
  state.stats.productSales = {};
  const seasonChanged = refreshSeason(state, options.date ?? new Date(now));
  recordLedger(state, 'expense', -rent, `房租（第 ${previousDay} 天）`, now);
  return {
    dayNumber: state.day.number,
    rent,
    paid: shortfall <= 0,
    shortfall,
    reachedGoal,
    dayRevenue,
    seasonChanged,
    seasonName: state.season?.name ?? ''
  };
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

/**
 * 加柜成长：花钱新增一个零食柜（柜数 +1，全店格子变多）。
 * - 可同时指定一种还没上架的已解锁零食（直接进排面），productId 为空则纯扩空柜
 * - 柜位有上限（两排 × 5），价格随柜数递增
 */
export function purchaseShelfCabinet(state, productId = null, now = Date.now()) {
  const owned = Math.max(0, state.cabinetCount ?? state.shelves?.length ?? 0);
  if (owned >= MAX_CABINETS) return { ok: false, reason: '柜位已经摆满，放不下更多零食柜了' };
  let addedProduct = null;
  if (productId) {
    addedProduct = PRODUCTS[productId];
    if (!addedProduct) return { ok: false, reason: '未知零食' };
    if (state.shelves?.includes(productId)) return { ok: false, reason: '这种零食已经上架了' };
    refreshUnlocks(state);
    if (!state.unlockedProductIds.includes(productId)) {
      return { ok: false, reason: '这种零食还没解锁，先提升店铺等级或零食图鉴' };
    }
  }
  const cost = nextCabinetCost(owned);
  if (state.coins < cost) return { ok: false, reason: '金币不足', cost };
  state.coins -= cost;
  state.cabinetCount = owned + 1;
  if (addedProduct) state.shelves.push(productId);
  recordLedger(
    state,
    'expense',
    -cost,
    addedProduct ? `新增零食柜：${addedProduct.name}` : '扩建空零食柜',
    now
  );
  return { ok: true, cost, cabinetCount: state.cabinetCount, shelves: [...state.shelves] };
}

/**
 * 玩家自定义货架：把第 slot 号柜第 rowIndex 行换成 productId。
 * - 首次改动会把当前自动排面"物化"为 shelfPlan 存档，之后排面完全由玩家决定
 * - 换品后如果某种零食不再占据任何行，它在货架上的存货全部退回仓库
 * - 新零食必须是已解锁商品
 */
export function swapShelfRow(state, slot, rowIndex, productId, now = Date.now()) {
  const cabinetCount = Math.max(1, Math.min(MAX_CABINETS, state.cabinetCount ?? state.shelves?.length ?? 0));
  const slotIndex = Math.floor(Number(slot) || 0);
  const row = Math.floor(Number(rowIndex) || 0);
  if (slotIndex < 0 || slotIndex >= cabinetCount) return { ok: false, reason: '没有这个零食柜' };
  if (row < 0 || row >= GROUPS_PER_CABINET) return { ok: false, reason: '没有这一行' };
  const target = PRODUCTS[productId];
  if (!target) return { ok: false, reason: '未知零食' };
  refreshUnlocks(state);
  if (!state.unlockedProductIds.includes(productId)) {
    return { ok: false, reason: '这种零食还没解锁，先提升店铺等级或零食图鉴' };
  }

  // 物化当前排面（含玩家之前改过的部分），记录换品前的商品分布
  const before = shopPlanogram(state).rows.map((planRow) => [...planRow]);
  const previous = before[slotIndex]?.[row] ?? null;
  if (previous === productId) return { ok: true, previous, next: productId, returned: [] };

  if (!Array.isArray(state.shelfPlan) || state.shelfPlan.length < cabinetCount) {
    const plan = normalizeShelfPlan({ shelfPlan: before }, cabinetCount);
    state.shelfPlan = plan;
  }
  state.shelfPlan[slotIndex][row] = productId;

  // 换品后失去所有行架的商品：货架存货退回仓库（顾客预留的照常走完结账）
  const after = shopPlanogram(state);
  const occupied = new Set(after.rows.flat().filter(Boolean));
  const returned = [];
  for (const planRow of before) {
    for (const oldId of planRow) {
      if (!oldId || occupied.has(oldId)) continue;
      const qty = state.shelfInventory[oldId] ?? 0;
      if (qty > 0) {
        state.warehouseInventory[oldId] = (state.warehouseInventory[oldId] ?? 0) + qty;
        state.shelfInventory[oldId] = 0;
        returned.push({ productId: oldId, quantity: qty });
      }
    }
  }
  recordLedger(
    state,
    'note',
    0,
    `调整货架：${PRODUCTS[previous]?.name ?? '空位'} → ${target.name}`,
    now
  );
  return { ok: true, previous, next: productId, returned };
}

export function serializeState(state, now = Date.now()) {
  return JSON.stringify({ ...state, version: GAME_VERSION, saveVersion: GAME_VERSION, lastSavedAt: now });
}



export function restockShelf(state, productId, requestedQuantity) {
  if (!PRODUCTS[productId]) return 0;
  const requested = Math.max(0, Math.floor(Number(requestedQuantity) || 0));
  const available = state.warehouseInventory[productId] ?? 0;
  const capacity = productCapacity(state, productId);
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
  const shelves = normalizeShelves(parsed);
  const cabinetCount = normalizeCabinetCount(parsed, shelves);
  const upgrades = { ...upgradeDefaults(), ...(parsed.upgrades ?? {}) };
  for (const productId of Object.keys(PRODUCTS)) {
    const restoredReservation = Math.max(0, Number(reservedInventory[productId]) || 0);
    const capacity = productCapacity({ shelves, cabinetCount, upgrades }, productId);
    const shelfSpace = Math.max(0, capacity - (shelfInventory[productId] ?? 0));
    const returnedToShelf = Math.min(shelfSpace, restoredReservation);
    shelfInventory[productId] = (shelfInventory[productId] ?? 0) + returnedToShelf;
    warehouseInventory[productId] = (warehouseInventory[productId] ?? 0) + restoredReservation - returnedToShelf;
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
    shelves,
    cabinetCount,
    shelfPlan: normalizeShelfPlan(parsed, cabinetCount),
    upgrades,
    // 凌晨订货过场：营业计时不能超过打烊点；季节字段兜底
    day: {
      ...base.day,
      ...(parsed.day ?? {}),
      elapsedMs: Math.min(Number(parsed.day?.elapsedMs) || 0, DAY_LENGTH_MS)
    },
    dayBreak: parsed.dayBreak === true,
    season: normalizeSeason(parsed, now),
    stats: { ...base.stats, ...(parsed.stats ?? {}) },
    recoveredFromCorruptSave: false
  };
}

function migrateLegacyState(parsed, now) {
  const base = createInitialState(parsed.createdAt ?? now);
  const upgrades = { ...upgradeDefaults(), ...(parsed.upgrades ?? {}) };
  const shelves = normalizeShelves(parsed);
  const cabinetCount = normalizeCabinetCount(parsed, shelves);
  const legacyInventory = { ...warehouseInventoryDefaults(), ...(parsed.inventory ?? {}) };
  const shelfInventory = warehouseInventoryDefaults();
  const warehouseInventory = warehouseInventoryDefaults();
  for (const productId of Object.keys(PRODUCTS)) {
    const quantity = Math.max(0, Number(legacyInventory[productId]) || 0);
    const capacity = productCapacity({ shelves, cabinetCount, upgrades }, productId);
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
    shelves,
    cabinetCount,
    shelfPlan: normalizeShelfPlan(parsed, cabinetCount),
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
