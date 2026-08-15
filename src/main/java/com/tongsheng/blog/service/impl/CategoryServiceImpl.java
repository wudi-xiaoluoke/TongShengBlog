package com.tongsheng.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.entity.Category;
import com.tongsheng.blog.mapper.ArticleMapper;
import com.tongsheng.blog.mapper.CategoryMapper;
import com.tongsheng.blog.service.CategoryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 分类服务实现
 */
@Service
public class CategoryServiceImpl extends ServiceImpl<CategoryMapper, Category> implements CategoryService {

    private final ArticleMapper articleMapper;

    public CategoryServiceImpl(ArticleMapper articleMapper) {
        this.articleMapper = articleMapper;
    }

    @Override
    public List<Category> listSorted() {
        return list(new LambdaQueryWrapper<Category>()
                .orderByAsc(Category::getSort)
                .orderByAsc(Category::getId));
    }

    @Override
    public Map<Long, String> nameMap() {
        Map<Long, String> map = new LinkedHashMap<>();
        for (Category c : listSorted()) {
            map.put(c.getId(), c.getName());
        }
        return map;
    }

    @Override
    @Transactional
    public boolean deleteCategory(Long id) {
        if (getById(id) == null) {
            return false;
        }
        // 该分类下所有文章置为「无分类」（只更新未逻辑删除的；被删行由外键 ON DELETE SET NULL 兜底）
        articleMapper.update(null, new LambdaUpdateWrapper<Article>()
                .set(Article::getCategoryId, null)
                .eq(Article::getCategoryId, id));
        // 物理删除分类
        return removeById(id);
    }
}
