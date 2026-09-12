import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createFirstVisitStore,
  createHomeMusicPlayer,
  pickRandomTrack,
} from '../src/main/resources/static/js/home-music.mjs';

function createFakeEventTarget() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
    },

    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },

    dispatch(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener({ type });
      }
    },

    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createFakeAudio(outcomes = []) {
  const events = createFakeEventTarget();
  let outcomeIndex = 0;

  return {
    paused: true,
    currentTime: 0,
    loop: true,
    playCalls: 0,
    pauseCalls: 0,
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,

    async play() {
      this.playCalls += 1;
      const outcome = outcomes[outcomeIndex++] ?? { succeeds: true };

      if (!outcome.succeeds) {
        throw outcome.error ?? new Error('playback blocked');
      }

      this.paused = false;
      events.dispatch('playing');
    },

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },

    dispatch(type) {
      events.dispatch(type);
    },

    emit(type) {
      if (type === 'ended') {
        this.paused = true;
      }
      events.dispatch(type);
    },
  };
}

function waitForAsyncEvents() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

test('first-visit store persists played state in storage', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
  const store = createFirstVisitStore(storage, 'home-music-played');

  assert.equal(store.hasPlayed(), false);

  store.markPlayed();

  assert.equal(values.get('home-music-played'), '1');
  const secondStore = createFirstVisitStore(storage, 'home-music-played');
  assert.equal(secondStore.hasPlayed(), true);
});

test('first-visit store falls back to in-page memory when storage throws', () => {
  const storage = {
    getItem() {
      throw new Error('storage unavailable');
    },
    setItem() {
      throw new Error('storage unavailable');
    },
  };
  const store = createFirstVisitStore(storage, 'home-music-played');

  assert.equal(store.hasPlayed(), false);

  store.markPlayed();

  assert.equal(store.hasPlayed(), true);
});

test('track selection uses the supplied random value', () => {
  const tracks = ['/audio/mu-xin.mp3', '/audio/luo-xiao-han.mp3'];

  assert.equal(pickRandomTrack(tracks, () => 0), tracks[0]);
  assert.equal(pickRandomTrack(tracks, () => 0.999999), tracks[1]);
  assert.equal(pickRandomTrack([], () => 0), null);
  assert.equal(pickRandomTrack(null, () => 0), null);
});

test('player skips audio creation and control state after a prior visit', async () => {
  let createAudioCalls = 0;
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio() {
      createAudioCalls += 1;
      return createFakeAudio();
    },
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), false);
  assert.equal(createAudioCalls, 0);
  assert.deepEqual(controlStates, []);
});

test('player awaits an async prior-visit check before deciding to skip audio creation', async () => {
  const priorVisit = createDeferred();
  let createAudioCalls = 0;
  let startSettled = false;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => priorVisit.promise,
      markPlayed() {},
    },
    createAudio() {
      createAudioCalls += 1;
      return createFakeAudio();
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  const startResult = player.start().finally(() => {
    startSettled = true;
  });
  await waitForAsyncEvents();
  assert.equal(startSettled, false);
  assert.equal(createAudioCalls, 0);

  priorVisit.resolve(true);
  assert.equal(await startResult, false);
  assert.equal(createAudioCalls, 0);
});

test('player starts after an async prior-visit check resolves false', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: async () => false,
      markPlayed() {},
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  assert.equal(await player.start(), true);
  assert.equal(audio.playCalls, 1);
});

test('concurrent starts after an async visit check create and play only one audio', async () => {
  const priorVisit = createDeferred();
  const audios = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => priorVisit.promise,
      markPlayed() {},
    },
    createAudio() {
      const audio = createFakeAudio([{ succeeds: true }]);
      audios.push(audio);
      return audio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  const starts = Promise.all([player.start(), player.start()]);
  await waitForAsyncEvents();
  priorVisit.resolve(false);

  assert.deepEqual(await starts, [true, false]);
  assert.equal(audios.length, 1);
  assert.equal(audios[0].playCalls, 1);
});

test('player treats a rejected prior-visit check as not played', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: async () => {
        throw new Error('account state unavailable');
      },
      markPlayed() {},
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  assert.equal(await player.start(), true);
  assert.equal(audio.playCalls, 1);
});

test('successful first play marks the visit on playing and publishes control state', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const controlStates = [];
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3', '/b.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio(track) {
      assert.equal(track, '/a.mp3');
      return audio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
    random: () => 0,
  });

  assert.equal(await player.start(), true);
  assert.equal(audio.loop, false);
  assert.equal(markPlayedCalls, 1);
  assert.deepEqual(controlStates.at(-1), { playing: true });

  audio.dispatch('playing');
  assert.equal(markPlayedCalls, 1);
});

test('async markPlayed rejection is consumed without delaying state or marking twice', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const controlStates = [];
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
        return Promise.reject(new Error('account state unavailable'));
      },
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);
  assert.deepEqual(controlStates.at(-1), { playing: true });
  audio.dispatch('playing');
  await waitForAsyncEvents();
  assert.equal(markPlayedCalls, 1);
});

test('async markPlayed resolution remains fire-and-forget and marks only once', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const markPlayed = createDeferred();
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
        return markPlayed.promise;
      },
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
  });

  assert.equal(await player.start(), true);
  assert.equal(markPlayedCalls, 1);
  audio.dispatch('playing');
  assert.equal(markPlayedCalls, 1);
  markPlayed.resolve();
  await waitForAsyncEvents();
});

test('synchronous markPlayed failure does not break playback state', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        throw new Error('storage unavailable');
      },
    },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);
  assert.deepEqual(controlStates.at(-1), { playing: true });
});

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

test('toggle pauses playing audio and publishes paused control state', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);

  assert.equal(await player.toggle(), true);
  assert.equal(audio.pauseCalls, 1);
  assert.deepEqual(controlStates.at(-1), { playing: false });
});

test('toggle resumes paused audio through the playing event', async () => {
  const audio = createFakeAudio([
    { succeeds: true },
    { succeeds: true },
  ]);
  const controlStates = [];
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: { hasPlayed: () => false, markPlayed() {} },
    createAudio: () => audio,
    interactionTarget: createFakeEventTarget(),
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);
  assert.equal(await player.toggle(), true);

  assert.equal(await player.toggle(), true);
  assert.equal(audio.playCalls, 2);
  assert.deepEqual(controlStates.at(-1), { playing: true });
});

test('failed toggle resume stays paused without changing visit state or arming retries', async () => {
  const interactionTarget = createFakeEventTarget();
  const audio = createFakeAudio([
    { succeeds: true },
    { succeeds: false },
  ]);
  const controlStates = [];
  let played = false;
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => played,
      markPlayed() {
        played = true;
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget,
    setControlState: (state) => controlStates.push(state),
  });

  assert.equal(await player.start(), true);
  assert.equal(await player.toggle(), true);

  assert.equal(await player.toggle(), false);
  assert.deepEqual(controlStates.at(-1), { playing: false });
  assert.equal(played, true);
  assert.equal(markPlayedCalls, 1);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 0);
  }
});

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

test('blocked first play retries once on the first interaction and cleans up listeners', async () => {
  const interactionTarget = createFakeEventTarget();
  const audio = createFakeAudio([
    { succeeds: false, error: new Error('autoplay blocked') },
    { succeeds: true },
  ]);
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget,
    setControlState() {},
  });

  assert.equal(await player.start(), false);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 1);
  }

  interactionTarget.dispatch('touchstart');
  await waitForAsyncEvents();

  assert.equal(audio.playCalls, 2);
  assert.equal(markPlayedCalls, 1);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 0);
    interactionTarget.dispatch(type);
  }
  await waitForAsyncEvents();
  assert.equal(audio.playCalls, 2);
});

test('interaction observed during pending initial play triggers one immediate retry', async () => {
  const initialPlay = createDeferred();
  const interactionTarget = createFakeEventTarget();
  let interacted = false;
  let markPlayedCalls = 0;
  const events = createFakeEventTarget();
  const audio = {
    paused: true,
    loop: true,
    playCalls: 0,
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,
    async play() {
      this.playCalls += 1;
      if (this.playCalls === 1) {
        return initialPlay.promise;
      }
      this.paused = false;
      events.dispatch('playing');
    },
    pause() {},
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget,
    hasUserInteracted: () => interacted,
    setControlState() {},
  });

  const startResult = player.start();
  await waitForAsyncEvents();
  assert.equal(audio.playCalls, 1);

  interacted = true;
  initialPlay.reject(new Error('autoplay blocked'));

  assert.equal(await startResult, true);
  assert.equal(audio.playCalls, 2);
  assert.equal(markPlayedCalls, 1);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 0);
  }
});

test('failed immediate compensation arms one final gesture-handler retry', async () => {
  const initialPlay = createDeferred();
  const interactionTarget = createFakeEventTarget();
  let interacted = false;
  let markPlayedCalls = 0;
  const events = createFakeEventTarget();
  const audio = {
    paused: true,
    loop: true,
    playCalls: 0,
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,
    async play() {
      this.playCalls += 1;
      if (this.playCalls === 1) {
        return initialPlay.promise;
      }
      if (this.playCalls === 2) {
        throw new Error('historical activation expired');
      }
      this.paused = false;
      events.dispatch('playing');
    },
    pause() {},
  };
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget,
    hasUserInteracted: () => interacted,
    setControlState() {},
  });

  const startResult = player.start();
  await waitForAsyncEvents();
  interacted = true;
  initialPlay.reject(new Error('autoplay blocked'));

  assert.equal(await startResult, false);
  assert.equal(audio.playCalls, 2);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 1);
  }

  interactionTarget.dispatch('click');
  await waitForAsyncEvents();

  assert.equal(audio.playCalls, 3);
  assert.equal(markPlayedCalls, 1);
  for (const type of ['click', 'touchstart', 'keydown']) {
    assert.equal(interactionTarget.listenerCount(type), 0);
    interactionTarget.dispatch(type);
  }
  await waitForAsyncEvents();
  assert.equal(audio.playCalls, 3);
});

test('failed playback never marks the visit as played', async () => {
  const interactionTarget = createFakeEventTarget();
  const audio = createFakeAudio([
    { succeeds: false },
    { succeeds: false },
  ]);
  let markPlayedCalls = 0;
  const player = createHomeMusicPlayer({
    tracks: ['/a.mp3'],
    store: {
      hasPlayed: () => false,
      markPlayed() {
        markPlayedCalls += 1;
      },
    },
    createAudio: () => audio,
    interactionTarget,
    setControlState() {},
  });

  assert.equal(await player.start(), false);
  interactionTarget.dispatch('click');
  await waitForAsyncEvents();

  assert.equal(audio.playCalls, 2);
  assert.equal(markPlayedCalls, 0);
});

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

test('resume tolerates session suffixes in stored track urls and uses the current track url', async () => {
  const audio = createFakeAudio([{ succeeds: true }]);
  const created = [];
  const player = createHomeMusicPlayer({
    tracks: ['/b.mp3;jsessionid=NEW'],
    store: { hasPlayed: () => true, markPlayed() {} },
    createAudio(track) {
      created.push(track);
      return audio;
    },
    interactionTarget: createFakeEventTarget(),
    setControlState() {},
    resumeStore: {
      load: () => ({ track: '/b.mp3;jsessionid=OLD', at: 11 }),
      save() {},
      clear() {},
    },
    random: () => 0,
  });

  assert.equal(await player.toggle(), true);
  assert.deepEqual(created, ['/b.mp3;jsessionid=NEW']);
  assert.equal(audio.currentTime, 11);
});

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

test('home bootstrap starts first-visit music without changing article shuffle integration', () => {
  const script = readFileSync(
    'src/main/resources/static/js/home.mjs',
    'utf8',
  );

  assert.doesNotMatch(
    script,
    /import\s*\{[^}]*createFirstVisitStore[^}]*createHomeMusicPlayer[^}]*\}\s*from\s*['"]\.\/home-music\.mjs\?v=20260905['"];/s,
  );
  assert.match(script, /async function initializeHomeMusic\(\)/);
  assert.match(
    script,
    /try\s*\{[\s\S]*?await import\(['"]\.\/home-music\.mjs\?v=20260905['"]\)[\s\S]*?\}\s*catch\s*\{/,
  );
  assert.match(
    script,
    /createFirstVisitStore\s*\(\s*window\.localStorage,\s*['"]home-music-played-v1['"],?\s*\)/,
  );
  assert.match(script, /new Audio\(url\)/);
  assert.match(script, /home-music-resume-v1/);
  assert.match(script, /resumeStore,/);
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
  const guardedMusicImport = script.indexOf("await import('./home-music.mjs?v=20260905')");
  assert.notEqual(shuffleRegistration, -1);
  assert.notEqual(guardedMusicImport, -1);
  assert.ok(
    shuffleRegistration < guardedMusicImport,
    'shuffle listener must be registered before loading optional music code',
  );
});

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
  const guardedMusicImport = script.indexOf("await import('./home-music.mjs?v=20260905')");
  assert.ok(observerRegistration !== -1 && observerRegistration < guardedMusicImport);
  assert.doesNotMatch(script, /removeEventListener\([^,]+,\s*retryPlayback/);
});

test('README Node test description includes first-visit home music coverage', () => {
  const readme = readFileSync('README.md', 'utf8');

  assert.match(
    readme,
    /Node 单测[^\n]*首页音乐[^\n]*(?:首次访问|播放器)/,
  );
});

test('home music toggle uses the approved responsive sticky-note styling', () => {
  const css = readFileSync(
    'src/main/resources/static/css/home.css',
    'utf8',
  );

  assert.match(css, /\.music-toggle\s*\{[^}]*position:\s*fixed[^}]*right:\s*18px[^}]*bottom:\s*16px[^}]*z-index:/s);
  assert.match(css, /\.music-toggle\s*\{[^}]*width:\s*38px[^}]*height:\s*38px/s);
  assert.match(css, /\.music-toggle\s*\{[^}]*background:\s*#fff3b0[^}]*color:\s*#8a6d3b[^}]*transform:\s*rotate\(6deg\)/s);
  assert.match(css, /\.music-toggle\[hidden\]\s*\{\s*display:\s*none\s*\}/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.music-toggle\s*\{[^}]*right:\s*12px[^}]*bottom:\s*12px[^}]*width:\s*44px[^}]*height:\s*44px/s);
});
