# 手账档案馆：一本可以翻的书

日期：2026-08-13
状态：已与用户确认

## 背景

首页目前是「随机精选一批已发布文章」（会话内固定随机种子），导航栏的「手账」指向 `/#posts` 锚点，但锚点目标缺失，点击效果等同「首页」，功能冗余。

用户决定：**给「手账」一个独立于首页的功能——完整档案馆**，以「一本可以翻的书」的形式呈现，与站名「同生的手账本」主题契合。

## 目标

- 新页面 `/notes`：展示**全部**已发布文章，按月分组、月份倒序（最新在前）。
- 呈现为摊开的书：左右两页对称排布，中间书脊，每页 = 一个月的文章。
- 翻书交互：上一页/下一页做翻页动画；跳转到指定月份时书「合拢→重开」。
- 首页保持不变（随机精选 + 留言）。

## 非目标（YAGNI）

- 不做分类筛选、搜索、评论区。
- 不做服务端分页（个人博客规模，全部内容一次性渲染进 DOM）。
- 首页的随机精选/换一批/尺寸切换逻辑不做改动。

## 内容组织

- 数据源：全部 `status=PUBLISHED AND publish_time IS NOT NULL AND deleted=0` 的文章。
- 按月分组，键为 `yyyy-MM`（或 `yyyy年M月` 显示），**月份倒序**（最新月在前）。
- 摊开的一组（spread）= 左右两页 = **月份倒序列表里相邻两个月的文章**（不是日历相邻，而是有文章的月份两两配对）：
  - 左页 = 较新的月份，右页 = 较旧的月份。
  - 月份总数为奇数时，最后一组只有左页有内容；右页显示封底样式（如「未完待续」或空书页）。
- 单个月份内文章按发布时间倒序排列；若某月文章过多，该页内容区内部可滚动（个人博客规模，不做跨页拆分）。

## 书页呈现

- 复用首页手账卡片的信息要素：日期 / 标题 / 摘要 / 分类标签 / 阅读量，改为适合书页宽度的紧凑排版。
- 每页顶部为月份标题（如「2026 年 8 月」）。
- 页面视觉：纸张质感（底色/阴影）、中间书脊折痕、页面边缘圆角。

## 交互（CSS 3D + 原生 JS，不引入框架）

- **上一页 / 下一页**：
  - 页面围绕书脊边缘翻转：`rotateY 0 → -180°`，配合 `perspective`、`backface-visibility: hidden`、翻转过程中的折页阴影。
  - 落定后露出下一页内容。
- **跳转到指定月份**：
  - 两阶段动画：左右两页先向中间合拢（`rotateY → ∓90°`，书「合上」），替换内容后从中间重新翻开（回到 0°）。
- **跳转控件**：书下方一排「月份索引」（月份名可点，如「2026.08 · 2026.07 · …」），点击触发合拢→重开动画，跳到含该月的摊开组。

## 降级（无 JS）

无 JS 时所有摊开组按序堆叠展示，可滚动浏览全部内容；翻页控件与动画自然失效但不丢失内容。

## 路由与导航

- 新增 `/notes` 页面。
- 导航栏「手账」由 `/#posts` 改为 `/notes`。
- 移除 `home/index.html` 中此前为修复锚点加的 `id="posts"`（导航不再指向它）。
- 「留言」锚点 `/#guest` 保持不变，仍在首页。

## 测试

1. **Service 层**：按月分组正确性——分组键、月份倒序、组内文章倒序。
2. **MockMvc**：`/notes` 返回 200；HTML 含月份标题与文章链接。
3. **JS 纯逻辑**（Node，沿用 `tests/game-*.test.mjs` 模式）：月份列表 → 摊开组（spread）的分组计算；翻页/跳转的状态机逻辑抽成纯函数测试。

## 文件清单

- `src/main/java/.../controller/HomeController.java`：新增 `/notes` 入口（或新建 `NotesController`）。
- `src/main/java/.../service/ArticleService.java` + `impl/ArticleServiceImpl.java`：新增「按月份分组、倒序」的查询方法。
- `src/main/resources/templates/notes/index.html`：新模板（书页结构 + 月份索引）。
- `src/main/resources/static/css/home.css` 或新增 `notes.css`：书页 3D 样式。
- `src/main/resources/static/js/notes.js`：翻页/合拢重开/跳转动画。
- `src/main/resources/templates/fragments/layout.html`：导航「手账」改 `/notes`。
- `src/main/resources/templates/home/index.html`：移除 `id="posts"`。
- 测试：`src/test/java/...`（Service + MockMvc）、`tests/notes-book.test.mjs`（JS 纯逻辑）。

## 技术说明

- 项目为 Spring Boot 3 + Thymeleaf + 原生 CSS/JS，无前端框架；本功能沿用原生栈。
- Thymeleaf 渲染全部摊开组进 DOM，JS 控制显隐与动画；这样无 JS 也能滚动看全部内容。
- `spring.thymeleaf.cache=false`，模板改动即时生效；但运行中的 `mvn spring-boot:run` 读的是 `target/classes` 副本，改动后需同步或重启。
