-- ============================================================
-- 同生的手账本 · v3 迁移脚本：文章表加阅读量列 + 种子内容升级为 Markdown
-- 老库执行一次（新库直接跑 schema.sql 即可，无需本脚本）
-- 执行方式（同样必须带 utf8mb4 参数）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 < src/main/resources/db/migration-v3.sql
-- 本脚本非幂等，一次性执行；已加过 views 列则跳过加列步骤。
-- ============================================================
USE tongsheng_blog;

-- 1) 加阅读量列
ALTER TABLE `article` ADD COLUMN `views` BIGINT NOT NULL DEFAULT 0 COMMENT '阅读量' AFTER `content`;

-- 2) 种子内容升级为 Markdown 示例（老库已存在则更新，不存在则跳过无副作用）
UPDATE `article` SET `content` = '亲爱的**未来的我**：\n\n今天的天空很蓝，窗外的猫在睡觉。我把此刻的心情写在纸上，希望你拆开的时候，还能闻到阳光的味道。\n\n- 别熬夜了\n- 好好吃饭\n- 记得常回家看看\n\n> 这句话每年写给你，希望今年你能做到。'
WHERE `title` = '写给五年后的自己';

UPDATE `article` SET `content` = '第一个黄昏，我在看落日；\n第二个黄昏，我在看人群；\n第三个黄昏，我学会了什么都不做。\n\n原来发呆，也是一种充电。'
WHERE `title` = '西湖边的三个黄昏';

UPDATE `article` SET `content` = '今天决定：\n\n- [x] 一定要更快 ❌\n- [ ] 慢慢来，比较快 ✔️\n\n> ——写在备忘录里，也写给自己。'
WHERE `title` = '关于「慢下来」的思考';
