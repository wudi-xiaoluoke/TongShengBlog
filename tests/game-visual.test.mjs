import test from 'node:test';
import assert from 'node:assert/strict';
import * as scene from '../src/main/resources/static/js/game/game-scene.mjs';
import { createInitialState } from '../src/main/resources/static/js/game/game-state.mjs';
import { buildWorld } from '../src/main/resources/static/js/game/game-world.mjs';
import { PRODUCTS, shopPlanogram } from '../src/main/resources/static/js/game/game-config.mjs';

test('display allocations expose all four rows and never duplicate stock across cabinets', () => {
  assert.equal(typeof scene.shelfDisplayCells, 'function');
  const state = createInitialState(0);
  state.cabinetCount = 10;
  state.shelves = Object.keys(PRODUCTS);
  const plan = shopPlanogram(state);
  const cells = scene.shelfDisplayCells(state, plan);
  assert.equal(cells.length, 10);
  assert.ok(cells.every(cabinet => cabinet.length === 4 && cabinet.every(row => row.length === 3)));
  for (const id of state.shelves) {
    assert.equal(cells.flat(2).filter(cell => cell.productId === id).reduce((n, cell) => n + cell.quantity, 0), state.shelfInventory[id] ?? 0);
  }
});

test('season and game time alter ambience without altering world geometry', () => {
  assert.equal(typeof scene.sceneEnvironment, 'function');
  const state = createInitialState(0);
  const geometry = JSON.stringify(buildWorld(state).furniture);
  const skies = new Set();
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const hour of [9, 12, 16, 18, 20]) {
      state.season = { id: season };
      state.day.elapsedMs = (hour - 9) / 12 * 180000;
      const env = scene.sceneEnvironment(state);
      skies.add(env.sky);
      assert.equal(env.season, season);
      assert.ok(env.interiorShade <= 0.16, 'the open store remains readable at night');
      assert.equal(JSON.stringify(buildWorld(state).furniture), geometry);
    }
  }
  assert.ok(skies.size >= 4);
});

test('weather samples are deterministic and stay in exterior regions', () => {
  assert.equal(typeof scene.weatherPixels, 'function');
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const pixels = scene.weatherPixels(season, 12345);
    assert.deepEqual(scene.weatherPixels(season, 12345), pixels);
    assert.ok(pixels.every(({x,y}) => y >= 444 || (x >= 226 && x <= 412 && y >= 8 && y <= 64)));
  }
});

test('scarce stock is visible at the primary cabinet visited by customers', () => {
  const state=createInitialState(0),plan=shopPlanogram(state),cells=scene.shelfDisplayCells(state,plan);
  for(const id of ['candy','chips']) {
    const primary=plan.primaryCabinet.get(id);
    assert.ok(cells[primary].flat().some(c=>c.productId===id&&c.quantity>0),`${id} must be visible where customers pick it up`);
  }
});
