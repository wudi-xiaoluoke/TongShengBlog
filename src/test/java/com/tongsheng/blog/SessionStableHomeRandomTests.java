package com.tongsheng.blog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 回归测试：首页「会话内固定随机」。
 *
 * 背景：首页用 ORDER BY RAND() 每次重新随机挑一批文章，点进文章再「回到小本本」时
 * 所有文章都变了。修复后同一会话内复用同一随机种子，文章集合与顺序必须保持不变。
 */
@SpringBootTest
@AutoConfigureMockMvc
class SessionStableHomeRandomTests {

    @Autowired
    private MockMvc mockMvc;

    private static final Pattern ARTICLE_LINK = Pattern.compile("/article/(\\d+)");

    /** 按出现顺序提取首页 HTML 中文章卡片的 id 列表 */
    private List<Long> articleIds(String html) {
        List<Long> ids = new ArrayList<>();
        Matcher m = ARTICLE_LINK.matcher(html);
        while (m.find()) {
            ids.add(Long.parseLong(m.group(1)));
        }
        return ids;
    }

    private MvcResult render(String path, MockHttpSession session) throws Exception {
        return mockMvc.perform(get(path).session(session))
                .andExpect(status().isOk())
                .andReturn();
    }

    @Test
    void sameSessionRepeatedHomeReturnsIdenticalSetAndOrder() throws Exception {
        MockHttpSession session = new MockHttpSession();
        List<Long> first = articleIds(render("/", session).getResponse().getContentAsString());
        List<Long> second = articleIds(render("/", session).getResponse().getContentAsString());

        assertFalse(first.isEmpty(), "首页应展示已发布文章");
        assertEquals(first, second, "同一会话内再次进入首页，文章集合与顺序应保持不变");
    }

    @Test
    void sameSessionPageSizeSwitchKeepsRelativeOrder() throws Exception {
        MockHttpSession session = new MockHttpSession();
        List<Long> five = articleIds(render("/?size=5", session).getResponse().getContentAsString());
        List<Long> twenty = articleIds(render("/?size=20", session).getResponse().getContentAsString());

        assertFalse(five.isEmpty());
        assertFalse(twenty.isEmpty());
        // 同一随机种子下，5 篇应是 20 篇的前缀（相对顺序一致）
        assertEquals(five, twenty.subList(0, five.size()), "切到更大页数时，之前看到的文章应在前面且顺序不变");
    }

    @Test
    void differentSessionsUseDifferentSeed() throws Exception {
        long seedA = seedOf(new MockHttpSession());
        long seedB = seedOf(new MockHttpSession());
        assertNotEquals(seedA, seedB, "不同会话应生成不同的随机种子");
    }

    private long seedOf(MockHttpSession session) throws Exception {
        render("/", session);
        return Long.parseLong(String.valueOf(session.getAttribute("homeRandomSeed")));
    }
}
