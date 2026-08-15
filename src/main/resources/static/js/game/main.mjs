import {
  BACKUP_KEY,
  CUSTOMER_VARIANTS,
  PRODUCTS,
  STORAGE_KEY,
  productCapacity,
  unlockedProducts
} from './game-config.mjs';
import {
  createInitialState,
  placeSupplyOrder,
  purchaseUpgrade,
  restockShelf,
  restoreState,
  serializeState,
  settleSupplyOrders
} from './game-state.mjs';
import {
  createCustomerSimulation,
  customerAtPoint
} from './game-customer.mjs';
import {
  canvasPointFromEvent,
  createSceneRenderer,
  loadGameAssets
} from './game-scene.mjs';
import { shelfAtPoint, shelfById } from './game-world.mjs';
import { createGameUI } from './game-ui.mjs';

const canvas = document.getElementById('snack-shop-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const assetError = document.getElementById('asset-error');
const sceneMessage = document.getElementById('scene-message');

const rawSave = localStorage.getItem(STORAGE_KEY);
const state = restoreState(rawSave, Date.now());
if (state.recoveredFromCorruptSave && rawSave) localStorage.setItem(BACKUP_KEY, rawSave);

let simulation;
let selectedCustomerId = null;
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

function selectedCustomer() {
  return customers().find((customer) => customer.id === selectedCustomerId) ?? null;
}

function selectedShelf() {
  return shelfById(selectedShelfId);
}

function saveGame(statusText = '已自动存档') {
  localStorage.setItem(STORAGE_KEY, serializeState(state, Date.now()));
  ui.markSaved(statusText);
}

function refreshUI() {
  ui.render(Date.now(), customers(), selectedCustomer(), selectedShelf());
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
  onRestock(quantity) {
    const shelf = selectedShelf();
    if (!shelf) return;
    const current = state.shelfInventory[shelf.productId] ?? 0;
    const requested = Number.isFinite(quantity) ? quantity : productCapacity(state) - current;
    const moved = restockShelf(state, shelf.productId, requested);
    if (!moved) {
      ui.showToast((state.warehouseInventory[shelf.productId] ?? 0) <= 0
        ? '仓库没货了，先去进货吧'
        : '货架容量已被商品和顾客预留占满');
      return;
    }
    saveGame('补货完成并已存档');
    ui.showToast(`${PRODUCTS[shelf.productId].name} 上架 ${moved} 件`);
    refreshUI();
  },
  onReset() {
    localStorage.removeItem(STORAGE_KEY);
    for (const customer of [...customers()]) simulation.releaseCustomer(customer);
    customers().splice(0);
    const freshState = createInitialState(Date.now());
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, freshState);
    selectedCustomerId = null;
    selectedShelfId = null;
    nextSpawnAt = performance.now() + 1_000;
    saveGame('新店已经准备好');
    ui.showToast('已经重新开店');
    refreshUI();
  },
  onRetryAssets() {
    window.location.reload();
  }
});

simulation = createCustomerSimulation({
  state,
  onCheckout({ revenue }) {
    saveGame('顾客结账并已存档');
    ui.showToast(`收银完成，收入 ${revenue} 金币`);
  },
  onOutOfStock({ productId }) {
    saveGame('缺货顾客离店，进度已保存');
    ui.showToast(`${PRODUCTS[productId]?.name ?? '商品'} 缺货，顾客离店了`);
  }
});

function randomRequest() {
  const products = unlockedProducts(state);
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

function spawnCustomer(now) {
  const maxCustomers = Math.min(5, 2 + state.upgrades.traffic);
  if (activeCustomers().length >= maxCustomers) {
    nextSpawnAt = now + 1_000;
    return;
  }
  const request = randomRequest();
  simulation.spawn({
    id: `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    request,
    variant: Math.floor(Math.random() * CUSTOMER_VARIANTS.length)
  });
  const interval = Math.max(4_000, 10_000 - state.upgrades.traffic * 1_100);
  nextSpawnAt = now + interval + Math.random() * 2_000;
  sceneMessage.textContent = '有新顾客沿街道走进来了';
}

function updateCustomers(deltaMs) {
  simulation.update(deltaMs, Date.now());
  for (let index = customers().length - 1; index >= 0; index -= 1) {
    if (customers()[index].phase === 'done') customers().splice(index, 1);
  }
  if (!selectedCustomer()) selectedCustomerId = null;
}

function gameLoop(now) {
  if (!running) return;
  const deltaMs = Math.min(80, Math.max(0, now - lastFrameAt));
  lastFrameAt = now;
  elapsedMs += deltaMs;
  if (now >= nextSpawnAt) spawnCustomer(now);
  updateCustomers(deltaMs);

  const completed = settleSupplyOrders(state, Date.now());
  if (completed.length) {
    saveGame('进货已进入仓库');
    ui.showToast(`${completed.map((order) => PRODUCTS[order.productId].name).join('、')} 已送入仓库`);
  }

  renderScene?.({
    customers: activeCustomers(),
    selectedCustomerId,
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
  const customer = customerAtPoint(activeCustomers(), point.x, point.y);
  if (customer) {
    selectedCustomerId = customer.id;
    selectedShelfId = null;
    sceneMessage.textContent = '已选中顾客，可查看购买清单和当前动作';
  } else {
    const shelf = shelfAtPoint(point.x, point.y);
    selectedShelfId = shelf?.id ?? null;
    selectedCustomerId = null;
    sceneMessage.textContent = shelf
      ? `已选中${PRODUCTS[shelf.productId].name}货架，可从仓库补货`
      : '点击顾客查看需求，点击货架进行补货';
  }
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
  try {
    loadingText.textContent = '正在铺设街道、货架和收银台…';
    const assets = await loadGameAssets('/images/game');
    renderScene = createSceneRenderer(canvas, assets);
    loadingOverlay.classList.add('is-hidden');
    assetError.classList.add('is-hidden');
    saveGame(rawSave ? '已读取并升级本地存档' : '新店已自动存档');
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error(error);
    loadingOverlay.classList.add('is-hidden');
    assetError.classList.remove('is-hidden');
  }
}

start();
