-- ============================================================
-- 同生的手账本 · 建表脚本（仅表结构，无示例数据）
--
-- 用途：在目标数据库里创建 分类/文章/管理员 三张表。
--
-- 执行方式（重要：必须带 utf8mb4 参数，否则中文会被按 GBK 误解码存成乱码）：
--   mysql --default-character-set=utf8mb4 -uroot -p < tables.sql
--
-- 说明：
--   1. 脚本幂等（CREATE TABLE IF NOT EXISTS），重复执行不会报错、不会清空数据。
--   2. 若服务器上的库名不是 tongsheng_blog，请改下面的 USE 语句，
--      并保证与启动 jar 时的 --spring.datasource.url 里的库名一致。
--   3. admin 表只建表不插数据，初始管理员由应用首次启动时自动写入
--      （BCrypt 加密，见 AdminInitializer）。
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
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '驳回原因(历史遗留，新数据写入 feedback)',
  `tracking_code` VARCHAR(16)  DEFAULT NULL COMMENT '投稿回执号(唯一)',
  `feedback`      VARCHAR(500) DEFAULT NULL COMMENT '站长给投稿人的话',
  `reviewed_at`   DATETIME DEFAULT NULL COMMENT '审核时间',
  `publish_time`  DATETIME DEFAULT NULL COMMENT '审核通过发布时间',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '投稿时间',
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除 0-正常 1-删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_tracking_code` (`tracking_code`),
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
