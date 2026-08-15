export const GAME_VERSION = 2;
export const STORAGE_KEY = 'tongsheng.snackShop.save.v1';
export const BACKUP_KEY = 'tongsheng.snackShop.backup';
export const CANVAS_WIDTH = 768;
export const CANVAS_HEIGHT = 512;

export const PRODUCTS = Object.freeze({
  candy: {
    id: 'candy', name: '草莓糖', orderQuantity: 10, orderCost: 20, salePrice: 36,
    deliveryMs: 30_000, unlockLevel: 1, shelf: { x: 155, y: 180 }, color: '#e76167'
  },
  chips: {
    id: 'chips', name: '原味薯片', orderQuantity: 10, orderCost: 30, salePrice: 50,
    deliveryMs: 45_000, unlockLevel: 1, shelf: { x: 275, y: 180 }, color: '#e4ad45'
  },
  seaweed: {
    id: 'seaweed', name: '脆脆海苔', orderQuantity: 10, orderCost: 38, salePrice: 62,
    deliveryMs: 60_000, unlockLevel: 2, shelf: { x: 395, y: 180 }, color: '#68a978'
  },
  soda: {
    id: 'soda', name: '橘子汽水', orderQuantity: 10, orderCost: 45, salePrice: 72,
    deliveryMs: 75_000, unlockLevel: 2, shelf: { x: 155, y: 295 }, color: '#e9854f'
  },
  cookies: {
    id: 'cookies', name: '黄油饼干', orderQuantity: 10, orderCost: 55, salePrice: 88,
    deliveryMs: 90_000, unlockLevel: 3, shelf: { x: 275, y: 295 }, color: '#c68e52'
  },
  jelly: {
    id: 'jelly', name: '水果果冻', orderQuantity: 10, orderCost: 68, salePrice: 105,
    deliveryMs: 120_000, unlockLevel: 4, shelf: { x: 395, y: 295 }, color: '#8a79bb'
  }
});

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

export function productCapacity(state) {
  return 20 + (state.upgrades?.shelf ?? 0) * 10;
}

export function unlockedProducts(state) {
  const bonus = state.upgrades?.catalog ?? 0;
  return Object.values(PRODUCTS).filter((product) => product.unlockLevel <= state.level + bonus);
}
