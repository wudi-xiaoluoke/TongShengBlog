package com.tongsheng.blog;

import com.tongsheng.blog.constant.ArticleStatus;
import com.tongsheng.blog.dto.MonthGroup;
import com.tongsheng.blog.dto.Spread;
import com.tongsheng.blog.entity.Article;
import com.tongsheng.blog.service.ArticleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 手账档案馆（/notes）测试：按月分组、书页配对、页面渲染
 */
@SpringBootTest
@AutoConfigureMockMvc
class NotesBookTests {

    @Autowired
    private ArticleService articleService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void monthGroupsAreNewestFirstAndSortedWithinMonth() {
        List<MonthGroup> groups = articleService.listPublishedByMonth();
        assertFalse(groups.isEmpty(), "库里应至少有已发布文章");

        // 月份倒序（最新在前）
        for (int i = 0; i < groups.size() - 1; i++) {
            assertTrue(groups.get(i).shortLabel().compareTo(groups.get(i + 1).shortLabel()) > 0,
                    "月份应倒序（最新在前）：" + groups.get(i).shortLabel() + " 应在 " + groups.get(i + 1).shortLabel() + " 前");
        }
        // 组内全部已发布 + 按发布时间倒序
        for (MonthGroup g : groups) {
            List<Article> arts = g.articles();
            assertTrue(arts.stream().allMatch(a -> a.getStatus() == ArticleStatus.PUBLISHED),
                    "手账页只能出现已发布文章");
            for (int i = 0; i < arts.size() - 1; i++) {
                assertFalse(arts.get(i).getPublishTime().isBefore(arts.get(i + 1).getPublishTime()),
                        "组内文章应按发布时间倒序");
            }
        }
    }

    @Test
    void pairUpBuildsTwoPageSpreadsAndOddMonthGetsBackCover() {
        List<MonthGroup> four = months("2026.08", "2026.07", "2026.06", "2026.05");
        List<Spread> s4 = Spread.pairUp(four);
        assertEquals(2, s4.size());
        assertEquals("2026.08", s4.get(0).left().shortLabel());
        assertEquals("2026.07", s4.get(0).right().shortLabel());
        assertEquals("2026.06", s4.get(1).left().shortLabel());
        assertEquals("2026.05", s4.get(1).right().shortLabel());
        assertTrue(s4.get(1).hasRight());

        List<MonthGroup> three = months("2026.08", "2026.07", "2026.06");
        List<Spread> s3 = Spread.pairUp(three);
        assertEquals(2, s3.size());
        assertTrue(s3.get(0).hasRight());
        assertFalse(s3.get(1).hasRight(), "最后奇数个月不应有右页");
        assertNull(s3.get(1).right());
        assertEquals("2026.06", s3.get(1).left().shortLabel());
    }

    @Test
    void notesPageRendersWithMonthsAndArticleLinks() throws Exception {
        MvcResult result = mockMvc.perform(get("/notes"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("month-title")))
                .andExpect(content().string(containsString("/article/")))
                .andExpect(content().string(containsString("class=\"page-picker\"")))
                .andExpect(content().string(containsString("id=\"pageMenuBtn\"")))
                .andExpect(content().string(containsString("id=\"pageMenu\"")))
                .andExpect(content().string(containsString("class=\"page-option\"")))
                .andExpect(content().string(containsString("aria-haspopup=\"listbox\"")))
                .andExpect(content().string(containsString("role=\"option\"")))
                .andExpect(content().string(containsString("aria-selected=")))
                .andExpect(content().string(containsString("id=\"monthIndex\"")))
                .andExpect(content().string(containsString("book-page-block")))
                .andExpect(content().string(containsString("jump-label")))
                .andReturn();

        String html = result.getResponse().getContentAsString();
        assertTrue(Pattern.compile("<div[^>]*id=\\\"pageMenu\\\"[^>]*>\\s*<button(?=[^>]*class=\\\"page-option\\\")(?=[^>]*role=\\\"option\\\")(?=[^>]*data-index=)[^>]*>", Pattern.DOTALL)
                        .matcher(html)
                        .find(),
                "pageMenu must contain a page-option button with role=option and data-index");
        assertTrue(Pattern.compile("<nav[^>]*id=\\\"monthIndex\\\"[^>]*>\\s*<button(?=[^>]*class=\\\"mi(?:\\s|\\\"))(?=[^>]*data-index=)(?=[^>]*data-month=)[^>]*>", Pattern.DOTALL)
                        .matcher(html)
                        .find(),
                "monthIndex must contain a month button with data-index and data-month");
    }

    private List<MonthGroup> months(String... shorts) {
        List<MonthGroup> list = new ArrayList<>();
        for (String s : shorts) {
            list.add(new MonthGroup(s, s, List.of()));
        }
        return list;
    }
}
