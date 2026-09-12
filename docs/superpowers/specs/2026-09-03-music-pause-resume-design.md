# 首页音乐暂停进度记忆设计

## 目标

首页背景音乐**暂停后离开页面再回来**时，点击 ▶ 从上次暂停位置继续播放同一首曲目，而不是从头随机播放。歌曲自然放完则清除记忆，重播从头开始。

## 范围

- 仅首页（沿用上一特性范围）。
- 修改 `src/main/resources/static/js/home-music.mjs`（新增 `resumeStore` 钩子与恢复分支）、`src/main/resources/static/js/home.mjs`（localStorage 实现）、缓存版本戳。
- 更新 `tests/home-music.test.mjs`、`scripts/verify-music-sway.ps1`、README。
- 不做"播放中离开自动续播"（用户明确排除）。

## 存储接口（resumeStore）

可选参数，三方法全部容错（同步抛错或异步拒绝均不影响播放状态）：

- `load()` → `{ track, at } | null`
- `save({ track, at })`
- `clear()`

`home.mjs` 以 `localStorage` 键 `home-music-resume-v1` 实现（JSON 存取，解析失败视为无记录）；模块保持存储无关、纯逻辑可测。

## 时机

| 事件 | 动作 |
|---|---|
| 用户暂停（playing → ▶） | `save({ sessionTrack, audio.currentTime })` |
| 歌曲自然 ended | `clear()`，回空闲 |
| 音频 error | 回空闲但不清除记录 |

## 恢复流程

点 ▶ 且当前无 audio 时按优先级：

1. 本页会话已选过曲（含刚播完的重播场景）→ 不读记录，沿用现逻辑；
2. 无会话曲目且记录有效（track 仍在内置曲目列表）→ 以该曲创建音频、`currentTime = max(0, at)`、播放，并定为会话曲目；
3. 无记录或记录无效 → `clear()` 并回退随机选曲。

## 边界

- 播放中直接离开不记录；
- 恢复播放失败 → 回空闲、保留记录，下次点击重试；
- 曲目列表变化导致记录失效 → 忽略并清除，不卡死。

## 验证

- `tests/home-music.test.mjs` 新增用例：暂停写入曲目+位置；恢复用同曲同位置（非随机）；放完清除记录；失效曲目忽略并清除；error 保留记录。
- 版本戳升 `20260905`（home.mjs 模板引用、模块动态 import、测试钉住断言、校验脚本同步）。
- Node 全量测试、`mvn test`、无头浏览器：暂停 → 刷新 → 点击 ▶ 可继续播放；localStorage 记录写入与清除符合预期。
