package com.tongsheng.blog.service;

import com.tongsheng.blog.config.AdminProperties;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 管理端防暴力登录（内存方案）：连续失败 N 次锁定 M 分钟
 *
 * <p>按「用户名 + IP」计数。isLocked 只做判断、不删除计数，
 * 计数在 recordFailure 中维护：距上次失败超过一个窗口期则重新计数，
 * 达到阈值后锁定 loginLockMinutes 分钟，登录成功时 reset 清除。
 */
@Service
public class LoginAttemptService {

    private record Attempt(int count, long lastFailureMs, long lockUntilMs) {
    }

    private final AdminProperties props;
    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public LoginAttemptService(AdminProperties props) {
        this.props = props;
    }

    /** 该 key 当前是否处于锁定中 */
    public boolean isLocked(String key) {
        Attempt attempt = attempts.get(key);
        return attempt != null && attempt.lockUntilMs() > System.currentTimeMillis();
    }

    /** 剩余锁定秒数（未锁定返回 0） */
    public long remainingLockSeconds(String key) {
        Attempt attempt = attempts.get(key);
        if (attempt != null && attempt.lockUntilMs() > System.currentTimeMillis()) {
            return (attempt.lockUntilMs() - System.currentTimeMillis()) / 1000;
        }
        return 0;
    }

    /** 记录一次登录失败 */
    public void recordFailure(String key) {
        long now = System.currentTimeMillis();
        Attempt current = attempts.get(key);
        // 已锁定中，计数不再变化
        if (current != null && current.lockUntilMs() > now) {
            return;
        }
        long windowMs = props.getLoginLockMinutes() * 60_000L;
        int count;
        if (current == null || now - current.lastFailureMs() > windowMs) {
            // 首次失败或超过窗口期，重新计数
            count = 1;
        } else {
            count = current.count() + 1;
        }
        if (count >= props.getLoginFailLimit()) {
            attempts.put(key, new Attempt(count, now, now + windowMs));
        } else {
            attempts.put(key, new Attempt(count, now, 0));
        }
    }

    /** 登录成功清除记录 */
    public void reset(String key) {
        attempts.remove(key);
    }
}
