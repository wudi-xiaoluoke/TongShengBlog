# 📖 同生的手账本

> 白天认真生活，晚上把今天捡起来，夹进这里。
> 这本小本本摊开放在桌上，路过的人都能翻一翻、写两句。

**同生的手账本**是一个手写手账风格的个人博客全栈项目。访客打开它，像翻开一本摊在木桌上的日记——可以看文章、翻手账、投一篇稿；博主则把审核、编辑、分类这些活儿，都藏在书脊后面。

- 🎈 **访客**：浏览随机精选 · 翻阅手账档案馆 · 免登录投稿
- 🔒 **博主**：审核 · 编辑 · 分类管理 · 防暴力登录
- 🧺 **彩蛋**：像素零食店经营小游戏、商城跳转

---

## 📑 目录

- [功能一览](#-功能一览)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [手账档案馆 /notes](#-手账档案馆-notes)
- [目录结构](#-目录结构)
- [部署到服务器](#-部署到服务器)
- [管理端账号](#-管理端账号)
- [测试](#-测试)
- [写在最后](#-写在最后)

---

## ✨ 功能一览

**访客（无需登录）**

- 🖋️ **首页精选**：随机挑选已发布文章，以手账卡片展示（摘要 + 阅读量）。同一会话内固定——点进文章再「回到小本本」不会重排，可选 5 / 10 / 20 篇
- 📔 **手账档案馆 `/notes`**：全部文章按月分组、月份倒序，以**一本可以翻的书**浏览——详情见下方专节
- 📄 **文章详情**：Markdown 渲染（加粗 / 列表 / 表格 / 任务列表 / 引用 / 代码块 + 高亮）
- 👀 **阅读量统计**：同一浏览器会话内每篇只计一次，防刷新刷量
- ✍️ **免登录投稿**：昵称 + 标题 + 可选分类 + Markdown 正文，提交后进入「待审核」
- 🛡️ **投稿限流**：同一 IP 5 分钟内最多 5 篇

**博主（仅自己，`/admin`）**

- 🔐 登录防暴力破解：连错 5 次锁定 10 分钟
- 🗂️ 文章列表 + 状态筛选（全部 / 待审核 / 已发布 / 已驳回）
- ✅ 审核通过 / 驳回（可填原因）
- 📝 编辑（保存后回到待审核，需重新发布）
- 🗑️ 删除（逻辑删除）
- 🏷️ 分类管理：自定义分类，增 / 改 / 删；删除分类时其下文章自动变「无分类」

**安全**

- Markdown 双防线：flexmark 转义原生 HTML + OWASP 白名单净化（拦截 `javascript:` 等危险协议）
- 摘要字段再转义一次，双保险
- 密码 BCrypt 哈希存储
- 管理端 Session + 拦截器保护

---

## 🧰 技术栈

| 层 | 选型 |
|---|---|
| 后端 | **Java 21 · Spring Boot 3.2 · MyBatis-Plus 3.5.5 · Thymeleaf** |
| 数据库 | **MySQL 8.0**（库名 `tongsheng_blog`） |
| 渲染 | flexmark（Markdown）+ OWASP Java HTML Sanitizer |
| 前端 | 原生 HTML/CSS/JS（ES Modules）+ CSS 3D 翻书动画 |
| 构建 | Maven（Spring Boot fat jar） |

---

## 🚀 快速开始

### 1. 初始化数据库（仅首次）

二选一：

```bash
# 完整版：建库 + 建表 + 3 篇示例文章
mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/schema.sql

# 纯净版：只建表结构，无示例数据（全新库推荐）
mysql --default-character-set=utf8mb4 -uroot -p < src/main/resources/db/tables.sql
```

> ⚠️ **必须带 `--default-character-set=utf8mb4`**，否则中文会被按 GBK 误解码存成乱码。
> 脚本均幂等，重复执行不会报错、不会清空数据。

### 2. 启动

```bash
mvn spring-boot:run
```

或直接在 IDE 里运行 `com.tongsheng.blog.BlogApplication`。

### 3. 访问

| 入口 | 地址 |
|---|---|
| 主页（浏览 + 投稿） | http://localhost:8081 |
| 手账档案馆（翻书页浏览全部） | http://localhost:8081/notes |
| 管理端 | http://localhost:8081/admin |
| 像素零食店经营小游戏 | http://localhost:8081/game |
| 商城（跳转按钮） | http://localhost:5173（需另启动「柿子网」Vue 项目） |

---

## 📔 手账档案馆 /notes

把「全部文章按时间翻一翻」做成了一本真的书：

- 🪵 摊在**木质桌面**上，两侧是**布面封壳** + 书脊，书页边缘有层叠的书口
- 🖱️ **拖拽翻页**：左半页往左拖看更早的月份，右半页往右拖看更近的月份；松手前超过一半才算翻页，否则弹回
- 🔢 **页码菜单**：中间是「第 N / N 页」按钮，点开是可选页码的列表，支持键盘（↑↓ / Home / End / Enter / Esc）
- 📆 **月份索引**：按月份快跳——书先从两侧**合拢**，在完全闭合时停顿片刻，再从中间翻开到目标月
- ♿ **无障碍降级**：系统「减少动态效果」或浏览器不支持 3D 时，自动退化为淡入淡出翻页；无 JS 时书页顺序堆叠可滚动，文章链接始终可访问

---

## 🗂️ 目录结构

```
Tongshengbolg/
├── pom.xml
├── src/main/
│   ├── java/com/tongsheng/blog/   # 控制器 / 服务 / 实体 / Mapper / 配置 / 拦截器
│   └── resources/
│       ├── application.yml
│       ├── db/schema.sql          # 建库建表 + 示例文章
│       ├── db/tables.sql          # 仅表结构（部署用）
│       ├── static/css/            # home.css（手账风）/ admin.css（后台风）/ notes.css（翻书）
│       ├── static/js/             # notes.mjs（翻书交互）/ notes-logic.mjs（纯逻辑，可单测）
│       └── templates/             # Thymeleaf 模板（主页 / 详情 / 手账 / 管理端 / 游戏 / 404）
├── tests/                         # Node 单测（翻书逻辑、零食店小游戏状态机）
└── docs/                          # 设计稿与迭代记录
```

---

## ☁️ 部署到服务器

打包成可执行 fat jar：

```bash
mvn package
java -jar target/tongsheng-blog-1.0.0.jar
```

- 服务器需 **Java 21**（LTS）与 **MySQL 8.0**，表结构用上面的 `tables.sql` 初始化
- jar 默认连 `localhost:3306/tongsheng_blog`（root/123456），服务器上可覆盖：

```bash
java -jar tongsheng-blog-1.0.0.jar \
  --spring.datasource.url='jdbc:mysql://<DB_HOST>:3306/tongsheng_blog?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true' \
  --spring.datasource.username=<用户> --spring.datasource.password=<密码>
```

- 生产环境建议加 `--spring.thymeleaf.cache=true`
- 首次启动自动创建管理端账号（见下），上线后请改密

---

## 👤 管理端账号

首次启动时自动写入（BCrypt 加密）：

- 用户名：`admin`
- 初始密码：`tongsheng2026`

> 登录后请修改 `application.yml` 中 `admin.init-password`，删掉 `admin` 表旧记录再重启来改密（或手动 UPDATE）。

---

## 🧪 测试

- **Java 集成测试**（13 个）：MockMvc + MockHttpSession 直连真实库，覆盖首页随机稳定、手账按月分组、静态资源 MIME 等
- **Node 单测**（54 个）：`node --test "tests/*.test.mjs"`，覆盖翻书纯逻辑（翻页方向、拖拽进度、跳转门控、菜单焦点决策）与零食店小游戏状态机

---

## ✍️ 写在最后

这本手账还在慢慢变厚。想到的、做到的，都会记在这里。如果你路过，欢迎翻一翻、写两句。
