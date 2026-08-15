package com.tongsheng.blog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 文章 / 投稿实体
 */
@Data
@TableName("article")
public class Article {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    /** 正文（Markdown 原文） */
    private String content;

    /** 阅读量 */
    private Long views;

    private String nickname;

    /** 分类ID（null 表示无分类） */
    private Long categoryId;

    /** 分类名称（瞬态字段，仅显示用，不入库） */
    @TableField(exist = false)
    private String categoryName;

    /** 渲染后的 HTML（瞬态，详情页展示用，不入库） */
    @TableField(exist = false)
    private String contentHtml;

    /** 纯文本摘要（瞬态，主页卡片展示用，不入库） */
    @TableField(exist = false)
    private String summary;

    /** 状态：0-待审核 1-已发布 2-已驳回，见 {@link com.tongsheng.blog.constant.ArticleStatus} */
    private Integer status;

    private String rejectReason;

    /** 审核通过发布时间 */
    private LocalDateTime publishTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
