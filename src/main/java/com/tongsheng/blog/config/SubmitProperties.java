package com.tongsheng.blog.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 投稿限流配置（内存按 IP）
 */
@Data
@Component
@ConfigurationProperties(prefix = "submit")
public class SubmitProperties {

    /** 时间窗口内最多投稿条数 */
    private int rateLimitCount = 5;

    /** 时间窗口（分钟） */
    private int rateLimitMinutes = 5;
}
