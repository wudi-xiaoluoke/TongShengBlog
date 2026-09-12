# 首页音乐按钮播放时轻柔摆动设计

## 目标

首页背景音乐播放期间，右下角的音乐控制按钮（便利贴样式）围绕自身基线左右小幅摆动并带轻微起伏，像被风吹着随音乐轻轻飘动；暂停或停止时回到静止。

## 实现范围

- 修改 `src/main/resources/static/css/home.css` 的「首页背景音乐」区块：新增摆动关键帧与 `.music-playing` 动画规则。
- 修改 `src/main/resources/static/js/home.mjs` 的 `setControlState`：根据 `playing` 切换按钮的 `music-playing` class。
- 不修改 `home-music.mjs`（纯逻辑模块及其既有行为不变）、不修改 HTML 结构、不新增依赖或定时器。

## 视觉与动画

- 按钮静态基线仍为 `rotate(6deg)`；动画围绕 6° 游走，摆幅约 ±3°，并带 1px 级左右位移与上下起伏。
- 关键帧使用不对称停靠 + `ease-in-out`，拐点自然减速，形成"飘动"而非匀速摆动；首尾姿态同为 6° 静止位，播放开始与循环衔接无跳动。
- 周期约 3.4s、无限循环，仅当 `.music-playing` 存在时运行；暂停（`playing=false`）即移除 class、立即静止。
- 悬停/聚焦配色等既有规则不受影响。
- `prefers-reduced-motion: reduce` 下不运行动画。

## 行为

- 仅 `playing === true`（真实播放中）时摆动；点击暂停（按钮显示 ▶）与歌曲自然结束（按钮隐藏）后均为静止。

## 验证

- 静态检查：CSS 含关键帧与 `.music-playing` 规则；`home.mjs` 仅多一行 class 切换。
- 语法检查 `home.mjs`。
- 重建 target 资源副本后浏览器实测：播放中摆动、暂停即静止、hover/focus 正常、动画衔接无跳变。
