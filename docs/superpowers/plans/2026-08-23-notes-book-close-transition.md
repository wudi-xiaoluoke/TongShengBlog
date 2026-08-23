# Notes Book Close Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct page/month jumps close both book halves into a visibly thick central spine, pause briefly, switch content invisibly, and open the target spread symmetrically.

**Architecture:** Keep the existing `idle → closing → closed → opening → idle` JavaScript state machine. Centralize the revised phase timings in testable logic, then let CSS own the 3D page/cover motion and make `.book-page-block` a layered closed-spine visual that fades in near the end of closing and out at the start of opening.

**Tech Stack:** Native ES modules, Node `node:test`, CSS 3D transforms/transitions, Spring Boot static resources.

---

## File map

- Modify `src/main/resources/static/js/notes-logic.mjs`: expose validated jump-transition timing values.
- Modify `tests/notes-book.test.mjs`: test the confirmed 380/220/430ms timing contract.
- Modify `src/main/resources/static/js/notes.mjs`: consume the timing contract without changing navigation behavior.
- Modify `src/main/resources/static/css/notes.css`: implement symmetric 86° closure, layered 28–36px spine, cover edges, shadow choreography, mobile sizing, and reduced-motion cleanup.

### Task 1: Lock the confirmed animation timing in tests

**Files:**
- Modify: `tests/notes-book.test.mjs`
- Modify: `src/main/resources/static/js/notes-logic.mjs`
- Modify: `src/main/resources/static/js/notes.mjs`

- [ ] **Step 1: Write the failing timing-contract test**

Add `jumpTransitionTiming` to the import list in `tests/notes-book.test.mjs`, then add:

```js
test('uses the confirmed close, hold, and open timing', () => {
  assert.deepEqual(jumpTransitionTiming(), {
    closeMs: 380,
    holdMs: 220,
    openMs: 430,
  });
});
```

- [ ] **Step 2: Run the focused Node test and verify failure**

Run:

```powershell
node --test --test-name-pattern="confirmed close" tests/notes-book.test.mjs
```

Expected: FAIL because `jumpTransitionTiming` is not exported.

- [ ] **Step 3: Implement the minimal timing helper**

Add to `src/main/resources/static/js/notes-logic.mjs`:

```js
export function jumpTransitionTiming() {
  return Object.freeze({ closeMs: 380, holdMs: 220, openMs: 430 });
}
```

- [ ] **Step 4: Consume the timing helper in the browser module**

Add `jumpTransitionTiming` to the import list in `src/main/resources/static/js/notes.mjs` and replace the three old constants with:

```js
const {
  closeMs: CLOSE_MS,
  holdMs: HOLD_MS,
  openMs: OPEN_MS,
} = jumpTransitionTiming();
```

Keep `TURN_MS`, `FALLBACK_MS`, `MIN_DRAG_PX`, and `FADE_HALF_MS` unchanged.

- [ ] **Step 5: Run all notes logic tests**

Run:

```powershell
node --test tests/notes-book.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the timing boundary**

```powershell
git add tests/notes-book.test.mjs src/main/resources/static/js/notes-logic.mjs src/main/resources/static/js/notes.mjs
git commit -m "test: define notes book jump timing"
```

### Task 2: Replace the thin closed line with a layered spine side

**Files:**
- Modify: `src/main/resources/static/css/notes.css:68-145`

- [ ] **Step 1: Record the pre-change CSS assertions**

Run:

```powershell
rg -n "width: 20px|rotateY\(88deg\)|jump-closed \.book-page-block" src/main/resources/static/css/notes.css
```

Expected: matches show the current 20px block and 88° closure, proving the old visual contract is present.

- [ ] **Step 2: Rebuild `.book-page-block` as the closed spine side**

Replace the current `.book-page-block` rule and add its pseudo-elements:

```css
.book-page-block {
  position: absolute;
  left: 50%;
  top: -5px;
  bottom: -7px;
  width: clamp(28px, 4.2vw, 36px);
  z-index: 6;
  box-sizing: border-box;
  border: 2px solid var(--notes-dark);
  border-radius: 5px;
  background:
    linear-gradient(90deg, rgba(142, 80, 53, .32), transparent 24% 72%, rgba(142, 80, 53, .28)),
    repeating-linear-gradient(0deg, #fff9ed 0 2px, #e7d6b8 2px 3px);
  box-shadow: 0 8px 18px rgba(90, 55, 35, .24), inset 0 0 5px rgba(255, 255, 255, .72);
  opacity: 0;
  transform: translateX(-50%) scaleX(.72);
  transition: opacity 80ms ease, transform 80ms ease;
  pointer-events: none;
}

.book-page-block::before,
.book-page-block::after {
  content: '';
  position: absolute;
  left: -3px;
  right: -3px;
  height: 7px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--notes-dark), #bd7a57 48%, var(--notes-dark));
}

.book-page-block::before { top: -4px; }
.book-page-block::after { bottom: -4px; }
```

- [ ] **Step 3: Replace jump transforms and phase choreography**

Replace the existing jump-specific rules with:

```css
.book.js.jump-closing .book-page,
.book.js.jump-closing .book-cover {
  transition-duration: 380ms;
  transition-timing-function: cubic-bezier(.42, 0, .72, 1);
}
.book.js.jump-closing .book-page.left,
.book.js.jump-closing .book-cover.left,
.book.js.jump-closed .book-page.left,
.book.js.jump-closed .book-cover.left { transform: rotateY(86deg); }
.book.js.jump-closing .book-page.right,
.book.js.jump-closing .book-cover.right,
.book.js.jump-closed .book-page.right,
.book.js.jump-closed .book-cover.right { transform: rotateY(-86deg); }
.book.js.jump-closed .book-page,
.book.js.jump-closed .book-cover { transition: none; }
.book.js.jump-opening .book-page,
.book.js.jump-opening .book-cover {
  transform: rotateY(0);
  transition-duration: 430ms;
  transition-timing-function: cubic-bezier(.22, .68, .3, 1);
}
.book.js.jump-closing .book-page-block,
.book.js.jump-closed .book-page-block {
  opacity: 1;
  transform: translateX(-50%) scaleX(1);
  transition-delay: 300ms;
}
.book.js.jump-closed .book-page-block { transition: none; }
.book.js.jump-opening .book-page-block {
  opacity: 0;
  transform: translateX(-50%) scaleX(.72);
  transition-delay: 0ms;
}
```

- [ ] **Step 4: Add closed-state shadow containment**

Add:

```css
.book.js.jumping .book-spread { transform-style: preserve-3d; }
.book.js.jump-closing .page-inner,
.book.js.jump-closed .page-inner { box-shadow: 0 2px 5px rgba(90, 55, 35, .08); }
.book.js.jump-closed .jump-label { z-index: 7; }
```

- [ ] **Step 5: Preserve visible thickness on mobile**

Inside `@media (max-width: 720px)`, add:

```css
.book-page-block {
  width: clamp(24px, 6vw, 30px);
  top: -3px;
  bottom: -5px;
}
```

Do not change the existing reduced-motion rule that hides `.book-page-block`.

- [ ] **Step 6: Verify the new CSS contract**

Run:

```powershell
rg -n "rotateY\(86deg\)|width: clamp\(28px|transition-delay: 300ms|width: clamp\(24px" src/main/resources/static/css/notes.css
```

Expected: all four new visual-contract patterns match.

- [ ] **Step 7: Commit the visual boundary**

```powershell
git add src/main/resources/static/css/notes.css
git commit -m "feat: improve notes book close transition"
```

### Task 3: Regression and visual verification

**Files:**
- Test: `tests/notes-book.test.mjs`
- Test: `src/test/java/com/tongsheng/blog/NotesBookTests.java`
- Verify: `src/main/resources/static/css/notes.css`
- Verify: `src/main/resources/static/js/notes.mjs`

- [ ] **Step 1: Run the JavaScript regression suite**

Run:

```powershell
node --test tests/notes-book.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 2: Run the focused Spring notes tests**

Run:

```powershell
mvn -Dtest=NotesBookTests test
```

Expected: BUILD SUCCESS with all `NotesBookTests` passing.

- [ ] **Step 3: Run whitespace and repository checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional implementation changes remain before their commits, or the worktree is clean after commits.

- [ ] **Step 4: Visually inspect the direct-jump sequence**

Start the application with:

```powershell
mvn spring-boot:run
```

Open `/notes`, choose a non-current page or month, and verify:

- both halves close simultaneously without lateral drift;
- the central closed state is visibly 28–36px thick with paper lines and cover caps;
- the pause is short and content never flashes;
- both target pages open simultaneously and remain aligned;
- controls unlock after completion;
- at a viewport below 720px the spine remains visibly thick;
- reduced-motion mode uses the existing fade without a 3D spine.

- [ ] **Step 5: Commit any verification-only corrections separately**

If visual verification requires a correction, first add a regression assertion when practical, make one focused correction, rerun Steps 1–4, then commit only those files:

```powershell
git add tests/notes-book.test.mjs src/main/resources/static/js/notes-logic.mjs src/main/resources/static/js/notes.mjs src/main/resources/static/css/notes.css
git commit -m "fix: polish notes book close animation"
```
