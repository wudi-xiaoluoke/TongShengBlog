package com.tongsheng.blog.service;

import com.vladsch.flexmark.ext.autolink.AutolinkExtension;
import com.vladsch.flexmark.ext.gfm.strikethrough.StrikethroughExtension;
import com.vladsch.flexmark.ext.gfm.tasklist.TaskListExtension;
import com.vladsch.flexmark.ext.tables.TablesExtension;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import com.vladsch.flexmark.util.misc.Extension;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Markdown 渲染服务
 *
 * <p>三层 XSS 防线：
 * <ol>
 *   <li>flexmark {@code escapeHtmlBlocks/Inline(true)} 把作者写的原生 HTML 标签转义成文本</li>
 *   <li>OWASP 白名单净化兜底：剔除白名单外元素/属性，尤其拦截 {@code javascript:} 等危险协议链接</li>
 *   <li>代码块天然转义：围栏代码块内容由 flexmark 转义，highlight.js 仅着色不执行</li>
 * </ol>
 */
@Component
public class MarkdownService {

    private static final int SUMMARY_LENGTH = 80;

    private final Parser parser;
    private final HtmlRenderer renderer;
    private final PolicyFactory policy;

    public MarkdownService() {
        List<Extension> extensions = List.of(
                TablesExtension.create(),
                TaskListExtension.create(),
                AutolinkExtension.create(),
                StrikethroughExtension.create()
        );
        MutableDataSet options = new MutableDataSet();
        options.set(Parser.EXTENSIONS, extensions);

        parser = Parser.builder(options).build();
        renderer = HtmlRenderer.builder(options)
                .escapeHtml(true)         // 原生 HTML → 按文本转义输出（块 + 行内）
                .softBreak("<br />")      // 单换行 → <br>，保住手账换行风格
                .build();

        policy = new HtmlPolicyBuilder()
                .allowElements(
                        "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
                        "ul", "ol", "li", "blockquote", "pre", "code",
                        "strong", "em", "del", "a", "img",
                        "table", "thead", "tbody", "tr", "th", "td",
                        "span", "div", "input")
                .allowAttributes("class").onElements("code", "pre", "blockquote", "ul", "li", "div", "span")
                .allowAttributes("href", "title", "target", "rel").onElements("a")
                .allowAttributes("src", "alt", "title").onElements("img")
                .allowAttributes("type", "checked", "disabled").onElements("input")
                .allowAttributes("colspan", "rowspan").onElements("th", "td")
                .allowUrlProtocols("http", "https", "mailto")
                .requireRelNofollowOnLinks()
                .toFactory();
    }

    /** Markdown → 已净化的 HTML（详情页用） */
    public String render(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }
        try {
            Node doc = parser.parse(markdown);
            return policy.sanitize(renderer.render(doc));
        } catch (RuntimeException e) {
            // flexmark 对畸形 markdown 很宽容，兜底不抛异常
            return markdown;
        }
    }

    /** 把纯文本里的 HTML 特殊字符转义，确保摘要字段不含可执行标签 */
    private String escapeHtml(String text) {
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** Markdown → 纯文本摘要（主页卡片用，约 80 字） */
    public String excerpt(String markdown) {
        if (markdown == null || markdown.isBlank()) {
            return "";
        }
        try {
            Node doc = parser.parse(markdown);
            String text = new com.vladsch.flexmark.util.ast.TextCollectingVisitor()
                    .collectAndGetText(doc);
            text = text.replaceAll("\\s+", " ").trim();
            if (text.isEmpty()) {
                return "";
            }
            text = text.length() <= SUMMARY_LENGTH ? text : text.substring(0, SUMMARY_LENGTH) + "…";
            // 纯文本里可能残留作者写的原始 <script> 等，做 HTML 转义，双保险
            return escapeHtml(text);
        } catch (RuntimeException e) {
            String t = markdown.replaceAll("\\s+", " ").trim();
            t = t.length() <= SUMMARY_LENGTH ? t : t.substring(0, SUMMARY_LENGTH) + "…";
            return escapeHtml(t);
        }
    }
}
