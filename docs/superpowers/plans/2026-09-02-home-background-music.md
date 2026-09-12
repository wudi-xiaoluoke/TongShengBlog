# Home First-Visit Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play one randomly selected local MP3 on a visitor's first home-page visit only, with an unobtrusive sticky-note pause/resume control and a replaceable first-visit state boundary.

**Architecture:** Keep browser-independent selection, persistence, autoplay retry, and playback state logic in a focused ES module. The existing home module wires that logic to `localStorage`, the browser `Audio` API, the document interaction events, and the home-page control. Thymeleaf only declares the two track URLs and the hidden control, while Spring Boot serves copied MP3 files from its standard static resource directory.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, Thymeleaf, CSS, Spring Boot MockMvc, Maven

---

## File Structure

- Create `src/main/resources/static/js/home-music.mjs`: reusable first-visit store and playback coordinator with dependency injection for tests and future account-backed state.
- Create `tests/home-music.test.mjs`: behavior tests for selection, persistence, autoplay rejection/retry, pause/resume, and safe storage fallback.
- Modify `src/main/resources/static/js/home.mjs`: preserve article shuffling and bootstrap music from template data attributes.
- Modify `src/main/resources/templates/home/index.html`: declare track URLs and add the hidden accessible music control.
- Modify `src/main/resources/static/css/home.css`: style the selected mini sticky-note control and its responsive hit target.
- Create `src/main/resources/static/audio/mu-xin.mp3`: deployable copy of `音乐包/木馨.mp3` with an ASCII URL-safe filename.
- Create `src/main/resources/static/audio/luo-xiao-han.mp3`: deployable copy of `音乐包/罗小涵.mp3` with an ASCII URL-safe filename.
- Modify `src/test/java/com/tongsheng/blog/StaticResourceMimeTypeTests.java`: verify both MP3 resources are served with audio content types.
- Modify `README.md`: document first-visit music behavior and the new static audio directory.

### Task 1: First-Visit Store and Random Track Selection

**Files:**
- Create: `tests/home-music.test.mjs`
- Create: `src/main/resources/static/js/home-music.mjs`

- [ ] **Step 1: Write failing store and selection tests**

Create `tests/home-music.test.mjs` with tests that define the intended API:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFirstVisitStore,
  pickRandomTrack,
} from '../src/main/resources/static/js/home-music.mjs';

test('first-visit store persists successful playback', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = createFirstVisitStore(storage, 'home-music-played');

  assert.equal(store.hasPlayed(), false);
  store.markPlayed();
  assert.equal(store.hasPlayed(), true);
  assert.equal(values.get('home-music-played'), '1');
});

test('first-visit store safely falls back when browser storage throws', () => {
  const storage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  const store = createFirstVisitStore(storage, 'home-music-played');

  assert.equal(store.hasPlayed(), false);
  store.markPlayed();
  assert.equal(store.hasPlayed(), true);
});

test('random selection covers both configured tracks', () => {
  const tracks = ['/audio/mu-xin.mp3', '/audio/luo-xiao-han.mp3'];
  assert.equal(pickRandomTrack(tracks, () => 0), tracks[0]);
  assert.equal(pickRandomTrack(tracks, () => 0.999999), tracks[1]);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/home-music.test.mjs`

Expected: FAIL because `src/main/resources/static/js/home-music.mjs` does not exist.

- [ ] **Step 3: Implement the minimal store and selection functions**

Create `src/main/resources/static/js/home-music.mjs`:

```js
export function createFirstVisitStore(storage, key) {
  let memoryPlayed = false;
  return {
    hasPlayed() {
      try {
        return memoryPlayed || storage?.getItem(key) === '1';
      } catch {
        return memoryPlayed;
      }
    },
    markPlayed() {
      memoryPlayed = true;
      try {
        storage?.setItem(key, '1');
      } catch {
        // Memory state still prevents a second attempt in this page.
      }
    },
  };
}

export function pickRandomTrack(tracks, random = Math.random) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  return tracks[Math.floor(random() * tracks.length)];
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test tests/home-music.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the focused unit**

```bash
git add tests/home-music.test.mjs src/main/resources/static/js/home-music.mjs
git commit -m "feat: add first-visit music state"
```

### Task 2: Playback Coordinator and Autoplay Retry

**Files:**
- Modify: `tests/home-music.test.mjs`
- Modify: `src/main/resources/static/js/home-music.mjs`

- [ ] **Step 1: Add a small fake event target and fake audio to the test file**

Append helpers that exercise real coordinator behavior without mocking module internals:

```js
function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    listenerCount() { return listeners.size; },
  };
}

function createFakeAudio(playResults = [Promise.resolve()]) {
  const listeners = new Map();
  let playIndex = 0;
  return {
    paused: true,
    loop: true,
    playCalls: 0,
    pauseCalls: 0,
    addEventListener(type, listener) { listeners.set(type, listener); },
    play() {
      this.playCalls += 1;
      const result = playResults[Math.min(playIndex++, playResults.length - 1)];
      return result.then(() => {
        this.paused = false;
        listeners.get('playing')?.();
      });
    },
    pause() { this.paused = true; this.pauseCalls += 1; },
  };
}
```

- [ ] **Step 2: Write failing tests for skip, success, and retry behavior**

Import `createHomeMusicPlayer`, then add:

```js
test('already-played visits do not create audio or show the control', async () => {
  let created = 0;
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: { hasPlayed: () => true, markPlayed: () => assert.fail() },
    createAudio: () => { created += 1; },
    interactionTarget: createEventTarget(),
    setControlState: state => controlStates.push(state),
  });

  assert.equal(await player.start(), false);
  assert.equal(created, 0);
  assert.deepEqual(controlStates, []);
});

test('successful playback marks the visit, shows the control, and never loops', async () => {
  const audio = createFakeAudio();
  let marked = 0;
  const states = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: { hasPlayed: () => false, markPlayed: () => { marked += 1; } },
    createAudio: url => { assert.equal(url, '/a.mp3'); return audio; },
    random: () => 0,
    interactionTarget: createEventTarget(),
    setControlState: state => states.push(state),
  });

  assert.equal(await player.start(), true);
  assert.equal(marked, 1);
  assert.equal(audio.loop, false);
  assert.deepEqual(states.at(-1), { visible: true, playing: true });
});

test('blocked autoplay retries once on the first user interaction', async () => {
  const audio = createFakeAudio([Promise.reject(new Error('blocked')), Promise.resolve()]);
  const interactions = createEventTarget();
  let marked = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed: () => { marked += 1; } },
    createAudio: () => audio,
    interactionTarget: interactions,
    setControlState: () => {},
  });

  assert.equal(await player.start(), false);
  assert.equal(interactions.listenerCount(), 3);
  interactions.dispatch('click');
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(audio.playCalls, 2);
  assert.equal(marked, 1);
  assert.equal(interactions.listenerCount(), 0);
});

test('failed playback does not mark the visit', async () => {
  const audio = createFakeAudio([Promise.reject(new Error('broken'))]);
  let marked = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed: () => { marked += 1; } },
    createAudio: () => audio,
    interactionTarget: createEventTarget(),
    setControlState: () => {},
  });

  assert.equal(await player.start(), false);
  assert.equal(marked, 0);
});
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run: `node --test tests/home-music.test.mjs`

Expected: FAIL because `createHomeMusicPlayer` is not exported.

- [ ] **Step 4: Implement the playback coordinator**

Add to `home-music.mjs`:

```js
const INTERACTION_EVENTS = ['click', 'touchstart', 'keydown'];

export function createHomeMusicPlayer({
  tracks,
  store,
  createAudio,
  interactionTarget,
  setControlState,
  random = Math.random,
}) {
  let audio = null;
  let retryArmed = false;
  let recorded = false;

  const disarmRetry = () => {
    if (!retryArmed) return;
    INTERACTION_EVENTS.forEach(type => interactionTarget.removeEventListener(type, retry));
    retryArmed = false;
  };

  const confirmPlaying = () => {
    if (!recorded) {
      recorded = true;
      store.markPlayed();
    }
    disarmRetry();
    setControlState({ visible: true, playing: true });
  };

  const attemptPlay = async () => {
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const retry = () => {
    disarmRetry();
    void attemptPlay();
  };

  const armRetry = () => {
    if (retryArmed) return;
    retryArmed = true;
    INTERACTION_EVENTS.forEach(type => interactionTarget.addEventListener(type, retry, { once: true }));
  };

  return {
    async start() {
      if (store.hasPlayed()) return false;
      const track = pickRandomTrack(tracks, random);
      if (!track) return false;
      audio = createAudio(track);
      audio.loop = false;
      audio.addEventListener('playing', confirmPlaying);
      const started = await attemptPlay();
      if (!started) armRetry();
      return started;
    },
  };
}
```

- [ ] **Step 5: Run the focused test and confirm GREEN**

Run: `node --test tests/home-music.test.mjs`

Expected: all playback tests pass with 0 failures.

- [ ] **Step 6: Commit the coordinator**

```bash
git add tests/home-music.test.mjs src/main/resources/static/js/home-music.mjs
git commit -m "feat: coordinate first-visit music playback"
```

### Task 3: Pause and Resume State

**Files:**
- Modify: `tests/home-music.test.mjs`
- Modify: `src/main/resources/static/js/home-music.mjs`

- [ ] **Step 1: Write failing pause/resume tests**

Add:

```js
test('toggle pauses playing audio and publishes the paused control state', async () => {
  const audio = createFakeAudio();
  const states = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed: () => {} },
    createAudio: () => audio,
    interactionTarget: createEventTarget(),
    setControlState: state => states.push(state),
  });
  await player.start();

  assert.equal(await player.toggle(), true);
  assert.equal(audio.pauseCalls, 1);
  assert.deepEqual(states.at(-1), { visible: true, playing: false });
});

test('toggle resumes paused audio and restores the playing control state', async () => {
  const audio = createFakeAudio();
  const states = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed: () => {} },
    createAudio: () => audio,
    interactionTarget: createEventTarget(),
    setControlState: state => states.push(state),
  });
  await player.start();
  await player.toggle();
  assert.equal(await player.toggle(), true);
  assert.equal(audio.playCalls, 2);
  assert.deepEqual(states.at(-1), { visible: true, playing: true });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/home-music.test.mjs`

Expected: FAIL because `toggle` is not defined on the player returned by Task 2.

- [ ] **Step 3: Complete the minimal toggle behavior**

Add this method to the returned player object:

```js
async toggle() {
  if (!audio) return false;
  if (!audio.paused) {
    audio.pause();
    setControlState({ visible: true, playing: false });
    return true;
  }
  const resumed = await attemptPlay();
  if (!resumed) setControlState({ visible: true, playing: false });
  return resumed;
},
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test tests/home-music.test.mjs`

Expected: all tests pass with 0 failures.

- [ ] **Step 5: Commit pause/resume behavior**

```bash
git add tests/home-music.test.mjs src/main/resources/static/js/home-music.mjs
git commit -m "feat: add background music controls"
```

### Task 4: Home Page Markup, Bootstrap, and Styling

**Files:**
- Modify: `tests/home-music.test.mjs`
- Modify: `src/main/resources/templates/home/index.html`
- Modify: `src/main/resources/static/js/home.mjs`
- Modify: `src/main/resources/static/css/home.css`

- [ ] **Step 1: Write failing integration assertions against source files**

Add source-level tests:

```js
import { readFileSync } from 'node:fs';

test('home template declares both tracks and the hidden music control', () => {
  const template = readFileSync(new URL('../src/main/resources/templates/home/index.html', import.meta.url), 'utf8');
  assert.match(template, /id="home-music"/);
  assert.match(template, /data-track-one/);
  assert.match(template, /data-track-two/);
  assert.match(template, /id="music-toggle"/);
  assert.match(template, /hidden/);
});

test('home bootstrap initializes the player without coupling it to article shuffling', () => {
  const script = readFileSync(new URL('../src/main/resources/static/js/home.mjs', import.meta.url), 'utf8');
  assert.match(script, /createFirstVisitStore/);
  assert.match(script, /createHomeMusicPlayer/);
  assert.match(script, /home-music-played-v1/);
  assert.match(script, /musicPlayer\.start\(\)/);
});

test('music control uses the selected mini sticky-note treatment', () => {
  const css = readFileSync(new URL('../src/main/resources/static/css/home.css', import.meta.url), 'utf8');
  assert.match(css, /\.music-toggle\s*\{/);
  assert.match(css, /background:\s*#fff3b0/);
  assert.match(css, /transform:\s*rotate\(6deg\)/);
  assert.match(css, /width:\s*38px/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?width:\s*44px/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test tests/home-music.test.mjs`

Expected: the three integration assertions fail because markup, bootstrap, and styles are absent.

- [ ] **Step 3: Add the home template declarations**

Before the footer in `home/index.html`, add:

```html
<div id="home-music"
     th:attr="data-track-one=@{/audio/mu-xin.mp3},data-track-two=@{/audio/luo-xiao-han.mp3}">
  <button type="button" id="music-toggle" class="music-toggle" hidden
          aria-label="暂停背景音乐" aria-pressed="false">
    <span class="music-toggle-icon" aria-hidden="true">Ⅱ</span>
  </button>
</div>
```

Update the `home.mjs` cache-busting version in the existing script tag to the current feature version.

- [ ] **Step 4: Bootstrap music in the existing home module**

At the top of `home.mjs`, import the new functions. Keep the existing article shuffling code unchanged, then add guarded initialization:

```js
import { createFirstVisitStore, createHomeMusicPlayer } from './home-music.mjs';

const musicRoot = document.getElementById('home-music');
const musicToggle = document.getElementById('music-toggle');

if (musicRoot && musicToggle) {
  const tracks = [musicRoot.dataset.trackOne, musicRoot.dataset.trackTwo].filter(Boolean);
  const setControlState = ({ visible, playing }) => {
    musicToggle.hidden = !visible;
    musicToggle.setAttribute('aria-pressed', String(!playing));
    musicToggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '继续背景音乐');
    musicToggle.querySelector('.music-toggle-icon').textContent = playing ? 'Ⅱ' : '▶';
  };
  const musicPlayer = createHomeMusicPlayer({
    tracks,
    store: createFirstVisitStore(window.localStorage, 'home-music-played-v1'),
    createAudio: url => new Audio(url),
    interactionTarget: document,
    setControlState,
  });
  musicToggle.addEventListener('click', () => { void musicPlayer.toggle(); });
  void musicPlayer.start();
}
```

- [ ] **Step 5: Add the mini sticky-note CSS**

Style `.music-toggle` with the approved fixed mini sticky-note design:

```css
#home-music{position:relative}
.music-toggle{
  position:fixed;right:18px;bottom:16px;z-index:20;
  display:grid;place-items:center;width:38px;height:38px;padding:0;
  border:0;background:#fff3b0;color:#8a6d3b;
  transform:rotate(6deg);box-shadow:2px 3px 5px rgba(90,70,50,.14);
  font-family:inherit;font-size:14px;cursor:pointer;
}
.music-toggle::before{
  content:'';position:absolute;top:-4px;left:10px;width:24px;height:8px;
  background:rgba(255,255,255,.6);
}
.music-toggle:hover{color:#d1662f;transform:rotate(3deg) translateY(-1px)}
.music-toggle[hidden]{display:none}
@media (max-width:640px){.music-toggle{right:12px;bottom:12px;width:44px;height:44px}}
```

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `node --test tests/home-music.test.mjs`

Expected: all music tests pass with 0 failures.

- [ ] **Step 7: Commit the home integration**

```bash
git add tests/home-music.test.mjs src/main/resources/templates/home/index.html src/main/resources/static/js/home.mjs src/main/resources/static/css/home.css
git commit -m "feat: integrate first-visit music on home page"
```

### Task 5: Static Audio Resources and Server Verification

**Files:**
- Create: `src/main/resources/static/audio/mu-xin.mp3`
- Create: `src/main/resources/static/audio/luo-xiao-han.mp3`
- Modify: `src/test/java/com/tongsheng/blog/StaticResourceMimeTypeTests.java`

- [ ] **Step 1: Write failing MockMvc tests for the two audio URLs**

Add:

```java
@Test
void servesBackgroundMusicWithAudioMimeType() throws Exception {
    mockMvc.perform(get("/audio/mu-xin.mp3"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", startsWith("audio/")));
    mockMvc.perform(get("/audio/luo-xiao-han.mp3"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", startsWith("audio/")));
}
```

- [ ] **Step 2: Run the focused Java test and confirm RED**

Run: `./mvnw -Dtest=StaticResourceMimeTypeTests test` when the Maven wrapper exists; this repository has no wrapper, so use `mvn -Dtest=StaticResourceMimeTypeTests test`.

Expected: FAIL with HTTP 404 for both audio URLs.

- [ ] **Step 3: Copy the user-provided MP3 files into static resources**

Create `src/main/resources/static/audio/`, then copy without modifying the originals:

```powershell
Copy-Item -LiteralPath '音乐包\木馨.mp3' -Destination 'src\main\resources\static\audio\mu-xin.mp3'
Copy-Item -LiteralPath '音乐包\罗小涵.mp3' -Destination 'src\main\resources\static\audio\luo-xiao-han.mp3'
```

- [ ] **Step 4: Run the focused Java test and confirm GREEN**

Run: `mvn -Dtest=StaticResourceMimeTypeTests test`

Expected: both Java test methods pass, including executable JavaScript MIME and MP3 audio MIME.

- [ ] **Step 5: Verify copied files match the originals byte-for-byte**

Run:

```powershell
Get-FileHash '音乐包\木馨.mp3','src\main\resources\static\audio\mu-xin.mp3'
Get-FileHash '音乐包\罗小涵.mp3','src\main\resources\static\audio\luo-xiao-han.mp3'
```

Expected: the source and destination SHA-256 hashes match for each song.

- [ ] **Step 6: Commit the audio resources and server test**

```bash
git add src/test/java/com/tongsheng/blog/StaticResourceMimeTypeTests.java src/main/resources/static/audio/mu-xin.mp3 src/main/resources/static/audio/luo-xiao-han.mp3
git commit -m "feat: serve home background music assets"
```

### Task 6: Documentation and Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the feature and file layout**

Add a feature bullet explaining that the first home-page visit randomly plays one local track, browser policy may defer playback until first interaction, and `localStorage` prevents repeat autoplay. Add `static/audio/` to the project tree description.

- [ ] **Step 2: Run all Node tests**

Run: `node --test "tests/*.test.mjs"`

Expected: all Node tests pass with 0 failures.

- [ ] **Step 3: Run all Java tests**

Run: `mvn test`

Expected: Maven reports `BUILD SUCCESS` with 0 test failures and 0 errors.

- [ ] **Step 4: Build the application package**

Run: `mvn -DskipTests package`

Expected: Maven reports `BUILD SUCCESS` and produces the application JAR under `target/`.

- [ ] **Step 5: Inspect final diff and confirm scope**

Run: `git diff --check HEAD~4..HEAD` and `git status --short`.

Expected: no whitespace errors; only music feature files and pre-existing unrelated untracked files remain. Do not stage the original `音乐包/` directory or other pre-existing untracked files.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "docs: describe first-visit home music"
```

- [ ] **Step 7: Re-run fresh completion verification**

Run:

```powershell
node --test "tests/*.test.mjs"
mvn test
mvn -DskipTests package
git status --short
```

Expected: Node reports 0 failures; Maven test and package commands report `BUILD SUCCESS`; status contains no feature-related unstaged changes and preserves unrelated pre-existing files.
