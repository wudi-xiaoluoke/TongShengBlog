import {
  PRODUCTS,
  UPGRADES,
  productCapacity,
  unlockedProducts,
  upgradeCost
} from './game-config.mjs';
import { shelfDisplayState } from './game-state.mjs';

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(value ?? 0)));
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function productInfo(product, suffix) {
  return `
    <div class="product-info">
      <i class="product-swatch" style="background:${product.color}" aria-hidden="true"></i>
      <span><b>${product.name}</b><small>${suffix}</small></span>
    </div>`;
}

export function createGameUI(state, handlers) {
  const elements = {
    coins: document.getElementById('coins-value'),
    reputation: document.getElementById('reputation-value'),
    level: document.getElementById('level-value'),
    revenue: document.getElementById('revenue-value'),
    served: document.getElementById('served-value'),
    left: document.getElementById('left-value'),
    inventory: document.getElementById('inventory-list'),
    supply: document.getElementById('supply-list'),
    orders: document.getElementById('active-orders'),
    upgrades: document.getElementById('upgrade-list'),
    ledger: document.getElementById('ledger-list'),
    request: document.getElementById('customer-request'),
    customerState: document.getElementById('customer-state'),
    shelfPanel: document.getElementById('shelf-panel'),
    shelfProduct: document.getElementById('shelf-product'),
    shelfState: document.getElementById('shelf-state'),
    shelfStock: document.getElementById('shelf-stock'),
    warehouseStock: document.getElementById('warehouse-stock'),
    restockOne: document.getElementById('restock-one'),
    restockFive: document.getElementById('restock-five'),
    restockFull: document.getElementById('restock-full'),
    capacity: document.getElementById('capacity-label'),
    delivery: document.getElementById('delivery-label'),
    customerCount: document.getElementById('customer-count'),
    saveStatus: document.getElementById('save-status'),
    toast: document.getElementById('game-toast')
  };
  let toastTimer = 0;

  function renderStats() {
    elements.coins.textContent = formatNumber(state.coins);
    elements.reputation.textContent = formatNumber(state.reputation);
    elements.level.textContent = formatNumber(state.level);
    elements.revenue.textContent = formatNumber(state.stats.totalRevenue);
    elements.served.textContent = formatNumber(state.stats.customersServed);
    elements.left.textContent = formatNumber(state.stats.customersLeft);
    elements.capacity.textContent = `单架容量 ${productCapacity(state)}`;
    const reduction = Math.min(55, state.upgrades.delivery * 12);
    elements.delivery.textContent = reduction ? `配送加速 ${reduction}%` : '普通配送';
  }

  function renderInventory() {
    elements.inventory.innerHTML = unlockedProducts(state).map((product) => `
      <div class="product-row">
        ${productInfo(product, `仓库 ${state.warehouseInventory[product.id] ?? 0} · 货架 ${state.shelfInventory[product.id] ?? 0} · 顾客已取 ${state.reservedInventory[product.id] ?? 0}`)}
        <span class="stock-value">${(state.warehouseInventory[product.id] ?? 0) + (state.shelfInventory[product.id] ?? 0) + (state.reservedInventory[product.id] ?? 0)}</span>
      </div>`).join('');
  }

  function renderSupply(now) {
    elements.supply.innerHTML = unlockedProducts(state).map((product) => `
      <div class="product-row">
        ${productInfo(product, `${product.orderQuantity} 件 · ${product.orderCost} 金币`)}
        <div class="row-actions">
          <button class="mini-button" type="button" data-order-product="${product.id}"
            ${state.coins < product.orderCost ? 'disabled' : ''}>下单</button>
        </div>
      </div>`).join('');

    if (!state.supplyOrders.length) {
      elements.orders.innerHTML = '<p class="empty-panel">暂时没有运输中的订单。</p>';
      return;
    }
    elements.orders.innerHTML = state.supplyOrders.map((order) => {
      const product = PRODUCTS[order.productId];
      const total = Math.max(1, order.readyAt - order.orderedAt);
      const progress = Math.max(0, Math.min(100, ((now - order.orderedAt) / total) * 100));
      return `
        <div class="order-row">
          <div>
            <b>${product.name} × ${order.quantity}</b>
            <div class="order-progress"><i style="width:${progress.toFixed(1)}%"></i></div>
          </div>
          <strong>${formatDuration(order.readyAt - now)}</strong>
        </div>`;
    }).join('');
  }

  function renderUpgrades() {
    elements.upgrades.innerHTML = Object.values(UPGRADES).map((upgrade) => {
      const level = state.upgrades[upgrade.id] ?? 0;
      const cost = upgradeCost(upgrade.id, level);
      return `
        <div class="upgrade-row">
          <div class="upgrade-info">
            <span><b>${upgrade.name} · Lv.${level}</b><small>${upgrade.description}</small></span>
          </div>
          <button class="mini-button" type="button" data-upgrade="${upgrade.id}"
            ${state.coins < cost ? 'disabled' : ''}>${cost} 金币</button>
        </div>`;
    }).join('');
  }

  function renderLedger() {
    if (!state.ledger.length) {
      elements.ledger.innerHTML = '<p class="empty-panel">第一笔生意还在路上。</p>';
      return;
    }
    elements.ledger.innerHTML = state.ledger.map((entry) => `
      <div class="ledger-row ${entry.type}">
        <span>${entry.label}</span>
        <strong>${entry.amount > 0 ? '+' : ''}${entry.amount}</strong>
      </div>`).join('');
  }

  function renderCustomer(selectedCustomer) {
    if (!selectedCustomer || selectedCustomer.phase === 'done') {
      elements.customerState.textContent = '等待选择';
      elements.request.innerHTML = '<p>点击场景中的顾客查看想买什么。</p>';
      return;
    }
    const phaseLabels = {
      street: '正在路上', entering: '正在进店', browsing: '前往货架',
      picking: '正在取货', waitingShelf: '等待货架', queueing: '正在排队',
      checkout: '正在结账', outOfStock: '发现缺货', leaving: '准备离店'
    };
    elements.customerState.textContent = phaseLabels[selectedCustomer.phase] ?? '店内顾客';
    elements.request.innerHTML = `
      <div class="request-items">${selectedCustomer.request.map((item) => {
        const product = PRODUCTS[item.productId];
        return `<span class="request-chip">${product.name} × ${item.quantity}</span>`;
      }).join('')}</div>`;
  }

  function renderShelf(selectedShelf) {
    if (!selectedShelf) {
      elements.shelfPanel.classList.add('is-dormant');
      elements.shelfProduct.textContent = '选择货架';
      elements.shelfState.textContent = '等待选择';
      elements.shelfStock.textContent = '--';
      elements.warehouseStock.textContent = '--';
      [elements.restockOne, elements.restockFive, elements.restockFull].forEach((button) => { button.disabled = true; });
      return;
    }
    const product = PRODUCTS[selectedShelf.productId];
    const shelfQuantity = state.shelfInventory[selectedShelf.productId] ?? 0;
    const warehouseQuantity = state.warehouseInventory[selectedShelf.productId] ?? 0;
    const capacity = productCapacity(state);
    const label = { empty: '已空', low: '偏少', half: '半满', full: '充足' }[
      shelfDisplayState(shelfQuantity, capacity)
    ];
    elements.shelfPanel.classList.remove('is-dormant');
    elements.shelfProduct.textContent = `${product.name}货架`;
    elements.shelfState.textContent = label;
    elements.shelfStock.textContent = `${shelfQuantity} / ${capacity}`;
    elements.warehouseStock.textContent = warehouseQuantity;
    const reservedQuantity = state.reservedInventory[selectedShelf.productId] ?? 0;
    const disabled = warehouseQuantity <= 0 || shelfQuantity + reservedQuantity >= capacity;
    [elements.restockOne, elements.restockFive, elements.restockFull].forEach((button) => { button.disabled = disabled; });
  }

  function render(now, customers, selectedCustomer, selectedShelf = null) {
    renderStats();
    renderInventory();
    renderSupply(now);
    renderUpgrades();
    renderLedger();
    renderCustomer(selectedCustomer);
    renderShelf(selectedShelf);
    const maxCustomers = Math.min(5, 2 + state.upgrades.traffic);
    elements.customerCount.textContent = `店内顾客 ${customers.length} / ${maxCustomers}`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2_300);
  }

  function markSaved(text = '已自动存档') {
    elements.saveStatus.textContent = text;
  }

  document.querySelector('.game-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-panel]');
    if (!button) return;
    document.querySelectorAll('.game-tab').forEach((tab) => tab.classList.toggle('is-active', tab === button));
    document.querySelectorAll('[data-game-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.id !== button.dataset.panel));
  });
  elements.supply.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-product]');
    if (button) handlers.onSupply(button.dataset.orderProduct);
  });
  elements.upgrades.addEventListener('click', (event) => {
    const button = event.target.closest('[data-upgrade]');
    if (button) handlers.onUpgrade(button.dataset.upgrade);
  });
  elements.restockOne.addEventListener('click', () => handlers.onRestock(1));
  elements.restockFive.addEventListener('click', () => handlers.onRestock(5));
  elements.restockFull.addEventListener('click', () => handlers.onRestock(Number.POSITIVE_INFINITY));
  document.getElementById('help-button').addEventListener('click', () => document.getElementById('help-dialog').showModal());
  document.getElementById('open-reset').addEventListener('click', () => document.getElementById('reset-game-dialog').showModal());
  document.getElementById('confirm-reset').addEventListener('click', () => handlers.onReset());
  document.getElementById('retry-assets').addEventListener('click', () => handlers.onRetryAssets());

  return { render, showToast, markSaved };
}
