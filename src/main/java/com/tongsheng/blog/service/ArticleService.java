package com.tongsheng.blog.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.tongsheng.blog.dto.MonthGroup;
import com.tongsheng.blog.entity.Article;

import java.util.List;

/**
 * 文章服务
 */
public interface ArticleService extends IService<Article> {

    /** 主页：已发布文章列表（按发布时间倒序） */
    IPage<Article> listPublished(int page, int size);

    /** 主页：从已发布文章中随机挑 limit 篇；seed 固定则文章集与顺序稳定（同一会话复用同一 seed） */
    List<Article> listRandomPublished(int limit, long seed);

    /** 主页：已发布文章总数（用于显示「共 N 篇」） */
    long countPublished();

    /** 手账档案馆：全部已发布文章按月分组，月份倒序（最新在前），组内按发布时间倒序 */
    List<MonthGroup> listPublishedByMonth();

    /** 管理端：按状态分页（status 传 null 查全部） */
    IPage<Article> listByStatus(Integer status, int page, int size);

    /** 管理端：统计各状态数量 */
    long countByStatus(int status);

    /** 访客投稿 */
    void submit(Article article);

    /** 审核通过 */
    boolean approve(Long id, String feedback);

    /** 驳回 */
    boolean reject(Long id, String feedback);

    /** 回执查询：按回执号返回文章（含逻辑删除），无则返回 null */
    Article findForTracking(String code);

    /** 编辑更新（更新后回到待审核，需重新发布） */
    boolean updateDraft(Long id, String title, String content, Long categoryId);

    /** 阅读量 +1（SQL 原子自增，不读-改-写） */
    void incrementViews(Long id);
}
