import {
  BACKUP_KEY,
  CUSTOMER_VARIANTS,
  DAY_LENGTH_MS,
  PRODUCTS,
  STORAGE_KEY,
  VIP_CHANCE,
  VIP_REPUTATION_THRESHOLD,
  dailyGoalFor,
  dayPhaseFor,
  gameClock,
  maxCustomersFor,
  productCapacity,
  rentForLevel,
  seasonById,
  spawnIntervalMs
} from './game-config.mjs';
import {
  advanceDay,
  createInitialState,
  placeSupplyOrder,
  purchaseShelfCabinet,
  purchaseUpgrade,
  restockShelf,
  restoreState,
  serializeState,
  settleSupplyOrders,
  swapShelfRow
} from './game-state.mjs';
import {
  createCustomerSimulation,
  customerAtPoint
} from './game-customer.mjs';
import {
  canvasPointFromEvent,
  createSceneRenderer,
  loadGameAssets
} from './game-scene.mjs?v=20260909-live';
import { createGameUI } from './game-ui.mjs?v=20260909-live';
import { buildWorld } from './game-world.mjs';

const canvas = document.getElementById('snack-shop-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const assetError = document.getElementById('asset-error');
const sceneMessage = document.getElementById('scene-message');

// === 账号与云存档：登录用户的进度存服务端，换设备续档 ===
/** 当前登录用户；null = 未登录/离线，走纯本地模式 */
async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** 拉云端存档 JSON；未登录/没有云端档/网络失败都返回 null */
async function fetchCloudSave() {
  try {
    const res = await fetch('/api/game/save');
    if (!res.ok) return null;
    const data = await res.json();
    return data.save?.stateJson ?? null;
  } catch {
    return null;
  }
}

const currentUser = await fetchCurrentUser();
// 账号绑定的云端进度优先：登录且有云档则以云端为准（同步镜像到本地）
const cloudSaveJson = currentUser ? await fetchCloudSave() : null;
if (cloudSaveJson) localStorage.setItem(STORAGE_KEY, cloudSaveJson);

// 标题右侧显示店主名牌（登录才有）
const playerChip = document.getElementById('player-chip');
if (currentUser && playerChip) {
  playerChip.textContent = `店主：${currentUser.username}${cloudSaveJson ? ' · 已接续云端档' : ''}`;
  playerChip.hidden = false;
}

const rawSave = localStorage.getItem(STORAGE_KEY);
const state = restoreState(rawSave, Date.now());
if (state.recoveredFromCorruptSave && rawSave) localStorage.setItem(BACKUP_KEY, rawSave);

// 动态世界：柜位/排面/路线由存档的柜数与已上架零食决定，加柜后重建并热替换
let world = buildWorld(state);

let simulation;
let selectedShelfId = null;
let renderScene = null;
let nextSpawnAt = performance.now() + 2_200;
let lastFrameAt = performance.now();
let lastUiAt = 0;
let elapsedMs = 0;
let running = true;

function customers() {
  return simulation?.customers ?? [];
}

function selectedShelf() {
  return world.shelfById(selectedShelfId);
}

/** 选中的零食柜里，某一行（默认第一行）摆放的零食 */
function shelfProductAt(shelf, row = 0) {
  return world.rows?.[shelf?.slot ?? 0]?.[row] ?? world.productIds[0] ?? null;
}

let cloudSyncTimer = null;

/** 登录用户的存档异步同步到云端（防抖 3s，避免高频操作连环请求） */
function syncCloudSave() {
  if (!currentUser) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/game/save', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateJson: serializeState(state, Date.now()) })
      });
      if (res.ok) ui.markSaved('已同步云端 ☁');
    } catch { /* 网络失败不打扰经营，本地档仍在 */ }
  }, 3_000);
}

function saveGame(statusText = '已自动存档') {
  localStorage.setItem(STORAGE_KEY, serializeState(state, Date.now()));
  syncCloudSave();
  ui.markSaved(statusText);
}

function refreshUI() {
  ui.render(Date.now(), customers(), selectedShelf());
  // 场景内气泡跟随对象移动（窗口缩放会重新吸附）
  ui.positionPopovers({ shelf: selectedShelf(), canvas });
}

function mutateAndRender(callback) {
  callback();
  saveGame();
  refreshUI();
}

const ui = createGameUI(state, {
  onSupply(productId) {
    try {
      mutateAndRender(() => {
        const order = placeSupplyOrder(state, productId, Date.now());
        ui.showToast(`${PRODUCTS[productId].name} 已发货，${Math.ceil((order.readyAt - Date.now()) / 1_000)} 秒后进入仓库`);
      });
    } catch (error) {
      ui.showToast(error.message);
    }
  },
  onUpgrade(upgradeId) {
    const result = purchaseUpgrade(state, upgradeId, Date.now());
    if (!result.ok) {
      ui.showToast(result.reason);
      return;
    }
    saveGame();
    ui.showToast(`升级成功，当前 Lv.${result.level}`);
    refreshUI();
  },
  onAddCabinet(productId) {
    const result = purchaseShelfCabinet(state, productId || null, Date.now());
    if (!result.ok) {
      ui.showToast(result.reason);
      refreshUI();
      return;
    }
    world = buildWorld(state);
    simulation.setWorld(world);
    selectedShelfId = null;
    saveGame('新零食柜已就位并存档');
    ui.showToast(productId
      ? `新零食柜已摆好，快去给 ${PRODUCTS[productId].name} 进货吧`
      : '空柜已就位，所有零食的格子都变多了');
    refreshUI();
  },
  onRestock(quantity, productId = null) {
    const shelf = selectedShelf();
    if (!shelf) return;
    const target = productId || shelfProductAt(shelf);
    if (!target) return;
    const current = state.shelfInventory[target] ?? 0;
    const requested = Number.isFinite(quantity) ? quantity : productCapacity(state, target) - current;
    const moved = restockShelf(state, target, requested);
    if (!moved) {
      ui.showToast((state.warehouseInventory[target] ?? 0) <= 0
        ? '仓库没货了，先去进货吧'
        : '货架容量已被商品和顾客预留占满');
      return;
    }
    saveGame('补货完成并已存档');
    ui.showToast(`${PRODUCTS[target].name} 上架 ${moved} 件`);
    refreshUI();
  },
  onSwapShelfRow(slot, rowIndex, productId) {
    const result = swapShelfRow(state, slot, rowIndex, productId, Date.now());
    if (!result.ok) {
      ui.showToast(result.reason);
      refreshUI();
      return;
    }
    world = buildWorld(state);
    simulation.setWorld(world);
    if (result.returned?.length) {
      ui.showToast(`已换成 ${PRODUCTS[productId].name}；${result.returned
        .map((item) => `${PRODUCTS[item.productId].name} ×${item.quantity}`)
        .join('、')} 退回仓库`);
    } else {
      ui.showToast(`这一行已换成 ${PRODUCTS[productId].name}`);
    }
    saveGame('货架已重新摆放并存档');
    refreshUI();
  },
  onReset() {
    localStorage.removeItem(STORAGE_KEY);
    for (const customer of [...customers()]) simulation.releaseCustomer(customer);
    customers().splice(0);
    const freshState = createInitialState(Date.now());
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, freshState);
    selectedShelfId = null;
    nextSpawnAt = performance.now() + 1_000;
    world = buildWorld(state);
    simulation.setWorld(world);
    saveGame('新店已经准备好');
    ui.showToast('已经重新开店');
    refreshUI();
  },
  onRetryAssets() {
    window.location.reload();
  },
  onOpenNewDay(orders) {
    // 开门前先提交凌晨勾选的订货单（表格步进器累计的），失败的单项跳过
    if (Array.isArray(orders) && orders.length) {
      let placed = 0;
      for (const item of orders) {
        try {
          placeSupplyOrder(state, item.productId, Date.now());
          placed += 1;
        } catch {
          // 金币不足等异常：跳过这一份，不影响开门
        }
      }
      if (placed > 0) ui.showToast(`提交了 ${placed} 份订货，开门后陆续到货`);
    }
    openNewDay();
  }
});

simulation = createCustomerSimulation({
  state,
  world,
  onCheckout({ revenue, tip }) {
    saveGame('顾客结账并已存档');
    ui.showToast(tip > 0
      ? `收银完成，收入 ${revenue} 金币，顾客很满意给了 ${tip} 小费`
      : `收银完成，收入 ${revenue} 金币`);
  },
  onOutOfStock({ productId }) {
    saveGame('缺货顾客离店，进度已保存');
    ui.showToast(`${PRODUCTS[productId]?.name ?? '商品'} 缺货，顾客离店了`);
  },
  onAngryLeave() {
    saveGame('顾客等不及生气离店，进度已保存');
    ui.showToast('顾客等太久而生气离店，口碑 -2，记得加快补货和收银');
  }
});

/** 顾客只会买店里摆着的零食（柜位里的商品） */
function carriedProducts() {
  return world.productIds
    .map((productId) => PRODUCTS[productId])
    .filter(Boolean);
}

function randomRequest() {
  const products = carriedProducts();
  const first = products[Math.floor(Math.random() * products.length)];
  const request = [{ productId: first.id, quantity: 1 }];
  if (state.level >= 3 && products.length > 1 && Math.random() < 0.32) {
    let second = first;
    while (second.id === first.id) second = products[Math.floor(Math.random() * products.length)];
    request.push({ productId: second.id, quantity: 1 });
  }
  return request;
}

function activeCustomers() {
  return customers().filter((customer) => customer.phase !== 'done');
}

function vipRequest() {
  const products = carriedProducts();
  const count = 2 + (Math.random() < 0.5 ? 1 : 0);
  const request = [];
  for (let index = 0; index < count; index += 1) {
    const product = products[Math.floor(Math.random() * products.length)];
    request.push({ productId: product.id, quantity: 1 });
  }
  return request;
}

/** 当前季节配置（存档里缓存，换天时刷新） */
function currentSeason() {
  return seasonById(state.season?.id) ?? null;
}

/** 按时段客群权重抽变体（student/neighbor/worker） */
function pickVariant(phase) {
  const weights = phase?.weights ?? {};
  const entries = CUSTOMER_VARIANTS.map((variant, index) => [variant.id, index]);
  const total = entries.reduce((sum, [id]) => sum + (weights[id] ?? 0.34), 0);
  let roll = Math.random() * total;
  for (const [id, index] of entries) {
    roll -= weights[id] ?? 0.34;
    if (roll <= 0) return index;
  }
  return 0;
}

function spawnCustomer(now) {
  const clock = gameClock(state);
  const phase = dayPhaseFor(clock.hour);
  const season = currentSeason();
  const maxCustomers = maxCustomersFor(state.upgrades.traffic, phase);
  if (activeCustomers().length >= maxCustomers) {
    nextSpawnAt = now + 1_000;
    return;
  }
  const vip = state.reputation >= VIP_REPUTATION_THRESHOLD && Math.random() < VIP_CHANCE;
  const request = vip ? vipRequest() : randomRequest();
  simulation.spawn({
    id: `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    request,
    variant: pickVariant(phase),
    vip
  });
  const base = Math.max(4_000, 10_000 - state.upgrades.traffic * 1_100);
  const interval = spawnIntervalMs(base, phase, season);
  nextSpawnAt = now + interval + Math.random() * 2_000;
  sceneMessage.textContent = vip ? '一位戴金冠的贵客光临了小店！' : '有新顾客沿街道走进来了';
}

function updateCustomers(deltaMs) {
  simulation.update(deltaMs, Date.now());
  for (let index = customers().length - 1; index >= 0; index -= 1) {
    if (customers()[index].phase === 'done') customers().splice(index, 1);
  }
}

/** 打烊：进入凌晨订货过场（时间冻结，玩家下完进货单再开门） */
function enterDayBreak() {
  state.day.elapsedMs = DAY_LENGTH_MS;
  state.dayBreak = true;
  saveGame('打烊了，凌晨订货时间');
  ui.showNightBreak({
    dayNumber: state.day.number,
    dayRevenue: state.day.revenue ?? 0,
    goal: dailyGoalFor(state.level),
    rent: rentForLevel(state.level),
    coins: state.coins
  });
}

/** 凌晨过场结束：结算房租、翻到新一天，换季时播报 */
function openNewDay() {
  const settlement = advanceDay(state, Date.now());
  saveGame('新的一天开始了');
  ui.hideNightBreak();
  if (!settlement.paid) {
    ui.showToast(`打烊：金币不够交房租（差 ${settlement.shortfall}），口碑大跌！第 ${settlement.dayNumber} 天继续努力`);
  } else if (settlement.reachedGoal) {
    ui.showToast(`打烊：达成营业目标，口碑 +5！房租 ${settlement.rent} 已付，第 ${settlement.dayNumber} 天开门`);
  } else {
    ui.showToast(`打烊：已付房租 ${settlement.rent} 金币，第 ${settlement.dayNumber} 天开门营业`);
  }
  if (settlement.seasonChanged) {
    ui.showToast(`${settlement.seasonName}天来了，街上的客人也换了一批气质`);
  }
  nextSpawnAt = performance.now() + 2_000;
  refreshUI();
}

function gameLoop(now) {
  if (!running) return;
  const deltaMs = Math.min(80, Math.max(0, now - lastFrameAt));
  lastFrameAt = now;
  elapsedMs += deltaMs;
  if (!state.dayBreak && now >= nextSpawnAt) spawnCustomer(now);
  updateCustomers(deltaMs);

  const completed = settleSupplyOrders(state, Date.now());
  if (completed.length) {
    saveGame('进货已进入仓库');
    ui.showToast(`${completed.map((order) => PRODUCTS[order.productId].name).join('、')} 已送入仓库`);
  }

  // === 营业日推进：到点不直接结算，先进凌晨订货过场 ===
  if (state.day && !state.dayBreak) {
    state.day.elapsedMs += deltaMs;
    if (state.day.elapsedMs >= DAY_LENGTH_MS) enterDayBreak();
  }

  renderScene?.({
    customers: activeCustomers(),
    selectedShelfId,
    state,
    elapsedMs
  });
  if (now - lastUiAt > 250) {
    refreshUI();
    lastUiAt = now;
  }
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPointFromEvent(canvas, event);
  if (customerAtPoint(activeCustomers(), point.x, point.y)) return; // 点顾客不响应，保持纯观赏
  const shelf = world.shelfAtPoint(point.x, point.y);
  selectedShelfId = shelf?.id ?? null;
  if (!shelf) ui.closePanels(); // 点空白处：气泡全部收起，画面回归纯场景
  sceneMessage.textContent = shelf
    ? `已选中零食柜（${new Set(world.rows[shelf.slot] ?? []).size} 种零食），可从仓库补货`
    : '点击货架补货，右下角手机管理进货和账本';
  refreshUI();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
    saveGame('已暂停并存档');
  } else {
    settleSupplyOrders(state, Date.now());
    running = true;
    lastFrameAt = performance.now();
    requestAnimationFrame(gameLoop);
  }
});

window.addEventListener('beforeunload', () => saveGame());
window.setInterval(() => saveGame(), 15_000);

async function start() {
  refreshUI();
  if (state.recoveredFromCorruptSave) ui.showToast('旧存档损坏，已备份并创建新店');
  // 刷新页面时若停在凌晨订货过场，直接恢复夜幕画面
  if (state.dayBreak) {
    ui.showNightBreak({
      dayNumber: state.day.number,
      dayRevenue: state.day.revenue ?? 0,
      goal: dailyGoalFor(state.level),
      rent: rentForLevel(state.level),
      coins: state.coins
    });
  }
  try {
    loadingText.textContent = '正在铺设街道、货架和收银台…';
    const assets = await loadGameAssets();
    renderScene = createSceneRenderer(canvas, assets);
    loadingOverlay.classList.add('is-hidden');
    assetError.classList.add('is-hidden');
    saveGame(cloudSaveJson ? '已读取云端存档 ☁' : rawSave ? '已读取并升级本地存档' : '新店已自动存档');
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error(error);
    loadingOverlay.classList.add('is-hidden');
    assetError.classList.remove('is-hidden');
  }
}

start();
