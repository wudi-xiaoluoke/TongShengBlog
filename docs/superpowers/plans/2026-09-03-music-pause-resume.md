# Home Music Pause Position Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the home-page music is paused and the user leaves the page, returning and clicking ▶ resumes the same track from the paused position; a naturally finished track clears the memory so the next play starts fresh.

**Architecture:** `home-music.mjs` gains an optional `resumeStore` hook (`load`/`save`/`clear`, all fault-tolerant). A user pause saves `{ track: sessionTrack, at: audio.currentTime }`; natural `ended` clears it while `error` keeps it. When `toggle()` runs with no audio element and no session track yet, it first tries the stored record (validated against `tracks`), resumes from `at`, and only falls back to random selection when the record is missing or stale. `home.mjs` implements `resumeStore` over `localStorage` (`home-music-resume-v1`). Spec: `docs/superpowers/specs/2026-09-03-music-pause-resume-design.md`.

**Tech Stack:** ES module, Node test runner, PowerShell structural verification, Maven resource copy, headless Edge CDP smoke test.

---

### Task 1: Add the failing resume-memory tests (RED)

**Files:**
- Modify: `tests/home-music.test.mjs`

- [ ] **Step 1: Give the fake audio a mutable currentTime**

In `createFakeAudio`, add a `currentTime` field next to `paused`:

```js
    paused: true,
    currentTime: 0,
```

- [ ] **Step 2: Append six resume-memory tests**

Insert immediately before the test named `home template exposes two music tracks through an icon-only always-visible control`:

```js
test('pause stores the session track and its current position', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const saves = [];
  const resumeStore = {
    load: () => null,
    save(record) {
      saves.push(record);
    },
    clear() {},
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore,
  });

  assert.equal(await player.toggle(), true);
  audio.currentTime = 42;
  assert.equal(await player.toggle(), true);

  assert.deepEqual(saves, [{ track: '/a.mp3', at: 42 }]);
});

test('resume after reload continues the stored track from its stored position', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  let randomCalls = 0;
  const resumeStore = {
    load: () => ({ track: '/b.mp3', at: 27 }),
    save() {},
    clear() {},
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio(track) {
      assert.equal(track, '/b.mp3');
      return audio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore,
    random() {
      randomCalls += 1;
      return 0;
    },
  });

  assert.equal(await player.start(), false);
  assert.equal(await player.toggle(), true);
  assert.equal(audio.currentTime, 27);
  assert.equal(audio.playCalls, 1);
  assert.equal(randomCalls, 0);
});

test('natural completion clears the stored resume record', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const cleared = [];
  const resumeStore = {
    load: () => null,
    save() {},
    clear() {
      cleared.push(1);
    },
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore,
  });

  assert.equal(await player.start(), true);
  audio.emit('ended');

  assert.equal(cleared.length, 1);
});

test('a stale stored track is cleared and falls back to a fresh random pick', async () => {
  const audios = [createFakeAudio([{ succeeds: true }])];
  const created = [];
  const cleared = [];
  const resumeStore = {
    load: () => ({ track: '/old.mp3', at: 9 }),
    save() {},
    clear() {
      cleared.push(1);
    },
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio(track) {
      created.push(track);
      return audios[0];
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore,
  });

  assert.equal(await player.toggle(), true);
  assert.deepEqual(created, ['/a.mp3']);
  assert.equal(cleared.length, 1);
});

test('audio error keeps the stored resume record for a later retry', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const cleared = [];
  const resumeStore = {
    load: () => null,
    save() {},
    clear() {
      cleared.push(1);
    },
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore,
  });

  assert.equal(await player.start(), true);
  audio.emit('error');

  assert.equal(cleared.length, 0);
});

test('a failed resume attempt stays idle and keeps the stored record', async () => {
  const audio = createFakeAudio([{ succeeds: false }]);
  const cleared = [];
  const controlStates = [];
  const resumeStore = {
    load: () => ({ track: '/a.mp3', at: 5 }),
    save() {},
    clear() {
      cleared.push(1);
    },
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
    resumeStore,
  });

  assert.equal(await player.toggle(), false);
  assert.equal(cleared.length, 0);
  assert.deepEqual(controlStates.at(-1), { playing: false });
});
```

- [ ] **Step 3: Run the music suite and confirm RED**

Run: `node --test tests/home-music.test.mjs` (unrestricted if the sandbox denies child pipes).

Expected: the six new tests fail (module does not save/load/clear yet); the other tests still pass.

### Task 2: Wire resumeStore into the player module (GREEN)

**Files:**
- Modify: `src/main/resources/static/js/home-music.mjs`

- [ ] **Step 1: Accept the resumeStore option**

In `createHomeMusicPlayer`, add `resumeStore` to the destructured options after `random`:

```js
  setControlState,
  hasUserInteracted = () => false,
  random = Math.random,
  resumeStore,
}) {
```

- [ ] **Step 2: Add fault-tolerant helpers after `armRetry`**

```js
  function safeResumeCall(fn) {
    if (!resumeStore) {
      return;
    }

    try {
      Promise.resolve(fn()).catch(() => {});
    } catch {
      // A failing resume record never breaks playback state.
    }
  }

  async function loadResumeRecord() {
    if (!resumeStore) {
      return null;
    }

    try {
      return await resumeStore.load();
    } catch {
      return null;
    }
  }
```

- [ ] **Step 3: Split ended from error handling**

Replace the shared `handleStopped` with two handlers and update the audio listeners:

```js
  // 自然结束：释放元素并清掉暂停位置记录；会话曲目仍留给本页重播。
  function handleEnded() {
    audio = null;
    phase = 'ended';
    safeResumeCall(() => resumeStore.clear());
    publish(false);
  }

  // 加载失败：同样回空闲，但保留位置记录供稍后重试。
  function handleError() {
    audio = null;
    phase = 'ended';
    publish(false);
  }
```

In `createTrackAudio`, change the listener registrations to:

```js
    next.addEventListener('ended', handleEnded);
    next.addEventListener('error', handleError);
```

- [ ] **Step 4: Save position on user pause and resume from the stored record**

In `toggle()`, replace the pause branch:

```js
      if (phase === 'playing') {
        audio.pause();
        phase = 'paused';
        publish(false);
        safeResumeCall(() =>
          resumeStore.save({ track: sessionTrack, at: audio.currentTime }),
        );
        return true;
      }
```

Replace the no-audio branch:

```js
      if (!audio) {
        // 无本页会话曲目时，先尝试从上次暂停处继续同一首。
        if (!sessionTrack) {
          const record = await loadResumeRecord();
          const usable =
            record &&
            typeof record.track === 'string' &&
            Number.isFinite(record.at) &&
            record.at >= 0 &&
            tracks.includes(record.track);

          if (usable) {
            sessionTrack = record.track;
            audio = createTrackAudio(record.track);
            audio.currentTime = record.at;
            phase = 'pending';
            const didPlay = await attemptPlay();
            if (!didPlay) {
              audio = null;
              phase = 'none';
              publish(false);
            }
            return didPlay;
          }

          if (record) {
            safeResumeCall(() => resumeStore.clear());
          }
        }

        return startFresh();
      }
```

- [ ] **Step 5: Syntax-check and run the music suite**

Run: `node --check src/main/resources/static/js/home-music.mjs` then `node --test tests/home-music.test.mjs`.

Expected: syntax check silent; all music tests pass (GREEN), including the six new resume-memory tests.

### Task 3: localStorage implementation, cache stamps and verifier

**Files:**
- Modify: `src/main/resources/static/js/home.mjs`
- Modify: `src/main/resources/templates/home/index.html`
- Modify: `tests/home-music.test.mjs` (version literals)
- Modify: `scripts/verify-music-sway.ps1`

- [ ] **Step 1: Build resumeStore over localStorage in home.mjs**

Inside `initializeHomeMusic`, right before `const musicPlayer = createHomeMusicPlayer({`, add:

```js
    const resumeStore = {
      load() {
        try {
          const raw = window.localStorage.getItem('home-music-resume-v1');
          if (!raw) {
            return null;
          }
          const parsed = JSON.parse(raw);
          return parsed &&
            typeof parsed.track === 'string' &&
            typeof parsed.at === 'number'
            ? parsed
            : null;
        } catch {
          return null;
        }
      },
      save(record) {
        try {
          window.localStorage.setItem('home-music-resume-v1', JSON.stringify(record));
        } catch {
          // Progress memory is optional.
        }
      },
      clear() {
        try {
          window.localStorage.removeItem('home-music-resume-v1');
        } catch {
          // Progress memory is optional.
        }
      },
    };
```

Pass it into the player options (add `resumeStore,` after `random`-adjacent entries, e.g. right after `setControlState` block is defined — the option belongs on the `createHomeMusicPlayer({ ... })` object literal, e.g. after `hasUserInteracted`):

```js
      hasUserInteracted: () => hasUserInteracted,
      resumeStore,
```

- [ ] **Step 2: Bump the cache stamps to 20260905**

- `home.mjs` dynamic import: `./home-music.mjs?v=20260904` → `./home-music.mjs?v=20260905`
- `home/index.html` script tag: `(v='20260904')` → `(v='20260905')`
- `tests/home-music.test.mjs`: replace every remaining `20260904` literal with `20260905` (PowerShell replace-all)
- `scripts/verify-music-sway.ps1`: replace `(v='20260904')` with `(v='20260905')`

- [ ] **Step 3: Assert the resume wiring in the bootstrap test**

In the test `home bootstrap starts first-visit music without changing article shuffle integration`, after the existing `assert.match(script, /new Audio\(url\)/);` line add:

```js
  assert.match(script, /home-music-resume-v1/);
  assert.match(script, /resumeStore,/);
```

(The `resumeStore.save({ track, at })` call text lives in `home-music.mjs`, not in `home.mjs`; its behavior is covered by the module unit tests in Task 1.)

- [ ] **Step 4: Run all checks**

Run:

```powershell
node --check src/main/resources/static/js/home.mjs
node --test tests/home-music.test.mjs
node --test "tests/*.test.mjs"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-music-sway.ps1
```

Expected: all silent/green; the verifier prints `Music sway verification passed.` and the full Node suite (100 tests) passes with 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/main/resources/static/js/home-music.mjs src/main/resources/static/js/home.mjs src/main/resources/templates/home/index.html tests/home-music.test.mjs scripts/verify-music-sway.ps1
git commit -m "feat: resume paused home music from its saved position"
```

### Task 4: README, resource sync, browser smoke test and full suites

**Files:**
- Modify: `README.md:33`
- Verify: build output, running app behavior, full test suites, final git state

- [ ] **Step 1: Update the README feature bullet**

Change the music bullet so the pause clause reads (keep the rest of the bullet unchanged):

```markdown
- 🎵 **首页音乐**：首次访问首页自动随机播放一首内置音轨（浏览器自动播放策略可能延迟到首次交互后开始）；此后回到首页，右下角音乐按钮始终可见——点击 ▶ 播放，本页内单曲播放完毕可点击重播同一首，暂停即停；暂停的位置会被记住，离开页面再回来点 ▶ 会从暂停处继续播放同一首，听完则重置；播放期间按钮会轻轻摆动
```

- [ ] **Step 2: Sync resources into the build output**

Run `mvn -q process-resources` (ASCII mapped drive fallback if the Chinese path breaks). Confirm `target\classes\static\js\home-music.mjs` contains `home-music-resume` markers, `home-music.mjs` contains `resumeStore.save`, `home.mjs` contains `home-music-resume-v1`, and the template contains `v='20260905'`.

- [ ] **Step 3: Restart the app and run the browser smoke test**

Stop any running `mvn spring-boot:run`, start a fresh one, wait for the Tomcat port log (8081). With headless Edge via CDP (unique profile + port per run as before):

1. Fresh profile, first visit: wait for playing, click to pause, read `localStorage['home-music-resume-v1']` — it must be valid JSON with a `track` and an `at` number greater than 0.
2. Reload the same page (same profile): button must load idle ▶; click ▶ and poll until playing — no crash, icon Ⅱ and sway class appear.
3. Optionally assert `localStorage['home-music-resume-v1']` still exists right after the resume click and is removed only after the track naturally ends (unit tests cover the clearing logic; a browser wait for full song end is optional).

- [ ] **Step 4: Run the full verification suites**

Run `node --test "tests/*.test.mjs"` and `mvn test` (unrestricted if Mockito needs agent attach). Expected: Node 0 failures; Maven `BUILD SUCCESS` with 0 failures/errors.

- [ ] **Step 5: Inspect and commit**

Run `git diff --check` and `git status --short`. Expected: only feature files changed; pre-existing unrelated untracked files must NOT be staged.

```bash
git add README.md
git commit -m "docs: describe pause position memory for home music"
```

- [ ] **Step 6: Final state**

Keep the app running for the user's manual check; report the commit list.
