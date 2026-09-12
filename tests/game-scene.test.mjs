import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSceneRenderer
} from '../src/main/resources/static/js/game/game-scene.mjs';
import {
  CHECKOUT_COUNTER,
  DEFAULT_SHELF_PRODUCT_IDS,
  SHOPKEEPER_POINT,
  buildWorld
} from '../src/main/resources/static/js/game/game-world.mjs';

const DEFAULT_WORLD = buildWorld(DEFAULT_SHELF_PRODUCT_IDS);

function createMockContext() {
  const ops = [];
  const track = (name) => (...args) => ops.push({ name, args });
  return {
    ops,
    clearRect: track('clearRect'),
    drawImage: track('drawImage'),
    fillRect: track('fillRect'),
    strokeRect: track('strokeRect'),
    fillText: track('fillText'),
    beginPath: track('beginPath'),
    arc: track('arc'),
    ellipse: track('ellipse'),
    roundRect: track('roundRect'),
    fill: track('fill'),
    stroke: track('stroke'),
    clip: track('clip'),
    save: track('save'),
    restore: track('restore'),
    closePath: track('closePath'),
    moveTo: track('moveTo'),
    lineTo: track('lineTo'),
    translate: track('translate'),
    rotate: track('rotate'),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    imageSmoothingEnabled: true
  };
}

function renderWith(ctx, { customers = [], ...rest } = {}) {
  createSceneRenderer({ getContext: () => ctx }, {})({
    customers,
    selectedCustomerId: null,
    selectedShelfId: null,
    state: { shelfInventory: {}, upgrades: { shelf: 0 } },
    elapsedMs: 0,
    ...rest
  });
}

// 收银台两片的标志性 fillRect（顶面 / 前沿悬边）
function counterSliceIndices(ctx) {
  const { x, y, width: w } = CHECKOUT_COUNTER;
  const backIndex = ctx.ops.findIndex((op) =>
    op.name === 'fillRect'
    && op.args[0] === x && op.args[1] === y && op.args[2] === w
  );
  const frontIndex = ctx.ops.findIndex((op) =>
    op.name === 'fillRect'
    && op.args[0] === x - 4 && op.args[1] === y + 58 && op.args[2] === w + 8
  );
  return [backIndex, frontIndex];
}

test('paints the interior, every pseudo-3D shelf, and a two-slice counter', () => {
  const ctx = createMockContext();
  renderWith(ctx);

  // 第一个 fillRect 必须是后墙
  const wallPaint = ctx.ops.find((op) => op.name === 'fillRect');
  assert.deepEqual(wallPaint.args, [0, 0, 768, 84]);

  // 每个货架都有"顶板"fillRect（x, y, 122, 20）
  for (const shelf of DEFAULT_WORLD.shelves) {
    const topPlank = ctx.ops.find((op) =>
      op.name === 'fillRect'
      && op.args[0] === shelf.x && op.args[1] === shelf.y
      && op.args[2] === shelf.width && op.args[3] === 20
    );
    assert.ok(topPlank, `shelf ${shelf.id} should paint a top plank (pseudo-3D)`);
  }

  // 收银台分两片绘制，后半片先画
  const [backIndex, frontIndex] = counterSliceIndices(ctx);
  assert.ok(backIndex > 0, 'counter back slice should be drawn');
  assert.ok(frontIndex > backIndex, 'counter front slice must be drawn after back slice');
});

test('renders the shopkeeper between the counter back and front slices', () => {
  const ctx = createMockContext();
  renderWith(ctx);

  const [backIndex, frontIndex] = counterSliceIndices(ctx);
  assert.ok(backIndex > 0 && frontIndex > backIndex);

  // 像素脚底阴影必须夹在收银台两片之间，保证腿被前沿遮挡。
  const ownerShadowIndex = ctx.ops.findIndex((op, index) => {
    if (op.name !== 'fillRect' || index <= backIndex || index >= frontIndex) return false;
    const [x, y] = op.args;
    return x === SHOPKEEPER_POINT.x - 14 && y === SHOPKEEPER_POINT.y - 4 && op.args[2] === 28;
  });
  assert.ok(ownerShadowIndex > 0, 'shopkeeper shadow should be drawn between counter back and front slices');
});

test('sorts customers behind or in front of a shelf by their foot point', () => {
  const ctx = createMockContext();
  const shelf = DEFAULT_WORLD.shelves[0];
  const shelfCenterX = shelf.x + shelf.width / 2;
  const customers = [
    {
      id: 'behind-shelf', variant: 0, phase: 'queueing', direction: 'south', frame: 0,
      x: shelfCenterX, y: shelf.zBase - 1, request: []
    },
    {
      id: 'front-of-shelf', variant: 1, phase: 'queueing', direction: 'south', frame: 0,
      x: shelfCenterX, y: shelf.zBase + 1, request: []
    }
  ];

  renderWith(ctx, { customers });

  // 直角像素身体按脚底深度排序。
  const bodyOps = ctx.ops.filter((op) => {
    if (op.name !== 'fillRect' || op.args[2] !== 24 || op.args[3] !== 20) return false;
    const [x] = op.args;
    return Math.abs(x - (shelfCenterX - 12)) <= 1;
  });
  assert.ok(bodyOps.length >= 2, 'expected pixel body calls for both customers');
  const bodyYs = bodyOps.map((op) => op.args[1]);
  assert.deepEqual(bodyYs, [...bodyYs].sort((a, b) => a - b),
    'customers with larger foot y must be drawn later (in front)');
});

test('draws shelf selection and request bubbles in the final overlay pass', () => {
  const ctx = createMockContext();
  const customer = {
    id: 'selected-customer', variant: 0, phase: 'picking', direction: 'south', frame: 0,
    x: 193, y: 222, request: [{ productId: 'candy', quantity: 1 }]
  };

  renderWith(ctx, {
    customers: [customer],
    selectedCustomerId: customer.id,
    selectedShelfId: 'shelf-0',
    state: { shelfInventory: { candy: 1 }, upgrades: { shelf: 0 } }
  });

  // 货架选中框 strokeRect (用 #ffd66b 颜色)
  const shelfOutline = ctx.ops.find((op) =>
    op.name === 'strokeRect' && op.args[0] === DEFAULT_WORLD.shelves[0].x - 3
  );
  assert.ok(shelfOutline, 'expected shelf selection strokeRect');

  // 顾客对话气泡 fillRect 在顾客头顶(顾客 y=222, 气泡在 y=110 附近)
  const bubbleFill = ctx.ops.find((op) =>
    op.name === 'fillRect'
    && op.args[0] >= 100 && op.args[0] <= 280
    && op.args[1] >= 100 && op.args[1] <= 160
    && op.args[3] === 26
  );
  assert.ok(bubbleFill, 'expected request bubble fillRect with height=26');

  // 低库存标记 fillRect 在货架右上角
  const lowStockMarker = ctx.ops.find((op) =>
    op.name === 'fillRect'
    && op.args[0] === DEFAULT_WORLD.shelves[0].x + DEFAULT_WORLD.shelves[0].width - 33
    && op.args[1] === DEFAULT_WORLD.shelves[0].y + 5
    && op.args[2] === 28
    && op.args[3] === 18
  );
  assert.ok(lowStockMarker, 'expected low stock marker fillRect');
});

test('draws a circular checkout progress ring above a paying customer', () => {
  const ctx = createMockContext();
  const durationMs = 2_200;
  const customer = {
    id: 'paying-customer', variant: 0, phase: 'checkout', direction: 'south', frame: 0,
    x: 690, y: 266, request: [{ productId: 'candy', quantity: 1 }],
    phaseMs: 1_100, checkoutDurationMs: durationMs
  };

  renderWith(ctx, { customers: [customer] });

  // 进度环：arc(x, y, r, start, end) 从顶部 (-PI/2) 顺时针扫过一半（1100/2200）
  const halfPi = Math.PI / 2;
  const progressArc = ctx.ops.find((op) =>
    op.name === 'arc'
    && op.args.length >= 5
    && Math.abs(op.args[3] - -halfPi) < 1e-9
    && Math.abs(op.args[4] - (-halfPi + Math.PI)) < 1e-9
  );
  assert.ok(progressArc, 'expected a half-swept progress arc starting at the top');

  // 环心有 ¥ 符号
  const yen = ctx.ops.find((op) => op.name === 'fillText' && op.args[0] === '¥');
  assert.ok(yen, 'expected a ¥ glyph centered in the progress ring');
});

test('shopping bubbles leave VIP crowns and patience bars visible', () => {
  const ctx=createMockContext();
  renderWith(ctx,{customers:[{id:'vip',x:193,y:222,vip:true,variant:0,direction:'south',phase:'picking',request:[{productId:'candy',quantity:1}]}]});
  const bubble=ctx.ops.find(op=>op.name==='fillRect'&&op.args[0]>150&&op.args[0]<200&&op.args[3]===26);
  assert.ok(bubble);
  assert.ok(bubble.args[1]+bubble.args[3]+4<=222-76,'bubble and tail must stay above the crown');
});
