import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  clamp,
  next,
  prev,
  canNext,
  canPrev,
  dragProgress,
  shouldCommitTurn,
  turnAngle,
  canStartInteraction,
  monthToSpreadIndex,
  pageTurnDirection,
  moveOptionIndex,
  temporaryPageData,
  directionalDragProgress,
  fallbackDelay,
  transitionCompletionGate,
  pageMenuDecision,
  shouldUseSimpleMotion,
  shouldHandleHorizontalDrag,
  isCurrentInteraction,
  jumpTransitionTiming,
} from '../src/main/resources/static/js/notes-logic.mjs';

test('jump close hides page faces edge-on while the book is closed', () => {
  const css = readFileSync(
    new URL('../src/main/resources/static/css/notes.css', import.meta.url),
    'utf8',
  );

  assert.match(css, /\.book\.js\.jump-closing \.book-page\.left,[\s\S]*?\.book\.js\.jump-closed \.book-cover\.left\s*\{\s*transform:\s*rotateY\(90deg\);\s*\}/);
  assert.match(css, /\.book\.js\.jump-closing \.book-page\.right,[\s\S]*?\.book\.js\.jump-closed \.book-cover\.right\s*\{\s*transform:\s*rotateY\(-90deg\);\s*\}/);
  assert.match(css, /\.book\.js\.jump-closed \.book-page,\s*\.book\.js\.jump-closed \.book-cover\s*\{[^}]*transition:\s*none;[^}]*opacity:\s*0;[^}]*\}/);
});

test('clamps an index into the valid range', () => {
  assert.equal(clamp(0, 5), 0);
  assert.equal(clamp(4, 5), 4);
  assert.equal(clamp(-1, 5), 0);
  assert.equal(clamp(9, 5), 4);
  assert.equal(clamp(0, 0), 0);
  assert.equal(clamp(3, 1), 0);
});

test('next moves toward older months and stops at the last spread', () => {
  assert.equal(next(0, 5), 1);
  assert.equal(next(3, 5), 4);
  assert.equal(next(4, 5), 4);
});

test('prev moves toward newer months and stops at the first spread', () => {
  assert.equal(prev(4, 5), 3);
  assert.equal(prev(1, 5), 0);
  assert.equal(prev(0, 5), 0);
});

test('canNext / canPrev report the book edges', () => {
  assert.equal(canNext(0, 5), true);
  assert.equal(canNext(4, 5), false);
  assert.equal(canPrev(0, 5), false);
  assert.equal(canPrev(4, 5), true);
  assert.equal(canNext(0, 0), false);
  assert.equal(canPrev(0, 0), false);
});

test('calculates normalized drag progress', () => {
  assert.equal(dragProgress(0, 400), 0);
  assert.equal(dragProgress(-180, 400), 0.45);
  assert.equal(dragProgress(600, 400), 1);
  assert.equal(dragProgress(20, 0), 1);
});

test('commits a turn at or above the threshold', () => {
  assert.equal(shouldCommitTurn(0.449), false);
  assert.equal(shouldCommitTurn(0.45), true);
  assert.equal(shouldCommitTurn(1), true);
  assert.equal(shouldCommitTurn(2, 1.1), false);
  assert.equal(shouldCommitTurn(-1, 0), true);
});

test('calculates turn angles by direction and progress', () => {
  assert.equal(turnAngle('next', 0), 0);
  assert.equal(turnAngle('next', 0.5), -90);
  assert.equal(turnAngle('next', 1), -180);
  assert.equal(turnAngle('prev', 0.5), 90);
});

test('starts interactions only while idle', () => {
  assert.equal(canStartInteraction('idle'), true);
  for (const phase of ['dragging', 'settling', 'closing', 'closed', 'opening']) {
    assert.equal(canStartInteraction(phase), false);
  }
});

test('finds the spread containing a month', () => {
  const spreads = [['2026.08', '2026.07'], ['2026.06', '2026.05'], ['2026.04']];

  assert.equal(monthToSpreadIndex('2026.08', spreads), 0);
  assert.equal(monthToSpreadIndex('2026.05', spreads), 1);
  assert.equal(monthToSpreadIndex('2026.04', spreads), 2);
  assert.equal(monthToSpreadIndex('missing', spreads), -1);
});

test('chooses a turn direction from the clicked half and respects book edges', () => {
  assert.equal(pageTurnDirection(499, 100, 800, 2, 5), 'prev');
  assert.equal(pageTurnDirection(500, 100, 800, 2, 5), 'next');
  assert.equal(pageTurnDirection(120, 100, 800, 0, 5), null);
  assert.equal(pageTurnDirection(880, 100, 800, 4, 5), null);
});

test('moves a listbox focus index with arrows, Home, and End', () => {
  assert.equal(moveOptionIndex(1, 4, 'ArrowDown'), 2);
  assert.equal(moveOptionIndex(1, 4, 'ArrowRight'), 2);
  assert.equal(moveOptionIndex(1, 4, 'ArrowUp'), 0);
  assert.equal(moveOptionIndex(1, 4, 'ArrowLeft'), 0);
  assert.equal(moveOptionIndex(2, 4, 'Home'), 0);
  assert.equal(moveOptionIndex(1, 4, 'End'), 3);
  assert.equal(moveOptionIndex(3, 4, 'ArrowDown'), 3);
  assert.equal(moveOptionIndex(0, 4, 'ArrowUp'), 0);
  assert.equal(moveOptionIndex(2, 4, 'PageDown'), 2);
  assert.equal(moveOptionIndex(2, 0, 'Home'), 0);
});

test('preserves source empty metadata for temporary turning faces', () => {
  assert.deepEqual(temporaryPageData('<div>未完待续</div>', true), {
    html: '<div>未完待续</div>',
    empty: true,
  });
  assert.deepEqual(temporaryPageData('<div>正文</div>', false), {
    html: '<div>正文</div>',
    empty: false,
  });
  assert.deepEqual(temporaryPageData(null, false), {
    html: null,
    empty: true,
  });
});

test('only advances drag progress toward the chosen page turn direction', () => {
  assert.equal(directionalDragProgress('next', -180, 400), 0.45);
  assert.equal(directionalDragProgress('next', 180, 400), 0);
  assert.equal(directionalDragProgress('prev', 180, 400), 0.45);
  assert.equal(directionalDragProgress('prev', -180, 400), 0);
});

test('always pads animation fallback timeouts beyond their CSS durations', () => {
  assert.equal(fallbackDelay(420, 120), 540);
  assert.equal(fallbackDelay(480, 120), 600);
  assert.ok(fallbackDelay(700, 1) > 700);
});

test('completes a transition gate once after every unique expected key', () => {
  let completions = 0;
  const gate = transitionCompletionGate(['page-left', 'page-right', 'cover-left'], () => {
    completions += 1;
  });

  assert.equal(gate.accept('page-left'), false);
  assert.equal(gate.accept('page-left'), false);
  assert.equal(gate.accept('unknown'), false);
  assert.equal(gate.accept('page-right'), false);
  assert.equal(gate.accept('cover-left'), true);
  assert.equal(gate.accept('cover-left'), false);
  assert.equal(completions, 1);
});

test('decides Escape, Tab, and focusout menu closure behavior', () => {
  assert.deepEqual(pageMenuDecision('keydown', 'Escape', true), {
    close: true,
    restoreFocus: true,
  });
  assert.deepEqual(pageMenuDecision('keydown', 'Tab', true), {
    close: true,
    restoreFocus: false,
  });
  assert.deepEqual(pageMenuDecision('focusout', '', false), {
    close: true,
    restoreFocus: false,
  });
  assert.deepEqual(pageMenuDecision('focusout', '', true), {
    close: false,
    restoreFocus: false,
  });
});

test('uses a simple fade when motion is reduced or 3D transforms are unavailable', () => {
  assert.equal(shouldUseSimpleMotion(false, true), false);
  assert.equal(shouldUseSimpleMotion(true, true), true);
  assert.equal(shouldUseSimpleMotion(false, false), true);
  assert.equal(shouldUseSimpleMotion(true, false), true);
});

test('only treats a deliberate horizontal gesture as a page drag', () => {
  assert.equal(shouldHandleHorizontalDrag(7, 0, 8), false);
  assert.equal(shouldHandleHorizontalDrag(8, 1, 8), true);
  assert.equal(shouldHandleHorizontalDrag(8, 12, 8), false);
  assert.equal(shouldHandleHorizontalDrag(-20, 4, 8), true);
  assert.equal(shouldHandleHorizontalDrag(0, 40, 8), false);
});

test('accepts animation completion only for the current token and sheet', () => {
  const sheet = {};
  const replacement = {};

  assert.equal(isCurrentInteraction(4, 4, sheet, sheet), true);
  assert.equal(isCurrentInteraction(3, 4, sheet, sheet), false);
  assert.equal(isCurrentInteraction(4, 4, sheet, replacement), false);
  assert.equal(isCurrentInteraction(4, 4, sheet, null), false);
});

test('confirmed close uses the notes book jump transition timing', () => {
  assert.deepEqual(jumpTransitionTiming(), {
    closeMs: 380,
    holdMs: 220,
    openMs: 430,
  });
});
