package com.tongsheng.blog.controller;

import com.tongsheng.blog.entity.Category;
import com.tongsheng.blog.service.CategoryService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * 管理端分类管理：列表、新增、编辑、删除（/admin/categories/**，由拦截器保护）
 */
@Controller
public class AdminCategoryController {

    private final CategoryService categoryService;

    public AdminCategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    /** 分类列表页 + 顶部新增表单 */
    @GetMapping("/admin/categories")
    public String list(Model model) {
        model.addAttribute("categories", categoryService.listSorted());
        return "admin/categories";
    }

    /** 新增分类 */
    @PostMapping("/admin/categories/create")
    public String create(@RequestParam String name,
                         @RequestParam(required = false) String description,
                         @RequestParam(defaultValue = "0") int sort,
                         RedirectAttributes redirect) {
        if (name == null || name.isBlank()) {
            redirect.addFlashAttribute("flash", "分类名称不能为空");
            return "redirect:/admin/categories";
        }
        try {
            Category category = new Category();
            category.setName(name.trim());
            category.setDescription(blankToNull(description));
            category.setSort(sort);
            categoryService.save(category);
            redirect.addFlashAttribute("flash", "已新增分类：「" + name.trim() + "」");
        } catch (DuplicateKeyException e) {
            redirect.addFlashAttribute("flash", "分类名称已存在：「" + name.trim() + "」");
        }
        return "redirect:/admin/categories";
    }

    /** 编辑分类 */
    @PostMapping("/admin/categories/{id}/update")
    public String update(@PathVariable Long id,
                         @RequestParam String name,
                         @RequestParam(required = false) String description,
                         @RequestParam(defaultValue = "0") int sort,
                         RedirectAttributes redirect) {
        Category category = categoryService.getById(id);
        if (category == null) {
            redirect.addFlashAttribute("flash", "分类不存在");
            return "redirect:/admin/categories";
        }
        if (name == null || name.isBlank()) {
            redirect.addFlashAttribute("flash", "分类名称不能为空");
            return "redirect:/admin/categories";
        }
        try {
            category.setName(name.trim());
            category.setDescription(blankToNull(description));
            category.setSort(sort);
            categoryService.updateById(category);
            redirect.addFlashAttribute("flash", "已更新分类：「" + name.trim() + "」");
        } catch (DuplicateKeyException e) {
            redirect.addFlashAttribute("flash", "分类名称已存在：「" + name.trim() + "」");
        }
        return "redirect:/admin/categories";
    }

    /** 删除分类（其下文章自动置为无分类） */
    @PostMapping("/admin/categories/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        boolean ok = categoryService.deleteCategory(id);
        redirect.addFlashAttribute("flash", ok ? "已删除分类，该分类下的文章已变为「无分类」" : "分类不存在");
        return "redirect:/admin/categories";
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
