/** 手账书：纯逻辑，可被 Node 测试（tests/notes-book.test.mjs） */

/** 把索引限制在 [0, total-1]；total<=0 时返回 0 */
export function clamp(i, total) {
  if (total <= 0) return 0;
  if (i < 0) return 0;
  if (i > total - 1) return total - 1;
  return i;
}

/** 下一页（向后翻 = 更早的月份），到末页即停 */
export function next(i, total) {
  return clamp(i + 1, total);
}

/** 上一页（向前翻 = 更近的月份），到首页即停 */
export function prev(i, total) {
  return clamp(i - 1, total);
}

export function canPrev(i) {
  return i > 0;
}

export function canNext(i, total) {
  return i < total - 1;
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

export function dragProgress(deltaX, pageWidth) {
  return clampUnit(Math.abs(deltaX) / Math.max(1, Math.abs(pageWidth)));
}

export function directionalDragProgress(direction, deltaX, pageWidth) {
  const movesTowardTurn = direction === 'next' ? deltaX < 0 : deltaX > 0;
  return movesTowardTurn ? dragProgress(deltaX, pageWidth) : 0;
}

export function shouldCommitTurn(progress, threshold = 0.45) {
  return clampUnit(progress) >= threshold;
}

export function turnAngle(direction, progress) {
  const angle = 180 * clampUnit(progress);
  if (angle === 0) return 0;
  return direction === 'prev' ? angle : -angle;
}

export function canStartInteraction(phase) {
  return phase === 'idle';
}

export function monthToSpreadIndex(month, spreads) {
  return spreads.findIndex((spread) => spread.includes(month));
}

export function pageTurnDirection(clientX, bookLeft, bookWidth, currentIndex, total) {
  const direction = clientX < bookLeft + bookWidth / 2 ? 'prev' : 'next';
  if (direction === 'prev' && !canPrev(currentIndex)) return null;
  if (direction === 'next' && !canNext(currentIndex, total)) return null;
  return direction;
}

export function moveOptionIndex(currentIndex, total, key) {
  if (total <= 0) return 0;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  if (key === 'ArrowDown' || key === 'ArrowRight') return clamp(currentIndex + 1, total);
  if (key === 'ArrowUp' || key === 'ArrowLeft') return clamp(currentIndex - 1, total);
  return clamp(currentIndex, total);
}

export function temporaryPageData(html, sourceIsEmpty) {
  return {
    html,
    empty: sourceIsEmpty || html == null,
  };
}

export function fallbackDelay(duration, pad) {
  return duration + Math.max(1, pad);
}

export function transitionCompletionGate(expectedKeys, onDone) {
  const expected = new Set(expectedKeys);
  const seen = new Set();
  let completed = false;
  return {
    accept(key) {
      if (completed || !expected.has(key)) return false;
      seen.add(key);
      if (seen.size !== expected.size) return false;
      completed = true;
      onDone();
      return true;
    },
  };
}

export function pageMenuDecision(eventType, key, focusRemainsInside) {
  if (eventType === 'keydown' && key === 'Escape') {
    return { close: true, restoreFocus: true };
  }
  if (eventType === 'keydown' && key === 'Tab') {
    return { close: true, restoreFocus: false };
  }
  if (eventType === 'focusout' && !focusRemainsInside) {
    return { close: true, restoreFocus: false };
  }
  return { close: false, restoreFocus: false };
}

export function shouldUseSimpleMotion(reduceMotion, supports3d) {
  return Boolean(reduceMotion) || !supports3d;
}

export function shouldHandleHorizontalDrag(deltaX, deltaY, threshold = 8) {
  const horizontalDistance = Math.abs(deltaX);
  return horizontalDistance >= Math.max(0, threshold)
    && horizontalDistance > Math.abs(deltaY);
}

export function isCurrentInteraction(token, currentToken, expectedSheet, currentSheet) {
  return token === currentToken && expectedSheet != null && expectedSheet === currentSheet;
}
