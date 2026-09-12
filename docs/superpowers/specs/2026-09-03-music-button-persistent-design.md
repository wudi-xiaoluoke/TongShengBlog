# 首页音乐按钮常驻设计

## 目标

首页右下角的音乐按钮不再受"仅在播放时显示、播完即隐藏"约束，改为**始终可见**：首次访问仍自动随机播放一首；此后回到首页按钮以 ▶ 空闲态常驻，点击播放，本页会话内播完重播同一首。摆动动画语义不变（真实播放中才摆动）。

## 范围

- 仅首页（用户确认：不加其他页面）。
- 修改 `src/main/resources/static/js/home-music.mjs`（状态语义）、`src/main/resources/static/js/home.mjs`（状态接线）、`src/main/resources/templates/home/index.html`（按钮初始常显）。
- `home.css` 不动（摆动动画与样式沿用）。
- 更新 `tests/home-music.test.mjs` 与 `scripts/verify-music-sway.ps1`。

## 语义模型

去掉"可见性"，`setControlState` 只携带 `{ playing }`：

| 状态 | 触发 | 表现 |
|---|---|---|
| idle | 非首次访问初次加载 / 自动播放被浏览器拦截待交互 / 音频 error | ▶ |
| playing | 真实播放中 | Ⅱ + `.music-playing`（摆动） |
| paused | 用户暂停，同一 audio 保留 | ▶，点击从暂停处继续 |
| ended | 一首自然结束 | ▶，audio 释放但记住本会话曲目，点击从头重播同曲 |

- **会话曲目**：每次页面加载后首次真正开播时随机选一次；本页后续 pause/ended/重播均复用该曲，不换曲、不重选。
- `start()` 保留首次访问门控（localStorage `home-music-played-v1`）：从未播放 → 自动随机开播并打标；已播放 → 不自动。
- 曲目结束不再隐藏按钮、不再清空曲目；播放被打断/失败的既有竞态兜底与"只打标一次"逻辑保留。

## 模板与 DOM

- 按钮去掉 `hidden`，初始 ▶ 空闲态（`aria-label="播放背景音乐" aria-pressed="false"`）。
- `setControlState({playing})`：切换图标（Ⅱ/▶）、aria 与 `music-playing` class（驱动摆动）。
- 按钮点击 → `toggle()`；首次访问被拦截时点按钮本身即可兜底开播。

## 边界与错误处理

- 暂停 → 同一 audio 续播；结束 → 新建 audio 重播同曲。
- 连点/拦截竞态沿用现有 attemptPlay + 交互兜底路径，不新增竞态。
- 既有加固（结束防重放打标、启动竞态闭环、观察者只移除自己的监听）全部保留。

## 验证

- `tests/home-music.test.mjs`：适配新状态表（无 visible），新增「结束后重播同曲」「暂停后续播」「非首次访问点 ▶ 才播」用例；bootstrap 断言同步。
- `scripts/verify-music-sway.ps1`：断言模板按钮初始不再 `hidden`。
- Node 全量测试、`mvn test`、无头浏览器实测四种状态（播放/暂停/放完重播/回访不自动）按钮均在。
