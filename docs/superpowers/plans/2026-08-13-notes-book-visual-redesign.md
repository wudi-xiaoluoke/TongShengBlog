# Handwritten Book Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/notes` as a light, site-consistent illustrated book with rigid whole-sheet page turns and close-pause-open jumps to a selected spread or month.

**Architecture:** Keep the existing Spring/Thymeleaf month grouping and rendered spreads. Extend the testable JavaScript logic with drag/phase/mapping helpers, then replace the current soft-looking transition layer with one temporary double-sided rigid DOM sheet anchored to the spine. Use a separate close/closed/open state sequence for direct jumps; static content remains ordinary HTML and all motion has reduced-motion and no-JavaScript fallbacks.

**Tech Stack:** Java 21, Spring Boot 3.2, Thymeleaf, native CSS 3D transforms, native ES modules and Pointer Events, Node `node:test`, JUnit 5/MockMvc.

---

## Scope and file map

- Modify `src/main/resources/static/js/notes-logic.mjs`: pure drag progress, commit threshold, turn-angle, phase guard, and month-to-spread mapping functions.
- Modify `tests/notes-book.test.mjs`: deterministic unit tests for every new pure function and existing page boundaries.
- Modify `src/main/resources/templates/notes/index.html`: accessible page selector, individual month buttons, thick-page block, and jump label.
- Modify `src/test/java/com/tongsheng/blog/NotesBookTests.java`: template assertions for the new navigation semantics.
- Replace the presentation rules in `src/main/resources/static/css/notes.css`: site-aligned visual system, rigid page sheet, close/open sequence, mobile double-page rules, and motion fallbacks.
- Refactor `src/main/resources/static/js/notes.mjs`: one explicit interaction state, rigid auto/drag turns, jump transition, cleanup timeouts, and control synchronization.

The current workspace has no `.git` directory. Every task includes the intended commit boundary, but the commit step must be skipped unless Git metadata is restored before execution.

### Task 1: Add testable interaction math and mapping

**Files:**
- Modify: `tests/notes-book.test.mjs`
- Modify: `src/main/resources/static/js/notes-logic.mjs`

- [ ] **Step 1: Write failing tests for rigid-turn math, phase gating, and month lookup**

Replace the import in `tests/notes-book.test.mjs` and append these tests:

```js
import {
  clamp, next, prev, canNext, canPrev,
  dragProgress, shouldCommitTurn, turnAngle,
  canStartInteraction, monthToSpreadIndex
} from '../src/main/resources/static/js/notes-logic.mjs';

test('drag progress is absolute, width-relative, and clamped', () => {
  assert.equal(dragProgress(0, 400), 0);
  assert.equal(dragProgress(-180, 400), 0.45);
  assert.equal(dragProgress(600, 400), 1);
  assert.equal(dragProgress(20, 0), 1);
});

test('a rigid turn commits at the 45 percent threshold', () => {
  assert.equal(shouldCommitTurn(0.449), false);
  assert.equal(shouldCommitTurn(0.45), true);
  assert.equal(shouldCommitTurn(1), true);
});

test('turn angle keeps the sheet rigid and follows direction', () => {
  assert.equal(turnAngle('next', 0), 0);
  assert.equal(turnAngle('next', 0.5), -90);
  assert.equal(turnAngle('next', 1), -180);
  assert.equal(turnAngle('prev', 0.5), 90);
});

test('only idle phase accepts a new interaction', () => {
  assert.equal(canStartInteraction('idle'), true);
  for (const phase of ['dragging', 'settling', 'closing', 'closed', 'opening']) {
    assert.equal(canStartInteraction(phase), false);
  }
});

test('month lookup returns the spread containing that month', () => {
  const spreadMonths = [
    ['2026.08', '2026.07'],
    ['2026.06', '2026.05'],
    ['2026.04']
  ];
  assert.equal(monthToSpreadIndex('2026.08', spreadMonths), 0);
  assert.equal(monthToSpreadIndex('2026.05', spreadMonths), 1);
  assert.equal(monthToSpreadIndex('2026.04', spreadMonths), 2);
  assert.equal(monthToSpreadIndex('2024.01', spreadMonths), -1);
});
```

- [ ] **Step 2: Run the Node test and verify the new imports fail**

Run:

```powershell
node --test tests/notes-book.test.mjs
```

Expected: FAIL because `dragProgress`, `shouldCommitTurn`, `turnAngle`, `canStartInteraction`, and `monthToSpreadIndex` are not exported.

- [ ] **Step 3: Implement the minimal pure functions**

Append to `src/main/resources/static/js/notes-logic.mjs`:

```js
function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

export function dragProgress(deltaX, pageWidth) {
  const safeWidth = Math.max(1, Math.abs(pageWidth));
  return clampUnit(Math.abs(deltaX) / safeWidth);
}

export function shouldCommitTurn(progress, threshold = 0.45) {
  return clampUnit(progress) >= threshold;
}

export function turnAngle(direction, progress) {
  const sign = direction === 'prev' ? 1 : -1;
  return sign * 180 * clampUnit(progress);
}

export function canStartInteraction(phase) {
  return phase === 'idle';
}

export function monthToSpreadIndex(month, spreadMonths) {
  return spreadMonths.findIndex((months) => months.includes(month));
}
```

- [ ] **Step 4: Run the Node test and verify all logic tests pass**

Run:

```powershell
node --test tests/notes-book.test.mjs
```

Expected: all existing and new tests PASS.

- [ ] **Step 5: Commit the interaction logic boundary if Git is available**

```powershell
git add tests/notes-book.test.mjs src/main/resources/static/js/notes-logic.mjs
git commit -m "test: define rigid notes book interactions"
```

### Task 2: Add accessible direct-jump controls to the template

**Files:**
- Modify: `src/test/java/com/tongsheng/blog/NotesBookTests.java`
- Modify: `src/main/resources/templates/notes/index.html:24-114`

- [ ] **Step 1: Strengthen the MockMvc template contract**

Add these expectations to `notesPageRendersWithMonthsAndArticleLinks()` after the existing assertions:

```java
.andExpect(content().string(containsString("id=\"pageMenuBtn\"")))
.andExpect(content().string(containsString("id=\"pageMenu\"")))
.andExpect(content().string(containsString("class=\"page-option\"")))
.andExpect(content().string(containsString("class=\"mi")))
.andExpect(content().string(containsString("data-month=")))
.andExpect(content().string(containsString("book-page-block")))
.andExpect(content().string(containsString("jump-label")));
```

- [ ] **Step 2: Run the focused Java test and verify it fails**

Run:

```powershell
mvn -Dtest=NotesBookTests#notesPageRendersWithMonthsAndArticleLinks test
```

Expected: FAIL because the page menu, individual-month controls, page block, and jump label do not exist.

- [ ] **Step 3: Add book depth and jump-status elements**

Inside `#book`, immediately after `.book-spine`, add:

```html
<span class="book-page-block" aria-hidden="true"></span>
<span class="jump-label" id="jumpLabel" aria-live="polite"></span>
```

- [ ] **Step 4: Replace the static indicator with a page-menu button and list**

Replace the current `.page-indicator` span with:

```html
<div class="page-picker">
  <button class="page-indicator" id="pageMenuBtn" type="button"
          aria-haspopup="listbox" aria-expanded="false" aria-controls="pageMenu">
    第 1 / 1 页
  </button>
  <div class="page-menu" id="pageMenu" role="listbox" hidden>
    <button class="page-option" type="button" role="option"
            th:each="sp, st : ${spreads}"
            th:attr="data-index=${st.index},aria-label=${sp.hasRight() ? ('第 ' + (st.index + 1) + ' 页，' + sp.left.monthLabel + ' 至 ' + sp.right.monthLabel) : ('第 ' + (st.index + 1) + ' 页，' + sp.left.monthLabel)}"
            th:text="${sp.hasRight() ? ('第 ' + (st.index + 1) + ' 页 · ' + sp.left.shortLabel + ' / ' + sp.right.shortLabel) : ('第 ' + (st.index + 1) + ' 页 · ' + sp.left.shortLabel)}">
      第 1 页 · 2026.08 / 2026.07
    </button>
  </div>
</div>
```

- [ ] **Step 5: Render one focusable button per month**

Replace the existing paired `.mi` span loop with:

```html
<nav class="month-index" id="monthIndex" aria-label="月份索引" th:if="${not #lists.isEmpty(spreads)}">
  <th:block th:each="sp, st : ${spreads}">
    <button class="mi" type="button"
            th:attr="data-index=${st.index},data-month=${sp.left.shortLabel},aria-label=${'跳到 ' + sp.left.monthLabel}"
            th:classappend="${st.first} ? 'on'"
            th:text="${sp.left.shortLabel}">2026.08</button>
    <button class="mi" type="button" th:if="${sp.hasRight()}"
            th:attr="data-index=${st.index},data-month=${sp.right.shortLabel},aria-label=${'跳到 ' + sp.right.monthLabel}"
            th:classappend="${st.first} ? 'on'"
            th:text="${sp.right.shortLabel}">2026.07</button>
  </th:block>
</nav>
```

- [ ] **Step 6: Run the focused Java test and verify it passes**

Run:

```powershell
mvn -Dtest=NotesBookTests#notesPageRendersWithMonthsAndArticleLinks test
```

Expected: PASS.

- [ ] **Step 7: Commit the navigation markup boundary if Git is available**

```powershell
git add src/test/java/com/tongsheng/blog/NotesBookTests.java src/main/resources/templates/notes/index.html
git commit -m "feat: add direct notes book navigation"
```

### Task 3: Rebuild the static book visual in the site language

**Files:**
- Modify: `src/main/resources/static/css/notes.css`

- [ ] **Step 1: Replace wood and heavy leather tokens with shared site colors**

At the top of `notes.css`, define the local palette and replace `.book-surface`, `.book-cover`, `.book-spine`, and `.page-inner` with these rules:

```css
.notes-page {
  --notes-bg: #faf3e3;
  --notes-paper: #fffdf4;
  --notes-paper-edge: #eadcc0;
  --notes-dash: #d9c8a8;
  --notes-text: #5a4632;
  --notes-muted: #8a7355;
  --notes-soft: #b39a77;
  --notes-accent: #d1662f;
  --notes-cover: #aa6847;
  --notes-cover-dark: #8e5035;
}

.notes-page .wrap { max-width: 960px; }
.book-wrap { max-width: 900px; margin: 18px auto 40px; padding: 0 12px; }
.book-surface { position: relative; margin: 22px auto 0; padding: 24px 20px 34px; }
.book { position: relative; perspective: 1800px; transform-style: preserve-3d; }
.book-spread { display: flex; position: relative; z-index: 2; transform-style: preserve-3d; }

.book-cover { position: absolute; top: -8px; bottom: -12px; width: calc(50% + 9px); z-index: 0; background: linear-gradient(145deg, var(--notes-cover), var(--notes-cover-dark)); }
.book-cover.left { left: -9px; border-radius: 14px 2px 2px 16px; box-shadow: -8px 14px 24px rgba(90,70,50,.18); }
.book-cover.right { right: -9px; border-radius: 2px 14px 16px 2px; box-shadow: 8px 14px 24px rgba(90,70,50,.18); }
.book-spine { position: absolute; left: 50%; top: 0; bottom: 0; width: 20px; transform: translateX(-50%); z-index: 4; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(90,70,50,.16) 44%, rgba(255,255,255,.5) 52%, rgba(90,70,50,.1) 60%, transparent); }

.book-page { flex: 1 1 0; min-width: 0; position: relative; }
.book-page.left { padding-right: 3px; }
.book-page.right { padding-left: 3px; }
.page-inner { position: relative; min-height: 460px; padding: 24px 22px 28px; border: 1px solid var(--notes-paper-edge); background: var(--notes-paper); color: var(--notes-text); }
.book-page.left .page-inner { border-radius: 12px 2px 3px 13px; background: linear-gradient(90deg,#f5ead3 0,var(--notes-paper) 11%,var(--notes-paper) 78%,#ede1ca 100%); box-shadow: -4px 6px 0 #e4d2b2, -7px 10px 0 #f4e9d4; }
.book-page.right .page-inner { border-radius: 2px 12px 13px 3px; background: linear-gradient(90deg,#ede1ca 0,var(--notes-paper) 22%,var(--notes-paper) 89%,#f5ead3 100%); box-shadow: 4px 6px 0 #e4d2b2, 7px 10px 0 #f4e9d4; }
```

- [ ] **Step 2: Align typography and controls with `home.css`**

Replace the month, entry, nav, page-menu, and chip rules with:

```css
.month-title { color:#6b4f2e; font-size:17px; font-weight:700; letter-spacing:3px; padding-bottom:9px; margin-bottom:10px; border-bottom:1px dashed var(--notes-dash); }
.e-date { color:var(--notes-soft); font-size:11.5px; letter-spacing:1px; }
.e-title { color:var(--notes-text); font-size:14.5px; font-weight:700; }
.e-excerpt { color:var(--notes-muted); font-size:12.5px; line-height:1.7; }
.e-cat { color:var(--notes-accent); background:transparent; border:1px dashed var(--notes-accent); border-radius:999px; padding:1px 9px; }
.nav-btn,.page-indicator,.page-option,.mi { font-family:inherit; color:#6b4f2e; background:var(--notes-paper); border:1px dashed #c9b28a; cursor:pointer; }
.nav-btn,.page-indicator,.mi { border-radius:999px; padding:7px 16px; }
.mi.on { color:var(--notes-paper); background:var(--notes-accent); border-color:var(--notes-accent); }
.page-picker { position:relative; }
.page-menu { position:absolute; left:50%; bottom:calc(100% + 8px); z-index:20; width:max-content; max-width:min(82vw,360px); transform:translateX(-50%); padding:7px; border:1px solid var(--notes-paper-edge); border-radius:10px; background:var(--notes-paper); box-shadow:0 12px 28px rgba(90,70,50,.18); }
.page-option { display:block; width:100%; padding:7px 10px; border:0; border-radius:6px; text-align:left; }
.page-option:hover,.page-option[aria-selected="true"] { color:var(--notes-accent); background:#f6ecd9; }
```

- [ ] **Step 3: Run server-render tests to catch accidental template/style path breakage**

Run:

```powershell
mvn -Dtest=NotesBookTests,StaticResourceMimeTypeTests test
```

Expected: PASS.

- [ ] **Step 4: Commit the static visual boundary if Git is available**

```powershell
git add src/main/resources/static/css/notes.css
git commit -m "style: align notes book with handwritten site"
```

### Task 4: Replace the old leaf animation with a rigid double-sided sheet

**Files:**
- Modify: `src/main/resources/static/js/notes.mjs`
- Modify: `src/main/resources/static/css/notes.css`

- [ ] **Step 1: Import the tested interaction helpers and introduce one explicit state**

Replace the import/constants/state declarations at the top of `notes.mjs` with:

```js
import {
  next, prev, clamp, canNext, canPrev,
  dragProgress, shouldCommitTurn, turnAngle, canStartInteraction
} from './notes-logic.mjs';

const TURN_MS = 700;
const CLOSE_MS = 420;
const HOLD_MS = 280;
const OPEN_MS = 480;
const FALLBACK_PAD_MS = 120;

const state = {
  currentIndex: 0,
  phase: 'idle',
  direction: null,
  progress: 0,
  targetIndex: null,
  pointerId: null,
  startX: 0,
  sheet: null,
  reveal: null
};
```

- [ ] **Step 2: Replace `busy` guards with phase guards**

Use `state.currentIndex` instead of `current`, and start both `step()` and `jumpTo()` with:

```js
if (!canStartInteraction(state.phase)) return;
```

Update `activate(i)` so it assigns `state.currentIndex = i`, toggles `aria-hidden`, updates button disabled states, writes `第 ${i + 1} / ${total} 页`, marks each `.page-option` selected by `data-index`, and marks every `.mi` on when its `data-index` equals `i`.

- [ ] **Step 3: Replace `flipTo()` with a rigid-sheet implementation**

Use these functions in `notes.mjs`:

```js
function buildTurnLayers(to, direction) {
  const from = spreads[state.currentIndex];
  const sheet = document.createElement('div');
  sheet.className = `turning-sheet ${direction}`;

  const frontSide = direction === 'next' ? 'right' : 'left';
  const backSide = direction === 'next' ? 'left' : 'right';
  sheet.append(
    face(pageInnerHtml(state.currentIndex, frontSide), 'front'),
    face(pageInnerHtml(to, backSide), 'back')
  );

  const reveal = document.createElement('div');
  reveal.className = `reveal-layer ${direction}`;
  const revealSide = direction === 'next' ? 'right' : 'left';
  reveal.append(face(pageInnerHtml(to, revealSide), 'front'));
  from.append(reveal, sheet);
  state.sheet = sheet;
  state.reveal = reveal;
}

function setSheetProgress(progress) {
  state.progress = Math.max(0, Math.min(1, progress));
  state.sheet.style.transform = `rotateY(${turnAngle(state.direction, state.progress)}deg)`;
  state.sheet.style.setProperty('--turn-progress', state.progress);
}

function finishTurn(to) {
  state.sheet?.remove();
  state.reveal?.remove();
  state.sheet = null;
  state.reveal = null;
  state.phase = 'idle';
  state.direction = null;
  state.progress = 0;
  state.targetIndex = null;
  activate(to);
}

function autoTurn(to) {
  state.phase = 'settling';
  state.direction = to > state.currentIndex ? 'next' : 'prev';
  state.targetIndex = to;
  buildTurnLayers(to, state.direction);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    state.sheet.classList.add('animate');
    setSheetProgress(1);
  }));

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    finishTurn(to);
  };
  state.sheet.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') finish();
  }, { once: true });
  setTimeout(finish, TURN_MS + FALLBACK_PAD_MS);
}
```

Change `step(dir)` to compute the bounded target and call `autoTurn(to)`.

- [ ] **Step 4: Add the rigid sheet CSS**

Delete the old `.turn-leaf` soft-looking rules and add:

```css
.reveal-layer { position:absolute; top:0; bottom:0; width:50%; z-index:3; overflow:hidden; }
.reveal-layer.next { right:0; }
.reveal-layer.prev { left:0; }
.turning-sheet { position:absolute; top:0; bottom:0; width:50%; z-index:8; transform-style:preserve-3d; will-change:transform; }
.turning-sheet.next { left:50%; transform-origin:left center; }
.turning-sheet.prev { right:50%; transform-origin:right center; }
.turning-sheet.animate { transition:transform 700ms cubic-bezier(.38,.08,.22,.98); }
.turn-face { position:absolute; inset:0; overflow:hidden; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
.turn-face.back { transform:rotateY(180deg); }
.turning-sheet::after { content:""; position:absolute; inset:0; pointer-events:none; opacity:calc(.16 + var(--turn-progress,0) * .18); background:linear-gradient(90deg,rgba(90,70,50,.22),transparent 34%); }
.turning-sheet.prev::after { transform:scaleX(-1); }
```

Update `face()` to set `el.className = `turn-face ${cls}``.

- [ ] **Step 5: Run the Node and Java tests**

Run:

```powershell
node --test tests/notes-book.test.mjs
mvn -Dtest=NotesBookTests test
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the rigid auto-turn boundary if Git is available**

```powershell
git add src/main/resources/static/js/notes.mjs src/main/resources/static/css/notes.css
git commit -m "feat: turn notes with a rigid full sheet"
```

### Task 5: Add pointer dragging and the close-pause-open jump

**Files:**
- Modify: `src/main/resources/static/js/notes.mjs`
- Modify: `src/main/resources/static/css/notes.css`

- [ ] **Step 1: Wire page-menu and month controls to spread indexes**

Cache these elements beside the existing buttons:

```js
const pageMenuBtn = document.getElementById('pageMenuBtn');
const pageMenu = document.getElementById('pageMenu');
const pageOptions = Array.from(document.querySelectorAll('#pageMenu .page-option'));
const monthButtons = Array.from(document.querySelectorAll('#monthIndex .mi'));
const jumpLabel = document.getElementById('jumpLabel');
```

In `init()`, add:

```js
pageMenuBtn?.addEventListener('click', () => {
  const willOpen = pageMenu.hasAttribute('hidden');
  pageMenu.toggleAttribute('hidden', !willOpen);
  pageMenuBtn.setAttribute('aria-expanded', String(willOpen));
});
pageOptions.forEach((button) => button.addEventListener('click', () => {
  pageMenu.hidden = true;
  pageMenuBtn.setAttribute('aria-expanded', 'false');
  jumpTo(Number(button.dataset.index), button.textContent.trim());
}));
monthButtons.forEach((button) => button.addEventListener('click', () => {
  jumpTo(Number(button.dataset.index), button.dataset.month);
}));
```

- [ ] **Step 2: Replace the old nested-timeout jump with named phases and one cleanup path**

Use this `jumpTo()` implementation:

```js
function jumpTo(index, label = '') {
  if (!canStartInteraction(state.phase)) return;
  const target = clamp(index, total);
  if (target === state.currentIndex) return;

  state.phase = 'closing';
  state.targetIndex = target;
  jumpLabel.textContent = label ? `翻到 · ${label}` : `翻到 · 第 ${target + 1} 页`;
  book.classList.add('jumping', 'jump-closing');

  setTimeout(() => {
    book.classList.remove('jump-closing');
    book.classList.add('jump-closed');
    activate(target);
    state.phase = 'closed';

    setTimeout(() => {
      state.phase = 'opening';
      book.classList.remove('jump-closed');
      book.classList.add('jump-opening');

      setTimeout(() => {
        book.classList.remove('jumping', 'jump-opening');
        jumpLabel.textContent = '';
        state.phase = 'idle';
        state.targetIndex = null;
      }, OPEN_MS);
    }, HOLD_MS);
  }, CLOSE_MS);

  setTimeout(() => {
    if (state.targetIndex !== target) return;
    book.classList.remove('jumping', 'jump-closing', 'jump-closed', 'jump-opening');
    jumpLabel.textContent = '';
    activate(target);
    state.phase = 'idle';
    state.targetIndex = null;
  }, CLOSE_MS + HOLD_MS + OPEN_MS + FALLBACK_PAD_MS);
}
```

- [ ] **Step 3: Add Pointer Event dragging for a rigid page**

Add these handlers and register them on `book`:

```js
function onPointerDown(event) {
  if (!canStartInteraction(state.phase) || event.button > 0) return;
  if (event.target.closest('a,button')) return;
  const rect = book.getBoundingClientRect();
  const direction = event.clientX >= rect.left + rect.width / 2 ? 'next' : 'prev';
  const to = direction === 'next' ? next(state.currentIndex, total) : prev(state.currentIndex, total);
  if (to === state.currentIndex) return;

  state.phase = 'dragging';
  state.direction = direction;
  state.targetIndex = to;
  state.pointerId = event.pointerId;
  state.startX = event.clientX;
  buildTurnLayers(to, direction);
  book.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  const pageWidth = book.getBoundingClientRect().width / 2;
  setSheetProgress(dragProgress(event.clientX - state.startX, pageWidth));
  if (state.progress > 0.04) event.preventDefault();
}

function onPointerUp(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  const deltaX = event.clientX - state.startX;
  if (Math.abs(deltaX) < 8) {
    finishTurn(state.currentIndex);
    return;
  }
  state.phase = 'settling';
  const target = state.targetIndex;
  const commit = shouldCommitTurn(state.progress);
  state.sheet.classList.add('animate');
  setSheetProgress(commit ? 1 : 0);
  setTimeout(() => {
    if (commit) finishTurn(target);
    else finishTurn(state.currentIndex);
  }, TURN_MS + FALLBACK_PAD_MS);
}

function onPointerCancel(event) {
  if (state.phase !== 'dragging' || event.pointerId !== state.pointerId) return;
  state.phase = 'settling';
  state.sheet.classList.add('animate');
  setSheetProgress(0);
  setTimeout(() => finishTurn(state.currentIndex), TURN_MS + FALLBACK_PAD_MS);
}

book.addEventListener('pointerdown', onPointerDown);
book.addEventListener('pointermove', onPointerMove, { passive:false });
book.addEventListener('pointerup', onPointerUp);
book.addEventListener('pointercancel', onPointerCancel);
```

- [ ] **Step 4: Add the close/closed/open and thick-page styles**

Append:

```css
.book-page-block { position:absolute; left:50%; top:12px; bottom:12px; width:52px; z-index:1; transform:translateX(-50%) rotateY(90deg); opacity:0; background:repeating-linear-gradient(90deg,#f1e5cc 0 3px,#dcc9a6 3px 4px,#fff6e5 4px 6px); border:1px solid #d6bf99; box-shadow:0 8px 13px rgba(90,70,50,.18); }
.jump-label { position:absolute; left:50%; bottom:-34px; z-index:12; transform:translateX(-50%); color:var(--notes-accent); font-weight:700; letter-spacing:2px; white-space:nowrap; opacity:0; }
.book.jumping .book-page,.book.jumping .book-cover { transition:transform 420ms cubic-bezier(.4,.05,.2,1); }
.book.jump-closing .book-page.left,.book.jump-closing .book-cover.left,.book.jump-closed .book-page.left,.book.jump-closed .book-cover.left { transform-origin:right center; transform:rotateY(88deg); }
.book.jump-closing .book-page.right,.book.jump-closing .book-cover.right,.book.jump-closed .book-page.right,.book.jump-closed .book-cover.right { transform-origin:left center; transform:rotateY(-88deg); }
.book.jump-closed .book-page-block { opacity:1; }
.book.jump-closed .jump-label { opacity:1; }
.book.jump-opening .book-page,.book.jump-opening .book-cover { transition:transform 480ms cubic-bezier(.2,.72,.24,1); }
```

- [ ] **Step 5: Run logic and server-render tests**

Run:

```powershell
node --test tests/notes-book.test.mjs
mvn -Dtest=NotesBookTests test
```

Expected: PASS.

- [ ] **Step 6: Commit the gesture and jump boundary if Git is available**

```powershell
git add src/main/resources/static/js/notes.mjs src/main/resources/static/css/notes.css
git commit -m "feat: add rigid drag and timed book jumps"
```

### Task 6: Finish responsive, reduced-motion, and browser verification

**Files:**
- Modify: `src/main/resources/static/css/notes.css`
- Modify: `src/main/resources/static/js/notes.mjs`

- [ ] **Step 1: Add mobile double-page constraints**

Replace the existing mobile block with:

```css
@media (max-width:720px) {
  .book-wrap { padding:0 4px; }
  .book-surface { padding:18px 4px 28px; }
  .book-cover { top:-5px; bottom:-7px; }
  .page-inner { min-height:330px; padding:14px 10px 20px; }
  .month-title { font-size:13px; letter-spacing:1px; }
  .page-entries { gap:9px; }
  .e-head { gap:5px; }
  .e-date { font-size:9.5px; }
  .e-title { font-size:12px; line-height:1.35; }
  .e-excerpt { display:none; }
  .e-meta { gap:5px; margin-top:3px; }
  .e-cat,.e-views { font-size:9px; }
  .book-nav { gap:8px; }
  .nav-btn,.page-indicator { min-height:40px; padding:6px 10px; }
  .month-index { flex-wrap:nowrap; justify-content:flex-start; overflow-x:auto; padding:2px 2px 8px; }
  .mi { min-height:40px; flex:0 0 auto; }
}
```

- [ ] **Step 2: Add reduced-motion and 3D fallback behavior**

Append:

```css
@media (prefers-reduced-motion:reduce) {
  .turning-sheet,.book-page,.book-cover { transition-duration:160ms !important; }
  .book.js .book-spread { animation:none; }
}

@supports not (transform-style:preserve-3d) {
  .turning-sheet,.reveal-layer,.book-page-block { display:none !important; }
  .book.js .book-spread.active { animation:notesFade 180ms ease; }
  @keyframes notesFade { from { opacity:0; } to { opacity:1; } }
}
```

In `notes.mjs`, add:

```js
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fadeTo(target) {
  state.phase = 'settling';
  book.classList.add('notes-fading');
  setTimeout(() => {
    activate(target);
    book.classList.remove('notes-fading');
    state.phase = 'idle';
    state.targetIndex = null;
  }, 160);
}
```

At the start of `autoTurn(to)`, use `if (reduceMotion) { fadeTo(to); return; }`. At the start of `jumpTo()` after target validation, use the same branch. Add `.book.notes-fading .book-spread.active { opacity:.25; transition:opacity 160ms ease; }` to `notes.css` so both paths retain one cleanup and control-synchronization behavior.

- [ ] **Step 3: Run the full automated verification suite**

Run:

```powershell
node --test tests/notes-book.test.mjs
mvn test
```

Expected: Node tests PASS and Maven reports BUILD SUCCESS.

- [ ] **Step 4: Reload the running app and verify desktop interactions**

If the app at `http://127.0.0.1:8081/notes` is running from `target/classes`, restart it or copy/rebuild resources before checking. Then verify at a desktop viewport:

1. Book colors, type, tape/handmade details, and accent colors visually match the home page.
2. Wood grain and thick dark spine are absent.
3. Next/previous controls turn one complete rigid rectangular page around the spine.
4. Direction keys behave identically.
5. Repeated clicks during motion do not create overlapping sheets.
6. A drag below 45% returns to the same spread; a drag at or above 45% completes.
7. Clicking an article still navigates instead of beginning a drag.
8. Page menu and every individual month jump through close → thick-page pause → open.
9. First/last buttons disable correctly and the odd final spread renders its empty right page.

- [ ] **Step 5: Verify mobile and accessibility behavior**

At a viewport no wider than 720px, verify:

1. Both pages remain visible.
2. Month and article titles remain readable; excerpts are removed before titles are compressed.
3. Horizontal swipes operate the rigid sheet without vertical-page scroll hijacking.
4. Month controls scroll horizontally and remain at least 40px tall.
5. With reduced motion enabled, transitions become a short fade and never lock controls.
6. With JavaScript disabled, all spreads remain in document order and article links work.

- [ ] **Step 6: Commit the responsive and verification boundary if Git is available**

```powershell
git add src/main/resources/static/css/notes.css src/main/resources/static/js/notes.mjs
git commit -m "fix: harden notes book responsive fallbacks"
```

## Final completion check

- [ ] Run `node --test tests/notes-book.test.mjs` and retain the passing output.
- [ ] Run `mvn test` and retain the BUILD SUCCESS output.
- [ ] Confirm the rendered `/notes` page against every acceptance criterion in `docs/superpowers/specs/2026-08-13-notes-book-visual-redesign-design.md`.
- [ ] If Git is restored, run `git status --short` and verify only intended files remain modified.
