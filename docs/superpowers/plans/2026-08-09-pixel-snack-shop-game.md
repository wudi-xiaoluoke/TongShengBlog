# Pixel Snack Shop Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/game` placeholder with a persistent, endless pixel-art snack shop simulation where customers walk from the street into a top-down store, shop, check out, and leave.

**Architecture:** Use ES modules with a pure state layer tested by Node's built-in test runner. Render the animated store in a fixed-resolution Canvas and keep inventory, ordering, upgrades, ledger, save controls, and notices in responsive HTML panels. ImageGen supplies the project-bound scene, character, fixture, and product raster assets.

**Tech Stack:** Thymeleaf, HTML5 Canvas, CSS, JavaScript ES modules, localStorage, Node `node:test`, ImageGen, Spring Boot/Maven

---

### Task 1: Define configuration and test the economy state

**Files:**
- Create: `src/main/resources/static/js/game/game-config.mjs`
- Create: `src/main/resources/static/js/game/game-state.mjs`
- Create: `tests/game-state.test.mjs`

- [ ] **Step 1: Write failing tests for the game state API**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, placeSupplyOrder, settleSupplyOrders,
  serveRequest, purchaseUpgrade, serializeState, restoreState
} from '../src/main/resources/static/js/game/game-state.mjs';

test('places and settles a supply order', () => {
  const state = createInitialState(1_000);
  const order = placeSupplyOrder(state, 'chips', 1_000);
  assert.equal(state.coins, 170);
  settleSupplyOrders(state, order.readyAt);
  assert.equal(state.inventory.chips, 10);
});

test('serves available snacks and records income', () => {
  const state = createInitialState(1_000);
  state.inventory.candy = 2;
  const result = serveRequest(state, [{ productId: 'candy', quantity: 1 }]);
  assert.equal(result.ok, true);
  assert.equal(state.inventory.candy, 1);
  assert.equal(state.coins, 236);
  assert.equal(state.stats.totalRevenue, 36);
});

test('restores completed offline deliveries', () => {
  const state = createInitialState(1_000);
  placeSupplyOrder(state, 'candy', 1_000);
  const restored = restoreState(serializeState(state), 40_000);
  assert.equal(restored.inventory.candy, 10);
  assert.equal(restored.supplyOrders.length, 0);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/game-state.test.mjs`

Expected: FAIL because the state modules do not exist.

- [ ] **Step 3: Implement configuration data**

Define six products (`candy`, `chips`, `seaweed`, `soda`, `cookies`, `jelly`) with Chinese names, order quantities, costs, prices, delivery times, unlock levels, shelf coordinates, and color fallbacks. Define five upgrades (`shelf`, `delivery`, `traffic`, `catalog`, `checkout`) with level-based costs and effects. Export Canvas dimensions, storage keys, customer routes, and timing constants.

- [ ] **Step 4: Implement pure state functions**

```js
export function createInitialState(now = Date.now()) { /* versioned defaults */ }
export function placeSupplyOrder(state, productId, now = Date.now()) { /* validate, debit, enqueue */ }
export function settleSupplyOrders(state, now = Date.now()) { /* move completed orders into inventory */ }
export function serveRequest(state, request) { /* atomic stock check, debit stock, credit income */ }
export function purchaseUpgrade(state, upgradeId) { /* validate cost and increment */ }
export function serializeState(state) { return JSON.stringify(state); }
export function restoreState(raw, now = Date.now()) { /* parse, validate version, settle offline orders */ }
```

- [ ] **Step 5: Run GREEN**

Run: `node --test tests/game-state.test.mjs`

Expected: all state tests pass.

### Task 2: Test and implement the customer movement state machine

**Files:**
- Create: `src/main/resources/static/js/game/game-scene.mjs`
- Create: `tests/game-scene.test.mjs`

- [ ] **Step 1: Write failing state-machine tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomer, updateCustomer } from '../src/main/resources/static/js/game/game-scene.mjs';

test('customer follows street, entrance, shelf, checkout and exit states', () => {
  const customer = createCustomer({ id: 'c1', productId: 'candy', variant: 0 });
  const seen = new Set([customer.phase]);
  for (let i = 0; i < 4_000 && customer.phase !== 'done'; i += 1) {
    updateCustomer(customer, 50, { served: customer.phase === 'shopping' });
    seen.add(customer.phase);
  }
  assert.deepEqual([...seen], ['street', 'entering', 'shopping', 'queueing', 'checkout', 'leaving', 'done']);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/game-scene.test.mjs`

Expected: FAIL because the scene module does not exist.

- [ ] **Step 3: Implement deterministic movement**

Export `createCustomer`, `updateCustomer`, `customerAtPoint`, and `customerHitTest`. Use fixed waypoint arrays per phase and a speed measured in logical Canvas pixels per second. Change phases only when the current waypoint list finishes; hold in `shopping` until served, hold briefly in `checkout`, then route through the door and street exit.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/game-scene.test.mjs`

Expected: the full phase-order test passes.

### Task 3: Generate and prepare pixel assets

**Files:**
- Create: `src/main/resources/static/images/game/snack-shop-scene.png`
- Create: `src/main/resources/static/images/game/characters.png`
- Create: `src/main/resources/static/images/game/fixtures-and-products.png`

- [ ] **Step 1: Generate the top-down scene with built-in ImageGen**

Prompt requirements: top-down 16-bit pixel-art snack shop, warm wood interior in the upper two-thirds, visible doorway, sidewalk and street in the lower third, clear walkable floor, no people, no UI, no text, no logo, no watermark, 3:2 landscape composition.

- [ ] **Step 2: Generate the character sprite atlas**

Prompt requirements: one shopkeeper and three distinct customers, each with north/east/south/west standing and two-frame walking poses, strict aligned grid, crisp 16-bit pixels, flat `#00ff00` chroma-key background, no shadows, no text, no watermark, no green in characters.

- [ ] **Step 3: Generate fixture and product atlas**

Prompt requirements: top-down shelves, checkout counter, parcel box, candy, chips, seaweed, soda, cookies, jelly, strict aligned grid, warm 16-bit pixel style, flat `#00ff00` chroma-key background, no shadows, no text, no watermark.

- [ ] **Step 4: Remove chroma key and validate assets**

Use the installed ImageGen helper with `--auto-key border --soft-matte --despill`; validate alpha corners, grid alignment, and no green fringe. Copy final assets into the paths above without overwriting unrelated files.

### Task 4: Build the game page and responsive pixel UI

**Files:**
- Replace: `src/main/resources/templates/game/index.html`
- Create: `src/main/resources/static/css/game.css`

- [ ] **Step 1: Add a failing structure check**

Create `scripts/verify-snack-shop-game.ps1` that asserts the page contains `id="snack-shop-canvas"`, inventory/order/upgrade/ledger panels, asset preloads, all module script references, and no placeholder text `小游戏建设中`.

- [ ] **Step 2: Run RED**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-snack-shop-game.ps1`

Expected: FAIL because the placeholder page has no Canvas.

- [ ] **Step 3: Replace the placeholder template**

Build a semantic game shell containing the shared site header/footer, stat HUD, 768×512 Canvas, loading/error overlay, tabs for inventory/supply/upgrades/ledger, selected-customer order card, toast live region, save indicator, help dialog, and reset confirmation dialog. Load `game.css` and `main.mjs`.

- [ ] **Step 4: Add responsive pixel UI CSS**

Use a warm brown/cream pixel palette, square borders and stepped shadows, `image-rendering: pixelated`, two-column desktop layout, single-column mobile layout, minimum 44px interactive targets, no page-level horizontal overflow, and no Emoji as UI icons.

### Task 5: Connect Canvas rendering, controls, persistence, and automation

**Files:**
- Create: `src/main/resources/static/js/game/game-ui.mjs`
- Create: `src/main/resources/static/js/game/main.mjs`
- Modify: `src/main/resources/static/js/game/game-scene.mjs`

- [ ] **Step 1: Implement the Canvas renderer**

Load the three generated assets, disable smoothing, draw scene and fixtures, draw customers and shopkeeper by sprite source rectangles, animate walking frames, render selection outlines and demand bubbles, and fall back to pixel rectangles when non-critical atlas regions are unavailable.

- [ ] **Step 2: Implement DOM rendering and actions**

Render product stock/order buttons, active delivery timers, upgrade cards, ledger totals, selected customer request, notices, and save status. Bind supply, upgrade, serve, tab, help, retry, and reset actions to explicit state functions.

- [ ] **Step 3: Implement the main loop**

Initialize assets and restored state, settle offline deliveries, spawn customers according to the traffic upgrade, update movement, handle manual serve clicks, apply automatic checkout probability from the checkout upgrade, autosave after mutations and every 15 seconds, pause animation while hidden, and resume with time-delta reconciliation.

- [ ] **Step 4: Run structure and Node tests**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-snack-shop-game.ps1
node --test tests/game-state.test.mjs tests/game-scene.test.mjs
```

Expected: all checks pass.

### Task 6: Update project documentation and verify the full app

**Files:**
- Modify: `README.md`
- Verify: all game files and existing application tests.

- [ ] **Step 1: Update README**

Replace the `/game` placeholder descriptions with the implemented pixel snack shop feature, local save behavior, and controls.

- [ ] **Step 2: Run final static checks**

Run `rg -n "小游戏建设中|🎮" src/main/resources/templates/game src/main/resources/static/css/game.css src/main/resources/static/js/game` and confirm no placeholder or Emoji UI remains.

- [ ] **Step 3: Run full Maven tests from a temporary ASCII drive mapping**

Run `mvn clean test` from the mapped drive and remove the mapping in a `finally` block.

Expected: BUILD SUCCESS with all existing Spring tests passing.

- [ ] **Step 4: Perform browser QA**

Verify `/game` at desktop and mobile widths: assets load, street/shop remain pixel-sharp, a customer completes the entire route, supply countdown persists across refresh, automation serves eligible customers, and reset requires confirmation.

- [ ] **Step 5: Skip commit**

The workspace has no `.git` directory, so report changed files and verification evidence instead of committing.
