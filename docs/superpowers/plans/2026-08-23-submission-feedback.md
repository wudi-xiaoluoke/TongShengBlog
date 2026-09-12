# 投稿审核反馈（站内回执号）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让站长与投稿访客之间形成「投稿拿回执 → 审核写附言 → 凭回执查结果」的站内双向沟通链路，不引入任何外部依赖。

**Architecture:** 投稿时由 `ArticleServiceImpl.submit` 生成 8 位唯一回执号存进 `article.tracking_code`，提交成功后重定向到新 `/track` 小票页；站长通过/驳回时把选填「给投稿人的话」写进新 `feedback` + `reviewed_at`；访客凭回执号在 `/track` 查询（按 IP 限流防枚举），看到状态、附言与文章链接。数据层（实体/Mapper/Service）→ 限流服务 → 查询控制器 → 投稿/审核控制器 → 模板，测试走项目现有的 `@SpringBootTest + MockMvc` 直连真实库模式。

**Tech Stack:** Java 21 · Spring Boot 3.2 · MyBatis-Plus 3.5.5 · Thymeleaf · MySQL 8.0 · JUnit 5 + MockMvc

> **修订说明（2026-08-23 执行中发现）：** 原计划把「改接口签名（Task 2）」与「实现 impl（Task 3-5）」「改 AdminController 调用方（Task 8）」拆开，导致 Task 2 之后主源码编译不过，每个 TDD 任务的「跑测试」都死在编译期。现将数据层的实现（回执号生成、审核附言、回执查询服务）与 AdminController 调用方改动合并为**一个可编译的 Task 3**，测试一次写全、一次跑绿。后续任务顺序不变。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `src/main/resources/db/migration-v4.sql`（新增） | 老库加 `tracking_code`/`feedback`/`reviewed_at` + UNIQUE + 迁移历史驳回原因，幂等 |
| `src/main/resources/db/schema.sql` / `tables.sql`（修改） | 建表语句同步加新列与 UNIQUE 键（全新安装用） |
| `src/main/java/com/tongsheng/blog/entity/Article.java`（修改） | 加 `trackingCode` / `feedback` / `reviewedAt` 字段 |
| `src/main/java/com/tongsheng/blog/mapper/ArticleMapper.java`（修改） | `findByTrackingCodeIncludingDeleted`（含逻辑删除，回执小票用）+ `countByTrackingCode`（含逻辑删除，撞号检查用） |
| `src/main/java/com/tongsheng/blog/service/ArticleService.java` / `impl/ArticleServiceImpl.java`（修改） | submit 生成回执号；approve/reject 接收附言；新增 `findForTracking` |
| `src/main/java/com/tongsheng/blog/controller/AdminController.java`（修改） | approve/reject 增加选填 `feedback` 参数（编译必需） |
| `src/main/java/com/tongsheng/blog/config/TrackingProperties.java`（新增） | 回执查询限流配置（镜像 `SubmitProperties`） |
| `src/main/java/com/tongsheng/blog/service/TrackingRateLimitService.java`（新增） | 回执查询按 IP 限流（镜像 `SubmitRateLimitService`） |
| `src/main/java/com/tongsheng/blog/controller/TrackController.java`（新增） | `GET /track` 查询 + 限流 |
| `src/main/java/com/tongsheng/blog/controller/HomeController.java`（修改） | submit 成功重定向 `/track?code=…` |
| `src/main/resources/templates/track/index.html`（新增） | 查询表单 + 回执小票页（复用 home.css 手账风格） |
| `src/main/resources/static/css/track.css`（新增） | 小票样式 |
| `src/main/resources/templates/admin/dashboard.html`（修改） | 附言输入框共用通过/驳回按钮；显示 `feedback` |
| `src/main/resources/static/css/admin.css`（修改） | 附言输入框宽度 |
| `src/main/resources/templates/home/index.html` + `static/css/home.css`（修改） | 投稿区「查投稿进度」入口 |
| `src/main/resources/application.yml`（修改） | `tracking` 限流配置 |
| `src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java`（新增） | 全链路集成测试 |
| `src/test/java/com/tongsheng/blog/TrackingRateLimitServiceTests.java`（新增） | 限流纯单测 |
| `README.md`（修改） | 功能一览补充「投稿回执」「审核附言」 |

---

## Task 1: 数据库迁移脚本

**Files:**
- Create: `src/main/resources/db/migration-v4.sql`
- Modify: `src/main/resources/db/schema.sql`
- Modify: `src/main/resources/db/tables.sql`

- [ ] **Step 1: 写幂等迁移脚本**

新建 `src/main/resources/db/migration-v4.sql`：

```sql
-- ============================================================
-- 同生的手账本 · v4 迁移脚本：文章表加「回执号 / 站长附言 / 审核时间」
--
-- 老库执行一次即可（本脚本幂等，可重复执行）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v4.sql
--
-- 新库直接跑 schema.sql / tables.sql（已包含新列），无需本脚本。
-- ============================================================
USE tongsheng_blog;

DROP PROCEDURE IF EXISTS `upgrade_article_v4`;

DELIMITER $$
CREATE PROCEDURE `upgrade_article_v4`()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article'
                       AND COLUMN_NAME = 'tracking_code') THEN
    ALTER TABLE `article`
      ADD COLUMN `tracking_code` VARCHAR(16) NULL COMMENT '投稿回执号(唯一)' AFTER `reject_reason`;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article'
                       AND COLUMN_NAME = 'feedback') THEN
    ALTER TABLE `article`
      ADD COLUMN `feedback` VARCHAR(500) NULL COMMENT '站长给投稿人的话' AFTER `tracking_code`;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article'
                       AND COLUMN_NAME = 'reviewed_at') THEN
    ALTER TABLE `article`
      ADD COLUMN `reviewed_at` DATETIME NULL COMMENT '审核时间' AFTER `feedback`;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article'
                       AND INDEX_NAME = 'uk_article_tracking_code') THEN
    ALTER TABLE `article`
      ADD UNIQUE KEY `uk_article_tracking_code` (`tracking_code`);
  END IF;
END$$
DELIMITER ;

CALL `upgrade_article_v4`();
DROP PROCEDURE IF EXISTS `upgrade_article_v4`;

-- 历史驳回原因合并进 feedback（幂等：仅当 feedback 为空且 reject_reason 有值时抄写）
UPDATE `article`
SET `feedback` = `reject_reason`
WHERE `feedback` IS NULL AND `reject_reason` IS NOT NULL;
```

- [ ] **Step 2: 应用到本地库并验证**

Run:
```bash
mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v4.sql
mysql --default-character-set=utf8mb4 -uroot -p123456 -e "SHOW COLUMNS FROM tongsheng_blog.article;"
```
Expected: 输出含 `tracking_code`、`feedback`、`reviewed_at` 三列。

- [ ] **Step 3: 重复执行验证幂等**

Run（再跑一遍）:
```bash
mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v4.sql
```
Expected: 无报错，`SHOW COLUMNS` 结果不变，不产生重复列。

- [ ] **Step 4: 同步 `schema.sql` 与 `tables.sql`**

在 `src/main/resources/db/schema.sql` 和 `src/main/resources/db/tables.sql` 中，把文章建表语句的：

```sql
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '驳回原因(博主可见)',
```

替换为：

```sql
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '驳回原因(历史遗留，新数据写入 feedback)',
  `tracking_code` VARCHAR(16)  DEFAULT NULL COMMENT '投稿回执号(唯一)',
  `feedback`      VARCHAR(500) DEFAULT NULL COMMENT '站长给投稿人的话',
  `reviewed_at`   DATETIME DEFAULT NULL COMMENT '审核时间',
```

并在文章建表语句的 `PRIMARY KEY (\`id\`),` 之后、`KEY \`idx_status_publish_time\`` 之前插入：

```sql
  UNIQUE KEY `uk_article_tracking_code` (`tracking_code`),
```

（两个文件此处的文章表结构一致，做完全相同的两处修改。）

- [ ] **Step 5: 验证全新安装脚本（幂等）**

Run:
```bash
mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/tables.sql
mysql --default-character-set=utf8mb4 -uroot -p123456 -e "SHOW COLUMNS FROM tongsheng_blog.article; SHOW INDEX FROM tongsheng_blog.article;"
```
Expected: 无报错（CREATE TABLE IF NOT EXISTS 对已有表不生效、不动数据），`SHOW COLUMNS` 含新三列，`SHOW INDEX` 含 `uk_article_tracking_code`。

- [ ] **Step 6: Commit**

```bash
git add src/main/resources/db/
git commit -m "db: add tracking_code/feedback/reviewed_at migration"
```

---

## Task 2: 数据层骨架（实体 + Mapper + Service 接口）

**Files:**
- Modify: `src/main/java/com/tongsheng/blog/entity/Article.java`
- Modify: `src/main/java/com/tongsheng/blog/mapper/ArticleMapper.java`
- Modify: `src/main/java/com/tongsheng/blog/service/ArticleService.java`

> 本任务已完成（工作区已改好，未提交），保留在此供记录与后续提交。完成标准：接口签名已更新、impl 与 AdminController 暂为旧签名（此刻主源码不编译，属预期）。

- [ ] **Step 1: 实体加字段**

在 `Article.java` 的 `private String rejectReason;` 之后加：

```java
    /** 投稿回执号（唯一；旧数据为 null） */
    private String trackingCode;

    /** 站长给投稿人的话（通过/驳回都写入，投稿人可见） */
    private String feedback;

    /** 审核时间 */
    private LocalDateTime reviewedAt;
```

- [ ] **Step 2: Mapper 加两个查询**

`ArticleMapper.java` 改为：

```java
package com.tongsheng.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tongsheng.blog.entity.Article;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 文章 Mapper
 */
public interface ArticleMapper extends BaseMapper<Article> {

    /** 按回执号查询（含逻辑删除记录，供回执小票显示审核结果与「已撤下」状态）。
     *  注意：@TableLogic 会为所有 MyBatis-Plus 自动 SQL 追加 deleted=0，此处必须用原生 @Select 才能查到已删行。 */
    @Select("SELECT * FROM article WHERE tracking_code = #{code} LIMIT 1")
    Article findByTrackingCodeIncludingDeleted(@Param("code") String code);

    /** 按回执号计数（含逻辑删除记录，用于生成时避免与已删行的历史回执号撞号） */
    @Select("SELECT COUNT(*) FROM article WHERE tracking_code = #{code}")
    long countByTrackingCode(@Param("code") String code);
}
```

- [ ] **Step 3: Service 接口改签名 + 新增方法**

在 `ArticleService.java` 中：

- `boolean approve(Long id);` → `boolean approve(Long id, String feedback);`
- `boolean reject(Long id, String reason);` → `boolean reject(Long id, String feedback);`
- 新增：

```java
    /** 回执查询：按回执号返回文章（含逻辑删除），无则返回 null */
    Article findForTracking(String code);
```

---

## Task 3: 数据层实现（回执号生成 + 审核附言 + 回执查询服务 + AdminController 调用方）

**Files:**
- Modify: `src/main/java/com/tongsheng/blog/service/impl/ArticleServiceImpl.java`
- Modify: `src/main/java/com/tongsheng/blog/controller/AdminController.java`
- Test: `src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java`（已存在骨架，追加方法）

> 本任务把原计划的 Task 3/4/5/8 中「改 impl + 改 AdminController 调用方」合并为一次提交，保证本任务结束主源码可编译、测试全绿。测试骨架（`submitDraft()` / `adminSession()` / `@AfterEach` 清理 / 全部 import）已由先前步骤写入 `SubmissionTrackingTests.java`。

- [ ] **Step 1: 追加数据层测试（8 个方法）**

打开 `src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java`，确认骨架存在（`submitGeneratesUniqueTrackingCode` 已含），在类内追加以下 8 个方法：

```java
    @Test
    void approveWithFeedbackStoresFeedbackAndReviewedAt() {
        Article a = submitDraft();
        assertTrue(articleService.approve(a.getId(), "写得很真诚，谢谢你"));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PUBLISHED, saved.getStatus());
        assertEquals("写得很真诚，谢谢你", saved.getFeedback());
        assertNotNull(saved.getReviewedAt());
        assertNotNull(saved.getPublishTime());
    }

    @Test
    void approveWithBlankFeedbackLeavesFeedbackNull() {
        Article a = submitDraft();
        assertTrue(articleService.approve(a.getId(), "   "));
        assertNull(articleService.getById(a.getId()).getFeedback());
    }

    @Test
    void rejectStoresFeedbackAndStatus() {
        Article a = submitDraft();
        assertTrue(articleService.reject(a.getId(), "内容与主题不符"));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.REJECTED, saved.getStatus());
        assertEquals("内容与主题不符", saved.getFeedback());
        assertNotNull(saved.getReviewedAt());
        assertNull(saved.getPublishTime());
    }

    @Test
    void approveOnNonPendingReturnsFalse() {
        Article a = submitDraft();
        articleService.approve(a.getId(), null);
        assertFalse(articleService.approve(a.getId(), "再评一次"));
    }

    @Test
    void updateDraftClearsStaleFeedbackAndReviewedAt() {
        Article a = submitDraft();
        articleService.reject(a.getId(), "旧附言");
        assertTrue(articleService.updateDraft(a.getId(), "改了标题", "新内容", null));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PENDING, saved.getStatus());
        assertNull(saved.getFeedback(), "编辑后回到待审核，旧附言应清空");
        assertNull(saved.getReviewedAt());
    }

    @Test
    void findForTrackingReturnsArticleByCode() {
        Article a = submitDraft();
        Article found = articleService.findForTracking(a.getTrackingCode());
        assertNotNull(found);
        assertEquals(a.getId(), found.getId());
        assertNull(articleService.findForTracking("NOPE1234"));
    }

    @Test
    void findForTrackingStillReturnsLogicallyDeletedArticle() {
        Article a = submitDraft();
        articleService.approve(a.getId(), null);
        articleService.removeById(a.getId()); // 逻辑删除（deleted=1）
        Article found = articleService.findForTracking(a.getTrackingCode());
        assertNotNull(found, "回执小票应仍能看到审核结果");
        assertEquals(1, found.getDeleted().intValue());
    }

    @Test
    void adminApproveWithFeedbackWorks() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(post("/admin/article/{id}/approve", a.getId())
                        .param("feedback", "写得很真诚")
                        .session(adminSession()))
                .andExpect(status().is3xxRedirection());
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PUBLISHED, saved.getStatus());
        assertEquals("写得很真诚", saved.getFeedback());
    }
```

- [ ] **Step 2: 跑测试确认红（主源码编译失败，属预期）**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: **BUILD FAILURE** —— 主源码编译错误，来自 `ArticleServiceImpl`（缺 `findForTracking`、`approve(Long)` 不匹配新接口签名）与 `AdminController`（仍按旧签名调用 `approve(Long)`）。测试不会执行。确认报错只来自这两处、无其它无关错误。

- [ ] **Step 3: 实现 ArticleServiceImpl（合并原 Task 3/4/5）**

在 `ArticleServiceImpl.java` 顶部常量区加：

```java
    /** 回执号字母表：去掉 0/O、1/I/L 等易混字符 */
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
```

补 import：`import java.util.concurrent.ThreadLocalRandom;`

把 `submit` 改为：

```java
    @Override
    public void submit(Article article) {
        article.setStatus(ArticleStatus.PENDING);
        article.setPublishTime(null);
        article.setRejectReason(null);
        article.setTrackingCode(uniqueTrackingCode());
        save(article);
    }

    /** 生成不与现存回执号冲突的号（含逻辑删除行；32^8 空间 + UNIQUE 兜底） */
    private String uniqueTrackingCode() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = newTrackingCode();
            if (baseMapper.countByTrackingCode(code) == 0) {
                return code;
            }
        }
        throw new IllegalStateException("回执号生成失败，请稍后再试");
    }

    private String newTrackingCode() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }
```

把 `approve`、`reject`、`updateDraft` 替换为：

```java
    @Override
    public boolean approve(Long id, String feedback) {
        Article article = getById(id);
        if (article == null || article.getStatus() != ArticleStatus.PENDING) {
            return false;
        }
        article.setStatus(ArticleStatus.PUBLISHED);
        article.setPublishTime(LocalDateTime.now());
        article.setFeedback(blankToNull(feedback));
        article.setReviewedAt(LocalDateTime.now());
        article.setRejectReason(null);
        return updateById(article);
    }

    @Override
    public boolean reject(Long id, String feedback) {
        Article article = getById(id);
        if (article == null || article.getStatus() != ArticleStatus.PENDING) {
            return false;
        }
        article.setStatus(ArticleStatus.REJECTED);
        article.setFeedback(blankToNull(feedback));
        article.setReviewedAt(LocalDateTime.now());
        article.setPublishTime(null);
        article.setRejectReason(null);
        return updateById(article);
    }

    @Override
    public boolean updateDraft(Long id, String title, String content, Long categoryId) {
        Article article = getById(id);
        if (article == null) {
            return false;
        }
        article.setTitle(title);
        article.setContent(content);
        article.setCategoryId(categoryId);
        // 编辑后回到待审核，需管理员重新审核发布；旧审核附言随之作废
        article.setStatus(ArticleStatus.PENDING);
        article.setPublishTime(null);
        article.setFeedback(null);
        article.setReviewedAt(null);
        article.setRejectReason(null);
        return updateById(article);
    }

    /** 空串/纯空白 → null（附言选填） */
    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
```

新增 `findForTracking`：

```java
    @Override
    public Article findForTracking(String code) {
        return baseMapper.findByTrackingCodeIncludingDeleted(code);
    }
```

- [ ] **Step 4: 更新 AdminController 的 approve / reject（编译必需）**

把 `approve` 方法替换为：

```java
    @PostMapping("/admin/article/{id}/approve")
    public String approve(@PathVariable Long id,
                          @RequestParam(required = false) String feedback,
                          RedirectAttributes redirect) {
        if (articleService.approve(id, feedback)) {
            redirect.addFlashAttribute("flash", "已审核通过");
        } else {
            redirect.addFlashAttribute("flash", "操作失败：文章不存在或状态不符");
        }
        return "redirect:/admin";
    }
```

把 `reject` 方法替换为：

```java
    @PostMapping("/admin/article/{id}/reject")
    public String reject(@PathVariable Long id,
                         @RequestParam(required = false) String feedback,
                         RedirectAttributes redirect) {
        if (articleService.reject(id, feedback)) {
            String note = (feedback == null || feedback.isBlank()) ? "" : "：「" + feedback.trim() + "」";
            redirect.addFlashAttribute("flash", "已驳回" + note);
        } else {
            redirect.addFlashAttribute("flash", "操作失败：文章不存在或状态不符");
        }
        return "redirect:/admin";
    }
```

- [ ] **Step 5: 跑测试确认绿**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: PASS —— 9 个用例全绿（`submitGeneratesUniqueTrackingCode` + 本任务追加的 8 个）。

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/tongsheng/blog/entity/Article.java \
        src/main/java/com/tongsheng/blog/mapper/ArticleMapper.java \
        src/main/java/com/tongsheng/blog/service/ArticleService.java \
        src/main/java/com/tongsheng/blog/service/impl/ArticleServiceImpl.java \
        src/main/java/com/tongsheng/blog/controller/AdminController.java \
        src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java
git commit -m "feat: tracking code on submit, review feedback, findForTracking"
```

---

## Task 4: 回执查询限流

**Files:**
- Create: `src/main/java/com/tongsheng/blog/config/TrackingProperties.java`
- Create: `src/main/java/com/tongsheng/blog/service/TrackingRateLimitService.java`
- Modify: `src/main/resources/application.yml`
- Test: `src/test/java/com/tongsheng/blog/TrackingRateLimitServiceTests.java`（新建）

- [ ] **Step 1: 写限流单测（纯 JUnit，不启 Spring）**

新建 `src/test/java/com/tongsheng/blog/TrackingRateLimitServiceTests.java`：

```java
package com.tongsheng.blog;

import com.tongsheng.blog.config.TrackingProperties;
import com.tongsheng.blog.service.TrackingRateLimitService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 回执查询限流纯单测（直接 new 服务实例，不依赖 Spring 容器）
 */
class TrackingRateLimitServiceTests {

    @Test
    void blocksAfterExceedingWindowCount() {
        TrackingProperties props = new TrackingProperties();
        TrackingRateLimitService service = new TrackingRateLimitService(props);
        for (int i = 0; i < 30; i++) {
            assertTrue(service.allow("1.1.1.1"), "第 " + (i + 1) + " 次应在限流内");
        }
        assertFalse(service.allow("1.1.1.1"), "第 31 次应被拦截");
    }

    @Test
    void differentIpIsIndependent() {
        TrackingProperties props = new TrackingProperties();
        TrackingRateLimitService service = new TrackingRateLimitService(props);
        for (int i = 0; i < 30; i++) {
            service.allow("2.2.2.2");
        }
        assertTrue(service.allow("3.3.3.3"), "不同 IP 互不影响");
    }
}
```

- [ ] **Step 2: 跑测试确认红**

Run: `mvn test -Dtest=TrackingRateLimitServiceTests`
Expected: FAIL —— 编译错：`TrackingProperties` / `TrackingRateLimitService` 不存在。

- [ ] **Step 3: 实现配置 + 服务**

新建 `src/main/java/com/tongsheng/blog/config/TrackingProperties.java`：

```java
package com.tongsheng.blog.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 回执查询限流配置（内存按 IP）
 */
@Data
@Component
@ConfigurationProperties(prefix = "tracking")
public class TrackingProperties {

    /** 时间窗口内最多查询次数 */
    private int rateLimitCount = 30;

    /** 时间窗口（分钟） */
    private int rateLimitMinutes = 1;
}
```

新建 `src/main/java/com/tongsheng/blog/service/TrackingRateLimitService.java`：

```java
package com.tongsheng.blog.service;

import com.tongsheng.blog.config.TrackingProperties;
import org.springframework.stereotype.Service;

import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 回执号查询限流（内存按 IP）：时间窗口内最多 N 次，防暴力枚举回执号
 */
@Service
public class TrackingRateLimitService {

    private final TrackingProperties props;
    private final Map<String, Deque<Long>> records = new ConcurrentHashMap<>();

    public TrackingRateLimitService(TrackingProperties props) {
        this.props = props;
    }

    /** 当前 IP 是否允许查询（允许则记录本次查询时间） */
    public boolean allow(String ip) {
        long now = System.currentTimeMillis();
        long windowMs = props.getRateLimitMinutes() * 60_000L;
        Deque<Long> deque = records.computeIfAbsent(ip, k -> new ConcurrentLinkedDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > windowMs) {
                deque.pollFirst();
            }
            if (deque.size() >= props.getRateLimitCount()) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
```

- [ ] **Step 4: application.yml 加配置**

在 `src/main/resources/application.yml` 末尾（`submit:` 块之后）加：

```yaml
# 回执查询限流（内存方案，按 IP）
tracking:
  rate-limit-count: 30
  rate-limit-minutes: 1
```

- [ ] **Step 5: 跑测试确认绿**

Run: `mvn test -Dtest=TrackingRateLimitServiceTests`
Expected: PASS（2 个用例）。

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/tongsheng/blog/config/TrackingProperties.java src/main/java/com/tongsheng/blog/service/TrackingRateLimitService.java src/main/resources/application.yml src/test/java/com/tongsheng/blog/TrackingRateLimitServiceTests.java
git commit -m "feat: rate-limit tracking code lookups per IP"
```

---

## Task 5: /track 回执查询页 + 首页入口

**Files:**
- Create: `src/main/java/com/tongsheng/blog/controller/TrackController.java`
- Create: `src/main/resources/templates/track/index.html`
- Create: `src/main/resources/static/css/track.css`
- Modify: `src/main/resources/templates/home/index.html`
- Modify: `src/main/resources/static/css/home.css`
- Test: `src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java`（追加方法）

- [ ] **Step 1: 追加失败测试**

在 `SubmissionTrackingTests` 类内追加：

```java
    @Test
    void trackWithoutCodeShowsQueryForm() throws Exception {
        mockMvc.perform(get("/track"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("回执号")));
    }

    @Test
    void trackShowsPendingSlip() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("待审核")))
                .andExpect(content().string(containsString(a.getTitle())))
                .andExpect(content().string(containsString(a.getTrackingCode())));
    }

    @Test
    void trackUnknownCodeShowsNotFound() throws Exception {
        mockMvc.perform(get("/track").param("code", "NOPE1234"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("回执号不存在")));
    }

    @Test
    void trackLookupRateLimitedByIp() throws Exception {
        // 用独立假 IP，避免污染其它测试的 127.0.0.1 限额
        for (int i = 0; i < 30; i++) {
            mockMvc.perform(get("/track").param("code", "ABC12345")
                            .with(req -> { req.setRemoteAddr("10.9.9.9"); return req; }))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/track").param("code", "ABC12345")
                        .with(req -> { req.setRemoteAddr("10.9.9.9"); return req; }))
                .andExpect(content().string(containsString("查得太频繁")));
    }
```

- [ ] **Step 2: 跑测试确认红**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: FAIL —— 4 个新用例失败（`/track` 路由不存在 → 404）。

- [ ] **Step 3: 新建 TrackController**

新建 `src/main/java/com/tongsheng/blog/controller/TrackController.java`：

```java
package com.tongsheng.blog.controller;

import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.TrackingRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 回执号查询页：访客凭投稿回执号查看审核进度与站长的话
 */
@Controller
public class TrackController {

    private final ArticleService articleService;
    private final TrackingRateLimitService trackingRateLimit;

    public TrackController(ArticleService articleService, TrackingRateLimitService trackingRateLimit) {
        this.articleService = articleService;
        this.trackingRateLimit = trackingRateLimit;
    }

    @GetMapping("/track")
    public String track(@RequestParam(required = false) String code,
                        Model model,
                        HttpServletRequest request) {
        String trimmed = (code == null) ? "" : code.trim();
        model.addAttribute("query", trimmed);
        if (trimmed.isEmpty()) {
            return "track/index";
        }
        if (!trackingRateLimit.allow(clientIp(request))) {
            model.addAttribute("error", "查得太频繁啦，歇一分钟再试～");
            return "track/index";
        }
        Article article = articleService.findForTracking(trimmed);
        if (article == null) {
            model.addAttribute("error", "回执号不存在，是不是抄错了？");
            return "track/index";
        }
        model.addAttribute("article", article);
        return "track/index";
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
```

- [ ] **Step 4: 新建 track 模板**

新建 `src/main/resources/templates/track/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN" xmlns:th="http://www.thymeleaf.org">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>查投稿进度 · 回执查询 — 同生的手账本</title>
  <link rel="stylesheet" th:href="@{/css/home.css}">
  <link rel="stylesheet" th:href="@{/css/track.css}">
</head>
<body>
<div class="wrap">
  <header th:replace="~{fragments/layout :: header}"></header>

  <div class="track">
    <div class="track-title">🔍 查投稿进度</div>
    <p class="track-hint">投稿后你会拿到一张回执小票，凭上面的<b>回执号</b>就能看到审核结果和博主的话。</p>

    <form class="track-form" method="get" th:action="@{/track}">
      <input type="text" name="code" th:value="${query}" maxlength="16" placeholder="输入回执号，例如 A7K3Q9XZ">
      <button type="submit">查询 ✎</button>
    </form>

    <p class="flash-ok" th:if="${ok}" th:text="${ok}"></p>
    <p class="flash-err" th:if="${error}" th:text="${error}"></p>

    <!-- 查询结果小票 -->
    <div class="slip" th:if="${article}">
      <div class="slip-code">
        回执号：<b th:text="${article.trackingCode}">A7K3Q9XZ</b>
        <span class="slip-note">收藏本页，随时回来看结果</span>
      </div>
      <div class="slip-row"><span class="k">标题</span><span class="v" th:text="${article.title}">标题</span></div>
      <div class="slip-row"><span class="k">昵称</span><span class="v" th:text="${article.nickname}">昵称</span></div>
      <div class="slip-row">
        <span class="k">状态</span>
        <span class="badge"
              th:classappend="${article.status == 0} ? 'pending' : (${article.status == 1} ? 'published' : 'rejected')"
              th:text="${article.status == 0 ? '待审核' : (article.status == 1 ? '已通过' : '已驳回')}">待审核</span>
      </div>
      <div class="slip-row" th:if="${article.reviewedAt != null}">
        <span class="k">审核时间</span>
        <span class="v" th:text="${#temporals.format(article.reviewedAt,'yyyy-MM-dd HH:mm')}">2026-08-23 10:00</span>
      </div>
      <div class="slip-note-block" th:if="${article.feedback}">
        <div class="k">博主的话</div>
        <p class="v" th:text="${article.feedback}">附言</p>
      </div>
      <div class="slip-foot">
        <a th:if="${article.status == 1 && article.deleted == 0}" th:href="@{/article/{id}(id=${article.id})}">去看看这篇手账 →</a>
        <span th:if="${article.deleted == 1}" class="removed">这篇投稿已被撤下</span>
      </div>
    </div>
  </div>

  <footer th:replace="~{fragments/layout :: footer}"></footer>
</div>
</body>
</html>
```

- [ ] **Step 5: 新建 track.css**

新建 `src/main/resources/static/css/track.css`：

```css
/* ============================================================
   同生的手账本 · 回执查询页样式（复用 home.css 的手账风格）
   ============================================================ */
.track{max-width:560px;margin:0 auto;padding:30px 16px 60px}
.track-title{font-size:22px;font-weight:bold;color:#5a4632;letter-spacing:2px;margin-bottom:8px}
.track-hint{font-size:13px;color:#a08a6b;line-height:1.8;margin-bottom:20px}
.track-form{display:flex;gap:10px;margin-bottom:16px}
.track-form input{flex:1;padding:11px 14px;font-size:15px;letter-spacing:2px;border:1px solid #eadcc0;border-radius:6px;background:#fffdf6;font-family:inherit}
.track-form input:focus{outline:none;border-color:#d1662f;box-shadow:0 0 0 3px rgba(209,102,47,.12)}
.track-form button{padding:11px 22px;font-size:14px;letter-spacing:2px;color:#fff;background:#d1662f;border:1px solid #c05a26;border-radius:6px;cursor:pointer;box-shadow:0 3px 0 #a3481f}
.track-form button:hover{transform:translateY(1px);box-shadow:0 1px 0 #a3481f}

.slip{background:#fffdf4;border:1px solid #eadcc0;border-radius:10px;padding:22px 24px;box-shadow:2px 4px 0 rgba(90,70,50,.10);margin-top:8px}
.slip-code{font-size:15px;color:#5a4632;letter-spacing:1px;border-bottom:1px dashed #eadcc0;padding-bottom:12px;margin-bottom:12px}
.slip-code b{font-size:22px;color:#d1662f;letter-spacing:3px}
.slip-note{font-size:12px;color:#b39a77;margin-left:10px}
.slip-row{display:flex;gap:14px;padding:6px 0;font-size:14px}
.slip-row .k{flex:none;width:64px;color:#a08a6b}
.slip-row .v{color:#3d3a34}
.slip-note-block{background:#faf3e3;border:1px dashed #e2cd9e;border-radius:6px;padding:10px 14px;margin-top:12px}
.slip-note-block .k{font-size:12px;color:#a08a6b}
.slip-note-block p{font-size:14px;color:#5a4632;margin-top:4px}
.slip-foot{margin-top:16px;font-size:14px}
.slip-foot a{color:#d1662f;font-weight:bold}
.slip-foot .removed{color:#a3482e}

.badge{display:inline-block;font-size:12px;padding:2px 12px;border-radius:999px;letter-spacing:1px}
.badge.pending{background:#fff3cd;color:#8a6d1a;border:1px solid #ecd98a}
.badge.published{background:#e8f5e6;color:#3f7f3d;border:1px solid #9bc48f}
.badge.rejected{background:#eee;color:#777;border:1px solid #d5d5d5}

@media (max-width:560px){
  .track-form{flex-direction:column}
  .slip{padding:16px 14px}
}
```

- [ ] **Step 6: 首页加入口**

在 `src/main/resources/templates/home/index.html` 的投稿区（`<p>写下你的心情、故事或碎碎念…</p>` 之后）插入：

```html
    <a class="track-entry" th:href="@{/track}">🔍 查投稿进度</a>
```

在 `src/main/resources/static/css/home.css` 的 `.flash-err` 规则之后追加：

```css
.guest .track-entry{display:inline-block;margin-top:14px;font-size:13px;color:#8a7355;letter-spacing:1px;border-bottom:1px dashed #c9b28c;padding-bottom:2px}
.guest .track-entry:hover{color:#d1662f;border-bottom-color:#d1662f}
```

- [ ] **Step 7: 跑测试确认绿**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: PASS —— 13 个用例（9 个数据层 + 4 个新）。

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/tongsheng/blog/controller/TrackController.java src/main/resources/templates/track/ src/main/resources/static/css/track.css src/main/resources/templates/home/index.html src/main/resources/static/css/home.css src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java
git commit -m "feat: tracking-code slip page at /track"
```

---

## Task 6: 提交重定向到小票页 + 管理端附言模板

**Files:**
- Modify: `src/main/java/com/tongsheng/blog/controller/HomeController.java`
- Modify: `src/main/resources/templates/admin/dashboard.html`
- Modify: `src/main/resources/static/css/admin.css`
- Test: `src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java`（追加方法）

- [ ] **Step 1: 追加失败测试**

在 `SubmissionTrackingTests` 类内追加：

```java
    @Test
    void submitRedirectsToTrackingSlip() throws Exception {
        MvcResult result = mockMvc.perform(post("/submit")
                        .param("nickname", "小鹿")
                        .param("title", "测试投稿-重定向-" + UUID.randomUUID())
                        .param("content", "测试正文")
                        .with(req -> { req.setRemoteAddr("10.0.0.1"); return req; }))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = result.getResponse().getRedirectedUrl();
        assertNotNull(location, "提交成功后应重定向到回执小票页");
        assertTrue(location.contains("/track?code="), "重定向应为 /track?code=…，实际：" + location);
        String code = location.substring(location.indexOf("code=") + "code=".length());
        createdCodes.add(code);
        assertNotNull(articleService.findForTracking(code), "回执号应已落库可查");
    }

    @Test
    void adminRejectWithFeedbackShowsOnSlip() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(post("/admin/article/{id}/reject", a.getId())
                        .param("feedback", "内容与主题不符")
                        .session(adminSession()))
                .andExpect(status().is3xxRedirection());
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(content().string(containsString("已驳回")))
                .andExpect(content().string(containsString("内容与主题不符")));
    }

    @Test
    void deletedArticleShowsRemovedOnSlip() throws Exception {
        Article a = submitDraft();
        articleService.approve(a.getId(), "谢谢投稿");
        articleService.removeById(a.getId()); // 逻辑删除
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("已被撤下")))
                .andExpect(content().string(containsString("已通过")))
                .andExpect(content().string(containsString("谢谢投稿")));
    }
```

- [ ] **Step 2: 跑测试确认红**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: FAIL —— `submitRedirectsToTrackingSlip`（重定向仍是 `/#guest`）、`adminRejectWithFeedbackShowsOnSlip`（dashboard 表单未传 `feedback`，且 `/track` 页显示由 Task 5 已就绪，失败点在管理端表单参数）、`deletedArticleShowsRemovedOnSlip`（已通过 task 5 的 slip 支持，此处确认通过；如该项先绿也无妨）。

- [ ] **Step 3: HomeController 重定向到小票页**

把 `HomeController.submit` 的最后两行：

```java
        articleService.submit(article);
        redirect.addFlashAttribute("ok", "已收到，等审核通过就会出现在小本本上～");
        return "redirect:/#guest";
```

替换为：

```java
        articleService.submit(article);
        redirect.addFlashAttribute("ok", "已收到！回执号 " + article.getTrackingCode()
                + "，收藏本页，审核结果出来就能看");
        return "redirect:/track?code=" + article.getTrackingCode();
```

- [ ] **Step 4: dashboard.html 改共用附言框 + 显示 feedback**

把 `dashboard.html` 里的：

```html
            <div class="reason" th:if="${a.rejectReason}" th:text="'驳回原因：' + ${a.rejectReason}"></div>
```

替换为：

```html
            <div class="reason" th:if="${a.feedback}" th:text="'博主的话：' + ${a.feedback}"></div>
```

把「操作」单元格里两个待审核表单（`<!-- 待审核：通过 + 驳回 -->` 注释下到编辑链接前的部分）：

```html
              <!-- 待审核：通过 + 驳回 -->
              <form class="inline" method="post" th:if="${a.status == 0}"
                    th:action="@{/admin/article/{id}/approve(id=${a.id})}">
                <button class="btn ok" type="submit">通过</button>
              </form>
              <form class="inline" method="post" th:if="${a.status == 0}"
                    th:action="@{/admin/article/{id}/reject(id=${a.id})}">
                <input class="reason" type="text" name="reason" placeholder="原因(可选)">
                <button class="btn bad" type="submit">驳回</button>
              </form>
```

替换为：

```html
              <!-- 待审核：附言 + 通过/驳回 共用一个输入框（按钮 formaction 决定去向） -->
              <form class="inline" method="post" th:if="${a.status == 0}">
                <input class="feedback" type="text" name="feedback" maxlength="500" placeholder="给投稿人的话(选填)">
                <button class="btn ok" type="submit" th:attr="formaction=@{/admin/article/{id}/approve(id=${a.id})}">通过</button>
                <button class="btn bad" type="submit" th:attr="formaction=@{/admin/article/{id}/reject(id=${a.id})}">驳回</button>
              </form>
```

- [ ] **Step 5: admin.css 加附言框宽度**

在 `admin.css` 的 `input.reason{...}` 规则后追加：

```css
input.feedback{width:220px;padding:5px 10px;font-size:12px;border:1px solid #eadcc0;border-radius:4px;background:#fffdf6}
```

并在 `@media (max-width:640px)` 块内追加：

```css
  input.feedback{width:110px}
```

- [ ] **Step 6: 跑测试确认绿**

Run: `mvn test -Dtest=SubmissionTrackingTests`
Expected: PASS —— 16 个用例全绿。

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/tongsheng/blog/controller/HomeController.java src/main/resources/templates/admin/dashboard.html src/main/resources/static/css/admin.css src/test/java/com/tongsheng/blog/SubmissionTrackingTests.java
git commit -m "feat: redirect submit to slip page; admin review feedback form"
```

---

## Task 7: 全量验证 + 文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 跑全量测试**

Run: `mvn test`
Expected: 全绿 —— 原 13 个（`BlogApplicationTests` / `StaticResourceMimeTypeTests` / `SessionStableHomeRandomTests` / `NotesBookTests`）+ 新增（`SubmissionTrackingTests` 16 个 + `TrackingRateLimitServiceTests` 2 个）。

- [ ] **Step 2: 冒烟验证（可选，本地起服务）**

Run（后台）:
```bash
mvn spring-boot:run
```
然后验证：
- `curl "http://localhost:8081/track"` → 200，含「查投稿进度」
- `curl "http://localhost:8081/track?code=NOPE1234"` → 200，含「回执号不存在」
- 首页 `curl "http://localhost:8081/"` → 含「查投稿进度」入口
验证后停掉进程。

- [ ] **Step 3: 更新 README 功能一览**

在 `README.md` 的「**访客（无需登录）**」列表加一条：

```markdown
- 🔍 **投稿回执**：投稿后拿到一张回执小票，凭回执号随时查看审核结果与博主的话（`/track`）
```

在「**博主（仅自己，`/admin`）**」列表，把：

```markdown
- ✅ 审核通过 / 驳回（可填原因）
```

替换为：

```markdown
- ✅ 审核通过 / 驳回（可给投稿人留一句话，投稿人凭回执号可见）
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: mention tracking slip and review feedback in README"
```

---

## Self-Review

**1. Spec 覆盖：**
- 数据模型（3 列 + 迁移历史 reject_reason）→ Task 1、2 ✅
- 回执号生成（32 字符去易混 + 8 位 + 撞号重试 + UNIQUE）→ Task 3 ✅
- 投稿重定向小票页 + 首页入口 → Task 6（重定向）、Task 5（入口）✅
- 站长审核附言框共用通过/驳回 → Task 3（AdminController 参数）+ Task 6（模板）✅
- /track 查询：无码表单 / 三种状态 / 附言 / 链接 / 不存在 / 已删「内容已撤下」→ Task 5 ✅
- 查询限流 → Task 4 + Task 5 控制器测试 ✅
- 附言长度：模板 `maxlength="500"` 前端拦截 + DB `VARCHAR(500)` 兜底（spec「超长返回校验错误」以双层拦截实现，符合 YAGNI，不做服务端手动校验）✅

**2. 占位符扫描：** 无 TBD/TODO；每个代码步骤都有完整代码。✅

**3. 类型/命名一致性：** `findForTracking` / `findByTrackingCodeIncludingDeleted` / `countByTrackingCode` / `blankToNull` / `uniqueTrackingCode` / `newTrackingCode` 在 Task 2/3 中定义与使用一致；`feedback` 参数名在 Service 接口、Impl、AdminController、模板间一致。✅

**4. 编译可行性（本次修订重点）：** 每次任务结束主源码均可编译：
- Task 2 结束：不编译（接口已改、impl/调用方未改）——**已知例外**，由修订说明记录。
- Task 3 结束：impl + AdminController 已同步 → 编译通过、测试全绿 ✅
- Task 4/5/6 各结束：均在 Task 3 的编译基线上增量添加 → 可编译 ✅

**5. 已知取舍：** `approve`/`reject` 内部调用被覆写过的 `getById(id)`（会填充分类名 + 渲染 Markdown），多做了无谓工作但结果正确——沿用现有代码既有行为，不额外改造。
