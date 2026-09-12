package com.tongsheng.blog.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 回执查询限流配置（内存按 IP）
 */
@Data
@Component
@ConfigurationProperties(prefix = "tracking")
public class TrackingProperties {

    /** 时间窗口内最多查询次数 */
    private int rateLimitCount = 30;

    /** 时间窗口（分钟） */
    private int rateLimitMinutes = 1;
}
