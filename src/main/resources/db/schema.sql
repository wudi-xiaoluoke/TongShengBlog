-- ============================================================
-- 同生的手账本 · 建库建表脚本
-- 执行方式（重要：必须带 utf8mb4 参数，否则中文会被按 GBK 误解码存成乱码）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/schema.sql
-- 说明：admin 表仅建表，初始管理员由应用启动时自动写入（BCrypt 加密，见 AdminInitializer）
-- ============================================================

CREATE DATABASE IF NOT EXISTS tongsheng_blog
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tongsheng_blog;

-- 分类表
CREATE TABLE IF NOT EXISTS `category` (
  `id`          BIGINT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name`        VARCHAR(30)  NOT NULL COMMENT '分类名称',
  `description` VARCHAR(100) DEFAULT NULL COMMENT '分类描述(可选)',
  `sort`        INT NOT NULL DEFAULT 0 COMMENT '排序值(越小越靠前)',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章分类表';

-- 文章 / 投稿表
CREATE TABLE IF NOT EXISTS `article` (
  `id`            BIGINT NOT NULL AUTO_INCREMENT COMMENT '文章ID',
  `title`         VARCHAR(100) NOT NULL COMMENT '标题',
  `content`       TEXT NOT NULL COMMENT '正文(Markdown)',
  `views`         BIGINT NOT NULL DEFAULT 0 COMMENT '阅读量',
  `nickname`      VARCHAR(50) NOT NULL DEFAULT '同生' COMMENT '投稿昵称/作者',
  `category_id`   BIGINT DEFAULT NULL COMMENT '分类ID',
  `status`        TINYINT NOT NULL DEFAULT 0 COMMENT '状态 0-待审核 1-已发布 2-已驳回',
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '驳回原因(博主可见)',
  `publish_time`  DATETIME DEFAULT NULL COMMENT '审核通过发布时间',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '投稿时间',
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除 0-正常 1-删除',
  PRIMARY KEY (`id`),
  KEY `idx_status_publish_time` (`status`, `publish_time`),
  KEY `idx_status_created_at`   (`status`, `created_at`),
  KEY `idx_category_id` (`category_id`),
  CONSTRAINT `fk_article_category` FOREIGN KEY (`category_id`)
    REFERENCES `category`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章/投稿表';

-- 管理员表（单账号）
CREATE TABLE IF NOT EXISTS `admin` (
  `id`         BIGINT NOT NULL AUTO_INCREMENT,
  `username`   VARCHAR(50) NOT NULL COMMENT '用户名',
  `password`   VARCHAR(128) NOT NULL COMMENT 'BCrypt 哈希',
  `nickname`   VARCHAR(50) DEFAULT NULL COMMENT '显示名',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表(单账号)';

-- 种子分类（固定 id，文章引用）
INSERT IGNORE INTO `category` (`id`,`name`,`description`,`sort`) VALUES
(1,'随笔','日常碎碎念',1),
(2,'旅行','行路所见',2),
(3,'思考','慢下来的想法',3);

-- 种子文章：原手账页三篇（内容升级为 Markdown 示例），status=1 已发布。
-- 用 WHERE NOT EXISTS 按标题判断，保证幂等：
--   表里已有同标题文章则跳过 —— 重跑本脚本不会重复插入，也不会覆盖/改动已有文章。
-- 注意：不要改回 INSERT IGNORE（article.title 无唯一索引，IGNORE 不会生效）。
INSERT INTO `article` (`title`,`content`,`nickname`,`category_id`,`status`,`publish_time`)
SELECT '写给五年后的自己',
       '亲爱的**未来的我**：\n\n今天的天空很蓝，窗外的猫在睡觉。我把此刻的心情写在纸上，希望你拆开的时候，还能闻到阳光的味道。\n\n- 别熬夜了\n- 好好吃饭\n- 记得常回家看看\n\n> 这句话每年写给你，希望今年你能做到。',
       '同生', 1, 1, '2026-08-02 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM `article` WHERE `title` = '写给五年后的自己');

INSERT INTO `article` (`title`,`content`,`nickname`,`category_id`,`status`,`publish_time`)
SELECT '西湖边的三个黄昏',
       '第一个黄昏，我在看落日；\n第二个黄昏，我在看人群；\n第三个黄昏，我学会了什么都不做。\n\n原来发呆，也是一种充电。',
       '同生', 2, 1, '2026-07-18 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM `article` WHERE `title` = '西湖边的三个黄昏');

INSERT INTO `article` (`title`,`content`,`nickname`,`category_id`,`status`,`publish_time`)
SELECT '关于「慢下来」的思考',
       '今天决定：\n\n- [x] 一定要更快 ❌\n- [ ] 慢慢来，比较快 ✔️\n\n> ——写在备忘录里，也写给自己。',
       '同生', 3, 1, '2026-06-30 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM `article` WHERE `title` = '关于「慢下来」的思考');
