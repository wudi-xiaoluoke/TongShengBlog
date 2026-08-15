# 阅读量眼睛图标替换设计

## 目标

将首页文章卡片和文章详情页阅读量前的 `👀` Emoji 替换为统一的线框 SVG 眼睛图标，使其与现有手账风格和棕灰色元信息文字协调。

## 实现范围

- 修改 `src/main/resources/templates/home/index.html` 的阅读量标记。
- 修改 `src/main/resources/templates/article/detail.html` 的阅读量标记。
- 修改 `src/main/resources/static/css/home.css`，统一图标尺寸、颜色、间距与垂直对齐。
- 不修改阅读量数据、计数逻辑或页面其他 Emoji。

## 视觉与结构

- 使用无外部依赖的内联 SVG 线框眼睛，尺寸约 14px。
- SVG 使用 `currentColor`，继承现有 `.views` 的棕灰色。
- 图标与数字使用行内弹性布局垂直居中，并保留小间距。
- SVG 标记为装饰性图形；阅读量数字继续作为可读文本输出。

## 验证

- 首页和详情页不再包含 `👀`。
- 两处阅读量均包含同一套 SVG 图标结构。
- 阅读数字仍由原 Thymeleaf 表达式输出。
- 运行结构验证与完整 Maven 测试。
