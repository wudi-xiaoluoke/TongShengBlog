// 首页「换一批」：AJAX 局部刷新文章卡片，不整页跳转。
// 随机种子逻辑在后端：片段接口 /home/posts 带 t 参数才重新随机（与整页 / 路由一致），
// 会话内往返文章仍保持同一批。无 JS 时按钮无效（与旧版一致），网络异常退回整页刷新兜底。
const sizeSelect = document.getElementById('page-size');
const shuffleBtn = document.getElementById('shuffle-btn');

async function loadPosts(reshuffle) {
  const url = new URL(shuffleBtn.dataset.endpoint, location.origin);
  url.searchParams.set('size', sizeSelect.value);
  if (reshuffle) {
    url.searchParams.set('t', Date.now());
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error('HTTP ' + resp.status);
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = await resp.text();
    const fresh = tmp.querySelector('#posts');
    if (!fresh) {
      throw new Error('fragment missing #posts');
    }
    // 每次重新取当前节点替换，避免引用失效
    document.getElementById('posts').replaceWith(fresh);
  } catch {
    // 保守兜底：整页刷新
    location.reload();
  }
}

shuffleBtn.addEventListener('click', () => loadPosts(true));

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
    } = await import('./home-music.mjs?v=20260905');
    const tracks = [
      musicRoot.dataset.trackOne,
      musicRoot.dataset.trackTwo,
    ].filter((track) => typeof track === 'string' && track.trim().length > 0);
    const musicIcon = musicToggle.querySelector('.music-toggle-icon');
    const store = createFirstVisitStore(
      window.localStorage,
      'home-music-played-v1',
    );
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
    const musicPlayer = createHomeMusicPlayer({
      tracks,
      store,
      createAudio: (url) => new Audio(url),
      interactionTarget: document,
      hasUserInteracted: () => hasUserInteracted,
      resumeStore,
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

// === 登录便签：粉签点「签到」→ 屏幕中央双便签弹层（注册/登录，点签翻页切换） ===
const stickyLogin = document.getElementById('sticky-login');
const loginForm = document.getElementById('login-note-form');
const visitorInput = document.getElementById('visitor-name');
const loginGreet = document.getElementById('login-greet');
const AUTH_API = stickyLogin?.dataset.api ?? '/api/auth';

const authOverlay = document.getElementById('auth-overlay');
const authClose = document.getElementById('auth-close');
const noteRegister = document.getElementById('note-register');
const noteLogin = document.getElementById('note-login');

/** 已登录：粉签显示问候 + 退出 */
function showVisitorGreeting(name) {
  loginGreet.innerHTML = '';
  loginGreet.append(`你好呀，${name}～`);
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'rename';
  logout.textContent = '退出';
  logout.addEventListener('click', async () => {
    await fetch(`${AUTH_API}/logout`, { method: 'POST' });
    location.reload(); // 回到未登录态
  });
  loginGreet.append(logout);
  loginGreet.hidden = false;
  loginForm.hidden = true;
  stickyLogin.querySelector('b').hidden = true; // 登录后不再显示「留下你的名字」
}

/** 弹层打开/关闭 */
function openAuthModal(prefillName = '') {
  if (!authOverlay) return;
  document.getElementById('register-name').value = prefillName;
  document.getElementById('login-name').value = prefillName;
  authOverlay.hidden = false;
  (noteRegister.classList.contains('is-front')
    ? document.getElementById('register-name')
    : document.getElementById('login-name')
  ).focus();
}

function closeAuthModal() {
  if (authOverlay) authOverlay.hidden = true;
}

/** 点后面那张签 → 翻到前面（带翻页动画） */
function bringToFront(note) {
  if (!note || note.classList.contains('is-front')) return;
  const other = note === noteRegister ? noteLogin : noteRegister;
  other.classList.remove('is-front', 'flip-in');
  other.classList.add('is-back');
  note.classList.remove('is-back');
  note.classList.add('is-front', 'flip-in');
  // 动画类用完即摘，下次翻转能重新触发
  note.addEventListener('animationend', () => note.classList.remove('flip-in'), { once: true });
  const field = note.querySelector('input');
  if (field && !authOverlay.hidden) field.focus();
}

/** 调注册/登录接口（两个接口入口一致：新名字注册、老名字验密） */
async function signin(username, password, msgEl) {
  msgEl.textContent = '';
  try {
    const res = await fetch(`${AUTH_API}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.ok) { msgEl.textContent = data.error ?? '没成功，再试一次？'; return; }
    closeAuthModal();
    showVisitorGreeting(data.user.username);
    // 留言板昵称还空着就顺手填上
    const nickname = document.getElementById('nickname');
    if (nickname && !nickname.value.trim()) nickname.value = data.user.username;
  } catch {
    msgEl.textContent = '网络开小差了，等会儿再试～';
  }
}

async function restoreSession() {
  try {
    const res = await fetch(`${AUTH_API}/me`);
    const data = await res.json();
    if (data.user) showVisitorGreeting(data.user.username);
  } catch { /* 网络问题就保持未登录态 */ }
}

if (loginForm && visitorInput && loginGreet && authOverlay) {
  restoreSession();

  // 粉签上点签到 → 弹出双便签
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    openAuthModal(visitorInput.value.trim());
  });

  // 弹层：点后面的签翻到前面；点遮罩/✕ 关闭
  noteRegister.addEventListener('click', (event) => {
    if (event.target.closest('input,button')) return;
    bringToFront(noteRegister);
  });
  noteLogin.addEventListener('click', (event) => {
    if (event.target.closest('input,button')) return;
    bringToFront(noteLogin);
  });
  authClose.addEventListener('click', closeAuthModal);
  authOverlay.addEventListener('click', (event) => {
    if (event.target === authOverlay) closeAuthModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAuthModal();
  });

  // 两张签各自提交
  document.getElementById('register-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const pass = document.getElementById('register-pass').value;
    if (!name) { document.getElementById('register-name').focus(); return; }
    if (!pass) { document.getElementById('register-pass').focus(); return; }
    signin(name, pass, noteRegister.querySelector('.auth-msg'));
  });
  document.getElementById('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    const pass = document.getElementById('login-pass').value;
    if (!name) { document.getElementById('login-name').focus(); return; }
    if (!pass) { document.getElementById('login-pass').focus(); return; }
    signin(name, pass, noteLogin.querySelector('.auth-msg'));
  });
}

void initializeHomeMusic();
