package com.tongsheng.blog.controller;

import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.TrackingRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * 回执号查询页：访客凭投稿回执号查看审核进度与站长的话
 */
@Controller
public class TrackController {

    private final ArticleService articleService;
    private final TrackingRateLimitService trackingRateLimit;

    public TrackController(ArticleService articleService, TrackingRateLimitService trackingRateLimit) {
        this.articleService = articleService;
        this.trackingRateLimit = trackingRateLimit;
    }

    @GetMapping("/track")
    public String track(@RequestParam(required = false) String code,
                        Model model,
                        HttpServletRequest request) {
        String trimmed = (code == null) ? "" : code.trim();
        model.addAttribute("query", trimmed);
        if (trimmed.isEmpty()) {
            return "track/index";
        }
        if (!trackingRateLimit.allow(clientIp(request))) {
            model.addAttribute("error", "查得太频繁啦，歇一分钟再试～");
            return "track/index";
        }
        Article article = articleService.findForTracking(trimmed);
        if (article == null) {
            model.addAttribute("error", "回执号不存在，是不是抄错了？");
            return "track/index";
        }
        model.addAttribute("article", article);
        return "track/index";
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
