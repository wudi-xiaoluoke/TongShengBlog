import {
  DAY_LENGTH_MS,
  GROUPS_PER_CABINET,
  MAX_CABINETS,
  PRODUCTS,
  PRODUCT_CATEGORIES,
  SLOTS_PER_CABINET,
  UPGRADES,
  dailyGoalFor,
  gameClock,
  nextCabinetCost,
  productCapacity,
  rentForLevel,
  shopPlanogram,
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
    cabinets: document.getElementById('cabinet-list'),
    ledger: document.getElementById('ledger-list'),
    shelfPanel: document.getElementById('shelf-panel'),
    shelfProduct: document.getElementById('shelf-product'),
    shelfState: document.getElementById('shelf-state'),
    shelfExtra: document.getElementById('shelf-extra-products'),
    capacity: document.getElementById('capacity-label'),
    delivery: document.getElementById('delivery-label'),
    dayTimer: document.getElementById('day-timer'),
    widgetRevenue: document.getElementById('widget-revenue'),
    widgetGoal: document.getElementById('widget-goal'),
    widgetBar: document.getElementById('widget-bar-fill'),
    widgetSeason: document.getElementById('widget-season'),
    widgetCoins: document.getElementById('widget-coins'),
    widgetReputation: document.getElementById('widget-reputation'),
    nightOverlay: document.getElementById('night-overlay'),
    nightSummary: document.getElementById('night-summary'),
    nightSupply: document.getElementById('night-supply-list'),
    nightOrders: document.getElementById('night-orders'),
    saveStatus: document.getElementById('save-status'),
    toast: document.getElementById('game-toast')
  };
  let toastTimer = 0;
  let selectedShelfSlot = null; // 当前选中的柜位号，换品下拉框要用
  const stageElement = document.getElementById('game-stage');
  const phoneButton = document.getElementById('phone-button');
  const phoneShell = document.getElementById('phone-shell');
  const phoneHome = document.getElementById('phone-home');
  const phoneClock = document.getElementById('phone-clock');
  let openPanelId = null; // null = 手机主屏

  /** 手机开合 */
  function setPhoneOpen(open) {
    phoneShell?.classList.toggle('is-hidden', !open);
    phoneButton?.setAttribute('aria-expanded', String(open));
    phoneButton?.classList.toggle('is-active', open);
  }

  /** 手机内 App 切换：null 回主屏；再点同一个 App 也能回主屏 */
  function setOpenPanel(id) {
    openPanelId = openPanelId === id ? null : id;
    document.querySelectorAll('[data-phone-page]').forEach((panel) => {
      panel.classList.toggle('is-hidden', panel.id !== openPanelId);
    });
    phoneHome?.classList.toggle('is-hidden', openPanelId !== null);
    phoneShell?.querySelectorAll('.phone-app').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.panel === openPanelId);
    });
  }

  /** 把气泡面板摆到舞台内的世界坐标附近（自动夹在画面内） */
  function placePopover(panel, anchorX, anchorY, placement) {
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    if (!width || !height) return;
    const stageWidth = stageElement.clientWidth;
    const stageHeight = stageElement.clientHeight;
    let left = Math.round(anchorX - width / 2);
    left = Math.max(8, Math.min(left, stageWidth - width - 8));
    let top = placement === 'below' ? Math.round(anchorY + 10) : Math.round(anchorY - height - 12);
    top = Math.max(8, Math.min(top, stageHeight - height - 8));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  /**
   * 场景内 UI 定位：每帧把打开的气泡吸附到对应对象旁边。
   * shelf 传画布世界坐标（768×512 空间）的选中对象。
   */
  function positionPopovers({ shelf = null, canvas = null } = {}) {
    if (!stageElement || !canvas) return;
    stageElement.classList.toggle('compact-stage', canvas.clientWidth < 700);
    if (canvas.clientWidth < 700) {
      // 小屏退回文档流，清掉内联定位
      if (elements.shelfPanel) { elements.shelfPanel.style.left = ''; elements.shelfPanel.style.top = ''; }
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stageElement.getBoundingClientRect();
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    const toStageX = (x) => canvasRect.left - stageRect.left + x * scaleX;
    const toStageY = (y) => canvasRect.top - stageRect.top + y * scaleY;
    if (shelf && !elements.shelfPanel.classList.contains('is-hidden')) {
      // 补货卡：贴在柜子正下方（下方是地板空地，不遮货架）
      placePopover(elements.shelfPanel, toStageX(shelf.x + shelf.width / 2), toStageY(shelf.y + shelf.height), 'below');
    }
  }

  function renderStats() {
    elements.coins.textContent = formatNumber(state.coins);
    elements.reputation.textContent = formatNumber(state.reputation);
    elements.level.textContent = formatNumber(state.level);
    elements.revenue.textContent = formatNumber(state.stats.totalRevenue);
    elements.served.textContent = formatNumber(state.stats.customersServed);
    elements.left.textContent = formatNumber(state.stats.customersLeft);
    elements.capacity.textContent =
      `零食柜 ${state.cabinetCount ?? state.shelves?.length ?? 0}/${MAX_CABINETS} · 每柜 ${SLOTS_PER_CABINET} 格`;
    const reduction = Math.min(55, state.upgrades.delivery * 12);
    elements.delivery.textContent = reduction ? `配送加速 ${reduction}%` : '普通配送';
  }

  // 手机端分类筛选（仓库/货架 与 配送中心 共用一个选中分类）
  let phoneCategory = 'all';

  function renderPhoneCats() {
    document.querySelectorAll('[data-phone-cats]').forEach((nav) => {
      nav.innerHTML = PRODUCT_CATEGORIES.map((cat) => `
        <button type="button" class="phone-cat${cat.id === phoneCategory ? ' is-active' : ''}"
          data-phone-cat="${cat.id}">${cat.name}</button>`).join('');
    });
  }

  function renderInventory() {
    elements.inventory.innerHTML = unlockedProducts(state)
      .filter((product) => phoneCategory === 'all' || product.category === phoneCategory)
      .map((product) => `
      <div class="product-row">
        ${productInfo(product, `仓库 ${state.warehouseInventory[product.id] ?? 0} · 货架 ${state.shelfInventory[product.id] ?? 0} · 顾客已取 ${state.reservedInventory[product.id] ?? 0}`)}
        <span class="stock-value">${(state.warehouseInventory[product.id] ?? 0) + (state.shelfInventory[product.id] ?? 0) + (state.reservedInventory[product.id] ?? 0)}</span>
      </div>`).join('') || '<p class="empty-panel">这个分类还没有解锁的零食。</p>';
  }

  /** 进货列表（手机"配送中心"专用；凌晨订货用 nr-table） */
  function supplyRowsHtml() {
    return unlockedProducts(state)
      .filter((product) => phoneCategory === 'all' || product.category === phoneCategory)
      .map((product) => {
        const warehouse = state.warehouseInventory[product.id] ?? 0;
        const incoming = state.supplyOrders
          .filter((order) => order.productId === product.id)
          .reduce((sum, order) => sum + (order.quantity ?? 0), 0);
        return `
      <div class="product-row">
        ${productInfo(product, `${product.orderQuantity} 件 · ${product.orderCost} 金币 · 仓库 ${warehouse}${incoming ? ` · 在途 ${incoming}` : ''}`)}
        <div class="row-actions">
          <button class="mini-button" type="button" data-order-product="${product.id}"
            ${state.coins < product.orderCost ? 'disabled' : ''}>下单</button>
        </div>
      </div>`;
      }).join('') || '<p class="empty-panel">这个分类还没有解锁的零食。</p>';
  }

  function ordersHtml(now) {
    if (!state.supplyOrders.length) {
      return '<p class="empty-panel">暂时没有运输中的订单。</p>';
    }
    return state.supplyOrders.map((order) => {
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

  // === 凌晨订货表格（左列零食种类 + 横排供货价/仓库/上期销量/订货步进器） ===
  const nightQty = new Map(); // productId -> 份数（1 份 = 一次下单的 orderQuantity 件）
  let nightCategory = 'all';  // 书签筛选：当前选中的分类

  function nightQtyOf(productId) {
    return nightQty.get(productId) ?? 0;
  }

  function nightTotals() {
    let qty = 0;
    let cost = 0;
    for (const [productId, copies] of nightQty) {
      const product = PRODUCTS[productId];
      if (!product || copies <= 0) continue;
      qty += copies;
      cost += copies * product.orderCost;
    }
    return { qty, cost };
  }

  function nightRowHtml(product) {
    const copies = nightQtyOf(product.id);
    const warehouse = state.warehouseInventory[product.id] ?? 0;
    const soldToday = state.stats?.productSales?.[product.id] ?? 0;
    const canAdd = nightTotals().cost + product.orderCost <= state.coins;
    return `
      <div class="nr-row" data-product="${product.id}">
        <span class="nr-name"><i class="nr-dot" style="background:${product.color}"></i>${product.name}</span>
        <span class="nr-price">¥${(product.orderCost / 10).toFixed(2)}</span>
        <span class="nr-stock">${warehouse}</span>
        <span class="nr-sold">${soldToday}</span>
        <span class="nr-stepper">
          <button type="button" data-night-dec="${product.id}" aria-label="减少" ${copies <= 0 ? 'disabled' : ''}>−</button>
          <b>${copies}</b>
          <button type="button" data-night-inc="${product.id}" aria-label="增加" ${canAdd ? '' : 'disabled'}>+</button>
        </span>
      </div>`;
  }

  /** 分类书签：像夹在书页里的签子，点哪个筛哪个 */
  function renderNightBookmarks() {
    const nav = document.getElementById('night-bookmarks');
    if (!nav) return;
    nav.innerHTML = PRODUCT_CATEGORIES.map((cat) => `
      <button type="button" class="nr-bookmark${cat.id === nightCategory ? ' is-active' : ''}"
        data-night-category="${cat.id}">${cat.name}</button>`).join('');
  }

  let nightSig = ''; // 上次渲染的数据签名：相同则跳过重建，避免 hover 状态被重置而闪烁

  function renderNightTable() {
    if (!elements.nightSupply) return;
    const products = unlockedProducts(state)
      .filter((product) => nightCategory === 'all' || product.category === nightCategory);
    const sig = `${nightCategory}|${state.coins}|${[...nightQty].map(([id, n]) => `${id}=${n}`).join(',')}|${products
      .map((product) => `${product.id}:${state.warehouseInventory[product.id] ?? 0}:${state.stats?.productSales?.[product.id] ?? 0}`)
      .join(',')}`;
    if (sig === nightSig) return;
    nightSig = sig;
    const rows = products.map(nightRowHtml).join('');
    elements.nightSupply.innerHTML = `
      <div class="nr-row nr-head-row">
        <span class="nr-name">零食</span>
        <span class="nr-price">供货价</span>
        <span class="nr-stock">仓库库存</span>
        <span class="nr-sold">上期销量</span>
        <span class="nr-stepper">订货数量</span>
      </div>
      ${rows || '<p class="empty-panel">这个分类还没有解锁的零食。</p>'}`;
    const totals = nightTotals();
    const qtyEl = document.getElementById('night-total-qty');
    const costEl = document.getElementById('night-total-cost');
    if (qtyEl) qtyEl.textContent = String(totals.qty);
    if (costEl) costEl.textContent = formatNumber(totals.cost);
  }

  /** 开门时一次性提交所有勾选的订货（每份走一次 placeSupplyOrder） */
  function pendingNightOrders() {
    const orders = [];
    for (const [productId, copies] of nightQty) {
      for (let index = 0; index < copies; index += 1) orders.push({ productId });
    }
    return orders;
  }

  function renderSupply(now) {
    elements.supply.innerHTML = supplyRowsHtml();
    elements.orders.innerHTML = ordersHtml(now);
  }

  /** 加柜成长：展示已解锁但还没摆上柜的零食 + 空柜扩容选项 */
  function renderCabinets() {
    if (!elements.cabinets) return;
    const owned = state.cabinetCount ?? state.shelves?.length ?? 0;
    const cost = nextCabinetCost(owned);
    const candidates = unlockedProducts(state).filter((product) => !state.shelves?.includes(product.id));
    const header = `<p class="cabinet-summary">零食柜 ${owned} / ${MAX_CABINETS} · 下一柜 ${cost} 金币</p>`;
    if (owned >= MAX_CABINETS) {
      elements.cabinets.innerHTML = `${header}<p class="empty-panel">柜位已经摆满，这家店已经是整条街最壕的零食铺了。</p>`;
      return;
    }
    const emptyRow = `
      <div class="product-row">
        ${productInfo({ name: '空柜扩容', color: '#8a5a34' }, '不上新零食，纯加柜数让每样零食多占格子')}
        <div class="row-actions">
          <button class="mini-button" type="button" data-add-cabinet=""
            ${state.coins < cost ? 'disabled' : ''}>加柜</button>
        </div>
      </div>`;
    if (!candidates.length) {
      elements.cabinets.innerHTML = `${header}${emptyRow}
        <p class="empty-panel">暂时没有可上架的新零食，提升店铺等级或升级零食图鉴解锁更多。</p>`;
      return;
    }
    elements.cabinets.innerHTML = `${header}${candidates.map((product) => `
      <div class="product-row">
        ${productInfo(product, `售价 ${product.salePrice} · 进货 ${product.orderCost}`)}
        <div class="row-actions">
          <button class="mini-button" type="button" data-add-cabinet="${product.id}"
            ${state.coins < cost ? 'disabled' : ''}>加柜</button>
        </div>
      </div>`).join('')}${emptyRow}`;
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
    elements.ledger.innerHTML = state.ledger.map((entry) => {
      const amountHtml = entry.type === 'note'
        ? '<strong class="ledger-note-mark">换</strong>'
        : `<strong>${entry.amount > 0 ? '+' : ''}${entry.amount}</strong>`;
      return `
      <div class="ledger-row ${entry.type}">
        <span>${entry.label}${entry.timeLabel ? `<small>${entry.timeLabel}</small>` : ''}</span>
        ${amountHtml}
      </div>`;
    }).join('');
  }

  /** 每行一张卡：选种类 + 该行库存 + 补货按钮，摆放与补货一体。
   *  行卡带数据签名：数据没变化就不重建 innerHTML，否则 250ms 定时刷新会
   *  把用户打开中的下拉框销毁（表现为"闪一下就消失"）。 */
  let shelfSig = '';
  function renderShelf(selectedShelf) {
    if (!selectedShelf) {
      elements.shelfPanel.classList.add('is-hidden');
      selectedShelfSlot = null;
      shelfSig = '';
      elements.shelfProduct.textContent = '选择货架';
      elements.shelfState.textContent = '等待选择';
      elements.shelfExtra.innerHTML = '';
      return;
    }
    elements.shelfPanel.classList.remove('is-hidden');
    selectedShelfSlot = selectedShelf.slot ?? null;
    const rows = shopPlanogram(state).rows[selectedShelf.slot] ?? [];
    const kinds = [...new Set(rows.filter(Boolean))];
    // 状态胶囊：取整柜最差的一行
    const stateOrder = { empty: 0, low: 1, half: 2, full: 3 };
    const stateLabel = { empty: '已空', low: '偏少', half: '半满', full: '充足' };
    const worst = kinds.length
      ? kinds.map((productId) => shelfDisplayState(state.shelfInventory[productId] ?? 0, productCapacity(state, productId)))
        .sort((a, b) => stateOrder[a] - stateOrder[b])[0]
      : 'empty';
    elements.shelfProduct.textContent = `零食柜 · ${kinds.length} 种零食`;
    elements.shelfState.textContent = stateLabel[worst];

    const unlocked = unlockedProducts(state);
    // 结构签名只含"哪些行摆了什么"，不含库存数字——顾客买东西会让库存不停变，
    // 若因此重建 DOM 依旧会关掉用户打开中的下拉框。库存/置灰走下面的定点更新。
    const sig = [selectedShelf.slot, rows.join(','), unlocked.length].join('#');
    if (sig !== shelfSig) {
      shelfSig = sig;
      elements.shelfExtra.innerHTML = Array.from({ length: GROUPS_PER_CABINET }, (_, rowIndex) => {
        const productId = rows[rowIndex] ?? '';
        const item = productId ? PRODUCTS[productId] : null;
        const options = unlocked.map((product) => `
          <option value="${product.id}" ${product.id === productId ? 'selected' : ''}>${product.name}</option>`).join('');
        if (!item) {
          return `
        <div class="shelf-row-card is-empty">
          <div class="shelf-row-top">
            <i class="product-swatch" style="background:#e8dcc2" aria-hidden="true"></i>
            <select class="row-select" data-row-index="${rowIndex}" aria-label="第 ${rowIndex + 1} 行摆放的零食">${options}</select>
          </div>
          <p class="empty-panel">选一种零食摆上这一行。</p>
        </div>`;
        }
        const item0 = item;
        return `
        <div class="shelf-row-card">
          <div class="shelf-row-top">
            <i class="product-swatch" style="background:${item0.color}" aria-hidden="true"></i>
            <select class="row-select" data-row-index="${rowIndex}" aria-label="第 ${rowIndex + 1} 行摆放的零食">${options}</select>
          </div>
          <div class="shelf-row-foot">
            <small></small>
            <div class="row-actions">
              <button class="mini-button" type="button" data-restock-product="${productId}" data-restock-qty="1">+1</button>
              <button class="mini-button" type="button" data-restock-product="${productId}" data-restock-qty="5">+5</button>
              <button class="mini-button" type="button" data-restock-product="${productId}" data-restock-qty="full">补满</button>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    // 定点刷新库存文案与按钮置灰，不重建 DOM（保住打开中的下拉框）
    const cards = elements.shelfExtra.querySelectorAll('.shelf-row-card');
    Array.from({ length: GROUPS_PER_CABINET }, (_, rowIndex) => {
      const productId = rows[rowIndex] ?? '';
      const card = cards[rowIndex];
      if (!card || !productId) return;
      const qty = state.shelfInventory[productId] ?? 0;
      const cap = productCapacity(state, productId);
      const reserved = state.reservedInventory[productId] ?? 0;
      const warehouse = state.warehouseInventory[productId] ?? 0;
      const small = card.querySelector('.shelf-row-foot small');
      if (small) small.textContent = `货架 ${qty}/${cap} · 仓库 ${warehouse}`;
      const disabled = warehouse <= 0 || qty + reserved >= cap;
      card.querySelectorAll('.row-actions .mini-button').forEach((button) => { button.disabled = disabled; });
    });
  }

  function render(now, customers, selectedShelf = null) {
    renderStats();
    renderInventory();
    renderSupply(now);
    renderCabinets();
    renderUpgrades();
    renderLedger();
    renderShelf(selectedShelf);
    if (elements.widgetSeason) {
      elements.widgetSeason.textContent = state.season?.name ?? '春';
    }
    if (elements.nightOverlay && !elements.nightOverlay.classList.contains('is-hidden')) {
      // 定时刷新只更新表格数值（renderNightTable 内部有数据签名去重，避免重建 DOM 造成 hover 闪烁）；
      // 书签只在打开过场和点击时渲染一次
      renderNightTable();
      elements.nightOrders.innerHTML = ordersHtml(now);
    }
    if (elements.dayTimer) {
      const day = state.day ?? { number: 1, elapsedMs: 0, revenue: 0 };
      const remaining = Math.max(0, DAY_LENGTH_MS - day.elapsedMs);
      const goal = dailyGoalFor(state.level);
      elements.dayTimer.textContent =
        `${state.season?.name ?? '春'} · 第 ${day.number} 天 · ${gameClock(state).clock} · 打烊 ${formatDuration(remaining)} · 今日 ${formatNumber(day.revenue)}/${formatNumber(goal)}（房租 ${formatNumber(rentForLevel(state.level))}）`;
      // 手机主屏"今日经营概览"小组件
      if (elements.widgetRevenue) {
        elements.widgetRevenue.textContent = formatNumber(day.revenue);
        elements.widgetGoal.textContent = ` / ${formatNumber(goal)}`;
        elements.widgetBar.style.width = `${Math.min(100, Math.round((day.revenue / Math.max(1, goal)) * 100))}%`;
        elements.widgetCoins.textContent = formatNumber(state.coins ?? 0);
        elements.widgetReputation.textContent = formatNumber(state.reputation ?? 0);
      }
    }
    if (phoneClock) {
      // 手机时钟显示游戏内部时间（营业日 09:00~21:00），与玩家系统时间无关
      const clock = gameClock(state);
      phoneClock.textContent = clock.clock;
    }
  }

  /** 凌晨订货过场：展示打烊小结（小票式账单），玩家下完单点"开门营业" */
  function showNightBreak(preview) {
    if (!elements.nightOverlay) return;
    // 过场是 fixed 全屏夜幕：挂到 body 下，避免被带 transform/filter 的祖先劫持包含块
    if (elements.nightOverlay.parentElement !== document.body) {
      document.body.appendChild(elements.nightOverlay);
    }
    const shortfall = Math.max(0, preview.rent - preview.coins);
    const reached = preview.dayRevenue >= preview.goal;
    const setText = (id, text) => {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    };
    setText('night-day', String(preview.dayNumber));
    setText('night-revenue', formatNumber(preview.dayRevenue));
    setText('night-goal', formatNumber(preview.goal));
    setText('night-rent', formatNumber(preview.rent));
    setText('night-coins', formatNumber(preview.coins));
    const ratio = Math.max(0, Math.min(100, Math.round((preview.dayRevenue / Math.max(1, preview.goal)) * 100)));
    setText('night-goal-text', `${ratio}%`);
    const fill = document.getElementById('night-goal-fill');
    if (fill) fill.style.width = `${ratio}%`;
    if (shortfall > 0) {
      elements.nightSummary.className = 'night-note warn';
      elements.nightSummary.textContent = `金币不够交今晚的房租（还差 ${formatNumber(shortfall)}），明天的生意要加油！`;
    } else if (reached) {
      elements.nightSummary.className = 'night-note ok';
      elements.nightSummary.textContent = '今日营业目标达成！明天结算时口碑 +5。';
    } else {
      elements.nightSummary.className = 'night-note';
      elements.nightSummary.textContent = `房租已备好，离今日目标还差 ${formatNumber(preview.goal - preview.dayRevenue)}，明天继续。`;
    }
    nightQty.clear();
    nightCategory = 'all';
    nightSig = '';
    renderNightBookmarks();
    renderNightTable();
    elements.nightOrders.innerHTML = ordersHtml(Date.now());
    elements.nightOverlay.classList.remove('is-hidden');
  }

  function hideNightBreak() {
    elements.nightOverlay?.classList.add('is-hidden');
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

  // 店长手机：右下角图标开合；屏幕内 App 图标 / 返回键切换页面
  phoneButton?.addEventListener('click', () => setPhoneOpen(phoneShell.classList.contains('is-hidden')));
  document.getElementById('phone-close')?.addEventListener('click', () => {
    setPhoneOpen(false);
    phoneButton?.focus();
  });
  // 手机分类条：点哪个筛哪个（仓库/货架与配送中心共用选中态），已勾选状态天然保留
  document.querySelectorAll('[data-phone-cats]').forEach((nav) => {
    nav.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-phone-cat]');
      if (!chip) return;
      phoneCategory = chip.dataset.phoneCat;
      renderPhoneCats();
      renderInventory();
      renderSupply(Date.now());
    });
  });
  renderPhoneCats();
  phoneShell?.addEventListener('click', (event) => {
    const app = event.target.closest('[data-panel]');
    if (app) { setOpenPanel(app.dataset.panel); return; }
    if (event.target.closest('[data-back]')) setOpenPanel(null);
  });
  elements.supply.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-product]');
    if (button) handlers.onSupply(button.dataset.orderProduct);
  });
  // 升级按钮在 #upgrade-list，加柜按钮在 #cabinet-list：两个容器共用同一套代理
  const upgradeActionHandler = (event) => {
    const button = event.target.closest('[data-upgrade]');
    if (button) handlers.onUpgrade(button.dataset.upgrade);
    const cabinetButton = event.target.closest('[data-add-cabinet]');
    if (cabinetButton) handlers.onAddCabinet(cabinetButton.dataset.addCabinet);
  };
  elements.upgrades.addEventListener('click', upgradeActionHandler);
  elements.cabinets?.addEventListener('click', upgradeActionHandler);
  elements.shelfExtra.addEventListener('click', (event) => {
    const button = event.target.closest('[data-restock-product]');
    if (!button) return;
    const quantity = button.dataset.restockQty === 'full'
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor(Number(button.dataset.restockQty) || 1));
    handlers.onRestock(quantity, button.dataset.restockProduct);
  });
  // 货架每行的零食更换：下拉框选完即换
    elements.shelfExtra.addEventListener('change', (event) => {
      const select = event.target.closest('[data-row-index]');
      if (!select || selectedShelfSlot === null) return;
      handlers.onSwapShelfRow(selectedShelfSlot, select.dataset.rowIndex, select.value);
    });
  document.getElementById('help-button').addEventListener('click', () => document.getElementById('help-dialog').showModal());
  document.getElementById('open-reset').addEventListener('click', () => document.getElementById('reset-game-dialog').showModal());
  document.getElementById('confirm-reset').addEventListener('click', () => handlers.onReset());
  document.getElementById('retry-assets').addEventListener('click', () => handlers.onRetryAssets());
  elements.nightOverlay?.addEventListener('click', (event) => {
    // 分类书签：切换筛选并重绘表格（已勾的份数保留）
    const bookmark = event.target.closest('[data-night-category]');
    if (bookmark) {
      nightCategory = bookmark.dataset.nightCategory;
      renderNightBookmarks();
      renderNightTable();
      return;
    }
    // 表格步进器：+/- 调整份数（1 份 = 一次下单），受金币上限约束
    const inc = event.target.closest('[data-night-inc]');
    const dec = event.target.closest('[data-night-dec]');
    if (inc || dec) {
      const productId = (inc ?? dec).dataset.nightInc ?? (dec ?? inc).dataset.nightDec;
      const product = PRODUCTS[productId];
      if (!product) return;
      const next = nightQtyOf(productId) + (inc ? 1 : -1);
      nightQty.set(productId, Math.max(0, next));
      renderNightTable();
      return;
    }
    if (event.target.closest('#night-clear')) {
      nightQty.clear();
      renderNightTable();
      return;
    }
    // 夜幕面板内残留的下单按钮走手机同款代理
    const button = event.target.closest('[data-order-product]');
    if (button) handlers.onSupply(button.dataset.orderProduct);
  });
  document.getElementById('open-new-day')?.addEventListener('click', () => handlers.onOpenNewDay(pendingNightOrders()));

  return {
    render,
    showToast,
    markSaved,
    positionPopovers,
    showNightBreak,
    hideNightBreak,
    // 点画布空白处：手机收起并回主屏，画面回归纯场景
    closePanels: () => { setPhoneOpen(false); setOpenPanel(null); }
  };
}
