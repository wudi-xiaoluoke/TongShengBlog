package com.tongsheng.blog.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.tongsheng.blog.config.AdminProperties;
import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.entity.Admin;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.interceptor.AdminLoginInterceptor;
import com.tongsheng.blog.mapper.AdminMapper;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.CategoryService;
import com.tongsheng.blog.service.LoginAttemptService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.Map;

/**
 * 管理端：登录、文章列表、审核、驳回、编辑、删除
 */
@Controller
public class AdminController {

    public static final Map<Integer, String> STATUS_LABELS = Map.of(
            ArticleStatus.PENDING, "待审核",
            ArticleStatus.PUBLISHED, "已发布",
            ArticleStatus.REJECTED, "已驳回"
    );

    private final AdminMapper adminMapper;
    private final AdminProperties adminProperties;
    private final BCryptPasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttemptService;
    private final ArticleService articleService;
    private final CategoryService categoryService;

    public AdminController(AdminMapper adminMapper, AdminProperties adminProperties,
                           BCryptPasswordEncoder passwordEncoder, LoginAttemptService loginAttemptService,
                           ArticleService articleService, CategoryService categoryService) {
        this.adminMapper = adminMapper;
        this.adminProperties = adminProperties;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptService = loginAttemptService;
        this.articleService = articleService;
        this.categoryService = categoryService;
    }

    // ---------------- 登录 ----------------

    @GetMapping("/admin/login")
    public String loginPage(HttpSession session, Model model) {
        if (session.getAttribute(AdminLoginInterceptor.SESSION_ADMIN) != null) {
            return "redirect:/admin";
        }
        model.addAttribute("error", model.asMap().getOrDefault("error", null));
        return "admin/login";
    }

    @PostMapping("/admin/login")
    public String login(@RequestParam String username,
                        @RequestParam String password,
                        HttpServletRequest request,
                        HttpSession session,
                        RedirectAttributes redirect) {
        String key = username + "|" + clientIp(request);
        if (loginAttemptService.isLocked(key)) {
            long seconds = loginAttemptService.remainingLockSeconds(key);
            redirect.addFlashAttribute("error",
                    "尝试次数过多，已被锁定，" + (seconds / 60 + 1) + " 分钟后重试");
            return "redirect:/admin/login";
        }
        Admin admin = adminMapper.selectOne(
                new LambdaQueryWrapper<Admin>().eq(Admin::getUsername, username));
        if (admin != null && passwordEncoder.matches(password, admin.getPassword())) {
            loginAttemptService.reset(key);
            session.setAttribute(AdminLoginInterceptor.SESSION_ADMIN, admin);
            return "redirect:/admin";
        }
        loginAttemptService.recordFailure(key);
        long remaining = loginAttemptService.remainingLockSeconds(key);
        String message = remaining > 0
                ? "登录失败过多，已锁定，请 " + (remaining / 60 + 1) + " 分钟后重试"
                : "用户名或密码错误";
        redirect.addFlashAttribute("error", message);
        return "redirect:/admin/login";
    }

    @PostMapping("/admin/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/admin/login";
    }

    // ---------------- 管理面板 ----------------

    @GetMapping("/admin")
    public String dashboard(@RequestParam(required = false) Integer status,
                            Model model) {
        IPage<Article> page = articleService.listByStatus(status, 1, 100);
        model.addAttribute("articles", page.getRecords());
        model.addAttribute("currentStatus", status);
        model.addAttribute("pendingCount", articleService.countByStatus(ArticleStatus.PENDING));
        model.addAttribute("publishedCount", articleService.countByStatus(ArticleStatus.PUBLISHED));
        model.addAttribute("rejectedCount", articleService.countByStatus(ArticleStatus.REJECTED));
        model.addAttribute("statusLabels", STATUS_LABELS);
        return "admin/dashboard";
    }

    // ---------------- 审核操作 ----------------

    @PostMapping("/admin/article/{id}/approve")
    public String approve(@PathVariable Long id, RedirectAttributes redirect) {
        if (articleService.approve(id)) {
            redirect.addFlashAttribute("flash", "已审核通过");
        } else {
            redirect.addFlashAttribute("flash", "操作失败：文章不存在或状态不符");
        }
        return "redirect:/admin";
    }

    @PostMapping("/admin/article/{id}/reject")
    public String reject(@PathVariable Long id,
                         @RequestParam(required = false) String reason,
                         RedirectAttributes redirect) {
        if (articleService.reject(id, reason)) {
            redirect.addFlashAttribute("flash", "已驳回" + (reason != null && !reason.isBlank() ? "：" + reason.trim() : ""));
        } else {
            redirect.addFlashAttribute("flash", "操作失败：文章不存在或状态不符");
        }
        return "redirect:/admin";
    }

    // ---------------- 编辑 ----------------

    @GetMapping("/admin/article/{id}/edit")
    public String editPage(@PathVariable Long id, Model model) {
        Article article = articleService.getById(id);
        if (article == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文章不存在");
        }
        model.addAttribute("article", article);
        model.addAttribute("categories", categoryService.listSorted());
        return "admin/edit";
    }

    @PostMapping("/admin/article/{id}/update")
    public String update(@PathVariable Long id,
                         @RequestParam String title,
                         @RequestParam String content,
                         @RequestParam(required = false) Long categoryId,
                         RedirectAttributes redirect) {
        if (title == null || title.isBlank()) {
            redirect.addFlashAttribute("flash", "标题不能为空");
            return "redirect:/admin/article/" + id + "/edit";
        }
        if (content == null || content.isBlank()) {
            redirect.addFlashAttribute("flash", "内容不能为空");
            return "redirect:/admin/article/" + id + "/edit";
        }
        // 防御：伪造的 categoryId 视为无分类
        Long validCategoryId = (categoryId != null && categoryService.getById(categoryId) != null)
                ? categoryId : null;
        boolean ok = articleService.updateDraft(id, title.trim(), content, validCategoryId);
        redirect.addFlashAttribute("flash", ok ? "已保存，状态回到待审核，记得重新发布" : "保存失败");
        return "redirect:/admin";
    }

    // ---------------- 删除（逻辑删除） ----------------

    @PostMapping("/admin/article/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirect) {
        boolean ok = articleService.removeById(id);
        redirect.addFlashAttribute("flash", ok ? "已删除" : "删除失败");
        return "redirect:/admin";
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
