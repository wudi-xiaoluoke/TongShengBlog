package com.tongsheng.blog.controller;

import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.dto.Spread;
import com.tongsheng.blog.dto.SubmitDTO;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.CategoryService;
import com.tongsheng.blog.service.SubmitRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 前台页面：主页、文章详情、投稿
 */
@Controller
public class HomeController {

    /** session 中已浏览文章 id 集合的键名 */
    public static final String SESSION_VIEWED_ARTICLES = "viewedArticleIds";

    /** session 中首页随机种子键名：同一会话内首页文章集与顺序保持不变 */
    private static final String SESSION_HOME_SEED = "homeRandomSeed";

    private final ArticleService articleService;
    private final CategoryService categoryService;
    private final SubmitRateLimitService rateLimitService;

    public HomeController(ArticleService articleService, CategoryService categoryService,
                          SubmitRateLimitService rateLimitService) {
        this.articleService = articleService;
        this.categoryService = categoryService;
        this.rateLimitService = rateLimitService;
    }

    /** 主页：随机展示一批已发布文章（默认 10 篇，可切 5/10/20）+ 投稿表单。
     *  随机种子固定在会话内：点进文章再「回到小本本」时，文章集与顺序保持不变。 */
    @GetMapping("/")
    public String index(@RequestParam(defaultValue = "10") int size, HttpSession session, Model model) {
        int pageSize = normalizeSize(size);
        List<Article> articles = articleService.listRandomPublished(pageSize, homeSeed(session));
        model.addAttribute("articles", articles);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("total", articleService.countPublished());
        model.addAttribute("submit", new SubmitDTO());
        model.addAttribute("categories", categoryService.listSorted());
        return "home/index";
    }

    /** 手账档案馆：全部已发布文章按月分组，以翻书页形式展示 */
    @GetMapping("/notes")
    public String notes(Model model) {
        model.addAttribute("spreads", Spread.pairUp(articleService.listPublishedByMonth()));
        return "notes/index";
    }

    /** 会话内首页随机种子：首次访问生成并存入 session，之后复用（返回首页不再打乱） */
    private long homeSeed(HttpSession session) {
        Object seed = session.getAttribute(SESSION_HOME_SEED);
        if (seed instanceof Number n) {
            return n.longValue();
        }
        long fresh = ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        session.setAttribute(SESSION_HOME_SEED, fresh);
        return fresh;
    }

    /** 每页展示数量：仅允许 5/10/20，其它值回退默认 10 */
    private int normalizeSize(int size) {
        return (size == 5 || size == 10 || size == 20) ? size : 10;
    }

    /** 文章详情（仅已发布，否则 404）。同一会话内同一篇只计一次阅读量。 */
    @GetMapping("/article/{id}")
    public String detail(@PathVariable Long id, Model model, HttpSession session) {
        Article article = articleService.getById(id);
        if (article == null || article.getStatus() != ArticleStatus.PUBLISHED) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文章不存在或未发布");
        }
        // 同一浏览器会话内同一篇只计一次（防刷新刷量）
        if (recordView(id, session)) {
            // 自增成功，页面显示值补正 +1（持久化只走上面的原子 SQL）
            article.setViews(article.getViews() == null ? 1L : article.getViews() + 1);
        }
        model.addAttribute("article", article);
        return "article/detail";
    }

    /** @return true = 本次为新计数（已执行自增）；false = 会话内已看过 */
    @SuppressWarnings("unchecked")
    private boolean recordView(Long id, HttpSession session) {
        Set<Long> viewed = (Set<Long>) session.getAttribute(SESSION_VIEWED_ARTICLES);
        if (viewed == null) {
            viewed = new HashSet<>();
            session.setAttribute(SESSION_VIEWED_ARTICLES, viewed);
        }
        boolean firstTime = viewed.add(id); // Set.add 返回 true 表示首次
        if (firstTime) {
            articleService.incrementViews(id);
        }
        return firstTime;
    }

    /** 访客投稿：校验 + 限流 + PRG */
    @PostMapping("/submit")
    public String submit(@Valid @ModelAttribute("submit") SubmitDTO dto,
                         BindingResult bindingResult,
                         HttpServletRequest request,
                         RedirectAttributes redirect) {
        if (bindingResult.hasErrors()) {
            String message = bindingResult.getFieldErrors().stream()
                    .map(fe -> fe.getDefaultMessage())
                    .findFirst().orElse("请检查填写的内容");
            redirect.addFlashAttribute("error", message);
            return "redirect:/#guest";
        }
        if (!rateLimitService.allow(clientIp(request))) {
            redirect.addFlashAttribute("error", "写得有点多啦，歇会儿再写～");
            return "redirect:/#guest";
        }
        Article article = new Article();
        article.setNickname(dto.getNickname().trim());
        article.setTitle(dto.getTitle().trim());
        article.setContent(dto.getContent());
        // 防御：伪造的 categoryId 视为无分类
        Long categoryId = (dto.getCategoryId() != null && categoryService.getById(dto.getCategoryId()) != null)
                ? dto.getCategoryId() : null;
        article.setCategoryId(categoryId);
        articleService.submit(article);
        redirect.addFlashAttribute("ok", "已收到，等审核通过就会出现在小本本上～");
        return "redirect:/#guest";
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
