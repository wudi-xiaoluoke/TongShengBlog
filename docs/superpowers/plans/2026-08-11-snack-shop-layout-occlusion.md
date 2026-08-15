# Snack Shop Layout and Occlusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the six shelves into a wall-row and center-island layout, keep the entrance clear, and render the shopkeeper naturally between the checkout counter layers.

**Architecture:** `game-world.mjs` remains the single source of truth for furniture coordinates, collision boxes, approach points, and route waypoints. `game-scene.mjs` uses one Y-sorted scene graph: whole shelf images sort at their foot line, while the counter is split into a rear/base pass and a front-panel pass with the shopkeeper between them.

**Tech Stack:** Browser Canvas 2D, native ES modules, Node.js built-in test runner, Spring Boot/Thymeleaf host page.

---

### Task 1: Lock the intended store layout in world tests

**Files:**
- Modify: `tests/game-world.test.mjs`
- Modify: `src/main/resources/static/js/game/game-world.mjs`

- [ ] **Step 1: Write failing layout tests**

Add assertions that the first three shelves form the back-wall row, the last three form the center-island row, both rows stay inside the shop, the island ends above the entrance corridor, and a clear horizontal gap remains between the rightmost shelf and the counter.

```js
test('places one shelf row on the back wall and one island row in the store center', () => {
  const wallRow = SHELVES.slice(0, 3);
  const islandRow = SHELVES.slice(3);
  assert.ok(wallRow.every((shelf) => shelf.y <= 100));
  assert.ok(islandRow.every((shelf) => shelf.y >= 230 && shelf.y + shelf.height <= 330));
  assert.ok(Math.max(...islandRow.map((shelf) => shelf.y + shelf.height)) < 350);
  assert.ok(Math.max(...SHELVES.map((shelf) => shelf.x + shelf.width)) <= CHECKOUT_COUNTER.x - 45);
});

test('keeps the shopkeeper and checkout customer on opposite sides of the counter front', () => {
  assert.ok(SHOPKEEPER_POINT.y < CHECKOUT_COUNTER.zBase);
  assert.ok(CHECKOUT_COUNTER.checkoutPoint.y > CHECKOUT_COUNTER.zBase);
});
```

- [ ] **Step 2: Run the world test and verify RED**

Run: `node --test tests/game-world.test.mjs`

Expected: FAIL because the existing island row extends to `y=346`, the shelf/counter gap is only 26 pixels, and `SHOPKEEPER_POINT` does not yet exist.

- [ ] **Step 3: Implement the new coordinates and safe routes**

In `game-world.mjs`, export the shopkeeper point and use these layout anchors:

```js
export const SHELVES = Object.freeze([
  makeShelf('shelf-candy', 'candy', 105, 88, { x: 166, y: 184 }, { x: 197, y: 205 }),
  makeShelf('shelf-chips', 'chips', 275, 88, { x: 336, y: 184 }, { x: 367, y: 205 }),
  makeShelf('shelf-seaweed', 'seaweed', 445, 88, { x: 506, y: 184 }, { x: 537, y: 205 }),
  makeShelf('shelf-soda', 'soda', 105, 238, { x: 166, y: 334 }, { x: 197, y: 354 }),
  makeShelf('shelf-cookies', 'cookies', 275, 238, { x: 336, y: 334 }, { x: 367, y: 354 }),
  makeShelf('shelf-jelly', 'jelly', 445, 238, { x: 506, y: 334 }, { x: 537, y: 354 })
]);

export const SHOPKEEPER_POINT = Object.freeze({ x: 690, y: 180 });
```

Move the counter to `x: 618, y: 105`, set its foot line to `zBase: 215`, and set `checkoutPoint` to `{ x: 690, y: 238 }`. Move checkout queue points to `y: 266`, `304`, and `342`. Set the inside entrance hub to `{ x: 650, y: 330 }`, so entrance and exit routes cross the storefront boundary through the doorway at `x: 650` before turning left. Route wall-row customers through `{ x: 595, y: 205 }` and island-row customers through the aisle below the island at `y: 330`.

- [ ] **Step 4: Run world and customer tests and verify GREEN**

Run: `node --test tests/game-world.test.mjs tests/game-customer.test.mjs`

Expected: all tests PASS, including `validateWorldLayout()` returning no collision errors.

### Task 2: Correct shelf and checkout occlusion

**Files:**
- Modify: `tests/game-scene.test.mjs`
- Modify: `src/main/resources/static/js/game/game-scene.mjs`

- [ ] **Step 1: Write failing draw-order tests**

Replace the expectation for twelve shelf draws with one shelf draw per shelf. Add a test that records image calls and asserts this order:

```js
assert.ok(counterBaseIndex < ownerIndex);
assert.ok(ownerIndex < counterFrontIndex);
assert.equal(shelfCalls.length, SHELVES.length);
```

Identify the counter back as the cropped nine-argument draw covering source `[0%, 46%)`, and the counter front as the cropped nine-argument draw covering source `[46%, 100%]`. Assert that the source and destination boundaries meet without overlap.

- [ ] **Step 2: Run the scene test and verify RED**

Run: `node --test tests/game-scene.test.mjs`

Expected: FAIL because shelves are currently drawn twice and the whole counter is drawn after the shopkeeper.

- [ ] **Step 3: Implement one Y-sorted scene graph**

Import `SHOPKEEPER_POINT`, derive the owner from it, remove `drawShelfFront`, and stop redrawing shelf strips after all characters.

Add a cropped front-panel helper:

```js
function drawCounterFront(ctx, counterImage) {
  const split = 0.46;
  const sourceY = counterImage.height * split;
  const sourceHeight = counterImage.height - sourceY;
  const destinationY = CHECKOUT_COUNTER.y + CHECKOUT_COUNTER.height * split;
  ctx.drawImage(
    counterImage,
    0, sourceY, counterImage.width, sourceHeight,
    CHECKOUT_COUNTER.x, destinationY,
    CHECKOUT_COUNTER.width, CHECKOUT_COUNTER.height * (1 - split)
  );
}
```

Add three sorted counter/owner layers: cropped counter back at `z = CHECKOUT_COUNTER.y`, owner at `z = SHOPKEEPER_POINT.y`, and the complementary cropped counter front at `z = CHECKOUT_COUNTER.zBase`. Customers remain sorted by their foot Y. The two counter crops must not overlap, preventing alpha edges from being composited twice. This makes a queued customer draw in front of the counter while the shopkeeper remains behind its front panel.

- [ ] **Step 4: Run scene tests and verify GREEN**

Run: `node --test tests/game-scene.test.mjs`

Expected: all scene tests PASS and each shelf image is drawn exactly once.

### Task 3: Regression and visual verification

**Files:**
- Modify only if a test exposes a regression.

- [ ] **Step 1: Run the complete front-end suite**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the structural verifier**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-snack-shop-game.ps1`

Expected: `Snack shop game structure verification passed.`

- [ ] **Step 3: Run the Spring test suite**

Run from an ASCII-only substituted drive if the local Java compiler rejects the Chinese path: `subst T: "C:\Users\伟嘉\Desktop\求职\Tongshengbolg"`, then `mvn test` from `T:\`.

Expected: `BUILD SUCCESS` and zero test failures.

- [ ] **Step 4: Verify in the local browser**

Open `/game`, reset or reload the scene, and confirm: three shelves touch the rear zone, three shelves form a central island, the doorway aisle is open, the right-side checkout aisle is open, the shopkeeper's head and torso are visible, customers pass in front of the appropriate furniture, shelf clicks still select and restock correctly, and the console contains no errors.

> This workspace currently has no Git repository metadata, so commit steps are intentionally omitted; no destructive repository operation is required.
