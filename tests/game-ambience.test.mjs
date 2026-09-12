import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_LENGTH_MS,
  DAY_PHASES,
  dayPhaseFor,
  maxCustomersFor,
  seasonForDate,
  spawnIntervalMs
} from '../src/main/resources/static/js/game/game-config.mjs';
import {
  advanceDay,
  createInitialState,
  restoreState,
  serializeState
} from '../src/main/resources/static/js/game/game-state.mjs';

test('dayPhaseFor splits the business day into five phases and dawn', () => {
  assert.equal(dayPhaseFor(9).id, 'morning');
  assert.equal(dayPhaseFor(10).id, 'morning');
  assert.equal(dayPhaseFor(11).id, 'noon');
  assert.equal(dayPhaseFor(13).id, 'noon');
  assert.equal(dayPhaseFor(14).id, 'afternoon');
  assert.equal(dayPhaseFor(16).id, 'afternoon');
  assert.equal(dayPhaseFor(17).id, 'dusk');
  assert.equal(dayPhaseFor(18).id, 'dusk');
  assert.equal(dayPhaseFor(19).id, 'night');
  assert.equal(dayPhaseFor(20).id, 'night');
  // 打烊后与开门前都算凌晨
  assert.equal(dayPhaseFor(21).id, 'dawn');
  assert.equal(dayPhaseFor(3).id, 'dawn');
});

test('dayPhaseFor phases tile the whole business day without gaps', () => {
  for (let hour = 9; hour < 21; hour += 1) {
    const phase = dayPhaseFor(hour);
    assert.notEqual(phase.id, 'dawn');
    assert.ok(hour >= phase.startHour && hour < phase.endHour);
  }
  assert.equal(DAY_PHASES.length, 5);
});

test('seasonForDate maps real months onto the four seasons', () => {
  assert.equal(seasonForDate(new Date(2026, 2, 15)).id, 'spring');   // 3 月
  assert.equal(seasonForDate(new Date(2026, 4, 31)).id, 'spring');   // 5 月末
  assert.equal(seasonForDate(new Date(2026, 5, 1)).id, 'summer');    // 6 月
  assert.equal(seasonForDate(new Date(2026, 7, 20)).id, 'summer');   // 8 月
  assert.equal(seasonForDate(new Date(2026, 8, 5)).id, 'autumn');    // 9 月
  assert.equal(seasonForDate(new Date(2026, 10, 8)).id, 'autumn');   // 11 月
  assert.equal(seasonForDate(new Date(2026, 11, 31)).id, 'winter');  // 12 月
  assert.equal(seasonForDate(new Date(2026, 0, 10)).id, 'winter');   // 1 月
  assert.equal(seasonForDate(new Date(2026, 1, 5)).id, 'winter');    // 2 月
});

test('spawn interval reacts to phase and season multipliers', () => {
  const noon = dayPhaseFor(12);
  const dusk = dayPhaseFor(18);
  const spring = seasonForDate(new Date(2026, 3, 1));
  const winter = seasonForDate(new Date(2026, 0, 1));
  // 中午（高峰 ×0.6）春天 → 6s
  assert.equal(spawnIntervalMs(10_000, noon, spring), 6_000);
  // 同样中午，冬天（×0.85 客流）更稀疏
  assert.equal(spawnIntervalMs(10_000, noon, winter), Math.round(10_000 * 0.6 / 0.85));
  // 傍晚（低谷 ×1.3）夏天（×1.15）最稀疏
  const summer = seasonForDate(new Date(2026, 6, 1));
  assert.equal(spawnIntervalMs(10_000, dusk, summer), Math.round(10_000 * 1.3 / 1.15));
  // 极小基础间隔被 2.5s 下限兜住
  assert.equal(spawnIntervalMs(500, noon, spring), 2_500);
});

test('in-store customer cap follows phase crowd factor', () => {
  const noon = dayPhaseFor(12);
  const dusk = dayPhaseFor(18);
  assert.equal(maxCustomersFor(0, noon), 2);   // 基础 2 × 1.2 → 2.4 → 2
  assert.equal(maxCustomersFor(3, noon), 6);   // 基础 5 × 1.2 → 6
  assert.equal(maxCustomersFor(3, dusk), 4);   // 基础 5 × 0.7 → 3.5 → 4
  assert.equal(maxCustomersFor(0, dusk), 2);   // 下限保 2
});

test('new save carries season and day-break defaults', () => {
  const state = createInitialState(new Date(2026, 8, 5).getTime());
  assert.equal(state.season.id, 'autumn');
  assert.equal(state.season.name, '秋');
  assert.equal(state.dayBreak, false);
});

test('advanceDay settles rent, reopens the day and reports season change', () => {
  const state = createInitialState(new Date(2026, 0, 10).getTime()); // 冬
  state.coins = 500;
  state.day.revenue = 400;
  const settlement = advanceDay(state, 5_000, { date: new Date(2026, 6, 1) });
  assert.equal(settlement.dayNumber, 2);
  assert.equal(settlement.paid, true);
  assert.equal(settlement.seasonChanged, true);
  assert.equal(settlement.seasonName, '夏');
  assert.equal(state.season.id, 'summer');
  assert.equal(state.dayBreak, false);
  assert.equal(state.day.number, 2);
  assert.equal(state.day.elapsedMs, 0);
});

test('serialize/restore round-trips season, day break and clamps the day clock', () => {
  const state = createInitialState(new Date(2026, 5, 1).getTime());
  state.day.elapsedMs = DAY_LENGTH_MS + 12_345; // 异常超时（如旧档）要被夹回打烊点
  state.dayBreak = true;
  state.season = { id: 'summer', name: '夏' };
  const restored = restoreState(serializeState(state, 1_000), 1_000);
  assert.equal(restored.day.elapsedMs, DAY_LENGTH_MS);
  assert.equal(restored.dayBreak, true);
  assert.equal(restored.season.id, 'summer');
});

test('restore falls back to the restore-time month when the save season is invalid', () => {
  const state = createInitialState(new Date(2026, 8, 5).getTime());
  state.season = { id: 'not-a-season', name: '??? ' };
  const restoreAt = new Date(2026, 8, 5).getTime(); // 9 月还原 → 秋
  const restored = restoreState(serializeState(state, 1_000), restoreAt);
  assert.equal(restored.season.id, 'autumn');
});
