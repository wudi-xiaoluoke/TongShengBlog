# 投稿审核反馈 · 站内回执号设计

日期：2026-08-23  
状态：已与用户确认（方案 B），待书面审阅

## 背景

网站目前是无状态投稿：访客填表提交后只能看到「已收到，等审核通过…」，之后与站长之间的沟通完全断裂——投稿人是死是活、通过还是驳回、为什么驳回，一概无感。站长端虽有「驳回原因」字段，但注释写明「博主可见」，投稿人永远看不到。

本次目标：让站长与投稿访客形成**一条有回音的双向沟通链路**，且不引入外部依赖（不加邮箱、不加短信、不做登录体系）。场景聚焦在**投稿审核反馈**这一条主线上。

## 已确认的目标语义

1. 访客投稿成功，立刻拿到一张**站内回执小票**：一个不重复、难猜的**回执号**，收藏本页即可随时回来看审核结果。
2. 站长审核（通过 / 驳回）时可选填**「给投稿人的话」**，投稿人凭回执号看到这句话。
3. 投稿人无需登录、无需留联系方式，凭回执号即可查进度；隐私靠「号难猜 + 查询限流」保证。

## 采用方案

采用**方案 B**：回执号 + `/track` 查询小票页；通过 / 驳回都能写选填「给投稿人的话」（新 `feedback` 字段），历史驳回原因迁移合并进来；查询做 IP 限流防枚举。

未采用方案 A（仅驳回可见原因，通过无附言、无迁移），因为回音不够完整；未采用方案 C（详情页展示附言 + 管理端未读提醒），因为未读提醒超出当前沟通需求，保持本本轻量。

## 数据模型

`article` 表新增 3 列，由新脚本 `db/migration-v4.sql` 对**已存在库**执行：

| 列 | 类型 | 说明 |
|---|---|---|
| `tracking_code` | `VARCHAR(16) NULL`，**UNIQUE** | 回执号；新投稿时生成。旧数据留 NULL |
| `feedback` | `VARCHAR(500) NULL` | 「站长给投稿人的话」，通过 / 驳回都写入，投稿人可见 |
| `reviewed_at` | `DATETIME NULL` | 审核时间 |

迁移同时执行：

```sql
UPDATE `article`
SET `feedback` = `reject_reason`
WHERE `feedback` IS NULL AND `reject_reason` IS NOT NULL;
```

把历史驳回原因抄进 `feedback`，管理端显示不丢。`reject_reason` 列**保留不删**（避免 DDL 风险），但此后不再写入新数据，所有审核附言统一走 `feedback`。

同步更新 `tables.sql` / `schema.sql` 的 `article` 建表语句加入新列与 UNIQUE 键，保证全新安装一步到位。

## 回执号生成

- 字符表取 32 个**无易混字符**：`ABCDEFGHJKMNPQRSTUVWXYZ23456789`（去掉 0/O、1/I/L 等）。
- 长度 8 位 → 空间约 `32^8 ≈ 1.1 万亿`，可枚举性可忽略。
- 生成用 `ThreadLocalRandom`（与项目现有随机风格一致）；插入撞 UNIQUE 则重试，连续重试仍失败则报「稍后再试」。
- UNIQUE 索引作为并发兜底。

## 访客投稿流程

- `HomeController.submit` 保存文章前由 `articleService.submit` 生成回执号并写入 `tracking_code`。
- 提交成功不再跳 `/#guest`，改为**重定向到回执小票页** `/track?code=XXX`，flash 提示「已收到！回执号 XXX，收藏本页，审核结果出来就能看」。
- 首页投稿表单旁加一个小入口「查投稿进度」，指向 `/track`（给丢了小票的人）。
- 小票页在本本风格内醒目展示：回执号大字、可收藏提示、当前状态。

## 站长审核流程（管理端）

`admin/dashboard.html` 待审核行改为：

- **一个「给投稿人的话(选填)」输入框**，下方并列「通过」「驳回」两个按钮，**共用这一个输入**（比现状「驳回带输入、通过不带」清爽，也贴合「每篇一条回话」的直觉）。
- 点击「通过」→ `approve(id, feedback)`；点击「驳回」→ `reject(id, feedback)`；都写入 `feedback` + `reviewed_at`。
- 输入为空时 `feedback` 写 NULL，投稿人小票上只显示状态、不显示「无话可说」。
- 列表里原「驳回原因：xxx」显示改为 `feedback`：有则显示「博主的话：xxx」，已发布 / 已驳回都能看到。

现有 `reject_reason` 相关代码（`reject(id, reason)` 写 reject_reason、dashboard 读 rejectReason）随本次迁移统一改为读写 `feedback`。

## 回执查询页 `/track`

新 `TrackController` 提供 `GET /track`，可选 `?code=`：

- **不带 code** → 渲染查询表单（输入回执号）。
- **带 code** → 按 `tracking_code` 查库（过滤 `deleted=0`）：
  - 查不到 → 「回执号不存在，是不是抄错了？」
  - 查到 → 渲染小票：
    - 标题 / 昵称 / 状态徽章（待审核 · 已通过 · 已驳回）
    - 站长的话（`feedback` 非空才显示）+ 审核时间（`reviewed_at`）
    - 已通过且未删除 → 附文章详情链接
  - 投稿已被逻辑删除 → 仍显示审核结果与站长的话，但提示「内容已撤下」、不附文章链接。

小票页样式复用 `home.css` 的手账风格，必要时加少量独立样式。

## 安全与边界

- **查询限流**：`/track` 的带 code 查询按 IP 限流（与投稿限流 `SubmitRateLimitService` 分开，独立计数器），约 1 分钟 30 次；超限提示「查得太频繁，稍后再试」。防止用接口暴力枚举回执号。
- 回执号空间大 + 限流 → 枚举不可行；小票只认码、不需要登录，隐私靠「号难猜」保证。
- 生成撞号重试、插入并发冲突由 UNIQUE 兜底。
- `deleted` 文章不可见文章内容，但审核结果与站长的话仍可按回执号查看（回执是投稿人私有的查询凭证）。

## 测试与验收

### 自动化验证（Java 集成测试，沿用现有 MockMvc + 真实库模式）

- 投稿成功后重定向到 `/track?code=…`，库中文章 `tracking_code` 非空且唯一。
- `/track?code=<pending>` → 显示「待审核」，无附言不显示站长的话。
- 审核通过（带 / 不带附言）→ 小票显示「已通过」+ 附言 + 文章链接；不带附言则不显示。
- 审核驳回（带附言）→ 小票显示「已驳回」+ 附言 + 无链接。
- `/track?code=<不存在的号>` → 「回执号不存在」。
- 已删除投稿的码 → 显示结果 + 「内容已撤下」、无链接。
- 查询超过限流 → 提示稍后再试。
- 附言选填，`@Size(max=500)`（沿用现有 Bean Validation 风格）；超长返回校验错误，不静默截断。

### 数据库脚本验证

- `migration-v4.sql` 在本地库重复执行两次，验证幂等、不丢数据。
- 更新后的 `tables.sql` 重跑验证幂等，新列齐全。

### 视觉验收

- 投稿成功后落到回执小票页，回执号醒目、有「收藏本页」提示。
- 小票状态徽章与网站风格一致（复用现有 badge 风格）。
- 管理端待审核行：附言输入框 + 通过/驳回两按钮布局不挤。
- 首页「查投稿进度」入口位置自然。

## 涉及文件

- `src/main/resources/db/migration-v4.sql`（新增）：ALTER 加 3 列 + UNIQUE + 迁移 `reject_reason`。
- `src/main/resources/db/tables.sql` / `schema.sql`：建表语句同步加新列与 UNIQUE 键。
- `src/main/java/com/tongsheng/blog/entity/Article.java`：加 `trackingCode` / `feedback` / `reviewedAt`。
- `src/main/java/com/tongsheng/blog/service/ArticleService(Impl)`：`submit` 生成回执号；`approve` / `reject` 支持附言；新增 `findByTrackingCode`。
- `src/main/java/com/tongsheng/blog/mapper/ArticleMapper`（或 Service 内查询）：按 `tracking_code` 查未删除文章。
- `src/main/java/com/tongsheng/blog/controller/HomeController.java`：`submit` 成功后重定向 `/track?code=…`。
- `src/main/java/com/tongsheng/blog/controller/AdminController.java`：`approve` / `reject` 增加选填附言参数。
- `src/main/java/com/tongsheng/blog/controller/TrackController.java`（新增）：`GET /track` 查询 + 限流。
- `src/main/resources/templates/track/index.html`（新增）：查询表单 + 回执小票页。
- `src/main/resources/templates/admin/dashboard.html`：附言输入框 + 共用按钮 + 显示 `feedback`。
- `src/main/resources/templates/home/index.html`：投稿表单旁「查投稿进度」入口。
- 测试：现有 Java 集成测试目录下新增对应用例。

## 部署注意

- 服务器更新时需**先执行 `migration-v4.sql` 再加新 jar**（老 jar 与新列不冲突，但新代码依赖新列存在）。
- 部署流程：`mysql --default-character-set=utf8mb4 ... < migration-v4.sql` → 替换 jar → 重启。
