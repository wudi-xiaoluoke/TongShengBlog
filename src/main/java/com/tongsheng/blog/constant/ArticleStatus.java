package com.tongsheng.blog.constant;

/**
 * 文章状态常量
 */
public final class ArticleStatus {

    /** 待审核 */
    public static final int PENDING = 0;

    /** 已发布 */
    public static final int PUBLISHED = 1;

    /** 已驳回 */
    public static final int REJECTED = 2;

    private ArticleStatus() {
    }
}
