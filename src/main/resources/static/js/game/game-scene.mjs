import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PRODUCTS,
  productCapacity
} from './game-config.mjs';
import { shelfDisplayState } from './game-state.mjs';
import { CHECKOUT_COUNTER, SHELVES, SHOPKEEPER_POINT } from './game-world.mjs';

export function canvasPointFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载素材：${url}`));
    image.src = url;
  });
}

export async function loadGameAssets(basePath = '/images/game') {
  const [scene, shelf, counter, characters, fixtures] = await Promise.all([
    loadImage(`${basePath}/snack-shop-empty-scene.png`),
    loadImage(`${basePath}/shelf-empty.png`),
    loadImage(`${basePath}/checkout-counter.png`),
    loadImage(`${basePath}/characters.png`),
    loadImage(`${basePath}/fixtures-and-products.png`).catch(() => null)
  ]);
  return { scene, shelf, counter, characters, fixtures };
}

const DIRECTION_COLUMNS = Object.freeze({ north: 9, east: 1, south: 6, west: 4 });
const CHARACTER_ATLAS_REFERENCE_WIDTH = 1774;
const CHARACTER_FRAME_WIDTH = 128;
const CHARACTER_FRAME_CENTERS = Object.freeze([
  90.5, 242, 391, 561.5, 727.5, 866,
  1020.5, 1168, 1296.5, 1448.5, 1591.5, 1710
]);
const PRODUCT_ATLAS_CELLS = Object.freeze({
  candy: { col: 1, row: 2 }, chips: { col: 2, row: 2 }, seaweed: { col: 3, row: 2 },
  soda: { col: 0, row: 3 }, cookies: { col: 1, row: 3 }, jelly: { col: 2, row: 3 }
});

function drawCharacter(ctx, atlas, character, row) {
  const cellHeight = atlas.height / 4;
  const moving = ['street', 'entering', 'browsing', 'queueing', 'leaving'].includes(character.phase);
  const baseColumn = DIRECTION_COLUMNS[character.direction] ?? DIRECTION_COLUMNS.south;
  const column = Math.min(11, baseColumn + (moving ? character.frame : 0));
  const atlasScale = atlas.width / CHARACTER_ATLAS_REFERENCE_WIDTH;
  const sourceWidth = CHARACTER_FRAME_WIDTH * atlasScale;
  const sourceX = (CHARACTER_FRAME_CENTERS[column] - CHARACTER_FRAME_WIDTH / 2) * atlasScale;
  const width = 54;
  const height = 68;
  ctx.drawImage(
    atlas,
    sourceX,
    row * cellHeight,
    sourceWidth,
    cellHeight,
    Math.round(character.x - width / 2),
    Math.round(character.y - height),
    width,
    height
  );
}

function drawProductIcon(ctx, fixtures, productId, x, y, size = 18) {
  if (!fixtures || !PRODUCT_ATLAS_CELLS[productId]) {
    ctx.fillStyle = PRODUCTS[productId]?.color ?? '#d75e46';
    ctx.fillRect(x, y, size, size);
    return;
  }
  const cell = PRODUCT_ATLAS_CELLS[productId];
  const cellWidth = fixtures.width / 4;
  const cellHeight = fixtures.height / 4;
  ctx.drawImage(
    fixtures,
    cell.col * cellWidth,
    cell.row * cellHeight,
    cellWidth,
    cellHeight,
    x,
    y,
    size,
    size
  );
}

export function shelfProductSlots(displayState) {
  return { empty: 0, low: 2, half: 5, full: 8 }[displayState] ?? 0;
}

function shelfVisualState(shelf, state) {
  const quantity = state.shelfInventory?.[shelf.productId] ?? 0;
  return shelfDisplayState(quantity, productCapacity(state));
}

function drawShelfBase(ctx, assets, shelf, state) {
  ctx.drawImage(assets.shelf, shelf.x, shelf.y, shelf.width, shelf.height);
  const displayState = shelfVisualState(shelf, state);
  const slotCount = shelfProductSlots(displayState);
  for (let index = 0; index < slotCount; index += 1) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    drawProductIcon(ctx, assets.fixtures, shelf.productId, shelf.x + 22 + col * 21, shelf.y + 27 + row * 21, 17);
  }
}

function drawShelfOverlay(ctx, shelf, state, selectedShelfId) {
  const displayState = shelfVisualState(shelf, state);
  if (selectedShelfId === shelf.id) {
    ctx.strokeStyle = '#ffe477';
    ctx.lineWidth = 4;
    ctx.strokeRect(shelf.x - 3, shelf.y - 3, shelf.width + 6, shelf.height + 6);
  }
  if (displayState === 'empty' || displayState === 'low') {
    ctx.fillStyle = displayState === 'empty' ? '#a73f32' : '#d98a32';
    ctx.fillRect(shelf.x + shelf.width - 33, shelf.y + 5, 28, 18);
    ctx.fillStyle = '#fff7da';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(displayState === 'empty' ? '空' : '少', shelf.x + shelf.width - 19, shelf.y + 18);
  }
}

function drawCounterBack(ctx, counterImage) {
  const split = 0.46;
  ctx.drawImage(
    counterImage,
    0,
    0,
    counterImage.width,
    counterImage.height * split,
    CHECKOUT_COUNTER.x,
    CHECKOUT_COUNTER.y,
    CHECKOUT_COUNTER.width,
    CHECKOUT_COUNTER.height * split
  );
}

function drawCounterFront(ctx, counterImage) {
  const split = 0.46;
  const sourceY = counterImage.height * split;
  const sourceHeight = counterImage.height - sourceY;
  const destinationY = CHECKOUT_COUNTER.y + CHECKOUT_COUNTER.height * split;
  const destinationHeight = CHECKOUT_COUNTER.height * (1 - split);
  ctx.drawImage(
    counterImage,
    0,
    sourceY,
    counterImage.width,
    sourceHeight,
    CHECKOUT_COUNTER.x,
    destinationY,
    CHECKOUT_COUNTER.width,
    destinationHeight
  );
}

function drawRequestBubble(ctx, assets, customer) {
  const missing = customer.phase === 'outOfStock';
  const width = Math.max(58, customer.request.length * 28 + 14 + (missing ? 22 : 0));
  const x = Math.max(4, Math.min(CANVAS_WIDTH - width - 4, customer.x - width / 2));
  const y = Math.max(6, customer.y - 105);
  ctx.fillStyle = '#fff4cf';
  ctx.strokeStyle = '#3f2d20';
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, width, 37);
  ctx.strokeRect(x, y, width, 37);
  customer.request.forEach((item, index) => {
    drawProductIcon(ctx, assets.fixtures, item.productId, x + 7 + index * 28, y + 6, 24);
  });
  if (missing) {
    ctx.fillStyle = '#a73f32';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', x + width - 14, y + 27);
  }
}

export function createSceneRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const owner = {
    ...SHOPKEEPER_POINT,
    phase: 'checkout',
    direction: 'south',
    frame: 0,
    zBase: SHOPKEEPER_POINT.y
  };

  return function renderScene({
    customers = [],
    selectedCustomerId = null,
    selectedShelfId = null,
    state,
    elapsedMs = 0
  }) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets.scene, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const layers = [
      ...SHELVES.map((shelf) => ({ z: shelf.zBase, draw: () => drawShelfBase(ctx, assets, shelf, state) })),
      {
        z: CHECKOUT_COUNTER.y,
        draw: () => drawCounterBack(ctx, assets.counter)
      },
      { z: owner.zBase, draw: () => drawCharacter(ctx, assets.characters, owner, 0) },
      {
        z: CHECKOUT_COUNTER.zBase,
        draw: () => drawCounterFront(ctx, assets.counter)
      },
      ...customers
        .filter((customer) => customer.phase !== 'done')
        .map((customer) => ({
          z: customer.y,
          draw: () => {
            drawCharacter(ctx, assets.characters, customer, 1 + (customer.variant % 3));
          }
        }))
    ];
    layers.sort((a, b) => a.z - b.z).forEach((layer) => layer.draw());
    for (const shelf of SHELVES) drawShelfOverlay(ctx, shelf, state, selectedShelfId);
    for (const customer of customers.filter((item) => item.phase !== 'done')) {
      if (customer.id === selectedCustomerId) {
        ctx.strokeStyle = '#ffe477';
        ctx.lineWidth = 4;
        ctx.strokeRect(customer.x - 22, customer.y - 72, 44, 76);
      }
      if (['browsing', 'picking', 'waitingShelf', 'outOfStock'].includes(customer.phase)) {
        drawRequestBubble(ctx, assets, customer);
      }
    }
  };
}
