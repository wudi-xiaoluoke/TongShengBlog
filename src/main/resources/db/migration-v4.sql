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
