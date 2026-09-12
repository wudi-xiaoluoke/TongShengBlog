package com.tongsheng.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tongsheng.blog.entity.Article;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 文章 Mapper
 */
public interface ArticleMapper extends BaseMapper<Article> {

    /** 按回执号查询（含逻辑删除记录，供回执小票显示审核结果与「已撤下」状态）。
     *  注意：@TableLogic 会为所有 MyBatis-Plus 自动 SQL 追加 deleted=0，此处必须用原生 @Select 才能查到已删行。 */
    @Select("SELECT * FROM article WHERE tracking_code = #{code} LIMIT 1")
    Article findByTrackingCodeIncludingDeleted(@Param("code") String code);

    /** 按回执号计数（含逻辑删除记录，用于生成时避免与已删行的历史回执号撞号） */
    @Select("SELECT COUNT(*) FROM article WHERE tracking_code = #{code}")
    long countByTrackingCode(@Param("code") String code);
}
