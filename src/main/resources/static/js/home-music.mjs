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
        // In-page memory remains the fallback when storage is unavailable.
      }
    },
  };
}

export function pickRandomTrack(tracks, random = Math.random) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null;
  }

  return tracks[Math.floor(random() * tracks.length)];
}

const INTERACTION_EVENTS = ['click', 'touchstart', 'keydown'];

export function createHomeMusicPlayer({
  tracks,
  store,
  createAudio,
  interactionTarget,
  setControlState,
  hasUserInteracted = () => false,
  random = Math.random,
  resumeStore,
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
    next.addEventListener('ended', handleEnded);
    next.addEventListener('error', handleError);
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
        // 无本页会话曲目时，先尝试从上次暂停处继续同一首。
        if (!sessionTrack) {
          const record = await loadResumeRecord();
          // 忽略 URL 中的会话路径参数（如 ;jsessionid=…），避免刷新后误判失效。
          const withoutSessionSuffix = (url) => {
            const index = url.indexOf(';');
            return index < 0 ? url : url.slice(0, index);
          };
          const usable =
            record &&
            typeof record.track === 'string' &&
            Number.isFinite(record.at) &&
            record.at >= 0;
          const match = usable
            ? tracks.find((t) => withoutSessionSuffix(t) === withoutSessionSuffix(record.track))
            : null;

          if (match) {
            sessionTrack = match;
            audio = createTrackAudio(match);
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
        safeResumeCall(() =>
          resumeStore.save({ track: sessionTrack, at: audio.currentTime }),
        );
        return true;
      }

      // pending：自动播放的 play() 仍在等待（等待浏览器放行），不打断它。
      return attemptPlay();
    },
  };
}
