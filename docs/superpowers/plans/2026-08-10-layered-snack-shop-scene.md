# Layered Snack Shop Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the baked shop image with a layered Canvas world where six interactive shelves have real stock states and customers follow fixed, collision-safe routes from the street to shelves, queue, checkout, and exit.

**Architecture:** Keep the existing Spring/Thymeleaf page and Canvas size, but split world geometry, customer simulation, state transitions, and rendering into focused ES modules. Inventory becomes warehouse stock plus shelf stock; customers reserve orders atomically and traverse named waypoint routes. The renderer draws a clean environment background, furniture, characters, shelf contents, and interaction overlays as separate layers.

**Tech Stack:** Spring Boot 3.2, Thymeleaf, HTML Canvas 2D, native ES modules, localStorage, Node `node:test`, built-in ImageGen plus chroma-key removal.

**Repository note:** This workspace has no `.git` directory. Run every test checkpoint, but do not initialize a repository or invent commit steps.

---

### Task 1: Version 2 Inventory State and Migration

**Files:**
- Modify: `src/main/resources/static/js/game/game-state.mjs`
- Modify: `src/main/resources/static/js/game/game-config.mjs`
- Modify: `tests/game-state.test.mjs`

- [ ] **Step 1: Write failing tests for version 2 state**

Add tests that assert a new game contains `saveVersion: 2`, `warehouseInventory`, and `shelfInventory`, with starter shelf quantities of 5 candy and 3 chips.

```js
test('creates version 2 warehouse and shelf inventories', () => {
  const state = createInitialState(1_000);
  assert.equal(state.saveVersion, 2);
  assert.equal(state.warehouseInventory.candy, 0);
  assert.equal(state.shelfInventory.candy, 5);
  assert.equal(state.shelfInventory.chips, 3);
});
```

- [ ] **Step 2: Write failing migration and restocking tests**

Cover old `inventory` migration, order delivery to the warehouse, capacity-limited shelf restocking, and inventory conservation.

```js
test('migrates legacy inventory into shelves then warehouse', () => {
  const legacy = JSON.stringify({ coins: 200, inventory: { candy: 25, chips: 3 } });
  const state = restoreState(legacy, 2_000);
  assert.equal(state.saveVersion, 2);
  assert.equal(state.shelfInventory.candy, 20);
  assert.equal(state.warehouseInventory.candy, 5);
});

test('restocks a shelf without losing inventory', () => {
  const state = createInitialState(1_000);
  state.warehouseInventory.candy = 10;
  const before = state.warehouseInventory.candy + state.shelfInventory.candy;
  const moved = restockShelf(state, 'candy', 5);
  assert.equal(moved, 5);
  assert.equal(state.warehouseInventory.candy + state.shelfInventory.candy, before);
});
```

- [ ] **Step 3: Run the state tests and confirm RED**

Run:

```powershell
node --test tests\game-state.test.mjs
```

Expected: failures for missing version 2 properties and `restockShelf` export.

- [ ] **Step 4: Implement the minimal version 2 state API**

Add the following public behavior:

```js
export const SAVE_VERSION = 2;

export function restockShelf(state, productId, requestedQuantity) {
  const available = state.warehouseInventory[productId] ?? 0;
  const capacity = productCapacity(state);
  const current = state.shelfInventory[productId] ?? 0;
  const moved = Math.max(0, Math.min(requestedQuantity, available, capacity - current));
  state.warehouseInventory[productId] = available - moved;
  state.shelfInventory[productId] = current + moved;
  return moved;
}

export function shelfDisplayState(quantity, capacity) {
  if (quantity <= 0) return 'empty';
  const ratio = quantity / capacity;
  if (ratio < 0.4) return 'low';
  if (ratio < 0.8) return 'half';
  return 'full';
}
```

Change settled supply orders to add to `warehouseInventory`. Add an explicit `migrateLegacyState(parsed)` path in `restoreState`, and keep corrupt-save recovery behavior unchanged.

- [ ] **Step 5: Run state tests and confirm GREEN**

Run `node --test tests\game-state.test.mjs`.

Expected: all state tests pass with no skipped tests.

---

### Task 2: World Geometry, Shelves, Hitboxes, and Route Validation

**Files:**
- Create: `src/main/resources/static/js/game/game-world.mjs`
- Create: `tests/game-world.test.mjs`
- Modify: `src/main/resources/static/js/game/game-config.mjs`

- [ ] **Step 1: Write failing world geometry tests**

Tests must verify six shelves, one product per shelf, click hit testing, four shelf visual states, and collision-free waypoints.

```js
test('defines six interactive product shelves', () => {
  assert.equal(SHELVES.length, 6);
  assert.deepEqual(new Set(SHELVES.map((shelf) => shelf.productId)).size, 6);
});

test('keeps every route waypoint outside furniture collisions', () => {
  for (const route of Object.values(SHELF_ROUTES)) {
    for (const point of route) {
      assert.equal(pointInsideAnyCollision(point, FURNITURE), false);
    }
  }
});
```

- [ ] **Step 2: Run world tests and confirm RED**

Run `node --test tests\game-world.test.mjs`.

Expected: module-not-found failure for `game-world.mjs`.

- [ ] **Step 3: Implement fixed world data and helpers**

Define six shelf objects, a counter, three queue points, public entrance/exit nodes, and a branch route for each shelf.

```js
export const SHELVES = Object.freeze([
  makeShelf('shelf-candy', 'candy', 132, 122, 122, 76, { x: 193, y: 222 }),
  makeShelf('shelf-chips', 'chips', 292, 122, 122, 76, { x: 353, y: 222 }),
  makeShelf('shelf-seaweed', 'seaweed', 452, 122, 122, 76, { x: 513, y: 222 }),
  makeShelf('shelf-soda', 'soda', 132, 270, 122, 76, { x: 193, y: 370 }),
  makeShelf('shelf-cookies', 'cookies', 292, 270, 122, 76, { x: 353, y: 370 }),
  makeShelf('shelf-jelly', 'jelly', 452, 270, 122, 76, { x: 513, y: 370 })
]);

export function shelfAtPoint(x, y) {
  return [...SHELVES].reverse().find((shelf) => pointInRect(x, y, shelf.hitbox)) ?? null;
}
```

Keep all coordinates centralized in this module. Export `validateWorldLayout()` for tests and development assertions.

- [ ] **Step 4: Run world tests and confirm GREEN**

Run `node --test tests\game-world.test.mjs`.

Expected: all geometry and collision assertions pass.

---

### Task 3: Atomic Reservations and Fixed Customer Route Simulation

**Files:**
- Create: `src/main/resources/static/js/game/game-customer.mjs`
- Create: `tests/game-customer.test.mjs`
- Modify: `src/main/resources/static/js/game/game-state.mjs`
- Modify: `src/main/resources/static/js/game/game-scene.mjs`
- Modify: `tests/game-scene.test.mjs`

- [ ] **Step 1: Write failing reservation tests**

Cover all-or-nothing multi-product reservation and reservation release.

```js
test('reserves a complete order atomically', () => {
  const state = createInitialState(1_000);
  state.shelfInventory.candy = 2;
  state.shelfInventory.chips = 0;
  const result = reserveShelfOrder(state, [
    { productId: 'candy', quantity: 1 },
    { productId: 'chips', quantity: 1 }
  ]);
  assert.equal(result.ok, false);
  assert.equal(state.shelfInventory.candy, 2);
});
```

- [ ] **Step 2: Write failing lifecycle and queue tests**

Assert the normal phases, out-of-stock phases, shelf waiting behavior, three queue slots, queue advancement, and no duplicate slot ownership.

```js
test('follows entrance, shelf, queue, checkout and exit waypoints', () => {
  const simulation = createCustomerSimulation({ state: stockedState() });
  const customer = simulation.spawn({ request: [{ productId: 'candy', quantity: 1 }] });
  advanceUntilDone(simulation, customer);
  assert.deepEqual(customer.phaseHistory, [
    'street', 'entering', 'browsing', 'picking',
    'queueing', 'checkout', 'leaving', 'done'
  ]);
});
```

- [ ] **Step 3: Run customer tests and confirm RED**

Run:

```powershell
node --test tests\game-customer.test.mjs tests\game-scene.test.mjs
```

Expected: missing simulation module and reservation API failures.

- [ ] **Step 4: Implement the customer simulation**

Move route state transitions out of rendering code. Expose a simulation with these boundaries:

```js
export function createCustomerSimulation({ state, onCheckout, onOutOfStock }) {
  return {
    customers: [],
    spawn({ id, request, variant }),
    update(deltaMs),
    releaseCustomer(customerId)
  };
}
```

At the entrance, reserve all requested shelf stock atomically. For stocked orders, visit shelf approach points in product order, then acquire a queue slot. For failed reservations, visit the first missing shelf, show out-of-stock feedback, and exit. Release uncommitted reservations when a customer is removed unexpectedly.

- [ ] **Step 5: Implement queue timing and checkout speed**

Use three fixed queue points from `game-world.mjs`. Only index 0 can enter checkout. Derive duration from the upgrade without allowing zero-time checkout:

```js
export function checkoutDurationMs(checkoutLevel) {
  return Math.max(700, 2_200 - checkoutLevel * 300);
}
```

- [ ] **Step 6: Run customer and scene tests and confirm GREEN**

Run `node --test tests\game-customer.test.mjs tests\game-scene.test.mjs`.

Expected: route, reservation, queue, and existing character frame tests all pass.

---

### Task 4: Generate Clean Background and Independent Furniture Assets

**Files:**
- Create: `src/main/resources/static/images/game/snack-shop-empty-scene.png`
- Create: `src/main/resources/static/images/game/shelf.png`
- Create: `src/main/resources/static/images/game/checkout-counter.png`
- Preserve: `src/main/resources/static/images/game/characters.png`
- Preserve: `src/main/resources/static/images/game/fixtures-and-products.png`

- [ ] **Step 1: Inspect the existing scene and furniture atlas**

Use `view_image` at original resolution and record which environment elements must remain: warm wall, wooden floor, doorway, sidewalk, crosswalk, road, plants only when they do not occupy planned furniture hitboxes.

- [ ] **Step 2: Generate the empty environment background**

Use built-in ImageGen with the current scene as style reference and this invariant-focused prompt:

```text
Use case: precise-object-edit
Asset type: 768x512 top-down pixel-art game background
Primary request: create a clean empty neighborhood snack shop interior connected to a sidewalk, crosswalk and street
Style: warm detailed 16-bit pixel art matching the provided scene
Constraints: keep walls, wooden floor, centered shop door, sidewalk, crosswalk and road; remove every person, shelf, checkout counter, product display and interactive furniture; leave open rectangular floor space for six shelves; no text, no watermark
```

- [ ] **Step 3: Generate transparent shelf and counter sources**

Use built-in ImageGen on a flat `#00ff00` chroma-key background. Generate one front-facing top-down wooden retail shelf and one checkout counter, each isolated with generous padding and no products or characters.

- [ ] **Step 4: Remove chroma key and validate alpha**

Copy the selected built-in outputs to `tmp/imagegen/shelf-source.png` and `tmp/imagegen/checkout-counter-source.png`, then run the installed helper for each source:

```powershell
$pythonPath = 'C:\Users\伟嘉\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$removeChromaKey = 'C:\Users\伟嘉\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py'
& $pythonPath $removeChromaKey --input 'tmp\imagegen\shelf-source.png' --out 'src\main\resources\static\images\game\shelf.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
& $pythonPath $removeChromaKey --input 'tmp\imagegen\checkout-counter-source.png' --out 'src\main\resources\static\images\game\checkout-counter.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Validate transparent corners, non-empty subject coverage, crisp pixel edges, and no green fringe. Copy final assets into `static/images/game` without deleting the previous scene asset.

---

### Task 5: Layered Furniture and Shelf-State Renderer

**Files:**
- Modify: `src/main/resources/static/js/game/game-scene.mjs`
- Modify: `tests/game-scene.test.mjs`
- Modify: `src/main/resources/static/js/game/game-world.mjs`

- [ ] **Step 1: Write failing renderer call-order tests**

Use a fake Canvas context to assert the renderer draws the environment first, shelf bodies before/after characters according to `zBase`, shelf product icons according to `shelfDisplayState`, and overlays last.

```js
test('draws furniture and characters in depth order', () => {
  const calls = renderWithFakeContext({ customerY: 360 });
  assert.ok(calls.indexOf('shelf:soda:back') < calls.indexOf('customer'));
  assert.ok(calls.indexOf('customer') < calls.indexOf('shelf:soda:front'));
});
```

- [ ] **Step 2: Run renderer tests and confirm RED**

Run `node --test tests\game-scene.test.mjs`.

Expected: missing furniture layer calls.

- [ ] **Step 3: Load the new assets and render shelves**

Change `loadGameAssets` to load `snack-shop-empty-scene.png`, `shelf.png`, and `checkout-counter.png`. Render shelf bases from world objects, then place 0, 2, 5, or 8 product icons for `empty`, `low`, `half`, or `full` states. Preserve `ctx.imageSmoothingEnabled = false`.

- [ ] **Step 4: Add selected shelf and stock overlays**

Render a gold pixel outline around the selected shelf. Empty shelves get a small `缺货` badge; low shelves get a subtle warning marker. Keep text and badges in Canvas overlays, not baked into raster assets.

- [ ] **Step 5: Run renderer tests and confirm GREEN**

Run `node --test tests\game-scene.test.mjs tests\game-world.test.mjs`.

Expected: all layer, hitbox, and character frame tests pass.

---

### Task 6: Shelf Restocking UI and Main-Loop Integration

**Files:**
- Modify: `src/main/resources/templates/game/index.html`
- Modify: `src/main/resources/static/css/game.css`
- Modify: `src/main/resources/static/js/game/game-ui.mjs`
- Modify: `src/main/resources/static/js/game/main.mjs`
- Create: `tests/game-ui-structure.test.mjs`

- [ ] **Step 1: Write a failing UI structure test**

Read the template as text and assert the shelf panel contains stable IDs for product name, shelf quantity, warehouse quantity, state, and three restock actions.

```js
test('template exposes the shelf restocking controls', () => {
  for (const id of ['shelf-panel', 'shelf-product', 'shelf-stock', 'warehouse-stock', 'restock-one', 'restock-five', 'restock-full']) {
    assert.match(template, new RegExp(`id="${id}"`));
  }
});
```

- [ ] **Step 2: Run UI structure test and confirm RED**

Run `node --test tests\game-ui-structure.test.mjs`.

Expected: missing shelf panel IDs.

- [ ] **Step 3: Add the shelf panel and pixel styling**

Replace the manual “交付零食” primary action with contextual shelf/customer panels. The shelf panel shows product, shelf stock, warehouse stock, capacity, state label, and restock buttons. On mobile it remains below the Canvas and uses full-width touch targets.

- [ ] **Step 4: Integrate click priority and selection state**

In `main.mjs`, resolve Canvas clicks in this order:

```js
const customer = customerAtPoint(simulation.customers, point.x, point.y);
const shelf = customer ? null : shelfAtPoint(point.x, point.y);
selectedCustomerId = customer?.id ?? null;
selectedShelfId = shelf?.id ?? null;
```

Restock handlers call `restockShelf`, save immediately, refresh shelf visuals, and show exact moved quantities. Clicking blank Canvas clears both selections.

- [ ] **Step 5: Connect simulation events to economy state**

Successful checkout records revenue and reputation once. Out-of-stock departure records one lost customer and reduces reputation without going below zero. Supply orders and offline settlement add to warehouse stock. Autosave serializes version 2 state.

- [ ] **Step 6: Run UI, state, customer, and structure tests**

Run:

```powershell
node --test tests\game-ui-structure.test.mjs tests\game-state.test.mjs tests\game-world.test.mjs tests\game-customer.test.mjs tests\game-scene.test.mjs
```

Expected: all tests pass.

---

### Task 7: Browser QA, Cache Version, and Full Regression

**Files:**
- Modify: `src/main/resources/templates/game/index.html`
- Modify: `scripts/verify-snack-shop-game.ps1`
- Modify: `README.md`

- [ ] **Step 1: Bump the module cache version**

Change the Thymeleaf module URL query value so browsers cannot reuse the old scene implementation after deployment.

```html
<script type="module" th:src="@{/js/game/main.mjs(v=20260810-layered)}"></script>
```

- [ ] **Step 2: Extend the structural verification script**

Require the new world/customer modules, clean scene asset, shelf panel IDs, and versioned state fields. Keep the existing no-placeholder and no-emoji checks.

- [ ] **Step 3: Run all JavaScript and structure tests**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-snack-shop-game.ps1
node --test tests\game-state.test.mjs tests\game-world.test.mjs tests\game-customer.test.mjs tests\game-scene.test.mjs tests\game-ui-structure.test.mjs
```

Expected: structure verification passes and all Node tests report zero failures.

- [ ] **Step 4: Run the full Spring test suite**

Use the temporary drive mapping required by this Chinese-character path:

```powershell
subst.exe T: 'C:\Users\伟嘉\Desktop\求职\Tongshengbolg'
try {
  Set-Location T:\
  mvn.cmd clean test
  exit $LASTEXITCODE
} finally {
  Set-Location 'C:\Users\伟嘉\Desktop\求职\Tongshengbolg'
  subst.exe T: /D
}
```

Expected: `BUILD SUCCESS`, seven or more tests, zero failures and zero errors.

- [ ] **Step 5: Perform desktop browser QA**

Verify at 1440×1000:

- clean background contains no baked shelves or people;
- all six shelves render independently;
- clicking each shelf opens the correct product panel;
- restocking changes warehouse and shelf counts and visual state;
- customers follow aisle routes, wait at occupied shelves, queue without overlap, and exit;
- character and shelf depth ordering is correct;
- console contains no errors.

- [ ] **Step 6: Perform mobile browser QA**

Verify at 390×844 that the Canvas scales down, controls stack below it, buttons remain usable, and `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 7: Update README**

Document that `/game` now uses warehouse-to-shelf restocking, fixed customer routes, interactive shelves, and local version 2 saves.

---

### Task 8: Final Verification and Handoff

**Files:**
- Review all files changed in Tasks 1–7.

- [ ] **Step 1: Re-run fresh verification**

Run the structure script, every Node test, and `mvn clean test` again after the final edit. Do not rely on earlier output.

- [ ] **Step 2: Check saved assets and stale references**

Use `rg` to confirm code references `snack-shop-empty-scene.png`, `shelf.png`, and `checkout-counter.png`, and no renderer references the baked scene for gameplay.

- [ ] **Step 3: Summarize the delivered loop**

Report the exact files changed, generated asset paths and ImageGen prompts, Node/Spring test counts, browser QA results, and the manual restart/refresh instruction. State explicitly that no commit was created because the workspace is not a Git repository.
