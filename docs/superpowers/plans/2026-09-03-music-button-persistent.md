# Persistent Home Music Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home-page music control button never disappears: it is always visible on the home page, first-ever visit still autoplays one random track, repeat visits show an idle ▶ that starts music on click, and within one page session an ended track can be replayed (same track) from the idle ▶.

**Architecture:** Rework `home-music.mjs` from a "visibility + once-per-browser autoplay" model to a "phase + per-session track" model. The module drops the `visible` concept and publishes `setControlState({ playing })` only. The session track is chosen once per page load at the first real play; pause keeps the same `Audio` element, natural end or load error releases it but keeps the track for replay. `home.mjs` no longer hides the button; `home/index.html` ships the button visible in the idle ▶ state. CSS (sway) is untouched. Spec: `docs/superpowers/specs/2026-09-03-music-button-persistent-design.md`.

**Tech Stack:** ES module, Node test runner (`node --test`), PowerShell structural verification, Maven resource copy.

---

### Task 1: Adapt and extend the unit tests to the persistent-button semantics (RED)

**Files:**
- Modify: `tests/home-music.test.mjs`

Background: the file keeps its helpers (lines 1-93) unchanged. Several tests assert `{ visible: ..., playing: ... }` state objects, hide-on-end, and toggle-denied-after-end; two bootstrap tests and the template test read `home.mjs`/`index.html` sources. All must encode the new semantics **before** the module changes, so the suite turns RED.

- [ ] **Step 1: Globally rewrite the published state shapes**

The module will publish only `{ playing }`. Replace all three shapes file-wide (PowerShell):

```powershell
$p = 'tests\home-music.test.mjs'
$c = Get-Content -LiteralPath $p -Encoding utf8 -Raw
$c = $c.Replace('{ visible: true, playing: true }', '{ playing: true }')
$c = $c.Replace('{ visible: true, playing: false }', '{ playing: false }')
$c = $c.Replace('{ visible: false, playing: false }', '{ playing: false }')
Set-Content -LiteralPath $p -Value $c -Encoding utf8 -NoNewline
```

- [ ] **Step 2: Replace the hide-on-end test with replay-the-same-track semantics**

Replace the whole test named `natural track completion hides controls and prevents replay` (currently asserts ending hides the control and `toggle()` returns false) with:

```js
test('natural track completion keeps the control idle and replay restarts the same track', async () => {
  const firstAudio = createFakeAudio([{ succeeds: true }]);
  const secondAudio = createFakeAudio([{ succeeds: true }]);
  const tracks = ['/a.mp3', '/b.mp3'];
  const created = [];
  const controlStates = [];
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks,
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio(track) {
      created.push(track);
      return created.length === 1 ? firstAudio : secondAudio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
    random: () => 0,
  });

  assert.equal(await player.start(), true);
  assert.deepEqual(created, ['/a.mp3']);
  firstAudio.emit('ended');

  assert.deepEqual(controlStates.at(-1), { playing: false });
  assert.equal(await player.toggle(), true);
  assert.deepEqual(created, ['/a.mp3', '/a.mp3']);
  assert.equal(firstAudio.playCalls, 1);
  assert.equal(secondAudio.playCalls, 1);
  assert.deepEqual(controlStates.at(-1), { playing: true });
  assert.equal(markPlayedCalls, 1);
});
```

- [ ] **Step 3: Replace the async-mark-pending replay-block test**

Replace `completed playback cannot restart while async visit persistence is pending` with a version asserting that after `ended` the *autoplay* gate stays closed (`start()` false, still one audio) while a user replay via `toggle()` is allowed even while `markPlayed` is still pending:

```js
test('ended playback blocks autoplay restart but allows a same-track user replay while persistence is pending', async () => {
  const markPlayed = createDeferred();
  const audios = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: async () => false,
      markPlayed: () => markPlayed.promise,
    },
    createAudio() {
      const audio = createFakeAudio([{ succeeds: true }]);
      audios.push(audio);
      return audio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  assert.equal(await player.start(), true);
  audios[0].emit('ended');

  assert.equal(await player.start(), false);
  assert.equal(audios.length, 1);

  assert.equal(await player.toggle(), true);
  assert.equal(audios.length, 2);
  assert.equal(audios[1].playCalls, 1);

  markPlayed.resolve();
  await waitForAsyncEvents();
});
```

- [ ] **Step 4: Replace the toggle-before-start test with repeat-visit click-to-play**

Replace `toggle before start returns false` with:

```js
test('toggle on a repeat visit starts a freshly chosen session track', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const controlStates = [];
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: {
      hasPlayed: () => true,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
    random: () => 0,
  });

  assert.equal(await player.start(), false);

  assert.equal(await player.toggle(), true);
  assert.equal(audio.playCalls, 1);
  assert.deepEqual(controlStates.at(-1), { playing: true });
  assert.equal(markPlayedCalls, 1);
});
```

- [ ] **Step 5: Add the error-event and session-stability tests**

Append after the `synchronous markPlayed failure does not break playback state` test:

```js
test('audio load error releases the element but keeps the control idle and replayable', async () => {
  const firstAudio = createFakeAudio([{ succeeds: true }]);
  const secondAudio = createFakeAudio([{ succeeds: true }]);
  const created = [];
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed() {} },
    createAudio(track) {
      created.push(track);
      return created.length === 1 ? firstAudio : secondAudio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);
  firstAudio.emit('error');

  assert.deepEqual(controlStates.at(-1), { playing: false });
  assert.equal(await player.toggle(), true);
  assert.deepEqual(created, ['/a.mp3', '/a.mp3']);
  assert.equal(secondAudio.playCalls, 1);
});

test('session track is chosen once and reused across pause, end and replay', async () => {
  const audios = [
    createFakeAudio([{ succeeds: true }, { succeeds: true }]),
    createFakeAudio([{ succeeds: true }]),
  ];
  const created = [];
  let randomCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio(track) {
      created.push(track);
      return audios[created.length - 1];
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    random() {
      randomCalls += 1;
      return 0.999999;
    },
  });

  assert.equal(await player.start(), false);

  assert.equal(await player.toggle(), true);
  assert.equal(await player.toggle(), true); // pause
  assert.equal(await player.toggle(), true); // resume same element
  assert.equal(created[0], '/b.mp3');
  assert.equal(randomCalls, 1);

  audios[0].emit('ended');
  assert.equal(await player.toggle(), true);
  assert.deepEqual(created, ['/b.mp3', '/b.mp3']);
  assert.equal(randomCalls, 1);
});
```

Note: in the second appended test the fake audios need per-element outcome sequences; the second fake's `pause()` is never exercised, and `pause` on the first fake must not consume an outcome (pause does not touch `outcomes` in the helper — verified against the helper at the top of the file).

- [ ] **Step 6: Rewrite the two home bootstrap tests and the template test for the new wiring**

Replace the test `home bootstrap starts first-visit music without changing article shuffle integration` with:

```js
test('home bootstrap starts first-visit music without changing article shuffle integration', () => {
  const script = readFileSync(
    'src/main/resources/static/js/home.mjs',
    'utf8',
  );

  assert.doesNotMatch(
    script,
    /import\s*\{[^}]*createFirstVisitStore[^}]*createHomeMusicPlayer[^}]*\}\s*from\s*['"]\.\/home-music\.mjs\?v=20260904['"];/s,
  );
  assert.match(script, /async function initializeHomeMusic\(\)/);
  assert.match(
    script,
    /try\s*\{[\s\S]*?await import\(['"]\.\/home-music\.mjs\?v=20260904['"]\)[\s\S]*?\}\s*catch\s*\{/,
  );
  assert.match(
    script,
    /createFirstVisitStore\s*\(\s*window\.localStorage,\s*['"]home-music-played-v1['"],?\s*\)/,
  );
  assert.match(script, /new Audio\(url\)/);
  assert.match(
    script,
    /musicToggle\.addEventListener\(['"]click['"],\s*\(event\)\s*=>\s*\{[\s\S]*?event\.stopPropagation\(\)[\s\S]*?void musicPlayer\.toggle\(\)\.catch\(\(\)\s*=>\s*\{\}\)/,
  );
  assert.match(script, /await musicPlayer\.start\(\)/);
  assert.match(script, /playing \? '暂停背景音乐' : '播放背景音乐'/);
  assert.doesNotMatch(script, /musicToggle\.hidden/);
  assert.doesNotMatch(script, /visible/);
  assert.match(script, /void initializeHomeMusic\(\)/);

  assert.match(script, /async function loadPosts\(reshuffle\)/);
  assert.match(script, /shuffleBtn\.dataset\.endpoint/);
  assert.match(script, /shuffleBtn\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*loadPosts\(true\)\)/);

  const shuffleRegistration = script.indexOf('shuffleBtn.addEventListener');
  const guardedMusicImport = script.indexOf("await import('./home-music.mjs?v=20260904')");
  assert.notEqual(shuffleRegistration, -1);
  assert.notEqual(guardedMusicImport, -1);
  assert.ok(
    shuffleRegistration < guardedMusicImport,
    'shuffle listener must be registered before loading optional music code',
  );
});
```

Replace the test `home bootstrap observes interaction before import and removes only its observer listeners` with:

```js
test('home bootstrap observes interaction before import and removes only its observer listeners', () => {
  const script = readFileSync(
    'src/main/resources/static/js/home.mjs',
    'utf8',
  );

  assert.match(script, /let\s+hasUserInteracted\s*=\s*false/);
  assert.match(script, /const\s+observeUserInteraction\s*=\s*\(\)\s*=>\s*\{\s*hasUserInteracted\s*=\s*true;?\s*\}/s);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.match(
      script,
      new RegExp(`document\\.addEventListener\\(['"]${type}['"],\\s*observeUserInteraction`),
    );
    assert.match(
      script,
      new RegExp(`document\\.removeEventListener\\(['"]${type}['"],\\s*observeUserInteraction`),
    );
  }
  assert.match(script, /hasUserInteracted:\s*\(\)\s*=>\s*hasUserInteracted/);
  assert.match(script, /try\s*\{[\s\S]*await import\([\s\S]*await musicPlayer\.start\(\)[\s\S]*\}\s*catch\s*\{[\s\S]*\}\s*finally\s*\{[\s\S]*removeEventListener/s);

  const observerRegistration = script.indexOf("document.addEventListener('click', observeUserInteraction");
  const guardedMusicImport = script.indexOf("await import('./home-music.mjs?v=20260904')");
  assert.ok(observerRegistration !== -1 && observerRegistration < guardedMusicImport);
  assert.doesNotMatch(script, /removeEventListener\([^,]+,\s*retryPlayback/);
});
```

Replace the test `home template exposes two music tracks through an icon-only hidden control` with:

```js
test('home template exposes two music tracks through an icon-only always-visible control', () => {
  const template = readFileSync(
    'src/main/resources/templates/home/index.html',
    'utf8',
  );

  assert.match(template, /id="home-music"/);
  assert.match(template, /data-track-one=@\{\/audio\/mu-xin\.mp3\}/);
  assert.match(template, /data-track-two=@\{\/audio\/luo-xiao-han\.mp3\}/);

  const button = template.match(
    /<button\b(?<attributes>[^>]*\bid="music-toggle"[^>]*)>(?<content>[\s\S]*?)<\/button>/,
  );
  assert.ok(button, 'expected the home music toggle button');
  assert.doesNotMatch(button.groups.attributes, /\bhidden\b/);
  assert.match(button.groups.attributes, /aria-label="播放背景音乐"/);
  assert.match(button.groups.attributes, /aria-pressed="false"/);
  assert.match(
    button.groups.content.trim(),
    /^<span class="music-toggle-icon" aria-hidden="true">▶<\/span>$/,
  );
  assert.doesNotMatch(button.groups.content, /播放中|已暂停|木心|罗小涵|mu-xin|luo-xiao-han/i);
});
```

- [ ] **Step 7: Run the music suite and confirm RED**

Run (needs unrestricted mode for the test runner's child processes if the sandbox denies pipes):

```powershell
node --test tests/home-music.test.mjs
```

Expected: multiple failures, all caused by the module still hiding controls on end, still publishing `visible`, and still refusing `toggle()` after end / before start.

### Task 2: Rework the player module to the phase + session-track model (GREEN)

**Files:**
- Modify: `src/main/resources/static/js/home-music.mjs`

- [ ] **Step 1: Replace the module body**

Replace everything below the unchanged `createFirstVisitStore` and `pickRandomTrack` helpers (keep their code exactly as-is) with:

```js
const INTERACTION_EVENTS = ['click', 'touchstart', 'keydown'];

export function createHomeMusicPlayer({
  tracks,
  store,
  createAudio,
  interactionTarget,
  setControlState,
  hasUserInteracted = () => false,
  random = Math.random,
}) {
  // 每次页面加载的会话：曲目只随机选一次；phase 描述当前播放阶段。
  let sessionTrack = null;
  let audio = null;
  let phase = 'none'; // none | pending | playing | paused | ended
  let retryArmed = false;
  let markedPlayed = false;

  function publish(playing) {
    setControlState({ playing });
  }

  function disarmRetry() {
    if (!retryArmed) {
      return;
    }

    retryArmed = false;
    for (const eventName of INTERACTION_EVENTS) {
      interactionTarget.removeEventListener(eventName, retryPlayback);
    }
  }

  function handlePlaying() {
    if (!markedPlayed) {
      markedPlayed = true;
      try {
        Promise.resolve(store.markPlayed()).catch(() => {});
      } catch {
        // Playback state remains usable when visit persistence is unavailable.
      }
    }

    disarmRetry();
    phase = 'playing';
    publish(true);
  }

  // 自然结束或加载失败：释放元素、保持空闲，会话曲目留给下次重播。
  function handleStopped() {
    audio = null;
    phase = 'ended';
    publish(false);
  }

  function ensureSessionTrack() {
    if (!sessionTrack) {
      sessionTrack = pickRandomTrack(tracks, random);
    }
    return sessionTrack;
  }

  function createTrackAudio(track) {
    const next = createAudio(track);
    next.loop = false;
    next.addEventListener('playing', handlePlaying);
    next.addEventListener('ended', handleStopped);
    next.addEventListener('error', handleStopped);
    return next;
  }

  async function attemptPlay() {
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  function retryPlayback() {
    disarmRetry();
    void attemptPlay();
  }

  function armRetry() {
    if (retryArmed) {
      return;
    }

    retryArmed = true;
    for (const eventName of INTERACTION_EVENTS) {
      interactionTarget.addEventListener(eventName, retryPlayback);
    }
  }

  // 新建播放元素（空闲/结束后的首次或重播入口）；失败即释放回空闲。
  async function startFresh() {
    const track = ensureSessionTrack();
    if (!track) {
      return false;
    }

    audio = createTrackAudio(track);
    phase = 'pending';
    const didPlay = await attemptPlay();
    if (!didPlay) {
      audio = null;
      phase = 'none';
      publish(false);
    }
    return didPlay;
  }

  return {
    // 首次访问自动播放入口；会话内已有活动或已自动播放过则拒绝。
    async start() {
      if (audio || sessionTrack || markedPlayed) {
        return false;
      }

      let hasPlayed = false;
      try {
        hasPlayed = await store.hasPlayed();
      } catch {
        // Treat unavailable visit state as a first visit.
      }
      if (audio || sessionTrack || markedPlayed || hasPlayed) {
        return false;
      }

      const track = ensureSessionTrack();
      if (!track) {
        return false;
      }

      audio = createTrackAudio(track);
      phase = 'pending';

      const didPlay = await attemptPlay();
      if (!didPlay) {
        if (hasUserInteracted()) {
          const didCompensate = await attemptPlay();
          if (!didCompensate) {
            armRetry();
          }
          return didCompensate;
        }
        armRetry();
      }

      return didPlay;
    },

    // 用户点击按钮：播放/暂停/续播/结束后重播同曲，统一入口。
    async toggle() {
      if (retryArmed) {
        disarmRetry();
      }

      if (!audio) {
        return startFresh();
      }

      if (audio.paused) {
        const didPlay = await attemptPlay();
        if (!didPlay) {
          publish(false);
        }
        return didPlay;
      }

      if (phase === 'playing') {
        audio.pause();
        phase = 'paused';
        publish(false);
        return true;
      }

      // pending：自动播放的 play() 仍在等待（等待浏览器放行），不打断它。
      return attemptPlay();
    },
  };
}
```

- [ ] **Step 2: Syntax-check and run the music suite**

```powershell
node --check src/main/resources/static/js/home-music.mjs
node --test tests/home-music.test.mjs
```

Expected: syntax check silent; all **logic** tests pass (GREEN). The only remaining failures must be the source-structure tests (the two bootstrap tests and the template test, which read `home.mjs`/`index.html` and are still pinned to the old wiring) — they turn green in Task 3 after the template and `home.mjs` are rewired. If any appended test trips over fake-audio details (e.g., `pause()` consuming nothing, `emit('error')` reachable), align the fake in Task 1 tests rather than weakening the module.

### Task 3: Always-visible button wiring (template, home.mjs, verifier, stamps)

**Files:**
- Modify: `src/main/resources/templates/home/index.html`
- Modify: `src/main/resources/static/js/home.mjs`
- Modify: `scripts/verify-music-sway.ps1`
- Modify: `tests/home-music.test.mjs` (cache stamp literals, if not already handled)

- [ ] **Step 1: Make the template button visible and idle**

In `home/index.html`, replace the whole `#home-music` block:

```html
  <div id="home-music"
       th:attr="data-track-one=@{/audio/mu-xin.mp3},data-track-two=@{/audio/luo-xiao-han.mp3}">
    <button type="button" id="music-toggle" class="music-toggle"
            aria-label="播放背景音乐" aria-pressed="false">
      <span class="music-toggle-icon" aria-hidden="true">▶</span>
    </button>
  </div>
```

- [ ] **Step 2: Rewire home.mjs state handling**

Replace the whole `initializeHomeMusic` music block so it publishes `{ playing }`, never touches `hidden`, stops the click from bubbling (so document-level autoplay retry listeners and the tag handler do not double-fire), and bumps the module import stamp:

```js
async function initializeHomeMusic() {
  const musicRoot = document.getElementById('home-music');
  const musicToggle = document.getElementById('music-toggle');
  if (!musicRoot || !musicToggle) {
    return;
  }

  let hasUserInteracted = false;
  const observeUserInteraction = () => {
    hasUserInteracted = true;
  };
  document.addEventListener('click', observeUserInteraction);
  document.addEventListener('touchstart', observeUserInteraction);
  document.addEventListener('keydown', observeUserInteraction);

  try {
    const {
      createFirstVisitStore,
      createHomeMusicPlayer,
    } = await import('./home-music.mjs?v=20260904');
    const tracks = [
      musicRoot.dataset.trackOne,
      musicRoot.dataset.trackTwo,
    ].filter((track) => typeof track === 'string' && track.trim().length > 0);
    const musicIcon = musicToggle.querySelector('.music-toggle-icon');
    const store = createFirstVisitStore(
      window.localStorage,
      'home-music-played-v1',
    );
    const musicPlayer = createHomeMusicPlayer({
      tracks,
      store,
      createAudio: (url) => new Audio(url),
      interactionTarget: document,
      hasUserInteracted: () => hasUserInteracted,
      setControlState({ playing }) {
        musicToggle.classList.toggle('music-playing', playing);
        musicToggle.setAttribute('aria-pressed', String(playing));
        musicToggle.setAttribute(
          'aria-label',
          playing ? '暂停背景音乐' : '播放背景音乐',
        );
        if (musicIcon) {
          musicIcon.textContent = playing ? 'Ⅱ' : '▶';
        }
      },
    });

    musicToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      void musicPlayer.toggle().catch(() => {});
    });
    await musicPlayer.start();
  } catch {
    // 背景音乐是渐进增强；初始化异常不影响文章浏览与换一批。
  } finally {
    document.removeEventListener('click', observeUserInteraction);
    document.removeEventListener('touchstart', observeUserInteraction);
    document.removeEventListener('keydown', observeUserInteraction);
  }
}
```

- [ ] **Step 3: Bump the page-level cache stamp**

In `home/index.html` change the module script tag:

```html
<script th:src="@{/js/home.mjs(v='20260904')}" type="module"></script>
```

- [ ] **Step 4: Align the sway verifier with the always-visible button**

In `scripts/verify-music-sway.ps1`, replace the template check block:

```powershell
if (-not $template.Contains('aria-label="播放背景音乐"')) {
    throw 'Idle aria-label is missing from the home music button.'
}
if ($template.Contains('id="music-toggle" class="music-toggle" hidden')) {
    throw 'Home music button must no longer start hidden.'
}
if (-not $template.Contains("(v='20260904')")) {
    throw 'home.mjs cache version was not bumped in the home template.'
}
```

Keep every other check (sway class, keyframes, reduced motion, class toggle in home.mjs) unchanged.

- [ ] **Step 5: Update remaining cache stamp literals in tests**

If any `20260903` literal remains in `tests/home-music.test.mjs`, replace all with `20260904` (PowerShell replace-all on the literal), then run:

```powershell
node --check src/main/resources/static/js/home.mjs
node --test tests/home-music.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-music-sway.ps1
node --test "tests/*.test.mjs"
```

Expected: both syntax checks silent; music suite and the full Node suite (92+ tests) pass; the verifier prints `Music sway verification passed.`

- [ ] **Step 6: Commit**

```bash
git add src/main/resources/static/js/home-music.mjs src/main/resources/static/js/home.mjs src/main/resources/templates/home/index.html tests/home-music.test.mjs scripts/verify-music-sway.ps1
git commit -m "feat: keep home music button always visible and replayable"
```

### Task 4: README, resource sync and full verification

**Files:**
- Modify: `README.md:33`
- Verify: served files through the running app; full test suites; final git state

- [ ] **Step 1: Update the README feature bullet**

Replace the existing `🎵 **首页音乐**` bullet text with:

```markdown
- 🎵 **首页音乐**：首次访问首页自动随机播放一首内置音轨（浏览器自动播放策略可能延迟到首次交互后开始）；此后回到首页，右下角音乐按钮始终可见——点击 ▶ 播放，本页内单曲播放完毕可点击重播同一首，暂停即停；播放期间按钮会轻轻摆动
```

Check the README Node-test description bullet (line ~178) still matches its `首页音乐` regex; adjust wording only if the regex fails.

- [ ] **Step 2: Sync resources into the build output**

Run from the repository root: `mvn -q process-resources` (fall back to an ASCII substituted drive, `subst T: ...`, if the Chinese path breaks Maven). Confirm `target\classes\static\js\home-music.mjs` contains `phase = 'ended'`, `target\classes\static\js\home.mjs` no longer assigns `musicToggle.hidden`, and `target\classes\templates\home\index.html` contains `aria-label="播放背景音乐"` and `v='20260904'`.

- [ ] **Step 3: Restart the app and run the browser behavior check**

Stop any running `mvn spring-boot:run` job, start a fresh one, and wait for the `Tomcat started on port` log line (port 8081).

Then drive headless Edge via CDP (same technique as the sway QA: `--remote-debugging-port`, `--remote-allow-origins=*`, `--autoplay-policy=no-user-gesture-required`, fresh `--user-data-dir` per scenario) and assert:

1. **Fresh profile** (first visit): within 30 s the button is visible (`hidden === false`, DOM-wise no `hidden` attribute), `aria-pressed="true"`, `music-playing` class present, and two computed `transform` samples 700 ms apart differ (sway running).
2. **Same profile, second load** (repeat visit): button visible on load with `aria-pressed="false"` and no `music-playing` class; clicking it turns it to `aria-pressed="true"` with sway; clicking again pauses (`aria-pressed="false"`, transform settles).
3. **Article detail page** `http://localhost:8081/article/<id>`: no `#music-toggle` element exists (button stays home-only). Fetch the home page listing first to obtain a real article id.

- [ ] **Step 4: Run the full verification suites**

Run `node --test "tests/*.test.mjs"` and `mvn test` (unrestricted if Mockito needs agent attach to system temp). Expected: Node 0 failures; Maven `BUILD SUCCESS` with 0 failures/errors.

- [ ] **Step 5: Inspect and commit**

Run `git diff --check` and `git status --short`. Expected: no whitespace errors; only feature files changed; pre-existing unrelated untracked files (`音乐包/`, snack-shop refactor docs, `tests/mall-snackshop-integration-plan.md`) must NOT be staged.

```bash
git add README.md
git commit -m "docs: describe persistent home music button"
```

- [ ] **Step 6: Final state**

Stop the background app only after the user confirms they are done viewing. Report commit list and remind that `home.css` sway tuning is untouched by this feature.
