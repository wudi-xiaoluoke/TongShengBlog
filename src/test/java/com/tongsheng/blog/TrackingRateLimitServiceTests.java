package com.tongsheng.blog;

import com.tongsheng.blog.config.TrackingProperties;
import com.tongsheng.blog.service.TrackingRateLimitService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 回执查询限流纯单测（直接 new 服务实例，不依赖 Spring 容器）
 */
class TrackingRateLimitServiceTests {

    @Test
    void blocksAfterExceedingWindowCount() {
        TrackingProperties props = new TrackingProperties();
        TrackingRateLimitService service = new TrackingRateLimitService(props);
        for (int i = 0; i < 30; i++) {
            assertTrue(service.allow("1.1.1.1"), "第 " + (i + 1) + " 次应在限流内");
        }
        assertFalse(service.allow("1.1.1.1"), "第 31 次应被拦截");
    }

    @Test
    void differentIpIsIndependent() {
        TrackingProperties props = new TrackingProperties();
        TrackingRateLimitService service = new TrackingRateLimitService(props);
        for (int i = 0; i < 30; i++) {
            service.allow("2.2.2.2");
        }
        assertTrue(service.allow("3.3.3.3"), "不同 IP 互不影响");
    }
}
