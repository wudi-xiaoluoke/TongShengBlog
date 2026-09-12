package com.tongsheng.blog;

import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.entity.Admin;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.interceptor.AdminLoginInterceptor;
import com.tongsheng.blog.service.ArticleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 投稿审核反馈全链路：回执号生成、审核附言、/track 查询、限流、管理端附言。
 * 直接连真实库，测试数据在 @AfterEach 里物理删除，不污染开发库。
 */
@SpringBootTest
@AutoConfigureMockMvc
class SubmissionTrackingTests {

    @Autowired
    private ArticleService articleService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** 本次测试产生的回执号，@AfterEach 物理清理 */
    private final List<String> createdCodes = new ArrayList<>();

    @AfterEach
    void cleanup() {
        createdCodes.forEach(code ->
                jdbcTemplate.update("DELETE FROM article WHERE tracking_code = ?", code));
    }

    /** 直接经 service 建一篇待审核草稿，返回带 trackingCode 的实体 */
    private Article submitDraft() {
        Article article = new Article();
        article.setNickname("测试投稿人");
        article.setTitle("测试投稿-" + UUID.randomUUID());
        article.setContent("测试正文");
        articleService.submit(article);
        createdCodes.add(article.getTrackingCode());
        return article;
    }

    /** 管理端已登录会话 */
    private MockHttpSession adminSession() {
        Admin admin = new Admin();
        admin.setId(1L);
        admin.setUsername("admin");
        admin.setNickname("同生");
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AdminLoginInterceptor.SESSION_ADMIN, admin);
        return session;
    }

    @Test
    void submitGeneratesUniqueTrackingCode() {
        Article a = submitDraft();
        Article b = submitDraft();
        assertNotNull(a.getTrackingCode());
        assertEquals(8, a.getTrackingCode().length());
        assertNotEquals(a.getTrackingCode(), b.getTrackingCode(), "两次投稿回执号不应重复");
        assertEquals(ArticleStatus.PENDING, a.getStatus());
    }

    @Test
    void approveWithFeedbackStoresFeedbackAndReviewedAt() {
        Article a = submitDraft();
        assertTrue(articleService.approve(a.getId(), "写得很真诚，谢谢你"));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PUBLISHED, saved.getStatus());
        assertEquals("写得很真诚，谢谢你", saved.getFeedback());
        assertNotNull(saved.getReviewedAt());
        assertNotNull(saved.getPublishTime());
    }

    @Test
    void approveWithBlankFeedbackLeavesFeedbackNull() {
        Article a = submitDraft();
        assertTrue(articleService.approve(a.getId(), "   "));
        assertNull(articleService.getById(a.getId()).getFeedback());
    }

    @Test
    void rejectStoresFeedbackAndStatus() {
        Article a = submitDraft();
        assertTrue(articleService.reject(a.getId(), "内容与主题不符"));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.REJECTED, saved.getStatus());
        assertEquals("内容与主题不符", saved.getFeedback());
        assertNotNull(saved.getReviewedAt());
        assertNull(saved.getPublishTime());
    }

    @Test
    void approveOnNonPendingReturnsFalse() {
        Article a = submitDraft();
        articleService.approve(a.getId(), null);
        assertFalse(articleService.approve(a.getId(), "再评一次"));
    }

    @Test
    void updateDraftClearsStaleFeedbackAndReviewedAt() {
        Article a = submitDraft();
        articleService.reject(a.getId(), "旧附言");
        assertTrue(articleService.updateDraft(a.getId(), "改了标题", "新内容", null));
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PENDING, saved.getStatus());
        assertNull(saved.getFeedback(), "编辑后回到待审核，旧附言应清空");
        assertNull(saved.getReviewedAt());
    }

    @Test
    void findForTrackingReturnsArticleByCode() {
        Article a = submitDraft();
        Article found = articleService.findForTracking(a.getTrackingCode());
        assertNotNull(found);
        assertEquals(a.getId(), found.getId());
        assertNull(articleService.findForTracking("NOPE1234"));
    }

    @Test
    void findForTrackingStillReturnsLogicallyDeletedArticle() {
        Article a = submitDraft();
        articleService.approve(a.getId(), null);
        articleService.removeById(a.getId()); // 逻辑删除（deleted=1）
        Article found = articleService.findForTracking(a.getTrackingCode());
        assertNotNull(found, "回执小票应仍能看到审核结果");
        assertEquals(1, found.getDeleted().intValue());
    }

    @Test
    void adminApproveWithFeedbackWorks() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(post("/admin/article/{id}/approve", a.getId())
                        .param("feedback", "写得很真诚")
                        .session(adminSession()))
                .andExpect(status().is3xxRedirection());
        Article saved = articleService.getById(a.getId());
        assertEquals(ArticleStatus.PUBLISHED, saved.getStatus());
        assertEquals("写得很真诚", saved.getFeedback());
    }

    @Test
    void trackWithoutCodeShowsQueryForm() throws Exception {
        mockMvc.perform(get("/track"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("回执号")));
    }

    @Test
    void trackShowsPendingSlip() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("待审核")))
                .andExpect(content().string(containsString(a.getTitle())))
                .andExpect(content().string(containsString(a.getTrackingCode())));
    }

    @Test
    void trackUnknownCodeShowsNotFound() throws Exception {
        mockMvc.perform(get("/track").param("code", "NOPE1234"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("回执号不存在")));
    }

    @Test
    void trackLookupRateLimitedByIp() throws Exception {
        // 用独立假 IP，避免污染其它测试的 127.0.0.1 限额
        for (int i = 0; i < 30; i++) {
            mockMvc.perform(get("/track").param("code", "ABC12345")
                            .with(req -> { req.setRemoteAddr("10.9.9.9"); return req; }))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(get("/track").param("code", "ABC12345")
                        .with(req -> { req.setRemoteAddr("10.9.9.9"); return req; }))
                .andExpect(content().string(containsString("查得太频繁")));
    }

    @Test
    void submitRedirectsToTrackingSlip() throws Exception {
        MvcResult result = mockMvc.perform(post("/submit")
                        .param("nickname", "小鹿")
                        .param("title", "测试投稿-重定向-" + UUID.randomUUID())
                        .param("content", "测试正文")
                        .with(req -> { req.setRemoteAddr("10.0.0.1"); return req; }))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = result.getResponse().getRedirectedUrl();
        assertNotNull(location, "提交成功后应重定向到回执小票页");
        assertTrue(location.contains("/track?code="), "重定向应为 /track?code=…，实际：" + location);
        String code = location.substring(location.indexOf("code=") + "code=".length());
        createdCodes.add(code);
        assertNotNull(articleService.findForTracking(code), "回执号应已落库可查");
    }

    @Test
    void adminRejectWithFeedbackShowsOnSlip() throws Exception {
        Article a = submitDraft();
        mockMvc.perform(post("/admin/article/{id}/reject", a.getId())
                        .param("feedback", "内容与主题不符")
                        .session(adminSession()))
                .andExpect(status().is3xxRedirection());
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(content().string(containsString("已驳回")))
                .andExpect(content().string(containsString("内容与主题不符")));
    }

    @Test
    void deletedArticleShowsRemovedOnSlip() throws Exception {
        Article a = submitDraft();
        articleService.approve(a.getId(), "谢谢投稿");
        articleService.removeById(a.getId()); // 逻辑删除
        mockMvc.perform(get("/track").param("code", a.getTrackingCode()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("已被撤下")))
                .andExpect(content().string(containsString("已通过")))
                .andExpect(content().string(containsString("谢谢投稿")));
    }
}
