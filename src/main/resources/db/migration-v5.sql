-- ============================================================
-- 同生的手账本 · v5 迁移：注册用户 + 零食店云存档
--
-- 执行方式（必须带 utf8mb4，避免中文按 GBK 误解码）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v5.sql
-- 脚本幂等，可重复执行。
-- ============================================================

USE tongsheng_blog;

-- 注册用户表（主页粉签注册，未来商城/小游戏共用账号）
CREATE TABLE IF NOT EXISTS `user` (
  `id`            BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username`      VARCHAR(16) NOT NULL COMMENT '用户名（唯一，2-16位中英文/数字/下划线）',
  `password`      VARCHAR(100) NOT NULL COMMENT 'BCrypt 哈希',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册（首次来店）时间',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最近登录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='注册用户表';

-- 零食店云存档（一个用户一份，覆盖式保存）
CREATE TABLE IF NOT EXISTS `game_save` (
  `user_id`    BIGINT NOT NULL COMMENT '用户ID',
  `state_json` LONGTEXT NOT NULL COMMENT '游戏状态 JSON（serializeState 产物）',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近存档时间',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_game_save_user` FOREIGN KEY (`user_id`)
    REFERENCES `user`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='零食店云存档表';
