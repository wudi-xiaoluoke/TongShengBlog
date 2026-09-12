package com.tongsheng.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.dto.MonthGroup;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.mapper.ArticleMapper;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.CategoryService;
import com.tongsheng.blog.service.MarkdownService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 文章服务实现
 */
@Service
public class ArticleServiceImpl extends ServiceImpl<ArticleMapper, Article> implements ArticleService {

    private final CategoryService categoryService;
    private final MarkdownService markdownService;

    public ArticleServiceImpl(CategoryService categoryService, MarkdownService markdownService) {
        this.categoryService = categoryService;
        this.markdownService = markdownService;
    }

    /** 回执号字母表：去掉 0/O、1/I/L 等易混字符 */
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;

    @Override
    public IPage<Article> listPublished(int page, int size) {
        LambdaQueryWrapper<Article> wrapper = new LambdaQueryWrapper<Article>()
                .eq(Article::getStatus, ArticleStatus.PUBLISHED)
                .isNotNull(Article::getPublishTime)
                .orderByDesc(Article::getPublishTime);
        IPage<Article> result = page(new Page<>(page, size), wrapper);
        fill(result.getRecords());
        // 主页卡片：生成纯文本摘要
        result.getRecords().forEach(a -> a.setSummary(markdownService.excerpt(a.getContent())));
        return result;
    }

    @Override
    public List<Article> listRandomPublished(int limit, long seed) {
        // ORDER BY RAND(seed)：同一 seed 每次产生相同顺序 → 同一会话内返回首页不再打乱；
        // 不同会话 seed 不同，仍是随机。@TableLogic 自动追加 deleted=0
        List<Article> records = list(new LambdaQueryWrapper<Article>()
                .eq(Article::getStatus, ArticleStatus.PUBLISHED)
                .isNotNull(Article::getPublishTime)
                .last("ORDER BY RAND(" + seed + ") LIMIT " + limit));
        fill(records);
        records.forEach(a -> a.setSummary(markdownService.excerpt(a.getContent())));
        return records;
    }

    @Override
    public long countPublished() {
        return count(new LambdaQueryWrapper<Article>()
                .eq(Article::getStatus, ArticleStatus.PUBLISHED)
                .isNotNull(Article::getPublishTime));
    }

    private static final DateTimeFormatter MONTH_LABEL_FULL = DateTimeFormatter.ofPattern("yyyy 年 M 月");
    private static final DateTimeFormatter MONTH_LABEL_SHORT = DateTimeFormatter.ofPattern("yyyy.MM");

    @Override
    public List<MonthGroup> listPublishedByMonth() {
        // 全量已发布文章按发布时间倒序，再按月份（YearMonth）分组，天然保持月份倒序、组内倒序
        List<Article> records = list(new LambdaQueryWrapper<Article>()
                .eq(Article::getStatus, ArticleStatus.PUBLISHED)
                .isNotNull(Article::getPublishTime)
                .orderByDesc(Article::getPublishTime));
        fill(records);
        records.forEach(a -> a.setSummary(markdownService.excerpt(a.getContent())));

        LinkedHashMap<YearMonth, List<Article>> byMonth = new LinkedHashMap<>();
        for (Article a : records) {
            YearMonth ym = YearMonth.from(a.getPublishTime());
            byMonth.computeIfAbsent(ym, k -> new ArrayList<>()).add(a);
        }
        return byMonth.entrySet().stream()
                .map(e -> new MonthGroup(
                        e.getKey().format(MONTH_LABEL_FULL),
                        e.getKey().format(MONTH_LABEL_SHORT),
                        e.getValue()))
                .toList();
    }

    @Override
    public IPage<Article> listByStatus(Integer status, int page, int size) {
        LambdaQueryWrapper<Article> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(Article::getStatus, status);
        }
        wrapper.orderByDesc(Article::getCreatedAt);
        IPage<Article> result = page(new Page<>(page, size), wrapper);
        fill(result.getRecords());
        return result;
    }

    @Override
    public long countByStatus(int status) {
        return count(new LambdaQueryWrapper<Article>().eq(Article::getStatus, status));
    }

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

    @Override
    public Article findForTracking(String code) {
        return baseMapper.findByTrackingCodeIncludingDeleted(code);
    }

    @Override
    public void incrementViews(Long id) {
        update(null, new LambdaUpdateWrapper<Article>()
                .setSql("views = views + 1")
                .eq(Article::getId, id));
    }

    /** 详情页单条查询：返回前填充分类名 + 渲染 Markdown */
    @Override
    public Article getById(java.io.Serializable id) {
        Article article = super.getById(id);
        if (article != null) {
            fill(List.of(article));
            article.setContentHtml(markdownService.render(article.getContent()));
        }
        return article;
    }

    /** 批量填充分类名（categoryId → categoryName） */
    private void fill(List<Article> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Map<Long, String> map = categoryService.nameMap();
        list.forEach(a -> a.setCategoryName(map.get(a.getCategoryId())));
    }
}
