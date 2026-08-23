/** 手账档案馆：刚性翻页、合书跳转与可访问页码菜单。 */
import {
  next,
  prev,
  clamp,
  canNext,
  canPrev,
  directionalDragProgress,
  shouldCommitTurn,
  turnAngle,
  canStartInteraction,
  pageTurnDirection,
  moveOptionIndex,
  temporaryPageData,
  fallbackDelay,
  transitionCompletionGate,
  pageMenuDecision,
  shouldUseSimpleMotion,
  shouldHandleHorizontalDrag,
  jumpTransitionTiming,
} from './notes-logic.mjs';

const TURN_MS = 700;
const { closeMs: CLOSE_MS, holdMs: HOLD_MS, openMs: OPEN_MS } = jumpTransitionTiming();
const FALLBACK_MS = 120;
const MIN_DRAG_PX = 8;
const FADE_HALF_MS = 80;

const book = document.getElementById('book');
if (!book) throw new Error('找不到 #book');

const spreads = Array.from(book.querySelectorAll('.book-spread'));
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageMenuBtn = document.getElementById('pageMenuBtn');
const pageMenu = document.getElementById('pageMenu');
const pageOptions = Array.from(document.querySelectorAll('#pageMenu .page-option'));
const monthButtons = Array.from(document.querySelectorAll('#monthIndex .mi'));
const jumpLabel = document.getElementById('jumpLabel');
const total = spreads.length;
const reducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };
const supports3d = typeof CSS !== 'undefined'
  && typeof CSS.supports === 'function'
  && CSS.supports('transform-style', 'preserve-3d');

const state = {
  currentIndex: 0,
  phase: 'idle',
  direction: null,
  progress: 0,
  targetIndex: null,
  pointerId: null,
  startX: null,
  startY: null,
  sheet: null,
  reveal: null,
  jumpToken: 0,
  jumpTransitionCleanup: null,
  fadeTimers: [],
};

init();

function init() {
  if (total === 0) return;
  book.classList.add('js');
  updateMotionMode();
  activate(0);

  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));
  pageMenuBtn?.addEventListener('click', () => setPageMenu(pageMenu?.hidden ?? true));
  pageMenuBtn?.addEventListener('keydown', onPageMenuButtonKeyDown);
  pageMenu?.addEventListener('focusout', onPageMenuFocusOut);
  pageOptions.forEach((option) => {
    option.addEventListener('click', () => selectPageOption(option));
    option.addEventListener('keydown', onPageOptionKeyDown);
  });
  monthButtons.forEach((button) => {
    button.addEventListener('click', () => jumpTo(Number(button.dataset.index), button.dataset.month));
  });

  book.addEventListener('pointerdown', onPointerDown);
  book.addEventListener('pointermove', onPointerMove);
  book.addEventListener('pointerup', onPointerUp);
  book.addEventListener('pointercancel', onPointerCancel);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);
  reducedMotion.addEventListener?.('change', onMotionPreferenceChange);
}

function usesSimpleMotion() {
  return shouldUseSimpleMotion(reducedMotion.matches, supports3d);
}

function updateMotionMode() {
  book.classList.toggle('simple-motion', usesSimpleMotion());
}

function onMotionPreferenceChange() {
  updateMotionMode();
  if (!usesSimpleMotion() || state.phase === 'idle') return;
  const target = Number.isInteger(state.targetIndex) ? state.targetIndex : state.currentIndex;
  state.jumpToken += 1;
  state.jumpTransitionCleanup?.();
  clearFadeTimers();
  state.sheet?.remove();
  state.reveal?.remove();
  book.classList.remove('jumping', 'jump-closing', 'jump-closed', 'jump-opening', 'notes-fading');
  activate(target);
  if (jumpLabel) jumpLabel.textContent = '';
  resetInteractionState();
}

/** 激活第 i 组摊开书页，并同步所有导航状态。 */
function activate(i) {
  state.currentIndex = clamp(i, total);
  spreads.forEach((spread, index) => {
    const active = index === state.currentIndex;
    spread.classList.toggle('active', active);
    spread.setAttribute('aria-hidden', String(!active));
  });
  if (prevBtn) prevBtn.disabled = !canPrev(state.currentIndex);
  if (nextBtn) nextBtn.disabled = !canNext(state.currentIndex, total);
  if (pageMenuBtn) pageMenuBtn.textContent = `第 ${state.currentIndex + 1} / ${total} 页`;
  pageOptions.forEach((option) => {
    const selected = Number(option.dataset.index) === state.currentIndex;
    option.setAttribute('aria-selected', String(selected));
    option.tabIndex = selected ? 0 : -1;
  });
  monthButtons.forEach((button) => {
    button.classList.toggle('on', Number(button.dataset.index) === state.currentIndex);
  });
}

function step(direction) {
  if (!canStartInteraction(state.phase)) return;
  const target = direction < 0
    ? prev(state.currentIndex, total)
    : next(state.currentIndex, total);
  if (target !== state.currentIndex) autoTurn(target);
}

function autoTurn(target) {
  if (usesSimpleMotion()) {
    fadeTo(target);
    return;
  }
  state.phase = 'settling';
  state.direction = target > state.currentIndex ? 'next' : 'prev';
  state.progress = 0;
  state.targetIndex = target;
  const layers = buildTurnLayers(state.currentIndex, target, state.direction);
  state.sheet = layers.sheet;
  state.reveal = layers.reveal;
  spreads[state.currentIndex].append(layers.reveal, layers.sheet);
  setSheetProgress(0);
  settleSheet(true);
}

function onPointerDown(event) {
  if (!canStartInteraction(state.phase)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest('a, button')) return;

  const rect = book.getBoundingClientRect();
  const direction = pageTurnDirection(
    event.clientX,
    rect.left,
    rect.width,
    state.currentIndex,
    total,
  );
  if (!direction) return;

  const target = direction === 'next'
    ? next(state.currentIndex, total)
    : prev(state.currentIndex, total);
  state.phase = 'dragging';
  state.direction = direction;
  state.targetIndex = target;
  state.pointerId = event.pointerId;
  state.startX = event.clientX;
  state.startY = event.clientY;
  if (usesSimpleMotion()) {
    book.setPointerCapture(event.pointerId);
    return;
  }
  const layers = buildTurnLayers(state.currentIndex, target, direction);
  state.sheet = layers.sheet;
  state.reveal = layers.reveal;
  spreads[state.currentIndex].append(layers.reveal, layers.sheet);
  setSheetProgress(0);
  book.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  const deltaX = event.clientX - state.startX;
  const deltaY = event.clientY - state.startY;
  if (Math.abs(deltaY) >= MIN_DRAG_PX && Math.abs(deltaY) >= Math.abs(deltaX)) {
    cancelPreparedTurnImmediate();
    return;
  }
  const halfBookWidth = book.getBoundingClientRect().width / 2;
  setSheetProgress(directionalDragProgress(
    state.direction,
    deltaX,
    halfBookWidth,
  ));
  if (shouldHandleHorizontalDrag(deltaX, deltaY, MIN_DRAG_PX) && event.cancelable) {
    event.preventDefault();
  }
}

function onPointerUp(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  const deltaX = event.clientX - state.startX;
  const deltaY = event.clientY - state.startY;
  if (!shouldHandleHorizontalDrag(deltaX, deltaY, MIN_DRAG_PX)) {
    cancelPreparedTurnImmediate();
    return;
  }
  if (event.cancelable) event.preventDefault();
  releasePointerCapture(event.pointerId);
  if (usesSimpleMotion()) {
    if (shouldCommitTurn(state.progress)) {
      const fadeTarget = state.targetIndex;
      resetInteractionState();
      fadeTo(fadeTarget);
    } else {
      cancelPreparedTurnImmediate();
    }
    return;
  }
  settleSheet(shouldCommitTurn(state.progress));
}

function onPointerCancel(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  releasePointerCapture(event.pointerId);
  settleSheet(false);
}

function releasePointerCapture(pointerId) {
  if (book.hasPointerCapture(pointerId)) book.releasePointerCapture(pointerId);
  state.pointerId = null;
}

function cancelPreparedTurnImmediate() {
  if (state.pointerId != null) releasePointerCapture(state.pointerId);
  state.sheet?.remove();
  state.reveal?.remove();
  activate(state.currentIndex);
  resetInteractionState();
}

function settleSheet(commit) {
  const sheet = state.sheet;
  const target = commit ? state.targetIndex : state.currentIndex;
  if (!sheet) {
    finishTurn(target);
    return;
  }
  state.phase = 'settling';
  let finished = false;
  let timeoutId;
  const onTransitionEnd = (event) => {
    if (event.target === sheet && event.propertyName === 'transform') finish();
  };
  const cleanup = () => {
    clearTimeout(timeoutId);
    sheet.removeEventListener('transitionend', onTransitionEnd);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    finishTurn(target);
  };
  sheet.addEventListener('transitionend', onTransitionEnd);
  void sheet.offsetWidth;
  sheet.classList.add('animate');
  requestAnimationFrame(() => setSheetProgress(commit ? 1 : 0));
  timeoutId = setTimeout(finish, fallbackDelay(TURN_MS, FALLBACK_MS));
}

function buildTurnLayers(fromIndex, targetIndex, direction) {
  const isNext = direction === 'next';
  const frontSide = isNext ? 'right' : 'left';
  const backSide = isNext ? 'left' : 'right';
  const revealSide = isNext ? 'right' : 'left';
  const sheet = document.createElement('div');
  sheet.className = `turning-sheet ${direction}`;
  sheet.append(
    face(pageData(fromIndex, frontSide), 'front', frontSide),
    face(pageData(targetIndex, backSide), 'back', backSide),
  );
  const reveal = document.createElement('div');
  reveal.className = `reveal-layer ${direction}`;
  reveal.append(face(pageData(targetIndex, revealSide), 'front', revealSide));
  makeTemporaryLayerInert(sheet);
  makeTemporaryLayerInert(reveal);
  return { sheet, reveal };
}

function makeTemporaryLayerInert(layer) {
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
    element.setAttribute('tabindex', '-1');
  });
}

function setSheetProgress(progress) {
  state.progress = progress;
  if (!state.sheet) return;
  state.sheet.style.setProperty('--turn-progress', String(progress));
  state.sheet.style.transform = `rotateY(${turnAngle(state.direction, progress)}deg)`;
}

/** 合拢、在完全闭合时换页、短暂停顿，再打开。 */
function jumpTo(i, label) {
  if (!canStartInteraction(state.phase)) return;
  const target = clamp(i, total);
  if (target === state.currentIndex) return;

  if (usesSimpleMotion()) {
    if (jumpLabel) jumpLabel.textContent = `翻到 · ${label || `第 ${target + 1} 页`}`;
    fadeTo(target);
    return;
  }

  const token = ++state.jumpToken;
  state.targetIndex = target;
  state.phase = 'closing';
  if (jumpLabel) jumpLabel.textContent = `翻到 · ${label || `第 ${target + 1} 页`}`;

  const closingElements = [
    ...spreads[state.currentIndex].querySelectorAll('.book-page'),
    ...book.querySelectorAll(':scope > .book-cover'),
  ];
  const completeClose = () => {
    if (!isCurrentJump(token, target) || state.phase !== 'closing') return;
    state.phase = 'closed';
    book.classList.remove('jump-closing');
    book.classList.add('jump-closed');
    activate(target);

    setTimeout(() => {
      if (!isCurrentJump(token, target)) return;
      state.phase = 'opening';
      const targetSpread = spreads[target];
      const openingElements = [
        ...targetSpread.querySelectorAll('.book-page'),
        ...book.querySelectorAll(':scope > .book-cover'),
      ];
      state.jumpTransitionCleanup = watchTransformTransitions(
        openingElements,
        () => finishJump(token, target),
        OPEN_MS,
      );
      book.classList.remove('jump-closed');
      book.classList.add('jump-opening');
    }, HOLD_MS);
  };
  state.jumpTransitionCleanup = watchTransformTransitions(
    closingElements,
    completeClose,
    CLOSE_MS,
  );
  book.classList.add('jumping', 'jump-closing');

  setTimeout(
    () => finishJump(token, target),
    fallbackDelay(CLOSE_MS + HOLD_MS + OPEN_MS, FALLBACK_MS),
  );
}

function fadeTo(target) {
  const safeTarget = clamp(target, total);
  if (safeTarget === state.currentIndex || !canStartInteraction(state.phase)) return;
  clearFadeTimers();
  state.phase = 'settling';
  state.targetIndex = safeTarget;
  book.classList.add('notes-fading');
  state.fadeTimers.push(setTimeout(() => {
    activate(safeTarget);
    book.classList.remove('notes-fading');
    state.fadeTimers.push(setTimeout(() => {
      if (jumpLabel) jumpLabel.textContent = '';
      resetInteractionState();
    }, FADE_HALF_MS));
  }, FADE_HALF_MS));
}

function clearFadeTimers() {
  state.fadeTimers.forEach((timer) => clearTimeout(timer));
  state.fadeTimers = [];
}

function watchTransformTransitions(elements, onDone, duration) {
  const keys = elements.map((_, index) => String(index));
  const listeners = [];
  let timeoutId;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timeoutId);
    listeners.forEach(({ element, listener }) => {
      element.removeEventListener('transitionend', listener);
    });
  };
  const finish = () => {
    cleanup();
    onDone();
  };
  const gate = transitionCompletionGate(keys, finish);
  elements.forEach((element, index) => {
    const listener = (event) => {
      if (event.target === element && event.propertyName === 'transform') {
        gate.accept(String(index));
      }
    };
    listeners.push({ element, listener });
    element.addEventListener('transitionend', listener);
  });
  timeoutId = setTimeout(finish, fallbackDelay(duration, FALLBACK_MS));
  return cleanup;
}

function isCurrentJump(token, target) {
  return state.jumpToken === token
    && state.targetIndex === target
    && state.phase !== 'idle';
}

function finishJump(token, target) {
  if (!isCurrentJump(token, target)) return;
  state.jumpTransitionCleanup?.();
  state.jumpTransitionCleanup = null;
  activate(target);
  book.classList.remove('jumping', 'jump-closing', 'jump-closed', 'jump-opening');
  if (jumpLabel) jumpLabel.textContent = '';
  resetInteractionState();
}

function finishTurn(target) {
  state.sheet?.remove();
  state.reveal?.remove();
  activate(target);
  resetInteractionState();
}

function resetInteractionState() {
  state.phase = 'idle';
  state.direction = null;
  state.progress = 0;
  state.targetIndex = null;
  state.pointerId = null;
  state.startX = null;
  state.startY = null;
  state.sheet = null;
  state.reveal = null;
  state.jumpTransitionCleanup = null;
  clearFadeTimers();
}

function setPageMenu(open, restoreFocus = false) {
  if (!pageMenu || !pageMenuBtn) return;
  pageMenu.hidden = !open;
  pageMenuBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    const selected = pageOptions.find(
      (option) => Number(option.dataset.index) === state.currentIndex,
    );
    focusPageOption(pageOptions.indexOf(selected));
  } else if (restoreFocus) {
    pageMenuBtn.focus();
  }
}

function focusPageOption(index) {
  if (index < 0 || index >= pageOptions.length) return;
  pageOptions.forEach((option, optionIndex) => {
    option.tabIndex = optionIndex === index ? 0 : -1;
  });
  pageOptions[index].focus();
}

function selectPageOption(option) {
  const target = Number(option.dataset.index);
  const label = option.textContent.trim();
  setPageMenu(false, true);
  jumpTo(target, label);
}

function onPageMenuButtonKeyDown(event) {
  const navigationKeys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
  if (event.key === 'Escape') {
    setPageMenu(false, true);
    event.preventDefault();
  } else if (navigationKeys.includes(event.key)) {
    setPageMenu(true);
    const target = moveOptionIndex(state.currentIndex, pageOptions.length, event.key);
    focusPageOption(target);
    event.preventDefault();
  }
}

function onPageOptionKeyDown(event) {
  const current = pageOptions.indexOf(event.currentTarget);
  const navigationKeys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
  if (navigationKeys.includes(event.key)) {
    const target = moveOptionIndex(current, pageOptions.length, event.key);
    focusPageOption(target);
    event.preventDefault();
  } else if (event.key === 'Enter' || event.key === ' ') {
    selectPageOption(event.currentTarget);
    event.preventDefault();
  } else if (event.key === 'Escape') {
    setPageMenu(false, true);
    event.preventDefault();
  } else {
    const decision = pageMenuDecision('keydown', event.key, true);
    if (decision.close) setPageMenu(false, decision.restoreFocus);
  }
}

function onPageMenuFocusOut(event) {
  const focusRemainsInside = event.relatedTarget instanceof Node
    && pageMenu.contains(event.relatedTarget);
  const decision = pageMenuDecision('focusout', '', focusRemainsInside);
  if (decision.close) setPageMenu(false, decision.restoreFocus);
}

function onDocumentPointerDown(event) {
  if (pageMenu?.hidden) return;
  const picker = pageMenuBtn?.closest('.page-picker');
  if (!picker?.contains(event.target)) setPageMenu(false, true);
}

function onDocumentKeyDown(event) {
  if (event.defaultPrevented) return;
  const menuDecision = pageMenuDecision('keydown', event.key, false);
  if (!pageMenu?.hidden && menuDecision.close) {
    setPageMenu(false, menuDecision.restoreFocus);
    event.preventDefault();
    return;
  }
  if (!pageMenu?.hidden) return;
  if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
  if (event.key === 'ArrowRight') {
    step(1);
    event.preventDefault();
  } else if (event.key === 'ArrowLeft') {
    step(-1);
    event.preventDefault();
  }
}

function pageData(spreadIndex, side) {
  const page = spreads[spreadIndex]?.querySelector(`.book-page.${side}`);
  const inner = page?.querySelector('.page-inner');
  return temporaryPageData(inner?.innerHTML ?? null, page?.classList.contains('empty') ?? false);
}

function face(page, faceClass, side) {
  const element = document.createElement('div');
  element.className = `turn-face ${faceClass} ${side}`;
  if (page.empty) element.classList.add('empty');
  const inner = document.createElement('div');
  inner.className = 'page-inner';
  inner.innerHTML = page.html ?? '<div class="cover-text">未完待续 ✎</div>';
  element.appendChild(inner);
  return element;
}
