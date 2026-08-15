package com.tongsheng.blog.dto;

import com.tongsheng.blog.entity.Article;

import java.util.List;

/**
 * 手账档案馆：一个月的文章集合。
 *
 * @param monthLabel 页面标题用完整月份（如「2026 年 8 月」）
 * @param shortLabel 月份索引用短标签（如「2026.08」）
 * @param articles   该月文章（按发布时间倒序）
 */
public record MonthGroup(String monthLabel, String shortLabel, List<Article> articles) {
}
