package com.tongsheng.blog.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.tongsheng.blog.entity.Category;

import java.util.List;
import java.util.Map;

/**
 * 分类服务
 */
public interface CategoryService extends IService<Category> {

    /** 按 sort、id 升序返回全部分类 */
    List<Category> listSorted();

    /** 返回 id → name 映射，供显示层填充分类名 */
    Map<Long, String> nameMap();

    /** 删除分类，并把它下面的文章置为「无分类」 */
    boolean deleteCategory(Long id);
}
