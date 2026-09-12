# Home Music Button Sway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While the home-page background music is actually playing, gently sway the fixed music control button (sticker style) left and right around its 6° baseline with a subtle bob, and stop swaying the moment playback pauses or ends.

**Architecture:** Drive the effect purely from existing playback state: `setControlState({visible, playing})` in `home.mjs` toggles a `music-playing` class on the button; `home.css` binds that class to an infinite `music-float` keyframe animation around the existing `rotate(6deg)` baseline. The pure-logic module `home-music.mjs` stays untouched, so its Node tests remain valid.

**Tech Stack:** CSS keyframe animation, vanilla ES module, PowerShell structural verification, Maven resource copy.

---

### Task 1: Write a failing structural verification script

**Files:**
- Create: `scripts/verify-music-sway.ps1`

- [ ] **Step 1: Create the verification script**

```powershell
$ErrorActionPreference = 'Stop'
$css = Get-Content -LiteralPath 'src\main\resources\static\css\home.css' -Encoding utf8 -Raw
$homeJs = Get-Content -LiteralPath 'src\main\resources\static\js\home.mjs' -Encoding utf8 -Raw
$template = Get-Content -LiteralPath 'src\main\resources\templates\home\index.html' -Encoding utf8 -Raw

if (-not $css.Contains('.music-toggle.music-playing{')) {
    throw 'Playing-state sway rule is missing from home.css.'
}
if (-not $css.Contains('animation:music-float 3.4s ease-in-out infinite;')) {
    throw 'music-float animation binding is missing from home.css.'
}
if (-not $css.Contains('@keyframes music-float')) {
    throw 'music-float keyframes are missing from home.css.'
}
if (-not $css.Contains('@media (prefers-reduced-motion:reduce)')) {
    throw 'Reduced-motion guard is missing from home.css.'
}
if (-not $homeJs.Contains("musicToggle.classList.toggle('music-playing', playing);")) {
    throw 'Playing-state class toggle is missing from home.mjs.'
}
if (-not $template.Contains("(v='20260903')")) {
    throw 'home.mjs cache version was not bumped in the home template.'
}

Write-Output 'Music sway verification passed.'
```

- [ ] **Step 2: Run the script and confirm it fails**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-music-sway.ps1`

Expected: throws `Playing-state sway rule is missing from home.css.` and exits non-zero.

### Task 2: Implement the sway animation and state class

**Files:**
- Modify: `src/main/resources/static/css/home.css` (music section, after `.music-toggle:hover,` rule at line 141, before `@media (max-width:640px)` at line 143)
- Modify: `src/main/resources/static/js/home.mjs:69-71`
- Modify: `src/main/resources/static/js/home.mjs:53`
- Modify: `src/main/resources/templates/home/index.html:107`

- [ ] **Step 1: Add the sway CSS**

Insert between line 141 (`.music-toggle:hover,.music-toggle:focus-visible{background:#ffe998;color:#765724}`) and the `@media (max-width:640px)` block:

```css

/* 播放中轻柔摆动：围绕 6° 基线 ±3° 游走并带轻微浮沉，像随音乐飘动 */
.music-toggle.music-playing{
  animation:music-float 3.4s ease-in-out infinite;
}
@keyframes music-float{
  0%  {transform:rotate(6deg) translate(0,0)}
  15% {transform:rotate(9deg) translate(1px,0)}
  40% {transform:rotate(5deg) translate(.5px,-1px)}
  65% {transform:rotate(3deg) translate(-1px,0)}
  85% {transform:rotate(7.5deg) translate(-.5px,-1px)}
  100%{transform:rotate(6deg) translate(0,0)}
}
@media (prefers-reduced-motion:reduce){
  .music-toggle.music-playing{animation:none}
}
```

- [ ] **Step 2: Toggle the playing-state class in home.mjs**

In `setControlState`, add the class toggle as the second statement, right after `musicToggle.hidden = !visible;`:

```js
      setControlState({ visible, playing }) {
        musicToggle.hidden = !visible;
        musicToggle.classList.toggle('music-playing', playing);
        musicToggle.setAttribute('aria-pressed', String(playing));
```

- [ ] **Step 3: Bump the cache version for the changed JS files**

In `src/main/resources/static/js/home.mjs` change the dynamic import (line 53):

```js
    } = await import('./home-music.mjs?v=20260903');
```

In `src/main/resources/templates/home/index.html` change the module script tag (line 107):

```html
<script th:src="@{/js/home.mjs(v='20260903')}" type="module"></script>
```

- [ ] **Step 4: Syntax-check the edited module**

Run: `node --check src/main/resources/static/js/home.mjs`

Expected: no output and exit code 0.

- [ ] **Step 5: Run the verification script and confirm it passes**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-music-sway.ps1`

Expected: prints `Music sway verification passed.`

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-music-sway.ps1 src/main/resources/static/css/home.css src/main/resources/static/js/home.mjs src/main/resources/templates/home/index.html
git commit -m "feat: sway home music button while playing"
```

### Task 3: Sync resources and verify behavior in the browser

**Files:**
- Verify: `target/classes/static/css/home.css`, `target/classes/static/js/home.mjs`, `target/classes/templates/home/index.html`
- Modify: `README.md:33`

- [ ] **Step 1: Copy resources into the build output**

Run from the repository root: `mvn -q process-resources`

If Maven fails on the non-ASCII path, map an ASCII drive first and rerun there: `subst T: "C:\Users\伟嘉\Desktop\求职\Tongshengbolg"` then run `mvn -q process-resources` from `T:\` and remove the mapping afterwards with `subst T: /D`.

Expected: `target\classes\static\css\home.css` now contains `.music-toggle.music-playing{`, `target\classes\static\js\home.mjs` contains the class toggle line, and `target\classes\templates\home\index.html` contains `v='20260903'`.

- [ ] **Step 2: Start the app and smoke-test the served files**

Run in a background terminal from the repository root (or the mapped drive): `mvn spring-boot:run` and wait for the listening-port log.

Then confirm the running server serves the updated files:

```powershell
(Invoke-WebRequest 'http://localhost:8080/css/home.css').Content.Contains('.music-toggle.music-playing')
(Invoke-WebRequest 'http://localhost:8080/js/home.mjs').Content.Contains("classList.toggle('music-playing'")
(Invoke-WebRequest 'http://localhost:8080/').Content.Contains("v='20260903'")
```

Expected: three `True` lines. If the configured port differs, substitute it from the startup log.

- [ ] **Step 3: Visual check**

Open `http://localhost:8080/` in a browser with autoplay allowed and `localStorage` key `home-music-played-v1` cleared (or a fresh profile). Confirm:
1. First song starts (auto or after one click per browser policy) and the bottom-right sticker sways gently around its tilted baseline with a soft bob, with no jump when the animation loop restarts.
2. Clicking the button pauses: the sway stops immediately and the icon shows ▶.
3. Clicking again resumes: sway restarts; icon shows Ⅱ.
4. Letting the song end hides the button and leaves it static.

Optionally, in DevTools emulate `prefers-reduced-motion: reduce` and confirm the button stays static while playing.

- [ ] **Step 4: Note the sway feature in the README**

Append one clause to the existing music bullet (README.md line 33) so it reads:

```markdown
- 🎵 **首页音乐**：同一浏览器首次访问首页时随机播放一首内置音轨；浏览器自动播放策略可能延迟到首次交互后开始，`localStorage` 会避免在刷新、页面导航或浏览器重启后重复自动播放；播放期间右下角音乐按钮会轻轻摆动，暂停即静止
```

- [ ] **Step 5: Run the full verification suite**

Run: `node --test "tests/*.test.mjs"` and then `mvn test` (from an ASCII mapped drive if the Java compiler rejects the Chinese path).

Expected: Node reports 0 failures; Maven reports `BUILD SUCCESS` with 0 failures and 0 errors.

- [ ] **Step 6: Inspect the diff and commit**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only feature files changed; pre-existing unrelated untracked files (snack-shop refactor docs, `tests/mall-snackshop-integration-plan.md`, `音乐包/`, etc.) must NOT be staged.

```bash
git add README.md
git commit -m "docs: note music button sway in home music"
```
