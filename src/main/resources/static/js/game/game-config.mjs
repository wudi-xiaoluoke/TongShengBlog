export const GAME_VERSION = 2;
export const STORAGE_KEY = 'tongsheng.snackShop.save.v1';
export const BACKUP_KEY = 'tongsheng.snackShop.backup';
export const CANVAS_WIDTH = 768;
export const CANVAS_HEIGHT = 512;

// === 经营深度：耐心 / 小费 / 每日房租 / VIP ===
export const DAY_LENGTH_MS = 180_000;            // 一个营业日 = 3 分钟
export const GAME_DAY_START_HOUR = 9;            // 游戏内营业日从 09:00 开始
export const GAME_DAY_END_HOUR = 21;             // 打烊时间 21:00（一天 12 个游戏小时）
export const RENT_BASE = 50;                     // 房租基数
export const RENT_PER_LEVEL = 35;                // 每级店铺追加房租
export const DAILY_GOAL_RENT_MULTIPLIER = 2;     // 日营业额达到房租 ×2 → 口碑 +5
export const DAILY_GOAL_REPUTATION = 5;
export const RENT_SHORTFALL_REPUTATION = -8;     // 交不起房租的口碑惩罚
export const PATIENCE_BASE_MS = 50_000;          // 顾客基础耐心（等待状态消耗）
export const VIP_PATIENCE_FACTOR = 0.7;          // VIP 更没耐心
export const VIP_REPUTATION_THRESHOLD = 12;      // 口碑达到后才出现 VIP
export const VIP_CHANCE = 0.12;                  // VIP 出现概率
export const VIP_PAY_MULTIPLIER = 1.5;           // VIP 付款倍率
export const TIP_PATIENCE_RATIO = 0.45;          // 等待耗时占比低于此值 → 给小费
export const TIP_RATE = 0.12;                    // 小费比例

export function rentForLevel(level = 1) {
  return RENT_BASE + Math.max(1, level) * RENT_PER_LEVEL;
}

export function dailyGoalFor(level = 1) {
  return rentForLevel(level) * DAILY_GOAL_RENT_MULTIPLIER;
}

export const PRODUCTS = Object.freeze({
  candy: {
    id: 'candy', category: 'sweet', name: '草莓糖', orderQuantity: 10, orderCost: 20, salePrice: 36,
    deliveryMs: 30_000, unlockLevel: 1, color: '#e76167'
  },
  chips: {
    id: 'chips', category: 'puffed', name: '原味薯片', orderQuantity: 10, orderCost: 30, salePrice: 50,
    deliveryMs: 45_000, unlockLevel: 1, color: '#e4ad45'
  },
  seaweed: {
    id: 'seaweed', category: 'puffed', name: '脆脆海苔', orderQuantity: 10, orderCost: 38, salePrice: 62,
    deliveryMs: 60_000, unlockLevel: 2, color: '#68a978'
  },
  soda: {
    id: 'soda', category: 'drink', name: '橘子汽水', orderQuantity: 10, orderCost: 45, salePrice: 72,
    deliveryMs: 75_000, unlockLevel: 2, color: '#e9854f'
  },
  cookies: {
    id: 'cookies', category: 'bake', name: '黄油饼干', orderQuantity: 10, orderCost: 55, salePrice: 88,
    deliveryMs: 90_000, unlockLevel: 3, color: '#c68e52'
  },
  jelly: {
    id: 'jelly', category: 'drink', name: '水果果冻', orderQuantity: 10, orderCost: 68, salePrice: 105,
    deliveryMs: 120_000, unlockLevel: 4, color: '#8a79bb'
  },
  peanut: {
    id: 'peanut', category: 'bake', name: '香脆花生', orderQuantity: 10, orderCost: 42, salePrice: 68,
    deliveryMs: 70_000, unlockLevel: 3, color: '#b5651d'
  },
  marshmallow: {
    id: 'marshmallow', category: 'sweet', name: '云朵棉花糖', orderQuantity: 10, orderCost: 40, salePrice: 66,
    deliveryMs: 75_000, unlockLevel: 3, color: '#f3a6c1'
  },
  latiao: {
    id: 'latiao', category: 'puffed', name: '劲爆辣条', orderQuantity: 10, orderCost: 50, salePrice: 80,
    deliveryMs: 90_000, unlockLevel: 4, color: '#c0392b'
  },
  chocolate: {
    id: 'chocolate', category: 'sweet', name: '黑巧克力', orderQuantity: 10, orderCost: 75, salePrice: 118,
    deliveryMs: 105_000, unlockLevel: 5, color: '#6b4226'
  }
});

// 零食分类（深夜订货页的书签筛选）
export const PRODUCT_CATEGORIES = Object.freeze([
  { id: 'all', name: '全部' },
  { id: 'sweet', name: '糖果' },
  { id: 'puffed', name: '膨化' },
  { id: 'bake', name: '烘焙坚果' },
  { id: 'drink', name: '饮品果冻' }
]);

// === 零食柜成长：花钱加柜扩容，柜内格子按零食种类轮转分配 ===
export const CABINET_BASE_COST = 180;       // 第一个新柜的价格
export const CABINET_COST_GROWTH = 1.6;     // 之后每柜价格倍率
export const INITIAL_CABINET_COUNT = 6;     // 开局自带柜数
export const MAX_CABINETS = 10;             // 店内柜位上限（两排 × 5）
export const SLOTS_PER_CABINET = 12;        // 每柜 12 格（4 列 × 3 行）
export const GROUPS_PER_CABINET = 4;        // 每柜 4 行，一行放一种零食
export const SLOTS_PER_GROUP = 3;           // 一种零食占一行 3 格 → 一柜最多 4 种
export const DEFAULT_SHELF_PRODUCT_IDS = Object.freeze([
  'candy', 'chips', 'seaweed', 'soda', 'cookies', 'jelly'
]);

export function nextCabinetCost(ownedCount = INITIAL_CABINET_COUNT) {
  const extra = Math.max(0, ownedCount - INITIAL_CABINET_COUNT);
  return Math.round(CABINET_BASE_COST * Math.pow(CABINET_COST_GROWTH, extra));
}

/** 每格能放几件零食（扩容货架升级：每级每格多放 1 件） */
export function unitsPerSlot(state) {
  return 1 + (state?.upgrades?.shelf ?? 0);
}

/**
 * 柜内排面：第 c 号柜第 r 行放 stockedIds[(c*4+r) % stockedIds.length]。
 * 种类多（≥4 的整数倍关系）时一柜最多 4 种；种类少时同种零食轮转复用空行，
 * 占的行越多容量越大——"没有那么多口味，就把多出来的货堆到别的格子里"。
 */
export function planogramRows(cabinetCount, stockedIds) {
  const list = stockedIds.length ? stockedIds : [...DEFAULT_SHELF_PRODUCT_IDS];
  const rows = [];
  for (let cabinet = 0; cabinet < cabinetCount; cabinet += 1) {
    const row = [];
    for (let group = 0; group < GROUPS_PER_CABINET; group += 1) {
      row.push(list[(cabinet * GROUPS_PER_CABINET + group) % list.length]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 排面分配结果：每种零食占多少行（决定容量）+ 主货柜（顾客去哪买）。
 * 主货柜贪心分配：优先挑"已分摊零食最少"的柜，让顾客动线尽量分散。
 * rowsOverride：玩家自定义排面（柜数×4 的二维数组，元素为 productId 或 null=空行），
 * 给定时忽略自动轮转，直接用玩家的摆放。
 */
export function planogramAssignment(cabinetCount, stockedIds, rowsOverride = null) {
  let rows;
  if (Array.isArray(rowsOverride) && rowsOverride.length >= cabinetCount) {
    rows = rowsOverride.slice(0, cabinetCount).map((row) => (Array.isArray(row) ? [...row] : []));
  } else {
    rows = planogramRows(cabinetCount, stockedIds);
  }
  const groupCounts = new Map();
  const cabinetsWith = new Map();
  rows.forEach((row, cabinetIndex) => {
    for (const productId of row) {
      if (!productId || !PRODUCTS[productId]) continue;
      groupCounts.set(productId, (groupCounts.get(productId) ?? 0) + 1);
      if (!cabinetsWith.has(productId)) cabinetsWith.set(productId, []);
      if (!cabinetsWith.get(productId).includes(cabinetIndex)) cabinetsWith.get(productId).push(cabinetIndex);
    }
  });
  const cabinetLoad = new Map();
  const primaryCabinet = new Map();
  for (const [productId] of groupCounts) {
    const candidates = cabinetsWith.get(productId) ?? [];
    let best = candidates[0] ?? 0;
    for (const candidate of candidates) {
      if ((cabinetLoad.get(candidate) ?? 0) < (cabinetLoad.get(best) ?? 0)) best = candidate;
    }
    cabinetLoad.set(best, (cabinetLoad.get(best) ?? 0) + 1);
    primaryCabinet.set(productId, best);
  }
  return { rows, groupCounts, primaryCabinet };
}

/** 汇总存档的柜数 + 已上架零食 + 玩家自定义排面 → 排面 */
export function shopPlanogram(state) {
  const stocked = (Array.isArray(state?.shelves) ? state.shelves : [...DEFAULT_SHELF_PRODUCT_IDS])
    .filter((id) => PRODUCTS[id]);
  const cabinetCount = Math.max(1, Math.min(MAX_CABINETS, state?.cabinetCount ?? stocked.length));
  let override = Array.isArray(state?.shelfPlan) ? state.shelfPlan : null;
  if (override && override.length < cabinetCount) {
    // 加柜后旧排面不够长：新柜位用自动轮转补齐
    const auto = planogramRows(cabinetCount, stocked);
    override = [...override, ...auto.slice(override.length)];
  }
  return planogramAssignment(cabinetCount, stocked, override);
}

/** 单品容量 = 占的行数 × 每行 3 格 × 每格件数 */
export function productCapacity(state, productId) {
  const groups = shopPlanogram(state).groupCounts.get(productId) ?? 0;
  return groups * SLOTS_PER_GROUP * unitsPerSlot(state);
}

/** 全店格子总数 */
export function totalSlotCount(state) {
  const cabinetCount = Math.max(1, Math.min(MAX_CABINETS, state?.cabinetCount ?? 0));
  return cabinetCount * SLOTS_PER_CABINET;
}

/**
 * 游戏内部时间：营业日 3 分钟实时 = 游戏内 09:00~21:00 的 12 个小时。
 * 所有 UI（手机时钟、账本时间）都从这里取，不读用户系统时间。
 */
export function gameClock(state) {
  const day = state?.day ?? { number: 1, elapsedMs: 0 };
  const ratio = Math.max(0, Math.min(1, (day.elapsedMs ?? 0) / DAY_LENGTH_MS));
  const totalMinutes = Math.round(
    (GAME_DAY_START_HOUR * 60) + ratio * (GAME_DAY_END_HOUR - GAME_DAY_START_HOUR) * 60
  );
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return {
    dayNumber: day.number ?? 1,
    hour,
    minute,
    clock: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  };
}

// === 时段系统：营业日按游戏时钟切成 5 个时段，凌晨只作打烊后的订货过场 ===
// intervalFactor：顾客生成间隔倍率（>1 更稀疏）；crowdFactor：同店顾客上限倍率
// weights：各客群变体（student/neighbor/worker）的出现权重
export const DAY_PHASES = Object.freeze([
  { id: 'morning', name: '早晨', startHour: 9, endHour: 11, intervalFactor: 1.25, crowdFactor: 0.8, weights: { neighbor: 0.7, student: 0.1, worker: 0.2 } },
  { id: 'noon', name: '中午', startHour: 11, endHour: 14, intervalFactor: 0.6, crowdFactor: 1.2, weights: { neighbor: 0.2, student: 0.15, worker: 0.65 } },
  { id: 'afternoon', name: '下午', startHour: 14, endHour: 17, intervalFactor: 0.8, crowdFactor: 1.1, weights: { neighbor: 0.2, student: 0.65, worker: 0.15 } },
  { id: 'dusk', name: '傍晚', startHour: 17, endHour: 19, intervalFactor: 1.3, crowdFactor: 0.7, weights: { neighbor: 0.5, student: 0.25, worker: 0.25 } },
  { id: 'night', name: '晚上', startHour: 19, endHour: 21, intervalFactor: 0.9, crowdFactor: 1.0, weights: { neighbor: 0.3, student: 0.3, worker: 0.4 } }
]);
export const DAWN_PHASE = Object.freeze({ id: 'dawn', name: '凌晨' });

/** 游戏小时 → 所处时段（营业时钟 09:00~21:00 之外归入凌晨/兜底） */
export function dayPhaseFor(hour) {
  const h = ((Number(hour) || 0) % 24 + 24) % 24;
  const phase = DAY_PHASES.find((item) => h >= item.startHour && h < item.endHour);
  if (phase) return phase;
  if (h >= GAME_DAY_END_HOUR || h < GAME_DAY_START_HOUR) return DAWN_PHASE;
  return DAY_PHASES[0];
}

// === 季节系统：跟真实日期走（3-5 月春 / 6-8 月夏 / 9-11 月秋 / 12-2 月冬） ===
// trafficMultiplier：整体客流倍率；tint：全场景氛围色；particles：季节天气粒子
export const SEASONS = Object.freeze([
  {
    id: 'spring', name: '春', months: [3, 4, 5], trafficMultiplier: 1.0, particle: 'petal',
    plantLeaves: '#ef9ab4', plantLeaves2: '#f6bccd', tint: 'rgba(255, 190, 214, 0.05)'
  },
  {
    id: 'summer', name: '夏', months: [6, 7, 8], trafficMultiplier: 1.15, particle: 'sun',
    plantLeaves: '#3f7a3a', plantLeaves2: '#5f9a4e', tint: 'rgba(255, 236, 150, 0.05)'
  },
  {
    id: 'autumn', name: '秋', months: [9, 10, 11], trafficMultiplier: 0.95, particle: 'leaf',
    plantLeaves: '#d98a32', plantLeaves2: '#c9682a', tint: 'rgba(255, 170, 90, 0.05)'
  },
  {
    id: 'winter', name: '冬', months: [12, 1, 2], trafficMultiplier: 0.85, particle: 'snow',
    plantLeaves: '#9fb4bd', plantLeaves2: '#cfd8dc', tint: 'rgba(200, 220, 255, 0.07)'
  }
]);

const SEASON_BY_ID = new Map(SEASONS.map((season) => [season.id, season]));

/** 真实日期 → 季节配置（月份决定，跨年也只看月） */
export function seasonForDate(date = new Date()) {
  const month = ((date instanceof Date ? date.getMonth() : new Date().getMonth()) + 1);
  return SEASONS.find((season) => season.months.includes(month)) ?? SEASONS[0];
}

export function seasonById(id) {
  return SEASON_BY_ID.get(id) ?? null;
}

// === 客流公式：间隔与同店上限随时段/季节变化（纯函数，便于测试与复用） ===
/** 顾客生成间隔 = 招牌升级压缩后的基础间隔 × 时段倍率 ÷ 季节倍率，下限 2.5s */
export function spawnIntervalMs(baseIntervalMs, phase, season) {
  const phaseFactor = phase?.intervalFactor ?? 1;
  const seasonFactor = season?.trafficMultiplier ?? 1;
  return Math.max(2_500, Math.round(baseIntervalMs * phaseFactor / seasonFactor));
}

/** 同店顾客上限 = 招牌升级决定的上限 × 时段拥挤系数，至少保留 2 人 */
export function maxCustomersFor(upgradeTraffic, phase) {
  const base = Math.min(5, 2 + Math.max(0, upgradeTraffic ?? 0));
  return Math.max(2, Math.round(base * (phase?.crowdFactor ?? 1)));
}

export const UPGRADES = Object.freeze({
  shelf: { id: 'shelf', name: '扩容货架', baseCost: 250, description: '每级让单品容量 +10' },
  delivery: { id: 'delivery', name: '配送小车', baseCost: 300, description: '每级缩短 12% 配送时间' },
  traffic: { id: 'traffic', name: '街边招牌', baseCost: 300, description: '顾客来店更频繁' },
  catalog: { id: 'catalog', name: '零食图鉴', baseCost: 450, description: '更早解锁新品' },
  checkout: { id: 'checkout', name: '自动收银', baseCost: 350, description: '自动服务部分顾客' }
});

export const CUSTOMER_VARIANTS = Object.freeze([
  { id: 'student', name: '放学学生', color: '#5d83b5' },
  { id: 'neighbor', name: '街坊邻居', color: '#b7676c' },
  { id: 'worker', name: '下班职员', color: '#6f8f65' }
]);

export const CUSTOMER_ROUTES = Object.freeze({
  street: [{ x: 730, y: 470 }, { x: 610, y: 470 }],
  entering: [{ x: 610, y: 410 }, { x: 610, y: 350 }],
  checkout: [{ x: 565, y: 305 }, { x: 565, y: 245 }],
  leaving: [{ x: 610, y: 350 }, { x: 610, y: 430 }, { x: 760, y: 470 }]
});

export function upgradeCost(id, currentLevel) {
  const upgrade = UPGRADES[id];
  if (!upgrade) return Number.POSITIVE_INFINITY;
  return Math.round(upgrade.baseCost * Math.pow(1.65, currentLevel));
}

export function unlockedProducts(state) {
  const bonus = state.upgrades?.catalog ?? 0;
  return Object.values(PRODUCTS).filter((product) => product.unlockLevel <= state.level + bonus);
}
