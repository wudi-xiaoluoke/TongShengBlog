import {
  PATIENCE_BASE_MS,
  PRODUCTS,
  TIP_PATIENCE_RATIO,
  TIP_RATE,
  VIP_PATIENCE_FACTOR,
  VIP_PAY_MULTIPLIER
} from './game-config.mjs';
import {
  commitReservedSale,
  releaseReservedItems,
  reserveShelfOrder
} from './game-state.mjs';
import {
  ENTRANCE_ROUTE,
  EXIT_ROUTE,
  DEFAULT_SHELF_PRODUCT_IDS,
  QUEUE_HOLD_POINTS,
  QUEUE_POINTS,
  SHELF_HOLD_POINTS,
  SHOP_HUB,
  buildWorld
} from './game-world.mjs';

const CUSTOMER_SPEED = 92;
const PICK_DURATION_MS = 450;
const CHECKOUT_DURATION_MS = 2_200;
const OUT_OF_STOCK_DURATION_MS = 650;

function clonePoints(points) {
  return points.map((point) => ({ ...point }));
}

function setRoute(customer, phase, points) {
  customer.phase = phase;
  customer.phaseMs = 0;
  customer.route = clonePoints(points);
  customer.waypointIndex = 0;
}

const HUB = SHOP_HUB;
const RIGHT_AISLE_X = 595;

function nearPoint(customer, point, tolerance = 3) {
  return Math.hypot(customer.x - point.x, customer.y - point.y) < tolerance;
}

function safePathToHub(customer) {
  if (nearPoint(customer, HUB)) return [];
  if (customer.x < 600 && customer.y < 260) {
    return [
      { x: customer.x, y: 205 },
      { x: RIGHT_AISLE_X, y: 205 },
      { x: RIGHT_AISLE_X, y: 330 },
      HUB
    ];
  }
  if (customer.x < 600) {
    // 中岛柜加高后（碰撞到 y+335），过道压到 345 保证不穿柜
    return [
      { x: customer.x, y: 345 },
      { x: RIGHT_AISLE_X, y: 345 },
      HUB
    ];
  }
  return [HUB];
}

function safePathToShelf(customer, productId) {
  return [...safePathToHub(customer), ...activeWorld.routeForProduct(productId).slice(1)];
}

function safePathToWaitingPoint(customer, shelf, target) {
  const toHub = safePathToHub(customer);
  if (target.x === shelf.waitingPoint.x && target.y === shelf.waitingPoint.y) {
    const aisleY = shelf.y < 200 ? 205 : shelf.y + shelf.height + 6;
    return [...toHub, { x: RIGHT_AISLE_X, y: aisleY }, target];
  }
  return [...toHub, target];
}

function exitPath(customer) {
  return [...safePathToHub(customer), ...EXIT_ROUTE.slice(1)];
}

function updateRouteDestination(customer, phase, target) {
  customer.phase = phase;
  customer.phaseMs = 0;
  if (customer.waypointIndex < customer.route.length) {
    customer.route[customer.route.length - 1] = { ...target };
  } else {
    setRoute(customer, phase, [target]);
  }
}

export function createCustomer({ id, variant = 0, request, vip = false } = {}) {
  const normalizedRequest = request?.length
    ? request.map((item) => ({ productId: item.productId, quantity: Math.max(1, item.quantity ?? 1) }))
    : [{ productId: 'candy', quantity: 1 }];
  const first = ENTRANCE_ROUTE[0];
  return {
    id: id ?? `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    variant,
    vip,
    productId: normalizedRequest[0].productId,
    request: normalizedRequest,
    phase: 'street',
    x: first.x,
    y: first.y,
    route: clonePoints(ENTRANCE_ROUTE.slice(1, 2)),
    waypointIndex: 0,
    direction: 'west',
    frame: 0,
    animationMs: 0,
    phaseMs: 0,
    // 耐心：只在等待（等货架/排队）时消耗；VIP 更急躁
    patienceMs: 0,
    maxPatienceMs: Math.round(PATIENCE_BASE_MS * (vip ? VIP_PATIENCE_FACTOR : 1)),
    angry: false,
    shoppingIndex: 0,
    reservedItems: [],
    missingProductId: null,
    shelfId: null,
    selected: false,
    paid: false
  };
}

function moveTowardWaypoint(customer, deltaMs) {
  const target = customer.route[customer.waypointIndex];
  if (!target) return true;
  const dx = target.x - customer.x;
  const dy = target.y - customer.y;
  const distance = Math.hypot(dx, dy);
  const step = CUSTOMER_SPEED * (deltaMs / 1_000);
  if (Math.abs(dx) > Math.abs(dy)) customer.direction = dx >= 0 ? 'east' : 'west';
  else customer.direction = dy >= 0 ? 'south' : 'north';
  if (distance <= step || distance === 0) {
    customer.x = target.x;
    customer.y = target.y;
    customer.waypointIndex += 1;
    return customer.waypointIndex >= customer.route.length;
  }
  customer.x += (dx / distance) * step;
  customer.y += (dy / distance) * step;
  return false;
}

export function customerHitTest(customer, x, y) {
  return x >= customer.x - 20 && x <= customer.x + 20
    && y >= customer.y - 66 && y <= customer.y + 6;
}

export function customerAtPoint(customers, x, y) {
  for (let index = customers.length - 1; index >= 0; index -= 1) {
    if (customers[index].phase !== 'done' && customerHitTest(customers[index], x, y)) {
      return customers[index];
    }
  }
  return null;
}

// 动态世界：模块级持有，加柜后通过 setWorld 热替换，所有寻路立即生效
let activeWorld = buildWorld(DEFAULT_SHELF_PRODUCT_IDS);

export function createCustomerSimulation({ state, world, onCheckout = () => {}, onOutOfStock = () => {}, onAngryLeave = () => {} }) {
  activeWorld = world ?? buildWorld(state?.shelves ?? DEFAULT_SHELF_PRODUCT_IDS);
  const customers = [];
  const queue = [];
  const pendingQueue = [];
  const shelfOccupants = new Map();
  const shelfWaiters = new Map();

  function spawn(options = {}) {
    const customer = createCustomer(options);
    customers.push(customer);
    return customer;
  }

  function beginShelfVisit(customer, productId) {
    const shelf = activeWorld.shelfByProduct(productId);
    if (!shelf) {
      // 该零食没有柜位（不应发生）：按缺货处理
      customer.missingProductId = productId;
      customer.phase = 'outOfStock';
      customer.phaseMs = 0;
      return;
    }
    const browsingPath = safePathToShelf(customer, productId);
    customer.productId = productId;
    customer.shelfId = shelf.id ?? null;
    const waiters = shelfWaiters.get(shelf.id) ?? [];
    if (shelfOccupants.has(shelf.id) || waiters.length) {
      waiters.push(customer);
      shelfWaiters.set(shelf.id, waiters);
      const target = waiters.length === 1
        ? shelf.waitingPoint
        : SHELF_HOLD_POINTS[Math.min(waiters.length - 2, SHELF_HOLD_POINTS.length - 1)];
      setRoute(customer, 'waitingShelf', safePathToWaitingPoint(customer, shelf, target));
      return;
    }
    shelfOccupants.set(shelf.id, customer.id);
    setRoute(customer, 'browsing', browsingPath);
  }

  function retargetShelfWaiters(shelfId) {
    const shelf = activeWorld.shelfById(shelfId);
    if (!shelf) {
      shelfWaiters.delete(shelfId);
      return;
    }
    const waiters = shelfWaiters.get(shelfId) ?? [];
    waiters.forEach((customer, index) => {
      const target = index === 0
        ? shelf.waitingPoint
        : SHELF_HOLD_POINTS[Math.min(index - 1, SHELF_HOLD_POINTS.length - 1)];
      const currentTarget = customer.route[customer.route.length - 1];
      if (!currentTarget || currentTarget.x !== target.x || currentTarget.y !== target.y) {
        customer.desiredWaitTarget = { ...target };
      }
    });
  }

  function releaseShelf(shelfId, customerId) {
    if (!shelfId || shelfOccupants.get(shelfId) !== customerId) return;
    shelfOccupants.delete(shelfId);
    const waiters = shelfWaiters.get(shelfId) ?? [];
    const next = waiters.shift();
    if (!waiters.length) shelfWaiters.delete(shelfId);
    else shelfWaiters.set(shelfId, waiters);
    if (next) {
      shelfOccupants.set(shelfId, next.id);
      next.promoteToShelf = true;
      if (waiters.length) retargetShelfWaiters(shelfId);
    }
  }

  function beginLeaving(customer) {
    releaseShelf(customer.shelfId, customer.id);
    customer.shelfId = null;
    setRoute(customer, 'leaving', exitPath(customer));
  }

  /** 顾客不耐烦放弃等待：离开所有队列/货架等待位，但保留正在走的离店路线 */
  function abandonWaiting(customer) {
    const queueIndex = queue.indexOf(customer);
    if (queueIndex >= 0) queue.splice(queueIndex, 1);
    const pendingIndex = pendingQueue.indexOf(customer);
    if (pendingIndex >= 0) pendingQueue.splice(pendingIndex, 1);
    for (const [shelfId, waiters] of shelfWaiters) {
      const waiterIndex = waiters.indexOf(customer);
      if (waiterIndex >= 0) {
        waiters.splice(waiterIndex, 1);
        if (!waiters.length) shelfWaiters.delete(shelfId);
        else retargetShelfWaiters(shelfId);
      }
    }
    releaseShelf(customer.shelfId, customer.id);
    customer.shelfId = null;
  }

  function refreshQueueTargets() {
    queue.forEach((customer, index) => {
      const target = QUEUE_POINTS[Math.min(index, QUEUE_POINTS.length - 1)];
      if (customer.phase === 'waitingQueue') {
        customer.queuePromotionTarget = { ...target };
        return;
      }
      if (customer.phase !== 'queueing') return;
      const currentTarget = customer.route[customer.route.length - 1];
      if (!currentTarget || currentTarget.x !== target.x || currentTarget.y !== target.y) {
        updateRouteDestination(customer, 'queueing', target);
      }
    });
  }

  function retargetPendingQueue() {
    pendingQueue.forEach((customer, index) => {
      const target = QUEUE_HOLD_POINTS[Math.min(index, QUEUE_HOLD_POINTS.length - 1)];
      updateRouteDestination(customer, 'waitingQueue', target);
    });
  }

  function promotePendingQueue() {
    while (queue.length < QUEUE_POINTS.length && pendingQueue.length) {
      const customer = pendingQueue.shift();
      queue.push(customer);
      customer.queuePromotionTarget = { ...QUEUE_POINTS[queue.length - 1] };
      if (customer.waypointIndex >= customer.route.length) {
        setRoute(customer, 'queueing', [customer.queuePromotionTarget]);
        customer.queuePromotionTarget = null;
      }
    }
    if (pendingQueue.length) retargetPendingQueue();
  }

  function joinQueue(customer) {
    const pathPrefix = safePathToHub(customer);
    if (queue.length < QUEUE_POINTS.length) {
      queue.push(customer);
      setRoute(customer, 'queueing', [...pathPrefix, QUEUE_POINTS[queue.length - 1]]);
    } else {
      pendingQueue.push(customer);
      const target = QUEUE_HOLD_POINTS[Math.min(pendingQueue.length - 1, QUEUE_HOLD_POINTS.length - 1)];
      setRoute(customer, 'waitingQueue', [...pathPrefix, target]);
    }
  }

  function finishPicking(customer) {
    releaseShelf(customer.shelfId, customer.id);
    if (customer.missingProductId) {
      customer.phase = 'outOfStock';
      customer.phaseMs = 0;
      return;
    }
    customer.shoppingIndex += 1;
    if (customer.shoppingIndex < customer.reservedItems.length) {
      beginShelfVisit(customer, customer.reservedItems[customer.shoppingIndex].productId);
    } else {
      joinQueue(customer);
      customer.shelfId = null;
    }
  }

  function completeRoute(customer) {
    if (customer.phase === 'street') {
      setRoute(customer, 'entering', ENTRANCE_ROUTE.slice(2));
      return;
    }
    if (customer.phase === 'entering') {
      const reservation = reserveShelfOrder(state, customer.request);
      if (reservation.ok) {
        customer.reservedItems = reservation.reservedItems;
        customer.shoppingIndex = 0;
        beginShelfVisit(customer, customer.reservedItems[0].productId);
      } else {
        customer.missingProductId = reservation.missingProductId;
        beginShelfVisit(customer, reservation.missingProductId);
      }
      return;
    }
    if (customer.phase === 'browsing') {
      customer.phase = 'picking';
      customer.phaseMs = 0;
      return;
    }
    if (customer.phase === 'waitingShelf') {
      if (customer.promoteToShelf) {
        customer.promoteToShelf = false;
        setRoute(customer, 'browsing', safePathToShelf(customer, customer.productId));
        return;
      }
      if (customer.desiredWaitTarget) {
        const shelf = activeWorld.shelfByProduct(customer.productId);
        const target = customer.desiredWaitTarget;
        customer.desiredWaitTarget = null;
        setRoute(customer, 'waitingShelf', safePathToWaitingPoint(customer, shelf, target));
      }
      return;
    }
    if (customer.phase === 'waitingQueue') {
      if (customer.queuePromotionTarget) {
        const target = customer.queuePromotionTarget;
        customer.queuePromotionTarget = null;
        setRoute(customer, 'queueing', [target]);
      }
      return;
    }
    if (customer.phase === 'queueing' && queue[0] === customer) {
      customer.phase = 'checkout';
      customer.phaseMs = 0;
      // 结账总时长（自动收银升级会缩短）：场景用它画头顶圆形进度条
      customer.checkoutDurationMs = Math.max(700, CHECKOUT_DURATION_MS - (state.upgrades.checkout ?? 0) * 300);
      return;
    }
    if (customer.phase === 'leaving') customer.phase = 'done';
  }

  function updateCustomer(customer, deltaMs, now) {
    if (customer.phase === 'done') return;
    customer.phaseMs += deltaMs;
    customer.animationMs += deltaMs;
    customer.frame = Math.floor(customer.animationMs / 180) % 2;

    // === 耐心系统：等货架/排队且已站定才消耗（走路不计），耗尽则生气离店 ===
    if (customer.phase === 'waitingShelf' || customer.phase === 'waitingQueue' || customer.phase === 'queueing') {
      const standingStill = customer.waypointIndex >= customer.route.length;
      if (standingStill) customer.patienceMs += deltaMs;
      if (customer.patienceMs >= customer.maxPatienceMs) {
        abandonWaiting(customer);
        releaseReservedItems(state, customer.reservedItems);
        customer.reservedItems = [];
        customer.missingProductId = null;
        customer.angry = true;
        state.reputation = Math.max(0, state.reputation - 2);
        state.stats.customersLeft += 1;
        onAngryLeave({ customer });
        beginLeaving(customer);
        return;
      }
    }

    if (customer.phase === 'picking') {
      if (customer.phaseMs >= PICK_DURATION_MS) finishPicking(customer);
      return;
    }
    if (customer.phase === 'outOfStock') {
      if (customer.phaseMs >= OUT_OF_STOCK_DURATION_MS) {
        state.reputation = Math.max(0, state.reputation - 1);
        state.stats.customersLeft += 1;
        onOutOfStock({ customer, productId: customer.missingProductId });
        beginLeaving(customer);
      }
      return;
    }
    if (customer.phase === 'waitingShelf') {
      if (moveTowardWaypoint(customer, deltaMs)) completeRoute(customer);
      return;
    }
    if (customer.phase === 'waitingQueue') {
      if (moveTowardWaypoint(customer, deltaMs)) completeRoute(customer);
      return;
    }
    if (customer.phase === 'checkout') {
      const duration = customer.checkoutDurationMs
        ?? Math.max(700, CHECKOUT_DURATION_MS - (state.upgrades.checkout ?? 0) * 300);
      if (customer.phaseMs >= duration) {
        const result = commitReservedSale(
          state,
          customer.reservedItems,
          now,
          customer.vip ? { multiplier: VIP_PAY_MULTIPLIER } : undefined
        );
        customer.reservedItems = [];
        customer.paid = result.ok;
        let tip = 0;
        // 快速服务小费：等待耗时占耐心的比例足够低才给
        if (result.ok && customer.patienceMs <= customer.maxPatienceMs * TIP_PATIENCE_RATIO) {
          tip = Math.max(1, Math.ceil(result.revenue * TIP_RATE));
          state.coins += tip;
          state.stats.totalRevenue += tip;
          if (state.day) state.day.revenue += tip;
        }
        if (queue[0] === customer) queue.shift();
        else {
          const index = queue.indexOf(customer);
          if (index >= 0) queue.splice(index, 1);
        }
        refreshQueueTargets();
        promotePendingQueue();
        onCheckout({ customer, ...result, tip });
        beginLeaving(customer);
      }
      return;
    }
    if (moveTowardWaypoint(customer, deltaMs)) completeRoute(customer);
  }

  function update(deltaMs, now = Date.now()) {
    refreshQueueTargets();
    for (const customer of customers) updateCustomer(customer, deltaMs, now);
  }

  function releaseCustomer(customerOrId) {
    const customer = typeof customerOrId === 'string'
      ? customers.find((item) => item.id === customerOrId)
      : customerOrId;
    if (!customer) return false;
    if (customer.reservedItems.length && !customer.paid) releaseReservedItems(state, customer.reservedItems);
    customer.reservedItems = [];
    const queueIndex = queue.indexOf(customer);
    if (queueIndex >= 0) queue.splice(queueIndex, 1);
    const pendingIndex = pendingQueue.indexOf(customer);
    if (pendingIndex >= 0) pendingQueue.splice(pendingIndex, 1);
    for (const [shelfId, waiters] of shelfWaiters) {
      const waiterIndex = waiters.indexOf(customer);
      if (waiterIndex >= 0) {
        waiters.splice(waiterIndex, 1);
        if (!waiters.length) shelfWaiters.delete(shelfId);
        else retargetShelfWaiters(shelfId);
      }
    }
    releaseShelf(customer.shelfId, customer.id);
    customer.phase = 'done';
    refreshQueueTargets();
    promotePendingQueue();
    return true;
  }

  return {
    customers,
    queue,
    pendingQueue,
    shelfOccupants,
    shelfWaiters,
    spawn,
    update,
    releaseCustomer,
    setWorld(nextWorld) {
      activeWorld = nextWorld;
    }
  };
}

export function requestLabel(request = []) {
  return request.map((item) => `${PRODUCTS[item.productId]?.name ?? item.productId} ×${item.quantity ?? 1}`).join('、');
}
