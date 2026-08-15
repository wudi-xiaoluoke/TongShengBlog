-- ============================================================
-- 同生的手账本 · v2 迁移脚本：文章分类表化
-- 老库执行一次（新库直接跑 schema.sql 即可，无需本脚本）
-- 执行方式（同样必须带 utf8mb4 参数）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v2.sql
--
-- 步骤说明：第 7 步删旧列刻意放最后，建议先执行到第 6 步，
-- 确认应用跑通后再单独执行第 7 步。本脚本非幂等，一次性执行。
-- ============================================================

USE tongsheng_blog;

-- 1) 建 category 表（建过则跳过）
CREATE TABLE IF NOT EXISTS `category` (
  `id`          BIGINT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(30)  NOT NULL COMMENT '分类名称',
  `description` VARCHAR(100) DEFAULT NULL COMMENT '分类描述(可选)',
  `sort`        INT NOT NULL DEFAULT 0 COMMENT '排序值(越小越靠前)',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章分类表';

-- 2) 种子分类
INSERT IGNORE INTO `category` (`name`,`description`,`sort`) VALUES
('随笔','日常碎碎念',1),
('旅行','行路所见',2),
('思考','慢下来的想法',3);

-- 3) article 加 category_id 列（MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，已加则跳过本步）
ALTER TABLE `article` ADD COLUMN `category_id` BIGINT DEFAULT NULL COMMENT '分类ID' AFTER `nickname`;

-- 4) 回填：老库所有自由文本分类建成 category 行（零数据丢失），再按名称反写 category_id
INSERT INTO `category` (`name`,`sort`)
SELECT DISTINCT TRIM(`category`), 100
FROM `article`
WHERE `category` IS NOT NULL AND TRIM(`category`) <> ''
  AND TRIM(`category`) NOT IN (SELECT `name` FROM `category`);

UPDATE `article` a
JOIN `category` c ON TRIM(a.`category`) = c.`name`
SET a.`category_id` = c.`id`;

-- 5) 校验：应返回 0
SELECT COUNT(*) AS `remaining_uncategorized`
FROM `article`
WHERE `category` IS NOT NULL AND TRIM(`category`) <> '' AND `category_id` IS NULL;

-- 6) 加外键（兜底，未加则跳过本步）
ALTER TABLE `article`
  ADD CONSTRAINT `fk_article_category` FOREIGN KEY (`category_id`)
  REFERENCES `category`(`id`) ON DELETE SET NULL;

-- 7) 【确认步骤 5=0、应用跑通后】再删旧列（注释掉，验证后取消注释执行）
-- ALTER TABLE `article` DROP COLUMN `category`;
