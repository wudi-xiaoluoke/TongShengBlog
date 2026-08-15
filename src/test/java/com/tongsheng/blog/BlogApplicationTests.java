package com.tongsheng.blog;

import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.entity.Category;
import com.tongsheng.blog.mapper.ArticleMapper;
import com.tongsheng.blog.service.ArticleService;
import com.tongsheng.blog.service.CategoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 冒烟测试：上下文启动 + 种子数据 + 状态流转 + 分类管理
 */
@SpringBootTest
class BlogApplicationTests {

    @Autowired
    private ArticleMapper articleMapper;

    @Autowired
    private ArticleService articleService;

    @Autowired
    private CategoryService categoryService;

    @Test
    void contextLoads() {
        assertNotNull(articleMapper);
    }

    @Test
    void seedArticlesExist() {
        List<Article> published = articleService.listPublished(1, 10).getRecords();
        assertFalse(published.isEmpty(), "主页应至少有种子文章");
        assertTrue(published.stream().allMatch(a -> a.getStatus() == ArticleStatus.PUBLISHED),
                "主页只能出现已发布文章");
    }

    @Test
    void submitThenApproveFlow() {
        // 投稿（带分类）
        Article draft = new Article();
        draft.setTitle("测试投稿文章");
        draft.setContent("这是一篇用于自动化验证状态流转的测试内容。");
        draft.setNickname("测试员");
        draft.setCategoryId(1L); // 随笔
        articleService.submit(draft);
        assertNotNull(draft.getId());
        assertEquals(ArticleStatus.PENDING, draft.getStatus());

        // 未审核时主页不可见
        assertTrue(articleService.listPublished(1, 50).getRecords().stream()
                        .noneMatch(a -> a.getId().equals(draft.getId())),
                "待审核文章不应出现在主页");

        // 审核通过
        assertTrue(articleService.approve(draft.getId()));
        Article approved = articleService.getById(draft.getId());
        assertEquals(ArticleStatus.PUBLISHED, approved.getStatus());
        assertNotNull(approved.getPublishTime());
        assertEquals("随笔", approved.getCategoryName(), "分类名应被正确填充");

        // 已发布主页可见
        assertTrue(articleService.listPublished(1, 50).getRecords().stream()
                        .anyMatch(a -> a.getId().equals(draft.getId())),
                "审核通过后应出现在主页");

        // 清理测试数据
        articleMapper.deleteById(draft.getId());
    }

    @Test
    void categoryCrudAndDeleteClearsArticles() {
        // 新增
        Category category = new Category();
        category.setName("测试分类");
        category.setDescription("用于自动化测试");
        category.setSort(99);
        assertTrue(categoryService.save(category));
        Long id = category.getId();
        assertNotNull(id);

        // 查（listSorted 应包含）
        assertTrue(categoryService.listSorted().stream().anyMatch(c -> c.getId().equals(id)));
        assertTrue(categoryService.nameMap().containsKey(id));

        // 改名
        category.setName("测试分类改名");
        assertTrue(categoryService.updateById(category));
        assertEquals("测试分类改名",
                categoryService.nameMap().get(id));

        // 建一篇文章挂在该分类下
        Article article = new Article();
        article.setTitle("挂分类的文章");
        article.setContent("删除分类时这篇文章应被置为无分类。");
        article.setNickname("测试员");
        article.setCategoryId(id);
        articleService.submit(article);

        // 删除分类 → 其下文章变无分类
        assertTrue(categoryService.deleteCategory(id));
        assertNull(categoryService.getById(id), "分类应已删除");
        Article after = articleService.getById(article.getId());
        assertNull(after.getCategoryId(), "文章分类应被置空");
        assertNull(after.getCategoryName(), "分类名应为空");

        // 清理测试文章
        articleMapper.deleteById(article.getId());
    }

    @Test
    void markdownRenderAndXssSafe() {
        Article a = new Article();
        a.setTitle("渲染测试");
        a.setContent("**加粗**\n\n- 列表项\n\n`<script>alert(1)</script>`\n\n[链接](javascript:alert(2))\n\n```java\nSystem.out.println(\"hi\");\n```");
        a.setNickname("测试");
        a.setCategoryId(1L);
        articleService.submit(a);
        articleService.approve(a.getId());

        Article detail = articleService.getById(a.getId());
        String html = detail.getContentHtml();
        assertNotNull(html);
        assertTrue(html.contains("<strong>加粗</strong>"), "加粗应渲染为 <strong>");
        assertFalse(html.contains("javascript:alert"), "OWASP 应移除 javascript: 链接");
        assertFalse(html.contains("<script>alert"), "原始脚本不得出现（应被转义）");
        assertTrue(html.contains("language-java"), "围栏代码块应带语言类");

        // 卡片摘要是纯文本（经 th:text 转义安全显示），不得含可执行的脚本标签，长度受限
        var card = articleService.listPublished(1, 50).getRecords().stream()
                .filter(x -> x.getId().equals(a.getId())).findFirst().orElse(null);
        assertNotNull(card);
        assertFalse(card.getSummary().contains("<script>"), "摘要不应含可执行的 script 标签");
        // 摘要在截断后再做 HTML 转义，转义会略增长度，留少量余量
        assertTrue(card.getSummary().length() <= 120, "摘要长度应受限（约 80 字，转义略增）");

        articleMapper.deleteById(a.getId());
    }

    @Test
    void viewsIncrementAtomicAndDefaultZero() {
        Article a = new Article();
        a.setTitle("浏览量测试");
        a.setContent("x");
        a.setNickname("测试");
        articleService.submit(a);
        articleService.approve(a.getId());

        assertEquals(0L, articleService.getById(a.getId()).getViews(), "默认阅读量应为 0");
        articleService.incrementViews(a.getId());
        articleService.incrementViews(a.getId());
        assertEquals(2L, articleService.getById(a.getId()).getViews(), "自增两次应为 2");

        articleMapper.deleteById(a.getId());
    }
}
