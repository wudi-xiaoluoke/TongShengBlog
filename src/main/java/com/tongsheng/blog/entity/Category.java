package com.tongsheng.blog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 文章分类实体
 *
 * <p>注意：不含 {@code deleted} 字段（无 @TableLogic），删除即物理删除。</p>
 */
@Data
@TableName("category")
public class Category {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String description;

    /** 排序值，越小越靠前 */
    private Integer sort;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
